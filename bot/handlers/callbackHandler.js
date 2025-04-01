const startCommand = require('../commands/general/startCommand');
const helpCommand = require('../commands/general/helpCommand');
const { handleHelpSettings } = require('../commands/general/helpCommand');
const statusCommand = require('../commands/general/statusCommand');
const usageCommand = require('../commands/general/usageCommand');
const pinterestLoginCommand = require('../commands/pinterest/pinterestLoginCommand');
const pinterestLogoutCommand = require('../commands/pinterest/pinterestLogoutCommand');
const pinterestStatusCommand = require('../commands/pinterest/pinterestStatusCommand');
const { handleYoutubeCallback } = require('./youtubeHandler');

// Add this import
const { handleSheetCallback } = require('./googleSheetHandler');

// Add these imports for Google commands
const googleConnectCommand = require('../commands/google/googleConnectCommand');
const googleStatusCommand = require('../commands/google/googleStatusCommand');
const googleSheetCommand = require('../commands/google/googleSheetCommand');

// Import the handlers
const { handleCreateSheetCallback, handleDisconnectCallback, handleRecreateSheetCallback } = require('../commands/google/index');

const { handleSettingsCallback } = require('./settingsHandler');
const { getUserSettings } = require('../utils/settingsManager');
const stepLogger = require('../utils/stepLogger');

// Add this import near the top
const { deleteMessageAfterDelay } = require('../utils/messageUtils');

// Add this import at the top with other imports
const { checkBackendStatus } = require('../utils/statusUtils');

/**
 * Handle callback queries
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {object} callbackQuery - Callback query object
 * @param {function} checkBackendStatus - Function to check backend status
 */
async function handleCallback(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const action = callbackQuery.data;
  const userId = callbackQuery.from.id.toString();
  
  stepLogger.info('CALLBACK_RECEIVED', { action, chatId, userId });
  
  try {
    // Early handler for Google-specific callbacks
    if (action === 'google_create_sheet') {
      try {
        stepLogger.info('GOOGLE_CREATE_SHEET_START', { chatId });
        await handleCreateSheetCallback(bot, callbackQuery);
        stepLogger.info('GOOGLE_CREATE_SHEET_SUCCESS', { chatId });
        return;
      } catch (error) {
        stepLogger.error('GOOGLE_CREATE_SHEET_ERROR', { chatId, error: error.message });
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: 'Failed to create spreadsheet. Please try again.',
          show_alert: true
        });
        return;
      }
    }
    
    // Add handler for recreate sheet callback
    if (action === 'google_recreate_sheet') {
      try {
        stepLogger.info('GOOGLE_RECREATE_SHEET_START', { chatId });
        await handleRecreateSheetCallback(bot, callbackQuery);
        stepLogger.info('GOOGLE_RECREATE_SHEET_SUCCESS', { chatId });
        return;
      } catch (error) {
        stepLogger.error('GOOGLE_RECREATE_SHEET_ERROR', { chatId, error: error.message });
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: 'Failed to recreate spreadsheet. Please try again.',
          show_alert: true
        });
        return;
      }
    }
    
    // Handle Google disconnect flow
    if (action === 'google_disconnect') {
      try {
        // Show confirmation dialog
        const confirmKeyboard = {
          inline_keyboard: [
            [
              { text: '❌ Yes, disconnect', callback_data: 'google_disconnect_confirm' },
              { text: '↩️ Cancel', callback_data: 'google_disconnect_cancel' }
            ]
          ]
        };
        
        await bot.editMessageText(
          '⚠️ Are you sure you want to disconnect Google Sheets?\n\n' +
          'Your spreadsheet ID will be preserved in case you reconnect later.',
          {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id,
            reply_markup: confirmKeyboard
          }
        );
        
        await bot.answerCallbackQuery(callbackQuery.id);
        stepLogger.info('GOOGLE_DISCONNECT_CONFIRM_REQUESTED', { chatId });
        return;
      } catch (error) {
        stepLogger.error('GOOGLE_DISCONNECT_ERROR', { chatId, error: error.message });
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: 'Failed to show disconnect confirmation.',
          show_alert: true
        });
        return;
      }
    }
    
    // Handle disconnect confirmation or cancellation
    if (action === 'google_disconnect_confirm' || action === 'google_disconnect_cancel') {
      try {
        await handleDisconnectCallback(bot, callbackQuery);
        stepLogger.info('GOOGLE_DISCONNECT_HANDLED', { chatId, action });
        return;
      } catch (error) {
        stepLogger.error('GOOGLE_DISCONNECT_CALLBACK_ERROR', { chatId, error: error.message });
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: 'Failed to process disconnect request.',
          show_alert: true
        });
        return;
      }
    }

    // Add this to your handleCallback function
    if (action === 'google_connect') {
      try {
        const googleConnectCommand = require('../commands/google/googleConnectCommand');
        await googleConnectCommand(bot, { chat: { id: chatId } });
        await bot.answerCallbackQuery(callbackQuery.id);
        stepLogger.info('GOOGLE_CONNECT_CALLBACK_SUCCESS', { chatId });
        return;
      } catch (error) {
        stepLogger.error('GOOGLE_CONNECT_CALLBACK_ERROR', { chatId, error: error.message });
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: 'Failed to process connection request.',
          show_alert: true
        });
        return;
      }
    }

    // Continue with the rest of your callback handler...
    const startTime = Date.now(); // Initialize startTime to measure elapsed time

    // Handle sheet-related callbacks
    if (action.startsWith('sheet_')) {
      try {
        stepLogger.info('SHEET_CALLBACK_START', { action, chatId });
        const handled = await handleSheetCallback(bot, callbackQuery);
        if (handled) {
          stepLogger.info('CALLBACK_HANDLED', {
            action,
            chatId,
            elapsed: Date.now() - startTime,
          });
          return;
        } else {
          stepLogger.warn('SHEET_CALLBACK_UNHANDLED', { action, chatId });
        }
      } catch (error) {
        stepLogger.error(`SHEET_CALLBACK_ERROR: ${error.message}`, { 
          chatId, 
          action 
        });
        
        try {
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'An error occurred. Please try again.',
            show_alert: true
          });
        } catch (err) {
          // Ignore errors in answering callback queries
        }
        return;
      }
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
        'status': async () => {
          // Make sure statusCommand is a function before calling it
          if (typeof statusCommand === 'function') {
            return await statusCommand(bot, { 
              chat: { id: chatId }, 
              from: callbackQuery.from 
            });
          } else if (typeof statusCommand.default === 'function') {
            // If it's exported as default
            return await statusCommand.default(bot, { 
              chat: { id: chatId }, 
              from: callbackQuery.from 
            });
          } else {
            throw new Error('Status command not properly exported');
          }
        },
        'usage': () => usageCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
        'pinterest_login': () => pinterestLoginCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
        'pinterest_logout': () => pinterestLogoutCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
        'pinterest_status': () => pinterestStatusCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
        
        // Add these new Google-related handlers
        'google_connect': () => googleConnectCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
        'google_status': () => googleStatusCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
        'google_sheet': () => googleSheetCommand(bot, { chat: { id: chatId }, from: callbackQuery.from }),
        
        'google_disconnect_confirm': async () => {
          try {
            await handleDisconnectCallback(bot, callbackQuery);
            return {}; // No message to delete
          } catch (error) {
            stepLogger.error('GOOGLE_DISCONNECT_CONFIRM_ERROR', { chatId, error: error.message });
            throw error;
          }
        },
        
        'google_disconnect_cancel': async () => {
          try {
            await handleDisconnectCallback(bot, callbackQuery);
            return {}; // No message to delete
          } catch (error) {
            stepLogger.error('GOOGLE_DISCONNECT_CANCEL_ERROR', { chatId, error: error.message });
            throw error;
          }
        },
        
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
        deleteMessageAfterDelay(bot, chatId, callbackQuery.message.message_id, 15000);

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
        deleteMessageAfterDelay(bot, chatId, callbackQuery.message.message_id, 15000);

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

    // Add auto-delete for callback messages
    // Refresh the timer on interaction (extend by 15 more seconds)
    if (messageId) {
      deleteMessageAfterDelay(bot, chatId, messageId, 15000);
    }
  } catch (error) {
    stepLogger.error('CALLBACK_PROCESSING_ERROR', { chatId, action, error: error.message });
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'An error occurred. Please try again.',
      show_alert: true
    });
  }
}

module.exports = {
  handleCallback,
  handleCallbackQuery: handleCallback
};