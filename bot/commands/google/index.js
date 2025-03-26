const googleConnectCommand = require('./googleConnectCommand');
const googleStatusCommand = require('./googleStatusCommand');
const googleDisconnectCommand = require('./googleDisconnectCommand');
const googleSheetCommand = require('./googleSheetCommand');

// Create your handleDisconnectCallback function here
async function handleDisconnectCallback(bot, query) {
    const chatId = query.message.chat.id;
    try {
        // Your disconnect logic here
        if (query.data === 'google_disconnect_confirm') {
            // Handle confirmation
            const googleService = require('../../services/googleService');
            await googleService.disconnectGoogle(chatId);
            
            await bot.answerCallbackQuery(query.id, {
                text: '✅ Google Sheets disconnected successfully!',
                show_alert: true
            });
            
            // Update the message
            await bot.editMessageText(
                '❌ Google Sheets is now disconnected. Your data will no longer be saved to Google Sheets.',
                {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    parse_mode: 'Markdown'
                }
            );
        } else {
            // Handle cancellation
            await bot.answerCallbackQuery(query.id, {
                text: 'Operation cancelled',
                show_alert: true
            });
            
            // Update the message
            await bot.editMessageText(
                '✅ Google Sheets remains connected.',
                {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    parse_mode: 'Markdown'
                }
            );
        }
    } catch (error) {
        console.error('Google disconnect error:', error);
        await bot.answerCallbackQuery(query.id, {
            text: '❌ Failed to process your request',
            show_alert: true
        });
    }
}

// Map of commands to their handlers
const googleCommands = {
    'google_connect': googleConnectCommand,
    'google_status': googleStatusCommand,
    'google_disconnect': googleDisconnectCommand
};

// Callback query handlers
const googleCallbacks = {
    'google_disconnect_confirm': handleDisconnectCallback,
    'google_disconnect_cancel': handleDisconnectCallback
};

// Register Google commands with bot
function registerGoogleCommands(bot) {
    // Register command handlers
    Object.entries(googleCommands).forEach(([command, handler]) => {
        bot.onText(new RegExp(`/${command}`), (msg) => handler(bot, msg));
    });

    // Register callback query handlers
    bot.on('callback_query', (query) => {
        const handler = googleCallbacks[query.data];
        if (handler) {
            handler(bot, query);
        }
    });

    // Add command descriptions
    bot.setMyCommands([
        // ...existing commands...
        { command: 'google_connect', description: 'Connect Google Sheets' },
        { command: 'google_status', description: 'Check Google Sheets connection' },
        { command: 'google_disconnect', description: 'Disconnect Google Sheets' }
    ]);
}

// ONLY ONE module.exports statement
module.exports = {
    registerGoogleCommands,
    googleCommands,
    googleCallbacks,
    googleConnectCommand,
    googleStatusCommand,
    googleDisconnectCommand,
    googleSheetCommand,
    handleDisconnectCallback  // Also export this function
};