import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const rootDir = process.cwd();
const tempRoot = path.resolve(rootDir, 'temp');
const defaultAtlasConfig = 'public/assets/atlas-configs/dicethrone/ability-cards-common.atlas.json';

function printHelp() {
  console.log(`用法:
  npm run dicethrone:intake:crops -- --hero <heroId> --source ability-cards [--max-index 39]
  npm run dicethrone:intake:crops -- --hero <heroId> --source player-board --rects <json路径>
  npm run dicethrone:intake:crops -- --hero <heroId> --source tip --rects <json路径>

说明:
  - 本工具只服务 Dice Throne 录入核对
  - 所有输出都必须且只会写入 temp/
  - 产物不是正式运行时资源，不能放进 public/assets/

参数:
  --hero <id>            角色 ID，例如 artificer
  --source <type>        ability-cards | player-board | tip
  --input <path>         源图路径，默认 public/assets/i18n/zh-CN/dicethrone/images/<hero>/compressed/<source>.webp
  --rects <path>         player-board / tip 使用的裁图 JSON
  --atlas-config <path>  ability-cards 使用的 atlas 配置，默认 ability-cards-common.atlas.json
  --start-index <n>      ability-cards 起始索引，默认 0
  --max-index <n>        ability-cards 结束索引，默认取 atlas 最大索引
  --output-dir <path>    自定义输出目录；必须位于 temp/ 下
  --quality <n>          WebP 质量，默认 100
  --help                 显示帮助
`);
}

function parseArgs(argv) {
  const parsed = {
    hero: '',
    source: '',
    input: '',
    rects: '',
    atlasConfig: defaultAtlasConfig,
    startIndex: 0,
    maxIndex: null,
    outputDir: '',
    quality: 100,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--help' || current === '-h') {
      parsed.help = true;
      continue;
    }
    if (current === '--hero') {
      parsed.hero = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (current === '--source') {
      parsed.source = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (current === '--input') {
      parsed.input = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (current === '--rects') {
      parsed.rects = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (current === '--atlas-config') {
      parsed.atlasConfig = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (current === '--start-index') {
      parsed.startIndex = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }
    if (current === '--max-index') {
      parsed.maxIndex = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }
    if (current === '--output-dir') {
      parsed.outputDir = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (current === '--quality') {
      parsed.quality = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }
    throw new Error(`未知参数: ${current}`);
  }

  return parsed;
}

function applyNpmConfigFallback(parsed) {
  const env = process.env;
  if (!parsed.hero && env.npm_config_hero) {
    parsed.hero = env.npm_config_hero;
  }
  if (!parsed.source && env.npm_config_source) {
    parsed.source = env.npm_config_source;
  }
  if (!parsed.input && env.npm_config_input) {
    parsed.input = env.npm_config_input;
  }
  if (!parsed.rects && env.npm_config_rects) {
    parsed.rects = env.npm_config_rects;
  }
  if (
    parsed.atlasConfig === defaultAtlasConfig
    && env.npm_config_atlas_config
  ) {
    parsed.atlasConfig = env.npm_config_atlas_config;
  }
  if (
    parsed.startIndex === 0
    && typeof env.npm_config_start_index === 'string'
    && env.npm_config_start_index !== ''
  ) {
    parsed.startIndex = Number.parseInt(env.npm_config_start_index, 10);
  }
  if (
    parsed.maxIndex === null
    && typeof env.npm_config_max_index === 'string'
    && env.npm_config_max_index !== ''
  ) {
    parsed.maxIndex = Number.parseInt(env.npm_config_max_index, 10);
  }
  if (!parsed.outputDir && env.npm_config_output_dir) {
    parsed.outputDir = env.npm_config_output_dir;
  }
  if (
    parsed.quality === 100
    && typeof env.npm_config_quality === 'string'
    && env.npm_config_quality !== ''
  ) {
    parsed.quality = Number.parseInt(env.npm_config_quality, 10);
  }
  return parsed;
}

function assertWithinTemp(relativeOrAbsolutePath) {
  const resolved = path.resolve(rootDir, relativeOrAbsolutePath);
  if (resolved !== tempRoot && !resolved.startsWith(`${tempRoot}${path.sep}`)) {
    throw new Error(`输出目录必须位于 temp/ 下，当前为: ${resolved}`);
  }
  return resolved;
}

function resolveDefaultInput(hero, source) {
  const fileName = `${source}.webp`;
  return path.join(
    'public/assets/i18n/zh-CN/dicethrone/images',
    hero,
    'compressed',
    fileName,
  );
}

function resolveDefaultOutputDir(hero, source) {
  if (source === 'ability-cards') {
    return path.join('temp/dicethrone-intake', hero, 'ability-card-slots');
  }
  if (source === 'player-board') {
    return path.join('temp/dicethrone-intake', hero, 'player-board-slots');
  }
  if (source === 'tip') {
    return path.join('temp/dicethrone-intake', hero, 'tip-slots');
  }
  throw new Error(`不支持的 source: ${source}`);
}

async function ensureDir(targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
}

async function readJson(relativePath) {
  const absolutePath = path.resolve(rootDir, relativePath);
  const content = await fs.readFile(absolutePath, 'utf8');
  return JSON.parse(content);
}

async function extractRect(sourcePath, outputPath, rect, quality) {
  await sharp(sourcePath)
    .extract({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    })
    .webp({ quality })
    .toFile(outputPath);
}

function validateRect(rect, label) {
  for (const key of ['left', 'top', 'width', 'height']) {
    if (!Number.isInteger(rect[key]) || rect[key] < 0) {
      throw new Error(`${label} 的 ${key} 非法: ${rect[key]}`);
    }
  }
  if (rect.width <= 0 || rect.height <= 0) {
    throw new Error(`${label} 的 width/height 必须大于 0`);
  }
}

function normalizeRectEntries(raw) {
  const entries = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.entries)
      ? raw.entries
      : Array.isArray(raw.slots)
        ? raw.slots
        : null;
  if (!entries) {
    throw new Error('rects JSON 必须是数组，或包含 entries/slots 数组');
  }
  return entries.map((entry, index) => {
    const id = String(entry.id ?? `slot-${String(index).padStart(2, '0')}`);
    const normalized = {
      id,
      left: Number(entry.left),
      top: Number(entry.top),
      width: Number(entry.width),
      height: Number(entry.height),
    };
    validateRect(normalized, id);
    return normalized;
  });
}

function getAtlasRect(atlasConfig, metadata, index) {
  const scaleX = metadata.width / atlasConfig.imageW;
  const scaleY = metadata.height / atlasConfig.imageH;
  if (Array.isArray(atlasConfig.frames)) {
    const frame = atlasConfig.frames[index];
    if (!frame) {
      throw new Error(`atlas 缺少 frame index=${index}`);
    }
    return {
      left: Math.round(frame.x * scaleX),
      top: Math.round(frame.y * scaleY),
      width: Math.round(frame.width * scaleX),
      height: Math.round(frame.height * scaleY),
    };
  }
  const row = Math.floor(index / atlasConfig.cols);
  const col = index % atlasConfig.cols;
  if (!atlasConfig.rowStarts?.[row] && atlasConfig.rowStarts?.[row] !== 0) {
    throw new Error(`atlas row 越界: index=${index}, row=${row}`);
  }
  if (!atlasConfig.colStarts?.[col] && atlasConfig.colStarts?.[col] !== 0) {
    throw new Error(`atlas col 越界: index=${index}, col=${col}`);
  }
  return {
    left: Math.round(atlasConfig.colStarts[col] * scaleX),
    top: Math.round(atlasConfig.rowStarts[row] * scaleY),
    width: Math.round(atlasConfig.colWidths[col] * scaleX),
    height: Math.round(atlasConfig.rowHeights[row] * scaleY),
  };
}

function getAtlasMaxIndex(atlasConfig) {
  if (Array.isArray(atlasConfig.frames)) {
    return atlasConfig.frames.length - 1;
  }
  if (Number.isInteger(atlasConfig.rows) && Number.isInteger(atlasConfig.cols)) {
    return atlasConfig.rows * atlasConfig.cols - 1;
  }
  throw new Error('atlas 配置缺少 frames 或 rows/cols');
}

async function runRectMode(parsed, sourcePath, outputDir) {
  if (!parsed.rects) {
    throw new Error(`${parsed.source} 必须提供 --rects`);
  }
  const rectEntries = normalizeRectEntries(await readJson(parsed.rects));
  await ensureDir(outputDir);
  for (const entry of rectEntries) {
    const outputPath = path.join(outputDir, `${entry.id}.webp`);
    await extractRect(sourcePath, outputPath, entry, parsed.quality);
    console.log(`WROTE_CROP=${outputPath}`);
  }
}

async function runAtlasMode(parsed, sourcePath, outputDir) {
  const atlasConfig = await readJson(parsed.atlasConfig);
  const metadata = await sharp(sourcePath).metadata();
  const maxIndex = parsed.maxIndex ?? getAtlasMaxIndex(atlasConfig);
  if (!Number.isInteger(parsed.startIndex) || parsed.startIndex < 0) {
    throw new Error(`start-index 非法: ${parsed.startIndex}`);
  }
  if (!Number.isInteger(maxIndex) || maxIndex < parsed.startIndex) {
    throw new Error(`max-index 非法: ${maxIndex}`);
  }
  await ensureDir(outputDir);
  for (let index = parsed.startIndex; index <= maxIndex; index += 1) {
    const rect = getAtlasRect(atlasConfig, metadata, index);
    validateRect(rect, `slot-${index}`);
    const fileName = `slot-${String(index).padStart(2, '0')}.webp`;
    const outputPath = path.join(outputDir, fileName);
    await extractRect(sourcePath, outputPath, rect, parsed.quality);
    console.log(`WROTE_CROP=${outputPath}`);
  }
}

async function main() {
  const parsed = applyNpmConfigFallback(parseArgs(process.argv.slice(2)));
  if (parsed.help) {
    printHelp();
    return;
  }
  if (!parsed.hero) {
    throw new Error('缺少 --hero');
  }
  if (!['ability-cards', 'player-board', 'tip'].includes(parsed.source)) {
    throw new Error(`不支持的 --source: ${parsed.source}`);
  }
  if (!Number.isInteger(parsed.quality) || parsed.quality < 1 || parsed.quality > 100) {
    throw new Error(`quality 非法: ${parsed.quality}`);
  }

  const sourceRelativePath = parsed.input || resolveDefaultInput(parsed.hero, parsed.source);
  const sourcePath = path.resolve(rootDir, sourceRelativePath);
  const outputDir = assertWithinTemp(parsed.outputDir || resolveDefaultOutputDir(parsed.hero, parsed.source));

  console.log(`SOURCE_IMAGE=${sourcePath}`);
  console.log(`OUTPUT_DIR=${outputDir}`);

  if (parsed.source === 'ability-cards') {
    await runAtlasMode(parsed, sourcePath, outputDir);
    return;
  }
  await runRectMode(parsed, sourcePath, outputDir);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
