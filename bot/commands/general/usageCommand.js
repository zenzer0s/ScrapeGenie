const stepLogger = require('../../utils/stepLogger');
const { formatUptime } = require('../utils/formatters');

async function usageCommand(bot, msg) {
  const chatId = msg.chat.id;
  
  stepLogger.info('CMD_USAGE', { chatId });
  
  const memoryUsage = process.memoryUsage();
  const rss = (memoryUsage.rss / 1024 / 1024).toFixed(2); 
  const heapTotal = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
  const heapUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
  const external = (memoryUsage.external / 1024 / 1024).toFixed(2);

  const cpuUsage = process.cpuUsage();
  const userCPU = (cpuUsage.user / 1000).toFixed(2);
  const systemCPU = (cpuUsage.system / 1000).toFixed(2);

  const uptimeStr = formatUptime(process.uptime());

  const message = 
    `📊 *Resource Usage Information:*\n\n` +
    `*Memory Usage:*\n` +
    `• RSS: ${rss} MB\n` +
    `• Heap Total: ${heapTotal} MB\n` +
    `• Heap Used: ${heapUsed} MB\n` +
    `• External: ${external} MB\n\n` +
    `*CPU Usage:*\n` +
    `• User: ${userCPU} ms\n` +
    `• System: ${systemCPU} ms\n\n` +
    `*Uptime:* ${uptimeStr}`;

  const sentMessage = await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  return { sentMessage, userMessageId: msg.message_id };
}

module.exports = usageCommand;