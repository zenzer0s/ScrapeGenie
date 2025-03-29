const express = require('express');
const router = express.Router();
const TokenStorage = require('../../google/storage/tokenStorage');
const AuthHandler = require('../../google/auth/authHandler');
const SheetsManager = require('../../google/sheets/sheetsManager');
const SheetsIntegration = require('../../google/integration/sheetsIntegration');
const { GOOGLE_CONFIG } = require('../../google/config/config');

// Create instances - only once
const tokenStorage = require('../../google/storage/tokenStorage');
const authHandler = require('../../google/auth/authHandler');
const sheetsManager = require('../../google/sheets/sheetsManager');

// Create a single instance of SheetsIntegration
const sheetsIntegration = new SheetsIntegration(tokenStorage, authHandler, sheetsManager);

const routeLogTimestamps = {};
const LOG_DEBOUNCE_MS = 5000;

function debouncedRouteLog(message, route, chatId) {
    const logKey = `${route}_${chatId}`;
    const now = Date.now();
    
    if (!routeLogTimestamps[logKey] || (now - routeLogTimestamps[logKey] > LOG_DEBOUNCE_MS)) {
        console.log(message);
        routeLogTimestamps[logKey] = now;
        return true;
    }
    return false;
}

router.get('/sheet-data', async (req, res) => {
    try {
        const { chatId, page = 1, pageSize = 5 } = req.query;
        
        if (!chatId) {
            return res.status(400).json({ error: 'Chat ID required' });
        }
        
        // Log only if it hasn't been logged recently
        debouncedRouteLog(`Getting sheet data for chatId: ${chatId}, page: ${page}, pageSize: ${pageSize}`, 'sheet_data', chatId);
        
        // Get sheet data
        const data = await sheetsIntegration.getSheetData(chatId, parseInt(page), parseInt(pageSize));
        
        res.json(data);
    } catch (error) {
        console.error(`Sheet data error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/sheet-entry', async (req, res) => {
    try {
        const { chatId, url } = req.body;
        
        if (!chatId || !url) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Simplified log
        console.log(`Deleting sheet entry for chatId: ${chatId}, URL: ${url}`);
        
        // Check if user is connected
        const isConnected = await sheetsIntegration.checkConnection(chatId);
        
        if (!isConnected) {
            return res.status(400).json({ error: 'User not connected to Google Sheets' });
        }
        
        // Get user data with spreadsheet ID
        const userData = await tokenStorage.getTokens(chatId);
        
        if (!userData || !userData.spreadsheetId) {
            return res.status(400).json({ error: 'No spreadsheet found for user' });
        }
        
        // Set up auth client with user's tokens
        authHandler.setCredentials(userData.tokens);
        const authClient = authHandler.getAuthClient();
        
        // Initialize sheets API with auth client
        sheetsManager.initializeSheets(authClient);
        
        // Delete entry by URL
        await sheetsManager.deleteEntryByUrl(userData.spreadsheetId, url);
        
        res.json({ success: true });
    } catch (error) {
        console.error(`Error deleting sheet entry: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

router.post('/store-metadata', async (req, res) => {
  try {
    const { chatId, metadata } = req.body;
    
    if (!chatId || !metadata || !metadata.url) {
      return res.status(400).json({ error: 'Chat ID and valid metadata required' });
    }
    
    console.log(`Storing metadata for chatId: ${chatId}, URL: ${metadata.url}`);
    
    // Check if user is connected
    const isConnected = await sheetsIntegration.checkConnection(chatId);
    
    if (!isConnected) {
      return res.status(401).json({ error: 'User not connected to Google Sheets' });
    }
    
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
    
    // Set up authentication
    authHandler.setCredentials(userData.tokens);
    const authClient = authHandler.getAuthClient();
    
    // Initialize sheets with auth client
    sheetsManager.initializeSheets(authClient);
    
    // Store the metadata
    await sheetsManager.appendWebsiteData(userData.spreadsheetId, metadata);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error storing metadata:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/auth-url', async (req, res) => {
  try {
    const { chatId } = req.query;
    
    if (!chatId) {
      return res.status(400).json({ error: 'chatId is required' });
    }
    
    console.log(`Generating auth URL for chatId: ${chatId}`);
    
    // Generate a state parameter that includes the chatId (for security)
    const state = Buffer.from(chatId).toString('base64');
    
    // Generate the authentication URL
    const authUrl = authHandler.generateAuthUrl(state);
    
    console.log(`Auth URL generated: ${authUrl.substring(0, 100)}...`);
    
    // Return the URL to the client
    res.json({ url: authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/auth/google', (req, res) => {
  // Generate a random state for security
  const state = Buffer.from(Date.now().toString()).toString('base64');
  const authUrl = authHandler.generateAuthUrl(state);
  res.redirect(authUrl);
});

router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).send('Invalid request: Missing code or state');
    }
    
    console.log('[CALLBACK] Received authorization code');
    
    // Decode chatId from state
    const chatId = Buffer.from(state, 'base64').toString();
    console.log(`[CALLBACK] Decoded chatId: ${chatId}`);
    
    // Exchange code for tokens
    console.log('Exchanging authorization code for tokens');
    const tokens = await authHandler.getTokensFromCode(code);
    console.log('Tokens retrieved successfully');
    console.log('[CALLBACK] Retrieved tokens successfully');
    
    // Save tokens
    await tokenStorage.saveTokens(chatId, { tokens });
    console.log(`[CALLBACK] Tokens saved for user ${chatId}`);
    
    try {
      // Set up user's spreadsheet
      console.log(`Setting up sheet for user: ${chatId}`);
      await sheetsIntegration.setupUserSheet(chatId);
      console.log('Sheet setup complete');
      
      // Redirect to success page
      return res.redirect('/auth-success.html');
    } catch (setupError) {
      console.error('[CALLBACK] Error during sheet setup:', setupError);
      return res.status(500).send('Authentication successful, but sheet setup failed. Please try again.');
    }
  } catch (error) {
    console.error('[CALLBACK] Error:', error);
    return res.status(500).send('Authentication failed. Please try again.');
  }
});

router.get('/status', async (req, res) => {
  try {
    console.log('Status endpoint called with params:', req.query);
    const { chatId } = req.query;
    
    if (!chatId) {
      return res.status(400).json({ error: 'Chat ID required' });
    }
    
    console.log(`Checking connection for chatId: ${chatId}`);
    
    // Get detailed connection status
    const status = await sheetsIntegration.checkConnection(chatId);
    console.log(`Connection status for ${chatId}:`, status);
    
    res.json(status);
  } catch (error) {
    console.error('Error checking status:', error);
    res.status(500).json({ 
      connected: false,
      error: error.message,
      message: "Error checking connection status"
    });
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

router.post('/create-spreadsheet', async (req, res) => {
  try {
    const { chatId } = req.body;
    
    if (!chatId) {
      return res.status(400).json({ error: 'Chat ID required' });
    }
    
    console.log(`Creating new spreadsheet for chatId: ${chatId}`);
    
    // Create a new spreadsheet using our method
    const result = await sheetsIntegration.createNewSpreadsheet(chatId);
    
    // Return the result
    res.json(result);
  } catch (error) {
    console.error('Error creating spreadsheet:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to create spreadsheet"
    });
  }
});

module.exports = router;