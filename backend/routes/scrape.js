const express = require("express");
const router = express.Router();
const instaScraper = require("../scraper/instaScraper"); // ✅ Correct Import

router.get("/instagram", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });

    const result = await instaScraper(url); // ✅ Make sure function name matches
    res.json(result);
});

module.exports = router;
