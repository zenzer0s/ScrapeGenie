const express = require("express");
const cors = require("cors");
const scrapeRoutes = require("./routes/scrape");

const app = express();
const PORT = process.env.PORT || 8000;  // Auto-detect port

app.use(cors());
app.use(express.json());

// Mount routes with /api prefix
app.use("/api/scrape", scrapeRoutes);

app.get("/", (req, res) => {
    res.send("ScrapeGenie API is running...");
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ status: "healthy" });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
