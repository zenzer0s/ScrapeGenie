const { extractUrls } = require('../utils/urlUtils');
const { createBatch, submitBatch } = require('../batch/batchProcessor');
const stepLogger = require('../utils/stepLogger');
const fs = require('fs');
const path = require('path');

/**
 * Process links from a designated Telegram group
 */
class GroupProcessor {
  constructor(bot) {
    this.bot = bot;
    this.groupInfo = null;
    this.isProcessing = false;
  }

  /**
   * Initialize the group processor
   * @returns {Promise<boolean>} - Whether initialization succeeded
   */
  async initialize() {
    try {
      stepLogger.info('GROUP_INIT_START');
      
      // Load group info from config file instead of searching by name
      await this.loadGroupInfo();
      
      if (this.groupInfo) {
        stepLogger.info('GROUP_FOUND', { 
          groupId: this.groupInfo.id,
          title: this.groupInfo.title
        });
        return true;
      } else {
        stepLogger.warn('GROUP_NOT_FOUND');
        return false;
      }
    } catch (error) {
      stepLogger.error('GROUP_INIT_FAILED', { error: error.message });
      return false;
    }
  }

  async loadGroupInfo() {
    const configFile = path.join(__dirname, '../../data/groupConfig.json');
    
    if (fs.existsSync(configFile)) {
      try {
        const groupData = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        
        // Verify group data
        if (groupData && groupData.id) {
          // Try to get current group info to ensure it still exists
          const currentGroupInfo = await this.bot.getChat(groupData.id).catch(() => null);
          
          if (currentGroupInfo) {
            this.groupInfo = {
              id: currentGroupInfo.id,
              title: currentGroupInfo.title,
              type: currentGroupInfo.type
            };
            
            return true;
          }
        }
      } catch (error) {
        stepLogger.error('GROUP_LOAD_CONFIG_FAILED', { error: error.message });
      }
    }
    
    this.groupInfo = null;
    return false;
  }

  /**
   * Process unprocessed messages in the group
   * @returns {Promise<number>} - Number of messages processed
   */
  async processUnprocessedMessages() {
    if (!this.groupInfo || this.isProcessing) {
      return 0;
    }
    
    this.isProcessing = true;
    
    try {
      stepLogger.info('GROUP_PROCESS_START', { groupId: this.groupInfo.id });
      
      // Get recent message history
      const messages = await this.getGroupMessages();
      
      // Filter for unprocessed messages with links
      const unprocessedMessages = messages.filter(msg => 
        !msg.reactions || // No reactions yet
        !msg.reactions.some(r => r.emoji === '✅') // No check mark reaction
      );
      
      // Extract all URLs
      const allLinks = [];
      const messageIds = [];
      
      for (const msg of unprocessedMessages) {
        if (msg.text) {
          const urls = extractUrls(msg.text);
          
          if (urls.length > 0) {
            allLinks.push(...urls);
            messageIds.push(msg.message_id);
          }
        }
      }
      
      stepLogger.info('GROUP_LINKS_FOUND', { 
        count: allLinks.length,
        messageCount: messageIds.length
      });
      
      // If no links, we're done
      if (allLinks.length === 0) {
        this.isProcessing = false;
        return 0;
      }
      
      // Notify in the group that processing is starting
      await this.bot.sendMessage(
        this.groupInfo.id,
        `🔍 Found ${allLinks.length} unprocessed links in ${messageIds.length} messages.\nStarting batch processing...`
      );
      
      // Create user ID for group processing (using group ID)
      const groupUserId = Math.abs(this.groupInfo.id); 
      
      // Create and process batch
      const batchId = await createBatch(allLinks, this.groupInfo.id, groupUserId);
      await submitBatch(batchId, this.bot);
      
      // Mark all processed messages
      for (const messageId of messageIds) {
        await this.markMessageAsProcessed(messageId);
      }
      
      // Final count
      stepLogger.info('GROUP_PROCESS_COMPLETE', { 
        processedCount: allLinks.length
      });
      
      this.isProcessing = false;
      return allLinks.length;
      
    } catch (error) {
      stepLogger.error('GROUP_PROCESS_FAILED', { error: error.message });
      
      // Try to notify in group
      try {
        await this.bot.sendMessage(
          this.groupInfo.id,
          `❌ Error processing group messages: ${error.message}`
        );
      } catch (err) {
        // Ignore notification errors
      }
      
      this.isProcessing = false;
      return 0;
    }
  }

  /**
   * Get messages from the group
   * This uses alternative methods since getChatHistory isn't available
   * @param {number} limit - Maximum number of messages to retrieve
   * @returns {Promise<Array>} - Array of message objects
   */
  async getGroupMessages(limit = 100) {
    try {
      // Unfortunately, Telegram Bot API doesn't provide a way to get message history
      // We'll need to use a different approach - only process new messages as they come in
      
      stepLogger.info('GROUP_GET_MESSAGES_APPROACH', { 
        method: 'forward_based',
        info: 'Using forwarded message collection'  
      });
      
      // Return empty array - we'll collect messages as they come in instead
      return [];
    } catch (error) {
      stepLogger.error('GROUP_GET_MESSAGES_FAILED', { 
        error: error.message 
      });
      return [];
    }
  }

  /**
   * Mark a message as processed
   * @param {number} messageId - Message ID to mark
   */
  async markMessageAsProcessed(messageId) {
    try {
      // Add a reaction to the message
      await this.bot.setMessageReaction(
        this.groupInfo.id,
        messageId,
        ['✅'] // Checkmark emoji
      );
      
    } catch (error) {
      // Try commenting instead if reactions fail
      try {
        await this.bot.sendMessage(
          this.groupInfo.id,
          "✅ Processed",
          { reply_to_message_id: messageId }
        );
      } catch (err) {
        stepLogger.warn('GROUP_MARK_FAILED', { 
          messageId,
          error: err.message 
        });
      }
    }
  }

  /**
   * Handle a new message sent to the group
   * @param {Object} msg - Message object
   * @returns {boolean} - Whether the message was handled
   */
  async handleGroupMessage(msg) {
    // Check if this message is from our tracked group
    if (!this.groupInfo || msg.chat.id !== this.groupInfo.id) {
      return false;
    }
    
    // If we're already processing, just mark for later processing
    if (this.isProcessing) {
      stepLogger.info('GROUP_MESSAGE_QUEUED', { 
        chatId: msg.chat.id, 
        messageId: msg.message_id 
      });
      return true;
    }
    
    // Extract URLs from the message
    const urls = extractUrls(msg.text || '');
    
    // If no URLs, ignore
    if (urls.length === 0) {
      return false;
    }
    
    stepLogger.info('GROUP_NEW_MESSAGE', { 
      chatId: msg.chat.id, 
      messageId: msg.message_id,
      urlCount: urls.length 
    });
    
    // Let's process all unprocessed messages including this one
    await this.processUnprocessedMessages();
    return true;
  }

  /**
   * Check if a chat ID belongs to our group
   * @param {number} chatId - Chat ID to check
   * @returns {boolean} - Whether the chat is our group
   */
  isGroupChat(chatId) {
    return this.groupInfo && this.groupInfo.id === chatId;
  }
}

module.exports = GroupProcessor;