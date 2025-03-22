const { getUserSettings, updateUserSettings } = require('../utils/settingsManager');
const stepLogger = require('../utils/stepLogger');

/**
 * Display the settings menu
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {string} userId - User ID
 */
async function handleSettings(bot, chatId, userId) {
  // Get current settings
  const userSettings = getUserSettings(userId);
  
  // Determine the display mode based on caption setting
  const captionEnabled = userSettings.instagram.sendCaption;
  const displayMode = captionEnabled ? 'Media + Caption' : 'Only Media';
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: `Mode: ${displayMode}`, callback_data: 'toggle_media' },
      ],
    ],
  };

  await bot.sendMessage(chatId, 'Customize your Instagram settings:', {
    reply_markup: keyboard,
  });
}

/**
 * Handle callback queries for settings
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {object} query - Callback query object
 */
async function handleSettingsCallback(bot, query) {
  const chatId = query.message?.chat?.id;
  const userId = query.from?.id?.toString();

  // Validate chatId and userId
  if (!chatId || !userId) {
    stepLogger.error('SETTINGS_CALLBACK_ERROR', { error: 'Invalid callback query object' });
    await bot.answerCallbackQuery(query.id, { text: 'An error occurred. Please try again.' });
    return;
  }

  stepLogger.info('SETTINGS_CALLBACK_RECEIVED', { chatId, userId, action: query.data });

  try {
    if (query.data === 'toggle_media') {
      const userSettings = getUserSettings(userId);
      
      // Toggle caption setting - media is always sent
      const newCaptionSetting = !userSettings.instagram.sendCaption;
      
      // Update settings - media is always true, caption toggles
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
      
      // Let user know
      const displayMode = newCaptionSetting ? 'Media + Caption' : 'Only Media';
      await bot.answerCallbackQuery(query.id, { 
        text: `Setting updated: ${displayMode}`
      });
      
      // Refresh the settings menu
      await handleSettings(bot, chatId, userId);
    }
  } catch (error) {
    stepLogger.error('SETTINGS_CALLBACK_ERROR', { chatId, userId, error: error.message });
    await bot.answerCallbackQuery(query.id, { text: 'An error occurred. Please try again.' });
  }
}

module.exports = { handleSettings, handleSettingsCallback };