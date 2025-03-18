const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Configuration object
const config = {
  token: process.env.TELEGRAM_BOT_TOKEN,
  backendUrl: process.env.BACKEND_URL || `http://0.0.0.0:${process.env.PORT || 8080}`,
  port: process.env.PORT || 8080,
  
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

// Validate essential configuration
if (!config.token) {
  console.error("❌ Telegram Bot Token not found! Check your .env file.");
  process.exit(1);
}

// Create required directories
Object.entries(config.paths).forEach(([name, dir]) => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created ${name} directory: ${dir}`);
    } catch (error) {
      console.error(`❌ Failed to create ${name} directory: ${error.message}`);
    }
  }
});

// Log configuration summary
console.log("🔍 Bot configuration loaded:");
console.log(`• API endpoint: ${config.backendUrl}`);
console.log(`• Using polling mode`);

module.exports = config;