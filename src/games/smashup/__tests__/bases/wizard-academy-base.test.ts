import { beforeAll, describe, expect, it } from 'vitest';
import {
    getInteractionsFromResult,
    initAllAbilities,
    makeState,
    triggerBaseAbility,
    triggerBaseAbilityWithMS,
} from './base-contract-helpers';
import { SU_EVENTS } from '../../domain/types';
import {
    getFirstPrompt,
    getPromptHandlerData,
    getPromptOptions,
    getPromptPlayerId,
    getPromptSourceId,
    respondToPrompt,
} from '../helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('base_wizard_academy 巫师学院 afterScoring', () => {
    it('基地牌库有牌时生成重排交互并暴露顶部三张上下文', () => {
        const result = triggerBaseAbilityWithMS('base_wizard_academy', 'afterScoring', {
            state: makeState({
                bases: [{ defId: 'base_wizard_academy', minions: [], ongoingActions: [] }],
                baseDeck: ['base_a', 'base_b', 'base_c', 'base_d'],
            }),
            baseIndex: 0,
            baseDefId: 'base_wizard_academy',
            playerId: '0',
            rankings: [{ playerId: '0', power: 5, vp: 3 }],
            now: 0,
        });

        const prompt = getInteractionsFromResult(result)[0];
        expect(result.events).toHaveLength(0);
        expect(prompt).toBeDefined();
        expect(getPromptSourceId(prompt)).toBe('base_wizard_academy');
        expect(getPromptPlayerId(prompt)).toBe('0');

        const topCards = getPromptHandlerData(prompt).continuationContext.topCards;
        expect(topCards).toEqual(['base_a', 'base_b', 'base_c']);
    });

    it('基地牌库只有一张牌时也能触发', () => {
        const result = triggerBaseAbilityWithMS('base_wizard_academy', 'afterScoring', {
            state: makeState({
                bases: [{ defId: 'base_wizard_academy', minions: [], ongoingActions: [] }],
                baseDeck: ['base_x'],
            }),
            baseIndex: 0,
            baseDefId: 'base_wizard_academy',
            playerId: '0',
            rankings: [{ playerId: '0', power: 5, vp: 3 }],
            now: 0,
        });

        expect(getInteractionsFromResult(result)).toHaveLength(1);
    });

    it('基地牌库为空时不触发', () => {
        const result = triggerBaseAbility('base_wizard_academy', 'afterScoring', {
            state: makeState({
                bases: [{ defId: 'base_wizard_academy', minions: [], ongoingActions: [] }],
                baseDeck: [],
            }),
            baseIndex: 0,
            baseDefId: 'base_wizard_academy',
            playerId: '0',
            rankings: [{ playerId: '0', power: 5, vp: 3 }],
            now: 0,
        });

        expect(result.events).toHaveLength(0);
    });

    it('先选择替换基地，再为剩余基地提供排序交互', () => {
        const result = triggerBaseAbilityWithMS('base_wizard_academy', 'afterScoring', {
            state: makeState({
                bases: [{ defId: 'base_wizard_academy', minions: [], ongoingActions: [] }],
                baseDeck: ['base_a', 'base_b', 'base_c', 'base_d'],
            }),
            baseIndex: 0,
            baseDefId: 'base_wizard_academy',
            playerId: '0',
            rankings: [{ playerId: '0', power: 5, vp: 3 }],
            now: 0,
        });

        const firstPrompt = getInteractionsFromResult(result)[0];
        const chooseReplacement = getPromptOptions(firstPrompt).find((option: any) => option.value?.defId === 'base_c');
        expect(chooseReplacement).toBeDefined();

        const pickedReplacement = respondToPrompt(result.matchState!, chooseReplacement.id, '0');
        expect(pickedReplacement.success).toBe(true);

        const orderPrompt = getFirstPrompt(pickedReplacement.finalState);
        expect(getPromptSourceId(orderPrompt)).toBe('base_wizard_academy');
        expect(getPromptOptions(orderPrompt).map((option: any) => option.value?.defId)).toEqual(
            expect.arrayContaining(['base_a', 'base_b']),
        );
        expect(getPromptOptions(orderPrompt).map((option: any) => option.value?.defId)).not.toContain('base_c');

        const chooseRemainingTop = getPromptOptions(orderPrompt).find((option: any) => option.value?.defId === 'base_b');
        expect(chooseRemainingTop).toBeDefined();

        const ordered = respondToPrompt(pickedReplacement.finalState, chooseRemainingTop.id, '0');
        expect(ordered.success).toBe(true);

        const reorderedEvent = ordered.events.find((event) => event.type === SU_EVENTS.BASE_DECK_REORDERED);
        expect(reorderedEvent).toBeDefined();
        expect((reorderedEvent as any).payload.topDefIds).toEqual(['base_c', 'base_b', 'base_a']);
        expect(ordered.finalState.core.baseDeck.slice(0, 4)).toEqual(['base_c', 'base_b', 'base_a', 'base_d']);
    });
});
