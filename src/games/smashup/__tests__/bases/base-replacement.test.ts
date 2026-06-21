import { describe, expect, it } from 'vitest';
import { reduce } from '../../domain/reducer';
import { SU_EVENTS, type BaseReplacedEvent } from '../../domain/types';
import { makeBase, makeMinion, makeState } from '../helpers';

describe('BASE_REPLACED keepCards 模式', () => {
    it('keepCards=true 时保留随从和 ongoing，仅替换 defId', () => {
        const minion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const base = makeBase({
            defId: 'old_base',
            minions: [minion],
            ongoingActions: [{ uid: 'ong-1', defId: 'cthulhu_altar', ownerId: '0' }],
        });
        const state = makeState({ bases: [base], baseDeck: ['new_base', 'another'] });

        const evt: BaseReplacedEvent = {
            type: SU_EVENTS.BASE_REPLACED,
            payload: { baseIndex: 0, oldBaseDefId: 'old_base', newBaseDefId: 'new_base', keepCards: true },
            timestamp: 0,
        };
        const next = reduce(state, evt);

        expect(next.bases[0].defId).toBe('new_base');
        expect(next.bases[0].minions).toHaveLength(1);
        expect(next.bases[0].minions[0].uid).toBe('m1');
        expect(next.bases[0].ongoingActions).toHaveLength(1);
        expect(next.baseDeck).toContain('old_base');
        expect(next.baseDeck).not.toContain('new_base');
    });

    it('基地替换后应清除该位置残留的 before/afterScoring 标记', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'old_base' })],
            baseDeck: ['new_base'],
            beforeScoringTriggeredBases: [0],
            afterScoringTriggeredBases: [0],
        });

        const evt: BaseReplacedEvent = {
            type: SU_EVENTS.BASE_REPLACED,
            payload: { baseIndex: 0, oldBaseDefId: 'old_base', newBaseDefId: 'new_base' },
            timestamp: 0,
        };

        const next = reduce(state, evt);
        expect(next.beforeScoringTriggeredBases).toBeUndefined();
        expect(next.afterScoringTriggeredBases).toBeUndefined();
    });

    it('BASE_REPLACED 会让原基地上的泰坦离场并清空状态', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'old_base' })],
            baseDeck: ['new_base'],
            titans: [{
                uid: 'titan-1',
                defId: 'ghosts_creampuff_man',
                faction: 'ghosts',
                ownerId: '0',
                controllerId: '1',
                powerCounters: 4,
                talentUsed: true,
                metadata: { armed: true },
                location: { zone: 'base', baseIndex: 0, enteredAt: 9 },
            }],
            titanOngoingSuppressedUntilTurnEnd: ['titan-1'],
        });

        const evt: BaseReplacedEvent = {
            type: SU_EVENTS.BASE_REPLACED,
            payload: { baseIndex: 0, oldBaseDefId: 'old_base', newBaseDefId: 'new_base', keepCards: true },
            timestamp: 0,
        };

        const next = reduce(state, evt);
        expect(next.titans?.[0]).toMatchObject({
            uid: 'titan-1',
            controllerId: '1',
            powerCounters: 0,
            talentUsed: false,
            metadata: undefined,
            location: { zone: 'setaside' },
        });
        expect(next.titanOngoingSuppressedUntilTurnEnd ?? []).not.toContain('titan-1');
    });

    it('keepCards=false 时不保留原基地上的卡牌', () => {
        const base = makeBase({ defId: 'old_base' });
        const state = makeState({ bases: [base], baseDeck: ['new_base'] });

        const evt: BaseReplacedEvent = {
            type: SU_EVENTS.BASE_REPLACED,
            payload: { baseIndex: 0, oldBaseDefId: 'old_base', newBaseDefId: 'new_base' },
            timestamp: 0,
        };
        const next = reduce(state, evt);

        expect(next.bases).toHaveLength(2);
        expect(next.bases[0].defId).toBe('new_base');
        expect(next.bases[0].minions).toHaveLength(0);
    });
});
