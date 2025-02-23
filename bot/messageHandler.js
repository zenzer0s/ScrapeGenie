// bot/messageHandler.js
const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

async function handleUrlMessage(bot, msg) {
  if (msg.text && msg.text.startsWith('http')) {
    const chatId = msg.chat.id;
    const url = msg.text.trim();

    try {
      // Send an initial loading message and start a timer to update it every 10 seconds.
      const processingMsg = await bot.sendMessage(chatId, '⏳ _Fetching details..._', { parse_mode: 'Markdown' });
      let counter = 10;
      const timer = setInterval(async () => {
        try {
          await bot.editMessageText(`⏳ _Still working on it... (${counter}s)_`, {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            parse_mode: 'Markdown'
          });
          counter += 10;
        } catch (e) {
          // Ignore errors if the message is already deleted or edited.
        }
      }, 10000);

      // Make the scraping request
      const response = await axios.post(`${BACKEND_URL}/api/scrape`, { url });
      clearInterval(timer);
      await bot.deleteMessage(chatId, processingMsg.message_id);
      const data = response.data;
      if (!data.success) {
        throw new Error(data.error || 'Failed to scrape data');
      }

      // Prepare an inline keyboard for a "View" button.
      let keyboard;
      if (data.type === 'youtube') {
        keyboard = {
          inline_keyboard: [
            [{ text: 'View Video', url: data.originalUrl }]
          ]
        };
      } else if (data.type === 'instagram') {
        keyboard = {
          inline_keyboard: [
            [{ text: 'View Post', url: data.originalUrl }]
          ]
        };
      } else if (data.type === 'website') {
        keyboard = {
          inline_keyboard: [
            [{ text: 'Read More', url: data.originalUrl }]
          ]
        };
      }

      // Process based on content type
      switch (data.type) {
        case 'youtube': {
          // Add "📺 YouTube Video" label and extra newline between title and link.
          const caption = `📺 *YouTube Video*\n\n*${data.title}*\n\n🔗 [Watch Video](${data.originalUrl})`;
          if (data.mediaUrl) {
            await bot.sendPhoto(chatId, data.mediaUrl, { caption, parse_mode: 'Markdown', reply_markup: keyboard });
          } else {
            await bot.sendMessage(chatId, caption, { parse_mode: 'Markdown', reply_markup: keyboard });
          }
          break;
        }
        case 'instagram':
          if (data.contentType === 'reel') {
            await bot.sendMessage(chatId,
              `📱 *Instagram Reel*\n\n📝 ${data.caption}\n\n🔗 [View Reel](${data.originalUrl})`,
              { parse_mode: 'Markdown', reply_markup: keyboard }
            );
          } else {
            const messageText = `📸 *Instagram Post*\n\n📝 ${data.caption}\n\n🔗 [View Post](${data.originalUrl})`;
            if (data.mediaUrl) {
              await bot.sendPhoto(chatId, data.mediaUrl, { caption: messageText, parse_mode: 'Markdown', reply_markup: keyboard });
            } else {
              await bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown', reply_markup: keyboard });
            }
          }
          break;
        case 'website': {
          const messageText = `🌍 *${data.title}*\n\n📝 ${data.description}\n\n🔗 [Read More](${data.originalUrl})`;
          if (data.mediaUrl) {
            await bot.sendPhoto(chatId, data.mediaUrl, { caption: messageText, parse_mode: 'Markdown', reply_markup: keyboard });
          } else {
            await bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown', reply_markup: keyboard });
          }
          break;
        }
        default:
          throw new Error('Unsupported content type');
      }
    } catch (error) {
      console.error('Error processing URL in messageHandler:', error);
      await bot.sendMessage(chatId,
        '❌ _Sorry, I encountered an error while processing your URL._\n' +
        '_Please ensure the link is valid and try again._',
        { parse_mode: 'Markdown' }
      );
    }
  }
}

module.exports = { handleUrlMessage };
