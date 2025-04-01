const stepLogger = require('../../utils/stepLogger');
const googleService = require('../../services/googleService');

async function googleConnectCommand(bot, msg) {
    const chatId = msg.chat.id;
    stepLogger.info('CMD_GOOGLE_CONNECT', { chatId });

    try {
        // Get auth URL from backend
        const authUrl = await googleService.getAuthUrl(chatId);
        
        const message = await bot.sendMessage(chatId, '🔄 Preparing Google Sheets connection...');

        // Short message with a button that triggers a callback instead of direct URL
        await bot.editMessageText('📊 Connect your Google account to store scraped website data:\n\n' +
            '1. Click the button below\n' +
            '2. Sign in with your Google account\n' +
            '3. Allow ScrapeGenie to access Google Sheets', {
            chat_id: chatId,
            message_id: message.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔗 Connect Google Sheets', callback_data: 'google_auth_url' }]
                ]
            }
        });

        return { sentMessage: message, userMessageId: msg.message_id };

    } catch (error) {
        stepLogger.error('CMD_GOOGLE_CONNECT_ERROR', { chatId, error: error.message });
        const sentMessage = await bot.sendMessage(
            chatId, 
            '❌ Failed to initialize Google connection. Please try again later.'
        );
        return { sentMessage, userMessageId: msg.message_id };
    }
}

module.exports = googleConnectCommand;