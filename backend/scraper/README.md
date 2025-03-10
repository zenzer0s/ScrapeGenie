# ScrapeGenie Scraper

The `scraper` module in ScrapeGenie is responsible for extracting data from various online sources such as YouTube, Instagram, Pinterest, and general websites. It utilizes Puppeteer for browser-based scraping and Axios for API-based extraction where applicable.

## **Features**
- **Modular Scrapers:**  
  - YouTube scraper (`ytScraper.js`)  
  - Instagram scraper (`instaScraper.js`) 
  - Pinterest scraper (`pinterestScraper.js`)
  - General website metadata scraper (`metadata.js`)
- **Browser Management:**  
  - Uses a shared Puppeteer browser instance for efficiency via `browserManager.js`
  - Manages different scraper instances with `scraperManager.js`
- **Optimized Extraction:**  
  - Selects only necessary DOM elements to reduce processing time
  - Advanced handling for platform-specific content

---

## **Project Structure**
```
scraper/
├── browserManager.js    # Manages Puppeteer browser instances
├── helpers.js           # Helper functions for scrapers
├── instaDownloader.py   # Python script for Instagram downloads
├── instaScraper.js      # Instagram-specific scraper
├── metadata.js          # General website metadata scraper
├── pinterestScraper.js  # Pinterest-specific scraper
├── README.md            # This documentation file
├── scraper.js           # Core scraping logic
├── scraperManager.js    # Manages different scraper instances
└── ytScraper.js         # YouTube-specific scraper
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
- Uses YouTube's Open Graph metadata (`og:title`, `og:image`) for quick scraping.  
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
- Extracts media URL and captions while ignoring unnecessary data.
- Works with `instaDownloader.py` for specialized media extraction tasks.
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

### **4️⃣ pinterestScraper.js (Pinterest Scraper)**
🔹 **Purpose:**  
Extracts Pinterest images and pin details.  
🔹 **How It Works:**  
- Authenticates using `pinterest-auth.js` utilities when needed.
- Extracts high-quality image versions of pins.
- Handles both public pins and boards.
🔹 **Data Extracted:**  
- ✅ Pin Title/Description  
- ✅ High-resolution Image URL  
- ✅ Original Pin URL  
🔹 **Example Response:**
```json
{
  "title": "Modern Interior Design Ideas",
  "mediaUrl": "https://i.pinimg.com/originals/XX/YY/ZZ.jpg",
  "originalUrl": "https://www.pinterest.com/pin/123456789012345678/",
  "type": "pinterest"
}
```

---

### **5️⃣ metadata.js (General Website Scraper)**
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

### **6️⃣ scraperManager.js**
🔹 **Purpose:**  
Manages different scraper instances and their allocation.
🔹 **Key Features:**  
- Dynamically selects the appropriate scraper based on URL patterns.
- Handles scraper lifecycle and resource management.
- Implements fallback mechanisms when primary extraction methods fail.
🔹 **Usage:**  
Used by the main API routes to coordinate scraping activities.

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

✅ **Scraper Management:**  
`scraperManager.js` efficiently allocates resources for different scraper types.

✅ **Efficient Selectors:**  
Each scraper extracts only the necessary elements to minimize processing time.

✅ **Fallback Handling:**  
If metadata is missing, scrapers use alternative strategies to fetch data.

✅ **Python Integration:**  
Uses specialized Python scripts for tasks better suited to Python libraries.

---

## **Future Improvements**
🚀 **Headless Mode:**  
Consider running Puppeteer in headless mode for additional performance gains.

🚀 **Asynchronous Queue:**  
A job queue could manage concurrent scraping requests for better load management.

🚀 **Enhanced Error Handling:**  
Logging and monitoring tools could be added to track failures.

🚀 **Caching System:**  
Implement caching to reduce redundant scraping of frequently accessed content.

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