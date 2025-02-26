# Use a smaller Node.js image
FROM node:18-alpine AS builder  

WORKDIR /app  

# Copy package files first (better caching)
COPY package*.json ./  

# Install only production dependencies
RUN npm install --production  

# Copy all source files
COPY . .  

# Remove unnecessary dev dependencies (optional)
RUN npm prune --production  

# Final lightweight image
FROM node:18-alpine  

WORKDIR /app  

# Copy only necessary files from the builder stage
COPY --from=builder /app /app  

EXPOSE 3000  

CMD ["sh", "-c", "node backend/server.js & node bot/bot.js && wait"]
