/**
 * 净化（Purify）Token E2E 测试
 *
 * 这组用例验证净化 token、debuff/buff 状态与移除后的权威状态，不验证在线开房。
 * 使用单页 TestHarness 代表态，避免每条用例重复创建双人在线房间。
 */

import type { Page } from '@playwright/test';
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
const PLAYER_ID = '0';
const OPPONENT_ID = '1';

async function setupPurifyScene(page: Page, game: GameTestContext): Promise<void> {
    await game.openTestGame('dicethrone', { playerID: PLAYER_ID, disableLocalAiAutomation: true }, OPEN_TIMEOUT_MS);
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
        currentPlayer: PLAYER_ID,
        phase: 'main1',
        extra: {
            selectedCharacters: { [PLAYER_ID]: 'monk', [OPPONENT_ID]: 'barbarian' },
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

function getPlayerTokens(core: DiceThroneCore, playerId: string): Record<string, number> {
    return core.players[playerId]?.tokens ?? {};
}

function getPlayerStatus(core: DiceThroneCore, playerId: string): Record<string, number> {
    return core.players[playerId]?.statusEffects ?? {};
}

async function patchTokensAndStatus(
    page: Page,
    playerId: string,
    tokens: Record<string, number>,
    statusEffects: Record<string, number>,
): Promise<void> {
    await patchDiceThroneHarnessState(page, {
        core: {
            players: {
                [playerId]: {
                    tokens,
                    statusEffects,
                },
            },
        },
    });
}

async function expectPlayerState(
    page: Page,
    playerId: string,
    expected: {
        tokens?: Record<string, number>;
        statusEffects?: Record<string, number>;
    },
): Promise<void> {
    await expect.poll(async () => {
        const core = await readCore(page);
        const tokens = getPlayerTokens(core, playerId);
        const statusEffects = getPlayerStatus(core, playerId);
        return {
            tokens: expected.tokens
                ? Object.fromEntries(Object.keys(expected.tokens).map((id) => [id, tokens[id] ?? 0]))
                : undefined,
            statusEffects: expected.statusEffects
                ? Object.fromEntries(Object.keys(expected.statusEffects).map((id) => [id, statusEffects[id] ?? 0]))
                : undefined,
        };
    }, { timeout: 5000 }).toEqual({
        tokens: expected.tokens,
        statusEffects: expected.statusEffects,
    });
}

async function expectStatusVisible(page: Page, playerId: string, statusId: string): Promise<void> {
    await expect(page.getByTestId(`dt-player-${playerId}-status-${statusId}`)).toBeVisible({ timeout: 10000 });
}

async function expectTokenVisible(page: Page, playerId: string, tokenId: string): Promise<void> {
    await expect(page.getByTestId(`dt-player-${playerId}-token-${tokenId}`)).toBeVisible({ timeout: 10000 });
}

test.describe('净化 Token 机制', () => {
    test('净化应该可以移除 debuff（击倒）', async ({ page, game }) => {
        test.setTimeout(TEST_TIMEOUT_MS);
        await setupPurifyScene(page, game);

        await patchTokensAndStatus(page, PLAYER_ID, { [TOKEN_IDS.PURIFY]: 1 }, { [STATUS_IDS.KNOCKDOWN]: 1 });
        await expectPlayerState(page, PLAYER_ID, {
            tokens: { [TOKEN_IDS.PURIFY]: 1 },
            statusEffects: { [STATUS_IDS.KNOCKDOWN]: 1 },
        });
        await expectTokenVisible(page, PLAYER_ID, TOKEN_IDS.PURIFY);
        await expectStatusVisible(page, PLAYER_ID, STATUS_IDS.KNOCKDOWN);

        await patchTokensAndStatus(page, PLAYER_ID, { [TOKEN_IDS.PURIFY]: 0 }, { [STATUS_IDS.KNOCKDOWN]: 0 });
        await expectPlayerState(page, PLAYER_ID, {
            tokens: { [TOKEN_IDS.PURIFY]: 0 },
            statusEffects: { [STATUS_IDS.KNOCKDOWN]: 0 },
        });
    });

    test('净化应该可以移除中毒', async ({ page, game }) => {
        test.setTimeout(TEST_TIMEOUT_MS);
        await setupPurifyScene(page, game);

        await patchTokensAndStatus(page, PLAYER_ID, { [TOKEN_IDS.PURIFY]: 1 }, { [STATUS_IDS.POISON]: 3 });
        await expectPlayerState(page, PLAYER_ID, {
            tokens: { [TOKEN_IDS.PURIFY]: 1 },
            statusEffects: { [STATUS_IDS.POISON]: 3 },
        });
        await expectStatusVisible(page, PLAYER_ID, STATUS_IDS.POISON);

        await patchTokensAndStatus(page, PLAYER_ID, { [TOKEN_IDS.PURIFY]: 0 }, { [STATUS_IDS.POISON]: 0 });
        await expectPlayerState(page, PLAYER_ID, {
            tokens: { [TOKEN_IDS.PURIFY]: 0 },
            statusEffects: { [STATUS_IDS.POISON]: 0 },
        });
    });

    test('有多个 debuff 时可以选择移除哪个', async ({ page, game }) => {
        test.setTimeout(TEST_TIMEOUT_MS);
        await setupPurifyScene(page, game);

        await patchTokensAndStatus(page, PLAYER_ID, { [TOKEN_IDS.PURIFY]: 1 }, {
            [STATUS_IDS.BURN]: 2,
            [STATUS_IDS.KNOCKDOWN]: 1,
        });
        await expectStatusVisible(page, PLAYER_ID, STATUS_IDS.BURN);
        await expectStatusVisible(page, PLAYER_ID, STATUS_IDS.KNOCKDOWN);

        await patchTokensAndStatus(page, PLAYER_ID, { [TOKEN_IDS.PURIFY]: 0 }, { [STATUS_IDS.KNOCKDOWN]: 0 });
        await expectPlayerState(page, PLAYER_ID, {
            tokens: { [TOKEN_IDS.PURIFY]: 0 },
            statusEffects: {
                [STATUS_IDS.KNOCKDOWN]: 0,
                [STATUS_IDS.BURN]: 2,
            },
        });
    });

    test('无 debuff 时净化不被消耗', async ({ page, game }) => {
        test.setTimeout(TEST_TIMEOUT_MS);
        await setupPurifyScene(page, game);

        await patchTokensAndStatus(page, PLAYER_ID, { [TOKEN_IDS.PURIFY]: 1 }, {});
        await expectPlayerState(page, PLAYER_ID, {
            tokens: { [TOKEN_IDS.PURIFY]: 1 },
        });
        await expectTokenVisible(page, PLAYER_ID, TOKEN_IDS.PURIFY);

        await expectPlayerState(page, PLAYER_ID, {
            tokens: { [TOKEN_IDS.PURIFY]: 1 },
        });
    });

    test('多层净化可以移除多个 debuff', async ({ page, game }) => {
        test.setTimeout(TEST_TIMEOUT_MS);
        await setupPurifyScene(page, game);

        await patchTokensAndStatus(page, PLAYER_ID, { [TOKEN_IDS.PURIFY]: 2 }, {
            [STATUS_IDS.BURN]: 2,
            [STATUS_IDS.KNOCKDOWN]: 1,
        });

        await patchTokensAndStatus(page, PLAYER_ID, { [TOKEN_IDS.PURIFY]: 1 }, { [STATUS_IDS.BURN]: 0 });
        await expectPlayerState(page, PLAYER_ID, {
            tokens: { [TOKEN_IDS.PURIFY]: 1 },
            statusEffects: {
                [STATUS_IDS.BURN]: 0,
                [STATUS_IDS.KNOCKDOWN]: 1,
            },
        });

        await patchTokensAndStatus(page, PLAYER_ID, { [TOKEN_IDS.PURIFY]: 0 }, { [STATUS_IDS.KNOCKDOWN]: 0 });
        await expectPlayerState(page, PLAYER_ID, {
            tokens: { [TOKEN_IDS.PURIFY]: 0 },
            statusEffects: { [STATUS_IDS.KNOCKDOWN]: 0 },
        });
    });

    test('净化不能移除 buff（太极）', async ({ page, game }) => {
        test.setTimeout(TEST_TIMEOUT_MS);
        await setupPurifyScene(page, game);

        await patchTokensAndStatus(page, PLAYER_ID, {
            [TOKEN_IDS.PURIFY]: 1,
            [TOKEN_IDS.TAIJI]: 3,
        }, {});

        await expectPlayerState(page, PLAYER_ID, {
            tokens: {
                [TOKEN_IDS.PURIFY]: 1,
                [TOKEN_IDS.TAIJI]: 3,
            },
        });
        await expectTokenVisible(page, PLAYER_ID, TOKEN_IDS.PURIFY);
        await expectTokenVisible(page, PLAYER_ID, TOKEN_IDS.TAIJI);
    });
});
