const fs = require('fs');
const { escapeMarkdown } = require('../utils/textUtils');
const stepLogger = require('../utils/stepLogger');

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
    stepLogger.info('YOUTUBE_HANDLER_START', { chatId, url: url.substring(0, 50) });
    
    // Create keyboard markup with URL
    const keyboard = {
      inline_keyboard: [
        [{ text: '🎬 Watch on YouTube', url: url }]
      ]
    };
    
    // Prepare caption
    let caption = '';
    
    // Add title
    if (data.title) {
      caption += `*${escapeMarkdown(data.title)}*`;
      stepLogger.debug('YOUTUBE_TITLE', { title: data.title.substring(0, 50) });
    } else {
      caption += '*YouTube Video*';
    }
    
    // Add channel name if available
    if (data.channelName) {
      caption += `\n\n👤 *Channel:* ${escapeMarkdown(data.channelName)}`;
    }
    
    // Add description if available (truncated)
    if (data.description && data.description.trim()) {
      const maxDescLength = 300; // Reasonable length for caption
      let desc = data.description.trim();
      
      if (desc.length > maxDescLength) {
        desc = desc.substring(0, maxDescLength) + '...';
      }
      
      caption += `\n\n${escapeMarkdown(desc)}`;
      stepLogger.debug('YOUTUBE_DESC', { descLength: data.description.length });
    }
    
    // Add video stats if available
    if (data.views || data.likes || data.published) {
      caption += '\n';
      
      if (data.views) {
        caption += `\n👁️ *Views:* ${formatNumber(data.views)}`;
      }
      
      if (data.likes) {
        caption += `\n👍 *Likes:* ${formatNumber(data.likes)}`;
      }
      
      if (data.published) {
        try {
          const date = new Date(data.published);
          if (!isNaN(date)) {
            caption += `\n📅 *Published:* ${date.toLocaleDateString()}`;
          }
        } catch (e) {
          // Ignore invalid date format
        }
      }
    }

    // Check if we have a audio file available
    const hasAudio = data.hasAudio && data.audioFile && fs.existsSync(data.audioFile);
    
    // Check if we have a downloaded video file
    if (data.filepath) {
      // Verify file exists
      if (!fs.existsSync(data.filepath)) {
        stepLogger.error('YOUTUBE_FILE_NOT_FOUND', { filepath: data.filepath });
        throw new Error(`Video file not found at: ${data.filepath}`);
      }
      
      // Get file size
      const stats = fs.statSync(data.filepath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      stepLogger.info('YOUTUBE_SEND_VIDEO', { 
        filepath: data.filepath,
        fileSize: `${fileSizeMB} MB` 
      });
      
      const captionMaxLength = 1024; // Telegram caption limit
      
      // Send video file
      await bot.sendVideo(chatId, fs.createReadStream(data.filepath), {
        caption: caption.length <= captionMaxLength ? caption : '',
        parse_mode: 'Markdown',
        reply_markup: keyboard,
        supports_streaming: true
      });
      
      // Send caption separately if it's too long
      if (caption.length > captionMaxLength) {
        await bot.sendMessage(chatId, caption, { parse_mode: 'Markdown' });
      }
      
      // Clean up the file after sending
      try {
        fs.unlinkSync(data.filepath);
        stepLogger.debug('YOUTUBE_FILE_CLEANUP', { filepath: data.filepath });
      } catch (cleanupError) {
        stepLogger.warn('YOUTUBE_FILE_CLEANUP_FAILED', { 
          error: cleanupError.message 
        });
      }
    } else if (data.mediaUrl) {
      // We have a thumbnail image
      stepLogger.info('YOUTUBE_SEND_THUMBNAIL', { mediaUrl: data.mediaUrl });
      
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
      // No media available, send text only
      stepLogger.info('YOUTUBE_SEND_TEXT_ONLY');
      
      await bot.sendMessage(chatId, caption, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      });
    }
    
    // Send audio file if available
    if (hasAudio) {
      try {
        // Get audio file size
        const audioStats = fs.statSync(data.audioFile);
        const audioSizeMB = (audioStats.size / (1024 * 1024)).toFixed(2);
        
        stepLogger.info('YOUTUBE_SEND_AUDIO', { 
          audioFile: data.audioFile,
          audioSize: `${audioSizeMB} MB`,
          audioType: data.audioType || 'm4a'
        });
        
        // Send loading message
        const loadingMsg = await bot.sendMessage(chatId, '🎵 Sending audio...');
        
        // Send the audio file WITHOUT any caption
        await bot.sendAudio(chatId, fs.createReadStream(data.audioFile), {
          // No caption
          title: data.title || 'YouTube Audio',
          performer: 'YouTube',
        });
        
        // Delete loading message
        await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
        
        // The audio file will be cleaned up by the ytAudio.js module's auto-cleanup
      } catch (audioError) {
        stepLogger.error('YOUTUBE_AUDIO_SEND_ERROR', { 
          chatId, 
          error: audioError.message,
          audioFile: data.audioFile
        });
        
        // Notify user of audio error
        await bot.sendMessage(
          chatId,
          '⚠️ Sorry, I couldn\'t send the audio file.',
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }
    }
    
    stepLogger.success('YOUTUBE_HANDLER_COMPLETE', { chatId });
  } catch (error) {
    stepLogger.error('YOUTUBE_HANDLER_ERROR', { 
      chatId, 
      url: url.substring(0, 50),
      error: error.message 
    });
    
    // Send a fallback message to the user
    try {
      await bot.sendMessage(
        chatId,
        `Sorry, I couldn't process this YouTube video properly.\n\nError: ${error.message}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎬 Watch on YouTube', url: url }]
            ]
          }
        }
      );
    } catch (msgError) {
      stepLogger.error('YOUTUBE_FALLBACK_FAILED', { 
        chatId, 
        error: msgError.message 
      });
    }
    
    throw error;
  }
}

/**
 * Format large numbers with commas
 * @param {number|string} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
  if (!num) return '0';
  
  const n = parseInt(num, 10);
  if (isNaN(n)) return String(num);
  
  return n.toLocaleString();
}

/**
 * Handle YouTube audio callback query
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {object} query - Callback query
 */
async function handleYoutubeCallback(bot, query) {
  if (query.data === 'audio_info') {
    await bot.answerCallbackQuery(query.id, {
      text: 'High-quality audio has been sent as a separate message',
      show_alert: false
    });
  }
}

module.exports = { handleYoutube, handleYoutubeCallback };