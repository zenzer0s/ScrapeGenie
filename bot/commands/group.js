module.exports = {
  // Process all unprocessed messages in the group
  process: async (bot, msg, groupProcessor) => {
    const chatId = msg.chat.id;
    
    if (!groupProcessor || !groupProcessor.groupInfo) {
      await bot.sendMessage(
        chatId,
        "⚠️ Group processing is not configured. Please ensure:\n\n" +
        "1. A group named 'ScrapeGenie Links' exists\n" +
        "2. This bot is a member of the group"
      );
      return true;
    }
    
    await bot.sendMessage(
      chatId,
      "🔍 Checking for unprocessed messages in the group..."
    );
    
    const processedCount = await groupProcessor.processUnprocessedMessages();
    
    if (processedCount > 0) {
      await bot.sendMessage(
        chatId,
        `✅ Found and processing ${processedCount} links from the group.`
      );
    } else {
      await bot.sendMessage(
        chatId,
        "📭 No unprocessed links found in the group."
      );
    }
    
    return true;
  }
};