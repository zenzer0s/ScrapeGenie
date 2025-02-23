const express = require("express");
const instaScraper = require("../scraper/instaScraper");

const router = express.Router();

router.get("/instagram", async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: "URL is required" });
    }

    try {
        const mediaUrl = await instaScraper(url);
        res.json({ mediaUrl });
    } catch (error) {
        console.error("Instagram Scrape Error:", error);
        res.status(500).json({ error: "Failed to fetch Instagram media" });
    }
});

module.exports = router;
