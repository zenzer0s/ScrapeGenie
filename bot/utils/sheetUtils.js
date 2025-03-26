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

function createNavigationButtons(currentPage, totalPages) {
    const buttons = [];
    const navRow = [];
    
    // First button
    navRow.push({
        text: '⏮️ First',
        callback_data: `sheet_page_1`
    });
    
    // Previous button
    navRow.push({
        text: '◀️ Prev',
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
    
    // Last button
    navRow.push({
        text: '⏭️ Last',
        callback_data: `sheet_page_${totalPages}`
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

module.exports = {
    formatSheetDataMessage,
    createNavigationButtons
};