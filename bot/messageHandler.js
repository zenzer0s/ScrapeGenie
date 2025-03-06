// bot/messageHandler.js
const axios = require('axios');
const logger = require('./logger');
// Fix the import paths
const pinterestScraper = require('../backend/scraper/pinterestScraper');
const sessionManager = require('../backend/services/sessionManager');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

async function handleUrlMessage(bot, msg) {
  // Extract URL from message text
  const text = msg.text;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = urlRegex.exec(text);
  
  if (!match) return;
  
  const url = match[0];
  const chatId = msg.chat.id;

  try {
    // Send "processing" message
    const processingMsg = await bot.sendMessage(chatId, "⏳ Processing your URL...");
    
    // Show typing animation
    await bot.sendChatAction(chatId, 'typing');
    
    // Set a timer to update the processing message if it takes too long
    let dots = 0;
    const timer = setInterval(async () => {
      dots = (dots + 1) % 4;
      const loadingText = "⏳ Processing your URL" + ".".repeat(dots);
      
      try {
        await bot.editMessageText(loadingText, {
          chat_id: chatId,
          message_id: processingMsg.message_id
        });
      } catch (error) {
        console.error('Error updating processing message:', error);
      }
    }, 2000);
    
    const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 8000}`;
    // For Pinterest URLs, use the new scraper
    if (url.includes('pinterest.com') || url.includes('pin.it')) {
      const userId = msg.from.id.toString();
      
      try {
        const cookies = await sessionManager.getSession(userId)?.cookies || [];
        const result = await pinterestScraper.scrapePinterest(url, cookies);
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to extract Pinterest content');
        }

        // Create keyboard markup with URL
        const keyboard = {
          inline_keyboard: [
            [
              {
                text: '📌 View on Pinterest',
                url: result.originalUrl || url  // Fallback to original input URL if needed
              }
            ]
          ]
        };

        // Create caption
        const caption = `📌 *Pinterest Image*\n\n` +
                       (result.title ? `*${result.title}*\n\n` : '') +
                       (result.description ? `${result.description.substring(0, 500)}${result.description.length > 500 ? '...' : ''}\n\n` : '') +
                       (result.creator ? `👤 By: ${result.creator}\n\n` : '');

        // Debug log
        console.log('Sending message with:', {
          mediaUrl: result.mediaUrl,
          caption,
          keyboard: JSON.stringify(keyboard)
        });

        // Send media with error handling
        try {
          await bot.sendPhoto(chatId, result.mediaUrl, {
            caption,
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
        } catch (photoError) {
          console.log('Error sending photo:', photoError.message);
          
          // Try sending as document
          await bot.sendDocument(chatId, result.mediaUrl, {
            caption,
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
        }

      } catch (error) {
        console.error('Pinterest Error:', error);
        await bot.sendMessage(
          chatId,
          '❌ Sorry, I encountered an error while processing your Pinterest URL.\n' +
          'Please ensure the link is valid and try again.',
          { parse_mode: 'Markdown' }
        );
      }
      return;
    }
    
    // Handle other URLs as before
    const response = await axios.post(`${BACKEND_URL}/api/scrape`, { url });
    
    clearInterval(timer);
    await bot.deleteMessage(chatId, processingMsg.message_id);
    
    const data = response.data;
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to scrape data');
    }

    // Process based on content type
    if (data.type === 'youtube') {
      // Handle YouTube content
      // Add "📺 YouTube Video" label and extra newline between title and link.
      const caption = `📺 *YouTube Video*\n\n*${data.title}*\n\n🔗 [Watch Video](${data.originalUrl})`;
      if (data.mediaUrl) {
        await bot.sendPhoto(chatId, data.mediaUrl, { caption, parse_mode: 'Markdown', reply_markup: keyboard });
      } else {
        await bot.sendMessage(chatId, caption, { parse_mode: 'Markdown', reply_markup: keyboard });
      }
    } else if (data.type === 'instagram') {
      // Handle Instagram content
      if (data.contentType === 'reel') {
        // Clean the caption and remove hashtags
        const cleanCaption = cleanupInstagramText(data.caption);
        
        await bot.sendMessage(chatId,
          `📱 <b>Instagram Reel</b>\n\n📝 ${cleanCaption}\n\n🔗 <a href="${data.originalUrl}">View Reel</a>`,
          { parse_mode: 'HTML', reply_markup: keyboard }
        );
      } else {
        const cleanCaption = cleanupInstagramText(data.caption);
        const messageText = `📸 <b>Instagram Post</b>\n\n📝 ${cleanCaption}\n\n🔗 <a href="${data.originalUrl}">View Post</a>`;
        
        if (data.mediaUrl) {
          await bot.sendPhoto(chatId, data.mediaUrl, { caption: messageText, parse_mode: 'HTML', reply_markup: keyboard });
        } else {
          await bot.sendMessage(chatId, messageText, { parse_mode: 'HTML', reply_markup: keyboard });
        }
      }
    } else if (data.type === 'website') {
      // Handle website content
      const messageText = `🌍 *${data.title}*\n\n📝 ${data.description}\n\n🔗 [Read More](${data.originalUrl})`;
      if (data.mediaUrl) {
        await bot.sendPhoto(chatId, data.mediaUrl, { caption: messageText, parse_mode: 'Markdown', reply_markup: keyboard });
      } else {
        await bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown', reply_markup: keyboard });
      }
    } else {
      throw new Error('Unsupported content type');
    }
  } catch (error) {
    logger.error(`Error handling message: ${error.stack || error}`);
    await bot.sendMessage(msg.chat.id,
      '❌ An error occurred while processing your request.\n' +
      'Please try again later or contact support if the issue persists.',
      { parse_mode: 'Markdown' }
    );
  }
}

function escapeMarkdown(text) {
  if (!text) return '';
  
  // First filter out long hashtags and clean up the text
  let cleanText = text
    // Remove hashtags with more than 15 characters
    .replace(/#[^\s#]{15,}/g, '')
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    .trim();
    
  // Escape only specific Markdown characters that are problematic
  // Using HTML mode instead as it's more reliable for this case
  return cleanText;
}

// Add this new function to your file
function cleanupInstagramText(text) {
  if (!text) return '';
  
  return text
    // Remove all hashtags completely
    .replace(/#\w+/g, '')
    // Remove excessive line breaks
    .replace(/\n{3,}/g, '\n\n')
    // Remove excessive dots
    .replace(/\.{2,}/g, '...')
    // Clean up spaces
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { handleUrlMessage };
