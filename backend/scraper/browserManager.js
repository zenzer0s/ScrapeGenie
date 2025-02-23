const puppeteer = require("puppeteer");

let browserInstance;

async function getBrowser() {
    if (!browserInstance) {
        browserInstance = await puppeteer.launch({
            headless: "new",  // Use improved headless mode
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--disable-gpu"
            ]
        });
    }
    return browserInstance;
}

module.exports = getBrowser;
