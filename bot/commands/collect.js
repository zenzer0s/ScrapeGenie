// Create this new file:

const { extractUrls } = require('../utils/urlUtils');
const { createBatch, submitBatch } = require('../batch/batchProcessor');
const stepLogger = require('../utils/stepLogger');

/**
 * Collect and process URLs from recently forwarded messages
 */
module.exports = async (bot, msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Check if we have a pending collection for this user
  if (!global.pendingCollections || !global.pendingCollections[userId]) {
    await bot.sendMessage(
      chatId,
      "⚠️ You need to start the collection process first. Use /process to begin."
    );
    return true;
  }
  
  const collection = global.pendingCollections[userId];
  
  // Check if we have any messages
  if (collection.messages.length === 0) {
    await bot.sendMessage(
      chatId,
      "⚠️ No forwarded messages found. Please forward messages with links first, then use /collect."
    );
    return true;
  }
  
  stepLogger.info('COLLECT_COMMAND_INVOKED', { 
    chatId, 
    userId,
    messageCount: collection.messages.length 
  });
  
  // Extract URLs from all messages
  const allUrls = [];
  
  for (const text of collection.messages) {
    const urls = extractUrls(text);
    allUrls.push(...urls);
  }
  
  if (allUrls.length === 0) {
    await bot.sendMessage(
      chatId,
      "⚠️ No URLs found in the forwarded messages."
    );
    return true;
  }
  
  // Create and process batch
  await bot.sendMessage(
    chatId,
    `🔍 Found ${allUrls.length} links in ${collection.messages.length} messages. Processing as a batch...`
  );
  
  const batchId = await createBatch(allUrls, chatId, userId);
  await submitBatch(batchId, bot);
  
  // Clear the collection
  delete global.pendingCollections[userId];
  
  return true;
};