const { fetchInstagramPost } = require("./instaScraper");
const { scrapePinterest } = require("./pinterestScraper");
const { scrapeYouTube } = require("./ytScraper");
const { fetchYouTubeShort } = require("./ytShort");
const scraper = require("./scraper");
const axios = require("axios");

const PATTERNS = {
    instagram: /https?:\/\/(www\.)?instagram\.com\/(p|reel|tv|stories)\//,
    pinterest: /https?:\/\/(www\.)?pinterest\.[a-z]+\/pin\//,
    pinterestAny: /https?:\/\/(www\.)?pinterest\.[a-z]+/,
    pinterestShort: /https?:\/\/(www\.)?pin\.it\//,
    youtube: /https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/,
    youtubeShorts: /https?:\/\/(www\.)?youtube\.com\/shorts\//,
};

async function expandPinterestUrl(url) {
    try {
        const response = await axios.get(url, { 
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        const expandedUrl = response.request.res.responseUrl || url;
        
        if (expandedUrl.includes('show_error=true') || !expandedUrl.includes('/pin/')) {
            const pinMatch = url.match(/pin\.it\/([a-zA-Z0-9]+)/);
            if (pinMatch && pinMatch[1]) {
                return `https://www.pinterest.com/pin/${pinMatch[1]}/`;
            }
        }
        
        return expandedUrl;
    } catch (error) {
        return url;
    }
}

async function scrapeContent(url, userId = 'default') {
    try {
        if (PATTERNS.pinterestShort.test(url)) {
            url = await expandPinterestUrl(url);
        }

        if (PATTERNS.instagram.test(url)) {
            return await fetchInstagramPost(url);
        } else if (PATTERNS.pinterest.test(url) || PATTERNS.pinterestAny.test(url)) {
            return await scrapePinterest(url, userId);
        } else if (PATTERNS.youtubeShorts.test(url)) {
            return await fetchYouTubeShort(url);
        } else if (PATTERNS.youtube.test(url)) {
            return await scrapeYouTube(url);
        } else {
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
        console.log("✅ Scraping complete");
    }).catch((error) => {
        console.error("❌ Scraping failed:", error);
    });
}

module.exports = { scrapeContent };