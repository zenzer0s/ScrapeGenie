const { checkBackendHealth } = require('../services/apiService');
const stepLogger = require('./stepLogger');
const config = require('../config/botConfig');

/**
 * Check backend status with detailed information
 * @returns {Promise<object>} Status information object
 */
async function checkBackendStatus() {
  try {
    stepLogger.info('BACKEND_STATUS_CHECK_START');
    
    // Use the centralized API service instead of direct axios call
    const healthResult = await checkBackendHealth();
    
    if (healthResult.success) {
      stepLogger.success('BACKEND_STATUS_CHECK_SUCCESS', {
        status: healthResult.status,
        responseTime: `${healthResult.elapsed}ms`
      });
      
      return {
        online: true,
        status: healthResult.status,
        data: healthResult.data,
        responseTime: healthResult.elapsed
      };
    } else {
      stepLogger.warn('BACKEND_STATUS_CHECK_FAILED', {
        status: healthResult.status,
        error: healthResult.error
      });
      
      return {
        online: false,
        status: healthResult.status,
        error: healthResult.error
      };
    }
  } catch (error) {
    stepLogger.error('BACKEND_STATUS_CHECK_ERROR', { 
      error: error.message 
    });
    
    return {
      online: false,
      error: error.message
    };
  }
}

module.exports = { checkBackendStatus };