const express = require('express');
const router = express.Router();
const TokenStorage = require('../../google/storage/tokenStorage');
const AuthHandler = require('../../google/auth/authHandler');
const SheetsManager = require('../../google/sheets/sheetsManager');
const SheetsIntegration = require('../../google/integration/sheetsIntegration');
const { GOOGLE_CONFIG } = require('../../google/config/config');
const path = require('path');
const axios = require('axios');

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

// Update auth URL generation route
router.get('/auth-url', async (req, res) => {
  try {
    const { chatId, returning } = req.query;
    
    if (!chatId) {
      return res.status(400).json({ error: 'Missing chatId parameter' });
    }
    
    console.log(`Generating auth URL for chatId: ${chatId}, returning: ${returning}`);
    
    // Pass the returning parameter in state to the callback
    const state = returning === 'true' ? 
      `${chatId}:returning` : 
      chatId;
    
    const authUrl = authHandler.getAuthUrl(state);
    console.log(`Auth URL generated: ${authUrl.substring(0, 100)}...`);
    
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update callback handler to parse the returning parameter
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      console.error('No authorization code found in callback');
      return res.status(400).send('Authentication failed: No authorization code received');
    }
    
    // Parse state parameter to get chatId and returning status
    let chatId, isReturning = false;
    
    if (state.includes(':returning')) {
      [chatId, _] = state.split(':');
      isReturning = true;
    } else {
      chatId = state;
    }
    
    console.log(`[CALLBACK] Decoded chatId: ${chatId}, isReturning: ${isReturning}`);
    
    // Exchange code for tokens
    const tokens = await authHandler.getTokensFromCode(code);
    console.log(`Tokens retrieved successfully`);
    
    // Use the returning flag to prioritize finding existing spreadsheets
    const result = await sheetsIntegration.handleReturningUser(chatId, tokens, isReturning);
    
    // After successful authentication, redirect to the auto-closing success page
    return res.redirect(`/api/google/success?chatId=${chatId}&returning=${result.isReturning}`);
  } catch (error) {
    console.error('[CALLBACK] Error:', error);
    return res.status(500).send('Authentication failed. Please try again.');
  }
});

// Update the success route to serve the HTML with the right params
router.get('/success', (req, res) => {
  // Pass parameters in the URL for the JS to use
  res.sendFile(path.join(__dirname, '../public/auth-success.html'));
});

router.get('/status', async (req, res) => {
  try {
    const { chatId } = req.query;
    
    if (!chatId) {
      return res.status(400).json({ error: 'chatId parameter is required' });
    }
    
    console.log(`Status endpoint called with params: ${JSON.stringify(req.query)}`);
    
    // Get user data
    const userData = await tokenStorage.getTokens(chatId);
    
    // Basic response structure
    const response = {
      connected: false,
      authentication: false,
      spreadsheetMissing: true,
      message: 'Not connected to Google Sheets'
    };
    
    if (!userData) {
      return res.json(response);
    }
    
    // Check if user has tokens
    if (userData.tokens) {
      response.connected = true;
      response.authentication = true;
      
      // Add returning user information
      if (userData.spreadsheetCreatedAt) {
        response.spreadsheetCreatedAt = userData.spreadsheetCreatedAt;
        response.daysSinceCreation = Math.floor(
          (new Date() - new Date(userData.spreadsheetCreatedAt)) / (1000 * 60 * 60 * 24)
        );
      }
      
      if (userData.disconnectedAt) {
        response.lastDisconnect = userData.disconnectedAt;
      }
      
      // Check if spreadsheet exists
      try {
        authHandler.setCredentials(userData.tokens);
        const authClient = authHandler.getAuthClient();
        sheetsManager.initializeSheets(authClient);
        
        if (userData.spreadsheetId) {
          // Try to access the spreadsheet
          await sheetsManager.getSpreadsheetData(userData.spreadsheetId);
          response.spreadsheetMissing = false;
          response.spreadsheetId = userData.spreadsheetId;
          response.message = 'Connected to Google Sheets';
        } else {
          response.message = 'Authentication successful, but no spreadsheet is linked';
        }
      } catch (error) {
        console.error(`Error checking spreadsheet: ${error.message}`);
        
        if (error.message.includes('not found') || error.message.includes('does not exist')) {
          response.message = 'Authentication successful, but spreadsheet not found';
        } else {
          response.message = `Authentication successful, but spreadsheet access failed: ${error.message}`;
        }
      }
    } else if (userData.spreadsheetId) {
      // User has a saved spreadsheet but no tokens
      response.connected = true;
      response.authentication = false;
      response.spreadsheetId = userData.spreadsheetId;
      response.spreadsheetCreatedAt = userData.spreadsheetCreatedAt;
      response.disconnectedAt = userData.disconnectedAt;
      response.message = 'Spreadsheet exists but requires authentication';
    }
    
    console.log(`Connection status for ${chatId}: ${JSON.stringify(response)}`);
    return res.json(response);
  } catch (error) {
    console.error(`Status endpoint error: ${error.message}`);
    return res.status(500).json({ error: error.message });
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

// Add this endpoint
router.post('/disconnect', async (req, res) => {
  try {
    const { chatId } = req.body;
    
    if (!chatId) {
      return res.status(400).json({ error: 'chatId is required' });
    }
    
    console.log(`Disconnecting Google for user ${chatId}`);
    
    // Remove tokens but preserve spreadsheet ID
    await tokenStorage.removeTokens(chatId);
    
    return res.json({
      success: true,
      message: 'Successfully disconnected from Google Sheets'
    });
  } catch (error) {
    console.error('Error disconnecting from Google:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
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

// Replace your notify-bot endpoint with this simpler version
router.post('/notify-bot', async (req, res) => {
  try {
    const { chatId, isReturning } = req.body;
    
    if (!chatId) {
      return res.status(400).json({ error: 'chatId is required' });
    }
    
    console.log(`🔔 Attempting to notify user ${chatId} about successful auth (returning: ${isReturning})`);
    
    // Get connection details
    const userData = await tokenStorage.getTokens(chatId);
    const spreadsheetId = userData?.spreadsheetId || 'Unknown';
    
    // Generate appropriate message
    const message = isReturning ? 
      `✅ Welcome back! You've been reconnected to your Google Sheets account.\n\nYour existing spreadsheet is ready to use.` :
      `✅ You've been successfully connected to Google Sheets!\n\nA new spreadsheet has been created for you.`;
    
    // DIRECT BOT IMPORT - this avoids routing issues
    try {
      // Use relative path to find the bot
      const botPath = path.resolve(__dirname, '../../bot/bot.js');
      console.log(`Looking for bot at: ${botPath}`);
      
      // Import the bot
      const bot = require(botPath);
      
      // Send message with button
      await bot.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 View Spreadsheet', callback_data: 'google_sheet' }]
          ]
        }
      });
      
      console.log(`✅ Bot notification successfully sent to ${chatId}`);
    } catch (error) {
      console.error(`❌ Error sending bot message: ${error.message}`);
      console.error(error.stack);
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error in notify-bot:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;