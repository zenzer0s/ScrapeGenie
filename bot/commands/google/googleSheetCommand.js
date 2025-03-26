const stepLogger = require('../../utils/stepLogger');
const googleService = require('../../services/googleService');
const { formatSheetListMessage, createWebsiteButtons } = require('../../utils/sheetUtils');

async function googleSheetCommand(bot, msg) {
    const chatId = msg.chat.id;
    stepLogger.info('CMD_GOOGLE_SHEET', { chatId });

    try {
        // Check if user is connected to Google
        const isConnected = await googleService.checkConnectionStatus(chatId);

        if (!isConnected) {
            const authUrl = await googleService.getAuthUrl(chatId);
            const connectButton = {
                inline_keyboard: [[
                    { text: '🔗 Connect Google Sheets', url: authUrl }
                ]]
            };

            const sentMessage = await bot.sendMessage(
                chatId,
                '❌ You need to connect Google Sheets first to view your saved data.',
                { reply_markup: connectButton }
            );
            return { sentMessage, userMessageId: msg.message_id };
        }

        // Send a loading message
        const loadingMessage = await bot.sendMessage(
            chatId,
            '🔄 Loading your saved websites...'
        );

        try {
            // Fetch first page of data
            const pageData = await googleService.getSheetData(chatId, 1);
            
            // Create message with website buttons
            const message = formatSheetListMessage(pageData);
            const websiteButtons = createWebsiteButtons(pageData);

            // Edit the loading message with the actual data
            await bot.editMessageText(message, {
                chat_id: chatId,
                message_id: loadingMessage.message_id,
                parse_mode: 'Markdown',
                reply_markup: websiteButtons
            });

            return { sentMessage: loadingMessage, userMessageId: msg.message_id };
        } catch (error) {
            // Edit the loading message with error info
            await bot.editMessageText(
                '❌ Failed to retrieve your Google Sheets data.\n\nError: ' + error.message,
                {
                    chat_id: chatId,
                    message_id: loadingMessage.message_id
                }
            );
            
            return { sentMessage: loadingMessage, userMessageId: msg.message_id };
        }
    } catch (error) {
        stepLogger.error(`CMD_GOOGLE_SHEET_ERROR: ${error.message}`, { chatId });
        const sentMessage = await bot.sendMessage(
            chatId,
            '❌ Failed to retrieve your Google Sheets data. Please try again later.'
        );
        return { sentMessage, userMessageId: msg.message_id };
    }
}

module.exports = googleSheetCommand;