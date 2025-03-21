const axios = require('axios');
const config = require('../config/botConfig');
const stepLogger = require('../utils/stepLogger');

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
    // Convert userId to string
    const response = await api.post('/api/scrape', {
      url,
      userId: String(userId)  // Convert to string
    });
    
    // Add debug logging to check response structure
    stepLogger.debug('API_RESPONSE_STRUCTURE', {
      hasData: !!response.data,
      topLevelKeys: Object.keys(response.data),
      hasNestedData: response.data && !!response.data.data,
      nestedKeys: response.data && response.data.data ? Object.keys(response.data.data) : 'none'
    });
    
    // Return the nested data object to avoid accessing issues downstream
    if (response.data && response.data.success && response.data.data) {
      return response.data.data; // Extract the nested data
    }
    
    return response.data;
  } catch (error) {
    stepLogger.error('SCRAPE_API_ERROR', {
      url,
      error: error.message,
      status: error.response?.status
    });
    throw error;
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
  checkBackendHealth,
  getPinterestStatus,
  generatePinterestToken,
  logoutPinterest
};