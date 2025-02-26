#!/bin/bash

# Define the .env file path
ENV_FILE=".env"

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  .env file not found. Creating a new one..."
    
    # Ask for Telegram Bot Token
    read -p "Enter your TELEGRAM_BOT_TOKEN: " BOT_TOKEN
    
    # Write the token to .env
    echo "TELEGRAM_BOT_TOKEN=$BOT_TOKEN" > $ENV_FILE
    
    echo "✅ .env file created successfully!"
else
    echo "✅ .env file already exists!"
fi

# Confirm the .env file content
echo "📄 Current .env file:"
cat $ENV_FILE
