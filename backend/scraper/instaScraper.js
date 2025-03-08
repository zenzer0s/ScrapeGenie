const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

// Function to download Instagram media using Instaloader
async function fetchInstagramPost(url) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, "instaDownloader.py");
        const tempDir = "/tmp"; // Temporary storage

        console.log("🟢 fetchInstagramPost() called");
        console.log(`📌 URL Received: ${url}`);
        console.log(`📂 Expected Script Path: ${scriptPath}`);

        // Ensure temp directory exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const pythonPath = "/home/zen/Documents/Pro/ScrapeGenie/backend/venv/bin/python3";
        const command = `${pythonPath} ${scriptPath} "${url}" --dirname-pattern=${tempDir}`;

        console.log(`🚀 Running command: ${command}`);

        exec(command, (error, stdout, stderr) => {
            console.log("🔄 Instaloader process finished");

            if (error) {
                console.error(`❌ Instaloader Error: ${stderr}`);
                return reject(new Error(stderr));
            }

            console.log(`✅ Instaloader Success:\n${stdout}`);

            // Find the downloaded media file
            const downloadedFiles = fs.readdirSync(tempDir)
                .map(file => path.join(tempDir, file))
                .filter(file => file.endsWith(".mp4") || file.endsWith(".jpg") || file.endsWith(".png"));

            if (downloadedFiles.length === 0) {
                return reject(new Error("No media found in temp directory"));
            }

            const mediaPath = downloadedFiles[0];
            console.log(`📂 Downloaded File: ${mediaPath}`);

            resolve(mediaPath);
        });
    });
}

module.exports = { fetchInstagramPost };
