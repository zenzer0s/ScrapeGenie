const express = require("express");
const { scrapeContent } = require("../scraper/scraperManager");
const { fetchInstagramPost } = require("../scraper/instaScraper");
const { scrapePinterest, loginToPinterest } = require('../scraper/pinterestScraper');

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
        // Inside your URL handling logic
        if (pinterestPattern.test(url)) {
            const result = await scrapePinterest(url, userId);
            
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
                
                // Handle other errors...
            }
            
            // Process successful results...
        }

        const result = await scrapeContent(url, userId); // Pass userId to scrapeContent
        console.log(`✅ Scraper Result:`, result); // Log output from scraperManager.js
        
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