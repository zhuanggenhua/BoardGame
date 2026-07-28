import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUTPUT_DIR = path.resolve('public/assets/i18n/zh-CN/doudizhu/chips');
const SIZE = 256;

const CHIPS = [
  { id: 'bid-pass', label: '过', top: '#325b47', mid: '#183426', edge: '#d8f3df', accent: '#9fe5aa' },
  { id: 'bid-1', label: '1', top: '#fff1ad', mid: '#e5a23c', edge: '#fff0b8', accent: '#b43b22' },
  { id: 'bid-2', label: '2', top: '#ffe188', mid: '#d9732e', edge: '#fff0b8', accent: '#a9261b' },
  { id: 'bid-3', label: '3', top: '#fff4bd', mid: '#f05a35', edge: '#fff0b8', accent: '#8b170f' },
];

function chipSvg(chip) {
  return `
    <svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="face" cx="36%" cy="25%" r="72%">
          <stop offset="0%" stop-color="${chip.top}"/>
          <stop offset="54%" stop-color="${chip.mid}"/>
          <stop offset="100%" stop-color="${chip.accent}"/>
        </radialGradient>
        <linearGradient id="shine" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.65"/>
          <stop offset="42%" stop-color="#ffffff" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.18"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="9" stdDeviation="9" flood-color="#170604" flood-opacity="0.38"/>
        </filter>
      </defs>
      <circle cx="128" cy="128" r="112" fill="#150604" opacity="0.9" filter="url(#shadow)"/>
      <circle cx="128" cy="128" r="104" fill="url(#face)"/>
      <circle cx="128" cy="128" r="80" fill="#2d0d08" opacity="0.18"/>
      <circle cx="128" cy="128" r="62" fill="#fff4bd" opacity="0.17"/>
      ${Array.from({ length: 12 }, (_, index) => {
        const angle = (index * 30 - 7) * Math.PI / 180;
        const x = 128 + Math.cos(angle) * 88;
        const y = 128 + Math.sin(angle) * 88;
        return `<rect x="${x - 9}" y="${y - 18}" width="18" height="36" rx="7" fill="${chip.edge}" opacity="0.84" transform="rotate(${index * 30} ${x} ${y})"/>`;
      }).join('')}
      <circle cx="128" cy="128" r="101" fill="none" stroke="${chip.edge}" stroke-width="8" opacity="0.9"/>
      <circle cx="128" cy="128" r="72" fill="none" stroke="#5c160d" stroke-width="5" opacity="0.5"/>
      <circle cx="128" cy="128" r="48" fill="#fff2ba" opacity="0.2"/>
      <path d="M58 84 C82 34,178 34,200 84 C158 66,101 66,58 84Z" fill="url(#shine)"/>
      <text x="128" y="${chip.label === '过' ? 144 : 151}" text-anchor="middle" font-size="${chip.label === '过' ? 72 : 92}" font-weight="900" fill="#fff8d6" stroke="#5a170d" stroke-width="7" paint-order="stroke" font-family="'Microsoft YaHei', Arial">${chip.label}</text>
      <text x="128" y="198" text-anchor="middle" font-size="24" font-weight="900" fill="#fff0b8" opacity="0.82" font-family="'Microsoft YaHei', Arial">叫分</text>
    </svg>`;
}

await fs.mkdir(OUTPUT_DIR, { recursive: true });

for (const chip of CHIPS) {
  await sharp(Buffer.from(chipSvg(chip)))
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUTPUT_DIR, `${chip.id}.png`));
}

console.log(`Generated ${CHIPS.length} doudizhu chip PNGs in ${OUTPUT_DIR}`);
