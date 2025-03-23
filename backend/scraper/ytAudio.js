const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

// Helper function for formatting time
const formatTime = ms => (ms / 1000).toFixed(2) + 's';

/**
 * Fetches high-quality audio from a YouTube video
 * @param {string} url YouTube URL
 * @returns {Promise<Object>} Object containing audio file path and info
 */
async function fetchYouTubeAudio(url) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const scriptPath = path.join(__dirname, "ytdlp.py");
        const outputDir = "/dev/shm/youtube_audio_tmp";

        // Ensure the output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Pass "audio" as the third parameter to indicate audio-only download
        const command = `python3 ${scriptPath} "${url}" "${outputDir}" "audio"`;

        console.log(`🎵 Fetching YouTube audio for: ${url}`);
        
        exec(command, (error, stdout, stderr) => {
            const elapsed = Date.now() - startTime;
            
            if (stderr) {
                console.error(`❌ yt-dlp Audio Error (${formatTime(elapsed)}):`, stderr);
            }

            if (error) {
                console.error(`❌ Failed to fetch YouTube audio (${formatTime(elapsed)}):`, error.message);
                return reject(new Error(stderr || "Unknown yt-dlp error during audio extraction"));
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
                    throw new Error("No JSON output found in yt-dlp audio response");
                }

                output = JSON.parse(jsonLine); // Parse the JSON line
                if (output.error) return reject(new Error(output.error));
            } catch (parseError) {
                console.error(`❌ Failed to parse yt-dlp audio output (${formatTime(elapsed)}):`, parseError.message);
                return reject(new Error("Failed to parse yt-dlp audio output"));
            }

            console.log(`✅ YouTube audio fetched successfully (${formatTime(elapsed)}): ${output.filepath}`);
            resolve(output);

            // Cleanup temporary files after 30 minutes
            setTimeout(() => {
                try {
                    if (fs.existsSync(output.filepath)) {
                        fs.unlinkSync(output.filepath);
                        console.log(`🧹 Cleaned up audio file: ${output.filepath}`);
                    }
                } catch (cleanupError) {
                    console.error(`Failed to clean up audio file: ${cleanupError}`);
                }
            }, 30 * 60 * 1000);
        });
    });
}

// Add periodic cleanup function
function cleanupOldAudioFiles(directory = "/dev/shm/youtube_audio_tmp") {
    if (!fs.existsSync(directory)) return;

    const files = fs.readdirSync(directory);
    const now = Date.now();
    let deletedCount = 0;

    files.forEach(file => {
        const filePath = path.join(directory, file);
        const stats = fs.statSync(filePath);

        if ((now - stats.mtimeMs) > 30 * 60 * 1000) {
            try {
                fs.unlinkSync(filePath);
                deletedCount++;
            } catch (error) {
                console.error(`Failed to delete audio file ${filePath}: ${error}`);
            }
        }
    });

    if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old audio files from /dev/shm/youtube_audio_tmp`);
    }
}

// Run cleanup every 15 minutes
setInterval(() => cleanupOldAudioFiles(), 15 * 60 * 1000);

// Run cleanup on module load
cleanupOldAudioFiles();

module.exports = { fetchYouTubeAudio };