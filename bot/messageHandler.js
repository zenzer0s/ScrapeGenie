// bot/messageHandler.js
const axios = require('axios');

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
    // For Pinterest URLs, pass the userId for session cookies
    if (url.includes('pinterest.com') || url.includes('pin.it')) {
      const userId = msg.from.id.toString();
      
      try {
        // First try with session if available
        const response = await axios.post(`${BACKEND_URL}/api/scrape`, { 
          url, 
          userId 
        });
        
        clearInterval(timer);
        await bot.deleteMessage(chatId, processingMsg.message_id);
        
        const data = response.data;
        
        if (!data.success) {
          // If authentication required, suggest login
          if (data.requiresAuthentication) {
            await bot.sendMessage(chatId, 
              "⚠️ *This Pinterest content requires login*\n\n" +
              "Use /pinterest_login to connect your Pinterest account for downloading this content.",
              { parse_mode: "Markdown" }
            );
            return;
          }
          
          throw new Error(data.error || 'Failed to extract Pinterest content');
        }
        
        // Define keyboard for the message
        const keyboard = {
          inline_keyboard: [
            [{ text: 'View on Pinterest', url: data.originalUrl }]
          ]
        };
        
        // Handle Pinterest content (photos/videos)
        if (data.mediaUrl) {
          const caption = `📌 *Pinterest ${data.contentType}*\n\n` +
                         (data.title ? `*${data.title}*\n\n` : '') +
                         (data.description ? `${data.description}\n\n` : '') +
                         (data.creator ? `👤 By: ${data.creator}\n\n` : '') +
                         `🔗 [View original](${data.originalUrl})`;

          if (data.contentType === 'video') {
            await bot.sendVideo(chatId, data.mediaUrl, {
              caption,
              parse_mode: 'Markdown',
              reply_markup: keyboard
            });
          } else {
            await bot.sendPhoto(chatId, data.mediaUrl, {
              caption,
              parse_mode: 'Markdown',
              reply_markup: keyboard
            });
          }
        } else {
          await bot.sendMessage(chatId, 
            "❌ Failed to extract media from this Pinterest URL.",
            { parse_mode: 'Markdown' }
          );
        }
      } catch (error) {
        console.error('Error processing Pinterest URL:', error);
        await bot.sendMessage(chatId,
          '❌ _Failed to extract content from this Pinterest URL._\n\n' +
          'If this is private content, try using /pinterest_login first.',
          { parse_mode: 'Markdown' }
        );
      }
      return; // Return early to avoid processing this URL further
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
    console.error('Error processing URL in messageHandler:', error);
    await bot.sendMessage(chatId,
      '❌ _Sorry, I encountered an error while processing your URL._\n' +
      '_Please ensure the link is valid and try again._',
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
