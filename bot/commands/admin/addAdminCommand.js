const stepLogger = require('../../utils/stepLogger');
const statusNotifier = require('../../services/statusNotifier');

async function addAdminCommand(bot, msg) {
  const chatId = msg.chat.id;
  
  stepLogger.info('CMD_ADD_ADMIN', { chatId });
  
  const added = statusNotifier.addAdmin(chatId);
  
  const sentMessage = await bot.sendMessage(chatId,
    added ? 
      "✅ *Admin notifications enabled!*\n\nYou'll receive alerts when the bot goes online or offline." :
      "ℹ️ You're already receiving admin notifications.",
    { parse_mode: 'Markdown' }
  );
  
  return { sentMessage, userMessageId: msg.message_id };
}

module.exports = addAdminCommand;