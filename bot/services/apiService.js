const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://0.0.0.0:8080';

/**
 * Call the scrape API to process a URL
 * @param {string} url - The URL to scrape
 * @param {string} userId - User ID
 * @returns {Promise<object>} The API response data
 */
async function callScrapeApi(url, userId) {
  console.log(`🔍 Calling API for URL: ${url}`);
  
  const response = await axios.post(`${BACKEND_URL}/api/scrape`, { 
    url,
    userId: userId.toString()
  });
  
  console.log("API Response:", JSON.stringify(response.data, null, 2));
  
  if (!response.data.success || !response.data.data) {
    throw new Error('API returned unsuccessful response');
  }
  
  return response.data.data;
}

module.exports = {
  callScrapeApi
};