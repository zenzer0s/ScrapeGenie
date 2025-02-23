// scrape.js
const express = require('express');
const ytScraper = require('../scraper/ytScraper');
const instaScraper = require('../scraper/instaScraper');
const { scrapeMetadata } = require('../scraper/metadata');

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ 
                success: false, 
                error: "URL is required" 
            });
        }

        let result;
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            result = await ytScraper(url);
        } else if (url.includes('instagram.com')) {
            result = await instaScraper(url);
        } else {
            // For any other URL, use metadata scraper
            result = await scrapeMetadata(url);
        }

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to scrape data" 
        });
    }
});

module.exports = router;