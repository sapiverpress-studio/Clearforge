#!/usr/bin/env bash
set -euo pipefail

audio="${1:?Usage: generate-podcast-mp4.sh AUDIO_MP3 OUTPUT_MP4 [COVER_PNG]}"
output="${2:?Usage: generate-podcast-mp4.sh AUDIO_MP3 OUTPUT_MP4 [COVER_PNG]}"
cover="${3:-public/podcast/cover.png}"

[[ -f "$audio" ]] || { echo "Missing audio: $audio" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg is required" >&2; exit 1; }
command -v ffprobe >/dev/null || { echo "ffprobe is required" >&2; exit 1; }

valid_image() {
  [[ -f "$1" ]] && ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$1" 2>/dev/null | grep -Eq '^[1-9][0-9]*$'
}

if ! valid_image "$cover"; then
  slug="$(basename "$(dirname "$audio")")"
  candidate="media/$slug/story-1.png"
  if valid_image "$candidate"; then
    cover="$candidate"
  else
    cover="$(find media -type f -name story-1.png -print 2>/dev/null | sort | tail -n 1)"
  fi
fi
valid_image "$cover" || { echo "No usable podcast or story artwork was found." >&2; exit 1; }
echo "Using artwork: $cover"

mkdir -p "$(dirname "$output")"

# A restrained 16:9 full-episode video: blurred cover backdrop, sharp cover art,
# and a live waveform. CRF 28 keeps a mostly-static 8–10 minute video compact.
ffmpeg -hide_banner -loglevel warning -y \
  -loop 1 -framerate 25 -i "$cover" \
  -i "$audio" \
  -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=36,eq=brightness=-0.28[bg];[0:v]scale=760:760:force_original_aspect_ratio=decrease[cover];[1:a]showwaves=s=920x150:mode=line:colors=0x66a7ff@0.9:rate=25,format=rgba[wave];[bg][cover]overlay=(W-w)/2:70[tmp];[tmp][wave]overlay=(W-w)/2:880,format=yuv420p[v]" \
  -map "[v]" -map 1:a \
  -c:v libx264 -preset medium -crf 28 -tune stillimage \
  -c:a aac -b:a 128k -ar 44100 \
  -movflags +faststart -shortest "$output"

echo "Generated Facebook/YouTube MP4: $output"
