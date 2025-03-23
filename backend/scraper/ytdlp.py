import json
import subprocess
import sys
import os
from concurrent.futures import ThreadPoolExecutor

if len(sys.argv) < 3:
    print(json.dumps({"error": "Missing required arguments"}))
    sys.exit(1)

url = sys.argv[1]
output_dir = sys.argv[2]

# Check if we're in audio-only mode
mode = "video"  # Default to video mode
if len(sys.argv) >= 4 and sys.argv[3] == "audio":
    mode = "audio"

os.makedirs(output_dir, exist_ok=True)
merged_path = os.path.join(output_dir, "output.mp4")
log_file = os.path.join(output_dir, "yt-dlp-debug.log")

def download_and_merge():
    """Download and merge video and audio using yt-dlp."""
    if mode == "audio":
        output_file = os.path.join(output_dir, "output.m4a")
        
        # Command for audio-only download
        command = [
            "yt-dlp",
            "-f", "bestaudio[ext=m4a]/bestaudio",  # Prefer m4a format
            "--extract-audio",
            "--audio-format", "m4a",               # Force m4a output
            "--audio-quality", "0",                # Best quality
            "-o", output_file,
            url
        ]
    else:
        # Command for video download
        command = [
            "yt-dlp", "-f", "bv+ba", "--merge-output-format", "mp4",
            "-o", merged_path, url
        ]
    subprocess.run(command, check=True)

with open(log_file, "w") as log:
    try:
        # Run yt-dlp in parallel (simulated for demonstration)
        with ThreadPoolExecutor() as executor:
            future = executor.submit(download_and_merge)
            future.result()  # Wait for the download and merge to complete

        log.write("✅ Video and audio downloaded and merged successfully.\n")

        # Determine media type and file extension
        media_type = "video"
        output_path = merged_path
        if mode == "audio":
            media_type = "audio"
            output_path = os.path.join(output_dir, "output.m4a")
            file_ext = "m4a"
        else:
            file_ext = "mp4"

        # Return the merged file path
        print(json.dumps({
            "success": True,
            "filepath": output_path,
            "mediaType": media_type,
            "fileExtension": file_ext
        }))

    except subprocess.CalledProcessError as e:
        error_message = e.stderr if hasattr(e, 'stderr') and e.stderr else str(e)
        log.write("\n❌ Error:\n" + error_message)
        print(json.dumps({"error": error_message}))
        sys.exit(1)
    except Exception as e:
        log.write("\n❌ Unexpected Error:\n" + str(e))
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
