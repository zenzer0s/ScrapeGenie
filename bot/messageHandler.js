// bot/messageHandler.js
const axios = require('axios');
const logger = require('./logger');
const fs = require("fs");
const path = require("path");

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
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
        
        // FIXED: Instagram response is nested in response.data.data
        const mediaPath = response.data.data.mediaPath;
        const caption = response.data.data.caption || '';
        const isVideo = response.data.data.is_video || false;
        
        console.log(`📂 Media path: ${mediaPath}`);
        console.log(`🎬 Is video: ${isVideo}`);
        
        // Verify file exists
        if (!mediaPath || !fs.existsSync(mediaPath)) {
          throw new Error(`Media file not found at: ${mediaPath}`);
        }
        
        // Create keyboard markup with URL
        const keyboard = {
          inline_keyboard: [
            [{ text: '📱 Open in Instagram', url: url }]
          ]
        };
        
        // Format caption
        const messageText = caption ? `${caption}` : '';
        
        // Send media based on type
        if (isVideo) {
          console.log('📹 Sending video...');
          await bot.sendVideo(chatId, mediaPath, {
            caption: messageText,
            reply_markup: keyboard
          });
        } else {
          console.log('🖼️ Sending photo...');
          await bot.sendPhoto(chatId, mediaPath, {
            caption: messageText,
            reply_markup: keyboard
          });
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
    
    // Create keyboard markup with URL
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: 'Watch on YouTube',
            url: url
          }
        ]
      ]
    };

    // Handle different content types
    if (data.type === 'youtube') {
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
      await bot.sendMessage(chatId, `✅ Content scraped successfully. Type: ${data.type || 'unknown'}`, {
        reply_markup: keyboard
      });
    }
    
  } catch (error) {
    console.error(`❌ Error handling URL: ${error.message}`);
    logger.error(`Error handling URL: ${error}`);
    
    try {
      await bot.sendMessage(chatId, `❌ Sorry, I encountered an error processing your request.\nError: ${error.message}`);
    } catch (sendError) {
      console.error(`Failed to send error message: ${sendError.message}`);
    }
  }
}

async function handleMessage(ctx) {
    const text = ctx.message.text;

    if (!text || !text.startsWith("http")) {
        return; // Ignore messages that are not URLs
    }

    ctx.reply("🔄 Downloading...");

    try {
        const result = await scrapeContent(text);

        // Check if it's an Instagram post (Instaloader saves files in downloads/)
        const downloadFolder = path.join(__dirname, "../downloads");
        const files = fs.readdirSync(downloadFolder).map(f => path.join(downloadFolder, f));

        if (files.length === 0) {
            return ctx.reply("❌ No file found. Something went wrong.");
        }

        let sentMedia = false; // Track if at least one media file is sent

        // Send downloaded files (photo/video)
        for (const file of files) {
            if (file.endsWith(".mp4")) {
                await ctx.replyWithVideo({ source: file });
                sentMedia = true;
            } else if (file.endsWith(".jpg") || file.endsWith(".png")) {
                await ctx.replyWithPhoto({ source: file });
                sentMedia = true;
            }
        }

        if (!sentMedia) {
            return ctx.reply("❌ No media found. Please check if the link is correct.");
        }

        // Cleanup (optional)
        setTimeout(() => {
            files.forEach(file => fs.unlinkSync(file));
        }, 10000); // Wait 10 seconds before deleting files

    } catch (error) {
        console.error("❌ Failed to download:", error);
        ctx.reply("❌ Download failed. Please try again.");
    }
}

function escapeMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\*/g, '\\*')
    .replace(/\_/g, '\\_')
    .replace(/\`/g, '\\`');
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

module.exports = { handleUrlMessage, handleMessage };
