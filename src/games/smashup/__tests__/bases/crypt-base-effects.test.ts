import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    triggerExtendedBaseAbility,
    makeState,
    makeMatchState,
    getPromptsBySourceId,
    resolveDestroyedMinions,
    SU_EVENTS,
    type BaseAbilityContext,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('base_crypt: 消灭者放指示物', () => {
    it('消灭者在这里只有一个随从时也必须先让玩家确认', () => {
        const core = makeState({
                bases: [{
                    defId: 'base_crypt',
                    minions: [
                        { uid: 'm_destroyer', defId: 'd1', controller: '1', owner: '1', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': { id: '0', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
                    '1': { id: '1', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
                } as any,
        });
        const ctx: BaseAbilityContext = {
            state: core,
            matchState: makeMatchState(core),
            baseIndex: 0,
            baseDefId: 'base_crypt',
            playerId: '0',
            minionUid: 'm_victim',
            destroyerId: '1',
            now: 1000,
        };

        const result = triggerExtendedBaseAbility('base_crypt', 'onMinionDestroyed', ctx);
        expect(result.events).toHaveLength(0);
        expect(getPromptsBySourceId(result.matchState!, 'base_crypt')).toHaveLength(1);
    });

    it('消灭者在这里没有随从时不放指示物', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_crypt',
                    minions: [],
                    ongoingActions: [],
                }],
                players: {
                    '0': { id: '0', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
                    '1': { id: '1', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_crypt',
            playerId: '0',
            minionUid: 'm_victim',
            destroyerId: '1',
            now: 1000,
        };

        const { events } = triggerExtendedBaseAbility('base_crypt', 'onMinionDestroyed', ctx);
        expect(events.length).toBe(0);
    });

    it('同一张牌一次性消灭多个随从，只允许触发一次地窖（按 FAQ，管线层 batch）', () => {
        const core = makeState({
            bases: [{
                defId: 'base_crypt',
                minions: [
                    { uid: 'm_destroyer', defId: 'd1', controller: '1', owner: '1', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    { uid: 'victim-1', defId: 'v1', controller: '0', owner: '0', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    { uid: 'victim-2', defId: 'v2', controller: '0', owner: '0', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                ],
                ongoingActions: [],
            }],
            players: {
                '0': { id: '0', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
                '1': { id: '1', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
            } as any,
        });
        const ms = makeMatchState(core);
        const res = resolveDestroyedMinions({
            state: ms,
            currentPlayerId: '1',
            destroyed: [
                { minionUid: 'victim-1', minionDefId: 'v1', ownerId: '0', destroyerId: '1', reason: 'powderkeg' },
                { minionUid: 'victim-2', minionDefId: 'v2', ownerId: '0', destroyerId: '1', reason: 'powderkeg' },
            ],
            now: 1000,
        });
        // base_crypt 是 optional，且有 matchState 时会创建交互；batch 后只创建一次
        expect(getPromptsBySourceId(res.matchState ?? ms, 'base_crypt')).toHaveLength(1);
    });
});


// ============================================================================
// base_tar_pits: 焦油坑 - 被消灭随从放入牌库底
// ============================================================================
