#!/bin/bash

# Detect OS
OS="Unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="Linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="Mac"
elif [[ "$OS" == "Windows_NT" ]]; then
    OS="Windows"
fi

echo "🖥️ Detected OS: $OS"

# Function to check and install required packages
check_and_install() {
    if ! command -v "$1" &>/dev/null; then
        echo "❌ $1 is not installed. Installing..."
        if [[ "$OS" == "Linux" ]]; then
            sudo apt-get update && sudo apt-get install -y "$2"
        elif [[ "$OS" == "Mac" ]]; then
            brew install "$2"
        fi
    else
        echo "✅ $1 is already installed."
    fi
}

# Ensure required packages are installed
check_and_install node nodejs
check_and_install npm npm

# Move to project root directory
cd "$(dirname "$0")"

# Ensure logs directory exists
mkdir -p logs

# Ensure node_modules exists before starting services
if [ ! -d "node_modules" ]; then
    echo "⚠️ node_modules not found. Installing dependencies..."
    npm ci --no-audit --no-fund
else
    echo "✅ node_modules found. Skipping installation."
fi

# Check for .env file in the main folder
if [ ! -f .env ]; then
    echo "⚠️ No .env file found! Creating one..."
    touch .env
    read -p "Enter your Telegram Bot Token: " BOT_TOKEN
    echo "TELEGRAM_BOT_TOKEN=$BOT_TOKEN" > .env
    echo "✅ .env file created successfully!"
else
    echo "✅ .env file already exists."
fi

# Kill existing bot.js and server.js processes safely
echo "🛑 Stopping any running instances of bot.js and server.js..."
pkill -f "node bot/bot.js" && echo "✅ Stopped bot.js" || echo "⚠️ No running instance of bot.js"
pkill -f "node backend/server.js" && echo "✅ Stopped server.js" || echo "⚠️ No running instance of server.js"

# Start bot and backend with logs
echo "🚀 Starting the bot and backend..."

nohup node bot/bot.js > logs/bot.log 2>&1 &
BOT_PID=$!
nohup node backend/server.js > logs/server.log 2>&1 &
SERVER_PID=$!

echo "✅ Bot started (PID: $BOT_PID) | Log: logs/bot.log"
echo "✅ Server started (PID: $SERVER_PID) | Log: logs/server.log"

# Function to stop services gracefully
stop_services() {
    echo "🛑 Stopping bot and server..."
    kill "$BOT_PID" 2>/dev/null && echo "✅ Bot stopped" || echo "⚠️ Bot was not running"
    kill "$SERVER_PID" 2>/dev/null && echo "✅ Server stopped" || echo "⚠️ Server was not running"
    exit 0
}

# Monitor user input for "STOP" command
while true; do
    read -r -p "⌨️  Type 'STOP' to stop services: " input
    if [[ "$input" == "STOP" ]]; then
        stop_services
    else
        echo "❌ Invalid command. Type 'STOP' to exit."
    fi
done
