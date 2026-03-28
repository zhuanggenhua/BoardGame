import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const rootDir = process.cwd();

const jobs = [
  {
    source: 'public/assets/i18n/zh-CN/dicethrone/images/samurai/compressed/player-board.webp',
    outputDir: 'public/assets/i18n/zh-CN/dicethrone/images/samurai/crops/player-board',
    entries: [
      { id: 'slot-01', left: 0, top: 170, width: 330, height: 485 },
      { id: 'slot-02', left: 330, top: 170, width: 340, height: 485 },
      { id: 'slot-03', left: 0, top: 640, width: 330, height: 490 },
      { id: 'slot-04', left: 330, top: 640, width: 340, height: 490 },
      { id: 'slot-05', left: 1380, top: 170, width: 340, height: 485 },
      { id: 'slot-06', left: 1715, top: 170, width: 333, height: 485 },
      { id: 'slot-07', left: 1380, top: 640, width: 340, height: 490 },
      { id: 'slot-08', left: 1715, top: 640, width: 333, height: 490 },
      { id: 'ultimate', left: 650, top: 885, width: 750, height: 340 },
    ],
  },
  {
    source: 'public/assets/i18n/zh-CN/dicethrone/images/samurai/compressed/tip.webp',
    outputDir: 'public/assets/i18n/zh-CN/dicethrone/images/samurai/crops/tip',
    entries: [
      { id: 'shame', left: 0, top: 0, width: 700, height: 470 },
      { id: 'honor', left: 0, top: 450, width: 700, height: 510 },
      { id: 'retribution', left: 0, top: 930, width: 700, height: 480 },
      { id: 'dice-legend', left: 700, top: 1280, width: 403, height: 760 },
    ],
  },
];

const abilityCardsAtlasJob = {
  source: 'public/assets/i18n/zh-CN/dicethrone/images/samurai/compressed/ability-cards.webp',
  outputDir: 'public/assets/i18n/zh-CN/dicethrone/images/samurai/crops/ability-cards',
  atlasConfigPath: 'public/assets/atlas-configs/dicethrone/ability-cards-common.atlas.json',
  maxIndex: 39,
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
      await extractFromRect(sourcePath, outputPath, entry);
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
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
