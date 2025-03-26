// Create a new file: bot/utils/sheetUtils.js
function formatSheetDataMessage(pageData) {
    if (!pageData.entries || pageData.entries.length === 0) {
        return '📊 *Your Saved Websites*\n\nYou haven\'t saved any websites yet. Send a URL to get started!';
    }

    let message = `📊 *Your Saved Websites* (Page ${pageData.currentPage} of ${pageData.totalPages})\n\n`;
    
    pageData.entries.forEach((entry, index) => {
        message += `*${index+1}. ${entry.title || 'Untitled'}*\n`;
        message += `URL: ${entry.url || 'No URL'}\n`;
        
        // Truncate description if too long
        let description = entry.description || 'No description';
        if (description.length > 100) {
            description = description.substring(0, 97) + '...';
        }
        message += `Description: ${description}\n`;
        
        // Format date
        if (entry.dateAdded) {
            const date = new Date(entry.dateAdded);
            message += `Added: ${date.toLocaleDateString()}\n`;
        }
        
        message += '\n';
    });

    message += `Total entries: ${pageData.totalEntries}`;
    return message;
}

// Also update the original createNavigationButtons function to be consistent
function createNavigationButtons(currentPage, totalPages) {
    const buttons = [];
    const navRow = [];
    
    // Previous button
    navRow.push({
        text: '◀️ Previous',
        callback_data: `sheet_page_${Math.max(1, currentPage - 1)}`
    });
    
    // Page indicator
    navRow.push({
        text: `${currentPage}/${totalPages}`,
        callback_data: 'sheet_noop'
    });
    
    // Next button
    navRow.push({
        text: 'Next ▶️',
        callback_data: `sheet_page_${Math.min(totalPages, currentPage + 1)}`
    });
    
    buttons.push(navRow);
    
    // Action buttons
    buttons.push([
        {
            text: '🔄 Refresh',
            callback_data: `sheet_refresh`
        }
    ]);
    
    return { inline_keyboard: buttons };
}

// Create functions for the list-detail view

function formatSheetListMessage(pageData) {
    if (!pageData || !pageData.entries || pageData.entries.length === 0) {
        return '📊 *Your Saved Websites*\n\nYou haven\'t saved any websites yet. Send a URL to get started!';
    }

    let message = `📊 *Your Saved Websites* (Page ${pageData.currentPage} of ${pageData.totalPages})\n\n`;
    message += `Select a website to view details:\n`;
    message += `Total entries: ${pageData.totalEntries}`;
    
    return message;
}

function formatSheetDetailMessage(entry) {
    if (!entry) {
        return '❌ Website details not found.';
    }
    
    let message = `📝 *Website Details*\n\n`;
    message += `*Title:* ${entry.title || 'Untitled'}\n\n`;
    message += `*URL:* ${entry.url || 'No URL'}\n\n`;
    
    // Format description
    const description = entry.description || 'No description';
    message += `*Description:* ${description}\n\n`;
    
    // Format date
    if (entry.dateAdded) {
        const date = new Date(entry.dateAdded);
        message += `*Added:* ${date.toLocaleDateString()}`;
    }
    
    return message;
}

// Update the createWebsiteButtons function to remove First and Last buttons
function createWebsiteButtons(pageData) {
    const buttons = [];
    
    // Create a button for each website
    pageData.entries.forEach((entry, index) => {
        let title = entry.title || 'Untitled';
        
        // Truncate long titles
        if (title.length > 25) {
            title = title.substring(0, 22) + '...';
        }
        
        buttons.push([{
            text: `${index + 1}. ${title}`,
            callback_data: `sheet_view_${index}`
        }]);
    });
    
    // Navigation row - simplified version with just Prev/Next
    const navRow = [];
    
    // Previous button
    navRow.push({
        text: '◀️ Previous',
        callback_data: `sheet_page_${Math.max(1, pageData.currentPage - 1)}`
    });
    
    // Page indicator
    navRow.push({
        text: `${pageData.currentPage}/${pageData.totalPages}`,
        callback_data: 'sheet_noop'
    });
    
    // Next button
    navRow.push({
        text: 'Next ▶️',
        callback_data: `sheet_page_${Math.min(pageData.totalPages, pageData.currentPage + 1)}`
    });
    
    buttons.push(navRow);
    
    // Action buttons
    buttons.push([
        {
            text: '🔄 Refresh',
            callback_data: `sheet_refresh`
        }
    ]);
    
    return { inline_keyboard: buttons };
}

function createBackButton(pageNumber, index) {
    return {
        inline_keyboard: [
            [
                {
                    text: '◀️ Back to list',
                    callback_data: `sheet_page_${pageNumber}`
                },
                {
                    text: '🗑️ Delete',
                    callback_data: `sheet_delete_${index}`
                }
            ]
        ]
    };
}

module.exports = {
    formatSheetDataMessage,
    createNavigationButtons,
    formatSheetListMessage,
    formatSheetDetailMessage,
    createWebsiteButtons,
    createBackButton
};