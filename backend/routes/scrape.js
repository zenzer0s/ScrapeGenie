const express = require("express");
const { scrapeContent } = require("../scraper/scraperManager");
const { fetchInstagramPost } = require("../scraper/instaScraper");

const router = express.Router();

router.post("/", async (req, res) => {
    const { url } = req.body;
    const userId = req.body.userId || 'default'; // Add a default userId

    if (!url) {
        return res.status(400).json({ success: false, error: "No URL provided" });
    }

    console.log(`🟢 Received API request for: ${url}`);

    try {
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