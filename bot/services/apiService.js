const axios = require('axios');
const config = require('../config/botConfig');
const stepLogger = require('../utils/stepLogger');

// Create axios instance with defaults
const api = axios.create({
  baseURL: `${config.backendUrl}/api`,  // Add /api here
  timeout: 30000, // Reduced from 60s to 30s
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'ScrapeGenie-Bot/1.0'
  }
});

/**
 * Call the scrape API to process a URL
 * @param {string} url - The URL to scrape
 * @param {string|number} userId - User ID
 * @param {Object} options - Additional options
 * @returns {Promise<object>} The API response data
 */
async function callScrapeApi(url, userId, options = {}) {
  const requestId = generateRequestId();
  const maxRetries = options.retries || 1; // Reduced from 2 to 1
  let attempts = 0;
  
  stepLogger.info('API_CALL_START', { 
    requestId,
    url: url.substring(0, 100),
    userId
  });
  
  while (attempts <= maxRetries) {
    attempts++;
    
    try {
      const startTime = Date.now();
      
      const response = await api.post('/api/scrape', { 
        url,
        userId: userId.toString(),
        priority: options.priority || 'high', // Add priority flag
        ...options
      });
      
      const elapsed = Date.now() - startTime;
      
      stepLogger.success('API_CALL_SUCCESS', { 
        requestId,
        elapsed,
        statusCode: response.status,
        contentType: response.headers['content-type'],
        dataSize: approximateSize(response.data)
      });
      
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || 'API returned unsuccessful response');
      }
      
      return response.data.data;
    } catch (error) {
      const isRetryable = isRetryableError(error);
      
      stepLogger.error('API_CALL_ERROR', { 
        requestId,
        attempt: attempts,
        status: error.response?.status,
        error: error.message,
        retryable: isRetryable
      });
      
      if (attempts > maxRetries || !isRetryable) {
        const errorMessage = formatErrorMessage(error);
        throw new Error(errorMessage);
      }
      
      // Reduced wait time between retries
      const delayMs = Math.min(1000 * attempts, 3000); // Max 3 second wait
      stepLogger.info('API_RETRY_WAIT', { 
        requestId, 
        attempt: attempts, 
        delayMs 
      });
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Check if an error should trigger a retry
 * @param {Error} error - The error to check
 * @returns {boolean} True if should retry
 */
function isRetryableError(error) {
  // Network errors are retryable
  if (!error.response) return true;
  
  // 5xx errors are retryable
  if (error.response.status >= 500) return true;
  
  // 429 Too Many Requests is retryable
  if (error.response.status === 429) return true;
  
  // Other errors are not retryable
  return false;
}

/**
 * Format a user-friendly error message
 * @param {Error} error - The error to format
 * @returns {string} Formatted error message
 */
function formatErrorMessage(error) {
  if (!error.response) {
    return `Network error: Could not connect to API server. Please check your internet connection.`;
  }
  
  switch (error.response.status) {
    case 400:
      return `Invalid request: ${error.response.data?.message || 'Bad Request'}`;
    case 401:
    case 403:
      return `Authentication error: ${error.response.data?.message || 'Not authorized'}`;
    case 404:
      return `The requested resource could not be found`;
    case 429:
      return `Rate limit exceeded. Please try again in a few minutes.`;
    case 500:
      return `Server error: The API server encountered an error. Please try again later.`;
    default:
      return error.response.data?.message || error.message || 'Unknown error occurred';
  }
}

/**
 * Generate a short request ID for tracking
 * @returns {string} Request ID
 */
function generateRequestId() {
  return Math.random().toString(36).substring(2, 8);
}

/**
 * Get approximate size of response data
 * @param {object} data - Response data
 * @returns {string} Formatted size
 */
function approximateSize(data) {
  const jsonSize = JSON.stringify(data).length;
  
  if (jsonSize < 1024) {
    return `${jsonSize} bytes`;
  } else if (jsonSize < 1024 * 1024) {
    return `${(jsonSize / 1024).toFixed(1)} KB`;
  } else {
    return `${(jsonSize / (1024 * 1024)).toFixed(1)} MB`;
  }
}

/**
 * Check backend health status
 * @returns {Promise<object>} Health status
 */
async function checkBackendHealth() {
  try {
    const startTime = Date.now();
    const response = await api.get('/health');
    const elapsed = Date.now() - startTime;
    
    stepLogger.info('HEALTH_CHECK_COMPLETE', { 
      status: response.status,
      elapsed
    });
    
    return {
      success: true,
      status: response.status,
      data: response.data,
      elapsed
    };
  } catch (error) {
    stepLogger.error('HEALTH_CHECK_FAILED', { 
      error: error.message,
      status: error.response?.status 
    });
    
    return {
      success: false,
      status: error.response?.status || 0,
      error: error.message
    };
  }
}

module.exports = {
  callScrapeApi,
  checkBackendHealth
};