# Use a lightweight Node.js image
FROM node:18-alpine  

# Set working directory
WORKDIR /app  

# Copy package files first (for efficient caching)
COPY package*.json ./  

# Install dependencies
RUN npm install  

# Copy everything else (EXCEPT .env)
COPY . .  

# Expose the port for the backend API
EXPOSE 3000  

# Start both backend and bot, ensuring they run correctly
CMD sh -c "node backend/server.js & node bot/bot.js && wait"
