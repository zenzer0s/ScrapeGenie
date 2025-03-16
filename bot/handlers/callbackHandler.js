const { 
  startCommand, 
  helpCommand, 
  statusCommand, 
  usageCommand,
  pinterestLoginCommand,
  pinterestLogoutCommand,
  pinterestStatusCommand
} = require('../commands');

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
      console.log(`🗑️ Deleted message ${messageId} from chat ${chatId}`);
    } catch (error) {
      console.error(`❌ Failed to delete message ${messageId} from chat ${chatId}:`, error.message);
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
  
  // Acknowledge the callback
  await bot.answerCallbackQuery(callbackQuery.id);
  
  // Process the action
  switch (action) {
    case 'start':
      const startResult = await startCommand(bot, { chat: { id: chatId }, from: callbackQuery.from });
      deleteMessageAfterDelay(bot, chatId, startResult.sentMessage.message_id, 15000);
      deleteMessageAfterDelay(bot, chatId, msg.message_id, 15000);
      break;
    case 'help':
      const helpResult = await helpCommand(bot, { chat: { id: chatId }, from: callbackQuery.from });
      deleteMessageAfterDelay(bot, chatId, helpResult.sentMessage.message_id, 15000);
      deleteMessageAfterDelay(bot, chatId, msg.message_id, 15000);
      break;
    case 'status':
      const statusResult = await statusCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }, checkBackendStatus);
      deleteMessageAfterDelay(bot, chatId, statusResult.sentMessage.message_id, 15000);
      deleteMessageAfterDelay(bot, chatId, msg.message_id, 15000);
      break;
    case 'usage':
      const usageResult = await usageCommand(bot, { chat: { id: chatId }, from: callbackQuery.from });
      deleteMessageAfterDelay(bot, chatId, usageResult.sentMessage.message_id, 15000);
      deleteMessageAfterDelay(bot, chatId, msg.message_id, 15000);
      break;
    case 'pinterest_login':
      const pinterestLoginResult = await pinterestLoginCommand(bot, { chat: { id: chatId }, from: callbackQuery.from });
      pinterestLoginResult.sentMessages.forEach(sentMessage => {
        deleteMessageAfterDelay(bot, chatId, sentMessage.message_id, 15000);
      });
      deleteMessageAfterDelay(bot, chatId, msg.message_id, 15000);
      break;
    case 'pinterest_logout':
      const pinterestLogoutResult = await pinterestLogoutCommand(bot, { chat: { id: chatId }, from: callbackQuery.from });
      deleteMessageAfterDelay(bot, chatId, pinterestLogoutResult.sentMessage.message_id, 15000);
      deleteMessageAfterDelay(bot, chatId, msg.message_id, 15000);
      break;
    case 'pinterest_status':
      const pinterestStatusResult = await pinterestStatusCommand(bot, { chat: { id: chatId }, from: callbackQuery.from });
      deleteMessageAfterDelay(bot, chatId, pinterestStatusResult.sentMessage.message_id, 15000);
      deleteMessageAfterDelay(bot, chatId, msg.message_id, 15000);
      break;
    default:
      const unknownCommandMessage = await bot.sendMessage(chatId, "Unknown command");
      deleteMessageAfterDelay(bot, chatId, unknownCommandMessage.message_id, 15000);
      deleteMessageAfterDelay(bot, chatId, msg.message_id, 15000);
  }
}

module.exports = { 
  handleCallbackQuery,
  deleteMessageAfterDelay
};