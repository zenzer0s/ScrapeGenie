const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

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

// Update the scrapePinterest function to use these helpers
async function scrapePinterest(url, cookies = []) {
  console.log(`Scraping Pinterest URL: ${url}`);
  
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set cookies if provided
    if (cookies && cookies.length > 0) {
      await page.setCookie(...cookies);
    }
    
    // Monitor network requests for image URLs
    await page.setRequestInterception(true);
    const imageUrls = new Set();
    
    page.on('request', request => {
      const url = request.url();
      if (url.includes('pinimg.com')) {
        imageUrls.add(url);
      }
      request.continue();
    });
    
    // Navigate to Pinterest pin
    console.log('📍 Navigating to pin...');
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: CONFIG.loadTimeout 
    });
    
    // Initial scroll to trigger lazy loading
    await scrollToLoadImages(page);
    
    // Try to find the image with retries
    console.log('🔍 Searching for pin image...');
    const imageData = await page.evaluate((config) => {
      function isValidImage(img) {
        // Check if image is from Pinterest
        if (!img.src || !img.src.includes('pinimg.com')) return false;
        
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
    
    // Get additional pin metadata
    const pinData = await page.evaluate(() => {
      return {
        title: document.querySelector('meta[property="og:title"]')?.content || 
               document.title.replace(' | Pinterest', ''),
        description: document.querySelector('meta[property="og:description"]')?.content || '',
        creator: document.querySelector('[data-test-id="pin-creator"]')?.textContent?.trim() || ''
      };
    });
    
    await browser.close();
    
    return {
      success: true,
      type: 'pinterest',
      title: pinData.title,
      description: pinData.description,
      mediaUrl: finalUrl,
      contentType: 'image',
      creator: pinData.creator,
      originalUrl: url,
      dimensions: {
        width: imageData.width,
        height: imageData.height
      },
      quality: {
        original: originalQuality,
        enhanced: enhancedQuality,
        improvement: `${improvement}%`
      }
    };
    
  } catch (error) {
    console.error('Pinterest Scraper Error:', error);
    if (browser) await browser.close();
    return { 
      success: false, 
      error: error.message
    };
  }
}

module.exports = { scrapePinterest };