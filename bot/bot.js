const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const fs = require('fs');
const { startCommand, helpCommand, statusCommand, usageCommand } = require('./commands');
const { handleUrlMessage } = require('./messageHandler');
const logger = require('./logger');

// Set up Axios to retry failed requests (e.g., ECONNRESET)
axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const token = process.env.TELEGRAM_BOT_TOKEN;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

if (!token) {
  console.error("❌ Telegram Bot Token not found! Check your .env file.");
  logger.error("❌ Telegram Bot Token not found! Check your .env file.");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Register command handlers
bot.onText(/\/start/, (msg) => startCommand(bot, msg));
bot.onText(/\/help/, (msg) => helpCommand(bot, msg));
bot.onText(/\/status/, (msg) => statusCommand(bot, msg, checkBackendStatus));
bot.onText(/\/usage/, (msg) => usageCommand(bot, msg));

// Delegate URL message processing to messageHandler.js
bot.on('message', async (msg) => {
  await handleUrlMessage(bot, msg);
});

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

console.log("🚀 Bot is running...");

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
