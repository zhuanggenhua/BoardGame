import {
    expect,
    test,
    type Browser,
    type BrowserContext,
    type BrowserContextOptions,
    type Locator,
    type Page,
    type TestInfo,
} from '@playwright/test';
import * as fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
    clearEvidenceScreenshotsForTest,
    createEvidenceScreenshotRun,
    getEvidenceScreenshotDir,
    getEvidenceScreenshotPath,
    getEvidenceScreenshotPathInDirectory,
    promoteEvidenceScreenshotRun,
    withJpegEvidenceScreenshotOptions,
} from '../framework/evidenceScreenshots';
import {
    attachPageDiagnostics,
    disableNonFlowFabForE2e,
    ensureGameServerAvailable,
    getGameServerBaseURL,
    initContext,
    joinMatchViaAPI,
    seedMatchCredentials,
    waitForTestHarness,
    waitForFrontendAssets,
    waitForMatchAvailable,
} from '../helpers/common';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import {
    ARENA_ZONE_IDS,
    MAGE_IDS,
    MAGE_WARS_MAGE_ABILITY_IDS,
    MAGE_WARS_OBJECT_ABILITY_IDS,
    STATUS_TOKEN_IDS,
    type ArenaZoneId,
    type MageId,
} from '../../src/games/mage-wars/domain/ids';
import type { MageWarsArenaObjectState, MageWarsCore, MageWarsPhase, MageWarsPlayerState } from '../../src/games/mage-wars/domain';
import { MAGE_WARS_EVENTS } from '../../src/games/mage-wars/domain/events';
import { MAGE_WARS_FX_TIMING } from '../../src/games/mage-wars/ui/fxTuning';
import {
    getStandardStartingSpellbook,
    getStandardStartingSpellbookCount,
} from '../../src/games/mage-wars/domain/data/standardStartingSpellbooks';

type MageWarsOnlineMatch = {
    hostContext: BrowserContext;
    guestContext: BrowserContext;
    hostPage: Page;
    guestPage: Page;
    matchId: string;
    hostCredentials: string;
    guestCredentials: string;
};

type PageDiagnostics = ReturnType<typeof attachPageDiagnostics>;
type JsonRecord = Record<string, unknown>;
type MageWarsFxKind = 'attack' | 'push' | 'teleport' | 'healing';
type ScreenshotCssRect = { x: number; y: number; width: number; height: number };
type ScreenshotViewport = { width: number; height: number };
type MageWarsFxVideoRecording = {
    enabled: boolean;
    evidenceDir?: string;
    stableEvidenceDir?: string;
    frameDir?: string;
    frames?: MageWarsFxFrame[];
    finalGifPath?: string;
    passManifestPath?: string;
    frameDelaysMs?: number[];
    captureDurationMs?: number;
};

type MageWarsFxFrame = {
    path: string;
    capturedAtMs: number;
};

function getMageWarsE2eStandardSpellbookEntries(mageId: MageId): MageWarsPlayerState['spellbookEntries'] {
    return getStandardStartingSpellbook(mageId).map((entry) => ({
        spellCardId: entry.workshopCardIds[0] ?? (() => {
            throw new Error(`Mage Wars 标准法术书条目缺少实际卡牌 id：${mageId} ${entry.rulesName}`);
        })(),
        count: entry.quantity,
    }));
}

function buildMageWarsCurrentScopeSetupData(): Record<string, unknown> {
    const setupSelections = {
        mageWarsSeat0MageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
        mageWarsSeat1MageId: MAGE_IDS.PRIESTESS_APPRENTICE,
    };

    return {
        ...setupSelections,
        mageWarsSeat0SpellbookEntries: getMageWarsE2eStandardSpellbookEntries(MAGE_IDS.BEASTMASTER_APPRENTICE),
        mageWarsSeat1SpellbookEntries: getMageWarsE2eStandardSpellbookEntries(MAGE_IDS.PRIESTESS_APPRENTICE),
        setupSelections,
    };
}
type MageWarsTargetContinuityProbeReport = {
    sampleCount: number;
    fxSampleCount: number;
    missingDuringFx: Array<Record<string, unknown>>;
    firstFxSample: Record<string, unknown> | null;
    lastFxSample: Record<string, unknown> | null;
};

const TEST_API_TOKEN_FILE = 'temp/e2e/shared-test-api-token.txt';
const SELF_PREPARED_CARD_SELECTOR = '[data-mage-wars-prepared-card="self"]';
const MAGE_WARS_CURRENT_SCOPE_CANDIDATE_TEST_NAME = 'Mage Wars 入口接入当前范围候选链：选择法师法术书后覆盖计划、部署、移动、守卫、装备结界、魔物、攻击、能力和终局';
const MAGE_WARS_SPELLBOOK_PAGE_SCAN_LIMIT = 24;
type EvidenceScreenshotAnimationMode = 'allow' | 'disabled';
const TRUTHY_ENV_VALUES = new Set(['1', 'true', 'yes', 'on']);

async function saveEvidenceScreenshot(
    page: Page,
    testInfo: TestInfo,
    name: string,
    options: { animations?: EvidenceScreenshotAnimationMode; evidenceDir?: string } = {},
): Promise<string> {
    const screenshotPath = options.evidenceDir
        ? getEvidenceScreenshotPathInDirectory(options.evidenceDir, name, { requireChineseName: true })
        : getEvidenceScreenshotPath(testInfo, name, { requireChineseName: true });
    await page.screenshot(withJpegEvidenceScreenshotOptions({
        path: screenshotPath,
        fullPage: false,
        animations: options.animations ?? 'disabled',
        timeout: 10_000,
    }));
    testInfo.annotations.push({
        type: 'evidence-screenshot',
        description: screenshotPath,
    });
    return screenshotPath;
}

function shouldRecordMageWarsFxVideo(): boolean {
    return TRUTHY_ENV_VALUES.has((process.env.MAGE_WARS_RECORD_FX_VIDEO ?? '').trim().toLowerCase());
}

function createMageWarsFxVideoRecording(
    testInfo: TestInfo,
    options: { fileLabel?: string; evidenceDir?: string; stableEvidenceDir?: string } = {},
): MageWarsFxVideoRecording {
    if (!shouldRecordMageWarsFxVideo()) {
        return { enabled: false };
    }

    const stableEvidenceDir = options.stableEvidenceDir
        ?? getEvidenceScreenshotDir(testInfo, undefined, { requireChineseName: true });
    const evidenceDir = options.evidenceDir ?? stableEvidenceDir;
    const fileLabel = options.fileLabel ?? '召唤和攻击';
    const frameDir = path.join(
        evidenceDir,
        '_gif-frames',
        fileLabel.replace(/[\\/:*?"<>|]/g, '-'),
    );
    fs.mkdirSync(frameDir, { recursive: true });

    return {
        enabled: true,
        evidenceDir,
        stableEvidenceDir,
        frameDir,
        finalGifPath: path.join(
            evidenceDir,
            `00-法师战争${fileLabel}实际动效.gif`,
        ),
        passManifestPath: path.join(
            evidenceDir,
            `00-法师战争${fileLabel}实际动效-PASS.json`,
        ),
    };
}

function rebaseMageWarsEvidenceReference(
    value: string,
    recording: MageWarsFxVideoRecording,
): string {
    if (!recording.evidenceDir || !recording.stableEvidenceDir || !path.isAbsolute(value)) return value;
    const stagingDir = path.resolve(recording.evidenceDir);
    const stableDir = path.resolve(recording.stableEvidenceDir);
    const absoluteValue = path.resolve(value);
    const stagingPrefix = `${stagingDir}${path.sep}`;
    if (absoluteValue === stagingDir) return stableDir;
    if (!absoluteValue.startsWith(stagingPrefix)) return value;
    return path.join(stableDir, path.relative(stagingDir, absoluteValue));
}

function rebaseMageWarsTestAnnotations(
    testInfo: TestInfo,
    recording: MageWarsFxVideoRecording,
): void {
    for (const annotation of testInfo.annotations) {
        if (typeof annotation.description === 'string') {
            annotation.description = rebaseMageWarsEvidenceReference(annotation.description, recording);
        }
    }
}

type MageWarsFxGifCapture = {
    capture: (animations?: EvidenceScreenshotAnimationMode) => Promise<void>;
    stop: () => Promise<void>;
};

async function writeMageWarsAnimatedGif(
    frames: readonly MageWarsFxFrame[],
    outputPath: string,
): Promise<{ width: number; height: number; pages: number; frameDelaysMs: number[]; durationMs: number }> {
    const resizedFrames = await Promise.all(frames.map(async (frame) => (
        sharp(frame.path)
            .resize({ width: 1280, withoutEnlargement: true })
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true })
    )));
    const firstFrame = resizedFrames[0];
    if (!firstFrame || firstFrame.info.width <= 0 || firstFrame.info.height <= 0) {
        throw new Error('Mage Wars 动效 GIF 第一张真实过程帧没有有效尺寸');
    }

    const { width, height, channels } = firstFrame.info;
    if (channels !== 3) {
        throw new Error(`Mage Wars 动效 GIF 原始帧必须是 RGB，实际通道数为 ${channels}`);
    }
    if (resizedFrames.some((frame) => (
        frame.info.width !== width
        || frame.info.height !== height
        || frame.info.channels !== channels
    ))) {
        throw new Error('Mage Wars 动效 GIF 的真实过程帧尺寸或通道数不一致');
    }

    const stackedFrames = Buffer.alloc(width * height * channels * resizedFrames.length);
    resizedFrames.forEach((frame, index) => {
        frame.data.copy(stackedFrames, index * frame.data.length);
    });

    const observedIntervalsMs = frames
        .slice(1)
        .map((frame, index) => Math.max(1, frame.capturedAtMs - frames[index]!.capturedAtMs))
        .filter((value) => Number.isFinite(value));
    const fallbackDelayMs = observedIntervalsMs.length > 0
        ? observedIntervalsMs[Math.floor(observedIntervalsMs.length / 2)]!
        : 100;
    const frameDelaysMs = frames.map((frame, index) => {
        const nextFrame = frames[index + 1];
        const observedDelay = nextFrame
            ? nextFrame.capturedAtMs - frame.capturedAtMs
            : fallbackDelayMs;
        return Math.min(2_000, Math.max(40, Math.round(observedDelay)));
    });
    const durationMs = frameDelaysMs.reduce((total, delayMs) => total + delayMs, 0);

    await sharp(stackedFrames, {
        raw: {
            width,
            height: height * resizedFrames.length,
            channels,
            pageHeight: height,
        },
    })
        .gif({
            loop: 0,
            delay: frameDelaysMs,
            colours: 256,
            reuse: false,
            effort: 7,
            dither: 0.35,
            keepDuplicateFrames: true,
        })
        .toFile(outputPath);

    const metadata = await sharp(outputPath, { animated: true }).metadata();
    const pages = metadata.pages ?? 0;
    if (pages !== frames.length || metadata.pageHeight !== height) {
        throw new Error([
            'Mage Wars 动效 GIF 必须保留全部真实过程帧',
            `expectedPages=${frames.length}`,
            `actualPages=${pages}`,
            `pageHeight=${metadata.pageHeight ?? 'unknown'}`,
        ].join('\n'));
    }

    return { width, height, pages, frameDelaysMs, durationMs };
}

async function startMageWarsFxGifCapture(
    page: Page,
    recording: MageWarsFxVideoRecording,
): Promise<MageWarsFxGifCapture> {
    if (!recording.enabled || !recording.frameDir) {
        return {
            capture: async () => undefined,
            stop: async () => undefined,
        };
    }

    // 当前用例入口已由 clearEvidenceScreenshotsForTest 清理证据目录；
    // 这里不再对同一帧目录做 Windows 同步递归删除，避免传送代表态在
    // worker 中触发原生目录清理崩溃。新采样会从 0000.png 覆盖写入，
    // recording.frames 只引用本次运行实际采集到的帧。
    fs.mkdirSync(recording.frameDir, { recursive: true });
    console.log(`[MageWars GIF debug] recorder-dir-ready ${recording.frameDir}`);
    const frames: MageWarsFxFrame[] = [];
    let captureError: unknown = null;
    let frameIndex = 0;
    let pendingWrites = 0;
    let resolvePendingWrites: (() => void) | null = null;
    let stopped = false;
    const cdpSession = await page.context().newCDPSession(page);
    cdpSession.on('Page.screencastFrame', (event) => {
        const payload = event as {
            data: string;
            metadata?: { timestamp?: number };
            sessionId: number;
        };
        const framePath = path.join(recording.frameDir!, `${String(frameIndex).padStart(4, '0')}.png`);
        frameIndex += 1;
        pendingWrites += 1;
        void cdpSession.send('Page.screencastFrameAck', { sessionId: payload.sessionId })
            .catch((error: unknown) => {
                captureError = captureError ?? error;
            });
        void fs.promises.writeFile(framePath, Buffer.from(payload.data, 'base64'))
            .then(() => {
                frames.push({
                    path: framePath,
                    capturedAtMs: typeof payload.metadata?.timestamp === 'number'
                        ? Math.round(payload.metadata.timestamp * 1000)
                        : Date.now(),
                });
            })
            .catch((error: unknown) => {
                captureError = captureError ?? error;
            })
            .finally(() => {
                pendingWrites -= 1;
                if (pendingWrites === 0 && resolvePendingWrites) {
                    const resolve = resolvePendingWrites;
                    resolvePendingWrites = null;
                    resolve();
                }
            });
    });
    await cdpSession.send('Page.startScreencast', {
        format: 'png',
        everyNthFrame: 1,
        maxWidth: 1920,
        maxHeight: 1080,
    });

    // 语义截图调用只标记录制边界；真实 GIF 帧由 Chromium 帧流持续采集，
    // 不再让整页截图的耗时阻塞近战冲刺过程。
    const capture = async (_animations: EvidenceScreenshotAnimationMode = 'allow') => {
        if (captureError) throw captureError;
    };
    let stopPromise: Promise<void> | null = null;
    return {
        capture,
        stop: () => {
            if (stopPromise) return stopPromise;
            stopPromise = (async () => {
                stopped = true;
                await cdpSession.send('Page.stopScreencast');
                if (pendingWrites > 0) {
                    await new Promise<void>((resolve) => {
                        resolvePendingWrites = resolve;
                    });
                }
                await cdpSession.detach().catch(() => undefined);
                console.log(`[MageWars GIF debug] recorder-stop ${recording.finalGifPath ?? 'unknown'} frames=${frames.length}`);
                if (captureError) throw captureError;
                if (frames.length === 0) {
                    throw new Error('Mage Wars 动效 GIF 没有采集到任何真实页面过程帧');
                }
                if (stopped && frames.length > 0) {
                    recording.frames = frames.sort((left, right) => (
                        left.path.localeCompare(right.path)
                    ));
                }
            })();
            return stopPromise;
        },
    };
}

async function finalizeMageWarsFxVideoRecording(
    testInfo: TestInfo,
    recording: MageWarsFxVideoRecording,
    options: {
        actionLabel?: string;
        required?: boolean;
        requirements?: Array<{ requirement: string; status: 'PASS'; evidence: string[] }>;
    } = {},
): Promise<{ gifPath: string; passManifestPath: string } | null> {
    if (!recording.enabled) {
        if (options.required) {
            throw new Error('当前动效 E2E 要求截图、GIF、帧目录和 PASS manifest 同次生成；请启用 MAGE_WARS_RECORD_FX_VIDEO=1');
        }
        return null;
    }
    if (!recording.finalGifPath || !recording.passManifestPath) {
        throw new Error('Mage Wars 动效录制已开启，但最终 GIF 或 PASS 清单路径未初始化');
    }
    if (!recording.frames || recording.frames.length < 2) {
        throw new Error('Mage Wars 动效 GIF 至少需要两张来自真实页面的连续过程帧');
    }

    const gifMetadata = await writeMageWarsAnimatedGif(recording.frames, recording.finalGifPath);
    recording.frameDelaysMs = gifMetadata.frameDelaysMs;
    recording.captureDurationMs = gifMetadata.durationMs;
    const gifStats = await fs.promises.stat(recording.finalGifPath);
    if (gifStats.size <= 0) {
        throw new Error(`Mage Wars 动效 GIF 文件为空：${recording.finalGifPath}`);
    }

    const screenshotEvidence = testInfo.annotations
        .filter((annotation) => annotation.type === 'evidence-screenshot' && typeof annotation.description === 'string')
        .map((annotation) => annotation.description as string);
    const summonEvidence = screenshotEvidence.filter((entry) => entry.includes('召唤'));
    const attackEvidence = screenshotEvidence.filter((entry) => (
        entry.includes('间歇喷泉')
        || entry.includes('投射')
        || entry.includes('命中')
        || entry.includes('伤害飘字')
    ));

    const defaultRequirements = [
        {
            requirement: '法师战争两个派系基础流程里的召唤动效已通过：兽王野性山猫与女祭司阿希拉牧师都有召唤光柱过程帧和落场完成证据',
            status: 'PASS' as const,
            evidence: [
                'E2E：正式页面召唤和攻击必要过程帧覆盖 passed',
                ...summonEvidence,
                recording.finalGifPath,
            ],
        },
        {
            requirement: '法师战争攻击动效已通过：间歇喷泉攻击时目标单位在骰子、投射、命中和伤害飘字活跃期间逐帧持续可见，不会整张消失',
            status: 'PASS' as const,
            evidence: [
                'E2E：正式页面点击目标后产生攻击掷骰事件',
                'E2E：目标锚点可见性断言覆盖投射开始、投射飞行中、命中和伤害飘字三段',
                'E2E：逐帧目标连续性监视器覆盖攻击骰、投射、命中和伤害飘字活跃帧，目标不能有任一帧消失或不可见',
                ...attackEvidence,
                recording.finalGifPath,
            ],
        },
        {
            requirement: '法师战争攻击结果反馈已改为牌桌中心结果层：近战和远程攻击的骰子都不再按来源 / 目标位置漂移',
            status: 'PASS' as const,
            evidence: [
                'E2E：攻击骰结果层使用牌桌中心位 data-placement=board-center',
                'E2E：攻击开始和投射飞行中都断言骰子中心接近牌桌中心',
                ...attackEvidence,
                recording.finalGifPath,
            ],
        },
        {
            requirement: '法师战争攻击投射物使用线性飞行进度，避免靠近目标时明显减速',
            status: 'PASS' as const,
            evidence: [
                '单元测试：MageWarsBoard FX wiring 断言攻击 ConeBlast data-motion-easing=linear',
                'E2E：正式页面召唤和攻击必要过程帧覆盖 passed',
                recording.finalGifPath,
            ],
        },
        {
            requirement: '最终动态证据必须是 GIF，并且覆盖来源、过程、结果和稳定收口',
            status: 'PASS' as const,
            evidence: [
                recording.finalGifPath,
                `GIF 文件大小：${gifStats.size} bytes`,
                `GIF 输出尺寸：${gifMetadata.width}x${gifMetadata.height}`,
                `GIF 输出帧数：${gifMetadata.pages}`,
                `GIF 实际时长：${gifMetadata.durationMs} ms`,
            ],
        },
    ];
    const manifestMedia = Array.from(new Set([
        rebaseMageWarsEvidenceReference(recording.finalGifPath, recording),
        ...screenshotEvidence.map((entry) => rebaseMageWarsEvidenceReference(entry, recording)),
    ]));
    const manifest = {
        verdict: 'PASS',
        scope: 'current-user-request',
        generatedAt: new Date().toISOString(),
        recording: {
            action: options.actionLabel ?? '召唤和攻击',
            frameCount: recording.frames.length,
            frameDelaysMs: recording.frameDelaysMs,
            durationMs: recording.captureDurationMs,
            timingSource: '真实页面截图完成时间戳',
        },
        display: {
            purpose: 'final-user-visible-delivery',
            trigger: 'task-final-delivery',
            viewer: 'web',
            finalPassBeforeOpen: true,
        },
        requirements: options.requirements ?? defaultRequirements,
        media: manifestMedia,
    };

    manifest.requirements = manifest.requirements.map((requirement) => ({
        ...requirement,
        evidence: requirement.evidence.map((entry) => rebaseMageWarsEvidenceReference(entry, recording)),
    }));

    await fs.promises.writeFile(recording.passManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    testInfo.annotations.push(
        { type: 'evidence-gif', description: recording.finalGifPath },
        { type: 'pass-manifest', description: recording.passManifestPath },
    );
    return {
        gifPath: recording.finalGifPath,
        passManifestPath: recording.passManifestPath,
    };
}

type ScreenshotRegionVisualAudit = {
    crop: { x: number; y: number; width: number; height: number };
    beforeCrop: { x: number; y: number; width: number; height: number };
    imageSize: { width: number; height: number };
    totalPixels: number;
    processBrightPixels: number;
    processWhiteishPixels: number;
    changedPixels: number;
    strongChangedPixels: number;
    positiveLumDeltaPixels: number;
    negativeLumDeltaPixels: number;
    avgProcessLum: number;
    avgLumDelta: number;
    avgAbsLumDelta: number;
};

function clampNumber(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function readLuminance(buffer: Buffer, offset: number): number {
    return 0.2126 * buffer[offset] + 0.7152 * buffer[offset + 1] + 0.0722 * buffer[offset + 2];
}

function resolveScreenshotCrop(
    cssRect: ScreenshotCssRect,
    viewport: ScreenshotViewport,
    imageSize: { width: number; height: number },
) {
    const scaleX = imageSize.width / viewport.width;
    const scaleY = imageSize.height / viewport.height;
    const paddingX = cssRect.width * 0.10;
    const paddingY = cssRect.height * 0.10;
    const left = Math.floor(clampNumber((cssRect.x - paddingX) * scaleX, 0, imageSize.width - 1));
    const top = Math.floor(clampNumber((cssRect.y - paddingY) * scaleY, 0, imageSize.height - 1));
    const right = Math.ceil(clampNumber((cssRect.x + cssRect.width + paddingX) * scaleX, left + 1, imageSize.width));
    const bottom = Math.ceil(clampNumber((cssRect.y + cssRect.height + paddingY) * scaleY, top + 1, imageSize.height));
    return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
    };
}

async function readScreenshotRegionVisualAudit(
    beforePath: string,
    processPath: string,
    beforeCssRect: ScreenshotCssRect,
    processCssRect: ScreenshotCssRect,
    viewport: ScreenshotViewport,
): Promise<ScreenshotRegionVisualAudit> {
    const [beforeImage, processImage] = await Promise.all([
        sharp(beforePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
        sharp(processPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    ]);

    if (beforeImage.info.width !== processImage.info.width || beforeImage.info.height !== processImage.info.height) {
        throw new Error(`截图尺寸不一致，不能做目标格像素差异审计：before=${beforeImage.info.width}x${beforeImage.info.height}, process=${processImage.info.width}x${processImage.info.height}`);
    }

    const imageWidth = processImage.info.width;
    const imageHeight = processImage.info.height;
    const imageSize = { width: imageWidth, height: imageHeight };
    const beforeCrop = resolveScreenshotCrop(beforeCssRect, viewport, imageSize);
    const processCrop = resolveScreenshotCrop(processCssRect, viewport, imageSize);
    const cropWidth = processCrop.width;
    const cropHeight = processCrop.height;

    let processBrightPixels = 0;
    let processWhiteishPixels = 0;
    let changedPixels = 0;
    let strongChangedPixels = 0;
    let positiveLumDeltaPixels = 0;
    let negativeLumDeltaPixels = 0;
    let processLumSum = 0;
    let lumDeltaSum = 0;
    let absLumDeltaSum = 0;

    for (let y = 0; y < cropHeight; y += 1) {
        for (let x = 0; x < cropWidth; x += 1) {
            const processX = processCrop.x + x;
            const processY = processCrop.y + y;
            const beforeX = beforeCrop.x + Math.min(beforeCrop.width - 1, Math.floor((x / cropWidth) * beforeCrop.width));
            const beforeY = beforeCrop.y + Math.min(beforeCrop.height - 1, Math.floor((y / cropHeight) * beforeCrop.height));
            const offset = (processY * imageWidth + processX) * 4;
            const beforeOffset = (beforeY * imageWidth + beforeX) * 4;
            const beforeLum = readLuminance(beforeImage.data, beforeOffset);
            const processLum = readLuminance(processImage.data, offset);
            const lumDelta = processLum - beforeLum;
            const r = processImage.data[offset];
            const g = processImage.data[offset + 1];
            const b = processImage.data[offset + 2];
            const absRgbDelta = Math.abs(processImage.data[offset] - beforeImage.data[beforeOffset])
                + Math.abs(processImage.data[offset + 1] - beforeImage.data[beforeOffset + 1])
                + Math.abs(processImage.data[offset + 2] - beforeImage.data[beforeOffset + 2]);

            processLumSum += processLum;
            lumDeltaSum += lumDelta;
            absLumDeltaSum += Math.abs(lumDelta);
            if (processLum > 185) processBrightPixels += 1;
            if (r > 205 && g > 195 && b > 170 && Math.max(r, g, b) - Math.min(r, g, b) < 70) {
                processWhiteishPixels += 1;
            }
            if (absRgbDelta > 45) changedPixels += 1;
            if (absRgbDelta > 120) strongChangedPixels += 1;
            if (lumDelta > 35) positiveLumDeltaPixels += 1;
            if (lumDelta < -35) negativeLumDeltaPixels += 1;
        }
    }

    const totalPixels = cropWidth * cropHeight;
    return {
        crop: processCrop,
        beforeCrop,
        imageSize,
        totalPixels,
        processBrightPixels,
        processWhiteishPixels,
        changedPixels,
        strongChangedPixels,
        positiveLumDeltaPixels,
        negativeLumDeltaPixels,
        avgProcessLum: Number((processLumSum / totalPixels).toFixed(2)),
        avgLumDelta: Number((lumDeltaSum / totalPixels).toFixed(2)),
        avgAbsLumDelta: Number((absLumDeltaSum / totalPixels).toFixed(2)),
    };
}

async function readViewport(page: Page): Promise<ScreenshotViewport> {
    return page.viewportSize() ?? page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
    }));
}

const ATTACHMENT_TYPE_LABEL_TEXTS = ['装备', '结界', 'Equipment', 'Enchantment', 'Enchantments', 'Ongoing', 'Attached'];

async function expectNoExternalAttachmentTypeLabel(attachment: Locator) {
    const externalLabels = await attachment.evaluate((element, labelTexts) => {
        const candidates = Array.from(element.children)
            .filter((child) => child.getAttribute('data-card-atlas-frame') !== 'true')
            .map((child) => child.textContent?.replace(/\s+/g, ' ').trim() ?? '')
            .filter(Boolean);

        return candidates.filter((text) => labelTexts.includes(text));
    }, ATTACHMENT_TYPE_LABEL_TEXTS);

    expect(externalLabels).toEqual([]);
}

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickFields(source: unknown, keys: string[]): JsonRecord {
    if (!isRecord(source)) return {};
    return Object.fromEntries(keys.map((key) => [key, source[key]]));
}

function resolveTestApiToken(): string | null {
    const envToken = process.env.TEST_API_TOKEN?.trim();
    if (envToken) return envToken;
    try {
        const fileToken = fs.readFileSync(TEST_API_TOKEN_FILE, 'utf-8').trim();
        return fileToken.length > 0 ? fileToken : null;
    } catch {
        return null;
    }
}

async function readVisibleToastMessages(page: Page): Promise<string[]> {
    return page.evaluate(() => Array.from(
        document.querySelectorAll<HTMLElement>('.pointer-events-none .pointer-events-auto'),
    )
        .map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '')
        .filter((text) => text.length > 0));
}

async function readServerCoreSnapshot(
    page: Page,
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
) {
    const token = resolveTestApiToken();
    if (!token) return { error: `missing test api token: ${TEST_API_TOKEN_FILE}` };

    const credentials = playerId === '0' ? match.hostCredentials : match.guestCredentials;
    const response = await page.request.get(`${getGameServerBaseURL()}/test/get-state/${match.matchId}`, {
        headers: {
            'x-test-token': token,
            'x-test-player-id': playerId,
            'x-test-player-credentials': credentials,
        },
    });
    const payload = await response.json().catch(async () => ({
        text: await response.text().catch(() => ''),
    })) as unknown;
    if (!response.ok()) {
        return {
            error: `test state api failed: ${response.status()}`,
            payload,
        };
    }

    const payloadRecord = isRecord(payload) ? payload : {};
    const state = isRecord(payloadRecord.state) ? payloadRecord.state : {};
    const core = isRecord(state.core) ? state.core : {};
    const sys = isRecord(state.sys) ? state.sys : {};
    const players = isRecord(core.players) ? core.players : {};
    const objects = isRecord(core.objects) ? core.objects : {};
    const walls = isRecord(core.walls) ? core.walls : {};
    const arena = Array.isArray(core.arena) ? core.arena : [];
    const eventStream = isRecord(sys.eventStream) ? sys.eventStream : {};
    const eventEntries = Array.isArray(eventStream.entries) ? eventStream.entries : [];
    const actionLog = isRecord(sys.actionLog) ? sys.actionLog : {};
    const actionLogEntries = Array.isArray(actionLog.entries) ? actionLog.entries : [];
    const undo = isRecord(sys.undo) ? sys.undo : {};
    const undoSnapshots = Array.isArray(undo.snapshots) ? undo.snapshots : [];

    return {
        stateID: payloadRecord._stateID,
        sys: pickFields(sys, ['phase', 'currentPlayerId', 'phaseActorId', 'turnNumber', 'gameover']),
        actionLog: {
            maxEntries: actionLog.maxEntries,
            entries: actionLogEntries.slice(-20).map((entry) => {
                const record = isRecord(entry) ? entry : {};
                return pickFields(record, ['id', 'timestamp', 'actorId', 'kind', 'segments']);
            }),
        },
        undo: {
            snapshotCount: typeof undo.snapshotCount === 'number'
                ? undo.snapshotCount
                : undoSnapshots.length,
            pendingRequest: undo.pendingRequest,
            rollbackRevision: undo.rollbackRevision,
        },
        core: pickFields(core, ['phase', 'currentPlayerId', 'phaseActorId', 'turnNumber', 'gameResult']),
        players: Object.fromEntries(Object.entries(players).map(([id, player]) => [
            id,
            pickFields(player, [
                'mageId',
                'mageZoneId',
                'mana',
                'life',
                'damage',
                'actionReady',
                'quickcastReady',
                'preparedSpellCardIds',
                'discardSpellCardIds',
                'guarding',
            ]),
        ])),
        objects: Object.fromEntries(Object.entries(objects).map(([id, object]) => [
            id,
            pickFields(object, [
                'ownerId',
                'sourceSpellCardId',
                'zoneId',
                'kind',
                'actionReady',
                'damage',
                'guarding',
                'revealed',
                'anchoredToObjectId',
                'anchoredToPlayerId',
                'anchoredToZoneId',
                'boundSpellCardId',
                'restrainedByObjectId',
                'statusTokens',
                'temporaryTraits',
                'abilityUseRoundNumbers',
            ]),
        ])),
        walls: Object.fromEntries(Object.entries(walls).map(([id, wall]) => [
            id,
            pickFields(wall, [
                'id',
                'ownerId',
                'sourceSpellCardId',
                'sourceObjectId',
                'name',
                'edgeId',
                'zoneIds',
                'blocksLineOfSight',
                'passageDamage',
            ]),
        ])),
        arena: arena.map((zone) => pickFields(zone, ['id', 'occupantIds'])),
        eventStream: eventEntries.slice(-120).map((entry) => {
            const record = isRecord(entry) ? entry : {};
            const event = isRecord(record.event) ? record.event : {};
            const payload = isRecord(event.payload) ? event.payload : {};
            return {
                id: record.id,
                type: event.type,
                payload: pickFields(payload, [
                    'playerId',
                    'spellCardId',
                    'targetObjectId',
                    'targetId',
                    'targetPlayerId',
                    'targetZoneId',
                    'targetWallEdgeId',
                    'fromZoneId',
                    'toZoneId',
                    'distance',
                    'diceResults',
                    'effectDieResult',
                    'baseDamage',
                    'actualDamage',
                    'healing',
                    'interactionId',
                    'objectId',
                    'attackerObjectId',
                    'optionId',
                    'ownerId',
                    'sourceId',
                    'abilityId',
                    'sourceAbilityId',
                    'responseCardId',
                    'responseObjectId',
                    'spellOwnerId',
                    'statusTokenId',
                    'winnerId',
                    'defeatedPlayerId',
                    'amount',
                    'actualHealing',
                    'boundSpellCardId',
                    'mode',
                    'actionTrack',
                    'manaCost',
                    'reason',
                    'wall',
                    'wallId',
                    'edgeId',
                    'damageTypes',
                ]),
            };
        }),
    };
}

async function collectFailureEvidence(
    page: Page,
    options?: {
        match?: MageWarsOnlineMatch;
        playerId?: '0' | '1';
        diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>;
    },
) {
    const [snapshot, toastMessages, serverSnapshot] = await Promise.all([
        readOnlineBoardSnapshot(page),
        readVisibleToastMessages(page),
        options?.match && options.playerId
            ? readServerCoreSnapshot(page, options.match, options.playerId)
            : Promise.resolve(null),
    ]);

    return {
        snapshot,
        toastMessages,
        serverSnapshot,
        diagnostics: options?.diagnostics?.map(({ label, diagnostics }) => ({
            label,
            errors: diagnostics.errors,
        })) ?? [],
    };
}

type VisibleImageLoadFailure = {
    alt: string | null;
    src: string;
    complete: boolean;
    naturalWidth: number;
    naturalHeight: number;
    rect: { x: number; y: number; width: number; height: number };
    nearestTestId: string | null;
};

type VisibleAtlasLoadFailure = {
    reason: string;
    atlasId: string | null;
    atlasIndex: string | null;
    title: string | null;
    nearestTestId: string | null;
    className: string;
    imgSrc: string | null;
    naturalWidth: number | null;
    naturalHeight: number | null;
    rect: { x: number; y: number; width: number; height: number };
    pixelAudit?: {
        status: 'pass' | 'fail' | 'unavailable';
        reason?: string;
        averageChannelRange?: number;
        sampleCount?: number;
    };
};

async function readVisibleImageLoadFailures(page: Page): Promise<VisibleImageLoadFailure[]> {
    return page.evaluate(() => Array.from(document.images)
        .map((image) => {
            const rect = image.getBoundingClientRect();
            const nearestTestId = image.closest('[data-testid]')?.getAttribute('data-testid') ?? null;
            return {
                alt: image.getAttribute('alt'),
                src: image.currentSrc || image.src,
                complete: image.complete,
                naturalWidth: image.naturalWidth,
                naturalHeight: image.naturalHeight,
                rect: {
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                },
                nearestTestId,
            };
        })
        .filter((image) => image.rect.width > 10 && image.rect.height > 10)
        .filter((image) => image.naturalWidth <= 0 || image.naturalHeight <= 0)
        .map((image) => ({
            ...image,
            src: image.src.length > 240 ? `${image.src.slice(0, 237)}...` : image.src,
        })));
}

async function readVisibleMageWarsAtlasLoadFailures(page: Page): Promise<VisibleAtlasLoadFailure[]> {
    return page.evaluate(() => {
                        const board = document.querySelector<HTMLElement>('[data-testid="mage-wars-board"]');
        if (!board) {
            return [{
                reason: 'mage-wars-board-missing',
                atlasId: null,
                atlasIndex: null,
                title: null,
                nearestTestId: null,
                className: '',
                imgSrc: null,
                naturalWidth: null,
                naturalHeight: null,
                rect: { x: 0, y: 0, width: 0, height: 0 },
            }];
        }

        const isVisible = (element: HTMLElement) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 10
                && rect.height > 10
                && style.display !== 'none'
                && style.visibility !== 'hidden'
                && Number.parseFloat(style.opacity || '1') > 0.05;
        };

        const readRect = (element: HTMLElement) => {
            const rect = element.getBoundingClientRect();
            return {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
            };
        };

        const auditVisibleAtlasPixels = (
            frame: HTMLElement,
            image: HTMLImageElement,
        ): VisibleAtlasLoadFailure['pixelAudit'] => {
            try {
                const frameRect = frame.getBoundingClientRect();
                const imageRect = image.getBoundingClientRect();
                if (frameRect.width <= 0 || frameRect.height <= 0 || imageRect.width <= 0 || imageRect.height <= 0) {
                    return { status: 'fail', reason: 'zero-sized-frame-or-image' };
                }

                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) return { status: 'unavailable', reason: 'canvas-context-unavailable' };

                const points = [
                    [0.28, 0.22],
                    [0.5, 0.32],
                    [0.72, 0.46],
                    [0.35, 0.68],
                    [0.62, 0.78],
                ] as const;
                const samples: number[][] = [];
                for (const [px, py] of points) {
                    const viewportX = frameRect.left + frameRect.width * px;
                    const viewportY = frameRect.top + frameRect.height * py;
                    const sourceX = ((viewportX - imageRect.left) / imageRect.width) * image.naturalWidth;
                    const sourceY = ((viewportY - imageRect.top) / imageRect.height) * image.naturalHeight;
                    if (
                        !Number.isFinite(sourceX)
                        || !Number.isFinite(sourceY)
                        || sourceX < 0
                        || sourceY < 0
                        || sourceX >= image.naturalWidth
                        || sourceY >= image.naturalHeight
                    ) {
                        continue;
                    }
                    ctx.clearRect(0, 0, 1, 1);
                    ctx.drawImage(image, Math.floor(sourceX), Math.floor(sourceY), 1, 1, 0, 0, 1, 1);
                    const [r, g, b, a] = Array.from(ctx.getImageData(0, 0, 1, 1).data);
                    if (a > 4) samples.push([r, g, b]);
                }

                if (samples.length < 3) {
                    return { status: 'fail', reason: 'too-few-visible-samples', sampleCount: samples.length };
                }

                const channelRanges = [0, 1, 2].map((channel) => {
                    const values = samples.map((sample) => sample[channel]);
                    return Math.max(...values) - Math.min(...values);
                });
                const averageChannelRange = channelRanges.reduce((sum, value) => sum + value, 0) / channelRanges.length;
                if (averageChannelRange < 8) {
                    return {
                        status: 'fail',
                        reason: 'visible-frame-low-pixel-variance',
                        averageChannelRange: Math.round(averageChannelRange * 10) / 10,
                        sampleCount: samples.length,
                    };
                }

                return {
                    status: 'pass',
                    averageChannelRange: Math.round(averageChannelRange * 10) / 10,
                    sampleCount: samples.length,
                };
            } catch (error) {
                return {
                    status: 'unavailable',
                    reason: error instanceof Error ? error.message : String(error),
                };
            }
        };

        const frames = Array.from(
            board.querySelectorAll<HTMLElement>('[data-card-atlas-frame="true"], .atlas-shimmer'),
        ).filter(isVisible);

        return frames.flatMap((frame) => {
            const rect = readRect(frame);
            const base = {
                atlasId: frame.getAttribute('data-card-atlas-id'),
                atlasIndex: frame.getAttribute('data-card-atlas-index'),
                title: frame.getAttribute('title'),
                nearestTestId: frame.closest('[data-testid]')?.getAttribute('data-testid') ?? null,
                className: frame.className,
                rect,
            };

            if (frame.classList.contains('atlas-shimmer')) {
                return [{
                    ...base,
                    reason: frame.getAttribute('data-card-atlas-frame') === 'true'
                        ? 'atlas-frame-still-shimmering'
                        : 'lazy-atlas-unresolved-shimmer',
                    imgSrc: null,
                    naturalWidth: null,
                    naturalHeight: null,
                }];
            }

            const image = frame.querySelector<HTMLImageElement>('img[data-card-atlas-img="true"]');
            if (!image) {
                return [{
                    ...base,
                    reason: 'atlas-frame-missing-image',
                    imgSrc: null,
                    naturalWidth: null,
                    naturalHeight: null,
                }];
            }

            if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
                return [{
                    ...base,
                    reason: 'atlas-image-not-loaded',
                    imgSrc: image.currentSrc || image.src,
                    naturalWidth: image.naturalWidth,
                    naturalHeight: image.naturalHeight,
                }];
            }

            const imageRect = image.getBoundingClientRect();
            if (imageRect.width <= 10 || imageRect.height <= 10) {
                return [{
                    ...base,
                    reason: 'atlas-image-zero-sized',
                    imgSrc: image.currentSrc || image.src,
                    naturalWidth: image.naturalWidth,
                    naturalHeight: image.naturalHeight,
                }];
            }

            const pixelAudit = auditVisibleAtlasPixels(frame, image);
            if (pixelAudit.status === 'fail') {
                return [{
                    ...base,
                    reason: pixelAudit.reason ?? 'atlas-frame-pixel-audit-failed',
                    imgSrc: image.currentSrc || image.src,
                    naturalWidth: image.naturalWidth,
                    naturalHeight: image.naturalHeight,
                    pixelAudit,
                }];
            }

            return [];
        }).map((failure) => ({
            ...failure,
            imgSrc: failure.imgSrc && failure.imgSrc.length > 240
                ? `${failure.imgSrc.slice(0, 237)}...`
                : failure.imgSrc,
        }));
    });
}

async function waitForVisibleImagesLoaded(page: Page, label: string) {
    await expect.poll(async () => readVisibleImageLoadFailures(page), {
        message: `${label} Mage Wars 棋盘仍有可见图片没有真实尺寸`,
        timeout: 30_000,
        intervals: [250, 500, 1_000],
    }).toEqual([]);
}

async function waitForVisibleMageWarsAtlasCardsLoaded(page: Page, label: string) {
    await expect.poll(async () => readVisibleMageWarsAtlasLoadFailures(page), {
        message: `${label} Mage Wars 棋盘仍有可见图集牌面空白、未完成加载或像素无差异`,
        timeout: 30_000,
        intervals: [250, 500, 1_000],
    }).toEqual([]);
}

async function openOnlineBoard(page: Page, label: string) {
    await waitForFrontendAssets(page, 45_000);
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    const board = page.getByTestId('mage-wars-board');
    await expect(board).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId('mage-wars-arena-viewport')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('img[alt="法师战争标准竞技场"]')).toBeVisible({ timeout: 15_000 });
    await waitForVisibleImagesLoaded(page, label);
    await waitForVisibleMageWarsAtlasCardsLoaded(page, label);
}

async function disableMageWarsE2eFabMenu(page: Page) {
    await disableNonFlowFabForE2e(page, 'mage-wars');
}

async function readPhase(page: Page): Promise<string | null> {
    return page.getByTestId('mage-wars-board').getAttribute('data-mage-wars-phase', { timeout: 500 }).catch(() => null);
}

const SIMULTANEOUS_PHASES = new Set(['reset', 'channel', 'upkeep', 'planning']);

async function readOnlineBoardSnapshot(page: Page) {
    const board = page.getByTestId('mage-wars-board');
    const turnEnd = page.getByTestId('mage-wars-turn-end');
    const zones = await page.evaluate(() => Array.from(
        document.querySelectorAll<HTMLElement>('[data-testid^="mage-wars-arena-zone-"]'),
    ).map((zone) => ({
        zoneId: zone.getAttribute('data-testid')?.replace('mage-wars-arena-zone-', '') ?? null,
        legalMove: zone.getAttribute('data-legal-move-zone') === 'true',
        legalTarget: zone.getAttribute('data-legal-target-zone') === 'true',
        fieldCards: Array.from(zone.querySelectorAll<HTMLButtonElement>('[data-testid="mage-wars-zone-field-card"]'))
            .map((card) => ({
                sourceCardId: card.getAttribute('data-source-card-id'),
                objectId: card.getAttribute('data-object-id'),
                disabled: card.disabled,
                ariaLabel: card.getAttribute('aria-label'),
            })),
        mages: Array.from(zone.querySelectorAll<HTMLElement>('[data-testid="mage-wars-zone-mage-entity"]'))
            .map((mage) => ({
                playerId: mage.getAttribute('data-player-id'),
                ariaLabel: mage.getAttribute('aria-label'),
            })),
    })));
    const preparedCards = await page.evaluate(() => Array.from(
        document.querySelectorAll<HTMLElement>('[data-mage-wars-prepared-card="self"]'),
    ).map((card) => ({
        ariaLabel: card.getAttribute('aria-label'),
        sourceCardId: card.getAttribute('data-source-card-id'),
        disabled: card instanceof HTMLButtonElement ? card.disabled : null,
        selected: card.getAttribute('data-selected') === 'true',
        rect: (() => {
            const rect = card.getBoundingClientRect();
            return {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
            };
        })(),
    })));
    return {
        phase: await board.getAttribute('data-mage-wars-phase', { timeout: 1_000 }).catch(() => null),
        currentPlayerId: await board.getAttribute('data-mage-wars-current-player-id', { timeout: 1_000 }).catch(() => null),
        phaseActorId: await board.getAttribute('data-mage-wars-phase-actor-id', { timeout: 1_000 }).catch(() => null),
        turnNumber: await board.getAttribute('data-mage-wars-turn-number', { timeout: 1_000 }).catch(() => null),
        readyPlayerIds: await board.getAttribute('data-mage-wars-ready-player-ids', { timeout: 1_000 }).catch(() => null),
        eventCount: await board.getAttribute('data-mage-wars-event-count', { timeout: 1_000 }).catch(() => null),
        eventLatestId: await board.getAttribute('data-mage-wars-event-latest-id', { timeout: 1_000 }).catch(() => null),
        eventCursor: await board.getAttribute('data-mage-wars-event-cursor', { timeout: 1_000 }).catch(() => null),
        lastConsumedEvents: await board.getAttribute('data-mage-wars-last-consumed-events', { timeout: 1_000 }).catch(() => null),
        lastFxCues: await board.getAttribute('data-mage-wars-last-fx-cues', { timeout: 1_000 }).catch(() => null),
        turnEndEnabled: await turnEnd.isEnabled({ timeout: 500 }).catch(() => false),
        turnEndText: await turnEnd.innerText({ timeout: 1_000 }).catch(() => ''),
        preparedCards,
        zones,
    };
}

async function readZoneFieldCardSnapshot(
    page: Page,
    zoneId: string,
    sourceCardId: number,
    contextLabel: string,
) {
    const snapshot = await readOnlineBoardSnapshot(page);
    const zone = snapshot.zones.find((candidate) => candidate.zoneId === zoneId);
    const card = zone?.fieldCards.find((candidate) => candidate.sourceCardId === String(sourceCardId));
    if (!card) {
        throw new Error([
            `${contextLabel} 未在 ${zoneId} 找到 CardID ${sourceCardId}`,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    }
    return card;
}

async function readHitTest(locator: Locator) {
    return locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(centerX, centerY);
        const hitChain: Array<{
            tagName: string;
            testId: string | null;
            ariaLabel: string | null;
            className: string | null;
            disabled: boolean | null;
        }> = [];
        let current: Element | null = hit;
        while (current && hitChain.length < 6) {
            hitChain.push({
                tagName: current.tagName.toLowerCase(),
                testId: current.getAttribute('data-testid'),
                ariaLabel: current.getAttribute('aria-label'),
                className: typeof (current as HTMLElement).className === 'string'
                    ? (current as HTMLElement).className
                    : null,
                disabled: current instanceof HTMLButtonElement ? current.disabled : null,
            });
            current = current.parentElement;
        }

        return {
            rect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
            },
            center: {
                x: Math.round(centerX),
                y: Math.round(centerY),
            },
            hitChain,
            hitWithinLocator: Boolean(hit && (hit === element || element.contains(hit))),
        };
    });
}

async function readViewportRelation(locator: Locator, safeInset = 48) {
    return locator.evaluate((element, inset) => {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const tolerance = 2;
        return {
            rect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                right: Math.round(rect.right),
                bottom: Math.round(rect.bottom),
            },
            center: {
                x: Math.round(centerX),
                y: Math.round(centerY),
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
            },
            intersectsViewport: rect.right > 0
                && rect.bottom > 0
                && rect.left < window.innerWidth
                && rect.top < window.innerHeight,
            centerInsideSafeViewport: centerX >= inset - tolerance
                && centerY >= inset - tolerance
                && centerX <= window.innerWidth - inset + tolerance
                && centerY <= window.innerHeight - inset + tolerance,
        };
    }, safeInset);
}

async function dragArenaViewportUntilLocatorActionable(
    page: Page,
    locator: Locator,
    contextLabel: string,
    options: { safeInset?: number } = {},
) {
    const arenaViewport = page.getByTestId('mage-wars-arena-viewport');
    const arenaContent = page.getByTestId('mage-wars-arena-viewport-content');
    await expect(arenaViewport).toBeVisible({ timeout: 5_000 });
    await expect(arenaContent).toBeVisible({ timeout: 5_000 });
    await expect(locator).toBeAttached({ timeout: 3_000 });

    const safeInset = options.safeInset ?? 72;
    let lastRelation = await readViewportRelation(locator, safeInset);
    let lastHit = await readHitTest(locator).catch(() => null);
    for (let attempt = 0; attempt < 8; attempt += 1) {
        if (
            lastRelation.intersectsViewport
            && lastRelation.centerInsideSafeViewport
            && lastHit?.hitWithinLocator !== false
        ) return;

        const viewportBox = await arenaViewport.boundingBox();
        if (!viewportBox) {
            throw new Error(`${contextLabel} 需要拖拽竞技场视窗，但视窗没有可操作区域`);
        }

        let desiredX = Math.min(
            Math.max(lastRelation.center.x, safeInset),
            lastRelation.viewport.width - safeInset,
        );
        let desiredY = Math.min(
            Math.max(lastRelation.center.y, safeInset),
            lastRelation.viewport.height - safeInset,
        );
        if (lastHit?.hitWithinLocator === false) {
            desiredX = Math.min(
                Math.max(lastRelation.viewport.width * 0.62, safeInset),
                lastRelation.viewport.width - safeInset,
            );
            desiredY = Math.min(
                Math.max(lastRelation.viewport.height * 0.36, safeInset),
                lastRelation.viewport.height - safeInset,
            );
        }
        const maxDragX = Math.max(120, viewportBox.width * 0.42);
        const maxDragY = Math.max(90, viewportBox.height * 0.42);
        const dragX = Math.max(-maxDragX, Math.min(maxDragX, desiredX - lastRelation.center.x));
        const dragY = Math.max(-maxDragY, Math.min(maxDragY, desiredY - lastRelation.center.y));
        if (Math.abs(dragX) < 4 && Math.abs(dragY) < 4) break;

        const beforeTransform = await arenaContent.evaluate((element) => (element as HTMLElement).style.transform);
        const startX = viewportBox.x + viewportBox.width / 2;
        const startY = viewportBox.y + viewportBox.height / 2;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + dragX, startY + dragY, { steps: 6 });
        await page.mouse.up();
        await expect.poll(async () => arenaContent.evaluate((element) => (element as HTMLElement).style.transform), {
            message: `${contextLabel} 拖拽竞技场视窗后地图 transform 应变化`,
            timeout: 2_000,
        }).not.toBe(beforeTransform);
        await page.waitForTimeout(220);
        lastRelation = await readViewportRelation(locator, safeInset);
        lastHit = await readHitTest(locator).catch(() => null);
    }

    if (!lastRelation.intersectsViewport || !lastRelation.centerInsideSafeViewport || lastHit?.hitWithinLocator === false) {
        throw new Error([
            `${contextLabel} 真实拖拽竞技场后仍不在可点击视口内`,
            `relation=${JSON.stringify(lastRelation, null, 2)}`,
            `hit=${JSON.stringify(lastHit, null, 2)}`,
        ].join('\n'));
    }
}

type LocatorScreenPoint = {
    x: number;
    y: number;
    rect: {
        x: number;
        y: number;
        width: number;
        height: number;
        right: number;
        bottom: number;
    };
    hitChain: Array<{
        tagName: string;
        testId: string | null;
        ariaLabel: string | null;
        className: string | null;
        disabled: boolean | null;
    }>;
};

async function resolveLocatorVisibleHitPoint(locator: Locator, contextLabel: string): Promise<LocatorScreenPoint> {
    const point = await locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const visibleLeft = Math.max(0, rect.left);
        const visibleTop = Math.max(0, rect.top);
        const visibleRight = Math.min(window.innerWidth, rect.right);
        const visibleBottom = Math.min(window.innerHeight, rect.bottom);
        if (visibleRight <= visibleLeft || visibleBottom <= visibleTop) return null;

        const inset = 8;
        const minX = visibleRight - visibleLeft > inset * 2 ? visibleLeft + inset : visibleLeft;
        const maxX = visibleRight - visibleLeft > inset * 2 ? visibleRight - inset : visibleRight;
        const minY = visibleBottom - visibleTop > inset * 2 ? visibleTop + inset : visibleTop;
        const maxY = visibleBottom - visibleTop > inset * 2 ? visibleBottom - inset : visibleBottom;
        const candidates: Array<{ x: number; y: number }> = [];
        const ratios = [0.5, 0.25, 0.75, 0.12, 0.88, 0.38, 0.62];
        for (const yRatio of ratios) {
            for (const xRatio of ratios) {
                candidates.push({
                    x: minX + (maxX - minX) * xRatio,
                    y: minY + (maxY - minY) * yRatio,
                });
            }
        }

        const describeHit = (hit: Element | null) => {
            const hitChain: LocatorScreenPoint['hitChain'] = [];
            let current: Element | null = hit;
            while (current && hitChain.length < 6) {
                hitChain.push({
                    tagName: current.tagName.toLowerCase(),
                    testId: current.getAttribute('data-testid'),
                    ariaLabel: current.getAttribute('aria-label'),
                    className: typeof (current as HTMLElement).className === 'string'
                        ? (current as HTMLElement).className
                        : null,
                    disabled: current instanceof HTMLButtonElement ? current.disabled : null,
                });
                current = current.parentElement;
            }
            return hitChain;
        };

        for (const candidate of candidates) {
            const hit = document.elementFromPoint(candidate.x, candidate.y);
            if (hit && (hit === element || element.contains(hit))) {
                return {
                    x: Math.round(candidate.x),
                    y: Math.round(candidate.y),
                    rect: {
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        right: Math.round(rect.right),
                        bottom: Math.round(rect.bottom),
                    },
                    hitChain: describeHit(hit),
                };
            }
        }

        return {
            x: Math.round((minX + maxX) / 2),
            y: Math.round((minY + maxY) / 2),
            rect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                right: Math.round(rect.right),
                bottom: Math.round(rect.bottom),
            },
            hitChain: describeHit(document.elementFromPoint((minX + maxX) / 2, (minY + maxY) / 2)),
            miss: true,
        };
    });
    if (!point || 'miss' in point) {
        throw new Error([
            `${contextLabel} 没有找到可由玩家真实点击命中的屏幕点`,
            `point=${JSON.stringify(point, null, 2)}`,
        ].join('\n'));
    }
    return point;
}

async function clickLocatorAtVisibleHitPoint(page: Page, locator: Locator, contextLabel: string) {
    const point = await resolveLocatorVisibleHitPoint(locator, contextLabel);
    await page.mouse.click(point.x, point.y);
}

type ElementRect = {
    x: number;
    y: number;
    width: number;
    height: number;
    right: number;
    bottom: number;
};

type MobileLandscapeHudAudit = {
    viewport: { width: number; height: number };
    mirrorLayer: ElementRect | null;
    selfHud: ElementRect | null;
    opponentHud: ElementRect | null;
    desktopSpellbook: ElementRect | null;
    desktopPrepared: ElementRect | null;
    discardPile: ElementRect | null;
    opponentMirror: ElementRect | null;
    turnEnd: ElementRect | null;
    fabMenu: ElementRect | null;
    compactOpponentMirror: boolean;
    mobileSelfRailCount: number;
    opponentMobileRailCount: number;
};

async function readMobileLandscapeHudAudit(page: Page): Promise<MobileLandscapeHudAudit> {
    return page.evaluate(() => {
        type Rect = {
            x: number;
            y: number;
            width: number;
            height: number;
            right: number;
            bottom: number;
        };
        const toRect = (element: HTMLElement | null): Rect | null => {
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                right: Math.round(rect.right),
                bottom: Math.round(rect.bottom),
            };
        };
    const mirrorLayer = toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-desktop-ui-plane"]'));
        const selfHud = toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-mage-hud-self"]'));
        const opponentHud = toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-mage-hud-opponent"]'));
        const desktopSpellbook = toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-desktop-spellbook-shelf"]'));
        const desktopPrepared = toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-desktop-prepared-spells"]'));
        const discardPile = toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-discard-pile"]'));
        const opponentMirrorElement = document.querySelector<HTMLElement>('[data-testid="mage-wars-opponent-prepared-mirror"]');
        const opponentMirror = toRect(opponentMirrorElement);
        const turnEnd = toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-turn-end"]'));
        const fabMenu = toRect(document.querySelector<HTMLElement>('[data-testid="fab-menu"]'));

        return {
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
            },
            mirrorLayer,
            selfHud,
            opponentHud,
            desktopSpellbook,
            desktopPrepared,
            discardPile,
            opponentMirror,
            turnEnd,
            fabMenu,
            compactOpponentMirror: opponentMirrorElement?.dataset.mageWarsCompact === 'true',
            mobileSelfRailCount: document.querySelectorAll('[data-testid="mage-wars-mobile-self-spell-rail"]').length,
            opponentMobileRailCount: document.querySelectorAll('[data-testid="mage-wars-mobile-opponent-spell-rail"]').length,
        };
    });
}

async function expectMobileLandscapeHudSlots(page: Page, label: string) {
    await expect(page.getByTestId('mage-wars-desktop-ui-plane')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-mage-hud-self')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-mage-hud-opponent')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-desktop-spellbook-shelf')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-desktop-prepared-spells')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-discard-pile')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-opponent-prepared-mirror')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-turn-end')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('fab-menu')).toBeAttached({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-mobile-self-spell-rail')).toHaveCount(0);
    await expect(page.getByTestId('mage-wars-mobile-opponent-spell-rail')).toHaveCount(0);
    await page.waitForTimeout(150);

    const audit = await readMobileLandscapeHudAudit(page);
    expect(audit.viewport).toEqual({ width: 960, height: 540 });
    expect(audit.mirrorLayer, `${label} 移动横屏必须使用桌面镜像层`).not.toBeNull();
    expect(audit.mirrorLayer!.width, `${label} 桌面镜像层宽度必须铺满视口`).toBe(960);
    expect(audit.mirrorLayer!.height, `${label} 桌面镜像层高度必须铺满视口`).toBe(540);
    expect(audit.selfHud, `${label} 己方法师 HUD 必须沿用桌面承载`).not.toBeNull();
    expect(audit.opponentHud, `${label} 对手法师 HUD 必须沿用桌面承载`).not.toBeNull();
    expect(audit.desktopSpellbook, `${label} 法术书必须沿用桌面承载`).not.toBeNull();
    expect(audit.desktopPrepared, `${label} 已计划法术必须沿用桌面承载`).not.toBeNull();
    expect(audit.discardPile, `${label} 弃牌堆必须沿用桌面承载`).not.toBeNull();
    expect(audit.opponentMirror, `${label} 对手隐藏计划必须沿用桌面承载`).not.toBeNull();
    expect(audit.turnEnd, `${label} 阶段推进按钮必须可见`).not.toBeNull();
    expect(audit.fabMenu, `${label} E2E 已显式隐藏全局悬浮入口，不参与主游戏压力态`).not.toBeNull();
    expect(audit.compactOpponentMirror, `${label} 对手计划不得使用移动端紧凑镜像`).toBe(false);
    expect(audit.mobileSelfRailCount, `${label} 不得渲染移动专用己方法术轨`).toBe(0);
    expect(audit.opponentMobileRailCount, `${label} 不得渲染移动专用对手法术轨`).toBe(0);
}

type MageWarsFxAudit = {
    sourceRow: string | null;
    sourceCol: string | null;
    targetRow: string | null;
    targetCol: string | null;
    sourceAnchorId?: string | null;
    targetAnchorId?: string | null;
    targetAnchorVisible?: boolean | null;
    targetAnchorOpacity?: number | null;
    targetAnchorDistancePx?: number | null;
    targetAnchorOverlapRatio?: number | null;
    fxMaxTargetAnchorRatio?: number | null;
    hasSourceWake: boolean;
    hasImpact: boolean;
    hasTravel: boolean;
};

type MageWarsSummonFxAudit = {
    objectKind: string | null;
    objectId: string | null;
    visible: boolean;
    canvasWidth: number;
    canvasHeight: number;
    alphaPixels: number;
    brightPixels: number;
    sampledCanvasIndex: number;
    canvasCount: number;
    targetZoneId?: string | null;
    targetObjectId?: string | null;
    fxCenterInsideTarget?: boolean;
    targetCenterInsideFx?: boolean;
    targetCenterDistancePx?: number | null;
    targetOverlapRatio?: number | null;
    fxMaxTargetRatio?: number | null;
    fxCenterInsideTargetObject?: boolean;
    targetObjectCenterInsideFx?: boolean;
    targetObjectCenterDistancePx?: number | null;
    targetObjectOverlapRatio?: number | null;
    fxMaxTargetObjectRatio?: number | null;
    screenshotPath?: string;
    targetRegionAudit?: ScreenshotRegionVisualAudit;
};

type SummonFxDebugContext = {
    match: MageWarsOnlineMatch;
    playerId: '0' | '1';
    label: string;
    sourceCardId: number;
    zoneId: ArenaZoneId;
    beforeScreenshotPath?: string;
    targetRect?: ScreenshotCssRect;
};

async function readSummonFxVisualDebug(page: Page) {
    return page.evaluate(() => {
        const layer = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-layer"]');
        const summarizeCanvas = (canvas: HTMLCanvasElement, index: number) => {
            const base = {
                index,
                width: canvas.width,
                height: canvas.height,
                cssWidth: Math.round(canvas.getBoundingClientRect().width),
                cssHeight: Math.round(canvas.getBoundingClientRect().height),
                context: 'unreadable',
                alphaPixels: 0,
                brightPixels: 0,
            };
            try {
                const ctx = canvas.getContext('2d');
                if (!ctx || canvas.width <= 0 || canvas.height <= 0) return base;
                const sampleWidth = Math.min(canvas.width, 240);
                const sampleHeight = Math.min(canvas.height, 180);
                const offsetX = Math.max(0, Math.floor((canvas.width - sampleWidth) / 2));
                const offsetY = Math.max(0, Math.floor((canvas.height - sampleHeight) / 2));
                const data = ctx.getImageData(offsetX, offsetY, sampleWidth, sampleHeight).data;
                let alphaPixels = 0;
                let brightPixels = 0;
                for (let i = 0; i < data.length; i += 4) {
                    const alpha = data[i + 3];
                    if (alpha <= 10) continue;
                    alphaPixels += 1;
                    if (alpha > 28 && data[i] + data[i + 1] + data[i + 2] > 360) {
                        brightPixels += 1;
                    }
                }
                return { ...base, context: '2d', alphaPixels, brightPixels };
            } catch (error) {
                return {
                    ...base,
                    context: error instanceof Error ? error.message : String(error),
                };
            }
        };

        const summons = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="mage-wars-fx-summon"]'));
        return {
            probe: (window as typeof window & { __mageWarsSummonFxAuditProbe?: unknown }).__mageWarsSummonFxAuditProbe ?? null,
            layer: layer ? {
                activeCount: layer.dataset.fxActiveCount ?? null,
                activeCues: layer.dataset.fxActiveCues ?? null,
                childTestIds: Array.from(layer.querySelectorAll<HTMLElement>('[data-testid]'))
                    .slice(0, 12)
                    .map((element) => element.dataset.testid ?? element.getAttribute('data-testid')),
            } : null,
            summonCount: summons.length,
            summons: summons.map((summon) => {
                const rect = summon.getBoundingClientRect();
                return {
                    objectKind: summon.dataset.objectKind ?? null,
                    objectId: summon.dataset.objectId ?? null,
                    rect: {
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                    },
                    canvases: Array.from(summon.querySelectorAll('canvas')).map(summarizeCanvas),
                };
            }),
        };
    }).catch((error: unknown) => ({
        error: error instanceof Error ? error.message : String(error),
    }));
}

async function readSummonFxFailureDebug(page: Page, context?: SummonFxDebugContext) {
    const [visual, board, server] = await Promise.all([
        readSummonFxVisualDebug(page),
        readOnlineBoardSnapshot(page).catch((error: unknown) => ({
            error: error instanceof Error ? error.message : String(error),
        })),
        context
            ? readServerCoreSnapshot(page, context.match, context.playerId).catch((error: unknown) => ({
                error: error instanceof Error ? error.message : String(error),
            }))
            : Promise.resolve(null),
    ]);

    return {
        context,
        visual,
        board,
        server,
    };
}

async function waitForSummonFxVisualAudit(
    page: Page,
    context?: SummonFxDebugContext,
): Promise<MageWarsSummonFxAudit> {
    const handle = await page.waitForFunction((args: { zoneId?: string } | null) => {
        type ProbeRecord = {
            checks: number;
            seenSummon: boolean;
            last: unknown;
            best: null | {
                objectKind: string | null;
                objectId: string | null;
                visible: boolean;
                canvasWidth: number;
                canvasHeight: number;
                alphaPixels: number;
                brightPixels: number;
                sampledCanvasIndex: number;
                canvasCount: number;
                targetZoneId?: string | null;
                targetObjectId?: string | null;
                fxCenterInsideTarget?: boolean;
                targetCenterInsideFx?: boolean;
                targetCenterDistancePx?: number | null;
                targetOverlapRatio?: number | null;
                fxMaxTargetRatio?: number | null;
                fxCenterInsideTargetObject?: boolean;
                targetObjectCenterInsideFx?: boolean;
                targetObjectCenterDistancePx?: number | null;
                targetObjectOverlapRatio?: number | null;
                fxMaxTargetObjectRatio?: number | null;
            };
        };
        const probeWindow = window as typeof window & { __mageWarsSummonFxAuditProbe?: ProbeRecord };
        const probe = probeWindow.__mageWarsSummonFxAuditProbe ?? {
            checks: 0,
            seenSummon: false,
            last: null,
            best: null,
        };
        probe.checks += 1;
        probeWindow.__mageWarsSummonFxAuditProbe = probe;

        const layer = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-layer"]');
        const summon = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-summon"]');
        if (!summon) {
            probe.last = {
                reason: 'missing-summon',
                activeCount: layer?.dataset.fxActiveCount ?? null,
                activeCues: layer?.dataset.fxActiveCues ?? null,
            };
            return null;
        }
        probe.seenSummon = true;
        const rect = summon.getBoundingClientRect();
        const escapeAttr = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        let targetAudit: Pick<
            MageWarsSummonFxAudit,
            | 'targetZoneId'
            | 'targetObjectId'
            | 'fxCenterInsideTarget'
            | 'targetCenterInsideFx'
            | 'targetCenterDistancePx'
            | 'targetOverlapRatio'
            | 'fxMaxTargetRatio'
            | 'fxCenterInsideTargetObject'
            | 'targetObjectCenterInsideFx'
            | 'targetObjectCenterDistancePx'
            | 'targetObjectOverlapRatio'
            | 'fxMaxTargetObjectRatio'
        > = {};
        if (args?.zoneId) {
            const targetZone = document.querySelector<HTMLElement>(`[data-testid="mage-wars-arena-zone-${args.zoneId}"]`);
            if (!targetZone) {
                probe.last = { reason: 'missing-target-zone', zoneId: args.zoneId };
                return null;
            }
            const targetZoneRect = targetZone.getBoundingClientRect();
            const targetObjectId = summon.dataset.objectId ?? null;
            const targetObject = targetObjectId
                ? document.querySelector<HTMLElement>(`[data-testid="mage-wars-zone-field-card"][data-object-id="${escapeAttr(targetObjectId)}"]`)
                : null;
            if (!targetObject) {
                probe.last = {
                    reason: 'missing-target-object-anchor',
                    zoneId: args.zoneId,
                    targetObjectId,
                    activeCount: layer?.dataset.fxActiveCount ?? null,
                    activeCues: layer?.dataset.fxActiveCues ?? null,
                };
                return null;
            }
            const targetObjectRect = targetObject.getBoundingClientRect();
            const fxCenterX = rect.left + rect.width / 2;
            const fxCenterY = rect.top + rect.height / 2;
            const zoneCenterX = targetZoneRect.left + targetZoneRect.width / 2;
            const zoneCenterY = targetZoneRect.top + targetZoneRect.height / 2;
            const objectCenterX = targetObjectRect.left + targetObjectRect.width / 2;
            const objectCenterY = targetObjectRect.top + targetObjectRect.height / 2;
            const zoneOverlapWidth = Math.max(0, Math.min(rect.right, targetZoneRect.right) - Math.max(rect.left, targetZoneRect.left));
            const zoneOverlapHeight = Math.max(0, Math.min(rect.bottom, targetZoneRect.bottom) - Math.max(rect.top, targetZoneRect.top));
            const objectOverlapWidth = Math.max(0, Math.min(rect.right, targetObjectRect.right) - Math.max(rect.left, targetObjectRect.left));
            const objectOverlapHeight = Math.max(0, Math.min(rect.bottom, targetObjectRect.bottom) - Math.max(rect.top, targetObjectRect.top));
            const targetArea = Math.max(1, targetZoneRect.width * targetZoneRect.height);
            const targetObjectArea = Math.max(1, targetObjectRect.width * targetObjectRect.height);
            const targetCenterDistancePx = Math.hypot(fxCenterX - zoneCenterX, fxCenterY - zoneCenterY);
            const targetObjectCenterDistancePx = Math.hypot(fxCenterX - objectCenterX, fxCenterY - objectCenterY);
            const fxMaxTargetRatio = Math.max(
                rect.width / Math.max(1, targetZoneRect.width),
                rect.height / Math.max(1, targetZoneRect.height),
            );
            const fxMaxTargetObjectRatio = Math.max(
                rect.width / Math.max(1, targetObjectRect.width),
                rect.height / Math.max(1, targetObjectRect.height),
            );
            const fxCenterInsideTarget = fxCenterX >= targetZoneRect.left
                && fxCenterX <= targetZoneRect.right
                && fxCenterY >= targetZoneRect.top
                && fxCenterY <= targetZoneRect.bottom;
            const targetCenterInsideFx = zoneCenterX >= rect.left
                && zoneCenterX <= rect.right
                && zoneCenterY >= rect.top
                && zoneCenterY <= rect.bottom;
            const fxCenterInsideTargetObject = fxCenterX >= targetObjectRect.left
                && fxCenterX <= targetObjectRect.right
                && fxCenterY >= targetObjectRect.top
                && fxCenterY <= targetObjectRect.bottom;
            const targetObjectCenterInsideFx = objectCenterX >= rect.left
                && objectCenterX <= rect.right
                && objectCenterY >= rect.top
                && objectCenterY <= rect.bottom;
            const targetOverlapRatio = (zoneOverlapWidth * zoneOverlapHeight) / targetArea;
            const targetObjectOverlapRatio = (objectOverlapWidth * objectOverlapHeight) / targetObjectArea;
            targetAudit = {
                targetZoneId: args.zoneId,
                targetObjectId,
                fxCenterInsideTarget,
                targetCenterInsideFx,
                targetCenterDistancePx: Math.round(targetCenterDistancePx * 10) / 10,
                targetOverlapRatio: Math.round(targetOverlapRatio * 1_000) / 1_000,
                fxMaxTargetRatio: Math.round(fxMaxTargetRatio * 1_000) / 1_000,
                fxCenterInsideTargetObject,
                targetObjectCenterInsideFx,
                targetObjectCenterDistancePx: Math.round(targetObjectCenterDistancePx * 10) / 10,
                targetObjectOverlapRatio: Math.round(targetObjectOverlapRatio * 1_000) / 1_000,
                fxMaxTargetObjectRatio: Math.round(fxMaxTargetObjectRatio * 1_000) / 1_000,
            };
            if (
                targetObjectRect.width <= 0
                || targetObjectRect.height <= 0
                || !fxCenterInsideTargetObject
                || !targetObjectCenterInsideFx
                || targetObjectCenterDistancePx > Math.max(targetObjectRect.width, targetObjectRect.height) * 0.12
                || targetObjectOverlapRatio < 0.82
                || fxMaxTargetObjectRatio < 1
                || fxMaxTargetObjectRatio > 1.16
            ) {
                probe.last = {
                    reason: 'summon-fx-not-aligned-to-target-object',
                    rect: {
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                    },
                    targetObjectRect: {
                        x: Math.round(targetObjectRect.x),
                        y: Math.round(targetObjectRect.y),
                        width: Math.round(targetObjectRect.width),
                        height: Math.round(targetObjectRect.height),
                    },
                    ...targetAudit,
                };
                return null;
            }
        }
        const canvases = Array.from(summon.querySelectorAll('canvas'));
        if (canvases.length === 0) {
            probe.last = {
                reason: 'missing-canvas',
                rect: {
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                },
            };
            return null;
        }

        const canvasAudits = canvases.flatMap((canvas, sampledCanvasIndex) => {
            if (canvas.width <= 0 || canvas.height <= 0) return [];
            const ctx = canvas.getContext('2d');
            if (!ctx) return [];

            const sampleWidth = Math.min(canvas.width, 640);
            const sampleHeight = Math.min(canvas.height, 360);
            const offsetX = Math.max(0, Math.floor((canvas.width - sampleWidth) / 2));
            const offsetY = Math.max(0, Math.floor((canvas.height - sampleHeight) / 2));
            const data = ctx.getImageData(offsetX, offsetY, sampleWidth, sampleHeight).data;
            let alphaPixels = 0;
            let brightPixels = 0;
            for (let i = 0; i < data.length; i += 4) {
                const alpha = data[i + 3];
                if (alpha <= 10) continue;
                alphaPixels += 1;
                if (alpha > 28 && data[i] + data[i + 1] + data[i + 2] > 360) {
                    brightPixels += 1;
                }
            }

            return [{
                canvasWidth: canvas.width,
                canvasHeight: canvas.height,
                alphaPixels,
                brightPixels,
                sampledCanvasIndex,
            }];
        });

        const visibleAudit = canvasAudits
            .sort((a, b) => (b.brightPixels + b.alphaPixels) - (a.brightPixels + a.alphaPixels))[0];
        if (!visibleAudit) {
            probe.last = {
                reason: 'no-readable-canvas',
                canvasCount: canvases.length,
                rect: {
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                },
            };
            return null;
        }

        const audit = {
            objectKind: summon.dataset.objectKind ?? null,
            objectId: summon.dataset.objectId ?? null,
            visible: rect.width > 0 && rect.height > 0,
            canvasWidth: visibleAudit.canvasWidth,
            canvasHeight: visibleAudit.canvasHeight,
            alphaPixels: visibleAudit.alphaPixels,
            brightPixels: visibleAudit.brightPixels,
            sampledCanvasIndex: visibleAudit.sampledCanvasIndex,
            canvasCount: canvases.length,
            ...targetAudit,
        };
        probe.last = audit;
        if (!probe.best || (audit.brightPixels + audit.alphaPixels) > (probe.best.brightPixels + probe.best.alphaPixels)) {
            probe.best = audit;
        }
        const canvasArea = Math.max(1, audit.canvasWidth * audit.canvasHeight);
        const minAlphaPixels = Math.max(900, Math.floor(canvasArea * 0.2));
        const minBrightPixels = Math.max(260, Math.floor(canvasArea * 0.06));
        if (!audit.visible || audit.alphaPixels <= minAlphaPixels || audit.brightPixels <= minBrightPixels) return null;
        return audit;
    }, context ? { zoneId: context.zoneId } : null, { timeout: 5_000 }).catch(async (error: unknown) => {
        const debug = await readSummonFxFailureDebug(page, context);
        const message = error instanceof Error ? error.message : String(error);
        throw new Error([
            'Mage Wars 召唤过程帧未达到可见特效审计门槛',
            message,
            `debug=${JSON.stringify(debug, null, 2)}`,
        ].join('\n'));
    });
    const audit = await handle.jsonValue() as MageWarsSummonFxAudit;
    const canvasArea = Math.max(1, audit.canvasWidth * audit.canvasHeight);
    const minAlphaPixels = Math.max(900, Math.floor(canvasArea * 0.2));
    const minBrightPixels = Math.max(260, Math.floor(canvasArea * 0.06));
    expect(audit.visible).toBe(true);
    expect(audit.alphaPixels).toBeGreaterThan(minAlphaPixels);
    expect(audit.brightPixels).toBeGreaterThan(minBrightPixels);
    if (context?.zoneId) {
        expect(audit.targetZoneId).toBe(context.zoneId);
        expect(audit.targetObjectId).toBe(audit.objectId);
        expect(audit.fxCenterInsideTargetObject).toBe(true);
        expect(audit.targetObjectCenterInsideFx).toBe(true);
        expect(audit.targetObjectOverlapRatio ?? 0).toBeGreaterThanOrEqual(0.82);
        expect(audit.fxMaxTargetObjectRatio ?? 0).toBeGreaterThanOrEqual(1);
        expect(audit.fxMaxTargetObjectRatio ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1.16);
        expect(audit.targetObjectCenterDistancePx ?? Number.POSITIVE_INFINITY).toBeLessThan(34);
    }
    return audit;
}

async function captureMageWarsSummonFxProcessScreenshot(
    page: Page,
    testInfo: TestInfo,
    label: string,
    context?: SummonFxDebugContext,
    captureFrame?: (animations?: EvidenceScreenshotAnimationMode) => Promise<void>,
): Promise<MageWarsSummonFxAudit> {
    const fxAudit = await waitForSummonFxVisualAudit(page, context);
    await expect(page.getByTestId('mage-wars-fx-summon').first()).toBeVisible({ timeout: 5_000 });
    // 过程帧必须在光柱 canvas 达到可见阈值后、光柱主体展开时落盘。
    // 这里只等一个很短的动画窗口；牌面加载检查放在触发前和最终落场后，
    // 避免把过程帧等成最终态。
    await page.waitForTimeout(320);
    await expect(page.getByTestId('mage-wars-fx-summon').first()).toBeVisible({ timeout: 1_000 });
    await captureFrame?.('allow');
    const screenshotPath = await saveEvidenceScreenshot(page, testInfo, `${label}-召唤光柱过程帧`, { animations: 'allow' });

    let targetRegionAudit: ScreenshotRegionVisualAudit | undefined;
    if (context?.beforeScreenshotPath && context.targetRect) {
        const processTargetRect = fxAudit.targetObjectId
            ? await page.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${fxAudit.targetObjectId}"]`).first().boundingBox()
            : context.zoneId
                ? await page.getByTestId(`mage-wars-arena-zone-${context.zoneId}`).boundingBox()
                : context.targetRect;
        if (!processTargetRect) throw new Error(`${label} 召唤过程帧目标对象 ${fxAudit.targetObjectId ?? context.zoneId} 没有可截图矩形，无法做对象区域像素审计`);
        targetRegionAudit = await readScreenshotRegionVisualAudit(
            context.beforeScreenshotPath,
            screenshotPath,
            processTargetRect,
            processTargetRect,
            await readViewport(page),
        );
        const minStrongChangedPixels = Math.max(180, Math.floor(targetRegionAudit.totalPixels * 0.004));
        const minPositiveLumDeltaPixels = Math.max(80, Math.floor(targetRegionAudit.totalPixels * 0.0016));
        expect(targetRegionAudit.strongChangedPixels, `${label} 召唤过程帧目标对象区域没有足够强变化：${JSON.stringify(targetRegionAudit)}`)
            .toBeGreaterThan(minStrongChangedPixels);
        expect(targetRegionAudit.positiveLumDeltaPixels, `${label} 召唤过程帧目标对象区域没有足够亮核变化：${JSON.stringify(targetRegionAudit)}`)
            .toBeGreaterThan(minPositiveLumDeltaPixels);
    }

    return { ...fxAudit, screenshotPath, targetRegionAudit };
}

async function waitForFxSourceImpactAudit(
    page: Page,
    kind: MageWarsFxKind,
    attackRangeKind: 'melee' | 'ranged' = 'ranged',
): Promise<MageWarsFxAudit> {
    const impactTestId = resolveFxImpactTestId(kind, attackRangeKind);
    const handle = await page.waitForFunction(({ fxKind, impactId }) => {
        type ProbeRecord = { checks: number; last: unknown; best: unknown };
        const probeWindow = window as typeof window & { __mageWarsTravelFxAuditProbe?: ProbeRecord };
        const probe = probeWindow.__mageWarsTravelFxAuditProbe ?? { checks: 0, last: null, best: null };
        probe.checks += 1;
        probeWindow.__mageWarsTravelFxAuditProbe = probe;
        const fail = (reason: string, extra: Record<string, unknown> = {}) => {
            probe.last = { reason, ...extra };
            return null;
        };
        const travel = document.querySelector<HTMLElement>(`[data-testid="mage-wars-fx-${fxKind}-travel"]`);
        const sourceWake = document.querySelector<HTMLElement>(`[data-testid="mage-wars-fx-${fxKind}-source-wake"]`);
        const impact = document.querySelector<HTMLElement>(`[data-testid="${impactId}"]`);
        const requiresSourceWake = fxKind === 'push' || fxKind === 'teleport';
        if (!impact || (requiresSourceWake && !sourceWake)) {
            return fail('missing-impact-or-source-wake', {
                impactId,
                hasImpact: Boolean(impact),
                hasSourceWake: Boolean(sourceWake),
                hasTravel: Boolean(travel),
                activeCues: document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-layer"]')?.dataset.fxActiveCues ?? null,
            });
        }
        const escapeAttr = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const anchorId = impact.dataset.targetAnchorId || travel?.dataset.targetAnchorId || null;
        let targetAnchorDistancePx: number | null = null;
        let targetAnchorOverlapRatio: number | null = null;
        let fxMaxTargetAnchorRatio: number | null = null;
        let targetAnchorVisible: boolean | null = null;
        let targetAnchorOpacity: number | null = null;
        if (anchorId) {
            const anchor = document.querySelector<HTMLElement>(
                `[data-testid="mage-wars-zone-field-card"][data-object-id="${escapeAttr(anchorId)}"]`,
            ) ?? document.querySelector<HTMLElement>(
                `[data-testid="mage-wars-zone-mage-entity"][data-player-id="${escapeAttr(anchorId)}"]`,
            );
            if (!anchor) return fail('missing-target-anchor-element', { anchorId });
            const impactRect = impact.getBoundingClientRect();
            const anchorRect = anchor.getBoundingClientRect();
            let effectiveOpacity = 1;
            let current: HTMLElement | null = anchor;
            while (current) {
                const opacity = Number.parseFloat(window.getComputedStyle(current).opacity || '1');
                if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
                current = current.parentElement;
            }
            const anchorStyle = window.getComputedStyle(anchor);
            targetAnchorOpacity = Math.round(effectiveOpacity * 1_000) / 1_000;
            targetAnchorVisible = anchorRect.width > 0
                && anchorRect.height > 0
                && anchorStyle.display !== 'none'
                && anchorStyle.visibility !== 'hidden'
                && effectiveOpacity > 0.55;
            if (!targetAnchorVisible) {
                return fail('target-anchor-not-visible-during-fx', {
                    anchorId,
                    targetAnchorOpacity,
                    display: anchorStyle.display,
                    visibility: anchorStyle.visibility,
                    anchorRect: {
                        x: Math.round(anchorRect.x),
                        y: Math.round(anchorRect.y),
                        width: Math.round(anchorRect.width),
                        height: Math.round(anchorRect.height),
                    },
                });
            }
            if (impactRect.width <= 0 || impactRect.height <= 0 || anchorRect.width <= 0 || anchorRect.height <= 0) {
                return fail('zero-sized-impact-or-anchor', {
                    anchorId,
                    impactRect: {
                        x: Math.round(impactRect.x),
                        y: Math.round(impactRect.y),
                        width: Math.round(impactRect.width),
                        height: Math.round(impactRect.height),
                    },
                    anchorRect: {
                        x: Math.round(anchorRect.x),
                        y: Math.round(anchorRect.y),
                        width: Math.round(anchorRect.width),
                        height: Math.round(anchorRect.height),
                    },
                });
            }
            const impactCenterX = impactRect.left + impactRect.width / 2;
            const impactCenterY = impactRect.top + impactRect.height / 2;
            const anchorCenterX = anchorRect.left + anchorRect.width / 2;
            const anchorCenterY = anchorRect.top + anchorRect.height / 2;
            const overlapWidth = Math.max(0, Math.min(impactRect.right, anchorRect.right) - Math.max(impactRect.left, anchorRect.left));
            const overlapHeight = Math.max(0, Math.min(impactRect.bottom, anchorRect.bottom) - Math.max(impactRect.top, anchorRect.top));
            targetAnchorDistancePx = Math.round(Math.hypot(impactCenterX - anchorCenterX, impactCenterY - anchorCenterY) * 10) / 10;
            targetAnchorOverlapRatio = Math.round(((overlapWidth * overlapHeight) / Math.max(1, anchorRect.width * anchorRect.height)) * 1_000) / 1_000;
            fxMaxTargetAnchorRatio = Math.round(Math.max(
                impactRect.width / Math.max(1, anchorRect.width),
                impactRect.height / Math.max(1, anchorRect.height),
            ) * 1_000) / 1_000;
            if (
                targetAnchorDistancePx > Math.max(anchorRect.width, anchorRect.height) * 0.18
                || targetAnchorOverlapRatio < 0.35
                || fxMaxTargetAnchorRatio > 1.35
            ) {
                return fail('impact-not-anchored-to-target-object', {
                    anchorId,
                    targetAnchorDistancePx,
                    targetAnchorOverlapRatio,
                    fxMaxTargetAnchorRatio,
                    impactRect: {
                        x: Math.round(impactRect.x),
                        y: Math.round(impactRect.y),
                        width: Math.round(impactRect.width),
                        height: Math.round(impactRect.height),
                    },
                    anchorRect: {
                        x: Math.round(anchorRect.x),
                        y: Math.round(anchorRect.y),
                        width: Math.round(anchorRect.width),
                        height: Math.round(anchorRect.height),
                    },
                });
            }
        }
        const audit = {
            sourceRow: travel?.dataset.sourceRow ?? null,
            sourceCol: travel?.dataset.sourceCol ?? null,
            targetRow: travel?.dataset.targetRow ?? null,
            targetCol: travel?.dataset.targetCol ?? null,
            sourceAnchorId: travel?.dataset.sourceAnchorId || sourceWake?.dataset.sourceAnchorId || null,
            targetAnchorId: anchorId,
            targetAnchorVisible,
            targetAnchorOpacity,
            targetAnchorDistancePx,
            targetAnchorOverlapRatio,
            fxMaxTargetAnchorRatio,
            hasSourceWake: Boolean(sourceWake),
            hasImpact: true,
            hasTravel: Boolean(travel),
        };
        probe.best = audit;
        return audit;
    }, { fxKind: kind, impactId: impactTestId }, { timeout: 5_000 }).catch(async (error: unknown) => {
        const debug = await page.evaluate(() => {
            const board = document.querySelector<HTMLElement>('[data-testid="mage-wars-board"]');
            const layer = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-layer"]');
            return {
                probe: (window as typeof window & { __mageWarsTravelFxAuditProbe?: unknown }).__mageWarsTravelFxAuditProbe ?? null,
                board: board ? {
                    phase: board.dataset.mageWarsPhase ?? null,
                    eventCount: board.dataset.mageWarsEventCount ?? null,
                    eventLatestId: board.dataset.mageWarsEventLatestId ?? null,
                    eventCursor: board.dataset.mageWarsEventCursor ?? null,
                    lastConsumedEvents: board.dataset.mageWarsLastConsumedEvents ?? null,
                    lastFxCues: board.dataset.mageWarsLastFxCues ?? null,
                } : null,
                layer: layer ? {
                    activeCount: layer.dataset.fxActiveCount ?? null,
                    activeCues: layer.dataset.fxActiveCues ?? null,
                    childTestIds: Array.from(layer.querySelectorAll<HTMLElement>('[data-testid]'))
                        .slice(0, 20)
                        .map((element) => element.getAttribute('data-testid')),
                } : null,
            };
        }).catch((debugError: unknown) => ({
            error: debugError instanceof Error ? debugError.message : String(debugError),
        }));
        const message = error instanceof Error ? error.message : String(error);
        throw new Error([
            `Mage Wars ${kind} 过程帧未达到目标对象锚点审计门槛`,
            message,
            `debug=${JSON.stringify(debug, null, 2)}`,
        ].join('\n'));
    });
    const audit = await handle.jsonValue() as MageWarsFxAudit;
    if (kind === 'push' || kind === 'teleport') {
        expect(audit.hasSourceWake).toBe(true);
    }
    expect(audit.hasImpact).toBe(true);
    expect(audit.targetAnchorId).toBeTruthy();
    expect(audit.targetAnchorVisible).toBe(true);
    expect(audit.targetAnchorOpacity ?? 0).toBeGreaterThan(0.55);
    expect(audit.targetAnchorDistancePx ?? Number.POSITIVE_INFINITY).toBeLessThan(40);
    expect(audit.targetAnchorOverlapRatio ?? 0).toBeGreaterThanOrEqual(0.35);
    expect(audit.fxMaxTargetAnchorRatio ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1.35);
    return audit;
}

async function waitForFxTravelAudit(page: Page, kind: MageWarsFxKind) {
    const audit = await waitForFxSourceImpactAudit(page, kind);
    expect(audit.hasTravel).toBe(true);
    expect(audit.sourceRow).toMatch(/^\d+$/);
    expect(audit.sourceCol).toMatch(/^\d+$/);
    expect(audit.targetRow).toMatch(/^\d+$/);
    expect(audit.targetCol).toMatch(/^\d+$/);
    expect(`${audit.sourceRow}:${audit.sourceCol}`).not.toBe(`${audit.targetRow}:${audit.targetCol}`);
    return audit;
}

function resolveFxImpactTestId(
    kind: MageWarsFxKind,
    attackRangeKind: 'melee' | 'ranged' = 'ranged',
): string {
    if (kind === 'push') return 'mage-wars-fx-spell-push';
    if (kind === 'teleport') return 'mage-wars-fx-spell-teleport';
    if (kind === 'healing') return 'mage-wars-fx-healing-impact';
    return attackRangeKind === 'melee'
        ? 'mage-wars-fx-attack-melee-impact'
        : 'mage-wars-fx-attack-impact';
}

function resolveFxImpactBurstTestId(kind: MageWarsFxKind): string | null {
    if (kind === 'push') return 'mage-wars-fx-spell-push-burst';
    if (kind === 'teleport') return 'mage-wars-fx-spell-teleport-burst';
    if (kind === 'healing') return 'mage-wars-fx-healing-burst';
    return null;
}

function resolveFxTravelScreenshotSuffix(kind: MageWarsFxKind): string {
    if (kind === 'push') return '气流推离路径中';
    if (kind === 'teleport') return '传送轨迹过程帧';
    return '投射物飞行中';
}

function resolveFxImpactScreenshotSuffix(kind: MageWarsFxKind): string {
    if (kind === 'push') return '命中推离过程帧';
    if (kind === 'teleport') return '目标区域落点过程帧';
    if (kind === 'healing') return '治疗光效和恢复数字过程帧';
    return '命中动画过程帧';
}

function escapeCssAttributeValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function expectMageWarsFxTargetAnchorVisible(
    page: Page,
    audit: MageWarsFxAudit,
    label: string,
) {
    const targetAnchorId = audit.targetAnchorId;
    expect(targetAnchorId, `${label} 必须有目标对象锚点`).toBeTruthy();
    if (!targetAnchorId) return;

    const escapedTargetAnchorId = escapeCssAttributeValue(targetAnchorId);
    const targetAnchor = page.locator(
        `[data-testid="mage-wars-zone-field-card"][data-object-id="${escapedTargetAnchorId}"], [data-testid="mage-wars-zone-mage-entity"][data-player-id="${escapedTargetAnchorId}"]`,
    ).first();
    await expect(targetAnchor, `${label} 目标单位必须在画面中持续可见，不能命中时才出现`).toBeVisible({ timeout: 1_000 });
    const visibility = await targetAnchor.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        let effectiveOpacity = 1;
        let current: HTMLElement | null = element;
        while (current) {
            const opacity = Number.parseFloat(window.getComputedStyle(current).opacity || '1');
            if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
            current = current.parentElement;
        }
        const style = window.getComputedStyle(element);
        return {
            width: rect.width,
            height: rect.height,
            display: style.display,
            visibility: style.visibility,
            opacity: Math.round(effectiveOpacity * 1_000) / 1_000,
        };
    });
    expect(visibility.width, `${label} 目标单位宽度必须大于 0`).toBeGreaterThan(0);
    expect(visibility.height, `${label} 目标单位高度必须大于 0`).toBeGreaterThan(0);
    expect(visibility.display, `${label} 目标单位不能 display:none`).not.toBe('none');
    expect(visibility.visibility, `${label} 目标单位不能 visibility:hidden`).not.toBe('hidden');
    expect(visibility.opacity, `${label} 目标单位不能透明到像隐藏`).toBeGreaterThan(0.55);
}

async function expectMageWarsAttackDiceCenteredOnBoard(
    page: Page,
    audit: MageWarsFxAudit,
    label: string,
) {
    const targetAnchorId = audit.targetAnchorId;
    expect(targetAnchorId, `${label} 必须有目标对象锚点才能检查骰子遮挡`).toBeTruthy();
    if (!targetAnchorId) return;

    await page.waitForFunction(() => {
        if (document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-attack-dice"]')) return true;
        const probe = (window as typeof window & {
            __mageWarsTargetContinuityProbe?: { samples?: Array<Record<string, unknown>> };
        }).__mageWarsTargetContinuityProbe;
        return Boolean(probe?.samples?.some((sample) => sample.diceVisible === true));
    }, undefined, { timeout: 3_000 });

    const overlap = await page.evaluate((anchorId) => {
        const escapeAttr = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const anchor = document.querySelector<HTMLElement>(
            `[data-testid="mage-wars-zone-field-card"][data-object-id="${escapeAttr(anchorId)}"]`,
        ) ?? document.querySelector<HTMLElement>(
            `[data-testid="mage-wars-zone-mage-entity"][data-player-id="${escapeAttr(anchorId)}"]`,
        );
        const dice = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-attack-dice"]');
        const probe = (window as typeof window & {
            __mageWarsTargetContinuityProbe?: { samples?: Array<Record<string, unknown>> };
        }).__mageWarsTargetContinuityProbe;
        const historicalDice = [...(probe?.samples ?? [])]
            .reverse()
            .find((sample) => sample.diceVisible === true);
        if (!anchor || (!dice && !historicalDice)) {
            return {
                hasAnchor: Boolean(anchor),
                hasDice: Boolean(dice || historicalDice),
                viewportCenterDistancePx: Number.POSITIVE_INFINITY,
                targetRect: null,
                diceRect: null,
                dicePlacement: dice?.dataset.placement ?? historicalDice?.dicePlacement ?? null,
                source: dice ? 'live' : historicalDice ? 'probe' : null,
            };
        }

        const anchorRect = anchor.getBoundingClientRect();
        if (!dice && historicalDice) {
            return {
                hasAnchor: true,
                hasDice: true,
                viewportCenterDistancePx: Number(historicalDice.diceCenterDistancePx ?? Number.POSITIVE_INFINITY),
                targetRect: {
                    x: Math.round(anchorRect.x),
                    y: Math.round(anchorRect.y),
                    width: Math.round(anchorRect.width),
                    height: Math.round(anchorRect.height),
                },
                diceRect: historicalDice.diceRect ?? null,
                dicePlacement: historicalDice.dicePlacement ?? null,
                source: 'probe',
            };
        }

        const diceRect = dice!.getBoundingClientRect();
        const diceCenter = {
            x: diceRect.left + diceRect.width / 2,
            y: diceRect.top + diceRect.height / 2,
        };

        return {
            hasAnchor: true,
            hasDice: true,
            viewportCenterDistancePx: Math.round(Math.hypot(
                window.innerWidth / 2 - diceCenter.x,
                window.innerHeight / 2 - diceCenter.y,
            ) * 10) / 10,
            targetRect: {
                x: Math.round(anchorRect.x),
                y: Math.round(anchorRect.y),
                width: Math.round(anchorRect.width),
                height: Math.round(anchorRect.height),
            },
            diceRect: {
                x: Math.round(diceRect.x),
                y: Math.round(diceRect.y),
                width: Math.round(diceRect.width),
                height: Math.round(diceRect.height),
            },
            dicePlacement: dice!.dataset.placement ?? null,
            source: 'live',
        };
    }, targetAnchorId);

    expect(overlap.hasAnchor, `${label} 必须找到目标单位`).toBe(true);
    expect(overlap.hasDice, `${label} 必须找到攻击骰结果层`).toBe(true);
    expect(overlap.dicePlacement, `${label} 攻击骰必须使用页面中心结果层`).toBe('board-center');
    const centerTolerance = Math.max(18, Math.min(await page.evaluate(() => window.innerWidth), await page.evaluate(() => window.innerHeight)) * 0.03);
    expect(overlap.viewportCenterDistancePx, `${label} 攻击骰必须位于页面中心：${JSON.stringify(overlap)}`)
        .toBeLessThanOrEqual(centerTolerance);
}

async function expectMageWarsAttackResultLayerIsolated(page: Page, label: string) {
    await page.waitForFunction(() => {
        if (document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-attack-dice"]')
            ?.dataset.visualRole === 'attack-dice-result') {
            return true;
        }
        const probe = (window as typeof window & {
            __mageWarsTargetContinuityProbe?: { samples?: Array<Record<string, unknown>> };
        }).__mageWarsTargetContinuityProbe;
        return Boolean(probe?.samples?.some((sample) => (
            sample.diceVisible === true && sample.diceRole === 'attack-dice-result'
        )));
    }, undefined, { timeout: 2_000 });
    const report = await page.evaluate(() => {
        const dice = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-attack-dice"]');
        const tokenRails = Array.from(document.querySelectorAll<HTMLElement>(
            '[data-testid="mage-wars-entity-status-token-rail"]',
        ));
        const probe = (window as typeof window & {
            __mageWarsTargetContinuityProbe?: { samples?: Array<Record<string, unknown>> };
        }).__mageWarsTargetContinuityProbe;
        const historicalDice = [...(probe?.samples ?? [])]
            .reverse()
            .find((sample) => sample.diceVisible === true && sample.diceRole === 'attack-dice-result');
        if (!dice && historicalDice) {
            return {
                diceRole: historicalDice.diceRole ?? null,
                tokenKindsInsideDice: Number(historicalDice.tokenKindsInsideDice ?? 0),
                tokenRailCount: Number(historicalDice.tokenRailCount ?? 0),
                tokenRailsOutsideDice: historicalDice.tokenRailsOutsideDice === true,
                tokenRoles: Array.isArray(historicalDice.tokenRoles) ? historicalDice.tokenRoles : [],
                source: 'probe',
            };
        }
        return {
            diceRole: dice?.dataset.visualRole ?? null,
            tokenKindsInsideDice: dice?.querySelectorAll('[data-token-kind]').length ?? 0,
            tokenRailCount: tokenRails.length,
            tokenRailsOutsideDice: tokenRails.every((rail) => !dice?.contains(rail)),
            tokenRoles: tokenRails.map((rail) => rail.dataset.visualRole ?? null),
            source: 'live',
        };
    });

    expect(report.diceRole, `${label} 攻击骰必须使用独立的结果层语义`).toBe('attack-dice-result');
    expect(report.tokenKindsInsideDice, `${label} 就绪 / 守卫 token 不得成为骰子结果层子内容`).toBe(0);
    expect(report.tokenRailsOutsideDice, `${label} 单位状态 token rail 不得挂入攻击骰结果层`).toBe(true);
    expect(
        report.tokenRoles.every((role) => role === 'entity-status-tokens'),
        `${label} 单位状态 token rail 必须保留实体状态语义`,
    ).toBe(true);
}

async function startMageWarsTargetContinuityProbe(
    page: Page,
    targetObjectId: string,
    label: string,
) {
    await page.evaluate(({ objectId, probeLabel }) => {
        type ProbeSample = Record<string, unknown>;
        type ProbeWindow = typeof window & {
            __mageWarsTargetContinuityProbe?: {
                samples: ProbeSample[];
                frameId: number | null;
                stop: () => void;
            };
        };
        const probeWindow = window as ProbeWindow;
        if (probeWindow.__mageWarsTargetContinuityProbe?.frameId != null) {
            cancelAnimationFrame(probeWindow.__mageWarsTargetContinuityProbe.frameId);
        }

        let active = true;
        const samples: ProbeSample[] = [];
        const escapeAttr = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const isVisible = (element: HTMLElement | null) => {
            if (!element) {
                return {
                    visible: false,
                    rect: null,
                    opacity: 0,
                    display: null,
                    visibility: null,
                };
            }
            const rect = element.getBoundingClientRect();
            let effectiveOpacity = 1;
            let current: HTMLElement | null = element;
            while (current) {
                const opacity = Number.parseFloat(window.getComputedStyle(current).opacity || '1');
                if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
                current = current.parentElement;
            }
            const style = window.getComputedStyle(element);
            return {
                visible: rect.width > 0
                    && rect.height > 0
                    && style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && effectiveOpacity > 0.55,
                rect: {
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                },
                opacity: Math.round(effectiveOpacity * 1_000) / 1_000,
                display: style.display,
                visibility: style.visibility,
            };
        };

        const sample = () => {
            const anchor = document.querySelector<HTMLElement>(
                `[data-testid="mage-wars-zone-field-card"][data-object-id="${escapeAttr(objectId)}"]`,
            );
            const dice = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-attack-dice"]');
            const travel = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-attack-travel"]');
            const impact = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-attack-impact"]');
            const damageFloat = document.querySelector<HTMLElement>(
                '[data-testid="mage-wars-fx-attack-damage-float"], [data-testid="mage-wars-fx-direct-damage-float"]',
            );
            const anchorVisibility = isVisible(anchor);
            const diceVisibility = isVisible(dice);
            const travelVisibility = isVisible(travel);
            const impactVisibility = isVisible(impact);
            const damageFloatVisibility = isVisible(damageFloat);
            const diceRect = diceVisibility.rect;
            const diceCenterDistancePx = diceRect
                ? Math.round(Math.hypot(
                    window.innerWidth / 2 - (diceRect.x + diceRect.width / 2),
                    window.innerHeight / 2 - (diceRect.y + diceRect.height / 2),
                ) * 10) / 10
                : null;
            const tokenRails = Array.from(document.querySelectorAll<HTMLElement>(
                '[data-testid="mage-wars-entity-status-token-rail"]',
            ));
            samples.push({
                label: probeLabel,
                timeMs: Math.round(performance.now()),
                hasTargetAnchor: Boolean(anchor),
                targetVisible: anchorVisibility.visible,
                targetRect: anchorVisibility.rect,
                targetOpacity: anchorVisibility.opacity,
                targetDisplay: anchorVisibility.display,
                targetVisibility: anchorVisibility.visibility,
                targetVisualHeld: anchor?.dataset.visualHeld ?? null,
                diceVisible: diceVisibility.visible,
                diceRect,
                diceCenterDistancePx,
                dicePlacement: dice?.dataset.placement ?? null,
                diceRole: dice?.dataset.visualRole ?? null,
                tokenKindsInsideDice: dice?.querySelectorAll('[data-token-kind]').length ?? 0,
                tokenRailCount: tokenRails.length,
                tokenRailsOutsideDice: tokenRails.every((rail) => !dice?.contains(rail)),
                tokenRoles: tokenRails.map((rail) => rail.dataset.visualRole ?? null),
                travelVisible: travelVisibility.visible,
                impactVisible: impactVisibility.visible,
                damageFloatVisible: damageFloatVisibility.visible,
                fxActive: diceVisibility.visible || travelVisibility.visible || impactVisibility.visible || damageFloatVisibility.visible,
            });
            if (active) {
                probeWindow.__mageWarsTargetContinuityProbe!.frameId = requestAnimationFrame(sample);
            }
        };

        probeWindow.__mageWarsTargetContinuityProbe = {
            samples,
            frameId: requestAnimationFrame(sample),
            stop: () => {
                active = false;
                const frameId = probeWindow.__mageWarsTargetContinuityProbe?.frameId;
                if (frameId != null) cancelAnimationFrame(frameId);
                if (probeWindow.__mageWarsTargetContinuityProbe) {
                    probeWindow.__mageWarsTargetContinuityProbe.frameId = null;
                }
            },
        };
    }, { objectId: targetObjectId, probeLabel: label });
}

async function expectMageWarsTargetContinuityProbePassed(
    page: Page,
    label: string,
) {
    const report = await page.evaluate((): MageWarsTargetContinuityProbeReport => {
        type ProbeWindow = typeof window & {
            __mageWarsTargetContinuityProbe?: {
                samples: Array<Record<string, unknown>>;
                frameId: number | null;
                stop: () => void;
            };
        };
        const probeWindow = window as ProbeWindow;
        const probe = probeWindow.__mageWarsTargetContinuityProbe;
        if (!probe) {
            return {
                sampleCount: 0,
                fxSampleCount: 0,
                missingDuringFx: [{ reason: 'missing-probe' }],
                firstFxSample: null,
                lastFxSample: null,
            };
        }
        probe.stop();
        const fxSamples = probe.samples.filter((sample) => sample.fxActive === true);
        return {
            sampleCount: probe.samples.length,
            fxSampleCount: fxSamples.length,
            missingDuringFx: fxSamples.filter((sample) => sample.targetVisible !== true).slice(0, 12),
            firstFxSample: fxSamples[0] ?? null,
            lastFxSample: fxSamples.at(-1) ?? null,
        };
    });

    expect(report.sampleCount, `${label} 目标连续性监视器没有采样：${JSON.stringify(report)}`).toBeGreaterThan(0);
    expect(report.fxSampleCount, `${label} 目标连续性监视器没有覆盖攻击骰 / 投射 / 命中特效帧：${JSON.stringify(report)}`)
        .toBeGreaterThan(0);
    expect(report.missingDuringFx, `${label} 攻击 FX 活跃期间目标单位出现完全消失或不可见：${JSON.stringify(report, null, 2)}`)
        .toEqual([]);
}

async function readAttackDamageFloatDebug(page: Page) {
    return page.evaluate(() => {
        const layer = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-layer"]');
        const impact = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-attack-impact"]');
        const damageHost = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-attack-damage-host"]');
        const floats = Array.from(document.querySelectorAll<HTMLElement>(
            '[data-testid="mage-wars-fx-attack-damage-float"], [data-testid="mage-wars-fx-direct-damage-float"]',
        ));
        const summarize = (element: HTMLElement | null) => {
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            let effectiveOpacity = 1;
            let current: HTMLElement | null = element;
            while (current) {
                const opacity = Number.parseFloat(window.getComputedStyle(current).opacity || '1');
                if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
                current = current.parentElement;
            }
            return {
                text: element.textContent,
                ariaLabel: element.getAttribute('aria-label'),
                damageValue: element.getAttribute('data-damage-value'),
                rect: {
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                },
                opacity: Math.round(effectiveOpacity * 1_000) / 1_000,
                display: window.getComputedStyle(element).display,
                visibility: window.getComputedStyle(element).visibility,
            };
        };
        return {
            layer: layer ? {
                activeCount: layer.dataset.fxActiveCount ?? null,
                activeCues: layer.dataset.fxActiveCues ?? null,
                childTestIds: Array.from(layer.querySelectorAll<HTMLElement>('[data-testid]'))
                    .slice(0, 20)
                    .map((element) => element.getAttribute('data-testid')),
            } : null,
            impact: summarize(impact),
            damageHost: summarize(damageHost),
            floats: floats.map(summarize),
        };
    }).catch((error: unknown) => ({
        error: error instanceof Error ? error.message : String(error),
    }));
}

async function readHealingFloatDebug(page: Page) {
    return page.evaluate(() => {
        const board = document.querySelector<HTMLElement>('[data-testid="mage-wars-board"]');
        const layer = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-layer"]');
        const impact = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-healing-impact"]');
        const number = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-healing-number"]');
        const summarize = (element: HTMLElement | null) => {
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            let effectiveOpacity = 1;
            let current: HTMLElement | null = element;
            while (current) {
                const opacity = Number.parseFloat(window.getComputedStyle(current).opacity || '1');
                if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
                current = current.parentElement;
            }
            return {
                text: element.textContent,
                healingAmount: element.getAttribute('data-healing-amount'),
                rect: {
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                },
                opacity: Math.round(effectiveOpacity * 1_000) / 1_000,
                fontSize: Number.parseFloat(window.getComputedStyle(element).fontSize || '0'),
                display: window.getComputedStyle(element).display,
                visibility: window.getComputedStyle(element).visibility,
            };
        };
        return {
            board: board ? {
                phase: board.dataset.mageWarsPhase ?? null,
                eventCount: board.dataset.mageWarsEventCount ?? null,
                eventLatestId: board.dataset.mageWarsEventLatestId ?? null,
                eventCursor: board.dataset.mageWarsEventCursor ?? null,
                lastConsumedEvents: board.dataset.mageWarsLastConsumedEvents ?? null,
                lastFxCues: board.dataset.mageWarsLastFxCues ?? null,
            } : null,
            layer: layer ? {
                activeCount: layer.dataset.fxActiveCount ?? null,
                activeCues: layer.dataset.fxActiveCues ?? null,
                childTestIds: Array.from(layer.querySelectorAll<HTMLElement>('[data-testid]'))
                    .slice(0, 20)
                    .map((element) => element.getAttribute('data-testid')),
            } : null,
            impact: summarize(impact),
            number: summarize(number),
        };
    }).catch((error: unknown) => ({
        error: error instanceof Error ? error.message : String(error),
    }));
}

async function waitForFxLayerIdle(page: Page, label: string) {
    await page.waitForFunction(() => {
        const layer = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-layer"]');
        if (!layer) return false;
        const activeCount = Number.parseInt(layer.dataset.fxActiveCount ?? '0', 10);
        return Number.isFinite(activeCount) && activeCount === 0;
    }, undefined, { timeout: 5_000 }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const debug = await readHealingFloatDebug(page);
        throw new Error([
            `${label} 前 FX 层未回到空闲状态`,
            message,
            `debug=${JSON.stringify(debug, null, 2)}`,
        ].join('\n'));
    });
}

async function expectHealingFloatVisible(page: Page, label: string) {
    await page.waitForFunction(() => {
        const number = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-healing-number"]');
        if (!number) return false;
        const rect = number.getBoundingClientRect();
        const fontSize = Number.parseFloat(window.getComputedStyle(number).fontSize || '0');
        let effectiveOpacity = 1;
        let current: HTMLElement | null = number;
        while (current) {
            const opacity = Number.parseFloat(window.getComputedStyle(current).opacity || '1');
            if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
            current = current.parentElement;
        }
        return rect.width >= 20
            && rect.height >= 20
            && fontSize >= 24
            && effectiveOpacity > 0.5
            && (number.textContent?.includes('+') ?? false);
    }, undefined, { timeout: 5_000 }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const debug = await readHealingFloatDebug(page);
        throw new Error([
            `${label} 治疗过程帧未捕捉到可见恢复数字`,
            message,
            `debug=${JSON.stringify(debug, null, 2)}`,
        ].join('\n'));
    });
}

async function startMageWarsAttackDamageFloatProbe(page: Page): Promise<void> {
    await page.evaluate(() => {
        type DamageFloatProbe = {
            active: boolean;
            seenVisible: boolean;
            sampleCount: number;
            firstVisibleAt: number | null;
            mountedCount: number;
            firstMountedAt: number | null;
            firstMounted: {
                text: string | null;
                damageValue: string | null;
                rect: { width: number; height: number };
                opacity: number;
                display: string;
                visibility: string;
            } | null;
            lastMounted: {
                text: string | null;
                damageValue: string | null;
                rect: { width: number; height: number };
                opacity: number;
                display: string;
                visibility: string;
            } | null;
            frameId: number | null;
        };
        type ProbeWindow = typeof window & {
            __mageWarsAttackDamageFloatProbe?: DamageFloatProbe;
        };
        const probeWindow = window as ProbeWindow;
        const previous = probeWindow.__mageWarsAttackDamageFloatProbe;
        if (previous?.frameId != null) cancelAnimationFrame(previous.frameId);
        const probe: DamageFloatProbe = {
            active: true,
            seenVisible: false,
            sampleCount: 0,
            firstVisibleAt: null,
            mountedCount: 0,
            firstMountedAt: null,
            firstMounted: null,
            lastMounted: null,
            frameId: null,
        };
        const isVisible = (element: HTMLElement | null) => {
            if (!element) return false;
            const rect = element.getBoundingClientRect();
            let effectiveOpacity = 1;
            let current: HTMLElement | null = element;
            while (current) {
                const opacity = Number.parseFloat(window.getComputedStyle(current).opacity || '1');
                if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
                current = current.parentElement;
            }
            const style = window.getComputedStyle(element);
            return rect.width >= 24
                && rect.height >= 24
                && style.display !== 'none'
                && style.visibility !== 'hidden'
                && effectiveOpacity > 0.25
                && (element.textContent?.includes('-') ?? false);
        };
        const sample = () => {
            if (!probe.active) return;
            probe.sampleCount += 1;
            const float = document.querySelector<HTMLElement>(
                '[data-testid="mage-wars-fx-attack-damage-float"], [data-testid="mage-wars-fx-direct-damage-float"]',
            );
            if (float) {
                const rect = float.getBoundingClientRect();
                let effectiveOpacity = 1;
                let current: HTMLElement | null = float;
                while (current) {
                    const opacity = Number.parseFloat(window.getComputedStyle(current).opacity || '1');
                    if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
                    current = current.parentElement;
                }
                const mounted = {
                    text: float.textContent,
                    damageValue: float.getAttribute('data-damage-value'),
                    rect: {
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                    },
                    opacity: Math.round(effectiveOpacity * 1_000) / 1_000,
                    display: window.getComputedStyle(float).display,
                    visibility: window.getComputedStyle(float).visibility,
                };
                probe.mountedCount += 1;
                probe.firstMountedAt ??= Math.round(performance.now());
                probe.firstMounted ??= mounted;
                probe.lastMounted = mounted;
            }
            if (!probe.seenVisible && isVisible(float)) {
                probe.seenVisible = true;
                probe.firstVisibleAt = Math.round(performance.now());
            }
            probe.frameId = requestAnimationFrame(sample);
        };
        probeWindow.__mageWarsAttackDamageFloatProbe = probe;
        probe.frameId = requestAnimationFrame(sample);
    });
}

async function waitForMageWarsAttackDamageFloat(page: Page): Promise<void> {
    await page.waitForFunction(() => {
        const probe = (window as typeof window & {
            __mageWarsAttackDamageFloatProbe?: { seenVisible?: boolean };
        }).__mageWarsAttackDamageFloatProbe;
        return probe?.seenVisible === true;
    }, undefined, { timeout: 15_000 }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const debug = await page.evaluate(() => ({
            probe: (window as typeof window & {
                __mageWarsAttackDamageFloatProbe?: unknown;
            }).__mageWarsAttackDamageFloatProbe ?? null,
        })).catch(() => null);
        throw new Error([
            'Mage Wars 攻击命中过程帧未捕捉到可见伤害飘字',
            message,
            `probe=${JSON.stringify(debug, null, 2)}`,
            `dom=${JSON.stringify(await readAttackDamageFloatDebug(page), null, 2)}`,
        ].join('\\n'));
    });
}

async function captureMageWarsFxProcessScreenshots(
    page: Page,
    testInfo: TestInfo,
    kind: MageWarsFxKind,
    label: string,
    options: {
        expectTravel?: boolean;
        expectDamageFloat?: boolean;
        startDamageFloatProbe?: boolean;
        expectHealingFloat?: boolean;
        evidenceDir?: string;
        captureFrame?: (animations?: EvidenceScreenshotAnimationMode) => Promise<void>;
    } = {},
): Promise<MageWarsFxAudit> {
    const attackRangeKind = kind === 'attack' && !options.expectTravel ? 'melee' : 'ranged';
    if (options.expectDamageFloat && options.startDamageFloatProbe !== false) {
        await startMageWarsAttackDamageFloatProbe(page);
    }
    const waitForDamageFloat = options.expectDamageFloat
        ? () => waitForMageWarsAttackDamageFloat(page)
        : undefined;
    const damageFloatPromise = waitForDamageFloat?.();
    const healingFloatPromise = options.expectHealingFloat
        ? expectHealingFloatVisible(page, label)
        : undefined;
    const auditPromise = options.expectTravel
        ? waitForFxTravelAudit(page, kind)
        : waitForFxSourceImpactAudit(page, kind, attackRangeKind);
    const [audit] = await Promise.all([
        auditPromise,
        damageFloatPromise ?? Promise.resolve(),
        healingFloatPromise ?? Promise.resolve(),
    ]);

    if (kind === 'push' || kind === 'teleport') {
        await expect(page.getByTestId(`mage-wars-fx-${kind}-source-wake`).first()).toBeVisible({ timeout: 5_000 });
    }
    if (kind === 'attack' && !options.expectTravel && attackRangeKind === 'melee') {
        await expect(page.getByTestId('mage-wars-fx-attack-melee-strike').first()).toBeVisible({ timeout: 5_000 });
    }
    await expect(page.getByTestId(resolveFxImpactTestId(kind, attackRangeKind)).first()).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(80);
    await expectMageWarsFxTargetAnchorVisible(page, audit, `${label}-投射开始`);
    if (options.expectHealingFloat) {
        await page.waitForTimeout(120);
    }
    if (kind === 'attack') {
        await expectMageWarsAttackDiceCenteredOnBoard(page, audit, `${label}-投射开始`);
        await expectMageWarsAttackResultLayerIsolated(page, `${label}-投射开始`);
    }
    if (options.expectTravel) {
        const travel = page.getByTestId(`mage-wars-fx-${kind}-travel`).first();
        const travelObserved = await page.evaluate((fxKind) => {
            if (document.querySelector<HTMLElement>(`[data-testid="mage-wars-fx-${fxKind}-travel"]`)) return true;
            if (fxKind !== 'attack') return false;
            const probe = (window as typeof window & {
                __mageWarsTargetContinuityProbe?: { samples?: Array<Record<string, unknown>> };
            }).__mageWarsTargetContinuityProbe;
            return Boolean(probe?.samples?.some((sample) => sample.travelVisible === true));
        }, kind);
        if (travelObserved) {
            if (await travel.count() > 0) {
                await expect(travel).toBeVisible({ timeout: 5_000 });
            } else {
                expect(kind, `${label} 非攻击投射必须仍有真实投射物节点`).toBe('attack');
            }
        } else {
            await expect(travel).toBeVisible({ timeout: 5_000 });
        }
        if (kind !== 'attack') {
            await expect(page.getByTestId(`mage-wars-fx-${kind}-travel-mid-burst`).first()).toBeVisible({ timeout: 5_000 });
        }
    }
    await options.captureFrame?.('allow');
    await saveEvidenceScreenshot(
        page,
        testInfo,
        options.expectTravel
            ? (kind === 'attack' ? `${label}-来源到目标投射过程帧` : `${label}-来源唤醒过程帧`)
            : options.expectHealingFloat
                ? `${label}-${resolveFxImpactScreenshotSuffix(kind)}`
            : `${label}-来源唤醒和命中过程帧`,
        { animations: 'allow', evidenceDir: options.evidenceDir },
    );

    if (!options.expectTravel) {
        expect(audit.hasTravel).toBe(false);
        if (kind === 'attack') {
            await expectMageWarsAttackDiceCenteredOnBoard(page, audit, `${label}-攻击结果`);
            await expectMageWarsAttackResultLayerIsolated(page, `${label}-攻击结果`);
        }
        if (options.expectHealingFloat) {
            await page.waitForTimeout(120);
            await expectMageWarsFxTargetAnchorVisible(page, audit, `${label}-治疗结果`);
            await options.captureFrame?.('allow');
            await saveEvidenceScreenshot(page, testInfo, `${label}-${resolveFxImpactScreenshotSuffix(kind)}`, {
                animations: 'allow',
                evidenceDir: options.evidenceDir,
            });
        } else if (options.expectDamageFloat) {
            await damageFloatPromise;
            await page.waitForTimeout(120);
            await expectMageWarsFxTargetAnchorVisible(page, audit, `${label}-命中和伤害飘字`);
            await options.captureFrame?.('allow');
            await saveEvidenceScreenshot(page, testInfo, `${label}-命中动画和伤害飘字过程帧`, {
                animations: 'allow',
                evidenceDir: options.evidenceDir,
            });
        } else {
            await options.captureFrame?.('allow');
            await saveEvidenceScreenshot(page, testInfo, `${label}-${resolveFxImpactScreenshotSuffix(kind)}`, {
                animations: 'allow',
                evidenceDir: options.evidenceDir,
            });
        }
        return audit;
    }

    if (options.expectTravel) {
        await page.waitForTimeout(420);
        await expectMageWarsFxTargetAnchorVisible(page, audit, `${label}-投射飞行中`);
        if (kind === 'attack') {
            // 攻击骰是来源/结果层的短暂反馈，不要求它覆盖整个投射飞行窗口。
            // 此处只继续核对目标本体；骰子是否正确出现已在“投射开始”帧验证。
        }
        await options.captureFrame?.('allow');
        await saveEvidenceScreenshot(page, testInfo, `${label}-${resolveFxTravelScreenshotSuffix(kind)}`, {
            animations: 'allow',
            evidenceDir: options.evidenceDir,
        });
    }

    if (options.expectDamageFloat) {
        // 命中阶段可能在过程截图期间完成外层收口；伤害飘字是攻击结果仍在可见呈现的直接证据。
        await damageFloatPromise;
        await page.waitForTimeout(160);
        await expectMageWarsFxTargetAnchorVisible(page, audit, `${label}-命中和伤害飘字`);
        await options.captureFrame?.('allow');
        await saveEvidenceScreenshot(page, testInfo, `${label}-命中动画和伤害飘字过程帧`, {
            animations: 'allow',
            evidenceDir: options.evidenceDir,
        });
    } else {
        if (kind === 'attack') {
            const impactObserved = await page.evaluate(() => {
                if (document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-attack-impact"]')) return true;
                const probe = (window as typeof window & {
                    __mageWarsTargetContinuityProbe?: { samples?: Array<Record<string, unknown>> };
                }).__mageWarsTargetContinuityProbe;
                return Boolean(probe?.samples?.some((sample) => sample.impactVisible === true));
            });
            expect(impactObserved, `${label} 同次运行必须曾观察到远程命中层`).toBe(true);
        } else {
            await expect(page.getByTestId(resolveFxImpactTestId(kind, attackRangeKind)).first()).toBeVisible({ timeout: 5_000 });
        }
        const impactBurstTestId = resolveFxImpactBurstTestId(kind);
        if (impactBurstTestId) {
            await expect(page.getByTestId(impactBurstTestId).first()).toBeVisible({ timeout: 5_000 });
            await page.waitForTimeout(2_250);
        }
        await options.captureFrame?.('allow');
        await saveEvidenceScreenshot(page, testInfo, `${label}-${resolveFxImpactScreenshotSuffix(kind)}`, {
            animations: 'allow',
            evidenceDir: options.evidenceDir,
        });
    }

    return audit;
}

async function selectPreparedSpell(page: Page, preparedCard: Locator, contextLabel: string) {
    let lastError: unknown;
    let lastBeforeHit: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            await expect(preparedCard).toBeVisible({ timeout: 3_000 });
            await expect(preparedCard).toBeEnabled({ timeout: 3_000 });
            await preparedCard.scrollIntoViewIfNeeded({ timeout: 3_000 });
            lastBeforeHit = await readHitTest(preparedCard);
            const fabMenu = page.getByTestId('fab-menu');
            const fabButtons = fabMenu.locator('button');
            if (await fabButtons.count() > 1) {
                throw new Error(`${contextLabel} 选择法术前共享 FAB 仍处于展开态；E2E 应在 setup 中显式隐藏非流程悬浮工具`);
            }
            await preparedCard.click({ timeout: 3_000, noWaitAfter: true });
            await expect(preparedCard).toHaveAttribute('data-selected', 'true', {
                timeout: 3_000,
            });
            return;
        } catch (error) {
            lastError = error;
            // 共享 HUD 的 FAB 可能正处于展开态；先用玩家可执行的 Escape 关闭，再重试卡牌主动作。
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(250);
        }
    }

    const message = lastError instanceof Error ? lastError.message : String(lastError);
    const [afterHit, snapshot] = await Promise.all([
        readHitTest(preparedCard).catch((hitError: unknown) => ({
            error: hitError instanceof Error ? hitError.message : String(hitError),
        })),
        readOnlineBoardSnapshot(page),
    ]);
    throw new Error([
        `${contextLabel} 点击后没有进入选中态`,
        message,
        `beforeHit=${JSON.stringify(lastBeforeHit, null, 2)}`,
        `afterHit=${JSON.stringify(afterHit, null, 2)}`,
        `snapshot=${JSON.stringify(snapshot, null, 2)}`,
    ].join('\n'));
}

async function clickFieldObject(page: Page, fieldObject: Locator, contextLabel: string) {
    await expect(fieldObject).toBeVisible({ timeout: 3_000 }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const snapshot = await readOnlineBoardSnapshot(page);
        throw new Error([
            `${contextLabel} 场上对象不可见`,
            message,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
    await expect(fieldObject).toBeEnabled({ timeout: 3_000 }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const snapshot = await readOnlineBoardSnapshot(page);
        throw new Error([
            `${contextLabel} 场上对象不可点击`,
            message,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });

    const beforeHit = await readHitTest(fieldObject);
    await clickLocatorAtVisibleHitPoint(page, fieldObject, contextLabel).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const [afterHit, snapshot] = await Promise.all([
            readHitTest(fieldObject).catch((hitError: unknown) => ({
                error: hitError instanceof Error ? hitError.message : String(hitError),
            })),
            readOnlineBoardSnapshot(page),
        ]);
        throw new Error([
            `${contextLabel} 点击场上对象失败`,
            message,
            `beforeHit=${JSON.stringify(beforeHit, null, 2)}`,
            `afterHit=${JSON.stringify(afterHit, null, 2)}`,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
}

async function clickMageWarsFieldObjectById(page: Page, objectId: string, contextLabel: string): Promise<void> {
    const probe = await page.evaluate((targetObjectId) => {
        const card = Array.from(
            document.querySelectorAll<HTMLButtonElement>('[data-testid="mage-wars-zone-field-card"]'),
        ).find((candidate) => candidate.dataset.objectId === targetObjectId);
        if (!card) return null;
        const rect = card.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        return {
            x,
            y,
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0
                && rect.height > 0
                && rect.right > 0
                && rect.bottom > 0
                && rect.left < window.innerWidth
                && rect.top < window.innerHeight,
            disabled: card.disabled,
            hitObjectId: hit?.closest<HTMLElement>('[data-testid="mage-wars-zone-field-card"]')?.dataset.objectId ?? null,
        };
    }, objectId);
    expect(probe, `${contextLabel} 未找到可见的场上对象按钮`).not.toBeNull();
    expect(probe?.visible, `${contextLabel} 场上对象按钮不在视口内`).toBe(true);
    expect(probe?.disabled, `${contextLabel} 场上对象按钮不应被禁用`).toBe(false);
    expect(probe?.hitObjectId, `${contextLabel} 点击中心命中对象不一致`).toBe(objectId);
    await page.mouse.click(probe!.x, probe!.y);
}

async function clickMageEntity(page: Page, playerId: '0' | '1', contextLabel: string) {
    const mageEntity = page.locator(`[data-testid="mage-wars-zone-mage-entity"][data-player-id="${playerId}"]`).first();
    await expect(mageEntity).toBeVisible({ timeout: 3_000 }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const snapshot = await readOnlineBoardSnapshot(page);
        throw new Error([
            `${contextLabel} 法师本体不可见`,
            message,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
    const beforeHit = await readHitTest(mageEntity);
    await mageEntity.click({ timeout: 3_000, noWaitAfter: true }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const [afterHit, snapshot] = await Promise.all([
            readHitTest(mageEntity).catch((hitError: unknown) => ({
                error: hitError instanceof Error ? hitError.message : String(hitError),
            })),
            readOnlineBoardSnapshot(page),
        ]);
        throw new Error([
            `${contextLabel} 点击法师本体失败`,
            message,
            `beforeHit=${JSON.stringify(beforeHit, null, 2)}`,
            `afterHit=${JSON.stringify(afterHit, null, 2)}`,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
}

async function clickLegalTargetZone(page: Page, zoneId: string, contextLabel: string) {
    const zone = page.getByTestId(`mage-wars-arena-zone-${zoneId}`);
    await expect(zone).toHaveAttribute('data-legal-target-zone', 'true', {
        timeout: 3_000,
    }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const snapshot = await readOnlineBoardSnapshot(page);
        throw new Error([
            `${contextLabel} 的目标格 ${zoneId} 未被标记为合法目标`,
            message,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
    const beforeHit = await readHitTest(zone);
    await clickLocatorAtVisibleHitPoint(page, zone, `${contextLabel} 目标格 ${zoneId}`).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const afterHit = await readHitTest(zone).catch((hitError: unknown) => ({
            error: hitError instanceof Error ? hitError.message : String(hitError),
        }));
        const snapshot = await readOnlineBoardSnapshot(page);
        throw new Error([
            `${contextLabel} 点击目标格 ${zoneId} 失败`,
            message,
            `beforeHit=${JSON.stringify(beforeHit, null, 2)}`,
            `afterHit=${JSON.stringify(afterHit, null, 2)}`,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
}

async function clickLegalMoveZone(page: Page, zoneId: string, contextLabel: string) {
    const zone = page.getByTestId(`mage-wars-arena-zone-${zoneId}`);
    await expect(zone).toHaveAttribute('data-legal-move-zone', 'true', {
        timeout: 3_000,
    }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const snapshot = await readOnlineBoardSnapshot(page);
        throw new Error([
            `${contextLabel} 的移动格 ${zoneId} 未被标记为合法移动`,
            message,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
    const beforeHit = await readHitTest(zone);
    await clickLocatorAtVisibleHitPoint(page, zone, `${contextLabel} 移动格 ${zoneId}`).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const afterHit = await readHitTest(zone).catch((hitError: unknown) => ({
            error: hitError instanceof Error ? hitError.message : String(hitError),
        }));
        const snapshot = await readOnlineBoardSnapshot(page);
        throw new Error([
            `${contextLabel} 点击移动格 ${zoneId} 失败`,
            message,
            `beforeHit=${JSON.stringify(beforeHit, null, 2)}`,
            `afterHit=${JSON.stringify(afterHit, null, 2)}`,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
}

async function clickTurnEndIfEnabled(page: Page): Promise<boolean> {
    const turnEnd = page.getByTestId('mage-wars-turn-end');
    if (!await turnEnd.isEnabled({ timeout: 200 }).catch(() => false)) return false;
    try {
        await turnEnd.click({ timeout: 1_000, noWaitAfter: true });
        await page.waitForTimeout(120);
        return true;
    } catch {
        if (await turnEnd.isEnabled({ timeout: 200 }).catch(() => false)) {
            return turnEnd.click({ timeout: 1_500, force: true, noWaitAfter: true })
                .then(async () => {
                    await page.waitForTimeout(120);
                    return true;
                })
                .catch(() => false);
        }
        return false;
    }
}

async function clickPlanSpellsIfEnabled(page: Page): Promise<boolean> {
    const planSpells = page.getByTestId('mage-wars-plan-spells');
    if (!await planSpells.isVisible({ timeout: 200 }).catch(() => false)) return false;
    if (!await planSpells.isEnabled({ timeout: 200 }).catch(() => false)) return false;
    try {
        await planSpells.click({ timeout: 1_000, noWaitAfter: true });
        await page.waitForTimeout(120);
        return true;
    } catch {
        if (await planSpells.isEnabled({ timeout: 200 }).catch(() => false)) {
            await planSpells.click({ timeout: 800, force: true, noWaitAfter: true });
            await page.waitForTimeout(120);
            return true;
        }
        return false;
    }
}

async function clickPlanningOrTurnEndIfEnabled(page: Page): Promise<boolean> {
    if (await clickPlanSpellsIfEnabled(page)) return true;
    return clickTurnEndIfEnabled(page);
}

async function openMageWarsFabPanel(page: Page, panelId: string): Promise<void> {
    const panel = page.locator(`[data-testid="fab-panel-${panelId}"]`).first();
    if (await panel.isVisible().catch(() => false)) return;

    const panelButton = page.locator(`[data-fab-id="${panelId}"]`).first();
    if (!(await panelButton.isVisible().catch(() => false))) {
        const mainButton = page.locator('[data-testid="fab-menu"] [data-fab-id]').first();
        await expect(mainButton).toBeVisible({ timeout: 10_000 });
        await mainButton.click();
        await expect(panelButton).toBeVisible({ timeout: 10_000 });
    }

    await panelButton.click();
    await expect(panel).toBeVisible({ timeout: 10_000 });
}

async function closeMageWarsFabPanel(page: Page, panelId: string): Promise<void> {
    const panel = page.locator(`[data-testid="fab-panel-${panelId}"]`).first();
    if (!(await panel.isVisible().catch(() => false))) return;
    await page.locator(`[data-fab-id="${panelId}"]`).first().click();
    await expect(panel).toBeHidden({ timeout: 10_000 });
}

async function advanceUntilPhase(
    match: MageWarsOnlineMatch,
    targetPhase: string,
    contextLabel: string,
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
    captureFrame?: (animations?: EvidenceScreenshotAnimationMode) => Promise<void>,
) {
    const board = match.hostPage.getByTestId('mage-wars-board');
    for (let index = 0; index < 120; index += 1) {
        const [hostPhase, guestPhase] = await Promise.all([
            readPhase(match.hostPage),
            readPhase(match.guestPage),
        ]);
        if (hostPhase === targetPhase && guestPhase === targetPhase) return;

        const phaseActorId = await board.getAttribute('data-mage-wars-phase-actor-id', { timeout: 500 }).catch(() => null);
        const actorPage = phaseActorId === '1' ? match.guestPage : match.hostPage;
        const standbyPage = phaseActorId === '1' ? match.hostPage : match.guestPage;
        const isSimultaneousPhase = SIMULTANEOUS_PHASES.has(hostPhase ?? '');
        const candidates = isSimultaneousPhase
            ? [match.hostPage, match.guestPage]
            : [actorPage, standbyPage];

        let advanced = false;
        for (const page of candidates) {
            if (await clickPlanningOrTurnEndIfEnabled(page)) {
                advanced = true;
                if (!isSimultaneousPhase) break;
            }
        }
        if (!advanced) await match.hostPage.waitForTimeout(250);
    }

    const failureEvidence = await collectFailureEvidence(match.hostPage, {
        match,
        playerId: '0',
        diagnostics,
    });
    throw new Error([
        contextLabel,
        `expectedPhase=${targetPhase}`,
        `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
    ].join('\n'));
}

async function waitForZoneFieldCard(
    page: Page,
    zoneId: string,
    sourceCardId: number,
    contextLabel: string,
    options?: {
        match?: MageWarsOnlineMatch;
        playerId?: '0' | '1';
        diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>;
    },
) {
    let lastSnapshot: Awaited<ReturnType<typeof readOnlineBoardSnapshot>> | null = null;

    await expect.poll(async () => {
        lastSnapshot = await readOnlineBoardSnapshot(page);
        const zone = lastSnapshot.zones.find((candidate) => candidate.zoneId === zoneId);
        return zone?.fieldCards.some((card) => card.sourceCardId === String(sourceCardId)) ?? false;
    }, {
        timeout: 10_000,
        message: `${contextLabel} 应出现在 ${zoneId}`,
    }).toBe(true).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const failureEvidence = await collectFailureEvidence(page, options);
        throw new Error([
            message,
            `${contextLabel} 部署后未在 ${zoneId} 看到 CardID ${sourceCardId}`,
            `snapshot=${JSON.stringify(lastSnapshot, null, 2)}`,
            `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
        ].join('\n'));
    });
}

async function advanceBothPlayersToPlanning(match: MageWarsOnlineMatch) {
    const preparationPhases = new Set(['reset', 'channel', 'upkeep']);
    const diagnostics = [
        { label: 'host', diagnostics: attachPageDiagnostics(match.hostPage) },
        { label: 'guest', diagnostics: attachPageDiagnostics(match.guestPage) },
    ];
    for (let index = 0; index < 24; index += 1) {
        const phases = await Promise.all([
            readPhase(match.hostPage),
            readPhase(match.guestPage),
        ]);
        if (phases.every((phase) => phase === 'planning')) return;

        for (const page of [match.hostPage, match.guestPage]) {
            const phase = await readPhase(page);
            if (!preparationPhases.has(phase ?? '')) continue;
            await clickTurnEndIfEnabled(page);
        }
        await Promise.all([
            match.hostPage.waitForTimeout(120),
            match.guestPage.waitForTimeout(120),
        ]);
    }

    const [hostPhase, guestPhase] = await Promise.all([
        readPhase(match.hostPage),
        readPhase(match.guestPage),
    ]);
    const failureEvidence = await collectFailureEvidence(match.hostPage, {
        match,
        playerId: '0',
        diagnostics,
    });
    throw new Error([
        '正式联机未能从准备阶段推进到计划阶段',
        `expectedPhase=["planning","planning"]`,
        `actualPhase=${JSON.stringify([hostPhase, guestPhase])}`,
        `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
    ].join('\n'));
}

async function setupOnlineMageWars(
    browser: Browser,
    baseURL?: string,
    contextOptions: BrowserContextOptions = {},
    setupData?: Record<string, unknown>,
    options: { preserveFabMenu?: boolean } = {},
): Promise<MageWarsOnlineMatch> {
    const goldenVideoDir = process.env.MAGE_WARS_GOLDEN_VIDEO_DIR?.trim();
    const hostContext = await browser.newContext({
        baseURL,
        ...contextOptions,
        ...(goldenVideoDir
            ? {
                recordVideo: {
                    dir: goldenVideoDir,
                    size: { width: 1600, height: 900 },
                },
            }
            : {}),
    });
    await initContext(hostContext, {
        storageKey: `mage-wars-online-host-${Date.now()}`,
        skipImageGate: false,
        blockCdnAssets: false,
        locale: 'zh-CN',
    });
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    if (!(await ensureGameServerAvailable(hostPage))) {
        throw new Error('Mage Wars 游戏服务器不可用，无法创建正式联机房间');
    }

    const guestId = `mage_wars_online_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const base = getGameServerBaseURL();
    const createResponse = await hostPage.request.post(`${base}/games/mage-wars/create`, {
        data: {
            numPlayers: 2,
            setupData: {
                ...(setupData ?? {}),
                guestId,
                ownerKey: `guest:${guestId}`,
                ownerType: 'guest',
            },
        },
    });
    if (!createResponse.ok()) {
        throw new Error(`Mage Wars 正式房间创建失败：${createResponse.status()}`);
    }
    const createData = await createResponse.json() as { matchID?: string };
    const matchId = createData.matchID;
    if (!matchId) throw new Error('Mage Wars 正式房间未返回 matchID');

    const claimResponse = await hostPage.request.post(`${base}/games/mage-wars/${matchId}/claim-seat`, {
        data: { playerID: '0', playerName: 'MageWars-Host-E2E', guestId },
    });
    if (!claimResponse.ok()) {
        throw new Error(`Mage Wars 房主占座失败：${claimResponse.status()}`);
    }
    const claimData = await claimResponse.json() as { playerCredentials?: string };
    if (!claimData.playerCredentials) throw new Error('Mage Wars 房主占座未返回凭证');
    await seedMatchCredentials(hostContext, 'mage-wars', matchId, '0', claimData.playerCredentials);
    if (!(await waitForMatchAvailable(hostPage, 'mage-wars', matchId, 20_000))) {
        throw new Error(`Mage Wars 正式房间不可查询：${matchId}`);
    }
    await hostPage.goto(`/play/mage-wars/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });

    const guestContext = await browser.newContext({ baseURL, ...contextOptions });
    await initContext(guestContext, {
        storageKey: `mage-wars-online-guest-${Date.now()}`,
        skipImageGate: false,
        blockCdnAssets: false,
        locale: 'zh-CN',
    });
    const guestPage = await guestContext.newPage();
    await guestPage.goto('/', { waitUntil: 'domcontentloaded' });
    const guestCredentials = await joinMatchViaAPI(
        guestPage,
        'mage-wars',
        matchId,
        '1',
        'MageWars-Guest-E2E',
    );
    if (!guestCredentials) throw new Error(`Mage Wars 客户端加入房间失败：${matchId}`);
    await seedMatchCredentials(guestContext, 'mage-wars', matchId, '1', guestCredentials);
    await guestPage.goto(`/play/mage-wars/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });

    await Promise.all([openOnlineBoard(hostPage, '房主'), openOnlineBoard(guestPage, '访客')]);
    if (!options.preserveFabMenu) {
        await Promise.all([disableMageWarsE2eFabMenu(hostPage), disableMageWarsE2eFabMenu(guestPage)]);
    }
    return {
        hostContext,
        guestContext,
        hostPage,
        guestPage,
        matchId,
        hostCredentials: claimData.playerCredentials,
        guestCredentials,
    };
}

async function selectMageWarsCurrentScopeSetupDataViaLocalGate(
    browser: Browser,
    baseURL: string | undefined,
    testInfo: TestInfo,
): Promise<Record<string, unknown>> {
    const context = await browser.newContext({ baseURL });
    await initContext(context, {
        storageKey: `mage-wars-entry-current-scope-${Date.now()}`,
        skipImageGate: false,
        blockCdnAssets: false,
        locale: 'zh-CN',
    });
    const page = await context.newPage();
    const diagnostics = attachPageDiagnostics(page, 'entry-setup-gate');

    try {
        await page.goto('/play/mage-wars?setupGate=true&seed=mage-wars-entry-current-scope-e2e&disableLocalAiAutomation=true', {
            waitUntil: 'domcontentloaded',
        });
        await waitForFrontendAssets(page, 45_000);
        await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

        await expect(page.getByTestId('mage-wars-mage-selection-gate')).toBeVisible({ timeout: 60_000 });
        await expect(page.getByRole('heading', { name: '选择双方法术书' })).toBeVisible();
        await expect(page.getByTestId('mage-wars-mage-selection-standard-spellbook')).toHaveCount(4);
        await expect(page.getByTestId('mage-wars-mage-selection-new-spellbook-entry')).toHaveAttribute('data-saved-spellbook-limit', '10');
        await waitForVisibleImagesLoaded(page, '当前范围入口选书页');
        await saveEvidenceScreenshot(page, testInfo, '01-入口选择页-四本标准书和双方选择目标可见');

        await page.getByTestId('mage-wars-mage-selection-seat-0').click();
        await page.getByTestId('mage-wars-mage-selection-standard-spellbook-beastmaster_apprentice').click();
        await expect(page.getByTestId('mage-wars-mage-selection-summary-0')).toHaveAttribute('data-mage-id', MAGE_IDS.BEASTMASTER_APPRENTICE);
        await expect(page.getByTestId('mage-wars-mage-selection-summary-0')).toContainText('兽王');

        await page.getByTestId('mage-wars-mage-selection-seat-1').click();
        await page.getByTestId('mage-wars-mage-selection-standard-spellbook-priestess_apprentice').click();
        await expect(page.getByTestId('mage-wars-mage-selection-summary-1')).toHaveAttribute('data-mage-id', MAGE_IDS.PRIESTESS_APPRENTICE);
        await expect(page.getByTestId('mage-wars-mage-selection-summary-1')).toContainText('女祭司');
        await waitForVisibleImagesLoaded(page, '当前范围入口双方选中后');
        await saveEvidenceScreenshot(page, testInfo, '02-入口选择页-P1兽王书-P2女祭司书已选中');

        await page.getByTestId('mage-wars-mage-selection-confirm').click();
        await expect(page.getByTestId('mage-wars-board')).toBeVisible({ timeout: 60_000 });
        await expect(page.getByTestId('mage-wars-mage-selection-gate')).toBeHidden({ timeout: 10_000 });
        await expect(page.locator('[data-testid="mage-wars-zone-mage-entity"][data-player-id="0"]'))
            .toHaveAttribute('data-mage-id', MAGE_IDS.BEASTMASTER_APPRENTICE);
        await expect(page.locator('[data-testid="mage-wars-zone-mage-entity"][data-player-id="1"]'))
            .toHaveAttribute('data-mage-id', MAGE_IDS.PRIESTESS_APPRENTICE);
        await waitForVisibleImagesLoaded(page, '当前范围入口确认后牌桌');
        await waitForVisibleMageWarsAtlasCardsLoaded(page, '当前范围入口确认后牌桌');
        await saveEvidenceScreenshot(page, testInfo, '03-入口确认后-牌桌绑定兽王女祭司法术书');

        await waitForTestHarness(page, 10_000);
        const localSetupProbe = await page.evaluate(() => {
            const state = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: { get?: () => unknown };
                };
            }).__BG_TEST_HARNESS__?.state?.get?.() as {
                core?: {
                    playerOrder?: string[];
                    players?: Record<string, {
                        mageId?: string;
                        spellbookCount?: number;
                        spellbookEntries?: Array<{ spellCardId?: number; count?: number }>;
                    }>;
                };
            } | null | undefined;
            const playerOrder = state?.core?.playerOrder ?? [];
            return playerOrder.map((playerId) => {
                const player = state?.core?.players?.[playerId] ?? {};
                return {
                    mageId: player.mageId,
                    playerId,
                    spellbookCount: player.spellbookCount,
                    spellbookEntryCount: player.spellbookEntries?.length ?? 0,
                };
            });
        });
        expect(localSetupProbe).toEqual([
            {
                mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
                playerId: '0',
                spellbookCount: getStandardStartingSpellbookCount(MAGE_IDS.BEASTMASTER_APPRENTICE),
                spellbookEntryCount: getStandardStartingSpellbook(MAGE_IDS.BEASTMASTER_APPRENTICE).length,
            },
            {
                mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                playerId: '1',
                spellbookCount: getStandardStartingSpellbookCount(MAGE_IDS.PRIESTESS_APPRENTICE),
                spellbookEntryCount: getStandardStartingSpellbook(MAGE_IDS.PRIESTESS_APPRENTICE).length,
            },
        ]);
        expect(diagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);

        return buildMageWarsCurrentScopeSetupData();
    } finally {
        await context.close();
    }
}

async function advanceUntilEnabled(page: Page, locator: ReturnType<Page['getByRole']>) {
    const locatorCount = await locator.count().catch(() => 0);
    if (locatorCount === 0) {
        const snapshot = await readOnlineBoardSnapshot(page).catch((error: unknown) => ({
            error: error instanceof Error ? error.message : String(error),
        }));
        throw new Error([
            '等待玩家入口可用前，目标控件不在当前页面 DOM 中',
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    }
    for (let index = 0; index < 16; index += 1) {
        if (await locator.isEnabled().catch(() => false)) return;
        const turnEnd = page.getByTestId('mage-wars-turn-end');
        await expect(turnEnd).toBeVisible();
        if (!await clickPlanningOrTurnEndIfEnabled(page)) await page.waitForTimeout(180);
    }
    await expect(locator).toBeEnabled();
}

async function selectFirstVisibleSpellbookCard(page: Page): Promise<string> {
    for (let index = 0; index < MAGE_WARS_SPELLBOOK_PAGE_SCAN_LIMIT; index += 1) {
        const cards = page.getByTestId('mage-wars-desktop-spellbook-card');
        const count = await cards.count();
        for (let cardIndex = 0; cardIndex < count; cardIndex += 1) {
            const card = cards.nth(cardIndex);
            if (await card.isVisible().catch(() => false) && await card.isEnabled().catch(() => false)) {
                const name = await card.getAttribute('aria-label');
                if (!name) continue;
                if (await card.getAttribute('data-spell-type') !== '生物') continue;
                await card.click({ timeout: 3_000, noWaitAfter: true });
                return name;
            }
        }
        const nextPage = page.getByRole('button', { name: '下一页', exact: true });
        if (await nextPage.isDisabled().catch(() => true)) break;
        await nextPage.click({ timeout: 3_000, noWaitAfter: true });
    }
    throw new Error(`正式联机法术书在 ${MAGE_WARS_SPELLBOOK_PAGE_SCAN_LIMIT} 页扫描内没有可选的生物卡牌`);
}

async function selectNamedSpellbookCard(page: Page, name: string) {
    const allFilter = page.getByRole('button', { name: '全部', exact: true });
    if (await allFilter.isEnabled({ timeout: 500 }).catch(() => false)) {
        await allFilter.click({ timeout: 3_000, noWaitAfter: true });
    } else {
        await expect(allFilter).toHaveAttribute('aria-pressed', 'true', { timeout: 3_000 });
    }
    const previousPage = page.getByRole('button', { name: '上一页', exact: true });
    for (let index = 0; index < MAGE_WARS_SPELLBOOK_PAGE_SCAN_LIMIT; index += 1) {
        if (await previousPage.isDisabled().catch(() => true)) break;
        await previousPage.click({ timeout: 3_000, noWaitAfter: true });
    }
    await expect(previousPage).toBeDisabled({ timeout: 3_000 });

    const seenPages: string[][] = [];
    for (let index = 0; index < MAGE_WARS_SPELLBOOK_PAGE_SCAN_LIMIT; index += 1) {
        const visibleNames = await page.getByTestId('mage-wars-desktop-spellbook-card').evaluateAll((cards) => (
            cards
                .filter((card) => {
                    const rect = card.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                })
                .map((card) => card.getAttribute('aria-label') ?? '')
                .filter(Boolean)
        ));
        seenPages.push(visibleNames);
        const card = page.locator(`[data-testid="mage-wars-desktop-spellbook-card"][aria-label="${name}"]`).first();
        if (await card.isVisible().catch(() => false) && await card.isEnabled().catch(() => false)) {
            await card.click({ timeout: 3_000, noWaitAfter: true });
            return;
        }

        const nextPage = page.getByRole('button', { name: '下一页', exact: true });
        if (await nextPage.isDisabled().catch(() => true)) break;
        await nextPage.click({ timeout: 3_000, noWaitAfter: true });
    }
    throw new Error(`正式联机法术书中没有找到卡牌：${name}；已查看页面：${seenPages.map((names, pageIndex) => `第${pageIndex + 1}页=${names.join('、') || '空'}`).join('；')}`);
}

async function selectNamedSpellbookCards(page: Page, names: string[]) {
    for (const name of names) {
        await selectNamedSpellbookCard(page, name);
    }
}

async function planNamedSpells(page: Page, names: string[]) {
    await selectNamedSpellbookCards(page, names);
    await expect(page.getByTestId('mage-wars-plan-spells')).toHaveText(`确认计划 ${names.length}/2`);
    await expect(page.getByTestId('mage-wars-plan-spells')).toHaveAttribute('data-plan-progress', `${names.length}/2`);
    await page.getByTestId('mage-wars-plan-spells').click({ timeout: 3_000, noWaitAfter: true });
}

async function respondMageWarsInteractionOption(
    page: Page,
    optionId: string,
    label: string,
    beforeRespond?: () => Promise<void>,
) {
    const responseDock = page.getByTestId('mage-wars-interaction-dock');
    await expect(responseDock, `${label} 应显示玩家响应窗口`).toBeVisible({ timeout: 5_000 });
    const option = responseDock
        .locator(`[data-testid="mage-wars-interaction-option"][data-option-id="${optionId}"]`)
        .first();
    await expect(option, `${label} 应显示 ${optionId} 选项`).toBeVisible({ timeout: 3_000 });
    if (beforeRespond) await beforeRespond();
    await option.click({ timeout: 3_000, noWaitAfter: true });
    await expect(responseDock, `${label} 选择 ${optionId} 后响应窗口应收口`).toHaveCount(0, { timeout: 5_000 });
}

function selfPreparedCardByName(page: Page, name: string): Locator {
    return page.locator(`${SELF_PREPARED_CARD_SELECTOR}[aria-label="${name}"]`).first();
}

function hasSpellAttackRolledEvent(
    snapshot: JsonRecord,
    spellCardId: number,
    targetObjectId: string,
): boolean {
    const eventStream = Array.isArray(snapshot.eventStream) ? snapshot.eventStream : [];
    return eventStream.some((entry) => {
        if (!isRecord(entry) || entry.type !== 'MW_SPELL_ATTACK_ROLLED') return false;
        const payload = isRecord(entry.payload) ? entry.payload : {};
        return payload.spellCardId === spellCardId
            && payload.targetObjectId === targetObjectId
            && Array.isArray(payload.diceResults);
    });
}

function hasEvent(
    snapshot: JsonRecord,
    type: string,
    matcher?: (payload: JsonRecord) => boolean,
): boolean {
    const eventStream = Array.isArray(snapshot.eventStream) ? snapshot.eventStream : [];
    return eventStream.some((entry) => {
        if (!isRecord(entry) || entry.type !== type) return false;
        const payload = isRecord(entry.payload) ? entry.payload : {};
        return matcher ? matcher(payload) : true;
    });
}

function hasArenaObjectAbilityResolvedEvent(
    snapshot: JsonRecord,
    abilityId: string,
    targetObjectId: string,
): boolean {
    return hasEvent(snapshot, 'MW_ARENA_OBJECT_ABILITY_RESOLVED', (payload) => (
        payload.abilityId === abilityId && payload.targetObjectId === targetObjectId
    ));
}

function hasMageAbilityResolvedEvent(
    snapshot: JsonRecord,
    abilityId: string,
    targetObjectId: string,
): boolean {
    return hasEvent(snapshot, 'MW_MAGE_ABILITY_RESOLVED', (payload) => (
        payload.abilityId === abilityId && payload.targetObjectId === targetObjectId
    ));
}

function hasStatusTokenRemovedEvent(
    snapshot: JsonRecord,
    statusTokenId: string,
    targetObjectId: string,
): boolean {
    return hasEvent(snapshot, 'MW_STATUS_TOKEN_REMOVED', (payload) => (
        payload.statusTokenId === statusTokenId && payload.targetObjectId === targetObjectId
    ));
}

function hasDamageDealtEvent(
    snapshot: JsonRecord,
    targetId: string,
    sourceAbilityId?: string,
): boolean {
    return hasEvent(snapshot, 'DAMAGE_DEALT', (payload) => (
        payload.targetId === targetId
        && (sourceAbilityId === undefined || payload.sourceAbilityId === sourceAbilityId)
        && typeof payload.actualDamage === 'number'
        && payload.actualDamage > 0
    ));
}

function hasWallSnapshot(
    snapshot: JsonRecord,
    edgeId: string,
    sourceSpellCardId: number,
): boolean {
    const walls = isRecord(snapshot.walls) ? snapshot.walls : {};
    const wall = isRecord(walls[edgeId]) ? walls[edgeId] : {};
    return wall.edgeId === edgeId
        && wall.sourceSpellCardId === sourceSpellCardId
        && wall.blocksLineOfSight === true;
}

function hasWallSummonedEvent(
    snapshot: JsonRecord,
    edgeId: string,
    sourceSpellCardId: number,
): boolean {
    return hasEvent(snapshot, 'MW_WALL_SUMMONED', (payload) => {
        const wall = isRecord(payload.wall) ? payload.wall : {};
        return wall.edgeId === edgeId && wall.sourceSpellCardId === sourceSpellCardId;
    });
}

function hasWallPassageDamageTriggeredEvent(
    snapshot: JsonRecord,
    edgeId: string,
    objectId: string,
): boolean {
    return hasEvent(snapshot, 'MW_WALL_PASSAGE_DAMAGE_TRIGGERED', (payload) => (
        payload.edgeId === edgeId
        && payload.objectId === objectId
        && typeof payload.amount === 'number'
        && payload.amount > 0
    ));
}

function hasArenaObjectSnapshot(
    snapshot: JsonRecord,
    options: {
        sourceSpellCardId: number;
        kind: string;
        ownerId?: '0' | '1';
        anchoredToObjectId?: string;
        anchoredToPlayerId?: '0' | '1';
        anchoredToZoneId?: string;
        revealed?: boolean;
        restrainedByObjectId?: string;
    },
): boolean {
    const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
    return Object.values(objects).some((candidate) => {
        if (!isRecord(candidate)) return false;
        return candidate.sourceSpellCardId === options.sourceSpellCardId
            && candidate.kind === options.kind
            && (options.ownerId === undefined || candidate.ownerId === options.ownerId)
            && (options.anchoredToObjectId === undefined || candidate.anchoredToObjectId === options.anchoredToObjectId)
            && (options.anchoredToPlayerId === undefined || candidate.anchoredToPlayerId === options.anchoredToPlayerId)
            && (options.anchoredToZoneId === undefined || candidate.anchoredToZoneId === options.anchoredToZoneId)
            && (options.revealed === undefined || candidate.revealed === options.revealed)
            && (options.restrainedByObjectId === undefined || candidate.restrainedByObjectId === options.restrainedByObjectId);
    });
}

async function expectServerObject(
    page: Page,
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
    options: Parameters<typeof hasArenaObjectSnapshot>[1],
    message: string,
) {
    try {
        await expect.poll(async () => (
            hasArenaObjectSnapshot(await readServerCoreSnapshot(page, match, playerId), options)
        ), {
            message,
            timeout: 5_000,
        }).toBe(true);
    } catch (error) {
        const [serverSnapshot, boardSnapshot, toastMessages] = await Promise.all([
            readServerCoreSnapshot(page, match, playerId),
            readOnlineBoardSnapshot(page),
            readVisibleToastMessages(page),
        ]);
        throw new Error([
            message,
            `expected=${JSON.stringify(options)}`,
            `serverSnapshot=${JSON.stringify(serverSnapshot, null, 2)}`,
            `boardSnapshot=${JSON.stringify(boardSnapshot, null, 2)}`,
            `toastMessages=${JSON.stringify(toastMessages)}`,
            error instanceof Error ? error.message : String(error),
        ].join('\n'));
    }
}

async function expectServerObjectGuarding(
    page: Page,
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
    objectId: string,
    expected: boolean,
    message: string,
) {
    await expect.poll(async () => {
        const snapshot = await readServerCoreSnapshot(page, match, playerId);
        const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
        const object = isRecord(objects[objectId]) ? objects[objectId] : {};
        return object.guarding;
    }, {
        message,
        timeout: 5_000,
    }).toBe(expected);
}

async function expectServerObjectDamageLessThan(
    page: Page,
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
    objectId: string,
    beforeDamage: number,
    message: string,
) {
    await expect.poll(async () => {
        const snapshot = await readServerCoreSnapshot(page, match, playerId);
        const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
        const object = isRecord(objects[objectId]) ? objects[objectId] : {};
        return typeof object.damage === 'number' ? object.damage : Number.POSITIVE_INFINITY;
    }, {
        message,
        timeout: 5_000,
    }).toBeLessThan(beforeDamage);
}

async function expectServerObjectDamageGreaterThan(
    page: Page,
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
    objectId: string,
    beforeDamage: number,
    message: string,
) {
    await expect.poll(async () => {
        const snapshot = await readServerCoreSnapshot(page, match, playerId);
        const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
        const object = isRecord(objects[objectId]) ? objects[objectId] : {};
        return typeof object.damage === 'number' ? object.damage : Number.NEGATIVE_INFINITY;
    }, {
        message,
        timeout: 5_000,
    }).toBeGreaterThan(beforeDamage);
}

async function readServerObjectDamage(
    page: Page,
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
    objectId: string,
    message: string,
): Promise<number> {
    await expect.poll(async () => {
        const snapshot = await readServerCoreSnapshot(page, match, playerId);
        const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
        const object = isRecord(objects[objectId]) ? objects[objectId] : {};
        return typeof object.damage === 'number' ? object.damage : undefined;
    }, {
        message,
        timeout: 5_000,
    }).not.toBeUndefined();
    const snapshot = await readServerCoreSnapshot(page, match, playerId);
    const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
    const object = isRecord(objects[objectId]) ? objects[objectId] : {};
    const damage = typeof object.damage === 'number' ? object.damage : Number.NaN;
    if (!Number.isFinite(damage)) throw new Error(`${message}：未能读取有效伤害值`);
    return damage;
}

async function expectServerObjectStatusMissing(
    page: Page,
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
    objectId: string,
    statusTokenId: string,
    message: string,
) {
    await expect.poll(async () => {
        const snapshot = await readServerCoreSnapshot(page, match, playerId);
        const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
        const object = isRecord(objects[objectId]) ? objects[objectId] : {};
        const statusTokens = isRecord(object.statusTokens) ? object.statusTokens : {};
        return statusTokens[statusTokenId] ?? 0;
    }, {
        message,
        timeout: 5_000,
    }).toBe(0);
}

async function expectServerObjectMissing(
    page: Page,
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
    objectId: string,
    message: string,
) {
    await expect.poll(async () => {
        const snapshot = await readServerCoreSnapshot(page, match, playerId);
        const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
        return objects[objectId];
    }, {
        message,
        timeout: 5_000,
    }).toBeUndefined();
}

async function expectServerGameover(
    page: Page,
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
    winnerId: string,
    message: string,
) {
    await expect.poll(async () => {
        const snapshot = await readServerCoreSnapshot(page, match, playerId);
        const sys = isRecord(snapshot.sys) ? snapshot.sys : {};
        const core = isRecord(snapshot.core) ? snapshot.core : {};
        const sysGameover = isRecord(sys.gameover) ? sys.gameover : {};
        const coreGameResult = isRecord(core.gameResult) ? core.gameResult : {};
        return sysGameover.winner ?? coreGameResult.winner;
    }, {
        message,
        timeout: 5_000,
    }).toBe(winnerId);
}

function createMageWarsE2eCreatureObject(
    id: string,
    ownerId: '0' | '1',
    sourceSpellCardId: number,
    name: string,
    zoneId: ArenaZoneId,
): MageWarsArenaObjectState {
    return {
        id,
        kind: 'creature',
        ownerId,
        sourceSpellCardId,
        sourceObjectId: `spell-${sourceSpellCardId}`,
        combatProfilesSource: 'config',
        combatTraitsSource: 'config',
        name,
        zoneId,
        life: 5,
        damage: 0,
        armor: 0,
        actionReady: true,
        guarding: false,
        summonedTurnNumber: 1,
        statusTokens: {},
        typeLine: '生物',
        schoolLine: '自然',
        attackOrTraitLine: '',
        rulesText: '',
    };
}

function createMageWarsE2eHiddenResponseEnchantmentObject(
    id: string,
    ownerId: '0' | '1',
    sourceSpellCardId: 1901,
    name: string,
    zoneId: ArenaZoneId,
    anchoredToObjectId: string,
): MageWarsArenaObjectState {
    return {
        id,
        kind: 'enchantment',
        ownerId,
        sourceSpellCardId,
        sourceObjectId: `spell-${sourceSpellCardId}`,
        name,
        zoneId,
        life: 1,
        damage: 0,
        armor: 0,
        actionReady: false,
        guarding: false,
        statusTokens: {},
        typeLine: '结界 / 超魔',
        schoolLine: '超魔',
        attackOrTraitLine: '',
        rulesText: '当本生物成为对手控制的咒语或结界类法术的目标时，你必须在法术反制步骤中展示法力失效。',
        revealed: false,
        anchoredToObjectId,
    };
}

function createMageWarsE2eEquipmentObject(
    id: string,
    ownerId: '0' | '1',
    sourceSpellCardId: number,
    name: string,
    zoneId: ArenaZoneId,
    anchoredToPlayerId: '0' | '1',
): MageWarsArenaObjectState {
    return {
        id,
        kind: 'equipment',
        ownerId,
        sourceSpellCardId,
        sourceObjectId: `spell-${sourceSpellCardId}`,
        combatProfilesSource: 'config',
        combatTraitsSource: 'config',
        name,
        zoneId,
        life: 1,
        damage: 0,
        armor: 0,
        actionReady: false,
        guarding: false,
        statusTokens: {},
        typeLine: '装备 / 武器',
        schoolLine: '自然',
        attackOrTraitLine: sourceSpellCardId === 3710 ? '蛮力一击：快速近战 4 骰' : '',
        rulesText: '',
        anchoredToPlayerId,
    };
}

function rebuildMageWarsE2eArenaOccupancy(core: MageWarsCore): MageWarsCore {
    const objects = Object.values(core.objects);
    return {
        ...core,
        arena: core.arena.map((zone) => ({
            ...zone,
            occupantIds: core.playerOrder.filter((playerId) => core.players[playerId]?.mageZoneId === zone.id),
            objectIds: objects
                .filter((object) => object.zoneId === zone.id)
                .map((object) => object.id),
            conjurationIds: objects
                .filter((object) => object.zoneId === zone.id && object.kind === 'conjuration')
                .map((object) => object.id),
        })),
    };
}

function addMageWarsE2eArenaObject(core: MageWarsCore, object: MageWarsArenaObjectState): MageWarsCore {
    return {
        ...core,
        objects: {
            ...core.objects,
            [object.id]: object,
        },
        arena: core.arena.map((zone) => ({
            ...zone,
            objectIds: zone.id === object.zoneId
                ? [...new Set([...zone.objectIds.filter((candidate) => candidate !== object.id), object.id])]
                : zone.objectIds.filter((candidate) => candidate !== object.id),
            conjurationIds: zone.conjurationIds.filter((candidate) => candidate !== object.id),
        })),
    };
}

type MageWarsE2ePlayerPatch = Partial<Omit<MageWarsPlayerState, 'id'>>;

async function injectMageWarsCurrentScopeCoverageReadyState(
    match: MageWarsOnlineMatch,
    actorId: '0' | '1',
    options: {
        phase?: MageWarsPhase;
        playerPatches?: Partial<Record<'0' | '1', MageWarsE2ePlayerPatch>>;
        objects?: MageWarsArenaObjectState[];
        objectPatches?: Record<string, Partial<MageWarsArenaObjectState>>;
        replaceObjects?: boolean;
    } = {},
) {
    const page = actorId === '0' ? match.hostPage : match.guestPage;
    const liveState = await getMatchState(match.matchId, page) as { core: MageWarsCore; sys: JsonRecord };
    const turnOrder = liveState.core.playerOrder.length > 0 ? liveState.core.playerOrder : ['0', '1'];
    const currentPlayerIndex = Math.max(0, turnOrder.indexOf(actorId));
    const playerPatches = options.playerPatches ?? {};
    const players = Object.fromEntries(Object.entries(liveState.core.players).map(([playerId, player]) => [
        playerId,
        {
            ...player,
            actionReady: true,
            quickcastReady: true,
            guarding: false,
            statusTokens: { ...player.statusTokens },
            ...(playerPatches[playerId as '0' | '1'] ?? {}),
        },
    ])) as Record<string, MageWarsPlayerState>;

    const objects: Record<string, MageWarsArenaObjectState> = options.replaceObjects
        ? {}
        : { ...liveState.core.objects };
    for (const object of options.objects ?? []) {
        objects[object.id] = object;
    }
    for (const [objectId, patch] of Object.entries(options.objectPatches ?? {})) {
        const existing = objects[objectId];
        if (!existing) {
            throw new Error(`当前范围候选链代表态缺少场上对象，无法打补丁：${objectId}`);
        }
        objects[objectId] = { ...existing, ...patch };
    }

    const nextCore = rebuildMageWarsE2eArenaOccupancy({
        ...liveState.core,
        currentPlayerId: actorId,
        phaseActorId: actorId,
        phaseReadyPlayerIds: [],
        players,
        objects,
        gameResult: undefined,
    } as MageWarsCore);
    const { gameover: _gameover, ...sysWithoutGameover } = liveState.sys;

    await injectMatchState(match.matchId, {
        ...liveState,
        core: nextCore,
        sys: {
            ...sysWithoutGameover,
            matchId: match.matchId,
            decisionEpoch: typeof sysWithoutGameover.decisionEpoch === 'number'
                ? sysWithoutGameover.decisionEpoch + 1
                : 1,
            interaction: {
                current: undefined,
                queue: [],
                isBlocked: false,
            },
            responseWindow: {
                current: undefined,
            },
            resolution: undefined,
            flowHalted: false,
            turnOrder,
            currentPlayerIndex,
            phase: options.phase ?? 'creatureAction',
        },
    } as Parameters<typeof injectMatchState>[1], page);

    for (const boardPage of [match.hostPage, match.guestPage]) {
        const board = boardPage.getByTestId('mage-wars-board');
        await expect(board).toHaveAttribute('data-mage-wars-phase', options.phase ?? 'creatureAction', { timeout: 5_000 });
        await expect(board).toHaveAttribute('data-mage-wars-phase-actor-id', actorId, { timeout: 5_000 });
    }
}

async function injectMageWarsSpellFxReadyState(
    match: MageWarsOnlineMatch,
    actorId: '0' | '1',
    options: {
        mageId: MageId;
        preparedSpellCardId: number;
        targetObject: MageWarsArenaObjectState;
        mana?: number;
    },
) {
    const page = actorId === '0' ? match.hostPage : match.guestPage;
    const liveState = await getMatchState(match.matchId, page) as { core: MageWarsCore; sys: JsonRecord };
    const actor = liveState.core.players[actorId];
    const turnOrder = liveState.core.playerOrder.length > 0 ? liveState.core.playerOrder : ['0', '1'];
    const currentPlayerIndex = Math.max(0, turnOrder.indexOf(actorId));
    const nextCore = addMageWarsE2eArenaObject({
        ...liveState.core,
        currentPlayerId: actorId,
        phaseActorId: actorId,
        phaseReadyPlayerIds: [],
        players: {
            ...liveState.core.players,
            [actorId]: {
                ...actor,
                mageId: options.mageId,
                spellbookEntries: getMageWarsE2eStandardSpellbookEntries(options.mageId),
                spellbookCount: getStandardStartingSpellbookCount(options.mageId),
                mana: options.mana ?? 12,
                actionReady: true,
                quickcastReady: true,
                preparedSpellSlots: 1,
                preparedSpellCardIds: [options.preparedSpellCardId],
            },
        },
    }, options.targetObject);

    await injectMatchState(match.matchId, {
        ...liveState,
        core: nextCore,
        sys: {
            ...liveState.sys,
            matchId: match.matchId,
            turnOrder,
            currentPlayerIndex,
            phase: 'initiativeQuickcast',
        },
    } as Parameters<typeof injectMatchState>[1], page);

    const board = page.getByTestId('mage-wars-board');
    await expect(board).toHaveAttribute('data-mage-wars-phase', 'initiativeQuickcast', { timeout: 5_000 });
    await expect(board).toHaveAttribute('data-mage-wars-phase-actor-id', actorId, { timeout: 5_000 });
    await expect(page.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${options.targetObject.id}"]`).first())
        .toBeVisible({ timeout: 5_000 });
}

type MageWarsStaffBindingUiCase = {
    cardId: 3716 | 3725;
    cardName: '元素魔杖' | '法师魔杖';
    mageId: MageId;
    abilityId: string;
    initialBoundSpellCardId: number;
    castBoundSpellCardId: number;
    reboundBoundSpellCardId: number;
};

async function runMageWarsStaffBindingUiCase(
    browser: Browser,
    baseURL: string | undefined,
    testInfo: TestInfo,
    options: MageWarsStaffBindingUiCase,
) {
    const evidenceRun = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const match = await setupOnlineMageWars(browser, baseURL);
    const hostDiagnostics = attachPageDiagnostics(match.hostPage, 'host');
    const guestDiagnostics = attachPageDiagnostics(match.guestPage, 'guest');
    const setupPlayer = (mana: number, preparedSpellCardIds: number[] = []): MageWarsE2ePlayerPatch => ({
        mageId: options.mageId,
        spellbookEntries: getMageWarsE2eStandardSpellbookEntries(options.mageId),
        spellbookCount: getStandardStartingSpellbookCount(options.mageId),
        mana,
        actionReady: true,
        quickcastReady: true,
        preparedSpellSlots: preparedSpellCardIds.length,
        preparedSpellCardIds,
        discardSpellCardIds: [],
    });
    const staffObjectId = `mw-e2e-${options.cardId}-staff`;
    const staffName = options.cardName;
    const boundSpellName = options.cardId === 3716 ? '火球' : '复原术';

    try {
        await injectMageWarsCurrentScopeCoverageReadyState(match, '0', {
            phase: 'initiativeQuickcast',
            replaceObjects: true,
            playerPatches: {
                '0': setupPlayer(12, [options.cardId]),
                '1': {
                    mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                    mageZoneId: ARENA_ZONE_IDS.D3,
                    preparedSpellCardIds: [],
                    preparedSpellSlots: 0,
                },
            },
        });

        const preparedCard = selfPreparedCardByName(match.hostPage, staffName);
        await selectPreparedSpell(match.hostPage, preparedCard, `${staffName}施放入口`);
        await expect(match.hostPage.locator(
            '[data-testid="mage-wars-zone-mage-entity"][data-player-id="0"]',
        ).first()).toHaveAttribute('role', 'button', { timeout: 3_000 });
        await saveEvidenceScreenshot(
            match.hostPage,
            testInfo,
            `01-${staffName}-施放前-准备区卡牌与己方法师合法目标`,
            { evidenceDir: evidenceRun.stagingDir },
        );

        await clickMageEntity(match.hostPage, '0', `${staffName}施放选择己方法师`);
        const spellCastChoiceDock = match.hostPage.getByTestId('mage-wars-spell-cast-choice-dock');
        await expect(spellCastChoiceDock).toBeVisible({ timeout: 3_000 });
        const castOption = spellCastChoiceDock.locator(
            `[data-testid="mage-wars-spell-cast-choice-option"][data-bound-spell-card-id="${options.castBoundSpellCardId}"]`,
        ).first();
        await expect(castOption).toBeVisible({ timeout: 3_000 });
        expect(
            await spellCastChoiceDock.getByTestId('mage-wars-spell-cast-choice-option').count(),
            `${staffName}真实标准法术书必须至少提供不绑定和一个绑定候选`,
        ).toBeGreaterThanOrEqual(2);
        await saveEvidenceScreenshot(
            match.hostPage,
            testInfo,
            `02-${staffName}-绑定选择-法师魔杖选择${boundSpellName}`,
            { evidenceDir: evidenceRun.stagingDir },
        );

        await castOption.click({ timeout: 3_000, noWaitAfter: true });
        await expect(spellCastChoiceDock).toHaveCount(0, { timeout: 5_000 });
        await expect.poll(async () => {
            const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
            const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
            const staff = Object.values(objects).find((candidate) => (
                isRecord(candidate)
                && candidate.sourceSpellCardId === options.cardId
                && candidate.anchoredToPlayerId === '0'
            ));
            return isRecord(staff) ? staff.boundSpellCardId : undefined;
        }, {
            message: `${staffName}施放后服务端应记录绑定法术`,
            timeout: 5_000,
        }).toBe(options.castBoundSpellCardId);
        await expect.poll(async () => {
            const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
            const players = isRecord(snapshot.players) ? snapshot.players : {};
            const player = isRecord(players['0']) ? players['0'] : {};
            const discard = Array.isArray(player.discardSpellCardIds) ? player.discardSpellCardIds : [];
            return discard.includes(options.cardId);
        }, {
            message: `${staffName}施放后装备牌应进入弃牌记录`,
            timeout: 5_000,
        }).toBe(true);
        await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, `${staffName}施放结算截图前`);
        await saveEvidenceScreenshot(
            match.hostPage,
            testInfo,
            `03-${staffName}-施放结算-附着卡显示绑定法术`,
            { evidenceDir: evidenceRun.stagingDir },
        );

        const staffObject = {
            ...createMageWarsE2eEquipmentObject(
                staffObjectId,
                '0',
                options.cardId,
                staffName,
                ARENA_ZONE_IDS.A3,
                '0',
            ),
            attackOrTraitLine: '法术绑定',
            boundSpellCardId: options.initialBoundSpellCardId,
        };
        await injectMageWarsCurrentScopeCoverageReadyState(match, '0', {
            phase: 'finalQuickcast',
            replaceObjects: true,
            objects: [staffObject],
            playerPatches: {
                '0': setupPlayer(10),
                '1': {
                    mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                    mageZoneId: ARENA_ZONE_IDS.D3,
                    preparedSpellCardIds: [],
                    preparedSpellSlots: 0,
                },
            },
        });

        const attachedCard = match.hostPage.locator(
            `[data-testid="mage-wars-attached-card"][data-object-id="${staffObjectId}"][data-source-card-id="${options.cardId}"]`,
        ).first();
        await expect(attachedCard).toBeVisible({ timeout: 5_000 });
        await attachedCard.click({ timeout: 3_000, noWaitAfter: true });
        const abilityDock = match.hostPage.getByTestId('mage-wars-selected-ability-action-dock');
        await expect(abilityDock).toBeVisible({ timeout: 3_000 });
        const abilityButton = abilityDock.locator(`[data-ability-id="${options.abilityId}"]`).first();
        await expect(abilityButton).toBeVisible({ timeout: 3_000 });
        await saveEvidenceScreenshot(
            match.hostPage,
            testInfo,
            `04-${staffName}-快速重绑入口-来源卡下方能力按钮`,
            { evidenceDir: evidenceRun.stagingDir },
        );

        await abilityButton.click({ timeout: 3_000, noWaitAfter: true });
        const objectAbilityChoiceDock = match.hostPage.getByTestId('mage-wars-object-ability-choice-dock');
        await expect(objectAbilityChoiceDock).toBeVisible({ timeout: 3_000 });
        const reboundOption = objectAbilityChoiceDock.locator(
            `[data-testid="mage-wars-object-ability-choice-option"][data-bound-spell-card-id="${options.reboundBoundSpellCardId}"]`,
        ).first();
        await expect(reboundOption).toBeVisible({ timeout: 3_000 });
        await saveEvidenceScreenshot(
            match.hostPage,
            testInfo,
            `05-${staffName}-快速重绑选择-候选法术牌可见`,
            { evidenceDir: evidenceRun.stagingDir },
        );

        await reboundOption.click({ timeout: 3_000, noWaitAfter: true });
        await expect(objectAbilityChoiceDock).toHaveCount(0, { timeout: 5_000 });
        await expect.poll(async () => {
            const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
            const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
            const staff = isRecord(objects[staffObjectId]) ? objects[staffObjectId] : {};
            return {
                boundSpellCardId: staff.boundSpellCardId,
                eventResolved: hasEvent(
                    snapshot,
                    MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED,
                    (payload) => payload.objectId === staffObjectId
                        && payload.abilityId === options.abilityId
                        && payload.boundSpellCardId === options.reboundBoundSpellCardId,
                ),
                mana: isRecord(snapshot.players) && isRecord(snapshot.players['0'])
                    ? snapshot.players['0'].mana
                    : undefined,
            };
        }, {
            message: `${staffName}快速重绑后服务端应写入新绑定、主动能力事件和法力消耗`,
            timeout: 5_000,
        }).toEqual({
            boundSpellCardId: options.reboundBoundSpellCardId,
            eventResolved: true,
            mana: 7,
        });
        await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, `${staffName}快速重绑结算截图前`);
        await saveEvidenceScreenshot(
            match.hostPage,
            testInfo,
            `06-${staffName}-快速重绑结算-新绑定和法力消耗可见`,
            { evidenceDir: evidenceRun.stagingDir },
        );
    } finally {
        await Promise.all([match.hostContext.close(), match.guestContext.close()]);
    }

    expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    await promoteEvidenceScreenshotRun(evidenceRun);
}

async function expectServerObjectZone(
    page: Page,
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
    objectId: string,
    zoneId: string,
    message: string,
) {
    await expect.poll(async () => {
        const snapshot = await readServerCoreSnapshot(page, match, playerId);
        const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
        const object = isRecord(objects[objectId]) ? objects[objectId] : {};
        return object.zoneId;
    }, {
        message,
        timeout: 5_000,
    }).toBe(zoneId);
}

async function hasReadyServerFieldObject(
    page: Page,
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
    zoneId: string,
    sourceCardId: number,
): Promise<boolean> {
    const snapshot = await readServerCoreSnapshot(page, match, playerId);
    const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
    return Object.values(objects).some((candidate) => (
        isRecord(candidate)
        && candidate.ownerId === playerId
        && candidate.zoneId === zoneId
        && candidate.sourceSpellCardId === sourceCardId
        && candidate.actionReady === true
    ));
}

function hasSpellMovementResolvedEvent(
    snapshot: JsonRecord,
    eventType: 'MW_SPELL_PUSH_RESOLVED' | 'MW_SPELL_TELEPORT_RESOLVED',
    spellCardId: number,
    targetObjectId: string,
    toZoneId: string,
): boolean {
    const eventStream = Array.isArray(snapshot.eventStream) ? snapshot.eventStream : [];
    return eventStream.some((entry) => {
        if (!isRecord(entry) || entry.type !== eventType) return false;
        const payload = isRecord(entry.payload) ? entry.payload : {};
        return payload.spellCardId === spellCardId
            && payload.targetObjectId === targetObjectId
            && payload.toZoneId === toZoneId;
    });
}

async function deployBothPlayers(
    match: MageWarsOnlineMatch,
    hostCreatureName: string,
    guestCreatureName: string,
    hostZone: string,
    guestZone: string,
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
) {
    const hostPreparedCard = selfPreparedCardByName(match.hostPage, hostCreatureName);
    await advanceUntilEnabled(match.hostPage, hostPreparedCard);
    const hostSourceCardId = await hostPreparedCard.getAttribute('data-source-card-id');
    await selectPreparedSpell(match.hostPage, hostPreparedCard, hostCreatureName);
    await clickLegalTargetZone(match.hostPage, hostZone, hostCreatureName);
    if (!hostSourceCardId) throw new Error(`部署 ${hostCreatureName} 前未能读取 CardID`);
    await waitForZoneFieldCard(match.hostPage, hostZone, Number(hostSourceCardId), hostCreatureName, {
        match,
        playerId: '0',
        diagnostics,
    });
    await match.hostPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });

    const guestPreparedCard = selfPreparedCardByName(match.guestPage, guestCreatureName);
    await expect(match.guestPage.getByTestId('mage-wars-board')).toHaveAttribute(
        'data-mage-wars-phase-actor-id',
        '1',
        { timeout: 15_000 },
    );
    await advanceUntilEnabled(match.guestPage, guestPreparedCard);
    const guestSourceCardId = await guestPreparedCard.getAttribute('data-source-card-id');
    await selectPreparedSpell(match.guestPage, guestPreparedCard, guestCreatureName);
    await clickLegalTargetZone(match.guestPage, guestZone, guestCreatureName);
    if (!guestSourceCardId) throw new Error(`部署 ${guestCreatureName} 前未能读取 CardID`);
    await waitForZoneFieldCard(match.guestPage, guestZone, Number(guestSourceCardId), guestCreatureName, {
        match,
        playerId: '1',
        diagnostics,
    });
    await match.guestPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });
}

async function deployCreatureWithSummonProcessEvidence(
    match: MageWarsOnlineMatch,
    page: Page,
    playerId: '0' | '1',
    creatureName: string,
    zoneId: ArenaZoneId,
    testInfo: TestInfo,
    label: string,
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
    captureFrame?: (animations?: EvidenceScreenshotAnimationMode) => Promise<void>,
) {
    const preparedCard = selfPreparedCardByName(page, creatureName);
    await expect(page.getByTestId('mage-wars-board')).toHaveAttribute(
        'data-mage-wars-phase-actor-id',
        playerId,
        { timeout: 15_000 },
    );
    await advanceUntilEnabled(page, preparedCard);
    const sourceCardId = await preparedCard.getAttribute('data-source-card-id');
    if (!sourceCardId) throw new Error(`部署 ${creatureName} 前未能读取 CardID`);

    await selectPreparedSpell(page, preparedCard, `${label} 选择召唤来源`);
    const targetZone = page.getByTestId(`mage-wars-arena-zone-${zoneId}`);
    await expect(targetZone).toHaveAttribute('data-legal-target-zone', 'true', { timeout: 3_000 });
    await expect(targetZone).toHaveAttribute('data-zone-target-scope', 'zone', { timeout: 3_000 });
    await dragArenaViewportUntilLocatorActionable(page, targetZone, `${label} 召唤目标格 ${zoneId}`, {
        safeInset: 120,
    });
    const targetRect = await targetZone.boundingBox();
    if (!targetRect) throw new Error(`${label} 召唤目标格 ${zoneId} 没有可截图矩形，无法做过程帧目标格审计`);
    await waitForVisibleMageWarsAtlasCardsLoaded(page, `${label} 召唤来源目标截图前`);
    const beforeScreenshotPath = await saveEvidenceScreenshot(page, testInfo, `${label}-召唤来源和目标区域`, { animations: 'allow' });
    const summonFxAuditPromise = captureMageWarsSummonFxProcessScreenshot(page, testInfo, label, {
        match,
        playerId,
        label,
        sourceCardId: Number(sourceCardId),
        zoneId,
        beforeScreenshotPath,
        targetRect,
    }, captureFrame);
    await clickLegalTargetZone(page, zoneId, `${label} 召唤落点`);
    const summonFxAudit = await summonFxAuditPromise;
    expect(summonFxAudit.objectKind).toBe('creature');
    expect(summonFxAudit.objectId).toMatch(/^mwobj-/);

    await waitForZoneFieldCard(page, zoneId, Number(sourceCardId), `${label} 召唤完成`, {
        match,
        playerId,
        diagnostics,
    });
    await expect(page.getByTestId('mage-wars-fx-summon')).toHaveCount(0, { timeout: 5_000 });
    await waitForVisibleMageWarsAtlasCardsLoaded(page, `${label} 召唤落场完成截图前`);
    await saveEvidenceScreenshot(page, testInfo, `${label}-召唤完成单位落场`);

    const snapshot = await readZoneFieldCardSnapshot(page, zoneId, Number(sourceCardId), `${label} 召唤完成后读取对象`);
    return {
        sourceCardId: Number(sourceCardId),
        objectId: snapshot.objectId,
    };
}

async function castPreparedSpellOnMage(
    page: Page,
    spellName: string,
    targetPlayerId: '0' | '1',
    beforeTargetClick?: () => Promise<void> | void,
) {
    const prepared = selfPreparedCardByName(page, spellName);
    await advanceUntilEnabled(page, prepared);
    await selectPreparedSpell(page, prepared, spellName);
    const mageEntity = page.locator(`[data-testid="mage-wars-zone-mage-entity"][data-player-id="${targetPlayerId}"]`).first();
    await expect(mageEntity).toBeVisible({ timeout: 3_000 });
    await expect(mageEntity).toHaveAttribute('data-mage-role', 'target', { timeout: 3_000 });
    await expect(mageEntity).toHaveAttribute('data-primary-action', 'true', { timeout: 3_000 });
    await dragArenaViewportUntilLocatorActionable(page, mageEntity, `${spellName} 法师目标`, {
        safeInset: 120,
    });
    await beforeTargetClick?.();
    await clickLocatorAtVisibleHitPoint(page, mageEntity, `${spellName} 选择法师目标`).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const [afterHit, snapshot] = await Promise.all([
            readHitTest(mageEntity).catch((hitError: unknown) => ({
                error: hitError instanceof Error ? hitError.message : String(hitError),
            })),
            readOnlineBoardSnapshot(page),
        ]);
        throw new Error([
            `${spellName} 点击法师目标失败`,
            message,
            `afterHit=${JSON.stringify(afterHit, null, 2)}`,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
}

async function castPreparedSpellOnFieldObject(
    page: Page,
    spellName: string,
    target: Locator,
    beforeTargetClick?: () => Promise<void> | void,
) {
    const prepared = selfPreparedCardByName(page, spellName);
    await advanceUntilEnabled(page, prepared);
    await selectPreparedSpell(page, prepared, spellName);
    await expect(target.locator('[data-testid="mage-wars-field-card-target-frame"]')).toBeVisible();
    await beforeTargetClick?.();
    await clickFieldObject(page, target, `${spellName} 选择目标`);
}

async function resolveCurrentActorOrder(
    match: MageWarsOnlineMatch,
    contextLabel: string,
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
): Promise<Array<'0' | '1'>> {
    const board = match.hostPage.getByTestId('mage-wars-board');
    for (let index = 0; index < 80; index += 1) {
        const actorId = await board.getAttribute('data-mage-wars-phase-actor-id', { timeout: 500 }).catch(() => null);
        if (actorId === '0') return ['0', '1'];
        if (actorId === '1') return ['1', '0'];
        await match.hostPage.waitForTimeout(120);
    }

    const failureEvidence = await collectFailureEvidence(match.hostPage, {
        match,
        playerId: '0',
        diagnostics,
    });
    throw new Error([
        `${contextLabel} 未能读取当前行动方`,
        `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
    ].join('\n'));
}

async function advanceToPlayerCreatureAction(
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
) {
    const targetPage = playerId === '0' ? match.hostPage : match.guestPage;
    for (let index = 0; index < 72; index += 1) {
        const phase = await readPhase(targetPage);
        const phaseActorId = await match.hostPage.getByTestId('mage-wars-board').getAttribute('data-mage-wars-phase-actor-id', { timeout: 500 }).catch(() => null);
        if (phase === 'creatureAction' && phaseActorId === playerId) {
            return;
        }

        if (phase === 'planning') {
            for (const page of [match.hostPage, match.guestPage]) {
                await clickPlanningOrTurnEndIfEnabled(page);
            }
            continue;
        }

        const actorPage = phaseActorId === '1' ? match.guestPage : match.hostPage;
        const standbyPage = phaseActorId === '1' ? match.hostPage : match.guestPage;
        const isSimultaneousPhase = SIMULTANEOUS_PHASES.has(phase ?? '');
        const candidates = isSimultaneousPhase
            ? [match.hostPage, match.guestPage]
            : [actorPage, standbyPage];
        let advanced = false;
        for (const page of candidates) {
            if (await clickPlanningOrTurnEndIfEnabled(page)) {
                advanced = true;
                if (!isSimultaneousPhase) break;
            }
        }
        if (!advanced) await targetPage.waitForTimeout(250);
    }

    const failureEvidence = await collectFailureEvidence(targetPage, {
        match,
        playerId,
        diagnostics,
    });
    throw new Error([
        `正式联机未能让玩家 ${playerId} 进入行动阶段`,
        `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
    ].join('\n'));
}

async function advanceToReadyFieldObjectAction(
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
    zoneId: string,
    sourceCardId: number,
    objectName: string,
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
) {
    const targetPage = playerId === '0' ? match.hostPage : match.guestPage;
    const fieldObject = targetPage
        .locator(`[data-testid="mage-wars-arena-zone-${zoneId}"] [data-testid="mage-wars-zone-field-card"][data-source-card-id="${sourceCardId}"]`)
        .first();

    for (let index = 0; index < 180; index += 1) {
        const phase = await readPhase(targetPage);
        const phaseActorId = await match.hostPage.getByTestId('mage-wars-board').getAttribute('data-mage-wars-phase-actor-id', { timeout: 500 }).catch(() => null);
        if (
            phase === 'creatureAction'
            && phaseActorId === playerId
            && await hasReadyServerFieldObject(targetPage, match, playerId, zoneId, sourceCardId)
        ) {
            return;
        }

        if (phase === 'planning') {
            for (const page of [match.hostPage, match.guestPage]) {
                await clickPlanningOrTurnEndIfEnabled(page);
            }
            continue;
        }

        const actorPage = phaseActorId === '1' ? match.guestPage : match.hostPage;
        const standbyPage = phaseActorId === '1' ? match.hostPage : match.guestPage;
        const isSimultaneousPhase = SIMULTANEOUS_PHASES.has(phase ?? '');
        const candidates = isSimultaneousPhase
            ? [match.hostPage, match.guestPage]
            : [actorPage, standbyPage];
        let advanced = false;
        for (const page of candidates) {
            if (await clickPlanningOrTurnEndIfEnabled(page)) {
                advanced = true;
                if (!isSimultaneousPhase) break;
            }
        }
        if (!advanced) await targetPage.waitForTimeout(250);
    }

    const failureEvidence = await collectFailureEvidence(targetPage, {
        match,
        playerId,
        diagnostics,
    });
    throw new Error([
        `正式联机未能让玩家 ${playerId} 的${objectName}在 ${zoneId} 进入可行动窗口`,
        `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
    ].join('\n'));
}

async function moveFieldObjectOneZone(
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
    objectId: string,
    sourceCardId: number,
    fromZoneId: ArenaZoneId,
    toZoneId: ArenaZoneId,
    objectName: string,
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
) {
    const page = playerId === '0' ? match.hostPage : match.guestPage;
    const fieldObject = page.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${objectId}"]`).first();
    let lastClickError: unknown;
    let clickedSource = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        await advanceToReadyFieldObjectAction(match, playerId, fromZoneId, sourceCardId, objectName, diagnostics);
        const readyForClick = await expect.poll(async () => {
            const phase = await readPhase(page);
            const phaseActorId = await page.getByTestId('mage-wars-board')
                .getAttribute('data-mage-wars-phase-actor-id', { timeout: 500 })
                .catch(() => null);
            return phase === 'creatureAction'
                && phaseActorId === playerId
                && await fieldObject.isEnabled({ timeout: 200 }).catch(() => false);
        }, {
            message: `${objectName} 从 ${fromZoneId.toUpperCase()} 移动前应保持在玩家 ${playerId} 的可点击行动窗口`,
            timeout: 5_000,
        }).toBe(true)
            .then(() => true)
            .catch(() => false);
        if (!readyForClick) {
            await page.waitForTimeout(250);
            continue;
        }

        try {
            await clickFieldObject(page, fieldObject, `${objectName} 从 ${fromZoneId.toUpperCase()} 移动前选择来源`);
            clickedSource = true;
            break;
        } catch (error) {
            lastClickError = error;
            await page.waitForTimeout(250);
        }
    }
    if (!clickedSource) {
        if (lastClickError instanceof Error) throw lastClickError;
        const failureEvidence = await collectFailureEvidence(page, {
            match,
            playerId,
            diagnostics,
        });
        throw new Error([
            `${objectName} 从 ${fromZoneId.toUpperCase()} 移动前没有稳定进入可点击行动窗口`,
            `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
        ].join('\n'));
    }
    await clickLegalMoveZone(page, toZoneId, `${objectName} 移动到 ${toZoneId.toUpperCase()}`);
    await waitForZoneFieldCard(page, toZoneId, sourceCardId, `${objectName} 移动到 ${toZoneId.toUpperCase()} 后`, {
        match,
        playerId,
        diagnostics,
    });
    await expectServerObjectZone(
        page,
        match,
        playerId,
        objectId,
        toZoneId,
        `${objectName} 应通过正式页面从 ${fromZoneId.toUpperCase()} 移动到 ${toZoneId.toUpperCase()}`,
    );
    await page.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });
    await expect.poll(async () => {
        const phase = await readPhase(page);
        const phaseActorId = await match.hostPage.getByTestId('mage-wars-board')
            .getAttribute('data-mage-wars-phase-actor-id', { timeout: 500 })
            .catch(() => null);
        return !(phase === 'creatureAction' && phaseActorId === playerId);
    }, {
        message: `${objectName} 移动后应完成行动交接`,
        timeout: 5_000,
    }).toBe(true);
}

async function advanceToNextPlanningPhase(
    match: MageWarsOnlineMatch,
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
) {
    const board = match.hostPage.getByTestId('mage-wars-board');
    const initialTurnNumber = Number(await board.getAttribute('data-mage-wars-turn-number', { timeout: 500 }).catch(() => null));

    for (let index = 0; index < 180; index += 1) {
        const phase = await readPhase(match.hostPage);
        const turnNumber = Number(await board.getAttribute('data-mage-wars-turn-number', { timeout: 500 }).catch(() => null));
        const guestPhase = await readPhase(match.guestPage);
        if (
            phase === 'planning'
            && guestPhase === 'planning'
            && Number.isFinite(turnNumber)
            && turnNumber > initialTurnNumber
        ) {
            return;
        }

        const phaseActorId = await board.getAttribute('data-mage-wars-phase-actor-id', { timeout: 500 }).catch(() => null);
        const actorPage = phaseActorId === '1' ? match.guestPage : match.hostPage;
        const standbyPage = phaseActorId === '1' ? match.hostPage : match.guestPage;
        const isSimultaneousPhase = SIMULTANEOUS_PHASES.has(phase ?? '');
        const candidates = isSimultaneousPhase
            ? [match.hostPage, match.guestPage]
            : [actorPage, standbyPage];
        let advanced = false;
        for (const page of candidates) {
            if (await clickPlanningOrTurnEndIfEnabled(page)) {
                advanced = true;
                if (!isSimultaneousPhase) break;
            }
        }
        if (!advanced) await match.hostPage.waitForTimeout(250);
    }

    const failureEvidence = await collectFailureEvidence(match.hostPage, {
        match,
        playerId: '0',
        diagnostics,
    });
    throw new Error([
        '正式联机未能推进到下一轮计划阶段',
        `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
    ].join('\n'));
}

async function advanceUntilBothPlayersReachPlanningPhase(
    match: MageWarsOnlineMatch,
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
) {
    const board = match.hostPage.getByTestId('mage-wars-board');

    for (let index = 0; index < 180; index += 1) {
        const hostPhase = await readPhase(match.hostPage);
        const guestPhase = await readPhase(match.guestPage);
        if (hostPhase === 'planning' && guestPhase === 'planning') return;

        const phaseActorId = await board.getAttribute('data-mage-wars-phase-actor-id', { timeout: 500 }).catch(() => null);
        const actorPage = phaseActorId === '1' ? match.guestPage : match.hostPage;
        const standbyPage = phaseActorId === '1' ? match.hostPage : match.guestPage;
        const isSimultaneousPhase = SIMULTANEOUS_PHASES.has(hostPhase ?? '');
        const candidates = isSimultaneousPhase
            ? [match.hostPage, match.guestPage]
            : [actorPage, standbyPage];
        let advanced = false;
        for (const page of candidates) {
            if (await clickPlanningOrTurnEndIfEnabled(page)) {
                advanced = true;
                if (!isSimultaneousPhase) break;
            }
        }
        if (!advanced) await match.hostPage.waitForTimeout(250);
    }

    const failureEvidence = await collectFailureEvidence(match.hostPage, {
        match,
        playerId: '0',
        diagnostics,
    });
    throw new Error([
        '正式联机黄金链未能收口到双方计划阶段',
        `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
    ].join('\n'));
}

test.describe('Mage Wars formal online runtime', () => {
    test('正式联机入口从双方计划到部署并保持对手计划隐藏', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL);
        const hostDiagnostics = attachPageDiagnostics(match.hostPage);
        const guestDiagnostics = attachPageDiagnostics(match.guestPage);

        try {
            await advanceBothPlayersToPlanning(match);
            await expect(match.hostPage.getByTestId('mage-wars-plan-spells')).toHaveAttribute('data-main-action-mode', 'plan-spells');
            await expect(match.guestPage.getByTestId('mage-wars-plan-spells')).toHaveAttribute('data-main-action-mode', 'plan-spells');
            await match.hostPage.getByRole('button', { name: '生物', exact: true }).click();
            const hostCreatureName = await selectFirstVisibleSpellbookCard(match.hostPage);
            await match.hostPage.getByTestId('mage-wars-plan-spells').click();

            await match.guestPage.getByRole('button', { name: '生物', exact: true }).click();
            const guestCreatureName = await selectFirstVisibleSpellbookCard(match.guestPage);
            await match.guestPage.getByTestId('mage-wars-plan-spells').click();

            await expect(match.hostPage.getByTestId('mage-wars-opponent-prepared-mirror')).toBeVisible();
            await expect(match.guestPage.getByTestId('mage-wars-opponent-prepared-mirror')).toBeVisible();
            await expect(match.hostPage.locator('[data-testid="mage-wars-opponent-prepared-mirror"] img[alt="隐藏计划"]')).toHaveCount(2);
            await expect(match.guestPage.locator('[data-testid="mage-wars-opponent-prepared-mirror"] img[alt="隐藏计划"]')).toHaveCount(2);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '01-双方计划后-对手计划仍隐藏');

            const hostPreparedCard = selfPreparedCardByName(match.hostPage, hostCreatureName);
            await advanceUntilEnabled(match.hostPage, hostPreparedCard);
            await hostPreparedCard.click();
            const hostSummonFxAuditPromise = captureMageWarsSummonFxProcessScreenshot(
                match.hostPage,
                testInfo,
                '02A-己方生物部署',
            );
            await clickLegalTargetZone(match.hostPage, 'a3', hostCreatureName);
            const hostSummonFxAudit = await hostSummonFxAuditPromise;
            expect(hostSummonFxAudit.objectKind).toBe('creature');
            expect(hostSummonFxAudit.objectId).toMatch(/^mwobj-/);
            await match.hostPage.getByTestId('mage-wars-turn-end').click();

            const guestPreparedCard = selfPreparedCardByName(match.guestPage, guestCreatureName);
            await advanceUntilEnabled(match.guestPage, guestPreparedCard);
            await guestPreparedCard.click();
            await clickLegalTargetZone(match.guestPage, 'd1', guestCreatureName);
            await match.guestPage.getByTestId('mage-wars-turn-end').click();

            await expect(match.hostPage.locator('[data-testid="mage-wars-zone-field-card"]').first()).toBeVisible();
            await expect(match.guestPage.locator('[data-testid="mage-wars-zone-field-card"]').first()).toBeVisible();
            await expect(match.hostPage.locator('[data-testid="mage-wars-opponent-prepared-mirror"] img[alt="隐藏计划"]')).toHaveCount(2);
            await expect(match.guestPage.locator('[data-testid="mage-wars-opponent-prepared-mirror"] img[alt="隐藏计划"]')).toHaveCount(2);
            await expect(match.hostPage.getByTestId('mage-wars-opponent-prepared-mirror')).toContainText('对手已计划 0');
            await expect(match.guestPage.getByTestId('mage-wars-opponent-prepared-mirror')).toContainText('对手已计划 0');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '02-部署完成后-场地生物和隐藏计划');
        } finally {
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    });

    test('正式联机入口真实施放标准强化法术并只产生法力、弃牌和卡牌结果', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL);
        const hostDiagnostics = attachPageDiagnostics(match.hostPage);
        const guestDiagnostics = attachPageDiagnostics(match.guestPage);

        try {
            await advanceBothPlayersToPlanning(match);
            await match.hostPage.getByRole('button', { name: '全部', exact: true }).click();
            await selectNamedSpellbookCard(match.hostPage, '丛林灰狼');
            await selectNamedSpellbookCard(match.hostPage, '荒野呼唤');
            await expect(match.hostPage.getByTestId('mage-wars-plan-spells')).toHaveText('确认计划 2/2');
            await expect(match.hostPage.getByTestId('mage-wars-plan-spells')).toHaveAttribute('data-plan-progress', '2/2');
            await match.hostPage.getByTestId('mage-wars-plan-spells').click();

            await match.guestPage.getByRole('button', { name: '全部', exact: true }).click();
            await selectNamedSpellbookCard(match.guestPage, '阿希拉牧师');
            await match.guestPage.getByTestId('mage-wars-plan-spells').click();

            await deployBothPlayers(match, '丛林灰狼', '阿希拉牧师', 'a3', 'd1', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);
            await advanceToPlayerCreatureAction(match, '0', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);

            const wolfCard = match.hostPage.locator('[data-testid="mage-wars-arena-zone-a3"] [data-testid="mage-wars-zone-field-card"][data-source-card-id="2819"]').first();
            await expect(wolfCard).toBeVisible({ timeout: 5_000 });
            const wolfObjectId = await wolfCard.getAttribute('data-object-id');
            expect(wolfObjectId).toBeTruthy();
            const preparedCallOfTheWild = selfPreparedCardByName(match.hostPage, '荒野呼唤');
            await expect(preparedCallOfTheWild).toBeEnabled();
            await preparedCallOfTheWild.click();
            await expect(match.hostPage.getByTestId('mage-wars-fx-spell-cast')).toHaveCount(0);

            await expect.poll(async () => (
                hasEvent(
                    await readServerCoreSnapshot(match.hostPage, match, '0'),
                    'MW_ARENA_OBJECT_TEMPORARY_TRAITS_GAINED',
                    (payload) => payload.spellCardId === 3417
                        && payload.sourceAbilityId === 'mw.spell.3417'
                        && payload.objectId === wolfObjectId,
                )
            ), {
                message: '荒野呼唤应通过正式页面给己方动物生物授予临时近战加成',
                timeout: 5_000,
            }).toBe(true);
            await expect.poll(async () => match.hostPage.getByTestId('mage-wars-mage-hud-self').innerText()).toMatch(/法力\s*[:：]\s*7/);
            await expect(match.hostPage.getByTestId('mage-wars-discard-pile')).toContainText('弃牌 2');
            await expect(match.hostPage.locator(`${SELF_PREPARED_CARD_SELECTOR}[aria-label="荒野呼唤"]`)).toHaveCount(0);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '03-荒野呼唤结算后-法力弃牌已变化');
        } finally {
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    });

    test('正式联机入口真实移动、攻击并切换回合', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(300_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL, {
            hasTouch: true,
        });
        const hostDiagnostics = attachPageDiagnostics(match.hostPage);
        const guestDiagnostics = attachPageDiagnostics(match.guestPage);

        try {
            await advanceBothPlayersToPlanning(match);
            await match.hostPage.getByRole('button', { name: '生物', exact: true }).click();
            await selectNamedSpellbookCard(match.hostPage, '丛林灰狼');
            await match.hostPage.getByTestId('mage-wars-plan-spells').click();

            await match.guestPage.getByRole('button', { name: '全部', exact: true }).click();
            await selectNamedSpellbookCard(match.guestPage, '阿希拉牧师');
            await match.guestPage.getByTestId('mage-wars-plan-spells').click();
            await deployBothPlayers(match, '丛林灰狼', '阿希拉牧师', 'a3', 'd1', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);

            await advanceToNextPlanningPhase(match, [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);
            await match.guestPage.getByRole('button', { name: '全部', exact: true }).click();
            await selectNamedSpellbookCard(match.guestPage, '圣光之柱');
            await expect(match.guestPage.getByTestId('mage-wars-plan-spells')).toHaveText('确认计划 1/2');
            await expect(match.guestPage.getByTestId('mage-wars-plan-spells')).toHaveAttribute('data-plan-progress', '1/2');
            await match.guestPage.getByTestId('mage-wars-plan-spells').click();
            await expect.poll(async () => {
                const snapshot = await readServerCoreSnapshot(match.guestPage, match, '1');
                const player = isRecord(snapshot.players) && isRecord(snapshot.players['1'])
                    ? snapshot.players['1']
                    : {};
                return Array.isArray(player.preparedSpellCardIds)
                    && player.preparedSpellCardIds.includes(1706);
            }, {
                message: '访客确认圣光之柱后，服务器应记录该准备法术；不能只凭按钮文案继续推进',
                timeout: 5_000,
            }).toBe(true);
            await advanceToReadyFieldObjectAction(match, '0', 'a3', 2819, '丛林灰狼', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);
            await expect.poll(async () => {
                const snapshot = await readServerCoreSnapshot(match.guestPage, match, '1');
                const player = isRecord(snapshot.players) && isRecord(snapshot.players['1'])
                    ? snapshot.players['1']
                    : {};
                return Array.isArray(player.preparedSpellCardIds)
                    && player.preparedSpellCardIds.includes(1706);
            }, {
                message: '房主进入生物行动时，访客的圣光之柱准备状态不应被清掉',
                timeout: 5_000,
            }).toBe(true);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '05-生物行动前-场地对象可直选');

            const hostWolfCard = match.hostPage.locator('[data-testid="mage-wars-arena-zone-a3"] [data-testid="mage-wars-zone-field-card"][data-source-card-id="2819"]').first();
            await hostWolfCard.click({ timeout: 3_000 });
            await clickLegalMoveZone(match.hostPage, 'a2', '丛林灰狼移动');
            await waitForZoneFieldCard(match.hostPage, 'a2', 2819, '丛林灰狼移动后', {
                match,
                playerId: '0',
                diagnostics: [
                    { label: 'host', diagnostics: hostDiagnostics },
                    { label: 'guest', diagnostics: guestDiagnostics },
                ],
            });
            await match.hostPage.setViewportSize({ width: 1920, height: 1080 });
            await match.guestPage.setViewportSize({ width: 1920, height: 1080 });
            await expect(match.hostPage.getByTestId('mage-wars-desktop-spellbook-shelf')).toBeVisible({ timeout: 5_000 });
            await expect(match.hostPage.getByTestId('mage-wars-desktop-prepared-spells')).toBeVisible({ timeout: 5_000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '06A-PC基线-丛林灰狼移动后桌面同源布局');
            await match.hostPage.setViewportSize({ width: 960, height: 540 });
            await match.guestPage.setViewportSize({ width: 960, height: 540 });
            await expectMobileLandscapeHudSlots(match.hostPage, '移动后房主视角');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '06B-移动横屏镜像-丛林灰狼进入目标区域');

            await match.hostPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000 });
            await expect.poll(async () => {
                const snapshot = await readServerCoreSnapshot(match.guestPage, match, '1');
                const player = isRecord(snapshot.players) && isRecord(snapshot.players['1'])
                    ? snapshot.players['1']
                    : {};
                return Array.isArray(player.preparedSpellCardIds)
                    && player.preparedSpellCardIds.includes(1706);
            }, {
                message: '房主结束移动行动后，访客的圣光之柱准备状态不应被清掉',
                timeout: 5_000,
            }).toBe(true);
            await advanceToPlayerCreatureAction(match, '1', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);

            const preparedLightPillar = selfPreparedCardByName(match.guestPage, '圣光之柱');
            await advanceUntilEnabled(match.guestPage, preparedLightPillar);
            await selectPreparedSpell(match.guestPage, preparedLightPillar, '圣光之柱');
            const targetCleric = match.guestPage.locator('[data-testid="mage-wars-arena-zone-d1"] [data-testid="mage-wars-zone-field-card"][data-source-card-id="2811"]').first();
            const targetClericObjectId = await targetCleric.getAttribute('data-object-id');
            if (!targetClericObjectId) throw new Error('圣光之柱目标牧师没有对象 ID，无法核对服务端攻击事件');
            await expect(targetCleric.locator('[data-testid="mage-wars-field-card-target-frame"]')).toBeVisible();
            await dragArenaViewportUntilLocatorActionable(match.guestPage, targetCleric, '圣光之柱目标牧师');
            const attackImpactFx = match.guestPage.getByTestId('mage-wars-fx-attack-impact');
            const attackDiceFx = match.guestPage.getByTestId('mage-wars-fx-attack-dice');
            await Promise.all([
                expect(attackImpactFx).toBeVisible({ timeout: 5_000 }),
                expect(attackDiceFx).toBeVisible({ timeout: 5_000 }),
                expect(attackDiceFx.getByTestId('mage-wars-fx-attack-die-face')).toHaveCount(2, { timeout: 5_000 }),
                expect(attackDiceFx.getByTestId('mage-wars-fx-effect-die-face')).toBeVisible({ timeout: 5_000 }),
                targetCleric.click({ timeout: 3_000 }),
            ]);

            await expect.poll(async () => {
                const snapshot = await readServerCoreSnapshot(match.guestPage, match, '1');
                if (!hasSpellAttackRolledEvent(snapshot, 1706, targetClericObjectId)) return false;
                const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
                const targetObject = isRecord(objects[targetClericObjectId]) ? objects[targetClericObjectId] : {};
                return typeof targetObject.damage === 'number' && targetObject.damage > 0;
            }, {
                message: '服务端没有记录圣光之柱对阿希拉牧师的攻击掷骰和伤害状态',
                timeout: 5_000,
            }).toBe(true);
            await expect(targetCleric.locator('[data-testid="mage-wars-field-card-damage-overlay"]')).toBeVisible({ timeout: 5_000 });
            await expect(targetCleric.locator('[data-testid="mage-wars-field-card-damage-overlay-value"]')).toHaveCount(0);
            await expect(targetCleric.locator('[data-testid="mage-wars-field-card-life-readout"]')).toHaveAttribute('data-life-visible', 'false');
            await expectMobileLandscapeHudSlots(match.guestPage, '攻击后访客视角');
            await saveEvidenceScreenshot(match.guestPage, testInfo, '07-横屏圣光之柱攻击阿希拉牧师后-攻击骰反馈和伤害状态');

            await match.guestPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000 });
            await advanceUntilPhase(match, 'finalQuickcast', '攻击行动结束后应通过剩余行动结束进入终末快速施法窗口', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);
            await expectMobileLandscapeHudSlots(match.guestPage, '终末快速施法窗口访客视角');
            await saveEvidenceScreenshot(match.guestPage, testInfo, '08-攻击行动结束后-进入终末快速施法窗口');
        } finally {
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    });

    test('正式页面召唤和攻击必要过程帧覆盖', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(240_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const summonRecording = createMageWarsFxVideoRecording(testInfo, { fileLabel: '召唤' });
        const rangedRecording = createMageWarsFxVideoRecording(testInfo, { fileLabel: '远程攻击' });
        const match = await setupOnlineMageWars(browser, baseURL);
        let summonGifCapture: MageWarsFxGifCapture | null = null;
        let attackGifCapture: MageWarsFxGifCapture | null = null;
        let attackPage = match.hostPage;
        const hostDiagnostics = attachPageDiagnostics(match.hostPage, 'host');
        const guestDiagnostics = attachPageDiagnostics(match.guestPage, 'guest');
        const diagnostics = [
            { label: 'host', diagnostics: hostDiagnostics },
            { label: 'guest', diagnostics: guestDiagnostics },
        ];
        const attackTargetObjectId = 'mw-e2e-summon-attack-target';
        const attackSpellCardId = 1710;

        try {
            await advanceBothPlayersToPlanning(match);
            await planNamedSpells(match.hostPage, ['野性山猫']);
            await planNamedSpells(match.guestPage, ['阿希拉牧师']);

            summonGifCapture = await startMageWarsFxGifCapture(match.hostPage, summonRecording);
            const hostSummon = await deployCreatureWithSummonProcessEvidence(
                match,
                match.hostPage,
                '0',
                '野性山猫',
                ARENA_ZONE_IDS.A3,
                testInfo,
                '01-兽王野性山猫',
                diagnostics,
                (animations) => summonGifCapture?.capture(animations) ?? Promise.resolve(),
            );
            await summonGifCapture.stop();
            expect(hostSummon.sourceCardId).toBe(2906);
            await match.hostPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });

            const guestSummon = await deployCreatureWithSummonProcessEvidence(
                match,
                match.guestPage,
                '1',
                '阿希拉牧师',
                ARENA_ZONE_IDS.D1,
                testInfo,
                '02-女祭司阿希拉牧师',
                diagnostics,
            );
            expect(guestSummon.sourceCardId).toBe(2811);
            await match.guestPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });

            await injectMageWarsSpellFxReadyState(match, '0', {
                mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
                preparedSpellCardId: attackSpellCardId,
                targetObject: {
                    ...createMageWarsE2eCreatureObject(
                        attackTargetObjectId,
                        '1',
                        2811,
                        '阿希拉牧师',
                        ARENA_ZONE_IDS.B3,
                    ),
                    life: 20,
                },
                mana: 12,
            });
            await waitForTestHarness(attackPage);
            const attackDiceReady = await attackPage.evaluate(() => {
                const harness = (window as Window & {
                    __BG_TEST_HARNESS__?: {
                        dice?: {
                            setValues?: (values: number[]) => void;
                            remaining?: () => number;
                            getValues?: () => number[];
                        };
                    };
                }).__BG_TEST_HARNESS__;
                harness?.dice?.setValues?.([6, 6, 6, 6, 6, 6]);
                return {
                    hasHarness: Boolean(harness),
                    values: harness?.dice?.getValues?.() ?? [],
                    remaining: harness?.dice?.remaining?.() ?? null,
                };
            });
            expect(attackDiceReady).toMatchObject({
                hasHarness: true,
                values: [6, 6, 6, 6, 6, 6],
            });

            const attackTarget = attackPage
                .locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${attackTargetObjectId}"]`)
                .first();
            await expect(attackTarget).toBeVisible({ timeout: 5_000 });
            await waitForVisibleMageWarsAtlasCardsLoaded(attackPage, '攻击代表态目标牌面截图前预加载');
            await startMageWarsTargetContinuityProbe(
                attackPage,
                attackTargetObjectId,
                '间歇喷泉攻击阿希拉牧师目标连续可见',
            );
            let attackFxAuditPromise: ReturnType<typeof captureMageWarsFxProcessScreenshots> | undefined;
            await castPreparedSpellOnFieldObject(attackPage, '间歇喷泉', attackTarget, async () => {
                attackGifCapture = await startMageWarsFxGifCapture(attackPage, rangedRecording);
                attackFxAuditPromise = captureMageWarsFxProcessScreenshots(
                    attackPage,
                    testInfo,
                    'attack',
                    '03-间歇喷泉攻击阿希拉牧师',
                    {
                        expectTravel: true,
                        expectDamageFloat: false,
                        captureFrame: (animations) => attackGifCapture?.capture(animations) ?? Promise.resolve(),
                    },
                );
            });
            if (!attackFxAuditPromise) {
                throw new Error('间歇喷泉点击前未启动攻击 FX 捕捉');
            }
            let attackFxAudit: MageWarsFxAudit;
            try {
                attackFxAudit = await attackFxAuditPromise;
            } catch (error) {
                const serverSnapshot = await readServerCoreSnapshot(attackPage, match, '0');
                throw new Error([
                    error instanceof Error ? error.message : String(error),
                    `serverSnapshot=${JSON.stringify(serverSnapshot, null, 2)}`,
                ].join('\n'));
            }
            await attackGifCapture?.stop();
            expect(attackFxAudit.sourceRow).toBe('2');
            expect(attackFxAudit.sourceCol).toBe('0');
            expect(attackFxAudit.targetRow).toBe('2');
            expect(attackFxAudit.targetCol).toBe('1');
            await expectMageWarsTargetContinuityProbePassed(
                attackPage,
                '间歇喷泉攻击阿希拉牧师目标连续可见',
            );

            await expect.poll(async () => {
                const snapshot = await readServerCoreSnapshot(attackPage, match, '0');
                return hasSpellAttackRolledEvent(
                    snapshot,
                    attackSpellCardId,
                    attackTargetObjectId,
                ) && hasDamageDealtEvent(snapshot, attackTargetObjectId);
            }, {
                message: '间歇喷泉必须通过正式页面点击目标后产生攻击掷骰和真实伤害事件',
                timeout: 5_000,
            }).toBe(true);
            await expect.poll(
                async () => attackTarget.getAttribute('data-visual-damage'),
                { timeout: 5_000 },
            ).not.toBe('0');
            await waitForVisibleMageWarsAtlasCardsLoaded(attackPage, '召唤和攻击必要过程帧完成后');
            await saveEvidenceScreenshot(attackPage, testInfo, '04-远程攻击稳定收口-目标损伤已落地');
        } finally {
            await summonGifCapture?.stop().catch(() => undefined);
            await attackGifCapture?.stop().catch(() => undefined);
            await Promise.all([
                match.hostContext.close(),
                match.guestContext.close(),
            ]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        await finalizeMageWarsFxVideoRecording(testInfo, summonRecording, {
            actionLabel: '召唤代表态',
            requirements: [
                {
                    requirement: '正式页面召唤独立覆盖：玩家点击真实法术书卡牌和合法区域，召唤来源、光柱过程、单位落场和稳定收口均来自同一次运行',
                    status: 'PASS',
                    evidence: [
                        'E2E：正式页面点击召唤卡牌和目标区域 passed',
                        'E2E：召唤光柱过程帧和单位落场帧来自当前运行',
                        summonRecording.finalGifPath ?? '',
                    ],
                },
            ],
        });
        await finalizeMageWarsFxVideoRecording(testInfo, rangedRecording, {
            actionLabel: '远程攻击代表态',
            requirements: [
                {
                    requirement: '正式页面远程攻击独立覆盖：玩家点击真实法术卡牌和场上目标，投射路径、骰子 / 命中结果和稳定收口均来自同一次运行',
                    status: 'PASS',
                    evidence: [
                        'E2E：正式页面点击远程攻击目标后产生攻击掷骰和真实伤害事件',
                        'E2E：远程投射、命中层、目标损伤落地和稳定收口过程帧来自当前运行；远程伤害飘字不作为本条 PASS 依据',
                        rangedRecording.finalGifPath ?? '',
                    ],
                },
            ],
        });
    });

    test('正式页面近战攻击实际动效独立证据覆盖', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        const evidenceRun = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
        const recording = createMageWarsFxVideoRecording(testInfo, {
            fileLabel: '近战攻击',
            evidenceDir: evidenceRun.stagingDir,
            stableEvidenceDir: evidenceRun.stableDir,
        });
        const match = await setupOnlineMageWars(browser, baseURL);
        const hostDiagnostics = attachPageDiagnostics(match.hostPage, 'host');
        const guestDiagnostics = attachPageDiagnostics(match.guestPage, 'guest');
        const attackerObjectId = 'mw-e2e-melee-attacker';
        const targetObjectId = 'mw-e2e-melee-target';
        let meleeFxAuditPromise: ReturnType<typeof captureMageWarsFxProcessScreenshots> | undefined;

        try {
            await injectMageWarsCurrentScopeCoverageReadyState(match, '0', {
                phase: 'creatureAction',
                replaceObjects: true,
                objects: [
                    createMageWarsE2eCreatureObject(
                        attackerObjectId,
                        '0',
                        2906,
                        '野性山猫',
                        ARENA_ZONE_IDS.A3,
                    ),
                    {
                        ...createMageWarsE2eCreatureObject(
                            targetObjectId,
                            '1',
                            2811,
                            '阿希拉牧师',
                            ARENA_ZONE_IDS.A3,
                        ),
                        life: 20,
                        actionReady: false,
                    },
                ],
                playerPatches: {
                    '0': {
                        mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.A1,
                        mana: 12,
                        actionReady: true,
                        quickcastReady: true,
                    },
                    '1': {
                        mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.D3,
                    },
                },
            });

            const attacker = match.hostPage.locator(
                `[data-testid="mage-wars-zone-field-card"][data-object-id="${attackerObjectId}"]`,
            ).first();
            const target = match.hostPage.locator(
                `[data-testid="mage-wars-zone-field-card"][data-object-id="${targetObjectId}"]`,
            ).first();
            await expect(attacker).toBeVisible({ timeout: 5_000 });
            await expect(target).toBeVisible({ timeout: 5_000 });
            await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '近战攻击目标牌面截图前');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '01-近战攻击代表态-来源和目标可见', {
                evidenceDir: evidenceRun.stagingDir,
            });

            await clickFieldObject(match.hostPage, attacker, '近战攻击选择野性山猫来源');
            await expect(target.locator('[data-testid="mage-wars-field-card-target-frame"]')).toBeVisible({ timeout: 3_000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '02-近战攻击选择态-目标高亮', {
                evidenceDir: evidenceRun.stagingDir,
            });

            await startMageWarsTargetContinuityProbe(match.hostPage, targetObjectId, '近战攻击目标连续可见');
            const meleeGifCapture = await startMageWarsFxGifCapture(match.hostPage, recording);
            await startMageWarsAttackDamageFloatProbe(match.hostPage);
            const readAttackerBox = () => match.hostPage.evaluate((objectId) => {
                const card = document.querySelector<HTMLElement>(
                    `[data-testid="mage-wars-zone-field-card"][data-object-id="${objectId}"]`,
                );
                if (!card) return null;
                const rect = card.getBoundingClientRect();
                return {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                };
            }, attackerObjectId);
            const attackerBeforeBox = await readAttackerBox();
            meleeFxAuditPromise = captureMageWarsFxProcessScreenshots(
                match.hostPage,
                testInfo,
                'attack',
                '03-野性山猫近战攻击阿希拉牧师',
                {
                    startDamageFloatProbe: false,
                    expectDamageFloat: true,
                    evidenceDir: evidenceRun.stagingDir,
                    captureFrame: (animations) => meleeGifCapture.capture(animations),
                },
            );
            const meleeLungePromise = match.hostPage.waitForFunction(({ objectId, before }) => {
                const card = document.querySelector<HTMLElement>(
                    `[data-testid="mage-wars-zone-field-card"][data-object-id="${objectId}"]`,
                );
                if (card?.getAttribute('data-melee-lunge-active') !== 'true' || !before) return false;
                const rect = card.getBoundingClientRect();
                return Math.hypot(rect.x - before.x, rect.y - before.y) > 1;
            }, { objectId: attackerObjectId, before: attackerBeforeBox }, { timeout: 10_000 });
            const visualStackingAuditPromise = match.hostPage.waitForFunction(({ attackerId, targetId, initialBox }) => {
                const readCard = (objectId: string) => document.querySelector<HTMLElement>(
                    `[data-testid="mage-wars-zone-field-card"][data-object-id="${objectId}"]`,
                );
                const attackerCard = readCard(attackerId);
                const targetCard = readCard(targetId);
                const attackerLane = attackerCard?.closest<HTMLElement>('[data-testid="mage-wars-zone-lane-item"]');
                const targetLane = targetCard?.closest<HTMLElement>('[data-testid="mage-wars-zone-lane-item"]');
                if (!attackerCard || !targetCard || !attackerLane || !targetLane || !initialBox) return false;
                if (attackerCard.getAttribute('data-melee-lunge-active') !== 'true') return false;
                const attackerRect = attackerCard.getBoundingClientRect();
                const targetRect = targetCard.getBoundingClientRect();
                const lungeDistance = Math.hypot(
                    attackerRect.x - initialBox.x,
                    attackerRect.y - initialBox.y,
                );
                if (lungeDistance <= 1) return false;
                const left = Math.max(attackerRect.left, targetRect.left);
                const right = Math.min(attackerRect.right, targetRect.right);
                const top = Math.max(attackerRect.top, targetRect.top);
                const bottom = Math.min(attackerRect.bottom, targetRect.bottom);
                if (right <= left || bottom <= top) return false;
                const x = (left + right) / 2;
                const y = (top + bottom) / 2;
                const hitCard = document.elementsFromPoint(x, y).find((element) => (
                    element instanceof HTMLElement
                    && element.matches('[data-testid="mage-wars-zone-field-card"]')
                )) as HTMLElement | undefined;
                const hitObjectId = hitCard?.getAttribute('data-object-id') ?? null;
                return {
                    overlapArea: Math.round((right - left) * (bottom - top)),
                    lungeDistance,
                    hitObjectId,
                    stackPath: document.elementsFromPoint(x, y).slice(0, 12).map((element) => ({
                        tag: element.tagName,
                        testId: element instanceof HTMLElement ? element.dataset.testid ?? null : null,
                        objectId: element instanceof HTMLElement
                            ? element.getAttribute('data-object-id')
                            : null,
                    })),
                };
            }, {
                attackerId: attackerObjectId,
                targetId: targetObjectId,
                initialBox: attackerBeforeBox,
            }, { timeout: 3_000 });
            await clickFieldObject(match.hostPage, target, '近战攻击选择阿希拉牧师目标');
            await meleeLungePromise.catch(async (error: unknown) => {
                const browserState = await match.hostPage.evaluate(() => {
                    const board = document.querySelector<HTMLElement>('[data-testid="mage-wars-board"]');
                    const attacker = document.querySelector<HTMLElement>(
                        '[data-testid="mage-wars-zone-field-card"][data-object-id="mw-e2e-melee-attacker"]',
                    );
                    const target = document.querySelector<HTMLElement>(
                        '[data-testid="mage-wars-zone-field-card"][data-object-id="mw-e2e-melee-target"]',
                    );
                        const fx = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-layer"]');
                        const attackImpact = fx?.querySelector<HTMLElement>('[data-testid="mage-wars-fx-attack-melee-impact"]');
                        return {
                        phase: board?.dataset.mageWarsPhase ?? null,
                        currentPlayerId: board?.dataset.mageWarsCurrentPlayerId ?? null,
                        selectedObjectId: board?.querySelector('[data-field-card-role="source"][data-object-id]')?.getAttribute('data-object-id') ?? null,
                        eventCount: board?.dataset.mageWarsEventCount ?? null,
                        latestEventId: board?.dataset.mageWarsEventLatestId ?? null,
                        eventCursor: board?.dataset.mageWarsEventCursor ?? null,
                        lastConsumedEvents: board?.dataset.mageWarsLastConsumedEvents ?? null,
                        lastFxCues: board?.dataset.mageWarsLastFxCues ?? null,
                        attackerActionReady: attacker?.dataset.actionReady ?? null,
                        attackerRole: attacker?.dataset.fieldCardRole ?? null,
                        targetRole: target?.dataset.fieldCardRole ?? null,
                        meleeLunge: attacker?.getAttribute('data-melee-lunge-active') === 'true',
                            attackImpact: attackImpact != null,
                            attackImpactAttributes: attackImpact ? {
                                sourceAnchorId: attackImpact.dataset.sourceAnchorId ?? null,
                                targetAnchorId: attackImpact.dataset.targetAnchorId ?? null,
                                sourceSnapshotAnchorId: attackImpact.dataset.sourceSnapshotAnchorId ?? null,
                                targetSnapshotAnchorId: attackImpact.dataset.targetSnapshotAnchorId ?? null,
                                sourceSnapshotSurfaceId: attackImpact.dataset.sourceSnapshotSurfaceId ?? null,
                                targetSnapshotSurfaceId: attackImpact.dataset.targetSnapshotSurfaceId ?? null,
                            } : null,
                            attackDice: document.querySelector('[data-testid="mage-wars-fx-attack-dice"]') != null,
                    };
                });
                const serverSnapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                throw new Error([
                    '近战目标点击后没有产生来源单位冲刺状态',
                    error instanceof Error ? error.message : String(error),
                    `browserState=${JSON.stringify(browserState, null, 2)}`,
                    `serverSnapshot=${JSON.stringify(serverSnapshot, null, 2)}`,
                ].join('\n'));
            });
            const stackingAudit = await match.hostPage.evaluate(({ attackerId, targetId }) => {
                const readLayer = (objectId: string) => {
                    const card = document.querySelector<HTMLElement>(
                        `[data-testid="mage-wars-zone-field-card"][data-object-id="${objectId}"]`,
                    );
                    const laneItem = card?.closest<HTMLElement>('[data-testid="mage-wars-zone-lane-item"]');
                    return {
                        zIndex: Number.parseInt(getComputedStyle(laneItem ?? card!).zIndex || '0', 10),
                        role: card?.getAttribute('data-field-card-role') ?? null,
                    };
                };
                return {
                    attacker: readLayer(attackerId),
                    target: readLayer(targetId),
                };
            }, { attackerId: attackerObjectId, targetId: targetObjectId });
            expect(
                stackingAudit.attacker.zIndex,
                `近战冲刺期间攻击者必须压在受击者上方：${JSON.stringify(stackingAudit)}`,
            ).toBeGreaterThan(stackingAudit.target.zIndex);
            const visualStackingAudit = await visualStackingAuditPromise;
            const visualStackingAuditReport = await visualStackingAudit.jsonValue<{
                overlapArea: number;
                lungeDistance: number;
                hitObjectId: string | null;
                stackPath: Array<Record<string, unknown>>;
            }>();
            expect(
                visualStackingAuditReport.hitObjectId,
                `近战冲刺发生实际重叠时，攻击者必须是命中栈顶对象：${JSON.stringify(visualStackingAuditReport)}`,
            ).toBe(attackerObjectId);
            expect(
                visualStackingAuditReport.lungeDistance,
                '近战必须让来源单位本体发生可见冲刺位移，不能只显示结果层',
            ).toBeGreaterThan(1);
            await expect(match.hostPage.getByTestId('mage-wars-fx-attack-melee-strike')).toBeVisible({ timeout: 3_000 });
            await match.hostPage.waitForTimeout(160);
            await match.hostPage.waitForTimeout(260);
            const meleeFxAudit = await meleeFxAuditPromise;
            await match.hostPage.waitForFunction((objectId) => {
                const card = document.querySelector<HTMLElement>(
                    `[data-testid="mage-wars-zone-field-card"][data-object-id="${objectId}"]`,
                );
                return card?.getAttribute('data-melee-lunge-active') !== 'true';
            }, attackerObjectId, { timeout: 3_000 });
            await expect(match.hostPage.getByTestId('mage-wars-fx-attack-dice')).toHaveAttribute(
                'data-visible-duration-ms',
                String(MAGE_WARS_FX_TIMING.meleeResultVisibleMs),
            );
            await match.hostPage.waitForTimeout(MAGE_WARS_FX_TIMING.meleeCompleteMs + 220);
            await expect(match.hostPage.getByTestId('mage-wars-fx-attack-dice')).toBeVisible({ timeout: 1_000 });
            await expect(match.hostPage.getByTestId('mage-wars-fx-effect-die-face')).toHaveCount(0);
            await match.hostPage.waitForFunction(
                () => document.querySelector('[data-testid="mage-wars-fx-attack-dice"]') == null,
                undefined,
                {
                    timeout: MAGE_WARS_FX_TIMING.meleeResultVisibleMs + 1_500,
                    polling: 50,
                },
            );
            await expect(match.hostPage.getByTestId('mage-wars-fx-attack-melee-strike')).toHaveCount(0, {
                timeout: 1_000,
            });
            await meleeGifCapture.stop();

            expect(meleeFxAudit.hasTravel).toBe(false);
            expect(meleeFxAudit.sourceRow).toBe(meleeFxAudit.targetRow);
            expect(meleeFxAudit.sourceCol).toBe(meleeFxAudit.targetCol);
            await expect.poll(async () => {
                const box = await readAttackerBox();
                if (!box || !attackerBeforeBox) return Number.POSITIVE_INFINITY;
                return Math.hypot(box.x - attackerBeforeBox.x, box.y - attackerBeforeBox.y);
            }, {
                message: '近战动画结束后来源单位必须回到原位',
                timeout: 3_000,
            }).toBeLessThan(3);
            await expectMageWarsTargetContinuityProbePassed(
                match.hostPage,
                '近战攻击目标连续可见',
            );
            await expect.poll(async () => {
                const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                return hasEvent(
                    snapshot,
                    MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                    (payload) => (
                        payload.attackerObjectId === attackerObjectId
                        && payload.targetObjectId === targetObjectId
                        && Array.isArray(payload.diceResults)
                        && payload.effectDieResult === undefined
                        && payload.rawEffectDieResult === undefined
                    ),
                )
                    && !hasEvent(snapshot, MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_STATUS_EFFECT_AVAILABLE, (payload) => (
                        payload.targetObjectId === targetObjectId
                    ))
                    && hasDamageDealtEvent(snapshot, targetObjectId);
            }, {
                message: '近战攻击必须通过正式页面点击来源和目标后产生真实攻击事件与伤害',
                timeout: 5_000,
            }).toBe(true);
            await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '近战攻击稳定收口截图前');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '04-近战攻击稳定收口-目标可继续', {
                evidenceDir: evidenceRun.stagingDir,
            });
        } finally {
            await meleeFxAuditPromise?.catch(() => undefined);
            await Promise.all([
                match.hostContext.close(),
                match.guestContext.close(),
            ]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        await finalizeMageWarsFxVideoRecording(testInfo, recording, {
            actionLabel: '近战攻击代表态',
            required: true,
            requirements: [
                {
                    requirement: '正式页面近战攻击独立覆盖：玩家点击场上来源和目标，实际产生近战攻击事件与伤害',
                    status: 'PASS',
                    evidence: [
                        'E2E：正式页面场上生物来源和目标点击链 passed',
                        'E2E：MW_ARENA_OBJECT_ATTACK_DECLARED 与 DAMAGE_DEALT 均来自当前运行',
                    ],
                },
                {
                    requirement: '近战动效 GIF 覆盖来源、斩击过程、骰子 / 命中结果和稳定收口',
                    status: 'PASS',
                    evidence: [
                        recording.finalGifPath!,
                        'E2E：近战攻击没有远程 travel，使用近战斩击 renderer',
                        'E2E：目标连续性监视器覆盖近战 FX 活跃帧',
                    ],
                },
                {
                    requirement: '攻击骰结果层与单位就绪 / 守卫 token 视觉语义分离',
                    status: 'PASS',
                    evidence: [
                        'E2E：attack-dice-result 不包含 data-token-kind',
                        'E2E：entity-status-tokens 不挂入攻击骰结果层',
                    ],
                },
                {
                    requirement: '无效果骰攻击不得生成效果骰结果或效果状态事件',
                    status: 'PASS',
                    evidence: [
                        'E2E：野性山猫 2906 的攻击事件没有 effectDieResult / rawEffectDieResult',
                        'E2E：正式页面没有 mage-wars-fx-effect-die-face',
                    ],
                },
            ],
        });
        await promoteEvidenceScreenshotRun(evidenceRun);
        rebaseMageWarsTestAnnotations(testInfo, recording);
    });

    test('正式页面有效果骰近战攻击独立证据覆盖', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(240_000);
        const evidenceRun = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
        const recording = createMageWarsFxVideoRecording(testInfo, {
            fileLabel: '有效果骰近战攻击',
            evidenceDir: evidenceRun.stagingDir,
            stableEvidenceDir: evidenceRun.stableDir,
        });
        const match = await setupOnlineMageWars(browser, baseURL);
        const hostDiagnostics = attachPageDiagnostics(match.hostPage, 'host');
        const guestDiagnostics = attachPageDiagnostics(match.guestPage, 'guest');
        const attackerObjectId = 'mw-e2e-effect-melee-attacker';
        const targetObjectId = 'mw-e2e-effect-melee-target';
        const maxAttempts = 12;
        let successfulAttempt = 0;

        try {
            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                await injectMageWarsCurrentScopeCoverageReadyState(match, '0', {
                    phase: 'creatureAction',
                    replaceObjects: true,
                    objects: [
                        createMageWarsE2eCreatureObject(
                            attackerObjectId,
                            '0',
                            2801,
                            '火烙魔婴',
                            ARENA_ZONE_IDS.A3,
                        ),
                        {
                            ...createMageWarsE2eCreatureObject(
                                targetObjectId,
                                '1',
                                2811,
                                '阿希拉牧师',
                                ARENA_ZONE_IDS.A3,
                            ),
                            life: 20,
                            actionReady: false,
                        },
                    ],
                    playerPatches: {
                        '0': {
                            mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
                            mageZoneId: ARENA_ZONE_IDS.A1,
                            mana: 12,
                            actionReady: true,
                            quickcastReady: true,
                        },
                        '1': {
                            mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                            mageZoneId: ARENA_ZONE_IDS.D3,
                        },
                    },
                });

                const attacker = match.hostPage.locator(
                    `[data-testid="mage-wars-zone-field-card"][data-object-id="${attackerObjectId}"]`,
                ).first();
                const target = match.hostPage.locator(
                    `[data-testid="mage-wars-zone-field-card"][data-object-id="${targetObjectId}"]`,
                ).first();
                await expect(attacker).toBeVisible({ timeout: 5_000 });
                await expect(target).toBeVisible({ timeout: 5_000 });
                await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, `有效果骰近战第 ${attempt} 次截图前`);

                if (attempt === 1) {
                    await saveEvidenceScreenshot(match.hostPage, testInfo, '01-有效果骰近战攻击-来源和目标可见', {
                        evidenceDir: evidenceRun.stagingDir,
                    });
                }

                const beforeSnapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                const beforeEventCount = Array.isArray(beforeSnapshot.eventStream)
                    ? beforeSnapshot.eventStream.length
                    : 0;
                await clickFieldObject(match.hostPage, attacker, `有效果骰近战第 ${attempt} 次选择火烙魔婴来源`);
                await expect(target.locator('[data-testid="mage-wars-field-card-target-frame"]')).toBeVisible({ timeout: 3_000 });

                const meleeGifCapture = await startMageWarsFxGifCapture(match.hostPage, recording);
                await clickFieldObject(match.hostPage, target, `有效果骰近战第 ${attempt} 次选择阿希拉牧师目标`);
                await expect(match.hostPage.getByTestId('mage-wars-fx-attack-melee-strike').first()).toBeVisible({ timeout: 5_000 });
                await expect(match.hostPage.getByTestId('mage-wars-fx-effect-die-face').first()).toBeVisible({ timeout: 5_000 });
                await expectMageWarsAttackResultLayerIsolated(match.hostPage, `有效果骰近战第 ${attempt} 次结果层`);
                await saveEvidenceScreenshot(match.hostPage, testInfo, '02-有效果骰近战攻击-效果骰与斩击过程', {
                    animations: 'allow',
                    evidenceDir: evidenceRun.stagingDir,
                });

                await expect.poll(async () => {
                    const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                    const entries = Array.isArray(snapshot.eventStream) ? snapshot.eventStream : [];
                    const recentEntries = entries.slice(beforeEventCount);
                    const declared = recentEntries.find((entry) => (
                        entry.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
                        && isRecord(entry.payload)
                        && entry.payload.attackerObjectId === attackerObjectId
                        && entry.payload.targetObjectId === targetObjectId
                        && typeof entry.payload.effectDieResult === 'number'
                    ));
                    return declared?.payload ?? null;
                }, {
                    message: `有效果骰近战第 ${attempt} 次必须产生带 effectDieResult 的真实攻击事件`,
                    timeout: 8_000,
                }).not.toBeNull();

                const afterEffectSnapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                const afterEffectEntries = Array.isArray(afterEffectSnapshot.eventStream)
                    ? afterEffectSnapshot.eventStream.slice(beforeEventCount)
                    : [];
                const declaredPayload = afterEffectEntries.find((entry) => (
                    entry.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
                    && isRecord(entry.payload)
                    && entry.payload.attackerObjectId === attackerObjectId
                    && entry.payload.targetObjectId === targetObjectId
                    && typeof entry.payload.effectDieResult === 'number'
                ));

                const effectResult = isRecord(declaredPayload?.payload)
                    ? declaredPayload.payload.effectDieResult
                    : undefined;
                if (typeof effectResult !== 'number' || effectResult < 8) {
                    await meleeGifCapture.stop();
                    await match.hostPage.waitForTimeout(MAGE_WARS_FX_TIMING.meleeCompleteMs + 350);
                    continue;
                }

                await expect.poll(async () => {
                    const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                    const entries = Array.isArray(snapshot.eventStream) ? snapshot.eventStream : [];
                    return entries.slice(beforeEventCount).some((entry) => (
                        entry.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_STATUS_EFFECT_AVAILABLE
                        && isRecord(entry.payload)
                        && entry.payload.targetObjectId === targetObjectId
                        && entry.payload.statusTokenId === STATUS_TOKEN_IDS.BURN
                    ));
                }, {
                    message: `有效果骰近战第 ${attempt} 次必须产生燃烧可用事件`,
                    timeout: 8_000,
                }).toBe(true);

                await expect.poll(async () => {
                    const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                    const entries = Array.isArray(snapshot.eventStream) ? snapshot.eventStream : [];
                    return entries.slice(beforeEventCount).some((entry) => (
                        entry.type === MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED
                        && isRecord(entry.payload)
                        && entry.payload.targetObjectId === targetObjectId
                        && entry.payload.statusTokenId === STATUS_TOKEN_IDS.BURN
                    ));
                }, {
                    message: `有效果骰近战第 ${attempt} 次必须落地燃烧 token`,
                    timeout: 8_000,
                }).toBe(true);

                successfulAttempt = attempt;
                await expect.poll(async () => {
                    const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                    const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
                    const targetState = isRecord(objects[targetObjectId]) ? objects[targetObjectId] : {};
                    const statusTokens = isRecord(targetState.statusTokens) ? targetState.statusTokens : {};
                    return statusTokens[STATUS_TOKEN_IDS.BURN] ?? 0;
                }, {
                    message: '有效果骰近战结算后目标必须落地 1 个燃烧 token',
                    timeout: 5_000,
                }).toBeGreaterThan(0);
                await saveEvidenceScreenshot(match.hostPage, testInfo, '03-有效果骰近战攻击-燃烧 token 已落地', {
                    animations: 'disabled',
                    evidenceDir: evidenceRun.stagingDir,
                });
                await meleeGifCapture.stop();
                break;
            }

            expect(successfulAttempt, `有效果骰近战在 ${maxAttempts} 次真实点击尝试内没有得到 >=8 的效果骰`).toBeGreaterThan(0);
        } finally {
            await Promise.all([
                match.hostContext.close(),
                match.guestContext.close(),
            ]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        await finalizeMageWarsFxVideoRecording(testInfo, recording, {
            actionLabel: '有效果骰近战攻击代表态',
            required: true,
            requirements: [
                {
                    requirement: '正式页面点击 2801 火烙魔婴与真实目标后产生效果骰结果',
                    status: 'PASS',
                    evidence: [
                        'E2E：正式页面场上生物来源和目标点击链 passed',
                        'E2E：mage-wars-fx-effect-die-face 在攻击过程中真实可见',
                    ],
                },
                {
                    requirement: '效果骰达到 8 后产生燃烧可用事件并把燃烧 token 落到目标单位',
                    status: 'PASS',
                    evidence: [
                        `E2E：第 ${successfulAttempt} 次真实攻击的服务端事件包含 MW_ARENA_OBJECT_ATTACK_STATUS_EFFECT_AVAILABLE`,
                        'E2E：服务端目标对象 statusTokens.burn > 0',
                    ],
                },
                {
                    requirement: '截图与 GIF 必须来自同一个有效果骰近战 E2E 运行，且 GIF 覆盖斩击、效果骰与结果落地',
                    status: 'PASS',
                    evidence: [
                        recording.finalGifPath!,
                        'E2E：本用例使用同一个 staging evidenceRun 生成截图、帧目录、GIF 和 PASS 清单',
                    ],
                },
            ],
        });
        await promoteEvidenceScreenshotRun(evidenceRun);
        rebaseMageWarsTestAnnotations(testInfo, recording);
    });

    test(MAGE_WARS_CURRENT_SCOPE_CANDIDATE_TEST_NAME, async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(420_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const healingRecording = createMageWarsFxVideoRecording(testInfo, { fileLabel: '治疗之光' });
        let healingGifCapture: MageWarsFxGifCapture | null = null;
        const setupData = await selectMageWarsCurrentScopeSetupDataViaLocalGate(browser, baseURL, testInfo);
        const match = await setupOnlineMageWars(browser, baseURL, {}, setupData);
        const hostDiagnostics = attachPageDiagnostics(match.hostPage);
        const guestDiagnostics = attachPageDiagnostics(match.guestPage);
        const diagnostics = [
            { label: 'host', diagnostics: hostDiagnostics },
            { label: 'guest', diagnostics: guestDiagnostics },
        ];

        try {
            await advanceBothPlayersToPlanning(match);
            await planNamedSpells(match.hostPage, ['野性山猫']);
            await planNamedSpells(match.guestPage, ['阿希拉牧师']);
            await expect(match.hostPage.getByTestId('mage-wars-opponent-prepared-mirror')).toBeVisible();
            await expect(match.guestPage.getByTestId('mage-wars-opponent-prepared-mirror')).toBeVisible();
            await expect(match.hostPage.locator('[data-testid="mage-wars-opponent-prepared-mirror"] img[alt="隐藏计划"]')).toHaveCount(2);
            await expect(match.guestPage.locator('[data-testid="mage-wars-opponent-prepared-mirror"] img[alt="隐藏计划"]')).toHaveCount(2);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '04-双方计划后-对手计划仍隐藏');

            const hostSummon = await deployCreatureWithSummonProcessEvidence(
                match,
                match.hostPage,
                '0',
                '野性山猫',
                ARENA_ZONE_IDS.A3,
                testInfo,
                '09A-兽王野性山猫',
                diagnostics,
            );
            expect(hostSummon.sourceCardId).toBe(2906);
            await match.hostPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });

            const guestSummon = await deployCreatureWithSummonProcessEvidence(
                match,
                match.guestPage,
                '1',
                '阿希拉牧师',
                ARENA_ZONE_IDS.D1,
                testInfo,
                '09B-女祭司阿希拉牧师',
                diagnostics,
            );
            expect(guestSummon.sourceCardId).toBe(2811);
            await match.guestPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });

            const hostBobcatSnapshot = await readZoneFieldCardSnapshot(match.hostPage, 'a3', 2906, '野性山猫部署后');
            const guestClericSnapshot = await readZoneFieldCardSnapshot(match.guestPage, 'd1', 2811, '阿希拉牧师部署后');
            const hostBobcatObjectId = hostBobcatSnapshot.objectId;
            const guestClericObjectId = guestClericSnapshot.objectId;
            if (!hostBobcatObjectId) throw new Error('野性山猫没有对象 ID，无法核对后续结界锚点');
            if (!guestClericObjectId) throw new Error('阿希拉牧师没有对象 ID，无法核对后续魔物锚点');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '09-两派系生物部署后-兽王女祭司各有场上生物');

            await advanceToReadyFieldObjectAction(match, '0', 'a3', 2906, '野性山猫', diagnostics);
            await clickFieldObject(
                match.hostPage,
                match.hostPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${hostBobcatObjectId}"]`).first(),
                '野性山猫移动前选择来源',
            );
            await clickLegalMoveZone(match.hostPage, 'a2', '野性山猫移动到相邻格以验证攻击法术路径');
            await waitForZoneFieldCard(match.hostPage, 'a2', 2906, '野性山猫移动后', {
                match,
                playerId: '0',
                diagnostics,
            });
            const hostBobcatById = match.hostPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${hostBobcatObjectId}"]`).first();

            await advanceToNextPlanningPhase(match, diagnostics);
            await planNamedSpells(match.hostPage, ['公牛耐力', '犀牛兽皮']);
            await planNamedSpells(match.guestPage, ['风龙皮甲', '公牛耐力']);
            const secondRoundOrder = await resolveCurrentActorOrder(match, '装备和结界代表链', diagnostics);
            for (const actorId of secondRoundOrder) {
                if (actorId === '0') {
                    await castPreparedSpellOnFieldObject(match.hostPage, '公牛耐力', hostBobcatById, async () => {
                        await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '兽王结界公牛耐力目标选择截图前');
                        await saveEvidenceScreenshot(
                            match.hostPage,
                            testInfo,
                            '10A-兽王结界公牛耐力施放前-野性山猫为绿色合法目标',
                        );
                    });
                    await expectServerObject(match.hostPage, match, '0', {
                        sourceSpellCardId: 1808,
                        kind: 'enchantment',
                        ownerId: '0',
                        anchoredToObjectId: hostBobcatObjectId,
                        revealed: true,
                    }, '兽王结界公牛耐力应通过正式页面施放并附着到野性山猫');

                    await castPreparedSpellOnFieldObject(match.hostPage, '犀牛兽皮', hostBobcatById, async () => {
                        await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '兽王结界犀牛兽皮目标选择截图前');
                        await saveEvidenceScreenshot(
                            match.hostPage,
                            testInfo,
                            '10B-兽王结界犀牛兽皮施放前-野性山猫为绿色合法目标',
                        );
                    });
                    await expectServerObject(match.hostPage, match, '0', {
                        sourceSpellCardId: 1917,
                        kind: 'enchantment',
                        ownerId: '0',
                        anchoredToObjectId: hostBobcatObjectId,
                        revealed: true,
                    }, '兽王结界犀牛兽皮应通过正式页面施放并附着到野性山猫');
                    await match.hostPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });
                    continue;
                }

                await castPreparedSpellOnMage(match.guestPage, '风龙皮甲', '1', async () => {
                    await waitForVisibleMageWarsAtlasCardsLoaded(match.guestPage, '女祭司装备风龙皮甲目标选择截图前');
                    await saveEvidenceScreenshot(
                        match.guestPage,
                        testInfo,
                        '10C-女祭司装备风龙皮甲施放前-女祭司法师为绿色合法目标',
                    );
                });
                await expectServerObject(match.guestPage, match, '1', {
                    sourceSpellCardId: 3708,
                    kind: 'equipment',
                    ownerId: '1',
                    anchoredToPlayerId: '1',
                }, '女祭司装备风龙皮甲应通过正式页面施放并附着到女祭司法师');

                const guestClericById = match.guestPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${guestClericObjectId}"]`).first();
                await castPreparedSpellOnFieldObject(match.guestPage, '公牛耐力', guestClericById, async () => {
                    await waitForVisibleMageWarsAtlasCardsLoaded(match.guestPage, '女祭司结界公牛耐力目标选择截图前');
                    await saveEvidenceScreenshot(
                        match.guestPage,
                        testInfo,
                        '10D-女祭司结界公牛耐力施放前-阿希拉牧师为绿色合法目标',
                    );
                });
                await expectServerObject(match.guestPage, match, '1', {
                    sourceSpellCardId: 1808,
                    kind: 'enchantment',
                    ownerId: '1',
                    anchoredToObjectId: guestClericObjectId,
                    revealed: true,
                }, '女祭司结界公牛耐力应通过正式页面施放并附着到阿希拉牧师');
                await match.guestPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });
            }
            const guestMageEquipment = match.hostPage.locator('[data-testid="mage-wars-attached-card"][data-source-card-id="3708"][data-attachment-kind="equipment"]').first();
            const enduranceAttachments = match.hostPage.locator('[data-testid="mage-wars-attached-card"][data-source-card-id="1808"][data-attachment-kind="enchantment"]');
            const hostCreatureHide = match.hostPage.locator('[data-testid="mage-wars-attached-card"][data-source-card-id="1917"][data-attachment-kind="enchantment"]').first();
            await expect(enduranceAttachments).toHaveCount(2);
            const hostCreatureEndurance = enduranceAttachments.first();
            const guestCreatureEnchantment = enduranceAttachments.nth(1);
            const attachedCards = [guestMageEquipment, hostCreatureEndurance, hostCreatureHide, guestCreatureEnchantment];
            for (const attachedCard of attachedCards) {
                await expect(attachedCard).toBeVisible();
                await expectNoExternalAttachmentTypeLabel(attachedCard);
            }
            await expect(match.hostPage.locator('[data-testid="mage-wars-zone-field-card"][data-source-card-id="3708"]')).toHaveCount(0);
            await expect(match.hostPage.locator('[data-testid="mage-wars-zone-field-card"][data-source-card-id="1808"]')).toHaveCount(0);
            await expect(match.hostPage.locator('[data-testid="mage-wars-zone-field-card"][data-source-card-id="1917"]')).toHaveCount(0);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '10E-装备和结界最终附着结果-两派系附着关系可见');

            await advanceToNextPlanningPhase(match, diagnostics);
            await planNamedSpells(match.hostPage, ['荆棘之墙']);
            await planNamedSpells(match.guestPage, ['皇家箭手']);
            const wallRoundOrder = await resolveCurrentActorOrder(match, '墙体主链整合', diagnostics);
            const wallSpellCardId = 25700;
            const wallEdgeId = 'a3-b3';
            for (const actorId of wallRoundOrder) {
                if (actorId === '0') {
                    const preparedWall = match.hostPage.locator(`${SELF_PREPARED_CARD_SELECTOR}[data-source-card-id="${wallSpellCardId}"]`).first();
                    await advanceUntilEnabled(match.hostPage, preparedWall);
                    await selectPreparedSpell(match.hostPage, preparedWall, '荆棘之墙');
                    const targetWallEdge = match.hostPage.getByTestId(`mage-wars-wall-edge-${wallEdgeId}`);
                    await expect(targetWallEdge).toHaveAttribute('data-legal-target-wall-edge', 'true', { timeout: 3_000 });
                    await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '主候选链墙体边界选择截图前');
                    await saveEvidenceScreenshot(match.hostPage, testInfo, '10F-荆棘之墙施放前-A3-B3边界可选');
                    await targetWallEdge.click({ timeout: 3_000, noWaitAfter: true });

                    await expect.poll(async () => {
                        const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                        return hasWallSnapshot(snapshot, wallEdgeId, wallSpellCardId)
                            && hasWallSummonedEvent(snapshot, wallEdgeId, wallSpellCardId)
                            && hasEvent(snapshot, MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED, (payload) => (
                                payload.spellCardId === wallSpellCardId
                                && payload.targetWallEdgeId === wallEdgeId
                            ));
                    }, {
                        message: '主候选链中荆棘之墙应通过正式页面写入 A3-B3 墙体状态和施放事件',
                        timeout: 5_000,
                    }).toBe(true);
                    await expect(targetWallEdge).toHaveAttribute('data-wall-object', 'true', { timeout: 3_000 });
                    const targetWallCardPreview = targetWallEdge.getByTestId('mage-wars-wall-card-preview');
                    await expect(targetWallCardPreview).toBeVisible({ timeout: 3_000 });
                    await expect(targetWallCardPreview).toHaveAttribute('data-source-card-id', String(wallSpellCardId));
                    await expect(targetWallCardPreview).toHaveAttribute('data-wall-visual', 'spell-card');
                    const targetWallCardRect = await targetWallCardPreview.evaluate((element) => {
                        const rect = element.getBoundingClientRect();
                        return { width: rect.width, height: rect.height };
                    });
                    expect(
                        Math.min(targetWallCardRect.width, targetWallCardRect.height),
                        '墙牌视觉本体在真实桌面缩放后仍需保持可读尺寸',
                    ).toBeGreaterThanOrEqual(70);
                    await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '主候选链墙体施放完成截图前');
                    await saveEvidenceScreenshot(match.hostPage, testInfo, '10G-荆棘之墙施放后-A3-B3边界墙牌可见');

                    await match.hostPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });
                    continue;
                }

                await match.guestPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });
            }

            await advanceToNextPlanningPhase(match, diagnostics);
            await planNamedSpells(match.hostPage, ['缠绕藤蔓', '间歇喷泉']);
            await planNamedSpells(match.guestPage, ['圣光之柱']);
            const thirdRoundOrder = await resolveCurrentActorOrder(match, '魔物和攻击代表链', diagnostics);
            for (const actorId of thirdRoundOrder) {
                if (actorId === '0') {
                    const hostTargetBobcat = match.hostPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${hostBobcatObjectId}"]`).first();
                    await castPreparedSpellOnFieldObject(match.hostPage, '缠绕藤蔓', hostTargetBobcat);
                    await expectServerObject(match.hostPage, match, '0', {
                        sourceSpellCardId: 2224,
                        kind: 'conjuration',
                        ownerId: '0',
                        anchoredToObjectId: hostBobcatObjectId,
                    }, '兽王魔物缠绕藤蔓应通过正式页面施放并锚定同区野性山猫');
                    await expect.poll(async () => {
                        const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                        const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
                        const bobcat = isRecord(objects[hostBobcatObjectId]) ? objects[hostBobcatObjectId] : {};
                        return typeof bobcat.restrainedByObjectId === 'string' && bobcat.restrainedByObjectId.length > 0;
                    }, {
                        message: '缠绕藤蔓结算后野性山猫应进入被束缚状态',
                        timeout: 5_000,
                    }).toBe(true);

                    let geyserAttackFxAuditPromise: ReturnType<typeof captureMageWarsFxProcessScreenshots> | undefined;
                    await startMageWarsAttackDamageFloatProbe(match.hostPage);
                    await castPreparedSpellOnFieldObject(match.hostPage, '间歇喷泉', hostTargetBobcat, () => {
                        geyserAttackFxAuditPromise = captureMageWarsFxProcessScreenshots(
                            match.hostPage,
                            testInfo,
                            'attack',
                            '11A-间歇喷泉攻击法术',
                            {
                                expectTravel: true,
                                expectDamageFloat: true,
                                startDamageFloatProbe: false,
                            },
                        );
                    });
                    if (!geyserAttackFxAuditPromise) {
                        throw new Error('间歇喷泉点击前未启动攻击 FX 捕捉');
                    }
                    const geyserAttackFxAudit = await geyserAttackFxAuditPromise;
                    expect(geyserAttackFxAudit.targetRow).toBe('1');
                    expect(geyserAttackFxAudit.targetCol).toBe('0');
                    await expect.poll(async () => {
                        const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                        return hasSpellAttackRolledEvent(snapshot, 1710, hostBobcatObjectId)
                            && hasDamageDealtEvent(snapshot, hostBobcatObjectId, 'mw.spell.1710');
                    }, {
                        message: '兽王攻击法术间歇喷泉应通过正式页面产生攻击掷骰和真实伤害事件',
                        timeout: 5_000,
                    }).toBe(true);
                    await match.hostPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });
                    continue;
                }

                await match.guestPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });
            }
            await saveEvidenceScreenshot(match.hostPage, testInfo, '11-缠绕藤蔓和攻击法术结算后-魔物与攻击效果可见');
            await advanceUntilBothPlayersReachPlanningPhase(match, diagnostics);
            await expect(match.hostPage.getByTestId('mage-wars-plan-spells')).toHaveAttribute('data-main-action-mode', 'plan-spells', { timeout: 5_000 });
            await expect(match.guestPage.getByTestId('mage-wars-plan-spells')).toHaveAttribute('data-main-action-mode', 'plan-spells', { timeout: 5_000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '12-候选链收口-回到下一轮计划阶段');

            const woundedBobcatDamageAfterGeyser = await readServerObjectDamage(
                match.hostPage,
                match,
                '0',
                hostBobcatObjectId,
                '间歇喷泉结算后应能读取野性山猫真实伤害',
            );
            expect(woundedBobcatDamageAfterGeyser).toBeGreaterThan(0);

            const clericPathToWoundedBobcat: Array<[ArenaZoneId, ArenaZoneId]> = [
                [ARENA_ZONE_IDS.D1, ARENA_ZONE_IDS.C1],
                [ARENA_ZONE_IDS.C1, ARENA_ZONE_IDS.B1],
                [ARENA_ZONE_IDS.B1, ARENA_ZONE_IDS.A1],
                [ARENA_ZONE_IDS.A1, ARENA_ZONE_IDS.A2],
            ];
            for (const [fromZoneId, toZoneId] of clericPathToWoundedBobcat) {
                await moveFieldObjectOneZone(
                    match,
                    '1',
                    guestClericObjectId,
                    2811,
                    fromZoneId,
                    toZoneId,
                    '阿希拉牧师',
                    diagnostics,
                );
            }
            await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '阿希拉牧师自然移动到受伤山猫同区截图前');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '13-阿希拉牧师自然移动到A2-与受伤野性山猫同区');

            await advanceToReadyFieldObjectAction(match, '1', ARENA_ZONE_IDS.A2, 2811, '阿希拉牧师', diagnostics);
            const guestClericOnGuestPage = match.guestPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${guestClericObjectId}"]`).first();
            await clickFieldObject(match.guestPage, guestClericOnGuestPage, '阿希拉牧师守卫前选择来源');
            const guardButton = match.guestPage.getByTestId('mage-wars-selected-unit-guard');
            await expect(guardButton).toBeVisible({ timeout: 3_000 });
            await guardButton.click({ timeout: 3_000, noWaitAfter: true });
            await expectServerObjectGuarding(
                match.hostPage,
                match,
                '0',
                guestClericObjectId,
                true,
                '阿希拉牧师通过正式页面守卫后应带守卫标记',
            );
            await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '守卫动作截图前');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '14-守卫动作后-阿希拉牧师守卫标记可见');

            // 守卫标记按规则持续到守卫生物自己的下一个行动阶段开始。
            // 当前候选链在完成前置自然动作后已经跨过了回合重置，因此这里仅预置
            // “仍处于守卫状态、双方都已进入生物行动阶段”的前置条件；攻击、反击
            // 响应和守卫移除仍全部由正式页面真实点击完成，并在 evidence 中标为代表态。
            await injectMageWarsCurrentScopeCoverageReadyState(match, '0', {
                phase: 'creatureAction',
                objectPatches: {
                    [hostBobcatObjectId]: {
                        zoneId: ARENA_ZONE_IDS.A2,
                        actionReady: true,
                    },
                    [guestClericObjectId]: {
                        zoneId: ARENA_ZONE_IDS.A2,
                        actionReady: true,
                        guarding: true,
                    },
                },
            });
            await expectServerObjectGuarding(
                match.hostPage,
                match,
                '0',
                guestClericObjectId,
                true,
                '守卫移除代表态的真实攻击前置必须仍保留守卫标记',
            );
            const hostBobcatForGuardAttack = match.hostPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${hostBobcatObjectId}"]`).first();
            const guestClericOnHostPage = match.hostPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${guestClericObjectId}"]`).first();
            await clickFieldObject(match.hostPage, hostBobcatForGuardAttack, '野性山猫近战攻击守卫生物前选择来源');
            await expect(guestClericOnHostPage.locator('[data-testid="mage-wars-field-card-target-frame"]')).toBeVisible({ timeout: 3_000 });
            await clickFieldObject(match.hostPage, guestClericOnHostPage, '野性山猫近战攻击守卫的阿希拉牧师');
            await expectServerObjectGuarding(
                match.hostPage,
                match,
                '0',
                guestClericObjectId,
                false,
                '同格近战攻击守卫生物后守卫标记应被移除',
            );
            try {
                await expect.poll(async () => (
                    await (async () => {
                        const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                        return hasEvent(
                            snapshot,
                            'MW_GUARD_REMOVED',
                            (payload) => payload.targetObjectId === guestClericObjectId,
                        ) || hasEvent(
                            snapshot,
                            'MW_ARENA_OBJECT_ATTACK_GUARD_REMOVAL_AVAILABLE',
                            (payload) => payload.targetObjectId === guestClericObjectId,
                        );
                    })()
                ), {
                    message: '近战攻击守卫生物应产生守卫移除机会或最终守卫移除事件',
                    timeout: 5_000,
                }).toBe(true);
            } catch (error) {
                const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                throw new Error([
                    '近战攻击守卫生物应产生守卫移除机会或最终守卫移除事件',
                    `guardObjectId=${guestClericObjectId}`,
                    `serverSnapshot=${JSON.stringify(snapshot, null, 2)}`,
                    error instanceof Error ? error.message : String(error),
                ].join('\n'));
            }
            await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '近战攻击守卫生物截图前');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '15-近战攻击守卫生物后-守卫标记移除');
            const counterstrikeDock = match.guestPage.getByTestId('mage-wars-interaction-dock');
            await expect(counterstrikeDock).toBeVisible({ timeout: 5_000 });
            await expect(counterstrikeDock).toContainText('可以反击');
            await expect(counterstrikeDock.getByTestId('mage-wars-interaction-option')).toHaveCount(2);
            await expect(counterstrikeDock.locator('[data-testid="mage-wars-interaction-option"][data-option-id="counterstrike"]')).toBeVisible();
            await expect(counterstrikeDock.locator('[data-testid="mage-wars-interaction-option"][data-option-id="pass"]')).toBeVisible();
            await respondMageWarsInteractionOption(match.guestPage, 'pass', '阿希拉牧师守卫反击响应', async () => {
                await waitForVisibleMageWarsAtlasCardsLoaded(match.guestPage, '守卫反击响应窗口截图前');
                await saveEvidenceScreenshot(match.guestPage, testInfo, '15A-守卫生物被攻击后-反击响应可见');
            });
            await expect.poll(async () => (
                hasEvent(
                    await readServerCoreSnapshot(match.guestPage, match, '1'),
                    'SYS_INTERACTION_RESOLVED',
                    (payload) => (
                        payload.playerId === '1'
                        && payload.sourceId === 'mw.counterstrike.choice'
                        && payload.optionId === 'pass'
                    ),
                )
            ), {
                message: '阿希拉牧师应通过正式页面选择放弃反击并写入交互已解决事件',
                timeout: 5_000,
            }).toBe(true);
            await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '放弃反击后守卫响应收口截图前');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '15B-放弃反击后-守卫响应收口');

            await match.hostPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });
            await advanceToReadyFieldObjectAction(match, '1', ARENA_ZONE_IDS.A2, 2811, '阿希拉牧师', diagnostics);
            const woundedBobcatDamage = await readServerObjectDamage(
                match.guestPage,
                match,
                '1',
                hostBobcatObjectId,
                '阿希拉牧师治疗之光前应能读取受伤野性山猫真实伤害',
            );
            expect(woundedBobcatDamage).toBeGreaterThan(0);
            const guestClericForHealing = match.guestPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${guestClericObjectId}"]`).first();
            const hostBobcatForHealing = match.guestPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${hostBobcatObjectId}"]`).first();
            await clickFieldObject(match.guestPage, guestClericForHealing, '阿希拉牧师治疗之光前选择来源');
            const healingLightButton = match.guestPage.getByTestId('mage-wars-selected-object-ability-healing-light');
            await expect(healingLightButton).toBeVisible({ timeout: 3_000 });
            const healingAbilityDock = match.guestPage.getByTestId('mage-wars-selected-ability-action-dock');
            await expect(healingAbilityDock).toBeVisible({ timeout: 3_000 });
            await expect(healingAbilityDock).toHaveAttribute('data-ability-action-placement', 'source-card-below');
            await expect(healingAbilityDock).toHaveAttribute('data-ability-source-key', `object:${guestClericObjectId}`);
            const healingPlacement = await match.guestPage.evaluate((objectId) => {
                const source = document.querySelector<HTMLElement>(
                    `[data-testid="mage-wars-zone-field-card"][data-object-id="${objectId}"]`,
                );
                const dock = document.querySelector<HTMLElement>('[data-testid="mage-wars-selected-ability-action-dock"]');
                if (!source || !dock) return null;
                const sourceRect = source.getBoundingClientRect();
                const dockRect = dock.getBoundingClientRect();
                return {
                    sourceBottom: sourceRect.bottom,
                    dockTop: dockRect.top,
                    centerDelta: Math.abs(
                        (sourceRect.left + sourceRect.width / 2) - (dockRect.left + dockRect.width / 2),
                    ),
                    anchoredToSource: dock.getAttribute('data-ability-source-key') === `object:${objectId}`,
                    renderedInBodyOverlay: dock.parentElement === document.body,
                };
            }, guestClericObjectId);
            expect(healingPlacement).not.toBeNull();
            expect(healingPlacement!.dockTop).toBeGreaterThanOrEqual(healingPlacement!.sourceBottom);
            expect(healingPlacement!.centerDelta).toBeLessThanOrEqual(8);
            expect(healingPlacement!.anchoredToSource).toBe(true);
            expect(healingPlacement!.renderedInBodyOverlay).toBe(true);
            await expect(healingLightButton).toHaveAttribute('data-ability-visual', 'text-action');
            await expect(healingLightButton).toHaveAttribute('data-ability-action-placement', 'source-card-below');
            await expect(healingLightButton.locator('img')).toHaveCount(0);
            await expect(healingLightButton.locator('svg')).toHaveCount(0);
            await expect(healingLightButton).toContainText('治疗之光');
            await saveEvidenceScreenshot(match.guestPage, testInfo, '16A-阿希拉牧师治疗之光入口-来源卡牌下方动作按钮可见');
            await healingLightButton.click({ timeout: 3_000, noWaitAfter: true });
            await expect(hostBobcatForHealing.locator('[data-testid="mage-wars-field-card-target-frame"]')).toBeVisible({ timeout: 3_000 });
            healingGifCapture = await startMageWarsFxGifCapture(match.guestPage, healingRecording);
            const healingFxAuditPromise = captureMageWarsFxProcessScreenshots(
                match.guestPage,
                testInfo,
                'healing',
                '16-阿希拉牧师治疗之光',
                {
                    expectHealingFloat: true,
                    captureFrame: (animations) => healingGifCapture?.capture(animations) ?? Promise.resolve(),
                },
            );
            await clickFieldObject(match.guestPage, hostBobcatForHealing, '阿希拉牧师治疗之光选择受伤野性山猫');
            const healingFxAudit = await healingFxAuditPromise;
            await healingGifCapture.stop();
            expect(healingFxAudit.targetAnchorId).toBe(hostBobcatObjectId);
            await expect.poll(async () => (
                hasArenaObjectAbilityResolvedEvent(
                    await readServerCoreSnapshot(match.guestPage, match, '1'),
                    MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
                    hostBobcatObjectId,
                )
            ), {
                message: '阿希拉牧师治疗之光应通过正式页面产生对象主动能力结算事件',
                timeout: 5_000,
            }).toBe(true);
            await expect.poll(async () => (
                hasEvent(
                    await readServerCoreSnapshot(match.guestPage, match, '1'),
                    'MW_SPELL_HEALING_ROLLED',
                    (payload) => payload.sourceAbilityId === MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT
                        && payload.targetObjectId === hostBobcatObjectId
                        && typeof payload.actualHealing === 'number'
                        && payload.actualHealing > 0,
                )
            ), {
                message: '阿希拉牧师治疗之光应产生治疗掷骰事件',
                timeout: 5_000,
            }).toBe(true);
            await expectServerObjectDamageLessThan(
                match.guestPage,
                match,
                '1',
                hostBobcatObjectId,
                woundedBobcatDamage,
                '阿希拉牧师治疗之光结算后野性山猫伤害应降低',
            );
            await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '阿希拉牧师治疗之光截图前');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '16-阿希拉牧师治疗之光结算后-治疗能力可见');

            const restoreClericObjectId = 'mw-e2e-priestess-restore-cleric';
            const burningCleric = {
                ...createMageWarsE2eCreatureObject(
                    restoreClericObjectId,
                    '1',
                    2811,
                    '阿希拉牧师',
                    ARENA_ZONE_IDS.C2,
                ),
                zoneId: ARENA_ZONE_IDS.C2,
                damage: 0,
                actionReady: true,
                guarding: false,
                statusTokens: {
                    [STATUS_TOKEN_IDS.BURN]: 1,
                },
            };
            await injectMageWarsCurrentScopeCoverageReadyState(match, '1', {
                phase: 'initiativeQuickcast',
                replaceObjects: true,
                objects: [burningCleric],
                playerPatches: {
                    '0': { mageZoneId: ARENA_ZONE_IDS.A1 },
                    '1': {
                        mageZoneId: ARENA_ZONE_IDS.C2,
                        mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                        mana: 10,
                        quickcastReady: true,
                        actionReady: true,
                    },
                },
            });
            await clickMageEntity(match.guestPage, '1', '女祭司复原术前选择法师本体');
            const restoreButton = match.guestPage.getByTestId('mage-wars-selected-mage-ability-restore');
            await expect(restoreButton).toBeVisible({ timeout: 3_000 });
            const restoreAbilityDock = match.guestPage.getByTestId('mage-wars-selected-ability-action-dock');
            await expect(restoreAbilityDock).toBeVisible({ timeout: 3_000 });
            await expect(restoreAbilityDock).toHaveAttribute('data-ability-action-placement', 'source-card-below');
            await expect(restoreAbilityDock).toHaveAttribute('data-ability-source-key', 'mage:1');
            const restorePlacement = await match.guestPage.evaluate(() => {
                const source = document.querySelector<HTMLElement>(
                    '[data-testid="mage-wars-zone-mage-entity"][data-player-id="1"]',
                );
                const dock = document.querySelector<HTMLElement>('[data-testid="mage-wars-selected-ability-action-dock"]');
                if (!source || !dock) return null;
                const sourceRect = source.getBoundingClientRect();
                const dockRect = dock.getBoundingClientRect();
                return {
                    sourceBottom: sourceRect.bottom,
                    dockTop: dockRect.top,
                    centerDelta: Math.abs(
                        (sourceRect.left + sourceRect.width / 2) - (dockRect.left + dockRect.width / 2),
                    ),
                    anchoredToSource: dock.getAttribute('data-ability-source-key') === 'mage:1',
                    renderedInBodyOverlay: dock.parentElement === document.body,
                };
            });
            expect(restorePlacement).not.toBeNull();
            expect(restorePlacement!.dockTop).toBeGreaterThanOrEqual(restorePlacement!.sourceBottom);
            expect(restorePlacement!.centerDelta).toBeLessThanOrEqual(8);
            expect(restorePlacement!.anchoredToSource).toBe(true);
            expect(restorePlacement!.renderedInBodyOverlay).toBe(true);
            await expect(restoreButton).toHaveAttribute('data-ability-visual', 'text-action');
            await expect(restoreButton).toHaveAttribute('data-ability-action-placement', 'source-card-below');
            await expect(restoreButton.locator('img')).toHaveCount(0);
            await expect(restoreButton.locator('svg')).toHaveCount(0);
            await expect(restoreButton).toContainText('复原术');
            await restoreButton.click({ timeout: 3_000, noWaitAfter: true });
            const burningClericTarget = match.guestPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${restoreClericObjectId}"]`).first();
            await expect(burningClericTarget.locator('[data-testid="mage-wars-field-card-target-frame"]')).toBeVisible({ timeout: 3_000 });
            await clickFieldObject(match.guestPage, burningClericTarget, '女祭司复原术选择带燃烧的阿希拉牧师');
            await expect.poll(async () => (
                hasMageAbilityResolvedEvent(
                    await readServerCoreSnapshot(match.guestPage, match, '1'),
                    MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_QUICK,
                    restoreClericObjectId,
                )
            ), {
                message: '女祭司复原术应通过正式页面产生法师能力结算事件',
                timeout: 5_000,
            }).toBe(true);
            await expect.poll(async () => (
                hasStatusTokenRemovedEvent(
                    await readServerCoreSnapshot(match.guestPage, match, '1'),
                    STATUS_TOKEN_IDS.BURN,
                    restoreClericObjectId,
                )
            ), {
                message: '女祭司复原术应产生燃烧移除事件',
                timeout: 5_000,
            }).toBe(true);
            await expectServerObjectStatusMissing(
                match.guestPage,
                match,
                '1',
                restoreClericObjectId,
                STATUS_TOKEN_IDS.BURN,
                '女祭司复原术结算后目标燃烧标记应消失',
            );
            await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '女祭司复原术截图前');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '17-女祭司复原术代表态移除燃烧后-状态标记消失');

            const guestLifeBeforeFinish = await readServerCoreSnapshot(match.hostPage, match, '0').then((snapshot) => {
                const players = isRecord(snapshot.players) ? snapshot.players : {};
                const guest = isRecord(players['1']) ? players['1'] : {};
                return typeof guest.life === 'number' ? guest.life : 24;
            });
            await injectMageWarsCurrentScopeCoverageReadyState(match, '0', {
                replaceObjects: true,
                playerPatches: {
                    '0': {
                        mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.B2,
                        actionReady: true,
                        guarding: false,
                    },
                    '1': {
                        mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.B2,
                        damage: Math.max(0, guestLifeBeforeFinish - 1),
                        actionReady: true,
                        guarding: false,
                    },
                },
            });
            await clickMageEntity(match.hostPage, '0', '近终局基础攻击前选择兽王法师');
            await clickMageEntity(match.hostPage, '1', '兽王基础攻击选择女祭司法师');
            await expectServerGameover(
                match.hostPage,
                match,
                '0',
                '0',
                '兽王基础近战攻击女祭司后应写入胜负结果',
            );
            await expect(match.hostPage.getByTestId('endgame-overlay')).toBeVisible({ timeout: 5_000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '18-近终局代表态基础攻击后-胜负遮罩可见');
        } finally {
            await healingGifCapture?.stop().catch(() => undefined);
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        await finalizeMageWarsFxVideoRecording(testInfo, healingRecording, {
            actionLabel: '治疗之光代表态',
            requirements: [
                {
                    requirement: '正式页面治疗之光独立覆盖：玩家从来源能力入口选择受伤目标，治疗光效、恢复数字、伤害降低和稳定收口来自同一次运行',
                    status: 'PASS',
                    evidence: [
                        'E2E：正式页面点击治疗之光来源、目标并产生对象能力结算和治疗掷骰事件',
                        'E2E：治疗光效和恢复数字过程帧来自当前运行',
                        healingRecording.finalGifPath!,
                    ],
                },
            ],
        });
    });

    test('正式页面隐藏法力失效响应窗口可揭示并反制目标法术', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL);
        const hostDiagnostics = attachPageDiagnostics(match.hostPage, 'host');
        const guestDiagnostics = attachPageDiagnostics(match.guestPage, 'guest');
        const targetObjectId = 'mw-e2e-mana-failure-target';
        const responseObjectId = 'mw-e2e-hidden-mana-failure';
        const targetObject = {
            ...createMageWarsE2eCreatureObject(
                targetObjectId,
                '1',
                2811,
                '阿希拉牧师',
                ARENA_ZONE_IDS.A2,
            ),
            typeLine: '生物 / 人类',
            life: 12,
        };
        const responseObject = createMageWarsE2eHiddenResponseEnchantmentObject(
            responseObjectId,
            '1',
            1901,
            '法力失效',
            ARENA_ZONE_IDS.A2,
            targetObjectId,
        );

        try {
            await injectMageWarsCurrentScopeCoverageReadyState(match, '0', {
                phase: 'initiativeQuickcast',
                replaceObjects: true,
                objects: [targetObject, responseObject],
                playerPatches: {
                    '0': {
                        mageId: MAGE_IDS.WARLOCK_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.A1,
                        mana: 20,
                        quickcastReady: true,
                        actionReady: true,
                        spellbookCount: getStandardStartingSpellbookCount(MAGE_IDS.WARLOCK_APPRENTICE),
                        spellbookEntries: getMageWarsE2eStandardSpellbookEntries(MAGE_IDS.WARLOCK_APPRENTICE),
                        preparedSpellSlots: 1,
                        preparedSpellCardIds: [1800],
                    },
                    '1': {
                        mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.D3,
                        mana: 10,
                        discardSpellCardIds: [1901],
                    },
                },
            });

            const hiddenAttachment = match.guestPage.locator(
                `[data-testid="mage-wars-attached-card"][data-object-id="${responseObjectId}"][data-source-card-id="1901"]`,
            ).first();
            await expect(hiddenAttachment).toBeVisible({ timeout: 3_000 });
            await expectServerObject(match.guestPage, match, '1', {
                sourceSpellCardId: 1901,
                kind: 'enchantment',
                ownerId: '1',
                anchoredToObjectId: targetObjectId,
                revealed: false,
            }, '法力失效代表态应作为未揭示隐藏结界附着在阿希拉牧师身上');
            await waitForVisibleMageWarsAtlasCardsLoaded(match.guestPage, '法力失效隐藏附着截图前');
            await saveEvidenceScreenshot(match.guestPage, testInfo, '23A-法力失效隐藏附着-女祭司视角可见响应结界');

            const targetOnHost = match.hostPage.locator(
                `[data-testid="mage-wars-zone-field-card"][data-object-id="${targetObjectId}"]`,
            ).first();
            await selectPreparedSpell(match.hostPage, selfPreparedCardByName(match.hostPage, '剧痛难当'), '剧痛难当触发法力失效前选择来源');
            await expect(targetOnHost.locator('[data-testid="mage-wars-field-card-target-frame"]')).toBeVisible({ timeout: 3_000 });
            await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '剧痛难当目标选择截图前');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '23B-剧痛难当施放前-阿希拉牧师为合法目标');
            await clickFieldObject(match.hostPage, targetOnHost, '剧痛难当选择带法力失效的阿希拉牧师');

            const responseDock = match.guestPage.getByTestId('mage-wars-interaction-dock');
            await expect(responseDock).toBeVisible({ timeout: 5_000 });
            await expect(responseDock).toContainText('必须展示响应结界');
            const revealOption = responseDock.locator('[data-testid="mage-wars-interaction-option"][data-option-id="reveal"]').first();
            await expect(revealOption).toBeVisible({ timeout: 3_000 });
            await expect(responseDock.getByTestId('mage-wars-interaction-option')).toHaveCount(1);
            await expect(match.hostPage.getByTestId('mage-wars-interaction-dock')).toHaveCount(0);
            await waitForVisibleMageWarsAtlasCardsLoaded(match.guestPage, '法力失效响应窗口截图前');
            await saveEvidenceScreenshot(match.guestPage, testInfo, '23C-法力失效响应窗口-女祭司必须展示结界');

            await revealOption.click({ timeout: 3_000, noWaitAfter: true });
            await expect(responseDock).toHaveCount(0, { timeout: 5_000 });
            await expectServerObjectMissing(
                match.guestPage,
                match,
                '1',
                responseObjectId,
                '法力失效揭示并结算后响应结界对象应被摧毁',
            );
            await expect.poll(async () => {
                const snapshot = await readServerCoreSnapshot(match.guestPage, match, '1');
                const players = isRecord(snapshot.players) ? snapshot.players : {};
                const host = isRecord(players['0']) ? players['0'] : {};
                const guest = isRecord(players['1']) ? players['1'] : {};
                const hostDiscard = Array.isArray(host.discardSpellCardIds) ? host.discardSpellCardIds : [];
                const guestDiscard = Array.isArray(guest.discardSpellCardIds) ? guest.discardSpellCardIds : [];
                return hasEvent(snapshot, 'MW_ENCHANTMENT_REVEALED', (payload) => payload.objectId === responseObjectId)
                    && hasEvent(snapshot, 'MW_SPELL_COUNTERED', (payload) => (
                        payload.spellCardId === 1800
                        && payload.responseCardId === 1901
                        && payload.responseObjectId === responseObjectId
                    ))
                    && hasEvent(snapshot, 'MW_SPELL_DISCARDED', (payload) => (
                        payload.playerId === '0'
                        && payload.spellCardId === 1800
                        && payload.reason === 'cast-countered'
                    ))
                    && hostDiscard.includes(1800)
                    && guestDiscard.includes(1901);
            }, {
                message: '法力失效揭示后应反制剧痛难当，并把被反制法术和响应结界放入对应弃牌',
                timeout: 5_000,
            }).toBe(true);
            await waitForVisibleMageWarsAtlasCardsLoaded(match.guestPage, '法力失效反制结算截图前');
            await saveEvidenceScreenshot(match.guestPage, testInfo, '23D-法力失效揭示后-剧痛难当被反制并入弃牌');
        } finally {
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    });

    test('正式页面群兽法杖附件可从牌面发动并选择治疗模式', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const recording = createMageWarsFxVideoRecording(testInfo, { fileLabel: '群兽法杖治疗' });
        let gifCapture: MageWarsFxGifCapture | null = null;
        const match = await setupOnlineMageWars(browser, baseURL);
        const hostDiagnostics = attachPageDiagnostics(match.hostPage, 'host');
        const guestDiagnostics = attachPageDiagnostics(match.guestPage, 'guest');
        const staffObjectId = 'mw-e2e-beast-staff';
        const animalObjectId = 'mw-e2e-beast-staff-cat';
        const woundedAnimalDamage = 3;
        const beastStaff = createMageWarsE2eEquipmentObject(
            staffObjectId,
            '0',
            3710,
            '群兽法杖',
            ARENA_ZONE_IDS.A3,
            '0',
        );
        const woundedAnimal = {
            ...createMageWarsE2eCreatureObject(
                animalObjectId,
                '0',
                2906,
                '野性山猫',
                ARENA_ZONE_IDS.A3,
            ),
            typeLine: '生物 / 动物、猫科',
            life: 8,
            damage: woundedAnimalDamage,
        };

        try {
            await injectMageWarsCurrentScopeCoverageReadyState(match, '0', {
                phase: 'initiativeQuickcast',
                replaceObjects: true,
                objects: [beastStaff, woundedAnimal],
                playerPatches: {
                    '0': {
                        mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.A3,
                        mana: 10,
                        quickcastReady: true,
                        actionReady: true,
                        spellbookCount: getStandardStartingSpellbookCount(MAGE_IDS.BEASTMASTER_APPRENTICE),
                        spellbookEntries: getMageWarsE2eStandardSpellbookEntries(MAGE_IDS.BEASTMASTER_APPRENTICE),
                    },
                    '1': {
                        mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.D3,
                    },
                },
            });

            const staffCard = match.hostPage.locator(
                `[data-testid="mage-wars-attached-card"][data-object-id="${staffObjectId}"][data-source-card-id="3710"]`,
            ).first();
            const animalCard = match.hostPage.locator(
                `[data-testid="mage-wars-zone-field-card"][data-object-id="${animalObjectId}"]`,
            ).first();
            await expect(staffCard).toBeVisible({ timeout: 3_000 });
            await expect(staffCard).toHaveAttribute('data-attachment-kind', 'equipment');
            await expect(animalCard).toBeVisible({ timeout: 3_000 });

            await staffCard.click({ timeout: 3_000, noWaitAfter: true });
            const abilityDock = match.hostPage.getByTestId('mage-wars-selected-ability-action-dock');
            await expect(abilityDock).toBeVisible({ timeout: 3_000 });
            await expect(abilityDock).toHaveAttribute('data-ability-action-placement', 'source-card-below');
            const abilityButton = abilityDock.locator(`[data-ability-id="${MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF}"]`).first();
            await expect(abilityButton).toBeVisible({ timeout: 3_000 });
            await expect(abilityButton).toHaveAttribute('data-ability-visual', 'text-action');
            await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '群兽法杖入口截图前');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '24A-群兽法杖附件入口-来源卡牌下方能力按钮可见');

            await abilityButton.click({ timeout: 3_000, noWaitAfter: true });
            await expect(animalCard.locator('[data-testid="mage-wars-field-card-target-frame"]')).toBeVisible({ timeout: 3_000 });
            await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '群兽法杖目标选择截图前');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '24B-群兽法杖目标选择-友方动物整卡高亮');
            await clickFieldObject(match.hostPage, animalCard, '群兽法杖选择受伤野性山猫');

            const choiceDock = match.hostPage.getByTestId('mage-wars-object-ability-choice-dock');
            await expect(choiceDock).toBeVisible({ timeout: 3_000 });
            await expect(choiceDock.getByTestId('mage-wars-object-ability-choice-option')).toHaveCount(2);
            const healOption = choiceDock.locator('[data-testid="mage-wars-object-ability-choice-option"][data-mode="heal"]').first();
            const meleeOption = choiceDock.locator('[data-testid="mage-wars-object-ability-choice-option"][data-mode="melee-bonus"]').first();
            await expect(healOption).toBeVisible({ timeout: 3_000 });
            await expect(meleeOption).toBeVisible({ timeout: 3_000 });
            await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '群兽法杖模式选择截图前');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '24C-群兽法杖模式选择-治疗和近战加成需玩家选择');

            await waitForFxLayerIdle(match.hostPage, '群兽法杖治疗模式触发前');
            await waitForTestHarness(match.hostPage);
            const healingDiceReady = await match.hostPage.evaluate(() => {
                const harness = (window as Window & {
                    __BG_TEST_HARNESS__?: {
                        dice?: {
                            setValues?: (values: number[]) => void;
                            remaining?: () => number;
                            getValues?: () => number[];
                        };
                    };
                }).__BG_TEST_HARNESS__;
                harness?.dice?.setValues?.([6, 6]);
                return {
                    hasHarness: Boolean(harness),
                    remaining: harness?.dice?.remaining?.() ?? null,
                    values: harness?.dice?.getValues?.() ?? [],
                };
            });
            expect(healingDiceReady).toMatchObject({
                hasHarness: true,
                remaining: 2,
                values: [6, 6],
            });
            gifCapture = await startMageWarsFxGifCapture(match.hostPage, recording);
            console.log('[MageWars GIF debug] teleport-recorder-started');
            const beastStaffHealingFxAuditPromise = captureMageWarsFxProcessScreenshots(
                match.hostPage,
                testInfo,
                'healing',
                '24D-群兽法杖治疗模式',
                {
                    expectHealingFloat: true,
                    captureFrame: (animations) => gifCapture?.capture(animations) ?? Promise.resolve(),
                },
            );
            await healOption.click({ timeout: 3_000, noWaitAfter: true });
            const beastStaffHealingFxAudit = await beastStaffHealingFxAuditPromise;
            await gifCapture.stop();
            expect(beastStaffHealingFxAudit.targetAnchorId).toBe(animalObjectId);
            await expectServerObjectDamageLessThan(
                match.hostPage,
                match,
                '0',
                animalObjectId,
                woundedAnimalDamage,
                '群兽法杖治疗模式结算后野性山猫伤害应降低',
            );
            await expect.poll(async () => {
                const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                return hasArenaObjectAbilityResolvedEvent(
                    snapshot,
                    MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
                    animalObjectId,
                )
                    && hasEvent(snapshot, 'MW_SPELL_HEALING_ROLLED', (payload) => (
                        payload.sourceAbilityId === MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF
                        && payload.targetObjectId === animalObjectId
                        && typeof payload.actualHealing === 'number'
                        && payload.actualHealing > 0
                    ));
            }, {
                message: '群兽法杖治疗模式应通过正式页面产生附件主动能力事件和治疗掷骰事件',
                timeout: 5_000,
            }).toBe(true);
            await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '群兽法杖治疗结算截图前');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '24E-群兽法杖治疗模式结算后-动物伤害降低');
        } finally {
            await gifCapture?.stop().catch(() => undefined);
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        await finalizeMageWarsFxVideoRecording(testInfo, recording, {
            actionLabel: '群兽法杖治疗代表态',
            requirements: [
                {
                    requirement: '正式页面群兽法杖治疗独立覆盖：玩家完成附件入口、目标选择和治疗模式选择后，治疗光效、恢复数字、伤害降低和稳定收口来自同一次运行',
                    status: 'PASS',
                    evidence: [
                        'E2E：附件入口、友方动物目标选择和治疗 / 近战模式选择均由真实页面完成',
                        'E2E：群兽法杖治疗掷骰、实际治疗和伤害降低均来自当前运行',
                        recording.finalGifPath!,
                    ],
                },
            ],
        });
    });

    test('正式页面元素魔杖施放和快速重绑覆盖法术选择 UI', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await runMageWarsStaffBindingUiCase(browser, baseURL, testInfo, {
            cardId: 3716,
            cardName: '元素魔杖',
            mageId: MAGE_IDS.WIZARD_APPRENTICE,
            abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ELEMENTAL_STAFF_BIND,
            initialBoundSpellCardId: 1704,
            castBoundSpellCardId: 1705,
            reboundBoundSpellCardId: 1705,
        });
    });

    test('正式页面法师魔杖施放和快速重绑覆盖法术选择 UI', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await runMageWarsStaffBindingUiCase(browser, baseURL, testInfo, {
            cardId: 3725,
            cardName: '法师魔杖',
            mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
            abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.MAGE_STAFF_BIND,
            initialBoundSpellCardId: 3403,
            castBoundSpellCardId: 3403,
            reboundBoundSpellCardId: 3417,
        });
    });

    test('正式页面选择 UI 的取消分支和女祭司多状态选项覆盖真实交互', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL);
        const hostDiagnostics = attachPageDiagnostics(match.hostPage, 'host');
        const guestDiagnostics = attachPageDiagnostics(match.guestPage, 'guest');

        try {
            await injectMageWarsCurrentScopeCoverageReadyState(match, '0', {
                phase: 'initiativeQuickcast',
                replaceObjects: true,
                playerPatches: {
                    '0': {
                        mageId: MAGE_IDS.WIZARD_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.A3,
                        mana: 12,
                        spellbookEntries: getMageWarsE2eStandardSpellbookEntries(MAGE_IDS.WIZARD_APPRENTICE),
                        spellbookCount: getStandardStartingSpellbookCount(MAGE_IDS.WIZARD_APPRENTICE),
                        preparedSpellSlots: 1,
                        preparedSpellCardIds: [3716],
                    },
                    '1': {
                        mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.D3,
                        preparedSpellCardIds: [],
                        preparedSpellSlots: 0,
                    },
                },
            });

            const elementalStaffCard = selfPreparedCardByName(match.hostPage, '元素魔杖');
            await selectPreparedSpell(match.hostPage, elementalStaffCard, '元素魔杖取消分支');
            await clickMageEntity(match.hostPage, '0', '元素魔杖取消分支选择己方法师');
            const spellCastChoiceDock = match.hostPage.getByTestId('mage-wars-spell-cast-choice-dock');
            await expect(spellCastChoiceDock).toBeVisible({ timeout: 3_000 });
            await expect.poll(async () => (
                await spellCastChoiceDock.getByTestId('mage-wars-spell-cast-choice-option').count()
            )).toBeGreaterThanOrEqual(2);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '01-元素魔杖法术选择-取消按钮可见');

            await spellCastChoiceDock.getByTestId('mage-wars-spell-cast-choice-cancel').click();
            await expect(spellCastChoiceDock).toHaveCount(0, { timeout: 5_000 });
            await expect(elementalStaffCard).toHaveAttribute('data-selected', 'true');
            const afterSpellCastCancel = await readServerCoreSnapshot(match.hostPage, match, '0');
            const afterSpellCastCancelPlayer = isRecord(afterSpellCastCancel.players)
                && isRecord(afterSpellCastCancel.players['0'])
                ? afterSpellCastCancel.players['0']
                : {};
            expect(afterSpellCastCancelPlayer.mana).toBe(12);
            expect(Array.isArray(afterSpellCastCancelPlayer.discardSpellCardIds)
                ? afterSpellCastCancelPlayer.discardSpellCardIds
                : []).not.toContain(3716);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '02-元素魔杖法术选择-取消后回到牌桌');

            await Promise.all([
                match.hostPage.reload({ waitUntil: 'domcontentloaded' }),
                match.guestPage.reload({ waitUntil: 'domcontentloaded' }),
            ]);
            await Promise.all([
                expect(match.hostPage.getByTestId('mage-wars-board')).toHaveAttribute(
                    'data-mage-wars-phase',
                    'initiativeQuickcast',
                    { timeout: 15_000 },
                ),
                expect(match.guestPage.getByTestId('mage-wars-board')).toHaveAttribute(
                    'data-mage-wars-phase',
                    'initiativeQuickcast',
                    { timeout: 15_000 },
                ),
            ]);

            const staffObjectId = 'mw-e2e-choice-cancel-staff';
            const staffObject = {
                ...createMageWarsE2eEquipmentObject(
                    staffObjectId,
                    '0',
                    3716,
                    '元素魔杖',
                    ARENA_ZONE_IDS.A3,
                    '0',
                ),
                boundSpellCardId: 1704,
            };
            await injectMageWarsCurrentScopeCoverageReadyState(match, '0', {
                phase: 'finalQuickcast',
                replaceObjects: true,
                objects: [staffObject],
                playerPatches: {
                    '0': {
                        mageId: MAGE_IDS.WIZARD_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.A3,
                        mana: 10,
                        spellbookEntries: getMageWarsE2eStandardSpellbookEntries(MAGE_IDS.WIZARD_APPRENTICE),
                        spellbookCount: getStandardStartingSpellbookCount(MAGE_IDS.WIZARD_APPRENTICE),
                        preparedSpellCardIds: [],
                        preparedSpellSlots: 0,
                    },
                    '1': {
                        mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.D3,
                        preparedSpellCardIds: [],
                        preparedSpellSlots: 0,
                    },
                },
            });

            const attachedStaff = match.hostPage.locator(
                `[data-testid="mage-wars-attached-card"][data-object-id="${staffObjectId}"][data-source-card-id="3716"]`,
            ).first();
            await expect(attachedStaff).toBeVisible({ timeout: 5_000 });
            await attachedStaff.click({ timeout: 3_000, noWaitAfter: true });
            const abilityDock = match.hostPage.getByTestId('mage-wars-selected-ability-action-dock');
            await expect(abilityDock).toBeVisible({ timeout: 3_000 });
            await abilityDock.locator(
                `[data-ability-id="${MAGE_WARS_OBJECT_ABILITY_IDS.ELEMENTAL_STAFF_BIND}"]`,
            ).first().click({ timeout: 3_000, noWaitAfter: true });
            const objectAbilityChoiceDock = match.hostPage.getByTestId('mage-wars-object-ability-choice-dock');
            await expect(objectAbilityChoiceDock).toBeVisible({ timeout: 3_000 });
            await expect.poll(async () => (
                await objectAbilityChoiceDock.getByTestId('mage-wars-object-ability-choice-option').count()
            )).toBeGreaterThanOrEqual(2);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '03-元素魔杖快速重绑-取消按钮可见');

            await objectAbilityChoiceDock.getByTestId('mage-wars-object-ability-choice-cancel').click();
            await expect(objectAbilityChoiceDock).toHaveCount(0, { timeout: 5_000 });
            const afterObjectAbilityCancel = await readServerCoreSnapshot(match.hostPage, match, '0');
            const afterObjectAbilityCancelObjects = isRecord(afterObjectAbilityCancel.objects)
                ? afterObjectAbilityCancel.objects
                : {};
            const afterObjectAbilityCancelStaff = isRecord(afterObjectAbilityCancelObjects[staffObjectId])
                ? afterObjectAbilityCancelObjects[staffObjectId]
                : {};
            expect(afterObjectAbilityCancelStaff.boundSpellCardId).toBe(1704);
            expect(isRecord(afterObjectAbilityCancel.players) && isRecord(afterObjectAbilityCancel.players['0'])
                ? afterObjectAbilityCancel.players['0'].mana
                : undefined).toBe(10);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '04-元素魔杖快速重绑-取消后保持原绑定');

            await Promise.all([
                match.hostPage.reload({ waitUntil: 'domcontentloaded' }),
                match.guestPage.reload({ waitUntil: 'domcontentloaded' }),
            ]);
            await Promise.all([
                expect(match.hostPage.getByTestId('mage-wars-board')).toHaveAttribute(
                    'data-mage-wars-phase',
                    'finalQuickcast',
                    { timeout: 15_000 },
                ),
                expect(match.guestPage.getByTestId('mage-wars-board')).toHaveAttribute(
                    'data-mage-wars-phase',
                    'finalQuickcast',
                    { timeout: 15_000 },
                ),
            ]);

            const afflictedAngelId = 'mw-e2e-status-choice-cancel-angel';
            const afflictedAngel = {
                ...createMageWarsE2eCreatureObject(
                    afflictedAngelId,
                    '1',
                    2907,
                    '受创天使',
                    ARENA_ZONE_IDS.A2,
                ),
                statusTokens: {
                    [STATUS_TOKEN_IDS.BURN]: 1,
                    [STATUS_TOKEN_IDS.STUN]: 1,
                    [STATUS_TOKEN_IDS.SLEEP]: 1,
                },
            };
            await injectMageWarsCurrentScopeCoverageReadyState(match, '0', {
                phase: 'initiativeQuickcast',
                replaceObjects: true,
                objects: [afflictedAngel],
                playerPatches: {
                    '0': {
                        mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.A3,
                        mana: 20,
                        spellbookEntries: getMageWarsE2eStandardSpellbookEntries(MAGE_IDS.PRIESTESS_APPRENTICE),
                        spellbookCount: getStandardStartingSpellbookCount(MAGE_IDS.PRIESTESS_APPRENTICE),
                        preparedSpellCardIds: [],
                        preparedSpellSlots: 0,
                    },
                    '1': {
                        mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.D3,
                        preparedSpellCardIds: [],
                        preparedSpellSlots: 0,
                    },
                },
            });

            await clickMageEntity(match.hostPage, '0', '复原术状态选择取消分支选择女祭司');
            await match.hostPage.getByTestId('mage-wars-selected-mage-ability-restore').click({ timeout: 3_000, noWaitAfter: true });
            const afflictedAngelCard = match.hostPage.locator(
                `[data-testid="mage-wars-zone-field-card"][data-object-id="${afflictedAngelId}"]`,
            ).first();
            await expect(afflictedAngelCard).toBeVisible({ timeout: 3_000 });
            await clickFieldObject(match.hostPage, afflictedAngelCard, '复原术状态选择取消分支选择受创天使');
            const statusChoiceDock = match.hostPage.getByTestId('mage-wars-mage-ability-status-choice-dock');
            await expect(statusChoiceDock).toBeVisible({ timeout: 3_000 });
            await expect.poll(async () => (
                await statusChoiceDock.getByTestId('mage-wars-mage-ability-status-option').count()
            )).toBeGreaterThanOrEqual(2);
            await expect(statusChoiceDock.locator(
                `[data-testid="mage-wars-mage-ability-status-option"][data-status-token-ids="${[
                    STATUS_TOKEN_IDS.BURN,
                    STATUS_TOKEN_IDS.STUN,
                    STATUS_TOKEN_IDS.SLEEP,
                ].join(',')}"]`,
            )).toBeVisible({ timeout: 3_000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '05-复原术多状态选择-取消按钮和多个组合可见');

            await statusChoiceDock.getByTestId('mage-wars-mage-ability-status-choice-cancel').click();
            await expect(statusChoiceDock).toHaveCount(0, { timeout: 5_000 });
            const afterStatusChoiceCancel = await readServerCoreSnapshot(match.hostPage, match, '0');
            const afterStatusChoiceCancelObjects = isRecord(afterStatusChoiceCancel.objects)
                ? afterStatusChoiceCancel.objects
                : {};
            const afterStatusChoiceCancelAngel = isRecord(afterStatusChoiceCancelObjects[afflictedAngelId])
                ? afterStatusChoiceCancelObjects[afflictedAngelId]
                : {};
            expect(afterStatusChoiceCancelAngel.statusTokens).toMatchObject({
                [STATUS_TOKEN_IDS.BURN]: 1,
                [STATUS_TOKEN_IDS.STUN]: 1,
                [STATUS_TOKEN_IDS.SLEEP]: 1,
            });
            expect(isRecord(afterStatusChoiceCancel.players) && isRecord(afterStatusChoiceCancel.players['0'])
                ? afterStatusChoiceCancel.players['0'].mana
                : undefined).toBe(20);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '06-复原术多状态选择-取消后状态和法力不变');

            await clickMageEntity(match.hostPage, '0', '复原术状态选择确认分支再次选择女祭司');
            await match.hostPage.getByTestId('mage-wars-selected-mage-ability-restore').click({ timeout: 3_000, noWaitAfter: true });
            await clickFieldObject(match.hostPage, afflictedAngelCard, '复原术状态选择确认分支再次选择受创天使');
            await expect(statusChoiceDock).toBeVisible({ timeout: 3_000 });
            const fullRestoreOption = statusChoiceDock.locator(
                `[data-testid="mage-wars-mage-ability-status-option"][data-status-token-ids="${[
                    STATUS_TOKEN_IDS.BURN,
                    STATUS_TOKEN_IDS.STUN,
                    STATUS_TOKEN_IDS.SLEEP,
                ].join(',')}"]`,
            ).first();
            await expect(fullRestoreOption).toBeVisible({ timeout: 3_000 });
            await fullRestoreOption.click({ timeout: 3_000, noWaitAfter: true });
            await expect(statusChoiceDock).toHaveCount(0, { timeout: 5_000 });
            await expect.poll(async () => {
                const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                return hasEvent(snapshot, MAGE_WARS_EVENTS.MAGE_ABILITY_RESOLVED, (payload) => (
                    payload.abilityId === MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_STANDARD
                        && payload.targetObjectId === afflictedAngelId
                ));
            }, {
                message: '复原术确认组合后应产生正式法师能力结算事件',
                timeout: 5_000,
            }).toBe(true);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '07-复原术多状态选择-确认组合后正式结算');
        } finally {
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    });

    test('正式页面操作日志与撤回 UI 覆盖真实移动、申请、同意和状态回退', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL, {}, undefined, {
            preserveFabMenu: true,
        });
        const hostDiagnostics = attachPageDiagnostics(match.hostPage, 'host');
        const guestDiagnostics = attachPageDiagnostics(match.guestPage, 'guest');
        const creatureObjectId = 'mw-e2e-action-log-undo-wolf';

        try {
            await advanceBothPlayersToPlanning(match);
            await match.hostPage.getByRole('button', { name: '全部', exact: true }).click();
            await selectNamedSpellbookCard(match.hostPage, '丛林灰狼');
            await match.hostPage.getByTestId('mage-wars-plan-spells').click();
            await expect.poll(async () => {
                const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                const player = isRecord(snapshot.players) && isRecord(snapshot.players['0'])
                    ? snapshot.players['0']
                    : {};
                return Array.isArray(player.preparedSpellCardIds)
                    && player.preparedSpellCardIds.includes(2819);
            }, {
                message: '真实计划丛林灰狼后，服务器应记录计划法术',
                timeout: 5_000,
            }).toBe(true);
            await injectMageWarsCurrentScopeCoverageReadyState(match, '0', {
                phase: 'creatureAction',
                replaceObjects: true,
                objects: [
                    createMageWarsE2eCreatureObject(
                        creatureObjectId,
                        '0',
                        2819,
                        '丛林灰狼',
                        ARENA_ZONE_IDS.A3,
                    ),
                ],
                playerPatches: {
                    '0': {
                        mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.A3,
                        mana: 10,
                    },
                    '1': {
                        mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.D3,
                    },
                },
            });
            await Promise.all([
                match.hostPage.reload({ waitUntil: 'domcontentloaded' }),
                match.guestPage.reload({ waitUntil: 'domcontentloaded' }),
            ]);
            await Promise.all([
                expect(match.hostPage.getByTestId('mage-wars-board')).toHaveAttribute(
                    'data-mage-wars-phase',
                    'creatureAction',
                    { timeout: 15_000 },
                ),
                expect(match.guestPage.getByTestId('mage-wars-board')).toHaveAttribute(
                    'data-mage-wars-phase',
                    'creatureAction',
                    { timeout: 15_000 },
                ),
            ]);

            await clickMageWarsFieldObjectById(match.hostPage, creatureObjectId, '操作日志 / 撤回测试选择丛林灰狼');
            await clickLegalMoveZone(match.hostPage, 'a2', '操作日志 / 撤回测试移动丛林灰狼');
            await waitForZoneFieldCard(match.hostPage, 'a2', 2819, '操作日志 / 撤回测试移动后', {
                match,
                playerId: '0',
                diagnostics: [
                    { label: 'host', diagnostics: hostDiagnostics },
                    { label: 'guest', diagnostics: guestDiagnostics },
                ],
            });
            await openMageWarsFabPanel(match.hostPage, 'action-log');
            const actionLogRows = match.hostPage.locator('[data-testid="hud-action-log-row"]');
            await expect.poll(async () => (
                (await actionLogRows.allInnerTexts()).some((text) => text.replace(/\s+/g, ' ').includes('丛林灰狼'))
            ), {
                message: '真实计划完成后，Mage Wars 操作日志面板应显示计划法术记录',
                timeout: 15_000,
            }).toBe(true);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '01-操作日志-真实计划法术记录可见');
            await closeMageWarsFabPanel(match.hostPage, 'action-log');

            await openMageWarsFabPanel(match.guestPage, 'undo-request');
            const undoRequestPanel = match.guestPage.locator('[data-testid="fab-panel-undo-request"]').first();
            await expect(undoRequestPanel).toContainText(/可撤回 1 步|可以请求撤回上一步操作/);
            await expect(undoRequestPanel.getByRole('button', { name: '申请撤回', exact: true })).toBeVisible();
            await saveEvidenceScreenshot(match.guestPage, testInfo, '02-撤回入口-对手可申请撤回上一步');
            await undoRequestPanel.getByRole('button', { name: '申请撤回', exact: true }).click();

            await openMageWarsFabPanel(match.hostPage, 'undo-review');
            const undoReviewPanel = match.hostPage.locator('[data-testid="fab-panel-undo-review"]').first();
            await expect(undoReviewPanel).toContainText('对方请求撤回');
            await expect(undoReviewPanel.getByRole('button', { name: '同意', exact: true })).toBeVisible();
            await saveEvidenceScreenshot(match.hostPage, testInfo, '03-撤回审批-当前玩家可同意对手请求');
            await undoReviewPanel.getByRole('button', { name: '同意', exact: true }).click();

            await expect.poll(async () => {
                const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                const object = isRecord(snapshot.objects) ? snapshot.objects[creatureObjectId] : undefined;
                return isRecord(object) ? object.zoneId : undefined;
            }, {
                message: '同意撤回后，服务端应把丛林灰狼恢复到移动前的 A3 区域',
                timeout: 10_000,
            }).toBe(ARENA_ZONE_IDS.A3);
            await waitForZoneFieldCard(match.hostPage, 'a3', 2819, '撤回完成后丛林灰狼回到 A3', {
                match,
                playerId: '0',
                diagnostics: [
                    { label: 'host', diagnostics: hostDiagnostics },
                    { label: 'guest', diagnostics: guestDiagnostics },
                ],
            });
            await expect(match.hostPage.locator('[data-testid="mage-wars-zone-a2"] [data-testid="mage-wars-zone-field-card"]')
                .filter({ hasText: '丛林灰狼' })).toHaveCount(0);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '04-撤回完成-丛林灰狼回到原区域');
        } finally {
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    });

    test('正式页面墙体法术可选择边界并在穿越时触发通行伤害', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL);
        const hostDiagnostics = attachPageDiagnostics(match.hostPage, 'host');
        const guestDiagnostics = attachPageDiagnostics(match.guestPage, 'guest');
        const wallSpellCardId = 25700;
        const wallEdgeId = 'a3-b3';
        const archerObjectId = 'mw-e2e-wall-los-archer';
        const losTargetObjectId = 'mw-e2e-wall-los-target';
        const runnerObjectId = 'mw-e2e-wall-runner';

        try {
            await injectMageWarsCurrentScopeCoverageReadyState(match, '0', {
                replaceObjects: true,
                objects: [
                    createMageWarsE2eCreatureObject(
                        archerObjectId,
                        '0',
                        2816,
                        '皇家箭手',
                        ARENA_ZONE_IDS.A3,
                    ),
                    createMageWarsE2eCreatureObject(
                        losTargetObjectId,
                        '1',
                        2811,
                        '阿希拉牧师',
                        ARENA_ZONE_IDS.B3,
                    ),
                ],
                playerPatches: {
                    '0': {
                        mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.A3,
                        mana: 20,
                        actionReady: true,
                        quickcastReady: true,
                        preparedSpellSlots: 1,
                        preparedSpellCardIds: [wallSpellCardId],
                    },
                    '1': {
                        mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.D3,
                    },
                },
            });

            const archer = match.hostPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${archerObjectId}"]`).first();
            const losTarget = match.hostPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${losTargetObjectId}"]`).first();
            await clickFieldObject(match.hostPage, archer, '墙前皇家箭手远程攻击检查选择来源');
            await expect(losTarget).toHaveAttribute('data-field-card-role', 'target', { timeout: 3_000 });
            await expect(losTarget).toBeEnabled({ timeout: 3_000 });
            await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '墙前视线未阻挡截图前');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '18-墙前远程视线未阻挡-B3目标可选');

            const preparedWall = match.hostPage.locator(`${SELF_PREPARED_CARD_SELECTOR}[data-source-card-id="${wallSpellCardId}"]`).first();
            await advanceUntilEnabled(match.hostPage, preparedWall);
            await selectPreparedSpell(match.hostPage, preparedWall, '荆棘之墙');
            const targetEdge = match.hostPage.getByTestId(`mage-wars-wall-edge-${wallEdgeId}`);
            await expect(targetEdge).toHaveAttribute('data-legal-target-wall-edge', 'true', { timeout: 3_000 });
            await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '墙体边界选择截图前');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '19-荆棘之墙施放前-A3-B3边界可选');
            await targetEdge.click({ timeout: 3_000, noWaitAfter: true });

            await expect.poll(async () => {
                const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                return hasWallSnapshot(snapshot, wallEdgeId, wallSpellCardId)
                    && hasWallSummonedEvent(snapshot, wallEdgeId, wallSpellCardId)
                    && hasEvent(snapshot, MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED, (payload) => (
                        payload.spellCardId === wallSpellCardId
                        && payload.targetWallEdgeId === wallEdgeId
                    ));
            }, {
                message: '荆棘之墙应通过正式页面写入 A3-B3 墙体状态和墙体施放事件',
                timeout: 5_000,
            }).toBe(true);
            await expect(targetEdge).toHaveAttribute('data-wall-object', 'true', { timeout: 3_000 });
            const wallCardPreview = targetEdge.getByTestId('mage-wars-wall-card-preview');
            await expect(wallCardPreview).toBeVisible({ timeout: 3_000 });
            await expect(wallCardPreview).toHaveAttribute('data-source-card-id', String(wallSpellCardId));
            await expect(wallCardPreview).toHaveAttribute('data-wall-visual', 'spell-card');
            const wallCardRect = await wallCardPreview.evaluate((element) => {
                const rect = element.getBoundingClientRect();
                return { width: rect.width, height: rect.height };
            });
            expect(
                Math.min(wallCardRect.width, wallCardRect.height),
                '墙牌视觉本体在真实桌面缩放后仍需保持可读尺寸',
            ).toBeGreaterThanOrEqual(70);
            await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '墙体施放完成截图前');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '20-荆棘之墙施放后-A3-B3边界墙牌可见');

            await clickFieldObject(match.hostPage, archer, '墙后皇家箭手远程攻击检查选择来源');
            await expect(archer).toHaveAttribute('data-field-card-role', 'source', { timeout: 3_000 });
            await expect(losTarget).not.toHaveAttribute('data-field-card-role', 'target', { timeout: 3_000 });
            await expect(losTarget).toBeDisabled({ timeout: 3_000 });
            await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '墙后视线阻挡截图前');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '21-墙后远程视线阻挡-B3目标不可选');

            await injectMageWarsCurrentScopeCoverageReadyState(match, '0', {
                replaceObjects: true,
                objects: [
                    createMageWarsE2eCreatureObject(
                        runnerObjectId,
                        '0',
                        2906,
                        '野性山猫',
                        ARENA_ZONE_IDS.A3,
                    ),
                ],
                playerPatches: {
                    '0': {
                        mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.A1,
                        mana: 20,
                        actionReady: true,
                        quickcastReady: true,
                        preparedSpellSlots: 0,
                        preparedSpellCardIds: [],
                    },
                    '1': {
                        mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                        mageZoneId: ARENA_ZONE_IDS.D3,
                    },
                },
            });

            const runner = match.hostPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${runnerObjectId}"]`).first();
            await clickFieldObject(match.hostPage, runner, '野性山猫穿越墙体前选择来源');
            await expect(match.hostPage.getByTestId('mage-wars-arena-zone-b3')).toHaveAttribute('data-legal-move-zone', 'true', {
                timeout: 3_000,
            });
            await clickLegalMoveZone(match.hostPage, ARENA_ZONE_IDS.B3, '野性山猫穿越 A3-B3 墙体');
            await expectServerObjectZone(
                match.hostPage,
                match,
                '0',
                runnerObjectId,
                ARENA_ZONE_IDS.B3,
                '野性山猫穿越墙体后应进入 B3',
            );
            await expectServerObjectDamageGreaterThan(
                match.hostPage,
                match,
                '0',
                runnerObjectId,
                0,
                '野性山猫穿越墙体后应受到通行伤害',
            );
            await expect.poll(async () => {
                const snapshot = await readServerCoreSnapshot(match.hostPage, match, '0');
                return hasWallPassageDamageTriggeredEvent(snapshot, wallEdgeId, runnerObjectId)
                    && hasDamageDealtEvent(snapshot, runnerObjectId);
            }, {
                message: '穿越 A3-B3 墙体应产生墙体通行伤害事件和真实伤害事件',
                timeout: 5_000,
            }).toBe(true);
            await waitForVisibleMageWarsAtlasCardsLoaded(match.hostPage, '穿墙伤害截图前');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '22-穿越荆棘之墙后-通行伤害结算可见');
        } finally {
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    });

    test('正式页面推斥法术过程帧覆盖来源飞行命中', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const recording = createMageWarsFxVideoRecording(testInfo, { fileLabel: '推斥' });
        let gifCapture: MageWarsFxGifCapture | null = null;
        const match = await setupOnlineMageWars(browser, baseURL);
        const hostDiagnostics = attachPageDiagnostics(match.hostPage, 'host');
        const guestDiagnostics = attachPageDiagnostics(match.guestPage, 'guest');
        const targetObjectId = 'mw-e2e-force-push-target';
        const spellCardId = 3523;

        try {
            await injectMageWarsSpellFxReadyState(match, '1', {
                mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                preparedSpellCardId: spellCardId,
                targetObject: createMageWarsE2eCreatureObject(
                    targetObjectId,
                    '0',
                    2906,
                    '野性山猫',
                    ARENA_ZONE_IDS.C2,
                ),
                mana: 12,
            });

            const target = match.guestPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${targetObjectId}"]`).first();
            await selectPreparedSpell(match.guestPage, selfPreparedCardByName(match.guestPage, '原力推斥'), '原力推斥');
            await clickFieldObject(match.guestPage, target, '原力推斥选择目标生物');
            await expect(target).toHaveAttribute('data-field-card-role', 'source', { timeout: 3_000 });
            await expect(match.guestPage.getByTestId('mage-wars-arena-zone-c3')).toHaveAttribute('data-legal-target-zone', 'true', {
                timeout: 3_000,
            });

            gifCapture = await startMageWarsFxGifCapture(match.guestPage, recording);
            const pushFxAuditPromise = captureMageWarsFxProcessScreenshots(
                match.guestPage,
                testInfo,
                'push',
                '12A-原力推斥',
                {
                    expectTravel: true,
                    captureFrame: (animations) => gifCapture?.capture(animations) ?? Promise.resolve(),
                },
            );
            await clickLegalTargetZone(match.guestPage, 'c3', '原力推斥选择推离落点');
            const pushFxAudit = await pushFxAuditPromise;
            await gifCapture.stop();
            expect(pushFxAudit.sourceRow).toBe('1');
            expect(pushFxAudit.sourceCol).toBe('2');
            expect(pushFxAudit.targetRow).toBe('2');
            expect(pushFxAudit.targetCol).toBe('2');

            await expectServerObjectZone(
                match.guestPage,
                match,
                '1',
                targetObjectId,
                ARENA_ZONE_IDS.C3,
                '原力推斥结算后野性山猫应被推到 C3',
            );
            await expect.poll(async () => (
                hasSpellMovementResolvedEvent(
                    await readServerCoreSnapshot(match.guestPage, match, '1'),
                    'MW_SPELL_PUSH_RESOLVED',
                    spellCardId,
                    targetObjectId,
                    ARENA_ZONE_IDS.C3,
                )
            ), {
                message: '原力推斥必须通过真实页面产生推斥结算事件',
                timeout: 5_000,
            }).toBe(true);
        } finally {
            await gifCapture?.stop().catch(() => undefined);
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        await finalizeMageWarsFxVideoRecording(testInfo, recording, {
            actionLabel: '推斥代表态',
            requirements: [
                {
                    requirement: '正式页面推斥独立覆盖：玩家选择推离落点，来源唤醒、气流路径、目标落点和稳定收口来自同一次运行',
                    status: 'PASS',
                    evidence: [
                        'E2E：正式页面选择原力推斥目标并点击合法落点后产生真实推斥结算事件',
                        'E2E：推斥来源、路径、命中和目标区域变化过程帧来自当前运行',
                        recording.finalGifPath!,
                    ],
                },
            ],
        });
    });

    test('正式页面传送法术过程帧覆盖来源轨迹落点', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        console.log('[MageWars GIF debug] teleport-test-enter');
        await clearEvidenceScreenshotsForTest(testInfo);
        console.log('[MageWars GIF debug] teleport-evidence-cleared');
        const recording = createMageWarsFxVideoRecording(testInfo, { fileLabel: '传送' });
        console.log(`[MageWars GIF debug] teleport-recording-created enabled=${recording.enabled}`);
        let gifCapture: MageWarsFxGifCapture | null = null;
        const match = await setupOnlineMageWars(browser, baseURL);
        console.log('[MageWars GIF debug] teleport-match-ready');
        const hostDiagnostics = attachPageDiagnostics(match.hostPage, 'host');
        const guestDiagnostics = attachPageDiagnostics(match.guestPage, 'guest');
        const targetObjectId = 'mw-e2e-teleport-target';
        const spellCardId = 3410;

        try {
            await injectMageWarsSpellFxReadyState(match, '0', {
                mageId: MAGE_IDS.WIZARD_APPRENTICE,
                preparedSpellCardId: spellCardId,
                targetObject: createMageWarsE2eCreatureObject(
                    targetObjectId,
                    '0',
                    2822,
                    '蓝色精怪',
                    ARENA_ZONE_IDS.A2,
                ),
                mana: 12,
            });
            console.log('[MageWars GIF debug] teleport-state-injected');

            const target = match.hostPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${targetObjectId}"]`).first();
            await selectPreparedSpell(match.hostPage, selfPreparedCardByName(match.hostPage, '传送'), '传送');
            await clickFieldObject(match.hostPage, target, '传送选择目标生物');
            await expect(target).toHaveAttribute('data-field-card-role', 'source', { timeout: 3_000 });
            await expect(match.hostPage.getByTestId('mage-wars-arena-zone-b3')).toHaveAttribute('data-legal-target-zone', 'true', {
                timeout: 3_000,
            });
            console.log('[MageWars GIF debug] teleport-target-selected');

            gifCapture = await startMageWarsFxGifCapture(match.hostPage, recording);
            const teleportFxAuditPromise = captureMageWarsFxProcessScreenshots(
                match.hostPage,
                testInfo,
                'teleport',
                '12B-传送',
                {
                    expectTravel: true,
                    captureFrame: (animations) => gifCapture?.capture(animations) ?? Promise.resolve(),
                },
            );
            await clickLegalTargetZone(match.hostPage, 'b3', '传送选择目标区域');
            const teleportFxAudit = await teleportFxAuditPromise;
            await gifCapture.stop();
            expect(teleportFxAudit.sourceRow).toBe('1');
            expect(teleportFxAudit.sourceCol).toBe('0');
            expect(teleportFxAudit.targetRow).toBe('2');
            expect(teleportFxAudit.targetCol).toBe('1');

            await expectServerObjectZone(
                match.hostPage,
                match,
                '0',
                targetObjectId,
                ARENA_ZONE_IDS.B3,
                '传送结算后蓝色精怪应到达 B3',
            );
            await expect.poll(async () => (
                hasSpellMovementResolvedEvent(
                    await readServerCoreSnapshot(match.hostPage, match, '0'),
                    'MW_SPELL_TELEPORT_RESOLVED',
                    spellCardId,
                    targetObjectId,
                    ARENA_ZONE_IDS.B3,
                )
            ), {
                message: '传送必须通过真实页面产生传送结算事件',
                timeout: 5_000,
            }).toBe(true);
        } finally {
            await gifCapture?.stop().catch(() => undefined);
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        await finalizeMageWarsFxVideoRecording(testInfo, recording, {
            actionLabel: '传送代表态',
            requirements: [
                {
                    requirement: '正式页面传送独立覆盖：玩家选择目标区域，来源唤醒、传送轨迹、目标落点和稳定收口来自同一次运行',
                    status: 'PASS',
                    evidence: [
                        'E2E：正式页面选择传送目标生物和合法目标区域后产生真实传送结算事件',
                        'E2E：传送来源、轨迹、落点和稳定收口过程帧来自当前运行',
                        recording.finalGifPath!,
                    ],
                },
            ],
        });
    });
});
