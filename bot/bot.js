// At the beginning of your file:

const fs = require('fs');
const path = require('path');
const lockFile = path.join(__dirname, '../.bot.lock');
const { deleteMessageAfterDelay } = require('./utils/messageUtils');
const commandHandler = require('./messageHandler'); // Added import for commandHandler

// Check if another instance is running
function checkForMultipleInstances() {
  try {
    // If lock file exists and is recent (less than 10 seconds old)
    if (fs.existsSync(lockFile)) {
      const stats = fs.statSync(lockFile);
      const fileAge = Date.now() - stats.mtimeMs;
      
      if (fileAge < 10000) { // 10 seconds
        console.log("⚠️ Another bot instance appears to be running!");
        console.log("If this is incorrect, delete the lock file: " + lockFile);
        process.exit(1);
      } else {
        console.log("⚠️ Stale lock file found. Overwriting.");
      }
    }
    
    // Create or update lock file
    fs.writeFileSync(lockFile, String(process.pid));
    
    // Remove lock file when process exits
    process.on('exit', () => {
      try {
        fs.unlinkSync(lockFile);
      } catch (err) {
        // Ignore errors during cleanup
      }
    });
    
    // Also handle SIGINT and SIGTERM
    process.on('SIGINT', async () => {
      logger.warn("Received SIGINT signal");
      try {
        // Give time for cleanup
        setTimeout(() => {
          try {
            fs.unlinkSync(lockFile);
          } catch {
            // Ignore errors during cleanup
          }
          process.exit(0);
        }, 2000);
      } catch (error) {
        logger.error(`Error during shutdown: ${error.message}`);
        process.exit(1);
      }
    });
    
    process.on('SIGTERM', async () => {
      logger.warn("Received SIGTERM signal");
      try {
        // Give time for cleanup
        setTimeout(() => {
          try {
            fs.unlinkSync(lockFile);
          } catch {
            // Ignore errors during cleanup
          }
          process.exit(0);
        }, 2000);
      } catch (error) {
        logger.error(`Error during shutdown: ${error.message}`);
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error("Error checking for multiple instances:", error);
  }
}

// Call this before any other initialization
checkForMultipleInstances();

// At the beginning of your file, before other initializations:

// Separate console logs from step logs
const originalConsoleLog = console.log;
console.log = function(...args) {
  // Only log non-step-logger messages to console (which gets redirected to bot.log)
  const isStepLogMessage = args.length > 0 && 
    typeof args[0] === 'string' && 
    args[0].includes('[INFO]');
  
  if (!isStepLogMessage) {
    originalConsoleLog.apply(console, args);
  }
};

// Track initialization to prevent duplicates
const initialized = {
  queue: false,
  queueProcessor: false,
  group: false
};

// Import configuration and libraries
const config = require('./config/botConfig');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const logger = require('./utils/consoleLogger');
const stepLogger = require('./utils/stepLogger');

// Import commands and handlers
const commands = require('./commands'); // Updated to use single import for commands
const { handleMessage } = require('./messageHandler');
const { handleCallbackQuery } = require('./handlers/callbackHandler');
// deleteMessageAfterDelay is already imported above
const { checkBackendStatus } = require('./utils/statusUtils');
const { setupMaintenanceTasks } = require('./services/maintenanceService');
const queueService = require('./services/queueService');

// Set up Axios to retry failed requests
axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

// Initialize Telegram bot in polling mode
const bot = new TelegramBot(config.token, { polling: true });
logger.info("🔍 Bot is running in polling mode...");

// Override sendMessage to automatically delete all messages
const originalSendMessage = bot.sendMessage.bind(bot);
bot.sendMessage = async (chatId, text, options = {}) => {
  try {
    const sentMsg = await originalSendMessage(chatId, text, options);
    // Auto-delete all bot messages after 15 seconds
    deleteMessageAfterDelay(bot, chatId, sentMsg.message_id, 15000);
    return sentMsg;
  } catch (error) {
    console.error('Error in sendMessage override:', error);
    throw error;
  }
};

// Register command handlers
bot.onText(/\/start/, async (msg) => {
  const { sentMessage, userMessageId } = await commands.startCommand(bot, msg);
  // Only delete user message - bot messages are auto-deleted by override
  deleteMessageAfterDelay(bot, msg.chat.id, userMessageId, 15000);
});

bot.onText(/\/usage/, async (msg) => {
  const { sentMessage, userMessageId } = await commands.usageCommand(bot, msg);
  deleteMessageAfterDelay(bot, msg.chat.id, userMessageId, 15000);
});

// Register Pinterest command handlers
bot.onText(/\/pinterest_login/, async (msg) => {
  const { sentMessages, userMessageId } = await commands.pinterestLoginCommand(bot, msg);
  deleteMessageAfterDelay(bot, msg.chat.id, userMessageId, 15000);
});

bot.onText(/\/pinterest_logout/, async (msg) => {
  const { sentMessage, userMessageId } = await commands.pinterestLogoutCommand(bot, msg);
  deleteMessageAfterDelay(bot, msg.chat.id, userMessageId, 15000);
});

bot.onText(/\/pinterest_status/, async (msg) => {
  const { sentMessage, userMessageId } = await commands.pinterestStatusCommand(bot, msg);
  deleteMessageAfterDelay(bot, msg.chat.id, userMessageId, 15000);
});

// Handle Pinterest login with token
bot.onText(/\/start pinterest_login_(.+)/, async (msg, match) => {
  const token = match[1];
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  // Verify token and redirect to login page
  // ...
});

// Add this command handler
bot.onText(/\/group/, async (msg) => {
  try {
    await require('./commands/group').process(bot, msg);
  } catch (error) {
    logger.error('Error handling /group command:', error);
  }
});

// Register the group command
bot.onText(/\/register/, async (msg) => {
  try {
    await require('./commands/registerGroup')(bot, msg);
  } catch (error) {
    logger.error('Error handling /register command:', error);
  }
});

// Add these commands to your bot.js file

// Process command - starts forwarded message collection
bot.onText(/\/process/, async (msg) => {
  try {
    await require('./commands/process')(bot, msg);
  } catch (error) {
    logger.error('Error handling /process command:', error);
  }
});

// Collect command - processes collected messages
bot.onText(/\/collect/, async (msg) => {
  try {
    await require('./commands/collect')(bot, msg);
  } catch (error) {
    logger.error('Error handling /collect command:', error);
  }
});

// Delegate message processing to messageHandler.js
bot.on('message', async (msg) => {
  try {
    if (!msg.text) return;
    
    const chatId = msg.chat.id;
    console.log(`📩 Message from ${chatId}: ${msg.text}`);
    
    // Process commands through the central handler
    const isHandled = await commandHandler.handleMessage(bot, msg); // Updated to use commandHandler
    
    // Delete user messages after processing (optional)
    // You can uncomment this if you want to delete user messages too
    // deleteMessageAfterDelay(bot, chatId, msg.message_id, 15000);
    
  } catch (error) {
    console.error('Error handling message:', error);
  }
});

// Setup callback query handler
bot.on('callback_query', async (callbackQuery) => {
  await handleCallbackQuery(bot, callbackQuery, checkBackendStatus);
});

// Register help command handler
bot.onText(/\/help/, async (msg) => {
  // Make sure this actually calls your help command function:
  await commands.helpCommand(bot, msg); 
  // Or it might be directly importing the function:
  // await helpCommand(bot, msg);
});

// Global error handlers to prevent the process from crashing
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.stack}`);
  // Optionally, restart the bot or perform cleanup
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise} reason: ${reason}`);
  // Optionally, handle the rejection (restart or log further)
});

// Setup maintenance tasks
setupMaintenanceTasks();

logger.success("Bot initialization complete");