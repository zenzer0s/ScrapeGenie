const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Configuration
const token = process.env.TELEGRAM_BOT_TOKEN;
const BACKEND_URL = 'http://localhost:5000';

// Check if token exists
if (!token) {
    console.error("❌ Telegram Bot Token not found! Check your .env file.");
    process.exit(1);
}

// Create bot instance
const bot = new TelegramBot(token, { polling: true });

// Error handling
bot.on('polling_error', (error) => console.error('Polling error:', error));
bot.on('error', (error) => console.error('General error:', error));

// Start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        await bot.sendMessage(chatId, 
            `👋 *Welcome to ScrapeGenie!* 🧞‍♂️\n\n` +
            `I can extract information from:\n\n` +
            `🔹 *YouTube Videos* 📺\n` +
            `🔹 *Instagram Posts & Reels* 📸\n` +
            `🔹 *Any Website* 🌍\n\n` +
            `📌 Just send me a URL and I’ll do the magic!`
        , { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Error in /start command:', error);
        await bot.sendMessage(chatId, '❌ _Sorry, there was an error processing your request._', { parse_mode: 'Markdown' });
    }
});

// Help command with improved formatting
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        await bot.sendMessage(chatId,
            `📖 *ScrapeGenie Help Guide*\n\n` +
            `🔹 Send a URL to extract its details.\n\n` +
            `💡 *Supported Platforms:*\n` +
            `   • *YouTube* - Gets title, thumbnail, and video link.\n` +
            `   • *Instagram* - Extracts posts, reels with captions.\n` +
            `   • *Websites* - Fetches title, description & preview.\n\n` +
            `🔹 Commands:\n` +
            `/start - Start the bot\n` +
            `/help - Show this help message\n` +
            `/status - Check bot status\n`
        , { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Error in /help command:', error);
        await bot.sendMessage(chatId, '❌ _Sorry, there was an error processing your request._', { parse_mode: 'Markdown' });
    }
});

// Status command
bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const status = await checkBackendStatus();
        const uptime = process.uptime();
        const uptimeStr = formatUptime(uptime);

        await bot.sendMessage(chatId,
            `🟢 *Bot Status*\n\n` +
            `✅ *Bot:* Online\n` +
            `⏱ *Uptime:* ${uptimeStr}\n` +
            `${status ? '✅' : '❌'} *Backend:* ${status ? 'Connected' : 'Not Connected'}`
        , { parse_mode: 'Markdown' });

    } catch (error) {
        console.error('Error in /status command:', error);
        await bot.sendMessage(chatId, '❌ _Sorry, there was an error checking the status._', { parse_mode: 'Markdown' });
    }
});

// Improved URL handling with enhanced UX
bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('http')) {
        const chatId = msg.chat.id;
        const url = msg.text.trim();

        try {
            // Send loading message
            const processingMsg = await bot.sendMessage(chatId, '⏳ _Fetching details..._', { parse_mode: 'Markdown' });

            const response = await axios.post(`${BACKEND_URL}/api/scrape`, { url });
            const data = response.data;

            await bot.deleteMessage(chatId, processingMsg.message_id);

            if (!data.success) {
                throw new Error(data.error || 'Failed to scrape data');
            }

            switch (data.type) {
                case 'youtube': {
                    const caption = `📺 *${data.title}*\n\n🔗 [Watch Video](${data.originalUrl})`;
                    if (data.mediaUrl) {
                        await bot.sendPhoto(chatId, data.mediaUrl, { caption, parse_mode: 'Markdown' });
                    } else {
                        await bot.sendMessage(chatId, caption, { parse_mode: 'Markdown' });
                    }
                    break;
                }
                case 'instagram':
                    if (data.contentType === 'reel') {
                        await bot.sendMessage(chatId,
                            `📱 *Instagram Reel*\n\n📝 *Caption:* ${data.caption}\n\n🔗 [View Reel](${data.originalUrl})`
                        , { parse_mode: 'Markdown' });
                    } else {
                        const messageText = `📸 *Instagram Post*\n\n📝 ${data.caption}\n\n🔗 [View Post](${data.originalUrl})`;
                        if (data.mediaUrl) {
                            await bot.sendPhoto(chatId, data.mediaUrl, { caption: messageText, parse_mode: 'Markdown' });
                        } else {
                            await bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown' });
                        }
                    }
                    break;
                case 'website':
                    await bot.sendMessage(chatId,
                        `🌍 *${data.title}*\n\n📝 ${data.description}\n\n🔗 [Read More](${data.originalUrl})`
                    , { parse_mode: 'Markdown' });
                    break;
                default:
                    throw new Error('Unsupported content type');
            }

        } catch (error) {
            console.error('Error processing URL:', error);
            await bot.sendMessage(chatId,
                '❌ _Sorry, I encountered an error while processing your URL._\n' +
                '_Please make sure the link is valid and try again._'
            , { parse_mode: 'Markdown' });
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
