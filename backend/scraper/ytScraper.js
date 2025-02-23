const puppeteer = require('puppeteer');

async function ytScraper(videoUrl) {
    if (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
        return { error: "Invalid YouTube URL" };
    }

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(videoUrl, { waitUntil: 'domcontentloaded' });

        // Extract video title using correct selector
        const title = await page.$eval('meta[name="title"]', el => el.content).catch(() => null);

        // Extract thumbnail URL
        let videoId;
        if (videoUrl.includes("youtube.com/watch?v=")) {
            videoId = new URL(videoUrl).searchParams.get("v");
        } else if (videoUrl.includes("youtu.be/")) {
            videoId = videoUrl.split("/").pop().split("?")[0];
        }
        const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;

        // Return extracted data
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
