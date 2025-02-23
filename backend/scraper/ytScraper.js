// ytScraper.js
const puppeteer = require('puppeteer');
const getBrowser = require('./browserManager');

async function ytScraper(videoUrl) {
    if (!videoUrl.includes('youtube.com/watch?v=') && 
        !videoUrl.includes('youtu.be/') && 
        !videoUrl.includes('youtube.com/shorts/')) {
        return { 
            success: false, 
            error: "Invalid YouTube URL" 
        };
    }

    let browser = null;
    try {
        browser = await getBrowser();
        const page = await browser.newPage();
        
        // Set user agent
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/91.0.4472.124 Safari/537.36'
        );
        
        await page.goto(videoUrl, { waitUntil: 'networkidle0', timeout: 30000 });

        // Extract video ID
        let videoId;
        if (videoUrl.includes("youtube.com/watch?v=")) {
            videoId = new URL(videoUrl).searchParams.get("v");
        } else if (videoUrl.includes("youtube.com/shorts/")) {
            videoId = videoUrl.split("shorts/")[1]?.split("?")[0];
        } else {
            videoId = videoUrl.split("youtu.be/")[1]?.split("?")[0];
        }

        if (!videoId) {
            throw new Error("Could not extract video ID");
        }

        // Get title from page
        const title = await page.evaluate(() => {
            return document.querySelector('meta[name="title"]')?.content ||
                   document.querySelector('title')?.textContent || 
                   "Title not found";
        });

        return {
            success: true,
            type: 'youtube',
            title: title,
            mediaUrl: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
            originalUrl: videoUrl
        };

    } catch (error) {
        console.error("YouTube Scrape Error:", error);
        return { 
            success: false, 
            error: "Failed to fetch YouTube video details" 
        };
    }
}

module.exports = ytScraper;
