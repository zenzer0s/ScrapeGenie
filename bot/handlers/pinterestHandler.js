const { escapeMarkdown } = require('../utils/textUtils');
const stepLogger = require('../utils/stepLogger');

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
    stepLogger.info('PINTEREST_HANDLER_START', { chatId, url: url.substring(0, 50) });
    
    // Create keyboard markup with URL
    const keyboard = {
      inline_keyboard: [
        [{ text: '📌 View on Pinterest', url: url }]
      ]
    };
    
    // Prepare caption with title and description
    let caption = '';
    
    if (data.title) {
      caption += `*${escapeMarkdown(data.title)}*`;
      stepLogger.debug('PINTEREST_TITLE', { title: data.title.substring(0, 50) });
    }
    
    // Add description if available
    if (data.description && data.description.trim()) {
      caption += caption ? '\n\n' : '';
      caption += escapeMarkdown(data.description);
      stepLogger.debug('PINTEREST_DESCRIPTION', { 
        descriptionLength: data.description.length 
      });
    }
    
    // Add board name if available
    if (data.boardName) {
      caption += caption ? '\n\n' : '';
      caption += `📌 *Board:* ${escapeMarkdown(data.boardName)}`;
    }

    // Check for content type
    if (data.mediaType === 'video' && data.videoUrl) {
      // Send as video
      stepLogger.info('PINTEREST_SEND_VIDEO', { videoUrl: data.videoUrl });
      
      const captionMaxLength = 1024; // Telegram caption limit
      
      await bot.sendVideo(chatId, data.videoUrl, {
        caption: caption.length <= captionMaxLength ? caption : '',
        parse_mode: 'Markdown',
        reply_markup: keyboard,
        supports_streaming: true
      });
      
      // Send caption separately if it's too long
      if (caption.length > captionMaxLength) {
        await bot.sendMessage(chatId, caption, { parse_mode: 'Markdown' });
      }
    } else if (data.mediaUrl) {
      // Send as image
      stepLogger.info('PINTEREST_SEND_IMAGE', { mediaUrl: data.mediaUrl });
      
      const captionMaxLength = 1024; // Telegram caption limit
      
      await bot.sendPhoto(chatId, data.mediaUrl, {
        caption: caption.length <= captionMaxLength ? caption : '',
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      
      // Send caption separately if it's too long
      if (caption.length > captionMaxLength) {
        await bot.sendMessage(chatId, caption, { parse_mode: 'Markdown' });
      }
    } else {
      // No media URL - send as text message
      stepLogger.warn('PINTEREST_NO_MEDIA', { chatId });
      
      if (!caption) {
        caption = 'Pinterest content (no details available)';
      }
      
      await bot.sendMessage(chatId, caption, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    }
    
    stepLogger.success('PINTEREST_HANDLER_COMPLETE', { chatId });
  } catch (error) {
    stepLogger.error('PINTEREST_HANDLER_ERROR', { 
      chatId, 
      url: url.substring(0, 50),
      error: error.message 
    });
    
    // Send a fallback message to the user
    try {
      await bot.sendMessage(
        chatId,
        `Sorry, I couldn't process this Pinterest content.\n\nError: ${error.message}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📌 Open in Pinterest', url: url }]
            ]
          }
        }
      );
    } catch (msgError) {
      stepLogger.error('PINTEREST_FALLBACK_FAILED', { chatId, error: msgError.message });
    }
    
    throw error;
  }
}

module.exports = { handlePinterest };