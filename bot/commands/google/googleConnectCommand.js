const stepLogger = require('../../utils/stepLogger');
const googleService = require('../../services/googleService');

// Update the connect command to handle returning users
async function googleConnectCommand(bot, msg) {
    const chatId = msg.chat.id;
    stepLogger.info('CMD_GOOGLE_CONNECT', { chatId });

    try {
        // First check if user is already connected
        const status = await googleService.getDetailedStatus(chatId);
        stepLogger.debug('GOOGLE_CONNECT_STATUS', { chatId, status });

        // If user is already fully connected with a sheet
        if (status.connected && status.authentication && !status.spreadsheetMissing) {
            // Check if this is a returning user with a previous sheet
            if (status.spreadsheetCreatedAt && status.daysSinceCreation > 1) {
                // Returning user with existing sheet
                await bot.sendMessage(
                    chatId,
                    '👋 Welcome back! You\'re already connected to your Google Sheets account.\n\n' +
                    'Your previously created spreadsheet is ready to use.',
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📊 View Your Data', callback_data: 'google_sheet' }],
                                [{ text: '🗑️ Create New Sheet', callback_data: 'google_recreate_sheet' }]
                            ]
                        }
                    }
                );
                return;
            } else {
                // Regular connected user
                await bot.sendMessage(
                    chatId,
                    '✅ You\'re already connected to Google Sheets!\n\n' +
                    'You can use /scrape to save content directly to your spreadsheet.',
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📊 View Spreadsheet', callback_data: 'google_sheet' }]
                            ]
                        }
                    }
                );
                return;
            }
        }
        
        // If user has a sheet but needs to re-authenticate
        if (status.connected && !status.authentication && status.spreadsheetId) {
            // Show "welcome back, please reconnect" message
            const authUrl = await googleService.getAuthUrl(chatId);
            
            await bot.sendMessage(
                chatId,
                '👋 Welcome back! Your Google Sheets data is still saved, but you need to reconnect your account.\n\n' +
                'Click the button below to reconnect and access your existing spreadsheet:',
                {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🔗 Reconnect Google Account', url: authUrl }
                        ]]
                    }
                }
            );
            return;
        }

        // Regular connection flow for new users
        const authUrl = await googleService.getAuthUrl(chatId);
        stepLogger.info('GOOGLE_AUTH_URL_REQUEST', { chatId });

        const connectButton = {
            inline_keyboard: [[
                { text: '🔗 Connect Google Sheets', url: authUrl }
            ]]
        };

        await bot.sendMessage(
            chatId,
            '📊 Connect your Google Sheets account to save and manage content.\n\n' +
            'Click the button below to connect your Google account:',
            { reply_markup: connectButton }
        );
    } catch (error) {
        stepLogger.error(`CMD_GOOGLE_CONNECT_ERROR: ${error.message}`, { chatId, error });
        await bot.sendMessage(
            chatId,
            '❌ Failed to generate Google authentication link. Please try again later.'
        );
    }
}

module.exports = googleConnectCommand;