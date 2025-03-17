// Create this new file:

const { extractUrls } = require('../utils/urlUtils');
const { createBatch, submitBatch } = require('../batch/batchProcessor');
const stepLogger = require('../utils/stepLogger');

/**
 * Process URLs from forwarded messages
 */
module.exports = async (bot, msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Check if we have any forwarded messages in the last 5 messages
  await bot.sendMessage(
    chatId,
    "🔍 Please forward me messages with links that you want to process.\n\n" +
    "When you're done forwarding messages, send /collect to process all the links."
  );
  
  // Store the command for reference
  global.pendingCollections = global.pendingCollections || {};
  global.pendingCollections[userId] = {
    chatId,
    messages: [],
    timestamp: Date.now()
  };
  
  stepLogger.info('PROCESS_COMMAND_INVOKED', { chatId, userId });
  return true;
};