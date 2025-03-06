const express = require("express");
const cors = require("cors");
const scrapeRoutes = require("./routes/scrape");
const authRoutes = require("./routes/auth");
const path = require("path");
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

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
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).send("OK");
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
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
