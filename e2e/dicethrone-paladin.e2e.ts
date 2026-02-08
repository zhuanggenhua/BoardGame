/**
 * 圣骑士 (Paladin) E2E 交互测试
 *
 * 覆盖交互面：
 * - 神圣祝福 (Blessing of Divinity) 触发：免疫伤害并回复生命
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { TOKEN_IDS } from '../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../src/games/dicethrone/domain/resources';
import { initHeroState, createCharacterDice } from '../src/games/dicethrone/domain/characters';

// ============================================================================
// 复用辅助函数（与 dicethrone-shadow-thief.e2e.ts 保持一致）
// ============================================================================

const setEnglishLocale = async (context: BrowserContext | Page) => {
    await context.addInitScript(() => {
        localStorage.setItem('i18nextLng', 'en');
    });
};

const normalizeUrl = (url: string) => url.replace(/\/$/, '');

const getGameServerBaseURL = () => {
    const envUrl = process.env.PW_GAME_SERVER_URL || process.env.VITE_GAME_SERVER_URL;
    if (envUrl) return normalizeUrl(envUrl);
    const port = process.env.GAME_SERVER_PORT || process.env.PW_GAME_SERVER_PORT || '18000';
    return `http://localhost:${port}`;
};

const ensureGameServerAvailable = async (page: Page) => {
    const gameServerBaseURL = getGameServerBaseURL();
    const candidates = ['/games', `${gameServerBaseURL}/games`];
    for (const url of candidates) {
        try {
            const response = await page.request.get(url);
            if (response.ok()) return true;
        } catch { /* ignore */ }
    }
    return false;
};

const disableTutorial = async (page: Page) => {
    await page.addInitScript(() => {
        localStorage.setItem('tutorial_skip', '1');
    });
};

const blockAudioRequests = async (context: BrowserContext | Page) => {
    await context.route(/\.(mp3|ogg|webm|wav)(\?.*)?$/i, route => route.abort());
};

const disableAudio = async (context: BrowserContext | Page) => {
    await context.addInitScript(() => {
        localStorage.setItem('audio_muted', 'true');
        localStorage.setItem('audio_master_volume', '0');
        localStorage.setItem('audio_sfx_volume', '0');
        localStorage.setItem('audio_bgm_volume', '0');
        (window as Window & { __BG_DISABLE_AUDIO__?: boolean }).__BG_DISABLE_AUDIO__ = true;
    });
};

const waitForMainPhase = async (page: Page, timeout = 20000) => {
    await expect(page.getByText(/Main Phase \(1\)|主要阶段 \(1\)/)).toBeVisible({ timeout });
};

const openDiceThroneModal = async (page: Page) => {
    await page.goto('/?game=dicethrone', { waitUntil: 'domcontentloaded' });
    const modalHeading = page.getByRole('heading', { name: /Dice Throne|王权骰铸/i }).first();
    await expect(modalHeading).toBeVisible({ timeout: 15000 });
};

const ensureDebugPanelOpen = async (page: Page) => {
    const panel = page.getByTestId('debug-panel');
    if (await panel.isVisible().catch(() => false)) return;
    await page.getByTestId('debug-toggle').click();
    await expect(panel).toBeVisible({ timeout: 5000 });
};

const closeDebugPanelIfOpen = async (page: Page) => {
    const panel = page.getByTestId('debug-panel');
    if (await panel.isVisible().catch(() => false)) {
        await page.getByTestId('debug-toggle').click();
        await expect(panel).toBeHidden({ timeout: 5000 });
    }
};

const ensureDebugControlsTab = async (page: Page) => {
    await ensureDebugPanelOpen(page);
    const controlsTab = page.getByRole('button', { name: /⚙️|System|系统/i });
    if (await controlsTab.isVisible().catch(() => false)) {
        await controlsTab.click();
    }
};

const ensureDebugStateTab = async (page: Page) => {
    await ensureDebugPanelOpen(page);
    const stateTab = page.getByTestId('debug-tab-state');
    if (await stateTab.isVisible().catch(() => false)) {
        await stateTab.click();
    }
};

const readCoreState = async (page: Page) => {
    await ensureDebugStateTab(page);
    const raw = await page.getByTestId('debug-state-json').innerText();
    const parsed = JSON.parse(raw);
    return parsed?.core ?? parsed?.G?.core ?? parsed;
};

const applyCoreState = async (page: Page, coreState: unknown) => {
    await ensureDebugStateTab(page);
    await page.getByTestId('debug-state-toggle-input').click();
    const input = page.getByTestId('debug-state-input');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill(JSON.stringify(coreState));
    await page.getByTestId('debug-state-apply').click();
    await expect(input).toBeHidden({ timeout: 5000 }).catch(() => {});
};

const applyDiceValues = async (page: Page, values: number[]) => {
    await ensureDebugControlsTab(page);
    const diceSection = page.getByTestId('dt-debug-dice');
    const diceInputs = diceSection.locator('input[type="number"]');
    await expect(diceInputs).toHaveCount(5);
    for (let i = 0; i < 5; i += 1) {
        await diceInputs.nth(i).fill(String(values[i] ?? 1));
    }
    await diceSection.getByTestId('dt-debug-dice-apply').click();
    await closeDebugPanelIfOpen(page);
};

const getPlayerIdFromUrl = (page: Page, fallback: string) => {
    try {
        const url = new URL(page.url());
        return url.searchParams.get('playerID') ?? fallback;
    } catch {
        return fallback;
    }
};

const buildHeroState = (playerId: string, characterId: 'barbarian' | 'paladin') => {
    const dummyRandom = {
        shuffle: <T>(arr: T[]) => arr,
        random: () => 0.5,
        d: (_n: number) => 1,
        range: (min: number) => min,
    } as const;
    return initHeroState(playerId, characterId, dummyRandom);
};

const advanceToOffensiveRoll = async (page: Page) => {
    const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
    for (let attempt = 0; attempt < 5; attempt += 1) {
        if (await rollButton.isEnabled().catch(() => false)) return;
        const nextPhaseButton = page.locator('[data-tutorial-id="advance-phase-button"]');
        if (await nextPhaseButton.isEnabled().catch(() => false)) {
            await nextPhaseButton.click();
            await page.waitForTimeout(500);
        } else if (await nextPhaseButton.isVisible().catch(() => false)) {
            await page.waitForTimeout(300);
        }
    }
};

const waitForPlayerId = async (page: Page, matchId: string, timeout = 30000) => {
    try {
        await page.waitForFunction(
            (id) => {
                const params = new URLSearchParams(window.location.search);
                if (params.get('playerID')) return true;
                const stored = localStorage.getItem(`match_creds_${id}`);
                if (!stored) return false;
                try {
                    const data = JSON.parse(stored);
                    return Boolean(data?.playerID);
                } catch {
                    return false;
                }
            },
            matchId,
            { timeout }
        );
    } catch {
        return false;
    }

    const storedPlayerId = await page.evaluate((id) => {
        const params = new URLSearchParams(window.location.search);
        const urlPlayerId = params.get('playerID');
        if (urlPlayerId) return urlPlayerId;
        const stored = localStorage.getItem(`match_creds_${id}`);
        if (!stored) return null;
        try {
            const data = JSON.parse(stored);
            return data?.playerID ?? null;
        } catch {
            return null;
        }
    }, matchId);

    if (storedPlayerId && !page.url().includes('playerID=')) {
        await page.goto(`/play/dicethrone/match/${matchId}?playerID=${storedPlayerId}`);
    }

    return true;
};

const joinMatchAsGuest = async (page: Page, matchId: string) => {
    const gameServerBaseURL = getGameServerBaseURL();
    try {
        const matchResponse = await page.request.get(`${gameServerBaseURL}/games/dicethrone/${matchId}`);
        if (!matchResponse.ok()) return null;
        const matchInfo = await matchResponse.json();
        const players = Array.isArray(matchInfo?.players) ? matchInfo.players : [];
        const openSeat = [...players]
            .sort((a, b) => (a?.id ?? 0) - (b?.id ?? 0))
            .find((player) => !player?.name);
        if (!openSeat) return null;
        const playerID = String(openSeat.id);
        const playerName = `Guest_${Date.now()}`;
        const joinResponse = await page.request.post(
            `${gameServerBaseURL}/games/dicethrone/${matchId}/join`,
            { data: { playerID, playerName } }
        );
        if (!joinResponse.ok()) return null;
        const joinData = await joinResponse.json();
        const playerCredentials = joinData?.playerCredentials;
        if (!playerCredentials) return null;

        await page.evaluate(
            ({ id, pid, credentials }) => {
                localStorage.setItem(
                    `match_creds_${id}`,
                    JSON.stringify({ matchID: id, gameName: 'dicethrone', playerID: pid, credentials })
                );
            },
            { id: matchId, pid: playerID, credentials: playerCredentials }
        );

        await page.goto(`/play/dicethrone/match/${matchId}?playerID=${playerID}`, { waitUntil: 'domcontentloaded' });
        return playerID;
    } catch {
        return null;
    }
};

/** 创建在线房间并双方加入，返回 { hostPage, guestPage, hostContext, guestContext } */
const setupOnlineMatch = async (
    browser: import('@playwright/test').Browser,
    baseURL: string | undefined,
    hostChar: string,
    guestChar: string,
) => {
    const hostContext = await browser.newContext({ baseURL });
    await blockAudioRequests(hostContext);
    await disableAudio(hostContext);
    await disableTutorial(hostContext as any);
    await setEnglishLocale(hostContext);
    const hostPage = await hostContext.newPage();

    if (!await ensureGameServerAvailable(hostPage)) {
        throw new Error('游戏服务器不可用');
    }

    await openDiceThroneModal(hostPage);
    await hostPage.getByRole('button', { name: /Create Room|创建房间/i }).click();
    await expect(hostPage.getByRole('heading', { name: /Create Room|创建房间/i })).toBeVisible();
    await hostPage.getByRole('button', { name: /Confirm|确认/i }).click();
    try {
        await hostPage.waitForURL(/\/play\/dicethrone\/match\//, { timeout: 5000 });
    } catch {
        throw new Error('房间创建失败或后端不可用');
    }

    const hostUrl = new URL(hostPage.url());
    const matchId = hostUrl.pathname.split('/').pop();
    if (!matchId) throw new Error('无法从 URL 解析 matchId');
    if (!hostUrl.searchParams.get('playerID')) {
        hostUrl.searchParams.set('playerID', '0');
        await hostPage.goto(hostUrl.toString());
    }

    const guestContext = await browser.newContext({ baseURL });
    await blockAudioRequests(guestContext);
    await disableAudio(guestContext);
    await disableTutorial(guestContext as any);
    await setEnglishLocale(guestContext);
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/play/dicethrone/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
    let guestHasPlayerId = false;
    try {
        await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });
        guestHasPlayerId = true;
    } catch {
        guestHasPlayerId = await waitForPlayerId(guestPage, matchId, 20000);
    }
    if (!guestHasPlayerId) {
        const forcedPlayerId = await joinMatchAsGuest(guestPage, matchId);
        if (!forcedPlayerId) {
            await waitForPlayerId(guestPage, matchId, 30000);
        }
    }

    // 检查是否自动开始
    let autoStarted = true;
    try {
        await waitForMainPhase(hostPage, 15000);
        await waitForMainPhase(guestPage, 15000);
    } catch {
        autoStarted = false;
    }

    if (autoStarted) {
        return { hostPage, guestPage, hostContext, guestContext, autoStarted: true };
    }

    // 角色选择
    await hostPage.waitForSelector(`[data-char-id="${hostChar}"]`, { state: 'attached', timeout: 60000 });
    await guestPage.waitForSelector(`[data-char-id="${guestChar}"]`, { state: 'attached', timeout: 60000 });
    await hostPage.locator(`[data-char-id="${hostChar}"]`).first().click();
    await guestPage.locator(`[data-char-id="${guestChar}"]`).first().click();

    const readyButton = guestPage.getByRole('button', { name: /Ready|准备/i });
    await expect(readyButton).toBeVisible({ timeout: 20000 });
    await expect(readyButton).toBeEnabled({ timeout: 20000 });
    await readyButton.click();

    const startButton = hostPage.getByRole('button', { name: /Start Game|开始游戏/i });
    await expect(startButton).toBeVisible({ timeout: 20000 });
    await expect(startButton).toBeEnabled({ timeout: 20000 });
    await startButton.click();

    await waitForMainPhase(hostPage, 15000);
    await waitForMainPhase(guestPage, 15000);

    return { hostPage, guestPage, hostContext, guestContext, autoStarted: false };
};

// ============================================================================
// 圣骑士 E2E 测试
// ============================================================================

test.describe('DiceThrone Paladin E2E', () => {
    // ========================================================================
    // 1. 神圣祝福触发（免疫伤害 + 回复生命）
    // ========================================================================
    test('Online match: Paladin Blessing of Divinity prevents lethal damage', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'barbarian', 'paladin');
        const { hostPage, guestPage, hostContext, guestContext, autoStarted } = match!;

        if (autoStarted) {
            const coreOnStart = await readCoreState(hostPage);
            const hostId = getPlayerIdFromUrl(hostPage, '0');
            const guestId = getPlayerIdFromUrl(guestPage, '1');
            const hostChar = coreOnStart?.players?.[hostId]?.characterId;
            const guestChar = coreOnStart?.players?.[guestId]?.characterId;

            if (hostChar !== 'barbarian' || guestChar !== 'paladin') {
                const nextCore = {
                    ...coreOnStart,
                    players: {
                        ...coreOnStart.players,
                        [hostId]: buildHeroState(hostId, 'barbarian'),
                        [guestId]: buildHeroState(guestId, 'paladin'),
                    },
                    selectedCharacters: {
                        ...coreOnStart.selectedCharacters,
                        [hostId]: 'barbarian',
                        [guestId]: 'paladin',
                    },
                    readyPlayers: {
                        ...coreOnStart.readyPlayers,
                        [hostId]: true,
                        [guestId]: true,
                    },
                    hostStarted: true,
                    activePlayerId: hostId,
                    startingPlayerId: hostId,
                    dice: createCharacterDice('barbarian'),
                };
                await applyCoreState(hostPage, nextCore);
                await hostPage.waitForTimeout(300);
            }
        }

        const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
        const hostIsActive = await hostNextPhase.isEnabled({ timeout: 3000 }).catch(() => false);
        if (!hostIsActive) {
            const coreSnapshot = await readCoreState(hostPage);
            const hostId = getPlayerIdFromUrl(hostPage, '0');
            const forcedCore = {
                ...coreSnapshot,
                activePlayerId: hostId,
                startingPlayerId: hostId,
            };
            await applyCoreState(hostPage, forcedCore);
            await hostPage.waitForTimeout(300);
        }

        const attackerPage = hostPage;
        const defenderPage = guestPage;
        const defenderId = getPlayerIdFromUrl(defenderPage, '1');

        const coreState = await readCoreState(attackerPage);
        const defenderState = coreState?.players?.[defenderId];
        if (!defenderState) {
            throw new Error('无法读取防御方状态');
        }

        const hpBefore = 1;
        const nextCoreState = {
            ...coreState,
            players: {
                ...coreState.players,
                [defenderId]: {
                    ...defenderState,
                    resources: {
                        ...(defenderState.resources ?? {}),
                        [RESOURCE_IDS.HP]: hpBefore,
                    },
                    tokens: {
                        ...(defenderState.tokens ?? {}),
                        [TOKEN_IDS.BLESSING_OF_DIVINITY]: 1,
                    },
                },
            },
        };

        await applyCoreState(attackerPage, nextCoreState);
        await attackerPage.waitForTimeout(300);

        // 狂战士进攻：4 Strength 触发不可防御攻击 (violent-assault)
        await advanceToOffensiveRoll(attackerPage);
        const rollButton = attackerPage.locator('[data-tutorial-id="dice-roll-button"]');
        await expect(rollButton).toBeEnabled({ timeout: 5000 });
        await rollButton.click();
        await attackerPage.waitForTimeout(300);
        await applyDiceValues(attackerPage, [6, 6, 6, 6, 1]);

        const confirmButton = attackerPage.locator('[data-tutorial-id="dice-confirm-button"]');
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

        const highlightedSlots = attackerPage
            .locator('[data-ability-slot]')
            .filter({ has: attackerPage.locator('div.animate-pulse[class*="border-"]') });
        await expect(highlightedSlots.first()).toBeVisible({ timeout: 8000 });
        await highlightedSlots.first().click();

        const resolveAttackButton = attackerPage.getByRole('button', { name: /Resolve Attack|结算攻击/i });
        await expect(resolveAttackButton).toBeVisible({ timeout: 10000 });
        await resolveAttackButton.click();

        await expect(attackerPage.getByText(/Main Phase \(2\)|主要阶段 \(2\)/)).toBeVisible({ timeout: 15000 });

        const coreAfter = await readCoreState(attackerPage);
        const defenderAfter = coreAfter?.players?.[defenderId];
        const hpAfter = defenderAfter?.resources?.[RESOURCE_IDS.HP] ?? 0;
        expect(hpAfter).toBe(hpBefore + 5);
        expect(defenderAfter?.tokens?.[TOKEN_IDS.BLESSING_OF_DIVINITY] ?? 0).toBe(0);

        await attackerPage.screenshot({ path: 'test-results/paladin-blessing-prevent.png', fullPage: false });

        await hostContext.close();
        await guestContext.close();
    });
});
