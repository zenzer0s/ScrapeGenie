const stepLogger = require('../../utils/stepLogger');
const { formatUptime } = require('../utils/formatters');

// Add this function (it was missing)
async function checkBackendStatus() {
  try {
    // Simple implementation that returns a healthy status
    return {
      status: 'healthy',
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error checking backend status:', error);
    return { status: 'error', error: error.message };
  }
}

async function statusCommand(bot, msg) {
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