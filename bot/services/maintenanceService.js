const fs = require('fs');
const path = require('path');
const config = require('../config/botConfig');
const stepLogger = require('../utils/stepLogger');

/**
 * Setup maintenance tasks
 */
function setupMaintenanceTasks() {
  // Log cleanup schedule - once per hour instead of every 5 minutes
  const cleanupInterval = 60 * 60 * 1000; // 1 hour
  
  // Schedule regular maintenance
  setInterval(performMaintenance, cleanupInterval);
  
  // Also run once at startup
  performMaintenance();
  
  stepLogger.info('MAINTENANCE_SCHEDULED', { 
    intervalMs: cleanupInterval,
    intervalHuman: '1 hour'
  });
}

/**
 * Perform all maintenance tasks
 */
async function performMaintenance() {
  try {
    await cleanErrorLogs();
    await limitLogSizes();
    await cleanTempFiles();
    
    stepLogger.info('MAINTENANCE_COMPLETE');
  } catch (error) {
    stepLogger.error('MAINTENANCE_FAILED', { error: error.message });
  }
}

/**
 * Clean error logs
 */
async function cleanErrorLogs() {
  try {
    const logFilePath = path.join(config.paths.logs, 'bot-error.log');
    
    // Check if file exists
    if (!fs.existsSync(logFilePath)) {
      return;
    }
    
    await fs.promises.truncate(logFilePath, 0);
    stepLogger.info('ERROR_LOG_CLEANED', { path: logFilePath });
  } catch (error) {
    stepLogger.error('ERROR_LOG_CLEAN_FAILED', { error: error.message });
  }
}

/**
 * Limit size of log files
 */
async function limitLogSizes() {
  try {
    const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
    const logDir = config.paths.logs;
    
    // Read all log files
    const files = await fs.promises.readdir(logDir);
    
    for (const file of files) {
      if (!file.endsWith('.log')) continue;
      
      const filePath = path.join(logDir, file);
      const stats = await fs.promises.stat(filePath);
      
      // If file is bigger than limit, keep only second half
      if (stats.size > MAX_LOG_SIZE) {
        const data = await fs.promises.readFile(filePath, 'utf8');
        const newData = data.substring(Math.floor(data.length / 2));
        
        await fs.promises.writeFile(filePath, newData);
        
        stepLogger.info('LOG_SIZE_LIMITED', { 
          file, 
          oldSize: formatBytes(stats.size), 
          newSize: formatBytes(newData.length) 
        });
      }
    }
  } catch (error) {
    stepLogger.error('LOG_SIZE_LIMIT_FAILED', { error: error.message });
  }
}

/**
 * Clean temporary files (downloads older than 1 day)
 */
async function cleanTempFiles() {
  try {
    const downloadsDir = config.paths.downloads;
    
    if (!fs.existsSync(downloadsDir)) {
      return;
    }
    
    // Read all files in downloads directory
    const files = await fs.promises.readdir(downloadsDir);
    const now = Date.now();
    let deletedCount = 0;
    let deletedSize = 0;
    
    for (const file of files) {
      const filePath = path.join(downloadsDir, file);
      const stats = await fs.promises.stat(filePath);
      
      // Delete files older than 1 day
      if (now - stats.mtime.getTime() > 24 * 60 * 60 * 1000) {
        deletedSize += stats.size;
        await fs.promises.unlink(filePath);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      stepLogger.info('TEMP_FILES_CLEANED', { 
        count: deletedCount,
        size: formatBytes(deletedSize)
      });
    }
  } catch (error) {
    stepLogger.error('TEMP_FILES_CLEAN_FAILED', { error: error.message });
  }
}

/**
 * Format bytes to human readable string
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

module.exports = { setupMaintenanceTasks };