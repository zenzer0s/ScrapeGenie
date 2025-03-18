const { 
  startCommand, 
  helpCommand, 
  statusCommand, 
  usageCommand,
  pinterestLoginCommand,
  pinterestLogoutCommand,
  pinterestStatusCommand
} = require('../commands');
const stepLogger = require('../utils/stepLogger');

/**
 * Function to delete messages after a delay
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {number} messageId - Message ID to delete
 * @param {number} delay - Delay in milliseconds
 */
async function deleteMessageAfterDelay(bot, chatId, messageId, delay) {
  setTimeout(async () => {
    try {
      await bot.deleteMessage(chatId, messageId);
      stepLogger.debug('MESSAGE_DELETED', { chatId, messageId });
    } catch (error) {
      // Message may have already been deleted or too old
      stepLogger.warn('MESSAGE_DELETE_FAILED', { 
        chatId, 
        messageId, 
        error: error.message 
      });
    }
  }, delay);
}

/**
 * Handle callback queries
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {object} callbackQuery - Callback query object
 * @param {function} checkBackendStatus - Function to check backend status
 */
async function handleCallbackQuery(bot, callbackQuery, checkBackendStatus) {
  const action = callbackQuery.data;
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  
  // Track start time
  const startTime = Date.now();
  
  // Acknowledge the callback
  await bot.answerCallbackQuery(callbackQuery.id);
  
  stepLogger.info('CALLBACK_RECEIVED', { 
    action, 
    chatId, 
    userId: callbackQuery.from.id 
  });
  
  // Define command handlers
  const commandMap = {
    'start': () => startCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
    'help': () => helpCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
    'status': () => statusCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }, checkBackendStatus),
    'usage': () => usageCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
    'pinterest_login': () => pinterestLoginCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
    'pinterest_logout': () => pinterestLogoutCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
    'pinterest_status': () => pinterestStatusCommand(bot, { chat: { id: chatId }, from: callbackQuery.from })
  };
  
  try {
    // Process the action
    if (commandMap[action]) {
      // Call the appropriate command
      const result = await commandMap[action]();
      
      // Handle different result formats
      if (result.sentMessage) {
        deleteMessageAfterDelay(bot, chatId, result.sentMessage.message_id, 15000);
      } else if (result.sentMessages) {
        result.sentMessages.forEach(sentMessage => {
          deleteMessageAfterDelay(bot, chatId, sentMessage.message_id, 15000);
        });
      }
      
      // Delete the original message
      deleteMessageAfterDelay(bot, chatId, msg.message_id, 15000);
      
      stepLogger.info('CALLBACK_HANDLED', { 
        action, 
        chatId, 
        elapsed: Date.now() - startTime 
      });
    } else {
      // Handle unknown command
      const unknownCommandMessage = await bot.sendMessage(chatId, "Unknown command");
      deleteMessageAfterDelay(bot, chatId, unknownCommandMessage.message_id, 15000);
      deleteMessageAfterDelay(bot, chatId, msg.message_id, 15000);
      
      stepLogger.warn('CALLBACK_UNKNOWN', { action, chatId });
    }
  } catch (error) {
    stepLogger.error('CALLBACK_ERROR', { 
      action, 
      chatId, 
      error: error.message 
    });
    
    // Notify user of error
    const errorMessage = await bot.sendMessage(
      chatId, 
      `Error processing your request: ${error.message}`
    );
    
    deleteMessageAfterDelay(bot, chatId, errorMessage.message_id, 15000);
  }
}

module.exports = { 
  handleCallbackQuery,
  deleteMessageAfterDelay
};