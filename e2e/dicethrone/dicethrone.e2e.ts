import { test, expect } from '../framework';
import type { MatchState } from '../../src/engine/types';
import { STATUS_IDS, TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { buildHeroAbilitiesForFace } from '../../src/games/dicethrone/domain/characters';
import type { DiceThroneCore } from '../../src/games/dicethrone/types';
import {
    dispatchDiceThroneCommand,
    getDiceThroneUi,
    patchDiceThroneHarnessState,
    readDiceThroneHarnessState,
    setDiceThroneDiceValues,
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

    test('regression: 武僧连段冲拳②两颗太极奖励骰结算为5伤害加4太极', async ({ page, game }, testInfo) => {
        test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

        await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'monk' },
                hostStarted: true,
            },
        });

        await patchDiceThroneHarnessState(page, {
            core: {
                players: {
                    '0': {
                        abilityLevels: {
                            'taiji-combo': 2,
                        },
                        abilities: buildHeroAbilitiesForFace('monk', undefined, {
                            'fist-technique': 1,
                            'zen-forget': 1,
                            harmony: 1,
                            'lotus-palm': 1,
                            'taiji-combo': 2,
                            'thunder-strike': 1,
                            'calm-water': 1,
                            meditation: 1,
                        }),
                    },
                },
            },
        });

        await waitForDiceThronePhase(page, 'main1');
        await dispatchDiceThroneCommand(page, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: {},
        });
        await waitForDiceThronePhase(page, 'offensiveRoll');

        await setDiceThroneDiceValues(page, [1, 1, 1, 3, 4]);
        await dispatchDiceThroneCommand(page, {
            type: 'ROLL_DICE',
            playerId: '0',
            payload: {},
        });
        await dispatchDiceThroneCommand(page, {
            type: 'CONFIRM_ROLL',
            playerId: '0',
            payload: {},
        });
        await dispatchDiceThroneCommand(page, {
            type: 'SELECT_ABILITY',
            playerId: '0',
            payload: { abilityId: 'taiji-combo' },
        });

        const selectedState = await readDiceThroneHarnessState<DiceThroneMatchState>(page);
        expect(selectedState.core.pendingAttack?.attackerId).toBe('0');
        expect(selectedState.core.pendingAttack?.defenderId).toBe('1');
        expect(selectedState.core.pendingAttack?.sourceAbilityId).toBe('taiji-combo');

        await dispatchDiceThroneCommand(page, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: {},
        });
        await waitForDiceThronePhase(page, 'defensiveRoll');

        await setDiceThroneDiceValues(page, [1, 1, 1, 1]);
        await dispatchDiceThroneCommand(page, {
            type: 'ROLL_DICE',
            playerId: '1',
            payload: {},
        });
        await dispatchDiceThroneCommand(page, {
            type: 'CONFIRM_ROLL',
            playerId: '1',
            payload: {},
        });
        await dispatchDiceThroneCommand(page, {
            type: 'SELECT_ABILITY',
            playerId: '1',
            payload: { abilityId: 'meditation' },
        });

        await setDiceThroneDiceValues(page, [4, 5]);
        await dispatchDiceThroneCommand(page, {
            type: 'ADVANCE_PHASE',
            playerId: '1',
            payload: {},
        });

        await page.waitForFunction(
            () => {
                const state = window.__BG_TEST_HARNESS__?.state?.get?.();
                return state?.sys?.phase === 'main2'
                    && state?.core?.players?.['1']?.resources?.hp === 45
                    && state?.core?.players?.['0']?.tokens?.taiji === 4;
            },
            { timeout: 15000, polling: 200 },
        );

        const finalState = await readDiceThroneHarnessState<DiceThroneMatchState>(page);
        expect(finalState.sys.phase).toBe('main2');
        expect(finalState.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(45);
        expect(finalState.core.players['0'].tokens[TOKEN_IDS.TAIJI]).toBe(4);
        expect(finalState.core.players['0'].tokens[TOKEN_IDS.PURIFY] ?? 0).toBe(0);
        expect(finalState.core.players['0'].tokens[TOKEN_IDS.EVASIVE] ?? 0).toBe(0);
        expect(finalState.sys.interaction?.current).toBeFalsy();

        const finalEvents = finalState.sys.eventStream?.entries.map(entry => entry.event) ?? [];
        const taijiBonusDice = finalEvents
            .filter(event => event.type === 'BONUS_DIE_ROLLED' && event.payload.playerId === '0')
            .map(event => event.payload);
        expect(taijiBonusDice).toEqual(expect.arrayContaining([
            expect.objectContaining({ value: 4, face: 'taiji' }),
            expect.objectContaining({ value: 5, face: 'taiji' }),
        ]));
        expect(finalEvents).toContainEqual(expect.objectContaining({
            type: 'DAMAGE_DEALT',
            payload: expect.objectContaining({
                targetId: '1',
                amount: 5,
                actualDamage: 5,
                sourceAbilityId: 'taiji-combo',
            }),
        }));

        await game.screenshot('04-武僧连段冲拳二-两颗太极结算后', testInfo);
    });
});
