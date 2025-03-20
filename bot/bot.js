// At the beginning of your file:

const fs = require('fs');
const path = require('path');
const lockFile = path.join(__dirname, '../.bot.lock');
const statusNotifier = require('./services/statusNotifier');

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
    
    // Also handle SIGINT and SIGTERM with notifications
    process.on('SIGINT', async () => {
      logger.warn("Received SIGINT signal");
      try {
        await statusNotifier.notifyOffline(bot, 'Manual shutdown (Ctrl+C)');
        
        // Give time for notification to send
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
        await statusNotifier.notifyOffline(bot, 'Scheduled shutdown');
        
        // Give time for notification to send
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
const express = require('express');
const logger = require('./utils/consoleLogger');
const stepLogger = require('./utils/stepLogger');

// Import commands and handlers
const { 
  startCommand,
  helpCommand, 
  statusCommand,
  pinterestLoginCommand,
  pinterestLogoutCommand,
  pinterestStatusCommand
} = require('./commands');
const { handleMessage } = require('./messageHandler');
const { handleCallbackQuery, deleteMessageAfterDelay } = require('./handlers/callbackHandler');
const { checkBackendStatus } = require('./utils/statusUtils');
const { setupMaintenanceTasks } = require('./services/maintenanceService');
const queueService = require('./services/queueService');
const GroupProcessor = require('./group/groupProcessor');

// Set up Axios to retry failed requests
axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

// Create Express app for webhook mode
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send({ status: 'ok', timestamp: new Date() });
});

// Initialize Telegram bot
let bot;

if (config.useWebhook) {
  // Webhook configuration
  if (config.publicUrl) {
    const webhookPath = `/bot${config.token}`;
    const webhookUrl = `${config.publicUrl}${webhookPath}`;
    
    bot = new TelegramBot(config.token, { webHook: { port: config.port } });
    
    // Set the webhook
    bot.setWebHook(webhookUrl)
      .then(() => logger.success(`Webhook set to ${webhookUrl}`))
      .catch(err => {
        logger.error(`Failed to set webhook: ${err}`);
      });
    
    // Endpoint for webhook
    app.post(webhookPath, (req, res) => {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    });
    
    // If not started via setWebHook, start the Express server
    if (!app.listening) {
      app.listen(config.port, () => {
        logger.success(`Webhook server running on port ${config.port}`);
      });
    }
    
    logger.info("Bot is running in webhook mode...");
  } else {
    logger.error("Public URL not provided for webhook mode");
    process.exit(1);
  }
} else {
  // Polling mode
  bot = new TelegramBot(config.token, { polling: true });
  logger.info("Bot is running in polling mode...");
}

// Register command handlers
bot.onText(/\/start/, async (msg) => {
  const { sentMessage, userMessageId } = await startCommand(bot, msg);
  deleteMessageAfterDelay(bot, msg.chat.id, sentMessage.message_id, 15000);
  deleteMessageAfterDelay(bot, msg.chat.id, userMessageId, 15000);
});

bot.onText(/\/help/, async (msg) => {
  const { sentMessage, userMessageId } = await helpCommand(bot, msg);
  deleteMessageAfterDelay(bot, msg.chat.id, sentMessage.message_id, 15000);
  deleteMessageAfterDelay(bot, msg.chat.id, userMessageId, 15000);
});

bot.onText(/\/status/, async (msg) => {
  const { sentMessage, userMessageId } = await statusCommand(bot, msg, checkBackendStatus);
  deleteMessageAfterDelay(bot, msg.chat.id, sentMessage.message_id, 15000);
  deleteMessageAfterDelay(bot, msg.chat.id, userMessageId, 15000);
});

bot.onText(/\/usage/, async (msg) => {
  const { sentMessage, userMessageId } = await commands.usageCommand(bot, msg);
  deleteMessageAfterDelay(bot, msg.chat.id, sentMessage.message_id, 15000);
  deleteMessageAfterDelay(bot, msg.chat.id, userMessageId, 15000);
});

// Register Pinterest command handlers
bot.onText(/\/pinterest_login/, async (msg) => {
  const { sentMessages, userMessageId } = await pinterestLoginCommand(bot, msg);
  sentMessages.forEach(sentMessage => {
    deleteMessageAfterDelay(bot, msg.chat.id, sentMessage.message_id, 15000);
  });
  deleteMessageAfterDelay(bot, msg.chat.id, userMessageId, 15000);
});

bot.onText(/\/pinterest_logout/, async (msg) => {
  const { sentMessage, userMessageId } = await pinterestLogoutCommand(bot, msg);
  deleteMessageAfterDelay(bot, msg.chat.id, sentMessage.message_id, 15000);
  deleteMessageAfterDelay(bot, msg.chat.id, userMessageId, 15000);
});

bot.onText(/\/pinterest_status/, async (msg) => {
  const { sentMessage, userMessageId } = await pinterestStatusCommand(bot, msg);
  deleteMessageAfterDelay(bot, msg.chat.id, sentMessage.message_id, 15000);
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
    await require('./commands/group').process(bot, msg, groupProcessor);
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

// Admin commands for status notifications
bot.onText(/\/addadmin/, async (msg) => {
  try {
    const { sentMessage, userMessageId } = await commands.addAdminCommand(bot, msg);
    deleteMessageAfterDelay(bot, msg.chat.id, sentMessage.message_id, 15000);
    deleteMessageAfterDelay(bot, msg.chat.id, userMessageId, 15000);
  } catch (error) {
    logger.error(`Error in addadmin command: ${error.message}`);
  }
});

bot.onText(/\/removeadmin/, async (msg) => {
  try {
    const { sentMessage, userMessageId } = await commands.removeAdminCommand(bot, msg);
    deleteMessageAfterDelay(bot, msg.chat.id, sentMessage.message_id, 15000);
    deleteMessageAfterDelay(bot, msg.chat.id, userMessageId, 15000);
  } catch (error) {
    logger.error(`Error in removeadmin command: ${error.message}`);
  }
});

// Make groupProcessor globally accessible
global.groupProcessor = null;

// Delegate message processing to messageHandler.js
bot.on('message', async (msg) => {
  try {
    await handleMessage(bot, msg, groupProcessor);
  } catch (error) {
    logger.error(`Error handling message: ${error.message}`);
  }
});

// Setup callback query handler
bot.on('callback_query', async (callbackQuery) => {
  await handleCallbackQuery(bot, callbackQuery, checkBackendStatus);
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

// Initialize the queue processor and group processor
let groupProcessor;

(async () => {
  try {
    // No queue processor needed anymore
    logger.info("Direct processing mode - no queue being used");
    
    // Initialize the group processor
    logger.processing("Initializing group processor...");
    const groupProcessor = new GroupProcessor(bot);
    await groupProcessor.initialize();
    
    // Store in global for access from commands
    global.groupProcessor = groupProcessor;
    
    if (groupProcessor.groupInfo) {
      logger.success(`Group processor initialized for "${groupProcessor.groupInfo.title}"`);
      
      // Process any pending messages in the group
      logger.processing("Checking for unprocessed messages in group...");
      const processedCount = await groupProcessor.processUnprocessedMessages();
      
      if (processedCount > 0) {
        logger.success(`Processing ${processedCount} links from group`);
      } else {
        logger.success("No pending links in group");
      }
    } else {
      logger.warn("Group processor initialization failed. To use the group feature:");
      logger.warn("1. Create a Telegram group for collecting links");
      logger.warn("2. Add this bot to the group");
      logger.warn("3. Run /register command in that group");
    }
  } catch (error) {
    logger.error(`Initialization error: ${error.message}`);
  }
})();

logger.success("Bot initialization complete");

// For queue initialization:
async function initQueue() {
  if (initialized.queue) {
    return;
  }
  
  logger.processing("Initializing link processing queue...");
  
  try {
    // Your queue initialization code
    
    initialized.queue = true;
    logger.success("Queue initialized successfully");
  } catch (error) {
    logger.error(`Queue initialization failed: ${error.message}`);
  }
}

// For queue processor:
async function initLocalQueueProcessor() {
  if (initialized.queueProcessor) {
    return;
  }
  
  logger.processing("Initializing queue processor...");
  
  try {
    // Your queue processor initialization code
    
    initialized.queueProcessor = true;
    logger.success("Queue processor initialized");
  } catch (error) {
    logger.error(`Queue processor initialization failed: ${error.message}`);
  }
}

// For group processor:
async function initGroupProcessor() {
  if (initialized.group) {
    return;
  }
  
  logger.processing("Initializing group processor...");
  
  try {
    // Your group processor initialization code
    
    initialized.group = true;
    
    if (groupProcessor.groupInfo) {
      logger.success(`Group processor initialized for "${groupProcessor.groupInfo.title}"`);
      // Process pending messages
    } else {
      logger.warn("Group processor initialization failed");
    }
  } catch (error) {
    logger.error(`Group initialization failed: ${error.message}`);
  }
}

// Send online notification after bot is fully initialized
(async () => {
  try {
    await statusNotifier.notifyOnline(bot);
  } catch (error) {
    logger.error(`Error sending online notification: ${error.message}`);
  }
})();