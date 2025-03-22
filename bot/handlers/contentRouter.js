const { handleInstagram } = require('./instagramHandler');
const { handleYoutube } = require('./youtubeHandler');
const { handlePinterest } = require('./pinterestHandler');
const { handleGenericWebsite } = require('./genericHandler');
const stepLogger = require('../utils/stepLogger');

// Content type patterns
const CONTENT_PATTERNS = {
  instagram: [
    /instagram\.com/i,
    /instagr\.am/i,
    /ig\./i,
    /reels?\//i
  ],
  pinterest: [
    /pinterest\.com/i,
    /pin\.it/i,
  ],
  youtube: [
    /youtube\.com/i, 
    /youtu\.be/i,
    /shorts\//i
  ]
};

/**
 * Determine content type from URL
 * @param {string} url - URL to analyze
 * @returns {string} Content type
 */
function detectContentType(url, dataType = null) {
  // First check data.type if provided by API
  if (dataType) {
    return dataType;
  }
  
  // Then check URL patterns
  for (const [contentType, patterns] of Object.entries(CONTENT_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(url))) {
      return contentType;
    }
  }
  
  // Default to generic
  return 'generic';
}

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
    // Add detailed debugging for the received data
    stepLogger.debug('CONTENT_ROUTING_DATA', {
      dataPresent: !!data,
      dataKeys: data ? Object.keys(data) : 'null',
      mediaPathPresent: data && !!data.mediaPath,
      dataType: typeof data
    });
    
    // Check if we're dealing with a nested data structure
    if (data && data.success && data.data) {
      stepLogger.debug('EXTRACTING_NESTED_DATA', {
        nestedKeys: Object.keys(data.data)
      });
      data = data.data; // Extract the nested data
    }
    
    // Detect content type
    const contentType = detectContentType(url, data.type);
    
    stepLogger.info('CONTENT_ROUTING', { 
      chatId, 
      contentType, 
      url: url.substring(0, 50) // Log truncated URL
    });
    
    // Route to appropriate handler
    switch (contentType) {
      case 'instagram':
        await handleInstagram(bot, chatId, url, data);
        break;
      case 'youtube':
        await handleYoutube(bot, chatId, url, data);
        break;
      case 'pinterest':
        await handlePinterest(bot, chatId, url, data);
        break;
      default:
        await handleGenericWebsite(bot, chatId, url, data);
        break;
    }
    
    // Log successful routing
    stepLogger.success('CONTENT_DELIVERED', { 
      chatId, 
      contentType
    });
  } catch (error) {
    stepLogger.error('CONTENT_ROUTING_ERROR', { 
      chatId, 
      url: url.substring(0, 50),
      error: error.message
    });
    
    // Try fallback to generic handler if a specialized one failed
    try {
      // Only attempt fallback if we weren't already using generic
      if (detectContentType(url) !== 'generic') {
        stepLogger.info('CONTENT_ROUTING_FALLBACK', { chatId, url: url.substring(0, 50) });
        await handleGenericWebsite(bot, chatId, url, data);
      } else {
        throw error; // Re-throw if we were already using generic
      }
    } catch (fallbackError) {
      // If fallback also fails, throw the original error
      await handleError(bot, chatId, url, error);
    }
  }
}

/**
 * Handles errors and sends appropriate messages to the user
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {number} chatId - Chat ID to send content to
 * @param {string} url - Original URL
 * @param {Error} error - Error object
 * @returns {Promise<void>}
 */
async function handleError(bot, chatId, url, error) {
  try {
    stepLogger.error('DIRECT_PROCESSING_ERROR', { 
      chatId, 
      url, 
      error: error.message,
      status: error.status || 'unknown'
    });
    
    let userMessage = 'Sorry, I couldn\'t process this content properly.';
    
    // Check for specific error types
    if (error.status === 401) {
      userMessage = '🔐 <b>Pinterest Login Required</b>\n\nTo access Pinterest content, you need to connect your Pinterest account first.\n\nUse the /pinterest_login command to get started.';
    } else {
      userMessage += `\n\nError: ${error.message}`;
    }
    
    await bot.sendMessage(chatId, userMessage, { parse_mode: 'HTML' });
  } catch (sendError) {
    stepLogger.error('ERROR_HANDLING_FAILED', { 
      chatId, 
      originalError: error.message,
      sendError: sendError.message 
    });
  }
}

module.exports = { routeContent };