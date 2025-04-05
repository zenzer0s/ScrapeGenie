const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function promptCredentials() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));
  
  const email = await question('Enter Pinterest email: ');
  const password = await question('Enter Pinterest password: ');
  
  rl.close();
  return { email, password };
}

async function captureAuthSession(email, password, outputPath = 'data/session.json', headless = true) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      defaultViewport: { width: 1280, height: 800 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    const page = await browser.newPage();
    
    // Block non-essential resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['document', 'xhr', 'fetch', 'script'].includes(resourceType) || 
          req.url().includes('pinterest.com')) {
        req.continue();
      } else {
        req.abort();
      }
    });

    // Navigate to Pinterest login page
    await page.goto('https://www.pinterest.com/login/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Fill login form
    await page.waitForSelector('#email', { visible: true });
    await page.type('#email', email);
    await page.type('#password', password);
    
    // Submit login
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
      return { 
        success: false, 
        error: 'Invalid credentials. Please check your email and password.'
      };
    }
    
    // Wait briefly for session to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Capture session data
    const cookies = await page.cookies();
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
      cookies,
      localStorage,
      userAgent: await page.evaluate(() => navigator.userAgent),
      capturedAt: new Date().toISOString()
    };
    
    // Ensure directory exists and save session
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(sessionData, null, 2));
    
    return {
      success: true,
      ...sessionData
    };
  } catch (error) {
    return {
      success: false,
      error: `Login failed: ${error.message}`
    };
  } finally {
    if (browser) await browser.close();
  }
}

// Run as standalone script
if (require.main === module) {
  (async () => {
    try {
      const { email, password } = await promptCredentials();
      const outputPath = process.argv[2] || 'data/session.json';
      
      const result = await captureAuthSession(email, password, outputPath);
      
      if (result.success) {
        console.log('✅ Authentication completed successfully');
        console.log(`Session data saved to: ${outputPath}`);
      } else {
        console.log('❌ Authentication failed: ' + result.error);
        process.exit(1);
      }
    } catch (err) {
      console.error('❌ Fatal error:', err.message);
      process.exit(1);
    }
  })();
}

module.exports = { captureAuthSession, promptCredentials };