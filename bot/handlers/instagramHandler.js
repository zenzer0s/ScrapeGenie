const fs = require('fs');
const { cleanupInstagramText } = require('../utils/textUtils');

/**
 * Handles Instagram content
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {number} chatId - Chat ID to send content to
 * @param {string} url - Original Instagram URL
 * @param {object} data - Scraped Instagram data
 * @returns {Promise<void>}
 */
async function handleInstagram(bot, chatId, url, data) {
  try {
    const mediaPath = data.mediaPath;
    let caption = data.caption || '';
    const isVideo = data.is_video || false;
    const isCarousel = data.is_carousel || false;
    
    console.log(`📂 Instagram media path:`, mediaPath);
    console.log(`🎬 Is video: ${isVideo}, Is carousel: ${isCarousel}`);
    
    // Create keyboard markup with URL
    const keyboard = {
      inline_keyboard: [
        [{ text: '📱 Open in Instagram', url: url }]
      ]
    };
    
    // Handle carousel posts (multiple images)
    if (isCarousel && Array.isArray(mediaPath) && mediaPath.length > 0) {
      console.log(`🖼️ Sending carousel with ${mediaPath.length} images...`);
      
      // Split mediaPath into chunks of 6 images each
      const mediaChunks = [];
      for (let i = 0; i < mediaPath.length; i += 6) {
        mediaChunks.push(mediaPath.slice(i, i + 6));
      }
      
      for (const chunk of mediaChunks) {
        // Prepare media group format for Telegram
        const mediaGroup = chunk.map((filePath) => {
          if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ File not found: ${filePath}`);
            return null;
          }
          
          return {
            type: 'photo',
            media: fs.createReadStream(filePath),
            parse_mode: 'HTML'
          };
        }).filter(Boolean); // Remove any nulls from non-existent files
        
        if (mediaGroup.length === 0) {
          throw new Error('No valid files found in carousel');
        }
        
        // Send as media group
        await bot.sendMediaGroup(chatId, mediaGroup);
      }
      
      // Send caption separately if there are more than 6 images
      if (mediaPath.length > 6) {
        await bot.sendMessage(chatId, caption, { parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        // Send button separately since media groups don't support inline keyboards
        await bot.sendMessage(chatId, '📱 View original post:', {
          reply_markup: keyboard
        });
      }
      
    } else if (isVideo) {
      // Single video
      if (!fs.existsSync(mediaPath)) {
        throw new Error(`Video file not found at: ${mediaPath}`);
      }
      
      console.log('📹 Sending Instagram video...');
      await bot.sendVideo(chatId, mediaPath, {
        caption: caption.length <= 1024 ? caption : '',
        reply_markup: keyboard
      });
      
      // Send caption separately if it's too long
      if (caption.length > 1024) {
        await bot.sendMessage(chatId, caption, { parse_mode: 'HTML' });
      }
      
    } else {
      // Single image
      if (!fs.existsSync(mediaPath)) {
        throw new Error(`Image file not found at: ${mediaPath}`);
      }
      
      console.log('🖼️ Sending Instagram image...');
      await bot.sendPhoto(chatId, mediaPath, {
        caption: caption.length <= 1024 ? caption : '',
        reply_markup: keyboard
      });
      
      // Send caption separately if it's too long
      if (caption.length > 1024) {
        await bot.sendMessage(chatId, caption, { parse_mode: 'HTML' });
      }
    }
    
    console.log('✅ Instagram content sent successfully');
  } catch (error) {
    console.error(`❌ Instagram handler error: ${error.message}`);
    throw error;
  }
}

module.exports = { handleInstagram };