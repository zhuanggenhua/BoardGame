import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const rootDir = process.cwd();

const atlasConfigPath = path.join(
  rootDir,
  'public/assets/atlas-configs/dicethrone/ability-cards-common.atlas.json',
);

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'));

const ensureDir = async (targetDir) => {
  await fs.mkdir(targetDir, { recursive: true });
};

const getScaledAtlasRect = (atlasConfig, metadata, index) => {
  const row = Math.floor(index / atlasConfig.cols);
  const col = index % atlasConfig.cols;
  const scaleX = metadata.width / atlasConfig.imageW;
  const scaleY = metadata.height / atlasConfig.imageH;
  return {
    left: Math.round(atlasConfig.colStarts[col] * scaleX),
    top: Math.round(atlasConfig.rowStarts[row] * scaleY),
    width: Math.round(atlasConfig.colWidths[col] * scaleX),
    height: Math.round(atlasConfig.rowHeights[row] * scaleY),
  };
};

const detectVerticalSplit = async (input) => {
  const { data, info } = await sharp(input)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const startY = Math.floor(info.height * 0.35);
  const endY = Math.floor(info.height * 0.75);
  let bestY = Math.floor(info.height * 0.55);
  let bestScore = Number.POSITIVE_INFINITY;

  for (let y = startY; y <= endY; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < info.width; x += 1) {
      rowSum += data[y * info.width + x];
    }
    if (rowSum < bestScore) {
      bestScore = rowSum;
      bestY = y;
    }
  }

  return Math.max(1, bestY - 40);
};

const normalizeCardBuffer = async (input, cell) => (
  sharp(input)
    .resize({
      width: cell.width,
      height: cell.height,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 100 })
    .toBuffer()
);

const buildRegularSlotCard = async (sourcePath, rect, cell) => {
  const slotBuffer = await sharp(sourcePath)
    .extract(rect)
    .toBuffer();
  return normalizeCardBuffer(slotBuffer, cell);
};

const buildSplitSlotCard = async (sourcePath, rect, cell, part) => {
  const slotBuffer = await sharp(sourcePath)
    .extract(rect)
    .toBuffer();
  const metadata = await sharp(slotBuffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`无法读取分裂卡尺寸: ${sourcePath}`);
  }

  const splitY = await detectVerticalSplit(slotBuffer);
  const extractRect = part === 'top'
    ? { left: 0, top: 0, width: metadata.width, height: splitY }
    : { left: 0, top: splitY, width: metadata.width, height: metadata.height - splitY };

  const segmentBuffer = await sharp(slotBuffer)
    .extract(extractRect)
    .toBuffer();

  return normalizeCardBuffer(segmentBuffer, cell);
};

const buildTopCropCard = async (sourcePath, rect, cell, cropBottom) => {
  const slotBuffer = await sharp(sourcePath)
    .extract(rect)
    .toBuffer();
  const metadata = await sharp(slotBuffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`无法读取顶部裁图尺寸: ${sourcePath}`);
  }

  const topHeight = Math.min(cropBottom, metadata.height);
  const topBuffer = await sharp(slotBuffer)
    .extract({
      left: 0,
      top: 0,
      width: metadata.width,
      height: topHeight,
    })
    .toBuffer();

  return normalizeCardBuffer(topBuffer, cell);
};

const HEROES = [
  {
    heroId: 'gunslinger',
    source: 'public/assets/i18n/zh-CN/dicethrone/images/gunslinger/compressed/ability-cards.webp',
    output: 'public/assets/i18n/zh-CN/dicethrone/images/gunslinger/compressed/hand-cards-atlas.webp',
    grid: { rows: 5, cols: 4 },
    cell: { width: 598, height: 965 },
    cards: [
      { kind: 'slot', index: 18 },
      { kind: 'slot', index: 19 },
      { kind: 'slot', index: 20 },
      { kind: 'slot', index: 21 },
      { kind: 'split', index: 22, part: 'top' },
      { kind: 'split', index: 22, part: 'bottom' },
      { kind: 'split', index: 23, part: 'top' },
      { kind: 'split', index: 23, part: 'bottom' },
      { kind: 'split', index: 24, part: 'top' },
      { kind: 'split', index: 24, part: 'bottom' },
      { kind: 'slot', index: 25 },
      { kind: 'slot', index: 26 },
      { kind: 'slot', index: 27 },
      { kind: 'slot', index: 28 },
      { kind: 'slot', index: 29 },
      { kind: 'slot', index: 30 },
      { kind: 'slot', index: 31 },
    ],
  },
  {
    heroId: 'samurai',
    source: 'public/assets/i18n/zh-CN/dicethrone/images/samurai/compressed/ability-cards.webp',
    output: 'public/assets/i18n/zh-CN/dicethrone/images/samurai/compressed/hand-cards-atlas.webp',
    grid: { rows: 4, cols: 4 },
    cell: { width: 166, height: 268 },
    cards: [
      { kind: 'slot', index: 18 },
      { kind: 'slot', index: 19 },
      { kind: 'slot', index: 20 },
      { kind: 'slot', index: 21 },
      { kind: 'topCrop', index: 22, cropBottom: 180 },
      { kind: 'slot', index: 23 },
      { kind: 'topCrop', index: 24, cropBottom: 180 },
      { kind: 'topCrop', index: 25, cropBottom: 162 },
      { kind: 'slot', index: 26 },
      { kind: 'slot', index: 27 },
      { kind: 'slot', index: 28 },
      { kind: 'slot', index: 29 },
      { kind: 'slot', index: 30 },
      { kind: 'slot', index: 31 },
    ],
  },
];

const buildCardBuffer = async (hero, atlasConfig, metadata, card) => {
  const sourcePath = path.join(rootDir, hero.source);
  const rect = getScaledAtlasRect(atlasConfig, metadata, card.index);
  if (card.kind === 'slot') {
    return buildRegularSlotCard(sourcePath, rect, hero.cell);
  }
  if (card.kind === 'split') {
    return buildSplitSlotCard(sourcePath, rect, hero.cell, card.part);
  }
  if (card.kind === 'topCrop') {
    return buildTopCropCard(sourcePath, rect, hero.cell, card.cropBottom);
  }
  throw new Error(`未知卡牌生成类型: ${card.kind}`);
};

const composeAtlas = async (hero, buffers) => {
  const atlasWidth = hero.grid.cols * hero.cell.width;
  const atlasHeight = hero.grid.rows * hero.cell.height;
  const composites = buffers.map((input, index) => ({
    input,
    left: (index % hero.grid.cols) * hero.cell.width,
    top: Math.floor(index / hero.grid.cols) * hero.cell.height,
  }));

  return sharp({
    create: {
      width: atlasWidth,
      height: atlasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ quality: 86 })
    .toFile(path.join(rootDir, hero.output));
};

const run = async () => {
  const atlasConfig = await readJson(atlasConfigPath);

  for (const hero of HEROES) {
    const outputPath = path.join(rootDir, hero.output);
    await ensureDir(path.dirname(outputPath));

    const metadata = await sharp(path.join(rootDir, hero.source)).metadata();
    const buffers = [];
    for (const card of hero.cards) {
      buffers.push(await buildCardBuffer(hero, atlasConfig, metadata, card));
    }

    const capacity = hero.grid.rows * hero.grid.cols;
    if (buffers.length > capacity) {
      throw new Error(`${hero.heroId} atlas 容量不足: ${buffers.length} > ${capacity}`);
    }

    await composeAtlas(hero, buffers);
    console.log(`[dicethrone] built ${hero.heroId} hand atlas -> ${hero.output}`);
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
