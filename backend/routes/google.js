const express = require('express');
const router = express.Router();
const path = require('path');

// Core dependencies
const tokenStorage = require('../../google/storage/tokenStorage');
const authHandler = require('../../google/auth/authHandler');
const sheetsManager = require('../../google/sheets/sheetsManager');
const SheetsIntegration = require('../../google/integration/sheetsIntegration');

// Create integration service
const sheetsIntegration = new SheetsIntegration(tokenStorage, authHandler, sheetsManager);

// Log rate limiting
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

// Get paginated sheet data
router.get('/sheet-data', async (req, res) => {
    try {
        const { chatId, page = 1, pageSize = 5 } = req.query;
        
        if (!chatId) return res.status(400).json({ error: 'Chat ID required' });
        
        debouncedRouteLog(`Getting sheet data for chatId: ${chatId}`, 'sheet_data', chatId);
        const data = await sheetsIntegration.getSheetData(chatId, parseInt(page), parseInt(pageSize));
        res.json(data);
    } catch (error) {
        console.error(`Sheet data error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Delete sheet entry by URL
router.delete('/sheet-entry', async (req, res) => {
    try {
        const { chatId, url } = req.body;
        
        if (!chatId || !url) return res.status(400).json({ error: 'Missing required fields' });
        
        console.log(`Deleting sheet entry for chatId: ${chatId}, URL: ${url}`);
        
        // Check connection and get spreadsheet ID
        const isConnected = await sheetsIntegration.checkConnection(chatId);
        if (!isConnected) return res.status(400).json({ error: 'User not connected to Google Sheets' });
        
        const userData = await tokenStorage.getTokens(chatId);
        if (!userData?.spreadsheetId) return res.status(400).json({ error: 'No spreadsheet found for user' });
        
        // Set up auth and delete entry
        authHandler.setCredentials(userData.tokens);
        sheetsManager.initializeSheets(authHandler.getAuthClient());
        await sheetsManager.deleteEntryByUrl(userData.spreadsheetId, url);
        
        res.json({ success: true });
    } catch (error) {
        console.error(`Error deleting sheet entry: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Store metadata in sheet
router.post('/store-metadata', async (req, res) => {
    try {
        const { chatId, metadata } = req.body;
        
        if (!chatId || !metadata?.url) return res.status(400).json({ error: 'Chat ID and valid metadata required' });
        
        // Verify connection and authorization
        if (!await sheetsIntegration.checkConnection(chatId))
            return res.status(401).json({ error: 'User not connected to Google Sheets' });
        
        const userData = await tokenStorage.getTokens(chatId);
        if (!userData?.tokens) return res.status(401).json({ error: 'Authentication required' });
        if (!userData?.spreadsheetId) return res.status(404).json({ error: 'Spreadsheet not found' });
        
        // Set up auth and store data
        authHandler.setCredentials(userData.tokens);
        sheetsManager.initializeSheets(authHandler.getAuthClient());
        await sheetsManager.appendWebsiteData(userData.spreadsheetId, metadata);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error storing metadata:', error);
        res.status(500).json({ error: error.message });
    }
});

// Generate Google auth URL
router.get('/auth-url', async (req, res) => {
    try {
        const { chatId } = req.query;
        
        if (!chatId) return res.status(400).json({ error: 'chatId is required' });
        
        const state = Buffer.from(chatId).toString('base64');
        const authUrl = authHandler.generateAuthUrl(state);
        
        res.json({ url: authUrl });
    } catch (error) {
        console.error('Error generating auth URL:', error);
        res.status(500).json({ error: error.message });
    }
});

// Handle Google auth callback
router.get('/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        
        if (!code || !state) return res.status(400).send('Invalid request: Missing code or state');
        
        // Decode chatId from state
        const chatId = Buffer.from(state, 'base64').toString();
        
        // Exchange code for tokens
        const tokens = await authHandler.getTokensFromCode(code);
        
        // Save tokens
        await tokenStorage.saveTokens(chatId, { tokens });
        
        try {
            await sheetsIntegration.setupUserSheet(chatId);
            return res.redirect('/auth-success.html');
        } catch (setupError) {
            return res.status(500).send('Authentication successful, but sheet setup failed. Please try again.');
        }
    } catch (error) {
        console.error('[CALLBACK] Error:', error);
        return res.status(500).send('Authentication failed. Please try again.');
    }
});

// Serve success page
router.get('/success', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/auth-success.html'));
});

// Get connection status
router.get('/status', async (req, res) => {
    try {
        const { chatId } = req.query;
        
        if (!chatId) return res.status(400).json({ error: 'Chat ID required' });
        
        const status = await sheetsIntegration.checkConnection(chatId);
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

// Disconnect user from Google
router.post('/disconnect', async (req, res) => {
    try {
        const { chatId } = req.body;
        
        if (!chatId) return res.status(400).json({ error: 'Chat ID required' });
        
        const success = await sheetsIntegration.disconnectUser(chatId);
        res.json({ success });
    } catch (error) {
        console.error('Disconnect error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Scrape website and store in Google Sheets
router.post('/scrape-and-store', async (req, res) => {
    try {
        const { url, chatId } = req.body;
        
        if (!url || !chatId) return res.status(400).json({ error: 'URL and chat ID are required' });
        
        if (!await sheetsIntegration.checkConnection(chatId))
            return res.status(401).json({ error: 'User not connected to Google Sheets' });
        
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
            result.sheetUpdated = true;
        } catch (sheetError) {
            console.error(`Sheet storage error: ${sheetError.message}`);
            result.sheetUpdated = false;
        }
        
        return res.json(result);
    } catch (error) {
        console.error('Scrape and store error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new spreadsheet
router.post('/create-spreadsheet', async (req, res) => {
    try {
        const { chatId } = req.body;
        
        if (!chatId) return res.status(400).json({ error: 'Chat ID required' });
        
        const result = await sheetsIntegration.createNewSpreadsheet(chatId);
        res.json(result);
    } catch (error) {
        console.error('Error creating spreadsheet:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;