const express = require("express");
const { scrapeContent } = require("../scraper/scraperManager");
const { fetchInstagramPost } = require("../scraper/instaScraper");
const { scrapePinterest } = require('../scraper/pinterestScraper');
const SheetsIntegration = require('../../google/integration/sheetsIntegration');
const tokenStorage = require('../../google/storage/tokenStorage');
const authHandler = require('../../google/auth/authHandler');
const sheetsManager = require('../../google/sheets/sheetsManager');

const router = express.Router();
const sheetsIntegration = new SheetsIntegration(tokenStorage, authHandler, sheetsManager);

// URL patterns
const pinterestPattern = /(?:https?:\/\/)?(?:www\.)?(?:pinterest\.com|pin\.it)\/([^\/\s]+)/i;

// Main scraping endpoint
router.post("/", async (req, res) => {
    const { url, userId = 'default', chatId } = req.body;
    
    if (!url) {
        return res.status(400).json({ success: false, error: "No URL provided" });
    }

    console.log(`🟢 Processing: ${url}`);

    try {
        // Handle scraping based on URL type
        let result = pinterestPattern.test(url) 
            ? await handlePinterestScrape(url, userId)
            : await scrapeContent(url, userId);
            
        // Handle special Pinterest authentication responses
        if (result.loginRequired || (result.requiresAuth && result.service === 'pinterest')) {
            return res.status(401).json({
                success: false,
                error: result.error || 'Pinterest login required',
                requiresAuth: true,
                service: 'pinterest',
                userId: result.userId,
                loginRequired: result.loginRequired
            });
        }
        
        // Store in Google Sheets if applicable
        if (result?.type === 'website' && chatId) {
            await tryStoreInGoogleSheets(chatId, result, url);
        }
        
        if (!result || result.error) {
            return res.status(500).json({ 
                success: false, 
                error: "Scraping failed", 
                details: result 
            });
        }

        return res.json({ success: true, data: result });
    } catch (error) {
        console.error("❌ Scraper Error:", error);
        return res.status(500).json({ 
            success: false, 
            error: "Scraping failed", 
            details: error.message 
        });
    }
});

// Instagram-specific endpoint
router.post("/instagram", async (req, res) => {
    const startTime = Date.now();
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ success: false, error: "URL is required" });
    }

    try {
        const result = await fetchInstagramPost(url);
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
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Helper function for Pinterest handling
async function handlePinterestScrape(url, userId) {
    console.log(`⏱️ Starting Pinterest scrape for: ${url}`);
    const result = await scrapePinterest(url, userId);
    console.log(`✅ Pinterest scrape complete`);
    return result;
}

// Helper function for Google Sheets integration
async function tryStoreInGoogleSheets(chatId, result, url) {
    try {
        const status = await sheetsIntegration.checkConnection(chatId);
        
        if (status.connected && status.authentication && !status.spreadsheetMissing) {
            await sheetsIntegration.storeWebsiteMetadata(chatId, {
                title: result.title,
                url: result.originalUrl || url,
                description: result.content
            });
            
            result.sheetUpdated = true;
        }
    } catch (error) {
        console.error(`Failed to store in Google Sheets: ${error.message}`);
        // Continue execution even if sheet storage fails
    }
}

module.exports = router;