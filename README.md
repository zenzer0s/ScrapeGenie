# **🧞 ScrapeGenie - Intelligent URL Scraper & Telegram Bot**

ScrapeGenie is a powerful **URL scraping system with Telegram integration** that intelligently extracts rich metadata from **YouTube, Instagram, Pinterest, and general websites**. The backend leverages **Puppeteer and Axios** for efficient web scraping, while the Telegram bot delivers beautifully formatted results with interactive inline actions.

## **🚀 Features**

✅ **Multi-Platform Scraping Engine** - Extracts content from YouTube, Instagram, Pinterest, and general websites  
✅ **Rich Metadata Extraction** - Titles, descriptions, thumbnails, author information, and more  
✅ **Resource-Optimized Architecture** - Browser instance pooling and reuse for improved performance  
✅ **Elegant Telegram Interface** - Clean formatting with inline buttons for enhanced user experience  
✅ **System Health Monitoring** - Track resource usage with the `/usage` command  
✅ **Extensible Modular Design** - Easily add support for additional platforms  
✅ **Comprehensive Logging** - Detailed logs for both the bot and server components  
✅ **Advanced Error Recovery** - Automatic system recovery and reconnection
✅ **Pinterest Integration** - High-quality Pinterest image extraction
✅ **Instagram Content Analysis** - Determine post types and extract media
✅ **Optimized Media Processing** - Fast and efficient media URL extraction
✅ **Centralized Session Management** - Persistent authentication across restarts

## **⚙️ Installation**

For a quick setup, use the provided installation script:

```sh
git clone <repository-url>
cd ScrapeGenie
chmod +x install.sh
./install.sh
```

## **🛠️ Configuration**

Open .env and configure the following required parameter:

```env
# Required Setting
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

## **📱 Using the Telegram Bot**

1. Start a chat with your bot on Telegram (@YourBotUsername)
2. Send a URL from YouTube, Instagram, Pinterest, or any website
3. The bot will extract and display the content in a nicely formatted message
4. Use the inline buttons to access additional features

### **Available Commands**

- `/start` - Introduction to the bot
- `/help` - Display available commands
- `/status` - Check connection status to backend
- `/usage` - Check system resource usage
- `/about` - Information about ScrapeGenie

## **🔍 How It Works**

1. When a URL is sent to the bot, it forwards the request to the backend
2. The backend identifies the URL type and selects the appropriate scraper
3. Puppeteer or Axios is used to fetch and extract the data
4. The extracted metadata is formatted and returned to the bot
5. The bot presents the information in a user-friendly format

## **📝 License**

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

Similar code found with 2 license types