const puppeteer = require("puppeteer");

let browserInstance = null;
let isLaunching = false;
const pagePool = [];
const MAX_PAGES = 3;

async function getBrowser() {
    if (browserInstance) return browserInstance;
    
    if (isLaunching) {
        await new Promise(resolve => {
            const check = () => browserInstance ? resolve() : setTimeout(check, 100);
            check();
        });
        return browserInstance;
    }
    
    try {
        isLaunching = true;
        browserInstance = await puppeteer.launch({
            headless: "new",
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--disable-gpu",
                "--disable-extensions",
                "--disable-component-extensions-with-background-pages",
                "--disable-default-apps",
                "--mute-audio"
            ]
        });
        
        browserInstance.on('disconnected', () => {
            browserInstance = null;
            isLaunching = false;
            pagePool.length = 0;
        });
        
        return browserInstance;
    } catch (error) {
        isLaunching = false;
        throw error;
    } finally {
        isLaunching = false;
    }
}

async function getPage() {
    const browser = await getBrowser();
    
    if (pagePool.length > 0) {
        const page = pagePool.pop();
        await page.goto('about:blank');
        return page;
    }
    
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
        const resourceType = request.resourceType();
        ['image', 'font', 'media'].includes(resourceType) 
            ? request.abort() 
            : request.continue();
    });
    
    return page;
}

async function releasePage(page) {
    if (!page) return;
    
    try {
        await page.removeAllListeners();
        await page.goto('about:blank');
        
        pagePool.length < MAX_PAGES ? pagePool.push(page) : await page.close();
    } catch (error) {
        try {
            await page.close();
        } catch {
            // Silent failure on forced close
        }
    }
}

async function closeBrowser() {
    if (browserInstance) {
        try {
            await browserInstance.close();
        } finally {
            browserInstance = null;
            pagePool.length = 0;
        }
    }
}

process.on('SIGINT', async () => {
    await closeBrowser();
    process.exit();
});

module.exports = { getBrowser, getPage, releasePage, closeBrowser };
