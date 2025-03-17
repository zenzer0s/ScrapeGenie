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
  extractUrls,
  extractUrl,
  truncateUrl
};
