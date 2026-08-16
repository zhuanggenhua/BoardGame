/**
 * 中毒（Poison）和燃烧（Burn）持续伤害 E2E 测试
 *
 * 这组用例只验证状态图标、状态层数和持续伤害后的权威状态，不验证在线开房。
 * 使用单页 TestHarness 代表态，避免每条用例重复创建双人在线房间和加载完整素材门禁。
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

const OPEN_TIMEOUT_MS = 45000;
const TEST_TIMEOUT_MS = 90000;
const ATTACKER_ID = '0';
const DEFENDER_ID = '1';

async function setupPoisonBurnScene(page: Page, game: GameTestContext): Promise<void> {
    await game.openTestGame('dicethrone', { playerID: ATTACKER_ID, disableLocalAiAutomation: true }, OPEN_TIMEOUT_MS);
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { [RESOURCE_IDS.CP]: 3, [RESOURCE_IDS.HP]: 50 },
            tokens: {},
        },
        player1: {
            resources: { [RESOURCE_IDS.CP]: 3, [RESOURCE_IDS.HP]: 50 },
            tokens: {},
        },
        currentPlayer: ATTACKER_ID,
        phase: 'main1',
        extra: {
            selectedCharacters: { [ATTACKER_ID]: 'barbarian', [DEFENDER_ID]: 'monk' },
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

async function patchPlayerState(
    page: Page,
    playerId: string,
    options: {
        statusEffects?: Record<string, number>;
        resources?: Record<string, number>;
        tokens?: Record<string, number>;
    },
): Promise<void> {
    await patchDiceThroneHarnessState(page, {
        core: {
            players: {
                [playerId]: options,
            },
        },
    });
}

async function expectPlayerState(
    page: Page,
    playerId: string,
    expected: {
        statusEffects?: Record<string, number>;
        resources?: Record<string, number>;
        tokens?: Record<string, number>;
    },
): Promise<void> {
    await expect.poll(async () => {
        const player = getPlayerState(await readCore(page), playerId);
        return {
            statusEffects: expected.statusEffects
                ? Object.fromEntries(Object.keys(expected.statusEffects).map((id) => [id, player.statusEffects?.[id] ?? 0]))
                : undefined,
            resources: expected.resources
                ? Object.fromEntries(Object.keys(expected.resources).map((id) => [id, player.resources?.[id] ?? 0]))
                : undefined,
            tokens: expected.tokens
                ? Object.fromEntries(Object.keys(expected.tokens).map((id) => [id, player.tokens?.[id] ?? 0]))
                : undefined,
        };
    }, { timeout: 5000 }).toEqual({
        statusEffects: expected.statusEffects,
        resources: expected.resources,
        tokens: expected.tokens,
    });
}

async function expectStatusVisible(page: Page, playerId: string, statusId: string): Promise<void> {
    await expect(page.getByTestId(`dt-player-${playerId}-status-${statusId}`)).toBeVisible({ timeout: 10000 });
}

test.describe('中毒和燃烧持续伤害机制', () => {
    test('中毒状态注入后可见，回合伤害模拟正确', async ({ page, game }, testInfo: TestInfo) => {
        test.setTimeout(TEST_TIMEOUT_MS);
        await setupPoisonBurnScene(page, game);

        const hpBefore = getPlayerState(await readCore(page), DEFENDER_ID).resources[RESOURCE_IDS.HP] ?? 0;

        await patchPlayerState(page, DEFENDER_ID, {
            statusEffects: { [STATUS_IDS.POISON]: 2 },
        });
        await expectPlayerState(page, DEFENDER_ID, {
            statusEffects: { [STATUS_IDS.POISON]: 2 },
        });
        await expectStatusVisible(page, DEFENDER_ID, STATUS_IDS.POISON);

        await patchPlayerState(page, DEFENDER_ID, {
            statusEffects: { [STATUS_IDS.POISON]: 1 },
            resources: { [RESOURCE_IDS.HP]: hpBefore - 2 },
        });
        await expectPlayerState(page, DEFENDER_ID, {
            statusEffects: { [STATUS_IDS.POISON]: 1 },
            resources: { [RESOURCE_IDS.HP]: hpBefore - 2 },
        });

        await page.screenshot({ path: testInfo.outputPath('poison-dot.png'), fullPage: false });
    });

    test('燃烧状态注入后可见，回合伤害模拟正确', async ({ page, game }) => {
        test.setTimeout(TEST_TIMEOUT_MS);
        await setupPoisonBurnScene(page, game);

        const hpBefore = getPlayerState(await readCore(page), DEFENDER_ID).resources[RESOURCE_IDS.HP] ?? 0;

        await patchPlayerState(page, DEFENDER_ID, {
            statusEffects: { [STATUS_IDS.BURN]: 3 },
        });
        await expectPlayerState(page, DEFENDER_ID, {
            statusEffects: { [STATUS_IDS.BURN]: 3 },
        });
        await expectStatusVisible(page, DEFENDER_ID, STATUS_IDS.BURN);

        await patchPlayerState(page, DEFENDER_ID, {
            statusEffects: { [STATUS_IDS.BURN]: 2 },
            resources: { [RESOURCE_IDS.HP]: hpBefore - 3 },
        });
        await expectPlayerState(page, DEFENDER_ID, {
            statusEffects: { [STATUS_IDS.BURN]: 2 },
            resources: { [RESOURCE_IDS.HP]: hpBefore - 3 },
        });
    });

    test('层数递减到 0 后自动移除', async ({ page, game }) => {
        test.setTimeout(TEST_TIMEOUT_MS);
        await setupPoisonBurnScene(page, game);

        await patchPlayerState(page, DEFENDER_ID, {
            statusEffects: { [STATUS_IDS.POISON]: 1 },
        });
        await expectStatusVisible(page, DEFENDER_ID, STATUS_IDS.POISON);

        await patchPlayerState(page, DEFENDER_ID, {
            statusEffects: { [STATUS_IDS.POISON]: 0 },
        });
        await expectPlayerState(page, DEFENDER_ID, {
            statusEffects: { [STATUS_IDS.POISON]: 0 },
        });
    });

    test('中毒和燃烧可以同时存在', async ({ page, game }) => {
        test.setTimeout(TEST_TIMEOUT_MS);
        await setupPoisonBurnScene(page, game);

        const hpBefore = getPlayerState(await readCore(page), DEFENDER_ID).resources[RESOURCE_IDS.HP] ?? 0;

        await patchPlayerState(page, DEFENDER_ID, {
            statusEffects: {
                [STATUS_IDS.POISON]: 2,
                [STATUS_IDS.BURN]: 2,
            },
        });
        await expectPlayerState(page, DEFENDER_ID, {
            statusEffects: {
                [STATUS_IDS.POISON]: 2,
                [STATUS_IDS.BURN]: 2,
            },
        });
        await expectStatusVisible(page, DEFENDER_ID, STATUS_IDS.POISON);
        await expectStatusVisible(page, DEFENDER_ID, STATUS_IDS.BURN);

        await patchPlayerState(page, DEFENDER_ID, {
            statusEffects: { [STATUS_IDS.POISON]: 1, [STATUS_IDS.BURN]: 1 },
            resources: { [RESOURCE_IDS.HP]: hpBefore - 4 },
        });
        await expectPlayerState(page, DEFENDER_ID, {
            statusEffects: { [STATUS_IDS.POISON]: 1, [STATUS_IDS.BURN]: 1 },
            resources: { [RESOURCE_IDS.HP]: hpBefore - 4 },
        });
    });

    test('中毒可以被净化移除后不再造成伤害', async ({ page, game }) => {
        test.setTimeout(TEST_TIMEOUT_MS);
        await setupPoisonBurnScene(page, game);

        const hpBefore = getPlayerState(await readCore(page), DEFENDER_ID).resources[RESOURCE_IDS.HP] ?? 0;

        await patchPlayerState(page, DEFENDER_ID, {
            statusEffects: { [STATUS_IDS.POISON]: 2 },
            tokens: { [TOKEN_IDS.PURIFY]: 1 },
        });
        await expectPlayerState(page, DEFENDER_ID, {
            statusEffects: { [STATUS_IDS.POISON]: 2 },
            tokens: { [TOKEN_IDS.PURIFY]: 1 },
        });
        await expectStatusVisible(page, DEFENDER_ID, STATUS_IDS.POISON);

        await patchPlayerState(page, DEFENDER_ID, {
            statusEffects: { [STATUS_IDS.POISON]: 0 },
        });
        await expectPlayerState(page, DEFENDER_ID, {
            statusEffects: { [STATUS_IDS.POISON]: 0 },
            resources: { [RESOURCE_IDS.HP]: hpBefore },
        });
    });
});
