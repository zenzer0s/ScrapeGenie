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

// Import configuration and libraries
const config = require('./config/botConfig');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const express = require('express');

// Import commands and handlers
const { 
  startCommand, 
  helpCommand, 
  statusCommand, 
  usageCommand,
  pinterestLoginCommand,
  pinterestLogoutCommand,
  pinterestStatusCommand
} = require('./commands');
const { handleMessage } = require('./messageHandler');
const { handleCallbackQuery, deleteMessageAfterDelay } = require('./handlers/callbackHandler');
const { checkBackendStatus } = require('./utils/statusUtils');
const { setupMaintenanceTasks } = require('./services/maintenanceService');
const { initQueueProcessor } = require('./services/queueWorker');
const logger = require('./logger');
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
      .then(() => console.log(`✅ Webhook set to ${webhookUrl}`))
      .catch(err => {
        console.error(`❌ Failed to set webhook: ${err}`);
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
        console.log(`🚀 Webhook server running on port ${config.port}`);
      });
    }
    
    console.log("🤖 Bot is running in webhook mode...");
  } else {
    console.error("❌ Public URL not provided for webhook mode");
    logger.error("Public URL not provided for webhook mode");
    process.exit(1);
  }
} else {
  // Polling mode
  bot = new TelegramBot(config.token, { polling: true });
  console.log("🚀 Bot is running in polling mode...");
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
  const { sentMessage, userMessageId } = await usageCommand(bot, msg);
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
    console.error('Error handling /group command:', error);
  }
});

// Register the group command
bot.onText(/\/register/, async (msg) => {
  try {
    await require('./commands/registerGroup')(bot, msg);
  } catch (error) {
    console.error('Error handling /register command:', error);
  }
});

// Add these commands to your bot.js file

// Process command - starts forwarded message collection
bot.onText(/\/process/, async (msg) => {
  try {
    await require('./commands/process')(bot, msg);
  } catch (error) {
    console.error('Error handling /process command:', error);
  }
});

// Collect command - processes collected messages
bot.onText(/\/collect/, async (msg) => {
  try {
    await require('./commands/collect')(bot, msg);
  } catch (error) {
    console.error('Error handling /collect command:', error);
  }
});

// Make groupProcessor globally accessible
global.groupProcessor = null;

// Delegate message processing to messageHandler.js
bot.on('message', async (msg) => {
  try {
    await handleMessage(bot, msg, groupProcessor);
  } catch (error) {
    console.error("Error handling message:", error);
    logger.error(`Error handling message: ${error.message}`);
  }
});

// Setup callback query handler
bot.on('callback_query', async (callbackQuery) => {
  await handleCallbackQuery(bot, callbackQuery, checkBackendStatus);
});

// Global error handlers to prevent the process from crashing
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  logger.error(`Uncaught Exception: ${error.stack}`);
  // Optionally, restart the bot or perform cleanup
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error(`Unhandled Rejection at: ${promise} reason: ${reason}`);
  // Optionally, handle the rejection (restart or log further)
});

// Setup maintenance tasks
setupMaintenanceTasks();

// Initialize the queue processor and group processor
let groupProcessor;

(async () => {
  try {
    // Initialize the queue processor
    await initQueueProcessor(bot);
    console.log("✅ Queue processor initialized");
    
    // Initialize the group processor
    console.log("🔄 Initializing group processor...");
    const groupProcessor = new GroupProcessor(bot);
    await groupProcessor.initialize();
    
    // Store in global for access from commands
    global.groupProcessor = groupProcessor;
    
    if (groupProcessor.groupInfo) {
      console.log(`✅ Group processor initialized for "${groupProcessor.groupInfo.title}"`);
      
      // Process any pending messages in the group
      console.log("🔄 Checking for unprocessed messages in group...");
      const processedCount = await groupProcessor.processUnprocessedMessages();
      
      if (processedCount > 0) {
        console.log(`✅ Processing ${processedCount} links from group`);
      } else {
        console.log("✅ No pending links in group");
      }
    } else {
      console.warn("⚠️ Group processor initialization failed. To use the group feature:");
      console.warn("1. Create a Telegram group for collecting links");
      console.warn("2. Add this bot to the group");
      console.warn("3. Run /register command in that group");
    }
  } catch (error) {
    console.error("❌ Initialization error:", error.message);
  }
})();

console.log("✅ Bot initialization complete");