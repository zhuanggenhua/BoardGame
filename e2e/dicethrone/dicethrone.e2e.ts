import { test, expect } from '../framework';
import type { MatchState } from '../src/engine/types';
import { STATUS_IDS } from '../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../src/games/dicethrone/domain/resources';
import type { DiceThroneCore } from '../src/games/dicethrone/types';
import {
    dispatchDiceThroneCommand,
    getDiceThroneUi,
    patchDiceThroneHarnessState,
    readDiceThroneHarnessState,
    waitForDiceThronePhase,
} from '../helpers/dicethrone';

const DICETHRONE_OPEN_TIMEOUT_MS = 180000;
const DICETHRONE_TEST_TIMEOUT_MS = 120000;
type DiceThroneMatchState = MatchState<DiceThroneCore>;

test.describe('DiceThrone 核心 E2E', () => {
    test('main flow: moon elf reaches defensive roll', async ({ page, game }, testInfo) => {
        test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

        await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'moon_elf', '1': 'barbarian' },
                hostStarted: true,
                rollCount: 1,
                rollConfirmed: true,
                dice: [
                    { id: 0, value: 1, isKept: false },
                    { id: 1, value: 1, isKept: false },
                    { id: 2, value: 1, isKept: false },
                    { id: 3, value: 1, isKept: false },
                    { id: 4, value: 1, isKept: false },
                ],
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    isDefendable: true,
                    sourceAbilityId: 'longbow-5-1',
                    damage: 7,
                    bonusDamage: 0,
                    attackModifierBonusDamage: 0,
                    damageResolved: false,
                    resolvedDamage: 0,
                    preDefenseResolved: true,
                    offensiveRollEndTokenResolved: true,
                },
            },
        });

        await waitForDiceThronePhase(page, 'offensiveRoll');
        const ui = getDiceThroneUi(page);
        await expect(ui.handArea).toBeVisible({ timeout: 10000 });
        await dispatchDiceThroneCommand(page, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: {},
        });

        await waitForDiceThronePhase(page, 'defensiveRoll', 15000);

        const state = await readDiceThroneHarnessState<DiceThroneMatchState>(page);
        expect(state.sys.phase).toBe('defensiveRoll');
        expect(state.core.pendingAttack?.attackerId).toBe('0');
        expect(state.core.pendingAttack?.defenderId).toBe('1');
        expect(state.core.pendingAttack?.sourceAbilityId).toBe('longbow-5-1');
        expect(state.core.pendingAttack?.damage).toBe(7);

        await game.screenshot('01-main-flow-defensive-roll', testInfo);
    });

    test('regression: targeted adds 2 damage and persists', async ({ page, game }, testInfo) => {
        test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

        await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'moon_elf', '1': 'barbarian' },
                hostStarted: true,
                rollCount: 1,
                rollConfirmed: true,
                dice: [
                    { id: 0, value: 1, isKept: false },
                    { id: 1, value: 1, isKept: false },
                    { id: 2, value: 1, isKept: false },
                    { id: 3, value: 4, isKept: false },
                    { id: 4, value: 5, isKept: false },
                ],
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    isDefendable: false,
                    sourceAbilityId: 'longbow-3-1',
                    damage: 3,
                    bonusDamage: 0,
                    attackModifierBonusDamage: 0,
                    damageResolved: false,
                    resolvedDamage: 0,
                    preDefenseResolved: true,
                    offensiveRollEndTokenResolved: true,
                },
            },
        });

        await patchDiceThroneHarnessState(page, {
            core: {
                players: {
                    '1': {
                        statusEffects: {
                            [STATUS_IDS.TARGETED]: 1,
                        },
                    },
                },
            },
        });

        await waitForDiceThronePhase(page, 'offensiveRoll');

        const beforeState = await readDiceThroneHarnessState<DiceThroneMatchState>(page);
        expect(beforeState.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(50);
        expect(beforeState.core.players['1'].statusEffects[STATUS_IDS.TARGETED]).toBe(1);

        await dispatchDiceThroneCommand(page, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: {},
        });

        await page.waitForFunction(
            () => {
                const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.sys?.phase === 'main2' && state?.core?.players?.['1']?.resources?.hp === 45;
            },
            { timeout: 15000, polling: 200 },
        );

        const afterState = await readDiceThroneHarnessState<DiceThroneMatchState>(page);
        expect(afterState.sys.phase).toBe('main2');
        expect(afterState.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(45);
        expect(afterState.core.players['1'].statusEffects[STATUS_IDS.TARGETED]).toBe(1);

        await game.screenshot('02-targeted-damage-regression', testInfo);
    });

    test('ui stability: die lock toggle syncs state', async ({ page, game }, testInfo) => {
        test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

        await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'moon_elf', '1': 'barbarian' },
                hostStarted: true,
                rollCount: 1,
                rollConfirmed: false,
                dice: [
                    { id: 0, value: 1, isKept: false },
                    { id: 1, value: 2, isKept: false },
                    { id: 2, value: 3, isKept: false },
                    { id: 3, value: 4, isKept: false },
                    { id: 4, value: 5, isKept: false },
                ],
            },
        });

        await waitForDiceThronePhase(page, 'offensiveRoll');
        const ui = getDiceThroneUi(page);
        const firstDieButton = ui.dieButton(0);

        await expect(firstDieButton).toHaveAttribute('data-clickable', 'true', { timeout: 10000 });
        await firstDieButton.click();

        await page.waitForFunction(
            () => (window as Window).__BG_TEST_HARNESS__?.state?.get?.()?.core?.dice?.[0]?.isKept === true,
            { timeout: 10000, polling: 200 },
        );

        const lockedState = await readDiceThroneHarnessState<DiceThroneMatchState>(page);
        expect(lockedState.core.dice[0].isKept).toBe(true);

        await game.screenshot('03-dice-lock-state', testInfo);

        await firstDieButton.click();

        await page.waitForFunction(
            () => (window as Window).__BG_TEST_HARNESS__?.state?.get?.()?.core?.dice?.[0]?.isKept === false,
            { timeout: 10000, polling: 200 },
        );

        const unlockedState = await readDiceThroneHarnessState<DiceThroneMatchState>(page);
        expect(unlockedState.core.dice[0].isKept).toBe(false);
    });
});
