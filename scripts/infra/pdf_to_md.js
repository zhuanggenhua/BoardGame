import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';

const HELP_FLAGS = new Set(['-h', '--help']);
const OUTPUT_FLAGS = new Set(['-o', '--output']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_RULES_DIR = path.resolve(__dirname, '../..', 'public', 'assets', 'rules');

const usage = `用法:
  node scripts/infra/pdf_to_md.js <输入PDF> [-o <输出md>]

示例:
  node scripts/infra/pdf_to_md.js "d:/path/rules.pdf"
  node scripts/infra/pdf_to_md.js "d:/path/rules.pdf" -o "d:/path/rules.md"

说明:
  未指定输出时，默认输出到 public/assets/rules/ 下，同名 .md。
`;

const args = process.argv.slice(2);

if (args.length === 0 || args.some((arg) => HELP_FLAGS.has(arg))) {
  console.log(usage);
  process.exit(0);
}

const inputPath = args[0];

if (!inputPath || OUTPUT_FLAGS.has(inputPath)) {
  console.error('请输入有效的 PDF 路径。');
  console.log(usage);
  process.exit(1);
}

let outputPath = '';
const outputIndex = args.findIndex((arg) => OUTPUT_FLAGS.has(arg));
if (outputIndex !== -1) {
  outputPath = args[outputIndex + 1] ?? '';
}

const outputInline = args.find((arg) => arg.startsWith('--output='));
if (outputInline) {
  outputPath = outputInline.replace('--output=', '');
}

const absoluteInputPath = path.resolve(inputPath);
const resolvedOutputPath = outputPath
  ? path.resolve(outputPath)
  : path.join(DEFAULT_RULES_DIR, `${path.parse(absoluteInputPath).name}.md`);

const isBulletLine = (line) =>
  /^([*\-•●■]|\d+[\.)、]|[（(]?\d+[)）])\s*/.test(line);

const isPageNumber = (line) => /^(第\s*)?\d+\s*(页|Page)?$/i.test(line);

const shouldJoinLine = (prevLine, currentLine) => {
  if (!prevLine) return false;
  if (isBulletLine(prevLine) || isBulletLine(currentLine)) return false;
  const endPunctuation = /[。！？.!?；;：:]$/;
  if (endPunctuation.test(prevLine)) return false;
  return true;
};

const normalizeTextToMarkdown = (text) => {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ');

  const lines = normalized
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '');

  const result = [];
  for (const line of lines) {
    if (isPageNumber(line)) continue;

    const prevLine = result[result.length - 1] ?? '';

    if (shouldJoinLine(prevLine, line)) {
      const trimmedPrev = prevLine.endsWith('-')
        ? prevLine.slice(0, Math.max(0, prevLine.length - 1))
        : prevLine;
      result[result.length - 1] = `${trimmedPrev} ${line}`.trim();
      continue;
    }

    result.push(line);
  }

  return result.join('\n').replace(/\n{3,}/g, '\n\n');
};

const run = async () => {
  try {
    await fs.access(absoluteInputPath);
  } catch (error) {
    console.error(`找不到 PDF 文件: ${absoluteInputPath}`);
    process.exit(1);
  }

  try {
    const buffer = await fs.readFile(absoluteInputPath);
    const { text } = await pdfParse(buffer);

    const markdown = normalizeTextToMarkdown(text);

    await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
    await fs.writeFile(resolvedOutputPath, `${markdown}\n`, 'utf8');

    console.log(`转换完成: ${resolvedOutputPath}`);
  } catch (error) {
    console.error('转换失败，请确认 PDF 内容可被读取。');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
};

run();
