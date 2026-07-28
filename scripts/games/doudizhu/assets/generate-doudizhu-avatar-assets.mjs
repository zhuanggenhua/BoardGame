import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUTPUT_DIR = path.resolve('public/assets/i18n/zh-CN/doudizhu/avatars');
const SIZE = 256;

const AVATARS = [
  {
    id: 'player-1',
    title: '地主',
    face: '#ffc999',
    hair: '#2f140d',
    robeTop: '#ffcf6a',
    robeBottom: '#9b2018',
    sash: '#6d120c',
    badge: '#d72d21',
    headwear: 'landlord',
  },
  {
    id: 'player-2',
    title: '农民',
    face: '#f2bd89',
    hair: '#1d2631',
    robeTop: '#6bd49a',
    robeBottom: '#116343',
    sash: '#d9902a',
    badge: '#158760',
    headwear: 'scarf',
  },
  {
    id: 'player-3',
    title: '农民',
    face: '#ffd1a2',
    hair: '#5a2b16',
    robeTop: '#f3a35d',
    robeBottom: '#8f2f54',
    sash: '#1f7a54',
    badge: '#b64672',
    headwear: 'cap',
  },
];

function avatarSvg(avatar) {
  const headwear = renderHeadwear(avatar);
  return `
    <svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="rim" cx="36%" cy="22%" r="76%">
          <stop offset="0%" stop-color="#fff7cb"/>
          <stop offset="38%" stop-color="#e8b64e"/>
          <stop offset="72%" stop-color="#8b2b16"/>
          <stop offset="100%" stop-color="#230905"/>
        </radialGradient>
        <radialGradient id="innerGlow" cx="50%" cy="36%" r="72%">
          <stop offset="0%" stop-color="#fff2bc" stop-opacity="0.95"/>
          <stop offset="54%" stop-color="#b45d26" stop-opacity="0.42"/>
          <stop offset="100%" stop-color="#140805" stop-opacity="0.88"/>
        </radialGradient>
        <linearGradient id="robe" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${avatar.robeTop}"/>
          <stop offset="58%" stop-color="${avatar.robeBottom}"/>
          <stop offset="100%" stop-color="#260804"/>
        </linearGradient>
        <linearGradient id="badge" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#fff0a8"/>
          <stop offset="100%" stop-color="${avatar.badge}"/>
        </linearGradient>
        <filter id="shadow" x="-22%" y="-22%" width="144%" height="144%">
          <feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#120602" flood-opacity="0.45"/>
        </filter>
        <filter id="soft" x="-12%" y="-12%" width="124%" height="124%">
          <feGaussianBlur stdDeviation="1.2"/>
        </filter>
      </defs>
      <circle cx="128" cy="128" r="116" fill="url(#rim)" filter="url(#shadow)"/>
      <circle cx="128" cy="128" r="101" fill="#42120c"/>
      <circle cx="128" cy="126" r="90" fill="url(#innerGlow)"/>
      <ellipse cx="128" cy="201" rx="68" ry="26" fill="#080302" opacity="0.34"/>

      <path d="M45 220 C58 168,86 140,128 140 C170 140,198 168,211 220 Z" fill="url(#robe)"/>
      <path d="M71 205 C86 173,104 158,128 158 C152 158,170 173,185 205 Z" fill="#fff0bd" opacity="0.12"/>
      <path d="M83 176 C103 193,152 193,174 176 L184 220 L72 220 Z" fill="#1a0804" opacity="0.2"/>
      <path d="M73 188 L183 188 L195 222 L61 222 Z" fill="${avatar.sash}" opacity="0.9"/>
      <path d="M78 189 C110 201,146 201,178 189" fill="none" stroke="#fff0bd" stroke-width="3" opacity="0.22"/>

      <ellipse cx="91" cy="125" rx="14" ry="22" fill="${avatar.face}"/>
      <ellipse cx="165" cy="125" rx="14" ry="22" fill="${avatar.face}"/>
      <circle cx="128" cy="111" r="56" fill="${avatar.face}"/>
      <path d="M74 106 C78 54,111 38,128 46 C149 34,178 57,182 106 C166 83,91 83,74 106Z" fill="${avatar.hair}"/>
      <path d="M82 98 C104 59,152 58,174 98 C151 84,105 84,82 98Z" fill="#fff4c7" opacity="0.1"/>
      ${headwear}

      <ellipse cx="109" cy="114" rx="6" ry="8" fill="#351008"/>
      <ellipse cx="147" cy="114" rx="6" ry="8" fill="#351008"/>
      <circle cx="106" cy="111" r="2" fill="#fff7d6" opacity="0.92"/>
      <circle cx="144" cy="111" r="2" fill="#fff7d6" opacity="0.92"/>
      <path d="M124 121 C122 129,122 134,128 136" fill="none" stroke="#9a4d2d" stroke-width="4" stroke-linecap="round"/>
      <path d="M108 139 C121 151,137 151,150 139" fill="none" stroke="#7a2f1d" stroke-width="6" stroke-linecap="round"/>
      <path d="M94 101 C102 95,112 94,121 98" fill="none" stroke="#2d120b" stroke-width="4" stroke-linecap="round" opacity="0.72"/>
      <path d="M135 98 C144 94,154 95,162 101" fill="none" stroke="#2d120b" stroke-width="4" stroke-linecap="round" opacity="0.72"/>

      <g transform="translate(128 196)">
        <rect x="-48" y="-18" width="96" height="36" rx="18" fill="#210906" opacity="0.58"/>
        <rect x="-42" y="-14" width="84" height="28" rx="14" fill="url(#badge)"/>
        <text x="0" y="9" text-anchor="middle" font-size="21" font-weight="900" fill="#fff7ce" font-family="'Microsoft YaHei', Arial">${avatar.title}</text>
      </g>

      <path d="M51 74 C78 33,145 20,194 64" fill="none" stroke="#fff2ba" stroke-width="9" opacity="0.24" filter="url(#soft)"/>
      <circle cx="84" cy="63" r="12" fill="#fff6c9" opacity="0.42"/>
      <circle cx="128" cy="128" r="111" fill="none" stroke="#fff0ad" stroke-width="7" opacity="0.82"/>
      <circle cx="128" cy="128" r="94" fill="none" stroke="#5a160d" stroke-width="4" opacity="0.58"/>
      <circle cx="128" cy="128" r="82" fill="none" stroke="#fff6ce" stroke-width="1.5" opacity="0.18"/>
    </svg>`;
}

function renderHeadwear(avatar) {
  if (avatar.headwear === 'landlord') {
    return `
      <g>
        <path d="M83 73 C104 44,152 44,173 73 L164 88 C143 75,112 75,92 88 Z" fill="#762015"/>
        <path d="M98 70 L111 39 L128 64 L145 39 L158 70 Z" fill="#ffce63"/>
        <path d="M106 67 L128 45 L150 67" fill="none" stroke="#7c1d13" stroke-width="5" stroke-linejoin="round"/>
        <circle cx="128" cy="53" r="8" fill="#fff2b1"/>
      </g>`;
  }
  if (avatar.headwear === 'scarf') {
    return `
      <g>
        <path d="M75 93 C94 73,161 73,181 93 L174 107 C148 96,108 96,82 107 Z" fill="#16825d"/>
        <path d="M163 92 C178 100,187 115,187 134 C176 126,166 113,154 100Z" fill="#f0a23f"/>
        <path d="M85 93 C105 83,149 83,171 93" fill="none" stroke="#fff0ad" stroke-width="4" opacity="0.45"/>
      </g>`;
  }
  return `
    <g>
      <path d="M80 91 C95 60,157 58,176 91 L166 105 C144 92,111 92,90 105 Z" fill="#8f2f54"/>
      <ellipse cx="128" cy="88" rx="52" ry="14" fill="#ffd36d" opacity="0.26"/>
      <path d="M102 77 C119 68,139 68,156 77" fill="none" stroke="#fff0ad" stroke-width="4" opacity="0.4"/>
    </g>`;
}

await fs.mkdir(OUTPUT_DIR, { recursive: true });

for (const avatar of AVATARS) {
  await sharp(Buffer.from(avatarSvg(avatar)))
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUTPUT_DIR, `${avatar.id}.png`));
}

console.log(`Generated ${AVATARS.length} doudizhu avatar PNGs in ${OUTPUT_DIR}`);
