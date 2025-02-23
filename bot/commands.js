const os = require('os');

// Format uptime helper function
function formatUptime(uptime) {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// /start command
async function startCommand(bot, msg) {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 
    `👋 *Welcome to ScrapeGenie!* 🧞‍♂️\n\n` +
    `I can extract information from:\n\n` +
    `🔹 *YouTube Videos* 📺\n` +
    `🔹 *Instagram Posts & Reels* 📸\n` +
    `🔹 *Websites* 🌍\n\n` +
    `📌 Just send me a URL and I’ll do the magic!`,
    { parse_mode: 'Markdown' }
  );
}

// /help command
async function helpCommand(bot, msg) {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId,
    `📖 *ScrapeGenie Help Guide*\n\n` +
    `🔹 Send a URL to extract its details.\n\n` +
    `💡 *Supported Platforms:*\n` +
    `   • *YouTube* - Gets title, thumbnail, and video link.\n` +
    `   • *Instagram* - Extracts posts and reels with captions.\n` +
    `   • *Websites* - Fetches title, description & preview.\n\n` +
    `🔹 Commands:\n` +
    `/start - Start the bot\n` +
    `/help - Show this help message\n` +
    `/status - Check bot status\n` +
    `/usage - View system resource usage`,
    { parse_mode: 'Markdown' }
  );
}

// /status command
async function statusCommand(bot, msg, checkBackendStatus) {
  const chatId = msg.chat.id;
  const status = await checkBackendStatus();
  const uptimeStr = formatUptime(process.uptime());

  await bot.sendMessage(chatId,
    `🟢 *Bot Status*\n\n` +
    `✅ *Bot:* Online\n` +
    `⏱ *Uptime:* ${uptimeStr}\n` +
    `${status ? '✅' : '❌'} *Backend:* ${status ? 'Connected' : 'Not Connected'}`,
    { parse_mode: 'Markdown' }
  );
}

// /usage command
async function usageCommand(bot, msg) {
  const chatId = msg.chat.id;
  
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

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

// Export all functions
module.exports = {
  startCommand,
  helpCommand,
  statusCommand,
  usageCommand
};
