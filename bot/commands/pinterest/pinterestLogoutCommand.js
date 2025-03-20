const stepLogger = require('../../utils/stepLogger');
const { api } = require('../../services/apiService');
const { checkBackendAvailable, handleCommandError } = require('../utils/errorHandlers');

async function pinterestLogoutCommand(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  stepLogger.info('CMD_PINTEREST_LOGOUT', { chatId });

  try {
    // First check if backend is available
    if (!await checkBackendAvailable(bot, chatId)) {
      return { userMessageId: msg.message_id };
    }

    // Try to logout
    const response = await api.post(`/api/auth/logout`, {
      userId
    });

    if (response.data.success) {
      const sentMessage = await bot.sendMessage(chatId,
        "✅ You have been logged out of Pinterest.",
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔐 Login Again', callback_data: 'pinterest_login' },
                { text: '🏠 Home', callback_data: 'start' }
              ]
            ]
          }
        }
      );
      stepLogger.success('PINTEREST_LOGOUT_SUCCESS', { chatId });
      return { sentMessage, userMessageId: msg.message_id };
    } else {
      throw new Error(response.data.error || 'Failed to logout');
    }
  } catch (error) {
    return handleCommandError(bot, chatId, error, 'pinterest_logout', msg.message_id);
  }
}

module.exports = pinterestLogoutCommand;