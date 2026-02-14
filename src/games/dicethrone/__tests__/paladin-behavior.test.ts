/**
 * 圣骑士 (Paladin) Custom Action 运行时行为断言测试
 */

import { describe, it, expect } from 'vitest';
import { TOKEN_IDS, PALADIN_DICE_FACE_IDS as FACES } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import type { DiceThroneCore, Die, HeroState, DiceThroneEvent } from '../domain/types';
import { getCustomActionHandler } from '../domain/effects';
import type { CustomActionContext } from '../domain/effects';
import { initializeCustomActions } from '../domain/customActions';
import { registerDiceDefinition } from '../domain/diceRegistry';
import { paladinDiceDefinition } from '../heroes/paladin/diceConfig';

initializeCustomActions();
registerDiceDefinition(paladinDiceDefinition);

// ============================================================================
// 测试工具
// ============================================================================

function createPaladinDie(value: number): Die {
    const faceMap: Record<number, string> = {
        1: FACES.SWORD, 2: FACES.SWORD,
        3: FACES.HELM, 4: FACES.HELM,
        5: FACES.HEART,
        6: FACES.PRAY,
    };
    return {
        id: 0, definitionId: 'paladin-dice', value,
        symbol: faceMap[value] as any, symbols: [faceMap[value]], isKept: false,
    };
}

function createState(opts: {
    attackerHP?: number;
    defenderHP?: number;
    attackerCP?: number;
    attackerCrit?: number;
    attackerProtect?: number;
    attackerBlessing?: number;
    attackerTithes?: number;
}): DiceThroneCore {
    const attacker: HeroState = {
        id: '0', characterId: 'paladin',
        resources: {
            [RESOURCE_IDS.HP]: opts.attackerHP ?? 50,
            [RESOURCE_IDS.CP]: opts.attackerCP ?? 5,
        },
        hand: [], deck: [{ id: 'd1' } as any, { id: 'd2' } as any, { id: 'd3' } as any], discard: [],
        statusEffects: {},
        tokens: {
            [TOKEN_IDS.CRIT]: opts.attackerCrit ?? 0,
            [TOKEN_IDS.PROTECT]: opts.attackerProtect ?? 0,
            [TOKEN_IDS.BLESSING_OF_DIVINITY]: opts.attackerBlessing ?? 0,
            [TOKEN_IDS.TITHES_UPGRADED]: opts.attackerTithes ?? 0,
        },
        tokenStackLimits: {
            [TOKEN_IDS.CRIT]: 3,
            [TOKEN_IDS.PROTECT]: 3,
            [TOKEN_IDS.BLESSING_OF_DIVINITY]: 1,
            [TOKEN_IDS.TITHES_UPGRADED]: 1,
        },
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
        selectedCharacters: { '0': 'paladin', '1': 'monk' },
        readyPlayers: { '0': true, '1': true },
        hostPlayerId: '0', hostStarted: true,
        dice: [1, 2, 3, 4, 5].map(v => createPaladinDie(v)),
        rollCount: 1, rollLimit: 3, rollDiceCount: 5, rollConfirmed: false,
        activePlayerId: '0', startingPlayerId: '0', turnNumber: 1,
        pendingAttack: null, tokenDefinitions: [],
    };
}

function buildCtx(
    state: DiceThroneCore, actionId: string,
    opts?: { random?: () => number; asDefender?: boolean }
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
    // targetId='0'（防御者自己）用于圣光术等自我增益
    // attackerId='0'（防御者自己）= effectCtx.attackerId
    return {
        ctx: effectCtx,
        targetId: '0' as any,
        attackerId: '0' as any,
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

describe('圣骑士 Custom Action 运行时行为断言', () => {

    // ========================================================================
    // 圣光术
    // ========================================================================
    describe('paladin-holy-light-roll (圣光术I：投1骰)', () => {
        it('投出剑面获得暴击', () => {
            const state = createState({});
            const handler = getCustomActionHandler('paladin-holy-light-roll')!;
            const events = handler(buildCtx(state, 'paladin-holy-light-roll', {
                random: () => 1 / 6, // d(6)→1 → sword
            }));

            const tokens = eventsOfType(events, 'TOKEN_GRANTED');
            expect(tokens).toHaveLength(1);
            expect((tokens[0] as any).payload.tokenId).toBe(TOKEN_IDS.CRIT);
        });

        it('投出头盔面获得守护', () => {
            const state = createState({});
            const handler = getCustomActionHandler('paladin-holy-light-roll')!;
            const events = handler(buildCtx(state, 'paladin-holy-light-roll', {
                random: () => 3 / 6, // d(6)→3 → helm
            }));

            const tokens = eventsOfType(events, 'TOKEN_GRANTED');
            expect(tokens).toHaveLength(1);
            expect((tokens[0] as any).payload.tokenId).toBe(TOKEN_IDS.PROTECT);
        });

        it('投出心面抽1牌', () => {
            const state = createState({});
            const handler = getCustomActionHandler('paladin-holy-light-roll')!;
            const events = handler(buildCtx(state, 'paladin-holy-light-roll', {
                random: () => 5 / 6, // d(6)→5 → heart
            }));

            expect(eventsOfType(events, 'CARD_DRAWN')).toHaveLength(1);
        });

        it('投出祈祷面获得2CP', () => {
            const state = createState({ attackerCP: 3 });
            const handler = getCustomActionHandler('paladin-holy-light-roll')!;
            const events = handler(buildCtx(state, 'paladin-holy-light-roll', {
                random: () => 1, // d(6)→6 → pray
            }));

            const cp = eventsOfType(events, 'CP_CHANGED');
            expect(cp).toHaveLength(1);
            expect((cp[0] as any).payload.delta).toBe(2);
        });

        it('暴击已满时不授予', () => {
            const state = createState({ attackerCrit: 3 });
            const handler = getCustomActionHandler('paladin-holy-light-roll')!;
            const events = handler(buildCtx(state, 'paladin-holy-light-roll', {
                random: () => 1 / 6, // sword
            }));

            expect(eventsOfType(events, 'TOKEN_GRANTED')).toHaveLength(0);
        });
    });

    describe('paladin-holy-light-roll-3 (圣光术III：投3骰)', () => {
        it('投3骰，各面效果叠加', () => {
            const state = createState({ attackerCP: 0 });
            let callIdx = 0;
            const rolls = [1 / 6, 3 / 6, 1]; // sword, helm, pray
            const handler = getCustomActionHandler('paladin-holy-light-roll-3')!;
            const events = handler(buildCtx(state, 'paladin-holy-light-roll-3', {
                random: () => rolls[callIdx++],
            }));

            // 3个BONUS_DIE_ROLLED
            expect(eventsOfType(events, 'BONUS_DIE_ROLLED')).toHaveLength(3);
            // sword → crit
            expect(eventsOfType(events, 'TOKEN_GRANTED').some(
                (e: any) => e.payload.tokenId === TOKEN_IDS.CRIT
            )).toBe(true);
            // helm → protect
            expect(eventsOfType(events, 'TOKEN_GRANTED').some(
                (e: any) => e.payload.tokenId === TOKEN_IDS.PROTECT
            )).toBe(true);
            // pray → 2CP
            const cp = eventsOfType(events, 'CP_CHANGED');
            expect(cp).toHaveLength(1);
            expect((cp[0] as any).payload.delta).toBe(2);
            // 多骰展示
            expect(eventsOfType(events, 'BONUS_DICE_REROLL_REQUESTED')).toHaveLength(1);
        });
    });

    // ========================================================================
    // 神圣防御
    // ========================================================================
    describe('paladin-holy-defense (神圣防御I：基于防御骰面)', () => {
        it('剑面造成伤害给原攻击者，头盔防止1伤害，心防止2伤害，祈祷获得CP', () => {
            // 骰子: sword(1), helm(3), heart(5) + 2个额外 → 默认骰子 [1,2,3,4,5]
            // 但 holy-defense I 的 diceCount=3，rollDiceCount 应为 3
            const state = createState({});
            // 设置 3 颗骰子：sword, helm, heart
            state.dice = [1, 3, 5].map(v => createPaladinDie(v));
            state.rollDiceCount = 3;
            const handler = getCustomActionHandler('paladin-holy-defense')!;
            const events = handler(buildCtx(state, 'paladin-holy-defense', {
                asDefender: true,
            }));

            // sword → 1伤害，目标是原攻击者('1')
            const dmg = eventsOfType(events, 'DAMAGE_DEALT');
            expect(dmg).toHaveLength(1);
            expect((dmg[0] as any).payload.amount).toBe(1);
            expect((dmg[0] as any).payload.targetId).toBe('1'); // 原攻击者

            // helm(1) + heart(2) → 防止3伤害
            const prevent = eventsOfType(events, 'PREVENT_DAMAGE');
            expect(prevent).toHaveLength(1);
            expect((prevent[0] as any).payload.amount).toBe(3); // 1×1 + 1×2
        });
    });

    describe('paladin-holy-defense-3 (神圣防御III：基于防御骰面+特殊效果)', () => {
        it('2头盔+1祈祷时额外获得守护', () => {
            const state = createState({});
            // 设置 4 颗骰子：helm, helm, pray, sword
            state.dice = [3, 4, 6, 1].map(v => createPaladinDie(v));
            state.rollDiceCount = 4;
            const handler = getCustomActionHandler('paladin-holy-defense-3')!;
            const events = handler(buildCtx(state, 'paladin-holy-defense-3', {
                asDefender: true,
            }));

            // 应有守护token
            const tokens = eventsOfType(events, 'TOKEN_GRANTED');
            expect(tokens.some((t: any) => t.payload.tokenId === TOKEN_IDS.PROTECT)).toBe(true);
        });
    });

    // ========================================================================
    // 神佑
    // ========================================================================
    describe('paladin-gods-grace (神佑：祈祷→4CP，其他→抽1)', () => {
        it('投出祈祷面获得4CP', () => {
            const state = createState({ attackerCP: 3 });
            const handler = getCustomActionHandler('paladin-gods-grace')!;
            const events = handler(buildCtx(state, 'paladin-gods-grace', {
                random: () => 1, // d(6)→6 → pray
            }));

            const cp = eventsOfType(events, 'CP_CHANGED');
            expect(cp).toHaveLength(1);
            expect((cp[0] as any).payload.delta).toBe(4);
        });

        it('投出非祈祷面抽1牌', () => {
            const state = createState({});
            const handler = getCustomActionHandler('paladin-gods-grace')!;
            const events = handler(buildCtx(state, 'paladin-gods-grace', {
                random: () => 1 / 6, // sword
            }));

            expect(eventsOfType(events, 'CARD_DRAWN')).toHaveLength(1);
        });
    });

    // ========================================================================
    // 神恩
    // ========================================================================
    describe('paladin-divine-favor (神恩)', () => {
        it('剑面抽2牌', () => {
            const state = createState({});
            const handler = getCustomActionHandler('paladin-divine-favor')!;
            const events = handler(buildCtx(state, 'paladin-divine-favor', {
                random: () => 1 / 6,
            }));
            expect(eventsOfType(events, 'CARD_DRAWN')).toHaveLength(2);
        });

        it('头盔面治愈3', () => {
            const state = createState({ attackerHP: 40 });
            const handler = getCustomActionHandler('paladin-divine-favor')!;
            const events = handler(buildCtx(state, 'paladin-divine-favor', {
                random: () => 3 / 6, // helm
            }));
            const heal = eventsOfType(events, 'HEAL_APPLIED');
            expect(heal).toHaveLength(1);
            expect((heal[0] as any).payload.amount).toBe(3);
        });

        it('心面治愈4', () => {
            const state = createState({ attackerHP: 40 });
            const handler = getCustomActionHandler('paladin-divine-favor')!;
            const events = handler(buildCtx(state, 'paladin-divine-favor', {
                random: () => 5 / 6, // heart
            }));
            expect((eventsOfType(events, 'HEAL_APPLIED')[0] as any).payload.amount).toBe(4);
        });

        it('祈祷面获得3CP', () => {
            const state = createState({ attackerCP: 2 });
            const handler = getCustomActionHandler('paladin-divine-favor')!;
            const events = handler(buildCtx(state, 'paladin-divine-favor', {
                random: () => 1, // pray
            }));
            expect((eventsOfType(events, 'CP_CHANGED')[0] as any).payload.delta).toBe(3);
        });
    });

    // ========================================================================
    // 赦免
    // ========================================================================
    describe('paladin-absolution (赦免)', () => {
        it('剑面对原攻击者造成1不可防御伤害', () => {
            const state = createState({});
            const handler = getCustomActionHandler('paladin-absolution')!;
            const events = handler(buildCtx(state, 'paladin-absolution', {
                asDefender: true,
                random: () => 1 / 6, // sword
            }));

            const dmg = eventsOfType(events, 'DAMAGE_DEALT');
            expect(dmg).toHaveLength(1);
            expect((dmg[0] as any).payload.amount).toBe(1);
            expect((dmg[0] as any).payload.targetId).toBe('1'); // 原攻击者
        });

        it('头盔面防止1伤害', () => {
            const state = createState({});
            const handler = getCustomActionHandler('paladin-absolution')!;
            const events = handler(buildCtx(state, 'paladin-absolution', {
                asDefender: true,
                random: () => 3 / 6, // helm
            }));

            const prevent = eventsOfType(events, 'PREVENT_DAMAGE');
            expect(prevent).toHaveLength(1);
            expect((prevent[0] as any).payload.amount).toBe(1);
        });

        it('心面防止2伤害', () => {
            const state = createState({});
            const handler = getCustomActionHandler('paladin-absolution')!;
            const events = handler(buildCtx(state, 'paladin-absolution', {
                asDefender: true,
                random: () => 5 / 6, // heart
            }));

            expect((eventsOfType(events, 'PREVENT_DAMAGE')[0] as any).payload.amount).toBe(2);
        });

        it('祈祷面获得1CP', () => {
            const state = createState({ attackerCP: 3 });
            const handler = getCustomActionHandler('paladin-absolution')!;
            const events = handler(buildCtx(state, 'paladin-absolution', {
                asDefender: true,
                random: () => 1, // pray
            }));

            expect((eventsOfType(events, 'CP_CHANGED')[0] as any).payload.delta).toBe(1);
        });
    });

    // ========================================================================
    // 教会税升级
    // ========================================================================
    describe('paladin-upgrade-tithes (教会税升级)', () => {
        it('授予TITHES_UPGRADED标记', () => {
            const state = createState({});
            const handler = getCustomActionHandler('paladin-upgrade-tithes')!;
            const events = handler(buildCtx(state, 'paladin-upgrade-tithes'));

            const tokens = eventsOfType(events, 'TOKEN_GRANTED');
            expect(tokens).toHaveLength(1);
            expect((tokens[0] as any).payload.tokenId).toBe(TOKEN_IDS.TITHES_UPGRADED);
        });
    });

    // ========================================================================
    // 神圣祝福
    // ========================================================================
    describe('paladin-blessing-prevent (神圣祝福：免疫致死+回血)', () => {
        it('有祝福时消耗1层，免除伤害并回复5HP', () => {
            const state = createState({ attackerBlessing: 1, attackerHP: 3 });
            const handler = getCustomActionHandler('paladin-blessing-prevent')!;
            const events = handler(buildCtx(state, 'paladin-blessing-prevent'));

            // 消耗token
            const consumed = eventsOfType(events, 'TOKEN_CONSUMED');
            expect(consumed).toHaveLength(1);

            // 免除伤害
            const prevent = eventsOfType(events, 'PREVENT_DAMAGE');
            expect(prevent).toHaveLength(1);
            expect((prevent[0] as any).payload.amount).toBe(9999);

            // 回复5HP
            const heal = eventsOfType(events, 'HEAL_APPLIED');
            expect(heal).toHaveLength(1);
            expect((heal[0] as any).payload.amount).toBe(5);
        });

        it('无祝福时不生成事件', () => {
            const state = createState({ attackerBlessing: 0 });
            const handler = getCustomActionHandler('paladin-blessing-prevent')!;
            const events = handler(buildCtx(state, 'paladin-blessing-prevent'));
            expect(events).toHaveLength(0);
        });
    });
});
