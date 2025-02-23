const puppeteer = require("puppeteer");

async function instaScraper(url) {
    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "networkidle2" });

        // Extract video/image URL
        const mediaUrl = await page.evaluate(() => {
            const video = document.querySelector("video");
            const image = document.querySelector("img");
            return video ? video.src : image ? image.src : null;
        });

        await browser.close();
        return mediaUrl ? { mediaUrl } : { error: "Failed to fetch Instagram media" };
    } catch (error) {
        console.error("Instagram Scrape Error:", error);
        return { error: "Scraping failed" };
    }
}

// ✅ Properly export the function
module.exports = instaScraper;
