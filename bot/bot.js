const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Add debug logging
console.log("🔍 Directory check:");
console.log(`• Current directory: ${__dirname}`);
console.log(`• Project root: ${path.resolve(__dirname, '..')}`);

// Ensure required directories exist
const fs = require('fs');
const dirs = [
  path.resolve(__dirname, '../data'),
  path.resolve(__dirname, '../data/sessions'),
  path.resolve(__dirname, '../logs'),
  path.resolve(__dirname, '../downloads')
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

console.log("🔍 Environment check:");
console.log(`• BACKEND_URL: ${process.env.BACKEND_URL}`);
console.log(`• PORT: ${process.env.PORT}`);
console.log(`• USE_WEBHOOK: ${process.env.USE_WEBHOOK}`);
console.log(`• PUBLIC_URL: ${process.env.PUBLIC_URL || 'Not set'}`);

if (!process.env.BACKEND_URL) {
  console.error("⚠️ BACKEND_URL is not set! Setting default value...");
  process.env.BACKEND_URL = `http://0.0.0.0:${process.env.PORT || 8080}`;
  console.log(`• BACKEND_URL (default): ${process.env.BACKEND_URL}`);
}

// Import libraries for both bot frameworks
const TelegramBot = require('node-telegram-bot-api');
const { Telegraf } = require("telegraf");
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const express = require('express');
const { 
  startCommand, 
  helpCommand, 
  statusCommand, 
  usageCommand,
  pinterestLoginCommand,
  pinterestLogoutCommand,
  pinterestStatusCommand
} = require('./commands');
const { handleUrlMessage, handleMessage } = require('./messageHandler');
const logger = require('./logger');

// Set up Axios to retry failed requests
axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const token = process.env.TELEGRAM_BOT_TOKEN;
const BACKEND_URL = process.env.BACKEND_URL || `http://0.0.0.0:${process.env.PORT || 8000}`;
const PORT = process.env.PORT || 8080;

// Webhook configuration
const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';
const PUBLIC_URL = process.env.PUBLIC_URL || '';

if (!token) {
  console.error("❌ Telegram Bot Token not found! Check your .env file.");
  logger.error("❌ Telegram Bot Token not found! Check your .env file.");
  process.exit(1);
}

if (USE_WEBHOOK && !PUBLIC_URL) {
  console.warn("⚠️ USE_WEBHOOK is true but PUBLIC_URL is not set. Webhook setup may fail.");
  logger.warn("USE_WEBHOOK is true but PUBLIC_URL is not set. Webhook setup may fail.");
}

// Create Express app for webhook mode
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send({ status: 'ok', timestamp: new Date() });
});

// Check if we should use the Telegraf implementation or the traditional one
const USE_TELEGRAF = process.env.USE_TELEGRAF === 'true';

let bot;
let telegrafBot;

if (USE_TELEGRAF) {
  // ===== TELEGRAF IMPLEMENTATION =====
  console.log("🔄 Using Telegraf implementation");
  
  if (USE_WEBHOOK) {
    telegrafBot = new Telegraf(token);
    
    // Set up webhook
    if (PUBLIC_URL) {
      const webhookPath = `/telegraf-webhook/${token}`;
      const webhookUrl = `${PUBLIC_URL}${webhookPath}`;
      
      // Setup webhook endpoint
      app.use(telegrafBot.webhookCallback(webhookPath));
      
      // Start the Express server
      app.listen(PORT, () => {
        console.log(`🚀 Webhook server running on port ${PORT}`);
        // Set webhook in Telegram
        telegrafBot.telegram.setWebhook(webhookUrl)
          .then(() => console.log(`✅ Webhook set to ${webhookUrl}`))
          .catch(err => {
            console.error(`❌ Failed to set webhook: ${err}`);
            logger.error(`Failed to set webhook: ${err}`);
          });
      });
    } else {
      console.error("❌ Public URL not provided for webhook mode");
      logger.error("Public URL not provided for webhook mode");
      process.exit(1);
    }
  } else {
    // Polling mode
    telegrafBot = new Telegraf(token);
    telegrafBot.launch()
      .then(() => console.log("🤖 Telegraf bot is running in polling mode..."))
      .catch(err => {
        console.error(`❌ Failed to start bot: ${err}`);
        logger.error(`Failed to start bot: ${err}`);
      });
  }
  
  // Handle basic commands
  telegrafBot.start((ctx) => ctx.reply("Welcome! Send me a URL to download content"));
  telegrafBot.help((ctx) => ctx.reply("Just send me a URL, and I'll download the content for you"));
  telegrafBot.command('status', async (ctx) => {
    const isBackendRunning = await checkBackendStatus();
    const statusMessage = isBackendRunning 
      ? "✅ Backend service is running." 
      : "❌ Backend service is not responding.";
    ctx.reply(statusMessage);
  });
  
  // Handle text messages (URLs)
  telegrafBot.on("text", async (ctx) => {
    const messageText = ctx.message.text;
    if (messageText.startsWith("http")) {
      await handleMessage(ctx);
    }
  });
  
  // Error handling
  telegrafBot.catch((err, ctx) => {
    logger.error(`Telegraf error for ${ctx.updateType}`, err);
    console.error(`Telegraf error for ${ctx.updateType}:`, err);
  });
  
  // Enable graceful stop
  process.once('SIGINT', () => telegrafBot.stop('SIGINT'));
  process.once('SIGTERM', () => telegrafBot.stop('SIGTERM'));
  
} else {
  // ===== NODE-TELEGRAM-BOT-API IMPLEMENTATION =====
  console.log("🔄 Using node-telegram-bot-api implementation");
  
  if (USE_WEBHOOK) {
    // Webhook configuration
    if (PUBLIC_URL) {
      const webhookPath = `/bot${token}`;
      const webhookUrl = `${PUBLIC_URL}${webhookPath}`;
      
      bot = new TelegramBot(token, { webHook: { port: PORT } });
      
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
        app.listen(PORT, () => {
          console.log(`🚀 Webhook server running on port ${PORT}`);
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
    bot = new TelegramBot(token, { polling: true });
    console.log("🚀 Bot is running in polling mode...");
  }
  
  // Register command handlers
  bot.onText(/\/start/, (msg) => startCommand(bot, msg));
  bot.onText(/\/help/, (msg) => helpCommand(bot, msg));
  bot.onText(/\/status/, (msg) => statusCommand(bot, msg, checkBackendStatus));
  bot.onText(/\/usage/, (msg) => usageCommand(bot, msg));
  
  // Register Pinterest command handlers
  bot.onText(/\/pinterest_login/, (msg) => pinterestLoginCommand(bot, msg));
  bot.onText(/\/pinterest_logout/, (msg) => pinterestLogoutCommand(bot, msg));
  bot.onText(/\/pinterest_status/, (msg) => pinterestStatusCommand(bot, msg));
  
  // Handle Pinterest login with token
  bot.onText(/\/start pinterest_login_(.+)/, async (msg, match) => {
    const token = match[1];
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    // Verify token and redirect to login page
    // ...
  });
  
  // Delegate URL message processing to messageHandler.js
  bot.on('message', async (msg) => {
    await handleUrlMessage(bot, msg);
  });
}

// Check backend status function
async function checkBackendStatus() {
  try {
    await axios.get(`${BACKEND_URL}/health`);
    return true;
  } catch (error) {
    console.error('Backend status check failed:', error);
    logger.error(`Backend status check failed: ${error.stack || error}`);
    return false;
  }
}

// Auto clean bot-error.log every 5 minutes
const logFilePath = path.join(__dirname, 'bot-error.log');
setInterval(() => {
  fs.truncate(logFilePath, 0, (err) => {
    if (err) {
      console.error("Error cleaning log file:", err);
      logger.error("Error cleaning log file: " + (err.stack || err));
    } else {
      console.log("bot-error.log cleaned successfully");
      logger.info("bot-error.log cleaned successfully");
    }
  });
}, 5 * 60 * 1000); // every 5 minutes

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
