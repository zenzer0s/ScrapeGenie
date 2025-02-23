const puppeteer = require("puppeteer");

async function scrapeMetadata(url) {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded" });

        const metadata = await page.evaluate(() => {
            return {
                title: document.title,
                description:
                    document.querySelector('meta[name="description"]')?.content || "No description found",
            };
        });

        return metadata;
    } catch (error) {
        console.error("Scraping error:", error);
        throw new Error("Scraping failed");
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

module.exports = { scrapeMetadata };
