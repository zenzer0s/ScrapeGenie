const { getPage, releasePage } = require('./browserManager');

async function scrapeMetadata(url) {
    if (!url || typeof url !== "string" || !url.startsWith("http")) {
        return { success: false, error: "Invalid URL provided" };
    }

    let page = null;
    try {
        page = await getPage();

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/91.0.4472.124 Safari/537.36'
        );

        await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });

        const metadata = await page.evaluate(() => {
            const getMetaContent = (selectors) => {
                for (let selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element && element.content && element.content.trim()) return element.content.trim();
                }
                return null;
            };

            let description = getMetaContent([
                'meta[name="description"]',
                'meta[property="og:description"]',
                'meta[name="twitter:description"]'
            ]);

            if (!description) {
                const containers = [
                    '.mw-parser-output p',  // Wikipedia
                    'article p',            // Blog articles
                    '.content p',           // Common content containers
                    'main p'                // Main content area
                ];
                
                for (const selector of containers) {
                    const elements = document.querySelectorAll(selector);
                    const validParagraphs = Array.from(elements).filter(p => {
                        const text = p.textContent?.trim() || "";
                        return text.length > 50 && !text.includes("{") && !text.includes("}");
                    });
                    
                    if (validParagraphs.length > 0) {
                        description = validParagraphs[0].textContent.trim();
                        break;
                    }
                }
            }
            
            if (!description) {
                const article = document.querySelector('article');
                if (article?.innerText) {
                    const text = article.innerText.trim();
                    description = text.length > 100 ? text.substring(0, 300) + "..." : text;
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
        return {
            success: false,
            error: error.message
        };
    } finally {
        if (page) await releasePage(page);
    }
}

module.exports = { scrapeMetadata };
