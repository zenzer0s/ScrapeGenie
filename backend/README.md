# ScrapeGenie Backend

This is the backend service for ScrapeGenie. It provides an API for scraping data from various sources (YouTube, Instagram, and general websites) and returns structured metadata that the bot consumes.

## Features

- **Scraping Modules:**  
  - `ytScraper.js`: Extracts YouTube video details (title, thumbnail URL).  
  - `instaScraper.js`: Retrieves Instagram post/reel information (caption, media URL).  
  - `metadata.js`: Scrapes generic website metadata (title, description, preview, etc.).
- **Browser Management:**  
  Utilizes Puppeteer with a shared browser instance for efficient resource usage.
- **Testing:**  
  Contains unit and integration tests in `backend/tests/`.

## Project Structure

```
backend/
├── routes/
│   ├── aiRoutes.js         # (if applicable)
│   └── scrape.js           # API route for scraping requests
├── scraper/
│   ├── browserManager.js   # Manages the Puppeteer browser instance
│   ├── helpers.js          # Helper functions used by scrapers
│   ├── instaScraper.js     # Instagram scraping logic
│   ├── metadata.js         # General website metadata scraper
│   ├── scraper.js          # (Additional scraping logic)
│   └── ytScraper.js        # YouTube scraping logic
├── server.js               # Main Express server file
├── tests/
│   ├── api.test.js         # API tests
│   └── scraper.test.js     # Scraper tests
└── utils/
    └── helpers.js          # Shared utility functions
```

## Setup and Installation

1. **Clone the Repository:**
   ```sh
   git clone <repository-url>
   cd ScrapeGenie/backend
   ```

2. **Install Dependencies:**
   ```sh
   npm install
   ```

3. **Configure Environment:**
   Create a `.env` file in the `backend` folder (this file should be in your `.gitignore`):
   ```env
   PORT=5000
   # Add any additional backend-specific environment variables here
   ```

4. **Run the Server:**
   ```sh
   npm start
   ```
   The server will run on the port specified in your `.env` file (default is 5000).

## Testing

To run tests:
```sh
npm test
```
