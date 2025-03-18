const { v4: uuidv4 } = require('uuid');
const { callScrapeApi } = require('../services/apiService');
const { routeContent } = require('../handlers/contentRouter');
const { truncateUrl } = require('../utils/urlUtils');
const stepLogger = require('../utils/stepLogger');

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
  const batchId = uuidv4();
  
  // Create batch structure
  const batch = {
    id: batchId,
    chatId,
    userId,
    createdAt: new Date(),
    statusMessageId: null,
    links: links.map((url, index) => ({
      url,
      index,
      status: 'pending',
      data: null,
      error: null
    })),
    stats: {
      total: links.length,
      pending: links.length,
      completed: 0,
      failed: 0
    }
  };
  
  // Store batch
  activeBatches.set(batchId, batch);
  
  stepLogger.info('BATCH_CREATED', { 
    batchId, 
    chatId, 
    linkCount: links.length 
  });
  
  return batchId;
}

/**
 * Submit a batch for processing
 * @param {string} batchId - The batch ID
 * @param {Object} bot - Telegram bot instance
 */
async function submitBatch(batchId, bot) {
  stepLogger.info('SUBMIT_BATCH_START', { batchId });
  
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
    
    stepLogger.info('BATCH_STATUS_CREATED', { 
      batchId, 
      statusMessageId: statusMessage.message_id 
    });
    
    // Process links directly, one by one
    processBatchItems(bot, batchId);
    
    stepLogger.info('SUBMIT_BATCH_COMPLETE', { batchId });
    return true;
  } catch (error) {
    stepLogger.error('SUBMIT_BATCH_FAILED', { 
      batchId, 
      error: error.message 
    });
    
    // Try to notify user
    await bot.sendMessage(
      batch.chatId,
      `❌ Error starting batch processing: ${error.message}`
    );
    
    // Clean up
    activeBatches.delete(batchId);
    throw error;
  }
}

/**
 * Process all batch items sequentially
 * @param {Object} bot - Telegram bot instance
 * @param {string} batchId - The batch ID
 */
async function processBatchItems(bot, batchId) {
  const batch = activeBatches.get(batchId);
  if (!batch) return;
  
  for (let i = 0; i < batch.links.length; i++) {
    try {
      await processBatchItem(bot, batchId, i);
      // Small delay between items to avoid rate limiting
      if (i < batch.links.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      stepLogger.error('BATCH_ITEM_PROCESS_FAILED', {
        batchId,
        index: i,
        error: error.message
      });
      // Continue with next item even if this one failed
    }
  }
  
  // Final status update
  updateStatusMessage(bot, batch);
  
  // Keep batch info for 1 hour then delete
  setTimeout(() => {
    activeBatches.delete(batchId);
    stepLogger.info('BATCH_CLEANUP', { batchId });
  }, 60 * 60 * 1000);
}

/**
 * Process a single batch item
 * @param {Object} bot - Telegram bot instance
 * @param {string} batchId - The batch ID
 * @param {number} index - Item index
 */
async function processBatchItem(bot, batchId, index) {
  const batch = activeBatches.get(batchId);
  if (!batch) return;
  
  const linkObj = batch.links[index];
  linkObj.status = 'processing';
  
  stepLogger.info('PROCESS_BATCH_ITEM_START', { 
    batchId, 
    index, 
    url: linkObj.url.substring(0, 50) 
  });
  
  updateStatusMessage(bot, batch);
  
  try {
    const data = await callScrapeApi(linkObj.url, batch.userId);
    
    // Update batch status
    linkObj.status = 'completed';
    linkObj.data = data;
    batch.stats.pending--;
    batch.stats.completed++;
    
    updateStatusMessage(bot, batch);
    
    stepLogger.success('PROCESS_BATCH_ITEM_SUCCESS', {
      batchId,
      index,
      url: linkObj.url.substring(0, 50)
    });
    
    // Route content
    await routeContent(bot, batch.chatId, linkObj.url, data);
  } catch (error) {
    linkObj.status = 'failed';
    linkObj.error = error.message;
    batch.stats.pending--;
    batch.stats.failed++;
    
    stepLogger.error('PROCESS_BATCH_ITEM_FAILED', {
      batchId,
      index,
      url: linkObj.url.substring(0, 50),
      error: error.message
    });
    
    updateStatusMessage(bot, batch);
  }
}

/**
 * Update batch item status (compatibility function)
 * @param {Object} bot - Telegram bot instance
 * @param {string} batchId - The batch ID
 * @param {number} index - Item index
 * @param {Object} dataOrError - API response data or error
 * @param {boolean} success - Whether the operation was successful
 */
async function updateBatchItemStatus(bot, batchId, index, dataOrError, success) {
  const batch = activeBatches.get(batchId);
  if (!batch) return;
  
  const linkObj = batch.links[index];
  
  if (success) {
    linkObj.status = 'completed';
    linkObj.data = dataOrError;
    batch.stats.pending--;
    batch.stats.completed++;
  } else {
    linkObj.status = 'failed';
    linkObj.error = dataOrError.message || 'Unknown error';
    batch.stats.pending--;
    batch.stats.failed++;
  }
  
  updateStatusMessage(bot, batch);
}

/**
 * Update the status message
 * @param {Object} bot - Telegram bot instance
 * @param {Object} batch - Batch object
 */
function updateStatusMessage(bot, batch) {
  if (!batch.statusMessageId) return;
  
  const message = generateStatusMessage(batch);
  
  bot.editMessageText(message, {
    chat_id: batch.chatId,
    message_id: batch.statusMessageId,
    parse_mode: 'Markdown'
  }).catch(err => {
    stepLogger.debug('STATUS_UPDATE_FAILED', { 
      batchId: batch.id, 
      error: err.message 
    });
  });
}

/**
 * Generate status message for batch
 * @param {Object} batch - Batch object
 * @returns {string} Status message
 */
function generateStatusMessage(batch) {
  const { stats } = batch;
  
  let message = `📋 *Batch Processing*\n\n` +
    `Links: ${stats.total} total\n` +
    `✅ Completed: ${stats.completed}\n` +
    `⏳ Pending: ${stats.pending}\n` +
    `❌ Failed: ${stats.failed}\n\n` +
    `🔄 Progress: ${Math.round((stats.completed + stats.failed) / stats.total * 100)}%\n\n`;
  
  // Add link status
  message += `📝 *Links Status:*\n`;
  
  batch.links.forEach((linkObj, idx) => {
    const statusEmoji = 
      linkObj.status === 'completed' ? '✅' :
      linkObj.status === 'failed' ? '❌' :
      linkObj.status === 'processing' ? '⏳' : '⏳';
    
    const truncatedUrl = truncateUrl(linkObj.url);
    message += `${statusEmoji} ${idx + 1}. ${truncatedUrl}\n`;
  });
  
  return message;
}

module.exports = {
  createBatch,
  submitBatch,
  updateBatchItemStatus
};