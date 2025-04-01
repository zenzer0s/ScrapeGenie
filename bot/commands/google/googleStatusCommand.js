const stepLogger = require('../../utils/stepLogger');
const googleService = require('../../services/googleService');

// Update the status message for returning users
async function googleStatusCommand(bot, msg) {
    const chatId = msg.chat.id;
    stepLogger.info('CMD_GOOGLE_STATUS', { chatId });

    try {
        // Get detailed connection status
        const status = await googleService.getDetailedStatus(chatId);
        stepLogger.debug('GOOGLE_STATUS_RESULT', { chatId, status });

        // User is connected to Google Sheets
        if (status.connected && status.authentication) {
            // Prepare buttons based on whether a spreadsheet exists
            let message, buttons;
            
            if (!status.spreadsheetMissing) {
                // User has a working spreadsheet - check if they're returning
                const isReturning = status.spreadsheetCreatedAt && 
                    (new Date() - new Date(status.spreadsheetCreatedAt) > 24 * 60 * 60 * 1000);
                
                if (isReturning) {
                    message = '✅ Welcome back! You\'re connected to your existing Google spreadsheet.\n\n' +
                              'You can view your existing data or create a new spreadsheet if you prefer.';
                    
                    buttons = {
                        inline_keyboard: [
                            [{ text: '📊 View Existing Data', callback_data: 'google_sheet' }],
                            [{ text: '🗑️ Delete & Create New Sheet', callback_data: 'google_recreate_sheet' }],
                            [{ text: '❌ Disconnect Google', callback_data: 'google_disconnect' }]
                        ]
                    };
                } else {
                    // Regular connected user
                    message = '✅ You are connected to Google Sheets!\n\n' +
                              'You can use /scrape to save content directly to your spreadsheet.';
                    
                    buttons = {
                        inline_keyboard: [
                            [{ text: '📊 View Spreadsheet Data', callback_data: 'google_sheet' }],
                            [{ text: '❌ Disconnect Google', callback_data: 'google_disconnect' }]
                        ]
                    };
                }
            } else {
                // User connected but needs a sheet
                message = '✅ You\'re authenticated with Google, but you don\'t have a spreadsheet yet.\n\n' +
                          'Click the button below to create a new spreadsheet:';
                
                buttons = {
                    inline_keyboard: [
                        [{ text: '📄 Create New Spreadsheet', callback_data: 'google_create_sheet' }],
                        [{ text: '❌ Disconnect Google', callback_data: 'google_disconnect' }]
                    ]
                };
            }
            
            await bot.sendMessage(chatId, message, { reply_markup: buttons });
        } else {
            // Not connected - show connect button
            const authUrl = await googleService.getAuthUrl(chatId);
            stepLogger.info('GOOGLE_AUTH_URL_REQUEST', { chatId });

            const connectButton = {
                inline_keyboard: [[
                    { text: '🔗 Connect Google Sheets', url: authUrl }
                ]]
            };

            await bot.sendMessage(
                chatId,
                '❌ You are not connected to Google Sheets.\n\n' +
                'Click the button below to connect your Google account:',
                { reply_markup: connectButton }
            );
        }
    } catch (error) {
        stepLogger.error(`CMD_GOOGLE_STATUS_ERROR: ${error.message}`, { chatId, error });
        await bot.sendMessage(
            chatId,
            '❌ Failed to check Google Sheets connection status. Please try again later.'
        );
    }
}

module.exports = googleStatusCommand;