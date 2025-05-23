const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sessionManager = require('../services/sessionManager');
const { captureAuthSession } = require('../utils/pinterest-auth'); // Added import for captureAuthSession

// Streamlined configuration for Pinterest scraping
const CONFIG = {
  loadTimeout: 15000,
  scrollDelay: 1000,
  minImageSize: {
    width: 500,
    height: 500
  }
};

// Helper function for delays and formatting
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const formatTime = ms => (ms / 1000).toFixed(2) + 's';

// Optimized quality check function
async function checkImageQuality(url) {
  try {
    const response = await axios.head(url, {
      timeout: 3000,
      validateStatus: (status) => status < 400
    });
    
    const contentLength = parseInt(response.headers['content-length'] || '0');
    const contentType = response.headers['content-type'];
    
    if (!contentLength || !contentType) {
      return { exists: false, error: 'Invalid response headers' };
    }
    
    return {
      exists: true,
      size: contentLength,
      type: contentType,
      sizeInMB: (contentLength / 1024 / 1024).toFixed(2)
    };
  } catch (error) {
    return { exists: false, error: error.message };
  }
}

// Update the loginToPinterest function to use direct data
async function loginToPinterest(username, password) {
  try {
    // Create a temporary session file path (keep this for compatibility)
    const tempSessionPath = path.join(__dirname, '..', '..', 'data', 'temp_session.json');
    
    // Use auth function but get data directly
    const sessionResult = await captureAuthSession(username, password, tempSessionPath);
    
    // Check if login was successful
    if (!sessionResult.success) {
      return { 
        success: false, 
        error: sessionResult.error || 'Authentication failed' 
      };
    }
    
    // Return session data directly instead of reading from file
    return {
      success: true,
      cookies: sessionResult.cookies,
      localStorage: sessionResult.localStorage,
      userAgent: sessionResult.userAgent
    };
  } catch (error) {
    console.error('Pinterest login error:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

async function scrapePinterest(url, userId = 'default') {
  const startTime = Date.now();
  console.log(`\n⏱️ Starting Pinterest scrape for: ${url}`);
  
  // Convert userId to string if it's a number
  userId = String(userId);
  
  // Session check
  console.log(`Looking for session file: ${sessionManager.getSessionPath(userId)}`);
  const session = sessionManager.getSession(userId);
  
  if (!session) {
    console.log(`No session file found for user ${userId}`);
    return { 
      success: false, 
      error: 'Pinterest login required',
      loginRequired: true  // Add this flag to make it easier to detect
    };
  }
  
  const browserStartTime = Date.now();
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1280, height: 900 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  });
  console.log(`⏱️ Browser launch: ${formatTime(Date.now() - browserStartTime)}`);
  
  try {
    const page = await browser.newPage();
    
    // Set cookies
    await page.setCookie(...session.cookies);
    
    // Set user agent if available
    if (session.userAgent) {
      await page.setUserAgent(session.userAgent);
    }
    
    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      const url = req.url();
      
      if (url.includes('pinimg.com') || // Always allow Pinterest image CDN
          resourceType === 'document' || 
          resourceType === 'xhr') {
        req.continue();
      } else {
        req.abort();
      }
    });
    
    // Skip homepage and navigate directly to the pin
    console.log('📍 Navigating to pin...');
    const pinNavigateTime = Date.now();
    
    // Use domcontentloaded instead of networkidle2 for faster loading
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.loadTimeout 
    });
    console.log(`⏱️ Pin page load: ${formatTime(Date.now() - pinNavigateTime)}`);
    
    // Wait for images to load
    try {
      await page.waitForSelector('img[src*="pinimg.com"]', { timeout: 8080 });
    } catch (error) {
      console.log('Waiting for images timed out, continuing anyway');
    }

    // Scroll to trigger lazy loading
    const scrollStartTime = Date.now();
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await delay(CONFIG.scrollDelay);
    console.log(`⏱️ Scroll operation: ${formatTime(Date.now() - scrollStartTime)}`);
    
    // Simplified image search focusing on what works
    const imageSearchTime = Date.now();
    console.log('🔍 Searching for pin image...');
    
    const imageData = await page.evaluate((config) => {
      // Direct page-wide search since logs show this is always what works
      const allPageImages = Array.from(document.querySelectorAll('img[src*="pinimg.com"]'));
      
      // Filter images
      const validImages = allPageImages
        .filter(img => {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;
          // Allow smaller images, e.g. at least 100×100
          if (width < 100 || height < 100) return false; 
          return true;
        })
        .map(img => ({
          url: img.src,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height
        }))
        // Sort by size (largest first)
        .sort((a, b) => (b.width * b.height) - (a.width * a.height));
      
      return validImages[0] || null;
    }, CONFIG);
    
    console.log(`⏱️ Image search: ${formatTime(Date.now() - imageSearchTime)}`);
    
    if (!imageData) {
      throw new Error('Could not find valid pin image');
    }
    
    console.log('\n✅ Found pin image:');
    console.log(`Dimensions: ${imageData.width}x${imageData.height}`);
    console.log(`URL: ${imageData.url}`);
    
    // Try to enhance to original quality
    let finalUrl = imageData.url;
    let originalQuality = null;
    let enhancedQuality = null;
    let improvement = "0.0%";
    
    // Check if URL contains /736x/ which can be enhanced
    if (imageData.url.includes('/736x/')) {
      console.log('\n✨ Enhanced URL found, verifying quality...');
      const enhancedUrl = imageData.url.replace('/736x/', '/originals/');
      
      // Check both URLs
      [originalQuality, enhancedQuality] = await Promise.all([
        checkImageQuality(imageData.url),
        checkImageQuality(enhancedUrl)
      ]);
      
      if (originalQuality.exists && enhancedQuality.exists) {
        improvement = ((enhancedQuality.size - originalQuality.size) / originalQuality.size * 100).toFixed(1) + '%';
        
        // Use enhanced only if it's actually better
        if (enhancedQuality.size > originalQuality.size) {
          finalUrl = enhancedUrl;
          console.log(`\n✨ Using enhanced URL with ${improvement} improvement`);
        } else {
          console.log(`\n✨ Using original URL (no improvement)`);
        }
      }
    } else {
      // Just check original quality
      originalQuality = await checkImageQuality(imageData.url);
      enhancedQuality = originalQuality;
    }
    
    await browser.close();
    
    console.log(`\n⏱️ Total processing time: ${formatTime(Date.now() - startTime)}`);
    
    return {
      success: true,
      type: 'pinterest',
      mediaUrl: finalUrl,
      contentType: 'image',
      originalUrl: url,
      dimensions: {
        width: imageData.width,
        height: imageData.height
      },
      quality: {
        original: originalQuality,
        enhanced: enhancedQuality,
        improvement: improvement
      },
      performance: {
        totalTime: formatTime(Date.now() - startTime)
      }
    };
    
  } catch (error) {
    console.error('Pinterest Scraper Error:', error);
    console.log(`⏱️ Failed after: ${formatTime(Date.now() - startTime)}`);
    if (browser) await browser.close();
    return { 
      success: false, 
      error: error.message
    };
  }
}

module.exports = { 
  scrapePinterest,
  loginToPinterest  // Added export for the login function
};