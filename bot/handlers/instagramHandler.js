const fs = require('fs');
const { cleanupInstagramText, escapeHtml } = require('../utils/textUtils');
const stepLogger = require('../utils/stepLogger');

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
    stepLogger.info('INSTAGRAM_HANDLER_START', { chatId, url: url.substring(0, 50) });
    
    const mediaPath = data.mediaPath;
    const caption = cleanupInstagramText(data.caption || '');
    const isVideo = data.is_video || false;
    const isCarousel = data.is_carousel || false;
    
    stepLogger.debug('INSTAGRAM_MEDIA_INFO', { 
      mediaType: isVideo ? 'video' : (isCarousel ? 'carousel' : 'image'),
      captionLength: caption.length,
      mediaPath: Array.isArray(mediaPath) ? `${mediaPath.length} items` : mediaPath 
    });
    
    // Create keyboard markup with URL
    const keyboard = {
      inline_keyboard: [
        [{ text: '📱 Open in Instagram', url: url }]
      ]
    };
    
    // Handle carousel posts (multiple images)
    if (isCarousel && Array.isArray(mediaPath) && mediaPath.length > 0) {
      stepLogger.info('INSTAGRAM_CAROUSEL', { itemCount: mediaPath.length });
      
      // Split mediaPath into chunks of 6 images each (Telegram limit)
      const mediaChunks = [];
      for (let i = 0; i < mediaPath.length; i += 6) {
        mediaChunks.push(mediaPath.slice(i, i + 6));
      }
      
      let chunkIndex = 0;
      for (const chunk of mediaChunks) {
        chunkIndex++;
        
        // Prepare media group format for Telegram
        const mediaGroup = chunk.map((filePath) => {
          if (!fs.existsSync(filePath)) {
            stepLogger.warn('INSTAGRAM_FILE_NOT_FOUND', { filePath });
            return null;
          }
          
          return {
            type: 'photo',
            media: fs.createReadStream(filePath),
            parse_mode: 'HTML'
          };
        }).filter(Boolean); // Remove any nulls from non-existent files
        
        if (mediaGroup.length === 0) {
          stepLogger.error('INSTAGRAM_NO_VALID_FILES', { chunkIndex });
          continue; // Skip to next chunk instead of failing completely
        }
        
        // Send as media group
        await bot.sendMediaGroup(chatId, mediaGroup);
        stepLogger.debug('INSTAGRAM_CHUNK_SENT', { 
          chunkIndex, 
          totalChunks: mediaChunks.length,
          itemsInChunk: mediaGroup.length 
        });
      }
      
      // Send caption separately
      if (caption && caption.trim().length > 0) {
        const captionMaxLength = 4000; // Telegram limit
        
        if (caption.length <= captionMaxLength) {
          await bot.sendMessage(chatId, caption, { 
            parse_mode: 'HTML', 
            reply_markup: keyboard 
          });
        } else {
          // Split long captions
          const parts = Math.ceil(caption.length / captionMaxLength);
          
          for (let i = 0; i < parts; i++) {
            const part = caption.substring(i * captionMaxLength, (i + 1) * captionMaxLength);
            
            // Only add keyboard to the last part
            const options = (i === parts - 1) ? 
              { parse_mode: 'HTML', reply_markup: keyboard } : 
              { parse_mode: 'HTML' };
              
            await bot.sendMessage(chatId, part, options);
          }
        }
      } else {
        // Send button separately since media groups don't support inline keyboards
        await bot.sendMessage(chatId, '📱 View original post:', {
          reply_markup: keyboard
        });
      }
      
    } else if (isVideo) {
      // Single video
      if (!fs.existsSync(mediaPath)) {
        stepLogger.error('INSTAGRAM_VIDEO_NOT_FOUND', { mediaPath });
        throw new Error(`Video file not found at: ${mediaPath}`);
      }
      
      stepLogger.info('INSTAGRAM_SEND_VIDEO', { fileSize: getFileSize(mediaPath) });
      
      const captionMaxLength = 1024; // Telegram caption limit
      
      await bot.sendVideo(chatId, fs.createReadStream(mediaPath), {
        caption: caption.length <= captionMaxLength ? caption : '',
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
      
      // Send caption separately if it's too long
      if (caption.length > captionMaxLength) {
        await bot.sendMessage(chatId, caption, { parse_mode: 'HTML' });
      }
      
    } else {
      // Single image
      if (!fs.existsSync(mediaPath)) {
        stepLogger.error('INSTAGRAM_IMAGE_NOT_FOUND', { mediaPath });
        throw new Error(`Image file not found at: ${mediaPath}`);
      }
      
      stepLogger.info('INSTAGRAM_SEND_IMAGE', { fileSize: getFileSize(mediaPath) });
      
      const captionMaxLength = 1024; // Telegram caption limit
      
      await bot.sendPhoto(chatId, fs.createReadStream(mediaPath), {
        caption: caption.length <= captionMaxLength ? caption : '',
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
      
      // Send caption separately if it's too long
      if (caption.length > captionMaxLength) {
        await bot.sendMessage(chatId, caption, { parse_mode: 'HTML' });
      }
    }
    
    // Attempt to clean up temp files
    cleanupMediaFiles(mediaPath);
    
    stepLogger.success('INSTAGRAM_HANDLER_COMPLETE', { chatId });
  } catch (error) {
    stepLogger.error('INSTAGRAM_HANDLER_ERROR', { 
      chatId, 
      url: url.substring(0, 50),
      error: error.message 
    });
    
    // Send a fallback message to the user
    try {
      await bot.sendMessage(
        chatId,
        `Sorry, I couldn't process this Instagram content properly.\n\nError: ${error.message}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📱 Open Original Instagram Post', url: url }]
            ]
          }
        }
      );
    } catch (msgError) {
      stepLogger.error('INSTAGRAM_FALLBACK_FAILED', { chatId, error: msgError.message });
    }
    
    throw error;
  }
}

/**
 * Get file size in MB
 * @param {string} filePath - Path to the file
 * @returns {string} File size in MB
 */
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return (stats.size / (1024 * 1024)).toFixed(2) + ' MB';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Clean up temporary media files
 * @param {string|string[]} mediaPath - Path or array of paths to media files
 */
function cleanupMediaFiles(mediaPath) {
  try {
    if (Array.isArray(mediaPath)) {
      mediaPath.forEach(path => {
        if (fs.existsSync(path)) {
          fs.unlinkSync(path);
        }
      });
    } else if (mediaPath && fs.existsSync(mediaPath)) {
      fs.unlinkSync(mediaPath);
    }
  } catch (error) {
    stepLogger.warn('INSTAGRAM_CLEANUP_ERROR', { error: error.message });
  }
}

module.exports = { handleInstagram };