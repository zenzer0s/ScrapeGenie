const puppeteer = require("puppeteer");
const { scrapePinterest } = require('./pinterestScraper'); // Import the scrapePinterest function

async function scrapeMetadata(url) {
    let browser;
    try {
        // Validate URL format
        if (!url || typeof url !== "string" || !url.startsWith("http")) {
            throw new Error("Invalid URL provided");
        }

        // Launch Puppeteer in headless mode
        browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        
        // Set a navigation timeout (15 seconds)
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

        // Extract metadata from the page
        const metadata = await page.evaluate(() => {
            const title = document.title || "No Title";
            const descriptionTag = document.querySelector('meta[name="description"]');
            const description = descriptionTag ? descriptionTag.content : "No Description";
            return { title, description };
        });

        return metadata;
    } catch (error) {
        console.error("Scraping error:", error);
        // Return error information so our API can relay it back
        return { error: error.message };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function scrapeWebsite(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: {width: 1280, height: 800}
    });
    
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    // Extract title and short description
    const metadata = await page.evaluate(() => {
      // Get title - try various methods
      let title = '';
      
      // 1. Try Open Graph title
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle && ogTitle.content) {
        title = ogTitle.content.trim();
      } 
      // 2. Try document title, but clean it
      else if (document.title) {
        // Remove common site name patterns (separated by | - — etc)
        title = document.title.split(/[\|\-–—]/)[0].trim();
      }
      // 3. Try h1 as last resort
      else {
        const h1 = document.querySelector('h1');
        if (h1) title = h1.innerText.trim();
      }
      
      // Get actual content description
      let content = '';
      
      // 1. Try meta description
      const metaDesc = document.querySelector('meta[name="description"]') || 
                       document.querySelector('meta[property="og:description"]');
      if (metaDesc && metaDesc.content) {
        content = metaDesc.content.trim();
      }
      // 2. For Wikipedia specifically
      else if (window.location.hostname.includes('wikipedia')) {
        const firstParagraph = document.querySelector('.mw-parser-output > p');
        if (firstParagraph) {
          content = firstParagraph.innerText.trim();
        }
      }
      // 3. Try to find first meaningful paragraph
      else {
        // Try various selectors for content areas
        const contentSelectors = [
          'article p', 'main p', '#content p', '.content p', 
          '[itemprop="articleBody"] p', '.entry-content p', 'p'
        ];
        
        for (const selector of contentSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.innerText.trim();
            // Skip very short paragraphs and ones with just dates or numbers
            if (text.length > 50 && !/^\d+/.test(text)) {
              content = text;
              break;
            }
          }
          if (content) break;
        }
      }
      
      // Limit content to ~30 words (approx 150-200 chars)
      if (content) {
        const words = content.split(/\s+/);
        if (words.length > 30) {
          content = words.slice(0, 30).join(' ') + '...';
        }
      }
      
      return { title, content };
    });
    
    return {
      type: 'website',
      title: metadata.title || new URL(url).hostname,
      content: metadata.content || "", // Return empty string instead of placeholder
      originalUrl: url
    };
  } catch (error) {
    console.error("Error scraping website:", error);
    return {
      type: 'website',
      title: new URL(url).hostname,
      content: "", // Empty string instead of error message
      originalUrl: url
    };
  } finally {
    if (browser) await browser.close();
  }
}

// ✅ Ensure this is correctly exported
module.exports = { scrapeMetadata, scrapePinterest, scrapeWebsite };
