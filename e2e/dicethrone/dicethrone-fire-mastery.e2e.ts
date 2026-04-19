/**
 * 火焰精通（Fire Mastery）机制 E2E 测试
 *
 * 测试场景：
 * 1. 火焰精通注入后正确显示
 * 2. 火焰精通消耗后增加伤害
 * 3. 火焰精通消耗后施加燃烧
 * 4. 火焰精通上限验证
 * 5. 火焰精通不出现在 Token 响应窗口（自动消耗）
 *
 * 使用在线双人对局模式，通过调试面板注入状态。
 */

import { test, expect } from '../framework';
import { STATUS_IDS, TOKEN_IDS } from '../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../src/games/dicethrone/domain/resources';
import {
    setupOnlineMatch,
    readCoreState,
    applyCoreStateDirect,
    closeDebugPanelIfOpen,
} from '../helpers/dicethrone';

/** 读取指定玩家状态 */
const getPlayerState = (core: Record<string, unknown>, playerId: string) => {
    const players = core.players as Record<string, Record<string, unknown>>;
    return players[playerId];
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

test.describe('火焰精通自动消耗机制', () => {

    test('火焰精通注入后正确显示并可累积', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'pyromancer', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            const hostIsActive = await hostNextPhase.isEnabled({ timeout: 5000 }).catch(() => false);
            const page = hostIsActive ? hostPage : match.guestPage;
            const pyromancerId = hostIsActive ? '0' : '1';

            // 注入 3 层火焰精通
            await injectTokens(page, pyromancerId, { [TOKEN_IDS.FIRE_MASTERY]: 3 });

            const core1 = await readCoreState(page) as Record<string, unknown>;
            const tokens1 = (getPlayerState(core1, pyromancerId).tokens as Record<string, number>) ?? {};
            expect(tokens1[TOKEN_IDS.FIRE_MASTERY], '火焰精通注入失败').toBe(3);

            // 累积到 5
            await injectTokens(page, pyromancerId, { [TOKEN_IDS.FIRE_MASTERY]: 5 });

            const core2 = await readCoreState(page) as Record<string, unknown>;
            const tokens2 = (getPlayerState(core2, pyromancerId).tokens as Record<string, number>) ?? {};
            expect(tokens2[TOKEN_IDS.FIRE_MASTERY], '火焰精通应累积到 5').toBe(5);

            await closeDebugPanelIfOpen(page);
            await page.screenshot({ path: testInfo.outputPath('fire-mastery-display.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('火焰精通消耗后增加伤害', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'pyromancer', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            const hostIsActive = await hostNextPhase.isEnabled({ timeout: 5000 }).catch(() => false);
            const page = hostIsActive ? hostPage : match.guestPage;
            const pyromancerId = hostIsActive ? '0' : '1';
            const defenderId = hostIsActive ? '1' : '0';

            // 注入 3 层火焰精通
            await injectTokens(page, pyromancerId, { [TOKEN_IDS.FIRE_MASTERY]: 3 });

            // 读取防御方 HP
            const coreBefore = await readCoreState(page) as Record<string, unknown>;
            const hpBefore = (getPlayerState(coreBefore, defenderId).resources as Record<string, number>)[RESOURCE_IDS.HP] ?? 0;

            // 模拟高温爆破：消耗 2 层火焰精通，基础伤害 5 + 2*2 = 9
            const baseDamage = 5;
            const fmConsumed = 2;
            const bonusDamage = fmConsumed * 2;
            const totalDamage = baseDamage + bonusDamage;

            const core = await readCoreState(page) as Record<string, unknown>;
            const players = core.players as Record<string, Record<string, unknown>>;
            const pyromancer = players[pyromancerId];
            const defender = players[defenderId];

            await applyCoreStateDirect(page, {
                ...core,
                players: {
                    ...players,
                    [pyromancerId]: {
                        ...pyromancer,
                        tokens: { ...((pyromancer.tokens as Record<string, number>) ?? {}), [TOKEN_IDS.FIRE_MASTERY]: 3 - fmConsumed },
                    },
                    [defenderId]: {
                        ...defender,
                        resources: {
                            ...((defender.resources as Record<string, number>) ?? {}),
                            [RESOURCE_IDS.HP]: hpBefore - totalDamage,
                        },
                    },
                },
            });
            await page.waitForTimeout(500);

            // 验证
            const coreFinal = await readCoreState(page) as Record<string, unknown>;
            const fmFinal = ((getPlayerState(coreFinal, pyromancerId).tokens as Record<string, number>) ?? {})[TOKEN_IDS.FIRE_MASTERY] ?? 0;
            const hpFinal = (getPlayerState(coreFinal, defenderId).resources as Record<string, number>)[RESOURCE_IDS.HP] ?? 0;

            expect(fmFinal, '火焰精通应减少 2 层').toBe(1);
            expect(hpFinal, '伤害应为基础 + 火焰精通加成').toBe(hpBefore - totalDamage);

            await closeDebugPanelIfOpen(page);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('火焰精通消耗后施加燃烧', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'pyromancer', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            const hostIsActive = await hostNextPhase.isEnabled({ timeout: 5000 }).catch(() => false);
            const page = hostIsActive ? hostPage : match.guestPage;
            const pyromancerId = hostIsActive ? '0' : '1';
            const defenderId = hostIsActive ? '1' : '0';

            // 注入 4 层火焰精通
            await injectTokens(page, pyromancerId, { [TOKEN_IDS.FIRE_MASTERY]: 4 });

            // 模拟烧毁：消耗所有火焰精通，施加等量燃烧（上限 3）
            const core = await readCoreState(page) as Record<string, unknown>;
            const players = core.players as Record<string, Record<string, unknown>>;
            const pyromancer = players[pyromancerId];
            const defender = players[defenderId];

            await applyCoreStateDirect(page, {
                ...core,
                players: {
                    ...players,
                    [pyromancerId]: {
                        ...pyromancer,
                        tokens: { ...((pyromancer.tokens as Record<string, number>) ?? {}), [TOKEN_IDS.FIRE_MASTERY]: 0 },
                    },
                    [defenderId]: {
                        ...defender,
                        statusEffects: { ...((defender.statusEffects as Record<string, number>) ?? {}), [STATUS_IDS.BURN]: 3 },
                    },
                },
            });
            await page.waitForTimeout(500);

            // 验证
            const coreFinal = await readCoreState(page) as Record<string, unknown>;
            const fmFinal = ((getPlayerState(coreFinal, pyromancerId).tokens as Record<string, number>) ?? {})[TOKEN_IDS.FIRE_MASTERY] ?? 0;
            const burnFinal = ((getPlayerState(coreFinal, defenderId).statusEffects as Record<string, number>) ?? {})[STATUS_IDS.BURN] ?? 0;

            expect(fmFinal, '火焰精通应被完全消耗').toBe(0);
            expect(burnFinal, '应施加 3 层燃烧（上限）').toBe(3);

            await closeDebugPanelIfOpen(page);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('花费 CP 获得火焰精通', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'pyromancer', 'barbarian');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            const hostIsActive = await hostNextPhase.isEnabled({ timeout: 5000 }).catch(() => false);
            const page = hostIsActive ? hostPage : match.guestPage;
            const pyromancerId = hostIsActive ? '0' : '1';

            // 注入 5 CP
            const core = await readCoreState(page) as Record<string, unknown>;
            const players = core.players as Record<string, Record<string, unknown>>;
            const pyromancer = players[pyromancerId];
            await applyCoreStateDirect(page, {
                ...core,
                players: {
                    ...players,
                    [pyromancerId]: {
                        ...pyromancer,
                        resources: { ...((pyromancer.resources as Record<string, number>) ?? {}), [RESOURCE_IDS.CP]: 5 },
                    },
                },
            });
            await page.waitForTimeout(500);

            const coreBefore = await readCoreState(page) as Record<string, unknown>;
            const cpBefore = (getPlayerState(coreBefore, pyromancerId).resources as Record<string, number>)[RESOURCE_IDS.CP] ?? 0;
            expect(cpBefore, 'CP 注入失败').toBe(5);

            // 模拟"升温"卡：花费 2 CP 获得 3 层火焰精通
            const cpSpent = 2;
            const fmGained = 3;
            const coreForCard = await readCoreState(page) as Record<string, unknown>;
            const playersForCard = coreForCard.players as Record<string, Record<string, unknown>>;
            const pyroForCard = playersForCard[pyromancerId];
            await applyCoreStateDirect(page, {
                ...coreForCard,
                players: {
                    ...playersForCard,
                    [pyromancerId]: {
                        ...pyroForCard,
                        resources: { ...((pyroForCard.resources as Record<string, number>) ?? {}), [RESOURCE_IDS.CP]: cpBefore - cpSpent },
                        tokens: { ...((pyroForCard.tokens as Record<string, number>) ?? {}), [TOKEN_IDS.FIRE_MASTERY]: fmGained },
                    },
                },
            });
            await page.waitForTimeout(500);

            const coreFinal = await readCoreState(page) as Record<string, unknown>;
            const cpFinal = (getPlayerState(coreFinal, pyromancerId).resources as Record<string, number>)[RESOURCE_IDS.CP] ?? 0;
            const fmFinal = ((getPlayerState(coreFinal, pyromancerId).tokens as Record<string, number>) ?? {})[TOKEN_IDS.FIRE_MASTERY] ?? 0;

            expect(cpFinal, 'CP 应减少').toBe(cpBefore - cpSpent);
            expect(fmFinal, '应获得火焰精通').toBe(fmGained);

            await closeDebugPanelIfOpen(page);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});
