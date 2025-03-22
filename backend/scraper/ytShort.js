const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

// Helper function for formatting time
const formatTime = ms => (ms / 1000).toFixed(2) + 's';

async function fetchYouTubeShort(url) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, "ytdlp.py");
        const outputDir = "/dev/shm/youtube_tmp";

        // Ensure the output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const command = `python3 ${scriptPath} "${url}" "${outputDir}"`;

        exec(command, (error, stdout, stderr) => {
            console.log("✅ yt-dlp Raw Output:", stdout);

            if (stderr) {
                console.error("❌ yt-dlp Error Output:", stderr);
            }

            if (error) {
                return reject(new Error(stderr || "Unknown yt-dlp error"));
            }

            // Filter stdout to find the JSON line
            let output;
            try {
                const jsonLine = stdout.split("\n").find(line => {
                    try {
                        JSON.parse(line); // Check if the line is valid JSON
                        return true;
                    } catch {
                        return false;
                    }
                });

                if (!jsonLine) {
                    throw new Error("No JSON output found in yt-dlp response");
                }

                output = JSON.parse(jsonLine); // Parse the JSON line
                if (output.error) return reject(new Error(output.error));
            } catch (parseError) {
                return reject(new Error("Failed to parse yt-dlp output"));
            }

            resolve(output);

            // Cleanup temporary files after 5 minutes
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
    const now = Date.now(1);
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
