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

    it('会把 UI 会直接渲染的非法数字字段收敛为安全值并上报异常', () => {
        const normalized = normalizeSmashUpCoreForUi({
            players: {
                '0': {
                    id: '0',
                    vp: Number.NaN,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: undefined,
                    minionLimit: Number.NaN,
                    actionsPlayed: null,
                    actionLimit: 'bad',
                    factions: ['pirates', 'wizards'],
                    minionsPlayedPerBase: { 0: Number.NaN, 1: 2 },
                    baseLimitedMinionQuota: { 0: 1, 1: Number.NaN },
                    baseLimitedMinionPowerCaps: { 0: [2, Number.NaN, 'bad'] },
                    extraMinionPowerMax: Number.NaN,
                    extraMinionPowerCaps: [2, Number.NaN],
                    sameNameMinionRemaining: Number.NaN,
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
                            basePower: undefined,
                            powerCounters: Number.NaN,
                            powerModifier: null,
                            tempPowerModifier: 'bad',
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                    ongoingActions: [
                        {
                            uid: 'ongoing-1',
                            defId: 'vampire_summon_wolves',
                            ownerId: '0',
                            metadata: {
                                powerCounters: Number.NaN,
                            },
                        },
                    ],
                },
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 1,
            titans: [
                {
                    uid: 'titan-1',
                    defId: 'time_travelers_time_box',
                    faction: 'time_travelers',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: Number.NaN,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0 },
                },
            ],
        } as any);

        const player = normalized.core?.players['0'];
        expect(player?.vp).toBe(0);
        expect(player?.minionsPlayed).toBe(0);
        expect(player?.minionLimit).toBe(1);
        expect(player?.actionsPlayed).toBe(0);
        expect(player?.actionLimit).toBe(1);
        expect(player?.minionsPlayedPerBase).toEqual({ 1: 2 });
        expect(player?.baseLimitedMinionQuota).toEqual({ 0: 1 });
        expect(player?.baseLimitedMinionPowerCaps).toEqual({ 0: [2] });
        expect(player?.extraMinionPowerMax).toBeUndefined();
        expect(player?.extraMinionPowerCaps).toEqual([2]);
        expect(player?.sameNameMinionRemaining).toBeUndefined();

        const minion = normalized.core?.bases[0]?.minions[0];
        expect(minion?.basePower).toBe(0);
        expect(minion?.powerCounters).toBe(0);
        expect(minion?.powerModifier).toBe(0);
        expect(minion?.tempPowerModifier).toBe(0);
        expect(normalized.core?.bases[0]?.ongoingActions[0]?.metadata?.powerCounters).toBe(0);
        expect(normalized.core?.titans?.[0]?.powerCounters).toBe(0);

        expect(normalized.anomalies).toEqual(expect.arrayContaining([
            { path: 'players.0.vp', actual: 'invalid-number' },
            { path: 'players.0.minionsPlayed', actual: 'invalid-number' },
            { path: 'players.0.minionLimit', actual: 'invalid-number' },
            { path: 'players.0.actionsPlayed', actual: 'invalid-number' },
            { path: 'players.0.actionLimit', actual: 'invalid-number' },
            { path: 'players.0.minionsPlayedPerBase.0', actual: 'invalid-number' },
            { path: 'players.0.baseLimitedMinionQuota.1', actual: 'invalid-number' },
            { path: 'players.0.baseLimitedMinionPowerCaps.0[1]', actual: 'invalid-number' },
            { path: 'players.0.baseLimitedMinionPowerCaps.0[2]', actual: 'invalid-number' },
            { path: 'players.0.extraMinionPowerMax', actual: 'invalid-number' },
            { path: 'players.0.extraMinionPowerCaps[1]', actual: 'invalid-number' },
            { path: 'players.0.sameNameMinionRemaining', actual: 'invalid-number' },
            { path: 'bases[0].minions[0].basePower', actual: 'invalid-number' },
            { path: 'bases[0].minions[0].powerCounters', actual: 'invalid-number' },
            { path: 'bases[0].minions[0].powerModifier', actual: 'invalid-number' },
            { path: 'bases[0].minions[0].tempPowerModifier', actual: 'invalid-number' },
            { path: 'bases[0].ongoingActions[0].metadata.powerCounters', actual: 'invalid-number' },
            { path: 'titans[0].powerCounters', actual: 'invalid-number' },
        ]));
    });
});
