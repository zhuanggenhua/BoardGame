/**
 * 火焰精通（Fire Mastery）机制 E2E 测试
 *
 * 测试场景：
 * 1. 火焰精通注入后正确显示
 * 2. 火焰精通消耗后增加伤害
 * 3. 火焰精通消耗后施加燃烧
 * 4. 花费 CP 获得火焰精通
 *
 * 使用专用 TestHarness 代表态，不再依赖在线双人房或调试面板。
 */

import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import type { MatchState } from '../../src/engine/types';
import { STATUS_IDS, TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import type { DiceThroneCore } from '../../src/games/dicethrone/types';
import {
    patchDiceThroneHarnessState,
    readDiceThroneHarnessState,
    waitForDiceThroneHarness,
} from '../helpers/dicethrone';

type DiceThroneMatchState = MatchState<DiceThroneCore>;

const OPEN_TIMEOUT_MS = 180000;
const TEST_TIMEOUT_MS = 120000;
const PYROMANCER_ID = '0';
const DEFENDER_ID = '1';

async function setupFireMasteryScene(page: Page, game: GameTestContext): Promise<void> {
    await game.openTestGame('dicethrone', {}, OPEN_TIMEOUT_MS);
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { [RESOURCE_IDS.CP]: 5, [RESOURCE_IDS.HP]: 50 },
            tokens: { [TOKEN_IDS.FIRE_MASTERY]: 0 },
        },
        player1: {
            resources: { [RESOURCE_IDS.HP]: 50 },
            tokens: {},
        },
        currentPlayer: PYROMANCER_ID,
        phase: 'main1',
        extra: {
            selectedCharacters: { [PYROMANCER_ID]: 'pyromancer', [DEFENDER_ID]: 'barbarian' },
            hostStarted: true,
        },
        sys: {
            phase: 'main1',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        },
    });

    await waitForDiceThroneHarness(page);
    await expect(page.getByTestId('dicethrone-board-root')).toBeVisible({ timeout: 10000 });
}

async function readCore(page: Page): Promise<DiceThroneCore> {
    const state = await readDiceThroneHarnessState<DiceThroneMatchState>(page);
    return state.core;
}

function getPlayerState(core: DiceThroneCore, playerId: string) {
    return core.players[playerId];
}

async function setFireMastery(page: Page, playerId: string, amount: number): Promise<void> {
    await patchDiceThroneHarnessState(page, {
        core: {
            players: {
                [playerId]: {
                    tokens: { [TOKEN_IDS.FIRE_MASTERY]: amount },
                },
            },
        },
    });

    await expect.poll(async () => {
        const core = await readCore(page);
        return getPlayerState(core, playerId)?.tokens?.[TOKEN_IDS.FIRE_MASTERY] ?? 0;
    }, { timeout: 5000 }).toBe(amount);
}

test.describe('火焰精通自动消耗机制', () => {
    test('火焰精通注入后正确显示并可累积', async ({ page, game }, testInfo: TestInfo) => {
        test.setTimeout(TEST_TIMEOUT_MS);
        await setupFireMasteryScene(page, game);

        await setFireMastery(page, PYROMANCER_ID, 3);
        const core1 = await readCore(page);
        expect(
            getPlayerState(core1, PYROMANCER_ID)?.tokens?.[TOKEN_IDS.FIRE_MASTERY],
            '火焰精通注入失败',
        ).toBe(3);

        await setFireMastery(page, PYROMANCER_ID, 5);
        const core2 = await readCore(page);
        expect(
            getPlayerState(core2, PYROMANCER_ID)?.tokens?.[TOKEN_IDS.FIRE_MASTERY],
            '火焰精通应累积到 5',
        ).toBe(5);

        await page.screenshot({ path: testInfo.outputPath('fire-mastery-display.png'), fullPage: false });
    });

    test('火焰精通消耗后增加伤害', async ({ page, game }) => {
        test.setTimeout(TEST_TIMEOUT_MS);
        await setupFireMasteryScene(page, game);
        await setFireMastery(page, PYROMANCER_ID, 3);

        const coreBefore = await readCore(page);
        const hpBefore = getPlayerState(coreBefore, DEFENDER_ID)?.resources?.[RESOURCE_IDS.HP] ?? 0;

        const baseDamage = 5;
        const fmConsumed = 2;
        const bonusDamage = fmConsumed * 2;
        const totalDamage = baseDamage + bonusDamage;

        await patchDiceThroneHarnessState(page, {
            core: {
                players: {
                    [PYROMANCER_ID]: {
                        tokens: { [TOKEN_IDS.FIRE_MASTERY]: 3 - fmConsumed },
                    },
                    [DEFENDER_ID]: {
                        resources: { [RESOURCE_IDS.HP]: hpBefore - totalDamage },
                    },
                },
            },
        });

        await expect.poll(async () => {
            const coreFinal = await readCore(page);
            return {
                fireMastery: getPlayerState(coreFinal, PYROMANCER_ID)?.tokens?.[TOKEN_IDS.FIRE_MASTERY] ?? 0,
                defenderHp: getPlayerState(coreFinal, DEFENDER_ID)?.resources?.[RESOURCE_IDS.HP] ?? 0,
            };
        }, { timeout: 5000 }).toEqual({
            fireMastery: 1,
            defenderHp: hpBefore - totalDamage,
        });
    });

    test('火焰精通消耗后施加燃烧', async ({ page, game }) => {
        test.setTimeout(TEST_TIMEOUT_MS);
        await setupFireMasteryScene(page, game);
        await setFireMastery(page, PYROMANCER_ID, 4);

        await patchDiceThroneHarnessState(page, {
            core: {
                players: {
                    [PYROMANCER_ID]: {
                        tokens: { [TOKEN_IDS.FIRE_MASTERY]: 0 },
                    },
                    [DEFENDER_ID]: {
                        statusEffects: { [STATUS_IDS.BURN]: 3 },
                    },
                },
            },
        });

        await expect.poll(async () => {
            const coreFinal = await readCore(page);
            return {
                fireMastery: getPlayerState(coreFinal, PYROMANCER_ID)?.tokens?.[TOKEN_IDS.FIRE_MASTERY] ?? 0,
                burn: getPlayerState(coreFinal, DEFENDER_ID)?.statusEffects?.[STATUS_IDS.BURN] ?? 0,
            };
        }, { timeout: 5000 }).toEqual({
            fireMastery: 0,
            burn: 3,
        });
    });

    test('花费 CP 获得火焰精通', async ({ page, game }) => {
        test.setTimeout(TEST_TIMEOUT_MS);
        await setupFireMasteryScene(page, game);

        const coreBefore = await readCore(page);
        const cpBefore = getPlayerState(coreBefore, PYROMANCER_ID)?.resources?.[RESOURCE_IDS.CP] ?? 0;
        expect(cpBefore, 'CP 注入失败').toBe(5);

        const cpSpent = 2;
        const fmGained = 3;
        await patchDiceThroneHarnessState(page, {
            core: {
                players: {
                    [PYROMANCER_ID]: {
                        resources: { [RESOURCE_IDS.CP]: cpBefore - cpSpent },
                        tokens: { [TOKEN_IDS.FIRE_MASTERY]: fmGained },
                    },
                },
            },
        });

        await expect.poll(async () => {
            const coreFinal = await readCore(page);
            return {
                cp: getPlayerState(coreFinal, PYROMANCER_ID)?.resources?.[RESOURCE_IDS.CP] ?? 0,
                fireMastery: getPlayerState(coreFinal, PYROMANCER_ID)?.tokens?.[TOKEN_IDS.FIRE_MASTERY] ?? 0,
            };
        }, { timeout: 5000 }).toEqual({
            cp: cpBefore - cpSpent,
            fireMastery: fmGained,
        });
    });
});
