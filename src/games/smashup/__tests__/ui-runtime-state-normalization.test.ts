import { describe, expect, it } from 'vitest';

import { normalizeSmashUpCoreForUi } from '../ui/normalizeRuntimeState';

describe('大杀四方 UI 运行时状态规范化', () => {
    it('会把中局快照里的 null 数组字段统一收敛为空数组', () => {
        const normalized = normalizeSmashUpCoreForUi({
            players: {
                '0': {
                    id: '0',
                    vp: 3,
                    hand: null,
                    deck: null,
                    discard: null,
                    minionsPlayed: 1,
                    minionLimit: 1,
                    actionsPlayed: 1,
                    actionLimit: 1,
                    factions: ['zombies', 'pirates'],
                    usedDiscardPlayAbilities: null,
                    pendingMinionPlayEffects: null,
                },
            },
            turnOrder: null,
            currentPlayerIndex: 0,
            bases: [
                {
                    defId: 'base_tortuga',
                    minions: [
                        {
                            uid: 'minion-1',
                            defId: 'pirate_first_mate',
                            controller: '0',
                            owner: '0',
                            basePower: 2,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: null,
                        },
                    ],
                    ongoingActions: null,
                    buriedCards: null,
                },
                null,
            ],
            baseDeck: [],
            turnNumber: 5,
            nextUid: 42,
            titans: null,
            madnessDeck: null,
        } as any);

        expect(normalized.core).toBeDefined();
        expect(normalized.core?.players['0']?.hand).toEqual([]);
        expect(normalized.core?.players['0']?.deck).toEqual([]);
        expect(normalized.core?.players['0']?.discard).toEqual([]);
        expect(normalized.core?.players['0']?.usedDiscardPlayAbilities).toEqual(undefined);
        expect(normalized.core?.players['0']?.pendingMinionPlayEffects).toEqual([]);
        expect(normalized.core?.turnOrder).toEqual([]);
        expect(normalized.core?.bases).toHaveLength(1);
        expect(normalized.core?.bases[0]?.ongoingActions).toEqual([]);
        expect(normalized.core?.bases[0]?.buriedCards).toEqual([]);
        expect(normalized.core?.bases[0]?.minions[0]?.attachedActions).toEqual([]);
        expect(normalized.core?.titans).toEqual([]);
        expect(normalized.core?.madnessDeck).toEqual([]);
        expect(normalized.anomalies).toEqual(expect.arrayContaining([
            { path: 'players.0.hand', actual: 'null' },
            { path: 'players.0.deck', actual: 'null' },
            { path: 'players.0.discard', actual: 'null' },
            { path: 'players.0.pendingMinionPlayEffects', actual: 'null' },
            { path: 'players.0.usedDiscardPlayAbilities', actual: 'null' },
            { path: 'turnOrder', actual: 'null' },
            { path: 'bases[0].ongoingActions', actual: 'null' },
            { path: 'bases[0].buriedCards', actual: 'null' },
            { path: 'bases[0].minions[0].attachedActions', actual: 'null' },
            { path: 'bases[1]', actual: 'invalid-entry' },
            { path: 'titans', actual: 'null' },
            { path: 'madnessDeck', actual: 'null' },
        ]));
    });

    it('不会破坏已合法的数组内容', () => {
        const normalized = normalizeSmashUpCoreForUi({
            players: {
                '0': {
                    id: '0',
                    vp: 1,
                    hand: [{ uid: 'hand-1', defId: 'zombie_lord', type: 'minion', owner: '0' }],
                    deck: [{ uid: 'deck-1', defId: 'the_burst', type: 'action', owner: '0' }],
                    discard: [{ uid: 'discard-1', defId: 'full_sail', type: 'action', owner: '0' }],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['zombies', 'pirates'],
                },
            },
            turnOrder: ['0'],
            currentPlayerIndex: 0,
            bases: [
                {
                    defId: 'base_tortuga',
                    minions: [
                        {
                            uid: 'minion-1',
                            defId: 'pirate_first_mate',
                            controller: '0',
                            owner: '0',
                            basePower: 2,
                            powerCounters: 1,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [{ uid: 'attach-1', defId: 'powderkeg', ownerId: '0' }],
                        },
                    ],
                    ongoingActions: [{ uid: 'ongoing-1', defId: 'seal_the_tomb', ownerId: '0' }],
                },
            ],
            baseDeck: [],
            turnNumber: 2,
            nextUid: 8,
            titans: [{ uid: 'titan-1', defId: 'cthulhu', faction: 'cthulhu', ownerId: '0', controllerId: '0', powerCounters: 0, talentUsed: false, location: { zone: 'setaside' } }],
        } as any);

        expect(normalized.core?.players['0']?.hand[0]?.uid).toBe('hand-1');
        expect(normalized.core?.turnOrder).toEqual(['0']);
        expect(normalized.core?.bases[0]?.minions[0]?.attachedActions[0]?.uid).toBe('attach-1');
        expect(normalized.core?.bases[0]?.ongoingActions[0]?.uid).toBe('ongoing-1');
        expect(normalized.core?.titans?.[0]?.uid).toBe('titan-1');
        expect(normalized.anomalies).toEqual([]);
    });

    it('会保留合法的 madnessDeck defId 字符串数组，不误报 invalid-entry', () => {
        const normalized = normalizeSmashUpCoreForUi({
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['minions_of_cthulhu', 'innsmouth'],
                },
            },
            turnOrder: ['0'],
            currentPlayerIndex: 0,
            bases: [],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 1,
            madnessDeck: ['special_madness', 'special_madness', 'special_madness'],
        } as any);

        expect(normalized.core?.madnessDeck).toEqual(['special_madness', 'special_madness', 'special_madness']);
        expect(normalized.anomalies).toEqual([]);
    });

    it('会把历史对象型 madnessDeck 夹具收敛为 defId 字符串数组', () => {
        const normalized = normalizeSmashUpCoreForUi({
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['minions_of_cthulhu', 'elder_things'],
                },
            },
            turnOrder: ['0'],
            currentPlayerIndex: 0,
            bases: [],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 1,
            madnessDeck: [
                { uid: 'md1', defId: 'special_madness', type: 'action', owner: '0' },
                { uid: 'md2', defId: 'special_madness', type: 'action', owner: '0' },
            ],
        } as any);

        expect(normalized.core?.madnessDeck).toEqual(['special_madness', 'special_madness']);
        expect(normalized.anomalies).toEqual([]);
    });
});
