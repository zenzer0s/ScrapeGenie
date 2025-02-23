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
            'I can help you scrape data from various sources.\n\n' +
            'Available commands:\n' +
            '/start - Show this welcome message\n' +
            '/help - Show available commands\n' +
            '/status - Check bot status\n\n' +
            'Simply send me a URL to start scraping!'
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
            '🔍 Supported URLs:\n\n' +
            '• Instagram posts and profiles\n' +
            '• YouTube videos and channels\n' +
            '• General web pages\n\n' +
            'Just send me any URL and I\'ll extract the relevant information!'
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
        // Check backend status
        const status = await checkBackendStatus();
        const uptime = process.uptime();
        const uptimeStr = formatUptime(uptime);
        
        await bot.sendMessage(chatId,
            '🤖 System Status:\n\n' +
            `✅ Bot: Running\n` +
            `⏱ Bot Uptime: ${uptimeStr}\n` +
            `${status ? '✅' : '❌'} Backend: ${status ? 'Connected' : 'Not Connected'}`
        );
    } catch (error) {
        console.error('Error in /status command:', error);
        await bot.sendMessage(chatId, '❌ Sorry, there was an error checking the status.');
    }
});

// Handle URL messages
bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('http')) {
        const chatId = msg.chat.id;
        const url = msg.text.trim();

        try {
            // Send initial processing message
            await bot.sendMessage(chatId, '🔄 Processing your URL... Please wait.');

            // Make request to backend scraping service
            const response = await axios.post(`${BACKEND_URL}/api/scrape`, { url });
            const data = response.data;

            // Format and send the scraped data
            if (data.success) {
                let message = '✅ Here\'s what I found:\n\n';
                
                if (data.title) message += `📑 Title: ${data.title}\n`;
                if (data.description) message += `📝 Description: ${data.description}\n`;
                if (data.metadata) {
                    message += '\n📊 Additional Information:\n';
                    for (const [key, value] of Object.entries(data.metadata)) {
                        message += `• ${key}: ${value}\n`;
                    }
                }

                await bot.sendMessage(chatId, message);

                // If there are media files, send them
                if (data.mediaUrls && data.mediaUrls.length > 0) {
                    await bot.sendMessage(chatId, '🖼 Media found! Processing...');
                    for (const mediaUrl of data.mediaUrls) {
                        try {
                            await bot.sendPhoto(chatId, mediaUrl);
                        } catch (error) {
                            console.error('Error sending media:', error);
                        }
                    }
                }
            } else {
                throw new Error(data.error || 'Failed to scrape data');
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

// Startup message
console.log("🚀 Telegram Bot is running...");

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down bot gracefully...');
    bot.stopPolling();
    process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});