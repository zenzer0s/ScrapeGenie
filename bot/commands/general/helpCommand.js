const stepLogger = require('../../utils/stepLogger');

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
    `   • Websites - Fetches title, description & preview.\n\n` +
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
          // Row 4: Customize Settings
          [
            { text: '⚙️ Customize Settings', callback_data: 'open_settings' }
          ]
        ]
      }
    }
  );
  return { sentMessage, userMessageId: msg.message_id };
}

module.exports = helpCommand;