const { v4: uuidv4 } = require('uuid');
const { addLinkToQueue, getQueueStats } = require('../services/queueService');
const { callScrapeApi } = require('../services/apiService');
const { routeContent } = require('../handlers/contentRouter');

// Store active batches
const activeBatches = new Map();

/**
 * Create a new batch of links to process
 * @param {Array<string>} links - Array of URLs to process
 * @param {number} chatId - Telegram chat ID
 * @param {number} userId - User ID
 * @returns {string} Batch ID
 */
async function createBatch(links, chatId, userId) {
  // Create a unique batch ID
  const batchId = uuidv4();
  
  // Create batch entry
  const batch = {
    id: batchId,
    chatId,
    userId,
    links: links.map(url => ({
      url,
      status: 'pending', // pending, processing, completed, failed
      result: null,
      error: null,
      processingOrder: 0
    })),
    statusMessageId: null,
    startTime: Date.now(),
    completedCount: 0,
    failedCount: 0
  };
  
  // Store in active batches
  activeBatches.set(batchId, batch);
  
  return batchId;
}

/**
 * Submit a batch to the processing queue
 * @param {string} batchId - The batch ID
 * @param {Object} bot - Telegram bot instance
 */
async function submitBatch(batchId, bot) {
  const batch = activeBatches.get(batchId);
  
  if (!batch) {
    throw new Error(`Batch ${batchId} not found`);
  }
  
  try {
    // Create status message
    const statusMessage = await bot.sendMessage(
      batch.chatId,
      generateStatusMessage(batch)
    );
    
    batch.statusMessageId = statusMessage.message_id;
    
    // Check queue status
    const stats = await getQueueStats();
    const useQueue = stats.status === 'enabled';
    
    // Process links in order
    for (let i = 0; i < batch.links.length; i++) {
      const linkObj = batch.links[i];
      linkObj.processingOrder = i + 1;
      
      if (useQueue) {
        // Add to queue with custom data
        await addLinkToQueue(
          linkObj.url,
          batch.chatId,
          batch.userId,
          {
            batchId,
            index: i,
            updateStatus: true
          }
        );
      } else {
        // Process directly in order
        processBatchItem(bot, batchId, i);
      }
    }
    
    // Update status message
    updateStatusMessage(bot, batch);
    
  } catch (error) {
    console.error(`Error submitting batch ${batchId}:`, error);
    
    // Try to notify user
    await bot.sendMessage(
      batch.chatId,
      `❌ Error starting batch processing: ${error.message}`
    );
    
    // Clean up
    activeBatches.delete(batchId);
  }
}

/**
 * Process a single item in a batch
 * @param {Object} bot - Telegram bot instance
 * @param {string} batchId - Batch ID
 * @param {number} index - Index of the link in the batch
 */
async function processBatchItem(bot, batchId, index) {
  const batch = activeBatches.get(batchId);
  
  if (!batch || index >= batch.links.length) {
    return;
  }
  
  const linkObj = batch.links[index];
  
  try {
    // Update status to processing
    linkObj.status = 'processing';
    updateStatusMessage(bot, batch);
    
    // Call API
    const data = await callScrapeApi(linkObj.url, batch.userId);
    
    // Store result
    linkObj.status = 'completed';
    linkObj.result = data;
    batch.completedCount++;
    
    // Update status message
    updateStatusMessage(bot, batch);
    
    // Check if batch is complete
    if (batch.completedCount + batch.failedCount === batch.links.length) {
      await finalizeBatch(bot, batchId);
    }
    
  } catch (error) {
    console.error(`Error processing batch item:`, error);
    
    // Update status to failed
    linkObj.status = 'failed';
    linkObj.error = error.message;
    batch.failedCount++;
    
    // Update status message
    updateStatusMessage(bot, batch);
    
    // Check if batch is complete
    if (batch.completedCount + batch.failedCount === batch.links.length) {
      await finalizeBatch(bot, batchId);
    }
  }
}

/**
 * Update the status message for a batch
 * @param {Object} bot - Telegram bot instance
 * @param {Object} batch - Batch object
 */
async function updateStatusMessage(bot, batch) {
  if (!batch.statusMessageId) return;
  
  try {
    await bot.editMessageText(
      generateStatusMessage(batch),
      {
        chat_id: batch.chatId,
        message_id: batch.statusMessageId,
        parse_mode: 'HTML'
      }
    );
  } catch (error) {
    console.error(`Error updating status message:`, error);
  }
}

/**
 * Generate a status message for the batch
 * @param {Object} batch - Batch object
 * @returns {string} Formatted status message
 */
function generateStatusMessage(batch) {
  const total = batch.links.length;
  const completed = batch.completedCount;
  const failed = batch.failedCount;
  const pending = total - completed - failed;
  
  let message = `<b>Processing ${total} links</b>\n\n`;
  
  // Add progress bar
  const progress = Math.floor(((completed + failed) / total) * 10);
  const progressBar = '▓'.repeat(progress) + '░'.repeat(10 - progress);
  message += `${progressBar} ${Math.floor(((completed + failed) / total) * 100)}%\n\n`;
  
  // Add counts
  message += `✅ Completed: ${completed}\n`;
  message += `❌ Failed: ${failed}\n`;
  message += `⏳ Pending: ${pending}\n\n`;
  
  // Add details for each link
  batch.links.forEach((link, i) => {
    const statusIcon = {
      'pending': '⏳',
      'processing': '🔄',
      'completed': '✅',
      'failed': '❌'
    }[link.status];
    
    message += `${statusIcon} ${i+1}. ${truncateUrl(link.url)}\n`;
  });
  
  // Add elapsed time
  const elapsed = Math.floor((Date.now() - batch.startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  message += `\n⏱️ Elapsed: ${minutes}m ${seconds}s`;
  
  return message;
}

/**
 * Truncate a URL to a reasonable length
 * @param {string} url - URL to truncate
 * @returns {string} Truncated URL
 */
function truncateUrl(url) {
  if (url.length <= 40) return url;
  return url.substring(0, 37) + '...';
}

/**
 * Finalize a batch and send all results
 * @param {Object} bot - Telegram bot instance
 * @param {string} batchId - Batch ID
 */
async function finalizeBatch(bot, batchId) {
  const batch = activeBatches.get(batchId);
  
  if (!batch) {
    return;
  }
  
  try {
    // Update final status
    await updateStatusMessage(bot, batch);
    
    // Send results
    await bot.sendMessage(
      batch.chatId,
      `✅ Batch processing complete! Sending results...`
    );
    
    // Send each result in order
    for (const link of batch.links) {
      if (link.status === 'completed' && link.result) {
        await routeContent(bot, batch.chatId, link.url, link.result);
      } else if (link.status === 'failed') {
        await bot.sendMessage(
          batch.chatId,
          `❌ Failed to process ${link.url}: ${link.error || 'Unknown error'}`
        );
      }
    }
    
    // Clean up
    activeBatches.delete(batchId);
    
  } catch (error) {
    console.error(`Error finalizing batch ${batchId}:`, error);
    
    // Try to notify user
    await bot.sendMessage(
      batch.chatId,
      `❌ Error finalizing batch: ${error.message}`
    );
    
    // Clean up anyway
    activeBatches.delete(batchId);
  }
}

/**
 * Update batch item status from queue processor
 * @param {Object} bot - Telegram bot instance
 * @param {string} batchId - Batch ID
 * @param {number} index - Index of the link in the batch
 * @param {Object} result - API result or error
 * @param {boolean} success - Whether processing was successful
 */
async function updateBatchItemStatus(bot, batchId, index, result, success) {
  const batch = activeBatches.get(batchId);
  
  if (!batch || index >= batch.links.length) {
    return;
  }
  
  const linkObj = batch.links[index];
  
  if (success) {
    linkObj.status = 'completed';
    linkObj.result = result;
    batch.completedCount++;
  } else {
    linkObj.status = 'failed';
    linkObj.error = result.message || 'Unknown error';
    batch.failedCount++;
  }
  
  // Update status message
  await updateStatusMessage(bot, batch);
  
  // Check if batch is complete
  if (batch.completedCount + batch.failedCount === batch.links.length) {
    await finalizeBatch(bot, batchId);
  }
}

module.exports = {
  createBatch,
  submitBatch,
  processBatchItem,
  updateBatchItemStatus
};