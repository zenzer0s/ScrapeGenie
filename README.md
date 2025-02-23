### **📜 ScrapeGenie - Smart URL Scraper & Telegram Bot**  

ScrapeGenie is a powerful **URL scraper and Telegram bot** that extracts metadata from **YouTube, Instagram, and general websites**. The backend uses **Puppeteer and Axios** for efficient data scraping, while the bot delivers formatted results with inline actions.

---

## **🚀 Features**
✅ **Scrapes YouTube, Instagram, and Websites** (Extracts titles, captions, images, and links).  
✅ **Optimized Puppeteer Scraping** (Reuses browser instances to save resources).  
✅ **Modular and Maintainable Codebase** (Separate logic for backend, bot, and scrapers).  
✅ **Inline Buttons & Markdown Formatting** for a clean Telegram bot UI.  
✅ **System Monitoring** (`/usage` command to check memory and CPU usage).  
✅ **Extensible Design** (Easily add more scrapers for other platforms).  

---

## **📂 Project Structure**
```
ScrapeGenie/
├── backend/                # Backend API & Scrapers
│   ├── routes/             # Express API routes
│   ├── scraper/            # All scraping modules (YouTube, Instagram, Websites)
│   ├── tests/              # Unit & integration tests
│   ├── utils/              # Helper functions
│   ├── server.js           # Main Express server
│   ├── package.json        # Backend dependencies
│   └── README.md           # Backend documentation
│
├── bot/                    # Telegram Bot
│   ├── bot.js              # Bot initialization
│   ├── commands.js         # Command handlers
│   ├── messageHandler.js   # URL processing & response formatting
│   ├── package.json        # Bot dependencies (if separate)
│   └── README.md           # Bot documentation
│
├── example.env             # Example environment variables
├── package.json            # Root dependencies (if unified)
├── package-lock.json
├── README.md               # Main documentation (this file)
└── .gitignore              # Files to exclude from Git
```

---

## **⚙️ Setup & Installation**
### **1️⃣ Clone the Repository**
```sh
git clone <repository-url>
cd ScrapeGenie
```

### **2️⃣ Install Dependencies**
If you're using a **single package.json at the root**, install all dependencies at once:
```sh
npm install
```
If the **backend has a separate package.json**, navigate to `backend/` and install:
```sh
cd backend
npm install
cd ..
```
If the **bot has a separate package.json**, navigate to `bot/` and install:
```sh
cd bot
npm install
cd ..
```

---

## **📄 Environment Configuration**
1. Copy the example environment file:
   ```sh
   cp example.env .env
   ```
2. Open `.env` and add your configurations:
   ```env
   TELEGRAM_BOT_TOKEN=your-telegram-bot-token
   BACKEND_URL=http://localhost:5000
   PORT=5000
   ```

---

## **🚀 Running the Backend**
1. Start the backend server:
   ```sh
   cd backend
   npm start
   ```
2. The backend should be running at `http://localhost:5000`.

---

## **🤖 Running the Telegram Bot**
1. Start the bot:
   ```sh
   cd bot
   node bot.js
   ```
2. Your Telegram bot should now be active and responding to commands.

---

## **✅ Testing**
Run backend tests:
```sh
cd backend
npm test
```
Run bot tests (if applicable):
```sh
cd bot
npm test
```

---

## **🛠️ Development & Contributing**
### **Folder Structure & Best Practices**
- Keep scrapers inside `backend/scraper/`.
- Use `bot/commands.js` for bot commands.
- Use `bot/messageHandler.js` for handling URLs.
- Separate helper functions inside `backend/utils/`.

### **Contributions**
1. **Fork the repository**
2. **Create a new branch**  
   ```sh
   git checkout -b feature-your-feature
   ```
3. **Commit your changes**  
   ```sh
   git commit -m "Add feature: your-feature"
   ```
4. **Push the branch**  
   ```sh
   git push origin feature-your-feature
   ```
5. **Submit a pull request** 🚀

---

## **📖 Future Improvements**
- **Add More Scrapers**: Twitter, Reddit, and TikTok support.
- **Improve Caching**: Store recently scraped results for efficiency.
- **Enhance Bot UI**: Add buttons for advanced actions.
- **Deploy to Cloud**: Run the bot and backend on a scalable server.

---

## **📜 License**
This project is licensed under the MIT License.

---

### **🎉 Happy Scraping with ScrapeGenie! 🚀**
