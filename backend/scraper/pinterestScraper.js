const puppeteer = require('puppeteer');
const sessionManager = require('../services/sessionManager');

// Helper function to delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get a browser instance
 */
async function getBrowser() {
  return await puppeteer.launch({
    headless: "new", // Use new headless mode
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1280,800'
    ],
    ignoreHTTPSErrors: true
  });
}

/**
 * Scrape Pinterest content using authenticated session
 * @param {string} url - Pinterest URL to scrape
 * @param {Array} cookies - Session cookies for authentication
 * @returns {Promise<Object>} - Extracted content data
 */
async function scrapePinterest(url, cookies = []) {
  if (!url.includes('pinterest.com') && !url.includes('pin.it')) {
    return { 
      success: false, 
      error: "Invalid Pinterest URL" 
    };
  }

  let browser = null;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    
    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/96.0.4664.110 Safari/537.36'
    );
    
    // Set cookies if provided (for authenticated session)
    if (cookies && cookies.length > 0) {
      console.log(`Setting ${cookies.length} Pinterest cookies for authenticated session`);
      await page.setCookie(...cookies);
    } else {
      console.log('No cookies provided, using guest session');
    }
    
    // Expand shortened URLs (e.g., pin.it links)
    if (url.includes('pin.it')) {
      console.log('Expanding shortened Pinterest URL');
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await delay(2000); // Wait a bit for redirects
      url = await page.url(); // Get the expanded URL after redirect
      console.log(`Expanded URL: ${url}`);
    }
    
    // Navigate to the Pinterest pin
    console.log(`Navigating to Pinterest URL: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    
    // Check if we're logged in by looking for specific elements
    const isLoggedIn = await page.evaluate(() => {
      // Multiple checks for login status to improve reliability
      const notLoginPage = !document.querySelector('div[data-test-id="login"]');
      const hasUserMenu = !!document.querySelector('button[data-test-id="user-menu"]');
      const hasHeaderProfile = !!document.querySelector('div[data-test-id="header-profile"]');
      const hasUserHome = !!document.querySelector('div[data-test-id="user-home"]');
      
      return notLoginPage && (hasUserMenu || hasHeaderProfile || hasUserHome);
    });
    
    console.log(`Pinterest scraper logged in status: ${isLoggedIn}`);
    
    // Take screenshot for debugging (remove in production)
    // await page.screenshot({ path: 'pinterest-page.png' });
    
    // Extract the pin data with improved selectors
    const pinData = await page.evaluate(() => {
      // Helper to get meta content with fallbacks
      const getMetaContent = (properties) => {
        for (const property of properties) {
          const meta = document.querySelector(`meta[property="${property}"]`);
          if (meta && meta.getAttribute('content')) {
            return meta.getAttribute('content');
          }
        }
        return null;
      };
      
      // Get basic pin information with fallbacks
      const title = getMetaContent(['og:title', 'twitter:title']) || 
                   document.title.replace(' | Pinterest', '') || 
                   'Pinterest Pin';
                   
      const description = getMetaContent(['og:description', 'twitter:description', 'description']) || '';
      
      // Get image with multiple fallback methods
      let imageUrl = getMetaContent(['og:image', 'twitter:image']);
      
      if (!imageUrl) {
        // Fallback 1: Look for the main pin image
        const mainImage = document.querySelector('div[data-test-id="pin-closeup"] img');
        if (mainImage && mainImage.src) {
          imageUrl = mainImage.src;
        } else {
          // Fallback 2: Look for any large image in the pin container
          const images = Array.from(document.querySelectorAll('div[data-test-id="pin-closeup"] img'));
          if (images.length > 0) {
            // Sort by size and get the largest
            const largestImage = images.sort((a, b) => {
              const aWidth = a.naturalWidth || a.width || 0;
              const bWidth = b.naturalWidth || b.width || 0;
              return bWidth - aWidth;
            })[0];
            
            if (largestImage) {
              imageUrl = largestImage.src;
            }
          }
        }
      }
      
      // For videos, check multiple possible video elements
      let videoUrl = null;
      
      // Method 1: Direct video element
      const videoElement = document.querySelector('video');
      if (videoElement && videoElement.src) {
        videoUrl = videoElement.src;
      }
      
      // Method 2: Source element inside video
      if (!videoUrl) {
        const videoSource = document.querySelector('video source');
        if (videoSource && videoSource.src) {
          videoUrl = videoSource.src;
        }
      }
      
      // Method 3: Video in data attributes
      if (!videoUrl) {
        const elements = Array.from(document.querySelectorAll('[data-video-id]'));
        for (const element of elements) {
          // Check data attributes for video URL
          for (const attr of element.attributes) {
            if (attr.name.startsWith('data-') && attr.value.includes('.mp4')) {
              videoUrl = attr.value;
              break;
            }
          }
          if (videoUrl) break;
        }
      }
      
      // Determine if it's a video pin using multiple indicators
      const isVideo = 
        !!videoUrl || 
        !!document.querySelector('[data-test-id="PinTypeVideo"]') || 
        !!document.querySelector('[data-test-id="VideoPlayer"]') ||
        !!document.querySelector('div[data-test-id="story-pin-closeup"]');
      
      // Get pin creator with multiple fallbacks
      let creator = '';
      const creatorSelectors = [
        '[data-test-id="pin-creator"]',
        '[data-test-id="PinUserInfo"]',
        '[data-test-id="creator-profile-name"]',
        'a[href*="/follow/"]'
      ];
      
      for (const selector of creatorSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          creator = element.textContent.trim();
          break;
        }
      }
      
      return {
        title,
        description,
        imageUrl,
        videoUrl,
        isVideo,
        creator
      };
    });
    
    // Determine the content type and return appropriate result
    const contentType = pinData.isVideo ? 'video' : 'image';
    const mediaUrl = pinData.videoUrl || pinData.imageUrl;
    
    await browser.close();
    
    // Return error if no media URL was found
    if (!mediaUrl) {
      return {
        success: false,
        error: "Could not extract media URL from this Pinterest pin",
        requiresAuthentication: !isLoggedIn
      };
    }
    
    return {
      success: true,
      type: 'pinterest',
      title: pinData.title || 'Pinterest Pin',
      description: pinData.description || '',
      mediaUrl: mediaUrl,
      contentType: contentType,
      creator: pinData.creator || '',
      originalUrl: url,
      isAuthenticated: isLoggedIn
    };
  } catch (error) {
    console.error("Pinterest Scraper Error:", error);
    if (browser) await browser.close();
    return { 
      success: false, 
      error: "Failed to fetch Pinterest content: " + error.message
    };
  }
}

/**
 * Login to Pinterest and get session cookies
 * @param {string} username - Pinterest username/email
 * @param {string} password - Pinterest password
 * @returns {Promise<Object>} - Session cookies or error
 */
async function loginToPinterest(username, password) {
  let browser = null;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    console.log("Opening Pinterest login page...");
    
    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/96.0.4664.110 Safari/537.36'
    );
    
    // Navigate directly to Pinterest's official login page
    await page.goto('https://www.pinterest.com/login/', { 
      waitUntil: 'networkidle2',
      timeout: 60000 // Increased timeout to 60s
    });
    
    console.log("Pinterest login page loaded");
    
    // Wait for the login form to be visible
    await page.waitForSelector('input[id="email"], input[type="email"]', { visible: true, timeout: 10000 });
    console.log("Login form found");
    
    // Find appropriate email/username field using multiple possible selectors
    const emailSelectors = [
      'input[id="email"]', 
      'input[type="email"]', 
      'input[name="id"]'
    ];
    
    let emailField = null;
    for (const selector of emailSelectors) {
      emailField = await page.$(selector);
      if (emailField) {
        console.log(`Found email field with selector: ${selector}`);
        break;
      }
    }
    
    if (!emailField) {
      throw new Error("Email input field not found on Pinterest login page");
    }
    
    // Type username/email
    await emailField.click({ clickCount: 3 }); // Select all text in field
    await emailField.type(username);
    console.log("Email entered");
    
    // Find and fill password field
    const passwordSelectors = [
      'input[id="password"]', 
      'input[type="password"]', 
      'input[name="password"]'
    ];
    
    let passwordField = null;
    for (const selector of passwordSelectors) {
      passwordField = await page.$(selector);
      if (passwordField) {
        console.log(`Found password field with selector: ${selector}`);
        break;
      }
    }
    
    if (!passwordField) {
      throw new Error("Password input field not found on Pinterest login page");
    }
    
    // Type password
    await passwordField.click({ clickCount: 3 }); // Select all text in field
    await passwordField.type(password);
    console.log("Password entered");
    
    // Find and click the login button
    const loginButtonSelectors = [
      'button[type="submit"]',
      'button.SignupButton',
      'button[data-test-id="registerFormSubmitButton"]',
      'button.red'
    ];
    
    let loginButton = null;
    for (const selector of loginButtonSelectors) {
      loginButton = await page.$(selector);
      if (loginButton) {
        console.log(`Found login button with selector: ${selector}`);
        break;
      }
    }
    
    if (!loginButton) {
      throw new Error("Login button not found on Pinterest login page");
    }
    
    // Click login button and wait for navigation
    console.log("Clicking login button...");
    await Promise.all([
      loginButton.click(),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
    ]);
    console.log("Login button clicked and navigation completed");
    
    // Check for login errors
    const errorSelectors = [
      'div[data-test-id="login-error"]',
      'div.errorMessage',
      'div.error'
    ];
    
    for (const selector of errorSelectors) {
      const errorElement = await page.$(selector);
      if (errorElement) {
        const errorText = await page.evaluate(el => el.textContent, errorElement);
        await browser.close();
        return { 
          success: false, 
          error: `Pinterest login failed: ${errorText.trim()}` 
        };
      }
    }
    
    // Check if login was successful by looking for dashboard elements
    const loginSuccessSelectors = [
      'div[data-test-id="header-profile"]',
      'div[data-test-id="user-home"]',
      'button[data-test-id="user-menu"]',
      'div.UserProfileHeader'
    ];
    
    let isLoggedIn = false;
    for (const selector of loginSuccessSelectors) {
      const element = await page.$(selector);
      if (element) {
        isLoggedIn = true;
        console.log(`Login confirmed with selector: ${selector}`);
        break;
      }
    }
    
    if (!isLoggedIn) {
      // Additional check - absence of login form
      const loginFormPresent = await page.$('input[id="email"]');
      isLoggedIn = !loginFormPresent;
    }
    
    if (!isLoggedIn) {
      await browser.close();
      return { 
        success: false, 
        error: "Login process completed but couldn't confirm successful login" 
      };
    }
    
    console.log("Login successful, extracting cookies...");
    
    // Get the cookies for future authenticated requests
    const cookies = await page.cookies();
    
    // Take a screenshot for debugging (you can remove this in production)
    // await page.screenshot({ path: 'login-success.png' });
    
    // Check if we have the essential Pinterest cookies
    const hasCsrfToken = cookies.some(cookie => cookie.name === 'csrftoken');
    const hasSessionId = cookies.some(cookie => cookie.name === '_auth' || cookie.name === '_pinterest_sess');
    
    if (!hasCsrfToken || !hasSessionId) {
      console.warn("Warning: Some essential Pinterest cookies are missing");
    }
    
    await browser.close();
    return { 
      success: true, 
      cookies,
      message: "Successfully logged in to Pinterest"
    };
  } catch (error) {
    console.error("Pinterest Login Error:", error);
    if (browser) await browser.close();
    return { 
      success: false, 
      error: `Login process failed: ${error.message}` 
    };
  }
}

module.exports = { scrapePinterest, loginToPinterest };