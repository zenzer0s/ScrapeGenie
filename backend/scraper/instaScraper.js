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
        const pythonPath = "/home/zen/Documents/Pro/ScrapeGenie/backend/venv/bin/python3";
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

            // Look specifically for files with this shortcode
            const downloadedFiles = fs.readdirSync(downloadDir)
                .filter(file => file.startsWith(shortcode))
                .map(file => path.join(downloadDir, file))
                .filter(file => file.endsWith(".mp4") || file.endsWith(".jpg") || file.endsWith(".png"));
                
            console.log(`⏱️ File search: ${formatTime(Date.now() - fileSearchStartTime)}`);

            if (downloadedFiles.length === 0) {
                return reject(new Error(`No media found for shortcode: ${shortcode}`));
            }

            // For videos prioritize .mp4 files, for images take the first one
            const videoFile = downloadedFiles.find(file => file.endsWith(".mp4"));
            const mediaPath = pythonOutput.is_video && videoFile ? videoFile : downloadedFiles[0];

            console.log(`📂 Downloaded File: ${mediaPath}`);
            
            // Calculate total time
            console.log(`⏱️ Total processing: ${formatTime(Date.now() - startTime)}`);

            resolve({
                mediaPath,
                caption: pythonOutput.caption || "",
                is_video: pythonOutput.is_video || false,
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
