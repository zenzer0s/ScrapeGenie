const { getUserSettings, updateUserSettings } = require('../utils/settingsManager');
const stepLogger = require('../utils/stepLogger');

/**
 * Display the settings menu
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {string} userId - User ID
 * @param {object} userSettings - User-specific settings
 */
async function handleSettings(bot, chatId, userId, userSettings = null) {
  // Retrieve settings if not provided
  if (!userSettings) {
    userSettings = getUserSettings(userId);
  }

  const keyboard = {
    inline_keyboard: [
      [
        { text: `Media: ${userSettings.instagram.sendMedia ? 'Only Media' : 'Media + Caption'}`, callback_data: 'toggle_media' },
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

  // Debugging logs to trace the query object
  stepLogger.debug('CALLBACK_QUERY_OBJECT', { query });

  // Validate chatId and userId
  if (!chatId || !userId) {
    stepLogger.error('SETTINGS_CALLBACK_ERROR', {
      chatId,
      userId,
      error: 'Invalid callback query object: chatId or userId is undefined',
    });
    await bot.answerCallbackQuery(query.id, { text: 'An error occurred. Please try again.' });
    return;
  }

  stepLogger.info('SETTINGS_CALLBACK_RECEIVED', { chatId, userId, action: query.data });

  try {
    if (query.data === 'toggle_media') {
      const userSettings = getUserSettings(userId);
      const newMediaSetting = !userSettings.instagram.sendMedia;
      
      // When toggling media, also update caption setting to be the opposite
      // When sendMedia is true → only media (no caption)
      // When sendMedia is false → media + caption
      updateUserSettings(userId, { 
        instagram: { 
          sendMedia: newMediaSetting,
          sendCaption: !newMediaSetting  // opposite of sendMedia
        } 
      });

      stepLogger.success('SETTINGS_MEDIA_TOGGLED', { 
        chatId, 
        userId, 
        sendMedia: newMediaSetting,
        sendCaption: !newMediaSetting
      });
      
      await bot.answerCallbackQuery(query.id, { 
        text: `Setting updated: ${newMediaSetting ? 'Only Media' : 'Media + Caption'}`
      });
    }

    // Retrieve updated settings and refresh the menu
    const updatedSettings = getUserSettings(userId);
    await handleSettings(bot, chatId, userId, updatedSettings);
  } catch (error) {
    stepLogger.error('SETTINGS_CALLBACK_ERROR', { chatId, userId, error: error.message });
    await bot.answerCallbackQuery(query.id, { text: 'An error occurred. Please try again.' });
  }
}

module.exports = { handleSettings, handleSettingsCallback };