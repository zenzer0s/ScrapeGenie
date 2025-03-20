const stepLogger = require('../../utils/stepLogger');
const { api } = require('../../services/apiService');

/**
 * Check if backend is available
 * @param {TelegramBot} bot - Bot instance
 * @param {number|string} chatId - Chat ID
 * @returns {Promise<boolean>} Whether backend is available
 */
async function checkBackendAvailable(bot, chatId) {
  try {
    const healthCheck = await api.get(`/health`);
    return healthCheck.status === 200;
  } catch (err) {
    stepLogger.error('BACKEND_UNAVAILABLE', { 
      chatId, 
      error: err.message 
    });
    
    await bot.sendMessage(chatId,
      '❌ *Backend server not available*\n\n' +
      'The service is currently unavailable. Please try again later.',
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 Back to Home', callback_data: 'start' }]
          ]
        }
      }
    );
    return false;
  }
}

/**
 * Handle errors in commands
 * @param {TelegramBot} bot - Bot instance
 * @param {number|string} chatId - Chat ID
 * @param {Error} error - Error object
 * @param {string} context - Error context
 * @returns {Promise<{sentMessage: object, userMessageId: number}>}
 */
async function handleCommandError(bot, chatId, error, context, userMessageId) {
  stepLogger.error(`${context.toUpperCase()}_ERROR`, {
    chatId,
    error: error.message
  });
  
  // Determine appropriate error message
  let errorMessage;
  if (error.code === 'ECONNREFUSED' || error.message.includes('connect')) {
    errorMessage = '❌ *Connection Error*\n\n' +
      'Cannot connect to the server. The server might be down or unavailable.\n\n' +
      'Please try again later.';
  } else {
    errorMessage = `❌ *${context} Error*\n\n` +
      'Sorry, we encountered a problem. Please try again later.';
  }
  
  const sentMessage = await bot.sendMessage(chatId, errorMessage, { 
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🏠 Back to Home', callback_data: 'start' }]
      ]
    }
  });
  
  return { sentMessage, userMessageId };
}

module.exports = {
  checkBackendAvailable,
  handleCommandError
};