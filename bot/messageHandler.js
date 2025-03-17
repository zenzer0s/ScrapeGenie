const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { extractUrl } = require('./utils/textUtils');
const { callScrapeApi } = require('./services/apiService');
const { addLinkToQueue, getQueueStats } = require('./services/queueService');
const { routeContent } = require('./handlers/contentRouter');
const { extractUrls } = require('./utils/urlUtils');
const { createBatch, submitBatch } = require('./batch/batchProcessor');
const stepLogger = require('./utils/stepLogger');

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

  if (!url) return;

  try {
    // Send processing message
    const processingMsg = await bot.sendMessage(chatId, "⏳ Processing your URL...");
    
    // Show typing animation
    await bot.sendChatAction(chatId, 'typing');
    
    // Check if we should queue or process directly
    const stats = await getQueueStats();
    const shouldQueue = stats.status === 'enabled' && (stats.waiting > 0 || stats.active >= 2);
    
    if (shouldQueue) {
      try {
        // Update message to indicate queueing
        await bot.editMessageText(
          "🔍 Adding your link to the processing queue...", 
          { chat_id: chatId, message_id: processingMsg.message_id }
        );
        
        // Add to queue
        await addLinkToQueue(url, chatId, userId, processingMsg.message_id);
        
        // Inform about queue position
        await bot.sendMessage(
          chatId, 
          `📊 Your link is #${stats.waiting + 1} in queue and will be processed soon.`
        );
        return;
      } catch (err) {
        console.log("Queue error, falling back to direct processing:", err.message);
      }
    }
    
    // Direct processing
    try {
      await bot.editMessageText(
        "⚙️ Processing your link...", 
        { chat_id: chatId, message_id: processingMsg.message_id }
      );
      
      const data = await callScrapeApi(url, userId);
      await bot.deleteMessage(chatId, processingMsg.message_id);
      await routeContent(bot, chatId, url, data);
      
    } catch (error) {
      console.error("Processing error:", error.message);
      
      // Handle specific errors (e.g., Pinterest auth required) here
      // ...
      
      // Generic error handling
      await bot.editMessageText(
        `❌ Error: ${error.message}`,
        { chat_id: chatId, message_id: processingMsg.message_id }
      );
    }
  } catch (error) {
    console.error(`Critical error: ${error.message}`);
    await bot.sendMessage(chatId, "❌ Sorry, something went wrong. Please try again later.");
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
 * @param {object} groupProcessor - Group message processor
 * @returns {Promise<void>}
 */
async function handleMessage(bot, msg, groupProcessor) {
  // Check if this is a forwarded message and we have a pending collection
  if (msg.forward_date && global.pendingCollections && global.pendingCollections[msg.from.id]) {
    const collection = global.pendingCollections[msg.from.id];
    
    // Add the message text to the collection
    if (msg.text) {
      collection.messages.push(msg.text);
      
      // Send a brief acknowledgment
      await bot.sendMessage(
        msg.chat.id,
        `📌 URL message collected (${collection.messages.length} total)`
      );
    }
    return;
  }

  const urls = extractUrls(msg.text || '');
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (urls.length === 0) {
    // Handle non-URL messages
    return;
  }

  stepLogger.info('MESSAGE_RECEIVED', { 
    chatId, 
    urlCount: urls.length 
  });
  
  try {
    // Check if this message is in our tracked group
    if (groupProcessor && groupProcessor.isGroupChat(chatId)) {
      // Let the group processor handle it
      await groupProcessor.handleGroupMessage(msg);
      return;
    }
    
    // Multiple URLs - use batch processor immediately
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
    
    // Single URL - process as usual
    const url = urls[0];
    stepLogger.info('SINGLE_URL_DETECTED', {
      chatId,
      url
    });
    
    // Send processing message
    const processingMsg = await bot.sendMessage(chatId, "⏳ Processing your URL...");
    
    // Show typing animation
    await bot.sendChatAction(chatId, 'typing');
    
    // Check if we should queue or process directly
    const stats = await getQueueStats();
    const shouldQueue = stats.status === 'enabled' && (stats.waiting > 0 || stats.active >= 1);
    
    if (shouldQueue) {
      // Add to queue
      await addLinkToQueue(url, chatId, userId, processingMsg.message_id);
    } else {
      // Process directly
      try {
        const data = await callScrapeApi(url, userId);
        await bot.deleteMessage(chatId, processingMsg.message_id);
        await routeContent(bot, chatId, url, data);
      } catch (error) {
        await bot.editMessageText(
          `❌ Error: ${error.message}`,
          { chat_id: chatId, message_id: processingMsg.message_id }
        );
      }
    }
  } catch (error) {
    stepLogger.error('MESSAGE_HANDLER_ERROR', { 
      error: error.message 
    });
    await bot.sendMessage(chatId, "❌ Sorry, something went wrong. Please try again later.");
  }
}

module.exports = { 
  handleMessage,
  handleUrlMessage,
  handleQueueCommand
};