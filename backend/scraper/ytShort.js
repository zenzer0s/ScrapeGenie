const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

// Helper function for formatting time
const formatTime = ms => (ms / 1000).toFixed(2) + 's';

async function fetchYouTubeShort(url) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, "ytdlp.py");
        const downloadDir = "/dev/shm/youtube_tmp";

        const startTime = Date.now();
        console.log(`\n⏱️ Starting YouTube process for: ${url}`);
        const pythonStartTime = Date.now();

        console.log(`📥 Running yt-dlp for: ${url}`);

        const command = `python3 "${scriptPath}" "${url}" "${downloadDir}"`;

        exec(command, (error, stdout, stderr) => {
            console.log("✅ yt-dlp Raw Output:", stdout);
            
            if (stderr) {
                console.error("❌ yt-dlp Error Output:", stderr);
            }

            if (error) {
                return reject(new Error(stderr || "Unknown yt-dlp error"));
            }

            let output;
            try {
                output = JSON.parse(stdout);
                if (output.error) return reject(new Error(output.error));
            } catch (parseError) {
                return reject(new Error("Failed to parse yt-dlp output"));
            }

            resolve(output);

            setTimeout(() => {
                try {
                    if (fs.existsSync(output.filepath)) {
                        fs.unlinkSync(output.filepath);
                        console.log(`🧹 Cleaned up file: ${output.filepath}`);
                    }
                } catch (cleanupError) {
                    console.error(`Failed to clean up file: ${cleanupError}`);
                }
            }, 5 * 60 * 1000);
        });
    });
}

// Add periodic cleanup function
function cleanupOldFiles(directory = "/dev/shm/youtube_tmp") {
    if (!fs.existsSync(directory)) return;

    const files = fs.readdirSync(directory);
    const now = Date.now();
    let deletedCount = 0;

    files.forEach(file => {
        const filePath = path.join(directory, file);
        const stats = fs.statSync(filePath);

        if ((now - stats.mtimeMs) > 5 * 60 * 1000) {
            try {
                fs.unlinkSync(filePath);
                deletedCount++;
            } catch (error) {
                console.error(`Failed to delete ${filePath}: ${error}`);
            }
        }
    });

    if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old files from ${directory}`);
    }
}

// Run cleanup every 15 minutes
setInterval(() => cleanupOldFiles(), 15 * 60 * 1000);

// Run cleanup on module load
cleanupOldFiles();

module.exports = { fetchYouTubeShort };
