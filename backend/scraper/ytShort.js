const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const OUTPUT_DIR = "/dev/shm/youtube_tmp";
const CLEANUP_DELAY = 5 * 60 * 1000; // 5 minutes

async function fetchYouTubeShort(url) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, "ytdlp.py");

        // Ensure the output directory exists
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        const command = `python3 ${scriptPath} "${url}" "${OUTPUT_DIR}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                return reject(new Error(stderr || "Unknown yt-dlp error"));
            }

            try {
                const jsonLine = stdout.split("\n").find(line => {
                    try {
                        JSON.parse(line);
                        return true;
                    } catch {
                        return false;
                    }
                });

                if (!jsonLine) {
                    throw new Error("No JSON output found in yt-dlp response");
                }

                const output = JSON.parse(jsonLine);
                if (output.error) return reject(new Error(output.error));
                
                resolve(output);
                
                // Schedule cleanup
                scheduleCleanup(output.filepath);
            } catch (parseError) {
                reject(new Error("Failed to parse yt-dlp output"));
            }
        });
    });
}

function scheduleCleanup(filepath) {
    setTimeout(() => {
        try {
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
            }
        } catch {
            // Silent error - file might be already deleted
        }
    }, CLEANUP_DELAY);
}

function cleanupOldFiles() {
    if (!fs.existsSync(OUTPUT_DIR)) return;

    const files = fs.readdirSync(OUTPUT_DIR);
    const now = Date.now();
    let deletedCount = 0;

    files.forEach(file => {
        const filePath = path.join(OUTPUT_DIR, file);
        const stats = fs.statSync(filePath);

        if ((now - stats.mtimeMs) > CLEANUP_DELAY) {
            try {
                fs.unlinkSync(filePath);
                deletedCount++;
            } catch {
                // Silent error
            }
        }
    });

    if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old files from ${OUTPUT_DIR}`);
    }
}

// Run cleanup every 15 minutes
setInterval(cleanupOldFiles, 15 * 60 * 1000);

// Run cleanup on module load
cleanupOldFiles();

module.exports = { fetchYouTubeShort };
