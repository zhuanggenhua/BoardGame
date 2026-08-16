import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { test } from './framework';
import {
    clearEvidenceScreenshotsForTest,
    getEvidenceScreenshotPath,
} from './framework/evidenceScreenshots';
import {
    createGuestId,
    ensureGameServerAvailable,
    getGameServerBaseURL,
    initContext,
    seedMatchCredentials,
    waitForHomeGameList,
} from './helpers/common';
import { selectCharacter, waitForCharacterSelection } from './helpers/dicethrone';
import { waitForFactionDraft, waitForSmashUpUI } from './helpers/smashup';
import { getMatchState } from './helpers/state-injection';
import {
    clickFactionReady,
    getPlayerStatusCard,
    selectFactionById,
    waitForFactionSelectionReady,
} from './helpers/summonerwars';

type ManualAiSeatController = {
    type: 'local-ai';
    minimumActionDelayMs: number;
    manualFactionSelection: true;
};

type ManualAiSeatControllers = Record<string, ManualAiSeatController>;

async function createOnlineAiRoom(args: {
    page: Page;
    gameName: string;
    numPlayers: number;
    guestId: string;
    setupData: Record<string, unknown>;
}): Promise<string> {
    const base = getGameServerBaseURL();
    const setupData = args.gameName === 'dicethrone'
        ? {
            guestId: args.guestId,
            ...args.setupData,
        }
        : {
            guestId: args.guestId,
            ownerKey: `guest:${args.guestId}`,
            ownerType: 'guest',
            ...args.setupData,
        };

    const response = await args.page.request.post(`${base}/games/${args.gameName}/create`, {
        data: {
            numPlayers: args.numPlayers,
            setupData,
        },
    });
    expect(response.ok()).toBeTruthy();

    const data = (await response.json().catch(() => null)) as { matchID?: string } | null;
    expect(data?.matchID).toBeTruthy();
    if (!data?.matchID) {
        throw new Error(`未能创建 ${args.gameName} 在线房间`);
    }
    return data.matchID;
}

async function claimSeatViaApi(args: {
    page: Page;
    gameName: string;
    matchId: string;
    playerId: string;
    guestId: string;
    playerName: string;
}): Promise<string> {
    const base = getGameServerBaseURL();
    const response = await args.page.request.post(`${base}/games/${args.gameName}/${args.matchId}/claim-seat`, {
        data: {
            playerID: args.playerId,
            playerName: args.playerName,
            guestId: args.guestId,
        },
    });
    expect(response.ok()).toBeTruthy();

    const data = (await response.json().catch(() => null)) as { playerCredentials?: string } | null;
    expect(data?.playerCredentials).toBeTruthy();
    if (!data?.playerCredentials) {
        throw new Error(`未能为 ${args.gameName} 的 ${args.playerId} 号位领取凭据`);
    }
    return data.playerCredentials;
}

async function seedAiSeatCredentials(
    target: BrowserContext | Page,
    matchId: string,
    aiSeatCredentials: Record<string, string>,
) {
    await target.addInitScript(
        ({ targetMatchId, targetSeatCredentials }) => {
            localStorage.setItem(`match_ai_creds_${targetMatchId}`, JSON.stringify(targetSeatCredentials));
            window.dispatchEvent(new Event('match-credentials-changed'));
        },
        { targetMatchId: matchId, targetSeatCredentials: aiSeatCredentials },
    );
}

async function waitForAiSeatCredentials(page: Page, matchId: string, expectedSeatIds: string[]) {
    await expect.poll(async () => {
        return page.evaluate((targetMatchId) => {
            const raw = localStorage.getItem(`match_ai_creds_${targetMatchId}`);
            if (!raw) return [];
            try {
                return Object.keys(JSON.parse(raw) as Record<string, string>).sort();
            } catch {
                return ['parse-error'];
            }
        }, matchId);
    }, {
        timeout: 10000,
        message: `等待 ${matchId} 的 AI 座位凭据写入本地`,
    }).toEqual([...expectedSeatIds].sort());
}

async function readLiveCore<T = Record<string, unknown>>(matchId: string, page: Page): Promise<T> {
    const state = await getMatchState(matchId, page);
    const record = state as { core?: T; G?: { core?: T } };
    return (record.core ?? record.G?.core ?? state) as T;
}

function buildManualAiSeatControllers(playerIds: string[]): ManualAiSeatControllers {
    return Object.fromEntries(
        playerIds.map((playerId) => [
            playerId,
            {
                type: 'local-ai',
                minimumActionDelayMs: 0,
                manualFactionSelection: true,
            } satisfies ManualAiSeatController,
        ]),
    );
}

async function selectSmashUpFactionById(page: Page, factionId: string) {
    await expect(page.getByTestId(`faction-option-${factionId}`)).toBeVisible({ timeout: 10000 });
    await page.getByTestId(`faction-option-${factionId}`).click();

    const confirmButton = page.getByTestId('faction-confirm-button');
    await confirmButton.waitFor({ state: 'visible', timeout: 10000 });
    await expect(confirmButton).toBeEnabled({ timeout: 15000 });
    await confirmButton.click();
    await page.waitForTimeout(500);
}

async function expectSmashUpCurrentSeat(page: Page, playerId: string) {
    const currentCard = page.getByTestId(`faction-selection-player-card-${playerId}`);
    await expect(currentCard).toBeVisible({ timeout: 10000 });
    await expect(currentCard).toHaveClass(/bg-\[#fef3c7\]/, { timeout: 10000 });
    await expect(page.getByText(/现在轮到你了|Your Turn/i).first()).toBeVisible({ timeout: 10000 });
}

async function installSmashUpFactionDraftRemountProbe(page: Page) {
    await page.evaluate(() => {
        const probeWindow = window as Window & {
            __BG_SU_FACTION_DRAFT_REMOUNT_PROBE__?: {
                removals: number;
                additions: number;
                observer?: MutationObserver;
            };
        };
        probeWindow.__BG_SU_FACTION_DRAFT_REMOUNT_PROBE__?.observer?.disconnect();
        const probe = {
            removals: 0,
            additions: 0,
            observer: undefined as MutationObserver | undefined,
        };
        const isFactionDraftNode = (node: Node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            const element = node as Element;
            return element.matches('[data-tutorial-id="su-faction-select"]')
                || Boolean(element.querySelector('[data-tutorial-id="su-faction-select"]'));
        };
        probe.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                mutation.removedNodes.forEach((node) => {
                    if (isFactionDraftNode(node)) probe.removals += 1;
                });
                mutation.addedNodes.forEach((node) => {
                    if (isFactionDraftNode(node)) probe.additions += 1;
                });
            }
        });
        probe.observer.observe(document.body, { childList: true, subtree: true });
        probeWindow.__BG_SU_FACTION_DRAFT_REMOUNT_PROBE__ = probe;
    });
}

async function expectSmashUpFactionDraftNotRemounted(page: Page, label: string) {
    await expect.poll(async () => page.evaluate(() => {
        const probe = (window as Window & {
            __BG_SU_FACTION_DRAFT_REMOUNT_PROBE__?: {
                removals: number;
                additions: number;
            };
        }).__BG_SU_FACTION_DRAFT_REMOUNT_PROBE__;
        return {
            removals: probe?.removals ?? 0,
            additions: probe?.additions ?? 0,
        };
    }), {
        timeout: 3000,
        message: `${label} 后 factionSelect 不应被卸载重建`,
    }).toEqual({ removals: 0, additions: 0 });
}

async function expectSmashUpSelectionCounts(
    page: Page,
    matchId: string,
    expected: { host: number; ai1: number; ai2: number; ai3: number },
    label: string,
) {
    await expect.poll(async () => {
        const core = await readLiveCore<{
            factionSelection?: {
                playerSelections?: Record<string, string[]>;
            };
        }>(matchId, page);
        return {
            host: core.factionSelection?.playerSelections?.['0']?.length ?? 0,
            ai1: core.factionSelection?.playerSelections?.['1']?.length ?? 0,
            ai2: core.factionSelection?.playerSelections?.['2']?.length ?? 0,
            ai3: core.factionSelection?.playerSelections?.['3']?.length ?? 0,
        };
    }, {
        timeout: 20000,
        message: `等待 SmashUp 四人手动代选写回 shared state: ${label}`,
    }).toEqual(expected);
}

async function prepareHostContext(args: {
    context: BrowserContext;
    guestId: string;
    storageKey: string;
    skipTutorial?: boolean;
}) {
    await initContext(args.context, {
        storageKey: args.storageKey,
        skipImageGate: true,
        skipTutorial: args.skipTutorial,
    });
    await args.context.addInitScript((id) => {
        localStorage.setItem('guest_id', id);
        sessionStorage.setItem('guest_id', id);
        document.cookie = `bg_guest_id=${encodeURIComponent(id)}; path=/; SameSite=Lax`;
    }, args.guestId);
}

test.describe('在线房间手动代 AI 做前置选择', () => {
    test('SmashUp 四人房房主可依次为 3 个 AI 完成派系选择并进入对局', async ({ browser }, testInfo) => {
        test.setTimeout(240000);
        await clearEvidenceScreenshotsForTest(testInfo);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const hostContext = await browser.newContext({ baseURL });
        const guestId = createGuestId('su-manual-ai');
        await prepareHostContext({
            context: hostContext,
            guestId,
            storageKey: '__smashup_manual_ai_setup',
        });

        const page = await hostContext.newPage();

        try {
            await page.goto('/', { waitUntil: 'domcontentloaded' });
            await waitForHomeGameList(page);
            test.skip(!(await ensureGameServerAvailable(page)), '游戏服务器不可用');

            const matchId = await createOnlineAiRoom({
                page,
                gameName: 'smashup',
                numPlayers: 4,
                guestId,
                setupData: {
                    enableAi: true,
                    seatControllers: buildManualAiSeatControllers(['1', '2', '3']),
                },
            });

            const hostCredentials = await claimSeatViaApi({
                page,
                gameName: 'smashup',
                matchId,
                playerId: '0',
                guestId,
                playerName: 'SmashUp-Host',
            });
            await seedMatchCredentials(hostContext, 'smashup', matchId, '0', hostCredentials);

            const aiSeatCredentials = Object.fromEntries(
                await Promise.all(
                    ['1', '2', '3'].map(async (playerId) => {
                        const credentials = await claimSeatViaApi({
                            page,
                            gameName: 'smashup',
                            matchId,
                            playerId,
                            guestId,
                            playerName: `SmashUp-AI-${playerId}`,
                        });
                        return [playerId, credentials] as const;
                    }),
                ),
            );
            await seedAiSeatCredentials(hostContext, matchId, aiSeatCredentials);

            await page.goto(`/play/smashup/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
            await waitForFactionDraft(page);
            await waitForAiSeatCredentials(page, matchId, ['1', '2', '3']);
            await installSmashUpFactionDraftRemountProbe(page);

            const draftSequence = ['aliens', 'ninjas', 'robots', 'wizards', 'tricksters', 'zombies', 'dinosaurs', 'pirates'];
            await expectSmashUpCurrentSeat(page, '0');
            await selectSmashUpFactionById(page, draftSequence[0]);
            await expectSmashUpSelectionCounts(page, matchId, {
                host: 1,
                ai1: 0,
                ai2: 0,
                ai3: 0,
            }, '第 1 次 host 选择');
            await expectSmashUpFactionDraftNotRemounted(page, '第 1 次选择');

            await expectSmashUpCurrentSeat(page, '1');
            await selectSmashUpFactionById(page, draftSequence[1]);
            await expectSmashUpSelectionCounts(page, matchId, {
                host: 1,
                ai1: 1,
                ai2: 0,
                ai3: 0,
            }, '第 2 次 AI1 选择');
            await expectSmashUpFactionDraftNotRemounted(page, '第 2 次选择');
            await expectSmashUpCurrentSeat(page, '2');
            await selectSmashUpFactionById(page, draftSequence[2]);
            await expectSmashUpSelectionCounts(page, matchId, {
                host: 1,
                ai1: 1,
                ai2: 1,
                ai3: 0,
            }, '第 3 次 AI2 选择');
            await expectSmashUpFactionDraftNotRemounted(page, '第 3 次选择');
            await expectSmashUpCurrentSeat(page, '3');
            await selectSmashUpFactionById(page, draftSequence[3]);
            await expectSmashUpSelectionCounts(page, matchId, {
                host: 1,
                ai1: 1,
                ai2: 1,
                ai3: 1,
            }, '第 4 次 AI3 选择');
            await expectSmashUpFactionDraftNotRemounted(page, '第 4 次选择');

            await page.screenshot({
                path: getEvidenceScreenshotPath(testInfo, 'smashup-manual-ai-mid-draft', {
                    filename: 'smashup-manual-ai-mid-draft.png',
                }),
                fullPage: false,
            });

            await expectSmashUpCurrentSeat(page, '3');
            for (const [index, factionId] of draftSequence.slice(4).entries()) {
                await selectSmashUpFactionById(page, factionId);
                if (factionId === 'tricksters') {
                    await expectSmashUpSelectionCounts(page, matchId, {
                        host: 1,
                        ai1: 1,
                        ai2: 1,
                        ai3: 2,
                    }, '第 5 次 AI3 第二派系选择');
                    await expectSmashUpFactionDraftNotRemounted(page, '第 5 次选择');
                    await expectSmashUpCurrentSeat(page, '2');
                } else if (factionId === 'zombies') {
                    await expectSmashUpSelectionCounts(page, matchId, {
                        host: 1,
                        ai1: 1,
                        ai2: 2,
                        ai3: 2,
                    }, '第 6 次 AI2 第二派系选择');
                    await expectSmashUpFactionDraftNotRemounted(page, '第 6 次选择');
                    await expectSmashUpCurrentSeat(page, '1');
                } else if (factionId === 'dinosaurs') {
                    await expectSmashUpSelectionCounts(page, matchId, {
                        host: 1,
                        ai1: 2,
                        ai2: 2,
                        ai3: 2,
                    }, '第 7 次 AI1 第二派系选择');
                    await expectSmashUpFactionDraftNotRemounted(page, '第 7 次选择');
                    await expectSmashUpCurrentSeat(page, '0');
                } else if (index !== 3) {
                    await expectSmashUpFactionDraftNotRemounted(page, `第 ${index + 5} 次选择`);
                }
            }

            await waitForSmashUpUI(page, 45000);

            await expect.poll(async () => {
                const core = await readLiveCore<{
                    players?: Record<string, { factions?: string[] }>;
                }>(matchId, page);
                return {
                    host: core.players?.['0']?.factions?.length ?? 0,
                    ai1: core.players?.['1']?.factions?.length ?? 0,
                    ai2: core.players?.['2']?.factions?.length ?? 0,
                    ai3: core.players?.['3']?.factions?.length ?? 0,
                };
            }, {
                timeout: 30000,
                message: '等待 SmashUp 四人手动代 AI 选派系完成后进入对局',
            }).toEqual({
                host: 2,
                ai1: 2,
                ai2: 2,
                ai3: 2,
            });

            await page.screenshot({
                path: getEvidenceScreenshotPath(testInfo, 'smashup-manual-ai-board-started', {
                    filename: 'smashup-manual-ai-board-started.png',
                }),
                fullPage: false,
            });
        } finally {
            await hostContext.close();
        }
    });

    test('SummonerWars 在线房间房主替 AI 点阵营后需点准备就绪才写回 shared state', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        await clearEvidenceScreenshotsForTest(testInfo);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const hostContext = await browser.newContext({ baseURL });
        const guestId = createGuestId('sw-manual-ai');
        await prepareHostContext({
            context: hostContext,
            guestId,
            storageKey: '__summonerwars_manual_ai_setup',
        });

        const page = await hostContext.newPage();

        try {
            await page.goto('/', { waitUntil: 'domcontentloaded' });
            await waitForHomeGameList(page);
            test.skip(!(await ensureGameServerAvailable(page)), '游戏服务器不可用');

            const matchId = await createOnlineAiRoom({
                page,
                gameName: 'summonerwars',
                numPlayers: 2,
                guestId,
                setupData: {
                    enableAi: true,
                    seatControllers: buildManualAiSeatControllers(['1']),
                },
            });

            const hostCredentials = await claimSeatViaApi({
                page,
                gameName: 'summonerwars',
                matchId,
                playerId: '0',
                guestId,
                playerName: 'SummonerWars-Host',
            });
            const aiCredentials = await claimSeatViaApi({
                page,
                gameName: 'summonerwars',
                matchId,
                playerId: '1',
                guestId,
                playerName: 'SummonerWars-AI-1',
            });

            await seedMatchCredentials(hostContext, 'summonerwars', matchId, '0', hostCredentials);
            await seedAiSeatCredentials(hostContext, matchId, { '1': aiCredentials });

            await page.goto(`/play/summonerwars/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
            await waitForFactionSelectionReady(page);
            await waitForAiSeatCredentials(page, matchId, ['1']);

            await selectFactionById(page, 'trickster');
            await page.waitForTimeout(800);
            await expect(page.getByTestId('sw-faction-card-trickster')).toHaveAttribute('data-selected', 'true');
            await expect(getPlayerStatusCard(page, '1')).toHaveAttribute('data-faction-id', 'trickster');
            expect(await readLiveCore<{
                selectedFactions?: Record<string, string>;
                readyPlayers?: Record<string, boolean>;
                hostStarted?: boolean;
            }>(matchId, page)).toMatchObject({
                selectedFactions: {
                    '0': 'unselected',
                    '1': 'unselected',
                },
                readyPlayers: {
                    '1': false,
                },
                hostStarted: false,
            });

            await clickFactionReady(page);
            await expect.poll(async () => {
                const core = await readLiveCore<{
                    selectedFactions?: Record<string, string>;
                    readyPlayers?: Record<string, boolean>;
                    hostStarted?: boolean;
                }>(matchId, page);
                return {
                    hostFaction: core.selectedFactions?.['0'] ?? 'unselected',
                    aiFaction: core.selectedFactions?.['1'] ?? 'unselected',
                    aiReady: core.readyPlayers?.['1'] ?? false,
                    hostStarted: core.hostStarted ?? null,
                };
            }, {
                timeout: 15000,
                message: '等待 SummonerWars AI 阵营在准备就绪后写回并准备',
            }).toEqual({
                hostFaction: 'unselected',
                aiFaction: 'trickster',
                aiReady: true,
                hostStarted: false,
            });
            await page.waitForTimeout(300);

            await selectFactionById(page, 'necromancer');
            await expect.poll(async () => {
                const core = await readLiveCore<{
                    selectedFactions?: Record<string, string>;
                    readyPlayers?: Record<string, boolean>;
                    hostStarted?: boolean;
                }>(matchId, page);
                return {
                    hostFaction: core.selectedFactions?.['0'] ?? 'unselected',
                    aiFaction: core.selectedFactions?.['1'] ?? 'unselected',
                    aiReady: core.readyPlayers?.['1'] ?? false,
                    hostStarted: core.hostStarted ?? null,
                };
            }, {
                timeout: 15000,
                message: '等待 SummonerWars 房主最后选择阵营',
            }).toEqual({
                hostFaction: 'necromancer',
                aiFaction: 'trickster',
                aiReady: true,
                hostStarted: false,
            });

            await expect(getPlayerStatusCard(page, '1')).toHaveAttribute('data-faction-id', 'trickster');
            await page.screenshot({
                path: getEvidenceScreenshotPath(testInfo, 'summonerwars-manual-ai-selected', {
                    filename: 'summonerwars-manual-ai-selected.png',
                }),
                fullPage: false,
            });
        } finally {
            await hostContext.close();
        }
    });

    test('DiceThrone 在线房间房主替 AI 点角色后需点准备就绪才写回 shared state', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        await clearEvidenceScreenshotsForTest(testInfo);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const hostContext = await browser.newContext({ baseURL });
        const guestId = createGuestId('dt-manual-ai');
        await prepareHostContext({
            context: hostContext,
            guestId,
            storageKey: '__dicethrone_manual_ai_setup',
            skipTutorial: false,
        });

        const page = await hostContext.newPage();

        try {
            await page.goto('/', { waitUntil: 'domcontentloaded' });
            await waitForHomeGameList(page);
            test.skip(!(await ensureGameServerAvailable(page)), '游戏服务器不可用');

            const matchId = await createOnlineAiRoom({
                page,
                gameName: 'dicethrone',
                numPlayers: 2,
                guestId,
                setupData: {
                    enableAi: true,
                    seatControllers: buildManualAiSeatControllers(['1']),
                },
            });

            const hostCredentials = await claimSeatViaApi({
                page,
                gameName: 'dicethrone',
                matchId,
                playerId: '0',
                guestId,
                playerName: 'DiceThrone-Host',
            });
            const aiCredentials = await claimSeatViaApi({
                page,
                gameName: 'dicethrone',
                matchId,
                playerId: '1',
                guestId,
                playerName: 'DiceThrone-AI-1',
            });

            await seedMatchCredentials(hostContext, 'dicethrone', matchId, '0', hostCredentials);
            await seedAiSeatCredentials(hostContext, matchId, { '1': aiCredentials });

            await page.goto(`/play/dicethrone/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
            await waitForCharacterSelection(page);
            await waitForAiSeatCredentials(page, matchId, ['1']);

            await selectCharacter(page, 'gunslinger');
            await page.waitForTimeout(800);
            await expect(page.locator('[data-character-id="gunslinger"], [data-char-id="gunslinger"]').first()).toContainText(/P2/i);
            expect(await readLiveCore<{
                selectedCharacters?: Record<string, string>;
                readyPlayers?: Record<string, boolean>;
                hostStarted?: boolean;
            }>(matchId, page)).toMatchObject({
                selectedCharacters: {
                    '0': 'unselected',
                    '1': 'unselected',
                },
                readyPlayers: {
                    '1': false,
                },
                hostStarted: false,
            });

            const readyButton = page.getByRole('button', { name: /Ready|准备/i }).first();
            await expect(readyButton).toBeVisible({ timeout: 5000 });
            await readyButton.click();
            await expect.poll(async () => {
                const core = await readLiveCore<{
                    selectedCharacters?: Record<string, string>;
                    readyPlayers?: Record<string, boolean>;
                    hostStarted?: boolean;
                }>(matchId, page);
                return {
                    hostCharacter: core.selectedCharacters?.['0'] ?? 'unselected',
                    aiCharacter: core.selectedCharacters?.['1'] ?? 'unselected',
                    aiReady: core.readyPlayers?.['1'] ?? false,
                    hostStarted: core.hostStarted ?? null,
                };
            }, {
                timeout: 15000,
                message: '等待 DiceThrone AI 角色在准备就绪后写回并准备',
            }).toEqual({
                hostCharacter: 'unselected',
                aiCharacter: 'gunslinger',
                aiReady: true,
                hostStarted: false,
            });
            await waitForCharacterSelection(page);
            await page.waitForTimeout(300);

            await selectCharacter(page, 'samurai');
            await expect.poll(async () => {
                const core = await readLiveCore<{
                    selectedCharacters?: Record<string, string>;
                    readyPlayers?: Record<string, boolean>;
                    hostStarted?: boolean;
                }>(matchId, page);
                return {
                    hostCharacter: core.selectedCharacters?.['0'] ?? 'unselected',
                    aiCharacter: core.selectedCharacters?.['1'] ?? 'unselected',
                    aiReady: core.readyPlayers?.['1'] ?? false,
                    hostStarted: core.hostStarted ?? null,
                };
            }, {
                timeout: 15000,
                message: '等待 DiceThrone 房主最后选择角色',
            }).toEqual({
                hostCharacter: 'samurai',
                aiCharacter: 'gunslinger',
                aiReady: true,
                hostStarted: false,
            });

            await expect(page.locator('[data-character-id="samurai"], [data-char-id="samurai"]').first()).toContainText(/P1/i);
            await expect(page.locator('[data-character-id="gunslinger"], [data-char-id="gunslinger"]').first()).toContainText(/P2/i);
            await page.screenshot({
                path: getEvidenceScreenshotPath(testInfo, 'dicethrone-manual-ai-selected', {
                    filename: 'dicethrone-manual-ai-selected.png',
                }),
                fullPage: false,
            });
        } finally {
            await hostContext.close();
        }
    });
});
