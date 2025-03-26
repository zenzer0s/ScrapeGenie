const express = require('express');
const router = express.Router();
const authHandler = require('../auth/authHandler');
const sheetsIntegration = require('../integration/sheetsIntegration');
const scraperBridge = require('../integration/scraperSheetsBridge');

// Store user sheet info temporarily (in production, use a database)
const userSheets = new Map();

// Initialize Google OAuth flow
router.get('/auth/google', (req, res) => {
    const authUrl = authHandler.generateAuthUrl();
    res.redirect(authUrl);
});

// Handle OAuth callback
router.get('/auth/google/callback', async (req, res) => {
    try {
        const { code } = req.query;
        const userId = 'user123'; // Replace with actual user ID from your auth system
        
        // Setup user's sheet and get credentials
        const setupResult = await sheetsIntegration.setupUserSheet(userId, code);
        
        // Store sheet info for user
        userSheets.set(userId, setupResult);
        
        res.json({ success: true, message: 'Google Sheets integration successful' });
    } catch (error) {
        console.error('Google auth callback error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint to scrape and store website data
router.post('/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        const userId = 'user123'; // Replace with actual user ID
        const userSheet = userSheets.get(userId);

        if (!userSheet) {
            return res.status(401).json({ 
                success: false, 
                error: 'Google Sheets not connected' 
            });
        }

        const result = await scraperBridge.scrapeAndStore(url, userId, userSheet);
        res.json(result);

    } catch (error) {
        console.error('Scrape and store error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;