const googleConnectCommand = require('./googleConnectCommand');
const googleStatusCommand = require('./googleStatusCommand');
const googleDisconnectCommand = require('./googleDisconnectCommand');
const googleSheetCommand = require('./googleSheetCommand');
const googleService = require('../../services/googleService'); // Add this at the top with your other imports
const { deleteMessageAfterDelay } = require('../../utils/messageUtils'); // Import the utility at the top of the file

// Update the handleDisconnectCallback function to remove deleteMessageAfterDelay
async function handleDisconnectCallback(bot, query) {
    const chatId = query.message.chat.id;
    const action = query.data;
    
    try {
        // If user wants to disconnect
        if (action === 'google_disconnect_confirm') {
            await bot.answerCallbackQuery(query.id);
            
            // Update message to show progress
            await bot.editMessageText(
                '🔄 Disconnecting from Google Sheets...',
                {
                    chat_id: chatId,
                    message_id: query.message.message_id
                }
            );
            
            // Call the service to disconnect
            const response = await googleService.disconnect(chatId);
            
            if (response.success) {
                // Update message to show success
                await bot.editMessageText(
                    '✅ Successfully disconnected from Google Sheets.\n\n' +
                    'Your spreadsheet information has been preserved. If you reconnect later, ' +
                    'you\'ll be able to access your existing spreadsheet.',
                    {
                        chat_id: chatId,
                        message_id: query.message.message_id,
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔄 Reconnect', callback_data: 'google_connect' }]
                            ]
                        }
                    }
                );
                
                // If you want to keep this behavior, use our new utility:
                // await deleteMessageAfterDelay(bot, chatId, query.message.message_id, 7000);
                // Otherwise, just remove this line completely
            } else {
                await bot.editMessageText(
                    `❌ Failed to disconnect: ${response.error || 'Unknown error'}`,
                    {
                        chat_id: chatId,
                        message_id: query.message.message_id
                    }
                );
            }
        } else {
            // User canceled the disconnect
            await bot.answerCallbackQuery(query.id, {
                text: 'Disconnect canceled'
            });
            
            // Update message to show connection status
            await bot.editMessageText(
                '✅ You are still connected to Google Sheets.\n\n' +
                'You can continue using Google Sheets integration normally.',
                {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📊 View Spreadsheet', callback_data: 'google_sheet' }],
                            [{ text: '❌ Disconnect Google', callback_data: 'google_disconnect' }]
                        ]
                    }
                }
            );
        }
    } catch (error) {
        console.error('Error in handleDisconnectCallback:', error);
        await bot.answerCallbackQuery(query.id, {
            text: 'An error occurred. Please try again.',
            show_alert: true
        });
    }
}

// Add new handler for create sheet functionality
async function handleCreateSheetCallback(bot, query) {
    const chatId = query.message.chat.id;
    
    try {
        // Show "processing" feedback
        await bot.answerCallbackQuery(query.id, {
            text: 'Creating new spreadsheet...',
            show_alert: false
        });
        
        // Update message to show "in progress"
        await bot.editMessageText(
            '🔄 Creating your new Google spreadsheet...',
            {
                chat_id: chatId,
                message_id: query.message.message_id
            }
        );
        
        // Create new spreadsheet
        const result = await googleService.createNewSpreadsheet(chatId);
        
        if (result.success) {
            // Success message
            await bot.editMessageText(
                '✅ New Google spreadsheet created successfully!\n\n' +
                'You can now use /scrape to add content to your spreadsheet.',
                {
                    chat_id: chatId,
                    message_id: query.message.message_id
                }
            );
        } else {
            // Error message
            await bot.editMessageText(
                `❌ Failed to create spreadsheet: ${result.message}`,
                {
                    chat_id: chatId,
                    message_id: query.message.message_id
                }
            );
        }
    } catch (error) {
        console.error('Create spreadsheet error:', error);
        await bot.answerCallbackQuery(query.id, {
            text: '❌ Failed to create spreadsheet',
            show_alert: true
        });
        
        await bot.editMessageText(
            '❌ Failed to create spreadsheet. Please try again later.',
            {
                chat_id: chatId,
                message_id: query.message.message_id
            }
        );
    }
}

// Add this new callback handler for recreating spreadsheets
async function handleRecreateSheetCallback(bot, query) {
    const chatId = query.message.chat.id;
    
    try {
        // Show processing status
        await bot.answerCallbackQuery(query.id, {
            text: 'Processing your request...'
        });
        
        // Update message to show progress
        await bot.editMessageText(
            '🔄 Deleting your old spreadsheet and creating a new one...',
            {
                chat_id: chatId,
                message_id: query.message.message_id
            }
        );
        
        // Call API to recreate spreadsheet
        const response = await googleService.recreateSpreadsheet(chatId);
        
        if (response.success) {
            // Success message
            await bot.editMessageText(
                '✅ Your Google spreadsheet has been recreated successfully!\n\n' +
                'Your previous data has been deleted and a fresh spreadsheet is ready to use.',
                {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📊 View Spreadsheet', callback_data: 'google_sheet' }]
                        ]
                    }
                }
            );
        } else {
            // Error message
            await bot.editMessageText(
                `❌ Failed to recreate spreadsheet: ${response.error || 'Unknown error'}`,
                {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Try Again', callback_data: 'google_recreate_sheet' }],
                            [{ text: '« Back', callback_data: 'google_status' }]
                        ]
                    }
                }
            );
        }
    } catch (error) {
        console.error('Error in handleRecreateSheetCallback:', error);
        await bot.editMessageText(
            '❌ Failed to recreate spreadsheet. Please try again later.',
            {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Try Again', callback_data: 'google_recreate_sheet' }],
                        [{ text: '« Back', callback_data: 'google_status' }]
                    ]
                }
            }
        );
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
    'google_disconnect_cancel': handleDisconnectCallback,
    'google_create_sheet': handleCreateSheetCallback,
    'google_recreate_sheet': handleRecreateSheetCallback  // Add this line
};

// Register Google commands with bot
function registerGoogleCommands(bot) {
    // Register command handlers
    Object.entries(googleCommands).forEach(([command, handler]) => {
        bot.onText(new RegExp(`/${command}`), (msg) => handler(bot, msg));
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
    handleDisconnectCallback,
    handleCreateSheetCallback,
    handleRecreateSheetCallback  // Add this to exports
};