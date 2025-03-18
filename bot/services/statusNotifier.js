const fs = require('fs');
const path = require('path');
const stepLogger = require('../utils/stepLogger');

// File to store admin chat IDs
const ADMIN_FILE = path.join(__dirname, '../data/admins.json');

// Ensure directory exists
const dataDir = path.dirname(ADMIN_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// In-memory store of admin chat IDs
let adminChats = [];

// Load admin chat IDs from file
function loadAdminChats() {
  try {
    if (fs.existsSync(ADMIN_FILE)) {
      const data = fs.readFileSync(ADMIN_FILE, 'utf8');
      adminChats = JSON.parse(data);
      return adminChats;
    }
  } catch (error) {
    stepLogger.error('ADMIN_LOAD_ERROR', { error: error.message });
  }
  return [];
}

// Save admin chat IDs to file
function saveAdminChats() {
  try {
    fs.writeFileSync(ADMIN_FILE, JSON.stringify(adminChats));
    return true;
  } catch (error) {
    stepLogger.error('ADMIN_SAVE_ERROR', { error: error.message });
    return false;
  }
}

// Add an admin chat
function addAdmin(chatId) {
  chatId = chatId.toString();
  if (adminChats.includes(chatId)) {
    return false;
  }
  adminChats.push(chatId);
  return saveAdminChats();
}

// Remove an admin chat
function removeAdmin(chatId) {
  chatId = chatId.toString();
  const initialLength = adminChats.length;
  adminChats = adminChats.filter(id => id !== chatId);
  
  if (adminChats.length !== initialLength) {
    return saveAdminChats();
  }
  return false;
}

// Format uptime in a readable way
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

// Send online notification to all admins
async function notifyOnline(bot) {
  stepLogger.info('SENDING_ONLINE_NOTIFICATION', { recipientCount: adminChats.length });
  
  const uptime = formatUptime(process.uptime());
  const memoryUsage = (process.memoryUsage().rss / (1024 * 1024)).toFixed(2);
  
  const message = 
    `🟢 *Bot Online*\n\n` +
    `⏰ *Time:* ${new Date().toLocaleString()}\n` + 
    `🧠 *Memory:* ${memoryUsage} MB\n` +
    `🖥️ *Server:* ${process.env.SERVER_NAME || 'Default'}\n`;
  
  for (const chatId of adminChats) {
    try {
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      stepLogger.error('NOTIFY_ADMIN_FAILED', { chatId, error: error.message });
    }
  }
}

// Send offline notification to all admins
async function notifyOffline(bot, reason = 'Server shutdown') {
  stepLogger.info('SENDING_OFFLINE_NOTIFICATION', { recipientCount: adminChats.length });
  
  const uptime = formatUptime(process.uptime());
  
  const message = 
    `🔴 *Bot Offline*\n\n` +
    `⏰ *Time:* ${new Date().toLocaleString()}\n` + 
    `⏱️ *Uptime:* ${uptime}\n` +
    `📝 *Reason:* ${reason}\n`;
  
  const promises = adminChats.map(chatId => 
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
      .catch(err => stepLogger.error('OFFLINE_NOTIFY_FAILED', { chatId, error: err.message }))
  );
  
  await Promise.allSettled(promises);
}

// Initialize by loading admin chats
loadAdminChats();

module.exports = {
  addAdmin,
  removeAdmin,
  notifyOnline,
  notifyOffline
};