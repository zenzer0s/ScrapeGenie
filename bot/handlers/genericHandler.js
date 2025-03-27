const { escapeMarkdown, sendSafeMessage } = require('../utils/textUtils');
const stepLogger = require('../utils/stepLogger');

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
    stepLogger.info('GENERIC_HANDLER_START', { 
      chatId, 
      url: url.substring(0, 50)  // Truncate URL for logs
    });
    
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
      stepLogger.debug('GENERIC_TITLE', { title: data.title.substring(0, 50) });
    }
    
    // Description if available
    if (data.description) {
      message += `\n\n${escapeMarkdown(data.description)}`;
    }
    
    // Only add content if it's not a placeholder
    if (data.content && !data.content.startsWith('Content from')) {
      message += `\n\n${escapeMarkdown(data.content)}`;
      stepLogger.debug('GENERIC_HAS_CONTENT', { contentLength: data.content.length });
    }
    
    // Add metadata if available
    if (data.metadata) {
      // Add site name
      if (data.metadata.siteName) {
        message += `\n\n📍 *Site:* ${escapeMarkdown(data.metadata.siteName)}`;
      }
      
      // Add date if available
      if (data.metadata.date) {
        const date = new Date(data.metadata.date);
        if (!isNaN(date)) {
          message += `\n📅 *Published:* ${date.toLocaleDateString()}`;
        }
      }
      
      // Add author if available
      if (data.metadata.author) {
        message += `\n👤 *Author:* ${escapeMarkdown(data.metadata.author)}`;
      }
    }
    
    // Send message if we have content
    if (message.trim()) {
      await sendSafeMessage(bot, chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } else {
      // Fallback message when no meaningful content was found
      await sendSafeMessage(bot, chatId, "Website information retrieved", {
        reply_markup: keyboard
      });
    }
    
    stepLogger.success('GENERIC_HANDLER_COMPLETE', { 
      chatId, 
      messageLength: message.length 
    });

    // After sending the message to the user, try to store in Google Sheets
    try {
      const googleService = require('../services/googleService');
      
      // Check if user has connected Google
      const isConnected = await googleService.checkConnectionStatus(chatId);
      
      if (isConnected) {
        stepLogger.info('GOOGLE_SHEETS_ENABLED', { chatId });
        
        // Store website metadata in Google Sheets
        await googleService.storeWebsiteMetadata(chatId, {
          title: data.title,
          url: url,
          description: data.content
        });
        
        // Send a confirmation message
        await bot.sendMessage(chatId, "✅ Website saved to your Google Sheets");
        
        stepLogger.success('GOOGLE_SHEETS_UPDATED', { chatId, url });
      }
    } catch (googleError) {
      stepLogger.error('GOOGLE_SHEETS_ERROR', { 
        chatId, 
        error: googleError.message 
      });
      // Continue even if Google Sheets update fails
    }
  } catch (error) {
    stepLogger.error('GENERIC_HANDLER_ERROR', { 
      chatId, 
      url: url.substring(0, 50),
      error: error.message 
    });
    
    // Send a fallback message to the user
    try {
      await bot.sendMessage(
        chatId,
        `Sorry, I couldn't process this website properly.\n\nError: ${error.message}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🌐 Open Original URL', url: url }]
            ]
          }
        }
      );
    } catch (msgError) {
      stepLogger.error('GENERIC_FALLBACK_FAILED', { chatId, error: msgError.message });
    }
    
    throw error;
  }
}

module.exports = { handleGenericWebsite };