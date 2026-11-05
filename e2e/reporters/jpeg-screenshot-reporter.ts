import { mkdir, rename, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import sharp from 'sharp';
import { EVIDENCE_SCREENSHOT_EXTENSION, EVIDENCE_SCREENSHOT_QUALITY } from '../framework/evidenceScreenshots.ts';

const JPEG_QUALITY = Number.parseInt(process.env.PW_EVIDENCE_JPEG_QUALITY || String(EVIDENCE_SCREENSHOT_QUALITY), 10);
const PNG_EXTENSION = '.png';
const JPG_EXTENSION = EVIDENCE_SCREENSHOT_EXTENSION;

async function convertPngToJpeg(filePath: string): Promise<string> {
    const targetPath = filePath.slice(0, -PNG_EXTENSION.length) + JPG_EXTENSION;
    const tempPath = `${targetPath}.tmp-${process.pid}`;

    await mkdir(dirname(targetPath), { recursive: true });
    await sharp(filePath)
        .jpeg({ quality: JPEG_QUALITY })
        .toFile(tempPath);

    await unlink(targetPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    });
    await rename(tempPath, targetPath);
    await unlink(filePath);
    return targetPath;
}

class JpegScreenshotReporter implements Reporter {
    async onTestEnd(test: TestCase, result: TestResult): Promise<void> {
        const outputDir = test.parent.project()?.outputDir;
        if (!outputDir) {
            return;
        }
        const convertedPaths = new Map<string, string>();
        for (const attachment of result.attachments) {
            if (attachment.contentType !== 'image/png' || !attachment.path?.toLowerCase().endsWith(PNG_EXTENSION)) {
                continue;
            }
            const sourcePath = resolve(attachment.path);
            const localPath = relative(resolve(outputDir), sourcePath);
            // 仅转换项目产物目录内本测试明确附加的文件，不扫描目录或修改外部原图。
            if (!localPath || isAbsolute(localPath) || localPath === '..' || localPath.startsWith(`..${sep}`)) {
                continue;
            }
            let nextPath = convertedPaths.get(sourcePath);
            if (!nextPath) {
                nextPath = await convertPngToJpeg(sourcePath);
                convertedPaths.set(sourcePath, nextPath);
            }
            attachment.path = nextPath;
            attachment.contentType = 'image/jpeg';
        }
    }
}

export default JpegScreenshotReporter;
