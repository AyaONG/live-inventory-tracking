#!/usr/bin/env python3
"""Create a browser-compatible copy; never overwrite or silently trim the original."""
import argparse, json, shutil, subprocess, sys
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('input', type=Path)
p.add_argument('--output', type=Path)
a=p.parse_args()
try:
    source=a.input.expanduser().resolve()
    output=(a.output.expanduser().resolve() if a.output else source.with_name(source.stem+'_web.mp4'))
    if not source.is_file(): raise ValueError('Source file not found.')
    if output.exists() or output==source: raise ValueError('Output already exists. Choose a new --output name.')
    if not shutil.which('ffmpeg') or not shutil.which('ffprobe'): raise ValueError('FFmpeg / FFprobe is not installed or is missing from PATH.')
    probe=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(source)],check=True,capture_output=True,text=True)
    duration=float(json.loads(probe.stdout)['format']['duration'])
    if duration>60: raise ValueError('This recording exceeds 60 seconds. Choose a shorter clip in your video editor; this script does not trim it automatically.')
    subprocess.run(['ffmpeg','-hide_banner','-n','-i',str(source),'-map','0:v:0','-map','0:a:0?',
        '-vf',"scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
        '-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k',
        '-sn','-dn','-movflags','+faststart',str(output)],check=True)
    print('Browser-compatible copy:',output)
    print('Original unchanged. Duration was not deliberately shortened.')
except (ValueError,KeyError,OSError,subprocess.CalledProcessError) as e:
    print('Conversion stopped:',e,file=sys.stderr);sys.exit(1)
