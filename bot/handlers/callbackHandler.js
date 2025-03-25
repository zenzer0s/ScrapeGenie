const startCommand = require('../commands/general/startCommand');
const helpCommand = require('../commands/general/helpCommand');
const { handleHelpSettings } = require('../commands/general/helpCommand');
const statusCommand = require('../commands/general/statusCommand');
const usageCommand = require('../commands/general/usageCommand');
const pinterestLoginCommand = require('../commands/pinterest/pinterestLoginCommand');
const pinterestLogoutCommand = require('../commands/pinterest/pinterestLogoutCommand');
const pinterestStatusCommand = require('../commands/pinterest/pinterestStatusCommand');
const { handleYoutubeCallback } = require('./youtubeHandler');
const googleConnectCommand = require('../commands/google/googleConnectCommand');
const googleStatusCommand = require('../commands/google/googleStatusCommand');
const googleDisconnectCommand = require('../commands/google/googleDisconnectCommand');
const { handleGoogleCallback } = require('./googleHandler');

const { handleSettingsCallback } = require('./settingsHandler');
const { getUserSettings } = require('../utils/settingsManager');
const stepLogger = require('../utils/stepLogger');

/**
 * Function to delete messages after a delay
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {number} messageId - Message ID to delete
 * @param {number} delay - Delay in milliseconds
 */
async function deleteMessageAfterDelay(bot, chatId, messageId, delay) {
  setTimeout(async () => {
    try {
      await bot.deleteMessage(chatId, messageId);
      stepLogger.debug('MESSAGE_DELETED', { chatId, messageId });
    } catch (error) {
      // Message may have already been deleted or too old
      stepLogger.warn('MESSAGE_DELETE_FAILED', { 
        chatId, 
        messageId, 
        error: error.message 
      });
    }
  }, delay);
}

/**
 * Handle callback queries
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {object} callbackQuery - Callback query object
 * @param {function} checkBackendStatus - Function to check backend status
 */
async function handleCallbackQuery(bot, callbackQuery, checkBackendStatus) {
  const startTime = Date.now(); // Initialize startTime to measure elapsed time
  const action = callbackQuery.data;
  const msg = callbackQuery.message;
  const chatId = msg?.chat?.id;
  const userId = callbackQuery.from?.id?.toString();

  // Debugging logs
  stepLogger.info('CALLBACK_RECEIVED', { action, chatId, userId });

  // Validate chatId and userId
  if (!chatId || !userId) {
    stepLogger.error('CALLBACK_ERROR', {
      action,
      chatId,
      userId,
      error: 'Invalid callback query object: chatId or userId is undefined',
    });
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'An error occurred. Please try again.' });
    return;
  }

  try {
    // First, check if it's a help-settings related action
    if (action === 'toggle_settings' || action === 'toggle_media' || action === 'back_to_help') {
      const handled = await handleHelpSettings(bot, callbackQuery);
      if (handled) {
        stepLogger.info('CALLBACK_HANDLED', {
          action,
          chatId,
          elapsed: Date.now() - startTime,
        });
        return;
      }
    }
    
    // If not handled by help settings, use the existing command map
    const commandMap = {
      'start': () => startCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
      'help': () => helpCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
      'status': () => statusCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }, checkBackendStatus),
      'usage': () => usageCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
      'pinterest_login': () => pinterestLoginCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
      'pinterest_logout': () => pinterestLogoutCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
      'pinterest_status': () => pinterestStatusCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
      'open_settings': async () => {
        try {
          const userId = callbackQuery.from.id.toString();
          const userSettings = getUserSettings(userId);
          
          // Call the handleSettings function directly with the userId
          await handleSettings(bot, chatId, userId, userSettings);
          return {}; // No message to delete
        } catch (error) {
          stepLogger.error('SETTINGS_COMMAND_ERROR', { chatId, error: error.message });
          throw error;
        }
      },
      'toggle_media': async () => {
        try {
          await handleSettingsCallback(bot, callbackQuery); // Properly handle toggle_media
        } catch (error) {
          stepLogger.error('TOGGLE_MEDIA_ERROR', { chatId, error: error.message });
          throw error; // Re-throw the error to be handled in the main try-catch
        }
      },
      'toggle_caption': async () => {
        try {
          await handleSettingsCallback(bot, callbackQuery); // Properly handle toggle_caption
        } catch (error) {
          stepLogger.error('TOGGLE_CAPTION_ERROR', { chatId, error: error.message });
          throw error; // Re-throw the error to be handled in the main try-catch
        }
      },
      'reset_settings': async () => {
        try {
          await handleSettingsCallback(bot, callbackQuery); // Properly handle reset_settings
        } catch (error) {
          stepLogger.error('RESET_SETTINGS_ERROR', { chatId, error: error.message });
          throw error; // Re-throw the error to be handled in the main try-catch
        }
      },
      'google_connect': () => googleConnectCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
      'google_status': () => googleStatusCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
      'google_disconnect': () => googleDisconnectCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
      'google_disconnect_confirm': async () => {
        try {
          await handleGoogleCallback(bot, callbackQuery);
          return {};
        } catch (error) {
          stepLogger.error('GOOGLE_DISCONNECT_ERROR', { chatId, error: error.message });
          throw error;
        }
      },
    };

    // Process the action
    if (commandMap[action]) {
      // Call the appropriate command
      const result = await commandMap[action]();

      // Handle different result formats
      if (result && result.sentMessage) {
        deleteMessageAfterDelay(bot, chatId, result.sentMessage.message_id, 15000);
      } else if (result && result.sentMessages) {
        result.sentMessages.forEach(sentMessage => {
          deleteMessageAfterDelay(bot, chatId, sentMessage.message_id, 15000);
        });
      }

      // Delete the original message
      deleteMessageAfterDelay(bot, chatId, msg.message_id, 15000);

      stepLogger.info('CALLBACK_HANDLED', {
        action,
        chatId,
        elapsed: Date.now() - startTime, // Use startTime to calculate elapsed time
      });
    } else if (action === 'audio_info') {
      await handleYoutubeCallback(bot, callbackQuery);
      // No need to delete message or do other handling for this callback
      return;
    } else {
      // Handle unknown command
      const unknownCommandMessage = await bot.sendMessage(chatId, "Unknown command");
      deleteMessageAfterDelay(bot, chatId, unknownCommandMessage.message_id, 15000);
      deleteMessageAfterDelay(bot, chatId, msg.message_id, 15000);

      stepLogger.warn('CALLBACK_UNKNOWN', { action, chatId });
    }
  } catch (error) {
    stepLogger.error('CALLBACK_ERROR', {
      action,
      chatId,
      error: error.message,
    });

    // Notify user of error
    const errorMessage = await bot.sendMessage(
      chatId,
      `Error processing your request: ${error.message}`
    );

    deleteMessageAfterDelay(bot, chatId, errorMessage.message_id, 15000);
  }
}

module.exports = {
  handleCallbackQuery,
  deleteMessageAfterDelay,
};