'use strict';
const fs = require('fs');
const fsp = fs.promises;
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const { promisify } = require('util');
const execFile = promisify(require('child_process').execFile);
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const MAX_SECONDS = 60;
async function receiveVideo(req, filename) {
  const length = Number(req.headers['content-length']);
  if (Number.isFinite(length) && length > MAX_VIDEO_BYTES) throw new Error('Video is larger than 40 MiB.');
  if (!/^video\/mp4(?:;|$)/i.test(req.headers['content-type'] || '')) throw new Error('Upload an MP4 file (video/mp4).');
  let bytes = 0;
  const limiter = new Transform({ transform(chunk, encoding, done) {
    bytes += chunk.length;
    if (bytes > MAX_VIDEO_BYTES) return done(new Error('Video is larger than 40 MiB.'));
    done(null, chunk);
  }});
  // One raw File body, streamed to disk. No multipart parser and no large memory buffer.
  req.setTimeout(120000, () => req.destroy(new Error('Upload timed out.')));
  await pipeline(req, limiter, fs.createWriteStream(filename, { flags: 'wx', mode: 0o600 }));
  if (bytes < 16) throw new Error('The video file is empty or incomplete.');
  return bytes;
}
function validateProbe(meta) {
  const duration = Number(meta.format && meta.format.duration);
  const streams = Array.isArray(meta.streams) ? meta.streams : [];
  const videos = streams.filter(s => s.codec_type === 'video');
  const audios = streams.filter(s => s.codec_type === 'audio');
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_SECONDS) throw new Error('Use a video of up to 60 seconds.');
  if (videos.length !== 1 || videos[0].codec_name !== 'h264') throw new Error('Use MP4 with H.264 video. HEVC recordings must be converted first; see the guide.');
  if (videos[0].pix_fmt !== 'yuv420p') throw new Error('Use standard 8-bit H.264 (yuv420p) for browser playback.');
  if (audios.length > 1 || audios.some(s => s.codec_name !== 'aac')) throw new Error('Use AAC audio or a silent clip.');
  if (streams.some(s => !['video', 'audio'].includes(s.codec_type))) throw new Error('Export a simple MP4 containing only video and optional AAC audio.');
  const { width, height } = videos[0];
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || Math.max(width, height) > 1920 || Math.min(width, height) > 1080) throw new Error('Export at 1080p or lower (portrait or landscape).');
  return { duration, width, height, has_audio: audios.length > 0 };
}
async function inspectVideo(filename) {
  const handle = await fsp.open(filename, 'r');
  try {
    const b = Buffer.alloc(12); await handle.read(b, 0, 12, 0);
    if (b.toString('ascii', 4, 8) !== 'ftyp') throw new Error('This is not a standard MP4 file. Renaming an extension does not convert a file.');
  } finally { await handle.close(); }
  let result;
  try {
    result = await execFile(process.env.FFPROBE_PATH || (fs.existsSync('/opt/homebrew/bin/ffprobe') ? '/opt/homebrew/bin/ffprobe' : fs.existsSync('/usr/local/bin/ffprobe') ? '/usr/local/bin/ffprobe' : 'ffprobe'), [
      '-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_entries', 'format=duration:stream=codec_type,codec_name,pix_fmt,width,height', '-of', 'json', filename
    ], { timeout: 15000, maxBuffer: 1024 * 1024 });
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error('FFprobe is missing on the server. Install FFmpeg, then restart the site.');
    throw new Error('The server could not validate this video. Export MP4 / H.264 / AAC and try again.');
  }
  return validateProbe(JSON.parse(result.stdout));
}
module.exports = { receiveVideo, inspectVideo, validateProbe, MAX_VIDEO_BYTES, MAX_SECONDS };
