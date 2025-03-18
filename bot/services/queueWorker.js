const queueService = require('./queueService');
const { callScrapeApi } = require('./apiService');
const { routeContent } = require('../handlers/contentRouter');
const { updateBatchItemStatus } = require('../batch/batchProcessor');
const stepLogger = require('../utils/stepLogger');

/**
 * Initialize the queue processor with the bot instance
 * @param {TelegramBot} bot - The Telegram bot instance
 * @returns {Promise<Object>} The queue processor controller
 */
async function initQueueProcessor(bot) {
  stepLogger.info('QUEUE_PROCESSOR_INIT_START');
  
  // Ensure queue is ready
  if (!queueService.isQueueEnabled()) {
    stepLogger.warn('QUEUE_NOT_ENABLED', { attemptingInit: true });
    const initialized = await queueService.initQueue();
    
    if (!initialized) {
      stepLogger.error('QUEUE_PROCESSOR_INIT_FAILED', { reason: 'queue_unavailable' });
      return { isRunning: () => false };
    }
  }
  
  // Make sure we have a valid queue
  if (!queueService.linkQueue) {
    stepLogger.error('QUEUE_PROCESSOR_INIT_FAILED', { reason: 'queue_undefined_after_init' });
    return { isRunning: () => false };
  }
  
  try {
    // Set up job processor with concurrency 1 to ensure strict ordering
    queueService.linkQueue.process(1, async (job) => {
      const { url, chatId, userId, messageId } = job.data;
      const batchInfo = typeof messageId === 'object' ? messageId : null;
      const jobStart = Date.now();
      
      stepLogger.info('PROCESS_JOB_START', { 
        jobId: job.id, 
        url: url.substring(0, 100), // Truncate very long URLs
        chatId, 
        batchId: batchInfo?.batchId || 'none' 
      });
      
      try {
        // Handle batch jobs
        if (batchInfo && batchInfo.updateStatus) {
          return await processBatchJob(bot, job, batchInfo, userId);
        } else {
          // Handle regular jobs
          return await processRegularJob(bot, job);
        }
      } catch (error) {
        const elapsed = Date.now() - jobStart;
        
        stepLogger.error('PROCESS_JOB_FAILED', { 
          jobId: job.id, 
          url: url.substring(0, 100),
          elapsed,
          error: error.message 
        });
        
        // Only handle error notifications for non-batch jobs
        if (!batchInfo) {
          await sendErrorNotification(bot, chatId, messageId, error);
        }
        
        throw error; // Let Bull know the job failed
      }
    });
    
    stepLogger.success('QUEUE_PROCESSOR_INIT_SUCCESS');
    return { isRunning: () => true };
    
  } catch (error) {
    stepLogger.error('QUEUE_PROCESSOR_INIT_FAILED', { error: error.message });
    return { isRunning: () => false };
  }
}

/**
 * Process a batch job
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {Object} job - Queue job
 * @param {Object} batchInfo - Batch information
 * @param {string|number} userId - User ID
 * @returns {Promise<Object>} Job result
 */
async function processBatchJob(bot, job, batchInfo, userId) {
  const { url } = job.data;
  const { batchId, index } = batchInfo;
  const jobStart = Date.now();
  
  try {
    // Call API
    const data = await callScrapeApi(url, userId);
    
    // Update batch status
    await updateBatchItemStatus(bot, batchId, index, data, true);
    
    const elapsed = Date.now() - jobStart;
    stepLogger.success('PROCESS_BATCH_ITEM_SUCCESS', { 
      jobId: job.id, 
      url: url.substring(0, 100),
      batchId,
      index,
      elapsed
    });
    
    return { success: true, url, batchId, index };
  } catch (error) {
    // Update batch status with error
    await updateBatchItemStatus(bot, batchId, index, error, false);
    
    stepLogger.error('PROCESS_BATCH_ITEM_FAILED', { 
      jobId: job.id, 
      url: url.substring(0, 100), 
      batchId,
      index,
      error: error.message 
    });
    
    throw error; // Let Bull know the job failed
  }
}

/**
 * Process a regular (non-batch) job
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {Object} job - Queue job
 * @returns {Promise<Object>} Job result
 */
async function processRegularJob(bot, job) {
  const { url, chatId, userId, messageId } = job.data;
  const jobStart = Date.now();
  
  try {
    // Update the processing message if needed
    if (messageId && typeof messageId === 'number') {
      await updateProcessingMessage(bot, chatId, messageId);
    }
    
    // Call API and process content
    const data = await callScrapeApi(url, userId);
    
    // Clean up processing message
    if (messageId && typeof messageId === 'number') {
      await deleteMessage(bot, chatId, messageId);
    }
    
    // Route content to appropriate handler
    await routeContent(bot, chatId, url, data);
    
    const elapsed = Date.now() - jobStart;
    stepLogger.success('PROCESS_JOB_SUCCESS', { 
      jobId: job.id, 
      url: url.substring(0, 100),
      elapsed
    });
    
    return { success: true };
  } catch (error) {
    throw error; // Let the main error handler deal with it
  }
}

/**
 * Update processing message
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {string|number} chatId - Chat ID
 * @param {number} messageId - Message ID
 */
async function updateProcessingMessage(bot, chatId, messageId) {
  try {
    await bot.editMessageText(
      `⏳ Processing your link...`,
      { chat_id: chatId, message_id: messageId }
    );
  } catch (error) {
    // Ignore message update errors
    stepLogger.debug('UPDATE_MESSAGE_FAILED', { 
      chatId, 
      messageId, 
      error: error.message 
    });
  }
}

/**
 * Delete a message
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {string|number} chatId - Chat ID
 * @param {number} messageId - Message ID
 */
async function deleteMessage(bot, chatId, messageId) {
  try {
    await bot.deleteMessage(chatId, messageId);
  } catch (error) {
    // Ignore deletion errors
    stepLogger.debug('DELETE_MESSAGE_FAILED', { 
      chatId, 
      messageId, 
      error: error.message 
    });
  }
}

/**
 * Send error notification to user
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {string|number} chatId - Chat ID
 * @param {number|null} messageId - Message ID or null
 * @param {Error} error - Error object
 */
async function sendErrorNotification(bot, chatId, messageId, error) {
  try {
    if (messageId && typeof messageId === 'number') {
      await bot.editMessageText(
        `❌ Error: ${error.message}`,
        { chat_id: chatId, message_id: messageId }
      );
    } else {
      await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
  } catch (err) {
    // Fallback error notification
    try {
      await bot.sendMessage(chatId, `❌ Error processing your link`);
    } catch (finalErr) {
      stepLogger.warn('ERROR_NOTIFICATION_FAILED', { 
        chatId, 
        error: finalErr.message 
      });
    }
  }
}

module.exports = { initQueueProcessor };