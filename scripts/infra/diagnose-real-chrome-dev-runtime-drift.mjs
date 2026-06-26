import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { loadDevRuntimePorts } from './dev-port-runtime.js';

const DEFAULT_CDP_URL = 'http://127.0.0.1:9222';
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'test-results', 'evidence-screenshots', 'manual');
const DEV_RUNTIME_PORTS_FILE = path.resolve(process.cwd(), '.tmp', 'dev-runtime-ports.json');
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

function parseArgs() {
    const args = process.argv.slice(2);
    let cdpUrl = DEFAULT_CDP_URL;
    let outputPrefix = 'real-chrome-dev-runtime-drift';
    let screenshot = true;
    let compareReload = false;
    let urlContains = '';

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--cdp-url') {
            cdpUrl = args[index + 1] ?? cdpUrl;
            index += 1;
            continue;
        }
        if (arg.startsWith('--cdp-url=')) {
            cdpUrl = arg.slice('--cdp-url='.length) || cdpUrl;
            continue;
        }
        if (arg === '--output-prefix') {
            outputPrefix = args[index + 1] ?? outputPrefix;
            index += 1;
            continue;
        }
        if (arg.startsWith('--output-prefix=')) {
            outputPrefix = arg.slice('--output-prefix='.length) || outputPrefix;
            continue;
        }
        if (arg === '--no-screenshot') {
            screenshot = false;
            continue;
        }
        if (arg === '--compare-reload') {
            compareReload = true;
            continue;
        }
        if (arg === '--url-contains') {
            urlContains = args[index + 1] ?? urlContains;
            index += 1;
            continue;
        }
        if (arg.startsWith('--url-contains=')) {
            urlContains = arg.slice('--url-contains='.length) || urlContains;
        }
    }

    return { cdpUrl, outputPrefix, screenshot, compareReload, urlContains };
}

function sanitizeSegment(value) {
    return String(value || 'unknown')
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || 'unknown';
}

function safeErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

function readDevRuntimePortsMeta() {
    const activePorts = loadDevRuntimePorts();
    let fileRecord = null;
    try {
        fileRecord = JSON.parse(fs.readFileSync(DEV_RUNTIME_PORTS_FILE, 'utf8'));
    } catch {
        fileRecord = null;
    }
    return {
        activePorts,
        fileRecord,
    };
}

function extractLocalTarget(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') {
        return null;
    }
    try {
        const parsed = new URL(rawUrl);
        if (!['http:', 'https:'].includes(parsed.protocol) || !LOCAL_HOSTS.has(parsed.hostname)) {
            return null;
        }
        const port = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
        if (!Number.isFinite(port) || port <= 0) {
            return null;
        }
        return {
            href: parsed.href,
            hostname: parsed.hostname,
            port,
            path: `${parsed.pathname}${parsed.search}`,
        };
    } catch {
        return null;
    }
}

async function probeFrontendPort(port) {
    const probeUrl = `http://127.0.0.1:${port}/@vite/client`;
    try {
        const response = await fetch(probeUrl, {
            signal: AbortSignal.timeout(2500),
            redirect: 'manual',
        });
        return {
            reachable: response.ok,
            status: response.status,
            statusText: response.statusText,
            probeUrl,
        };
    } catch (error) {
        return {
            reachable: false,
            error: safeErrorMessage(error),
            probeUrl,
        };
    }
}

async function readPageState(page) {
    return page.evaluate(() => {
        const rect = (selector) => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const box = element.getBoundingClientRect();
            return {
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
                center: box.x + (box.width / 2),
            };
        };
        const rects = (selector) => Array.from(document.querySelectorAll(selector)).map((element) => {
            const box = element.getBoundingClientRect();
            return {
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
            };
        });
        const groupCenter = (items) => {
            if (!items.length) return null;
            const left = Math.min(...items.map((item) => item.x));
            const right = Math.max(...items.map((item) => item.x + item.width));
            return left + ((right - left) / 2);
        };
        const navigationEntries = performance.getEntriesByType('navigation');
        const firstNavigation = navigationEntries[0];
        const readBodyText = () => {
            try {
                return document.body?.innerText?.slice(0, 500) || '';
            } catch {
                return '';
            }
        };
        const readStorageKeys = () => {
            try {
                return Object.keys(localStorage)
                    .filter((key) => key.startsWith('match_') || key.startsWith('owner_active_match'))
                    .slice(0, 20);
            } catch {
                return [];
            }
        };

        const pageCenter = window.innerWidth / 2;
        const handRow = document.querySelector('[data-testid="fantasyrealms-hand-row"]');
        const handRowRect = rect('[data-testid="fantasyrealms-hand-row"]');
        const handCards = rects('.fr-card-button--live-hand');
        const handRowStyle = handRow ? getComputedStyle(handRow) : null;
        const discardRowRect = rect('[data-testid="fantasyrealms-discard-row"]');
        const centerCards = rects('.fr-card-button--live-center');
        const root = document.querySelector('.fr-root');
        const rootCss = root ? getComputedStyle(root) : null;

        return {
            href: location.href,
            navigationEntryName: typeof firstNavigation?.name === 'string' ? firstNavigation.name : '',
            title: document.title,
            bodyText: readBodyText(),
            readyState: document.readyState,
            hasAppRoot: Boolean(document.querySelector('#root')),
            hasFantasyRealmsRoot: Boolean(document.querySelector('.fr-root')),
            storageAccessible: (() => {
                try {
                    void localStorage.length;
                    return true;
                } catch {
                    return false;
                }
            })(),
            storageKeys: readStorageKeys(),
            viewport: {
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio,
            },
            fantasyRealmsLiveGeometry: {
                tableClass: document.querySelector('[data-testid="fantasyrealms-live-table"]')?.className || null,
                rootVars: rootCss ? {
                    contentWidth: rootCss.getPropertyValue('--fr-live-content-width').trim(),
                    centerRowWidth: rootCss.getPropertyValue('--fr-live-center-row-width').trim(),
                    centerCardWidth: rootCss.getPropertyValue('--fr-live-center-card-width').trim(),
                    handRowWidth: rootCss.getPropertyValue('--fr-live-hand-row-width').trim(),
                    desktopScale: rootCss.getPropertyValue('--fr-live-desktop-ui-scale').trim(),
                } : null,
                handRowSlotCount: handRow?.getAttribute('data-slot-count') || null,
                handRowVisibleCount: handRow?.getAttribute('data-visible-count') || null,
                handRowGridTemplateColumns: handRowStyle?.gridTemplateColumns || null,
                handRowGap: handRowStyle?.gap || null,
                handRowCenterDeltaToPage: handRowRect ? handRowRect.center - pageCenter : null,
                handCardsCount: handCards.length,
                handCardWidth: handCards[0]?.width ?? null,
                handCardHeight: handCards[0]?.height ?? null,
                handCardsCenterDeltaToHandRow: handCards.length && handRowRect ? groupCenter(handCards) - handRowRect.center : null,
                centerCardsCount: centerCards.length,
                centerCardWidth: centerCards[0]?.width ?? null,
                centerCardHeight: centerCards[0]?.height ?? null,
                centerRowCenterDeltaToPage: discardRowRect ? discardRowRect.center - pageCenter : null,
                centerCardsCenterDeltaToCenterRow: centerCards.length && discardRowRect ? groupCenter(centerCards) - discardRowRect.center : null,
            },
        };
    });
}

function classifyLocalPage(pageState, localTarget, activeFrontendPort, portProbe) {
    if (pageState.href.startsWith('chrome-error://chromewebdata/')) {
        if (localTarget) {
            if (portProbe?.reachable) {
                return '浏览器错误页-但目标端口仍存活';
            }
            return activeFrontendPort && localTarget.port === activeFrontendPort
                ? '浏览器错误页-当前前端端口不可达'
                : '浏览器错误页-失活旧前端端口';
        }
        return '浏览器错误页';
    }

    if (!localTarget) {
        return '非本地开发页';
    }

    if (!portProbe?.reachable) {
        return activeFrontendPort && localTarget.port === activeFrontendPort
            ? '当前前端端口不可达'
            : '失活旧前端端口';
    }

    if (activeFrontendPort && localTarget.port === activeFrontendPort) {
        return '当前活跃开发前端';
    }

    return '仍存活但不是当前前端端口';
}

function summarizeReloadDifferences(beforeState, afterState) {
    const differences = [];
    const beforeGeometry = beforeState?.fantasyRealmsLiveGeometry ?? {};
    const afterGeometry = afterState?.fantasyRealmsLiveGeometry ?? {};
    const compareField = (label, beforeValue, afterValue) => {
        if (beforeValue !== afterValue) {
            differences.push({ label, before: beforeValue, after: afterValue });
        }
    };

    compareField('href', beforeState?.href, afterState?.href);
    compareField('title', beforeState?.title, afterState?.title);
    compareField('tableClass', beforeGeometry.tableClass, afterGeometry.tableClass);
    compareField('handRowSlotCount', beforeGeometry.handRowSlotCount, afterGeometry.handRowSlotCount);
    compareField('handRowVisibleCount', beforeGeometry.handRowVisibleCount, afterGeometry.handRowVisibleCount);
    compareField('handRowGridTemplateColumns', beforeGeometry.handRowGridTemplateColumns, afterGeometry.handRowGridTemplateColumns);
    compareField('handCardsCount', beforeGeometry.handCardsCount, afterGeometry.handCardsCount);
    compareField('handCardWidth', beforeGeometry.handCardWidth, afterGeometry.handCardWidth);
    compareField('handCardsCenterDeltaToHandRow', beforeGeometry.handCardsCenterDeltaToHandRow, afterGeometry.handCardsCenterDeltaToHandRow);
    compareField('centerCardsCount', beforeGeometry.centerCardsCount, afterGeometry.centerCardsCount);
    compareField('centerCardWidth', beforeGeometry.centerCardWidth, afterGeometry.centerCardWidth);
    compareField('centerCardsCenterDeltaToCenterRow', beforeGeometry.centerCardsCenterDeltaToCenterRow, afterGeometry.centerCardsCenterDeltaToCenterRow);
    return differences;
}

async function inspectPage(page, index, activeFrontendPort, options) {
    const pageState = await readPageState(page).catch((error) => ({
        href: page.url(),
        navigationEntryName: '',
        title: null,
        bodyText: '',
        readyState: 'unknown',
        hasAppRoot: false,
        hasFantasyRealmsRoot: false,
        storageAccessible: false,
        storageKeys: [],
        viewport: null,
        fantasyRealmsLiveGeometry: null,
        readError: safeErrorMessage(error),
    }));

    const sourceUrl = pageState.href.startsWith('chrome-error://chromewebdata/')
        ? pageState.navigationEntryName || pageState.href
        : pageState.href;
    const localTarget = extractLocalTarget(sourceUrl);
    const portProbe = localTarget ? await probeFrontendPort(localTarget.port) : null;
    const verdict = classifyLocalPage(pageState, localTarget, activeFrontendPort, portProbe);

    let screenshotPath = null;
    if (options.screenshot) {
        const portLabel = localTarget ? `${localTarget.port}` : 'no-port';
        const verdictLabel = sanitizeSegment(verdict);
        const fileName = `${options.outputPrefix}-${String(index).padStart(2, '0')}-${portLabel}-${verdictLabel}.png`;
        screenshotPath = path.join(DEFAULT_OUTPUT_DIR, fileName);
        await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {
            screenshotPath = null;
        });
    }

    let reloadComparison = null;
    if (options.compareReload && verdict === '当前活跃开发前端' && !page.isClosed()) {
        const beforeReloadState = pageState;
        let afterReloadState = null;
        let afterReloadScreenshotPath = null;
        try {
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
            await page.waitForTimeout(1500);
            afterReloadState = await readPageState(page);
            if (options.screenshot) {
                const fileName = `${options.outputPrefix}-${String(index).padStart(2, '0')}-after-reload.png`;
                afterReloadScreenshotPath = path.join(DEFAULT_OUTPUT_DIR, fileName);
                await page.screenshot({ path: afterReloadScreenshotPath, fullPage: false }).catch(() => {
                    afterReloadScreenshotPath = null;
                });
            }
            reloadComparison = {
                changedFields: summarizeReloadDifferences(beforeReloadState, afterReloadState),
                beforeReload: beforeReloadState,
                afterReload: afterReloadState,
                afterReloadScreenshotPath,
            };
        } catch (error) {
            reloadComparison = {
                beforeReload: beforeReloadState,
                afterReload: afterReloadState,
                reloadError: safeErrorMessage(error),
                afterReloadScreenshotPath,
            };
        }
    }

    return {
        index,
        verdict,
        sourceUrl,
        localTarget,
        portProbe,
        screenshotPath,
        page: pageState,
        reloadComparison,
    };
}

async function main() {
    const options = parseArgs();
    fs.mkdirSync(DEFAULT_OUTPUT_DIR, { recursive: true });

    const browser = await chromium.connectOverCDP(options.cdpUrl);
    const contexts = browser.contexts();
    const pages = contexts.flatMap((context) => context.pages());
    const { activePorts, fileRecord } = readDevRuntimePortsMeta();
    const activeFrontendPort = activePorts?.frontend ?? null;

    const localCandidatePages = [];
    for (const page of pages) {
        const currentUrl = page.url();
        const matchesFilter = !options.urlContains || currentUrl.includes(options.urlContains);
        if (
            matchesFilter
            && (
                currentUrl.startsWith('chrome-error://chromewebdata/')
                || extractLocalTarget(currentUrl)
            )
        ) {
            localCandidatePages.push(page);
        }
    }

    const inspectedPages = [];
    for (let index = 0; index < localCandidatePages.length; index += 1) {
        inspectedPages.push(await inspectPage(localCandidatePages[index], index + 1, activeFrontendPort, options));
    }

    const summary = {
        inspectedAt: new Date().toISOString(),
        cdpUrl: options.cdpUrl,
        devRuntime: {
            activePorts,
            fileRecord,
        },
        pageCount: pages.length,
        localCandidateCount: localCandidatePages.length,
        pages: inspectedPages,
    };

    const summaryPath = path.join(DEFAULT_OUTPUT_DIR, `${options.outputPrefix}.json`);
    fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

    console.log(JSON.stringify({
        summaryPath,
        inspectedPageCount: inspectedPages.length,
        activeFrontendPort,
        pages: inspectedPages.map((entry) => ({
            index: entry.index,
            verdict: entry.verdict,
            sourceUrl: entry.sourceUrl,
            screenshotPath: entry.screenshotPath,
            reloadChangedFields: entry.reloadComparison?.changedFields?.map((item) => item.label) ?? [],
        })),
    }, null, 2));

    await browser.close().catch(() => undefined);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
});
