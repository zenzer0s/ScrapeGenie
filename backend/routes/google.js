const express = require('express');
const router = express.Router();
const scraperBridge = require('../../google/integration/scraperSheetsBridge');
const { GOOGLE_CONFIG } = require('../../google/config/config');
const authHandler = require('../../google/auth/authHandler');
const sheetsIntegration = require('../../google/integration/sheetsIntegration');
const tokenStorage = require('../../google/storage/tokenStorage');
const sheetsManager = require('../../google/sheets/sheetsManager');

// Add this simple endpoint
router.get('/sheet-data', async (req, res) => {
  try {
    const { chatId, page = 1, pageSize = 5 } = req.query;
    
    if (!chatId) {
      return res.status(400).json({ error: 'Chat ID required' });
    }
    
    console.log(`Getting sheet data for chatId: ${chatId}, page: ${page}, pageSize: ${pageSize}`);
    
    // Check if user is connected
    const isConnected = await sheetsIntegration.checkConnection(chatId);
    
    if (!isConnected) {
      return res.status(401).json({ error: 'User not connected to Google Sheets' });
    }
    
    console.log('User is connected to Google Sheets');
    
    // Get user data and authenticate
    const userData = await tokenStorage.getTokens(chatId);
    
    if (!userData || !userData.tokens) {
      console.error('No tokens found for user', chatId);
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!userData.spreadsheetId) {
      console.error('No spreadsheet ID found for user', chatId);
      return res.status(404).json({ error: 'Spreadsheet not found' });
    }
    
    console.log(`Using spreadsheet ID: ${userData.spreadsheetId}`);
    
    // Set up authentication
    authHandler.setCredentials(userData.tokens);
    const authClient = authHandler.getAuthClient();
    
    // Initialize sheets with auth client
    sheetsManager.initializeSheets(authClient);
    
    // Get spreadsheet data
    const sheetData = await sheetsManager.getSpreadsheetData(userData.spreadsheetId);
    
    // Format the data as entries
    const entries = sheetData.map(row => ({
      title: row[0] || 'Untitled',
      url: row[1] || 'No URL',
      description: row[2] || 'No description',
      dateAdded: row[3] || new Date().toISOString()
    }));
    
    // Handle pagination
    const totalEntries = entries.length;
    const totalPages = Math.ceil(totalEntries / pageSize) || 1;
    const currentPage = Math.min(parseInt(page), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedEntries = entries.slice(startIndex, startIndex + parseInt(pageSize));
    
    console.log(`Retrieved ${totalEntries} entries, returning page ${currentPage} with ${paginatedEntries.length} items`);
    
    res.json({
      entries: paginatedEntries,
      totalEntries,
      totalPages,
      currentPage
    });
  } catch (error) {
    console.error('Error getting sheet data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Make sure these other routes still work
router.get('/auth-url', async (req, res) => {
  try {
    const { chatId } = req.query;
    if (!chatId) {
      return res.status(400).json({ error: 'Chat ID required' });
    }
    
    // Generate state with chatId for callback
    const state = Buffer.from(chatId).toString('base64');
    const authUrl = authHandler.generateAuthUrl(state);
    
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/auth/google', (req, res) => {
  const authUrl = authHandler.generateAuthUrl();
  res.redirect(authUrl);
});

router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      console.error('[CALLBACK] Missing code parameter');
      throw new Error('Authorization code is missing');
    }
    
    console.log('[CALLBACK] Received authorization code');
    
    // Decode state to get chatId
    const chatId = Buffer.from(state, 'base64').toString();
    console.log(`[CALLBACK] Decoded chatId: ${chatId}`);
    
    // Get tokens
    const tokens = await authHandler.getTokens(code);
    console.log('[CALLBACK] Retrieved tokens successfully');
    
    // Setup user's sheet
    const setupResult = await sheetsIntegration.setupUserSheet(chatId, tokens);
    console.log(`[CALLBACK] Sheet setup complete: ${setupResult.spreadsheetId}`);
    
    // Success message
    res.send(`
      <html>
        <body>
          <h1>Google Sheets connected successfully!</h1>
          <p>You can now close this window and return to the Telegram bot.</p>
          <script>setTimeout(() => window.close(), 5000)</script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('[CALLBACK] Error:', error);
    res.status(500).send(`
      <html>
        <body>
          <h1>Connection failed</h1>
          <p>Error: ${error.message}</p>
          <p>Please try again in the Telegram bot.</p>
        </body>
      </html>
    `);
  }
});

router.get('/status', async (req, res) => {
  try {
    const { chatId } = req.query;
    if (!chatId) {
      return res.status(400).json({ error: 'Chat ID required' });
    }
    
    // Check if user has connected Google Sheets
    // In production, you would check a database
    // For now, we'll return a mock response
    const isConnected = await sheetsIntegration.checkConnection(chatId);
    
    res.json({ isConnected });
  } catch (error) {
    console.error('Error checking status:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/disconnect', async (req, res) => {
  try {
    const { chatId } = req.body;
    
    if (!chatId) {
      return res.status(400).json({ error: 'Chat ID required' });
    }
    
    const success = await sheetsIntegration.disconnectUser(chatId);
    
    res.json({ success });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/scrape-and-store', async (req, res) => {
  try {
    const { url, chatId } = req.body;
    
    if (!url || !chatId) {
      return res.status(400).json({ error: 'URL and chat ID are required' });
    }
    
    // First check if user is connected
    const isConnected = await sheetsIntegration.checkConnection(chatId);
    
    if (!isConnected) {
      return res.status(401).json({ 
        error: 'User not connected to Google Sheets' 
      });
    }
    
    // Scrape the website
    const scraper = require('../scraper/scraper');
    const result = await scraper.scrapeWebsite(url);
    
    try {
      // Store in Google Sheets
      await sheetsIntegration.storeWebsiteMetadata(chatId, {
        title: result.title,
        url: result.originalUrl,
        description: result.content
      });
      
      // Important: Add this flag so the bot knows to show the confirmation
      result.sheetUpdated = true;
    } catch (sheetError) {
      console.error(`Sheet storage error: ${sheetError.message}`);
      // Don't fail the entire request if sheet update fails
      result.sheetUpdated = false;
    }
    
    return res.json(result);
  } catch (error) {
    console.error('Scrape and store error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;