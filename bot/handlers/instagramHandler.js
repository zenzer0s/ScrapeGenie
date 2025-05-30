const fs = require('fs');
const { cleanupInstagramText, escapeHtml } = require('../utils/textUtils');
const { getUserSettings } = require('../utils/settingsManager'); // Import user settings manager
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

    // Add detailed debugging for the received data
    stepLogger.debug('INSTAGRAM_HANDLER_DATA', {
      dataPresent: !!data,
      dataType: typeof data,
      dataKeys: data ? Object.keys(data) : 'null'
    });

    // Fetch user settings
    const userSettings = getUserSettings(chatId);
    const sendMedia = userSettings.instagram.sendMedia; // Should always be true
    const sendCaption = userSettings.instagram.sendCaption; // True for "Media + Caption", false for "Only Media"

    // Check if we're dealing with a nested data structure
    if (data && data.success && data.data) {
      stepLogger.debug('INSTAGRAM_HANDLER_NESTED_DATA', {
        nestedKeys: Object.keys(data.data)
      });
      data = data.data; // Extract the nested data
    }

    // If backend returned a friendly error (e.g., for stories), show it to the user and exit early
    if (data && data.error) {
      await bot.sendMessage(chatId, `⚠️ ${data.error}`);
      return;
    }

    // Now check for mediaPath in the correct data object
    if (!data || !data.mediaPath) {
      stepLogger.error('INSTAGRAM_MEDIA_PATH_MISSING', { 
        url: url.substring(0, 50),
        dataKeys: data ? Object.keys(data) : 'null'
      });
      throw new Error('Media path is missing from Instagram response');
    }

    const mediaPath = data.mediaPath;
    const caption = data.caption ? cleanupInstagramText(data.caption) : '';
    const isVideo = data.is_video || false;
    const isCarousel = data.is_carousel || false;

    stepLogger.debug('INSTAGRAM_MEDIA_INFO', { 
      mediaType: isVideo ? 'video' : (isCarousel ? 'carousel' : 'image'),
      captionLength: caption.length,
      mediaPath: Array.isArray(mediaPath) ? `${mediaPath.length} items` : mediaPath 
    });

    // If both media and captions are disabled, notify the user
    if (!sendMedia && !sendCaption) {
      await bot.sendMessage(chatId, 'Your settings are configured to disable both media and captions.');
      return;
    }

    // Create keyboard markup with URL
    const keyboard = {
      inline_keyboard: [
        [{ text: '📱 Open in Instagram', url: url }]
      ]
    };

    // Handle carousel posts (multiple images)
    if (isCarousel && Array.isArray(mediaPath) && mediaPath.length > 0) {
      if (!sendMedia) {
        stepLogger.info('INSTAGRAM_MEDIA_DISABLED', { chatId });
      } else {
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
      }

      // Send caption separately if enabled
      if (sendCaption && caption && caption.trim().length > 0) {
        await bot.sendMessage(chatId, `📝 <b>Caption:</b>\n\n${caption}`, { 
          parse_mode: 'HTML',
          reply_markup: keyboard,
          disable_web_page_preview: true
        });
      }

    } else if (isVideo) {
      // Single video
      if (!sendMedia) {
        stepLogger.info('INSTAGRAM_MEDIA_DISABLED', { chatId });
      } else {
        if (!fs.existsSync(mediaPath)) {
          stepLogger.error('INSTAGRAM_VIDEO_NOT_FOUND', { mediaPath });
          throw new Error(`Video file not found at: ${mediaPath}`);
        }

        stepLogger.info('INSTAGRAM_SEND_VIDEO', { fileSize: getFileSize(mediaPath) });

        const captionMaxLength = 1024; // Telegram caption limit
        const videoCaption = sendCaption && caption.length <= captionMaxLength ? caption : '';

        await bot.sendVideo(chatId, fs.createReadStream(mediaPath), {
          caption: videoCaption,
          parse_mode: 'HTML',
          reply_markup: keyboard
        });

        // Send caption separately if it's too long
        if (sendCaption && caption.length > captionMaxLength) {
          await bot.sendMessage(chatId, `📝 <b>Caption:</b>\n\n${caption}`, { 
            parse_mode: 'HTML',
            disable_web_page_preview: true 
          });
        }
      }

    } else {
      // Single image
      if (!sendMedia) {
        stepLogger.info('INSTAGRAM_MEDIA_DISABLED', { chatId });
      } else {
        if (!fs.existsSync(mediaPath)) {
          stepLogger.error('INSTAGRAM_IMAGE_NOT_FOUND', { mediaPath });
          throw new Error(`Image file not found at: ${mediaPath}`);
        }

        stepLogger.info('INSTAGRAM_SEND_IMAGE', { fileSize: getFileSize(mediaPath) });

        const captionMaxLength = 1024; // Telegram caption limit
        const imageCaption = sendCaption && caption.length <= captionMaxLength ? caption : '';

        await bot.sendPhoto(chatId, fs.createReadStream(mediaPath), {
          caption: imageCaption,
          parse_mode: 'HTML',
          reply_markup: keyboard
        });

        // Send caption separately if it's too long
        if (sendCaption && caption.length > captionMaxLength) {
          await bot.sendMessage(chatId, `📝 <b>Caption:</b>\n\n${caption}`, { 
            parse_mode: 'HTML',
            disable_web_page_preview: true 
          });
        }
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

    // If the error is a friendly backend error, show it to the user
    if (error.message && error.message.includes('Instagram Stories download is not supported')) {
      await bot.sendMessage(chatId, `⚠️ Instagram Stories download is not supported. Please provide a post, reel, or IGTV link.`);
      return;
    }

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