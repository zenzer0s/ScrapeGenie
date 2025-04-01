const express = require("express");
const { scrapeContent } = require("../scraper/scraperManager");
const { fetchInstagramPost } = require("../scraper/instaScraper");
const { scrapePinterest } = require('../scraper/pinterestScraper');
const SheetsIntegration = require('../../google/integration/sheetsIntegration');
const tokenStorage = require('../../google/storage/tokenStorage');
const authHandler = require('../../google/auth/authHandler');
const sheetsManager = require('../../google/sheets/sheetsManager');

const sheetsIntegration = new SheetsIntegration(tokenStorage, authHandler, sheetsManager);
const pinterestPattern = /(?:https?:\/\/)?(?:www\.)?(?:pinterest\.com|pin\.it)\/([^\/\s]+)/i;
const router = express.Router();

router.post("/", async (req, res) => {
    const { url } = req.body;
    const userId = req.body.userId || 'default';

    if (!url) return res.status(400).json({ success: false, error: "No URL provided" });

    console.log(`🟢 Processing: ${url}`);

    try {
        let result = pinterestPattern.test(url) 
            ? await scrapePinterest(url, userId)
            : await scrapeContent(url, userId);
            
        if (!result?.success && result?.requiresAuth && result?.service === 'pinterest') {
            return res.status(401).json({
                success: false,
                error: result.error,
                errorCode: result.errorCode,
                requiresAuth: true,
                service: 'pinterest',
                userId: result.userId,
                loginRequired: result.loginRequired
            });
        }
        
        if (result?.type === 'website') {
            const chatId = req.body.chatId || req.body.userId;
            if (chatId) tryStoreInGoogleSheets(chatId, result, url);
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

router.post("/instagram", async (req, res) => {
    const { url } = req.body;
    
    if (!url) return res.status(400).json({ success: false, error: "URL is required" });

    try {
        const result = await fetchInstagramPost(url);
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
        // Silently continue if Google storage fails
    }
}

module.exports = router;