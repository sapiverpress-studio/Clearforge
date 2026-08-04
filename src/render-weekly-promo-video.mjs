import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [packPath, postIndexRaw, audioPath, outputPath] = process.argv.slice(2);
if (!packPath || !postIndexRaw || !audioPath || !outputPath) {
  throw new Error('Usage: node src/render-weekly-promo-video.mjs <pack.json> <post-index> <audio.mp3> <output.mp4>');
}

const postIndex = Number(postIndexRaw);
const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
const post = pack.posts.find((item) => item.index === postIndex);
if (!post) throw new Error(`No weekly post found for index ${postIndex}.`);
if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size === 0) throw new Error(`Missing audio: ${audioPath}`);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: options.capture ? 'pipe' : 'inherit' });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${(result.stderr || result.stdout || '').trim()}`);
  return options.capture ? String(result.stdout || '').trim() : '';
}

function probeDuration(file) {
  const value = Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { capture: true }));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function wrap(text, max = 27, maxLines = 5) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= max || !current) current = next;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines.join('\n');
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.!?…]*$/, '')}…`;
  return kept.join('\n');
}

function escFilterPath(value) {
  return path.resolve(value).replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

const duration = probeDuration(audioPath);
if (!duration) throw new Error(`Invalid audio duration for ${audioPath}.`);
const openerPath = path.resolve(post.isla_opener || pack.visual_system?.isla_opener || 'vendor/isla-source/assets/sapiver-forge/isla-hook.mp4');
const productImagePath = path.resolve(post.product_image || '');
const openerAvailable = fs.existsSync(openerPath) && fs.statSync(openerPath).size > 0;
const productImageAvailable = fs.existsSync(productImagePath) && fs.statSync(productImagePath).size > 0;
const openerDuration = Math.min(2.35, Math.max(1.65, duration * 0.13));
const productDuration = Math.max(0.6, duration - openerDuration);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `sapiver-forge-video-${postIndex}-`));
const openerVideo = path.join(tempDir, '01-opener.mp4');
const productVideo = path.join(tempDir, '02-product.mp4');
const silentVideo = path.join(tempDir, 'silent.mp4');
const concatFile = path.join(tempDir, 'concat.txt');
const files = {
  hook: path.join(tempDir, 'hook.txt'),
  purpose: path.join(tempDir, 'purpose.txt'),
  decision: path.join(tempDir, 'decision.txt'),
  cta: path.join(tempDir, 'cta.txt'),
  label: path.join(tempDir, 'label.txt'),
};
fs.writeFileSync(files.hook, wrap(post.hook, 24, 4));
fs.writeFileSync(files.purpose, wrap(post.visual_cards?.[1] || post.narration, 31, 4));
fs.writeFileSync(files.decision, wrap(post.visual_cards?.[2] || 'A named human decides', 28, 3));
fs.writeFileSync(files.cta, wrap(post.product, 28, 3));
fs.writeFileSync(files.label, wrap(post.angle.replace(/-/g, ' ').toUpperCase(), 32, 2));

const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const regular = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const hookFilter = [
  'scale=1080:1920:force_original_aspect_ratio=increase',
  'crop=1080:1920',
  'eq=brightness=-0.08:saturation=0.92',
  'drawbox=x=0:y=0:w=1080:h=1920:color=0x061525@0.20:t=fill',
  `drawtext=fontfile=${font}:text='SAPIVER FORGE':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=105`,
  `drawtext=fontfile=${regular}:textfile='${escFilterPath(files.label)}':fontcolor=0xF1A441:fontsize=25:x=(w-text_w)/2:y=190`,
  `drawtext=fontfile=${font}:textfile='${escFilterPath(files.hook)}':fontcolor=white:fontsize=54:line_spacing=16:x=(w-text_w)/2:y=h-text_h-230:box=1:boxcolor=0x071827@0.72:boxborderw=34`,
  'fade=t=in:st=0:d=0.18',
  `fade=t=out:st=${Math.max(0.2, openerDuration - 0.22).toFixed(2)}:d=0.22`,
  'format=yuv420p',
].join(',');

if (openerAvailable) {
  const sourceDuration = probeDuration(openerPath);
  const usable = Math.max(0, sourceDuration - openerDuration - 0.05);
  const start = usable > 0 ? ((postIndex - 1) * 0.73) % usable : 0;
  run('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-ss', start.toFixed(3), '-i', openerPath, '-t', openerDuration.toFixed(3), '-an', '-vf', hookFilter, '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', openerVideo]);
} else {
  run('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=c=0x071827:s=1080x1920:r=30:d=${openerDuration}`, '-t', openerDuration.toFixed(3), '-vf', hookFilter, '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', openerVideo]);
}

const p1 = Math.max(3.0, productDuration * 0.42);
const p2 = Math.max(p1 + 2.4, productDuration * 0.72);
const productText = (file, size, start, end, y, opacity) =>
  `drawtext=fontfile=${font}:textfile='${escFilterPath(file)}':fontcolor=white:fontsize=${size}:line_spacing=16:x=(w-text_w)/2:y=${y}:box=1:boxcolor=0x071827@${opacity}:boxborderw=32:enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'`;
const productFilter = [
  "zoompan=z='min(zoom+0.00045,1.045)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=850x850:fps=30",
  'pad=1080:1920:(ow-iw)/2:305:color=0x071827',
  'drawbox=x=74:y=280:w=932:h=900:color=white@0.08:t=4',
  'drawbox=x=0:y=1200:w=1080:h=720:color=0x061525@0.54:t=fill',
  `drawtext=fontfile=${font}:text='SAPIVER FORGE':fontcolor=white:fontsize=46:x=(w-text_w)/2:y=105`,
  `drawtext=fontfile=${regular}:text='HUMAN CONTROL FOR AI WORKFLOWS':fontcolor=0xF1A441:fontsize=23:x=(w-text_w)/2:y=170`,
  productText(files.purpose, 43, 0, p1, 1310, '0.80'),
  productText(files.decision, 50, p1, p2, 1360, '0.82'),
  productText(files.cta, 45, p2, productDuration + 0.3, 1300, '0.85'),
  `drawtext=fontfile=${regular}:text='VIEW THE PRODUCT THROUGH THE LINK':fontcolor=0xF1A441:fontsize=24:x=(w-text_w)/2:y=1635:enable='between(t,${p2.toFixed(2)},${(productDuration + 0.3).toFixed(2)})'`,
  'drawbox=x=90:y=h-180:w=w-180:h=7:color=white@0.20:t=fill',
  `drawbox=x=90:y=h-180:w='(w-180)*t/${productDuration.toFixed(3)}':h=7:color=0xF1A441@0.95:t=fill`,
  `drawtext=fontfile=${regular}:text='${String(post.day).toUpperCase()}':fontcolor=white@0.74:fontsize=25:x=90:y=h-125`,
  `drawtext=fontfile=${regular}:text='sapiverpress.co.uk':fontcolor=white@0.74:fontsize=25:x=w-text_w-90:y=h-125`,
  'fade=t=in:st=0:d=0.22',
  `fade=t=out:st=${Math.max(0.2, productDuration - 0.35).toFixed(2)}:d=0.35`,
  'format=yuv420p',
].join(',');

const productInput = productImageAvailable
  ? ['-loop', '1', '-i', productImagePath]
  : ['-f', 'lavfi', '-i', `color=c=0x102A3D:s=1200x1200:r=30:d=${productDuration}`];
run('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', ...productInput, '-t', productDuration.toFixed(3), '-vf', productFilter, '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', productVideo]);

fs.writeFileSync(concatFile, `file '${openerVideo.replace(/'/g, "'\\''")}'\nfile '${productVideo.replace(/'/g, "'\\''")}'\n`);
run('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', concatFile, '-c', 'copy', silentVideo]);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
run('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', silentVideo, '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', duration.toFixed(3), '-movflags', '+faststart', outputPath]);

if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) throw new Error(`Video was not created: ${outputPath}`);
const dimensions = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', outputPath], { capture: true });
if (dimensions !== '1080x1920') throw new Error(`Unexpected video dimensions: ${dimensions}`);
console.log(JSON.stringify({
  outputPath,
  duration,
  postIndex,
  cards: 4,
  opener: openerAvailable ? post.isla_opener : 'branded-motion-fallback',
  product_image: productImageAvailable ? post.product_image : 'branded-product-fallback',
  human_motion_opener: openerAvailable,
  approved_product_artwork: productImageAvailable,
}));
