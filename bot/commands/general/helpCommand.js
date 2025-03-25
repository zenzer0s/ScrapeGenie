const stepLogger = require('../../utils/stepLogger');
const { getUserSettings, updateUserSettings } = require('../../utils/settingsManager');
const { 
    googleConnectCommand, 
    googleStatusCommand 
} = require('../google');

async function helpCommand(bot, msg) {
  const chatId = msg.chat.id;
  
  stepLogger.info('CMD_HELP', { chatId });
  
  const sentMessage = await bot.sendMessage(chatId,
    `📖 *ScrapeGenie Help Guide*\n\n` +
    `🔹 Send a URL to extract its details.\n\n` +
    `💡 *Supported Platforms:*\n` +
    `   • YouTube - Gets title, thumbnail, and video link.\n` +
    `   • Instagram - Extracts posts and reels with captions.\n` +
    `   • Pinterest - Downloads pins and videos (login may be required).\n` +
    `   • Websites - Fetches title, description & preview.\n` +
    `   • Google Sheets - Stores website data automatically.\n\n` +
    `Select an option below:`,
    { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          // Row 1: Home + Status 
          [
            { text: '🏠 Home', callback_data: 'start' },
            { text: '🔄 Status', callback_data: 'status' }
          ],
          // Row 2: Usage + Pinterest Status
          [
            { text: '📊 Usage', callback_data: 'usage' },
            { text: '🔍 Pinterest Status', callback_data: 'pinterest_status' }
          ],
          // Row 3: Pinterest Login/Logout
          [
            { text: '🔐 Pinterest Login', callback_data: 'pinterest_login' },
            { text: '🔓 Pinterest Logout', callback_data: 'pinterest_logout' }
          ],
          // Row 4: Google Sheets Controls
          [
            { text: '📊 Connect Sheets', callback_data: 'google_connect' },
            { text: '🔍 Sheets Status', callback_data: 'google_status' }
          ],
          // Row 5: Settings
          [
            { text: '⚙️ Customize Settings', callback_data: 'toggle_settings' }
          ]
        ]
      }
    }
  );
  return { sentMessage, userMessageId: msg.message_id };
}

/**
 * Handle settings directly in the help menu
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {object} query - Callback query
 */
async function handleHelpSettings(bot, query) {
  const chatId = query.message.chat.id;
  const userId = query.from.id.toString();
  const messageId = query.message.message_id;
  
  // Get current settings
  const userSettings = getUserSettings(userId);
  const displayMode = userSettings.instagram.sendCaption ? 'Media + Caption' : 'Only Media';
  
  // Create basic help message
  const helpMessage = 
    `📖 *ScrapeGenie Help Guide*\n\n` +
    `🔹 Send a URL to extract its details.\n\n` +
    `💡 *Supported Platforms:*\n` +
    `   • YouTube - Gets title, thumbnail, and video link.\n` +
    `   • Instagram - Extracts posts and reels with captions.\n` +
    `   • Pinterest - Downloads pins and videos (login may be required).\n` +
    `   • Websites - Fetches title, description & preview.`;
  
  // For settings view
  if (query.data === 'toggle_settings') {
    const settingsMessage = `${helpMessage}\n\n` +
      `⚙️ *Instagram Settings:*\n` +
      `Choose how media is delivered:`;
    
    const keyboard = {
      inline_keyboard: [
        // Settings row
        [
          { text: `Mode: ${displayMode}`, callback_data: 'toggle_media' }
        ],
        // Back to main help
        [
          { text: '⬅️ Back to Help', callback_data: 'back_to_help' }
        ]
      ]
    };
    
    await bot.editMessageText(settingsMessage, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
    await bot.answerCallbackQuery(query.id);
    return true;
  }
  // For toggling media setting
  else if (query.data === 'toggle_media') {
    // Toggle caption setting
    const newCaptionSetting = !userSettings.instagram.sendCaption;
    
    // Update settings
    updateUserSettings(userId, { 
      instagram: { 
        sendMedia: true,  // Always send media
        sendCaption: newCaptionSetting
      } 
    });
    
    // Log the change
    stepLogger.success('SETTINGS_MODE_TOGGLED', { 
      chatId, 
      userId, 
      sendMedia: true,
      sendCaption: newCaptionSetting,
      mode: newCaptionSetting ? 'Media + Caption' : 'Only Media'
    });
    
    // Update the settings view
    const updatedDisplayMode = newCaptionSetting ? 'Media + Caption' : 'Only Media';
    const settingsMessage = `${helpMessage}\n\n` +
      `⚙️ *Instagram Settings:*\n` +
      `Choose how media is delivered:`;
    
    const keyboard = {
      inline_keyboard: [
        // Settings row
        [
          { text: `Mode: ${updatedDisplayMode}`, callback_data: 'toggle_media' }
        ],
        // Back to main help
        [
          { text: '⬅️ Back to Help', callback_data: 'back_to_help' }
        ]
      ]
    };
    
    await bot.editMessageText(settingsMessage, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
    await bot.answerCallbackQuery(query.id, { 
      text: `Setting updated: ${updatedDisplayMode}`
    });
    return true;
  }
  // For going back to main help menu
  else if (query.data === 'back_to_help') {
    const keyboard = {
      inline_keyboard: [
        // Row 1: Home + Status 
        [
          { text: '🏠 Home', callback_data: 'start' },
          { text: '🔄 Status', callback_data: 'status' }
        ],
        // Row 2: Usage + Pinterest Login
        [
          { text: '📊 Usage', callback_data: 'usage' },
          { text: '🔍 Pinterest Status', callback_data: 'pinterest_status' }
        ],
        // Row 3: Pinterest Logout + Pinterest Status
        [
          { text: '🔐 Pinterest Login', callback_data: 'pinterest_login' },
          { text: '🔓 Pinterest Logout', callback_data: 'pinterest_logout' }
        ],
        // Row 4: Google Sheets Controls
        [
          { text: '📊 Connect Sheets', callback_data: 'google_connect' },
          { text: '🔍 Sheets Status', callback_data: 'google_status' }
        ],
        // Row 5: Customize Settings
        [
          { text: '⚙️ Customize Settings', callback_data: 'toggle_settings' }
        ]
      ]
    };
    
    await bot.editMessageText(helpMessage + '\n\nSelect an option below:', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
    await bot.answerCallbackQuery(query.id);
    return true;
  }
  
  return false; // Not a settings-related action
}

module.exports = helpCommand;
module.exports.handleHelpSettings = handleHelpSettings;