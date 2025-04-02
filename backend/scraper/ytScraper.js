// ytScraper.js
const puppeteer = require('puppeteer');
const { getBrowser, getPage, releasePage } = require('./browserManager');
const { fetchYouTubeAudio } = require('./ytAudio');

function extractVideoId(url) {
  if (url.includes('youtube.com/watch?v=')) {
    return new URL(url).searchParams.get('v');
  } else if (url.includes('youtube.com/shorts/')) {
    return url.split('shorts/')[1]?.split(/[?#]/)[0];
  } else if (url.includes('youtu.be/')) {
    return url.split('youtu.be/')[1]?.split(/[?#]/)[0];
  }
  return null;
}

async function getThumbnailUrl(videoId) {
  const qualityLevels = [
    { name: 'maxresdefault', width: 1280, height: 720 },
    { name: 'sddefault', width: 640, height: 480 },
    { name: 'hqdefault', width: 480, height: 360 },
    { name: 'mqdefault', width: 320, height: 180 },
    { name: 'default', width: 120, height: 90 }
  ];
  
  for (const quality of qualityLevels) {
    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/${quality.name}.jpg`;
    try {
      const response = await fetch(thumbnailUrl, { method: 'HEAD' });
      if (response.ok) {
        console.log(`✅ Found thumbnail: ${quality.name}`);
        return thumbnailUrl;
      }
    } catch (error) {
      // Continue to next quality if fetch fails
    }
  }
  
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

async function ytScraper(videoUrl) {
  // Validate URL and extract video ID
  if (!videoUrl.includes('youtube.com/watch?v=') && 
      !videoUrl.includes('youtu.be/') && 
      !videoUrl.includes('youtube.com/shorts/')) {
    return { success: false, error: "Invalid YouTube URL" };
  }

  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    return { success: false, error: "Could not extract video ID" };
  }

  // Begin parallel operations
  const thumbnailPromise = getThumbnailUrl(videoId);
  const audioPromise = fetchYouTubeAudio(videoUrl).catch(() => null);
  
  let page = null;
  try {
    // Get page and set up
    page = await getPage();
    await page.removeAllListeners('request');
    await page.setRequestInterception(true);
    
    // Handle requests safely
    page.on('request', (request) => {
      try {
        request.continue();
      } catch (error) {
        // Ignore "already handled" errors
      }
    });
    
    // Optimize page settings
    await page.setViewport({ width: 800, height: 600 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    );
    
    // Navigate and extract title
    await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const title = await page.evaluate(() => {
      return document.querySelector('meta[property="og:title"]')?.content ||
             document.querySelector('meta[name="title"]')?.content ||
             document.querySelector('title')?.textContent?.replace(' - YouTube', '') || 
             "Untitled YouTube Video";
    });

    // Wait for parallel operations to complete
    const [thumbnailUrl, audio] = await Promise.all([thumbnailPromise, audioPromise]);

    // Build result object
    const result = {
      success: true,
      type: 'youtube',
      title,
      mediaUrl: thumbnailUrl,
      originalUrl: videoUrl,
      videoId
    };

    // Add audio if available
    if (audio?.success) {
      result.audioFile = audio.filepath;
      result.audioType = audio.fileExtension;
      result.hasAudio = true;
    } else {
      result.hasAudio = false;
    }

    return result;
  } catch (error) {
    // Handle error case
    const [thumbnailUrl, audio] = await Promise.all([thumbnailPromise, audioPromise]);
    
    if (videoId) {
      return {
        success: true,
        type: 'youtube',
        title: "YouTube Video",
        mediaUrl: thumbnailUrl,
        originalUrl: videoUrl,
        videoId,
        hasAudio: audio?.success || false,
        audioFile: audio?.filepath,
        audioType: audio?.fileExtension
      };
    }
    
    return { success: false, error: "Failed to fetch YouTube video details" };
  } finally {
    if (page) {
      await page.removeAllListeners('request');
      await releasePage(page);
    }
  }
}

async function scrapeYouTube(url, retries = 2) {
  try {
    return await ytScraper(url);
  } catch (error) {
    if (retries > 0) {
      return await scrapeYouTube(url, retries - 1);
    }
    
    const videoId = extractVideoId(url);
    return {
      success: true,
      type: 'youtube',
      title: 'YouTube Video',
      mediaUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '',
      originalUrl: url,
      videoId: videoId || null,
      hasAudio: false
    };
  }
}

module.exports = { scrapeYouTube };