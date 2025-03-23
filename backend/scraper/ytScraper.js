// ytScraper.js
const puppeteer = require('puppeteer');
const getBrowser = require('./browserManager');
const { fetchYouTubeAudio } = require('./ytAudio'); // Add this line

// Extract video ID from various YouTube URL formats
function extractVideoId(url) {
  let videoId = null;
  
  // Handle youtube.com/watch?v= format
  if (url.includes('youtube.com/watch?v=')) {
    videoId = new URL(url).searchParams.get('v');
  } 
  // Handle youtube.com/shorts/ format
  else if (url.includes('youtube.com/shorts/')) {
    videoId = url.split('shorts/')[1]?.split(/[?#]/)[0];
  } 
  // Handle youtu.be/ format
  else if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1]?.split(/[?#]/)[0];
  }
  
  return videoId;
}

// Get thumbnail URL directly from video ID (no browser needed)
function getThumbnailUrl(videoId) {
  // Try the highest quality first
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
}

async function ytScraper(videoUrl) {
  // Check if it's a valid YouTube URL
  if (!videoUrl.includes('youtube.com/watch?v=') && 
      !videoUrl.includes('youtu.be/') && 
      !videoUrl.includes('youtube.com/shorts/')) {
    return { 
      success: false, 
      error: "Invalid YouTube URL" 
    };
  }

  // Extract video ID without browser
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    return {
      success: false,
      error: "Could not extract video ID"
    };
  }

  // Get thumbnail URL directly
  const thumbnailUrl = getThumbnailUrl(videoId);
  
  // Start audio download in parallel with metadata scraping
  const audioPromise = fetchYouTubeAudio(videoUrl).catch(error => {
    console.error('❌ Audio download failed:', error.message);
    return null; // Return null if audio download fails
  });
  
  // Now we only need to fetch the title
  let browser = null;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    
    // Optimize page for speed
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      // Only allow document and script requests - block images, stylesheets, fonts, etc.
      const resourceType = req.resourceType();
      if (resourceType === 'document' || resourceType === 'script') {
        req.continue();
      } else {
        req.abort();
      }
    });
    
    // Set a low viewport size to reduce resource usage
    await page.setViewport({ width: 800, height: 600 });
    
    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/91.0.4472.124 Safari/537.36'
    );
    
    // Wait for shorter time and only for DOMContentLoaded, not networkidle0
    await page.goto(videoUrl, { 
      waitUntil: 'domcontentloaded', 
      timeout: 15000 
    });

    // Extract title more efficiently
    const title = await page.evaluate(() => {
      // Try different selectors for the title in order of reliability
      return document.querySelector('meta[property="og:title"]')?.content ||
             document.querySelector('meta[name="title"]')?.content ||
             document.querySelector('title')?.textContent?.replace(' - YouTube', '') || 
             "Untitled YouTube Video";
    });

    // Wait for audio download to complete
    const audio = await audioPromise;

    // Build the result object with all existing properties
    const result = {
      success: true,
      type: 'youtube',
      title: title,
      mediaUrl: thumbnailUrl,
      originalUrl: videoUrl,
      videoId: videoId
    };

    // Add audio data if available
    if (audio && audio.success) {
      result.audioFile = audio.filepath;
      result.audioType = audio.fileExtension;
      result.hasAudio = true;
    } else {
      result.hasAudio = false;
    }

    return result;

  } catch (error) {
    console.error("YouTube Scrape Error:", error);
    
    // Wait for the audio even if metadata scraping fails
    const audio = await audioPromise;
    
    // Even if scraping fails, we still have the thumbnail URL, so return partial success
    if (videoId) {
      const result = {
        success: true,
        type: 'youtube',
        title: "YouTube Video", // Generic fallback title
        mediaUrl: thumbnailUrl,
        originalUrl: videoUrl,
        videoId: videoId
      };
      
      // Add audio data if available
      if (audio && audio.success) {
        result.audioFile = audio.filepath;
        result.audioType = audio.fileExtension;
        result.hasAudio = true;
      } else {
        result.hasAudio = false;
      }
      
      return result;
    }
    
    return { 
      success: false, 
      error: "Failed to fetch YouTube video details" 
    };
  } finally {
    // We don't close the browser here since we're using browserManager
  }
}

async function scrapeYouTube(url, retries = 2) {
  try {
    return await ytScraper(url);
  } catch (error) {
    if (retries > 0) {
      console.log(`⚠️ YouTube scrape failed, retrying (${retries} attempts left)...`);
      return await scrapeYouTube(url, retries - 1);
    }
    
    // Extract video ID for fallback
    const videoId = extractVideoId(url);
    
    // Fall back to minimal data if all retries fail
    return {
      success: true,
      type: 'youtube',
      title: 'YouTube Video',
      mediaUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : '',
      originalUrl: url,
      videoId: videoId || null,
      hasAudio: false
    };
  }
}

module.exports = { scrapeYouTube };