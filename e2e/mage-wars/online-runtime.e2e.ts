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
    getEvidenceScreenshotDir,
    getEvidenceScreenshotPath,
    withJpegEvidenceScreenshotOptions,
} from '../framework/evidenceScreenshots';
import {
    attachPageDiagnostics,
    ensureGameServerAvailable,
    getGameServerBaseURL,
    initContext,
    joinMatchViaAPI,
    seedMatchCredentials,
    waitForFrontendAssets,
    waitForMatchAvailable,
} from '../helpers/common';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { ARENA_ZONE_IDS, MAGE_IDS, type ArenaZoneId, type MageId } from '../../src/games/mage-wars/domain/ids';
import type { MageWarsArenaObjectState, MageWarsCore } from '../../src/games/mage-wars/domain';

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
type MageWarsFxKind = 'attack' | 'push' | 'teleport';
type ScreenshotCssRect = { x: number; y: number; width: number; height: number };
type ScreenshotViewport = { width: number; height: number };
type RecordedVideo = NonNullable<ReturnType<Page['video']>>;
type MageWarsFxVideoRecording = {
    enabled: boolean;
    contextOptions: BrowserContextOptions;
    rawVideoDir?: string;
    finalVideoPath?: string;
    passManifestPath?: string;
};

const TEST_API_TOKEN_FILE = 'temp/e2e/shared-test-api-token.txt';
const SELF_PREPARED_CARD_SELECTOR = '[data-mage-wars-prepared-card="self"]';
type EvidenceScreenshotAnimationMode = 'allow' | 'disabled';
const TRUTHY_ENV_VALUES = new Set(['1', 'true', 'yes', 'on']);

async function saveEvidenceScreenshot(
    page: Page,
    testInfo: TestInfo,
    name: string,
    options: { animations?: EvidenceScreenshotAnimationMode } = {},
): Promise<string> {
    const path = getEvidenceScreenshotPath(testInfo, name, { requireChineseName: true });
    await page.screenshot(withJpegEvidenceScreenshotOptions({
        path,
        fullPage: false,
        animations: options.animations ?? 'disabled',
        timeout: 10_000,
    }));
    testInfo.annotations.push({
        type: 'evidence-screenshot',
        description: path,
    });
    return path;
}

function shouldRecordMageWarsFxVideo(): boolean {
    return TRUTHY_ENV_VALUES.has((process.env.MAGE_WARS_RECORD_FX_VIDEO ?? '').trim().toLowerCase());
}

function createMageWarsFxVideoRecording(testInfo: TestInfo): MageWarsFxVideoRecording {
    if (!shouldRecordMageWarsFxVideo()) {
        return { enabled: false, contextOptions: {} };
    }

    const evidenceDir = getEvidenceScreenshotDir(testInfo, undefined, { requireChineseName: true });
    const rawVideoDir = path.join(evidenceDir, '_raw-video');
    fs.mkdirSync(rawVideoDir, { recursive: true });

    return {
        enabled: true,
        contextOptions: {
            recordVideo: {
                dir: rawVideoDir,
                size: { width: 1920, height: 1080 },
            },
        },
        rawVideoDir,
        finalVideoPath: path.join(evidenceDir, '00-法师战争召唤和攻击实际动效.webm'),
        passManifestPath: path.join(evidenceDir, '00-法师战争召唤和攻击实际动效-PASS.json'),
    };
}

async function finalizeMageWarsFxVideoRecording(
    testInfo: TestInfo,
    recording: MageWarsFxVideoRecording,
    video: RecordedVideo | null | undefined,
): Promise<{ videoPath: string; passManifestPath: string } | null> {
    if (!recording.enabled) return null;
    if (!recording.finalVideoPath || !recording.passManifestPath) {
        throw new Error('Mage Wars 录屏已开启，但最终录屏路径或 PASS 清单路径未初始化');
    }
    if (!video) {
        throw new Error('Mage Wars 录屏已开启，但正式页面没有生成 Playwright video 对象');
    }

    const rawVideoPath = await video.path();
    await fs.promises.mkdir(path.dirname(recording.finalVideoPath), { recursive: true });
    await fs.promises.copyFile(rawVideoPath, recording.finalVideoPath);
    const videoStats = await fs.promises.stat(recording.finalVideoPath);
    if (videoStats.size <= 0) {
        throw new Error(`Mage Wars 录屏文件为空：${recording.finalVideoPath}`);
    }
    if (recording.rawVideoDir) {
        await fs.promises.rm(recording.rawVideoDir, { recursive: true, force: true });
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

    const manifest = {
        verdict: 'PASS',
        scope: 'current-user-request',
        generatedAt: new Date().toISOString(),
        requirements: [
            {
                requirement: '法师战争两个派系基础流程里的召唤动效已通过：兽王野性山猫与女祭司阿希拉牧师都有召唤光柱过程帧和落场完成证据',
                status: 'PASS',
                evidence: [
                    'E2E：正式页面召唤和攻击必要过程帧覆盖 passed',
                    ...summonEvidence,
                    recording.finalVideoPath,
                ],
            },
            {
                requirement: '法师战争攻击动效已通过：间歇喷泉攻击时目标单位从投射开始、飞行中到命中飘字都持续可见，不是命中时才出现',
                status: 'PASS',
                evidence: [
                    'E2E：正式页面点击目标后产生攻击掷骰事件',
                    'E2E：目标锚点可见性断言覆盖投射开始、投射飞行中、命中和伤害飘字三段',
                    ...attackEvidence,
                    recording.finalVideoPath,
                ],
            },
            {
                requirement: '法师战争攻击骰结果层已避让目标单位：骰子出现时不能遮住阿希拉牧师目标本体',
                status: 'PASS',
                evidence: [
                    'E2E：攻击骰结果层使用路径旁侧避让位 data-placement=path-side-avoid-target',
                    'E2E：攻击骰与目标单位遮挡比例断言覆盖投射开始和投射飞行中两段',
                    ...attackEvidence,
                    recording.finalVideoPath,
                ],
            },
            {
                requirement: '法师战争攻击投射物使用线性飞行进度，避免靠近目标时明显减速',
                status: 'PASS',
                evidence: [
                    '单元测试：MageWarsBoard FX wiring 断言攻击 ConeBlast data-motion-easing=linear',
                    'E2E：正式页面召唤和攻击必要过程帧覆盖 passed',
                    recording.finalVideoPath,
                ],
            },
            {
                requirement: '最终录屏来自同一正式页面 E2E 入口，并从攻击准备态页面开始录制，避免把前置布置或状态注入误读成目标隐藏',
                status: 'PASS',
                evidence: [
                    recording.finalVideoPath,
                    `录屏文件大小：${videoStats.size} bytes`,
                ],
            },
        ],
        media: [recording.finalVideoPath],
    };

    await fs.promises.writeFile(recording.passManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    testInfo.annotations.push(
        { type: 'evidence-video', description: recording.finalVideoPath },
        { type: 'pass-manifest', description: recording.passManifestPath },
    );
    return {
        videoPath: recording.finalVideoPath,
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
    const arena = Array.isArray(core.arena) ? core.arena : [];
    const eventStream = isRecord(sys.eventStream) ? sys.eventStream : {};
    const eventEntries = Array.isArray(eventStream.entries) ? eventStream.entries : [];

    return {
        stateID: payloadRecord._stateID,
        sys: pickFields(sys, ['phase', 'currentPlayerId', 'phaseActorId', 'turnNumber']),
        core: pickFields(core, ['phase', 'currentPlayerId', 'phaseActorId', 'turnNumber']),
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
                'discardPileCardIds',
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
                'revealed',
                'anchoredToObjectId',
                'anchoredToPlayerId',
                'anchoredToZoneId',
                'restrainedByObjectId',
                'statusTokens',
            ]),
        ])),
        arena: arena.map((zone) => pickFields(zone, ['id', 'occupantIds'])),
        eventStream: eventEntries.slice(-30).map((entry) => {
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
                    'targetPlayerId',
                    'targetZoneId',
                    'fromZoneId',
                    'toZoneId',
                    'distance',
                    'diceResults',
                    'effectDieResult',
                    'baseDamage',
                    'actualDamage',
                    'amount',
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
    await expect(board).toContainText('正式竞技场');
    await waitForVisibleImagesLoaded(page, label);
    await waitForVisibleMageWarsAtlasCardsLoaded(page, label);
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
        };
    });
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
        const mirrorLayer = toRect(document.querySelector<HTMLElement>('[data-testid="mage-wars-mobile-desktop-mirror-layer"]'));
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
    await expect(page.getByTestId('mage-wars-mobile-desktop-mirror-layer')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-mage-hud-self')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-mage-hud-opponent')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-desktop-spellbook-shelf')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-desktop-prepared-spells')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-discard-pile')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-opponent-prepared-mirror')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('mage-wars-turn-end')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('fab-menu')).toBeVisible({ timeout: 5_000 });
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
    expect(audit.turnEnd, `${label} 回合结束按钮必须可见`).not.toBeNull();
    expect(audit.fabMenu, `${label} 全局悬浮入口必须参与压力态`).not.toBeNull();
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
): Promise<MageWarsSummonFxAudit> {
    const fxAudit = await waitForSummonFxVisualAudit(page, context);
    await expect(page.getByTestId('mage-wars-fx-summon').first()).toBeVisible({ timeout: 5_000 });
    // 过程帧必须在光柱 canvas 达到可见阈值后、光柱主体展开时落盘。
    // 这里只等一个很短的动画窗口；牌面加载检查放在触发前和最终落场后，
    // 避免把过程帧等成最终态。
    await page.waitForTimeout(320);
    await expect(page.getByTestId('mage-wars-fx-summon').first()).toBeVisible({ timeout: 1_000 });
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

async function waitForFxSourceImpactAudit(page: Page, kind: MageWarsFxKind): Promise<MageWarsFxAudit> {
    const impactTestId = resolveFxImpactTestId(kind);
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
        const requiresSourceWake = fxKind !== 'attack';
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
    if (kind !== 'attack') {
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

function resolveFxImpactTestId(kind: MageWarsFxKind): string {
    if (kind === 'push') return 'mage-wars-fx-spell-push';
    if (kind === 'teleport') return 'mage-wars-fx-spell-teleport';
    return 'mage-wars-fx-attack-impact';
}

function resolveFxImpactBurstTestId(kind: MageWarsFxKind): string | null {
    if (kind === 'push') return 'mage-wars-fx-spell-push-burst';
    if (kind === 'teleport') return 'mage-wars-fx-spell-teleport-burst';
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

async function expectMageWarsAttackDiceAvoidsTargetAnchor(
    page: Page,
    audit: MageWarsFxAudit,
    label: string,
) {
    const targetAnchorId = audit.targetAnchorId;
    expect(targetAnchorId, `${label} 必须有目标对象锚点才能检查骰子遮挡`).toBeTruthy();
    if (!targetAnchorId) return;

    const overlap = await page.evaluate((anchorId) => {
        const escapeAttr = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const anchor = document.querySelector<HTMLElement>(
            `[data-testid="mage-wars-zone-field-card"][data-object-id="${escapeAttr(anchorId)}"]`,
        ) ?? document.querySelector<HTMLElement>(
            `[data-testid="mage-wars-zone-mage-entity"][data-player-id="${escapeAttr(anchorId)}"]`,
        );
        const dice = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-attack-dice"]');
        if (!anchor || !dice) {
            return {
                hasAnchor: Boolean(anchor),
                hasDice: Boolean(dice),
                targetOverlapRatio: 1,
                diceOverlapRatio: 1,
                centerDistancePx: 0,
                targetRect: null,
                diceRect: null,
                dicePlacement: dice?.dataset.placement ?? null,
            };
        }

        const anchorRect = anchor.getBoundingClientRect();
        const diceRect = dice.getBoundingClientRect();
        const overlapWidth = Math.max(0, Math.min(anchorRect.right, diceRect.right) - Math.max(anchorRect.left, diceRect.left));
        const overlapHeight = Math.max(0, Math.min(anchorRect.bottom, diceRect.bottom) - Math.max(anchorRect.top, diceRect.top));
        const overlapArea = overlapWidth * overlapHeight;
        const anchorArea = Math.max(1, anchorRect.width * anchorRect.height);
        const diceArea = Math.max(1, diceRect.width * diceRect.height);
        const anchorCenter = {
            x: anchorRect.left + anchorRect.width / 2,
            y: anchorRect.top + anchorRect.height / 2,
        };
        const diceCenter = {
            x: diceRect.left + diceRect.width / 2,
            y: diceRect.top + diceRect.height / 2,
        };

        return {
            hasAnchor: true,
            hasDice: true,
            targetOverlapRatio: Math.round((overlapArea / anchorArea) * 1_000) / 1_000,
            diceOverlapRatio: Math.round((overlapArea / diceArea) * 1_000) / 1_000,
            centerDistancePx: Math.round(Math.hypot(anchorCenter.x - diceCenter.x, anchorCenter.y - diceCenter.y) * 10) / 10,
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
            dicePlacement: dice.dataset.placement ?? null,
        };
    }, targetAnchorId);

    expect(overlap.hasAnchor, `${label} 必须找到目标单位`).toBe(true);
    expect(overlap.hasDice, `${label} 必须找到攻击骰结果层`).toBe(true);
    expect(overlap.dicePlacement, `${label} 攻击骰必须使用避让目标的路径旁侧摆放`).toBe('path-side-avoid-target');
    expect(overlap.targetOverlapRatio, `${label} 攻击骰遮住目标单位过多：${JSON.stringify(overlap)}`)
        .toBeLessThanOrEqual(0.12);
    expect(overlap.diceOverlapRatio, `${label} 攻击骰自身仍压在目标单位上：${JSON.stringify(overlap)}`)
        .toBeLessThanOrEqual(0.12);
}

async function readAttackDamageFloatDebug(page: Page) {
    return page.evaluate(() => {
        const layer = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-layer"]');
        const impact = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-attack-impact"]');
        const damageHost = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-attack-damage-host"]');
        const floats = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="mage-wars-fx-attack-damage-float"]'));
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

async function captureMageWarsFxProcessScreenshots(
    page: Page,
    testInfo: TestInfo,
    kind: MageWarsFxKind,
    label: string,
    options: {
        expectTravel?: boolean;
        expectDamageFloat?: boolean;
    } = {},
): Promise<MageWarsFxAudit> {
    const audit = options.expectTravel
        ? await waitForFxTravelAudit(page, kind)
        : await waitForFxSourceImpactAudit(page, kind);

    if (kind !== 'attack') {
        await expect(page.getByTestId(`mage-wars-fx-${kind}-source-wake`).first()).toBeVisible({ timeout: 5_000 });
    }
    await expect(page.getByTestId(resolveFxImpactTestId(kind)).first()).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(80);
    await expectMageWarsFxTargetAnchorVisible(page, audit, `${label}-投射开始`);
    if (kind === 'attack') {
        await expectMageWarsAttackDiceAvoidsTargetAnchor(page, audit, `${label}-投射开始`);
    }
    await saveEvidenceScreenshot(
        page,
        testInfo,
        options.expectTravel
            ? (kind === 'attack' ? `${label}-来源到目标投射过程帧` : `${label}-来源唤醒过程帧`)
            : `${label}-来源唤醒和命中过程帧`,
        { animations: 'allow' },
    );

    if (options.expectTravel) {
        const travel = page.getByTestId(`mage-wars-fx-${kind}-travel`).first();
        await expect(travel).toBeVisible({ timeout: 5_000 });
        if (kind !== 'attack') {
            await expect(page.getByTestId(`mage-wars-fx-${kind}-travel-mid-burst`).first()).toBeVisible({ timeout: 5_000 });
        }
        await page.waitForTimeout(420);
        await expectMageWarsFxTargetAnchorVisible(page, audit, `${label}-投射飞行中`);
        if (kind === 'attack') {
            await expectMageWarsAttackDiceAvoidsTargetAnchor(page, audit, `${label}-投射飞行中`);
        }
        await saveEvidenceScreenshot(page, testInfo, `${label}-${resolveFxTravelScreenshotSuffix(kind)}`, { animations: 'allow' });
    } else {
        expect(audit.hasTravel).toBe(false);
        return audit;
    }

    await expect(page.getByTestId(resolveFxImpactTestId(kind)).first()).toBeVisible({ timeout: 5_000 });
    if (options.expectDamageFloat) {
        await page.waitForFunction(() => {
            const float = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-attack-damage-float"]');
            if (!float) return false;
            const rect = float.getBoundingClientRect();
            let effectiveOpacity = 1;
            let current: HTMLElement | null = float;
            while (current) {
                const opacity = Number.parseFloat(window.getComputedStyle(current).opacity || '1');
                if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
                current = current.parentElement;
            }
            return rect.width > 0
                && rect.height > 0
                && effectiveOpacity > 0.35
                && (float.textContent?.includes('-') ?? false);
        }, undefined, { timeout: 5_000 }).catch(async (error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            const debug = await readAttackDamageFloatDebug(page);
            throw new Error([
                'Mage Wars 攻击命中过程帧未捕捉到可见伤害飘字',
                message,
                `debug=${JSON.stringify(debug, null, 2)}`,
            ].join('\n'));
        });
        await expectMageWarsFxTargetAnchorVisible(page, audit, `${label}-命中和伤害飘字`);
        await saveEvidenceScreenshot(page, testInfo, `${label}-命中动画和伤害飘字过程帧`, { animations: 'allow' });
    } else {
        const impactBurstTestId = resolveFxImpactBurstTestId(kind);
        if (impactBurstTestId) {
            await expect(page.getByTestId(impactBurstTestId).first()).toBeVisible({ timeout: 5_000 });
            await page.waitForTimeout(2_250);
        }
        await saveEvidenceScreenshot(page, testInfo, `${label}-${resolveFxImpactScreenshotSuffix(kind)}`, { animations: 'allow' });
    }

    return audit;
}

async function selectPreparedSpell(page: Page, preparedCard: Locator, contextLabel: string) {
    await preparedCard.scrollIntoViewIfNeeded();
    const beforeHit = await readHitTest(preparedCard);
    await preparedCard.click({ timeout: 3_000, noWaitAfter: true });
    await expect(preparedCard).toHaveAttribute('data-selected', 'true', {
        timeout: 3_000,
    }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const [afterHit, snapshot] = await Promise.all([
            readHitTest(preparedCard).catch((hitError: unknown) => ({
                error: hitError instanceof Error ? hitError.message : String(hitError),
            })),
            readOnlineBoardSnapshot(page),
        ]);
        throw new Error([
            `${contextLabel} 点击后没有进入选中态`,
            message,
            `beforeHit=${JSON.stringify(beforeHit, null, 2)}`,
            `afterHit=${JSON.stringify(afterHit, null, 2)}`,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
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
    await fieldObject.click({ timeout: 3_000, noWaitAfter: true }).catch(async (error: unknown) => {
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
    await zone.click({ timeout: 3_000, noWaitAfter: true }).catch(async (error: unknown) => {
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
    await zone.click({ timeout: 3_000, noWaitAfter: true }).catch(async (error: unknown) => {
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

async function advanceUntilPhase(
    match: MageWarsOnlineMatch,
    targetPhase: string,
    contextLabel: string,
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
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
): Promise<MageWarsOnlineMatch> {
    const hostContext = await browser.newContext({ baseURL, ...contextOptions });
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
            setupData: { guestId, ownerKey: `guest:${guestId}`, ownerType: 'guest' },
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

async function advanceUntilEnabled(page: Page, locator: ReturnType<Page['getByRole']>) {
    for (let index = 0; index < 16; index += 1) {
        if (await locator.isEnabled().catch(() => false)) return;
        const turnEnd = page.getByTestId('mage-wars-turn-end');
        await expect(turnEnd).toBeVisible();
        if (!await clickPlanningOrTurnEndIfEnabled(page)) await page.waitForTimeout(180);
    }
    await expect(locator).toBeEnabled();
}

async function selectFirstVisibleSpellbookCard(page: Page): Promise<string> {
    for (let index = 0; index < 8; index += 1) {
        const cards = page.getByTestId('mage-wars-desktop-spellbook-card');
        const count = await cards.count();
        for (let cardIndex = 0; cardIndex < count; cardIndex += 1) {
            const card = cards.nth(cardIndex);
            if (await card.isVisible().catch(() => false) && await card.isEnabled().catch(() => false)) {
                const name = await card.getAttribute('aria-label');
                if (!name) continue;
                await card.click({ timeout: 3_000, noWaitAfter: true });
                return name;
            }
        }
        const nextPage = page.getByRole('button', { name: '下一页', exact: true });
        if (await nextPage.isDisabled().catch(() => true)) break;
        await nextPage.click({ timeout: 3_000, noWaitAfter: true });
    }
    throw new Error('正式联机法术书中没有可选的生物卡牌');
}

async function selectNamedSpellbookCard(page: Page, name: string) {
    const allFilter = page.getByRole('button', { name: '全部', exact: true });
    if (await allFilter.isEnabled({ timeout: 500 }).catch(() => false)) {
        await allFilter.click({ timeout: 3_000, noWaitAfter: true });
    } else {
        await expect(allFilter).toHaveAttribute('aria-pressed', 'true', { timeout: 3_000 });
    }
    const previousPage = page.getByRole('button', { name: '上一页', exact: true });
    for (let index = 0; index < 8; index += 1) {
        if (await previousPage.isDisabled().catch(() => true)) break;
        await previousPage.click({ timeout: 3_000, noWaitAfter: true });
    }
    await expect(previousPage).toBeDisabled({ timeout: 3_000 });

    const seenPages: string[][] = [];
    for (let index = 0; index < 8; index += 1) {
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
    await expect(page.getByTestId('mage-wars-plan-spells')).toHaveText(`计划 ${names.length} 张`);
    await page.getByTestId('mage-wars-plan-spells').click({ timeout: 3_000, noWaitAfter: true });
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
    await expect.poll(async () => (
        hasArenaObjectSnapshot(await readServerCoreSnapshot(page, match, playerId), options)
    ), {
        message,
        timeout: 5_000,
    }).toBe(true);
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
) {
    const preparedCard = selfPreparedCardByName(page, creatureName);
    await advanceUntilEnabled(page, preparedCard);
    const sourceCardId = await preparedCard.getAttribute('data-source-card-id');
    if (!sourceCardId) throw new Error(`部署 ${creatureName} 前未能读取 CardID`);

    await selectPreparedSpell(page, preparedCard, `${label} 选择召唤来源`);
    const targetZone = page.getByTestId(`mage-wars-arena-zone-${zoneId}`);
    await expect(targetZone).toHaveAttribute('data-legal-target-zone', 'true', { timeout: 3_000 });
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
    });
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
) {
    const prepared = selfPreparedCardByName(page, spellName);
    await advanceUntilEnabled(page, prepared);
    await selectPreparedSpell(page, prepared, spellName);
    const mageEntity = page.locator(`[data-testid="mage-wars-zone-mage-entity"][data-player-id="${targetPlayerId}"]`).first();
    await expect(mageEntity).toBeVisible({ timeout: 3_000 });
    await mageEntity.click({ timeout: 3_000, noWaitAfter: true, force: true }).catch(async (error: unknown) => {
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
    beforeTargetClick?: () => void,
) {
    const prepared = selfPreparedCardByName(page, spellName);
    await advanceUntilEnabled(page, prepared);
    await selectPreparedSpell(page, prepared, spellName);
    await expect(target.locator('[data-testid="mage-wars-field-card-target-frame"]')).toBeVisible();
    beforeTargetClick?.();
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
            && await fieldObject.isEnabled({ timeout: 200 }).catch(() => false)
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

test.describe('Mage Wars formal online runtime', () => {
    test('正式联机入口从双方计划到部署并保持对手计划隐藏', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL);
        const hostDiagnostics = attachPageDiagnostics(match.hostPage);
        const guestDiagnostics = attachPageDiagnostics(match.guestPage);

        try {
            await advanceBothPlayersToPlanning(match);
            await expect(match.hostPage.getByTestId('mage-wars-plan-spells')).toBeVisible();
            await expect(match.guestPage.getByTestId('mage-wars-plan-spells')).toBeVisible();
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

    test('正式联机入口真实施放强化法术并只产生法力、弃牌和卡牌结果', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL);
        const hostDiagnostics = attachPageDiagnostics(match.hostPage);
        const guestDiagnostics = attachPageDiagnostics(match.guestPage);

        try {
            await advanceBothPlayersToPlanning(match);
            await match.hostPage.getByRole('button', { name: '全部', exact: true }).click();
            await selectNamedSpellbookCard(match.hostPage, '丛林灰狼');
            await selectNamedSpellbookCard(match.hostPage, '冲锋陷阵');
            await expect(match.hostPage.getByTestId('mage-wars-plan-spells')).toHaveText('计划 2 张');
            await match.hostPage.getByTestId('mage-wars-plan-spells').click();

            await match.guestPage.getByRole('button', { name: '生物', exact: true }).click();
            const guestCreatureName = await selectFirstVisibleSpellbookCard(match.guestPage);
            await match.guestPage.getByTestId('mage-wars-plan-spells').click();

            await deployBothPlayers(match, '丛林灰狼', guestCreatureName, 'a3', 'd1', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);
            await advanceToPlayerCreatureAction(match, '0', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);

            const preparedCharge = selfPreparedCardByName(match.hostPage, '冲锋陷阵');
            await expect(preparedCharge).toBeEnabled();
            await preparedCharge.click();
            const wolfCard = match.hostPage.locator('[data-testid="mage-wars-arena-zone-a3"] [data-testid="mage-wars-zone-field-card"][data-source-card-id="2819"]').first();
            await expect(wolfCard.locator('[data-testid="mage-wars-field-card-target-frame"]')).toBeVisible();
            await wolfCard.click();
            await expect(match.hostPage.getByTestId('mage-wars-fx-spell-cast')).toHaveCount(0);

            await expect.poll(async () => match.hostPage.getByTestId('mage-wars-mage-hud-self').innerText()).toMatch(/法力\s+[\s\S]*7/);
            await expect(match.hostPage.getByTestId('mage-wars-discard-pile')).toContainText('弃牌 2');
            await expect(match.hostPage.locator(`${SELF_PREPARED_CARD_SELECTOR}[aria-label="冲锋陷阵"]`)).toHaveCount(0);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '03-冲锋陷阵结算后-法力弃牌已变化');
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
            await expect(match.guestPage.getByTestId('mage-wars-plan-spells')).toHaveText('计划 1 张');
            await match.guestPage.getByTestId('mage-wars-plan-spells').click();
            await advanceToReadyFieldObjectAction(match, '0', 'a3', 2819, '丛林灰狼', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);
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
            await expect(targetCleric.locator('img[alt*="伤害"]')).toBeVisible({ timeout: 5_000 });
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
        const recording = createMageWarsFxVideoRecording(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL);
        let recordedAttackContext: BrowserContext | null = null;
        let recordedHostVideo: RecordedVideo | null = null;
        let recordingDiagnostics: PageDiagnostics | null = null;
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

            const hostSummon = await deployCreatureWithSummonProcessEvidence(
                match,
                match.hostPage,
                '0',
                '野性山猫',
                ARENA_ZONE_IDS.A3,
                testInfo,
                '01-兽王野性山猫',
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
                '02-女祭司阿希拉牧师',
                diagnostics,
            );
            expect(guestSummon.sourceCardId).toBe(2811);
            await match.guestPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });

            await injectMageWarsSpellFxReadyState(match, '0', {
                mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
                preparedSpellCardId: attackSpellCardId,
                targetObject: createMageWarsE2eCreatureObject(
                    attackTargetObjectId,
                    '1',
                    2811,
                    '阿希拉牧师',
                    ARENA_ZONE_IDS.B3,
                ),
                mana: 12,
            });

            if (recording.enabled) {
                recordedAttackContext = await browser.newContext({ baseURL, ...recording.contextOptions });
                await initContext(recordedAttackContext, {
                    storageKey: `mage-wars-online-recorded-host-${Date.now()}`,
                    skipImageGate: false,
                    blockCdnAssets: false,
                    locale: 'zh-CN',
                });
                await seedMatchCredentials(recordedAttackContext, 'mage-wars', match.matchId, '0', match.hostCredentials);
                attackPage = await recordedAttackContext.newPage();
                recordingDiagnostics = attachPageDiagnostics(attackPage, 'recorded-host');
                recordedHostVideo = attackPage.video();
                await attackPage.goto(`/play/mage-wars/match/${match.matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
                await openOnlineBoard(attackPage, '录屏房主');
            }

            const attackTarget = attackPage
                .locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${attackTargetObjectId}"]`)
                .first();
            await expect(attackTarget).toBeVisible({ timeout: 5_000 });
            await waitForVisibleMageWarsAtlasCardsLoaded(attackPage, '攻击代表态目标牌面截图前预加载');
            let attackFxAuditPromise: ReturnType<typeof captureMageWarsFxProcessScreenshots> | undefined;
            await castPreparedSpellOnFieldObject(attackPage, '间歇喷泉', attackTarget, () => {
                attackFxAuditPromise = captureMageWarsFxProcessScreenshots(
                    attackPage,
                    testInfo,
                    'attack',
                    '03-间歇喷泉攻击阿希拉牧师',
                    {
                        expectTravel: true,
                        expectDamageFloat: true,
                    },
                );
            });
            if (!attackFxAuditPromise) {
                throw new Error('间歇喷泉点击前未启动攻击 FX 捕捉');
            }
            const attackFxAudit = await attackFxAuditPromise;
            expect(attackFxAudit.sourceRow).toBe('2');
            expect(attackFxAudit.sourceCol).toBe('0');
            expect(attackFxAudit.targetRow).toBe('2');
            expect(attackFxAudit.targetCol).toBe('1');

            await expect.poll(async () => (
                hasSpellAttackRolledEvent(
                    await readServerCoreSnapshot(attackPage, match, '0'),
                    attackSpellCardId,
                    attackTargetObjectId,
                )
            ), {
                message: '间歇喷泉必须通过正式页面点击目标后产生攻击掷骰事件',
                timeout: 5_000,
            }).toBe(true);
            await waitForVisibleMageWarsAtlasCardsLoaded(attackPage, '召唤和攻击必要过程帧完成后');
        } finally {
            await Promise.all([
                recordedAttackContext?.close() ?? Promise.resolve(),
                match.hostContext.close(),
                match.guestContext.close(),
            ]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        if (recordingDiagnostics) {
            expect(recordingDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        }
        await finalizeMageWarsFxVideoRecording(testInfo, recording, recordedHostVideo);
    });

    test('正式联机入口覆盖两派系法术类型代表链', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(420_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL);
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
            await planNamedSpells(match.hostPage, ['巨熊皮甲', '巨熊力量']);
            await planNamedSpells(match.guestPage, ['风龙皮甲', '公牛耐力']);
            const secondRoundOrder = await resolveCurrentActorOrder(match, '装备和结界代表链', diagnostics);
            for (const actorId of secondRoundOrder) {
                if (actorId === '0') {
                    await castPreparedSpellOnMage(match.hostPage, '巨熊皮甲', '0');
                    await expectServerObject(match.hostPage, match, '0', {
                        sourceSpellCardId: 3711,
                        kind: 'equipment',
                        ownerId: '0',
                        anchoredToPlayerId: '0',
                    }, '兽王装备巨熊皮甲应通过正式页面施放并附着到兽王法师');

                    await castPreparedSpellOnFieldObject(match.hostPage, '巨熊力量', hostBobcatById);
                    await expectServerObject(match.hostPage, match, '0', {
                        sourceSpellCardId: 1914,
                        kind: 'enchantment',
                        ownerId: '0',
                        anchoredToObjectId: hostBobcatObjectId,
                    revealed: true,
                }, '兽王结界巨熊力量应通过正式页面施放并附着到野性山猫');
                await match.hostPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });
                continue;
            }

                await castPreparedSpellOnMage(match.guestPage, '风龙皮甲', '1');
                await expectServerObject(match.guestPage, match, '1', {
                    sourceSpellCardId: 3708,
                    kind: 'equipment',
                    ownerId: '1',
                    anchoredToPlayerId: '1',
                }, '女祭司装备风龙皮甲应通过正式页面施放并附着到女祭司法师');

                const guestClericById = match.guestPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${guestClericObjectId}"]`).first();
                await castPreparedSpellOnFieldObject(match.guestPage, '公牛耐力', guestClericById);
                await expectServerObject(match.guestPage, match, '1', {
                    sourceSpellCardId: 1808,
                    kind: 'enchantment',
                    ownerId: '1',
                    anchoredToObjectId: guestClericObjectId,
                    revealed: true,
                }, '女祭司结界公牛耐力应通过正式页面施放并附着到阿希拉牧师');
                await match.guestPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });
            }
            const hostMageEquipment = match.hostPage.locator('[data-testid="mage-wars-attached-card"][data-source-card-id="3711"][data-attachment-kind="equipment"]').first();
            const guestMageEquipment = match.hostPage.locator('[data-testid="mage-wars-attached-card"][data-source-card-id="3708"][data-attachment-kind="equipment"]').first();
            const hostCreatureEnchantment = match.hostPage.locator('[data-testid="mage-wars-attached-card"][data-source-card-id="1914"][data-attachment-kind="enchantment"]').first();
            const guestCreatureEnchantment = match.hostPage.locator('[data-testid="mage-wars-attached-card"][data-source-card-id="1808"][data-attachment-kind="enchantment"]').first();
            const attachedCards = [hostMageEquipment, guestMageEquipment, hostCreatureEnchantment, guestCreatureEnchantment];
            for (const attachedCard of attachedCards) {
                await expect(attachedCard).toBeVisible();
                await expectNoExternalAttachmentTypeLabel(attachedCard);
            }
            await expect(match.hostPage.locator('[data-testid="mage-wars-zone-field-card"][data-source-card-id="3711"]')).toHaveCount(0);
            await expect(match.hostPage.locator('[data-testid="mage-wars-zone-field-card"][data-source-card-id="3708"]')).toHaveCount(0);
            await expect(match.hostPage.locator('[data-testid="mage-wars-zone-field-card"][data-source-card-id="1914"]')).toHaveCount(0);
            await expect(match.hostPage.locator('[data-testid="mage-wars-zone-field-card"][data-source-card-id="1808"]')).toHaveCount(0);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '10-装备和结界作为附件结算后-两派系附着关系可见');

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
                    await castPreparedSpellOnFieldObject(match.hostPage, '间歇喷泉', hostTargetBobcat, () => {
                        geyserAttackFxAuditPromise = captureMageWarsFxProcessScreenshots(
                            match.hostPage,
                            testInfo,
                            'attack',
                            '11A-间歇喷泉攻击法术',
                            {
                                expectTravel: true,
                                expectDamageFloat: true,
                            },
                        );
                    });
                    if (!geyserAttackFxAuditPromise) {
                        throw new Error('间歇喷泉点击前未启动攻击 FX 捕捉');
                    }
                    const geyserAttackFxAudit = await geyserAttackFxAuditPromise;
                    expect(geyserAttackFxAudit.targetRow).toBe('1');
                    expect(geyserAttackFxAudit.targetCol).toBe('0');
                    await expect.poll(async () => (
                        hasSpellAttackRolledEvent(await readServerCoreSnapshot(match.hostPage, match, '0'), 1710, hostBobcatObjectId)
                    ), {
                        message: '兽王攻击法术间歇喷泉应通过正式页面产生攻击掷骰事件',
                        timeout: 5_000,
                    }).toBe(true);
                    await match.hostPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });
                    continue;
                }

                await match.guestPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000, noWaitAfter: true });
            }
            await saveEvidenceScreenshot(match.hostPage, testInfo, '11-缠绕藤蔓和攻击法术结算后-魔物与攻击效果可见');
        } finally {
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    });

    test('正式页面推斥法术过程帧覆盖来源飞行命中', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await clearEvidenceScreenshotsForTest(testInfo);
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

            const pushFxAuditPromise = captureMageWarsFxProcessScreenshots(
                match.guestPage,
                testInfo,
                'push',
                '12A-原力推斥',
                { expectTravel: true },
            );
            await clickLegalTargetZone(match.guestPage, 'c3', '原力推斥选择推离落点');
            const pushFxAudit = await pushFxAuditPromise;
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
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    });

    test('正式页面传送法术过程帧覆盖来源轨迹落点', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL);
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

            const target = match.hostPage.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${targetObjectId}"]`).first();
            await selectPreparedSpell(match.hostPage, selfPreparedCardByName(match.hostPage, '传送'), '传送');
            await clickFieldObject(match.hostPage, target, '传送选择目标生物');
            await expect(target).toHaveAttribute('data-field-card-role', 'source', { timeout: 3_000 });
            await expect(match.hostPage.getByTestId('mage-wars-arena-zone-b3')).toHaveAttribute('data-legal-target-zone', 'true', {
                timeout: 3_000,
            });

            const teleportFxAuditPromise = captureMageWarsFxProcessScreenshots(
                match.hostPage,
                testInfo,
                'teleport',
                '12B-传送',
                { expectTravel: true },
            );
            await clickLegalTargetZone(match.hostPage, 'b3', '传送选择目标区域');
            const teleportFxAudit = await teleportFxAuditPromise;
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
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    });
});
