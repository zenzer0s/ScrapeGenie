const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { extractUrl } = require('./utils/textUtils');
const { callScrapeApi } = require('./services/apiService');
const { addLinkToQueue, getQueueStats } = require('./services/queueService');
const { routeContent } = require('./handlers/contentRouter');

const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || path.join(__dirname, '../downloads');

/**
 * Handles messages containing URLs
 * @param {TelegramBot} bot - The Telegram bot instance
 * @param {object} msg - Telegram message object
 * @returns {Promise<void>}
 */
async function handleUrlMessage(bot, msg) {
  const url = extractUrl(msg.text);
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!url) {
    return; // No URL found, exit the function
  }

  try {
    // Send "processing" message
    const processingMsg = await bot.sendMessage(chatId, "⏳ Processing your URL...");
    
    // Show typing animation
    await bot.sendChatAction(chatId, 'typing');
    
    // Get queue stats
    const stats = await getQueueStats();
    
    // If queue is busy, add to queue and inform user
    if (stats.waiting > 0 || stats.active >= 2) {
      // Add to queue instead of processing immediately
      await bot.editMessageText(
        "🔍 I've added your link to the processing queue...", 
        { chat_id: chatId, message_id: processingMsg.message_id }
      );
      
      // Add URL to processing queue
      await addLinkToQueue(url, chatId, userId, processingMsg.message_id);
      
      // Inform user about queue position
      await bot.sendMessage(
        chatId, 
        `📊 Your link is #${stats.waiting + 1} in the queue.\n` +
        `I'll process it as soon as possible.`
      );
      
      return;
    }
    
    // If queue is not busy, process immediately
    try {
      // Call API
      const data = await callScrapeApi(url, userId);
      
      // Delete processing message
      await bot.deleteMessage(chatId, processingMsg.message_id);
      
      // Route to appropriate handler
      await routeContent(bot, chatId, url, data);
      
    } catch (error) {
      // Handle Pinterest authentication error
      if (error.response?.status === 401 && 
          error.response.data?.requiresAuth && 
          error.response.data?.service === 'pinterest') {
          
        console.log('🔐 Pinterest authentication required');
        
        await bot.editMessageText(
          "🔐 *Pinterest Login Required*\n\n" +
          "To download content from Pinterest, you need to login first.\n\n" +
          "Please tap the button below to log in, then send your Pinterest link again.",
          {
            chat_id: chatId, 
            message_id: processingMsg.message_id,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔐 Login to Pinterest", callback_data: "pinterest_login" }]
              ]
            }
          }
        );
        return;
      }
      
      // Handle other errors
      console.error(`❌ Error handling URL: ${error.message}`);
      logger.error(`Error handling URL: ${error}`);
      
      await bot.editMessageText(
        `❌ Sorry, I encountered an error processing your request.\nError: ${error.message}`,
        { chat_id: chatId, message_id: processingMsg.message_id }
      );
    }
    
  } catch (error) {
    console.error(`❌ Critical error: ${error.message}`);
    logger.error(`Critical error: ${error}`);
    
    try {
      await bot.sendMessage(chatId, `❌ Sorry, something went wrong. Please try again later.`);
    } catch (sendError) {
      console.error(`Failed to send error message: ${sendError.message}`);
    }
  }
}

/**
 * Handles queue status command
 * @param {TelegramBot} bot - The Telegram bot instance
 * @param {object} msg - Telegram message object
 * @returns {Promise<void>}
 */
async function handleQueueCommand(bot, msg) {
  try {
    const stats = await getQueueStats();
    
    await bot.sendMessage(msg.chat.id, 
      `📊 *Queue Status*\n\n` +
      `• Waiting: ${stats.waiting}\n` +
      `• Processing: ${stats.active}\n` +
      `• Completed: ${stats.completed}\n` +
      `• Failed: ${stats.failed}\n\n` +
      `Total pending: ${stats.total}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error("Error handling queue command:", error);
    await bot.sendMessage(msg.chat.id, "Sorry, I couldn't retrieve queue status.");
  }
}

/**
 * Main message handler
 * @param {TelegramBot} bot - The Telegram bot instance
 * @param {object} msg - Telegram message object
 * @returns {Promise<void>}
 */
async function handleMessage(bot, msg) {
  // Handle commands
  if (msg.text && msg.text.startsWith('/queue')) {
    await handleQueueCommand(bot, msg);
    return;
  }
  
  // Handle URLs
  if (msg.text && extractUrl(msg.text)) {
    await handleUrlMessage(bot, msg);
    return;
  }
  
  // Other message handling can go here
}

module.exports = { 
  handleMessage,
  handleUrlMessage,
  handleQueueCommand
};