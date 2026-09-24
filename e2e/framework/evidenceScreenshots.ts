import { mkdir, readdir, rename, rm, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, parse } from 'node:path';
import type { TestInfo } from '@playwright/test';

const EVIDENCE_GAME_IDS = new Set(['betrayal', 'smashup', 'dicethrone', 'summonerwars', 'tictactoe', 'cardia', 'the-gang', 'mage-wars', '_shared']);
export const EVIDENCE_SCREENSHOT_EXTENSION = '.jpg';
export const EVIDENCE_SCREENSHOT_TYPE = 'jpeg';
export const EVIDENCE_SCREENSHOT_QUALITY = 90;
export type EvidenceScreenshotFormat = 'jpeg' | 'png';

export interface EvidenceScreenshotOptions {
    subdir?: string;
    filename?: string;
    /** 需要保留截图细节时显式使用 png；未显式传入时尊重 filename 扩展名。 */
    format?: EvidenceScreenshotFormat;
    /** 新增或本轮重跑的主证据截图应开启，运行时硬卡英文/抽象命名。 */
    requireChineseName?: boolean;
}

export interface EvidenceScreenshotRun {
    runId: string;
    stableDir: string;
    stagingDir: string;
    historyDir: string;
}

const CJK_CHARACTER_REGEX = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;

function assertChineseEvidenceSegment(value: string, label: string): void {
    if (CJK_CHARACTER_REGEX.test(value)) return;
    throw new Error(
        `证据截图${label}必须使用中文业务命名：${value}。` +
        '请用中文直说游戏、流程、交互阶段或结果，不要只用英文/编号/抽象名。',
    );
}

function shouldRequireChineseEvidenceName(options?: Pick<EvidenceScreenshotOptions, 'requireChineseName'>): boolean {
    return options?.requireChineseName === true
        || process.env.EVIDENCE_SCREENSHOT_REQUIRE_CHINESE_NAMES === '1';
}

function getEvidenceScreenshotGameId(testInfo: TestInfo): string {
    const normalizedPath = testInfo.file.replace(/\\/g, '/');
    const segments = normalizedPath.split('/');
    const e2eIndex = segments.lastIndexOf('e2e');
    if (e2eIndex >= 0) {
        const candidate = segments[e2eIndex + 1];
        if (candidate && EVIDENCE_GAME_IDS.has(candidate)) {
            return candidate;
        }
    }
    return '_shared';
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

function resolveEvidenceScreenshotFormat(
    filename: string,
    requestedFormat?: EvidenceScreenshotFormat,
): EvidenceScreenshotFormat {
    const extension = parse(filename).ext.toLowerCase();
    const filenameFormat = extension === '.png'
        ? 'png'
        : extension === '.jpg' || extension === '.jpeg'
            ? 'jpeg'
            : undefined;

    if (requestedFormat && filenameFormat && requestedFormat !== filenameFormat) {
        throw new Error(
            `证据截图文件名扩展名与 format 不一致：${filename} / ${requestedFormat}。` +
            '请让文件扩展名和实际编码格式保持一致。',
        );
    }

    return requestedFormat ?? filenameFormat ?? 'jpeg';
}

function sanitizeEvidenceFileName(filename: string, requestedFormat?: EvidenceScreenshotFormat): string {
    const parsed = parse(filename);
    const baseName = sanitizeEvidencePathSegment(parsed.name || 'screenshot') || 'screenshot';
    const format = resolveEvidenceScreenshotFormat(filename, requestedFormat);
    return `${baseName}${format === 'png' ? '.png' : EVIDENCE_SCREENSHOT_EXTENSION}`;
}

function sanitizeEvidenceSubdir(value: string): string {
    return value
        .split(/[\\/]+/)
        .map((segment) => sanitizeEvidencePathSegment(segment))
        .filter(Boolean)
        .join('/');
}

export function getEvidenceScreenshotFileSubdir(testInfo: TestInfo): string {
    const fileSubdir = sanitizeEvidencePathSegment(parse(testInfo.file).name || 'unknown-test') || 'unknown-test';
    const gameId = getEvidenceScreenshotGameId(testInfo);
    return `${gameId}/${fileSubdir}`;
}

export function getEvidenceScreenshotCaseSubdir(
    testInfo: TestInfo,
    options: Pick<EvidenceScreenshotOptions, 'requireChineseName'> = {},
): string {
    const fileSubdir = getEvidenceScreenshotFileSubdir(testInfo);
    const caseSubdir = sanitizeEvidencePathSegment(testInfo.title || 'unnamed-test') || 'unnamed-test';
    if (shouldRequireChineseEvidenceName(options)) {
        assertChineseEvidenceSegment(caseSubdir, '用例目录名');
    }
    return `${fileSubdir}/${caseSubdir}`;
}

export function getEvidenceScreenshotDir(
    testInfo: TestInfo,
    subdir?: string,
    options: Pick<EvidenceScreenshotOptions, 'requireChineseName'> = {},
): string {
    const fallbackDir = getEvidenceScreenshotFileSubdir(testInfo);
    const evidenceSubdir = subdir
        ? sanitizeEvidenceSubdir(subdir) || fallbackDir
        : getEvidenceScreenshotCaseSubdir(testInfo, options);
    if (subdir && shouldRequireChineseEvidenceName(options)) {
        assertChineseEvidenceSegment(evidenceSubdir, '自定义目录名');
    }

    // 证据截图统一锚定到仓库工作目录，避免混用 rootDir / cwd 导致输出目录漂移。
    return join(process.cwd(), 'test-results', 'evidence-screenshots', evidenceSubdir);
}

export function getEvidenceScreenshotPath(
    testInfo: TestInfo,
    name: string,
    options: EvidenceScreenshotOptions = {},
): string {
    return getEvidenceScreenshotPathInDirectory(
        getEvidenceScreenshotDir(testInfo, options.subdir, options),
        name,
        options,
    );
}

export function getEvidenceScreenshotPathInDirectory(
    directory: string,
    name: string,
    options: Pick<EvidenceScreenshotOptions, 'filename' | 'format' | 'requireChineseName'> = {},
): string {
    const filename =
        options.filename ??
        `${sanitizeEvidencePathSegment(name) || 'screenshot'}${options.format === 'png' ? '.png' : EVIDENCE_SCREENSHOT_EXTENSION}`;
    if (shouldRequireChineseEvidenceName(options)) {
        assertChineseEvidenceSegment(filename, '文件名');
    }
    return join(directory, sanitizeEvidenceFileName(filename, options.format));
}

export async function createEvidenceScreenshotRun(
    testInfo: TestInfo,
    options: Pick<EvidenceScreenshotOptions, 'requireChineseName'> = {},
): Promise<EvidenceScreenshotRun> {
    const stableDir = getEvidenceScreenshotDir(testInfo, undefined, options);
    const caseSubdir = sanitizeEvidencePathSegment(testInfo.title || 'unnamed-test') || 'unnamed-test';
    const runId = `${Date.now()}-${process.pid}-${randomUUID()}`;
    const stagingDir = join(
        process.cwd(),
        'test-results',
        'evidence-screenshots',
        '_temporary',
        getEvidenceScreenshotFileSubdir(testInfo),
        caseSubdir,
        runId,
    );
    const historyDir = join(
        process.cwd(),
        'test-results',
        'evidence-screenshots',
        '_history',
        getEvidenceScreenshotCaseSubdir(testInfo),
        runId,
    );

    await mkdir(stagingDir, { recursive: true });
    return { runId, stableDir, stagingDir, historyDir };
}

export async function promoteEvidenceScreenshotRun(run: EvidenceScreenshotRun): Promise<string> {
    let movedPrevious = false;
    try {
        await mkdir(dirname(run.historyDir), { recursive: true });
        await rename(run.stableDir, run.historyDir);
        movedPrevious = true;
    } catch (error) {
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        if (code !== 'ENOENT') throw error;
    }

    try {
        await mkdir(dirname(run.stableDir), { recursive: true });
        await rename(run.stagingDir, run.stableDir);
    } catch (error) {
        if (movedPrevious) {
            await rename(run.historyDir, run.stableDir).catch(() => undefined);
        }
        throw error;
    }

    return run.stableDir;
}

export function toJpegEvidenceScreenshotPath(path: string): string {
    return path.replace(/\.(?:png|jpe?g)$/i, EVIDENCE_SCREENSHOT_EXTENSION);
}

export function withJpegEvidenceScreenshotOptions<T extends Record<string, unknown>>(
    options: T,
): T & { type: typeof EVIDENCE_SCREENSHOT_TYPE; quality: typeof EVIDENCE_SCREENSHOT_QUALITY } {
    const next = { ...options } as T & {
        path?: unknown;
        type: typeof EVIDENCE_SCREENSHOT_TYPE;
        quality: typeof EVIDENCE_SCREENSHOT_QUALITY;
    };
    if (typeof next.path === 'string') {
        next.path = toJpegEvidenceScreenshotPath(next.path);
    }
    next.type = EVIDENCE_SCREENSHOT_TYPE;
    next.quality = EVIDENCE_SCREENSHOT_QUALITY;
    return next;
}

export async function clearEvidenceScreenshotsForTest(testInfo: TestInfo): Promise<void> {
    const caseDir = getEvidenceScreenshotDir(testInfo);
    const historyCaseDir = join(
        process.cwd(),
        'test-results',
        'evidence-screenshots',
        '_history',
        getEvidenceScreenshotCaseSubdir(testInfo),
        `${Date.now()}-${process.pid}-${randomUUID()}`,
    );
    try {
        await mkdir(dirname(historyCaseDir), { recursive: true });
        await rename(caseDir, historyCaseDir);
    } catch (error) {
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        if (code !== 'ENOENT') throw error;
    }

    // 兼容旧目录：首次截图前清掉当前用例在 legacy 路径下的历史遗留（含“平铺文件”和“用例子目录”两种结构）。
    const legacyFileSubdir =
        sanitizeEvidencePathSegment(parse(testInfo.file).name || 'unknown-test') || 'unknown-test';
    const legacyDir = join(
        process.cwd(),
        'test-results',
        'evidence-screenshots',
        legacyFileSubdir,
    );
    const legacyCaseSubdir = sanitizeEvidencePathSegment(testInfo.title || 'unnamed-test') || 'unnamed-test';
    const legacyCaseDir = join(legacyDir, legacyCaseSubdir);
    const legacyPrefix = `${sanitizeEvidencePathSegment(testInfo.title || 'unnamed')}-`;

    await rm(legacyCaseDir, { recursive: true, force: true });

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
