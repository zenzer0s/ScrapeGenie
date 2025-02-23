const express = require("express");
const cors = require("cors");
const scrapeRoutes = require("./routes/scrape");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use("/scrape", scrapeRoutes);

app.get("/", (req, res) => {
    res.send("ScrapeGenie API is running...");
});

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
