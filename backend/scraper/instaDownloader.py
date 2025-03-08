import sys
import instaloader
import os
import shutil

# Ensure URL and output path are provided
if len(sys.argv) < 3:
    print("❌ Error: Missing required arguments")
    print("Usage: python instaDownloader.py <URL> <OUTPUT_DIR>")
    sys.exit(1)

url = sys.argv[1]
output_dir = sys.argv[2]  # Get the download directory from command line

print(f"📌 Received output directory: {output_dir}")

# Initialize Instaloader with custom settings
# Changed dirname_pattern from "." to target directory to ensure correct path
L = instaloader.Instaloader(
    dirname_pattern=output_dir,  # Use the exact output directory
    filename_pattern="{shortcode}",  # Name files using post shortcode instead of timestamp
    download_pictures=True,
    download_videos=True,
    download_video_thumbnails=False,
    download_geotags=False,
    download_comments=False,
    save_metadata=False
)

try:
    # Extract post shortcode from URL
    post_shortcode = url.split("/")[-2]
    if not post_shortcode:  # Handle trailing slash
        post_shortcode = url.split("/")[-3]
        
    post = instaloader.Post.from_shortcode(L.context, post_shortcode)
    
    print(f"📂 Output directory: {output_dir}")
    print(f"🔍 Post shortcode: {post_shortcode}")
    
    # Download directly to output_dir without creating subdirectories
    # We don't need to call os.makedirs() since dirname_pattern handles this
    L.download_post(post, "")  # Use empty target since dirname_pattern has the full path
    
    print(f"✅ Downloaded: {post_shortcode} to {output_dir}")

except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
