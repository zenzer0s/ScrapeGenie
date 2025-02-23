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

// Handle URL messages
bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('http')) {
        const chatId = msg.chat.id;
        const url = msg.text.trim();

        try {
            // Send processing message
            const processingMsg = await bot.sendMessage(chatId, '🔄 Processing your URL...');

            // Make request to backend
            const response = await axios.post(`${BACKEND_URL}/api/scrape`, { url });
            const data = response.data;

            // Delete processing message
            await bot.deleteMessage(chatId, processingMsg.message_id);

            if (!data.success) {
                throw new Error(data.error || 'Failed to scrape data');
            }

            switch (data.type) {
                case 'youtube':
                    // Send title and thumbnail together
                    await bot.sendPhoto(chatId, data.mediaUrl, {
                        caption: `📺 ${data.title}\n\n🔗 ${data.originalUrl}`
                    }).catch(async () => {
                        // If sending photo fails, send text only
                        await bot.sendMessage(chatId, 
                            `📺 ${data.title}\n\n` +
                            `❌ Couldn't load thumbnail\n\n` +
                            `🔗 ${data.originalUrl}`
                        );
                    });
                    break;

                case 'instagram':
                    if (data.mediaUrl) {
                        // Send media with caption
                        await bot.sendPhoto(chatId, data.mediaUrl, {
                            caption: `📸 ${data.title || 'Instagram Post'}\n\n` +
                                   `${data.description ? data.description + '\n\n' : ''}` +
                                   `🔗 ${data.originalUrl}`
                        }).catch(async () => {
                            // Fallback text message
                            await bot.sendMessage(chatId,
                                `📸 ${data.title || 'Instagram Post'}\n\n` +
                                `${data.description ? data.description + '\n\n' : ''}` +
                                `❌ Couldn't load media\n\n` +
                                `🔗 ${data.originalUrl}`
                            );
                        });
                    } else {
                        await bot.sendMessage(chatId,
                            `📸 ${data.title || 'Instagram Post'}\n\n` +
                            `${data.description ? data.description + '\n\n' : ''}` +
                            `🔗 ${data.originalUrl}`
                        );
                    }
                    break;

                case 'website':
                    let message = '🌐 Website Information\n\n';
                    if (data.title) message += `📑 ${data.title}\n\n`;
                    if (data.description) message += `📝 ${data.description}\n\n`;
                    message += `🔗 ${data.url || url}`;
                    
                    await bot.sendMessage(chatId, message);
                    
                    // If website has an image, send it separately
                    if (data.image) {
                        await bot.sendPhoto(chatId, data.image).catch(() => {
                            // Ignore image sending errors
                        });
                    }
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