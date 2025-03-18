const stepLogger = require('../utils/stepLogger');

/**
 * GroupProcessor handles bot functionality in group chats
 */
class GroupProcessor {
  /**
   * Create a new GroupProcessor
   * @param {object} bot - Telegram bot instance
   * @param {object} config - Configuration object
   */
  constructor(bot, config) {
    this.bot = bot;
    this.config = config || {};
    this.allowedGroups = this.config.allowedGroups || [];
    
    stepLogger.info('GROUP_PROCESSOR_INIT', { 
      groupsEnabled: this.allowedGroups.length > 0 
    });
  }

  /**
   * Initialize the group processor
   * @returns {Promise<void>}
   */
  async initialize() {
    stepLogger.info('GROUP_PROCESSOR_INITIALIZE_START', {
      groupCount: this.allowedGroups.length
    });
    
    // If there are allowed groups, we could set up listeners or load data here
    if (this.allowedGroups.length > 0) {
      // For each group, we might want to load previous state, update group info, etc.
      for (const groupId of this.allowedGroups) {
        try {
          // Just log for now - could do more initialization per group
          stepLogger.debug('GROUP_INITIALIZE', { groupId });
        } catch (error) {
          stepLogger.warn('GROUP_INITIALIZE_ERROR', { 
            groupId, 
            error: error.message 
          });
        }
      }
    }
    
    stepLogger.success('GROUP_PROCESSOR_INITIALIZE_COMPLETE', {
      groupCount: this.allowedGroups.length
    });
    
    return true;
  }

  /**
   * Check if the chat is a monitored group chat
   * @param {number|string} chatId - Chat ID to check
   * @returns {boolean} True if this is a group we're monitoring
   */
  isGroupChat(chatId) {
    return this.allowedGroups.includes(chatId.toString());
  }

  /**
   * Handle a message in a group chat
   * @param {object} msg - Telegram message
   * @returns {Promise<void>}
   */
  async handleGroupMessage(msg) {
    const chatId = msg.chat.id;
    
    stepLogger.info('GROUP_MESSAGE_RECEIVED', { 
      chatId,
      userId: msg.from.id,
      username: msg.from.username || 'unknown'
    });
    
    // For now, we just log the message
    // Group features can be implemented later
  }
}

// Export the class directly
module.exports = GroupProcessor;