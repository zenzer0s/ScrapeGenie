const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const formatTime = ms => (ms / 1000).toFixed(2) + 's';
const DOWNLOAD_DIR = "/dev/shm/instagram_tmp";
const CLEANUP_DELAY = 5 * 60 * 1000; // 5 minutes
const SCRIPT_PATH = path.join(__dirname, "instaDownloader.py");
const PYTHON_PATH = process.env.PYTHON_PATH || "/usr/bin/python3";

async function fetchInstagramPost(url) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        // Ensure download directory exists
        if (!fs.existsSync(DOWNLOAD_DIR)) {
            fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
            console.log(`📂 Using new Instagram RAM disk directory: ${DOWNLOAD_DIR}`);
        }
        
        const pythonStartTime = Date.now();
        const command = `${PYTHON_PATH} "${SCRIPT_PATH}" "${url}" "${DOWNLOAD_DIR}"`;
        
        exec(command, (error, stdout, stderr) => {
            const pythonEndTime = Date.now();
            
            if (error) {
                return reject(new Error(stderr));
            }

            if (stdout.includes('"error":')) {
                // Extract shortcode from URL
                const shortcode = extractShortcode(url);
                
                return resolve({
                    error: "This content appears to be age-restricted or unavailable",
                    shortcode,
                    directUrl: `https://www.instagram.com/p/${shortcode}/`,
                    is_restricted: true,
                    is_error: true,
                    performance: {
                        totalTime: formatTime(Date.now() - startTime),
                        pythonTime: formatTime(pythonEndTime - pythonStartTime),
                        fileTime: formatTime(0)
                    }
                });
            }
            
            // Parse Python output
            const pythonOutput = parseJsonOutput(stdout);
            if (!pythonOutput) {
                return reject(new Error("Failed to parse Python output"));
            }
            
            if (pythonOutput.error) {
                return reject(new Error(pythonOutput.error));
            }
            
            const fileSearchStartTime = Date.now();
            // Extract shortcode from URL
            const shortcode = extractShortcode(url);

            if (!shortcode) {
                return reject(new Error("Could not extract shortcode from URL"));
            }

            // Look for files with this shortcode
            const allFiles = fs.readdirSync(DOWNLOAD_DIR)
                .filter(file => file.startsWith(shortcode))
                .map(file => path.join(DOWNLOAD_DIR, file));

            const mediaFiles = allFiles.filter(file => /\.(mp4|jpg|png)$/.test(file));
                
            if (mediaFiles.length === 0) {
                return reject(new Error(`No media found for shortcode: ${shortcode}`));
            }

            // Determine media type and prepare response
            const isCarousel = mediaFiles.length > 1 && !pythonOutput.is_video;
            const videoFile = mediaFiles.find(file => file.endsWith(".mp4"));
            
            let mediaPath;
            if (pythonOutput.is_video && videoFile) {
                mediaPath = videoFile;
            } else if (isCarousel) {
                mediaPath = sortCarouselImages(mediaFiles);
            } else {
                mediaPath = mediaFiles[0];
            }

            const result = {
                mediaPath,
                caption: pythonOutput.caption || "",
                is_video: pythonOutput.is_video || false,
                is_carousel: isCarousel,
                performance: {
                    totalTime: formatTime(Date.now() - startTime),
                    pythonTime: formatTime(pythonEndTime - pythonStartTime),
                    fileTime: formatTime(Date.now() - fileSearchStartTime)
                }
            };
            
            resolve(result);
            
            // Schedule cleanup of downloaded files
            scheduleCleanup(Array.isArray(mediaPath) ? mediaPath : [mediaPath]);
        });
    });
}

function extractShortcode(url) {
    const shortcode = url.split('/p/')[1]?.split(/[/?#]/)[0] || 
                      url.split('/reel/')[1]?.split(/[/?#]/)[0];
    return shortcode;
}

function parseJsonOutput(stdout) {
    try {
        const lines = stdout.split('\n');
        const jsonLine = lines.filter(line => 
            line.trim().startsWith('{') && line.trim().endsWith('}')).pop();
        
        if (!jsonLine) {
            return null;
        }
        
        return JSON.parse(jsonLine);
    } catch (error) {
        return null;
    }
}

function sortCarouselImages(files) {
    return files.sort((a, b) => {
        const aMatch = a.match(/_(\d+)\./);
        const bMatch = b.match(/_(\d+)\./);
        const aNum = aMatch ? parseInt(aMatch[1]) : 0;
        const bNum = bMatch ? parseInt(bMatch[1]) : 0;
        return aNum - bNum;
    });
}

function scheduleCleanup(files) {
    setTimeout(() => {
        files.forEach(file => {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }
            } catch (error) {
                // Silent error - file might be already deleted
            }
        });
    }, CLEANUP_DELAY);
}

function cleanupOldFiles() {
    if (!fs.existsSync(DOWNLOAD_DIR)) return;
    
    const files = fs.readdirSync(DOWNLOAD_DIR);
    const now = Date.now();
    
    files.forEach(file => {
        const filePath = path.join(DOWNLOAD_DIR, file);
        const stats = fs.statSync(filePath);
        
        if ((now - stats.mtimeMs) > CLEANUP_DELAY) {
            try {
                fs.unlinkSync(filePath);
            } catch (error) {
                // Silent error - file might be in use
            }
        }
    });
}

// Run cleanup every 15 minutes
setInterval(cleanupOldFiles, 15 * 60 * 1000);

// Run cleanup on module load
cleanupOldFiles();

module.exports = { fetchInstagramPost };
