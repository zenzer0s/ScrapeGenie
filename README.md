# **🧞‍♂️ ScrapeGenie - Intelligent URL Scraper & Telegram Bot**

ScrapeGenie is a powerful **URL scraping system with Telegram integration** that intelligently extracts rich metadata from **YouTube, Instagram, and general websites**. The backend leverages **Puppeteer and Axios** for efficient web scraping, while the Telegram bot delivers beautifully formatted results with interactive inline actions.

![ScrapeGenie Banner](https://via.placeholder.com/800x200?text=ScrapeGenie)

## **🚀 Features**

✅ **Multi-Platform Scraping Engine** - Extracts content from YouTube, Instagram, and general websites  
✅ **Rich Metadata Extraction** - Titles, descriptions, thumbnails, author information, and more  
✅ **Resource-Optimized Architecture** - Browser instance pooling and reuse for improved performance  
✅ **Elegant Telegram Interface** - Clean formatting with inline buttons for enhanced user experience  
✅ **System Health Monitoring** - Track resource usage with the `/usage` command  
✅ **Extensible Modular Design** - Easily add support for additional platforms  
✅ **Comprehensive Logging** - Detailed logs for both the bot and server components  

## **📂 Project Structure**

```
ScrapeGenie/
├── backend/                # Backend API & Scrapers
│   ├── routes/             # Express API routes
│   │   ├── aiRoutes.js     # AI-related routes
│   │   └── scrape.js       # Scraping endpoints
│   ├── scraper/            # Specialized scraping modules
│   │   ├── browserManager.js # Browser instance management
│   │   ├── helpers.js      # Scraper utility functions
│   │   ├── instaScraper.js # Instagram-specific scraper
│   │   ├── metadata.js     # Metadata extraction tools
│   │   ├── scraper.js      # Core scraping logic
│   │   └── ytScraper.js    # YouTube-specific scraper
│   ├── utils/              # Helper functions
│   │   └── helpers.js      # General utility functions
│   ├── README.md           # Backend documentation
│   └── server.js           # Main Express server
│
├── bot/                    # Telegram Bot
│   ├── bot.js              # Bot initialization
│   ├── commands.js         # Command handlers
│   ├── messageHandler.js   # URL processing & formatting
│   ├── logger.js           # Bot-specific logging
│   └── README.md           # Bot documentation
│
├── logs/                   # Application logs
│   ├── bot.log             # Telegram bot logs
│   └── server.log          # Backend server logs
│
├── .env                    # Environment configuration
├── example.env             # Example environment variables
├── install.sh              # Installation script
├── package.json            # Project dependencies
├── LICENSE                 # GNU AGPL v3 License
└── README.md               # Main documentation
```

## **⚙️ Installation**

### **Automatic Installation**

For a quick setup, use the provided installation script:

```sh
git clone <repository-url>
cd ScrapeGenie
chmod +x install.sh
./install.sh
```

### **Manual Installation**

1. **Clone the Repository**
   ```sh
   git clone <repository-url>
   cd ScrapeGenie
   ```

2. **Install Dependencies**
   ```sh
   npm install
   ```

3. **Configure Environment Variables**
   ```sh
   cp example.env .env
   # Edit .env with your configuration
   ```

## **🔧 Configuration**

Open `.env` and configure the following parameters:

```env
# Required Settings
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
PORT=5000

# Optional Settings
LOG_LEVEL=info                 # debug, info, warn, error
MAX_BROWSER_INSTANCES=3        # Number of concurrent browser instances
SCRAPE_TIMEOUT=30000           # Timeout in milliseconds
ENABLE_AI_FEATURES=false       # Enable AI-enhanced scraping
```

## **🚀 Running the Application**

### **Start the Backend Server**

```sh
npm run start:server
# or
node backend/server.js
```

### **Start the Telegram Bot**

```sh
npm run start:bot
# or
node bot/bot.js
```

### **Run Both Components**

```sh
npm run start
```

## **📱 Using the Telegram Bot**

1. Start a chat with your bot on Telegram (@YourBotUsername)
2. Send a URL from YouTube, Instagram, or any website
3. The bot will extract and display the content in a nicely formatted message
4. Use the inline buttons to access additional features

### **Available Commands**

- `/start` - Introduction to the bot
- `/help` - Display available commands
- `/usage` - Check system resource usage
- `/about` - Information about ScrapeGenie

## **🧩 API Endpoints**

The backend server exposes the following API endpoints:

- `POST /api/scrape` - Scrape content from a URL
- `GET /api/status` - Check the server status
- `POST /api/analyze` - AI-enhanced content analysis (if enabled)

## **🔍 How It Works**

1. When a URL is sent to the bot, it forwards the request to the backend
2. The backend identifies the URL type and selects the appropriate scraper
3. Puppeteer or Axios is used to fetch and extract the data
4. The extracted metadata is formatted and returned to the bot
5. The bot presents the information in a user-friendly format

## **🔧 Development**

### **Running in Development Mode**

```sh
npm run dev:server  # Start backend with hot-reload
npm run dev:bot     # Start bot with hot-reload
```

### **Testing**

```sh
npm test
```

### **Adding a New Scraper**

1. Create a new scraper file in `backend/scraper/`
2. Implement the scraping logic following the existing patterns
3. Register the new scraper in `backend/scraper/scraper.js`
4. Update the URL detection logic in the message handler

## **🚀 Future Enhancements**

- **Additional Platform Support**: Twitter, TikTok, Reddit, Pinterest
- **Media Download Options**: Direct download for images and videos
- **Content Summarization**: AI-powered summary of long articles
- **Search Functionality**: Search for content by keywords
- **User Preferences**: Customizable output formats and settings
- **Scheduled Scraping**: Monitor URLs for changes
- **Batch Processing**: Handle multiple URLs at once
- **Authentication Support**: Access content behind login walls
- **Webhook Integration**: Connect with other services
- **Advanced Caching**: Efficient storage and retrieval of scraped content

## **📄 License**

This project is licensed under the GNU AFFERO GENERAL PUBLIC LICENSE Version 3.

## **🤝 Contributing**

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Made with ❤️ by Praveen Zalaki**