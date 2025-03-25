const stepLogger = require('../../utils/stepLogger');
const googleService = require('../../services/googleService');

async function googleStatusCommand(bot, msg) {
    const chatId = msg.chat.id;
    stepLogger.info('CMD_GOOGLE_STATUS', { chatId });

    try {
        const isConnected = await googleService.checkConnectionStatus(chatId);

        let sentMessage;
        if (isConnected) {
            sentMessage = await bot.sendMessage(
                chatId,
                '✅ Google Sheets is connected!\n\n' +
                'Your scraped website data will be automatically stored in your Google Drive.\n\n' +
                'Available commands:\n' +
                '/google_disconnect - Disconnect Google Sheets\n'
            );
        } else {
            const authUrl = await googleService.getAuthUrl(chatId);
            const connectButton = {
                inline_keyboard: [[
                    { text: '🔗 Connect Google Sheets', url: authUrl }
                ]]
            };

            sentMessage = await bot.sendMessage(
                chatId,
                '❌ Google Sheets is not connected.\n\n' +
                'Connect to store your scraped website data automatically:',
                { reply_markup: connectButton }
            );
        }

        return { sentMessage, userMessageId: msg.message_id };
    } catch (error) {
        stepLogger.error('CMD_GOOGLE_STATUS_ERROR', { chatId, error: error.message });
        const sentMessage = await bot.sendMessage(
            chatId,
            '❌ Failed to check Google connection status. Please try again later.'
        );
        return { sentMessage, userMessageId: msg.message_id };
    }
}

module.exports = googleStatusCommand;