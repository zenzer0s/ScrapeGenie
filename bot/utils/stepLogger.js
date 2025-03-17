const fs = require('fs');
const path = require('path');

/**
 * Enhanced StepLogger with improved formatting and log cleanup on restart
 */
class StepLogger {
  constructor(options = {}) {
    this.options = {
      logDir: path.join(__dirname, '../../logs'),
      logFile: 'steps.log',
      consoleOutput: true,
      maxContextValueLength: 100,
      timeZone: 'local', // 'local' or 'utc'
      cleanOnStartup: true, // New option to control log cleanup
      ...options
    };
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.options.logDir)) {
      fs.mkdirSync(this.options.logDir, { recursive: true });
    }
    
    // Setup log file path
    this.logPath = path.join(this.options.logDir, this.options.logFile);
    
    // Clean log file on startup if enabled
    if (this.options.cleanOnStartup) {
      this._cleanLogFile();
    }
    
    // Create write stream
    this.logStream = fs.createWriteStream(this.logPath, { flags: 'a' });
    
    // Setup colors
    this.colors = {
      INFO: '\x1b[36m', // Cyan
      WARN: '\x1b[33m', // Yellow
      ERROR: '\x1b[31m', // Red
      DEBUG: '\x1b[90m', // Gray
      SUCCESS: '\x1b[32m', // Green
      RESET: '\x1b[0m'   // Reset
    };
    
    // Log startup
    this.info('LOGGER_INITIALIZED', { path: this.logPath, cleaned: this.options.cleanOnStartup });
  }
  
  /**
   * Clean/reset the log file
   * @private
   */
  _cleanLogFile() {
    try {
      // Truncate or create empty file
      fs.writeFileSync(this.logPath, '');
      console.log(`✅ Log file cleared: ${this.logPath}`);
    } catch (err) {
      console.error('Error cleaning log file:', err);
    }
  }
  
  /**
   * Format timestamp based on configured timezone
   * @private
   */
  _formatTimestamp() {
    const date = new Date();
    if (this.options.timeZone === 'utc') {
      return date.toISOString();
    }
    
    // Format with local timezone
    return date.toISOString().replace('Z', '');
  }
  
  /**
   * Format context object for display
   * @private
   */
  _formatContext(context) {
    if (!context || Object.keys(context).length === 0) {
      return '';
    }
    
    return Object.entries(context)
      .map(([key, value]) => {
        let formatted = typeof value === 'object' ? JSON.stringify(value) : String(value);
        
        // Truncate long values
        if (formatted.length > this.options.maxContextValueLength) {
          formatted = formatted.substring(0, this.options.maxContextValueLength - 3) + '...';
        }
        
        return `${key}=${formatted}`;
      })
      .join(' ');
  }
  
  /**
   * Log a step
   * @param {string} step - Step description
   * @param {Object} context - Context data
   * @param {string} level - Log level
   */
  log(step, context = {}, level = 'INFO') {
    const timestamp = this._formatTimestamp();
    const contextStr = this._formatContext(context);
    
    // Format: [TIMESTAMP] [LEVEL] [STEP] context_key=value context_key=value
    const logEntry = `[${timestamp}] [${level.padEnd(5)}] [${step.padEnd(30)}] ${contextStr}\n`;
    
    // Write to file
    this.logStream.write(logEntry);
    
    // Output to console if enabled
    if (this.options.consoleOutput) {
      const color = this.colors[level] || this.colors.INFO;
      console.log(`${color}${logEntry.trim()}${this.colors.RESET}`);
    }
  }
  
  /**
   * Manually clean the log file
   */
  cleanLog() {
    this.logStream.end();
    this._cleanLogFile();
    this.logStream = fs.createWriteStream(this.logPath, { flags: 'a' });
    this.info('LOG_FILE_CLEANED', {});
  }
  
  /**
   * Close logger and flush any pending writes
   */
  close() {
    this.logStream.end();
  }
  
  // Convenience methods
  info(step, context) { this.log(step, context, 'INFO'); }
  warn(step, context) { this.log(step, context, 'WARN'); }
  error(step, context) { this.log(step, context, 'ERROR'); }
  debug(step, context) { this.log(step, context, 'DEBUG'); }
  success(step, context) { this.log(step, context, 'SUCCESS'); }
}

// Create singleton instance
const logger = new StepLogger();

// Export convenience methods directly
module.exports = {
  logStep: (step, context, level) => logger.log(step, context, level),
  info: (step, context) => logger.info(step, context),
  warn: (step, context) => logger.warn(step, context),
  error: (step, context) => logger.error(step, context),
  debug: (step, context) => logger.debug(step, context),
  success: (step, context) => logger.success(step, context),
  cleanLog: () => logger.cleanLog(),
  close: () => logger.close(),
  
  // Allow access to the logger instance
  logger
};