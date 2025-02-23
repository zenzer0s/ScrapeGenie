const puppeteer = require('puppeteer');

async function instaScraper(postUrl) {
    if (!postUrl.includes('instagram.com/p/') && !postUrl.includes('instagram.com/reel/')) {
        return { error: "Invalid Instagram URL" };
    }

    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });
    
    try {
        const page = await browser.newPage();
        
        // Set user agent to avoid detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Navigate to the page and wait for content
        await page.goto(postUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        
        // Wait for critical elements
        await page.waitForSelector('meta[property="og:image"]', { timeout: 5000 }).catch(() => null);
        await page.waitForSelector('meta[property="og:description"]', { timeout: 5000 }).catch(() => null);

        // Extract data
        const data = await page.evaluate(() => {
            return {
                imageUrl: document.querySelector('meta[property="og:image"]')?.content,
                videoUrl: document.querySelector('meta[property="og:video"]')?.content,
                description: document.querySelector('meta[property="og:description"]')?.content,
                title: document.querySelector('meta[property="og:title"]')?.content
            };
        });

        return {
            success: true,
            type: 'instagram',
            mediaUrl: data.videoUrl || data.imageUrl,
            description: data.description,
            title: data.title,
            originalUrl: postUrl
        };
    } catch (error) {
        console.error("Instagram Scrape Error:", error);
        return { success: false, error: "Failed to fetch Instagram content" };
    } finally {
        await browser.close();
    }
}