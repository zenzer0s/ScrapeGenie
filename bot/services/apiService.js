const axios = require('axios');
const config = require('../config/botConfig');
const stepLogger = require('../utils/stepLogger');
const googleService = require('./googleService');

// Configure axios instance with defaults
const api = axios.create({
  baseURL: config.backendUrl,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'ScrapeGenie-Bot/1.0'
  }
});

/**
 * Call the scraping API
 * @param {string} url - URL to scrape
 * @param {string} userId - User ID to associate with the scrape
 * @returns {Promise<Object>} - API response
 */
async function callScrapeApi(url, userId) {
  try {
    const response = await api.post('/api/scrape', {
      url,
      userId
    });
    
    return response.data;
  } catch (error) {
    stepLogger.error('SCRAPE_API_ERROR', {
      url,
      error: error.message,
      status: error.response?.status
    });
    
    // Create a more informative error object
    const enhancedError = new Error(
      error.response?.data?.error || error.message
    );
    
    // Add status and original response data
    enhancedError.status = error.response?.status;
    enhancedError.data = error.response?.data;
    
    throw enhancedError;
  }
}

/**
 * Call the scrape API with Google Sheets integration
 * @param {string} url - URL to scrape
 * @param {string|number} userId - User ID
 * @param {string|number} chatId - Chat ID for Sheets integration
 * @returns {Promise<object>} - Scraped data
 */
async function callScrapeApiWithSheets(url, userId, chatId) {
  try {
    // First check if user has Google connected
    const isConnected = await googleService.checkConnectionStatus(chatId);
    
    if (isConnected) {
      stepLogger.info('GOOGLE_SHEETS_ENABLED', { chatId });
      
      // Use the scrape-and-store endpoint
      const response = await api.post('/api/google/scrape-and-store', {
        url,
        chatId
      });
      
      return response.data;
    } else {
      // Use regular scraping endpoint
      return await callScrapeApi(url, userId);
    }
  } catch (error) {
    stepLogger.error('SCRAPE_WITH_SHEETS_ERROR', { 
      chatId, 
      url, 
      error: error.message 
    });
    
    // Fallback to regular scraping
    return await callScrapeApi(url, userId);
  }
}

/**
 * Check if the backend API is healthy
 * @returns {Promise<boolean>} - True if API is healthy
 */
async function checkBackendHealth() {
  try {
    const response = await api.get('/health', { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    stepLogger.error('HEALTH_CHECK_ERROR', {
      error: error.message
    });
    return false;
  }
}

/**
 * Get Pinterest auth status
 * @param {string} userId - User ID to check status for
 * @returns {Promise<Object>} - Auth status
 */
async function getPinterestStatus(userId) {
  try {
    const response = await api.get('/api/auth/status', {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    stepLogger.error('PINTEREST_STATUS_ERROR', {
      userId,
      error: error.message,
      status: error.response?.status
    });
    throw error;
  }
}

/**
 * Generate Pinterest auth token
 * @param {string} userId - User ID to generate token for
 * @returns {Promise<Object>} - Auth token response
 */
async function generatePinterestToken(userId) {
  try {
    const response = await api.post('/api/auth/generate-token', { userId });
    return response.data;
  } catch (error) {
    stepLogger.error('PINTEREST_TOKEN_ERROR', {
      userId,
      error: error.message,
      status: error.response?.status
    });
    throw error;
  }
}

/**
 * Logout from Pinterest
 * @param {string} userId - User ID to logout
 * @returns {Promise<Object>} - Logout response
 */
async function logoutPinterest(userId) {
  try {
    const response = await api.post('/api/auth/logout', { userId });
    return response.data;
  } catch (error) {
    stepLogger.error('PINTEREST_LOGOUT_ERROR', {
      userId,
      error: error.message,
      status: error.response?.status
    });
    throw error;
  }
}

// Export the functions and api instance
module.exports = {
  api,
  callScrapeApi,
  callScrapeApiWithSheets,
  checkBackendHealth,
  getPinterestStatus,
  generatePinterestToken,
  logoutPinterest
};