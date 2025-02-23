import puppeteer from 'puppeteer';

const scrapeInstagramReel = async (url) => {
    if (!url.includes('instagram.com/reel/')) {
        return { error: 'Invalid Instagram Reel URL' };
    }
    
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        
        // Extract video URL
        const videoSrc = await page.evaluate(() => {
            const videoElement = document.querySelector('video');
            return videoElement ? videoElement.src : null;
        });
        
        await browser.close();
        
        if (!videoSrc) {
            return { error: 'Failed to extract video URL' };
        }
        
        return { videoUrl: videoSrc };
    } catch (error) {
        await browser.close();
        return { error: 'Failed to scrape Instagram Reel' };
    }
};

export default scrapeInstagramReel;
