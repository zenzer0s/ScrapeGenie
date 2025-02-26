const express = require("express");
const cors = require("cors");
const scrapeRoutes = require("./routes/scrape");

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

// Mount routes with /api prefix
app.use("/api/scrape", scrapeRoutes);  // Changed from "/scrape" to "/api/scrape"

app.get("/", (req, res) => {
    res.send("ScrapeGenie API is running...");
});

// Add health check endpoint
app.get("/health", (req, res) => {
    res.json({ status: "healthy" });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});