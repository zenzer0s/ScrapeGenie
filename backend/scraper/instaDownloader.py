import sys
import instaloader
import os

# Ensure URL is provided
if len(sys.argv) < 2:
    print("❌ Error: No URL provided")
    sys.exit(1)

url = sys.argv[1]
L = instaloader.Instaloader()

try:
    # Extract post shortcode from URL
    post_shortcode = url.split("/")[-2]
    post = instaloader.Post.from_shortcode(L.context, post_shortcode)

    # Create output directory
    output_dir = os.path.join(os.getcwd(), "downloads")
    os.makedirs(output_dir, exist_ok=True)

    # Download the post
    L.download_post(post, target=output_dir)
    print(f"✅ Downloaded: {post_shortcode} to {output_dir}")

except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
