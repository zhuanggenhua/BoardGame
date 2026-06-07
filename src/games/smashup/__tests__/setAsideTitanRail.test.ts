import { describe, expect, it } from 'vitest';
import type { TitanState } from '../domain/types';
import { getSetAsideTitansForActivation, getSetAsideTitansForDeckDisplay } from '../ui/setAsideTitanRail';

function makeTitan(overrides: Partial<TitanState>): TitanState {
    return {
        uid: 'titan-a',
        defId: 'time_travelers_time_box',
        ownerId: '0',
        controllerId: '0',
        powerCounters: 0,
        talentUsed: false,
        location: { zone: 'setaside' },
        ...overrides,
    };
}

describe('setaside titan rail ownership', () => {
    it('牌库旁 titan rail 应按 controller 显示 borrowed setaside Titan', () => {
        const titans: TitanState[] = [
            makeTitan({ uid: 'borrowed-time-box', ownerId: '1', controllerId: '0' }),
            makeTitan({ uid: 'owner-only-time-box', ownerId: '1', controllerId: '1' }),
            makeTitan({ uid: 'in-play-time-box', ownerId: '1', controllerId: '0', location: { zone: 'base', baseIndex: 0 } }),
        ];

        expect(getSetAsideTitansForDeckDisplay(titans, '0').map((titan) => titan.uid)).toEqual(['borrowed-time-box']);
        expect(getSetAsideTitansForDeckDisplay(titans, '1').map((titan) => titan.uid)).toEqual(['owner-only-time-box']);
    });

    it('setaside Titan 激活候选应按 controller 暴露 borrowed Titan', () => {
        const titans: TitanState[] = [
            makeTitan({ uid: 'borrowed-ursa', ownerId: '1', controllerId: '0' }),
            makeTitan({ uid: 'owner-ursa', ownerId: '1', controllerId: '1' }),
            makeTitan({ uid: 'base-ursa', ownerId: '1', controllerId: '0', location: { zone: 'base', baseIndex: 1 } }),
        ];

        expect(getSetAsideTitansForActivation(titans, '0').map((titan) => titan.uid)).toEqual(['borrowed-ursa']);
        expect(getSetAsideTitansForActivation(titans, '1').map((titan) => titan.uid)).toEqual(['owner-ursa']);
    });
});
