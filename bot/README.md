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
- **Logging System:**
  - Advanced error tracking with dedicated logs
  - Request/response logging for debugging
- **Modular Design:**  
  - Command logic is centralized in commands.js.  
  - URL scraping results are processed in messageHandler.js.
  - Logging functionality in logger.js

## Project Structure

```
bot/
├── bot.js                 # Bot entry point (initializes the bot and registers handlers)
├── commands.js            # Command handlers (/start, /help, /status, /usage)
├── logger.js              # Logger configuration and utility functions
├── messageHandler.js      # URL message processing and scraping result handling
├── bot-error.log          # Error log file for the bot
└── README.md              # This documentation file
```

## Bot Functionality

### Message Processing
When a user sends a URL, the bot:
1. Validates the URL format
2. Sends the URL to the backend for scraping
3. Formats the response based on content type (YouTube, Instagram, Pinterest, or general website)
4. Presents the extracted data with appropriate formatting and inline controls

### Logging
The bot implements a robust logging system:
- Error logging to `bot-error.log`
- Integration with the central logging system in bot.log
- Different log levels based on environment (development/production)

### Error Handling
The bot includes comprehensive error handling:
- Connection issues with the backend
- Invalid URL formats
- Unsupported platforms
- Timeout handling for slow responses

## Integration with Backend

The bot communicates with the backend server through REST API calls:
- Scraping requests to `/api/scrape`
- Health checks to `/health`
- Session status verification

## Performance Considerations

- Efficient message processing to handle multiple concurrent users
- Rate limiting for API calls to prevent abuse
- Error recovery mechanisms to maintain uptime

## Future Improvements

- Add inline query support for quick URL scraping
- Implement user preferences for formatting results
- Add analytics for usage patterns
- Support for additional content types
- Implement webhook mode for improved performance