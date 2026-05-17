import { beforeAll, describe, expect, it } from 'vitest';
import {
    getInteractionsFromResult,
    initAllAbilities,
    makeState,
    triggerBaseAbility,
    triggerBaseAbilityWithMS,
} from './base-contract-helpers';
import { getPromptHandlerData, getPromptPlayerId, getPromptSourceId } from '../helpers';

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
});
