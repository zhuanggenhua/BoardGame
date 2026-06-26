import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { loadDevRuntimePorts } from './dev-port-runtime.js';

const GAME_NAME = 'fantasyrealms';
const DEFAULT_CDP_URL = 'http://127.0.0.1:9222';
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'test-results', 'evidence-screenshots', 'manual');
const TEST_API_TOKEN_FILE = path.resolve(process.cwd(), 'temp', 'e2e', 'shared-test-api-token.txt');

function parseArgs() {
    const args = process.argv.slice(2);
    let cdpUrl = DEFAULT_CDP_URL;
    let outputPrefix = 'fantasyrealms-real-chrome-diagnose';
    let keepPageOpen = false;

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
        if (arg === '--keep-page-open') {
            keepPageOpen = true;
        }
    }

    return { cdpUrl, outputPrefix, keepPageOpen };
}

function ensureTestApiToken() {
    return fs.readFileSync(TEST_API_TOKEN_FILE, 'utf8').trim();
}

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function getDevUrls() {
    const ports = loadDevRuntimePorts();
    if (!ports) {
        return {
            frontendBaseURL: 'http://127.0.0.1:4275',
            gameServerBaseURL: 'http://127.0.0.1:18002',
        };
    }
    return {
        frontendBaseURL: `http://127.0.0.1:${ports.frontend}`,
        gameServerBaseURL: `http://127.0.0.1:${ports.gameServer}`,
    };
}

async function createRoom(page, gameServerBaseURL) {
    const ownerGuestId = `fr-real-owner-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const createResponse = await page.request.post(`${gameServerBaseURL}/games/${GAME_NAME}/create`, {
        data: {
            numPlayers: 2,
            setupData: {
                guestId: ownerGuestId,
                ownerKey: `guest:${ownerGuestId}`,
                ownerType: 'guest',
                expansion: 'base',
                variant: 'duel',
                setupSelections: {
                    expansion: 'base',
                    variant: 'duel',
                },
                enableAi: true,
                seatControllers: {
                    '1': {
                        type: 'local-ai',
                        minimumActionDelayMs: 0,
                    },
                },
            },
            unlisted: false,
        },
    });
    if (!createResponse.ok()) {
        throw new Error(`create room failed: ${createResponse.status()} ${await createResponse.text()}`);
    }

    const createData = await createResponse.json();
    const matchId = createData.matchID;
    const ownerPlayerId = createData.ownerPlayerID || '0';
    let ownerCredentials = createData.ownerCredentials || null;

    if (!matchId) {
        throw new Error('missing matchID from create response');
    }

    if (!ownerCredentials) {
        const claimResponse = await page.request.post(`${gameServerBaseURL}/games/${GAME_NAME}/${matchId}/claim-seat`, {
            data: {
                playerID: ownerPlayerId,
                playerName: `Host-FR-Real-${Date.now()}`,
                guestId: ownerGuestId,
            },
        });
        if (!claimResponse.ok()) {
            throw new Error(`claim seat failed: ${claimResponse.status()} ${await claimResponse.text()}`);
        }
        const claimData = await claimResponse.json();
        ownerCredentials = claimData.playerCredentials || null;
    }

    if (!ownerCredentials) {
        throw new Error('missing owner credentials');
    }

    const aiGuestId = `fr-real-ai-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const joinResponse = await page.request.post(`${gameServerBaseURL}/games/${GAME_NAME}/${matchId}/join`, {
        data: {
            playerID: '1',
            playerName: `AI-FR-Real-${Date.now()}`,
            data: { guestId: aiGuestId },
        },
    });
    if (!joinResponse.ok()) {
        throw new Error(`join ai failed: ${joinResponse.status()} ${await joinResponse.text()}`);
    }
    const joinData = await joinResponse.json();
    const aiCredentials = joinData.playerCredentials || null;
    if (!aiCredentials) {
        throw new Error('missing ai credentials');
    }

    return {
        matchId,
        ownerPlayerId,
        ownerCredentials,
        aiCredentialsBySeat: { '1': aiCredentials },
    };
}

async function injectTwoCenterCardState(page, gameServerBaseURL, testApiToken, room) {
    const authHeaders = {
        'X-Test-Token': testApiToken,
        'X-Test-Player-Id': room.ownerPlayerId,
        'X-Test-Player-Credentials': room.ownerCredentials,
    };

    const currentStateResponse = await page.request.get(`${gameServerBaseURL}/test/get-state/${room.matchId}`, {
        headers: authHeaders,
    });
    if (!currentStateResponse.ok()) {
        throw new Error(`get-state failed: ${currentStateResponse.status()} ${await currentStateResponse.text()}`);
    }
    const currentStateData = await currentStateResponse.json();
    const currentState = currentStateData.state;

    const cardPool = [
        ...(currentState.core?.drawPile ?? []),
        ...(currentState.core?.discardPile ?? []),
        ...Object.values(currentState.core?.players ?? {}).flatMap((player) => player?.hand ?? []),
    ].map((entry) => deepClone(entry));
    if (cardPool.length < 20) {
        throw new Error(`card pool too small for injection: ${cardPool.length}`);
    }

    const takeCards = (count) => {
        const picked = cardPool.splice(0, count);
        if (picked.length !== count) {
            throw new Error(`not enough cards for injection: need ${count}, got ${picked.length}`);
        }
        return picked;
    };

    const injectedDiscardPile = takeCards(2);
    const injectedHostHand = takeCards(8);
    const injectedAiHand = takeCards(7);
    const injectedDrawPile = takeCards(3);

    const injectedState = {
        ...currentState,
        sys: {
            ...(currentState.sys ?? {}),
            matchId: room.matchId,
            gameover: null,
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
        },
        core: {
            ...currentState.core,
            currentPlayer: '0',
            turn: 4,
            stage: 'discard',
            discardPile: injectedDiscardPile,
            drawPile: injectedDrawPile,
            players: {
                ...currentState.core.players,
                '0': {
                    ...currentState.core.players['0'],
                    hand: injectedHostHand,
                },
                '1': {
                    ...currentState.core.players['1'],
                    hand: injectedAiHand,
                },
            },
            focusCardId: injectedDiscardPile[0]?.id ?? null,
        },
    };

    const injectResponse = await page.request.post(`${gameServerBaseURL}/test/inject-state`, {
        headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
        },
        data: {
            matchId: room.matchId,
            state: injectedState,
        },
    });
    if (!injectResponse.ok()) {
        throw new Error(`inject-state failed: ${injectResponse.status()} ${await injectResponse.text()}`);
    }
}

async function readRoomMetrics(page) {
    return page.evaluate(() => {
        const rect = (selector) => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const box = element.getBoundingClientRect();
            const css = getComputedStyle(element);
            return {
                x: Math.round(box.x),
                y: Math.round(box.y),
                width: Math.round(box.width),
                height: Math.round(box.height),
                gap: css.gap,
                gridTemplateColumns: css.gridTemplateColumns,
            };
        };
        const rects = (selector) => Array.from(document.querySelectorAll(selector)).map((element) => {
            const box = element.getBoundingClientRect();
            return {
                x: Math.round(box.x),
                y: Math.round(box.y),
                width: Math.round(box.width),
                height: Math.round(box.height),
            };
        });
        const root = document.querySelector('.fr-root');
        const rootCss = root ? getComputedStyle(root) : null;
        return {
            href: location.href,
            title: document.title,
            bodyText: document.body?.innerText?.slice(0, 300) || '',
            viewport: {
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                dpr: window.devicePixelRatio,
            },
            hasRoot: Boolean(root),
            rootVars: rootCss ? {
                contentWidth: rootCss.getPropertyValue('--fr-live-content-width').trim(),
                centerRowWidth: rootCss.getPropertyValue('--fr-live-center-row-width').trim(),
                centerCardWidth: rootCss.getPropertyValue('--fr-live-center-card-width').trim(),
                handRowWidth: rootCss.getPropertyValue('--fr-live-hand-row-width').trim(),
                handHeaderWidth: rootCss.getPropertyValue('--fr-live-hand-header-width').trim(),
                actionRightOffset: rootCss.getPropertyValue('--fr-live-action-right-offset').trim(),
                actionBottomOffset: rootCss.getPropertyValue('--fr-live-action-bottom-offset').trim(),
                desktopScale: rootCss.getPropertyValue('--fr-live-desktop-ui-scale').trim(),
            } : null,
            topbar: rect('[data-testid="fantasyrealms-live-topbar"]'),
            scoreStrip: rect('[data-testid="fantasyrealms-live-score-strip"]'),
            actionButton: rect('[data-testid^="fantasyrealms-live-action-"]'),
            handZone: rect('.fr-live-hand-zone .fr-card-row--live-hand-zone'),
            centerRow: rect('.fr-discard-row--live-center'),
            centerCards: rects('.fr-card-button--live-center'),
            handCards: rects('.fr-card-button--live-hand'),
        };
    });
}

async function main() {
    const options = parseArgs();
    const testApiToken = ensureTestApiToken();
    const { frontendBaseURL, gameServerBaseURL } = getDevUrls();

    const localBrowser = await chromium.launch({ headless: true });
    const localContext = await localBrowser.newContext({ baseURL: frontendBaseURL });
    const localPage = await localContext.newPage();

    const room = await createRoom(localPage, gameServerBaseURL);

    const cdpBrowser = await chromium.connectOverCDP(options.cdpUrl);
    const cdpContext = cdpBrowser.contexts()[0];
    const roomPage = await cdpContext.newPage();

    await roomPage.addInitScript(({ matchId, ownerPlayerId, ownerCredentials, aiCredentialsBySeat }) => {
        localStorage.setItem(`match_creds_${matchId}`, JSON.stringify({
            matchID: matchId,
            playerID: ownerPlayerId,
            credentials: ownerCredentials,
            gameName: 'fantasyrealms',
            updatedAt: Date.now(),
        }));
        localStorage.setItem(`match_ai_creds_${matchId}`, JSON.stringify(aiCredentialsBySeat));
    }, {
        matchId: room.matchId,
        ownerPlayerId: room.ownerPlayerId,
        ownerCredentials: room.ownerCredentials,
        aiCredentialsBySeat: room.aiCredentialsBySeat,
    });

    const roomUrl = `${frontendBaseURL}/play/${GAME_NAME}/match/${room.matchId}?playerID=${room.ownerPlayerId}`;
    await roomPage.goto(roomUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await roomPage.waitForTimeout(2500);

    await injectTwoCenterCardState(localPage, gameServerBaseURL, testApiToken, room);
    await roomPage.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await roomPage.waitForTimeout(2000);

    const metrics = await readRoomMetrics(roomPage);

    fs.mkdirSync(DEFAULT_OUTPUT_DIR, { recursive: true });
    const pngPath = path.join(DEFAULT_OUTPUT_DIR, `${options.outputPrefix}.png`);
    const jsonPath = path.join(DEFAULT_OUTPUT_DIR, `${options.outputPrefix}.json`);
    await roomPage.screenshot({ path: pngPath, fullPage: false });
    fs.writeFileSync(jsonPath, JSON.stringify({
        matchId: room.matchId,
        ownerPlayerId: room.ownerPlayerId,
        roomUrl,
        frontendBaseURL,
        gameServerBaseURL,
        ...metrics,
    }, null, 2), 'utf8');

    console.log(JSON.stringify({
        matchId: room.matchId,
        roomUrl,
        pngPath,
        jsonPath,
        metrics,
    }, null, 2));

    await localContext.close().catch(() => undefined);
    await localBrowser.close().catch(() => undefined);
    if (!options.keepPageOpen) {
        await roomPage.close().catch(() => undefined);
    }
    await cdpBrowser.close().catch(() => undefined);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
});
