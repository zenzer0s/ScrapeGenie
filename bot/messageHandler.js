// bot/messageHandler.js
const axios = require('axios');
const logger = require('./logger');
const fs = require("fs");
const path = require("path");

const BACKEND_URL = process.env.BACKEND_URL || 'http://0.0.0.0:8080';
const DOWNLOAD_DIR = "/home/zen/Documents/Pro/ScrapeGenie/downloads";

async function handleUrlMessage(bot, msg) {
  // Extract URL from message text
  const text = msg.text;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = urlRegex.exec(text);
  
  if (!match) {
    return; // No URL found, exit the function
  }
  
  const url = match[0];
  const chatId = msg.chat.id;

  try {
    // Send "processing" message
    const processingMsg = await bot.sendMessage(chatId, "⏳ Processing your URL...");
    
    // Show typing animation
    await bot.sendChatAction(chatId, 'typing');
    
    console.log(`🔍 Calling API for URL: ${url}`);
    
    // Identify URL type before making API call
    const isInstagramUrl = url.includes('instagram.com') || url.includes('instagr.am');
    const isPinterestUrl = url.includes('pinterest.com') || url.includes('pin.it');
    const isYoutubeUrl = url.includes('youtube.com') || url.includes('youtu.be');
    
    // Make the API call
    const response = await axios.post(`${BACKEND_URL}/api/scrape`, { 
      url,
      userId: msg.from.id.toString() 
    });
    
    // Log the response for debugging
    console.log("API Response:", JSON.stringify(response.data, null, 2));
    
    // Delete processing message
    await bot.deleteMessage(chatId, processingMsg.message_id);
    
    // Handle Instagram separately as it has a different response structure
    if (isInstagramUrl) {
      try {
        if (!response.data || !response.data.success || !response.data.data) {
          throw new Error('Instagram scraping failed');
        }
        
        const data = response.data.data;
        const mediaPath = data.mediaPath;
        let caption = data.caption || '';
        const isVideo = data.is_video || false;
        const isCarousel = data.is_carousel || false;
        
        console.log(`📂 Media path:`, mediaPath);
        console.log(`🎬 Is video: ${isVideo}, Is carousel: ${isCarousel}`);
        
        // Create keyboard markup with URL
        const keyboard = {
          inline_keyboard: [
            [{ text: '📱 Open in Instagram', url: url }]
          ]
        };
        
        // Handle carousel posts (multiple images)
        if (isCarousel && Array.isArray(mediaPath) && mediaPath.length > 0) {
          console.log(`🖼️ Sending carousel with ${mediaPath.length} images...`);
          
          // Split mediaPath into chunks of 6 images each
          const mediaChunks = [];
          for (let i = 0; i < mediaPath.length; i += 6) {
            mediaChunks.push(mediaPath.slice(i, i + 6));
          }
          
          for (const chunk of mediaChunks) {
            // Prepare media group format for Telegram
            const mediaGroup = chunk.map((filePath) => {
              if (!fs.existsSync(filePath)) {
                console.warn(`⚠️ File not found: ${filePath}`);
                return null;
              }
              
              return {
                type: 'photo',
                media: fs.createReadStream(filePath),
                parse_mode: 'HTML'
              };
            }).filter(Boolean); // Remove any nulls from non-existent files
            
            if (mediaGroup.length === 0) {
              throw new Error('No valid files found in carousel');
            }
            
            // Send as media group
            await bot.sendMediaGroup(chatId, mediaGroup);
          }
          
          // Send caption separately if there are more than 6 images
          if (mediaPath.length > 6) {
            await bot.sendMessage(chatId, caption, { parse_mode: 'HTML', reply_markup: keyboard });
          } else {
            // Send button separately since media groups don't support inline keyboards
            await bot.sendMessage(chatId, '📱 View original post:', {
              reply_markup: keyboard
            });
          }
          
        } else if (isVideo) {
          // Single video
          if (!fs.existsSync(mediaPath)) {
            throw new Error(`Video file not found at: ${mediaPath}`);
          }
          
          console.log('📹 Sending video...');
          await bot.sendVideo(chatId, mediaPath, {
            caption: caption.length <= 1024 ? caption : '',
            reply_markup: keyboard
          });
          
          // Send caption separately if it's too long
          if (caption.length > 1024) {
            await bot.sendMessage(chatId, caption, { parse_mode: 'HTML' });
          }
          
        } else {
          // Single image
          if (!fs.existsSync(mediaPath)) {
            throw new Error(`Image file not found at: ${mediaPath}`);
          }
          
          console.log('🖼️ Sending single image...');
          await bot.sendPhoto(chatId, mediaPath, {
            caption: caption.length <= 1024 ? caption : '',
            reply_markup: keyboard
          });
          
          // Send caption separately if it's too long
          if (caption.length > 1024) {
            await bot.sendMessage(chatId, caption, { parse_mode: 'HTML' });
          }
        }
        
        console.log('✅ Instagram content sent successfully');
        return;
      } catch (error) {
        console.error(`❌ Instagram error: ${error.message}`);
        await bot.sendMessage(
          chatId,
          `❌ Sorry, I could not process this Instagram link.\nError: ${error.message}`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
    }
    
    // Handle Pinterest and YouTube (these have data.type structure)
    if (!response.data.success || !response.data.data) {
      throw new Error('Scraping failed');
    }
    
    const data = response.data.data;
    
    // Create keyboard markup with URL - dynamic text based on URL type
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: isYoutubeUrl ? '🎬 Watch on YouTube' : 
                  isPinterestUrl ? '📌 View on Pinterest' :
                  isInstagramUrl ? '📷 View on Instagram' : 
                  '🌐 Open Website',
            url: url
          }
        ]
      ]
    };

    // Handle different content types
    if (isYoutubeUrl && data.filepath) {
      const caption = `*${escapeMarkdown(data.title || '')}*`;
      
      if (!fs.existsSync(data.filepath)) {
        throw new Error(`Video file not found at: ${data.filepath}`);
      }
      
      console.log('📹 Sending YouTube video...');
      await bot.sendVideo(chatId, data.filepath, {
        caption: caption,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } else if (data.type === 'youtube') {
      const caption = `*${escapeMarkdown(data.title)}*`;
      
      if (data.mediaUrl) {
        await bot.sendPhoto(chatId, data.mediaUrl, { 
          caption: caption, 
          parse_mode: 'Markdown',
          reply_markup: keyboard 
        });
      } else {
        await bot.sendMessage(chatId, caption, { 
          parse_mode: 'Markdown',
          reply_markup: keyboard 
        });
      }
    } else if (data.type === 'pinterest') {
      await bot.sendPhoto(chatId, data.mediaUrl, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } else {
      // Handle generic/unknown content types
      let message = '';
      
      // Title in bold
      if (data.title) {
        message += `*${escapeMarkdown(data.title)}*`; 
      }
      
      // Only add content if it's not a placeholder
      if (data.content && !data.content.startsWith('Content from')) {
        message += `\n\n${data.content}`;
      }
      
      // Send message if we have content
      if (message.trim()) {
        await sendSafeMessage(bot, chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      } else {
        await sendSafeMessage(bot, chatId, "Website information retrieved", {
          reply_markup: keyboard
        });
      }
    }
    
  } catch (error) {
    console.error(`❌ Error handling URL: ${error.message}`);
    logger.error(`Error handling URL: ${error}`);
    
    // Check if this is a Pinterest authentication error
    if (error.response?.status === 401 && 
        error.response.data?.requiresAuth && 
        error.response.data?.service === 'pinterest') {
      
      console.log('🔐 Pinterest authentication required');
      
      await bot.sendMessage(
        chatId,
        "🔐 *Pinterest Login Required*\n\n" +
        "To download content from Pinterest, you need to login first.\n\n" +
        "Please tap the button below to log in, then send your Pinterest link again.",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔐 Login to Pinterest", callback_data: "pinterest_login" }]
            ]
          }
        }
      );
      return;
    }
    
    // Original error handling for other errors
    try {
      await bot.sendMessage(chatId, `❌ Sorry, I encountered an error processing your request.\nError: ${error.message}`);
    } catch (sendError) {
      console.error(`Failed to send error message: ${sendError.message}`);
    }
  }
}

// Add this improved escapeMarkdown function
function escapeMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\*/g, '\\*')
    .replace(/\_/g, '\\_')
    .replace(/\`/g, '\\`')
    .replace(/\~/g, '\\~');
}

// Add this safe message sending function
async function sendSafeMessage(bot, chatId, text, options = {}) {
  try {
    // Try with original options first
    return await bot.sendMessage(chatId, text, options);
  } catch (error) {
    if (error.message.includes('can\'t parse entities')) {
      console.log('⚠️ Formatting error, sending without parse_mode');
      const safeOptions = { ...options };
      delete safeOptions.parse_mode;
      return await bot.sendMessage(chatId, text, safeOptions);
    }
    throw error;
  }
}

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