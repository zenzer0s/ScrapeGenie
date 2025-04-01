import sys
import instaloader
import os
import time
import json

# Helper function for timing
def log_time(start_time, step_name):
    elapsed = time.time() - start_time
    return time.time()

# Main execution
start_total = time.time()

# Ensure URL is provided
if len(sys.argv) < 3:
    print(json.dumps({"error": "Missing required arguments"}))
    sys.exit(1)

url = sys.argv[1]
output_dir = sys.argv[2]

# Log start
print(f"\n⏱️ Starting Instagram processing for: {url}")

# Initialize Instaloader
start_init = time.time()
L = instaloader.Instaloader(
    dirname_pattern=output_dir,
    filename_pattern="{shortcode}",
    download_pictures=True,
    download_videos=True,
    download_video_thumbnails=False,
    download_geotags=False,
    download_comments=False,
    save_metadata=False
)
start_extraction = log_time(start_init, "Instaloader initialization")

try:
    # Extract post shortcode
    path_parts = url.rstrip('/').split('/')
    post_shortcode = next((part for part in reversed(path_parts) if part), None)
    
    start_fetch = log_time(start_extraction, "URL extraction")
    
    # Fetch post
    post = instaloader.Post.from_shortcode(L.context, post_shortcode)
    start_download = log_time(start_fetch, "Post info fetch")
    
    # Download post
    L.download_post(post, target="")
    log_time(start_download, "Media download")
    
    # Get result info
    result = {
        "success": True,
        "shortcode": post_shortcode,
        "caption": getattr(post, 'caption', ""),
        "is_video": getattr(post, 'is_video', False),
        "total_time": f"{time.time() - start_total:.2f}s"
    }
    
    print(json.dumps(result))

except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
