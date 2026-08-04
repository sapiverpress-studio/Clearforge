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
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status}): ${(result.stderr || result.stdout || '').trim()}`);
  }
  return options.capture ? String(result.stdout || '').trim() : '';
}

function wrap(text, max = 27, maxLines = 5) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= max || !current) current = next;
    else {
      lines.push(current);
      current = word;
    }
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

const duration = Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', audioPath], { capture: true }));
if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Invalid audio duration for ${audioPath}.`);

const openerPath = path.resolve(post.isla_opener || pack.visual_system?.isla_opener || 'vendor/isla-source/assets/sapiver-forge/isla-hook.mp4');
const productImagePath = path.resolve(post.product_image || '');
const openerAvailable = fs.existsSync(openerPath) && fs.statSync(openerPath).size > 0;
const productImageAvailable = fs.existsSync(productImagePath) && fs.statSync(productImagePath).size > 0;
const openerDuration = Math.min(2.35, Math.max(1.5, duration * 0.13));
const productDuration = Math.max(0.5, duration - openerDuration);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `sapiver-forge-video-${postIndex}-`));
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
const inputArgs = openerAvailable
  ? ['-stream_loop', '-1', '-i', openerPath]
  : ['-f', 'lavfi', '-i', `color=c=0x071827:s=1080x1920:r=30:d=${openerDuration}`];
inputArgs.push(...(productImageAvailable
  ? ['-loop', '1', '-i', productImagePath]
  : ['-f', 'lavfi', '-i', `color=c=0x102A3D:s=1200x1200:r=30:d=${productDuration}`]));
inputArgs.push('-i', audioPath);

const t2 = Math.max(openerDuration + 3.4, duration * 0.55);
const t3 = Math.max(t2 + 2.8, duration * 0.78);
const text = (file, size, start, end, y, boxOpacity = '0.78') =>
  `drawtext=fontfile=${font}:textfile='${escFilterPath(file)}':fontcolor=white:fontsize=${size}:line_spacing=16:x=(w-text_w)/2:y=${y}:box=1:boxcolor=0x071827@${boxOpacity}:boxborderw=34:enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'`;

const openerFilter = [
  `[0:v]trim=duration=${openerDuration.toFixed(3)},setpts=PTS-STARTPTS`,
  'scale=1080:1920:force_original_aspect_ratio=increase',
  'crop=1080:1920',
  'eq=brightness=-0.08:saturation=0.92',
  'drawbox=x=0:y=0:w=1080:h=1920:color=0x061525@0.18:t=fill',
  'fade=t=in:st=0:d=0.18',
  `fade=t=out:st=${Math.max(0.2, openerDuration - 0.22).toFixed(2)}:d=0.22[opener]`,
].join(',');

const productFilter = [
  '[1:v]split=2[productbg][productfg]',
  `[productbg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2,eq=brightness=-0.48:saturation=0.72,trim=duration=${productDuration.toFixed(3)},setpts=PTS-STARTPTS[bg]`,
  `[productfg]scale=820:820:force_original_aspect_ratio=decrease,pad=820:820:(ow-iw)/2:(oh-ih)/2:color=0x0B1D2D,zoompan=z='min(zoom+0.00045,1.045)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=820x820:fps=30,trim=duration=${productDuration.toFixed(3)},setpts=PTS-STARTPTS[fg]`,
  `[bg][fg]overlay=(W-w)/2:330:shortest=1,drawbox=x=92:y=300:w=896:h=880:color=white@0.08:t=4,drawbox=x=0:y=1210:w=1080:h=710:color=0x061525@0.54:t=fill,fade=t=in:st=0:d=0.28,fade=t=out:st=${Math.max(0.2, productDuration - 0.35).toFixed(2)}:d=0.35[product]`,
].join(';');

const overlayFilter = [
  '[opener][product]concat=n=2:v=1:a=0[base]',
  `[base]drawtext=fontfile=${font}:text='SAPIVER FORGE':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=105`,
  `drawtext=fontfile=${regular}:text='HUMAN CONTROL FOR AI WORKFLOWS':fontcolor=0xF1A441:fontsize=24:x=(w-text_w)/2:y=172`,
  `drawtext=fontfile=${regular}:textfile='${escFilterPath(files.label)}':fontcolor=0xF1A441:fontsize=25:x=(w-text_w)/2:y=245:enable='between(t,0,${openerDuration.toFixed(2)})'`,
  'drawbox=x=90:y=h-180:w=w-180:h=7:color=white@0.20:t=fill',
  `drawbox=x=90:y=h-180:w='(w-180)*t/${duration.toFixed(3)}':h=7:color=0xF1A441@0.95:t=fill`,
  text(files.hook, 54, 0, openerDuration, 'h-text_h-230', '0.72'),
  text(files.purpose, 43, openerDuration, t2, '1320', '0.80'),
  text(files.decision, 50, t2, t3, '1370', '0.82'),
  text(files.cta, 46, t3, duration + 0.3, '1320', '0.84'),
  `drawtext=fontfile=${regular}:text='VIEW THE PRODUCT THROUGH THE LINK':fontcolor=0xF1A441:fontsize=25:x=(w-text_w)/2:y=1635:enable='between(t,${t3.toFixed(2)},${(duration + 0.3).toFixed(2)})'`,
  `drawtext=fontfile=${regular}:text='${String(post.day).toUpperCase()}':fontcolor=white@0.74:fontsize=25:x=90:y=h-125`,
  `drawtext=fontfile=${regular}:text='sapiverpress.co.uk':fontcolor=white@0.74:fontsize=25:x=w-text_w-90:y=h-125`,
  `fade=t=out:st=${Math.max(0, duration - 0.42).toFixed(2)}:d=0.42[v]`,
].join(',');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
run('ffmpeg', [
  '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
  ...inputArgs,
  '-filter_complex', `${openerFilter};${productFilter};${overlayFilter}`,
  '-map', '[v]', '-map', '2:a:0',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-t', duration.toFixed(3), '-movflags', '+faststart', outputPath,
]);

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
