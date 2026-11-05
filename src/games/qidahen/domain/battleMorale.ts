import {
    collapseCompatPiecesToSpecialTroopStacks,
    expandSpecialTroopStacksToCompatPieces,
} from './troopCompat';
import type { QidahenBattleMoraleResult, QidahenSpecialTroopStack, QidahenTroopKind } from './types';

interface MoraleUnit {
    level: number;
    troopKind: QidahenTroopKind;
}

// 正式规则 p1、p6：每点损伤降低当前最高士气单位一级；炮兵通常不能承伤。
export const applyQidahenBattleDamage = <T extends MoraleUnit>(
    units: readonly T[],
    damage: number,
    artilleryFirst = false,
): T[] => {
    const next = units.map((unit) => ({ ...unit }));
    for (let point = 0; point < Math.max(0, Math.floor(damage)); point += 1) {
        const candidates = next.filter((unit) => unit.level > 0 && (artilleryFirst || unit.troopKind !== 'artillery'));
        const artillery = artilleryFirst ? candidates.filter((unit) => unit.troopKind === 'artillery') : [];
        const eligible = artillery.length > 0 ? artillery : candidates;
        const target = eligible.reduce<T | null>((highest, unit) => (
            highest == null || unit.level > highest.level ? unit : highest
        ), null);
        if (!target) break;
        // 连炮阵的炮兵是卡面明确的例外：承伤时直接移除。
        target.level = target.troopKind === 'artillery' ? 0 : target.level - 1;
    }
    return next;
};

/** 基础防御为3；军备/战术改变防御时，每次先按当前实际承伤单位的防御折算骰点。 */
export function consumeQidahenBattleRollTotal<T extends MoraleUnit>(
    units: readonly T[], total: number, defenseOf: (unit: T) => number, artilleryFirst = false,
): { units: T[]; damage: number } {
    let next = units.map(unit => ({ ...unit }));
    let remaining = Math.max(0, total);
    let damage = 0;
    while (remaining > 0) {
        const candidates = next.filter(unit => unit.level > 0 && (artilleryFirst || unit.troopKind !== 'artillery'));
        const artillery = artilleryFirst ? candidates.filter(unit => unit.troopKind === 'artillery') : [];
        const target = (artillery.length ? artillery : candidates).reduce<T | null>((highest, unit) => (
            highest == null || unit.level > highest.level ? unit : highest
        ), null);
        if (!target) break;
        const defense = defenseOf(target);
        if (remaining < defense) break;
        remaining -= defense;
        damage += 1;
        next = applyQidahenBattleDamage(next, 1, artilleryFirst);
    }
    return { units: next, damage };
}

export const applyQidahenBattleMoraleToStacks = (
    stacks: readonly QidahenSpecialTroopStack[],
    morale: QidahenBattleMoraleResult,
): QidahenSpecialTroopStack[] => collapseCompatPiecesToSpecialTroopStacks(
    expandSpecialTroopStacksToCompatPieces(stacks)
        .map((piece) => ({
            ...piece,
            level: morale.remainingLevels[piece.id] ?? piece.level,
        }))
        .filter((piece) => piece.level > 0),
);
