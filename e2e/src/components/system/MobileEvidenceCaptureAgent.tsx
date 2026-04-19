import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { createScopedLogger } from '../../lib/logger';

const logger = createScopedLogger('mobile-evidence-capture');
const CAPTURE_PARAM = 'bgCapture';
const CAPTURE_SAVE_URL_PARAM = 'bgCaptureSaveUrl';
const CAPTURE_STATUS_URL_PARAM = 'bgCaptureStatusUrl';
const CAPTURE_OUTPUT_PATH_PARAM = 'bgCaptureOutputPath';
const DEFAULT_CAPTURE_SAVE_URL = '/__capture/save';
const DEFAULT_CAPTURE_STATUS_URL = '/__capture/status';
type Html2CanvasFn = typeof import('html2canvas').default;
type SmashUpMobileEvidenceInjector = typeof import('../../games/smashup/mobileEvidence').injectSmashUpFourPlayerMobileEvidenceScene;
type SummonerWarsMobileEvidenceInjector = typeof import('../../games/summonerwars/mobileEvidence').injectSummonerWarsMobileEvidenceScene;
type SummonerWarsMobileEvidenceStateFactory = typeof import('../../games/summonerwars/mobileEvidence').withSummonerWarsMobileEvidenceActionLog;

let html2CanvasLoader: Promise<Html2CanvasFn> | null = null;
let smashUpMobileEvidenceInjectorLoader: Promise<SmashUpMobileEvidenceInjector> | null = null;
let summonerWarsMobileEvidenceInjectorLoader: Promise<SummonerWarsMobileEvidenceInjector> | null = null;
let summonerWarsMobileEvidenceStateFactoryLoader: Promise<SummonerWarsMobileEvidenceStateFactory> | null = null;

const sleep = (ms: number) => new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
});

async function waitForCondition(
    label: string,
    check: () => boolean | Promise<boolean>,
    timeoutMs = 15000,
    intervalMs = 120,
) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        if (await check()) {
            return;
        }
        await sleep(intervalMs);
    }
    throw new Error(`等待超时: ${label}`);
}

function getVisibleElement(selector: string) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) {
        return null;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
        return null;
    }

    const styles = window.getComputedStyle(element);
    if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') {
        return null;
    }

    return element;
}

function getVisibleElements(selector: string) {
    return Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return false;
        }

        const styles = window.getComputedStyle(element);
        return styles.display !== 'none' && styles.visibility !== 'hidden' && styles.opacity !== '0';
    });
}

function clickElement(selector: string, visibleOnly = false) {
    const element = visibleOnly ? getVisibleElement(selector) : document.querySelector<HTMLElement>(selector);
    if (!element) {
        return false;
    }
    element.click();
    return true;
}

function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const prototype = element instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    descriptor?.set?.call(element, value);
    if (!descriptor?.set) {
        element.value = value;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

function dispatchPointerEvent(element: HTMLElement, type: 'pointerdown' | 'pointerup', pointerId: number) {
    const rect = element.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    element.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        pointerId,
        pointerType: 'touch',
        clientX,
        clientY,
    }));
}

async function longPressElement(selector: string, label: string, pointerId: number) {
    const element = getVisibleElement(selector);
    if (!element) {
        throw new Error(`未找到可见元素: ${label}`);
    }

    dispatchPointerEvent(element, 'pointerdown', pointerId);
    await sleep(560);
    dispatchPointerEvent(element, 'pointerup', pointerId);
}

async function waitForMagnifyOverlayReady(overlaySelector: string, label: string) {
    await waitForCondition(
        `${label} 放大层出现`,
        () => Boolean(getVisibleElement(overlaySelector)),
        6000,
    );
    await waitForCondition(
        `${label} 放大层内容完成渲染`,
        () => {
            const overlay = getVisibleElement(overlaySelector);
            return Boolean(overlay) && overlay.querySelectorAll('.atlas-shimmer').length === 0;
        },
        8000,
    );
}

async function ensureDebugPanelOpen() {
    if (getVisibleElement('[data-testid="debug-panel"]')) {
        return;
    }

    if (!clickElement('[data-testid="debug-toggle"]', true)) {
        throw new Error('未找到 debug toggle');
    }

    await waitForCondition(
        'Debug 面板出现',
        () => Boolean(getVisibleElement('[data-testid="debug-panel"]')),
        5000,
    );
}

async function ensureDebugStateTab() {
    await ensureDebugPanelOpen();
    clickElement('[data-testid="debug-tab-state"]', true);
    await waitForCondition(
        'Debug 状态 JSON 出现',
        () => Boolean(getVisibleElement('[data-testid="debug-state-json"]')),
        5000,
    );
}

async function closeDebugPanelIfOpen() {
    if (!getVisibleElement('[data-testid="debug-panel"]')) {
        return;
    }

    clickElement('[data-testid="debug-toggle"]', true);
    await waitForCondition(
        'Debug 面板关闭',
        () => !getVisibleElement('[data-testid="debug-panel"]'),
        5000,
    );
}

async function readDebugState() {
    await ensureDebugStateTab();
    const raw = document.querySelector<HTMLElement>('[data-testid="debug-state-json"]')?.innerText?.trim();
    if (!raw) {
        throw new Error('Debug 状态 JSON 为空');
    }
    return JSON.parse(raw);
}

async function applyDebugState(nextState: unknown) {
    await ensureDebugStateTab();
    clickElement('[data-testid="debug-state-toggle-input"]', true);

    await waitForCondition(
        'Debug 状态输入框出现',
        () => Boolean(getVisibleElement('[data-testid="debug-state-input"]')),
        5000,
    );

    const input = document.querySelector<HTMLTextAreaElement>('[data-testid="debug-state-input"]');
    if (!input) {
        throw new Error('未找到 Debug 状态输入框');
    }

    setInputValue(input, JSON.stringify(nextState));
    clickElement('[data-testid="debug-state-apply"]', true);

    await waitForCondition(
        'Debug 状态输入框关闭',
        () => !getVisibleElement('[data-testid="debug-state-input"]'),
        5000,
    );
}

async function seedSummonerWarsActionLog() {
    await waitForCondition(
        'Summoner Wars TestHarness 就绪',
        () => Boolean(window.__BG_TEST_HARNESS__?.state?.isRegistered?.()),
        15000,
    );

    const harness = window.__BG_TEST_HARNESS__;
    if (!harness) {
        throw new Error('TestHarness 未挂载');
    }

    const withActionLog = await loadSummonerWarsMobileEvidenceStateFactory();
    const currentState = harness.state.get();
    if (!currentState) {
        throw new Error('Summoner Wars 当前状态未就绪');
    }

    harness.state.set(withActionLog(currentState, Date.now()));
}

async function openFabPanel(panelId: string, mainId = 'chat') {
    const panelSelector = `[data-testid="fab-panel-${panelId}"]`;
    if (getVisibleElement(panelSelector)) {
        return;
    }

    const panelButtonSelector = `[data-fab-id="${panelId}"]`;
    if (!getVisibleElement(panelButtonSelector)) {
        if (!clickElement(`[data-fab-id="${mainId}"]`, true)) {
            throw new Error(`未找到 FAB 主按钮: ${mainId}`);
        }
        await waitForCondition(
            `FAB 子按钮出现 (${panelId})`,
            () => Boolean(getVisibleElement(panelButtonSelector)),
            5000,
        );
    }

    if (!clickElement(panelButtonSelector, true)) {
        throw new Error(`未找到 FAB 子按钮: ${panelId}`);
    }

    await waitForCondition(
        `FAB 面板出现 (${panelId})`,
        () => Boolean(getVisibleElement(panelSelector)),
        5000,
    );
}

async function loadHtml2Canvas() {
    if (!html2CanvasLoader) {
        html2CanvasLoader = import('html2canvas')
            .then((module) => module.default)
            .catch((error) => {
                html2CanvasLoader = null;
                throw error;
            });
    }

    return html2CanvasLoader;
}

async function loadSmashUpMobileEvidenceInjector() {
    if (!smashUpMobileEvidenceInjectorLoader) {
        smashUpMobileEvidenceInjectorLoader = import('../../games/smashup/mobileEvidence')
            .then((module) => module.injectSmashUpFourPlayerMobileEvidenceScene)
            .catch((error) => {
                smashUpMobileEvidenceInjectorLoader = null;
                throw error;
            });
    }

    return smashUpMobileEvidenceInjectorLoader;
}

async function loadSummonerWarsMobileEvidenceInjector() {
    if (!summonerWarsMobileEvidenceInjectorLoader) {
        summonerWarsMobileEvidenceInjectorLoader = import('../../games/summonerwars/mobileEvidence')
            .then((module) => module.injectSummonerWarsMobileEvidenceScene)
            .catch((error) => {
                summonerWarsMobileEvidenceInjectorLoader = null;
                throw error;
            });
    }

    return summonerWarsMobileEvidenceInjectorLoader;
}

async function loadSummonerWarsMobileEvidenceStateFactory() {
    if (!summonerWarsMobileEvidenceStateFactoryLoader) {
        summonerWarsMobileEvidenceStateFactoryLoader = import('../../games/summonerwars/mobileEvidence')
            .then((module) => module.withSummonerWarsMobileEvidenceActionLog)
            .catch((error) => {
                summonerWarsMobileEvidenceStateFactoryLoader = null;
                throw error;
            });
    }

    return summonerWarsMobileEvidenceStateFactoryLoader;
}

async function uploadViewportCapture(saveUrl: string, scenario: string, outputPath?: string | null) {
    const html2canvas = await loadHtml2Canvas();
    await sleep(300);

    const target = (document.querySelector('[data-game-page]') as HTMLElement | null) ?? document.body;
    const canvas = await html2canvas(target, {
        backgroundColor: null,
        useCORS: true,
        logging: false,
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
    });

    const imageDataUrl = canvas.toDataURL('image/png');
    const response = await fetch(saveUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            scenario,
            outputPath,
            imageDataUrl,
            width: window.innerWidth,
            height: window.innerHeight,
        }),
    });

    if (!response.ok) {
        throw new Error(`capture upload failed: ${response.status}`);
    }
}

async function reportCaptureStatus(
    statusUrl: string,
    payload: {
        scenario: string;
        phase: string;
        message?: string;
        outputPath?: string | null;
        bytes?: number;
    },
) {
    const response = await fetch(statusUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        keepalive: true,
    });

    if (!response.ok) {
        throw new Error(`capture status update failed: ${response.status}`);
    }
}

async function runSmashUpTutorialScenario() {
    await waitForCondition(
        'Smash Up 教学浮层出现',
        () => Boolean(getVisibleElement('[data-testid="tutorial-overlay-card"]')),
        40000,
    );
}

async function prepareSummonerWarsBoard() {
    await waitForCondition(
        'Summoner Wars TestHarness 就绪',
        () => Boolean(window.__BG_TEST_HARNESS__?.state?.isRegistered?.()),
        15000,
    );

    const harness = window.__BG_TEST_HARNESS__;
    if (!harness) {
        throw new Error('TestHarness 未挂载');
    }

    const injectSummonerWarsMobileEvidenceScene = await loadSummonerWarsMobileEvidenceInjector();
    injectSummonerWarsMobileEvidenceScene(harness);

    await waitForCondition(
        '召唤师战争手牌区可见',
        () => Boolean(getVisibleElement('[data-testid="sw-hand-area"]')),
        20000,
    );
    await waitForCondition(
        '召唤师战争阶段条可见',
        () => Boolean(getVisibleElement('[data-testid="sw-phase-tracker"]')),
        10000,
    );
    await waitForCondition(
        '召唤师战争结束阶段按钮可见',
        () => Boolean(getVisibleElement('[data-testid="sw-end-phase"]')),
        10000,
    );
}

async function runSummonerWarsPhoneBoardScenario() {
    await prepareSummonerWarsBoard();
}

async function selectSummonerWarsHandCard() {
    clickElement('[data-testid="sw-hand-area"] [data-card-id]', true);
    await waitForCondition(
        '召唤师战争选中态放大入口可见',
        () => Boolean(getVisibleElement('[data-testid="sw-hand-area"] [data-selected="true"] [data-testid="sw-hand-card-magnify"]')),
        5000,
    );
}

async function runSummonerWarsHandMagnifyScenario() {
    await prepareSummonerWarsBoard();
    await selectSummonerWarsHandCard();
    clickElement('[data-testid="sw-hand-area"] [data-selected="true"] [data-testid="sw-hand-card-magnify"]', true);
    await waitForCondition(
        '召唤师战争放大层出现',
        () => {
            const overlay = getVisibleElement('[data-testid="sw-magnify-overlay"]');
            if (!overlay) {
                return false;
            }
            const styles = window.getComputedStyle(overlay);
            return styles.pointerEvents === 'auto' && styles.opacity === '1';
        },
        5000,
    );
}

async function runSummonerWarsPhaseDetailScenario() {
    await prepareSummonerWarsBoard();
    clickElement('[data-testid="sw-phase-item-build"]', true);
    await waitForCondition(
        '召唤师战争阶段详情面板出现',
        () => Boolean(getVisibleElement('[data-testid="sw-phase-detail-panel"]')),
        5000,
    );
}

async function runSummonerWarsActionLogScenario() {
    await prepareSummonerWarsBoard();
    await seedSummonerWarsActionLog();
    await openFabPanel('action-log', 'settings');
    await waitForCondition(
        '召唤师战争操作日志行出现',
        () => getVisibleElements('[data-testid="hud-action-log-row"]').length >= 2,
        5000,
    );
}

async function runSummonerWarsTabletBoardScenario() {
    await prepareSummonerWarsBoard();
}

async function prepareSmashUpFourPlayerBoard(options: { expandMinion?: boolean } = {}) {
    const { expandMinion = true } = options;
    await waitForCondition(
        'Smash Up TestHarness 就绪',
        () => {
            const harness = window.__BG_TEST_HARNESS__;
            return Boolean(harness?.state?.isRegistered?.() && harness?.command?.isRegistered?.());
        },
        15000,
    );

    const harness = window.__BG_TEST_HARNESS__;
    if (!harness) {
        throw new Error('TestHarness 未挂载');
    }

    const injectSmashUpFourPlayerMobileEvidenceScene = await loadSmashUpMobileEvidenceInjector();
    injectSmashUpFourPlayerMobileEvidenceScene(harness);

    await waitForCondition(
        'Smash Up 移动端场景注入完成',
        () => {
            const state = window.__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.phase === 'playCards'
                && (state?.core?.players?.['0']?.hand?.length ?? 0) === 2
                && state?.core?.bases?.[0]?.minions?.some((minion: { uid: string }) => minion.uid === 'p0-b0-armor-stego');
        },
        10000,
    );

    await waitForCondition(
        'Smash Up 目标随从可见',
        () => Boolean(getVisibleElement('[data-minion-uid="p0-b0-armor-stego"]')),
        15000,
    );

    if (!expandMinion) {
        return;
    }

    clickElement('[data-minion-uid="p0-b0-armor-stego"]', true);

    await waitForCondition(
        'Smash Up 单击后展开附属行动',
        () => {
            const minion = document.querySelector<HTMLElement>('[data-minion-uid="p0-b0-armor-stego"]');
            return minion?.dataset.expanded === 'true'
                && minion?.dataset.attachedActionsVisible === 'true'
                && minion?.dataset.activationArmed === 'true';
        },
        5000,
    );
}

async function runSmashUpFourPlayerAttachedActionsScenario() {
    await prepareSmashUpFourPlayerBoard();
}

async function runSmashUpMinionLongPressScenario() {
    await prepareSmashUpFourPlayerBoard();
    await longPressElement('[data-minion-uid="p0-b0-armor-stego"]', 'Smash Up 随从', 1);
    await waitForMagnifyOverlayReady('[data-testid="su-card-magnify-overlay"]', 'Smash Up 随从');
}

async function runSmashUpBaseLongPressScenario() {
    await prepareSmashUpFourPlayerBoard();
    await longPressElement('[data-base-index="1"]', 'Smash Up 基地', 2);
    await waitForMagnifyOverlayReady('[data-testid="su-card-magnify-overlay"]', 'Smash Up 基地');
}

async function runSmashUpBaseOngoingLongPressScenario() {
    await prepareSmashUpFourPlayerBoard();
    await longPressElement('[data-ongoing-uid="p0-b0-base-ongoing"]', 'Smash Up 基地持续行动', 3);
    await waitForMagnifyOverlayReady('[data-testid="su-card-magnify-overlay"]', 'Smash Up 基地持续行动');
}

async function runSmashUpAttachedActionLongPressScenario() {
    await prepareSmashUpFourPlayerBoard();
    await longPressElement('[data-attached-action-uid="p0-b0-armor-stego-upgrade"]', 'Smash Up 附属行动', 4);
    await waitForMagnifyOverlayReady('[data-testid="su-card-magnify-overlay"]', 'Smash Up 附属行动');
}

async function runSmashUpHandLongPressScenario() {
    await prepareSmashUpFourPlayerBoard();
    await longPressElement('[data-card-uid="p0-mobile-hand-terraform"]', 'Smash Up 手牌', 5);
    await waitForMagnifyOverlayReady('[data-testid="su-card-magnify-overlay"]', 'Smash Up 手牌');
}

async function runSmashUpTabletBoardScenario() {
    await prepareSmashUpFourPlayerBoard({ expandMinion: false });
}

const scenarioHandlers: Record<string, () => Promise<void>> = {
    'smashup-tutorial-mobile-landscape': runSmashUpTutorialScenario,
    'summonerwars-tutorial-phone-landscape': runSummonerWarsPhoneBoardScenario,
    'summonerwars-mobile-10-phone-landscape-board': runSummonerWarsPhoneBoardScenario,
    'summonerwars-mobile-11-hand-magnify-open': runSummonerWarsHandMagnifyScenario,
    'summonerwars-mobile-12-phase-detail-open': runSummonerWarsPhaseDetailScenario,
    'summonerwars-mobile-13-action-log-open': runSummonerWarsActionLogScenario,
    'summonerwars-mobile-20-tablet-landscape-board': runSummonerWarsTabletBoardScenario,
    'smashup-4p-mobile-attached-actions': runSmashUpFourPlayerAttachedActionsScenario,
    'smashup-4p-mobile-05-attached-actions': runSmashUpFourPlayerAttachedActionsScenario,
    'smashup-4p-mobile-07-minion-long-press': runSmashUpMinionLongPressScenario,
    'smashup-4p-mobile-08-base-long-press': runSmashUpBaseLongPressScenario,
    'smashup-4p-mobile-09-base-ongoing-long-press': runSmashUpBaseOngoingLongPressScenario,
    'smashup-4p-mobile-10-attached-action-long-press': runSmashUpAttachedActionLongPressScenario,
    'smashup-4p-mobile-11-hand-long-press': runSmashUpHandLongPressScenario,
    'smashup-4p-mobile-12-tablet-landscape': runSmashUpTabletBoardScenario,
};

export function MobileEvidenceCaptureAgent() {
    const location = useLocation();

    useEffect(() => {
        if (!import.meta.env.DEV) {
            return;
        }

        const params = new URLSearchParams(location.search);
        const scenario = params.get(CAPTURE_PARAM);
        if (!scenario) {
            return;
        }

        const handler = scenarioHandlers[scenario];
        const outputPath = params.get(CAPTURE_OUTPUT_PATH_PARAM);
        const saveUrl = params.get(CAPTURE_SAVE_URL_PARAM) || (outputPath ? DEFAULT_CAPTURE_SAVE_URL : null);
        const statusUrl = params.get(CAPTURE_STATUS_URL_PARAM) || DEFAULT_CAPTURE_STATUS_URL;

        if (!handler) {
            logger.warn('unknown-scenario', { scenario });
            return;
        }

        let disposed = false;
        const originalTitle = document.title;
        void (async () => {
            try {
                document.title = `capture-start:${scenario}`;
                logger.info('scenario-start', { scenario, path: `${location.pathname}${location.search}` });
                await reportCaptureStatus(statusUrl, {
                    scenario,
                    phase: 'scenario-start',
                    message: `${location.pathname}${location.search}`,
                    outputPath,
                });
                await handler();
                if (!disposed) {
                    document.documentElement.dataset.mobileEvidenceCaptureReady = scenario;
                    document.title = `capture-ready:${scenario}`;
                    logger.info('scenario-ready', { scenario });
                    await reportCaptureStatus(statusUrl, {
                        scenario,
                        phase: 'scenario-ready',
                        outputPath,
                    });
                    if (saveUrl) {
                        await reportCaptureStatus(statusUrl, {
                            scenario,
                            phase: 'scenario-uploading',
                            outputPath,
                        });
                        await uploadViewportCapture(saveUrl, scenario, outputPath);
                        document.title = `capture-uploaded:${scenario}`;
                        logger.info('scenario-uploaded', { scenario, saveUrl, outputPath });
                        await reportCaptureStatus(statusUrl, {
                            scenario,
                            phase: 'scenario-uploaded',
                            outputPath,
                        });
                    }
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error('scenario-failed', {
                    scenario,
                    error,
                });
                if (!disposed) {
                    document.documentElement.dataset.mobileEvidenceCaptureError = scenario;
                    document.title = `capture-failed:${scenario}`;
                    try {
                        await reportCaptureStatus(statusUrl, {
                            scenario,
                            phase: 'scenario-failed',
                            message: errorMessage,
                            outputPath,
                        });
                    } catch (statusError) {
                        logger.error('status-report-failed', {
                            scenario,
                            error: statusError,
                        });
                    }
                }
            }
        })();

        return () => {
            disposed = true;
            delete document.documentElement.dataset.mobileEvidenceCaptureReady;
            delete document.documentElement.dataset.mobileEvidenceCaptureError;
            document.title = originalTitle;
        };
    }, [location.pathname, location.search]);

    return null;
}

export default MobileEvidenceCaptureAgent;
