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
        
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/91.0.4472.124 Safari/537.36'
        );
        
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

        const metadata = await page.evaluate(() => {
            const getMetaContent = (selectors) => {
                for (let selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element?.content) return element.content;
                }
                return null;
            };

            // Try to get description from meta tags first.
            let description = getMetaContent([
                'meta[name="description"]',
                'meta[property="og:description"]',
                'meta[name="twitter:description"]'
            ]);
            
            // Fallback: if description is empty, attempt to find a suitable paragraph.
            if (!description || !description.trim()) {
                // Select all <p> elements inside .mw-parser-output if available.
                const paragraphs = Array.from(document.querySelectorAll('.mw-parser-output p'));
                // Filter out paragraphs that are too short (less than 50 characters)
                const validParagraphs = paragraphs.filter(p => p.textContent && p.textContent.trim().length > 50);
                if (validParagraphs.length > 0) {
                    description = validParagraphs[0].textContent.trim();
                }
            }

            return {
                title: document.title ||
                       getMetaContent(['meta[property="og:title"]', 'meta[name="title"]']) ||
                       "No Title",
                description: description || "No Description",
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
