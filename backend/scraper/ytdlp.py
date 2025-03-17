import json
import subprocess
import sys
import os

if len(sys.argv) < 3:
    print(json.dumps({"error": "Missing required arguments"}))
    sys.exit(1)

url = sys.argv[1]
output_dir = sys.argv[2]

os.makedirs(output_dir, exist_ok=True)
output_template = os.path.join(output_dir, "%(title)s.%(ext)s")

log_file = os.path.join(output_dir, "yt-dlp-debug.log")

with open(log_file, "w") as log:
    try:
        # First, get the info to know what the output file will be
        info_result = subprocess.run([
            "yt-dlp", "--no-download", "--print-json", url
        ], stdout=subprocess.PIPE, stderr=log, text=True, check=True)
        
        # Parse the video information
        info = json.loads(info_result.stdout)
        log.write("✅ Got video info successfully.\n")
        
        # Get title and determine the expected filename
        video_title = info.get('title', 'video')
        video_id = info.get('id', '')
        expected_filename = f"{video_title}.mp4"
        expected_path = os.path.join(output_dir, expected_filename)
        
        # Now actually download the video
        download_result = subprocess.run([
            "yt-dlp", "-f", "bv*[ext=mp4]+ba[ext=m4a]/b", "--merge-output-format", "mp4",
            "--output", output_template, url
        ], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, check=True)
        
        log.write(download_result.stdout)
        log.write("\n✅ yt-dlp download completed successfully.\n")
        
        # Find the downloaded file
        files = os.listdir(output_dir)
        downloaded_file = None
        for file in files:
            if file.endswith('.mp4') and file != "yt-dlp-debug.log":
                downloaded_file = os.path.join(output_dir, file)
                break
        
        if not downloaded_file:
            raise FileNotFoundError("Downloaded MP4 file not found")
        
        # Important: Don't print JSON here!
        # We'll print only one JSON object at the end
        log.write(f"\n✅ Found downloaded file: {downloaded_file}\n")
        
        # Try to download separate streams for GStreamer processing
        try:
            # Download video and audio separately
            download_separate_result = subprocess.run([
                "yt-dlp", "-f", "bv*[ext=mp4]/best[ext=mp4]", "--output", f"{output_template}.video", url
            ], stdout=subprocess.PIPE, stderr=log, text=True, check=True)
            
            download_audio_result = subprocess.run([
                "yt-dlp", "-f", "ba[ext=m4a]/ba", "--output", f"{output_template}.audio", url
            ], stdout=subprocess.PIPE, stderr=log, text=True, check=True)
            
            log.write("\n✅ Downloaded separate video and audio streams\n")
            
            # Find the downloaded video and audio files
            video_file = None
            audio_file = None
            
            for file in os.listdir(output_dir):
                if file.endswith('.video.mp4'):
                    video_file = os.path.join(output_dir, file)
                elif file.endswith('.audio.m4a') or file.endswith('.audio.webm'):
                    audio_file = os.path.join(output_dir, file)
            
            if video_file and audio_file:
                merged_output = os.path.join(output_dir, f"{video_title}_gstreamer.mp4")
                
                # Merge video & audio using GStreamer
                merge_command = [
                    "gst-launch-1.0",
                    "filesrc", f"location={video_file}", "!", "decodebin", "!", "videoconvert", "!", "x264enc", "!",
                    "mp4mux", "name=mux",
                    "filesrc", f"location={audio_file}", "!", "decodebin", "!", "audioconvert", "!", "voaacenc", "!", "mux.",
                    "mux.", "!", f"filesink location={merged_output}"
                ]
                
                log.write("\n⏳ Merging video & audio with GStreamer...\n")
                subprocess.run(merge_command, stderr=log, text=True, check=True)
                
                log.write("\n✅ GStreamer merging successful.\n")
                
                # Use the GStreamer output if it exists and has valid size
                if os.path.exists(merged_output) and os.path.getsize(merged_output) > 1000:
                    downloaded_file = merged_output
        except Exception as e:
            log.write(f"\n⚠️ GStreamer processing failed, using default download: {str(e)}\n")
            # Continue with the original downloaded file
        
        # NOW print only ONE JSON response at the very end
        print(json.dumps({"filepath": downloaded_file}))

    except subprocess.CalledProcessError as e:
        error_message = e.stdout if hasattr(e, 'stdout') and e.stdout else str(e)
        log.write("\n❌ yt-dlp/GStreamer Error:\n" + error_message)
        print(json.dumps({"error": error_message}))
        sys.exit(1)
    except (json.JSONDecodeError, KeyError, FileNotFoundError) as e:
        log.write("\n❌ Error:\n" + str(e))
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
