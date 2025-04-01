const stepLogger = require('../../utils/stepLogger');
const googleService = require('../../services/googleService');

async function googleStatusCommand(bot, msg) {
    const chatId = msg.chat.id;
    stepLogger.info('CMD_GOOGLE_STATUS', { chatId });

    try {
        // Get connection status
        const status = await googleService.getStatus(chatId);
        stepLogger.debug('GOOGLE_STATUS_RESULT', { chatId, isConnected: status });

        // CHANGE THIS LOGIC:
        if (status) {
            // User is already connected - show connected message
            await bot.sendMessage(
                chatId,
                '✅ You are connected to Google Sheets!\n\n' +
                'You can use /scrape to save content directly to your spreadsheet.',
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📊 View Spreadsheet Data', callback_data: 'google_sheet' }],
                            [{ text: '❌ Disconnect Google', callback_data: 'google_disconnect' }]
                        ]
                    }
                }
            );
        } else {
            // User is not connected - only show auth button in this case
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