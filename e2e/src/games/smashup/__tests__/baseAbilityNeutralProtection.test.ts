import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities } from '../abilities';
import { makeMatchState } from './helpers';
import { getInteractionHandler } from '../domain/abilityInteractionHandlers';
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
        const ms = makeMatchState(core);
        const handler = getInteractionHandler('base_mushroom_kingdom');
        const iData = { continuationContext: { mushroomBaseIndex: 0 } } as any;
        const res = handler(ms, '0', { minionUid: 't1', minionDefId: 'test_minion', fromBaseIndex: 1 }, iData, () => 0.5, 123);
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
        const ms = makeMatchState(core);
        const handler = getInteractionHandler('base_mushroom_kingdom');
        const iData = { continuationContext: { mushroomBaseIndex: 0 } } as any;
        const res = handler(ms, '0', { minionUid: 't1', minionDefId: 'test_minion', fromBaseIndex: 1 }, iData, () => 0.5, 123);
        const filtered = filterProtectedMoveEvents(res.events, core, '0');
        expect(filtered.some(e => e.type === SU_EVENTS.MINION_MOVED)).toBe(false);
    });
});

