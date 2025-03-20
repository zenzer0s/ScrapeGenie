const stepLogger = require('../../utils/stepLogger');
const { formatUptime } = require('../utils/formatters');

async function statusCommand(bot, msg, checkBackendStatus) {
  const chatId = msg.chat.id;
  
  stepLogger.info('CMD_STATUS', { chatId });
  
  const status = await checkBackendStatus();
  const uptimeStr = formatUptime(process.uptime());

  const sentMessage = await bot.sendMessage(chatId,
    `🟢 *Bot Status*\n\n` +
    `✅ *Bot:* Online\n` +
    `⏱ *Uptime:* ${uptimeStr}\n` +
    `${status ? '✅' : '❌'} *Backend:* ${status ? 'Connected' : 'Not Connected'}`,
    { parse_mode: 'Markdown' }
  );
  return { sentMessage, userMessageId: msg.message_id };
}

module.exports = statusCommand;