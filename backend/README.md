# ScrapeGenie Backend

This is the backend service for ScrapeGenie. It provides APIs for scraping data from various platforms (YouTube, Instagram, Pinterest, and general websites) and returns structured metadata that the bot consumes.

## Features

- **Scraping Modules:**  
  - `ytScraper.js`: Extracts YouTube video details (title, thumbnail URL)
  - `instaScraper.js`: Retrieves Instagram post/reel information (caption, media URL)
  - `pinterestScraper.js`: Extracts Pinterest images and pin details
  - `metadata.js`: Scrapes generic website metadata (title, description, preview, etc.)
- **Authentication System:**  
  - Pinterest login integration via `pinterest-auth.js`
  - Session management with `sessionManager.js`
- **Multi-platform Support:**
  - Instagram downloader with Python utility (`instaDownloader.py`)
  - YouTube content extraction
  - Pinterest image quality optimization
- **Browser Management:**  
  - Utilizes Puppeteer with shared browser instance via `browserManager.js`
  - Advanced scraper management with `scraperManager.js`

## Project Structure

```
backend/
├── public/
│   └── pinterest-login.html  # Pinterest authentication interface
├── routes/
│   ├── auth.js               # Authentication endpoints
│   └── scrape.js             # Scraping API endpoints
├── scraper/
│   ├── browserManager.js     # Manages Puppeteer browser instances
│   ├── helpers.js            # Helper functions for scrapers
│   ├── instaDownloader.py    # Python script for Instagram downloads
│   ├── instaScraper.js       # Instagram-specific scraper
│   ├── metadata.js           # General website metadata scraper
│   ├── pinterestScraper.js   # Pinterest-specific scraper
│   ├── README.md             # Detailed scraper documentation
│   ├── scraper.js            # Core scraping logic
│   ├── scraperManager.js     # Manages different scraper instances
│   └── ytScraper.js          # YouTube-specific scraper
├── services/
│   └── sessionManager.js     # Manages user sessions
├── tests/
│   ├── test-pinterest-image-refined.js  # Pinterest image quality tests
│   └── test-pinterest-quality.js        # Pinterest content tests
├── utils/
│   ├── helpers.js            # General utility functions
│   └── pinterest-auth.js     # Pinterest authentication utilities
├── README.md                 # This documentation file
└── server.js                 # Main Express server file
```

## Scraper Functionality

### YouTube Scraper
- Extracts video title, thumbnail URL, and video details
- Uses Open Graph metadata for quick scraping
- Falls back to Puppeteer for HTML-based scraping when needed

### Instagram Scraper
- Extracts captions, media URLs (images/videos)
- Determines post type (photo, reel)
- Works with both public and private posts (when authenticated)

### Metadata Scraper
- Fetches title, description, and preview images from general websites
- Uses Open Graph and meta tags when available
- Has fallback mechanisms for sites with limited metadata

## Performance Considerations

The backend uses several optimization techniques:
- Shared browser instance via `browserManager.js` to reduce CPU/memory usage
- Scraper management for efficient resource allocation
- Session persistence for faster authentication
- Python integration for specialized tasks
- Efficient DOM selectors to minimize processing time
- Fallback strategies when primary extraction methods fail

## Future Improvements

- Add support for additional platforms (TikTok, Twitter, etc.)
- Implement caching to reduce redundant scraping
- Add rate limiting to prevent abuse
- Enhance error reporting and monitoring
- Implement asynchronous queue for better load management
- Add logging and monitoring tools to track failures