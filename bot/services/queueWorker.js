const { linkQueue, isQueueEnabled, initQueue } = require('./queueService');
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
  console.log("🔄 Initializing link processing queue...");
  
  // Ensure queue is ready
  if (!isQueueEnabled()) {
    console.log("⚠️ Queue not enabled. Attempting initialization...");
    const initialized = await initQueue();
    
    if (!initialized) {
      console.error("❌ Queue initialization failed.");
      return { isRunning: () => false };
    }
  }
  
  try {
    // Set up job processor with concurrency 1 to ensure strict ordering
    linkQueue.process(1, async (job) => {
      const { url, chatId, userId, messageId } = job.data;
      const batchInfo = typeof messageId === 'object' ? messageId : null;
      
      stepLogger.info('PROCESS_JOB_START', { 
        jobId: job.id, 
        url, 
        chatId, 
        batchId: batchInfo?.batchId || 'none' 
      });
      
      console.log(`🔄 Processing queued link: ${url} for chat ${chatId}`);
      
      try {
        // Handle batch status updates
        if (batchInfo && batchInfo.updateStatus) {
          // This is a batch job, update status
          const { batchId, index } = batchInfo;
          
          try {
            // Call API
            const data = await callScrapeApi(url, userId);
            
            // Update batch status
            await updateBatchItemStatus(bot, batchId, index, data, true);
            
            stepLogger.info('PROCESS_JOB_SUCCESS', { 
              jobId: job.id, 
              url,
              batchId: batchInfo?.batchId || 'none'
            });
            
            return { success: true, url, batchId, index };
          } catch (error) {
            console.error(`❌ Job processing error: ${error.message}`);
            
            // Update batch status with error
            await updateBatchItemStatus(bot, batchId, index, error, false);
            
            stepLogger.error('PROCESS_JOB_FAILED', { 
              jobId: job.id, 
              url, 
              error: error.message 
            });
            
            throw error; // Let Bull know the job failed
          }
        } else {
          // Regular job (not batch)
          // Update the processing message if needed
          if (messageId && typeof messageId === 'number') {
            try {
              await bot.editMessageText(
                `⏳ Processing your link...`,
                { chat_id: chatId, message_id: messageId }
              );
            } catch (err) {
              // Ignore message update errors
            }
          }
          
          // Call API and process content
          const data = await callScrapeApi(url, userId);
          
          // Clean up processing message
          if (messageId && typeof messageId === 'number') {
            try {
              await bot.deleteMessage(chatId, messageId);
            } catch (err) {
              // Ignore deletion errors
            }
          }
          
          // Route content to appropriate handler
          await routeContent(bot, chatId, url, data);
          
          stepLogger.info('PROCESS_JOB_SUCCESS', { 
            jobId: job.id, 
            url,
            batchId: batchInfo?.batchId || 'none'
          });
          
          return { success: true };
        }
      } catch (error) {
        console.error(`❌ Job processing error: ${error.message}`);
        
        stepLogger.error('PROCESS_JOB_FAILED', { 
          jobId: job.id, 
          url, 
          error: error.message 
        });
        
        // Only handle non-batch jobs here
        if (!batchInfo) {
          // Notify user of error
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
              // Giving up on notification
            }
          }
        }
        
        throw error; // Let Bull know the job failed
      }
    });
    
    console.log("✅ Queue processor initialized");
    return { isRunning: () => true };
    
  } catch (error) {
    console.error(`❌ Queue processor initialization error: ${error.message}`);
    return { isRunning: () => false };
  }
}

module.exports = { initQueueProcessor };