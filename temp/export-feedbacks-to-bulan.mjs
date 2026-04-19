import fs from 'node:fs';
import path from 'node:path';

const workspace = 'D:/gongzuo/webgame/BoardGame';
const inputPath = path.join(workspace, 'temp', 'all-feedbacks.json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const baseRoot = fs.existsSync('C:/Users/zhuagenbao/GameNotes')
  ? 'C:/Users/zhuagenbao/GameNotes'
  : 'C:/Users/zhuagenbao/Desktop';
const outputRoot = path.join(baseRoot, '不烂', `BoardGame反馈导出-${timestamp}`);
const imagesRoot = path.join(outputRoot, 'images');
const itemsRoot = path.join(outputRoot, 'items');
fs.mkdirSync(imagesRoot, { recursive: true });
fs.mkdirSync(itemsRoot, { recursive: true });

const raw = fs.readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, '');
const docs = JSON.parse(raw);
const imageRe = /!\[([^\]]*)\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/g;

function safeName(value) {
  return String(value || 'unknown').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}

function extFromMime(mime) {
  if (mime.includes('png')) return '.png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('svg')) return '.svg';
  return '.bin';
}

async function saveImage(src, outBase) {
  if (src.startsWith('data:image/')) {
    const m = src.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!m) return null;
    const [, mime, b64] = m;
    const filePath = `${outBase}${extFromMime(mime)}`;
    fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
    return filePath;
  }
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`download failed: ${src} -> ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get('content-type') || 'image/png';
    const filePath = `${outBase}${extFromMime(ct)}`;
    fs.writeFileSync(filePath, buf);
    return filePath;
  }
  return null;
}

const summary = [];
for (const doc of docs) {
  const game = safeName(doc.gameName || 'unknown');
  const itemDir = path.join(itemsRoot, game);
  const imageDir = path.join(imagesRoot, game, doc._id);
  fs.mkdirSync(itemDir, { recursive: true });
  fs.mkdirSync(imageDir, { recursive: true });

  const matches = [...doc.content.matchAll(imageRe)];
  const imageRecords = [];
  for (let i = 0; i < matches.length; i++) {
    const [, alt, src] = matches[i];
    try {
      const saved = await saveImage(src, path.join(imageDir, `${String(i + 1).padStart(2, '0')}-${safeName(alt || 'screenshot')}`));
      imageRecords.push({ index: i + 1, alt: alt || '', srcType: src.startsWith('data:') ? 'embedded' : 'url', savedPath: saved ? path.relative(outputRoot, saved).replace(/\\/g, '/') : null });
    } catch (error) {
      imageRecords.push({ index: i + 1, alt: alt || '', srcType: src.startsWith('data:') ? 'embedded' : 'url', savedPath: null, error: String(error) });
    }
  }

  const plainText = doc.content.replace(imageRe, '').trim();
  const md = [
    `# Feedback ${doc._id}`,
    '',
    `- status: ${doc.status ?? ''}`,
    `- gameName: ${doc.gameName ?? ''}`,
    `- severity: ${doc.severity ?? ''}`,
    `- type: ${doc.type ?? ''}`,
    `- userId: ${doc.userId ?? ''}`,
    `- createdAt: ${doc.createdAt ?? ''}`,
    `- updatedAt: ${doc.updatedAt ?? ''}`,
    `- imageCount: ${imageRecords.length}`,
    '',
    '## content(text)',
    '',
    plainText || '(only images)',
    '',
    '## content(raw)',
    '',
    doc.content || '',
    '',
    '## images',
    '',
    ...(imageRecords.length ? imageRecords.map(img => `- [${img.index}] alt=${img.alt || '(empty)'} | type=${img.srcType} | file=${img.savedPath || 'FAILED'}${img.error ? ` | error=${img.error}` : ''}`) : ['- none']),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(itemDir, `${doc._id}.md`), md, 'utf8');
  summary.push({ ...doc, imageCount: imageRecords.length, imageFiles: imageRecords.map(x => x.savedPath).filter(Boolean) });
}

fs.writeFileSync(path.join(outputRoot, 'feedbacks.json'), JSON.stringify(summary, null, 2), 'utf8');
fs.writeFileSync(path.join(outputRoot, 'feedbacks.csv'), [
  'id,status,gameName,severity,type,userId,createdAt,updatedAt,imageCount,content',
  ...summary.map(doc => [doc._id, doc.status, doc.gameName, doc.severity, doc.type, doc.userId, doc.createdAt, doc.updatedAt, doc.imageCount, JSON.stringify((doc.content || '').replace(/\r?\n/g, ' '))].join(','))
].join('\n'), 'utf8');
fs.writeFileSync(path.join(outputRoot, 'README.txt'), [
  `导出时间: ${new Date().toISOString()}`,
  `总数: ${summary.length}`,
  `目录: ${outputRoot}`,
  '说明: items/ 下是逐条 markdown，images/ 下是拆出来的截图，feedbacks.json/csv 是总表。',
].join('\n'), 'utf8');
console.log(outputRoot);