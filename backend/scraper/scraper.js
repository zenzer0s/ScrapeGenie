const puppeteer = require("puppeteer");
const { scrapePinterest } = require('./pinterestScraper'); // Import the scrapePinterest function

async function scrapeMetadata(url) {
    let browser;
    try {
        // Validate URL format
        if (!url || typeof url !== "string" || !url.startsWith("http")) {
            throw new Error("Invalid URL provided");
        }

        // Launch Puppeteer in headless mode
        browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        
        // Set a navigation timeout (15 seconds)
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

        // Extract metadata from the page
        const metadata = await page.evaluate(() => {
            const title = document.title || "No Title";
            const descriptionTag = document.querySelector('meta[name="description"]');
            const description = descriptionTag ? descriptionTag.content : "No Description";
            return { title, description };
        });

        return metadata;
    } catch (error) {
        console.error("Scraping error:", error);
        // Return error information so our API can relay it back
        return { error: error.message };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function scrapeWebsite(url) {
    return `Scraped content from ${url}`;
}

// ✅ Ensure this is correctly exported
module.exports = { scrapeMetadata, scrapePinterest, scrapeWebsite };
