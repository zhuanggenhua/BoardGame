import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_ROOT = path.resolve(PROJECT_ROOT, 'public', 'assets');
const SKIP_DIR = 'compressed';
const VALID_EXTS = new Set(['.wav', '.aiff', '.aif', '.flac', '.m4a']);
const OGG_BITRATE = process.env.AUDIO_OGG_BITRATE ?? '96k';
const CLEAN_OUTPUT = process.env.AUDIO_CLEAN === '1';
const FFMPEG_ENV = process.env.FFMPEG_PATH?.trim();
const OUTPUT_EXTS = new Set(['.ogg']);

const resolveFfmpegCommand = (value) => {
  if (!value) return 'ffmpeg';
  const trimmed = value.trim();
  if (!trimmed) return 'ffmpeg';
  const resolved = path.isAbsolute(trimmed) ? trimmed : path.resolve(PROJECT_ROOT, trimmed);
  const lower = resolved.toLowerCase();
  if (lower.endsWith('ffmpeg') || lower.endsWith('ffmpeg.exe') || path.extname(resolved)) {
    return resolved;
  }
  return path.join(resolved, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
};

const FFMPEG_COMMAND = resolveFfmpegCommand(FFMPEG_ENV);

const stats = {
  fileCount: 0,
  oggCount: 0,
};

const runCommand = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', (error) => reject(error));
    child.on('exit', (code) => resolve(code ?? 1));
  });

const parseArgs = (argv) => {
  let root = null;
  let clean = CLEAN_OUTPUT;
  for (const arg of argv) {
    if (arg === '--clean') {
      clean = true;
      continue;
    }
    if (arg.startsWith('--')) {
      continue;
    }
    if (!root) {
      root = path.resolve(arg);
    }
  }
  return { root: root ?? DEFAULT_ROOT, clean };
};

const removeOutputFiles = async (dir) => {
  let removed = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removed += await removeOutputFiles(fullPath);
      continue;
    }
    if (entry.isFile() && OUTPUT_EXTS.has(path.extname(entry.name).toLowerCase())) {
      await fs.rm(fullPath, { force: true });
      removed += 1;
    }
  }
  return removed;
};

const clearCompressedDirs = async (root) => {
  let removed = 0;
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name === SKIP_DIR) {
      removed += await removeOutputFiles(fullPath);
      continue;
    }
    removed += await clearCompressedDirs(fullPath);
  }
  return removed;
};

const encodeVariant = async (src, dest, args) => {
  const code = await runCommand(FFMPEG_COMMAND, ['-y', '-i', src, '-vn', ...args, dest]);
  if (code !== 0) {
    throw new Error(`ffmpeg 处理失败: ${src}`);
  }
};

const handleFile = async (filePath, root) => {
  const ext = path.extname(filePath).toLowerCase();
  if (!VALID_EXTS.has(ext)) {
    return;
  }
  const outputDir = path.join(path.dirname(filePath), SKIP_DIR);
  await fs.mkdir(outputDir, { recursive: true });

  const baseName = path.parse(filePath).name;
  const oggPath = path.join(outputDir, `${baseName}.ogg`);

  await encodeVariant(filePath, oggPath, ['-c:a', 'libopus', '-b:a', OGG_BITRATE]);
  stats.oggCount += 1;

  stats.fileCount += 1;
  const relative = path.relative(root, filePath);
  console.log(`已处理: ${relative}`);
};

const walkDir = async (root) => {
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === SKIP_DIR) {
        continue;
      }
      await walkDir(fullPath);
      continue;
    }
    if (entry.isFile()) {
      await handleFile(fullPath, root);
    }
  }
};

const main = async () => {
  const { root, clean } = parseArgs(process.argv.slice(2));
  try {
    await fs.access(root);
  } catch {
    console.error(`路径不存在: ${root}`);
    process.exit(1);
  }

  if (clean) {
    const removed = await clearCompressedDirs(root);
    if (removed > 0) {
      console.log(`已清理 ${removed} 个音频文件（${SKIP_DIR} 目录内）。`);
    }
  }

  console.log(`开始压缩音频: ${root}`);
  try {
    await walkDir(root);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      console.error('未找到 ffmpeg，请先安装并确保命令可用，或设置 FFMPEG_PATH（支持相对路径）。');
    } else {
      console.error('音频压缩失败:', error);
    }
    process.exit(1);
  }

  console.log(`完成。处理 ${stats.fileCount} 个音频，输出 ${stats.oggCount} 个 OGG。`);
};

main();
