const puppeteer = require('puppeteer');

async function instaScraper(postUrl) {
    if (!postUrl.includes('instagram.com/p/')) {
        return { error: "Invalid Instagram post URL" };
    }

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(postUrl, { waitUntil: 'domcontentloaded' });

        // Extract media URL
        const mediaUrl = await page.evaluate(() => {
            const metaTag = document.querySelector('meta[property="og:image"]');
            return metaTag ? metaTag.content : null;
        });

        // Extract caption
        const caption = await page.evaluate(() => {
            const metaTag = document.querySelector('meta[property="og:description"]');
            return metaTag ? metaTag.content.split("•")[0].trim() : "Caption not found";
        });

        return {
            mediaUrl: mediaUrl || "Media not found",
            caption: caption
        };

    } catch (error) {
        console.error("Instagram Scrape Error:", error);
        return { error: "Failed to fetch Instagram post details" };
    } finally {
        await browser.close();
    }
}

module.exports = instaScraper;
