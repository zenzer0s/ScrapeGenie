import json
import subprocess
import sys
import os
import time
import uuid
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

# Generate unique filename using timestamp and random ID
timestamp = int(time.time())
random_id = str(uuid.uuid4().hex)[:8]  # 8 characters from UUID
base_filename = f"{timestamp}_{random_id}"

# Create unique filenames for both video and audio
merged_path = os.path.join(output_dir, f"{base_filename}.mp4")
audio_path = os.path.join(output_dir, f"{base_filename}.m4a")
log_file = os.path.join(output_dir, f"{base_filename}_debug.log")

def download_and_merge():
    """Download and merge video and audio using yt-dlp."""
    if mode == "audio":
        # Command for audio-only download
        command = [
            "yt-dlp",
            "-f", "bestaudio[ext=m4a]/bestaudio",  # Prefer m4a format
            "--extract-audio",
            "--audio-format", "m4a",               # Force m4a output
            "--audio-quality", "0",                # Best quality
            "-o", audio_path,
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
        if mode == "audio":
            media_type = "audio"
            output_path = audio_path
            file_ext = "m4a"
        else:
            output_path = merged_path
            file_ext = "mp4"

        # Calculate file size
        filesize = os.path.getsize(output_path)

        # Return the merged file path
        print(json.dumps({
            "success": True,
            "filepath": output_path,
            "filesize": filesize,
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
