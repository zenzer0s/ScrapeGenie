const stepLogger = require('../../utils/stepLogger');
const statusNotifier = require('../../services/statusNotifier');

async function removeAdminCommand(bot, msg) {
  const chatId = msg.chat.id;
  
  stepLogger.info('CMD_REMOVE_ADMIN', { chatId });
  
  const removed = statusNotifier.removeAdmin(chatId);
  
  const sentMessage = await bot.sendMessage(chatId,
    removed ? 
      "✅ *Admin notifications disabled*\n\nYou'll no longer receive bot status alerts." :
      "ℹ️ You weren't receiving admin notifications.",
    { parse_mode: 'Markdown' }
  );
  
  return { sentMessage, userMessageId: msg.message_id };
}

module.exports = removeAdminCommand;