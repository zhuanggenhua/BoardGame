import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect } from '../framework';
import {
    cleanupDTMatch,
    readyMultiplePlayersAndStartGame,
    selectCharacter,
    setupDTOnlineMatchWithPlayers,
    waitForGameBoard,
} from '../helpers/dicethrone';
import { getGameServerBaseURL, waitForTestHarness } from '../helpers/common';
import { getMatchState, injectMatchState } from '../helpers/state-injection';

const EVIDENCE_DIR = join(
    process.cwd(),
    'test-results',
    'evidence-screenshots',
    'dicethrone',
    'skirmish-1v1v1-20261002',
);

const saveEvidence = async (page: Parameters<typeof waitForGameBoard>[0], fileName: string) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    const path = join(EVIDENCE_DIR, fileName);
    await page.screenshot({ path, fullPage: false, timeout: 10000 });
    return path;
};

const clearTransientState = (state: any, defenderId: string | null | undefined = undefined) => {
    const next = structuredClone(state);
    const turnOrder = Array.isArray(next.sys?.turnOrder)
        ? [...next.sys.turnOrder]
        : Array.isArray(next.core?.turnOrder)
            ? [...next.core.turnOrder]
            : Object.keys(next.core?.players ?? {});
    next.sys = {
        ...next.sys,
        turnOrder,
        phase: 'targetingRoll',
        flowHalted: false,
        currentPlayerIndex: 0,
        interaction: {
            ...(next.sys?.interaction ?? {}),
            current: undefined,
            queue: [],
            isBlocked: false,
        },
        responseWindow: {
            ...(next.sys?.responseWindow ?? {}),
            current: undefined,
        },
        gameover: undefined,
    };
    next.core = {
        ...next.core,
        activePlayerId: '0',
        currentPlayerIndex: 0,
        phase: 'targetingRoll',
        rollCount: 1,
        rollLimit: 1,
        rollDiceCount: 1,
        rollConfirmed: true,
        selectedAbilityId: 'fist-technique-5',
        pendingDamage: null,
        pendingBonusDiceSettlement: undefined,
        pendingAttack: {
            attackerId: '0',
            defenderId,
            targetingSelectionPending: false,
            targetingSelectionResolved: false,
            isDefendable: true,
            damage: 6,
            sourceAbilityId: 'fist-technique-5',
            defenseAbilityId: undefined,
            preDefenseResolved: false,
            bonusDamage: 0,
            attackModifierBonusDamage: 0,
            damageResolved: false,
            resolvedDamage: 0,
            offensiveRollEndTokenResolved: false,
            bonusDiceResolved: false,
        },
        dice: (Array.isArray(next.core?.dice) ? next.core.dice : []).map((die: any, index: number) => ({
            ...die,
            value: index === 0 ? 6 : die.value ?? 1,
            isKept: false,
            ownerId: '0',
        })),
    };
    return next;
};

const dispatchHarnessCommand = async (page: any, type: string, playerId: string, payload: Record<string, unknown> = {}) => {
    await page.evaluate(({ commandType, commandPlayerId, commandPayload }) => {
        (window as any).__BG_TEST_HARNESS__?.command?.dispatch?.({
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
        });
    }, { commandType: type, commandPlayerId: playerId, commandPayload: payload });
};

test.describe('DiceThrone 三人混战真实浏览器验收', () => {
    test('1v1v1 开局、双目标选择与目标确认画面通过', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 3,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或三人房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId, players } = setup;
            await selectCharacter(players[0].page, 'monk');
            await selectCharacter(players[1].page, 'barbarian');
            await selectCharacter(players[2].page, 'pyromancer');
            await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

            await Promise.all(players.map((player) => waitForGameBoard(player.page)));
            await Promise.all(players.map((player) => waitForTestHarness(player.page, 15000)));

            await expect(hostPage.locator('[data-testid^="dt-top-header-"][data-player-id]')).toHaveCount(2, { timeout: 10000 });
            await expect(hostPage.getByText('35', { exact: true }).first()).toBeVisible({ timeout: 10000 });
            await saveEvidence(hostPage, '01-三人混战-开局-三名玩家独立生命.png');

            const current = await getMatchState(matchId, hostPage);
            await injectMatchState(matchId, clearTransientState(current), hostPage);
            await hostPage.waitForTimeout(800);
            await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');

            await expect(hostPage.getByTestId('dt-defender-choice-panel')).toBeVisible({ timeout: 15000 });
            const options = hostPage.locator('[data-testid^="dt-defender-choice-option-"][data-player-id]');
            await expect(options).toHaveCount(2, { timeout: 10000 });
            await expect(hostPage.getByTestId('dt-defender-choice-option-1')).toBeVisible();
            await expect(hostPage.getByTestId('dt-defender-choice-option-2')).toBeVisible();
            await saveEvidence(hostPage, '02-三人混战-攻击者可选两名对手.png');

            await hostPage.getByTestId('dt-defender-choice-option-1').click();
            await expect.poll(async () => hostPage.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    phase: state?.sys?.phase ?? null,
                    defenderId: state?.core?.pendingAttack?.defenderId ?? null,
                };
            }), { timeout: 15000 }).toEqual({ phase: 'defensiveRoll', defenderId: '1' });

            await expect(hostPage.getByTestId('dt-defender-choice-panel')).toBeHidden({ timeout: 10000 });
            await expect(players[1].page.getByTestId('dicethrone-board-root')).toBeVisible({ timeout: 10000 });
            await saveEvidence(players[1].page, '03-三人混战-确认目标后进入防御.png');
        } finally {
            await cleanupDTMatch(setup);
        }
    });

    test('1v1v1 旧状态 defenderId=null 时点击结算攻击仍出现目标选择', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 3,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或三人房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId, players } = setup;
            await selectCharacter(players[0].page, 'tianshi');
            await selectCharacter(players[1].page, 'monk');
            await selectCharacter(players[2].page, 'barbarian');
            await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));
            await waitForGameBoard(hostPage);
            await waitForTestHarness(hostPage, 15000);

            const current = await getMatchState(matchId, hostPage);
            await injectMatchState(matchId, clearTransientState(current, null), hostPage);
            await hostPage.waitForTimeout(800);
            await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');

            await expect(hostPage.getByTestId('dt-defender-choice-panel')).toBeVisible({ timeout: 15000 });
            await expect(hostPage.locator('[data-testid^="dt-defender-choice-option-"][data-player-id]')).toHaveCount(2, { timeout: 10000 });
            await saveEvidence(hostPage, '04-三人混战-旧null目标状态仍可结算.png');
        } finally {
            await cleanupDTMatch(setup);
        }
    });
});
