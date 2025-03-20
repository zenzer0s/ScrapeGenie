const stepLogger = require('../../utils/stepLogger');
const { api } = require('../../services/apiService');
const { checkBackendAvailable, handleCommandError } = require('../utils/errorHandlers');

async function pinterestStatusCommand(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  stepLogger.info('CMD_PINTEREST_STATUS', { chatId });

  try {
    // First check if backend is available
    if (!await checkBackendAvailable(bot, chatId)) {
      return { userMessageId: msg.message_id };
    }

    // Check login status
    const response = await api.get(`/api/auth/status`, {
      params: { userId }
    });

    if (response.data.success) {
      if (response.data.isLoggedIn) {
        const sentMessage = await bot.sendMessage(chatId,
          "✅ *You are logged in to Pinterest*",
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🔓 Logout', callback_data: 'pinterest_logout' },
                  { text: '🏠 Home', callback_data: 'start' }
                ]
              ]
            }
          }
        );
        stepLogger.success('PINTEREST_STATUS_LOGGED_IN', { chatId });
        return { sentMessage, userMessageId: msg.message_id };
      } else {
        const sentMessage = await bot.sendMessage(chatId,
          "⚠️ *You are not logged in to Pinterest*",
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🔐 Login', callback_data: 'pinterest_login' },
                  { text: '🏠 Home', callback_data: 'start' }
                ]
              ]
            }
          }
        );
        stepLogger.info('PINTEREST_STATUS_NOT_LOGGED_IN', { chatId });
        return { sentMessage, userMessageId: msg.message_id };
      }
    } else {
      throw new Error(response.data.error || 'Failed to check login status');
    }
  } catch (error) {
    return handleCommandError(bot, chatId, error, 'pinterest_status', msg.message_id);
  }
}

module.exports = pinterestStatusCommand;