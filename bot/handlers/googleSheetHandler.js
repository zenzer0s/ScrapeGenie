const stepLogger = require('../utils/stepLogger');
const googleService = require('../services/googleService');
const { formatSheetDataMessage, createNavigationButtons } = require('../utils/sheetUtils');

async function handleSheetNavigation(bot, query, page, forceRefresh = false) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    
    try {
        // Fetch data for requested page
        const pageData = await googleService.getSheetData(chatId, page);
        
        // Format the data as a message
        const message = formatSheetDataMessage(pageData);
        
        // Create navigation buttons
        const navigationButtons = createNavigationButtons(pageData.currentPage, pageData.totalPages);
        
        // Update the message with new data
        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: navigationButtons
        });
        
        // Answer the callback query
        await bot.answerCallbackQuery(query.id);
        return true;
    } catch (error) {
        stepLogger.error(`SHEET_NAVIGATION_ERROR: ${error.message}`, { chatId, page });
        await bot.answerCallbackQuery(query.id, {
            text: '❌ Failed to navigate sheets data',
            show_alert: true
        });
        throw error;
    }
}

async function handleSheetCallback(bot, query) {
    const chatId = query.message.chat.id;
    const action = query.data;
    
    try {
        if (action.startsWith('sheet_page_')) {
            const page = parseInt(action.split('_').pop());
            return await handleSheetNavigation(bot, query, page);
        } 
        
        if (action === 'sheet_refresh') {
            // Show a loading indicator
            await bot.answerCallbackQuery(query.id, {
                text: '🔄 Refreshing data...'
            });
            
            return await handleSheetNavigation(bot, query, 1, true);
        }
        
        if (action === 'sheet_noop') {
            await bot.answerCallbackQuery(query.id);
            return true;
        }
        
        return false; // Not handled
    } catch (error) {
        stepLogger.error(`SHEET_CALLBACK_ERROR: ${error.message}`, { chatId, action });
        
        // Let the user know there was an error
        try {
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Error: ' + error.message,
                show_alert: true
            });
        } catch (e) {
            // Ignore errors answering callback query
        }
        
        return false;
    }
}

module.exports = {
    handleSheetCallback
};