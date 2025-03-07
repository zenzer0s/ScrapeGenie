const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Creates an interface to prompt for user input
 * @returns {Promise<{email: string, password: string}>} User credentials
 */
async function promptCredentials() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));
  
  console.log('=== Pinterest Authentication Tool ===');
  const email = await question('Enter Pinterest email: ');
  const password = await question('Enter Pinterest password: ');
  
  rl.close();
  return { email, password };
}

/**
 * Logs into Pinterest and saves session data with focused logging
 * @param {string} email - Pinterest login email
 * @param {string} password - Pinterest login password
 * @param {string} outputPath - Path to save the session data (default: 'data/session.json')
 * @param {boolean} headless - Whether to run the browser in headless mode (default: false)
 */
async function captureAuthSession(email, password, outputPath = 'data/session.json', headless = true) {
  const log = (message, type = 'info') => {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '📘 INFO',
      warn: '🟡 WARNING',
      error: '🔴 ERROR',
      success: '✅ SUCCESS',
      debug: '🔍 DEBUG'
    }[type] || '📘 INFO';
    
    console.log(`[${timestamp}] ${prefix}: ${message}`);
  };

  log('Starting Pinterest authentication process...', 'info');
  
  // Launch browser with optimized settings
  const browser = await puppeteer.launch({
    headless: "new", // Use the new headless mode for better performance
    defaultViewport: { width: 1280, height: 800 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-breakpad',
      '--disable-component-extensions-with-background-pages',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-renderer-backgrounding',
      '--disable-notifications'
    ]
  });

  const page = await browser.newPage();
  
  // Block unnecessary resources
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const resourceType = req.resourceType();
    // Only allow essential resources
    if (['document', 'xhr', 'fetch', 'script'].includes(resourceType) || 
        req.url().includes('pinterest.com')) {
      req.continue();
    } else {
      req.abort();
    }
  });

  try {
    // Navigate to Pinterest login page
    log('Navigating to Pinterest login page...', 'info');
    await page.goto('https://www.pinterest.com/login/', {
      waitUntil: 'networkidle2',
      timeout: 30000 // Reduce timeout
    });

    // Fill login form
    log('Entering login credentials...', 'info');
    await page.waitForSelector('#email', { visible: true });
    await page.type('#email', email);
    await page.type('#password', password);
    
    // Click login button
    log('Submitting login...', 'info');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
    ]);

    // Check for login errors
    const loginFailed = await page.evaluate(() => {
      return document.body.innerText.includes('The password you entered is incorrect') ||
             document.body.innerText.includes('Email not found') ||
             document.body.innerText.includes('Hmm...that password isn\'t right');
    });

    if (loginFailed) {
      log('Login failed. Please check your credentials.', 'error');
      await browser.close();
      return { 
        success: false, 
        error: 'Invalid credentials. Please check your email and password.'
      };
    }

    log('Login successful!', 'success');
    
    // Check for two-factor authentication
    const possibleTwoFactorSelectors = [
      'input[placeholder*="code"]', 
      'input[aria-label*="code"]',
      'input[type="tel"]'
    ];
    
    for (const selector of possibleTwoFactorSelectors) {
      const hasTwoFactor = await page.$(selector) !== null;
      if (hasTwoFactor) {
        log('Two-factor authentication detected. Manual intervention required.', 'warn');
        
        // Prompt for verification code
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const code = await new Promise(resolve => {
          rl.question('Enter verification code: ', resolve);
        });
        
        rl.close();
        
        // Enter the code
        await page.type(selector, code, { delay: 50 });
        
        // Look for submit button
        const submitButtons = await page.$$('button[type="submit"]');
        if (submitButtons.length > 0) {
          await submitButtons[0].click();
          
          // Wait for navigation
          await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
        }
        
        break;
      }
    }
    
    // Wait for the session data to stabilize (shorter wait time)
    log('Capturing session data...', 'info');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Extract cookies and other session data
    const cookies = await page.cookies();
    log(`Captured ${cookies.length} cookies`, 'success');
    
    // Get localStorage data
    const localStorage = await page.evaluate(() => {
      let data = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          data[key] = localStorage.getItem(key);
        }
        return data;
      } catch (e) {
        return { error: e.toString() };
      }
    });
    
    // Create session object
    const sessionData = {
      cookies: cookies,
      localStorage: localStorage,
      userAgent: await page.evaluate(() => navigator.userAgent),
      capturedAt: new Date().toISOString()
    };
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Save session to file
    log(`Saving session data to ${outputPath}...`, 'info');
    fs.writeFileSync(outputPath, JSON.stringify(sessionData, null, 2));
    log(`Session data saved successfully!`, 'success');
    
    return true;
  } catch (error) {
    log(`Error during authentication process: ${error.message}`, 'error');
    await browser.close();
    return {
      success: false,
      error: `Login failed: ${error.message}`
    };
  } finally {
    await browser.close();
    log('Browser closed', 'debug');
  }
}

// Run as standalone script
if (require.main === module) {
  (async () => {
    try {
      const { email, password } = await promptCredentials();
      const outputPath = process.argv[2] || 'data/session.json';
      
      console.log('\nStarting authentication process...');
      const success = await captureAuthSession(email, password, outputPath);
      
      if (success) {
        console.log('\n✅ Authentication completed successfully');
        console.log(`Session data saved to: ${outputPath}`);
      } else {
        console.log('\n❌ Authentication failed');
        process.exit(1);
      }
    } catch (err) {
      console.error('\n❌ Fatal error:', err);
      process.exit(1);
    }
  })();
}

module.exports = { captureAuthSession, promptCredentials };