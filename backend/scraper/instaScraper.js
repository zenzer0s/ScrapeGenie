const getBrowser = require("./browserManager");

async function instaScraper(instaUrl) {
    if (!instaUrl.includes("instagram.com/p/")) {
        return { error: "Invalid Instagram URL" };
    }

    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        await page.setRequestInterception(true);
        page.on("request", (req) => {
            if (["image", "stylesheet", "font", "media"].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.goto(instaUrl, { waitUntil: "domcontentloaded", timeout: 15000 });

        const mediaUrl = await page.evaluate(() => {
            const video = document.querySelector("video");
            const img = document.querySelector("img");
            return video ? video.src : img ? img.src : null;
        });

        return mediaUrl ? { mediaUrl } : { error: "Failed to fetch Instagram media" };
    } catch (error) {
        console.error("Instagram Scrape Error:", error);
        return { error: "Failed to fetch Instagram media" };
    } finally {
        await page.close();
    }
}

module.exports = instaScraper;
