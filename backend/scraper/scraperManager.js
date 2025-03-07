const { fetchInstagramPost } = require("./instaScraper");
const { scrapePinterest } = require("./pinterestScraper");
const { scrapeYouTube } = require("./ytScraper");
const scraper = require("./scraper");
const axios = require("axios");

// Regex patterns for detecting different platforms
const PATTERNS = {
    instagram: /https?:\/\/(www\.)?instagram\.com\/(p|reel|tv|stories)\//,
    pinterest: /https?:\/\/(www\.)?pinterest\.[a-z]+\/pin\//,
    pinterestShort: /https?:\/\/(www\.)?pin\.it\//, // Short links
    youtube: /https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/, // Fixed regex
};

// Function to expand Pinterest short links
async function expandPinterestUrl(url) {
    try {
        console.log(`🔄 Expanding Pinterest short URL: ${url}`);
        const response = await axios.get(url, { maxRedirects: 5 });
        console.log(`✅ Expanded Pinterest URL: ${response.request.res.responseUrl}`);
        return response.request.res.responseUrl || url;
    } catch (error) {
        console.error(`❌ Failed to expand Pinterest URL, using original: ${url}`);
        return url;
    }
}

async function scrapeContent(url) {
    try {
        console.log(`🔍 Received URL: ${url}`);

        // Expand only Pinterest short links
        if (PATTERNS.pinterestShort.test(url)) {
            url = await expandPinterestUrl(url);
        }

        if (PATTERNS.instagram.test(url)) {
            console.log("📸 Instagram detected! ✅ Calling fetchInstagramPost...");
            return await fetchInstagramPost(url); // 🚀 Only use Instaloader, not Puppeteer!
        } else if (PATTERNS.pinterest.test(url)) {
            console.log("📌 Pinterest detected! Calling scrapePinterest...");
            return await scrapePinterest(url);
        } else if (PATTERNS.youtube.test(url)) {
            console.log("🎥 YouTube detected! Calling scrapeYouTube...");
            return await scrapeYouTube(url);
        } else {
            console.log("🌍 General website detected! Calling scrapeWebsite...");
            return await scraper.scrapeWebsite(url);
        }
    } catch (error) {
        console.error("❌ Scraping error:", error);
        return { error: "Scraping failed" };
    }
}

if (require.main === module) {
    const url = process.argv[2];
    if (!url) {
        console.log("❌ No URL provided. Please pass a URL as an argument.");
        process.exit(1);
    }

    scrapeContent(url).then((result) => {
        console.log("✅ Scraping complete:", result);
    }).catch((error) => {
        console.error("❌ Scraping failed:", error);
    });
}

module.exports = { scrapeContent };
