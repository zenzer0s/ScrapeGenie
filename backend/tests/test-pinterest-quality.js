const { scrapePinterest } = require('../scraper/pinterestScraper');
const axios = require('axios');

// Add quality check function
async function checkImageQuality(url) {
  try {
    const response = await axios.head(url);
    const contentLength = parseInt(response.headers['content-length'] || '0');
    const contentType = response.headers['content-type'];
    
    return {
      exists: true,
      size: contentLength,
      type: contentType,
      sizeInMB: (contentLength / 1024 / 1024).toFixed(2)
    };
  } catch (error) {
    return {
      exists: false,
      error: error.message
    };
  }
}

async function testImageQuality(url) {
  console.log('🚀 Testing Pinterest image quality');
  console.log(`URL: ${url}\n`);
  
  try {
    const result = await scrapePinterest(url);
    
    if (result.success) {
      // Original URL quality check
      const originalUrl = result.mediaUrl.replace('/originals/', '/736x/');
      console.log('Checking original quality URL...');
      const originalQuality = await checkImageQuality(originalUrl);
      
      // Enhanced URL quality check
      console.log('Checking enhanced quality URL...');
      const enhancedQuality = await checkImageQuality(result.mediaUrl);
      
      console.log('\n📊 Quality Test Results:');
      console.log('------------------------');
      
      if (originalQuality.exists) {
        console.log(`Original URL (${originalQuality.type}):`);
        console.log(`Size: ${originalQuality.sizeInMB} MB`);
      } else {
        console.log('⚠️ Original URL not accessible');
      }
      
      if (enhancedQuality.exists) {
        console.log(`\nEnhanced URL (${enhancedQuality.type}):`);
        console.log(`Size: ${enhancedQuality.sizeInMB} MB`);
        
        if (originalQuality.exists) {
          const improvement = ((enhancedQuality.size - originalQuality.size) / originalQuality.size * 100).toFixed(1);
          console.log(`\nQuality Improvement: ${improvement}%`);
        }
      } else {
        console.log('⚠️ Enhanced URL not accessible');
      }
      
      // Print final URL being used
      console.log('\n✨ Final URL:');
      console.log(result.mediaUrl);
      
    } else {
      console.log('❌ Failed to scrape Pinterest image');
      console.log(result.error);
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Get URL from command line or use default
const pinUrl = process.argv[2] || 'https://pin.it/4sfVd8liP';

// Run the test
testImageQuality(pinUrl)
  .catch(console.error)
  .finally(() => process.exit());