// instaScraper.js
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
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

        // Check if it's a Reel or Post
        const isReel = url.includes('/reel/');
        
        // Extract data based on content type
        const data = await page.evaluate(() => {
            const caption = document.querySelector('meta[property="og:description"]')?.content || '';
            const mediaUrl = document.querySelector('meta[property="og:image"]')?.content || 
                           document.querySelector('meta[property="og:video"]')?.content;
            
            return {
                caption,
                mediaUrl
            };
        });

        const response = {
            success: true,
            type: 'instagram',
            contentType: isReel ? 'reel' : 'post',
            caption: data.caption,
            originalUrl: url
        };

        // Only include mediaUrl for posts
        if (!isReel) {
            response.mediaUrl = data.mediaUrl;
        }

        return response;

    } catch (error) {
        console.error("Instagram Scrape Error:", error);
        return { 
            success: false, 
            error: "Failed to fetch Instagram content" 
        };
    }
};

module.exports = instaScraper;