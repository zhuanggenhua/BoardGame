/**
 * 影子盗贼 (Shadow Thief) Custom Action 运行时行为断言测试
 */

import { describe, it, expect } from 'vitest';
import { STATUS_IDS, TOKEN_IDS, SHADOW_THIEF_DICE_FACE_IDS as FACES } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import { CP_MAX } from '../domain/types';
import type { DiceThroneCore, Die, HeroState, DiceThroneEvent } from '../domain/types';
import { getCustomActionHandler } from '../domain/effects';
import type { CustomActionContext } from '../domain/effects';
import { initializeCustomActions } from '../domain/customActions';
import { registerDiceDefinition } from '../domain/diceRegistry';
import { shadowThiefDiceDefinition } from '../heroes/shadow_thief/diceConfig';

initializeCustomActions();
registerDiceDefinition(shadowThiefDiceDefinition);

// ============================================================================
// 测试工具
// ============================================================================

function createShadowDie(value: number): Die {
    const faceMap: Record<number, string> = {
        1: FACES.DAGGER, 2: FACES.DAGGER,
        3: FACES.BAG, 4: FACES.BAG,
        5: FACES.CARD,
        6: FACES.SHADOW,
    };
    return {
        id: 0, definitionId: 'shadow_thief-dice', value,
        symbol: faceMap[value] as any, symbols: [faceMap[value]], isKept: false,
    };
}

function createState(opts: {
    dice?: Die[];
    attackerHP?: number;
    defenderHP?: number;
    attackerCP?: number;
    defenderCP?: number;
    attackerSneak?: number;
    attackerSneakAttack?: number;
    defenderHand?: any[];
    attackerHand?: any[];
}): DiceThroneCore {
    const attacker: HeroState = {
        id: '0', characterId: 'shadow_thief',
        resources: {
            [RESOURCE_IDS.HP]: opts.attackerHP ?? 50,
            [RESOURCE_IDS.CP]: opts.attackerCP ?? 5,
        },
        hand: opts.attackerHand ?? [], deck: [{ id: 'd1' } as any, { id: 'd2' } as any], discard: [],
        statusEffects: {},
        tokens: {
            [TOKEN_IDS.SNEAK]: opts.attackerSneak ?? 0,
            [TOKEN_IDS.SNEAK_ATTACK]: opts.attackerSneakAttack ?? 0,
        },
        tokenStackLimits: { [TOKEN_IDS.SNEAK]: 3, [TOKEN_IDS.SNEAK_ATTACK]: 3 },
        damageShields: [], abilities: [], abilityLevels: {}, upgradeCardByAbilityId: {},
    };
    const defender: HeroState = {
        id: '1', characterId: 'monk',
        resources: {
            [RESOURCE_IDS.HP]: opts.defenderHP ?? 50,
            [RESOURCE_IDS.CP]: opts.defenderCP ?? 5,
        },
        hand: opts.defenderHand ?? [{ id: 'h1' } as any], deck: [], discard: [],
        statusEffects: {}, tokens: {}, tokenStackLimits: {},
        damageShields: [], abilities: [], abilityLevels: {}, upgradeCardByAbilityId: {},
    };
    return {
        players: { '0': attacker, '1': defender },
        selectedCharacters: { '0': 'shadow_thief', '1': 'monk' },
        readyPlayers: { '0': true, '1': true },
        hostPlayerId: '0', hostStarted: true,
        dice: opts.dice ?? [1, 2, 3, 4, 5].map(v => createShadowDie(v)),
        rollCount: 1, rollLimit: 3, rollDiceCount: 5, rollConfirmed: false,
        activePlayerId: '0', startingPlayerId: '0', turnNumber: 1,
        pendingAttack: null, tokenDefinitions: [],
    };
}

function buildCtx(
    state: DiceThroneCore, actionId: string,
    opts?: { random?: () => number; params?: Record<string, any>; asDefender?: boolean }
): CustomActionContext {
    // 防御上下文约定（与 attack.ts 一致）：
    //   effectCtx.attackerId = 防御者（使用防御技能的人）= '0'
    //   effectCtx.defenderId = 原攻击者（被防御技能影响的人）= '1'
    const ctxAttackerId = opts?.asDefender ? '0' : '0';
    const ctxDefenderId = opts?.asDefender ? '1' : '1';
    const effectCtx = {
        attackerId: ctxAttackerId as any, defenderId: ctxDefenderId as any,
        sourceAbilityId: actionId, state, damageDealt: 0, timestamp: 1000,
    };
    const randomFn = opts?.random
        ? {
            d: (n: number) => Math.ceil(opts.random!() * n),
            random: opts.random,
        } as any
        : undefined;
    // 防御技能中 attackerId=防御者自己(0)，targetId 取决于 ability 定义的 target 字段
    // 防御技能的 target='self' → targetId=防御者(0)，target='opponent' → targetId=原攻击者(1)
    const selfId = '0';
    const opponentId = '1';
    return {
        ctx: effectCtx,
        targetId: opponentId as any,
        attackerId: selfId as any,
        sourceAbilityId: actionId, state, timestamp: 1000, random: randomFn,
        action: { type: 'custom', customActionId: actionId, params: opts?.params },
    };
}

function eventsOfType(events: DiceThroneEvent[], type: string) {
    return events.filter(e => e.type === type);
}

// ============================================================================
// 测试套件
// ============================================================================

describe('影子盗贼 Custom Action 运行时行为断言', () => {

    // ========================================================================
    // 匕首打击
    // ========================================================================
    describe('shadow_thief-dagger-strike-cp (匕首打击：Bag→CP)', () => {
        it('2个Bag面获得2CP', () => {
            // 默认骰子: dagger,dagger,bag,bag,card → 2个bag
            const state = createState({});
            const handler = getCustomActionHandler('shadow_thief-dagger-strike-cp')!;
            const events = handler(buildCtx(state, 'shadow_thief-dagger-strike-cp'));

            const cp = eventsOfType(events, 'CP_CHANGED');
            expect(cp).toHaveLength(1);
            expect((cp[0] as any).payload.delta).toBe(2);
        });

        it('0个Bag面不获得CP', () => {
            const dice = [1, 1, 1, 1, 1].map(v => createShadowDie(v)); // 全dagger
            const state = createState({ dice });
            const handler = getCustomActionHandler('shadow_thief-dagger-strike-cp')!;
            const events = handler(buildCtx(state, 'shadow_thief-dagger-strike-cp'));
            expect(events).toHaveLength(0);
        });
    });

    describe('shadow_thief-dagger-strike-poison (匕首打击：Shadow→毒液)', () => {
        it('有Shadow面时施加毒液', () => {
            const dice = [1, 2, 3, 4, 6].map(v => createShadowDie(v)); // 1个shadow
            const state = createState({ dice });
            const handler = getCustomActionHandler('shadow_thief-dagger-strike-poison')!;
            const events = handler(buildCtx(state, 'shadow_thief-dagger-strike-poison'));

            const status = eventsOfType(events, 'STATUS_APPLIED');
            expect(status).toHaveLength(1);
            expect((status[0] as any).payload.statusId).toBe(STATUS_IDS.POISON);
        });

        it('无Shadow面时不施加', () => {
            const dice = [1, 2, 3, 4, 5].map(v => createShadowDie(v)); // 无shadow
            const state = createState({ dice });
            const handler = getCustomActionHandler('shadow_thief-dagger-strike-poison')!;
            const events = handler(buildCtx(state, 'shadow_thief-dagger-strike-poison'));
            expect(events).toHaveLength(0);
        });
    });

    describe('shadow_thief-dagger-strike-draw (匕首打击II：Card→抽牌)', () => {
        it('1个Card面抽1牌', () => {
            // 默认骰子有1个card(值5)
            const state = createState({});
            const handler = getCustomActionHandler('shadow_thief-dagger-strike-draw')!;
            const events = handler(buildCtx(state, 'shadow_thief-dagger-strike-draw', {
                random: () => 0.5,
            }));

            expect(eventsOfType(events, 'CARD_DRAWN')).toHaveLength(1);
        });
    });

    // ========================================================================
    // CP伤害
    // ========================================================================
    describe('shadow_thief-damage-half-cp (抢夺：一半CP伤害)', () => {
        it('CP=10时造成5点伤害', () => {
            const state = createState({ attackerCP: 10 });
            const handler = getCustomActionHandler('shadow_thief-damage-half-cp')!;
            const events = handler(buildCtx(state, 'shadow_thief-damage-half-cp'));

            const dmg = eventsOfType(events, 'DAMAGE_DEALT');
            expect(dmg).toHaveLength(1);
            expect((dmg[0] as any).payload.amount).toBe(5);
        });

        it('CP=7时造成4点伤害（向上取整）', () => {
            const state = createState({ attackerCP: 7 });
            const handler = getCustomActionHandler('shadow_thief-damage-half-cp')!;
            const events = handler(buildCtx(state, 'shadow_thief-damage-half-cp'));

            expect((eventsOfType(events, 'DAMAGE_DEALT')[0] as any).payload.amount).toBe(4);
        });

        it('CP=0时不造成伤害', () => {
            const state = createState({ attackerCP: 0 });
            const handler = getCustomActionHandler('shadow_thief-damage-half-cp')!;
            const events = handler(buildCtx(state, 'shadow_thief-damage-half-cp'));
            expect(events).toHaveLength(0);
        });
    });

    describe('shadow_thief-damage-full-cp (肾击：全部CP伤害)', () => {
        it('CP=8时造成8点伤害', () => {
            const state = createState({ attackerCP: 8 });
            const handler = getCustomActionHandler('shadow_thief-damage-full-cp')!;
            const events = handler(buildCtx(state, 'shadow_thief-damage-full-cp'));

            expect((eventsOfType(events, 'DAMAGE_DEALT')[0] as any).payload.amount).toBe(8);
        });
    });

    // ========================================================================
    // 偷取CP
    // ========================================================================
    describe('shadow_thief-steal-cp (偷取CP)', () => {
        it('有Shadow面时偷取对手CP并获得2CP', () => {
            const dice = [1, 2, 3, 4, 6].map(v => createShadowDie(v)); // 有shadow
            const state = createState({ dice, defenderCP: 10 });
            const handler = getCustomActionHandler('shadow_thief-steal-cp')!;
            const events = handler(buildCtx(state, 'shadow_thief-steal-cp'));

            const cpEvents = eventsOfType(events, 'CP_CHANGED');
            // 对手-2, 自己+2
            expect(cpEvents).toHaveLength(2);
            expect((cpEvents[0] as any).payload.delta).toBe(-2); // 偷取
            expect((cpEvents[1] as any).payload.delta).toBe(2); // 获得
        });

        it('无Shadow面时只获得2CP', () => {
            const dice = [1, 2, 3, 4, 5].map(v => createShadowDie(v)); // 无shadow
            const state = createState({ dice });
            const handler = getCustomActionHandler('shadow_thief-steal-cp')!;
            const events = handler(buildCtx(state, 'shadow_thief-steal-cp'));

            const cpEvents = eventsOfType(events, 'CP_CHANGED');
            expect(cpEvents).toHaveLength(1);
            expect((cpEvents[0] as any).payload.delta).toBe(2);
        });
    });

    // ========================================================================
    // 暗影之舞
    // ========================================================================
    describe('shadow_thief-shadow-dance-roll (暗影之舞I：骰值/2伤害)', () => {
        it('投出6时造成3点伤害', () => {
            const state = createState({});
            const handler = getCustomActionHandler('shadow_thief-shadow-dance-roll')!;
            const events = handler(buildCtx(state, 'shadow_thief-shadow-dance-roll', {
                random: () => 1, // d(6)→6
            }));

            const dmg = eventsOfType(events, 'DAMAGE_DEALT');
            expect(dmg).toHaveLength(1);
            expect((dmg[0] as any).payload.amount).toBe(3); // ceil(6/2)
        });

        it('投出3时造成2点伤害', () => {
            const state = createState({});
            const handler = getCustomActionHandler('shadow_thief-shadow-dance-roll')!;
            const events = handler(buildCtx(state, 'shadow_thief-shadow-dance-roll', {
                random: () => 3 / 6,
            }));

            expect((eventsOfType(events, 'DAMAGE_DEALT')[0] as any).payload.amount).toBe(2); // ceil(3/2)
        });
    });

    describe('shadow_thief-shadow-dance-roll-2 (暗影之舞II：真实伤害+SNEAK+SNEAK_ATTACK+抽牌)', () => {
        it('投出4时造成2点真实伤害，获得SNEAK和SNEAK_ATTACK，抽1牌', () => {
            const state = createState({});
            const handler = getCustomActionHandler('shadow_thief-shadow-dance-roll-2')!;
            const events = handler(buildCtx(state, 'shadow_thief-shadow-dance-roll-2', {
                random: () => 4 / 6,
            }));

            // 伤害
            const dmg = eventsOfType(events, 'DAMAGE_DEALT');
            expect(dmg).toHaveLength(1);
            expect((dmg[0] as any).payload.amount).toBe(2); // ceil(4/2)

            // Token: SNEAK + SNEAK_ATTACK
            const tokens = eventsOfType(events, 'TOKEN_GRANTED');
            expect(tokens).toHaveLength(2);

            // 抽牌
            expect(eventsOfType(events, 'CARD_DRAWN')).toHaveLength(1);
        });
    });

    // ========================================================================
    // 聚宝盆
    // ========================================================================
    describe('shadow_thief-cornucopia-discard (聚宝盆I：Shadow→弃对手牌)', () => {
        it('有Shadow面时弃对手1牌', () => {
            const dice = [1, 2, 3, 4, 6].map(v => createShadowDie(v));
            const state = createState({ dice, defenderHand: [{ id: 'h1' }] });
            const handler = getCustomActionHandler('shadow_thief-cornucopia-discard')!;
            const events = handler(buildCtx(state, 'shadow_thief-cornucopia-discard', {
                random: () => 0,
            }));

            expect(eventsOfType(events, 'CARD_DISCARDED')).toHaveLength(1);
        });

        it('无Shadow面时不弃牌', () => {
            const dice = [1, 2, 3, 4, 5].map(v => createShadowDie(v));
            const state = createState({ dice });
            const handler = getCustomActionHandler('shadow_thief-cornucopia-discard')!;
            const events = handler(buildCtx(state, 'shadow_thief-cornucopia-discard', {
                random: () => 0,
            }));
            expect(events).toHaveLength(0);
        });
    });

    // ========================================================================
    // 终极：Shadow Shank
    // ========================================================================
    describe('shadow_thief-shadow-shank-damage (暗影匕首：CP+5伤害)', () => {
        it('CP=8时造成13点伤害', () => {
            const state = createState({ attackerCP: 8 });
            const handler = getCustomActionHandler('shadow_thief-shadow-shank-damage')!;
            const events = handler(buildCtx(state, 'shadow_thief-shadow-shank-damage'));

            expect((eventsOfType(events, 'DAMAGE_DEALT')[0] as any).payload.amount).toBe(13);
        });

        it('CP=0时造成5点伤害', () => {
            const state = createState({ attackerCP: 0 });
            const handler = getCustomActionHandler('shadow_thief-shadow-shank-damage')!;
            const events = handler(buildCtx(state, 'shadow_thief-shadow-shank-damage'));

            expect((eventsOfType(events, 'DAMAGE_DEALT')[0] as any).payload.amount).toBe(5);
        });
    });

    // ========================================================================
    // 防御
    // ========================================================================
    describe('shadow_thief-defense-resolve (暗影防御I)', () => {
        it('匕首面造成伤害给原攻击者，背包面自己抽牌，暗影面自己获得护盾', () => {
            // 骰子: dagger,dagger,bag,bag,shadow → 2匕首,2背包,1暗影（防御用4骰但这里用5骰模拟）
            const dice = [1, 2, 3, 4, 6].map(v => createShadowDie(v));
            const state = createState({ dice });
            const handler = getCustomActionHandler('shadow_thief-defense-resolve')!;
            const events = handler(buildCtx(state, 'shadow_thief-defense-resolve', {
                asDefender: true,
                random: () => 0.5,
            }));

            // 2匕首 → 2伤害，目标是原攻击者('1')
            const dmg = eventsOfType(events, 'DAMAGE_DEALT');
            expect(dmg).toHaveLength(1);
            expect((dmg[0] as any).payload.amount).toBe(2);
            expect((dmg[0] as any).payload.targetId).toBe('1'); // 原攻击者

            // 2背包 → 抽2牌（防御者自己'0'抽）
            const draws = eventsOfType(events, 'CARD_DRAWN');
            expect(draws).toHaveLength(2);

            // 1暗影 → 1护盾（防御者自己'0'获得）
            const shield = eventsOfType(events, 'DAMAGE_SHIELD_GRANTED');
            expect(shield).toHaveLength(1);
            expect((shield[0] as any).payload.value).toBe(1);
            expect((shield[0] as any).payload.targetId).toBe('0'); // 防御者自己
        });
    });

    describe('shadow_thief-defense-resolve-2 (暗影防御II)', () => {
        it('2匕首施加毒液给原攻击者', () => {
            const dice = [1, 2, 3, 4, 5].map(v => createShadowDie(v)); // 2 dagger
            const state = createState({ dice });
            const handler = getCustomActionHandler('shadow_thief-defense-resolve-2')!;
            const events = handler(buildCtx(state, 'shadow_thief-defense-resolve-2', { asDefender: true }));

            const status = eventsOfType(events, 'STATUS_APPLIED');
            expect(status).toHaveLength(1);
            expect((status[0] as any).payload.statusId).toBe('poison');
            expect((status[0] as any).payload.targetId).toBe('1'); // 原攻击者
        });

        it('1暗影获得SNEAK_ATTACK（给防御者自己）', () => {
            const dice = [1, 3, 3, 5, 6].map(v => createShadowDie(v)); // 1 shadow
            const state = createState({ dice });
            const handler = getCustomActionHandler('shadow_thief-defense-resolve-2')!;
            const events = handler(buildCtx(state, 'shadow_thief-defense-resolve-2', { asDefender: true }));

            const tokens = eventsOfType(events, 'TOKEN_GRANTED');
            expect(tokens.some((t: any) => t.payload.tokenId === TOKEN_IDS.SNEAK_ATTACK)).toBe(true);
            // Token 给防御者自己
            tokens.forEach((t: any) => {
                expect(t.payload.targetId).toBe('0'); // 防御者自己
            });
        });

        it('2暗影获得SNEAK+SNEAK_ATTACK+999护盾（全部给防御者自己）', () => {
            const dice = [1, 3, 6, 6, 5].map(v => createShadowDie(v)); // 2 shadow
            const state = createState({ dice });
            const handler = getCustomActionHandler('shadow_thief-defense-resolve-2')!;
            const events = handler(buildCtx(state, 'shadow_thief-defense-resolve-2', { asDefender: true }));

            const tokens = eventsOfType(events, 'TOKEN_GRANTED');
            // 1 shadow → 1 SNEAK_ATTACK, 2 shadow → SNEAK + SNEAK_ATTACK
            expect(tokens.length).toBeGreaterThanOrEqual(3);
            // 所有 Token 给防御者自己
            tokens.forEach((t: any) => {
                expect(t.payload.targetId).toBe('0'); // 防御者自己
            });
            const shield = eventsOfType(events, 'DAMAGE_SHIELD_GRANTED');
            expect(shield).toHaveLength(1);
            expect((shield[0] as any).payload.value).toBe(999);
            expect((shield[0] as any).payload.targetId).toBe('0'); // 防御者自己
        });
    });

    // ========================================================================
    // 恐惧反击
    // ========================================================================
    describe('shadow_thief-fearless-riposte (恐惧反击I)', () => {
        it('匕首面造成伤害给原攻击者，匕首+暗影施加毒液给原攻击者', () => {
            const dice = [1, 2, 3, 4, 6].map(v => createShadowDie(v)); // 2 dagger + 1 shadow
            const state = createState({ dice });
            const handler = getCustomActionHandler('shadow_thief-fearless-riposte')!;
            const events = handler(buildCtx(state, 'shadow_thief-fearless-riposte', { asDefender: true }));

            const dmg = eventsOfType(events, 'DAMAGE_DEALT');
            expect(dmg).toHaveLength(1);
            expect((dmg[0] as any).payload.amount).toBe(2); // 2 daggers
            expect((dmg[0] as any).payload.targetId).toBe('1'); // 原攻击者

            const status = eventsOfType(events, 'STATUS_APPLIED');
            expect(status).toHaveLength(1);
            expect((status[0] as any).payload.targetId).toBe('1'); // 原攻击者
        });
    });

    describe('shadow_thief-fearless-riposte-2 (恐惧反击II)', () => {
        it('匕首面造成2×匕首伤害给原攻击者', () => {
            const dice = [1, 2, 3, 4, 6].map(v => createShadowDie(v)); // 2 dagger
            const state = createState({ dice });
            const handler = getCustomActionHandler('shadow_thief-fearless-riposte-2')!;
            const events = handler(buildCtx(state, 'shadow_thief-fearless-riposte-2', { asDefender: true }));

            const dmg = eventsOfType(events, 'DAMAGE_DEALT');
            expect((dmg[0] as any).payload.amount).toBe(4); // 2×2
            expect((dmg[0] as any).payload.targetId).toBe('1'); // 原攻击者
        });
    });

    // ========================================================================
    // 行动卡
    // ========================================================================
    describe('shadow_thief-one-with-shadows (与影共生)', () => {
        it('投出Shadow面获得SNEAK_ATTACK+2CP', () => {
            const state = createState({});
            const handler = getCustomActionHandler('shadow_thief-one-with-shadows')!;
            // 与影共生是自我增益，targetId=自己('0')
            const ctx = buildCtx(state, 'shadow_thief-one-with-shadows', {
                random: () => 1, // d(6)→6 → shadow
            });
            ctx.targetId = '0' as any;
            const events = handler(ctx);

            const tokens = eventsOfType(events, 'TOKEN_GRANTED');
            expect(tokens).toHaveLength(1);
            expect((tokens[0] as any).payload.tokenId).toBe(TOKEN_IDS.SNEAK_ATTACK);

            const cp = eventsOfType(events, 'CP_CHANGED');
            expect(cp).toHaveLength(1);
            expect((cp[0] as any).payload.delta).toBe(2);
        });

        it('投出非Shadow面抽1牌', () => {
            const state = createState({});
            const handler = getCustomActionHandler('shadow_thief-one-with-shadows')!;
            const ctx = buildCtx(state, 'shadow_thief-one-with-shadows', {
                random: () => 1 / 6, // d(6)→1 → dagger
            });
            ctx.targetId = '0' as any;
            const events = handler(ctx);

            expect(eventsOfType(events, 'TOKEN_GRANTED')).toHaveLength(0);
            expect(eventsOfType(events, 'CARD_DRAWN')).toHaveLength(1);
        });
    });

    describe('shadow_thief-card-trick (卡牌戏法：弃对手1+抽1/2)', () => {
        it('无潜行时弃对手1牌+抽1牌', () => {
            const state = createState({ defenderHand: [{ id: 'h1' }] });
            const handler = getCustomActionHandler('shadow_thief-card-trick')!;
            const events = handler(buildCtx(state, 'shadow_thief-card-trick', {
                random: () => 0,
            }));

            expect(eventsOfType(events, 'CARD_DISCARDED')).toHaveLength(1);
            expect(eventsOfType(events, 'CARD_DRAWN')).toHaveLength(1);
        });

        it('有潜行时弃对手1牌+抽2牌', () => {
            const state = createState({ attackerSneak: 1, defenderHand: [{ id: 'h1' }] });
            const handler = getCustomActionHandler('shadow_thief-card-trick')!;
            const events = handler(buildCtx(state, 'shadow_thief-card-trick', {
                random: () => 0,
            }));

            expect(eventsOfType(events, 'CARD_DISCARDED')).toHaveLength(1);
            expect(eventsOfType(events, 'CARD_DRAWN')).toHaveLength(2);
        });
    });

    // ========================================================================
    // 潜行防御
    // ========================================================================
    describe('shadow_thief-sneak-prevent (潜行：免除伤害)', () => {
        it('消耗1层SNEAK并免除伤害', () => {
            const state = createState({ attackerSneak: 2 });
            const handler = getCustomActionHandler('shadow_thief-sneak-prevent')!;
            const events = handler(buildCtx(state, 'shadow_thief-sneak-prevent', {
                params: { damageAmount: 5, tokenStacks: 2 },
            }));

            const consumed = eventsOfType(events, 'TOKEN_CONSUMED');
            expect(consumed).toHaveLength(1);
            expect((consumed[0] as any).payload.amount).toBe(1);

            const prevent = eventsOfType(events, 'PREVENT_DAMAGE');
            expect(prevent).toHaveLength(1);
            expect((prevent[0] as any).payload.amount).toBe(5);
        });

        it('无SNEAK时不生成事件', () => {
            const state = createState({ attackerSneak: 0 });
            const handler = getCustomActionHandler('shadow_thief-sneak-prevent')!;
            const events = handler(buildCtx(state, 'shadow_thief-sneak-prevent', {
                params: { damageAmount: 5, tokenStacks: 0 },
            }));
            expect(events).toHaveLength(0);
        });
    });

    // ========================================================================
    // 伏击
    // ========================================================================
    describe('shadow_thief-sneak-attack-use (伏击：骰值加伤)', () => {
        it('投出5时增加5点伤害到pendingAttack', () => {
            const state = createState({});
            state.pendingAttack = {
                attackerId: '0', defenderId: '1', isDefendable: true,
                damage: 3, bonusDamage: 0,
            } as any;
            const handler = getCustomActionHandler('shadow_thief-sneak-attack-use')!;
            const events = handler(buildCtx(state, 'shadow_thief-sneak-attack-use', {
                random: () => 5 / 6, // d(6)→5
            }));

            expect(eventsOfType(events, 'BONUS_DIE_ROLLED')).toHaveLength(1);
            expect(state.pendingAttack!.damage).toBe(8); // 3+5
        });
    });

    // ========================================================================
    // 移除负面状态
    // ========================================================================
    describe('shadow_thief-remove-all-debuffs (移除所有负面状态)', () => {
        it('移除目标所有debuff', () => {
            const state = createState({});
            state.players['1'].statusEffects[STATUS_IDS.POISON] = 2;
            state.players['1'].statusEffects[STATUS_IDS.BURN] = 1;
            state.tokenDefinitions = [
                { id: STATUS_IDS.POISON, category: 'debuff' } as any,
                { id: STATUS_IDS.BURN, category: 'debuff' } as any,
            ];
            const handler = getCustomActionHandler('shadow_thief-remove-all-debuffs')!;
            const events = handler(buildCtx(state, 'shadow_thief-remove-all-debuffs'));

            const removed = eventsOfType(events, 'STATUS_REMOVED');
            expect(removed).toHaveLength(2);
        });

        it('无debuff时不生成事件', () => {
            const state = createState({});
            state.tokenDefinitions = [
                { id: STATUS_IDS.POISON, category: 'debuff' } as any,
            ];
            const handler = getCustomActionHandler('shadow_thief-remove-all-debuffs')!;
            const events = handler(buildCtx(state, 'shadow_thief-remove-all-debuffs'));
            expect(events).toHaveLength(0);
        });
    });
});
