import { describe, expect, it } from 'vitest';
import type { DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { reduce } from '../domain/reducer';
import { createDiceThroneEventSystem } from '../domain/systems';
import { TOKEN_IDS } from '../domain/ids';
import { createHeroMatchup, createQueuedRandom } from './test-utils';

const extractNextEvents = (
    state: { core: DiceThroneCore; sys: Record<string, unknown> },
    events: DiceThroneEvent[],
    random = createQueuedRandom([6]),
): DiceThroneEvent[] => {
    const system = createDiceThroneEventSystem();
    const result = system.afterEvents?.({ state, events, random } as any);
    if (!result || Array.isArray(result) || !('events' in result)) {
        return [];
    }
    return (result.events ?? []) as DiceThroneEvent[];
};

const runAfterEvents = (
    state: { core: DiceThroneCore; sys: Record<string, unknown> },
    events: DiceThroneEvent[],
    random = createQueuedRandom([6]),
): { state: { core: DiceThroneCore; sys: Record<string, unknown> }; events: DiceThroneEvent[] } => {
    const system = createDiceThroneEventSystem();
    const result = system.afterEvents?.({ state, events, random } as any);
    if (!result || Array.isArray(result) || !('state' in result)) {
        return { state, events: [] };
    }
    return {
        state: (result.state ?? state) as { core: DiceThroneCore; sys: Record<string, unknown> },
        events: (result.events ?? []) as DiceThroneEvent[],
    };
};

const setChoiceAnchor = (core: DiceThroneCore, sourceAbilityId: string): void => {
    core.activatingAbilityId = sourceAbilityId;
    core.currentChoiceSourceAbilityId = sourceAbilityId;
};

describe('DiceThrone choice handler anchor contract', () => {
    it('同一批两个 CHOICE_REQUESTED 时，当前 choice 锚点必须跟当前交互而不是队列尾部对齐', () => {
        const state = createHeroMatchup('monk', 'treant')(['0', '1'], createQueuedRandom([1]));
        const events: DiceThroneEvent[] = [
            {
                type: 'CHOICE_REQUESTED',
                payload: {
                    playerId: '0',
                    sourceAbilityId: 'first-choice',
                    titleKey: 'choices.first',
                    options: [{ value: 0, customId: 'first-choice-option' }],
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: 100,
            } as DiceThroneEvent,
            {
                type: 'CHOICE_REQUESTED',
                payload: {
                    playerId: '0',
                    sourceAbilityId: 'second-choice',
                    titleKey: 'choices.second',
                    options: [{ value: 0, customId: 'second-choice-option' }],
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: 101,
            } as DiceThroneEvent,
        ];

        const reducedCore = events.reduce((core, event) => reduce(core, event), state.core);
        const afterEvents = runAfterEvents({ ...state, core: reducedCore }, events);
        const current = afterEvents.state.sys.interaction.current as { kind?: string; data?: { sourceId?: string } } | undefined;
        const queue = (afterEvents.state.sys.interaction.queue as Array<{ data?: { sourceId?: string } }> | undefined) ?? [];

        expect(current?.kind).toBe('simple-choice');
        expect(current?.data?.sourceId).toBe('first-choice');
        expect(queue).toHaveLength(1);
        expect(queue[0]?.data?.sourceId).toBe('second-choice');
        expect(afterEvents.state.core.currentChoiceSourceAbilityId).toBe('first-choice');
    });

    it('select-target choice effect 应拒绝 source 正确但没有当前 choice 锚点的 CHOICE_RESOLVED', () => {
        const state = createHeroMatchup('monk', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'fist-technique-5',
            isDefendable: true,
            damage: 6,
            targetingSelectionPending: true,
        };

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                customId: 'select-target:0',
                value: 0,
                sourceAbilityId: 'fist-technique-5',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 98,
        } as DiceThroneEvent);

        expect(next.pendingAttack?.defenderId).toBe('1');
        expect(next.pendingAttack?.targetingSelectionPending).toBe(true);
        expect(next.pendingAttack?.targetingSelectionResolved).not.toBe(true);
    });

    it('select-target choice effect 在当前 choice 锚点存在时仍应正常生效', () => {
        const state = createHeroMatchup('monk', 'treant')(['0', '1'], createQueuedRandom([1]));
        setChoiceAnchor(state.core, 'fist-technique-5');
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'fist-technique-5',
            isDefendable: true,
            damage: 6,
            targetingSelectionPending: true,
        };

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                customId: 'select-target:0',
                value: 0,
                sourceAbilityId: 'fist-technique-5',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 99,
        } as DiceThroneEvent);

        expect(next.pendingAttack?.defenderId).toBe('0');
        expect(next.pendingAttack?.targetingSelectionPending).toBe(false);
        expect(next.pendingAttack?.targetingSelectionResolved).toBe(true);
        expect(next.activatingAbilityId).toBeUndefined();
    });

    it('pyromancer spend CP for FM 应拒绝 source 正确但没有当前 choice 锚点的 CHOICE_RESOLVED', () => {
        const state = createHeroMatchup('pyromancer', 'monk')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].resources.cp = 4;

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                customId: 'pyro-spend-cp-for-fm-confirmed',
                value: 2,
                sourceAbilityId: 'pyro-spend-cp-for-fm',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 99,
        } as DiceThroneEvent);

        expect(next.players['0'].resources.cp).toBe(4);
    });

    it('pyromancer spend CP for FM 在当前 choice 锚点存在时仍应正常生效', () => {
        const state = createHeroMatchup('pyromancer', 'monk')(['0', '1'], createQueuedRandom([1]));
        setChoiceAnchor(state.core, 'pyro-spend-cp-for-fm');
        state.core.players['0'].resources.cp = 4;

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                customId: 'pyro-spend-cp-for-fm-confirmed',
                value: 2,
                sourceAbilityId: 'pyro-spend-cp-for-fm',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 100,
        } as DiceThroneEvent);

        expect(next.players['0'].resources.cp).toBe(2);
        expect(next.activatingAbilityId).toBeUndefined();
    });

    it('offensiveRollEnd choice effect 应拒绝 source 正确但没有当前 choice 锚点的 CHOICE_RESOLVED', () => {
        const state = createHeroMatchup('gunslinger', 'monk')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.LOADED] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'showdown',
            isDefendable: true,
            damage: 6,
        };

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                customId: 'skip',
                value: 0,
                sourceAbilityId: 'showdown',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 100,
        } as DiceThroneEvent);

        expect(next.pendingAttack?.offensiveRollEndTokenResolved).not.toBe(true);
        expect(next.players['0'].tokens[TOKEN_IDS.LOADED]).toBe(1);
    });

    it('use-crit 应拒绝 source 正确但没有当前 choice 锚点的 CHOICE_RESOLVED', () => {
        const state = createHeroMatchup('paladin', 'monk')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.CRIT] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'holy-strike-large',
            isDefendable: true,
            damage: 8,
            bonusDamage: 0,
        };

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                tokenId: TOKEN_IDS.CRIT,
                value: 1,
                customId: 'use-crit',
                sourceAbilityId: 'holy-strike-large',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 100,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.CRIT]).toBe(1);
        expect(next.pendingAttack?.bonusDamage).toBe(0);
        expect(next.pendingAttack?.offensiveRollEndTokenResolved).not.toBe(true);
    });

    it('use-crit 在当前 choice 锚点存在时仍应正常生效', () => {
        const state = createHeroMatchup('paladin', 'monk')(['0', '1'], createQueuedRandom([1]));
        setChoiceAnchor(state.core, 'holy-strike-large');
        state.core.players['0'].tokens[TOKEN_IDS.CRIT] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'holy-strike-large',
            isDefendable: true,
            damage: 8,
            bonusDamage: 0,
        };

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                tokenId: TOKEN_IDS.CRIT,
                value: 1,
                customId: 'use-crit',
                sourceAbilityId: 'holy-strike-large',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 101,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.CRIT]).toBe(0);
        expect(next.pendingAttack?.bonusDamage).toBe(4);
        expect(next.pendingAttack?.offensiveRollEndTokenResolved).not.toBe(true);
        expect(next.activatingAbilityId).toBeUndefined();
    });

    it('use-accuracy 应拒绝 source 正确但没有当前 choice 锚点的 CHOICE_RESOLVED', () => {
        const state = createHeroMatchup('paladin', 'monk')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.ACCURACY] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'holy-strike-large',
            isDefendable: true,
            damage: 8,
            bonusDamage: 0,
        };

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                tokenId: TOKEN_IDS.ACCURACY,
                value: 1,
                customId: 'use-accuracy',
                sourceAbilityId: 'holy-strike-large',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 102,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.ACCURACY]).toBe(1);
        expect(next.pendingAttack?.isDefendable).toBe(true);
        expect(next.pendingAttack?.offensiveRollEndTokenResolved).not.toBe(true);
    });

    it('use-accuracy 在当前 choice 锚点存在时仍应正常生效', () => {
        const state = createHeroMatchup('paladin', 'monk')(['0', '1'], createQueuedRandom([1]));
        setChoiceAnchor(state.core, 'holy-strike-large');
        state.core.players['0'].tokens[TOKEN_IDS.ACCURACY] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'holy-strike-large',
            isDefendable: true,
            damage: 8,
            bonusDamage: 0,
        };

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                tokenId: TOKEN_IDS.ACCURACY,
                value: 1,
                customId: 'use-accuracy',
                sourceAbilityId: 'holy-strike-large',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 103,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.ACCURACY]).toBe(0);
        expect(next.pendingAttack?.isDefendable).toBe(false);
        expect(next.pendingAttack?.offensiveRollEndTokenResolved).not.toBe(true);
        expect(next.activatingAbilityId).toBeUndefined();
    });

    it('ninja choice followup 应拒绝 source 正确但没有当前 choice 锚点的 SYS_INTERACTION_RESOLVED', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash',
            isDefendable: true,
            damage: 6,
        };
        state.core.pendingDamage = {
            id: 'ninja-choice-anchor-missing',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 6,
            currentDamage: 6,
            sourceAbilityId: 'slash',
            responseType: 'beforeDamageDealt',
            responderId: '0',
            isFullyEvaded: false,
        };

        const nextEvents = extractNextEvents(state, [{
            type: 'SYS_INTERACTION_RESOLVED',
            payload: {
                interactionId: 'choice-slash-100',
                playerId: '0',
                optionId: 'option-0',
                value: { value: 1, customId: 'ninja-ninjutsu-poison' },
                sourceId: 'slash',
            },
            timestamp: 100,
        } as unknown as DiceThroneEvent]);

        expect(nextEvents.some(event => event.type === 'CHOICE_RESOLVED')).toBe(true);
        expect(nextEvents.some(event => event.type === 'BONUS_DAMAGE_ADDED')).toBe(false);
        expect(nextEvents.some(event => event.type === 'TOKEN_GRANTED' && event.payload.tokenId === TOKEN_IDS.DELAYED_POISON)).toBe(false);
    });

    it('ninja choice followup 在当前 choice 锚点存在时仍应正常生效', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        setChoiceAnchor(state.core, 'slash');
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash',
            isDefendable: true,
            damage: 6,
        };
        state.core.pendingDamage = {
            id: 'ninja-choice-anchor-present',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 6,
            currentDamage: 6,
            sourceAbilityId: 'slash',
            responseType: 'beforeDamageDealt',
            responderId: '0',
            isFullyEvaded: false,
        };

        const nextEvents = extractNextEvents(state, [{
            type: 'SYS_INTERACTION_RESOLVED',
            payload: {
                interactionId: 'choice-slash-101',
                playerId: '0',
                optionId: 'option-0',
                value: { value: 1, customId: 'ninja-ninjutsu-poison' },
                sourceId: 'slash',
            },
            timestamp: 101,
        } as unknown as DiceThroneEvent]);

        expect(nextEvents.some(event => event.type === 'CHOICE_RESOLVED')).toBe(true);
        expect(nextEvents.some(event => event.type === 'BONUS_DAMAGE_ADDED')).toBe(true);
        expect(nextEvents.some(event => event.type === 'TOKEN_GRANTED' && event.payload.tokenId === TOKEN_IDS.DELAYED_POISON)).toBe(true);
    });

    it('ninja choice followup 在真实 simple-choice 交互快照存在时可不依赖 core 锚点生效', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash',
            isDefendable: true,
            damage: 6,
        };
        state.core.pendingDamage = {
            id: 'ninja-choice-interaction-backed',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 6,
            currentDamage: 6,
            sourceAbilityId: 'slash',
            responseType: 'beforeDamageDealt',
            responderId: '0',
            isFullyEvaded: false,
        };

        const nextEvents = extractNextEvents(state, [{
            type: 'SYS_INTERACTION_RESOLVED',
            payload: {
                interactionId: 'choice-slash-101a',
                playerId: '0',
                optionId: 'option-0',
                value: { value: 1, customId: 'ninja-ninjutsu-poison' },
                sourceId: 'slash',
                interactionData: {
                    sourceId: 'slash',
                    options: [
                        {
                            id: 'option-0',
                            value: { value: 1, customId: 'ninja-ninjutsu-poison' },
                        },
                    ],
                },
            },
            timestamp: 101,
        } as unknown as DiceThroneEvent]);

        expect(nextEvents.some(event => event.type === 'CHOICE_RESOLVED')).toBe(true);
        expect(nextEvents.some(event => event.type === 'BONUS_DAMAGE_ADDED')).toBe(true);
        expect(nextEvents.some(event => event.type === 'TOKEN_GRANTED' && event.payload.tokenId === TOKEN_IDS.DELAYED_POISON)).toBe(true);
    });

    it('真实 simple-choice 交互快照存在时，通用 token 花费也应不依赖 core 锚点生效', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 2;

        const choiceValue = {
            tokenId: TOKEN_IDS.SYNTH,
            value: -1,
            customId: 'artificer-wrench-strike-spend-electricity',
        };
        const afterEvents = runAfterEvents(state, [{
            type: 'SYS_INTERACTION_RESOLVED',
            payload: {
                interactionId: 'choice-wrench-strike-2-4-120',
                playerId: '0',
                optionId: 'option-2',
                value: choiceValue,
                sourceId: 'wrench-strike-2-4',
                interactionData: {
                    sourceId: 'wrench-strike-2-4',
                    options: [
                        {
                            id: 'option-2',
                            value: choiceValue,
                        },
                    ],
                },
            },
            timestamp: 120,
        } as unknown as DiceThroneEvent]);

        const choiceResolved = afterEvents.events.find(event => event.type === 'CHOICE_RESOLVED');
        expect(choiceResolved).toBeTruthy();
        expect((choiceResolved as any)?.payload?.interactionBacked).toBe(true);

        const next = reduce(state.core, choiceResolved as DiceThroneEvent);
        expect(next.players['0'].tokens[TOKEN_IDS.SYNTH]).toBe(1);
    });

    it('ninja undefendable followup 应拒绝 source 正确但没有当前 choice 锚点的 SYS_INTERACTION_RESOLVED', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash',
            isDefendable: true,
            damage: 6,
        };

        const nextEvents = extractNextEvents(state, [{
            type: 'SYS_INTERACTION_RESOLVED',
            payload: {
                interactionId: 'choice-slash-101b',
                playerId: '0',
                optionId: 'option-1',
                value: { value: 1, customId: 'ninja-ninjutsu-undefendable' },
                sourceId: 'slash',
            },
            timestamp: 101,
        } as unknown as DiceThroneEvent]);

        expect(nextEvents.some(event => event.type === 'CHOICE_RESOLVED')).toBe(true);
        expect(nextEvents.some(event => event.type === 'BONUS_DAMAGE_ADDED')).toBe(false);
        expect(nextEvents.some(event => event.type === 'ATTACK_MADE_UNDEFENDABLE')).toBe(false);
    });

    it('ninja undefendable followup 在当前 choice 锚点存在时仍应正常生效', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        setChoiceAnchor(state.core, 'slash');
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'slash',
            isDefendable: true,
            damage: 6,
        };

        const nextEvents = extractNextEvents(state, [{
            type: 'SYS_INTERACTION_RESOLVED',
            payload: {
                interactionId: 'choice-slash-102b',
                playerId: '0',
                optionId: 'option-1',
                value: { value: 1, customId: 'ninja-ninjutsu-undefendable' },
                sourceId: 'slash',
            },
            timestamp: 102,
        } as unknown as DiceThroneEvent]);

        expect(nextEvents.some(event => event.type === 'CHOICE_RESOLVED')).toBe(true);
        expect(nextEvents.some(event => event.type === 'BONUS_DAMAGE_ADDED')).toBe(true);
        expect(nextEvents.some(event => event.type === 'ATTACK_MADE_UNDEFENDABLE')).toBe(true);
    });

    it('gunslinger Loaded followup 应拒绝 source 正确但没有当前 choice 锚点的 SYS_INTERACTION_RESOLVED', () => {
        const state = createHeroMatchup('gunslinger', 'monk')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.LOADED] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'showdown',
            isDefendable: true,
            damage: 6,
        };

        const nextEvents = extractNextEvents(state, [{
            type: 'SYS_INTERACTION_RESOLVED',
            payload: {
                interactionId: 'choice-showdown-102',
                playerId: '0',
                optionId: 'option-0',
                value: { tokenId: TOKEN_IDS.LOADED, value: 1, customId: 'use-loaded' },
                sourceId: 'showdown',
            },
            timestamp: 102,
        } as unknown as DiceThroneEvent]);

        expect(nextEvents.some(event => event.type === 'CHOICE_RESOLVED')).toBe(true);
        expect(nextEvents.some(event => event.type === 'BONUS_DIE_ROLLED')).toBe(false);
        expect(nextEvents.some(event => event.type === 'BONUS_DAMAGE_ADDED')).toBe(false);
    });

    it.each([
        { customId: 'gunslinger-duel-deal-3', amount: 3, interactionId: 'choice-duel-201' },
        { customId: 'gunslinger-duel-lose', amount: 1, interactionId: 'choice-duel-202' },
    ])('gunslinger duel damage followup $customId 应拒绝 source 正确但没有当前 choice 锚点的 SYS_INTERACTION_RESOLVED', ({ customId, amount, interactionId }) => {
        const state = createHeroMatchup('monk', 'gunslinger')(['0', '1'], createQueuedRandom([1]));
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'fist',
            isDefendable: true,
            damage: 6,
        };

        const nextEvents = extractNextEvents(state, [{
            type: 'SYS_INTERACTION_RESOLVED',
            payload: {
                interactionId,
                playerId: '1',
                optionId: 'option-0',
                value: { value: amount, customId },
                sourceId: 'duel',
            },
            timestamp: 201,
        } as unknown as DiceThroneEvent]);

        expect(nextEvents.some(event => event.type === 'CHOICE_RESOLVED')).toBe(true);
        expect(nextEvents.some(event => event.type === 'DAMAGE_DEALT')).toBe(false);
    });

    it.each([
        { customId: 'gunslinger-duel-deal-3', amount: 3, interactionId: 'choice-duel-203' },
        { customId: 'gunslinger-duel-lose', amount: 1, interactionId: 'choice-duel-204' },
    ])('gunslinger duel damage followup $customId 在当前 choice 锚点存在时仍应正常生效', ({ customId, amount, interactionId }) => {
        const state = createHeroMatchup('monk', 'gunslinger')(['0', '1'], createQueuedRandom([1]));
        setChoiceAnchor(state.core, 'duel');
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'fist',
            isDefendable: true,
            damage: 6,
        };

        const nextEvents = extractNextEvents(state, [{
            type: 'SYS_INTERACTION_RESOLVED',
            payload: {
                interactionId,
                playerId: '1',
                optionId: 'option-0',
                value: { value: amount, customId },
                sourceId: 'duel',
            },
            timestamp: 202,
        } as unknown as DiceThroneEvent]);

        expect(nextEvents.some(event => event.type === 'CHOICE_RESOLVED')).toBe(true);
        expect(nextEvents.some(event => event.type === 'DAMAGE_DEALT' && event.payload.amount === amount)).toBe(true);
    });

    it('gunslinger duel prevent-half followup 应拒绝 source 正确但没有当前 choice 锚点的 SYS_INTERACTION_RESOLVED', () => {
        const state = createHeroMatchup('monk', 'gunslinger')(['0', '1'], createQueuedRandom([1]));
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'fist',
            isDefendable: true,
            damage: 6,
        };

        const nextEvents = extractNextEvents(state, [{
            type: 'SYS_INTERACTION_RESOLVED',
            payload: {
                interactionId: 'choice-duel-205',
                playerId: '1',
                optionId: 'option-1',
                value: { value: 50, customId: 'gunslinger-duel-prevent-half' },
                sourceId: 'duel',
            },
            timestamp: 203,
        } as unknown as DiceThroneEvent]);

        expect(nextEvents.some(event => event.type === 'CHOICE_RESOLVED')).toBe(true);
        expect(nextEvents.some(event => event.type === 'DAMAGE_SHIELD_GRANTED')).toBe(false);
    });

    it('gunslinger duel prevent-half followup 在当前 choice 锚点存在时仍应正常生效', () => {
        const state = createHeroMatchup('monk', 'gunslinger')(['0', '1'], createQueuedRandom([1]));
        setChoiceAnchor(state.core, 'duel');
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'fist',
            isDefendable: true,
            damage: 6,
        };

        const nextEvents = extractNextEvents(state, [{
            type: 'SYS_INTERACTION_RESOLVED',
            payload: {
                interactionId: 'choice-duel-206',
                playerId: '1',
                optionId: 'option-1',
                value: { value: 50, customId: 'gunslinger-duel-prevent-half' },
                sourceId: 'duel',
            },
            timestamp: 204,
        } as unknown as DiceThroneEvent]);

        expect(nextEvents.some(event => event.type === 'CHOICE_RESOLVED')).toBe(true);
        expect(nextEvents.some(event => event.type === 'DAMAGE_SHIELD_GRANTED' && event.payload.reductionPercent === 50)).toBe(true);
    });

    it('monk lotus palm 应拒绝 source 正确但没有当前 choice 锚点的 CHOICE_RESOLVED', () => {
        const state = createHeroMatchup('monk', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 3;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'lotus-palm',
            isDefendable: true,
            damage: 5,
        };

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                tokenId: TOKEN_IDS.TAIJI,
                value: -2,
                customId: 'lotus-palm-unblockable-pay',
                sourceAbilityId: 'lotus-palm',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 103,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TAIJI]).toBe(3);
        expect(next.pendingAttack?.isDefendable).toBe(true);
        expect(next.pendingAttack?.offensiveRollEndTokenResolved).not.toBe(true);
    });

    it('仅有 activatingAbilityId 但没有真实 CHOICE_REQUESTED 锚点时也应拒绝 forged CHOICE_RESOLVED', () => {
        const state = createHeroMatchup('monk', 'treant')(['0', '1'], createQueuedRandom([1]));
        state.core.activatingAbilityId = 'lotus-palm';
        state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 3;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'lotus-palm',
            isDefendable: true,
            damage: 5,
        };

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                tokenId: TOKEN_IDS.TAIJI,
                value: -2,
                customId: 'lotus-palm-unblockable-pay',
                sourceAbilityId: 'lotus-palm',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 103,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TAIJI]).toBe(3);
        expect(next.pendingAttack?.isDefendable).toBe(true);
        expect(next.pendingAttack?.offensiveRollEndTokenResolved).not.toBe(true);
    });

    it('monk lotus palm 在当前 choice 锚点存在时仍应正常生效', () => {
        const state = createHeroMatchup('monk', 'treant')(['0', '1'], createQueuedRandom([1]));
        setChoiceAnchor(state.core, 'lotus-palm');
        state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 3;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'lotus-palm',
            isDefendable: true,
            damage: 5,
        };

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                tokenId: TOKEN_IDS.TAIJI,
                value: -2,
                customId: 'lotus-palm-unblockable-pay',
                sourceAbilityId: 'lotus-palm',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 104,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.TAIJI]).toBe(1);
        expect(next.pendingAttack?.isDefendable).toBe(false);
        expect(next.pendingAttack?.offensiveRollEndTokenResolved).toBe(true);
        expect(next.activatingAbilityId).toBeUndefined();
    });

    it('monk meditation3 的无 customId token 选择应拒绝 source 正确但没有当前 choice 锚点的 CHOICE_RESOLVED', () => {
        const state = createHeroMatchup('monk', 'treant')(['0', '1'], createQueuedRandom([1]));

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                tokenId: TOKEN_IDS.EVASIVE,
                value: 1,
                sourceAbilityId: 'meditation-3',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 105,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.EVASIVE] ?? 0).toBe(0);
    });

    it('monk meditation3 的无 customId token 选择在当前 choice 锚点存在时仍应正常生效', () => {
        const state = createHeroMatchup('monk', 'treant')(['0', '1'], createQueuedRandom([1]));
        setChoiceAnchor(state.core, 'meditation-3');

        const next = reduce(state.core, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                tokenId: TOKEN_IDS.EVASIVE,
                value: 1,
                sourceAbilityId: 'meditation-3',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 106,
        } as DiceThroneEvent);

        expect(next.players['0'].tokens[TOKEN_IDS.EVASIVE] ?? 0).toBe(1);
        expect(next.activatingAbilityId).toBeUndefined();
    });

    it('INTERACTION_CANCELLED 后旧 choice 锚点不应再被 forged CHOICE_RESOLVED 复用', () => {
        const state = createHeroMatchup('monk', 'treant')(['0', '1'], createQueuedRandom([1]));
        setChoiceAnchor(state.core, 'lotus-palm');
        state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 3;

        const cancelled = reduce(state.core, {
            type: 'INTERACTION_CANCELLED',
            payload: {
                playerId: '0',
                sourceCardId: '',
                cpCost: 0,
                interactionId: 'choice-lotus-palm-200',
            },
            sourceCommandType: 'SYS_INTERACTION_CANCEL',
            timestamp: 200,
        } as DiceThroneEvent);

        expect(cancelled.activatingAbilityId).toBeUndefined();

        const forgedAfterCancel = reduce(cancelled, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                tokenId: TOKEN_IDS.TAIJI,
                value: -2,
                customId: 'lotus-palm-unblockable-pay',
                sourceAbilityId: 'lotus-palm',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 201,
        } as DiceThroneEvent);

        expect(forgedAfterCancel.players['0'].tokens[TOKEN_IDS.TAIJI]).toBe(3);
    });

    it('SYS_INTERACTION_EXPIRED 后旧 choice 锚点不应再被 forged CHOICE_RESOLVED 复用', () => {
        const state = createHeroMatchup('monk', 'treant')(['0', '1'], createQueuedRandom([1]));
        setChoiceAnchor(state.core, 'lotus-palm');
        state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 3;

        const expiredEvents = extractNextEvents(state, [{
            type: 'SYS_INTERACTION_EXPIRED',
            payload: {
                interactionId: 'choice-lotus-palm-300',
                playerId: '0',
                sourceId: 'lotus-palm',
            },
            timestamp: 300,
        } as unknown as DiceThroneEvent]);

        const expiredCancel = expiredEvents.find(event => event.type === 'INTERACTION_CANCELLED');
        expect(expiredCancel).toBeTruthy();

        const expiredState = reduce(state.core, expiredCancel as DiceThroneEvent);
        expect(expiredState.activatingAbilityId).toBeUndefined();

        const forgedAfterExpire = reduce(expiredState, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                tokenId: TOKEN_IDS.TAIJI,
                value: -2,
                customId: 'lotus-palm-unblockable-pay',
                sourceAbilityId: 'lotus-palm',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 301,
        } as DiceThroneEvent);

        expect(forgedAfterExpire.players['0'].tokens[TOKEN_IDS.TAIJI]).toBe(3);
    });

    it('SYS_INTERACTION_FORCE_UNLOCKED 后旧 choice 锚点不应再被 forged CHOICE_RESOLVED 复用', () => {
        const state = createHeroMatchup('monk', 'treant')(['0', '1'], createQueuedRandom([1]));
        setChoiceAnchor(state.core, 'lotus-palm');
        state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 3;

        const unlockedEvents = extractNextEvents(state, [{
            type: 'SYS_INTERACTION_FORCE_UNLOCKED',
            payload: {
                interactionId: 'choice-lotus-palm-400',
                playerId: '0',
                queueLength: 0,
            },
            timestamp: 400,
        } as unknown as DiceThroneEvent]);

        const forceUnlockCancel = unlockedEvents.find(event => event.type === 'INTERACTION_CANCELLED');
        expect(forceUnlockCancel).toBeTruthy();

        const unlockedState = reduce(state.core, forceUnlockCancel as DiceThroneEvent);
        expect(unlockedState.activatingAbilityId).toBeUndefined();

        const forgedAfterForceUnlock = reduce(unlockedState, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                tokenId: TOKEN_IDS.TAIJI,
                value: -2,
                customId: 'lotus-palm-unblockable-pay',
                sourceAbilityId: 'lotus-palm',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 401,
        } as DiceThroneEvent);

        expect(forgedAfterForceUnlock.players['0'].tokens[TOKEN_IDS.TAIJI]).toBe(3);
    });
});
