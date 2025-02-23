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

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/91.0.4472.124 Safari/537.36'
    );
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Determine if it's a Reel or Post
    const isReel = url.includes('/reel/');

    // Extract caption using meta tag
    const metaData = await page.evaluate(() => {
      const caption = document.querySelector('meta[property="og:description"]')?.content || '';
      return { caption };
    });

    let cleanCaption = metaData.caption;

    // Clean the caption differently for reels and posts
    if (isReel) {
      // For reels, try extracting text within quotes first
      const quoteMatch = cleanCaption.match(/"([^"]+)"/);
      if (quoteMatch && quoteMatch[1]) {
        cleanCaption = quoteMatch[1].trim();
      } else {
        // Fallback: remove leading metadata by finding the first colon
        const colonIndex = cleanCaption.indexOf(':');
        if (colonIndex !== -1) {
          cleanCaption = cleanCaption.substring(colonIndex + 1).trim();
        }
      }
    } else {
      // For posts, the logic we already had
      const quoteMatch = cleanCaption.match(/"([^"]+)"/);
      if (quoteMatch && quoteMatch[1]) {
        cleanCaption = quoteMatch[1].trim();
      } else {
        const colonIndex = cleanCaption.indexOf(':');
        if (colonIndex !== -1) {
          cleanCaption = cleanCaption.substring(colonIndex + 1).trim();
        }
      }
    }

    // For posts, attempt to get full image URL
    let fullImageUrl = null;
    if (!isReel) {
      try {
        fullImageUrl = await page.evaluate(() => {
          const scripts = Array.from(document.getElementsByTagName('script'));
          const sharedDataScript = scripts.find(script =>
            script.textContent.includes('window._sharedData')
          );
          if (sharedDataScript) {
            const jsonText = sharedDataScript.textContent.match(/window\._sharedData\s*=\s*(\{.+\});/);
            if (jsonText && jsonText[1]) {
              const data = JSON.parse(jsonText[1]);
              const media = data.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
              if (media && media.display_url) {
                return media.display_url;
              }
            }
          }
          return null;
        });
      } catch (err) {
        console.error("Error extracting full image URL via JSON:", err);
      }

      // Fallback: extract best image from within the main post container
      if (!fullImageUrl) {
        try {
          fullImageUrl = await page.evaluate(() => {
            const postContainer = document.querySelector('article');
            if (postContainer) {
              const imgs = Array.from(postContainer.querySelectorAll('img'));
              if (imgs.length) {
                const maxImg = imgs.reduce((prev, curr) => {
                  return (prev.naturalWidth > curr.naturalWidth) ? prev : curr;
                });
                return maxImg.src;
              }
            }
            return null;
          });
        } catch (err) {
          console.error("Error extracting full image URL via fallback:", err);
        }
      }
    }

    const response = {
      success: true,
      type: 'instagram',
      contentType: isReel ? 'reel' : 'post',
      caption: cleanCaption,
      originalUrl: url
    };

    if (!isReel) {
      response.mediaUrl = fullImageUrl;
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
