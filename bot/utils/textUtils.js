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
 * Cleans up Instagram text by removing hashtags and excessive formatting
 * @param {string} text - The text to clean up
 * @returns {string} Cleaned text
 */
function cleanupInstagramText(text) {
  if (!text) return '';
  
  return text
    // Remove all hashtags completely
    .replace(/#\w+/g, '')
    // Remove excessive line breaks
    .replace(/\n{3,}/g, '\n\n')
    // Remove excessive dots
    .replace(/\.{2,}/g, '...')
    // Clean up spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts URL from message text
 * @param {string} text - Message text
 * @returns {string|null} The first URL found or null
 */
function extractUrl(text) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = urlRegex.exec(text);
  return match ? match[0] : null;
}

module.exports = {
  escapeMarkdown,
  sendSafeMessage,
  cleanupInstagramText,
  extractUrl
};