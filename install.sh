#!/bin/bash

# Detect OS
OS=""
if [[ "$OSTYPE" == "linux-android"* ]]; then
    OS="Termux"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="Linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="Mac"
elif [[ "$OS" == "Windows_NT" ]]; then
    OS="Windows"
else
    OS="Unknown"
fi

echo "🖥️ Detected OS: $OS"

# If running on Termux, update everything first
if [[ "$OS" == "Termux" ]]; then
    echo "📦 Updating Termux packages..."
    pkg update && pkg upgrade -y

    echo "📦 Installing Node.js in Termux..."
    pkg install nodejs -y
fi

# Install dependencies in the main project
echo "🚀 Installing dependencies in the main project..."
npm install

# Install dependencies in all subfolders with package.json
echo "🔍 Searching for subfolders with package.json..."
find . -name "package.json" -not -path "./package.json" | while read file; do
  folder=$(dirname "$file")
  echo "📂 Installing dependencies in $folder ..."
  (cd "$folder" && npm install)
done

# Check for .env file in the root directory
if [ ! -f .env ]; then
    echo "⚠️ No .env file found! Creating one..."
    touch .env
    read -p "Enter your Telegram Bot Token: " BOT_TOKEN
    echo "TELEGRAM_BOT_TOKEN=$BOT_TOKEN" > .env
    echo "✅ .env file created successfully!"
else
    echo "✅ .env file already exists."
fi

# Keep Termux awake if running on Android
if [[ "$OS" == "Termux" ]]; then
    echo "🔒 Preventing Termux from sleeping..."
    termux-wake-lock
fi

# Run bot and backend
echo "🚀 Starting the bot and backend..."
node bot/bot.js &  # Runs in background
node backend/server.js  # Runs in foreground

echo "✅ All setup completed successfully!"
