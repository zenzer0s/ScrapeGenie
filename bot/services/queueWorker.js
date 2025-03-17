const { linkQueue, isQueueEnabled, initQueue } = require('./queueService');
const { callScrapeApi } = require('./apiService');
const { routeContent } = require('../handlers/contentRouter');

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
    // Set up job processor
    linkQueue.process(2, async (job) => {
      const { url, chatId, userId, messageId } = job.data;
      console.log(`🔄 Processing queued link: ${url} for chat ${chatId}`);
      
      try {
        // Update the processing message if needed
        if (messageId) {
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
        if (messageId) {
          try {
            await bot.deleteMessage(chatId, messageId);
          } catch (err) {
            // Ignore deletion errors
          }
        }
        
        // Route content to appropriate handler
        await routeContent(bot, chatId, url, data);
        return { success: true };
        
      } catch (error) {
        console.error(`❌ Job processing error: ${error.message}`);
        
        // Notify user of error
        try {
          if (messageId) {
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