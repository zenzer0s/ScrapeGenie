const stepLogger = require('../../utils/stepLogger');
const googleService = require('../../services/googleService');
const { checkBackendAvailable } = require('../utils/errorHandlers');

async function googleDisconnectCommand(bot, msg) {
    const chatId = msg.chat.id;
    stepLogger.log(`Processing Google disconnect for chat ${chatId}`);

    try {
        await checkBackendAvailable();
        const isConnected = await googleService.checkConnectionStatus(chatId);

        if (!isConnected) {
            await bot.sendMessage(
                chatId,
                '❌ You are not connected to Google Sheets.\n\n' +
                'Use /google_connect to connect your account.'
            );
            return;
        }

        // Show confirmation keyboard
        const confirmKeyboard = {
            inline_keyboard: [[
                { text: '✅ Yes, disconnect', callback_data: 'google_disconnect_confirm' },
                { text: '❌ No, keep connected', callback_data: 'google_disconnect_cancel' }
            ]]
        };

        await bot.sendMessage(
            chatId,
            '⚠️ Are you sure you want to disconnect Google Sheets?\n\n' +
            'Your sheet will remain in your Google Drive, but new data won\'t be stored.',
            { reply_markup: confirmKeyboard }
        );

    } catch (error) {
        stepLogger.error(`Google disconnect error: ${error.message}`);
        await bot.sendMessage(
            chatId,
            '❌ Failed to process disconnect request. Please try again later.'
        );
    }
}

// Handle callback queries for disconnect confirmation
async function handleDisconnectCallback(bot, query) {
    const chatId = query.message.chat.id;
    const action = query.data;

    try {
        if (action === 'google_disconnect_confirm') {
            await googleService.disconnectGoogle(chatId);
            await bot.editMessageText(
                '✅ Google Sheets disconnected successfully.\n\n' +
                'Use /google_connect to reconnect anytime.',
                {
                    chat_id: chatId,
                    message_id: query.message.message_id
                }
            );
        } else {
            await bot.editMessageText(
                '✅ Google Sheets connection maintained.',
                {
                    chat_id: chatId,
                    message_id: query.message.message_id
                }
            );
        }
    } catch (error) {
        stepLogger.error(`Disconnect callback error: ${error.message}`);
        await bot.editMessageText(
            '❌ Failed to disconnect. Please try again later.',
            {
                chat_id: chatId,
                message_id: query.message.message_id
            }
        );
    }
}

module.exports = {
    googleDisconnectCommand,
    handleDisconnectCallback
};