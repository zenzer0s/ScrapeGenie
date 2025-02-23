// instaScraper.js
const puppeteer = require('puppeteer');
const getBrowser = require('./browserManager');

const instaScraper = async (url) => {
    if (!url.includes('instagram.com')) {
        return { 
            success: false, 
            error: "Invalid Instagram URL" 
        };
    }

    let browser = null;
    try {
        browser = await getBrowser();
        const page = await browser.newPage();
        
        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

        // Extract metadata
        const data = await page.evaluate(() => ({
            imageUrl: document.querySelector('meta[property="og:image"]')?.content,
            title: document.querySelector('meta[property="og:title"]')?.content,
            description: document.querySelector('meta[property="og:description"]')?.content
        }));

        return {
            success: true,
            type: 'instagram',
            title: data.title || null,
            description: data.description || null,
            mediaUrl: data.imageUrl || null,
            originalUrl: url
        };

    } catch (error) {
        console.error("Instagram Scrape Error:", error);
        return { 
            success: false, 
            error: "Failed to fetch Instagram content" 
        };
    }
};

module.exports = instaScraper;