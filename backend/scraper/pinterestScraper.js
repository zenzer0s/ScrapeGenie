const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { captureAuthSession } = require('../utils/pinterest-auth'); // Import the captureAuthSession function
const sessionManager = require('../services/sessionManager'); // Import the sessionManager

// Configuration for Pinterest scraping
const CONFIG = {
  maxRetries: 3,
  retryDelay: 2000,
  scrollDelay: 1000,
  loadTimeout: 30000,
  minImageSize: {
    width: 500,  // Minimum width to consider
    height: 500  // Minimum height to consider
  },
  pinSelectors: {
    mainContainer: 'div[data-test-id="pin"]',
    closeupImage: 'div[data-test-id="pin-closeup-image"]',
    visualContent: 'div[data-test-id="visual-content"]',
    pinImage: '.PinImage',
    highResClass: '.hCL.kVc.L4E.MIw.N7A.XiG'
  }
};

// Helper function for delays
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Add scrollToLoadImages helper function
async function scrollToLoadImages(page) {
  console.log('📜 Scrolling to force lazy loading...');
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    window.scrollTo(0, document.body.scrollHeight / 2);
    window.scrollTo(0, document.body.scrollHeight);
    window.scrollTo(0, 0);
  });
  await delay(CONFIG.scrollDelay);
}

// Add this helper function at the top of the file, after the other helper functions
const formatTime = ms => (ms / 1000).toFixed(2) + 's';

// Update the quality check function to handle errors better
async function checkImageQuality(url) {
  try {
    console.log(`Checking quality for: ${url}`);
    const response = await axios.head(url, {
      timeout: 5000,
      validateStatus: (status) => status < 400 // Accept any success status
    });
    
    const contentLength = parseInt(response.headers['content-length'] || '0');
    const contentType = response.headers['content-type'];
    
    if (!contentLength || !contentType) {
      console.log(`⚠️ Warning: Invalid response for ${url}`);
      console.log('Headers:', response.headers);
      return {
        exists: false,
        error: 'Invalid response headers'
      };
    }
    
    return {
      exists: true,
      size: contentLength,
      type: contentType,
      sizeInMB: (contentLength / 1024 / 1024).toFixed(2)
    };
  } catch (error) {
    console.log(`⚠️ Error checking ${url}: ${error.message}`);
    return {
      exists: false,
      error: error.message
    };
  }
}

// Update the scrapePinterest function to use the session correctly
async function scrapePinterest(url, userId) {
  // Start timing
  const startTime = Date.now();
  console.log(`\n⏱️ Starting Pinterest scrape for: ${url}`);
  
  // Ensure userId is a string
  if (typeof userId !== 'string') {
    console.error('Invalid userId:', userId);
    return { 
      success: false, 
      error: 'Invalid userId. Please provide a valid userId.' 
    };
  }

  // Get session from session manager
  const session = sessionManager.getSession(userId);
  
  if (!session || !session.cookies || session.cookies.length === 0) {
    return { 
      success: false, 
      error: 'No valid session found. Please log in to Pinterest first.' 
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
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-extensions-with-background-pages',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-renderer-backgrounding'
    ]
  });
  console.log(`⏱️ Browser launch: ${formatTime(Date.now() - browserStartTime)}`);
  
  try {
    const pageStartTime = Date.now();
    const page = await browser.newPage();
    
    // Set cookies
    await page.setCookie(...session.cookies);
    
    // Set user agent if available
    if (session.userAgent) {
      await page.setUserAgent(session.userAgent);
    }
    
    // Navigate to Pinterest first to set localStorage
    const loginStartTime = Date.now();
    await page.goto('https://www.pinterest.com', { waitUntil: 'domcontentloaded' });
    console.log(`⏱️ Pinterest homepage load: ${formatTime(Date.now() - loginStartTime)}`);
    
    // Set localStorage if available
    if (session.localStorage) {
      await page.evaluate((storageData) => {
        for (const [key, value] of Object.entries(storageData)) {
          localStorage.setItem(key, value);
        }
      }, session.localStorage);
    }
    
    // Navigate to the Pinterest pin URL
    console.log('📍 Navigating to pin...');
    const pinNavigateTime = Date.now();
    await page.goto(url, { 
      waitUntil: 'networkidle2', // Change from 'domcontentloaded' to 'networkidle2'
      timeout: CONFIG.loadTimeout 
    });
    console.log(`⏱️ Pin page load: ${formatTime(Date.now() - pinNavigateTime)}`);
    
    // Wait for specific Pinterest elements to load
    // Add this after navigation
    try {
      await page.waitForSelector('img[srcset]', { timeout: 5000 });
    } catch (error) {
      console.log('Waiting for images timed out, continuing anyway');
    }

    // Modify the request interception to be less aggressive
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      const url = req.url();
      
      if (url.includes('pinimg.com') || // Always allow Pinterest image CDN
          resourceType === 'document' || 
          resourceType === 'xhr' || 
          resourceType === 'fetch' ||
          resourceType === 'script' || // Allow scripts to run
          resourceType === 'image') {
        req.continue();
      } else {
        // Block only non-essential resources
        req.abort();
      }
    });

    // Initial scroll to trigger lazy loading
    const scrollStartTime = Date.now();
    await scrollToLoadImages(page);
    console.log(`⏱️ Scroll operation: ${formatTime(Date.now() - scrollStartTime)}`);
    
    // Try to find the image with retries
    const imageSearchTime = Date.now();
    console.log('🔍 Searching for pin image...');
    const imageData = await page.evaluate((config) => {
      function isValidImage(img) {
        // Check if image is from Pinterest
        if (!img.src || !img.src.includes('pinimg.com')) return false;
        
        // Exclude video thumbnails
        if (img.src.includes('/videos/thumbnails/')) return false;
        
        // Get dimensions
        const width = img.naturalWidth || img.width || 0;
        const height = img.naturalHeight || img.height || 0;
        
        // Filter out small images and icons
        if (width < config.minImageSize.width || height < config.minImageSize.height) return false;
        
        // Filter out thumbnail directories
        if (img.src.includes('/236x/') || img.src.includes('/75x/')) return false;
        
        return true;
      }

      function getHighestResImage(container) {
        if (!container) return null;
        
        // Try high-res class first
        const highResImg = container.querySelector(config.pinSelectors.highResClass);
        if (highResImg && highResImg.src && isValidImage(highResImg)) {
          return {
            url: highResImg.src,
            width: highResImg.naturalWidth,
            height: highResImg.naturalHeight,
            source: 'high-res-class'
          };
        }
        
        // Get all valid images from container
        const images = Array.from(container.querySelectorAll('img'))
          .filter(isValidImage)
          .map(img => ({
            url: img.src,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            source: 'container-image'
          }))
          .sort((a, b) => (b.width * b.height) - (a.width * a.height));
        
        return images[0] || null;
      }
      
      // Try containers in priority order
      const containers = [
        document.querySelector(config.pinSelectors.closeupImage),
        document.querySelector(config.pinSelectors.mainContainer),
        document.querySelector(config.pinSelectors.visualContent),
        document.querySelector(config.pinSelectors.pinImage)
      ];
      
      for (const container of containers) {
        const result = getHighestResImage(container);
        if (result) return result;
      }
      
      // If no valid image found in containers, try page-wide search
      const allImages = Array.from(document.querySelectorAll('img'))
        .filter(isValidImage)
        .map(img => ({
          url: img.src,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          source: 'page-wide'
        }))
        .sort((a, b) => (b.width * b.height) - (a.width * a.height));
      
      return allImages[0] || null;
    }, CONFIG);
    console.log(`⏱️ Image search: ${formatTime(Date.now() - imageSearchTime)}`);
    
    if (!imageData) {
      throw new Error('Could not find valid pin image');
    }
    
    console.log('\n✅ Found pin image:');
    console.log(`Source: ${imageData.source}`);
    console.log(`Dimensions: ${imageData.width}x${imageData.height}`);
    console.log(`URL: ${imageData.url}`);
    
    // Try to enhance to original quality and verify
    const enhancedUrl = imageData.url.replace(/\/\d+x\//, '/originals/');
    
    console.log('\n✨ Enhanced URL found, verifying quality...');
    
    // Check both URLs with proper error handling
    const [originalQuality, enhancedQuality] = await Promise.all([
      checkImageQuality(imageData.url),
      checkImageQuality(enhancedUrl)
    ]);
    
    console.log('\n📊 Quality verification:');
    
    if (!originalQuality.exists) {
      console.log('⚠️ Original URL check failed:', originalQuality.error);
      return {
        success: false,
        error: 'Could not verify original image quality'
      };
    }
    
    console.log(`Original: ${originalQuality.sizeInMB} MB`);
    
    if (!enhancedQuality.exists) {
      console.log('⚠️ Enhanced URL not accessible, using original');
      return {
        success: true,
        mediaUrl: imageData.url,
        quality: {
          original: originalQuality,
          enhanced: null,
          improvement: '0%'
        },
        // ... rest of the return object
      };
    }
    
    console.log(`Enhanced: ${enhancedQuality.sizeInMB} MB`);
    
    const improvement = ((enhancedQuality.size - originalQuality.size) / originalQuality.size * 100).toFixed(1);
    console.log(`Improvement: ${improvement}%`);
    
    // Use enhanced only if it's actually better
    const finalUrl = (improvement > 0) ? enhancedUrl : imageData.url;
    console.log(`\n✨ Using ${improvement > 0 ? 'enhanced' : 'original'} URL`);
    
    await browser.close();
    
    // Add final timing log before returning
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
        improvement: `${improvement}%`
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

async function loginToPinterest(username, password) {
  try {
    // Create a temporary session file path
    const tempSessionPath = path.join(__dirname, '..', '..', 'data', 'temp_session.json');
    
    // Use your existing auth function
    const success = await captureAuthSession(username, password, tempSessionPath);
    
    if (!success) {
      return { 
        success: false, 
        error: 'Authentication failed' 
      };
    }
    
    // Read the session data
    const sessionData = JSON.parse(fs.readFileSync(tempSessionPath, 'utf8'));
    
    // Return in the format expected by auth.js
    return {
      success: true,
      cookies: sessionData.cookies,
      localStorage: sessionData.localStorage,
      userAgent: sessionData.userAgent
    };
  } catch (error) {
    console.error('Pinterest login error:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

async function simplifiedScrapePinterest(url) {
    console.log(`Pinterest placeholder scraping for: ${url}`);
    return {
        success: false,
        error: 'This is a simplified placeholder implementation',
        url: url
    };
}

module.exports = { 
  scrapePinterest,
  loginToPinterest,
  simplifiedScrapePinterest
};