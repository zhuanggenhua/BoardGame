import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUTPUT_DIR = path.resolve('public/assets/i18n/zh-CN/doudizhu/cards/faces');
const WIDTH = 400;
const HEIGHT = 560;

const SUITS = [
  { id: 'spade', glyph: '♠', color: '#111827', soft: '#d7dee8', pipFill: '#172033' },
  { id: 'heart', glyph: '♥', color: '#c51f28', soft: '#f4d3cf', pipFill: '#cf2d2d' },
  { id: 'club', glyph: '♣', color: '#111827', soft: '#d7dee8', pipFill: '#172033' },
  { id: 'diamond', glyph: '♦', color: '#c51f28', soft: '#f4d3cf', pipFill: '#cf2d2d' },
];

const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

const PIPS = {
  A: [[0.5, 0.5, 0, 112]],
  K: [[0.5, 0.35, 0, 54], [0.5, 0.68, 180, 54]],
  Q: [[0.5, 0.35, 0, 54], [0.5, 0.68, 180, 54]],
  J: [[0.5, 0.35, 0, 54], [0.5, 0.68, 180, 54]],
  '10': [[0.34, 0.25, 0, 44], [0.66, 0.25, 0, 44], [0.34, 0.37, 0, 44], [0.66, 0.37, 0, 44], [0.34, 0.49, 0, 44], [0.66, 0.49, 0, 44], [0.34, 0.61, 180, 44], [0.66, 0.61, 180, 44], [0.34, 0.73, 180, 44], [0.66, 0.73, 180, 44]],
  '9': [[0.34, 0.27, 0, 48], [0.66, 0.27, 0, 48], [0.34, 0.41, 0, 48], [0.66, 0.41, 0, 48], [0.5, 0.51, 0, 48], [0.34, 0.61, 180, 48], [0.66, 0.61, 180, 48], [0.34, 0.75, 180, 48], [0.66, 0.75, 180, 48]],
  '8': [[0.34, 0.27, 0, 50], [0.66, 0.27, 0, 50], [0.34, 0.42, 0, 50], [0.66, 0.42, 0, 50], [0.34, 0.58, 180, 50], [0.66, 0.58, 180, 50], [0.34, 0.73, 180, 50], [0.66, 0.73, 180, 50]],
  '7': [[0.34, 0.28, 0, 52], [0.66, 0.28, 0, 52], [0.5, 0.41, 0, 52], [0.34, 0.54, 0, 52], [0.66, 0.54, 0, 52], [0.34, 0.73, 180, 52], [0.66, 0.73, 180, 52]],
  '6': [[0.34, 0.28, 0, 54], [0.66, 0.28, 0, 54], [0.34, 0.51, 0, 54], [0.66, 0.51, 0, 54], [0.34, 0.74, 180, 54], [0.66, 0.74, 180, 54]],
  '5': [[0.34, 0.3, 0, 58], [0.66, 0.3, 0, 58], [0.5, 0.52, 0, 58], [0.34, 0.74, 180, 58], [0.66, 0.74, 180, 58]],
  '4': [[0.35, 0.31, 0, 62], [0.65, 0.31, 0, 62], [0.35, 0.73, 180, 62], [0.65, 0.73, 180, 62]],
  '3': [[0.5, 0.31, 0, 68], [0.5, 0.52, 0, 68], [0.5, 0.73, 180, 68]],
  '2': [[0.5, 0.34, 0, 76], [0.5, 0.7, 180, 76]],
};

function escapeText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function pipSvg({ glyph, color, x, y, rotate, size }) {
  return `
    <g transform="translate(${x} ${y}) rotate(${rotate})">
      <text x="0" y="0" text-anchor="middle" dominant-baseline="middle"
        font-size="${size}" font-weight="900" fill="${color}"
        font-family="Arial, 'Microsoft YaHei'">${glyph}</text>
    </g>`;
}

function cornerSvg({ rank, glyph, color, x, y, rotate = 0 }) {
  const rankSize = rank === '10' ? 54 : 68;
  const suitSize = rank === '10' ? 43 : 48;
  return `
    <g transform="translate(${x} ${y}) rotate(${rotate})">
      <text x="0" y="0" text-anchor="middle" font-size="${rankSize}" font-weight="950"
        fill="${color}" stroke="#ffffff" stroke-width="3" paint-order="stroke"
        font-family="Arial Black, Arial, 'Microsoft YaHei'">${escapeText(rank)}</text>
      <text x="0" y="48" text-anchor="middle" font-size="${suitSize}" font-weight="950"
        fill="${color}" stroke="#ffffff" stroke-width="2" paint-order="stroke"
        font-family="Arial, 'Microsoft YaHei'">${glyph}</text>
    </g>`;
}

function faceCardSvg(rank, suit) {
  const titles = { J: '侍', Q: '姬', K: '将' };
  const title = titles[rank];
  if (!title) return '';
  const crown = rank === 'K'
    ? '<path d="M162 203 L181 169 L200 202 L221 169 L238 203 Z" fill="#e7b653" stroke="#8d4b17" stroke-width="5"/>'
    : rank === 'Q'
      ? '<path d="M160 203 C178 176,222 176,240 203 C220 194,180 194,160 203Z" fill="#e7b653" stroke="#8d4b17" stroke-width="5"/>'
      : '<path d="M164 203 C178 182,222 182,236 203" fill="none" stroke="#8d4b17" stroke-width="9" stroke-linecap="round"/>';
  return `
    <g>
      <ellipse cx="200" cy="294" rx="88" ry="126" fill="${suit.soft}" opacity="0.72"/>
      <ellipse cx="200" cy="292" rx="76" ry="112" fill="#fff6df" stroke="${suit.color}" stroke-width="7" opacity="0.94"/>
      ${crown}
      <path d="M155 298 C166 244,234 244,245 298 L232 374 L168 374 Z" fill="${suit.color}" opacity="0.16"/>
      <circle cx="178" cy="270" r="8" fill="${suit.color}" opacity="0.9"/>
      <circle cx="222" cy="270" r="8" fill="${suit.color}" opacity="0.9"/>
      <path d="M180 318 C193 330,207 330,220 318" fill="none" stroke="${suit.color}" stroke-width="8" stroke-linecap="round" opacity="0.82"/>
      <text x="200" y="338" text-anchor="middle" font-size="88" font-weight="950"
        fill="${suit.color}" opacity="0.9" font-family="'Microsoft YaHei', Arial">${title}</text>
      <text x="200" y="401" text-anchor="middle" font-size="46" font-weight="900"
        fill="${suit.color}" font-family="Arial, 'Microsoft YaHei'">${suit.glyph}</text>
    </g>`;
}

function numberPipsSvg(rank, suit) {
  const pips = PIPS[rank] ?? [];
  return pips.map(([px, py, rotate, size]) => pipSvg({
    glyph: suit.glyph,
    color: suit.pipFill,
    x: Math.round(px * WIDTH),
    y: Math.round(py * HEIGHT),
    rotate,
    size,
  })).join('\n');
}

function baseCardSvg(inner) {
  return `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="paper" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="58%" stop-color="#fffdf4"/>
          <stop offset="100%" stop-color="#f0d7a7"/>
        </linearGradient>
        <linearGradient id="rim" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#fff1bf"/>
          <stop offset="48%" stop-color="#d39a47"/>
          <stop offset="100%" stop-color="#8f5726"/>
        </linearGradient>
        <radialGradient id="centerGlow" cx="50%" cy="38%" r="60%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.78"/>
          <stop offset="100%" stop-color="#f2d29b" stop-opacity="0"/>
        </radialGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#1d0b04" flood-opacity="0.38"/>
        </filter>
      </defs>
      <rect x="12" y="10" width="376" height="540" rx="34" fill="#1b0a05" opacity="0.25" filter="url(#softShadow)"/>
      <rect x="14" y="12" width="372" height="536" rx="36" fill="url(#paper)"/>
      <rect x="22" y="20" width="356" height="520" rx="30" fill="none" stroke="url(#rim)" stroke-width="9"/>
      <rect x="38" y="38" width="324" height="484" rx="22" fill="none" stroke="#ffffff" stroke-width="5" opacity="0.86"/>
      <rect x="54" y="74" width="292" height="412" rx="25" fill="#fff9e8" opacity="0.52"/>
      <ellipse cx="200" cy="286" rx="126" ry="190" fill="url(#centerGlow)"/>
      <path d="M72 96 C128 72,272 72,328 96" stroke="#ffffff" stroke-width="10" stroke-linecap="round" opacity="0.64"/>
      <path d="M74 502 C130 524,270 524,326 502" stroke="#d6a154" stroke-width="7" stroke-linecap="round" opacity="0.36"/>
      ${inner}
    </svg>`;
}

function normalCardSvg({ rank, suit }) {
  const center = faceCardSvg(rank, suit) || numberPipsSvg(rank, suit);
  return baseCardSvg(`
    ${cornerSvg({ rank, glyph: suit.glyph, color: suit.color, x: 72, y: 78 })}
    ${cornerSvg({ rank, glyph: suit.glyph, color: suit.color, x: 328, y: 482, rotate: 180 })}
    ${center}
  `);
}

function jokerSvg({ id, label, color, accent, soft }) {
  const rank = id === 'joker-big' ? '大' : '小';
  return baseCardSvg(`
    ${cornerSvg({ rank, glyph: '王', color, x: 72, y: 78 })}
    ${cornerSvg({ rank, glyph: '王', color, x: 328, y: 482, rotate: 180 })}
    <ellipse cx="200" cy="292" rx="96" ry="132" fill="${soft}" opacity="0.76"/>
    <ellipse cx="200" cy="288" rx="82" ry="118" fill="#fff7dc" stroke="${accent}" stroke-width="8"/>
    <path d="M146 248 C160 190,240 190,254 248 L236 366 L164 366 Z" fill="${color}" opacity="0.13"/>
    <text x="200" y="277" text-anchor="middle" font-size="82" font-weight="950" fill="${color}" font-family="'Microsoft YaHei', Arial">${label}</text>
    <text x="200" y="351" text-anchor="middle" font-size="36" font-weight="950" fill="#8b5a2b" font-family="Arial">JOKER</text>
    <path d="M150 386 C178 409,222 409,250 386" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" opacity="0.72"/>
  `);
}

async function writePng(fileName, svg) {
  const output = path.join(OUTPUT_DIR, fileName);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(output);
}

await fs.mkdir(OUTPUT_DIR, { recursive: true });

for (const suit of SUITS) {
  for (const rank of RANKS) {
    await writePng(`${suit.id}-${rank.toLowerCase()}.png`, normalCardSvg({ rank, suit }));
  }
}

await writePng('joker-small.png', jokerSvg({
  id: 'joker-small',
  label: '小王',
  color: '#111827',
  accent: '#33445f',
  soft: '#d7dee8',
}));
await writePng('joker-big.png', jokerSvg({
  id: 'joker-big',
  label: '大王',
  color: '#c51f28',
  accent: '#d96b62',
  soft: '#f4d3cf',
}));

console.log(`Generated ${SUITS.length * RANKS.length + 2} doudizhu card face PNGs in ${OUTPUT_DIR}`);
