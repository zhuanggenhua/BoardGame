import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { createScopedLogger } from '../../lib/logger';
import type {
    MobileEvidenceScenarioContext,
    MobileEvidenceScenarioHandlers,
} from '../../shared/mobileEvidenceCapture';

const logger = createScopedLogger('mobile-evidence-capture');
const CAPTURE_PARAM = 'bgCapture';
const CAPTURE_SAVE_URL_PARAM = 'bgCaptureSaveUrl';
const CAPTURE_STATUS_URL_PARAM = 'bgCaptureStatusUrl';
const CAPTURE_OUTPUT_PATH_PARAM = 'bgCaptureOutputPath';
const DEFAULT_CAPTURE_SAVE_URL = '/__capture/save';
const DEFAULT_CAPTURE_STATUS_URL = '/__capture/status';

type Html2CanvasFn = typeof import('html2canvas').default;

let html2CanvasLoader: Promise<Html2CanvasFn> | null = null;

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
            return overlay !== null && overlay.querySelectorAll('.atlas-shimmer').length === 0;
        },
        8000,
    );
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

function createScenarioContext(): MobileEvidenceScenarioContext {
    return {
        sleep,
        waitForCondition,
        getVisibleElement,
        getVisibleElements,
        clickElement,
        longPressElement,
        waitForMagnifyOverlayReady,
        openFabPanel,
    };
}

export interface MobileEvidenceCaptureAgentProps {
    scenarioHandlers: MobileEvidenceScenarioHandlers;
}

export function MobileEvidenceCaptureAgent({
    scenarioHandlers,
}: MobileEvidenceCaptureAgentProps) {
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
        const scenarioContext = createScenarioContext();
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
                await handler(scenarioContext);
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
    }, [location.pathname, location.search, scenarioHandlers]);

    return null;
}

export default MobileEvidenceCaptureAgent;
