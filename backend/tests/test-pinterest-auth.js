const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Helper function for user input
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

// Helper function for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function testPinterestAuth() {
  console.log('🚀 Starting Pinterest Authentication Test');
  
  // Track important responses
  const sessionData = {
    cookies: [],
    userInfo: null,
    apiResponses: []
  };

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 900 }
  });

  try {
    const page = await browser.newPage();
    
    // Monitor network for session data
    await page.setRequestInterception(true);
    
    page.on('request', request => {
      // Log important API calls
      if (request.url().includes('UserSessionResource') || 
          request.url().includes('users/me')) {
        console.log(`\n📡 ${request.method()} ${request.url()}`);
      }
      request.continue();
    });

    page.on('response', async response => {
      const url = response.url();
      if (url.includes('UserSessionResource') || 
          url.includes('users/me')) {
        try {
          const responseData = await response.json();
          sessionData.apiResponses.push({
            url: url,
            data: responseData
          });
          console.log(`✨ Captured API response from: ${url}`);
        } catch (e) {
          console.log(`⚠️ Could not parse response from: ${url}`);
        }
      }
    });

    // Login process
    console.log('\n1️⃣ Navigating to login page...');
    await page.goto('https://www.pinterest.com/login/', {
      waitUntil: 'networkidle2',
      timeout: 60000 // Increased timeout to 60 seconds
    });

    const username = await askQuestion('Enter Pinterest email/username: ');
    const password = await askQuestion('Enter Pinterest password: ');

    console.log('\n2️⃣ Filling login form...');
    await page.type('#email, input[type="email"]', username);
    await page.type('#password, input[type="password"]', password);

    console.log('\n3️⃣ Submitting login...');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }) // Increased timeout
    ]);

    // Wait for user data to load
    await delay(5000); // Increased wait time

    // Collect all cookies
    sessionData.cookies = await page.cookies();

    // Get user info
    sessionData.userInfo = await page.evaluate(() => {
      const userDataScript = document.querySelector('#__PWS_DATA__');
      if (userDataScript) {
        try {
          return JSON.parse(userDataScript.textContent);
        } catch (e) {
          return null;
        }
      }
      return null;
    });

    // Save all collected data
    const sessionFile = path.join(__dirname, '../../data/sessions/pinterest-session.json');
    fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));

    console.log('\n📊 Session Summary:');
    console.log(`• Cookies captured: ${sessionData.cookies.length}`);
    console.log(`• API responses captured: ${sessionData.apiResponses.length}`);
    console.log(`• Session file saved: ${sessionFile}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
    console.log('\n🏁 Test completed');
  }
}

// Run the test
testPinterestAuth().catch(console.error);