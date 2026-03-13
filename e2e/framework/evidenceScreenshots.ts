import { readdir, rm, unlink } from 'node:fs/promises';
import { join, parse } from 'node:path';
import type { TestInfo } from '@playwright/test';

export interface EvidenceScreenshotOptions {
    subdir?: string;
    filename?: string;
}

export function sanitizeEvidencePathSegment(value: string): string {
    return Array.from(value, (char) => (char.charCodeAt(0) < 32 ? '-' : char))
        .join('')
        .replace(/[<>:"/\\|?*]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 120);
}

function sanitizeEvidenceFileName(filename: string): string {
    const parsed = parse(filename);
    const baseName = sanitizeEvidencePathSegment(parsed.name || 'screenshot') || 'screenshot';
    const ext = parsed.ext && /^\.[a-z0-9]+$/i.test(parsed.ext) ? parsed.ext.toLowerCase() : '.png';
    return `${baseName}${ext}`;
}

function sanitizeEvidenceSubdir(value: string): string {
    return value
        .split(/[\\/]+/)
        .map((segment) => sanitizeEvidencePathSegment(segment))
        .filter(Boolean)
        .join('/');
}

export function getEvidenceScreenshotFileSubdir(testInfo: TestInfo): string {
    return sanitizeEvidencePathSegment(parse(testInfo.file).name || 'unknown-test') || 'unknown-test';
}

export function getEvidenceScreenshotCaseSubdir(testInfo: TestInfo): string {
    const fileSubdir = getEvidenceScreenshotFileSubdir(testInfo);
    const caseSubdir = sanitizeEvidencePathSegment(testInfo.title || 'unnamed-test') || 'unnamed-test';
    return `${fileSubdir}/${caseSubdir}`;
}

export function getEvidenceScreenshotDir(testInfo: TestInfo, subdir?: string): string {
    const fallbackDir = getEvidenceScreenshotFileSubdir(testInfo);
    const evidenceSubdir = subdir
        ? sanitizeEvidenceSubdir(subdir) || fallbackDir
        : getEvidenceScreenshotCaseSubdir(testInfo);

    // 证据截图统一锚定到仓库工作目录，避免混用 rootDir / cwd 导致输出目录漂移。
    return join(process.cwd(), 'test-results', 'evidence-screenshots', evidenceSubdir);
}

export function getEvidenceScreenshotPath(
    testInfo: TestInfo,
    name: string,
    options: EvidenceScreenshotOptions = {},
): string {
    const dir = getEvidenceScreenshotDir(testInfo, options.subdir);
    const filename =
        options.filename ??
        `${sanitizeEvidencePathSegment(testInfo.title || 'unnamed')}-${sanitizeEvidencePathSegment(name)}.png`;
    return join(dir, sanitizeEvidenceFileName(filename));
}

export async function clearEvidenceScreenshotsForTest(testInfo: TestInfo): Promise<void> {
    const caseDir = getEvidenceScreenshotDir(testInfo);
    await rm(caseDir, { recursive: true, force: true });

    // 兼容旧的平铺目录，首次截图前清掉当前用例的历史遗留文件。
    const legacyDir = join(
        process.cwd(),
        'test-results',
        'evidence-screenshots',
        getEvidenceScreenshotFileSubdir(testInfo),
    );
    const legacyPrefix = `${sanitizeEvidencePathSegment(testInfo.title || 'unnamed')}-`;

    try {
        const entries = await readdir(legacyDir, { withFileTypes: true });
        await Promise.all(
            entries
                .filter((entry) => entry.isFile() && entry.name.startsWith(legacyPrefix))
                .map((entry) => unlink(join(legacyDir, entry.name))),
        );
    } catch (error) {
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        if (code !== 'ENOENT') {
            throw error;
        }
    }
}
