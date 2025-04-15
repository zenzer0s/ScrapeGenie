/**
 * Escapes Markdown characters in text
 * @param {string} text - The text to escape
 * @returns {string} Escaped text
 */
function escapeMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\*/g, '\\*')
    .replace(/\_/g, '\\_')
    .replace(/\`/g, '\\`')
    .replace(/\~/g, '\\~');
}

/**
 * Sends a message safely, falling back to plain text if markdown parsing fails
 * @param {TelegramBot} bot - The Telegram bot instance
 * @param {number} chatId - Chat ID to send message to
 * @param {string} text - Message text
 * @param {object} options - Message options
 * @returns {Promise<Message>} The sent message
 */
async function sendSafeMessage(bot, chatId, text, options = {}) {
  try {
    // Try with original options first
    return await bot.sendMessage(chatId, text, options);
  } catch (error) {
    if (error.message.includes('can\'t parse entities')) {
      console.log('⚠️ Formatting error, sending without parse_mode');
      const safeOptions = { ...options };
      delete safeOptions.parse_mode;
      return await bot.sendMessage(chatId, text, safeOptions);
    }
    throw error;
  }
}

/**
 * Cleans up and formats Instagram text for better display in Telegram
 * @param {string} text - Original Instagram caption
 * @returns {string} Formatted text for Telegram
 */
function cleanupInstagramText(text) {
  if (!text) return '';
  
  // Preserve paragraphs and line breaks in Instagram captions
  let formatted = text
    // First, normalize all line breaks to \n
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    
    // Replace multiple blank lines with exactly 2 line breaks (one empty line)
    .replace(/\n{3,}/g, '\n\n')
    
    // Ensure hashtags start on their own line if there are many of them
    .replace(/(\s)(#\w+\s?#\w+\s?#\w+)/, '$1\n$2')
    
    // Bold @mentions for better visibility
    .replace(/@([a-zA-Z0-9._]+)/g, '<b>@$1</b>')
    
    // Make hashtags italic
    .replace(/#([a-zA-Z0-9_]+)/g, '<i>#$1</i>')
    
    // Make URLs clickable
    .replace(
      /(https?:\/\/[^\s]+)/g, 
      '<a href="$1">$1</a>'
    )
    
    // Ensure the text ends with exactly one line break
    .trim();
  
  // Escape HTML special characters except for our added tags
  formatted = escapeHtmlExceptTags(formatted);
  
  return formatted;
}

/**
 * Escapes HTML special characters while preserving existing HTML tags
 * @param {string} text - Text to escape
 * @returns {string} Escaped text with preserved tags
 */
function escapeHtmlExceptTags(text) {
  // First, temporarily replace HTML tags we want to keep
  const preservedTags = [];
  let index = 0;
  
  // Extract HTML tags to preserve them
  text = text.replace(/<\/?[bi]>|<a\s+href="[^"]*">[^<]*<\/a>/gi, match => {
    const placeholder = `__HTML_TAG_${index}__`;
    preservedTags.push(match);
    index++;
    return placeholder;
  });
  
  // Escape HTML special characters
  text = escapeHtml(text);
  
  // Restore preserved HTML tags
  for (let i = 0; i < preservedTags.length; i++) {
    text = text.replace(`__HTML_TAG_${i}__`, preservedTags[i]);
  }
  
  return text;
}

/**
 * Escapes HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Extract URLs from text
 * @param {string} text - Text to extract URLs from
 * @returns {Array<string>} - Array of URLs
 */
function extractUrls(text) {
  if (!text) return [];
  // URL regex pattern
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

/**
 * Extract a single URL from text (first one found)
 * @param {string} text - Text to extract URL from
 * @returns {string|null} - First URL found or null
 */
function extractUrl(text) {
  // This now uses the extractUrls function above
  const urls = extractUrls(text);
  return urls.length > 0 ? urls[0] : null;
}

/**
 * Truncate a URL for display
 * @param {string} url - URL to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated URL
 */
function truncateUrl(url, maxLength = 40) {
  if (!url) return '';
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + '...';
}

module.exports = {
  escapeMarkdown,
  sendSafeMessage,
  cleanupInstagramText,
  extractUrl, // Keep this one (now uses extractUrls)
  escapeHtml,
  escapeHtmlExceptTags,
  extractUrls,  // Add this
  truncateUrl   // Add this
};