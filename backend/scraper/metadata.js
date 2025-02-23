// metadata.js
const getBrowser = require('./browserManager');

async function scrapeMetadata(url) {
    if (!url || typeof url !== "string" || !url.startsWith("http")) {
        return { success: false, error: "Invalid URL provided" };
    }

    let browser = null;
    try {
        browser = await getBrowser();
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

        const metadata = await page.evaluate(() => {
            const getMetaContent = (selectors) => {
                for (let selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element?.content) return element.content;
                }
                return null;
            };

            return {
                title: document.title || 
                       getMetaContent(['meta[property="og:title"]', 'meta[name="title"]']) || 
                       "No Title",
                description: getMetaContent([
                    'meta[name="description"]',
                    'meta[property="og:description"]',
                    'meta[name="twitter:description"]'
                ]) || "No Description",
                originalUrl: window.location.href
            };
        });

        return {
            success: true,
            type: 'website',
            ...metadata
        };
    } catch (error) {
        console.error("Metadata Scraping error:", error);
        return { 
            success: false, 
            error: error.message 
        };
    }
}

module.exports = { scrapeMetadata };