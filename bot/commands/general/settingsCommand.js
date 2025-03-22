const { getUserSettings, updateUserSettings, resetUserSettings } = require('../../utils/settingsManager');
const stepLogger = require('../../utils/stepLogger');
const { handleCommandError } = require('../utils/errorHandlers');

async function settingsCommand(bot, msg) {
  const chatId = msg.chat?.id;
  const userId = msg.from?.id?.toString();

  if (!chatId || !userId) {
    stepLogger.error('SETTINGS_COMMAND_ERROR', { chatId, userId, error: 'Invalid message object' });
    throw new Error('Invalid message object: chatId or userId is undefined');
  }

  stepLogger.info('CMD_SETTINGS', { chatId, userId });

  try {
    // Fetch user-specific settings
    const userSettings = getUserSettings(userId);

    const keyboard = {
      inline_keyboard: [
        [
          { text: `Media: ${userSettings.instagram.sendMedia ? 'Enabled' : 'Disabled'}`, callback_data: 'toggle_media' },
          { text: `Caption: ${userSettings.instagram.sendCaption ? 'Enabled' : 'Disabled'}`, callback_data: 'toggle_caption' },
        ],
        [
          { text: 'Reset to Default', callback_data: 'reset_settings' },
        ],
      ],
    };

    // Send the settings menu
    const sentMessage = await bot.sendMessage(chatId, 'Customize your Instagram settings:', {
      reply_markup: keyboard,
    });

    stepLogger.success('SETTINGS_MENU_SENT', { chatId, userId });
    return { sentMessage, userMessageId: msg.message_id };
  } catch (error) {
    return handleCommandError(bot, chatId, error, 'settings', msg.message_id);
  }
}

async function handleSettingsCallback(bot, query) {
  const chatId = query.message?.chat?.id;
  const userId = query.from?.id?.toString();

  if (!chatId || !userId) {
    stepLogger.error('SETTINGS_CALLBACK_ERROR', { chatId, userId, error: 'Invalid callback query object' });
    await bot.answerCallbackQuery(query.id, { text: 'An error occurred. Please try again.' });
    return;
  }

  stepLogger.info('SETTINGS_CALLBACK_RECEIVED', { chatId, userId, action: query.data });

  try {
    if (query.data === 'toggle_media') {
      const userSettings = getUserSettings(userId);
      const newSetting = !userSettings.instagram.sendMedia;
      updateUserSettings(userId, { instagram: { sendMedia: newSetting } });

      await bot.answerCallbackQuery(query.id, { text: `Media setting updated: ${newSetting ? 'Enabled' : 'Disabled'}` });
      stepLogger.success('SETTINGS_MEDIA_TOGGLED', { chatId, userId, newSetting });
      await settingsCommand(bot, query.message); // Refresh settings menu
    } else if (query.data === 'toggle_caption') {
      const userSettings = getUserSettings(userId);
      const newSetting = !userSettings.instagram.sendCaption;
      updateUserSettings(userId, { instagram: { sendCaption: newSetting } });

      await bot.answerCallbackQuery(query.id, { text: `Caption setting updated: ${newSetting ? 'Enabled' : 'Disabled'}` });
      stepLogger.success('SETTINGS_CAPTION_TOGGLED', { chatId, userId, newSetting });
      await settingsCommand(bot, query.message); // Refresh settings menu
    } else if (query.data === 'reset_settings') {
      resetUserSettings(userId);

      await bot.answerCallbackQuery(query.id, { text: 'Settings reset to default.' });
      stepLogger.success('SETTINGS_RESET', { chatId, userId });
      await settingsCommand(bot, query.message); // Refresh settings menu
    }
  } catch (error) {
    stepLogger.error('SETTINGS_CALLBACK_ERROR', { chatId, userId, error: error.message });
    await bot.answerCallbackQuery(query.id, { text: 'An error occurred. Please try again.' });
  }
}

module.exports = { settingsCommand, handleSettingsCallback };