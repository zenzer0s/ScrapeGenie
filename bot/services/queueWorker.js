const { linkQueue } = require('./queueService');
const { callScrapeApi } = require('./apiService');
const { routeContent } = require('../handlers/contentRouter');

/**
 * Initialize the queue processor with the bot instance
 * @param {TelegramBot} bot - The Telegram bot instance
 */
function initQueueProcessor(bot) {
  console.log("🔄 Initializing link processing queue...");
  
  // Process queue with controlled concurrency (2 jobs at a time)
  linkQueue.process(2, async (job) => {
    const { url, chatId, userId, messageId } = job.data;
    
    console.log(`🔄 Processing queued link: ${url} for chat ${chatId}`);
    
    try {
      // Update the processing message
      if (messageId) {
        try {
          await bot.editMessageText(
            `⏳ Now processing your link: ${url}`,
            { chat_id: chatId, message_id: messageId }
          );
        } catch (err) {
          // Message might be deleted or too old, ignore
          console.log(`Couldn't update message: ${err.message}`);
        }
      }
      
      // Call the API
      const data = await callScrapeApi(url, userId);
      
      // Delete processing message if it exists
      if (messageId) {
        try {
          await bot.deleteMessage(chatId, messageId);
        } catch (err) {
          // Message might be already deleted, ignore
          console.log(`Couldn't delete message: ${err.message}`);
        }
      }
      
      // Send a new message indicating we're done
      await bot.sendMessage(chatId, `✅ Processing complete for your link: ${url}`);
      
      // Route the content to the appropriate handler
      await routeContent(bot, chatId, url, data);
      
      return { success: true, url };
      
    } catch (error) {
      console.error(`❌ Queue processing error: ${error.message}`);
      
      // Try to update the message if it exists
      if (messageId) {
        try {
          await bot.editMessageText(
            `❌ Error processing your link: ${error.message}`,
            { chat_id: chatId, message_id: messageId }
          );
        } catch (err) {
          // Message might be deleted or too old, try sending a new one
          await bot.sendMessage(chatId, `❌ Error processing your link: ${error.message}`);
        }
      } else {
        // No message ID, send a new message
        await bot.sendMessage(chatId, `❌ Error processing your link: ${error.message}`);
      }
      
      throw error; // Let Bull know the job failed
    }
  });
  
  console.log("✅ Queue processor initialized");
}

module.exports = { initQueueProcessor };