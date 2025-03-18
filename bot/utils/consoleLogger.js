/**
 * Simple console logger with emoji prefixes
 */
class ConsoleLogger {
  constructor() {
    this.prefixes = {
      info: '🔍',
      success: '✅',
      warn: '⚠️',
      error: '❌',
      start: '🚀',
      processing: '🔄'
    };
  }
  
  /**
   * Log a message with an emoji prefix
   * @param {string} message - The message to log
   * @param {string} type - The type of message (info, success, warn, error)
   */
  log(message, type = 'info') {
    const prefix = this.prefixes[type] || '';
    console.log(`${prefix} ${message}`);
  }
  
  // Convenience methods
  info(message) { this.log(message, 'info'); }
  success(message) { this.log(message, 'success'); }
  warn(message) { this.log(message, 'warn'); }
  error(message) { this.log(message, 'error'); }
  start(message) { this.log(message, 'start'); }
  processing(message) { this.log(message, 'processing'); }
  
  /**
   * Log a list with bullet points
   * @param {string} header - The header text
   * @param {Object|Array} items - Items to list
   */
  list(header, items) {
    console.log(`${this.prefixes.info} ${header}:`);
    
    if (Array.isArray(items)) {
      items.forEach(item => {
        console.log(`• ${item}`);
      });
    } else if (typeof items === 'object') {
      Object.entries(items).forEach(([key, value]) => {
        console.log(`• ${key}: ${value}`);
      });
    }
  }
}

// Export singleton
module.exports = new ConsoleLogger();