import json
import subprocess
import sys
import time
import os

url = sys.argv[1]
output_dir = sys.argv[2]
output_template = os.path.join(output_dir, "%(title)s.%(ext)s")
start_total = time.time()

log_file = os.path.join(output_dir, "yt-dlp-log.txt")
with open(log_file, "w") as log:
    try:
        result = subprocess.run([
            "yt-dlp", "-f", "bv*+ba/b", "--merge-output-format", "mp4", "--output", output_template, "--print-json", url
        ], stdout=log, stderr=log, text=True, check=True)

        metadata = json.loads(result.stdout)
        file_path = metadata["requested_downloads"][0]["filepath"]
        title = metadata.get("title", "Unknown Title")
        duration = f"{metadata.get('duration', 0)}s"
        file_size = f"{round(metadata.get('filesize', 0) / (1024 * 1024), 2)}MB"

        response = {
            "success": True,
            "title": title,
            "file_path": file_path,
            "duration": duration,
            "file_size": file_size,
            "total_time": f"{time.time() - start_total:.2f}s"
        }

        print(json.dumps(response))
    except subprocess.CalledProcessError as e:
        print(json.dumps({"error": str(e.stderr)}))
        sys.exit(1)
