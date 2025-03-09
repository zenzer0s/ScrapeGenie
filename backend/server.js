const express = require("express");
const cors = require("cors");
const scrapeRoutes = require("./routes/scrape");
const authRoutes = require("./routes/auth");
const path = require("path");
const fs = require('fs');
const { exec } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Ensure RAM disk directory exists
const INSTAGRAM_TMP_DIR = "/dev/shm/instagram_tmp";

try {
  if (!fs.existsSync(INSTAGRAM_TMP_DIR)) {
    fs.mkdirSync(INSTAGRAM_TMP_DIR, { recursive: true });
    console.log(`📂 Created Instagram RAM disk directory: ${INSTAGRAM_TMP_DIR}`);
  } else {
    console.log(`📂 Using existing Instagram RAM disk directory: ${INSTAGRAM_TMP_DIR}`);
    
    // Clean up existing files on startup
    const files = fs.readdirSync(INSTAGRAM_TMP_DIR);
    if (files.length > 0) {
      exec(`rm -rf ${INSTAGRAM_TMP_DIR}/*`, (error) => {
        if (error) {
          console.error(`❌ Error cleaning RAM disk: ${error}`);
        } else {
          console.log(`🧹 Cleaned ${files.length} files from RAM disk on startup`);
        }
      });
    }
  }
} catch (error) {
  console.error(`❌ RAM disk setup error: ${error.message}`);
  console.log(`⚠️ Falling back to regular file system`);
}

// Ensure the data and sessions directories exist
const dataDir = path.join(__dirname, '../data');
const sessionsDir = path.join(dataDir, 'sessions');

if (!require('fs').existsSync(dataDir)) {
  require('fs').mkdirSync(dataDir, { recursive: true });
  console.log('Created data directory');
}

if (!require('fs').existsSync(sessionsDir)) {
  require('fs').mkdirSync(sessionsDir, { recursive: true });
  console.log('Created sessions directory');
}

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({ 
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Mount routes with /api prefix
app.use("/api/scrape", scrapeRoutes);
app.use("/auth", authRoutes);

// Create public directory for login page
const publicDir = path.join(__dirname, 'public');
if (!require('fs').existsSync(publicDir)) {
  require('fs').mkdirSync(publicDir, { recursive: true });
}

// Serve the static files for the Pinterest login page
app.use(express.static(publicDir));

app.get("/", (req, res) => {
    res.send("ScrapeGenie API is running...");
});

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});
