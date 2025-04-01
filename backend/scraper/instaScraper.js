const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const formatTime = ms => (ms / 1000).toFixed(2) + 's';
const DOWNLOAD_DIR = "/dev/shm/instagram_tmp";
const SCRIPT_PATH = path.join(__dirname, "instaDownloader.py");
const PYTHON_PATH = process.env.PYTHON_PATH || "/usr/bin/python3";

async function fetchInstagramPost(url) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        console.log(`🔍 Processing Instagram URL: ${url}`);
        
        ensureDownloadDir();
        
        const pythonStartTime = Date.now();
        const command = `${PYTHON_PATH} "${SCRIPT_PATH}" "${url}" "${DOWNLOAD_DIR}"`;
        
        exec(command, (error, stdout, stderr) => {
            const pythonEndTime = Date.now();
            
            if (error) {
                console.error(`❌ Instaloader Error: ${stderr}`);
                return reject(new Error(stderr));
            }

            try {
                const lines = stdout.split('\n');
                const jsonLine = lines.filter(line => 
                    line.trim().startsWith('{') && line.trim().endsWith('}')).pop();
                
                if (!jsonLine) {
                    throw new Error("No JSON found in Python output");
                }
                
                const pythonOutput = JSON.parse(jsonLine);
                
                if (pythonOutput.error) {
                    return reject(new Error(pythonOutput.error));
                }
                
                const fileSearchStartTime = Date.now();
                const shortcode = extractShortcode(url);

                if (!shortcode) {
                    return reject(new Error("Could not extract shortcode from URL"));
                }

                const mediaFiles = findMediaFiles(shortcode);
                
                if (mediaFiles.length === 0) {
                    return reject(new Error(`No media found for shortcode: ${shortcode}`));
                }

                const isCarousel = mediaFiles.length > 1 && !pythonOutput.is_video;
                const videoFile = mediaFiles.find(file => file.endsWith(".mp4"));
                
                let mediaPath = getAppropriateMedia(pythonOutput.is_video, isCarousel, videoFile, mediaFiles);
                
                // Log file size for video
                if (pythonOutput.is_video && typeof mediaPath === 'string') {
                    const stats = fs.statSync(mediaPath);
                    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                    console.log(`📤 Sending Instagram video: ${fileSizeMB} MB`);
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
                
                console.log(`✅ Instagram content processed successfully`);
                resolve(result);
                
                scheduleCleanup(mediaPath);
            } catch (err) {
                reject(new Error(err.message));
            }
        });
    });
}

function ensureDownloadDir() {
    if (!fs.existsSync(DOWNLOAD_DIR)) {
        fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }
}

function extractShortcode(url) {
    return url.split('/p/')[1]?.split(/[/?#]/)[0] || url.split('/reel/')[1]?.split(/[/?#]/)[0];
}

function findMediaFiles(shortcode) {
    return fs.readdirSync(DOWNLOAD_DIR)
        .filter(file => file.startsWith(shortcode))
        .filter(file => /\.(mp4|jpg|png)$/.test(file))
        .map(file => path.join(DOWNLOAD_DIR, file));
}

function getAppropriateMedia(isVideo, isCarousel, videoFile, mediaFiles) {
    if (isVideo && videoFile) {
        return videoFile;
    } else if (isCarousel) {
        return sortCarouselImages(mediaFiles);
    } else {
        return mediaFiles[0];
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

function scheduleCleanup(mediaPath) {
    const files = Array.isArray(mediaPath) ? mediaPath : [mediaPath];
    
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
    }, 5 * 60 * 1000); // 5 minutes
}

module.exports = { fetchInstagramPost };