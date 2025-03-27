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
    
    // Add a small delay before initializing to prevent race conditions
    // when multiple requests come in at once
    await new Promise(resolve => setTimeout(resolve, 10));
    
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

router.delete('/sheet-entry', async (req, res) => {
  try {
    const { chatId, url } = req.body;
    
    if (!chatId || !url) {
      return res.status(400).json({ error: 'Chat ID and URL required' });
    }
    
    console.log(`Deleting sheet entry for chatId: ${chatId}, URL: ${url}`);
    
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
    
    // Delete the entry from the sheet
    await sheetsManager.deleteEntryByUrl(userData.spreadsheetId, url);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting sheet entry:', error);
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
    
    // Store the metadata - this was the line with the error
    // Make sure we're calling the function correctly
    await sheetsManager.appendRow(
      userData.spreadsheetId, 
      [
        metadata.title || 'Untitled',
        metadata.url,
        metadata.description || 'No description',
        new Date().toISOString() // Add timestamp
      ]
    );
    
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