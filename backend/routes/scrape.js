const express = require('express');
const ytScraper = require('../scraper/ytScraper');
const instaScraper = require('../scraper/instaScraper');

const router = express.Router();

// General scraping endpoint
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
            return res.status(400).json({ 
                success: false, 
                error: "Unsupported URL type" 
            });
        }

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to scrape data" 
        });
    }
});

// Keep your existing routes
router.get('/youtube', async (req, res) => { /* ... */ });
router.get('/instagram', async (req, res) => { /* ... */ });

module.exports = router;