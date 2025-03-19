const fs = require('fs');
const path = require('path');
const stepLogger = require('../utils/stepLogger');

// File to store admin chat IDs
const ADMIN_FILE = path.join(__dirname, '../data/admins.json');
const HEARTBEAT_FILE = path.join(__dirname, '../data/heartbeat.json');

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

// Save last known heartbeat
function saveHeartbeat() {
  try {
    const heartbeat = {
      timestamp: Date.now(),
      uptime: process.uptime(),
      memory: (process.memoryUsage().rss / (1024 * 1024)).toFixed(2)
    };
    fs.writeFileSync(HEARTBEAT_FILE, JSON.stringify(heartbeat));
    return true;
  } catch (error) {
    stepLogger.error('HEARTBEAT_SAVE_ERROR', { error: error.message });
    return false;
  }
}

// Start heartbeat system - saves status every 30 seconds
function startHeartbeat() {
  saveHeartbeat(); // Initial heartbeat
  
  // Set interval to update heartbeat file
  const heartbeatInterval = setInterval(() => {
    saveHeartbeat();
  }, 30000); // Every 30 seconds
  
  // Clean up on exit
  process.on('exit', () => {
    clearInterval(heartbeatInterval);
  });
  
  return heartbeatInterval;
}

// Check for abnormal shutdown when starting up
async function checkPreviousShutdown(bot) {
  try {
    if (!fs.existsSync(HEARTBEAT_FILE)) {
      // First run, no previous heartbeat
      return false;
    }
    
    const data = fs.readFileSync(HEARTBEAT_FILE, 'utf8');
    const lastHeartbeat = JSON.parse(data);
    const now = Date.now();
    const timeSinceHeartbeat = now - lastHeartbeat.timestamp;
    
    // If last heartbeat was less than 3 minutes ago but bot restarted,
    // it was likely an abnormal shutdown
    if (timeSinceHeartbeat < 180000) { // 3 minutes
      stepLogger.warn('ABNORMAL_SHUTDOWN_DETECTED', { 
        lastHeartbeat: new Date(lastHeartbeat.timestamp).toISOString(),
        timeSince: (timeSinceHeartbeat / 1000).toFixed(0) + 's'
      });
      
      // Notify admins about the previous shutdown
      if (adminChats.length > 0) {
        const lastTime = new Date(lastHeartbeat.timestamp).toLocaleString();
        const offlineMessage = 
          `⚠️ *Bot Recovered from Abnormal Shutdown*\n\n` +
          `The bot was unexpectedly offline and has just restarted.\n\n` +
          `⏰ *Last seen:* ${lastTime}\n` +
          `⏱️ *Offline duration:* ${formatDuration(timeSinceHeartbeat)}\n` +
          `📝 *Reason:* Likely forced shutdown or crash\n`;
        
        for (const chatId of adminChats) {
          await bot.sendMessage(chatId, offlineMessage, { parse_mode: 'Markdown' })
            .catch(err => stepLogger.error('RECOVERY_NOTIFY_FAILED', { chatId, error: err.message }));
        }
        
        return true;
      }
    }
  } catch (error) {
    stepLogger.error('PREVIOUS_SHUTDOWN_CHECK_ERROR', { error: error.message });
  }
  
  return false;
}

// Helper function to format duration
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// Send online notification to all admins
async function notifyOnline(bot) {
  // Check for abnormal shutdown first
  const wasAbnormalShutdown = await checkPreviousShutdown(bot);
  
  // If it was abnormal shutdown, we've already sent a more detailed notification
  if (!wasAbnormalShutdown) {
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
  
  // Start the heartbeat system
  startHeartbeat();
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