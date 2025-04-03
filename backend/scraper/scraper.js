const { getPage, releasePage } = require('./browserManager');
const { scrapePinterest } = require('./pinterestScraper'); // Import the scrapePinterest function

async function scrapeWebsite(url) {
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return {
      type: 'website',
      title: 'Invalid URL',
      content: '',
      originalUrl: url
    };
  }

  let page = null;
  try {
    page = await getPage();
    
    await page.setViewport({width: 1280, height: 800});
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    const metadata = await page.evaluate(() => {
      // Get title with fallbacks
      let title = '';
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle?.content) {
        title = ogTitle.content.trim();
      } else if (document.title) {
        title = document.title.split(/[\|\-–—]/)[0].trim();
      } else {
        const h1 = document.querySelector('h1');
        if (h1) title = h1.innerText.trim();
      }
      
      // Get content with fallbacks
      let content = '';
      
      // Try meta description first
      const metaDesc = document.querySelector('meta[name="description"]') || 
                       document.querySelector('meta[property="og:description"]');
      if (metaDesc?.content) {
        content = metaDesc.content.trim();
      }
      // Handle Wikipedia specially
      else if (window.location.hostname.includes('wikipedia')) {
        const firstParagraph = document.querySelector('.mw-parser-output > p');
        if (firstParagraph) content = firstParagraph.innerText.trim();
      }
      // Find first meaningful paragraph
      else {
        const contentSelectors = [
          'article p', 'main p', '#content p', '.content p', 
          '[itemprop="articleBody"] p', '.entry-content p', 'p'
        ];
        
        for (const selector of contentSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.innerText.trim();
            if (text.length > 50 && !/^\d+/.test(text)) {
              content = text;
              break;
            }
          }
          if (content) break;
        }
      }
      
      // Limit content length
      if (content) {
        const words = content.split(/\s+/);
        if (words.length > 30) {
          content = words.slice(0, 30).join(' ') + '...';
        }
      }
      
      return { title, content, originalUrl: window.location.href };
    });
    
    return {
      type: 'website',
      title: metadata.title || new URL(url).hostname,
      content: metadata.content || "", 
      originalUrl: metadata.originalUrl || url
    };
  } catch (error) {
    return {
      type: 'website',
      title: new URL(url).hostname,
      content: "",
      originalUrl: url
    };
  } finally {
    if (page) await releasePage(page);
  }
}

async function scrapeMetadata(url) {
  let page = null;
  try {
    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      throw new Error("Invalid URL provided");
    }

    page = await getPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

    const metadata = await page.evaluate(() => {
      const title = document.title || "No Title";
      const descriptionTag = document.querySelector('meta[name="description"]');
      const description = descriptionTag ? descriptionTag.content : "No Description";
      return { title, description };
    });

    return metadata;
  } catch (error) {
    return { error: error.message };
  } finally {
    if (page) await releasePage(page);
  }
}

module.exports = { scrapeMetadata, scrapeWebsite };
