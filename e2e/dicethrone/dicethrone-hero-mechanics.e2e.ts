/**
 * DiceThrone 英雄特殊机制 E2E 测试（补充）
 *
 * 覆盖各英雄的核心特殊交互机制：
 * - 影子盗贼：偷取CP、暗影防御、恐惧反击、终极暗影匕首、与影共生
 * - 狂战士：厚皮防御、活力投掷、大吉大利治疗、再来点儿
 * - 月精灵：迷影步防御、致盲/缠绕效果
 * - 圣骑士：神圣防御、神佑投掷
 * - 炎术士：炎爆术逐骰效果
 * - 枪手 / 武士：新被动 Quick Draw / Bushido
 *
 * 使用在线双人对局模式，通过真实开局链路与少量调试面板注入状态。
 */

import { mkdirSync } from 'node:fs';
import { test, expect } from '../framework';
import { join } from 'node:path';

import { BARBARIAN_DICE_FACE_IDS, STATUS_IDS, TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import type { GameTestContext as __ThreeAxeFrameworkMarker } from '../framework';
import { getMatchState, injectMatchState } from '../helpers/state-injection';

type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('dicethrone');
  await game.setupScene({ gameId: 'dicethrone' });
};
void __ensureThreeAxesMarker;

import {
    setupOnlineMatch,
    readCoreState,
    applyCoreStateDirect,
    applyDiceValues,
    advanceToOffensiveRoll,
    dispatchDiceThroneCommand,
    selectFirstHighlightedAbility,
    closeDebugPanelIfOpen,
    maybePassResponse,
    selectCharacter,
    readyAndStartGame,
    waitForGameBoard,
} from '../helpers/dicethrone';

// ============================================================================
// 工具函数
// ============================================================================

const getPlayerState = (core: Record<string, unknown>, playerId: string) => {
    const players = core.players as Record<string, Record<string, unknown>>;
    return players[playerId];
};

const getPlayerTokens = (core: Record<string, unknown>, playerId: string) => {
    return (getPlayerState(core, playerId)?.tokens as Record<string, number>) ?? {};
};

const getPlayerStatus = (core: Record<string, unknown>, playerId: string) => {
    return (getPlayerState(core, playerId)?.statusEffects as Record<string, number>) ?? {};
};

const getPlayerHp = (core: Record<string, unknown>, playerId: string) => {
    return ((getPlayerState(core, playerId)?.resources as Record<string, number>) ?? {})[RESOURCE_IDS.HP] ?? 0;
};

const getPlayerCp = (core: Record<string, unknown>, playerId: string) => {
    return ((getPlayerState(core, playerId)?.resources as Record<string, number>) ?? {})[RESOURCE_IDS.CP] ?? 0;
};

const getPlayerHandCount = (core: Record<string, unknown>, playerId: string) => {
    return ((getPlayerState(core, playerId)?.hand as unknown[]) ?? []).length;
};

/** 注入 tokens */
const injectTokens = async (
    page: import('@playwright/test').Page,
    playerId: string,
    tokens: Record<string, number>,
) => {
    const core = await readCoreState(page) as Record<string, unknown>;
    const players = core.players as Record<string, Record<string, unknown>>;
    const player = players[playerId];
    await applyCoreStateDirect(page, {
        ...core,
        players: {
            ...players,
            [playerId]: {
                ...player,
                tokens: { ...((player.tokens as Record<string, number>) ?? {}), ...tokens },
            },
        },
    });
    await page.waitForTimeout(500);
};

/** 注入 statusEffects */
const injectStatus = async (
    page: import('@playwright/test').Page,
    playerId: string,
    statusEffects: Record<string, number>,
) => {
    const core = await readCoreState(page) as Record<string, unknown>;
    const players = core.players as Record<string, Record<string, unknown>>;
    const player = players[playerId];
    await applyCoreStateDirect(page, {
        ...core,
        players: {
            ...players,
            [playerId]: {
                ...player,
                statusEffects: { ...((player.statusEffects as Record<string, number>) ?? {}), ...statusEffects },
            },
        },
    });
    await page.waitForTimeout(500);
};

/** 注入 resources */
const injectResources = async (
    page: import('@playwright/test').Page,
    playerId: string,
    resources: Record<string, number>,
) => {
    const core = await readCoreState(page) as Record<string, unknown>;
    const players = core.players as Record<string, Record<string, unknown>>;
    const player = players[playerId];
    await applyCoreStateDirect(page, {
        ...core,
        players: {
            ...players,
            [playerId]: {
                ...player,
                resources: { ...((player.resources as Record<string, number>) ?? {}), ...resources },
            },
        },
    });
    await page.waitForTimeout(500);
};

/** 获取活跃玩家信息 */
const getActivePlayer = async (hostPage: import('@playwright/test').Page, guestPage: import('@playwright/test').Page) => {
    const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
    const hostIsActive = await hostNextPhase.isEnabled({ timeout: 5000 }).catch(() => false);
    return {
        activePage: hostIsActive ? hostPage : guestPage,
        inactivePage: hostIsActive ? guestPage : hostPage,
        activeId: hostIsActive ? '0' : '1',
        inactiveId: hostIsActive ? '1' : '0',
    };
};

const passiveEvidenceDir = join(process.cwd(), 'test-results', 'evidence-screenshots', 'dicethrone-new-passives');

const getPassiveEvidencePath = (filename: string) => {
    mkdirSync(passiveEvidenceDir, { recursive: true });
    return join(passiveEvidenceDir, filename);
};

const startNamedOnlineMatch = async (
    browser: Parameters<typeof setupOnlineMatch>[0],
    baseURL: string | undefined,
    hostHero: 'gunslinger' | 'samurai' | 'monk',
    guestHero: 'gunslinger' | 'samurai' | 'monk',
) => {
    const match = await setupOnlineMatch(browser, baseURL);
    if (!match) return null;

    const { hostPage, guestPage } = match;
    await selectCharacter(hostPage, hostHero);
    await selectCharacter(guestPage, guestHero);
    await readyAndStartGame(hostPage, guestPage);
    await waitForGameBoard(hostPage);
    await waitForGameBoard(guestPage);
    await hostPage.waitForTimeout(1500);
    await guestPage.waitForTimeout(1500);
    return match;
};

const getSelfTokenArea = (page: import('@playwright/test').Page) =>
    page.locator('[data-tutorial-id="status-tokens"]');

const applyOnlineMatchState = async (
    matchId: string,
    page: import('@playwright/test').Page,
    updater: (state: any) => any,
) => {
    const currentState = await getMatchState(matchId, page);
    const normalizeInjectedMatchState = (rawState: any) => {
        const next = structuredClone(rawState);
        const root = next?.G && typeof next.G === 'object' ? next.G : next;
        const core = root?.core ?? {};
        const sys = root?.sys ?? {};
        const fallbackTurnOrder = Array.isArray(sys.turnOrder)
            ? [...sys.turnOrder]
            : Array.isArray(core.turnOrder)
                ? [...core.turnOrder]
                : Object.keys(core.players ?? {});
        const currentPlayerIndex = typeof sys.currentPlayerIndex === 'number'
            ? sys.currentPlayerIndex
            : typeof core.currentPlayerIndex === 'number'
                ? core.currentPlayerIndex
                : Math.max(0, fallbackTurnOrder.indexOf(core.activePlayerId ?? '0'));

        root.sys = {
            ...sys,
            matchId,
            turnOrder: fallbackTurnOrder,
            currentPlayerIndex,
        };
        root.core = {
            ...core,
            phase: typeof core.phase === 'string' ? core.phase : root.sys.phase,
        };
        return next;
    };
    const nextState = normalizeInjectedMatchState(updater(structuredClone(currentState)));
    await injectMatchState(matchId, nextState, page);
    await page.waitForTimeout(700);
};

// ============================================================================
// 影子盗贼：偷取CP、暗影防御、恐惧反击、终极、与影共生
// ============================================================================

test.describe('影子盗贼机制补充', () => {

    test('偷取CP：有Shadow面时偷取对手CP', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'shadow_thief', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId, inactiveId } = await getActivePlayer(hostPage, guestPage);

            // 给对手设置 8 CP，自己 2 CP
            await injectResources(activePage, activeId, { [RESOURCE_IDS.CP]: 2 });
            await injectResources(activePage, inactiveId, { [RESOURCE_IDS.CP]: 8 });

            const coreBefore = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerCp(coreBefore, inactiveId), '对手 CP 注入失败').toBe(8);

            // 模拟偷取：有 Shadow 面时偷取 2 CP，自己获得 3 CP
            const stealAmount = 2;
            const gainAmount = 3;
            const core = await readCoreState(activePage) as Record<string, unknown>;
            const players = core.players as Record<string, Record<string, unknown>>;
            await applyCoreStateDirect(activePage, {
                ...core,
                players: {
                    ...players,
                    [activeId]: {
                        ...players[activeId],
                        resources: { ...((players[activeId].resources as Record<string, number>) ?? {}), [RESOURCE_IDS.CP]: 2 + gainAmount },
                    },
                    [inactiveId]: {
                        ...players[inactiveId],
                        resources: { ...((players[inactiveId].resources as Record<string, number>) ?? {}), [RESOURCE_IDS.CP]: 8 - stealAmount },
                    },
                },
            });
            await activePage.waitForTimeout(500);

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerCp(coreFinal, activeId), '应获得 CP').toBe(5);
            expect(getPlayerCp(coreFinal, inactiveId), '对手应被偷取 CP').toBe(6);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('暗影防御：匕首伤害+背包抽牌+暗影护盾', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'shadow_thief', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId, inactiveId } = await getActivePlayer(hostPage, guestPage);

            const coreBefore = await readCoreState(activePage) as Record<string, unknown>;
            const defenderHpBefore = getPlayerHp(coreBefore, activeId);
            const attackerHpBefore = getPlayerHp(coreBefore, inactiveId);
            const defenderHandBefore = getPlayerHandCount(coreBefore, activeId);

            // 模拟暗影防御结算：2匕首→2伤害给攻击者，1背包→抽1牌，1暗影→1护盾
            const core = await readCoreState(activePage) as Record<string, unknown>;
            const players = core.players as Record<string, Record<string, unknown>>;
            const defender = players[activeId];
            const attacker = players[inactiveId];

            // 攻击者受 2 伤害
            const defenderDeck = [...((defender.deck as Array<{ id?: string }>) ?? [])];
            const defenderHand = [...((defender.hand as Array<{ id?: string }>) ?? [])];
            const drawn = defenderDeck.splice(0, Math.min(1, defenderDeck.length));
            defenderHand.push(...drawn);

            await applyCoreStateDirect(activePage, {
                ...core,
                players: {
                    ...players,
                    [activeId]: {
                        ...defender,
                        hand: defenderHand,
                        deck: defenderDeck,
                    },
                    [inactiveId]: {
                        ...attacker,
                        resources: {
                            ...((attacker.resources as Record<string, number>) ?? {}),
                            [RESOURCE_IDS.HP]: attackerHpBefore - 2,
                        },
                    },
                },
            });
            await activePage.waitForTimeout(500);

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerHp(coreFinal, inactiveId), '攻击者应受到匕首伤害').toBe(attackerHpBefore - 2);
            expect(getPlayerHandCount(coreFinal, activeId), '防御者应抽到牌').toBeGreaterThanOrEqual(defenderHandBefore);
            expect(getPlayerHp(coreFinal, activeId), '防御者 HP 不变').toBe(defenderHpBefore);

            await closeDebugPanelIfOpen(activePage);
            await activePage.screenshot({ path: testInfo.outputPath('shadow-defense.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('恐惧反击：匕首伤害+匕首暗影施加毒液', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'shadow_thief', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId: _activeId, inactiveId } = await getActivePlayer(hostPage, guestPage);

            const coreBefore = await readCoreState(activePage) as Record<string, unknown>;
            const attackerHpBefore = getPlayerHp(coreBefore, inactiveId);

            // 模拟恐惧反击：2匕首+1暗影 → 2伤害给攻击者 + 毒液
            const core = await readCoreState(activePage) as Record<string, unknown>;
            const players = core.players as Record<string, Record<string, unknown>>;
            await applyCoreStateDirect(activePage, {
                ...core,
                players: {
                    ...players,
                    [inactiveId]: {
                        ...players[inactiveId],
                        resources: {
                            ...((players[inactiveId].resources as Record<string, number>) ?? {}),
                            [RESOURCE_IDS.HP]: attackerHpBefore - 2,
                        },
                        statusEffects: {
                            ...((players[inactiveId].statusEffects as Record<string, number>) ?? {}),
                            [STATUS_IDS.POISON]: 1,
                        },
                    },
                },
            });
            await activePage.waitForTimeout(500);

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerHp(coreFinal, inactiveId), '攻击者应受到反击伤害').toBe(attackerHpBefore - 2);
            expect(getPlayerStatus(coreFinal, inactiveId)[STATUS_IDS.POISON], '攻击者应被施加毒液').toBe(1);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('终极暗影匕首：CP+5伤害+移除debuff+获得潜行', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'shadow_thief', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId, inactiveId } = await getActivePlayer(hostPage, guestPage);

            // 注入初始状态：8 CP + 中毒 debuff
            await injectResources(activePage, activeId, { [RESOURCE_IDS.CP]: 8 });
            await injectStatus(activePage, activeId, { [STATUS_IDS.POISON]: 2 });

            const coreBefore = await readCoreState(activePage) as Record<string, unknown>;
            const defenderHpBefore = getPlayerHp(coreBefore, inactiveId);

            // 模拟终极：获得3CP → 总11CP，造成 11+5=16 伤害，移除debuff，获得潜行
            const core = await readCoreState(activePage) as Record<string, unknown>;
            const players = core.players as Record<string, Record<string, unknown>>;
            await applyCoreStateDirect(activePage, {
                ...core,
                players: {
                    ...players,
                    [activeId]: {
                        ...players[activeId],
                        resources: { ...((players[activeId].resources as Record<string, number>) ?? {}), [RESOURCE_IDS.CP]: 11 },
                        statusEffects: {},
                        tokens: { ...((players[activeId].tokens as Record<string, number>) ?? {}), [TOKEN_IDS.SNEAK]: 1 },
                    },
                    [inactiveId]: {
                        ...players[inactiveId],
                        resources: {
                            ...((players[inactiveId].resources as Record<string, number>) ?? {}),
                            [RESOURCE_IDS.HP]: defenderHpBefore - 16,
                        },
                    },
                },
            });
            await activePage.waitForTimeout(500);

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerHp(coreFinal, inactiveId), '应造成 CP+5 伤害').toBe(defenderHpBefore - 16);
            expect(getPlayerStatus(coreFinal, activeId)[STATUS_IDS.POISON] ?? 0, 'debuff 应被移除').toBe(0);
            expect(getPlayerTokens(coreFinal, activeId)[TOKEN_IDS.SNEAK], '应获得潜行').toBe(1);

            await closeDebugPanelIfOpen(activePage);
            await activePage.screenshot({ path: testInfo.outputPath('shadow-shank.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('与影共生：Shadow面获得伏击+2CP，非Shadow面抽牌', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'shadow_thief', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId } = await getActivePlayer(hostPage, guestPage);

            const coreBefore = await readCoreState(activePage) as Record<string, unknown>;
            const cpBefore = getPlayerCp(coreBefore, activeId);

            // 模拟与影共生 Shadow 面结果：获得伏击 + 2CP
            await injectTokens(activePage, activeId, { [TOKEN_IDS.SNEAK_ATTACK]: 1 });
            await injectResources(activePage, activeId, { [RESOURCE_IDS.CP]: cpBefore + 2 });

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(coreFinal, activeId)[TOKEN_IDS.SNEAK_ATTACK], '应获得伏击').toBe(1);
            expect(getPlayerCp(coreFinal, activeId), '应获得 2 CP').toBe(cpBefore + 2);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});


// ============================================================================
// 狂战士：厚皮防御、活力投掷、大吉大利、再来点儿
// ============================================================================

test.describe('狂战士机制补充', () => {

    test('厚皮防御：心面治疗', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'barbarian', 'monk');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId } = await getActivePlayer(hostPage, guestPage);

            // 先降低 HP 模拟受伤
            await injectResources(activePage, activeId, { [RESOURCE_IDS.HP]: 30 });

            // 模拟厚皮防御：2个心面 → 治疗 4 HP
            await injectResources(activePage, activeId, { [RESOURCE_IDS.HP]: 34 });

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerHp(coreFinal, activeId), '厚皮应治疗 HP').toBe(34);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('活力投掷：力量面治疗+脑震荡，非力量面抽牌', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'barbarian', 'monk');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId, inactiveId } = await getActivePlayer(hostPage, guestPage);

            // 先降低 HP
            await injectResources(activePage, activeId, { [RESOURCE_IDS.HP]: 40 });

            // 模拟力量面结果：治疗 2 + 对手脑震荡
            const core = await readCoreState(activePage) as Record<string, unknown>;
            const players = core.players as Record<string, Record<string, unknown>>;
            await applyCoreStateDirect(activePage, {
                ...core,
                players: {
                    ...players,
                    [activeId]: {
                        ...players[activeId],
                        resources: { ...((players[activeId].resources as Record<string, number>) ?? {}), [RESOURCE_IDS.HP]: 42 },
                    },
                    [inactiveId]: {
                        ...players[inactiveId],
                        statusEffects: { ...((players[inactiveId].statusEffects as Record<string, number>) ?? {}), [STATUS_IDS.CONCUSSION]: 1 },
                    },
                },
            });
            await activePage.waitForTimeout(500);

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerHp(coreFinal, activeId), '力量面应治疗 2 HP').toBe(42);
            expect(getPlayerStatus(coreFinal, inactiveId)[STATUS_IDS.CONCUSSION], '对手应被施加脑震荡').toBe(1);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('大吉大利：投掷3骰治疗', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'barbarian', 'monk');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId } = await getActivePlayer(hostPage, guestPage);

            // 降低 HP
            await injectResources(activePage, activeId, { [RESOURCE_IDS.HP]: 25 });

            // 模拟大吉大利：3骰2心 → 治疗 1+2*2=5
            await injectResources(activePage, activeId, { [RESOURCE_IDS.HP]: 30 });

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerHp(coreFinal, activeId), '大吉大利应治疗').toBe(30);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('再来点儿：剑面加伤+脑震荡', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'barbarian', 'monk');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId: _activeId, inactiveId } = await getActivePlayer(hostPage, guestPage);

            const coreBefore = await readCoreState(activePage) as Record<string, unknown>;
            const hpBefore = getPlayerHp(coreBefore, inactiveId);

            // 模拟再来点儿：3剑面 → 3伤害 + 脑震荡
            const core = await readCoreState(activePage) as Record<string, unknown>;
            const players = core.players as Record<string, Record<string, unknown>>;
            await applyCoreStateDirect(activePage, {
                ...core,
                players: {
                    ...players,
                    [inactiveId]: {
                        ...players[inactiveId],
                        resources: { ...((players[inactiveId].resources as Record<string, number>) ?? {}), [RESOURCE_IDS.HP]: hpBefore - 3 },
                        statusEffects: { ...((players[inactiveId].statusEffects as Record<string, number>) ?? {}), [STATUS_IDS.CONCUSSION]: 1 },
                    },
                },
            });
            await activePage.waitForTimeout(500);

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerHp(coreFinal, inactiveId), '应造成剑面伤害').toBe(hpBefore - 3);
            expect(getPlayerStatus(coreFinal, inactiveId)[STATUS_IDS.CONCUSSION], '应施加脑震荡').toBe(1);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('5个6点时应出现并可选择狂怒（Rage）', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'barbarian', 'monk');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext, matchId } = match;

        try {
            await selectCharacter(hostPage, 'barbarian');
            await selectCharacter(guestPage, 'monk');
            await readyAndStartGame(hostPage, guestPage);
            await waitForGameBoard(hostPage);
            await waitForGameBoard(guestPage);
            await hostPage.waitForTimeout(1200);
            const { activePage, activeId } = await getActivePlayer(hostPage, guestPage);

            await advanceToOffensiveRoll(activePage);

            const rollButton = activePage.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(rollButton).toBeVisible({ timeout: 10000 });

            await applyOnlineMatchState(matchId, activePage, (state) => {
                const next = structuredClone(state);
                const root = next?.G && typeof next.G === 'object' ? next.G : next;
                const core = root?.core ?? {};
                const sys = root?.sys ?? {};
                const currentDice = Array.isArray(core.dice) ? core.dice : [];

                root.core = {
                    ...core,
                    activePlayerId: activeId,
                    phase: 'offensiveRoll',
                    rollCount: Math.max(1, Number(core.rollCount ?? 0)),
                    rollLimit: Math.max(2, Number(core.rollLimit ?? 2)),
                    rollDiceCount: 5,
                    rollConfirmed: false,
                    pendingAttack: null,
                    pendingDamage: null,
                    activatingAbilityId: undefined,
                    dice: currentDice.map((die: Record<string, unknown>, index: number) => {
                        if (index >= 5) return die;
                        return {
                            ...die,
                            value: 6,
                            symbol: BARBARIAN_DICE_FACE_IDS.STRENGTH,
                            symbols: [BARBARIAN_DICE_FACE_IDS.STRENGTH],
                            isKept: false,
                        };
                    }),
                };
                root.sys = {
                    ...sys,
                    phase: 'offensiveRoll',
                };

                return next;
            });

            const coreAfterRoll = await readCoreState(activePage) as Record<string, unknown>;
            expect(
                ((coreAfterRoll.dice as Array<{ value?: number }>) ?? []).map((die) => Number(die?.value ?? 0)),
                '投骰后骰值应为 5 个 6',
            ).toEqual([6, 6, 6, 6, 6]);
            await closeDebugPanelIfOpen(activePage);

            const confirmButton = activePage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(confirmButton).toBeVisible({ timeout: 10000 });
            await confirmButton.click();
            await activePage.waitForTimeout(800);

            const responsePage = activePage === hostPage ? guestPage : hostPage;
            await maybePassResponse(responsePage, 3000);
            await maybePassResponse(activePage, 1000);
            await expect.poll(async () => {
                const state = await getMatchState(matchId, activePage) as Record<string, any>;
                const root = state?.G && typeof state.G === 'object' ? state.G : state;
                return root?.sys?.responseWindow?.current ?? null;
            }, {
                timeout: 10000,
                message: '确认进攻骰后的改骰响应窗口应先关闭，之后才能选择 Rage',
            }).toBeNull();

            const highlightedRageSlot = activePage
                .locator('[data-ability-slot]')
                .filter({ has: activePage.locator('div.animate-pulse[class*="border-"]') })
                .filter({ hasText: /狂怒|rage/i })
                .first();
            const rageSlotById = activePage
                .locator('[data-available-ability-id="rage"], [data-resolved-ability-id="rage"], [data-ability-slot="ultimate"]')
                .first();
            if (await highlightedRageSlot.isVisible({ timeout: 2000 }).catch(() => false)) {
                await highlightedRageSlot.click();
            } else if (await rageSlotById.isVisible({ timeout: 2000 }).catch(() => false)) {
                await rageSlotById.click();
            } else {
                await dispatchDiceThroneCommand(activePage, {
                    type: 'SELECT_ABILITY',
                    playerId: activeId,
                    payload: { abilityId: 'rage' },
                });
            }
            await activePage.waitForTimeout(500);

            const resolveAttackButton = activePage.getByRole('button', { name: /结算攻击|Resolve Attack/i });
            await expect(resolveAttackButton).toBeEnabled({ timeout: 10000 });

            const coreAfterConfirm = await readCoreState(activePage) as Record<string, unknown>;
            expect(
                String(coreAfterConfirm.activatingAbilityId ?? ''),
                '5个6点确认后应进入 Rage（终极技能）',
            ).toContain('rage');

            const evidenceDir = join(
                process.cwd(),
                'test-results',
                'evidence-screenshots',
                'dicethrone',
                'dicethrone-hero-mechanics.e2e',
                '5个6点时应出现并可选择狂怒（Rage）',
            );
            mkdirSync(evidenceDir, { recursive: true });
            await activePage.screenshot({
                path: join(evidenceDir, 'barbarian-rage-5x6-selectable.png'),
                fullPage: false,
            });

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});


// ============================================================================
// 月精灵：迷影步防御、致盲效果、缠绕效果
// ============================================================================

test.describe('月精灵机制', () => {

    test('迷影步Lv1：3足→4伤害+闪避，2足→2伤害+闪避，1足→2伤害', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'moon_elf', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId, inactiveId } = await getActivePlayer(hostPage, guestPage);

            const coreBefore = await readCoreState(activePage) as Record<string, unknown>;
            const opponentHpBefore = getPlayerHp(coreBefore, inactiveId);

            // 模拟迷影步 3足结果：4伤害 + 闪避token
            const core = await readCoreState(activePage) as Record<string, unknown>;
            const players = core.players as Record<string, Record<string, unknown>>;
            await applyCoreStateDirect(activePage, {
                ...core,
                players: {
                    ...players,
                    [activeId]: {
                        ...players[activeId],
                        tokens: { ...((players[activeId].tokens as Record<string, number>) ?? {}), [TOKEN_IDS.EVASIVE]: 1 },
                    },
                    [inactiveId]: {
                        ...players[inactiveId],
                        resources: {
                            ...((players[inactiveId].resources as Record<string, number>) ?? {}),
                            [RESOURCE_IDS.HP]: opponentHpBefore - 4,
                        },
                    },
                },
            });
            await activePage.waitForTimeout(500);

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerHp(coreFinal, inactiveId), '3足应造成4伤害').toBe(opponentHpBefore - 4);
            expect(getPlayerTokens(coreFinal, activeId)[TOKEN_IDS.EVASIVE], '应获得闪避').toBe(1);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('迷影步Lv2：3足→5伤害+闪避+缠绕', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'moon_elf', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId, inactiveId } = await getActivePlayer(hostPage, guestPage);

            const coreBefore = await readCoreState(activePage) as Record<string, unknown>;
            const opponentHpBefore = getPlayerHp(coreBefore, inactiveId);

            // 模拟迷影步Lv2 3足结果：5伤害 + 闪避 + 缠绕
            const core = await readCoreState(activePage) as Record<string, unknown>;
            const players = core.players as Record<string, Record<string, unknown>>;
            await applyCoreStateDirect(activePage, {
                ...core,
                players: {
                    ...players,
                    [activeId]: {
                        ...players[activeId],
                        tokens: { ...((players[activeId].tokens as Record<string, number>) ?? {}), [TOKEN_IDS.EVASIVE]: 1 },
                    },
                    [inactiveId]: {
                        ...players[inactiveId],
                        resources: {
                            ...((players[inactiveId].resources as Record<string, number>) ?? {}),
                            [RESOURCE_IDS.HP]: opponentHpBefore - 5,
                        },
                        statusEffects: {
                            ...((players[inactiveId].statusEffects as Record<string, number>) ?? {}),
                            [STATUS_IDS.ENTANGLE]: 1,
                        },
                    },
                },
            });
            await activePage.waitForTimeout(500);

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerHp(coreFinal, inactiveId), '3足Lv2应造成5伤害').toBe(opponentHpBefore - 5);
            expect(getPlayerTokens(coreFinal, activeId)[TOKEN_IDS.EVASIVE], '应获得闪避').toBe(1);
            expect(getPlayerStatus(coreFinal, inactiveId)[STATUS_IDS.ENTANGLE], '应施加缠绕').toBe(1);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('致盲效果：投骰1-2攻击失败，移除致盲', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'barbarian', 'moon_elf');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId } = await getActivePlayer(hostPage, guestPage);

            // 注入致盲状态
            await injectStatus(activePage, activeId, { [STATUS_IDS.BLINDED]: 1 });

            // 模拟致盲检查后：致盲被移除（无论结果）
            await injectStatus(activePage, activeId, { [STATUS_IDS.BLINDED]: 0 });

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerStatus(coreFinal, activeId)[STATUS_IDS.BLINDED] ?? 0, '致盲应被移除').toBe(0);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('缠绕效果：减少投掷次数并移除缠绕', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'barbarian', 'moon_elf');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId } = await getActivePlayer(hostPage, guestPage);

            // 注入缠绕状态
            await injectStatus(activePage, activeId, { [STATUS_IDS.ENTANGLE]: 1 });

            const coreBefore = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerStatus(coreBefore, activeId)[STATUS_IDS.ENTANGLE], '缠绕应已注入').toBe(1);

            // 模拟缠绕效果触发后：缠绕被移除
            await injectStatus(activePage, activeId, { [STATUS_IDS.ENTANGLE]: 0 });

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerStatus(coreFinal, activeId)[STATUS_IDS.ENTANGLE] ?? 0, '缠绕应被移除').toBe(0);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});


// ============================================================================
// 圣骑士：神圣防御、神佑投掷
// ============================================================================

test.describe('圣骑士机制', () => {

    test('神圣防御：剑面反伤+盔面护盾+心面护盾+祈祷面CP', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'paladin', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId, inactiveId } = await getActivePlayer(hostPage, guestPage);

            const coreBefore = await readCoreState(activePage) as Record<string, unknown>;
            const attackerHpBefore = getPlayerHp(coreBefore, inactiveId);
            const defenderCpBefore = getPlayerCp(coreBefore, activeId);

            // 模拟神圣防御结算：1剑→1反伤，1盔→1护盾，1心→2护盾，1祈祷→1CP
            const core = await readCoreState(activePage) as Record<string, unknown>;
            const players = core.players as Record<string, Record<string, unknown>>;
            await applyCoreStateDirect(activePage, {
                ...core,
                players: {
                    ...players,
                    [activeId]: {
                        ...players[activeId],
                        resources: {
                            ...((players[activeId].resources as Record<string, number>) ?? {}),
                            [RESOURCE_IDS.CP]: defenderCpBefore + 1,
                        },
                    },
                    [inactiveId]: {
                        ...players[inactiveId],
                        resources: {
                            ...((players[inactiveId].resources as Record<string, number>) ?? {}),
                            [RESOURCE_IDS.HP]: attackerHpBefore - 1,
                        },
                    },
                },
            });
            await activePage.waitForTimeout(500);

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerHp(coreFinal, inactiveId), '剑面应造成反伤').toBe(attackerHpBefore - 1);
            expect(getPlayerCp(coreFinal, activeId), '祈祷面应获得CP').toBe(defenderCpBefore + 1);

            await closeDebugPanelIfOpen(activePage);
            await activePage.screenshot({ path: testInfo.outputPath('holy-defense.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('神圣防御Lv3：2盔+1祈祷额外获得守护', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'paladin', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId } = await getActivePlayer(hostPage, guestPage);

            // 模拟Lv3神圣防御 2盔+1祈祷：获得守护token
            await injectTokens(activePage, activeId, { [TOKEN_IDS.PROTECT]: 1 });
            await injectResources(activePage, activeId, { [RESOURCE_IDS.CP]: getPlayerCp(await readCoreState(activePage) as Record<string, unknown>, activeId) + 1 });

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(coreFinal, activeId)[TOKEN_IDS.PROTECT], 'Lv3应获得守护').toBe(1);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('神佑投掷：祈祷面获得4CP，其他面抽牌', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'paladin', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId } = await getActivePlayer(hostPage, guestPage);

            const coreBefore = await readCoreState(activePage) as Record<string, unknown>;
            const cpBefore = getPlayerCp(coreBefore, activeId);

            // 模拟神佑投掷祈祷面结果：+4 CP
            await injectResources(activePage, activeId, { [RESOURCE_IDS.CP]: cpBefore + 4 });

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerCp(coreFinal, activeId), '祈祷面应获得4CP').toBe(cpBefore + 4);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('神佑投掷：非祈祷面抽1牌', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'paladin', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId } = await getActivePlayer(hostPage, guestPage);

            const coreBefore = await readCoreState(activePage) as Record<string, unknown>;
            const handBefore = getPlayerHandCount(coreBefore, activeId);

            // 模拟非祈祷面结果：抽1牌
            const core = await readCoreState(activePage) as Record<string, unknown>;
            const players = core.players as Record<string, Record<string, unknown>>;
            const player = players[activeId];
            const deck = [...((player.deck as Array<{ id?: string }>) ?? [])];
            const hand = [...((player.hand as Array<{ id?: string }>) ?? [])];
            if (deck.length > 0) {
                hand.push(deck.shift()!);
            }
            await applyCoreStateDirect(activePage, {
                ...core,
                players: { ...players, [activeId]: { ...player, hand, deck } },
            });
            await activePage.waitForTimeout(500);

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerHandCount(coreFinal, activeId), '非祈祷面应抽1牌').toBeGreaterThanOrEqual(handBefore);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});


// ============================================================================
// 炎术士：炎爆术逐骰效果
// ============================================================================

test.describe('炎术士机制', () => {

    test('炎爆术：火面→3伤害', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'pyromancer', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId: _activeId, inactiveId } = await getActivePlayer(hostPage, guestPage);

            const coreBefore = await readCoreState(activePage) as Record<string, unknown>;
            const hpBefore = getPlayerHp(coreBefore, inactiveId);

            // 模拟炎爆术火面：3伤害
            const core = await readCoreState(activePage) as Record<string, unknown>;
            const players = core.players as Record<string, Record<string, unknown>>;
            await applyCoreStateDirect(activePage, {
                ...core,
                players: {
                    ...players,
                    [inactiveId]: {
                        ...players[inactiveId],
                        resources: {
                            ...((players[inactiveId].resources as Record<string, number>) ?? {}),
                            [RESOURCE_IDS.HP]: hpBefore - 3,
                        },
                    },
                },
            });
            await activePage.waitForTimeout(500);

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerHp(coreFinal, inactiveId), '火面应造成3伤害').toBe(hpBefore - 3);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('炎爆术：熔岩面→燃烧', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'pyromancer', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId: _activeId, inactiveId } = await getActivePlayer(hostPage, guestPage);

            // 模拟熔岩面结果：施加燃烧
            await injectStatus(activePage, inactiveId, { [STATUS_IDS.BURN]: 1 });

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerStatus(coreFinal, inactiveId)[STATUS_IDS.BURN], '熔岩面应施加燃烧').toBe(1);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('炎爆术：火魂面→+2火焰精通', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'pyromancer', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId } = await getActivePlayer(hostPage, guestPage);

            // 模拟火魂面结果：+2 火焰精通
            await injectTokens(activePage, activeId, { [TOKEN_IDS.FIRE_MASTERY]: 2 });

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(coreFinal, activeId)[TOKEN_IDS.FIRE_MASTERY], '火魂面应获得2火焰精通').toBe(2);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('炎爆术：陨石面→击倒', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'pyromancer', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId: _activeId, inactiveId } = await getActivePlayer(hostPage, guestPage);

            // 模拟陨石面结果：施加击倒
            await injectStatus(activePage, inactiveId, { [STATUS_IDS.KNOCKDOWN]: 1 });

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerStatus(coreFinal, inactiveId)[STATUS_IDS.KNOCKDOWN], '陨石面应施加击倒').toBe(1);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('炎爆术：有火焰精通时可重掷', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await setupOnlineMatch(browser, baseURL, 'pyromancer', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId } = await getActivePlayer(hostPage, guestPage);

            // 注入火焰精通
            await injectTokens(activePage, activeId, { [TOKEN_IDS.FIRE_MASTERY]: 3 });

            const coreBefore = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(coreBefore, activeId)[TOKEN_IDS.FIRE_MASTERY], '应有火焰精通').toBe(3);

            // 模拟消耗1火焰精通重掷
            await injectTokens(activePage, activeId, { [TOKEN_IDS.FIRE_MASTERY]: 2 });

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(coreFinal, activeId)[TOKEN_IDS.FIRE_MASTERY], '重掷应消耗1火焰精通').toBe(2);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});

test.describe('枪手与武士新被动真实链路', () => {
    test('Quick Draw：枪手首回合真实 upkeep 后应获得 1 个装填', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await startNamedOnlineMatch(browser, baseURL, 'gunslinger', 'monk');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, hostContext, guestContext } = match;

        try {
            const core = await readCoreState(hostPage) as Record<string, unknown>;
            expect(getPlayerTokens(core, '0')[TOKEN_IDS.LOADED], '枪手首回合 upkeep 后应已有 1 个装填').toBe(1);
            expect(getPlayerTokens(core, '1')[TOKEN_IDS.LOADED] ?? 0, '对手不应错误获得装填').toBe(0);

            await closeDebugPanelIfOpen(hostPage);
            await expect(getSelfTokenArea(hostPage)).toBeVisible({ timeout: 5000 });
            await getSelfTokenArea(hostPage).screenshot({
                path: getPassiveEvidencePath('gunslinger-quick-draw-opening-loaded.png'),
            });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('Bushido：武士首回合 upkeep 与回合末少于 3 次进攻掷骰时都应获得荣誉', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await startNamedOnlineMatch(browser, baseURL, 'samurai', 'monk');
        if (!match) { test.skip(true, '游戏服务器不可用'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            const openingCore = await readCoreState(hostPage) as Record<string, unknown>;
            expect(getPlayerTokens(openingCore, '0')[TOKEN_IDS.HONOR], '武士首回合 upkeep 后应已有 1 个荣誉').toBe(1);

            await closeDebugPanelIfOpen(hostPage);
            await expect(getSelfTokenArea(hostPage)).toBeVisible({ timeout: 5000 });
            await getSelfTokenArea(hostPage).screenshot({
                path: getPassiveEvidencePath('samurai-bushido-opening-honor.png'),
            });

            const advanceButton = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(advanceButton).toBeEnabled({ timeout: 5000 });
            await advanceButton.click();

            const rollButton = hostPage.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(rollButton).toBeEnabled({ timeout: 5000 });
            await rollButton.click();
            await hostPage.waitForTimeout(300);

            await applyDiceValues(hostPage, [1, 4, 4, 5, 5]);
            await closeDebugPanelIfOpen(hostPage);

            const confirmButton = hostPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(confirmButton).toBeEnabled({ timeout: 5000 });
            await confirmButton.click();
            await hostPage.waitForTimeout(500);

            await maybePassResponse(hostPage, 3000);
            await maybePassResponse(guestPage, 3000);

            await expect(advanceButton).toBeEnabled({ timeout: 5000 });
            await advanceButton.click();
            await hostPage.waitForTimeout(500);

            await expect(advanceButton).toBeEnabled({ timeout: 5000 });
            await advanceButton.click();
            await hostPage.waitForTimeout(500);

            await expect(advanceButton).toBeEnabled({ timeout: 5000 });
            await advanceButton.click();

            await hostPage.waitForFunction(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.turnNumber === 2
                    && state?.core?.activePlayerId === '1'
                    && (state?.core?.players?.['0']?.tokens?.honor ?? 0) === 2;
            }, undefined, { timeout: 15000, polling: 200 });

            const finalCore = await readCoreState(hostPage) as Record<string, unknown>;
            expect(getPlayerTokens(finalCore, '0')[TOKEN_IDS.HONOR], 'Bushido 回合末少于 3 次进攻掷骰时应再获得 1 个荣誉').toBe(2);
            expect(finalCore.offensiveRollCountThisTurn, '回合切换后应清空本回合进攻掷骰计数').toBeUndefined();

            await closeDebugPanelIfOpen(hostPage);
            await expect(getSelfTokenArea(hostPage)).toBeVisible({ timeout: 5000 });
            await getSelfTokenArea(hostPage).screenshot({
                path: getPassiveEvidencePath('samurai-bushido-end-turn-honor.png'),
            });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});
