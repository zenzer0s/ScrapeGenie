const express = require('express');
const ytScraper = require('../scraper/ytScraper');
const router = express.Router();

router.get('/youtube', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "YouTube URL is required" });

    const result = await ytScraper(url);
    res.json(result);
});

module.exports = router;
