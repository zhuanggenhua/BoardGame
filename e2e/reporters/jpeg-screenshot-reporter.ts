import { mkdir, readdir, rename, stat, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import sharp from 'sharp';
import { EVIDENCE_SCREENSHOT_EXTENSION, EVIDENCE_SCREENSHOT_QUALITY } from '../framework/evidenceScreenshots.ts';

const JPEG_QUALITY = Number.parseInt(process.env.PW_EVIDENCE_JPEG_QUALITY || String(EVIDENCE_SCREENSHOT_QUALITY), 10);
const RUN_STARTED_AT_MS = Date.now() - 5000;
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

async function convertPngTree(rootDir: string, onlyCurrentRun: boolean): Promise<void> {
    let entries;
    try {
        entries = await readdir(rootDir, { withFileTypes: true });
    } catch (error) {
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        if (code === 'ENOENT') {
            return;
        }
        throw error;
    }

    for (const entry of entries) {
        const absolutePath = join(rootDir, entry.name);
        if (entry.isDirectory()) {
            await convertPngTree(absolutePath, onlyCurrentRun);
            continue;
        }
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith(PNG_EXTENSION)) {
            continue;
        }

        if (onlyCurrentRun) {
            const info = await stat(absolutePath);
            if (info.mtimeMs < RUN_STARTED_AT_MS) {
                continue;
            }
        }

        await convertPngToJpeg(absolutePath);
    }
}

export async function convertCurrentRunScreenshotsToJpeg(): Promise<void> {
    await convertPngTree(join(process.cwd(), 'evidence'), true);
}

class JpegScreenshotReporter implements Reporter {
    async onTestEnd(_test: TestCase, result: TestResult): Promise<void> {
        if (!result.outputDir) {
            return;
        }
        await convertPngTree(result.outputDir, true);
        await Promise.all(result.attachments.map(async (attachment) => {
            if (attachment.contentType !== 'image/png' || !attachment.path?.toLowerCase().endsWith(PNG_EXTENSION)) {
                return;
            }

            const nextPath = await convertPngToJpeg(attachment.path);
            attachment.path = nextPath;
            attachment.contentType = 'image/jpeg';
        }));
    }

    async onEnd(): Promise<void> {
        await convertCurrentRunScreenshotsToJpeg();
    }
}

export default JpegScreenshotReporter;
