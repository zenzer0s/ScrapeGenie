const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

// Function to download Instagram media using Instaloader
async function fetchInstagramPost(url) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, "instaDownloader.py");
        // Use a clean absolute path for the downloads directory
        const downloadDir = "/home/zen/Documents/Pro/ScrapeGenie/downloads";

        console.log("🟢 fetchInstagramPost() called");
        console.log(`📌 URL Received: ${url}`);
        console.log(`📂 Expected Script Path: ${scriptPath}`);
        console.log(`📂 Download Directory: ${downloadDir}`);

        // Ensure download directory exists
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        const pythonPath = "/home/zen/Documents/Pro/ScrapeGenie/backend/venv/bin/python3";
        // Pass the download directory to the Python script
        const command = `${pythonPath} "${scriptPath}" "${url}" "${downloadDir}"`;

        console.log(`🚀 Running command: ${command}`);

        exec(command, (error, stdout, stderr) => {
            console.log("🔄 Instaloader process finished");
            console.log(stdout); // Log stdout for debugging

            if (error) {
                console.error(`❌ Instaloader Error: ${stderr}`);
                return reject(new Error(stderr));
            }

            console.log(`✅ Instaloader Success`);

            // Find the downloaded media file
            const downloadedFiles = fs.readdirSync(downloadDir)
                .map(file => path.join(downloadDir, file))
                .filter(file => file.endsWith(".mp4") || file.endsWith(".jpg") || file.endsWith(".png"));

            if (downloadedFiles.length === 0) {
                return reject(new Error("No media found in download directory"));
            }

            const mediaPath = downloadedFiles[0];
            console.log(`📂 Downloaded File: ${mediaPath}`);

            resolve(mediaPath);
        });
    });
}

module.exports = { fetchInstagramPost };
