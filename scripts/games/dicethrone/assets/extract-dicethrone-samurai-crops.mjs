import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const rootDir = process.cwd();
const tempRoot = 'temp/dicethrone-intake/samurai';

const jobs = [
  {
    source: 'public/assets/i18n/zh-CN/dicethrone/images/samurai/compressed/player-board.webp',
    outputDir: `${tempRoot}/crops/player-board`,
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
    outputDir: `${tempRoot}/crops/tip`,
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
  sourceSlotsOutputDir: `${tempRoot}/crops/ability-cards`,
  atlasConfigPath: 'public/assets/atlas-configs/dicethrone/ability-cards-common.atlas.json',
  maxIndex: 39,
  sourceAliasesOutputDir: `${tempRoot}/ability-cards/source-aliases`,
  namedSourceEntries: [
    { id: 'upgrade-katana-slice-2', sourceIndex: 18 },
    { id: 'upgrade-katana-slice-3', sourceIndex: 19 },
    { id: 'upgrade-wakizashi-2', sourceIndex: 20 },
    { id: 'upgrade-wakizashi-3', sourceIndex: 21 },
    { id: 'upgrade-solemnity-2', sourceIndex: 22 },
    { id: 'upgrade-budo-2', sourceIndex: 23 },
    { id: 'upgrade-masamune-2', sourceIndex: 24 },
    { id: 'upgrade-slot-06-2', sourceIndex: 25 },
    { id: 'upgrade-stand-tall-2', sourceIndex: 26 },
    { id: 'card-samurai-honor', sourceIndex: 27 },
    { id: 'card-you-should-be-ashamed', sourceIndex: 28 },
    { id: 'card-no-retreat', sourceIndex: 29 },
    { id: 'card-righteousness', sourceIndex: 30 },
    { id: 'card-zanshin', sourceIndex: 31 },
  ],
};

const handPreviewJob = {
  outputDir: `${tempRoot}/hand-preview`,
  targetWidth: 598,
  targetHeight: 965,
  entries: [
    'upgrade-katana-slice-2.webp',
    'upgrade-katana-slice-3.webp',
    'upgrade-wakizashi-2.webp',
    'upgrade-wakizashi-3.webp',
    'upgrade-solemnity-2.webp',
    'upgrade-budo-2.webp',
    'upgrade-masamune-2.webp',
    'upgrade-slot-06-2.webp',
    'upgrade-stand-tall-2.webp',
    'card-samurai-honor.webp',
    'card-you-should-be-ashamed.webp',
    'card-no-retreat.webp',
    'card-righteousness.webp',
    'card-zanshin.webp',
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

async function writeNormalizedPreview(sourcePath, outputDir, fileName, targetWidth, targetHeight) {
  await ensureDir(outputDir);
  await ensureDir(path.join(outputDir, 'compressed'));

  const buildPipeline = () => sharp(sourcePath)
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 100 });

  await buildPipeline().toFile(path.join(outputDir, fileName));
  await buildPipeline().toFile(path.join(outputDir, 'compressed', fileName));
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
  const atlasOutputDir = path.join(rootDir, abilityCardsAtlasJob.sourceSlotsOutputDir);
  const sourceAliasesOutputDir = path.join(rootDir, abilityCardsAtlasJob.sourceAliasesOutputDir);
  const atlasConfig = await readJson(abilityCardsAtlasJob.atlasConfigPath);
  const atlasMetadata = await sharp(atlasSourcePath).metadata();
  await ensureDir(atlasOutputDir);
  await ensureDir(sourceAliasesOutputDir);

  for (let index = 0; index <= abilityCardsAtlasJob.maxIndex; index += 1) {
    const id = `slot-${String(index).padStart(2, '0')}`;
    const outputPath = path.join(atlasOutputDir, `${id}.webp`);
    const rect = getScaledAtlasRect(atlasConfig, atlasMetadata, index);
    await extractFromRect(atlasSourcePath, outputPath, rect);
    console.log(`${abilityCardsAtlasJob.sourceSlotsOutputDir}/${id}.webp`);
  }

  for (const entry of abilityCardsAtlasJob.namedSourceEntries) {
    const outputPath = path.join(sourceAliasesOutputDir, `${entry.id}.webp`);
    const rect = getScaledAtlasRect(atlasConfig, atlasMetadata, entry.sourceIndex);
    await extractFromRect(atlasSourcePath, outputPath, rect);
    console.log(`${abilityCardsAtlasJob.sourceAliasesOutputDir}/${entry.id}.webp`);
  }

  const handPreviewOutputDir = path.join(rootDir, handPreviewJob.outputDir);
  for (const fileName of handPreviewJob.entries) {
    await writeNormalizedPreview(
      path.join(sourceAliasesOutputDir, fileName),
      handPreviewOutputDir,
      fileName,
      handPreviewJob.targetWidth,
      handPreviewJob.targetHeight,
    );
    console.log(`${handPreviewJob.outputDir}/${fileName}`);
    console.log(`${handPreviewJob.outputDir}/compressed/${fileName}`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
