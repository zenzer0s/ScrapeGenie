const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const formatTime = ms => (ms / 1000).toFixed(2) + 's';
const OUTPUT_DIR = "/dev/shm/youtube_audio_tmp";
const CLEANUP_DELAY = 30 * 60 * 1000; // 30 minutes

async function fetchYouTubeAudio(url) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const scriptPath = path.join(__dirname, "ytdlp.py");

        // Ensure the output directory exists
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        const command = `python3 ${scriptPath} "${url}" "${OUTPUT_DIR}" "audio"`;
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                return reject(new Error(stderr || "Unknown yt-dlp error during audio extraction"));
            }

            try {
                // Find JSON line in output
                const jsonLine = stdout.split("\n").find(line => {
                    try { JSON.parse(line); return true; } catch { return false; }
                });

                if (!jsonLine) {
                    throw new Error("No JSON output found in yt-dlp audio response");
                }

                const output = JSON.parse(jsonLine);
                if (output.error) return reject(new Error(output.error));
                
                // Schedule cleanup
                scheduleCleanup(output.filepath);
                
                resolve(output);
            } catch (parseError) {
                reject(new Error("Failed to parse yt-dlp audio output"));
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

function cleanupOldAudioFiles() {
    if (!fs.existsSync(OUTPUT_DIR)) return;

    const files = fs.readdirSync(OUTPUT_DIR);
    const now = Date.now();

    files.forEach(file => {
        const filePath = path.join(OUTPUT_DIR, file);
        const stats = fs.statSync(filePath);

        if ((now - stats.mtimeMs) > CLEANUP_DELAY) {
            try {
                fs.unlinkSync(filePath);
            } catch {
                // Silent error
            }
        }
    });
}

// Run cleanup every 15 minutes
setInterval(cleanupOldAudioFiles, 15 * 60 * 1000);

// Run cleanup on module load
cleanupOldAudioFiles();

module.exports = { fetchYouTubeAudio };