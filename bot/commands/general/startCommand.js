const stepLogger = require('../../utils/stepLogger');

async function startCommand(bot, msg) {
  const chatId = msg.chat.id;
  
  stepLogger.info('CMD_START', { chatId });
  
  // Send welcome message
  const sentMessage = await bot.sendMessage(chatId, 
    `👋 *Welcome to ScrapeGenie!* 🧞‍♂️\n\n` +
    `I can extract information from:\n\n` +
    `🔹 *YouTube Videos* 📺\n` +
    `🔹 *Instagram Posts & Reels* 📸\n` +
    `🔹 *Pinterest Pins* 📌\n` +
    `🔹 *Websites* 🌍\n\n` +
    `📌 Just send me a URL and I'll do the magic!\n\n` +
    `Select an option below or just send me a link:`,
    { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📖 Help', callback_data: 'help' },
            { text: '🔄 Status', callback_data: 'status' }
          ],
          [
            { text: '🔐 Pinterest Login', callback_data: 'pinterest_login' },
            { text: '🔓 Pinterest Logout', callback_data: 'pinterest_logout' }
          ]
        ]
      }
    }
  );
  return { sentMessage, userMessageId: msg.message_id };
}

module.exports = startCommand;