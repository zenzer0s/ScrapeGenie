# Use a smaller Node.js image
FROM node:18-alpine AS builder  

WORKDIR /app  

# Install dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    harfbuzz \
    ca-certificates \
    nss \
    freetype \
    ttf-freefont \
    font-noto \
    font-noto-cjk \
    font-noto-emoji \
    font-noto-extra

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

# Install Chromium again in the final container
RUN apk add --no-cache \
    chromium \
    harfbuzz \
    ca-certificates \
    nss \
    freetype \
    ttf-freefont \
    font-noto \
    font-noto-cjk \
    font-noto-emoji \
    font-noto-extra

# Set Puppeteer environment variables
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"
ENV PUPPETEER_SKIP_DOWNLOAD="true"

# Copy only necessary files from the builder stage
COPY --from=builder /app /app  

EXPOSE 8000  

CMD ["sh", "-c", "node backend/server.js & node bot/bot.js && wait"]
