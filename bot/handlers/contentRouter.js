const { handleInstagram } = require('./instagramHandler');
const { handleYoutube } = require('./youtubeHandler');
const { handlePinterest } = require('./pinterestHandler');
const { handleGenericWebsite } = require('./genericHandler');

/**
 * Routes content to the appropriate handler based on URL/content type
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {number} chatId - Chat ID to send content to
 * @param {string} url - Original URL
 * @param {object} data - API response data
 * @returns {Promise<void>}
 */
async function routeContent(bot, chatId, url, data) {
  try {
    // Check what type of content we're dealing with
    const isInstagramUrl = url.includes('instagram.com') || url.includes('instagr.am');
    const isPinterestUrl = url.includes('pinterest.com') || url.includes('pin.it');
    const isYoutubeUrl = url.includes('youtube.com') || url.includes('youtu.be');
    
    if (isInstagramUrl) {
      await handleInstagram(bot, chatId, url, data);
    } else if (isYoutubeUrl || data.type === 'youtube') {
      await handleYoutube(bot, chatId, url, data);
    } else if (isPinterestUrl || data.type === 'pinterest') {
      await handlePinterest(bot, chatId, url, data);
    } else {
      await handleGenericWebsite(bot, chatId, url, data);
    }
  } catch (error) {
    console.error(`❌ Content routing error: ${error.message}`);
    throw error;
  }
}

module.exports = { routeContent };