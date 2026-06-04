import { describe, expect, it } from 'vitest';

import { DiceThroneDomain } from '../domain';
import type { PlayerId, RandomFn } from '../../../engine/types';
import { GameTestRunner } from '../../../engine/testing';
import { TOKEN_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import { executePipeline } from '../../../engine/pipeline';
import { createSimpleChoice } from '../../../engine/systems/InteractionSystem';
import {
    assertState,
    cmd,
    createHeroMatchup,
    createQueuedRandom,
    createInitializedState,
    interactionRespondCommandType,
    testSystems,
} from './test-utils';

describe('ninja slash vs samurai stand tall regression', () => {
    it('slash-2-4 在 stand-tall 防御后的 ADVANCE_PHASE 不应抛出 dice.map 异常', () => {
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random: createQueuedRandom([2, 2, 2, 3, 6, 6, 6, 1, 1]),
            setup: createHeroMatchup('ninja', 'samurai', (core) => {
                core.players['0'].resources[RESOURCE_IDS.CP] = 0;
                core.players['1'].resources[RESOURCE_IDS.CP] = 0;
            }) as (playerIds: PlayerId[], random: RandomFn) => any,
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: 'ninja slash-2-4 vs samurai stand-tall defensive advance regression',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('RESPONSE_PASS', '0'),
                cmd('RESPONSE_PASS', '1'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'slash-2-4' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd(interactionRespondCommandType, '0', { optionId: 'option-1' }),
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('RESPONSE_PASS', '0'),
                cmd('RESPONSE_PASS', '1'),
                cmd('SELECT_ABILITY', '1', { abilityId: 'stand-tall' }),
                cmd('ADVANCE_PHASE', '1'),
            ],
            expect: {
                turnPhase: 'main2',
                pendingInteraction: null,
            },
        });

        expect(result.assertionErrors).toEqual([]);
        expect(result.finalState.sys.phase).toBe('main2');
        expect(result.finalState.core.pendingAttack).toBeNull();
    });

    it('最小 defensiveRoll 夹具执行 ADVANCE_PHASE 时不应抛出 dice.map 异常', () => {
        const playerIds: PlayerId[] = ['0', '1'];
        const random = createQueuedRandom([1]);
        const state = createInitializedState(playerIds, random);

        state.sys.phase = 'defensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollDiceCount = 3;
        state.core.rollConfirmed = true;
        state.core.activatingAbilityId = 'stand-tall';
        state.core.selectedCharacters['0'] = 'ninja' as any;
        state.core.selectedCharacters['1'] = 'samurai' as any;
        state.core.dice = [
            { id: 0, definitionId: 'samurai-dice', value: 6, symbol: 'rising_sun', symbols: ['rising_sun'], isKept: false },
            { id: 1, definitionId: 'samurai-dice', value: 6, symbol: 'rising_sun', symbols: ['rising_sun'], isKept: false },
            { id: 2, definitionId: 'samurai-dice', value: 6, symbol: 'rising_sun', symbols: ['rising_sun'], isKept: false },
            { id: 3, definitionId: 'samurai-dice', value: 1, symbol: 'katana', symbols: ['katana'], isKept: false },
            { id: 4, definitionId: 'samurai-dice', value: 1, symbol: 'katana', symbols: ['katana'], isKept: false },
        ];
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash-2-4',
            defenseAbilityId: 'stand-tall',
            isDefendable: true,
            damage: 6,
            preDefenseResolved: true,
            defenseResolved: false,
            damageResolved: false,
            attackDiceValues: [3, 2, 2, 6, 1],
            attackDiceFaceCounts: {
                ninja_katana: 4,
                shuriken: 0,
                mask: 1,
            },
        };

        const result = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            { ...cmd('ADVANCE_PHASE', '1'), timestamp: Date.now() } as any,
            random,
            playerIds,
        );

        expect(result.success).toBe(true);
        if (!result.success) {
            expect(result.error?.message).not.toContain('dice.map');
            return;
        }
        expect(result.state.sys.phase).toBe('main2');
    });

    it('旧 pendingBonusDiceSettlement 脏 dice shape 下跳过奖励骰结算不应因 reduce/map 崩溃', () => {
        const playerIds: PlayerId[] = ['0', '1'];
        const random = createQueuedRandom([1]);
        const state = createInitializedState(playerIds, random);

        state.core.pendingBonusDiceSettlement = {
            id: 'legacy-settlement',
            sourceAbilityId: 'ninja-going-forward-2',
            attackerId: '0',
            targetId: '1',
            dice: { legacy: true } as any,
            rerollCostTokenId: TOKEN_IDS.NINJUTSU,
            rerollCostAmount: 0,
            rerollCount: 0,
            maxRerollCount: 1,
            readyToSettle: false,
        } as any;

        const skipResult = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            { ...cmd('SKIP_BONUS_DICE_REROLL', '0'), timestamp: Date.now() } as any,
            random,
            playerIds,
        );

        expect(skipResult.success).toBe(true);

        const rerollResult = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            { ...cmd('REROLL_BONUS_DIE', '0', { dieIndex: 0 }), timestamp: Date.now() } as any,
            random,
            playerIds,
        );

        expect(rerollResult.success).toBe(false);
        if (!rerollResult.success) {
            expect(rerollResult.error).toBe('invalid_die_index');
        }
    });

    it('slash-2-4 在 still-wet-behind-ears 防御后的忍术选择收口不应因 auto-continue 抛出 dice.map 异常', () => {
        const playerIds: PlayerId[] = ['0', '1'];
        const random = createQueuedRandom([1]);
        const state = createHeroMatchup('cursed_pirate', 'ninja')(
            playerIds,
            random,
            ) as ReturnType<ReturnType<typeof createHeroMatchup>>;

        state.sys.phase = 'defensiveRoll';
        state.sys.flowHalted = true;
        state.core.activePlayerId = '1';
        state.core.rollCount = 1;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.activatingAbilityId = 'still-wet-behind-ears';
        state.core.currentChoiceSourceAbilityId = 'slash-2-4';
        state.core.dice = [
            { id: 0, definitionId: 'cursed-pirate-dice', value: 1, symbol: 'cutlass', symbols: ['cutlass'], isKept: false },
            { id: 1, definitionId: 'cursed-pirate-dice', value: 2, symbol: 'loot', symbols: ['loot'], isKept: false },
            { id: 2, definitionId: 'cursed-pirate-dice', value: 3, symbol: 'skull', symbols: ['skull'], isKept: false },
            { id: 3, definitionId: 'cursed-pirate-dice', value: 1, symbol: 'cutlass', symbols: ['cutlass'], isKept: false },
            { id: 4, definitionId: 'cursed-pirate-dice', value: 3, symbol: 'skull', symbols: ['skull'], isKept: false },
        ] as any;
        state.core.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'slash-2-4',
            defenseAbilityId: 'still-wet-behind-ears',
            isDefendable: true,
            damage: 6,
            preDefenseResolved: true,
            defenseResolved: true,
            damageResolved: true,
            resolvedDamage: 7,
            bonusDamage: 1,
            extraRoll: { value: 6, resolved: true },
            attackDiceValues: [1, 4, 1, 1, 3],
            attackDiceFaceCounts: {
                ninja_katana: 3,
                shuriken: 1,
                mask: 1,
            },
        } as any;
        state.core.pendingBonusDiceSettlement = {
            id: 'slash-2-4-display-only-bonus',
            sourceAbilityId: 'slash-2-4',
            attackerId: '1',
            targetId: '1',
            dice: [{
                index: 0,
                value: 1,
                face: 'ninja_katana',
                effectKey: 'bonusDie.effect.ninjaNinjutsu',
                effectParams: { value: 1, bonusDamage: 1 },
            }],
            displayOnly: true,
            rerollCount: 0,
            readyToSettle: false,
        } as any;
        state.sys.interaction.current = createSimpleChoice(
            'choice-slash-2-4-1780306943689',
            '1',
            'choices.ninjaNinjutsu.title',
            [
                {
                    id: 'option-0',
                    label: 'choices.ninjaNinjutsu.poison',
                    value: { value: 1, customId: 'ninja-ninjutsu-poison', labelKey: 'choices.ninjaNinjutsu.poison' },
                },
                {
                    id: 'option-1',
                    label: 'choices.ninjaNinjutsu.undefendable',
                    value: { value: 1, customId: 'ninja-ninjutsu-undefendable', labelKey: 'choices.ninjaNinjutsu.undefendable' },
                },
            ],
            'slash-2-4',
        );

        const result = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            { ...cmd(interactionRespondCommandType, '1', { optionId: 'option-0' }), timestamp: Date.now() } as any,
            random,
            playerIds,
        );

        expect(result.success).toBe(true);
        if (!result.success) {
            expect(result.error?.message).not.toContain('dice.map');
            return;
        }
        expect(result.state.core.pendingAttack).toBeNull();
    });

});
