const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Debug logging
console.log("🔍 Bot configuration loading:");
console.log(`• Current directory: ${__dirname}`);
console.log(`• Project root: ${path.resolve(__dirname, '../..')}`);

// Ensure required environment variables
if (!process.env.BACKEND_URL) {
  console.error("⚠️ BACKEND_URL is not set! Setting default value...");
  process.env.BACKEND_URL = `http://0.0.0.0:${process.env.PORT || 8080}`;
  console.log(`• BACKEND_URL (default): ${process.env.BACKEND_URL}`);
}

// Configuration object
const config = {
  token: process.env.TELEGRAM_BOT_TOKEN,
  backendUrl: process.env.BACKEND_URL || `http://0.0.0.0:${process.env.PORT || 8080}`,
  port: process.env.PORT || 8080,
  useWebhook: process.env.USE_WEBHOOK === 'true',
  publicUrl: process.env.PUBLIC_URL || '',
  
  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  },
  
  // Directory paths
  paths: {
    root: path.resolve(__dirname, '../..'),
    data: path.resolve(__dirname, '../../data'),
    sessions: path.resolve(__dirname, '../../data/sessions'),
    logs: path.resolve(__dirname, '../../logs'),
    downloads: path.resolve(__dirname, '../../downloads')
  }
};

// Ensure required directories exist
const fs = require('fs');
Object.values(config.paths).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Validate configuration
if (!config.token) {
  console.error("❌ Telegram Bot Token not found! Check your .env file.");
  process.exit(1);
}

if (config.useWebhook && !config.publicUrl) {
  console.warn("⚠️ USE_WEBHOOK is true but PUBLIC_URL is not set. Webhook setup may fail.");
}

module.exports = config;