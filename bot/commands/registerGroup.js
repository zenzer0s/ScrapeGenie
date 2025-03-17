const fs = require('fs');
const path = require('path');
const stepLogger = require('../utils/stepLogger');

// File to store group information
const GROUP_CONFIG_FILE = path.join(__dirname, '../../data/groupConfig.json');

module.exports = async (bot, msg) => {
  const chatId = msg.chat.id;
  const chatType = msg.chat.type;
  
  // Check if this is a group or supergroup
  if (chatType !== 'group' && chatType !== 'supergroup') {
    await bot.sendMessage(
      chatId,
      "⚠️ This command must be run from within the group you want to register."
    );
    return;
  }
  
  stepLogger.info('GROUP_REGISTER_ATTEMPT', { 
    chatId, 
    chatType,
    title: msg.chat.title
  });
  
  try {
    // Create the data directory if it doesn't exist
    const dataDir = path.dirname(GROUP_CONFIG_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Store group information
    const groupInfo = {
      id: chatId,
      title: msg.chat.title,
      type: chatType,
      registeredAt: new Date().toISOString()
    };
    
    fs.writeFileSync(GROUP_CONFIG_FILE, JSON.stringify(groupInfo, null, 2));
    
    stepLogger.success('GROUP_REGISTERED', { 
      groupId: chatId,
      title: msg.chat.title 
    });
    
    await bot.sendMessage(
      chatId,
      `✅ This group "${msg.chat.title}" has been successfully registered as your link collection group!\n\nYou can now:
      
1️⃣ Add this bot to this group
2️⃣ Post links to this group anytime (even when bot is offline)
3️⃣ When the bot is online, it will process all unprocessed links

The bot will now check for unprocessed links in this group.`
    );
    
    // Try to trigger group processing
    if (global.groupProcessor) {
      // Force reload of group info
      await global.groupProcessor.loadGroupInfo();
      
      // Process unprocessed messages
      const count = await global.groupProcessor.processUnprocessedMessages();
      
      if (count > 0) {
        await bot.sendMessage(
          chatId,
          `🔍 Found ${count} unprocessed links in this group. Starting batch processing...`
        );
      }
    }
    
  } catch (error) {
    stepLogger.error('GROUP_REGISTER_FAILED', { 
      error: error.message 
    });
    
    await bot.sendMessage(
      chatId,
      `❌ Error registering group: ${error.message}`
    );
  }
};