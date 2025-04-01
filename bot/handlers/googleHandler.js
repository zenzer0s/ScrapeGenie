const stepLogger = require('../utils/stepLogger');
const googleService = require('../services/googleService');

async function handleGoogleCallback(bot, query) {
    const chatId = query.message.chat.id;
    const action = query.data;

    try {
        if (action === 'google_disconnect_confirm') {
            await googleService.disconnectGoogle(chatId);
            await bot.editMessageText(
                '✅ Google Sheets disconnected successfully.',
                {
                    chat_id: chatId,
                    message_id: query.message.message_id
                }
            );
        }
        await bot.answerCallbackQuery(query.id);
    } catch (error) {
        stepLogger.error('GOOGLE_CALLBACK_ERROR', { 
            action, 
            chatId, 
            error: error.message 
        });
        throw error;
    }
}

module.exports = { handleGoogleCallback };