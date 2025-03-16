const { fetchInstagramPost } = require("./instaScraper");
const { scrapePinterest } = require("./pinterestScraper");
const { scrapeYouTube } = require("./ytScraper");
const { fetchYouTubeShort } = require("./ytShort");
const scraper = require("./scraper");
const axios = require("axios");

// Regex patterns for detecting different platforms
const PATTERNS = {
    instagram: /https?:\/\/(www\.)?instagram\.com\/(p|reel|tv|stories)\//,
    pinterest: /https?:\/\/(www\.)?pinterest\.[a-z]+\/pin\//,
    pinterestAny: /https?:\/\/(www\.)?pinterest\.[a-z]+/,  // Catch-all for Pinterest domains
    pinterestShort: /https?:\/\/(www\.)?pin\.it\//, // Short links
    youtube: /https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/, // Fixed regex
    youtubeShorts: /https?:\/\/(www\.)?youtube\.com\/shorts\//, // New pattern for YouTube Shorts
};

// Function to expand Pinterest short links
async function expandPinterestUrl(url) {
    try {
        console.log(`🔄 Expanding Pinterest short URL: ${url}`);
        const response = await axios.get(url, { 
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const expandedUrl = response.request.res.responseUrl || url;
        
        // Check if the URL contains an error parameter or doesn't contain /pin/
        if (expandedUrl.includes('show_error=true') || !expandedUrl.includes('/pin/')) {
            console.error(`⚠️ Pinterest returned an error page: ${expandedUrl}`);
            // Try to extract pin ID from the original URL
            const pinMatch = url.match(/pin\.it\/([a-zA-Z0-9]+)/);
            if (pinMatch && pinMatch[1]) {
                console.log(`🔄 Attempting to construct Pinterest URL from ID: ${pinMatch[1]}`);
                // This is just a fallback that may not work, but worth a try
                return `https://www.pinterest.com/pin/${pinMatch[1]}/`;
            }
        }
        
        console.log(`✅ Expanded Pinterest URL: ${expandedUrl}`);
        return expandedUrl;
    } catch (error) {
        console.error(`❌ Failed to expand Pinterest URL, using original: ${url}`);
        return url;
    }
}

async function scrapeContent(url, userId = 'default') {
    try {
        console.log(`🔍 Received URL: ${url}`);

        // Expand only Pinterest short links
        if (PATTERNS.pinterestShort.test(url)) {
            url = await expandPinterestUrl(url);
        }

        if (PATTERNS.instagram.test(url)) {
            console.log("📸 Instagram detected! ✅ Calling fetchInstagramPost...");
            return await fetchInstagramPost(url);
        } else if (PATTERNS.pinterest.test(url) || PATTERNS.pinterestAny.test(url)) {
            console.log(`📌 Pinterest detected! Calling scrapePinterest...`);
            return await scrapePinterest(url, userId); // Now userId is defined
        } else if (PATTERNS.youtubeShorts.test(url)) {
            console.log("🎥 YouTube Shorts detected! ✅ Calling fetchYouTubeShort...");
            return await fetchYouTubeShort(url);
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