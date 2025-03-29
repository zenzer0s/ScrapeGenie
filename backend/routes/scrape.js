const express = require("express");
const { scrapeContent } = require("../scraper/scraperManager");
const { fetchInstagramPost } = require("../scraper/instaScraper");
const { scrapePinterest, loginToPinterest } = require('../scraper/pinterestScraper');
const SheetsIntegration = require('../../google/integration/sheetsIntegration');
const tokenStorage = require('../../google/storage/tokenStorage');
const authHandler = require('../../google/auth/authHandler');
const sheetsManager = require('../../google/sheets/sheetsManager');

// Create an instance of SheetsIntegration
const sheetsIntegration = new SheetsIntegration(tokenStorage, authHandler, sheetsManager);

// Define URL patterns for different services
const pinterestPattern = /(?:https?:\/\/)?(?:www\.)?(?:pinterest\.com|pin\.it)\/([^\/\s]+)/i;
const router = express.Router();

router.post("/", async (req, res) => {
    const { url } = req.body;
    const userId = req.body.userId || 'default'; // Add a default userId

    if (!url) {
        return res.status(400).json({ success: false, error: "No URL provided" });
    }

    console.log(`🟢 Received API request for: ${url}`);

    try {
        let result;
        
        // Special handling for Pinterest URLs to handle authentication
        if (pinterestPattern.test(url)) {
            console.log(`⏱️ Starting Pinterest scrape for: ${url}`);
            result = await scrapePinterest(url, userId);
            
            // Special handling for login required
            if (!result.success && result.loginRequired) {
                return res.status(401).json({
                    success: false,
                    error: 'Pinterest login required',
                    loginRequired: true
                });
            }
            
            if (!result.success) {
                // Check if this is an authentication error
                if (result.requiresAuth && result.service === 'pinterest') {
                    return res.status(401).json({
                        success: false,
                        error: result.error,
                        errorCode: result.errorCode,
                        requiresAuth: true,
                        service: 'pinterest',
                        userId: result.userId
                    });
                }
            }
        } else {
            // For all non-Pinterest URLs, use the general scraper
            result = await scrapeContent(url, userId);
        }
        
        console.log(`✅ Scraper Result:`, result);
        
        // After scraping is complete and result is available:
        if (result && result.type === 'website') {
            const chatId = req.body.chatId || req.body.userId;
            if (chatId) {
                try {
                    // Check if user is connected to Google Sheets
                    const status = await sheetsIntegration.checkConnection(chatId);
                    
                    if (status.connected && status.authentication && !status.spreadsheetMissing) {
                        // Store scraped data in Google Sheets
                        await sheetsIntegration.storeWebsiteMetadata(chatId, {
                            title: result.title,
                            url: result.originalUrl || url,
                            description: result.content
                        });
                        
                        // Add flag so client knows data was stored
                        result.sheetUpdated = true;
                    }
                } catch (sheetError) {
                    console.error(`Failed to store data in Google Sheets: ${sheetError.message}`);
                    // Don't fail the whole request if Google storage fails
                }
            }
        }
        
        if (!result || result.error) {
            return res.status(500).json({ success: false, error: "Scraping failed", details: result });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        console.error("❌ Scraper Error:", error);
        res.status(500).json({ success: false, error: "Scraping failed", details: error.message });
    }
});

// In your Instagram route handler:

router.post("/instagram", async (req, res) => {
    const startTime = Date.now();
    const { url } = req.body;
    
    console.log(`\n🔍 Instagram request received for: ${url}`);
    
    if (!url) {
        return res.status(400).json({ success: false, error: "URL is required" });
    }

    try {
        console.log(`⏱️ Starting Instagram process...`);
        const result = await fetchInstagramPost(url);
        
        console.log(`⏱️ API response preparation: ${formatTime(Date.now() - startTime)}`);
        console.log(`✅ Instagram process complete in ${result.performance.totalTime}`);
        
        return res.json({
            success: true,
            mediaPath: result.mediaPath,
            caption: result.caption,
            is_video: result.is_video,
            performance: result.performance
        });
    } catch (error) {
        console.error(`❌ Instagram error: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;