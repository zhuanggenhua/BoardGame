/**
 * 月精灵 (Moon Elf) Custom Action 运行时行为断言测试
 */

import { describe, it, expect } from 'vitest';
import { STATUS_IDS, TOKEN_IDS, MOON_ELF_DICE_FACE_IDS as FACES } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import type { DiceThroneCore, Die, HeroState, DiceThroneEvent } from '../domain/types';
import { getCustomActionHandler } from '../domain/effects';
import type { CustomActionContext } from '../domain/effects';
import { initializeCustomActions } from '../domain/customActions';
import { registerDiceDefinition } from '../domain/diceRegistry';
import { moonElfDiceDefinition } from '../heroes/moon_elf/diceConfig';

initializeCustomActions();
registerDiceDefinition(moonElfDiceDefinition);

// ============================================================================
// 测试工具
// ============================================================================

function createMoonElfDie(value: number): Die {
    const faceMap: Record<number, string> = {
        1: FACES.BOW, 2: FACES.BOW, 3: FACES.BOW,
        4: FACES.FOOT, 5: FACES.FOOT,
        6: FACES.MOON,
    };
    return {
        id: 0, definitionId: 'moon_elf-dice', value,
        symbol: faceMap[value] as any, symbols: [faceMap[value]], isKept: false,
    };
}

function createState(opts: {
    dice?: Die[];
    defenderHP?: number;
    attackerHP?: number;
    attackerEvasive?: number;
    pendingAttackFaceCounts?: Record<string, number>;
}): DiceThroneCore {
    const attacker: HeroState = {
        id: '0', characterId: 'moon_elf',
        resources: { [RESOURCE_IDS.HP]: opts.attackerHP ?? 50, [RESOURCE_IDS.CP]: 5 },
        hand: [], deck: [], discard: [],
        statusEffects: {}, tokens: { [TOKEN_IDS.EVASIVE]: opts.attackerEvasive ?? 0 },
        tokenStackLimits: { [TOKEN_IDS.EVASIVE]: 3 },
        damageShields: [], abilities: [], abilityLevels: {}, upgradeCardByAbilityId: {},
    };
    const defender: HeroState = {
        id: '1', characterId: 'monk',
        resources: { [RESOURCE_IDS.HP]: opts.defenderHP ?? 50, [RESOURCE_IDS.CP]: 5 },
        hand: [], deck: [], discard: [],
        statusEffects: {}, tokens: {}, tokenStackLimits: {},
        damageShields: [], abilities: [], abilityLevels: {}, upgradeCardByAbilityId: {},
    };
    const state: DiceThroneCore = {
        players: { '0': attacker, '1': defender },
        selectedCharacters: { '0': 'moon_elf', '1': 'monk' },
        readyPlayers: { '0': true, '1': true },
        hostPlayerId: '0', hostStarted: true,
        dice: opts.dice ?? [1, 2, 3, 4, 5].map(v => createMoonElfDie(v)),
        rollCount: 1, rollLimit: 3, rollDiceCount: 5, rollConfirmed: false,
        activePlayerId: '0', startingPlayerId: '0', turnNumber: 1,
        pendingAttack: null, tokenDefinitions: [],
    };
    if (opts.pendingAttackFaceCounts) {
        state.pendingAttack = {
            attackerId: '0', defenderId: '1', isDefendable: true,
            damage: 5, bonusDamage: 0,
            attackDiceFaceCounts: opts.pendingAttackFaceCounts,
        } as any;
    }
    return state;
}

function buildCtx(
    state: DiceThroneCore, actionId: string,
    opts?: { random?: () => number; asDefender?: boolean }
): CustomActionContext {
    const attackerId = opts?.asDefender ? '0' : '0';
    const defenderId = opts?.asDefender ? '1' : '1';
    const effectCtx = {
        attackerId: attackerId as any, defenderId: defenderId as any,
        sourceAbilityId: actionId, state, damageDealt: 0, timestamp: 1000,
    };
    const randomFn = opts?.random
        ? {
            d: (n: number) => Math.ceil(opts.random!() * n),
            random: opts.random,
        } as any
        : undefined;
    return {
        ctx: effectCtx, targetId: '1' as any, attackerId: '0' as any,
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

describe('月精灵 Custom Action 运行时行为断言', () => {

    // ========================================================================
    // 长弓连击判定
    // ========================================================================
    describe('moon_elf-longbow-bonus-check-4 (长弓II连击：≥4同面→缠绕)', () => {
        it('4个相同骰面时施加缠绕', () => {
            const state = createState({
                pendingAttackFaceCounts: { [FACES.BOW]: 4, [FACES.FOOT]: 1 },
            });
            const handler = getCustomActionHandler('moon_elf-longbow-bonus-check-4')!;
            const events = handler(buildCtx(state, 'moon_elf-longbow-bonus-check-4'));

            const status = eventsOfType(events, 'STATUS_APPLIED');
            expect(status).toHaveLength(1);
            expect((status[0] as any).payload.statusId).toBe(STATUS_IDS.ENTANGLE);
        });

        it('不足4个相同骰面时不施加', () => {
            const state = createState({
                pendingAttackFaceCounts: { [FACES.BOW]: 3, [FACES.FOOT]: 2 },
            });
            const handler = getCustomActionHandler('moon_elf-longbow-bonus-check-4')!;
            const events = handler(buildCtx(state, 'moon_elf-longbow-bonus-check-4'));
            expect(events).toHaveLength(0);
        });

        it('无pendingAttack快照时不施加', () => {
            const state = createState({});
            const handler = getCustomActionHandler('moon_elf-longbow-bonus-check-4')!;
            const events = handler(buildCtx(state, 'moon_elf-longbow-bonus-check-4'));
            expect(events).toHaveLength(0);
        });
    });

    describe('moon_elf-longbow-bonus-check-3 (长弓III连击：≥3同面→缠绕)', () => {
        it('3个相同骰面时施加缠绕', () => {
            const state = createState({
                pendingAttackFaceCounts: { [FACES.BOW]: 3, [FACES.FOOT]: 2 },
            });
            const handler = getCustomActionHandler('moon_elf-longbow-bonus-check-3')!;
            const events = handler(buildCtx(state, 'moon_elf-longbow-bonus-check-3'));

            expect(eventsOfType(events, 'STATUS_APPLIED')).toHaveLength(1);
        });

        it('不足3个相同骰面时不施加', () => {
            const state = createState({
                pendingAttackFaceCounts: { [FACES.BOW]: 2, [FACES.FOOT]: 2, [FACES.MOON]: 1 },
            });
            const handler = getCustomActionHandler('moon_elf-longbow-bonus-check-3')!;
            const events = handler(buildCtx(state, 'moon_elf-longbow-bonus-check-3'));
            expect(events).toHaveLength(0);
        });
    });

    // ========================================================================
    // 爆裂箭结算
    // ========================================================================
    describe('moon_elf-exploding-arrow-resolve-1 (爆裂箭I：骰值伤害)', () => {
        it('5骰全BOW时造成13点伤害（3+2×5）', () => {
            const state = createState({});
            const handler = getCustomActionHandler('moon_elf-exploding-arrow-resolve-1')!;
            const events = handler(buildCtx(state, 'moon_elf-exploding-arrow-resolve-1', {
                random: () => 3 / 6, // d(6)→3 → BOW面，5骰全BOW
            }));

            const dmg = eventsOfType(events, 'DAMAGE_DEALT');
            expect(dmg).toHaveLength(1);
            expect((dmg[0] as any).payload.amount).toBe(13); // 3 + 2×5弓 + 1×0足
        });

        it('5骰全MOON时造成3点基础伤害', () => {
            const state = createState({});
            const handler = getCustomActionHandler('moon_elf-exploding-arrow-resolve-1')!;
            const events = handler(buildCtx(state, 'moon_elf-exploding-arrow-resolve-1', {
                random: () => 1, // d(6)→6 → MOON面，5骰全MOON
            }));

            expect((eventsOfType(events, 'DAMAGE_DEALT')[0] as any).payload.amount).toBe(3); // 3 + 0弓 + 0足
        });
    });

    describe('moon_elf-exploding-arrow-resolve-2 (爆炸射击II：5骰公式伤害+致盲)', () => {
        it('5骰2弓2足1月：造成9伤害，对手失去1CP，施加致盲（无缠绕）', () => {
            const state = createState({});
            state.players['1'].resources = { ...state.players['1'].resources, cp: 5 };
            const handler = getCustomActionHandler('moon_elf-exploding-arrow-resolve-2')!;
            // 5骰：值1→弓, 值2→弓, 值4→足, 值5→足, 值6→月
            let callIdx = 0;
            const diceQueue = [1, 2, 4, 5, 6];
            const events = handler(buildCtx(state, 'moon_elf-exploding-arrow-resolve-2', {
                random: () => diceQueue[callIdx++]! / 6,
            }));

            // 伤害 = 3 + 1×2弓 + 2×2足 = 9
            expect((eventsOfType(events, 'DAMAGE_DEALT')[0] as any).payload.amount).toBe(9);
            // 对手失去1CP（1月）
            const cpEvents = eventsOfType(events, 'CP_CHANGED');
            expect(cpEvents).toHaveLength(1);
            expect((cpEvents[0] as any).payload.delta).toBe(-1);
            // 施加致盲（II级无缠绕）
            const status = eventsOfType(events, 'STATUS_APPLIED');
            expect(status).toHaveLength(1);
            expect((status[0] as any).payload.statusId).toBe(STATUS_IDS.BLINDED);
        });
    });

    describe('moon_elf-exploding-arrow-resolve-3 (爆炸射击III：5骰公式伤害+致盲+缠绕)', () => {
        it('5骰2弓2足1月：造成9伤害，对手失去1CP，施加致盲和缠绕', () => {
            const state = createState({});
            state.players['1'].resources = { ...state.players['1'].resources, cp: 5 };
            const handler = getCustomActionHandler('moon_elf-exploding-arrow-resolve-3')!;
            // 5骰：值1→弓, 值2→弓, 值4→足, 值5→足, 值6→月
            let callIdx = 0;
            const diceQueue = [1, 2, 4, 5, 6];
            const events = handler(buildCtx(state, 'moon_elf-exploding-arrow-resolve-3', {
                random: () => diceQueue[callIdx++]! / 6,
            }));

            // 伤害 = 3 + 1×2弓 + 2×2足 = 9
            expect((eventsOfType(events, 'DAMAGE_DEALT')[0] as any).payload.amount).toBe(9);
            // 对手失去1CP（1月）
            const cpEvents = eventsOfType(events, 'CP_CHANGED');
            expect(cpEvents).toHaveLength(1);
            expect((cpEvents[0] as any).payload.delta).toBe(-1);
            // 施加致盲和缠绕
            const status = eventsOfType(events, 'STATUS_APPLIED');
            expect(status).toHaveLength(2);
            expect((status[0] as any).payload.statusId).toBe(STATUS_IDS.BLINDED);
            expect((status[1] as any).payload.statusId).toBe(STATUS_IDS.ENTANGLE);
        });
    });

    // ========================================================================
    // 迷影步结算
    // ========================================================================
    describe('moon_elf-elusive-step-resolve-1 (迷影步I)', () => {
        it('1个足面：造成1伤害，无减伤', () => {
            const dice = [1, 2, 3, 4, 1].map(v => createMoonElfDie(v)); // 1个foot(4)
            const state = createState({ dice });
            state.pendingAttack = { attackerId: '1', defenderId: '0', isDefendable: true, damage: 10, bonusDamage: 0 } as any;
            const handler = getCustomActionHandler('moon_elf-elusive-step-resolve-1')!;
            const events = handler(buildCtx(state, 'moon_elf-elusive-step-resolve-1'));

            const dmg = eventsOfType(events, 'DAMAGE_DEALT');
            expect(dmg).toHaveLength(1);
            expect((dmg[0] as any).payload.amount).toBe(1); // 1个足面 = 1伤害
            expect(eventsOfType(events, 'PREVENT_DAMAGE')).toHaveLength(0); // 不足2个足面，无减伤
        });

        it('2个足面：造成2伤害，抵挡一半伤害（向上取整）', () => {
            const dice = [1, 2, 3, 4, 5].map(v => createMoonElfDie(v)); // 2个foot(4,5)
            const state = createState({ dice });
            state.pendingAttack = { attackerId: '1', defenderId: '0', isDefendable: true, damage: 10, bonusDamage: 0 } as any;
            const handler = getCustomActionHandler('moon_elf-elusive-step-resolve-1')!;
            const events = handler(buildCtx(state, 'moon_elf-elusive-step-resolve-1'));

            expect((eventsOfType(events, 'DAMAGE_DEALT')[0] as any).payload.amount).toBe(2); // 2个足面 = 2伤害
            const prevent = eventsOfType(events, 'PREVENT_DAMAGE');
            expect(prevent).toHaveLength(1);
            expect((prevent[0] as any).payload.amount).toBe(5); // 10伤害 → 抵挡5 → 剩余5（向上取整）
        });

        it('3+个足面：造成对应伤害，抵挡一半伤害', () => {
            const dice = [4, 4, 5, 5, 4].map(v => createMoonElfDie(v)); // 5个foot
            const state = createState({ dice });
            state.pendingAttack = { attackerId: '1', defenderId: '0', isDefendable: true, damage: 10, bonusDamage: 0 } as any;
            const handler = getCustomActionHandler('moon_elf-elusive-step-resolve-1')!;
            const events = handler(buildCtx(state, 'moon_elf-elusive-step-resolve-1'));

            expect((eventsOfType(events, 'DAMAGE_DEALT')[0] as any).payload.amount).toBe(5); // 5个足面 = 5伤害
            const prevent = eventsOfType(events, 'PREVENT_DAMAGE');
            expect(prevent).toHaveLength(1);
            expect((prevent[0] as any).payload.amount).toBe(5); // 10伤害 → 抵挡5 → 剩余5
        });

        it('0个足面：无事件', () => {
            const dice = [1, 1, 1, 1, 1].map(v => createMoonElfDie(v)); // 全bow
            const state = createState({ dice });
            const handler = getCustomActionHandler('moon_elf-elusive-step-resolve-1')!;
            const events = handler(buildCtx(state, 'moon_elf-elusive-step-resolve-1'));
            expect(events).toHaveLength(0);
        });

        it('奇数伤害向上取整：9伤害→抵挡4→剩余5', () => {
            const dice = [4, 5, 1, 1, 1].map(v => createMoonElfDie(v)); // 2个foot
            const state = createState({ dice });
            state.pendingAttack = { attackerId: '1', defenderId: '0', isDefendable: true, damage: 9, bonusDamage: 0 } as any;
            const handler = getCustomActionHandler('moon_elf-elusive-step-resolve-1')!;
            const events = handler(buildCtx(state, 'moon_elf-elusive-step-resolve-1'));

            const prevent = eventsOfType(events, 'PREVENT_DAMAGE');
            expect((prevent[0] as any).payload.amount).toBe(4); // 9 / 2 = 4.5 → 向上取整5 → 抵挡4
        });
    });

    describe('moon_elf-elusive-step-resolve-2 (打不到我II)', () => {
        it('0弓2足：无伤害，有减伤（足≥2触发）', () => {
            // dice: [4,5,4,5,6] → 0弓, 4足, 1月
            const dice = [4, 5, 4, 5, 6].map(v => createMoonElfDie(v));
            const state = createState({ dice });
            state.pendingAttack = { attackerId: '1', defenderId: '0', isDefendable: true, damage: 10, bonusDamage: 0 } as any;
            const handler = getCustomActionHandler('moon_elf-elusive-step-resolve-2')!;
            const events = handler(buildCtx(state, 'moon_elf-elusive-step-resolve-2'));

            expect(eventsOfType(events, 'DAMAGE_DEALT')).toHaveLength(0); // 0弓→无伤害
            expect(eventsOfType(events, 'PREVENT_DAMAGE')).toHaveLength(1); // 足≥2→减伤
        });

        it('2弓2足：造成2伤害（弓面数），抵挡一半伤害', () => {
            // dice: [1,2,4,5,6] → 2弓, 2足, 1月
            const dice = [1, 2, 4, 5, 6].map(v => createMoonElfDie(v));
            const state = createState({ dice });
            state.pendingAttack = { attackerId: '1', defenderId: '0', isDefendable: true, damage: 10, bonusDamage: 0 } as any;
            const handler = getCustomActionHandler('moon_elf-elusive-step-resolve-2')!;
            const events = handler(buildCtx(state, 'moon_elf-elusive-step-resolve-2'));

            expect((eventsOfType(events, 'DAMAGE_DEALT')[0] as any).payload.amount).toBe(2); // 2弓→2伤害
            expect(eventsOfType(events, 'PREVENT_DAMAGE')).toHaveLength(1); // 足≥2→减伤
            expect(eventsOfType(events, 'TOKEN_GRANTED')).toHaveLength(0); // 无闪避效果
        });

        it('3弓1足：造成3伤害，无减伤（足<2）', () => {
            // dice: [1,2,3,4,6] → 3弓, 1足, 1月
            const dice = [1, 2, 3, 4, 6].map(v => createMoonElfDie(v));
            const state = createState({ dice });
            state.pendingAttack = { attackerId: '1', defenderId: '0', isDefendable: true, damage: 10, bonusDamage: 0 } as any;
            const handler = getCustomActionHandler('moon_elf-elusive-step-resolve-2')!;
            const events = handler(buildCtx(state, 'moon_elf-elusive-step-resolve-2'));

            expect((eventsOfType(events, 'DAMAGE_DEALT')[0] as any).payload.amount).toBe(3); // 3弓→3伤害
            expect(eventsOfType(events, 'PREVENT_DAMAGE')).toHaveLength(0); // 足<2→无减伤
        });

        it('5弓0足：造成5伤害，无减伤', () => {
            // dice: [1,1,2,2,3] → 5弓, 0足, 0月
            const dice = [1, 1, 2, 2, 3].map(v => createMoonElfDie(v));
            const state = createState({ dice });
            state.pendingAttack = { attackerId: '1', defenderId: '0', isDefendable: true, damage: 10, bonusDamage: 0 } as any;
            const handler = getCustomActionHandler('moon_elf-elusive-step-resolve-2')!;
            const events = handler(buildCtx(state, 'moon_elf-elusive-step-resolve-2'));

            expect((eventsOfType(events, 'DAMAGE_DEALT')[0] as any).payload.amount).toBe(5); // 5弓→5伤害
            expect(eventsOfType(events, 'PREVENT_DAMAGE')).toHaveLength(0); // 0足→无减伤
        });
    });

    // ========================================================================
    // 行动卡
    // ========================================================================
    describe('moon_elf-action-moon-shadow-strike (月影突袭)', () => {
        it('投出弓面时抽1牌（非月面→抽牌）', () => {
            const state = createState({});
            state.players['0'].deck = [{ id: 'c1' } as any];
            const handler = getCustomActionHandler('moon_elf-action-moon-shadow-strike')!;
            const events = handler(buildCtx(state, 'moon_elf-action-moon-shadow-strike', {
                random: () => 1 / 6, // d(6)→1 → bow
            }));

            expect(eventsOfType(events, 'CARD_DRAWN')).toHaveLength(1);
        });

        it('投出足面时抽1牌（非月面→抽牌）', () => {
            const state = createState({});
            state.players['0'].deck = [{ id: 'c1' } as any];
            const handler = getCustomActionHandler('moon_elf-action-moon-shadow-strike')!;
            const events = handler(buildCtx(state, 'moon_elf-action-moon-shadow-strike', {
                random: () => 4 / 6, // d(6)→4 → foot
            }));

            // 非月面→抽1牌（i18n描述："否则抽取1张牌"）
            expect(eventsOfType(events, 'CARD_DRAWN')).toHaveLength(1);
            expect(eventsOfType(events, 'STATUS_APPLIED')).toHaveLength(0);
        });

        it('投出月面时施加致盲+缠绕+锁定', () => {
            const state = createState({});
            const handler = getCustomActionHandler('moon_elf-action-moon-shadow-strike')!;
            const events = handler(buildCtx(state, 'moon_elf-action-moon-shadow-strike', {
                random: () => 1, // d(6)→6 → moon
            }));

            // 月面→致盲+缠绕+锁定（i18n描述："施加致盲、缠绕和锁定"）
            const status = eventsOfType(events, 'STATUS_APPLIED');
            expect(status).toHaveLength(3);
            expect((status[0] as any).payload.statusId).toBe(STATUS_IDS.BLINDED);
            expect((status[1] as any).payload.statusId).toBe(STATUS_IDS.ENTANGLE);
            expect((status[2] as any).payload.statusId).toBe(STATUS_IDS.TARGETED);
        });
    });

    describe('moon_elf-action-volley (齐射：弓面数伤害+缠绕)', () => {
        it('5骰全弓时增加bonusDamage 5点并施加缠绕', () => {
            const state = createState({});
            state.pendingAttack = {
                attackerId: '0', defenderId: '1', isDefendable: true,
                damage: 5, bonusDamage: 0,
            } as any;
            const handler = getCustomActionHandler('moon_elf-action-volley')!;
            // 全部投出弓面（value 1-3 都是弓）
            const events = handler(buildCtx(state, 'moon_elf-action-volley', {
                random: () => 1 / 6, // d(6)→1 → bow
            }));

            // 5个弓面 → bonusDamage +5
            expect(state.pendingAttack!.bonusDamage).toBe(5);
            // 施加缠绕
            const status = eventsOfType(events, 'STATUS_APPLIED');
            expect(status).toHaveLength(1);
            expect((status[0] as any).payload.statusId).toBe(STATUS_IDS.ENTANGLE);
        });

        it('5骰3弓2非弓时增加bonusDamage 3点', () => {
            const state = createState({});
            state.pendingAttack = {
                attackerId: '0', defenderId: '1', isDefendable: true,
                damage: 5, bonusDamage: 0,
            } as any;
            const handler = getCustomActionHandler('moon_elf-action-volley')!;
            // 模拟3弓2非弓：前3次返回弓(1/6→1)，后2次返回足(4/6→4)
            let callCount = 0;
            const events = handler(buildCtx(state, 'moon_elf-action-volley', {
                random: () => { callCount++; return callCount <= 3 ? 1 / 6 : 4 / 6; },
            }));

            expect(state.pendingAttack!.bonusDamage).toBe(3);
            expect(eventsOfType(events, 'STATUS_APPLIED')).toHaveLength(1);
        });
    });

    describe('moon_elf-action-watch-out (看箭！)', () => {
        it('投出弓面时增加2伤害', () => {
            const state = createState({});
            state.pendingAttack = {
                attackerId: '0', defenderId: '1', isDefendable: true,
                damage: 5, bonusDamage: 0,
            } as any;
            const handler = getCustomActionHandler('moon_elf-action-watch-out')!;
            const events = handler(buildCtx(state, 'moon_elf-action-watch-out', {
                random: () => 1 / 6, // d(6)→1 → bow
            }));

            // 弓→+2伤害（修改 pendingAttack.bonusDamage）
            expect(state.pendingAttack!.bonusDamage).toBe(2);
            expect(eventsOfType(events, 'STATUS_APPLIED')).toHaveLength(0);
        });

        it('投出足面时施加缠绕', () => {
            const state = createState({});
            const handler = getCustomActionHandler('moon_elf-action-watch-out')!;
            const events = handler(buildCtx(state, 'moon_elf-action-watch-out', {
                random: () => 4 / 6, // d(6)→4 → foot
            }));

            const status = eventsOfType(events, 'STATUS_APPLIED');
            expect(status).toHaveLength(1);
            expect((status[0] as any).payload.statusId).toBe(STATUS_IDS.ENTANGLE);
        });

        it('投出月面时施加致盲', () => {
            const state = createState({});
            const handler = getCustomActionHandler('moon_elf-action-watch-out')!;
            const events = handler(buildCtx(state, 'moon_elf-action-watch-out', {
                random: () => 1, // d(6)→6 → moon
            }));

            const status = eventsOfType(events, 'STATUS_APPLIED');
            expect(status).toHaveLength(1);
            expect((status[0] as any).payload.statusId).toBe(STATUS_IDS.BLINDED);
        });
    });

    // ========================================================================
    // 状态效果钩子
    // ========================================================================
    describe('moon_elf-blinded-check (致盲判定)', () => {
        it('投1-2时标记攻击无效', () => {
            const state = createState({});
            state.players['0'].statusEffects[STATUS_IDS.BLINDED] = 1;
            state.pendingAttack = {
                attackerId: '0', defenderId: '1', isDefendable: true,
                damage: 5, bonusDamage: 0, sourceAbilityId: 'test',
            } as any;
            const handler = getCustomActionHandler('moon_elf-blinded-check')!;
            const events = handler(buildCtx(state, 'moon_elf-blinded-check', {
                random: () => 1 / 6, // d(6)→1 → 失败
            }));

            // 移除致盲
            expect(eventsOfType(events, 'STATUS_REMOVED')).toHaveLength(1);
            // 攻击无效
            expect(state.pendingAttack!.sourceAbilityId).toBeUndefined();
        });

        it('投3-6时攻击正常', () => {
            const state = createState({});
            state.players['0'].statusEffects[STATUS_IDS.BLINDED] = 1;
            state.pendingAttack = {
                attackerId: '0', defenderId: '1', isDefendable: true,
                damage: 5, bonusDamage: 0, sourceAbilityId: 'test',
            } as any;
            const handler = getCustomActionHandler('moon_elf-blinded-check')!;
            const events = handler(buildCtx(state, 'moon_elf-blinded-check', {
                random: () => 3 / 6, // d(6)→3 → 成功
            }));

            expect(eventsOfType(events, 'STATUS_REMOVED')).toHaveLength(1);
            expect(state.pendingAttack!.sourceAbilityId).toBe('test'); // 保持不变
        });
    });

    describe('moon_elf-entangle-effect (缠绕效果：掷骰次数-1)', () => {
        it('减少1次掷骰机会并移除缠绕', () => {
            const state = createState({});
            state.players['0'].statusEffects[STATUS_IDS.ENTANGLE] = 1;
            const handler = getCustomActionHandler('moon_elf-entangle-effect')!;
            const events = handler(buildCtx(state, 'moon_elf-entangle-effect'));

            const rollLimit = eventsOfType(events, 'ROLL_LIMIT_CHANGED');
            expect(rollLimit).toHaveLength(1);
            expect((rollLimit[0] as any).payload.newLimit).toBe(2); // 3-1
            expect(eventsOfType(events, 'STATUS_REMOVED')).toHaveLength(1);
        });
    });

    describe('锁定 (Targeted) 持续效果验证', () => {
        it('锁定使受到的伤害+2（通过 tokenDefinitions 的 onDamageReceived 触发）', async () => {
            // 锁定的 +2 伤害通过 TokenDef.passiveTrigger.actions[modifyStat] 实现，
            // 由 createDamageCalculation 的 collectStatusModifiers 自动处理。
            // 这里验证 TokenDef 配置正确性。
            const { MOON_ELF_TOKENS } = await import('../heroes/moon_elf/tokens');
            const targetedDef = MOON_ELF_TOKENS.find((t: any) => t.id === STATUS_IDS.TARGETED);
            expect(targetedDef).toBeDefined();
            expect(targetedDef!.category).toBe('debuff');
            expect(targetedDef!.stackLimit).toBe(1);
            expect(targetedDef!.passiveTrigger?.timing).toBe('onDamageReceived');
            // 只有 modifyStat +2，没有 removeStatus
            const actions = targetedDef!.passiveTrigger?.actions ?? [];
            expect(actions).toHaveLength(1);
            expect(actions[0].type).toBe('modifyStat');
            expect(actions[0].value).toBe(2);
        });

        it('锁定是持续效果，不会在受伤后自动移除', async () => {
            const { MOON_ELF_TOKENS } = await import('../heroes/moon_elf/tokens');
            const targetedDef = MOON_ELF_TOKENS.find((t: any) => t.id === STATUS_IDS.TARGETED);
            const actions = targetedDef!.passiveTrigger?.actions ?? [];
            // 确认没有 removeStatus action
            const removeActions = actions.filter((a: any) => a.type === 'removeStatus');
            expect(removeActions).toHaveLength(0);
        });

        it('moon_elf-targeted-removal handler 已被移除', () => {
            const handler = getCustomActionHandler('moon_elf-targeted-removal');
            expect(handler).toBeUndefined();
        });
    });
});
