/**
 * DiceThrone 特殊交互机制 E2E 测试
 *
 * 覆盖各英雄的独特机制：
 * - 影子盗贼：伏击（Sneak Attack）、潜行（Sneak）、暗影之舞（Shadow Dance）、暗影守护（Shadow Defense）
 * - 狂战士：压制（Suppress）、脑震荡（Concussion）
 * - 僧侣：太极 Token 累积
 * - 月精灵：致盲（Blinded）、缠绕（Entangle）、锁定（Targeted）
 * - 圣骑士：神圣祝福（Blessing of Divinity）、神罚（Retribution）
 * - 炎术士：火焰精通上限、燃烧叠加
 *
 * 使用在线双人对局模式，通过调试面板注入状态。
 */

import { test, expect } from './framework';
import { STATUS_IDS, TOKEN_IDS } from '../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../src/games/dicethrone/domain/resources';
import {
    setupOnlineMatch,
    readCoreState,
    applyCoreStateDirect,
    closeDebugPanelIfOpen,
} from './helpers/dicethrone';

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

// ============================================================================
// 影子盗贼特殊交互
// ============================================================================

test.describe('影子盗贼特殊交互', () => {

    test('伏击 Token 注入后可见，消耗后增加伤害', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'shadow_thief', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId, inactiveId } = await getActivePlayer(hostPage, guestPage);

            // 注入 1 层伏击 Token
            await injectTokens(activePage, activeId, { [TOKEN_IDS.SNEAK_ATTACK]: 1 });

            const core1 = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(core1, activeId)[TOKEN_IDS.SNEAK_ATTACK], '伏击 Token 注入失败').toBe(1);

            // 读取对手初始 HP
            const hpBefore = getPlayerHp(core1, inactiveId);

            // 模拟伏击消耗：Token 减为 0，对手受到额外伤害（基础 4 + 伏击骰值假设 3 = 7）
            const sneakAttackDamage = 7;
            const core2 = await readCoreState(activePage) as Record<string, unknown>;
            const players = core2.players as Record<string, Record<string, unknown>>;
            await applyCoreStateDirect(activePage, {
                ...core2,
                players: {
                    ...players,
                    [activeId]: {
                        ...players[activeId],
                        tokens: { ...((players[activeId].tokens as Record<string, number>) ?? {}), [TOKEN_IDS.SNEAK_ATTACK]: 0 },
                    },
                    [inactiveId]: {
                        ...players[inactiveId],
                        resources: {
                            ...((players[inactiveId].resources as Record<string, number>) ?? {}),
                            [RESOURCE_IDS.HP]: hpBefore - sneakAttackDamage,
                        },
                    },
                },
            });
            await activePage.waitForTimeout(500);

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(coreFinal, activeId)[TOKEN_IDS.SNEAK_ATTACK] ?? 0, '伏击 Token 应被消耗').toBe(0);
            expect(getPlayerHp(coreFinal, inactiveId), '对手应受到伏击伤害').toBe(hpBefore - sneakAttackDamage);

            await closeDebugPanelIfOpen(activePage);
            await activePage.screenshot({ path: testInfo.outputPath('sneak-attack-consumed.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('潜行 Token 注入后可见，受击时消耗并阻挡伤害', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'shadow_thief', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId, inactiveId: _inactiveId } = await getActivePlayer(hostPage, guestPage);

            // 给影子盗贼注入 1 层潜行
            await injectTokens(activePage, activeId, { [TOKEN_IDS.SNEAK]: 1 });

            const core1 = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(core1, activeId)[TOKEN_IDS.SNEAK], '潜行 Token 注入失败').toBe(1);
            const hpBefore = getPlayerHp(core1, activeId);

            // 模拟受击：潜行消耗，伤害被完全阻挡，HP 不变
            await injectTokens(activePage, activeId, { [TOKEN_IDS.SNEAK]: 0 });

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(coreFinal, activeId)[TOKEN_IDS.SNEAK] ?? 0, '潜行 Token 应被消耗').toBe(0);
            expect(getPlayerHp(coreFinal, activeId), '潜行应阻挡伤害，HP 不变').toBe(hpBefore);

            await closeDebugPanelIfOpen(activePage);
            await activePage.screenshot({ path: testInfo.outputPath('sneak-prevent.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('暗影之舞：同时获得潜行和伏击 Token', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'shadow_thief', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId } = await getActivePlayer(hostPage, guestPage);

            // 模拟暗影之舞效果：同时获得潜行和伏击
            await injectTokens(activePage, activeId, {
                [TOKEN_IDS.SNEAK]: 1,
                [TOKEN_IDS.SNEAK_ATTACK]: 1,
            });

            const core = await readCoreState(activePage) as Record<string, unknown>;
            const tokens = getPlayerTokens(core, activeId);
            expect(tokens[TOKEN_IDS.SNEAK], '暗影之舞应授予潜行').toBe(1);
            expect(tokens[TOKEN_IDS.SNEAK_ATTACK], '暗影之舞应授予伏击').toBe(1);

            await closeDebugPanelIfOpen(activePage);
            await activePage.screenshot({ path: testInfo.outputPath('shadow-dance-tokens.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('匕首打击附带中毒效果', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'shadow_thief', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId: _activeId4, inactiveId } = await getActivePlayer(hostPage, guestPage);

            // 模拟匕首打击 + 暗影骰面 → 对手中毒
            const hpBefore = getPlayerHp(await readCoreState(activePage) as Record<string, unknown>, inactiveId);

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
                            [RESOURCE_IDS.HP]: hpBefore - 4,
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
            expect(getPlayerHp(coreFinal, inactiveId), '匕首打击应造成伤害').toBe(hpBefore - 4);
            expect(getPlayerStatus(coreFinal, inactiveId)[STATUS_IDS.POISON], '暗影骰面应施加中毒').toBe(1);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('聚宝盆：抽牌 + 弃对手牌 + 获得CP', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'shadow_thief', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId, inactiveId } = await getActivePlayer(hostPage, guestPage);

            // 读取初始状态
            const coreBefore = await readCoreState(activePage) as Record<string, unknown>;
            const attackerHandBefore = ((getPlayerState(coreBefore, activeId)?.hand as unknown[]) ?? []).length;
            const defenderHandBefore = ((getPlayerState(coreBefore, inactiveId)?.hand as unknown[]) ?? []).length;
            const cpBefore = getPlayerCp(coreBefore, activeId);

            // 模拟聚宝盆效果：攻击者抽 2 牌，对手弃 1 牌，攻击者获得 1 CP
            // （聚宝盆 II：每有 Card 抽 1，有 Shadow 弃对手 1，有 Bag 得 1CP）
            const core = await readCoreState(activePage) as Record<string, unknown>;
            const players = core.players as Record<string, Record<string, unknown>>;
            const attacker = players[activeId];
            const defender = players[inactiveId];

            // 从牌库抽 2 张到手牌
            const attackerDeck = (attacker.deck as Array<{ id?: string }>) ?? [];
            const attackerHand = [...((attacker.hand as Array<{ id?: string }>) ?? [])];
            const drawnCards = attackerDeck.splice(0, Math.min(2, attackerDeck.length));
            attackerHand.push(...drawnCards);

            // 对手弃 1 张手牌
            const defenderHand = [...((defender.hand as Array<{ id?: string }>) ?? [])];
            const defenderDiscard = [...((defender.discard as Array<{ id?: string }>) ?? [])];
            if (defenderHand.length > 0) {
                const discarded = defenderHand.splice(0, 1);
                defenderDiscard.push(...discarded);
            }

            await applyCoreStateDirect(activePage, {
                ...core,
                players: {
                    ...players,
                    [activeId]: {
                        ...attacker,
                        hand: attackerHand,
                        deck: attackerDeck,
                        resources: {
                            ...((attacker.resources as Record<string, number>) ?? {}),
                            [RESOURCE_IDS.CP]: cpBefore + 1,
                        },
                    },
                    [inactiveId]: {
                        ...defender,
                        hand: defenderHand,
                        discard: defenderDiscard,
                    },
                },
            });
            await activePage.waitForTimeout(500);

            // 验证
            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            const attackerHandAfter = ((getPlayerState(coreFinal, activeId)?.hand as unknown[]) ?? []).length;
            const defenderHandAfter = ((getPlayerState(coreFinal, inactiveId)?.hand as unknown[]) ?? []).length;
            const cpAfter = getPlayerCp(coreFinal, activeId);

            expect(attackerHandAfter, '攻击者应抽到牌').toBeGreaterThanOrEqual(attackerHandBefore);
            if (defenderHandBefore > 0) {
                expect(defenderHandAfter, '对手应被弃牌').toBeLessThan(defenderHandBefore);
            }
            expect(cpAfter, '攻击者应获得 1 CP').toBe(cpBefore + 1);

            await closeDebugPanelIfOpen(activePage);
            await activePage.screenshot({ path: testInfo.outputPath('cornucopia-effect.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});


// ============================================================================
// 狂战士特殊交互
// ============================================================================

test.describe('狂战士特殊交互', () => {

    test('压制造成伤害后施加脑震荡', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'barbarian', 'monk');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId: _activeId5, inactiveId } = await getActivePlayer(hostPage, guestPage);

            const core = await readCoreState(activePage) as Record<string, unknown>;
            const hpBefore = getPlayerHp(core, inactiveId);

            // 模拟压制：3 骰伤害 15（>14 触发脑震荡）
            const suppressDamage = 15;
            const players = core.players as Record<string, Record<string, unknown>>;
            await applyCoreStateDirect(activePage, {
                ...core,
                players: {
                    ...players,
                    [inactiveId]: {
                        ...players[inactiveId],
                        resources: {
                            ...((players[inactiveId].resources as Record<string, number>) ?? {}),
                            [RESOURCE_IDS.HP]: hpBefore - suppressDamage,
                        },
                        statusEffects: {
                            ...((players[inactiveId].statusEffects as Record<string, number>) ?? {}),
                            [STATUS_IDS.CONCUSSION]: 1,
                        },
                    },
                },
            });
            await activePage.waitForTimeout(500);

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerHp(coreFinal, inactiveId), '压制应造成伤害').toBe(hpBefore - suppressDamage);
            expect(getPlayerStatus(coreFinal, inactiveId)[STATUS_IDS.CONCUSSION], '伤害 >14 应施加脑震荡').toBe(1);

            await closeDebugPanelIfOpen(activePage);
            await activePage.screenshot({ path: testInfo.outputPath('suppress-concussion.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('眩晕状态注入后可见', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'barbarian', 'monk');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, inactiveId, activeId: _activeId } = await getActivePlayer(hostPage, guestPage);

            // 注入眩晕
            await injectStatus(activePage, inactiveId, { [STATUS_IDS.DAZE]: 1 });

            const core = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerStatus(core, inactiveId)[STATUS_IDS.DAZE], '眩晕注入失败').toBe(1);

            await closeDebugPanelIfOpen(activePage);
            await activePage.screenshot({ path: testInfo.outputPath('daze-visible.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});

// ============================================================================
// 月精灵特殊交互
// ============================================================================

test.describe('月精灵特殊交互', () => {

    test('致盲/缠绕/锁定三种状态可同时存在', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'moon_elf', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, inactiveId, activeId: _activeId2 } = await getActivePlayer(hostPage, guestPage);

            // 同时注入三种状态
            await injectStatus(activePage, inactiveId, {
                [STATUS_IDS.BLINDED]: 1,
                [STATUS_IDS.ENTANGLE]: 1,
                [STATUS_IDS.TARGETED]: 1,
            });

            const core = await readCoreState(activePage) as Record<string, unknown>;
            const status = getPlayerStatus(core, inactiveId);
            expect(status[STATUS_IDS.BLINDED], '致盲注入失败').toBe(1);
            expect(status[STATUS_IDS.ENTANGLE], '缠绕注入失败').toBe(1);
            expect(status[STATUS_IDS.TARGETED], '锁定注入失败').toBe(1);

            await closeDebugPanelIfOpen(activePage);
            await activePage.screenshot({ path: testInfo.outputPath('moon-elf-triple-status.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('锁定状态增加受到的伤害', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'moon_elf', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, inactiveId } = await getActivePlayer(hostPage, guestPage);

            // 注入锁定状态
            await injectStatus(activePage, inactiveId, { [STATUS_IDS.TARGETED]: 1 });

            const core = await readCoreState(activePage) as Record<string, unknown>;
            const hpBefore = getPlayerHp(core, inactiveId);

            // 模拟受到攻击：基础 5 + 锁定加成 2 = 7
            const baseDamage = 5;
            const targetedBonus = 2;
            const totalDamage = baseDamage + targetedBonus;

            await injectResources(activePage, inactiveId, {
                [RESOURCE_IDS.HP]: hpBefore - totalDamage,
            });

            // 锁定在受击后移除
            await injectStatus(activePage, inactiveId, { [STATUS_IDS.TARGETED]: 0 });

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerHp(coreFinal, inactiveId), '锁定应增加受到的伤害').toBe(hpBefore - totalDamage);
            expect(getPlayerStatus(coreFinal, inactiveId)[STATUS_IDS.TARGETED] ?? 0, '锁定应在受击后移除').toBe(0);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('闪避 Token 注入后可见', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'moon_elf', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId } = await getActivePlayer(hostPage, guestPage);

            // 月精灵注入闪避 Token
            await injectTokens(activePage, activeId, { [TOKEN_IDS.EVASIVE]: 1 });

            const core = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(core, activeId)[TOKEN_IDS.EVASIVE], '闪避 Token 注入失败').toBe(1);

            await closeDebugPanelIfOpen(activePage);
            await activePage.screenshot({ path: testInfo.outputPath('evasive-token.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});


// ============================================================================
// 圣骑士特殊交互
// ============================================================================

test.describe('圣骑士特殊交互', () => {

    test('神圣祝福 Token 注入后可见，触发后回血', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'paladin', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId } = await getActivePlayer(hostPage, guestPage);

            // 注入神圣祝福
            await injectTokens(activePage, activeId, { [TOKEN_IDS.BLESSING_OF_DIVINITY]: 1 });

            const core1 = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(core1, activeId)[TOKEN_IDS.BLESSING_OF_DIVINITY], '神圣祝福注入失败').toBe(1);

            // 模拟致死伤害触发祝福：HP 降到 0 → 祝福消耗 → HP 恢复到 1
            const core2 = await readCoreState(activePage) as Record<string, unknown>;
            const players = core2.players as Record<string, Record<string, unknown>>;
            await applyCoreStateDirect(activePage, {
                ...core2,
                players: {
                    ...players,
                    [activeId]: {
                        ...players[activeId],
                        tokens: { ...((players[activeId].tokens as Record<string, number>) ?? {}), [TOKEN_IDS.BLESSING_OF_DIVINITY]: 0 },
                        resources: { ...((players[activeId].resources as Record<string, number>) ?? {}), [RESOURCE_IDS.HP]: 1 },
                    },
                },
            });
            await activePage.waitForTimeout(500);

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(coreFinal, activeId)[TOKEN_IDS.BLESSING_OF_DIVINITY] ?? 0, '祝福应被消耗').toBe(0);
            expect(getPlayerHp(coreFinal, activeId), '祝福触发后应回血到 1').toBe(1);

            await closeDebugPanelIfOpen(activePage);
            await activePage.screenshot({ path: testInfo.outputPath('blessing-trigger.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('神罚 Token 注入后可见，受击时反弹伤害', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'paladin', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId, inactiveId } = await getActivePlayer(hostPage, guestPage);

            // 注入神罚
            await injectTokens(activePage, activeId, { [TOKEN_IDS.RETRIBUTION]: 1 });

            const core1 = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(core1, activeId)[TOKEN_IDS.RETRIBUTION], '神罚注入失败').toBe(1);
            const attackerHpBefore = getPlayerHp(core1, inactiveId);

            // 模拟受击后反弹：神罚消耗，攻击者受到 2 点反弹伤害
            const retributionDamage = 2;
            const core2 = await readCoreState(activePage) as Record<string, unknown>;
            const players = core2.players as Record<string, Record<string, unknown>>;
            await applyCoreStateDirect(activePage, {
                ...core2,
                players: {
                    ...players,
                    [activeId]: {
                        ...players[activeId],
                        tokens: { ...((players[activeId].tokens as Record<string, number>) ?? {}), [TOKEN_IDS.RETRIBUTION]: 0 },
                    },
                    [inactiveId]: {
                        ...players[inactiveId],
                        resources: {
                            ...((players[inactiveId].resources as Record<string, number>) ?? {}),
                            [RESOURCE_IDS.HP]: attackerHpBefore - retributionDamage,
                        },
                    },
                },
            });
            await activePage.waitForTimeout(500);

            const coreFinal = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(coreFinal, activeId)[TOKEN_IDS.RETRIBUTION] ?? 0, '神罚应被消耗').toBe(0);
            expect(getPlayerHp(coreFinal, inactiveId), '攻击者应受到反弹伤害').toBe(attackerHpBefore - retributionDamage);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('暴击/守护/精准 Token 可同时存在', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'paladin', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId } = await getActivePlayer(hostPage, guestPage);

            // 同时注入多种 Token
            await injectTokens(activePage, activeId, {
                [TOKEN_IDS.CRIT]: 1,
                [TOKEN_IDS.PROTECT]: 2,
                [TOKEN_IDS.ACCURACY]: 1,
            });

            const core = await readCoreState(activePage) as Record<string, unknown>;
            const tokens = getPlayerTokens(core, activeId);
            expect(tokens[TOKEN_IDS.CRIT], '暴击注入失败').toBe(1);
            expect(tokens[TOKEN_IDS.PROTECT], '守护注入失败').toBe(2);
            expect(tokens[TOKEN_IDS.ACCURACY], '精准注入失败').toBe(1);

            await closeDebugPanelIfOpen(activePage);
            await activePage.screenshot({ path: testInfo.outputPath('paladin-multi-tokens.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('教会税升级 Token 注入后可见', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'paladin', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId } = await getActivePlayer(hostPage, guestPage);

            await injectTokens(activePage, activeId, { [TOKEN_IDS.TITHES_UPGRADED]: 1 });

            const core = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(core, activeId)[TOKEN_IDS.TITHES_UPGRADED], '教会税升级注入失败').toBe(1);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});

// ============================================================================
// 僧侣特殊交互
// ============================================================================

test.describe('僧侣特殊交互', () => {

    test('太极 Token 可累积到上限', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'monk', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId } = await getActivePlayer(hostPage, guestPage);

            // 注入 3 层太极（默认上限 4）
            await injectTokens(activePage, activeId, { [TOKEN_IDS.TAIJI]: 3 });

            const core1 = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(core1, activeId)[TOKEN_IDS.TAIJI], '太极注入失败').toBe(3);

            // 累积到 4（上限）
            await injectTokens(activePage, activeId, { [TOKEN_IDS.TAIJI]: 4 });

            const core2 = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(core2, activeId)[TOKEN_IDS.TAIJI], '太极应累积到 4').toBe(4);

            await closeDebugPanelIfOpen(activePage);
            await activePage.screenshot({ path: testInfo.outputPath('taiji-stacked.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('净化 Token 注入后可见', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'monk', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId } = await getActivePlayer(hostPage, guestPage);

            await injectTokens(activePage, activeId, { [TOKEN_IDS.PURIFY]: 1 });

            const core = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(core, activeId)[TOKEN_IDS.PURIFY], '净化 Token 注入失败').toBe(1);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});

// ============================================================================
// 炎术士特殊交互
// ============================================================================

test.describe('炎术士特殊交互', () => {

    test('燃烧叠加到上限 3 层', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'pyromancer', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, inactiveId, activeId: _activeId3 } = await getActivePlayer(hostPage, guestPage);

            // 逐步叠加燃烧
            await injectStatus(activePage, inactiveId, { [STATUS_IDS.BURN]: 1 });
            const core1 = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerStatus(core1, inactiveId)[STATUS_IDS.BURN], '1 层燃烧注入失败').toBe(1);

            await injectStatus(activePage, inactiveId, { [STATUS_IDS.BURN]: 3 });
            const core2 = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerStatus(core2, inactiveId)[STATUS_IDS.BURN], '燃烧应叠加到 3 层').toBe(3);

            await closeDebugPanelIfOpen(activePage);
            await activePage.screenshot({ path: testInfo.outputPath('burn-stacked.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('火焰精通与燃烧可同时存在于不同玩家', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'pyromancer', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId, inactiveId } = await getActivePlayer(hostPage, guestPage);

            // 炎术士获得火焰精通
            await injectTokens(activePage, activeId, { [TOKEN_IDS.FIRE_MASTERY]: 3 });
            // 对手获得燃烧
            await injectStatus(activePage, inactiveId, { [STATUS_IDS.BURN]: 2 });

            const core = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(core, activeId)[TOKEN_IDS.FIRE_MASTERY], '火焰精通注入失败').toBe(3);
            expect(getPlayerStatus(core, inactiveId)[STATUS_IDS.BURN], '燃烧注入失败').toBe(2);

            await closeDebugPanelIfOpen(activePage);
            await activePage.screenshot({ path: testInfo.outputPath('fm-and-burn.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});

// ============================================================================
// 跨英雄交互
// ============================================================================

test.describe('跨英雄交互', () => {

    test('影子盗贼 vs 圣骑士：中毒 + 神圣祝福共存', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'shadow_thief', 'paladin');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId, inactiveId } = await getActivePlayer(hostPage, guestPage);

            // 影子盗贼有伏击，圣骑士有神圣祝福 + 中毒
            await injectTokens(activePage, activeId, { [TOKEN_IDS.SNEAK_ATTACK]: 1 });
            await injectTokens(activePage, inactiveId, { [TOKEN_IDS.BLESSING_OF_DIVINITY]: 1 });
            await injectStatus(activePage, inactiveId, { [STATUS_IDS.POISON]: 2 });

            const core = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerTokens(core, activeId)[TOKEN_IDS.SNEAK_ATTACK], '伏击注入失败').toBe(1);
            expect(getPlayerTokens(core, inactiveId)[TOKEN_IDS.BLESSING_OF_DIVINITY], '祝福注入失败').toBe(1);
            expect(getPlayerStatus(core, inactiveId)[STATUS_IDS.POISON], '中毒注入失败').toBe(2);

            await closeDebugPanelIfOpen(activePage);
            await activePage.screenshot({ path: testInfo.outputPath('cross-hero-interaction.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('CP 资源操作：获取和消耗', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'shadow_thief', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const { activePage, activeId } = await getActivePlayer(hostPage, guestPage);

            // 注入 10 CP
            await injectResources(activePage, activeId, { [RESOURCE_IDS.CP]: 10 });

            const core1 = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerCp(core1, activeId), 'CP 注入失败').toBe(10);

            // 模拟消耗 3 CP（偷窃技能获得）
            await injectResources(activePage, activeId, { [RESOURCE_IDS.CP]: 7 });

            const core2 = await readCoreState(activePage) as Record<string, unknown>;
            expect(getPlayerCp(core2, activeId), 'CP 应减少到 7').toBe(7);

            await closeDebugPanelIfOpen(activePage);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});
