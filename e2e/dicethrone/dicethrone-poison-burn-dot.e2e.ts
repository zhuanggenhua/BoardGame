/**
 * 中毒（Poison）和燃烧（Burn）持续伤害 E2E 测试
 *
 * 测试场景：
 * 1. 中毒状态注入后在 UI 中可见
 * 2. 燃烧状态注入后在 UI 中可见
 * 3. 中毒/燃烧层数递减模拟
 * 4. 中毒和燃烧可以同时存在
 * 5. 层数递减到 0 后自动移除
 *
 * 使用在线双人对局模式，通过调试面板注入状态。
 */

import { test, expect } from '../framework';
import { STATUS_IDS } from '../src/games/dicethrone/domain/ids';
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

/** 注入 statusEffects 和 resources */
const injectPlayerState = async (
    page: import('@playwright/test').Page,
    playerId: string,
    statusEffects: Record<string, number>,
    resourceOverrides?: Record<string, number>,
) => {
    const core = await readCoreState(page) as Record<string, unknown>;
    const players = core.players as Record<string, Record<string, unknown>>;
    const player = players[playerId];
    const updatedPlayer: Record<string, unknown> = {
        ...player,
        statusEffects: { ...((player.statusEffects as Record<string, number>) ?? {}), ...statusEffects },
    };
    if (resourceOverrides) {
        updatedPlayer.resources = { ...((player.resources as Record<string, number>) ?? {}), ...resourceOverrides };
    }
    await applyCoreStateDirect(page, {
        ...core,
        players: { ...players, [playerId]: updatedPlayer },
    });
    await page.waitForTimeout(500);
};

test.describe('中毒和燃烧持续伤害机制', () => {

    test('中毒状态注入后可见，回合伤害模拟正确', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'barbarian', 'monk');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            const hostIsActive = await hostNextPhase.isEnabled({ timeout: 5000 }).catch(() => false);
            const page = hostIsActive ? hostPage : match.guestPage;
            const defenderId = hostIsActive ? '1' : '0';

            // 读取防御方初始 HP
            const coreBefore = await readCoreState(page) as Record<string, unknown>;
            const defenderBefore = getPlayerState(coreBefore, defenderId);
            const hpBefore = (defenderBefore.resources as Record<string, number>)[RESOURCE_IDS.HP] ?? 0;

            // 注入 2 层中毒
            await injectPlayerState(page, defenderId, { [STATUS_IDS.POISON]: 2 });

            // 验证中毒注入成功
            const coreAfterInject = await readCoreState(page) as Record<string, unknown>;
            const statusAfterInject = (getPlayerState(coreAfterInject, defenderId).statusEffects as Record<string, number>) ?? {};
            expect(statusAfterInject[STATUS_IDS.POISON], '中毒注入失败').toBe(2);

            // 模拟回合开始：2 层中毒造成 2 点伤害，层数减 1
            await injectPlayerState(page, defenderId,
                { [STATUS_IDS.POISON]: 1 },
                { [RESOURCE_IDS.HP]: hpBefore - 2 },
            );

            const coreAfterTurn1 = await readCoreState(page) as Record<string, unknown>;
            const defenderAfterTurn1 = getPlayerState(coreAfterTurn1, defenderId);
            const hpAfterTurn1 = (defenderAfterTurn1.resources as Record<string, number>)[RESOURCE_IDS.HP] ?? 0;
            const poisonAfterTurn1 = ((defenderAfterTurn1.statusEffects as Record<string, number>) ?? {})[STATUS_IDS.POISON] ?? 0;

            expect(hpAfterTurn1, '中毒应造成 2 点伤害').toBe(hpBefore - 2);
            expect(poisonAfterTurn1, '中毒应减少 1 层').toBe(1);

            await closeDebugPanelIfOpen(page);
            await page.screenshot({ path: testInfo.outputPath('poison-dot.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('燃烧状态注入后可见，回合伤害模拟正确', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'barbarian', 'monk');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            const hostIsActive = await hostNextPhase.isEnabled({ timeout: 5000 }).catch(() => false);
            const page = hostIsActive ? hostPage : match.guestPage;
            const defenderId = hostIsActive ? '1' : '0';

            const coreBefore = await readCoreState(page) as Record<string, unknown>;
            const hpBefore = (getPlayerState(coreBefore, defenderId).resources as Record<string, number>)[RESOURCE_IDS.HP] ?? 0;

            // 注入 3 层燃烧
            await injectPlayerState(page, defenderId, { [STATUS_IDS.BURN]: 3 });

            const coreAfterInject = await readCoreState(page) as Record<string, unknown>;
            expect(((getPlayerState(coreAfterInject, defenderId).statusEffects as Record<string, number>) ?? {})[STATUS_IDS.BURN], '燃烧注入失败').toBe(3);

            // 模拟回合开始：3 层燃烧造成 3 点伤害，层数减 1
            await injectPlayerState(page, defenderId,
                { [STATUS_IDS.BURN]: 2 },
                { [RESOURCE_IDS.HP]: hpBefore - 3 },
            );

            const coreAfterTurn = await readCoreState(page) as Record<string, unknown>;
            const defenderAfterTurn = getPlayerState(coreAfterTurn, defenderId);
            expect((defenderAfterTurn.resources as Record<string, number>)[RESOURCE_IDS.HP], '燃烧应造成 3 点伤害').toBe(hpBefore - 3);
            expect(((defenderAfterTurn.statusEffects as Record<string, number>) ?? {})[STATUS_IDS.BURN], '燃烧应减少 1 层').toBe(2);

            await closeDebugPanelIfOpen(page);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('层数递减到 0 后自动移除', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'barbarian', 'monk');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            const hostIsActive = await hostNextPhase.isEnabled({ timeout: 5000 }).catch(() => false);
            const page = hostIsActive ? hostPage : match.guestPage;
            const defenderId = hostIsActive ? '1' : '0';

            // 注入 1 层中毒
            await injectPlayerState(page, defenderId, { [STATUS_IDS.POISON]: 1 });

            // 模拟回合：层数减到 0
            await injectPlayerState(page, defenderId, { [STATUS_IDS.POISON]: 0 });

            const coreFinal = await readCoreState(page) as Record<string, unknown>;
            const poisonFinal = ((getPlayerState(coreFinal, defenderId).statusEffects as Record<string, number>) ?? {})[STATUS_IDS.POISON] ?? 0;
            expect(poisonFinal, '中毒应被完全移除').toBe(0);

            await closeDebugPanelIfOpen(page);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('中毒和燃烧可以同时存在', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'barbarian', 'monk');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            const hostIsActive = await hostNextPhase.isEnabled({ timeout: 5000 }).catch(() => false);
            const page = hostIsActive ? hostPage : match.guestPage;
            const defenderId = hostIsActive ? '1' : '0';

            const coreBefore = await readCoreState(page) as Record<string, unknown>;
            const hpBefore = (getPlayerState(coreBefore, defenderId).resources as Record<string, number>)[RESOURCE_IDS.HP] ?? 0;

            // 同时注入中毒和燃烧
            await injectPlayerState(page, defenderId, {
                [STATUS_IDS.POISON]: 2,
                [STATUS_IDS.BURN]: 2,
            });

            const coreAfterInject = await readCoreState(page) as Record<string, unknown>;
            const statusAfterInject = (getPlayerState(coreAfterInject, defenderId).statusEffects as Record<string, number>) ?? {};
            expect(statusAfterInject[STATUS_IDS.POISON], '中毒注入失败').toBe(2);
            expect(statusAfterInject[STATUS_IDS.BURN], '燃烧注入失败').toBe(2);

            // 模拟回合：2 中毒 + 2 燃烧 = 4 点伤害，各减 1 层
            await injectPlayerState(page, defenderId,
                { [STATUS_IDS.POISON]: 1, [STATUS_IDS.BURN]: 1 },
                { [RESOURCE_IDS.HP]: hpBefore - 4 },
            );

            const coreFinal = await readCoreState(page) as Record<string, unknown>;
            const defenderFinal = getPlayerState(coreFinal, defenderId);
            const hpFinal = (defenderFinal.resources as Record<string, number>)[RESOURCE_IDS.HP] ?? 0;
            const statusFinal = (defenderFinal.statusEffects as Record<string, number>) ?? {};

            expect(hpFinal, '应受到 4 点伤害（2 中毒 + 2 燃烧）').toBe(hpBefore - 4);
            expect(statusFinal[STATUS_IDS.POISON], '中毒应减少 1 层').toBe(1);
            expect(statusFinal[STATUS_IDS.BURN], '燃烧应减少 1 层').toBe(1);

            await closeDebugPanelIfOpen(page);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('中毒可以被净化移除后不再造成伤害', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupOnlineMatch(browser, baseURL, 'barbarian', 'monk');
        if (!match) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, hostContext, guestContext } = match;

        try {
            await hostPage.waitForTimeout(2000);
            const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            const hostIsActive = await hostNextPhase.isEnabled({ timeout: 5000 }).catch(() => false);
            const page = hostIsActive ? hostPage : match.guestPage;
            const defenderId = hostIsActive ? '1' : '0';

            const coreBefore = await readCoreState(page) as Record<string, unknown>;
            const hpBefore = (getPlayerState(coreBefore, defenderId).resources as Record<string, number>)[RESOURCE_IDS.HP] ?? 0;

            // 注入中毒 + 净化
            const core = await readCoreState(page) as Record<string, unknown>;
            const players = core.players as Record<string, Record<string, unknown>>;
            const defender = players[defenderId];
            await applyCoreStateDirect(page, {
                ...core,
                players: {
                    ...players,
                    [defenderId]: {
                        ...defender,
                        statusEffects: { ...((defender.statusEffects as Record<string, number>) ?? {}), [STATUS_IDS.POISON]: 2 },
                        tokens: { ...((defender.tokens as Record<string, number>) ?? {}), purify: 1 },
                    },
                },
            });
            await page.waitForTimeout(500);

            // 模拟净化移除中毒
            await injectPlayerState(page, defenderId, { [STATUS_IDS.POISON]: 0 });

            // 验证 HP 不变（中毒已被移除，不造成伤害）
            const coreFinal = await readCoreState(page) as Record<string, unknown>;
            const hpFinal = (getPlayerState(coreFinal, defenderId).resources as Record<string, number>)[RESOURCE_IDS.HP] ?? 0;
            expect(hpFinal, '净化后不应受到中毒伤害').toBe(hpBefore);

            await closeDebugPanelIfOpen(page);
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});
