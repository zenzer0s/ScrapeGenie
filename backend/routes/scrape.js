const express = require("express");
const { scrapeContent } = require("../scraper/scraperManager");
const { fetchInstagramPost } = require("../scraper/instaScraper");

const router = express.Router();

router.post("/", async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, error: "No URL provided" });
    }

    console.log(`🟢 Received API request for: ${url}`);

    try {
        const result = await scrapeContent(url);
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

// Add this new Instagram-specific endpoint
router.post("/instagram", async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, error: "No URL provided" });
    }

    console.log(`🟢 Received Instagram API request for: ${url}`);

    try {
        const mediaPath = await fetchInstagramPost(url);
        
        // Return success with the filepath
        res.json({ 
            success: true, 
            mediaPath,
            caption: "", // Add caption if available
            originalUrl: url
        });
    } catch (error) {
        console.error("❌ Instagram Scraper Error:", error);
        res.status(500).json({ 
            success: false, 
            error: "Instagram scraping failed", 
            details: error.message 
        });
    }
});

module.exports = router;