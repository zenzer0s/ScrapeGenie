const fs = require('fs');
const { escapeMarkdown } = require('../utils/textUtils');

/**
 * Handles YouTube content
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {number} chatId - Chat ID to send content to
 * @param {string} url - Original YouTube URL
 * @param {object} data - Scraped YouTube data
 * @returns {Promise<void>}
 */
async function handleYoutube(bot, chatId, url, data) {
  try {
    // Create keyboard markup with URL
    const keyboard = {
      inline_keyboard: [
        [{ text: '🎬 Watch on YouTube', url: url }]
      ]
    };
    
    if (data.filepath) {
      const caption = `*${escapeMarkdown(data.title || '')}*`;
      
      if (!fs.existsSync(data.filepath)) {
        throw new Error(`Video file not found at: ${data.filepath}`);
      }
      
      console.log('📹 Sending YouTube video...');
      await bot.sendVideo(chatId, data.filepath, {
        caption: caption,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } else {
      const caption = `*${escapeMarkdown(data.title || 'YouTube Video')}*`;
      
      if (data.mediaUrl) {
        await bot.sendPhoto(chatId, data.mediaUrl, { 
          caption: caption, 
          parse_mode: 'Markdown',
          reply_markup: keyboard 
        });
      } else {
        await bot.sendMessage(chatId, caption, { 
          parse_mode: 'Markdown',
          reply_markup: keyboard 
        });
      }
    }
    
    console.log('✅ YouTube content sent successfully');
  } catch (error) {
    console.error(`❌ YouTube handler error: ${error.message}`);
    throw error;
  }
}

module.exports = { handleYoutube };