import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities } from '../abilities';
import { getSimpleChoicePrompt, respondToPromptOption, triggerBaseAbilityWithMS } from './helpers';
import { buildValidatedBaseMoveEvents } from '../domain/abilityHelpers';
import { filterProtectedMoveEvents } from '../domain/reducer';
import type { SmashUpCore, MinionOnBase } from '../domain/types';
import { SU_EVENTS } from '../domain/types';

beforeAll(() => {
    initAllAbilities();
});

function makeMinion(
    uid: string,
    controller: string,
    defId = 'test_minion',
    attachedActions: MinionOnBase['attachedActions'] = []
): MinionOnBase {
    return {
        uid,
        defId,
        controller,
        owner: controller,
        basePower: 3,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        attachedActions,
    };
}

function makeCore(overrides: Partial<SmashUpCore> = {}): SmashUpCore {
    return {
        players: {
            '0': { id: '0', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] } as any,
            '1': { id: '1', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] } as any,
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    } as SmashUpCore;
}

describe('Wiki/FAQ: 基地能力归因中立（Deep Roots vs Infiltrate）', () => {
    it('共享移动 gateway 不应在入口层丢失基地来源语义', () => {
        const target = makeMinion('t1', '1');
        const core = makeCore({
            bases: [
                { defId: 'base_mushroom_kingdom', minions: [], ongoingActions: [] } as any,
                {
                    defId: 'base_central_brain',
                    minions: [target],
                    ongoingActions: [{ uid: 'dr-1', defId: 'killer_plant_deep_roots', ownerId: '1' }],
                } as any,
            ],
        });

        const events = buildValidatedBaseMoveEvents(core, {
            minionUid: 't1',
            minionDefId: 'test_minion',
            fromBaseIndex: 1,
            toBaseIndex: 0,
            sourcePlayerId: '0',
            sourceDefId: 'base_mushroom_kingdom',
            sourceBaseIndex: 0,
            reason: 'base_mushroom_kingdom',
            now: 123,
        });

        expect(events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(true);
        expect(events.some(event => event.type === SU_EVENTS.ABILITY_FEEDBACK)).toBe(false);
    });

    it('Deep Roots（只拦截对手）不应阻止 base_mushroom_kingdom 的移动', () => {
        const target = makeMinion('t1', '1');
        const core = makeCore({
            bases: [
                { defId: 'base_mushroom_kingdom', minions: [], ongoingActions: [] } as any,
                {
                    defId: 'base_central_brain',
                    minions: [target],
                    ongoingActions: [{ uid: 'dr-1', defId: 'killer_plant_deep_roots', ownerId: '1' }],
                } as any,
            ],
        });
        const trigger = triggerBaseAbilityWithMS('base_mushroom_kingdom', 'onTurnStart', {
            state: core,
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_mushroom_kingdom',
        } as any);
        const prompt = getSimpleChoicePrompt(trigger.matchState!, 'base_mushroom_kingdom');
        const res = respondToPromptOption(
            trigger.matchState!,
            option => option.value?.minionUid === 't1',
            'Mushroom Kingdom target minion',
        );
        expect(prompt).toBeDefined();
        expect(res.success, res.error).toBe(true);
        const moveEvents = res.events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        expect(moveEvents.length).toBe(1);
        // 保护过滤：如果仍把基地能力当成“玩家0造成”，deep_roots 会错误拦截
        const filtered = filterProtectedMoveEvents(res.events, core, '0');
        expect(filtered.some(e => e.type === SU_EVENTS.MINION_MOVED)).toBe(true);
    });

    it('Infiltrate（让随从不受基地能力影响）应阻止 base_mushroom_kingdom 的移动', () => {
        const target = makeMinion('t1', '1', 'test_minion', [{ uid: 'inf-1', defId: 'ninja_infiltrate', ownerId: '0' }]);
        const core = makeCore({
            bases: [
                { defId: 'base_mushroom_kingdom', minions: [], ongoingActions: [] } as any,
                { defId: 'base_central_brain', minions: [target], ongoingActions: [] } as any,
            ],
        });
        const trigger = triggerBaseAbilityWithMS('base_mushroom_kingdom', 'onTurnStart', {
            state: core,
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_mushroom_kingdom',
        } as any);
        const prompt = getSimpleChoicePrompt(trigger.matchState!, 'base_mushroom_kingdom');
        const res = respondToPromptOption(
            trigger.matchState!,
            option => option.value?.minionUid === 't1',
            'Mushroom Kingdom target minion',
        );
        expect(prompt).toBeDefined();
        expect(res.success, res.error).toBe(true);
        const filtered = filterProtectedMoveEvents(res.events, core, '0');
        expect(filtered.some(e => e.type === SU_EVENTS.MINION_MOVED)).toBe(false);
    });
});

