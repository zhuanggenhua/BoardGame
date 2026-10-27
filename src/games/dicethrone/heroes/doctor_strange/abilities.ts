import type { AbilityDef, AbilityEffect } from '../../domain/combat';
import { DOCTOR_STRANGE_ABILITY as ID, DOCTOR_STRANGE_FACE as FACE, DOCTOR_STRANGE_SFX } from './constants';

/** 复杂法术/奖励骰交给本游戏唯一法术结算宿主，主攻击仍由共享伤害链处理。 */
export const strangeOperation = (operation: string, timing: AbilityEffect['timing'] = 'preDefense'): AbilityEffect => ({
    description: `doctorStrange.effects.${operation}`,
    timing,
    action: { type: 'custom', target: 'self', customActionId: 'doctor-strange-operation', params: { operation } },
});

const damage = (value: number, unblockable = false): AbilityEffect => ({
    description: 'doctorStrange.effects.attack', timing: 'withDamage',
    action: { type: 'damage', target: 'opponent', value, ...(unblockable ? { unblockable: true } : {}) },
});

const ability = (id: string, rest: Omit<AbilityDef, 'id' | 'name' | 'description' | 'sfxKey'>): AbilityDef => ({
    id, name: `abilities.${id}.name`, description: `abilities.${id}.description`, sfxKey: DOCTOR_STRANGE_SFX, ...rest,
});

export const DOCTOR_STRANGE_ABILITIES: AbilityDef[] = [
    ability(ID.OMEN, { type: 'offensive', trigger: { type: 'diceSet', faces: { [FACE.BOOK]: 2, [FACE.AMULET]: 2 } }, effects: [strangeOperation('omen'), damage(8)] }),
    ability(ID.AWARENESS, { type: 'utility', trigger: { type: 'diceSet', faces: { [FACE.BOOK]: 4 } }, effects: [strangeOperation('awareness')] }),
    ability(ID.BOOK, { type: 'passive', effects: [] }),
    ability(ID.ASTRAL, { type: 'offensive', trigger: { type: 'diceSet', faces: { [FACE.MANDALA]: 1, [FACE.BOOK]: 1, [FACE.CLOAK]: 1, [FACE.AMULET]: 1 } }, effects: [strangeOperation('astral'), damage(6)] }),
    ability(ID.BOLT, { type: 'offensive', variants: [
        { id: `${ID.BOLT}-small`, trigger: { type: 'smallStraight' }, effects: [damage(6), strangeOperation('cast-one', 'postDamage')], priority: 0 },
        { id: `${ID.BOLT}-large`, trigger: { type: 'largeStraight' }, effects: [damage(9), strangeOperation('cast-one', 'postDamage')], priority: 1 },
    ] }),
    ability(ID.WAND, { type: 'offensive', tags: ['unblockable'], trigger: { type: 'diceSet', faces: { [FACE.AMULET]: 4 } }, effects: [
        strangeOperation('wand'), damage(5, true), strangeOperation('wand-after-damage', 'postDamage'),
    ] }),
    ability(ID.BINDING, { type: 'offensive', trigger: { type: 'diceSet', faces: { [FACE.MANDALA]: 2, [FACE.CLOAK]: 2 } }, effects: [strangeOperation('binding'), damage(9)] }),
    ability(ID.CLOAK, { type: 'defensive', tags: ['defensive'], trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 2 }, effects: [strangeOperation('defense', 'withDamage')] }),
    ability(ID.ULTIMATE, { type: 'offensive', tags: ['ultimate', 'unblockable', 'uninterruptible'], trigger: { type: 'diceSet', faces: { [FACE.AMULET]: 5 } }, effects: [
        strangeOperation('ultimate'), damage(10, true), strangeOperation('ultimate-cast', 'postDamage'),
    ] }),
];
