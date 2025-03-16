const { escapeMarkdown, sendSafeMessage } = require('../utils/textUtils');

/**
 * Handles generic website content
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {number} chatId - Chat ID to send content to
 * @param {string} url - Original URL
 * @param {object} data - Scraped website data
 * @returns {Promise<void>}
 */
async function handleGenericWebsite(bot, chatId, url, data) {
  try {
    // Create keyboard markup with URL
    const keyboard = {
      inline_keyboard: [
        [{ text: '🌐 Open Website', url: url }]
      ]
    };
    
    let message = '';
    
    // Title in bold
    if (data.title) {
      message += `*${escapeMarkdown(data.title)}*`; 
    }
    
    // Only add content if it's not a placeholder
    if (data.content && !data.content.startsWith('Content from')) {
      message += `\n\n${data.content}`;
    }
    
    // Send message if we have content
    if (message.trim()) {
      await sendSafeMessage(bot, chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } else {
      await sendSafeMessage(bot, chatId, "Website information retrieved", {
        reply_markup: keyboard
      });
    }
    
    console.log('✅ Generic content sent successfully');
  } catch (error) {
    console.error(`❌ Generic handler error: ${error.message}`);
    throw error;
  }
}

module.exports = { handleGenericWebsite };