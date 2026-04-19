/**
 * 野蛮人 (Barbarian) Custom Action 运行时行为断言测试
 */

import { describe, it, expect } from 'vitest';
import { STATUS_IDS, BARBARIAN_DICE_FACE_IDS as FACES } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import type { DiceThroneCore, Die, HeroState, DiceThroneEvent } from '../domain/types';
import { getCustomActionHandler } from '../domain/effects';
import type { CustomActionContext } from '../domain/effects';
import { initializeCustomActions } from '../domain/customActions';
import { registerDiceDefinition } from '../domain/diceRegistry';
import { barbarianDiceDefinition } from '../heroes/barbarian/diceConfig';

initializeCustomActions();
registerDiceDefinition(barbarianDiceDefinition);

// ============================================================================
// 测试工具
// ============================================================================

function createBarbarianDie(value: number): Die {
    const faceMap: Record<number, string> = {
        1: FACES.SWORD, 2: FACES.SWORD, 3: FACES.SWORD,
        4: FACES.HEART, 5: FACES.HEART,
        6: FACES.STRENGTH,
    };
    return {
        id: 0, definitionId: 'barbarian-dice', value,
        symbol: faceMap[value] as any, symbols: [faceMap[value]], isKept: false,
    };
}

function createState(opts: {
    dice?: Die[];
    defenderHP?: number;
    attackerHP?: number;
}): DiceThroneCore {
    const attacker: HeroState = {
        id: '0', characterId: 'barbarian',
        resources: { [RESOURCE_IDS.HP]: opts.attackerHP ?? 50, [RESOURCE_IDS.CP]: 5 },
        hand: [], deck: [], discard: [],
        statusEffects: {}, tokens: {}, tokenStackLimits: {},
        damageShields: [], abilities: [], abilityLevels: {}, upgradeCardByAbilityId: {},
    };
    const defender: HeroState = {
        id: '1', characterId: 'monk',
        resources: { [RESOURCE_IDS.HP]: opts.defenderHP ?? 50, [RESOURCE_IDS.CP]: 5 },
        hand: [], deck: [], discard: [],
        statusEffects: {}, tokens: {}, tokenStackLimits: {},
        damageShields: [], abilities: [], abilityLevels: {}, upgradeCardByAbilityId: {},
    };
    return {
        players: { '0': attacker, '1': defender },
        selectedCharacters: { '0': 'barbarian', '1': 'monk' },
        readyPlayers: { '0': true, '1': true },
        hostPlayerId: '0', hostStarted: true,
        dice: opts.dice ?? [1, 2, 3, 4, 5].map(v => createBarbarianDie(v)),
        rollCount: 1, rollLimit: 3, rollDiceCount: 5, rollConfirmed: false,
        activePlayerId: '0', startingPlayerId: '0', turnNumber: 1,
        pendingAttack: null, tokenDefinitions: [],
    };
}


function buildCtx(
    state: DiceThroneCore, actionId: string,
    opts?: { random?: () => number; targetSelf?: boolean }
): CustomActionContext {
    const effectCtx = {
        attackerId: '0' as any, defenderId: '1' as any,
        sourceAbilityId: actionId, state, damageDealt: 0, timestamp: 1000,
    };
    const randomFn = opts?.random
        ? { d: (n: number) => Math.ceil(opts.random!() * n) } as any
        : undefined;
    // targetSelf=true 模拟 action.target:'self' 的真实场景（targetId=attackerId）
    const targetId = opts?.targetSelf ? '0' : '1';
    return {
        ctx: effectCtx, targetId: targetId as any, attackerId: '0' as any,
        sourceAbilityId: actionId, state, timestamp: 1000, random: randomFn,
        action: { type: 'custom', customActionId: actionId },
    };
}

function eventsOfType(events: DiceThroneEvent[], type: string) {
    return events.filter(e => e.type === type);
}

// ============================================================================
// 测试套件
// ============================================================================

describe('野蛮人 Custom Action 运行时行为断言', () => {

    // ========================================================================
    // barbarian-suppress-roll: 投3骰，造成点数总和伤害，>14施加脑震荡
    // ========================================================================
    describe('barbarian-suppress-roll (压制 I)', () => {
        it('投3骰造成点数总和伤害（target:self 场景，伤害必须打到对手）', () => {
            const state = createState({});
            let callIdx = 0;
            const rolls = [3, 4, 5]; // 总和=12
            const handler = getCustomActionHandler('barbarian-suppress-roll')!;
            // targetSelf=true 模拟真实的 action.target:'self' 场景
            const events = handler(buildCtx(state, 'barbarian-suppress-roll', {
                random: () => rolls[callIdx++] / 6,
                targetSelf: true,
            }));

            const dmg = eventsOfType(events, 'DAMAGE_DEALT');
            expect(dmg).toHaveLength(1);
            expect((dmg[0] as any).payload.amount).toBe(12);
            // D10 关键断言：伤害目标必须是对手 '1'，不能是自己 '0'
            expect((dmg[0] as any).payload.targetId).toBe('1');

            // 12 <= 14，不施加脑震荡
            const status = eventsOfType(events, 'STATUS_APPLIED');
            expect(status).toHaveLength(0);

            const settlement = eventsOfType(events, 'BONUS_DICE_REROLL_REQUESTED');
            expect(settlement).toHaveLength(1);
            expect((settlement[0] as any).payload.settlement.dice).toHaveLength(3);
            expect((settlement[0] as any).payload.settlement.displayOnly).toBe(true);
        });

        it('总和>14时施加脑震荡（target:self 场景）', () => {
            const state = createState({});
            let callIdx = 0;
            const rolls = [5, 5, 6]; // 总和=16 > 14
            const handler = getCustomActionHandler('barbarian-suppress-roll')!;
            const events = handler(buildCtx(state, 'barbarian-suppress-roll', {
                random: () => rolls[callIdx++] / 6,
                targetSelf: true,
            }));

            const dmg = eventsOfType(events, 'DAMAGE_DEALT');
            expect(dmg).toHaveLength(1);
            expect((dmg[0] as any).payload.amount).toBe(16);
            expect((dmg[0] as any).payload.targetId).toBe('1');
            const status = eventsOfType(events, 'STATUS_APPLIED');
            expect(status).toHaveLength(1);
            expect((status[0] as any).payload.statusId).toBe(STATUS_IDS.CONCUSSION);
            // 脑震荡也必须施加给对手
            expect((status[0] as any).payload.targetId).toBe('1');
        });
    });

    // ========================================================================
    // barbarian-suppress-2-roll: 投3骰，造成点数总和伤害，>9施加脑震荡
    // ========================================================================
    describe('barbarian-suppress-2-roll (压制 II)', () => {
        it('总和>9时施加脑震荡（target:self 场景）', () => {
            const state = createState({});
            let callIdx = 0;
            const rolls = [3, 4, 4]; // 总和=11 > 9
            const handler = getCustomActionHandler('barbarian-suppress-2-roll')!;
            const events = handler(buildCtx(state, 'barbarian-suppress-2-roll', {
                random: () => rolls[callIdx++] / 6,
                targetSelf: true,
            }));

            const dmg = eventsOfType(events, 'DAMAGE_DEALT');
            expect(dmg).toHaveLength(1);
            expect((dmg[0] as any).payload.amount).toBe(11);
            expect((dmg[0] as any).payload.targetId).toBe('1');
            expect(eventsOfType(events, 'STATUS_APPLIED')).toHaveLength(1);
            expect((eventsOfType(events, 'STATUS_APPLIED')[0] as any).payload.targetId).toBe('1');
        });

        it('总和<=9时不施加脑震荡（target:self 场景）', () => {
            const state = createState({});
            let callIdx = 0;
            const rolls = [1, 2, 3]; // 总和=6 <= 9
            const handler = getCustomActionHandler('barbarian-suppress-2-roll')!;
            const events = handler(buildCtx(state, 'barbarian-suppress-2-roll', {
                random: () => rolls[callIdx++] / 6,
                targetSelf: true,
            }));

            const dmg = eventsOfType(events, 'DAMAGE_DEALT');
            expect(dmg).toHaveLength(1);
            expect((dmg[0] as any).payload.amount).toBe(6);
            expect((dmg[0] as any).payload.targetId).toBe('1');
            expect(eventsOfType(events, 'STATUS_APPLIED')).toHaveLength(0);
        });
    });

    // ========================================================================
    // barbarian-thick-skin: 治疗 2×心骰面数
    // ========================================================================
    describe('barbarian-thick-skin (厚皮 I)', () => {
        it('2个心面治疗4点', () => {
            // 骰子: sword,sword,sword,heart,heart → 2个heart
            const dice = [1, 2, 3, 4, 5].map(v => createBarbarianDie(v));
            const state = createState({ dice });
            const handler = getCustomActionHandler('barbarian-thick-skin')!;
            const events = handler(buildCtx(state, 'barbarian-thick-skin'));

            const heal = eventsOfType(events, 'HEAL_APPLIED');
            expect(heal).toHaveLength(1);
            expect((heal[0] as any).payload.amount).toBe(4); // 2×2
        });

        it('0个心面治疗0点（仍生成事件）', () => {
            const dice = [1, 1, 1, 1, 1].map(v => createBarbarianDie(v)); // 全sword
            const state = createState({ dice });
            const handler = getCustomActionHandler('barbarian-thick-skin')!;
            const events = handler(buildCtx(state, 'barbarian-thick-skin'));

            expect((eventsOfType(events, 'HEAL_APPLIED')[0] as any).payload.amount).toBe(0);
        });
    });

    // ========================================================================
    // barbarian-thick-skin-2: 治疗 2×心面 + 心面>=2时授予preventStatus护盾
    // ========================================================================
    describe('barbarian-thick-skin-2 (厚皮 II)', () => {
        it('2个心面：治疗4点 + 授予preventStatus护盾', () => {
            const dice = [1, 2, 3, 4, 5].map(v => createBarbarianDie(v));
            const state = createState({ dice });
            const handler = getCustomActionHandler('barbarian-thick-skin-2')!;
            const events = handler(buildCtx(state, 'barbarian-thick-skin-2'));

            expect((eventsOfType(events, 'HEAL_APPLIED')[0] as any).payload.amount).toBe(4);
            const shield = eventsOfType(events, 'DAMAGE_SHIELD_GRANTED');
            expect(shield).toHaveLength(1);
            expect((shield[0] as any).payload.preventStatus).toBe(true);
        });

        it('1个心面：治疗2点，不授予护盾', () => {
            const dice = [1, 1, 1, 4, 1].map(v => createBarbarianDie(v)); // 1个heart
            const state = createState({ dice });
            const handler = getCustomActionHandler('barbarian-thick-skin-2')!;
            const events = handler(buildCtx(state, 'barbarian-thick-skin-2'));

            expect((eventsOfType(events, 'HEAL_APPLIED')[0] as any).payload.amount).toBe(2);
            expect(eventsOfType(events, 'DAMAGE_SHIELD_GRANTED')).toHaveLength(0);
        });
    });

    // ========================================================================
    // lucky-roll-heal: 投3骰，治疗 1+2×心面数
    // ========================================================================
    describe('lucky-roll-heal (大吉大利)', () => {
        it('3个心面治疗7点', () => {
            const state = createState({});
            const handler = getCustomActionHandler('lucky-roll-heal')!;
            const events = handler(buildCtx(state, 'lucky-roll-heal', {
                random: () => 4 / 6, // d(6)→4 → heart，3次
            }));

            const heal = eventsOfType(events, 'HEAL_APPLIED');
            expect(heal).toHaveLength(1);
            expect((heal[0] as any).payload.amount).toBe(7); // 1+2×3
            const settlement = eventsOfType(events, 'BONUS_DICE_REROLL_REQUESTED');
            expect(settlement).toHaveLength(0);
        });

        it('0个心面治疗1点', () => {
            const state = createState({});
            let callIdx = 0;
            const handler = getCustomActionHandler('lucky-roll-heal')!;
            const events = handler(buildCtx(state, 'lucky-roll-heal', {
                random: () => {
                    callIdx++;
                    return [1 / 6, 2 / 6, 3 / 6][callIdx - 1]; // 全sword
                },
            }));

            expect((eventsOfType(events, 'HEAL_APPLIED')[0] as any).payload.amount).toBe(1); // 1+2×0
        });
    });

    // ========================================================================
    // more-please-roll-damage: 投5骰，剑面数伤害+脑震荡
    // ========================================================================
    describe('more-please-roll-damage (再来点儿)', () => {
        it('5个剑面造成5点伤害并施加脑震荡（target:self 场景）', () => {
            const state = createState({});
            const handler = getCustomActionHandler('more-please-roll-damage')!;
            const events = handler(buildCtx(state, 'more-please-roll-damage', {
                random: () => 1 / 6, // d(6)→1 → sword，5次
                targetSelf: true,
            }));

            const dmg = eventsOfType(events, 'DAMAGE_DEALT');
            expect(dmg).toHaveLength(1);
            expect((dmg[0] as any).payload.amount).toBe(5);
            // D10 关键断言：伤害目标必须是对手 '1'
            expect((dmg[0] as any).payload.targetId).toBe('1');

            const status = eventsOfType(events, 'STATUS_APPLIED');
            expect(status).toHaveLength(1);
            expect((status[0] as any).payload.statusId).toBe(STATUS_IDS.CONCUSSION);
            expect((status[0] as any).payload.targetId).toBe('1');
            const settlement = eventsOfType(events, 'BONUS_DICE_REROLL_REQUESTED');
            expect(settlement).toHaveLength(0);
        });

        it('0个剑面不造成伤害但仍施加脑震荡（target:self 场景）', () => {
            const state = createState({});
            const handler = getCustomActionHandler('more-please-roll-damage')!;
            const events = handler(buildCtx(state, 'more-please-roll-damage', {
                random: () => 4 / 6, // d(6)→4 → heart，5次
                targetSelf: true,
            }));

            expect(eventsOfType(events, 'DAMAGE_DEALT')).toHaveLength(0);
            // 脑震荡始终施加给对手
            const status = eventsOfType(events, 'STATUS_APPLIED');
            expect(status).toHaveLength(1);
            expect((status[0] as any).payload.targetId).toBe('1');
        });
    });
});
