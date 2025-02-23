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

        // Use a slightly longer wait to let dynamic content load
        await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });

        const metadata = await page.evaluate(() => {
            const getMetaContent = (selectors) => {
                for (let selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element && element.content && element.content.trim()) return element.content.trim();
                }
                return null;
            };

            // Try to get description from meta tags first.
            let description = getMetaContent([
                'meta[name="description"]',
                'meta[property="og:description"]',
                'meta[name="twitter:description"]'
            ]);

            // Fallback 1: try known containers (Wikipedia, Medium, etc.)
            if (!description) {
                let paragraphs = [];
                // Try Wikipedia container first.
                const wikiParas = document.querySelectorAll('.mw-parser-output p');
                if (wikiParas.length > 0) {
                    paragraphs = Array.from(wikiParas);
                } else {
                    // Try generic article container (commonly used in Medium)
                    const articleParas = document.querySelectorAll('article p');
                    if (articleParas.length > 0) {
                        paragraphs = Array.from(articleParas);
                    }
                }
                // Filter out paragraphs that are too short or seem to contain inline CSS/code.
                const validParagraphs = paragraphs.filter(p => {
                    const text = p.textContent ? p.textContent.trim() : "";
                    return text.length > 50 && !text.includes("{") && !text.includes("}");
                });
                if (validParagraphs.length > 0) {
                    description = validParagraphs[0].textContent.trim();
                }
            }
            
            // Fallback 2: if still no description, check for an <article> element and use its inner text (truncated).
            if (!description) {
                const article = document.querySelector('article');
                if (article && article.innerText) {
                    const text = article.innerText.trim();
                    if (text.length > 100) {
                        description = text.substring(0, 300) + "...";
                    } else {
                        description = text;
                    }
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
