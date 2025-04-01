import sys
import instaloader
import time
import json

if len(sys.argv) < 3:
    print(json.dumps({"error": "Missing required arguments"}))
    sys.exit(1)

url = sys.argv[1]
output_dir = sys.argv[2]

start_total = time.time()

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

try:
    shortcode = None
    if "/p/" in url:
        shortcode = url.split("/p/")[1].split("/")[0].split("?")[0]
    elif "/reel/" in url:
        shortcode = url.split("/reel/")[1].split("/")[0].split("?")[0]
    elif "/tv/" in url:
        shortcode = url.split("/tv/")[1].split("/")[0].split("?")[0]
    
    if not shortcode:
        print(json.dumps({"error": "Could not extract post shortcode from URL"}))
        sys.exit(1)
    
    post = instaloader.Post.from_shortcode(L.context, shortcode)
    L.download_post(post, target="")
    
    print(json.dumps({
        "success": True,
        "shortcode": shortcode,
        "caption": post.caption if hasattr(post, 'caption') else "",
        "is_video": post.is_video if hasattr(post, 'is_video') else False,
        "total_time": f"{time.time() - start_total:.2f}s"
    }))

except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)