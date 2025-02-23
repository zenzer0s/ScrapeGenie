### **README for Scraper (`backend/scraper/README.md`)**

```markdown
# ScrapeGenie Scraper

The `scraper` module in ScrapeGenie is responsible for extracting data from various online sources such as YouTube, Instagram, and general websites. It utilizes Puppeteer for browser-based scraping and Axios for API-based extraction where applicable.

## **Features**
- **Modular Scrapers:**  
  - YouTube scraper (`ytScraper.js`)  
  - Instagram scraper (`instaScraper.js`)  
  - General website metadata scraper (`metadata.js`)
- **Browser Management:**  
  - Uses a shared Puppeteer browser instance for efficiency.
  - Limits concurrent scrapers to reduce resource usage.
- **Optimized Extraction:**  
  - Selects only necessary DOM elements to reduce processing time.
  - Blocks unnecessary resources (optional, for performance).

---

## **Project Structure**
```
scraper/
├── browserManager.js  # Manages Puppeteer instance (singleton browser for efficiency)
├── helpers.js         # Helper functions shared across scrapers
├── instaScraper.js    # Scrapes Instagram posts & reels
├── metadata.js        # Extracts title, description, and metadata from websites
├── scraper.js         # (If additional scraping logic exists)
└── ytScraper.js       # Scrapes YouTube video details
```

---

## **Scraper Descriptions**
### **1️⃣ browserManager.js**
🔹 **Purpose:**  
Manages the Puppeteer instance to avoid creating a new browser every request.  
🔹 **Key Features:**  
- Reuses a single browser instance across all scrapers.  
- Restarts the browser periodically to prevent memory leaks.  
🔹 **Usage:**  
Used internally by all scrapers when they require a Puppeteer page.

---

### **2️⃣ ytScraper.js (YouTube Scraper)**
🔹 **Purpose:**  
Fetches YouTube video details (title, thumbnail, etc.).  
🔹 **How It Works:**  
- Uses YouTube’s Open Graph metadata (`og:title`, `og:image`) for quick scraping.  
- If metadata is unavailable, falls back to Puppeteer for HTML-based scraping.  
🔹 **Data Extracted:**  
- ✅ Video Title  
- ✅ Thumbnail URL  
- ✅ Video URL  
🔹 **Example Response:**
```json
{
  "title": "Amazing Tech Video",
  "mediaUrl": "https://i.ytimg.com/vi/XYZ123/maxresdefault.jpg",
  "originalUrl": "https://www.youtube.com/watch?v=XYZ123",
  "type": "youtube"
}
```

---

### **3️⃣ instaScraper.js (Instagram Scraper)**
🔹 **Purpose:**  
Extracts details from Instagram posts and reels.  
🔹 **How It Works:**  
- Uses Puppeteer to load Instagram posts since they require authentication.  
- Extracts media URL and captions while ignoring unnecessary data (e.g., likes, comments).  
🔹 **Data Extracted:**  
- ✅ Caption  
- ✅ Media URL (image or video)  
- ✅ Post Type (Photo, Reel)  
🔹 **Example Response:**
```json
{
  "caption": "📸 Beautiful sunset view!",
  "mediaUrl": "https://instagram.com/media/example.jpg",
  "originalUrl": "https://www.instagram.com/p/ABC123/",
  "type": "instagram",
  "contentType": "post"
}
```

---

### **4️⃣ metadata.js (General Website Scraper)**
🔹 **Purpose:**  
Fetches metadata (title, description, and preview) from general websites.  
🔹 **How It Works:**  
- Uses Open Graph (`og:title`, `og:description`) and meta tags when available.  
- If no metadata is found, selects the first meaningful `<p>` tag as a fallback description.  
🔹 **Data Extracted:**  
- ✅ Page Title  
- ✅ Description  
- ✅ Thumbnail (if available)  
🔹 **Example Response:**
```json
{
  "title": "Breaking News - Tech Innovation",
  "description": "A new breakthrough in AI has been announced...",
  "mediaUrl": "https://example.com/thumbnail.jpg",
  "originalUrl": "https://example.com/article",
  "type": "website"
}
```

---

## **Usage & Integration**
These scrapers are used internally by the backend. The `scrape.js` route handles incoming scraping requests and delegates them to the appropriate scraper module.

**Example API Call:**
```sh
curl -X POST http://localhost:5000/api/scrape -H "Content-Type: application/json" -d '{"url": "https://www.youtube.com/watch?v=XYZ123"}'
```

**Example Response:**
```json
{
  "title": "Amazing Tech Video",
  "mediaUrl": "https://i.ytimg.com/vi/XYZ123/maxresdefault.jpg",
  "originalUrl": "https://www.youtube.com/watch?v=XYZ123",
  "type": "youtube"
}
```

---

## **Performance Optimizations**
✅ **Reused Browser Instance:**  
All scrapers share a single Puppeteer instance via `browserManager.js` to reduce CPU/memory usage.

✅ **Efficient Selectors:**  
Each scraper extracts only the necessary elements to minimize processing time.

✅ **Fallback Handling:**  
If metadata is missing, scrapers use alternative strategies to fetch data.

---

## **Future Improvements**
🚀 **Headless Mode:**  
Consider running Puppeteer in headless mode for additional performance gains.

🚀 **Asynchronous Queue:**  
A job queue (e.g., Bull.js) could manage concurrent scraping requests for better load management.

🚀 **Enhanced Error Handling:**  
Logging and monitoring tools (like Sentry) could be added to track failures.

---

## **Contributing**
Feel free to improve the scraping logic by:
- Enhancing selectors for better accuracy.
- Adding caching to avoid unnecessary repeated scraping.
- Improving efficiency with batch processing where possible.

---

## **Final Notes**
This scraper module is optimized for local use but can be scaled if needed. If deploying on a server, consider resource monitoring and rate limiting to prevent excessive browser instances.

For any issues, feel free to contribute or report bugs. 🚀
