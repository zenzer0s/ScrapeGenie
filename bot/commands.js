const os = require('os');
const { checkBackendHealth } = require('./services/apiService');
const stepLogger = require('./utils/stepLogger');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid'); // Add this line

// Create an axios instance with the base URL
const axiosInstance = axios.create({
  baseURL: process.env.BACKEND_URL || 'http://0.0.0.0:8080',
  timeout: 10000
});

// Set up a basic request retry mechanism using interceptors
axiosInstance.interceptors.response.use(undefined, async (err) => {
  const { config, message } = err;
  if (!config || !config.retry) {
    return Promise.reject(err);
  }
  
  // Set the retry count
  config.retryCount = config.retryCount || 0;
  
  // Check if we've maxed out the total number of retries
  if (config.retryCount >= config.retry) {
    return Promise.reject(err);
  }
  
  // Increase the retry count
  config.retryCount += 1;
  stepLogger.info('HTTP_REQUEST_RETRY', {
    attempt: config.retryCount,
    maxRetries: config.retry,
    url: config.url
  });
  
  // Create new promise to handle retry
  return new Promise((resolve) => {
    setTimeout(() => resolve(axiosInstance(config)), 1000 * config.retryCount);
  });
});

// Add retry property to all requests
axiosInstance.defaults.retry = 3;

/**
 * Check if backend is available
 * @param {TelegramBot} bot - Bot instance
 * @param {number|string} chatId - Chat ID
 * @returns {Promise<boolean>} Whether backend is available
 */
async function checkBackendAvailable(bot, chatId) {
  try {
    const healthCheck = await axiosInstance.get(`/health`);
    return healthCheck.status === 200;
  } catch (err) {
    stepLogger.error('BACKEND_UNAVAILABLE', { 
      chatId, 
      error: err.message 
    });
    
    await bot.sendMessage(chatId,
      '❌ *Backend server not available*\n\n' +
      'The service is currently unavailable. Please try again later.',
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 Back to Home', callback_data: 'start' }]
          ]
        }
      }
    );
    return false;
  }
}

/**
 * Handle errors in commands
 * @param {TelegramBot} bot - Bot instance
 * @param {number|string} chatId - Chat ID
 * @param {Error} error - Error object
 * @param {string} context - Error context
 * @returns {Promise<{sentMessage: object, userMessageId: number}>}
 */
async function handleCommandError(bot, chatId, error, context, userMessageId) {
  stepLogger.error(`${context.toUpperCase()}_ERROR`, {
    chatId,
    error: error.message
  });
  
  // Determine appropriate error message
  let errorMessage;
  if (error.code === 'ECONNREFUSED' || error.message.includes('connect')) {
    errorMessage = '❌ *Connection Error*\n\n' +
      'Cannot connect to the server. The server might be down or unavailable.\n\n' +
      'Please try again later.';
  } else {
    errorMessage = `❌ *${context} Error*\n\n` +
      'Sorry, we encountered a problem. Please try again later.';
  }
  
  const sentMessage = await bot.sendMessage(chatId, errorMessage, { 
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🏠 Back to Home', callback_data: 'start' }]
      ]
    }
  });
  
  return { sentMessage, userMessageId };
}

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
  
  stepLogger.info('CMD_START', { chatId });
  
  // Send welcome message
  const sentMessage = await bot.sendMessage(chatId, 
    `👋 *Welcome to ScrapeGenie!* 🧞‍♂️\n\n` +
    `I can extract information from:\n\n` +
    `🔹 *YouTube Videos* 📺\n` +
    `🔹 *Instagram Posts & Reels* 📸\n` +
    `🔹 *Pinterest Pins* 📌\n` +
    `🔹 *Websites* 🌍\n\n` +
    `📌 Just send me a URL and I'll do the magic!\n\n` +
    `Select an option below or just send me a link:`,
    { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📖 Help', callback_data: 'help' },
            { text: '🔄 Status', callback_data: 'status' }
          ],
          [
            { text: '🔐 Pinterest Login', callback_data: 'pinterest_login' },
            { text: '🔓 Pinterest Logout', callback_data: 'pinterest_logout' }
          ]
        ]
      }
    }
  );
  return { sentMessage, userMessageId: msg.message_id };
}

// /help command - with 2 columns, 3 rows layout
async function helpCommand(bot, msg) {
  const chatId = msg.chat.id;
  
  stepLogger.info('CMD_HELP', { chatId });
  
  const sentMessage = await bot.sendMessage(chatId,
    `📖 *ScrapeGenie Help Guide*\n\n` +
    `🔹 Send a URL to extract its details.\n\n` +
    `💡 *Supported Platforms:*\n` +
    `   • YouTube - Gets title, thumbnail, and video link.\n` +
    `   • Instagram - Extracts posts and reels with captions.\n` +
    `   • Pinterest - Downloads pins and videos (login may be required).\n` +
    `   • Websites - Fetches title, description & preview.\n\n` +
    `Select an option below:`,
    { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          // Row 1: Home + Status 
          [
            { text: '🏠 Home', callback_data: 'start' },
            { text: '🔄 Status', callback_data: 'status' }
          ],
          // Row 2: Usage + Pinterest Login
          [
            { text: '📊 Usage', callback_data: 'usage' },
            { text: '🔍 Pinterest Status', callback_data: 'pinterest_status' }
            
          ],
          // Row 3: Pinterest Logout + Pinterest Status
          [
            { text: '🔐 Pinterest Login', callback_data: 'pinterest_login' },
            { text: '🔓 Pinterest Logout', callback_data: 'pinterest_logout' }
          ]
        ]
      }
    }
  );
  return { sentMessage, userMessageId: msg.message_id };
}

// /status command
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

// /usage command
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

// Pinterest login command - improved with proper logging and error handling
async function pinterestLoginCommand(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  stepLogger.info('CMD_PINTEREST_LOGIN', { chatId });

  try {
    // First check if backend is available
    if (!await checkBackendAvailable(bot, chatId)) {
      return { userMessageId: msg.message_id };
    }
    
    // Check if user is already logged in
    const statusResponse = await axiosInstance.get(`/auth/status`, {
      params: { userId }
    });

    if (statusResponse.data.success && statusResponse.data.isLoggedIn) {
      const sentMessage = await bot.sendMessage(chatId,
        '✅ *You are already logged in to Pinterest!*\n\n' +
        'You can now send Pinterest links and I\'ll download them using your account.\n\n' +
        'To log out, use /pinterest_logout',
        { parse_mode: 'Markdown' }
      );
      return { sentMessage, userMessageId: msg.message_id };
    }

    // Generate login token
    const tokenResponse = await axiosInstance.post(`/auth/generate-token`, {
      userId
    });

    if (!tokenResponse.data.success) {
      throw new Error(tokenResponse.data.error || 'Failed to generate login link');
    }

    const loginUrl = tokenResponse.data.loginUrl;

    // Send detailed instructions
    const instructionsMessage = await bot.sendMessage(chatId,
      '🔐 *Pinterest Authentication*\n\n' +
      'To download high-quality Pinterest content and access private pins, you need to authenticate.\n\n' +
      '*Instructions:*\n' +
      '1️⃣ Click the login link in the next message\n' +
      '2️⃣ Enter your Pinterest login details on the official Pinterest page\n' +
      '3️⃣ After successful login, return to this chat\n\n' +
      '⚠️ This link expires in 15 minutes\n\n' +
      '_Your credentials are entered directly on Pinterest\'s official website and are never stored by this bot._',
      { parse_mode: 'Markdown' }
    );
    
    // Send the login URL separately (Telegram will make it clickable automatically)
    const loginUrlMessage = await bot.sendMessage(chatId, loginUrl, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔍 Check Login Status', callback_data: 'pinterest_status' },
            { text: '🏠 Home', callback_data: 'start' }
          ]
        ]
      }
    });
    
    stepLogger.success('PINTEREST_LOGIN_LINK_SENT', { chatId });
    return { sentMessages: [instructionsMessage, loginUrlMessage], userMessageId: msg.message_id };
    
  } catch (error) {
    return handleCommandError(bot, chatId, error, 'pinterest_login', msg.message_id);
  }
}

// Pinterest logout command - improved with proper logging
async function pinterestLogoutCommand(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  stepLogger.info('CMD_PINTEREST_LOGOUT', { chatId });

  try {
    // First check if backend is available
    if (!await checkBackendAvailable(bot, chatId)) {
      return { userMessageId: msg.message_id };
    }

    // Try to logout
    const response = await axiosInstance.post(`/auth/logout`, {
      userId
    });

    if (response.data.success) {
      const sentMessage = await bot.sendMessage(chatId,
        "✅ You have been logged out of Pinterest.",
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔐 Login Again', callback_data: 'pinterest_login' },
                { text: '🏠 Home', callback_data: 'start' }
              ]
            ]
          }
        }
      );
      stepLogger.success('PINTEREST_LOGOUT_SUCCESS', { chatId });
      return { sentMessage, userMessageId: msg.message_id };
    } else {
      throw new Error(response.data.error || 'Failed to logout');
    }
  } catch (error) {
    return handleCommandError(bot, chatId, error, 'pinterest_logout', msg.message_id);
  }
}

// Pinterest status command - improved with proper logging
async function pinterestStatusCommand(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  stepLogger.info('CMD_PINTEREST_STATUS', { chatId });

  try {
    // First check if backend is available
    if (!await checkBackendAvailable(bot, chatId)) {
      return { userMessageId: msg.message_id };
    }

    // Check login status
    const response = await axiosInstance.get(`/auth/status`, {
      params: { userId }
    });

    if (response.data.success) {
      if (response.data.isLoggedIn) {
        const sentMessage = await bot.sendMessage(chatId,
          "✅ *You are logged in to Pinterest*",
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🔓 Logout', callback_data: 'pinterest_logout' },
                  { text: '🏠 Home', callback_data: 'start' }
                ]
              ]
            }
          }
        );
        stepLogger.success('PINTEREST_STATUS_LOGGED_IN', { chatId });
        return { sentMessage, userMessageId: msg.message_id };
      } else {
        const sentMessage = await bot.sendMessage(chatId,
          "⚠️ *You are not logged in to Pinterest*",
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🔐 Login', callback_data: 'pinterest_login' },
                  { text: '🏠 Home', callback_data: 'start' }
                ]
              ]
            }
          }
        );
        stepLogger.info('PINTEREST_STATUS_NOT_LOGGED_IN', { chatId });
        return { sentMessage, userMessageId: msg.message_id };
      }
    } else {
      throw new Error(response.data.error || 'Failed to check login status');
    }
  } catch (error) {
    return handleCommandError(bot, chatId, error, 'pinterest_status', msg.message_id);
  }
}

// Admin commands
async function addAdminCommand(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // You might want to check user permissions here
  
  stepLogger.info('CMD_ADD_ADMIN', { chatId, userId });
  
  const added = notificationService.addAdminChat(chatId);
  
  if (added) {
    await bot.sendMessage(chatId, 
      "✅ This chat has been added to the admin notification list.\n\n" +
      "You will now receive notifications when the bot goes online or offline."
    );
    stepLogger.success('ADMIN_ADDED', { chatId });
  } else {
    await bot.sendMessage(chatId, 
      "ℹ️ This chat is already in the admin notification list."
    );
  }
  
  return { sentMessage: null, userMessageId: msg.message_id };
}

async function removeAdminCommand(bot, msg) {
  const chatId = msg.chat.id;
  
  stepLogger.info('CMD_REMOVE_ADMIN', { chatId });
  
  const removed = notificationService.removeAdminChat(chatId);
  
  if (removed) {
    await bot.sendMessage(chatId, 
      "✅ This chat has been removed from the admin notification list.\n\n" +
      "You will no longer receive bot status notifications."
    );
    stepLogger.success('ADMIN_REMOVED', { chatId });
  } else {
    await bot.sendMessage(chatId, 
      "ℹ️ This chat is not in the admin notification list."
    );
  }
  
  return { sentMessage: null, userMessageId: msg.message_id };
}

module.exports = {
  startCommand,
  helpCommand,
  statusCommand,
  usageCommand,
  pinterestLoginCommand,
  pinterestLogoutCommand,
  pinterestStatusCommand,
  addAdminCommand,
  removeAdminCommand
};
