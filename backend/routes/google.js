const express = require('express');
const router = express.Router();
const path = require('path');
const axios = require('axios');

// Core service dependencies
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
        const { chatId, returning } = req.query;
        
        if (!chatId) return res.status(400).json({ error: 'Missing chatId parameter' });
        
        const state = returning === 'true' ? `${chatId}:returning` : chatId;
        const authUrl = authHandler.getAuthUrl(state);
        
        res.json({ authUrl });
    } catch (error) {
        console.error('Error generating auth URL:', error);
        res.status(500).json({ error: error.message });
    }
});

// Handle Google auth callback
router.get('/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        
        if (!code) return res.status(400).send('Authentication failed: No authorization code received');
        
        // Parse state for chatId and returning status
        let chatId, isReturning = false;
        if (state.includes(':returning')) {
            [chatId, _] = state.split(':');
            isReturning = true;
        } else {
            chatId = state;
        }
        
        // Exchange code for tokens and handle user
        const tokens = await authHandler.getTokensFromCode(code);
        const result = await sheetsIntegration.handleReturningUser(chatId, tokens, isReturning);
        
        return res.redirect(`/api/google/success?chatId=${chatId}&returning=${result.isReturning}`);
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
        
        if (!chatId) return res.status(400).json({ error: 'chatId parameter is required' });
        
        const userData = await tokenStorage.getTokens(chatId);
        
        // Basic response structure
        const response = {
            connected: false,
            authentication: false,
            spreadsheetMissing: true,
            message: 'Not connected to Google Sheets'
        };
        
        if (!userData) return res.json(response);
        
        // Check if user has tokens
        if (userData.tokens) {
            response.connected = true;
            response.authentication = true;
            
            if (userData.spreadsheetCreatedAt) {
                response.spreadsheetCreatedAt = userData.spreadsheetCreatedAt;
                response.daysSinceCreation = Math.floor(
                    (new Date() - new Date(userData.spreadsheetCreatedAt)) / (1000 * 60 * 60 * 24)
                );
            }
            
            if (userData.disconnectedAt) response.lastDisconnect = userData.disconnectedAt;
            
            // Check spreadsheet access
            try {
                authHandler.setCredentials(userData.tokens);
                sheetsManager.initializeSheets(authHandler.getAuthClient());
                
                if (userData.spreadsheetId) {
                    await sheetsManager.getSpreadsheetData(userData.spreadsheetId);
                    response.spreadsheetMissing = false;
                    response.spreadsheetId = userData.spreadsheetId;
                    response.message = 'Connected to Google Sheets';
                } else {
                    response.message = 'Authentication successful, but no spreadsheet is linked';
                }
            } catch (error) {
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
        
        return res.json(response);
    } catch (error) {
        console.error(`Status endpoint error: ${error.message}`);
        return res.status(500).json({ error: error.message });
    }
});

// Disconnect user from Google
router.post('/disconnect', async (req, res) => {
    try {
        const { chatId } = req.body;
        
        if (!chatId) return res.status(400).json({ error: 'chatId is required' });
        
        // Remove tokens but preserve spreadsheet ID
        await tokenStorage.removeTokens(chatId);
        
        return res.json({
            success: true,
            message: 'Successfully disconnected from Google Sheets'
        });
    } catch (error) {
        console.error('Error disconnecting from Google:', error);
        return res.status(500).json({ success: false, error: error.message });
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

// Notify Telegram bot about successful authentication
router.post('/notify-bot', async (req, res) => {
    try {
        const { chatId, isReturning } = req.body;
        
        if (!chatId) return res.status(400).json({ error: 'chatId is required' });
        
        // Get connection details and prepare message
        const userData = await tokenStorage.getTokens(chatId);
        const message = isReturning ? 
            `✅ Welcome back! You've been reconnected to your Google Sheets account.\n\nYour existing spreadsheet is ready to use.` :
            `✅ You've been successfully connected to Google Sheets!\n\nA new spreadsheet has been created for you.`;
        
        try {
            const botPath = path.resolve(__dirname, '../../bot/bot.js');
            const bot = require(botPath);
            
            await bot.sendMessage(chatId, message, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📊 View Spreadsheet', callback_data: 'google_sheet' }]
                    ]
                }
            });
        } catch (error) {
            console.error(`Error sending bot message: ${error.message}`);
        }
        
        return res.json({ success: true });
    } catch (error) {
        console.error('Error in notify-bot:', error);
        return res.status(500).json({ error: error.message });
    }
});

module.exports = router;