#!/bin/bash
# run.sh - Script to start backend and bot concurrently

echo "Starting backend server..."
node backend/server.js &
BACKEND_PID=$!

echo "Starting bot..."
node bot/bot.js &
BOT_PID=$!

# Optionally, wait for both processes to exit
wait $BACKEND_PID $BOT_PID

echo "Both processes have terminated."
