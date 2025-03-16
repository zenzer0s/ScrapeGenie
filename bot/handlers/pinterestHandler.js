const { escapeMarkdown } = require('../utils/textUtils');

/**
 * Handles Pinterest content
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {number} chatId - Chat ID to send content to
 * @param {string} url - Original Pinterest URL
 * @param {object} data - Scraped Pinterest data
 * @returns {Promise<void>}
 */
async function handlePinterest(bot, chatId, url, data) {
  try {
    // Create keyboard markup with URL
    const keyboard = {
      inline_keyboard: [
        [{ text: '📌 View on Pinterest', url: url }]
      ]
    };
    
    const caption = data.title ? `*${escapeMarkdown(data.title)}*` : '';
    
    console.log('📌 Sending Pinterest image...');
    await bot.sendPhoto(chatId, data.mediaUrl, {
      caption: caption,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
    console.log('✅ Pinterest content sent successfully');
  } catch (error) {
    console.error(`❌ Pinterest handler error: ${error.message}`);
    throw error;
  }
}

module.exports = { handlePinterest };