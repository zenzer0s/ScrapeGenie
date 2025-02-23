const express = require('express');
const ytScraper = require('../scraper/ytScraper');
const instaScraper = require('../scraper/instaScraper'); // Ensure correct path

const router = express.Router();

// YouTube Scraper Route
router.get('/youtube', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "YouTube URL is required" });

    const result = await ytScraper(url);
    res.json(result);
});

// Instagram Scraper Route
router.get('/instagram', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "Instagram URL is required" });

    const result = await instaScraper(url);
    res.json(result);
});

module.exports = router;
