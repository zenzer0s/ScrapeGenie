const stepLogger = require('../../utils/stepLogger');
const apiService = require('../../services/apiService');

async function pinterestLoginCommand(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id?.toString() || chatId.toString();

  stepLogger.info('CMD_PINTEREST_LOGIN', { chatId });

  try {
    // First, check if already logged in
    const statusData = await apiService.getPinterestStatus(userId);

    // If already logged in, send a different message
    if (statusData.isLoggedIn) {
      const sentMessage = await bot.sendMessage(chatId, 
        "✅ *You're already logged in to Pinterest!*\n\nYou can use Pinterest scraping features right away.", 
        { parse_mode: 'Markdown' }
      );
      
      return { sentMessage, userMessageId: msg.message_id };
    }

    // If not logged in, continue with token generation
    const tokenData = await apiService.generatePinterestToken(userId);

    // Create login URL message with proper escaping for Markdown
    const loginUrl = tokenData.loginUrl;
    
    const message = 
      `🔐 *Pinterest Login*\n\n` +
      `Click the button below to log in to your Pinterest account.\n\n` +
      `This login is required for Pinterest scraping.\n`;

    // Send message with inline button instead of markdown link
    const sentMessage = await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔑 Login to Pinterest', url: loginUrl }]
        ]
      }
    });

    return { sentMessage, userMessageId: msg.message_id };

  } catch (error) {
    stepLogger.error('PINTEREST_LOGIN_ERROR', { 
      chatId, 
      error: error.message 
    });
    
    const errorMessage = 
      `❌ *Pinterest Login Error*\n\n` + 
      `Sorry, we encountered a problem. Please try again later.`;
    
    const sentMessage = await bot.sendMessage(chatId, errorMessage, { 
      parse_mode: 'Markdown' 
    });
    
    return { sentMessage, userMessageId: msg.message_id };
  }
}

module.exports = pinterestLoginCommand;