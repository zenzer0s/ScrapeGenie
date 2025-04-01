const stepLogger = require('./stepLogger');

/**
 * Delete a message after a specified delay
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {number} messageId - Message ID to delete
 * @param {number} delayMs - Delay in milliseconds (default: 15000)
 * @returns {Promise<void>}
 */
function deleteMessageAfterDelay(bot, chatId, messageId, delayMs = 15000) {
    stepLogger.debug('MESSAGE_DELETE_SCHEDULED', { chatId, messageId, delayMs });
    
    return new Promise((resolve) => {
        setTimeout(async () => {
            try {
                await bot.deleteMessage(chatId, messageId);
                stepLogger.debug('MESSAGE_DELETED', { chatId, messageId });
                resolve(true);
            } catch (error) {
                stepLogger.warn('MESSAGE_DELETE_FAILED', { 
                    chatId, 
                    messageId, 
                    error: error.message 
                });
                resolve(false);
            }
        }, delayMs);
    });
}

module.exports = {
    deleteMessageAfterDelay
};