const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const config = require('../config/botConfig');

/**
 * Setup maintenance tasks
 */
function setupMaintenanceTasks() {
  // Auto clean bot-error.log every 5 minutes
  const logFilePath = path.join(config.paths.logs, 'bot-error.log');
  
  setInterval(() => {
    fs.truncate(logFilePath, 0, (err) => {
      if (err) {
        console.error("Error cleaning log file:", err);
        logger.error("Error cleaning log file: " + (err.stack || err));
      } else {
        console.log("bot-error.log cleaned successfully");
        logger.info("bot-error.log cleaned successfully");
      }
    });
  }, 5 * 60 * 1000); // every 5 minutes
  
  console.log("🧹 Maintenance tasks scheduled");
}

module.exports = { setupMaintenanceTasks };