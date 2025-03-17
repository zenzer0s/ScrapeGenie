const axios = require('axios');
const logger = require('../logger');
const config = require('../config/botConfig');

/**
 * Check backend status
 * @returns {Promise<boolean>} True if backend is running
 */
async function checkBackendStatus() {
  try {
    await axios.get(`${config.backendUrl}/health`);
    return true;
  } catch (error) {
    console.error('Backend status check failed:', error);
    logger.error(`Backend status check failed: ${error.stack || error}`);
    return false;
  }
}

module.exports = { checkBackendStatus };