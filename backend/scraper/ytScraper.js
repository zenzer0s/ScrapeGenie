// ytScraper.js
const puppeteer = require('puppeteer');
const getBrowser = require('./browserManager');
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const pythonPath = process.env.PYTHON_PATH || "/usr/bin/python3";

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

    return {
      success: true,
      type: 'youtube',
      title: title,
      mediaUrl: thumbnailUrl,
      originalUrl: videoUrl,
      videoId: videoId
    };

  } catch (error) {
    console.error("YouTube Scrape Error:", error);
    
    // Even if scraping fails, we still have the thumbnail URL, so return partial success
    if (videoId) {
      return {
        success: true,
        type: 'youtube',
        title: "YouTube Video", // Generic fallback title
        mediaUrl: thumbnailUrl,
        originalUrl: videoUrl,
        videoId: videoId
      };
    }
    
    return { 
      success: false, 
      error: "Failed to fetch YouTube video details" 
    };
  } finally {
    // We don't close the browser here since we're using browserManager
  }
}

async function fetchYouTubeShort(url) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        console.log(`\n⏱️ Starting YouTube Shorts process for: ${url}`);
        
        const scriptPath = path.join(__dirname, "ytdlp.py");
        const downloadDir = "/dev/shm/youtube_tmp";

        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        console.log(`📂 RAM disk directory: ${downloadDir}`);

        const pythonStartTime = Date.now();
        const process = spawn(pythonPath, [scriptPath, url, downloadDir]);

        process.stdout.on("data", (data) => {
            console.log("📥 yt-dlp progress:", data.toString());
        });

        process.stderr.on("data", (data) => {
            console.error("❌ yt-dlp error:", data.toString());
        });

        process.on("close", (code) => {
            const pythonEndTime = Date.now();
            console.log(`⏱️ Python process: ${formatTime(pythonEndTime - pythonStartTime)}`);
            if (code !== 0) {
                return reject(new Error(`yt-dlp process exited with code ${code}`));
            }

            let output;
            try {
                const lines = data.toString().split('\n');
                const jsonLine = lines.filter(line => line.trim().startsWith('{') && line.trim().endsWith('}')).pop();
                if (!jsonLine) {
                    throw new Error("No JSON found in yt-dlp output");
                }
                output = JSON.parse(jsonLine);
                if (output.error) return reject(new Error(output.error));
            } catch (parseError) {
                console.error(`❌ JSON Parse Error: ${parseError.message}`);
                return reject(new Error("Failed to parse yt-dlp output"));
            }

            resolve(output);

            // Schedule cleanup after 5 minutes
            setTimeout(() => {
                try {
                    if (fs.existsSync(output.file_path)) {
                        fs.unlinkSync(output.file_path);
                        console.log(`🧹 Cleaned up file: ${output.file_path}`);
                    }
                } catch (cleanupError) {
                    console.error(`Failed to clean up file: ${cleanupError}`);
                }
            }, 5 * 60 * 1000);
        });
    });
}

async function scrapeYouTube(url) {
  return await ytScraper(url);
}

module.exports = { scrapeYouTube, fetchYouTubeShort };

// Helper function for formatting time
const formatTime = ms => (ms / 1000).toFixed(2) + 's';
