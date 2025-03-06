const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configuration
const CONFIG = {
  maxRetries: 3,          // Maximum number of retries for finding the image
  retryDelay: 2000,       // Delay between retries in milliseconds
  scrollDelay: 1000,      // Delay after scrolling
  loadTimeout: 30000,     // Page load timeout
  pinSelectors: {
    mainContainer: 'div[data-test-id="pin"]',
    closeupImage: 'div[data-test-id="pin-closeup-image"]',
    visualContent: 'div[data-test-id="visual-content"]',
    pinImage: '.PinImage',
    highResClass: '.hCL.kVc.L4E.MIw.N7A.XiG'
  }
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function testPinterestImageRefined(url, userId = null) {
  console.log('🚀 Starting refined Pinterest image extraction test');
  console.log(`URL: ${url}`);
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable request interception for monitoring
    await page.setRequestInterception(true);
    const imageUrls = new Set();
    
    page.on('request', request => {
      const url = request.url();
      if (url.includes('pinimg.com')) {
        imageUrls.add(url);
      }
      request.continue();
    });
    
    // Navigate to the Pinterest pin
    console.log('📍 Navigating to pin...');
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: CONFIG.loadTimeout 
    });
    
    // Helper function to scroll the page
    async function scrollToLoadImages() {
      console.log('📜 Scrolling to force lazy loading...');
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        window.scrollTo(0, document.body.scrollHeight / 2);
        window.scrollTo(0, document.body.scrollHeight);
        window.scrollTo(0, 0);
      });
      await delay(CONFIG.scrollDelay);
    }
    
    // Helper function to find image in container
    async function findImageInContainer(retry = 0) {
      const imageData = await page.evaluate((selectors) => {
        // Function to get highest resolution image from container
        function getHighestResImage(container) {
          if (!container) return null;
          
          // First try the specific high-res class
          const highResImg = container.querySelector(selectors.highResClass);
          if (highResImg && highResImg.src) {
            return {
              url: highResImg.src,
              width: highResImg.naturalWidth,
              height: highResImg.naturalHeight,
              source: 'high-res-class'
            };
          }
          
          // Get all images in the container
          const images = Array.from(container.querySelectorAll('img'));
          let bestImage = null;
          let maxSize = 0;
          
          images.forEach(img => {
            const width = img.naturalWidth || img.width || 0;
            const height = img.naturalHeight || img.height || 0;
            const size = width * height;
            
            if (size > maxSize && img.src && img.src.includes('pinimg.com')) {
              maxSize = size;
              bestImage = {
                url: img.src,
                width: width,
                height: height,
                source: 'largest-in-container'
              };
            }
          });
          
          return bestImage;
        }
        
        // Try different container selectors in order of specificity
        const containers = [
          document.querySelector(selectors.mainContainer),
          document.querySelector(selectors.closeupImage),
          document.querySelector(selectors.visualContent),
          document.querySelector(selectors.pinImage)
        ];
        
        for (const container of containers) {
          const result = getHighestResImage(container);
          if (result) return result;
        }
        
        return null;
      }, CONFIG.pinSelectors);
      
      if (!imageData && retry < CONFIG.maxRetries) {
        console.log(`⏳ Image not found, retrying (${retry + 1}/${CONFIG.maxRetries})...`);
        await delay(CONFIG.retryDelay);
        await scrollToLoadImages();
        return findImageInContainer(retry + 1);
      }
      
      return imageData;
    }
    
    // Initial scroll to trigger lazy loading
    await scrollToLoadImages();
    
    // Try to find the image
    console.log('🔍 Searching for pin image...');
    const imageData = await findImageInContainer();
    
    if (imageData) {
      console.log('\n✅ Found pin image:');
      console.log(`Source: ${imageData.source}`);
      console.log(`Dimensions: ${imageData.width}x${imageData.height}`);
      console.log(`URL: ${imageData.url}`);
      
      // Try to enhance to original quality
      const enhancedUrl = imageData.url.replace(/\/\d+x\//, '/originals/');
      if (enhancedUrl !== imageData.url) {
        console.log('\n✨ Enhanced URL:');
        console.log(enhancedUrl);
      }
      
      // Highlight the found image on the page
      await page.evaluate((url) => {
        const images = document.querySelectorAll('img');
        for (const img of images) {
          if (img.src === url) {
            img.style.border = '5px solid lime';
            img.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;
          }
        }
      }, imageData.url);
      
      // Take a screenshot with the highlighted image
      await page.screenshot({
        path: path.join(logsDir, 'pinterest-found-image.png'),
        fullPage: false
      });
      
      // Compare with other images found in network requests
      console.log('\n📊 Network requests analysis:');
      const networkUrls = Array.from(imageUrls);
      const originalQuality = networkUrls.filter(url => url.includes('/originals/'));
      const highQuality = networkUrls.filter(url => url.match(/\/1200x\/|\/1080x\/|\/736x\//));
      
      console.log(`Found ${originalQuality.length} original quality images`);
      console.log(`Found ${highQuality.length} high quality images`);
      
      // Save results
      const results = {
        url: url,
        timestamp: new Date().toISOString(),
        foundImage: {
          ...imageData,
          enhancedUrl: enhancedUrl
        },
        networkRequests: {
          originalQuality,
          highQuality
        }
      };
      
      fs.writeFileSync(
        path.join(logsDir, 'pinterest-extraction-results.json'),
        JSON.stringify(results, null, 2)
      );
      
      console.log('\n💾 Results saved to logs/pinterest-extraction-results.json');
      
    } else {
      console.log('❌ Failed to find pin image after all retries');
      
      // Save debug information
      await page.screenshot({
        path: path.join(logsDir, 'pinterest-failed-attempt.png'),
        fullPage: true
      });
      
      const html = await page.content();
      fs.writeFileSync(
        path.join(logsDir, 'pinterest-failed-page.html'),
        html
      );
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await delay(3000);
    await browser.close();
    console.log('\n🏁 Test completed');
  }
}

// Get URL from command line or use default
const pinUrl = process.argv[2] || 'https://pin.it/4sfVd8liP';
const userId = process.argv[3];

// Run the test
testPinterestImageRefined(pinUrl, userId)
  .catch(console.error);