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

// Delegate message processing to messageHandler.js
bot.on('message', async (msg) => {
  try {
    await handleMessage(bot, msg);
  } catch (error) {
    console.error("Error handling message:", error);
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

// Initialize the queue processor
(async () => {
  try {
    await initQueueProcessor(bot);
    console.log("✅ Queue processor initialized");
  } catch (error) {
    console.error("❌ Queue initialization error:", error.message);
  }
})();

console.log("✅ Bot initialization complete");