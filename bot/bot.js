const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Configuration
const token = process.env.TELEGRAM_BOT_TOKEN;
const BACKEND_URL = 'http://localhost:5000';

if (!token) {
  console.error("❌ Telegram Bot Token not found! Check your .env file.");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Error handling
bot.on('polling_error', (error) => console.error('Polling error:', error));
bot.on('error', (error) => console.error('General error:', error));

// /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    await bot.sendMessage(chatId, 
      `👋 *Welcome to ScrapeGenie!* 🧞‍♂️\n\n` +
      `I can extract information from:\n\n` +
      `🔹 *YouTube Videos* 📺\n` +
      `🔹 *Instagram Posts & Reels* 📸\n` +
      `🔹 *Websites* 🌍\n\n` +
      `📌 Just send me a URL and I’ll do the magic!`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error in /start command:', error);
    await bot.sendMessage(chatId, '❌ _Sorry, there was an error processing your request._', { parse_mode: 'Markdown' });
  }
});

// /help command
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    await bot.sendMessage(chatId,
      `📖 *ScrapeGenie Help Guide*\n\n` +
      `🔹 Send a URL to extract its details.\n\n` +
      `💡 *Supported Platforms:*\n` +
      `   • *YouTube* - Gets title, thumbnail, and video link.\n` +
      `   • *Instagram* - Extracts posts and reels with captions.\n` +
      `   • *Websites* - Fetches title, description & preview.\n\n` +
      `🔹 Commands:\n` +
      `/start - Start the bot\n` +
      `/help - Show this help message\n` +
      `/status - Check bot status\n`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error in /help command:', error);
    await bot.sendMessage(chatId, '❌ _Sorry, there was an error processing your request._', { parse_mode: 'Markdown' });
  }
});

// /status command
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const status = await checkBackendStatus();
    const uptimeStr = formatUptime(process.uptime());
    await bot.sendMessage(chatId,
      `🟢 *Bot Status*\n\n` +
      `✅ *Bot:* Online\n` +
      `⏱ *Uptime:* ${uptimeStr}\n` +
      `${status ? '✅' : '❌'} *Backend:* ${status ? 'Connected' : 'Not Connected'}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error in /status command:', error);
    await bot.sendMessage(chatId, '❌ _Sorry, there was an error checking the status._', { parse_mode: 'Markdown' });
  }
});

// Improved URL handling with loading animation and inline keyboards
bot.on('message', async (msg) => {
  if (msg.text && msg.text.startsWith('http')) {
    const chatId = msg.chat.id;
    const url = msg.text.trim();

    try {
      // Send initial loading message and start a timer to update it every 10 sec.
      const processingMsg = await bot.sendMessage(chatId, '⏳ _Fetching details..._', { parse_mode: 'Markdown' });
      let counter = 10;
      const timer = setInterval(async () => {
        try {
          await bot.editMessageText(`⏳ _Still working on it... (${counter}s)_`, { chat_id: chatId, message_id: processingMsg.message_id, parse_mode: 'Markdown' });
          counter += 10;
        } catch (e) {
          // Ignore edit errors if message was deleted
        }
      }, 10000);

      const response = await axios.post(`${BACKEND_URL}/api/scrape`, { url });
      clearInterval(timer);
      await bot.deleteMessage(chatId, processingMsg.message_id);
      const data = response.data;

      if (!data.success) {
        throw new Error(data.error || 'Failed to scrape data');
      }

      // Prepare inline keyboard for "View" button
      let keyboard;
      if (data.type === 'youtube') {
        keyboard = {
          inline_keyboard: [
            [{ text: 'View Video', url: data.originalUrl }]
          ]
        };
      } else if (data.type === 'instagram') {
        keyboard = {
          inline_keyboard: [
            [{ text: 'View Post', url: data.originalUrl }]
          ]
        };
      } else if (data.type === 'website') {
        keyboard = {
          inline_keyboard: [
            [{ text: 'Read More', url: data.originalUrl }]
          ]
        };
      }

      switch (data.type) {
        case 'youtube': {
          // Add "📺 YouTube Video" label
          const caption = `📺 *YouTube Video*\n\n*${data.title}*\n\n🔗 [Watch Video](${data.originalUrl})`;
          if (data.mediaUrl) {
            await bot.sendPhoto(chatId, data.mediaUrl, { caption, parse_mode: 'Markdown', reply_markup: keyboard });
          } else {
            await bot.sendMessage(chatId, caption, { parse_mode: 'Markdown', reply_markup: keyboard });
          }
          break;
        }
        case 'instagram':
          if (data.contentType === 'reel') {
            await bot.sendMessage(chatId,
              `📱 *Instagram Reel*\n\n📝 ${data.caption}\n\n🔗 [View Reel](${data.originalUrl})`,
              { parse_mode: 'Markdown', reply_markup: keyboard }
            );
          } else {
            const messageText = `📸 *Instagram Post*\n\n📝 ${data.caption}\n\n🔗 [View Post](${data.originalUrl})`;
            if (data.mediaUrl) {
              await bot.sendPhoto(chatId, data.mediaUrl, { caption: messageText, parse_mode: 'Markdown', reply_markup: keyboard });
            } else {
              await bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown', reply_markup: keyboard });
            }
          }
          break;
        case 'website': {
          // If a thumbnail is available, send it; else, send text message.
          const messageText = `🌍 *${data.title}*\n\n📝 ${data.description}\n\n🔗 [Read More](${data.originalUrl})`;
          if (data.mediaUrl) {
            await bot.sendPhoto(chatId, data.mediaUrl, { caption: messageText, parse_mode: 'Markdown', reply_markup: keyboard });
          } else {
            await bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown', reply_markup: keyboard });
          }
          break;
        }
        default:
          throw new Error('Unsupported content type');
      }
    } catch (error) {
      console.error('Error processing URL:', error);
      await bot.sendMessage(chatId,
        '❌ _Sorry, I encountered an error while processing your URL._\n' +
        '_Please make sure the link is valid and try again._',
        { parse_mode: 'Markdown' }
      );
    }
  }
});

// Check backend status
async function checkBackendStatus() {
  try {
    await axios.get(`${BACKEND_URL}/health`);
    return true;
  } catch (error) {
    console.error('Backend status check failed:', error);
    return false;
  }
}

// Format uptime
function formatUptime(uptime) {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down bot gracefully...');
  bot.stopPolling();
  process.exit(0);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
console.log("🚀 Bot is running...");
