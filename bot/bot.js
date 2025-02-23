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
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

bot.on('error', (error) => {
    console.error('General error:', error);
});

// Start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        await bot.sendMessage(chatId, 
            'Welcome to ScrapeGenie! 🧞‍♂️\n\n' +
            'I can help you extract information from:\n' +
            '• YouTube videos 📺\n' +
            '• Instagram posts 📸\n' +
            '• Any website 🌐\n\n' +
            'Just send me a URL to get started!'
        );
    } catch (error) {
        console.error('Error in /start command:', error);
        await bot.sendMessage(chatId, '❌ Sorry, there was an error processing your request.');
    }
});

// Help command
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        await bot.sendMessage(chatId,
            '🔍 How to use ScrapeGenie:\n\n' +
            '1. YouTube Videos:\n' +
            '   Send any YouTube URL to get title and thumbnail\n\n' +
            '2. Instagram Posts:\n' +
            '   Send any Instagram post URL to get content\n\n' +
            '3. Websites:\n' +
            '   Send any website URL to get its information\n\n' +
            'Commands:\n' +
            '/start - Start the bot\n' +
            '/help - Show this help message\n' +
            '/status - Check bot status'
        );
    } catch (error) {
        console.error('Error in /help command:', error);
        await bot.sendMessage(chatId, '❌ Sorry, there was an error processing your request.');
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
            '🤖 Bot Status\n\n' +
            `✅ Bot: Online\n` +
            `⏱ Uptime: ${uptimeStr}\n` +
            `${status ? '✅' : '❌'} Backend: ${status ? 'Connected' : 'Not Connected'}`
        );
    } catch (error) {
        console.error('Error in /status command:', error);
        await bot.sendMessage(chatId, '❌ Sorry, there was an error checking the status.');
    }
});

// Updated URL handling section
bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('http')) {
        const chatId = msg.chat.id;
        const url = msg.text.trim();

        try {
            const processingMsg = await bot.sendMessage(chatId, '🔄 Processing your URL...');

            const response = await axios.post(`${BACKEND_URL}/api/scrape`, { url });
            const data = response.data;

            await bot.deleteMessage(chatId, processingMsg.message_id);

            if (!data.success) {
                throw new Error(data.error || 'Failed to scrape data');
            }

            switch (data.type) {
                case 'youtube':
                    await bot.sendMessage(chatId,
                        `📺 ${data.title}\n\n` +
                        `${data.description ? `📝 ${data.description}\n\n` : ''}` +
                        `🔗 ${data.originalUrl}`
                    );
                    if (data.mediaUrl) {
                        await bot.sendPhoto(chatId, data.mediaUrl).catch(() => {
                            console.log('Failed to send YouTube thumbnail');
                        });
                    }
                    break;

                case 'instagram':
                    if (data.contentType === 'reel') {
                        await bot.sendMessage(chatId,
                            `📱 Instagram Reel\n\n` +
                            `${data.caption ? `📝 ${data.caption}\n\n` : ''}` +
                            `🔗 ${data.originalUrl}`
                        );
                    } else {
                        let message = `📸 Instagram Post\n\n`;
                        if (data.caption) message += `📝 ${data.caption}\n\n`;
                        message += `🔗 ${data.originalUrl}`;
                        
                        await bot.sendMessage(chatId, message);
                        
                        if (data.mediaUrl) {
                            await bot.sendPhoto(chatId, data.mediaUrl).catch(() => {
                                console.log('Failed to send Instagram media');
                            });
                        }
                    }
                    break;

                case 'website':
                    await bot.sendMessage(chatId,
                        `🌐 ${data.title}\n\n` +
                        `${data.description ? `📝 ${data.description}\n\n` : ''}` +
                        `🔗 ${data.originalUrl}`
                    );
                    break;

                default:
                    throw new Error('Unsupported content type');
            }

        } catch (error) {
            console.error('Error processing URL:', error);
            await bot.sendMessage(chatId, 
                '❌ Sorry, I encountered an error while processing your URL.\n' +
                'Please make sure the URL is valid and try again.'
            );
        }
    }
});

// Utility function to check backend status
async function checkBackendStatus() {
    try {
        await axios.get(`${BACKEND_URL}/health`);
        return true;
    } catch (error) {
        console.error('Backend status check failed:', error);
        return false;
    }
}

// Utility function to format uptime
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
