const stepLogger = require('../utils/stepLogger');
const googleService = require('../services/googleService');
const { 
    formatSheetListMessage, 
    formatSheetDetailMessage,
    createWebsiteButtons, 
    createBackButton 
} = require('../utils/sheetUtils');

// Update the handleSheetNavigation function
async function handleSheetNavigation(bot, query, page, forceRefresh = false) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    
    try {
        // Get current page from button data to check if we're staying on the same page
        let currentPage = 1;
        let totalPages = 1;
        
        try {
            const buttonRows = query.message.reply_markup.inline_keyboard;
            if (buttonRows && buttonRows.length >= 2) {
                const navRow = buttonRows[buttonRows.length - 2]; // Navigation row is second to last
                if (navRow && navRow.length >= 2) {
                    const pageButton = navRow[1]; // Middle button shows current page (now at index 1)
                    if (pageButton && pageButton.text) {
                        const pageParts = pageButton.text.split('/');
                        if (pageParts.length === 2) {
                            currentPage = parseInt(pageParts[0]) || 1;
                            totalPages = parseInt(pageParts[1]) || 1;
                        }
                    }
                }
            }
        } catch (err) {
            // Continue with default values
        }
        
        // If we're not forcing a refresh and the requested page is same as current,
        // just acknowledge the callback without changing anything
        if (!forceRefresh && page === currentPage) {
            // For Next button on last page or Prev button on first page
            if ((page === totalPages && query.data.includes('next')) || 
                (page === 1 && query.data.includes('prev'))) {
                await bot.answerCallbackQuery(query.id, {
                    text: page === 1 ? 'Already on first page' : 'Already on last page',
                    show_alert: false
                });
                return true;
            }
            
            // For manual navigation to same page
            if (query.data.startsWith('sheet_page_')) {
                await bot.answerCallbackQuery(query.id);
                return true;
            }
        }
        
        // For refresh button
        if (forceRefresh) {
            // Show "refreshing" notification
            await bot.answerCallbackQuery(query.id, {
                text: '🔄 Refreshing data...'
            });
        }
        
        // Fetch data for requested page
        const pageData = await googleService.getSheetData(chatId, page, undefined, forceRefresh);
        
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
        
        // If it was a refresh, show a success message
        if (forceRefresh) {
            await bot.answerCallbackQuery(query.id, {
                text: '✅ Data refreshed',
                show_alert: false
            });
        } else {
            // For regular navigation
            await bot.answerCallbackQuery(query.id);
        }
        
        return true;
    } catch (error) {
        // Handle the "message not modified" error gracefully
        if (error.message && error.message.includes('message is not modified')) {
            // Just acknowledge the callback without an error
            await bot.answerCallbackQuery(query.id);
            return true;
        }
        
        stepLogger.error(`SHEET_NAVIGATION_ERROR: ${error.message}`, { chatId, page });
        await bot.answerCallbackQuery(query.id, {
            text: '❌ Navigation failed',
            show_alert: true
        });
        throw error;
    }
}

// Update the handleWebsiteView function to pass the index to createBackButton
async function handleWebsiteView(bot, query, index) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    
    try {
        // Get current page from button data
        // This is where the error is happening - safely extract the page number
        let currentPage = 1; // Default to page 1
        
        try {
            const buttonRows = query.message.reply_markup.inline_keyboard;
            if (buttonRows && buttonRows.length >= 2) {
                const navRow = buttonRows[buttonRows.length - 2]; // Navigation row is second to last
                if (navRow && navRow.length >= 2) {
                    const pageButton = navRow[1]; // Middle button shows current page (now at index 1)
                    if (pageButton && pageButton.text) {
                        const pageParts = pageButton.text.split('/');
                        if (pageParts.length >= 1) {
                            currentPage = parseInt(pageParts[0]) || 1;
                        }
                    }
                }
            }
        } catch (err) {
            stepLogger.warn('Failed to extract page number from button data', { 
                error: err.message, 
                fallbackPage: 1 
            });
            // Continue with default page 1
        }
        
        stepLogger.debug('VIEW_WEBSITE_DETAILS', { 
            chatId, 
            index, 
            currentPage 
        });
        
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
        
        // Create back button with delete option
        const backButton = createBackButton(currentPage, index);
        
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

// Add this new function to handle deletion
async function handleWebsiteDelete(bot, query, index) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    
    try {
        // Get current page from button data
        const buttonRows = query.message.reply_markup.inline_keyboard;
        const buttonsRow = buttonRows[0]; // First row with back and delete buttons
        const backButton = buttonsRow[0]; // Back button contains page info
        const pageNumber = parseInt(backButton.callback_data.split('_').pop());
        
        // Show confirmation dialog
        await bot.editMessageText(
            '⚠️ *Are you sure you want to delete this website?*\n\nThis action cannot be undone.',
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: '✅ Yes, delete it',
                                callback_data: `sheet_delete_confirm_${index}_${pageNumber}`
                            },
                            {
                                text: '❌ No, keep it',
                                callback_data: `sheet_view_${index}`
                            }
                        ]
                    ]
                }
            }
        );
        
        // Answer the callback query
        await bot.answerCallbackQuery(query.id);
        return true;
    } catch (error) {
        stepLogger.error(`WEBSITE_DELETE_ERROR: ${error.message}`, { chatId, index });
        await bot.answerCallbackQuery(query.id, {
            text: '❌ Failed to prepare deletion',
            show_alert: true
        });
        throw error;
    }
}

// Add this function to handle delete confirmation
async function handleWebsiteDeleteConfirm(bot, query, index, pageNumber) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    
    try {
        // Send a loading message
        await bot.answerCallbackQuery(query.id, {
            text: '🔄 Deleting website...'
        });
        
        // Fetch data for the page
        const pageData = await googleService.getSheetData(chatId, pageNumber);
        
        // Get the website to delete
        const websiteToDelete = pageData.entries[index];
        
        if (!websiteToDelete) {
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Website not found',
                show_alert: true
            });
            return false;
        }
        
        // Delete the website from the sheet
        await googleService.deleteSheetEntry(chatId, websiteToDelete);
        
        // Show success message
        await bot.editMessageText(
            '✅ *Website Deleted Successfully*\n\nThe website has been removed from your saved websites.',
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: '◀️ Back to list',
                                callback_data: `sheet_page_${pageNumber}`
                            }
                        ]
                    ]
                }
            }
        );
        
        return true;
    } catch (error) {
        stepLogger.error(`WEBSITE_DELETE_CONFIRM_ERROR: ${error.message}`, { chatId, index });
        
        // Show error message
        await bot.editMessageText(
            `❌ *Error Deleting Website*\n\nCould not delete the website: ${error.message}`,
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: '◀️ Back to details',
                                callback_data: `sheet_view_${index}`
                            }
                        ]
                    ]
                }
            }
        );
        
        return false;
    }
}

// Update the handleSheetCallback function
async function handleSheetCallback(bot, query) {
    const chatId = query.message.chat.id;
    const action = query.data;
    const startTime = Date.now();
    
    try {
        if (action.startsWith('sheet_page_')) {
            const page = parseInt(action.split('_').pop());
            return await handleSheetNavigation(bot, query, page);
        } 
        
        if (action.startsWith('sheet_view_')) {
            const index = parseInt(action.split('_').pop());
            return await handleWebsiteView(bot, query, index);
        }
        
        if (action.startsWith('sheet_delete_confirm_')) {
            const parts = action.split('_');
            const index = parseInt(parts[3]);
            const pageNumber = parseInt(parts[4]);
            return await handleWebsiteDeleteConfirm(bot, query, index, pageNumber);
        }
        
        if (action.startsWith('sheet_delete_')) {
            const index = parseInt(action.split('_').pop());
            return await handleWebsiteDelete(bot, query, index);
        }
        
        if (action === 'sheet_refresh') {
            return await handleSheetNavigation(bot, query, 1, true);
        }
        
        if (action === 'sheet_noop') {
            await bot.answerCallbackQuery(query.id);
            return true;
        }
        
        return false; // Not handled
    } catch (error) {
        // Handle "message not modified" errors gracefully
        if (error.message && error.message.includes('message is not modified')) {
            await bot.answerCallbackQuery(query.id);
            return true;
        }
        
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
    } finally {
        stepLogger.debug('SHEET_CALLBACK_COMPLETED', {
            action,
            chatId,
            elapsed: Date.now() - startTime
        });
    }
}

module.exports = {
    handleSheetCallback
};