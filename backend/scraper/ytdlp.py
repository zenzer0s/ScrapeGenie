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

os.makedirs(output_dir, exist_ok=True)
merged_path = os.path.join(output_dir, "output.mp4")
log_file = os.path.join(output_dir, "yt-dlp-debug.log")

def download_and_merge():
    """Download and merge video and audio using yt-dlp."""
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

        # Return the merged file path
        print(json.dumps({"filepath": merged_path}))

    except subprocess.CalledProcessError as e:
        error_message = e.stderr if hasattr(e, 'stderr') and e.stderr else str(e)
        log.write("\n❌ Error:\n" + error_message)
        print(json.dumps({"error": error_message}))
        sys.exit(1)
    except Exception as e:
        log.write("\n❌ Unexpected Error:\n" + str(e))
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
