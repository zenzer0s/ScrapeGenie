const express = require('express');
const router = express.Router();
const scraperBridge = require('../../google/integration/scraperSheetsBridge');
const { GOOGLE_CONFIG } = require('../../google/config/config');
const authHandler = require('../../google/auth/authHandler');

// Add this endpoint for getting the auth URL
router.get('/auth-url', (req, res) => {
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

router.get('/auth/google/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        
        // Decode state to get chatId
        const chatId = Buffer.from(state, 'base64').toString();
        
        const tokens = await authHandler.getTokens(code);
        const setupResult = await sheetsIntegration.setupUserSheet(chatId, tokens);
        
        // Redirect back to Telegram bot
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
        console.error('Google auth callback error:', error);
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

module.exports = router;