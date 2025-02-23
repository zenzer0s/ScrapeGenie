const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { startCommand, helpCommand, statusCommand, usageCommand } = require('./commands');
const { handleUrlMessage } = require('./messageHandler');

const token = process.env.TELEGRAM_BOT_TOKEN;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

if (!token) {
  console.error("❌ Telegram Bot Token not found! Check your .env file.");
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
    return false;
  }
}

console.log("🚀 Bot is running...");
