const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

// Helper function for formatting time
const formatTime = ms => (ms / 1000).toFixed(2) + 's';

// Function to download Instagram media using Instaloader
async function fetchInstagramPost(url) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        console.log(`\n⏱️ Starting Instagram process for: ${url}`);
        
        const scriptPath = path.join(__dirname, "instaDownloader.py");
        // Use RAM disk for faster file operations
        const downloadDir = "/dev/shm/instagram_tmp";
        
        // Ensure download directory exists
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }
        
        console.log(`📂 RAM disk directory: ${downloadDir}`);
        
        const pythonStartTime = Date.now();
        const pythonPath = process.env.PYTHON_PATH || "/usr/bin/python3";
        const command = `${pythonPath} "${scriptPath}" "${url}" "${downloadDir}"`;
        
        console.log(`🚀 Running Python process...`);
        
        exec(command, (error, stdout, stderr) => {
            const pythonEndTime = Date.now();
            console.log(`⏱️ Python process: ${formatTime(pythonEndTime - pythonStartTime)}`);
            
            if (error) {
                console.error(`❌ Instaloader Error: ${stderr}`);
                return reject(new Error(stderr));
            }
            
            console.log("Raw Python output:", stdout);

            if (stdout.includes('"error":')) {
                // Process error JSON normally but return it as a valid response
                const errorJson = JSON.parse(stdout.match(/\{.*"error":.*\}/)[0]);
                
                return resolve({
                    error: "This content appears to be age-restricted or unavailable",
                    shortcode: url.split('/p/')[1]?.split(/[/?#]/)[0] || url.split('/reel/')[1]?.split(/[/?#]/)[0],
                    directUrl: `https://www.instagram.com/p/${url.split('/p/')[1]?.split(/[/?#]/)[0] || url.split('/reel/')[1]?.split(/[/?#]/)[0]}/`,
                    is_restricted: true,
                    is_error: true,
                    performance: {
                        totalTime: formatTime(Date.now() - startTime),
                        pythonTime: formatTime(pythonEndTime - pythonStartTime),
                        fileTime: formatTime(0)
                    }
                });
            }
            
            // Extract JSON from the output - look for the last line that contains JSON
            let pythonOutput;
            try {
                // Find the last line that starts with '{' and ends with '}'
                const lines = stdout.split('\n');
                const jsonLine = lines.filter(line => 
                    line.trim().startsWith('{') && line.trim().endsWith('}')).pop();
                
                if (!jsonLine) {
                    throw new Error("No JSON found in Python output");
                }
                
                pythonOutput = JSON.parse(jsonLine);
                
                if (pythonOutput.error) {
                    return reject(new Error(pythonOutput.error));
                }
            } catch (parseError) {
                console.error(`❌ JSON Parse Error: ${parseError.message}`);
                return reject(new Error("Failed to parse Python output"));
            }
            
            const fileSearchStartTime = Date.now();
            // Extract shortcode from URL
            const shortcode = url.split('/p/')[1]?.split(/[/?#]/)[0] || url.split('/reel/')[1]?.split(/[/?#]/)[0];

            if (!shortcode) {
                return reject(new Error("Could not extract shortcode from URL"));
            }

            // Look for files with this shortcode
            const allFiles = fs.readdirSync(downloadDir)
                .filter(file => file.startsWith(shortcode))
                .map(file => path.join(downloadDir, file));

            const mediaFiles = allFiles.filter(file => file.endsWith(".mp4") || file.endsWith(".jpg") || file.endsWith(".png"));
                
            console.log(`⏱️ File search: ${formatTime(Date.now() - fileSearchStartTime)}`);

            if (mediaFiles.length === 0) {
                return reject(new Error(`No media found for shortcode: ${shortcode}`));
            }

            // Check if this is a carousel post (multiple images)
            const isCarousel = mediaFiles.length > 1 && !pythonOutput.is_video;
            const videoFile = mediaFiles.find(file => file.endsWith(".mp4"));

            // For videos, return single file; for carousels, return array; otherwise just first image
            let mediaPath;
            if (pythonOutput.is_video && videoFile) {
                mediaPath = videoFile;
                console.log(`📂 Downloaded Video File: ${mediaPath}`);
            } else if (isCarousel) {
                // Sort files by their numerical index for proper order
                mediaPath = mediaFiles.sort((a, b) => {
                    const aMatch = a.match(/_(\d+)\./);
                    const bMatch = b.match(/_(\d+)\./);
                    const aNum = aMatch ? parseInt(aMatch[1]) : 0;
                    const bNum = bMatch ? parseInt(bMatch[1]) : 0;
                    return aNum - bNum;
                });
                console.log(`📂 Downloaded Carousel with ${mediaPath.length} images`);
            } else {
                // Single image, just take the first file
                mediaPath = mediaFiles[0];
                console.log(`📂 Downloaded Image File: ${mediaPath}`);
            }

            resolve({
                mediaPath,
                caption: pythonOutput.caption || "",
                is_video: pythonOutput.is_video || false,
                is_carousel: isCarousel,
                performance: {
                    totalTime: formatTime(Date.now() - startTime),
                    pythonTime: formatTime(pythonEndTime - pythonStartTime),
                    fileTime: formatTime(Date.now() - fileSearchStartTime)
                }
            });
            
            // Schedule cleanup of this file after 5 minutes
            setTimeout(() => {
                try {
                    if (fs.existsSync(mediaPath)) {
                        fs.unlinkSync(mediaPath);
                        console.log(`🧹 Cleaned up file: ${mediaPath}`);
                    }
                } catch (cleanupError) {
                    console.error(`Failed to clean up file: ${cleanupError}`);
                }
            }, 5 * 60 * 1000);
        });
    });
}

// Add periodic cleanup function
function cleanupOldFiles(directory = "/dev/shm/instagram_tmp") {
    if (!fs.existsSync(directory)) return;
    
    const files = fs.readdirSync(directory);
    const now = Date.now();
    let deletedCount = 0;
    
    files.forEach(file => {
        const filePath = path.join(directory, file);
        const stats = fs.statSync(filePath);
        
        // If file is older than 5 minutes, delete it
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

module.exports = { fetchInstagramPost };
