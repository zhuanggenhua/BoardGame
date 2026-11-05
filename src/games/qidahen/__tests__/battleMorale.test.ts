import { describe, expect, it } from 'vitest';
import { applyQidahenBattleDamage } from '../domain/battleMorale';

describe('正式战斗损伤与士气', () => {
    const units = () => [
        { id: 'gun', troopKind: 'artillery' as const, level: 1 },
        { id: 'veteran', troopKind: 'infantry' as const, level: 3 },
        { id: 'recruit', troopKind: 'infantry' as const, level: 1 },
    ];

    it('最高等级的步骑兵承伤降一级，仍然是一支部队', () => {
        const before = units();
        const after = applyQidahenBattleDamage(before, 1);
        expect(after.map((unit) => unit.level)).toEqual([1, 2, 1]);
        expect(after.filter((unit) => unit.level > 0)).toHaveLength(3);
        expect(before[1]?.level).toBe(3);
    });

    it('逐点重算当前最高等级，士气归零才阵亡', () => {
        const after = applyQidahenBattleDamage(units(), 3);
        expect(after.map((unit) => unit.level)).toEqual([1, 0, 1]);
    });

    it('普通损伤不能分配给炮兵', () => {
        expect(applyQidahenBattleDamage(units(), 20).map((unit) => unit.level)).toEqual([1, 0, 0]);
    });

    it('连炮阵例外允许炮兵先承伤并直接移除', () => {
        expect(applyQidahenBattleDamage(units(), 1, true).map((unit) => unit.level)).toEqual([0, 3, 1]);
    });
});
