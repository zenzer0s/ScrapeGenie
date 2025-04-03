const puppeteer = require('puppeteer');
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { getBrowser, getPage, releasePage } = require('./browserManager');

// Constants
const VIDEO_DIR = "/dev/shm/youtube_tmp";
const AUDIO_DIR = "/dev/shm/youtube_audio_tmp";
const VIDEO_CLEANUP = 5 * 60 * 1000; // 5 minutes
const AUDIO_CLEANUP = 30 * 60 * 1000; // 30 minutes

// Utility functions
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
  const qualities = [
    'maxresdefault', 'sddefault', 'hqdefault', 'mqdefault', 'default'
  ];
  
  for (const quality of qualities) {
    const url = `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) return url;
    } catch (error) { /* Continue to next quality */ }
  }
  
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function scheduleCleanup(filepath, delay) {
  setTimeout(() => {
    try {
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    } catch { /* Silent error */ }
  }, delay);
}

function cleanupOldFiles(dir, delay) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  const now = Date.now();
  let count = 0;

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    if ((now - stats.mtimeMs) > delay) {
      try {
        fs.unlinkSync(filePath);
        count++;
      } catch { /* Silent error */ }
    }
  });

  if (count > 0) console.log(`🧹 Cleaned up ${count} files from ${dir}`);
}

async function executePythonScript(url, dir, audioFlag = false) {
  return new Promise((resolve, reject) => {
    ensureDir(dir);
    const scriptPath = path.join(__dirname, "ytdlp.py");
    const audioParam = audioFlag ? '"audio"' : '';
    const command = `python3 ${scriptPath} "${url}" "${dir}" ${audioParam}`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || "yt-dlp error"));

      try {
        const jsonLine = stdout.split("\n").find(line => {
          try { JSON.parse(line); return true; } catch { return false; }
        });

        if (!jsonLine) throw new Error("No JSON output found");

        const output = JSON.parse(jsonLine);
        if (output.error) return reject(new Error(output.error));
        
        resolve(output);
      } catch (error) {
        reject(new Error("Failed to parse yt-dlp output"));
      }
    });
  });
}

// Core functions
async function fetchYouTubeAudio(url) {
  const output = await executePythonScript(url, AUDIO_DIR, true);
  scheduleCleanup(output.filepath, AUDIO_CLEANUP);
  return output;
}

async function fetchYouTubeShort(url) {
  const output = await executePythonScript(url, VIDEO_DIR);
  scheduleCleanup(output.filepath, VIDEO_CLEANUP);
  
  const videoId = extractVideoId(url);
  if (videoId) {
    output.videoId = videoId;
    output.thumbnailUrl = await getThumbnailUrl(videoId);
  }
  
  return output;
}

async function scrapeYouTubeMetadata(url) {
  const videoId = extractVideoId(url);
  if (!videoId) return { success: false, error: "Invalid YouTube URL" };

  const thumbnailPromise = getThumbnailUrl(videoId);
  const audioPromise = fetchYouTubeAudio(url).catch(() => null);
  
  let page = null;
  try {
    page = await getPage();
    await page.removeAllListeners('request');
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      try { request.continue(); } 
      catch { /* Ignore already handled */ }
    });
    
    await page.setViewport({ width: 800, height: 600 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    );
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const title = await page.evaluate(() => {
      return document.querySelector('meta[property="og:title"]')?.content ||
             document.querySelector('meta[name="title"]')?.content ||
             document.querySelector('title')?.textContent?.replace(' - YouTube', '') || 
             "Untitled YouTube Video";
    });

    const [thumbnailUrl, audio] = await Promise.all([thumbnailPromise, audioPromise]);

    const result = {
      success: true,
      type: 'youtube',
      title,
      mediaUrl: thumbnailUrl,
      originalUrl: url,
      videoId
    };

    if (audio?.success) {
      result.audioFile = audio.filepath;
      result.audioType = audio.fileExtension;
      result.hasAudio = true;
    } else {
      result.hasAudio = false;
    }

    return result;
  } catch (error) {
    const [thumbnailUrl, audio] = await Promise.all([thumbnailPromise, audioPromise]);
    
    if (videoId) {
      return {
        success: true,
        type: 'youtube',
        title: "YouTube Video",
        mediaUrl: thumbnailUrl,
        originalUrl: url,
        videoId,
        hasAudio: audio?.success || false,
        audioFile: audio?.filepath,
        audioType: audio?.fileExtension
      };
    }
    
    return { success: false, error: "Failed to fetch YouTube video" };
  } finally {
    if (page) {
      await page.removeAllListeners('request');
      await releasePage(page);
    }
  }
}

async function scrapeYouTube(url, retries = 2) {
  try {
    return await scrapeYouTubeMetadata(url);
  } catch (error) {
    if (retries > 0) return await scrapeYouTube(url, retries - 1);
    
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

// Setup cleanup tasks
function initCleanup() {
  setInterval(() => {
    cleanupOldFiles(VIDEO_DIR, VIDEO_CLEANUP);
    cleanupOldFiles(AUDIO_DIR, AUDIO_CLEANUP);
  }, 15 * 60 * 1000);

  cleanupOldFiles(VIDEO_DIR, VIDEO_CLEANUP);
  cleanupOldFiles(AUDIO_DIR, AUDIO_CLEANUP);
}

// Initialize
initCleanup();

module.exports = { 
  scrapeYouTube,
  fetchYouTubeShort,
  fetchYouTubeAudio
};