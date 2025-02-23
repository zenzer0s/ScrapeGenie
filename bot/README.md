### README for Bot

```markdown
# ScrapeGenie Bot

This is the Telegram bot for ScrapeGenie. It receives URLs from users, sends them to the backend for scraping, and then presents the extracted data in a clean, formatted message.

## Features

- **Command Handlers:**  
  - `/start`: Welcomes the user.  
  - `/help`: Displays a detailed help guide.  
  - `/status`: Checks the bot and backend status.  
  - `/usage`: Reports system resource usage.
- **Message Processing:**  
  - Delegates URL message processing to a dedicated module (`messageHandler.js`).  
  - Formats messages using Markdown and inline keyboards for interactive actions.
- **Modular Design:**  
  - Command logic is centralized in `bot/commands.js`.  
  - URL scraping results are processed in `bot/messageHandler.js`.

## Project Structure

```
bot/
├── bot.js                 # Bot entry point (initializes the bot and registers handlers)
├── commands.js            # Command handlers (/start, /help, /status, /usage)
└── messageHandler.js      # URL message processing and scraping result handling
```

## Setup and Installation

1. **Clone the Repository:**
   ```sh
   git clone <repository-url>
   cd ScrapeGenie
   ```

2. **Install Dependencies:**
   (If you’re using a single package.json at the root or separate ones, adjust accordingly.)
   ```sh
   npm install
   ```

3. **Configure Environment:**

   Create a `.env` file at the project root with your bot token and backend URL:
   ```env
   TELEGRAM_BOT_TOKEN=your-telegram-bot-token
   BACKEND_URL=http://localhost:5000
   ```

4. **Run the Bot:**
   ```sh
   node bot/bot.js
   ```
   The bot will start polling for messages and respond to commands.

## Testing the Bot

- Use the `/start`, `/help`, `/status`, and `/usage` commands to verify functionality.
- Send various URLs (YouTube, Instagram, and website links) to see how the bot processes and formats the responses.

## Additional Recommendations

- **UI/UX Enhancements:**  
  The bot leverages Markdown and inline keyboards for a better user experience. Future enhancements may include better error messages, loading animations, and caching.
- **Modularity:**  
  The separation between commands and message processing improves maintainability and scalability.
- **Logging:**  
  Consider integrating a robust logging mechanism to capture errors and usage patterns.
- **Future Scalability:**  
  As the project grows, you may split the bot and backend into separate services and integrate CI/CD pipelines for testing.

Feel free to adjust this README as your project evolves and new features are added.
```

---

### Git Commit Command (Multiple Commits in Loop)

You can commit these changes separately using:

```sh
git add backend/README.md
git commit -m "Add README for backend with structure and configuration details"

git add bot/README.md
git commit -m "Add README for bot with commands and message processing details"

git push origin main
```

These README files provide a clear, organized overview of each component and incorporate recommendations for scalability, documentation, and code quality. Let me know if you need any further changes!