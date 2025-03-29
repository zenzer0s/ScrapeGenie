const stepLogger = require('../../utils/stepLogger');
const googleService = require('../../services/googleService');
const { formatSheetListMessage, createWebsiteButtons } = require('../../utils/sheetUtils');

async function googleSheetCommand(bot, msg) {
    const chatId = msg.chat.id;
    stepLogger.info('CMD_GOOGLE_SHEET', { chatId });

    try {
        // Check detailed connection status instead of just boolean
        const status = await googleService.getDetailedStatus(chatId);

        if (!status.connected) {
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
        
        // Handle case where user is authenticated but spreadsheet is missing
        if (status.spreadsheetMissing) {
            const createButton = {
                inline_keyboard: [[
                    { text: '📊 Create New Spreadsheet', callback_data: 'google_create_sheet' }
                ]]
            };

            const sentMessage = await bot.sendMessage(
                chatId,
                '⚠️ Your Google account is connected, but your spreadsheet is missing or was deleted.\n\n' +
                'Click the button below to create a new spreadsheet:',
                { reply_markup: createButton }
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