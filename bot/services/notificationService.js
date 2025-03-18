const stepLogger = require('../utils/stepLogger');
const logger = require('../utils/consoleLogger');
const fs = require('fs');
const path = require('path');

// Store for admin/moderator chat IDs to notify
let adminChatIds = [];
let lastNotifiedStatus = null;

// Path to store admin chat IDs
const ADMIN_IDS_PATH = path.join(__dirname, '../data/admin_chats.json');

// Ensure directory exists
const dataDir = path.dirname(ADMIN_IDS_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Load admin chat IDs from file
 */
function loadAdminChatIds() {
  try {
    if (fs.existsSync(ADMIN_IDS_PATH)) {
      const data = fs.readFileSync(ADMIN_IDS_PATH, 'utf8');
      adminChatIds = JSON.parse(data);
      logger.info(`Loaded ${adminChatIds.length} admin chat IDs for notifications`);
    } else {
      adminChatIds = [];
      logger.warn("No admin chat IDs found. Use /addadmin to receive notifications.");
    }
  } catch (error) {
    stepLogger.error('LOAD_ADMIN_CHATS_ERROR', { error: error.message });
    adminChatIds = [];
  }
}

/**
 * Save admin chat IDs to file
 */
function saveAdminChatIds() {
  try {
    fs.writeFileSync(ADMIN_IDS_PATH, JSON.stringify(adminChatIds, null, 2));
    stepLogger.info('SAVE_ADMIN_CHATS_SUCCESS', { count: adminChatIds.length });
  } catch (error) {
    stepLogger.error('SAVE_ADMIN_CHATS_ERROR', { error: error.message });
  }
}

/**
 * Add an admin chat ID to notification list
 * @param {number|string} chatId - Chat ID to add
 * @returns {boolean} Whether the chat ID was added
 */
function addAdminChat(chatId) {
  chatId = chatId.toString();
  if (adminChatIds.includes(chatId)) {
    return false;
  }
  adminChatIds.push(chatId);
  saveAdminChatIds();
  return true;
}

/**
 * Remove an admin chat ID from notification list
 * @param {number|string} chatId - Chat ID to remove
 * @returns {boolean} Whether the chat ID was removed
 */
function removeAdminChat(chatId) {
  chatId = chatId.toString();
  const initialLength = adminChatIds.length;
  adminChatIds = adminChatIds.filter(id => id !== chatId);
  
  if (adminChatIds.length !== initialLength) {
    saveAdminChatIds();
    return true;
  }
  return false;
}

/**
 * Check if a chat ID is in the admin list
 * @param {number|string} chatId - Chat ID to check
 * @returns {boolean} Whether the chat ID is in the list
 */
function isAdminChat(chatId) {
  return adminChatIds.includes(chatId.toString());
}

/**
 * Send online notification to all admin chats
 * @param {TelegramBot} bot - The Telegram bot instance
 * @param {object} info - Additional information to include
 * @returns {Promise<void>}
 */
async function sendOnlineNotification(bot, info = {}) {
  // Don't send duplicate notifications in quick succession
  if (lastNotifiedStatus === 'online') {
    return;
  }
  lastNotifiedStatus = 'online';
  
  const serverName = process.env.SERVER_NAME || 'Default Server';
  const uptime = formatUptime(process.uptime());
  const memoryUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
  
  stepLogger.info('SENDING_ONLINE_NOTIFICATION', {
    recipientCount: adminChatIds.length
  });
  
  const message = 
    `🟢 *Bot is now ONLINE*\n\n` +
    `🖥️ *Server:* ${serverName}\n` +
    `⏰ *Time:* ${new Date().toISOString()}\n` +
    `🧠 *Memory:* ${memoryUsage} MB\n` +
    `${info.restartCount ? `🔄 *Restart Count:* ${info.restartCount}\n` : ''}` +
    `\nThe bot is ready to process requests.`;
  
  await sendToAllAdmins(bot, message);
}

/**
 * Send offline notification to all admin chats
 * @param {TelegramBot} bot - The Telegram bot instance
 * @param {object} info - Additional information to include
 * @returns {Promise<void>}
 */
async function sendOfflineNotification(bot, info = {}) {
  // Don't send duplicate notifications in quick succession
  if (lastNotifiedStatus === 'offline') {
    return;
  }
  lastNotifiedStatus = 'offline';
  
  const serverName = process.env.SERVER_NAME || 'Default Server';
  const uptime = formatUptime(process.uptime());
  const shutdownReason = info.reason || 'Scheduled shutdown';
  
  stepLogger.info('SENDING_OFFLINE_NOTIFICATION', {
    recipientCount: adminChatIds.length,
    reason: shutdownReason
  });
  
  const message = 
    `🔴 *Bot is going OFFLINE*\n\n` +
    `🖥️ *Server:* ${serverName}\n` +
    `⏰ *Time:* ${new Date().toISOString()}\n` +
    `⏱️ *Uptime:* ${uptime}\n` +
    `📝 *Reason:* ${shutdownReason}\n\n` +
    `The bot will be unavailable until restarted.`;
  
  await sendToAllAdmins(bot, message);
}

/**
 * Helper function to send a message to all admin chats
 * @param {TelegramBot} bot - The Telegram bot instance
 * @param {string} message - Message to send
 * @returns {Promise<void>}
 */
async function sendToAllAdmins(bot, message) {
  if (adminChatIds.length === 0) {
    logger.warn("No admin chat IDs configured for notifications");
    return;
  }
  
  const promises = adminChatIds.map(chatId => 
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
      .catch(err => {
        stepLogger.error('ADMIN_NOTIFICATION_FAILED', {
          chatId,
          error: err.message
        });
      })
  );
  
  await Promise.allSettled(promises);
}

/**
 * Format uptime helper function
 * @param {number} uptime - Uptime in seconds
 * @returns {string} Formatted uptime
 */
function formatUptime(uptime) {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// Initialize by loading admin chats
loadAdminChatIds();

module.exports = {
  addAdminChat,
  removeAdminChat,
  isAdminChat,
  sendOnlineNotification,
  sendOfflineNotification
};