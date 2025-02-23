const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const scraper = require("./scraper/scraper");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Route to scrape metadata
app.get("/scrape", async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: "URL is required" });
    }

    try {
        const data = await scraper.scrapeMetadata(url);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to scrape data" });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
});
