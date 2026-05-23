#!/usr/bin/env node
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const usage = () => {
  console.error([
    'Usage: node scripts/assets/make_emote_transparent.mjs <input> [output]',
    '',
    'Removes a near-solid edge-connected background from an emote image.',
    'Defaults to overwriting <input>. Use --threshold <0-255> to tune tolerance.',
    'Example:',
    '  node scripts/assets/make_emote_transparent.mjs public/assets/i18n/zh-CN/dicethrone/emotes/moon-elf/speechless-facepalm-chibi-v1.png',
  ].join('\n'));
};

const args = process.argv.slice(2);
const thresholdIndex = args.indexOf('--threshold');
let threshold = 34;
if (thresholdIndex >= 0) {
  const raw = args[thresholdIndex + 1];
  threshold = Number.parseInt(raw, 10);
  args.splice(thresholdIndex, 2);
}

const inputPath = args[0];
const outputPath = args[1] ?? inputPath;
if (!inputPath || !outputPath || !Number.isFinite(threshold)) {
  usage();
  process.exit(1);
}
if (!existsSync(inputPath)) {
  console.error(`Input not found: ${inputPath}`);
  process.exit(1);
}

const colorDistance = (data, index, color) => {
  const dr = data[index] - color.r;
  const dg = data[index + 1] - color.g;
  const db = data[index + 2] - color.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

const indexFor = (x, y, width) => (y * width + x) * 4;

const markIfBackground = ({ x, y, width, height, data, visited, queue, background }) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const pixel = y * width + x;
  if (visited[pixel]) return;
  const index = pixel * 4;
  if (data[index + 3] === 0 || colorDistance(data, index, background) <= threshold) {
    visited[pixel] = 1;
    queue.push(pixel);
  }
};

const image = sharp(inputPath);
const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
const corners = [
  indexFor(0, 0, width),
  indexFor(width - 1, 0, width),
  indexFor(0, height - 1, width),
  indexFor(width - 1, height - 1, width),
];
const background = corners.reduce((acc, index) => ({
  r: acc.r + data[index],
  g: acc.g + data[index + 1],
  b: acc.b + data[index + 2],
}), { r: 0, g: 0, b: 0 });
background.r /= corners.length;
background.g /= corners.length;
background.b /= corners.length;

const visited = new Uint8Array(width * height);
const queue = [];
for (let x = 0; x < width; x += 1) {
  markIfBackground({ x, y: 0, width, height, data, visited, queue, background });
  markIfBackground({ x, y: height - 1, width, height, data, visited, queue, background });
}
for (let y = 1; y < height - 1; y += 1) {
  markIfBackground({ x: 0, y, width, height, data, visited, queue, background });
  markIfBackground({ x: width - 1, y, width, height, data, visited, queue, background });
}

let removed = 0;
for (let cursor = 0; cursor < queue.length; cursor += 1) {
  const pixel = queue[cursor];
  const x = pixel % width;
  const y = Math.floor(pixel / width);
  const index = pixel * 4;
  if (data[index + 3] !== 0) {
    data[index + 3] = 0;
    removed += 1;
  }

  markIfBackground({ x: x + 1, y, width, height, data, visited, queue, background });
  markIfBackground({ x: x - 1, y, width, height, data, visited, queue, background });
  markIfBackground({ x, y: y + 1, width, height, data, visited, queue, background });
  markIfBackground({ x, y: y - 1, width, height, data, visited, queue, background });
}

await sharp(data, { raw: { width, height, channels: 4 } })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(outputPath);

console.log(JSON.stringify({
  input: path.normalize(inputPath),
  output: path.normalize(outputPath),
  width,
  height,
  threshold,
  removedPixels: removed,
  removedRatio: Number((removed / (width * height)).toFixed(4)),
}, null, 2));
