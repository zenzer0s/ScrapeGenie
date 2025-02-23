const puppeteer = require('puppeteer');

async function instaScraper(postUrl) {
    if (!postUrl.includes('instagram.com/p/') && !postUrl.includes('instagram.com/reel/')) {
        return { error: "Invalid Instagram URL" };
    }

    const browser = await puppeteer.launch({
        headless: "new", // Uses latest headless mode for better performance
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });
    const page = await browser.newPage();

    try {
        await page.goto(postUrl, { waitUntil: 'domcontentloaded' });

        // Extract media URL (image or reel)
        const mediaUrl = await page.evaluate(() => {
            const video = document.querySelector('video');
            if (video) return video.src;
            const image = document.querySelector('img');
            return image ? image.src : null;
        });

        // Extract caption
        const caption = await page.evaluate(() => {
            const captionElem = document.querySelector('meta[property="og:description"]');
            return captionElem ? captionElem.content : "Caption not found";
        });

        return {
            mediaUrl: mediaUrl || "Media not found",
            caption: caption
        };
    } catch (error) {
        console.error("Instagram Scrape Error:", error);
        return { error: "Failed to fetch Instagram media" };
    } finally {
        await browser.close();
    }
}

module.exports = instaScraper;
