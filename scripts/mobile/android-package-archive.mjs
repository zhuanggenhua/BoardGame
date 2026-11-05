import { createHash } from 'node:crypto';
import {
    createReadStream,
    createWriteStream,
    mkdirSync,
    unlinkSync,
} from 'node:fs';
import path from 'node:path';
import { Zip, ZipDeflate } from 'fflate';

export const STABLE_ANDROID_PACKAGE_ZIP_DATE = new Date('2024-01-01T00:00:00.000Z');
const SHARED_AUDIO_PREFIX = 'common/audio/';
const COMPRESSED_DIR_NAME = 'compressed';
const SOURCE_ASSET_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.mp3', '.wav', '.psd', '.ai', '.aseprite', '.kra', '.xcf', '.tmp', '.bak',
]);
const TEMPORARY_ASSET_NAME_PATTERN = /(^|[/._ -])(?:temp|tmp|bak|backup|old|copy|副本|临时|测试|test)([/._ -]|$)/i;

export const shouldIncludeSharedAudioPackagePath = (relativePath) => {
    const normalized = String(relativePath || '').replace(/\\/g, '/');
    const parts = normalized.split('/');
    return normalized.startsWith(SHARED_AUDIO_PREFIX)
        && path.extname(normalized).toLowerCase() === '.ogg'
        && parts.includes(COMPRESSED_DIR_NAME)
        && !SOURCE_ASSET_EXTENSIONS.has(path.extname(normalized).toLowerCase())
        && !TEMPORARY_ASSET_NAME_PATTERN.test(normalized)
        && !normalized.endsWith('/registry.json')
        && !normalized.endsWith('/phrase-mappings.zh-CN.json');
};

export const assertSharedAudioPackageEntriesArePublishable = (includedFiles) => {
    const blockedFiles = includedFiles
        .map((entry) => entry.relativePath)
        .filter((relativePath) => !shouldIncludeSharedAudioPackagePath(relativePath));
    if (blockedFiles.length > 0) {
        throw new Error([
            'Android 共享音频包候选资源包含非压缩 OGG 或构建/开发配置，已中断发布。',
            ...blockedFiles.slice(0, 20).map((relativePath) => `- ${relativePath}`),
            blockedFiles.length > 20 ? `... 还有 ${blockedFiles.length - 20} 个` : '',
        ].filter(Boolean).join('\n'));
    }
};

/**
 * Build an Android-compatible ZIP without buffering the whole package in memory.
 * DEFLATE level 0 avoids Android ZipInputStream's rejection of STORED entries
 * that use data descriptors while keeping already-compressed media unchanged.
 */
export const createAndroidCompatibleZipFile = async (includedFiles, zipFilePath) => {
    mkdirSync(path.dirname(zipFilePath), { recursive: true });
    try {
        unlinkSync(zipFilePath);
    } catch {}

    return await new Promise((resolve, reject) => {
        const output = createWriteStream(zipFilePath);
        const hash = createHash('sha256');
        let zipEnded = false;
        let totalBytes = 0;
        let settled = false;
        let activeInput = null;
        let outputBackpressured = false;

        const finishWithError = (error) => {
            if (settled) return;
            settled = true;
            try {
                activeInput?.destroy(error);
            } catch {}
            try {
                output.destroy();
            } catch {}
            reject(error);
        };

        output.on('error', finishWithError);
        output.on('finish', () => {
            if (settled) return;
            settled = true;
            resolve({
                zipFilePath,
                bytes: totalBytes,
                checksum: hash.digest('hex'),
            });
        });

        const zip = new Zip((error, chunk, final) => {
            if (error) {
                finishWithError(error);
                return;
            }

            const buffer = Buffer.from(chunk);
            hash.update(buffer);
            totalBytes += buffer.length;
            const canContinue = output.write(buffer);
            if (!canContinue && activeInput && !outputBackpressured) {
                outputBackpressured = true;
                activeInput.pause();
                output.once('drain', () => {
                    outputBackpressured = false;
                    activeInput?.resume();
                });
            }
            if (final && !zipEnded) {
                zipEnded = true;
                output.end();
            }
        });

        (async () => {
            try {
                for (const entry of includedFiles) {
                    await new Promise((entryResolve, entryReject) => {
                        const zipEntry = new ZipDeflate(entry.relativePath, { level: 0 });
                        zipEntry.mtime = STABLE_ANDROID_PACKAGE_ZIP_DATE;
                        zip.add(zipEntry);

                        const input = createReadStream(entry.fullPath);
                        activeInput = input;
                        if (outputBackpressured) input.pause();
                        input.on('error', entryReject);
                        input.on('data', (chunk) => {
                            zipEntry.push(new Uint8Array(chunk), false);
                        });
                        input.on('end', () => {
                            zipEntry.push(new Uint8Array(0), true);
                            if (activeInput === input) activeInput = null;
                            entryResolve();
                        });
                    });
                }
                zip.end();
            } catch (error) {
                finishWithError(error);
            }
        })().catch(finishWithError);
    });
};
