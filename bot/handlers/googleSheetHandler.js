const stepLogger = require('../utils/stepLogger');
const googleService = require('../services/googleService');
const { 
    formatSheetListMessage, 
    formatSheetDetailMessage,
    createWebsiteButtons, 
    createBackButton 
} = require('../utils/sheetUtils');

async function handleSheetNavigation(bot, query, page) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    
    try {
        // Fetch data for requested page
        const pageData = await googleService.getSheetData(chatId, page);
        
        // Format the data as a message
        const message = formatSheetListMessage(pageData);
        
        // Create website buttons
        const websiteButtons = createWebsiteButtons(pageData);
        
        // Update the message with new data
        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: websiteButtons
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

async function handleWebsiteView(bot, query, index) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    
    try {
        // Get current page from button data
        const buttonRows = query.message.reply_markup.inline_keyboard;
        const navRow = buttonRows[buttonRows.length - 2]; // Navigation row is second to last
        const pageButton = navRow[2]; // Middle button shows current page
        const [currentPage, totalPages] = pageButton.text.split('/').map(num => parseInt(num));
        
        // Fetch data for the current page
        const pageData = await googleService.getSheetData(chatId, currentPage);
        
        // Get the selected website
        const selectedWebsite = pageData.entries[index];
        
        if (!selectedWebsite) {
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Website not found',
                show_alert: true
            });
            return false;
        }
        
        // Format the website details
        const detailMessage = formatSheetDetailMessage(selectedWebsite);
        
        // Create back button
        const backButton = createBackButton(currentPage);
        
        // Update the message with website details
        await bot.editMessageText(detailMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: backButton
        });
        
        // Answer the callback query
        await bot.answerCallbackQuery(query.id);
        return true;
    } catch (error) {
        stepLogger.error(`WEBSITE_VIEW_ERROR: ${error.message}`, { chatId, index });
        await bot.answerCallbackQuery(query.id, {
            text: '❌ Failed to view website details',
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
        
        if (action.startsWith('sheet_view_')) {
            const index = parseInt(action.split('_').pop());
            return await handleWebsiteView(bot, query, index);
        }
        
        if (action === 'sheet_refresh') {
            // Show a loading indicator
            await bot.answerCallbackQuery(query.id, {
                text: '🔄 Refreshing data...'
            });
            
            return await handleSheetNavigation(bot, query, 1);
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