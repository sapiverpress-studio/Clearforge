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

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `sapiver-forge-video-${postIndex}-`));
const files = {
  hook: path.join(tempDir, 'hook.txt'),
  purpose: path.join(tempDir, 'purpose.txt'),
  decision: path.join(tempDir, 'decision.txt'),
  cta: path.join(tempDir, 'cta.txt'),
};

fs.writeFileSync(files.hook, wrap(post.hook, 25, 5));
fs.writeFileSync(files.purpose, wrap(post.visual_cards?.[1] || post.narration, 30, 5));
fs.writeFileSync(files.decision, wrap(post.visual_cards?.[2] || 'A named human decides', 28, 4));
fs.writeFileSync(files.cta, wrap(`See the ${post.product}`, 27, 4));

const t1 = Math.max(3.5, duration * 0.28);
const t2 = Math.max(t1 + 3, duration * 0.57);
const t3 = Math.max(t2 + 2.5, duration * 0.79);
const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const regular = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const text = (file, size, start, end) =>
  `drawtext=fontfile=${font}:textfile='${escFilterPath(file)}':fontcolor=white:fontsize=${size}:line_spacing=18:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=0x071827@0.88:boxborderw=42:enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'`;

const filter = [
  'format=yuv420p',
  "drawbox=x='80+20*sin(t*0.7)':y=250:w=920:h=920:color=0xD95B2B@0.10:t=fill",
  "drawbox=x='140-15*sin(t*0.5)':y=1120:w=800:h=420:color=0xF1A441@0.08:t=fill",
  `drawtext=fontfile=${font}:text='SAPIVER FORGE':fontcolor=white:fontsize=50:x=(w-text_w)/2:y=145`,
  `drawtext=fontfile=${regular}:text='HUMAN CONTROL FOR AI WORKFLOWS':fontcolor=0xF1A441:fontsize=25:x=(w-text_w)/2:y=220`,
  'drawbox=x=100:y=h-210:w=w-200:h=8:color=white@0.18:t=fill',
  `drawbox=x=100:y=h-210:w='(w-200)*t/${duration.toFixed(3)}':h=8:color=0xF1A441@0.95:t=fill`,
  text(files.hook, 58, 0, t1),
  text(files.purpose, 47, t1, t2),
  text(files.decision, 56, t2, t3),
  text(files.cta, 52, t3, duration + 0.5),
  `drawtext=fontfile=${regular}:text='${String(post.day).toUpperCase()}':fontcolor=white@0.72:fontsize=27:x=90:y=h-150`,
  `drawtext=fontfile=${regular}:text='sapiverpress.co.uk':fontcolor=white@0.72:fontsize=27:x=w-text_w-90:y=h-150`,
  'fade=t=in:st=0:d=0.35',
  `fade=t=out:st=${Math.max(0, duration - 0.45).toFixed(2)}:d=0.45`,
].join(',');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
run('ffmpeg', [
  '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
  '-f', 'lavfi', '-i', `color=c=0x071827:s=1080x1920:r=30:d=${duration}`,
  '-i', audioPath,
  '-vf', filter,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outputPath,
]);

if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) throw new Error(`Video was not created: ${outputPath}`);
console.log(JSON.stringify({ outputPath, duration, postIndex, cards: 4 }));
