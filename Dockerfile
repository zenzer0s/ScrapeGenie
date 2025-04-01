# Build stage
FROM node:18-bullseye-slim AS builder
WORKDIR /app

# Copy package files for npm install caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production --no-optional

# Final stage
FROM node:18-bullseye-slim
WORKDIR /app

# Install minimal dependencies in a single layer to reduce image size
RUN apt-get update && apt-get install -y \
    chromium \
    curl \
    ca-certificates \
    python3 python3-pip \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* ~/.cache/* && \
    apt-get clean

# Install FFmpeg directly from Debian repositories
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV NODE_ENV=production \
    PORT=8080 \
    MAX_BROWSER_INSTANCES=1 \
    SCRAPE_TIMEOUT=30000 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_OPTIONS="--max-old-space-size=512" \
    # Optimize Chromium performance
    CHROMIUM_FLAGS="--no-sandbox --disable-dev-shm-usage --disable-gpu --disable-software-rasterizer --disable-extensions"

# Copy node modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Install specific Python packages without caching pip
COPY backend/scraper/requirements.txt ./
RUN timeout 60s pip3 install --no-cache-dir -r requirements.txt || \
    pip3 install --no-cache-dir requests beautifulsoup4 instaloader && \
    rm -f requirements.txt

# Copy only necessary application files
COPY bot ./bot
COPY backend ./backend
COPY google ./google  
COPY example.env ./.env.example

# Create necessary directories with proper permissions
RUN mkdir -p logs data/sessions downloads && \
    chmod -R 755 logs data downloads

# Expose the port
EXPOSE 8080

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://0.0.0.0:${PORT}/health || exit 1

# Install PM2 and clean npm cache
RUN npm install -g pm2 --silent && npm cache clean --force

# Create optimized PM2 ecosystem file
RUN echo '{\
  "apps": [\
    {\
      "name": "server",\
      "script": "./backend/server.js",\
      "instances": 1,\
      "exec_mode": "fork",\
      "max_memory_restart": "450M",\
      "autorestart": true,\
      "max_restarts": 5,\
      "watch": false,\
      "kill_timeout": 6000,\
      "node_args": "--max-old-space-size=450",\
      "env": {\
        "NODE_ENV": "production"\
      }\
    },\
    {\
      "name": "bot",\
      "script": "./bot/bot.js",\
      "instances": 1,\
      "exec_mode": "fork",\
      "max_memory_restart": "250M",\
      "autorestart": true,\
      "max_restarts": 5,\
      "watch": false,\
      "node_args": "--max-old-space-size=250",\
      "env": {\
        "NODE_ENV": "production"\
      }\
    }\
  ]\
}' > ecosystem.json

# Start application with PM2
CMD ["pm2-runtime", "ecosystem.json"]
