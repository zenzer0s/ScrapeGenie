const fs = require('fs');
const path = require('path');
const { extractUrls } = require('./utils/urlUtils');
const { callScrapeApi } = require('./services/apiService');
const { routeContent } = require('./handlers/contentRouter');
const { createBatch, submitBatch } = require('./batch/batchProcessor');
const stepLogger = require('./utils/stepLogger');
const logger = require('./utils/consoleLogger');

const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || path.join(__dirname, '../downloads');

/**
 * Main message handler
 * @param {TelegramBot} bot - The Telegram bot instance
 * @param {object} msg - Telegram message object
 * @returns {Promise<void>}
 */
async function handleMessage(bot, msg) {
  if (!msg || !msg.text) return;
  
  const urls = extractUrls(msg.text);
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (urls.length === 0) {
    // No URLs found in message
    return;
  }

  stepLogger.info('MESSAGE_RECEIVED', { 
    chatId, 
    urlCount: urls.length 
  });
  
  try {
    // Multiple URLs - use batch processor
    if (urls.length > 1) {
      stepLogger.info('MULTIPLE_URLS_DETECTED', {
        chatId,
        urlCount: urls.length
      });
      
      await bot.sendMessage(chatId, `🔍 Found ${urls.length} links in your message. Processing as a batch...`);
      
      // Create and submit batch
      const batchId = await createBatch(urls, chatId, userId);
      await submitBatch(batchId, bot);
      return;
    }
    
    // Single URL - process directly
    const url = urls[0];
    stepLogger.info('SINGLE_URL_DETECTED', {
      chatId,
      url: url.substring(0, 50) // Truncate for log
    });
    
    // Send processing message
    const processingMsg = await bot.sendMessage(chatId, "⏳ Processing your URL...");
    
    // Show typing animation
    await bot.sendChatAction(chatId, 'typing');
    
    // Process URL directly
    await processUrlDirectly(bot, chatId, url, userId, processingMsg.message_id);
    
  } catch (error) {
    stepLogger.error('MESSAGE_HANDLER_ERROR', { 
      chatId,
      error: error.message 
    });
    await bot.sendMessage(chatId, "❌ Sorry, something went wrong. Please try again later.");
  }
}

/**
 * Process a URL directly
 * @param {TelegramBot} bot - The Telegram bot instance
 * @param {string|number} chatId - Chat ID
 * @param {string} url - URL to process
 * @param {string|number} userId - User ID
 * @param {number} messageId - Processing message ID
 */
async function processUrlDirectly(bot, chatId, url, userId, messageId) {
  try {
    // Update message
    await bot.editMessageText(
      "⚙️ Processing your link...", 
      { chat_id: chatId, message_id: messageId }
    );
    
    stepLogger.info('DIRECT_PROCESSING', {
      chatId,
      url: url.substring(0, 50)
    });
    
    const data = await callScrapeApi(url, userId);
    
    // Delete the processing message
    try {
      await bot.deleteMessage(chatId, messageId);
    } catch (err) {
      // Ignore deletion errors
      stepLogger.debug('DELETE_MESSAGE_FAILED', { chatId, messageId, error: err.message });
    }
    
    // Route content to appropriate handler
    await routeContent(bot, chatId, url, data);
    
    stepLogger.success('URL_PROCESSED', {
      chatId,
      url: url.substring(0, 50)
    });
  } catch (error) {
    stepLogger.error('DIRECT_PROCESSING_ERROR', {
      chatId,
      url: url.substring(0, 50),
      error: error.message
    });
    
    // Update the processing message with the error
    try {
      await bot.editMessageText(
        `❌ Error: ${error.message}`,
        { chat_id: chatId, message_id: messageId }
      );
    } catch (err) {
      // If editing fails, try sending a new message
      await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
  }
}

/**
 * Handles queue status command (compatibility function)
 * @param {TelegramBot} bot - The Telegram bot instance
 * @param {object} msg - Telegram message object
 * @returns {Promise<void>}
 */
async function handleQueueCommand(bot, msg) {
  const chatId = msg.chat.id;
  
  await bot.sendMessage(chatId, 
    `📊 *Queue Status*\n\n` +
    `Direct processing enabled - no queue is being used.`,
    { parse_mode: 'Markdown' }
  );
}

module.exports = { 
  handleMessage,
  handleQueueCommand,
  processUrlDirectly
};