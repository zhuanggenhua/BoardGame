import { describe, expect, it } from 'vitest';
import { consumeQidahenBattleRollTotal } from '../domain/battleMorale';

describe('骰点、防御与士气分别结算', () => {
    it('基础防御3与铁甲防御4消费不同骰点，均只降低士气一级', () => {
        const army = [{ level: 2, troopKind: 'infantry' as const }];
        expect(consumeQidahenBattleRollTotal(army, 3, () => 3)).toMatchObject({ damage: 1, units: [{ level: 1 }] });
        expect(consumeQidahenBattleRollTotal(army, 3, () => 4)).toMatchObject({ damage: 0, units: [{ level: 2 }] });
        expect(consumeQidahenBattleRollTotal(army, 4, () => 4)).toMatchObject({ damage: 1, units: [{ level: 1 }] });
    });

    it('每点损伤重新寻找最高士气单位，按其实际防御消费骰点', () => {
        const army = [
            { id: 'infantry', level: 3, troopKind: 'infantry' as const },
            { id: 'cavalry', level: 2, troopKind: 'cavalry' as const },
        ];
        const result = consumeQidahenBattleRollTotal(army, 10, unit => unit.troopKind === 'infantry' ? 4 : 3);
        expect(result.damage).toBe(2);
        expect(result.units.map(unit => unit.level)).toEqual([1, 2]);
        expect(army.map(unit => unit.level)).toEqual([3, 2]);
    });

    it('炮兵通常不承伤；连炮阵明确按防御4承伤并直接移除', () => {
        const army = [
            { level: 4, troopKind: 'artillery' as const },
            { level: 1, troopKind: 'infantry' as const },
        ];
        expect(consumeQidahenBattleRollTotal(army, 4, () => 3).units.map(unit => unit.level)).toEqual([4, 0]);
        expect(consumeQidahenBattleRollTotal(army, 4, () => 4, true).units.map(unit => unit.level)).toEqual([0, 1]);
    });
});
