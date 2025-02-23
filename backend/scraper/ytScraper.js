// ytScraper.js
const puppeteer = require('puppeteer');
const getBrowser = require('./browserManager');

async function ytScraper(videoUrl) {
    if (!videoUrl.includes('youtube.com/watch?v=') && !videoUrl.includes('youtu.be/')) {
        return { 
            success: false, 
            error: "Invalid YouTube URL" 
        };
    }

    let browser = null;
    try {
        browser = await getBrowser();
        const page = await browser.newPage();
        await page.goto(videoUrl, { waitUntil: 'networkidle0', timeout: 30000 });

        // Extract video ID
        let videoId = videoUrl.includes("youtube.com/watch?v=") 
            ? new URL(videoUrl).searchParams.get("v")
            : videoUrl.split("youtu.be/")[1]?.split("?")[0];

        if (!videoId) {
            throw new Error("Could not extract video ID");
        }

        // Get metadata
        const data = await page.evaluate(() => ({
            title: document.querySelector('meta[name="title"]')?.content
                || document.querySelector('title')?.textContent
                || null
        }));

        // Construct response with high-quality thumbnail
        return {
            success: true,
            type: 'youtube',
            title: data.title || "Title not found",
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