const puppeteer = require('puppeteer');

async function ytScraper(videoUrl) {
    if (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
        return { error: "Invalid YouTube URL" };
    }

    const browser = await puppeteer.launch({ headless: "new" }); // Use "new" mode for better support
    const page = await browser.newPage();

    try {
        await page.goto(videoUrl, { waitUntil: 'networkidle2' }); // Wait for page to fully load

        // Wait for title element to appear
        await page.waitForSelector('meta[name="title"]', { timeout: 5000 });

        // Extract title from meta tag
        const title = await page.$eval('meta[name="title"]', el => el.content).catch(() => null);

        // Extract video ID and thumbnail URL
        let videoId;
        if (videoUrl.includes("youtube.com/watch?v=")) {
            videoId = new URL(videoUrl).searchParams.get("v");
        } else if (videoUrl.includes("youtu.be/")) {
            videoId = videoUrl.split("/").pop().split("?")[0];
        }
        const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;

        return {
            title: title || "Title not found",
            thumbnailUrl: thumbnailUrl || "Thumbnail not found",
            videoUrl: videoUrl
        };
    } catch (error) {
        console.error("YouTube Scrape Error:", error);
        return { error: "Failed to fetch YouTube video details" };
    } finally {
        await browser.close();
    }
}

module.exports = ytScraper;
