// bot/messageHandler.js
const axios = require('axios');
const logger = require('./logger');
const pinterestScraper = require('../backend/scraper/pinterestScraper');
const sessionManager = require('../backend/services/sessionManager');
const { scrapeContent } = require("../backend/scraper/scraperManager");
const fs = require("fs");
const path = require("path");

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
// Use the absolute download path that's now fixed in instaScraper.js
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
    
    // Call backend API to process the URL
    console.log(`🔍 Calling API for URL: ${url}`);
    const response = await axios.post(`${BACKEND_URL}/api/scrape`, { url });
    
    // Delete the "processing" message
    await bot.deleteMessage(chatId, processingMsg.message_id);
    
    // Log the response for debugging
    console.log('📝 API Response:', JSON.stringify(response.data));
    
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

    // Handle based on content type
    if (data.type === 'youtube') {
      console.log('🎥 YouTube content detected!');
      
      // Create YouTube caption - simplified to just show the title
      const caption = `*${escapeMarkdown(data.title)}*`;
      
      // Check if we have a thumbnail URL
      if (data.mediaUrl) {
        try {
          console.log(`📸 Sending YouTube thumbnail: ${data.mediaUrl}`);
          await bot.sendPhoto(chatId, data.mediaUrl, { 
            caption: caption, 
            parse_mode: 'Markdown',
            reply_markup: keyboard 
          });
          console.log('✅ YouTube thumbnail sent successfully');
        } catch (photoError) {
          console.error(`❌ Error sending YouTube photo: ${photoError.message}`);
          // Fallback to text-only message
          await bot.sendMessage(chatId, caption, { 
            parse_mode: 'Markdown',
            reply_markup: keyboard 
          });
        }
      } else {
        // No thumbnail, send text only
        await bot.sendMessage(chatId, caption, { 
          parse_mode: 'Markdown',
          reply_markup: keyboard 
        });
      }
      return;
    }
    
    // Handle Instagram URLs
    if (data.type === 'instagram') {
      // Your Instagram handling code
    }
    
    // Handle other content types
    // ...

  } catch (error) {
    console.error(`❌ Error handling URL: ${error.message}`);
    logger.error(`Error handling URL: ${error.stack || error}`);
    
    try {
      await bot.sendMessage(chatId, '❌ Sorry, I encountered an error processing your request. Please try again later.');
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
  
  // First filter out long hashtags and clean up the text
  let cleanText = text
    // Remove hashtags with more than 15 characters
    .replace(/#[^\s#]{15,}/g, '')
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    .trim();
    
  // Escape only specific Markdown characters that are problematic
  return cleanText;
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
