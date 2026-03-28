import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const rootDir = process.cwd();

const jobs = [
  {
    source: 'public/assets/i18n/zh-CN/dicethrone/images/gunslinger/compressed/player-board.webp',
    outputDir: 'public/assets/i18n/zh-CN/dicethrone/images/gunslinger/crops/player-board',
    entries: [
      { id: 'revolver', left: 0, top: 170, width: 330, height: 485 },
      { id: 'bounty-hunter', left: 330, top: 170, width: 340, height: 485 },
      { id: 'quick-draw', left: 0, top: 640, width: 330, height: 490 },
      { id: 'take-cover', left: 330, top: 640, width: 340, height: 490 },
      { id: 'showdown', left: 1380, top: 170, width: 340, height: 485 },
      { id: 'deadeye', left: 1715, top: 170, width: 333, height: 485 },
      { id: 'fan-the-hammer', left: 1380, top: 640, width: 340, height: 490 },
      { id: 'duel', left: 1715, top: 640, width: 333, height: 490 },
      { id: 'fill-em-with-lead', left: 650, top: 885, width: 750, height: 340 },
    ],
  },
  {
    source: 'public/assets/i18n/zh-CN/dicethrone/images/gunslinger/compressed/tip.webp',
    outputDir: 'public/assets/i18n/zh-CN/dicethrone/images/gunslinger/crops/tip',
    entries: [
      { id: 'evasive', left: 0, top: 0, width: 700, height: 470 },
      { id: 'reload', left: 0, top: 450, width: 700, height: 510 },
      { id: 'knockdown', left: 0, top: 930, width: 700, height: 480 },
      { id: 'bounty', left: 0, top: 1390, width: 700, height: 560 },
      { id: 'dice-legend', left: 720, top: 1310, width: 360, height: 660 },
    ],
  },
];

const abilityCardsAtlasJob = {
  source: 'public/assets/i18n/zh-CN/dicethrone/images/gunslinger/compressed/ability-cards.webp',
  outputDir: 'public/assets/i18n/zh-CN/dicethrone/images/gunslinger/crops/ability-cards',
  atlasConfigPath: 'public/assets/atlas-configs/dicethrone/ability-cards-common.atlas.json',
  maxIndex: 31,
  splitEntries: [
    { id: 'fan-the-hammer-2', left: 2073, top: 2127, width: 598, height: 540 },
    { id: 'pistol-whip', left: 2073, top: 2557, width: 598, height: 553 },
    { id: 'take-cover-2', left: 2743, top: 2127, width: 598, height: 540 },
    { id: 'mark-the-target', left: 2743, top: 2557, width: 598, height: 553 },
    { id: 'deadeye-2', left: 3413, top: 2127, width: 598, height: 540 },
    { id: 'the-law', left: 3413, top: 2557, width: 598, height: 553 },
    { id: 'hero-portrait-extra', left: 6065, top: 6318, width: 675, height: 1054 },
  ],
};

async function ensureDir(targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
}

async function readJson(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  const content = await fs.readFile(absolutePath, 'utf8');
  return JSON.parse(content);
}

async function extractFromRect(sourcePath, outputPath, rect) {
  await sharp(sourcePath)
    .extract({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    })
    .webp({ quality: 100 })
    .toFile(outputPath);
}

function getScaledAtlasRect(atlasConfig, metadata, index) {
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
}

async function run() {
  for (const job of jobs) {
    const sourcePath = path.join(rootDir, job.source);
    const outputDir = path.join(rootDir, job.outputDir);
    await ensureDir(outputDir);

    for (const entry of job.entries) {
      const outputPath = path.join(outputDir, `${entry.id}.webp`);
      await sharp(sourcePath)
        .extract({
          left: entry.left,
          top: entry.top,
          width: entry.width,
          height: entry.height,
        })
        .webp({ quality: 100 })
        .toFile(outputPath);
      console.log(`${job.outputDir}/${entry.id}.webp`);
    }
  }

  const atlasSourcePath = path.join(rootDir, abilityCardsAtlasJob.source);
  const atlasOutputDir = path.join(rootDir, abilityCardsAtlasJob.outputDir);
  const atlasConfig = await readJson(abilityCardsAtlasJob.atlasConfigPath);
  const atlasMetadata = await sharp(atlasSourcePath).metadata();
  await ensureDir(atlasOutputDir);

  for (let index = 0; index <= abilityCardsAtlasJob.maxIndex; index += 1) {
    const id = `slot-${String(index).padStart(2, '0')}`;
    const outputPath = path.join(atlasOutputDir, `${id}.webp`);
    const rect = getScaledAtlasRect(atlasConfig, atlasMetadata, index);
    await extractFromRect(atlasSourcePath, outputPath, rect);
    console.log(`${abilityCardsAtlasJob.outputDir}/${id}.webp`);
  }

  for (const entry of abilityCardsAtlasJob.splitEntries) {
    const outputPath = path.join(atlasOutputDir, `${entry.id}.webp`);
    await extractFromRect(atlasSourcePath, outputPath, entry);
    console.log(`${abilityCardsAtlasJob.outputDir}/${entry.id}.webp`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
