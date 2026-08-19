/**
 * 圣骑士 Token/状态效果 测试
 *
 * 覆盖范围：
 * 1. Token 定义完整性（crit、accuracy、protect、retribution、blessing_of_divinity）
 * 2. 初始状态验证
 * 3. 角色注册数据一致性
 * 4. 技能中 grantToken 引用一致性
 */

import { describe, it, expect } from 'vitest';
import { PALADIN_TOKENS, PALADIN_INITIAL_TOKENS } from '../heroes/paladin/tokens';
import { PALADIN_ABILITIES } from '../heroes/paladin/abilities';
import { getPaladinStartingDeck } from '../heroes/paladin/cards';
import { paladinDiceDefinition } from '../heroes/paladin/diceConfig';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import { TOKEN_IDS, PALADIN_DICE_FACE_IDS } from '../domain/ids';
import { diceThroneFlowHooks } from '../domain/flowHooks';
import { createDiceThroneEventSystem } from '../domain/systems';
import { PALADIN_ABILITIES, PALADIN_TITHES_UPGRADED } from '../heroes/paladin/abilities';
import { createHeroMatchup, fixedRandom, getCardById } from './test-utils';
import { checkPlayCard } from '../domain/rules';

// ============================================================================
// 1. Token 定义完整性
// ============================================================================

describe('圣骑士 Token 定义', () => {
    it('应包含 Crit（暴击）— consumable, onOffensiveRollEnd, 伤害≥5时+4', () => {
        const crit = PALADIN_TOKENS.find(t => t.id === TOKEN_IDS.CRIT);
        expect(crit).toBeDefined();
        expect(crit!.category).toBe('consumable');
        expect(crit!.stackLimit).toBe(1);
        expect(crit!.activeUse).toBeDefined();
        expect(crit!.activeUse!.timing).toContain('onOffensiveRollEnd');
        expect(crit!.activeUse!.consumeAmount).toBe(1);
        expect(crit!.activeUse!.effect.type).toBe('modifyDamageDealt');
        expect(crit!.activeUse!.effect.value).toBe(4);
    });

    it('暴击门槛只看攻击初始伤害，不把攻击修正加伤计入 5 点判断', () => {
        const state = createHeroMatchup('paladin', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.CRIT] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-attack',
            damage: 3,
            isDefendable: true,
            bonusDamage: 2,
            attackModifierBonusDamage: 2,
        } as any;

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: state.core, sys: { phase: 'offensiveRoll' } },
            from: 'offensiveRoll',
            to: 'defensiveRoll',
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: {}, timestamp: 100 } as any,
            random: fixedRandom,
        } as any);
        const events = Array.isArray(result) ? result : result?.events ?? [];
        expect(events.some(event => event.type === 'CHOICE_REQUESTED')).toBe(false);
    });

    it('教会税 II 在致盲判定失败后不发放延迟 CP', () => {
        const state = createHeroMatchup('paladin', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].resources.cp = 14;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'blessing-of-might',
            isDefendable: false,
            blindedCheckResolved: true,
            blindedCheckMissed: true,
            deferredCpGrants: [{ playerId: '0', amount: 1, sourceAbilityId: 'tithes' }],
        } as any;

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: state.core, sys: { phase: 'offensiveRoll' } },
            from: 'offensiveRoll',
            to: 'main2',
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: {}, timestamp: 101 } as any,
            random: fixedRandom,
        } as any);
        const events = Array.isArray(result) ? result : result?.events ?? [];
        expect(events.some(event => event.type === 'CP_CHANGED')).toBe(false);
        expect(events.some(event => (
            event.type === 'PENDING_ATTACK_UPDATED'
            && (event.payload.patch as any).deferredCpGrants?.length === 0
        ))).toBe(true);
    });

    it('教会税 II 在技能激活时只登记延迟奖励，不立即发放 CP', () => {
        const state = createHeroMatchup('paladin', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.players['0'].passiveAbilities = [PALADIN_TITHES_UPGRADED];
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'blessing-of-might',
            isDefendable: false,
        } as any;

        const system = createDiceThroneEventSystem();
        const result = system.afterEvents?.({
            state,
            events: [{
                type: 'ABILITY_ACTIVATED',
                payload: { abilityId: 'blessing-of-might', playerId: '0', isDefense: false },
                sourceCommandType: 'SELECT_ABILITY',
                timestamp: 100,
            }],
            random: fixedRandom,
        } as any);
        const events = result && !Array.isArray(result) ? result.events ?? [] : [];

        expect(events.some(event => event.type === 'CP_CHANGED')).toBe(false);
        expect(events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'PENDING_ATTACK_UPDATED',
                payload: expect.objectContaining({
                    patch: expect.objectContaining({
                        deferredCpGrants: [expect.objectContaining({
                            playerId: '0',
                            amount: 1,
                            sourceAbilityId: 'tithes',
                        })],
                    }),
                }),
            }),
        ]));
    });

    it('正义战法和圣光术的奖励骰判定不触发教会税 II', () => {
        const state = createHeroMatchup('paladin', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.players['0'].passiveAbilities = [PALADIN_TITHES_UPGRADED];

        const system = createDiceThroneEventSystem();
        for (const abilityId of ['righteous-combat', 'holy-light']) {
            const ability = PALADIN_ABILITIES.find(entry => entry.id === abilityId);
            expect(ability).toBeDefined();
            state.core.players['0'].abilities = ability ? [ability] : [];
            state.core.pendingAttack = {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: abilityId,
                isDefendable: true,
            } as any;

            const result = system.afterEvents?.({
                state,
                events: [{
                    type: 'ABILITY_ACTIVATED',
                    payload: { abilityId, playerId: '0', isDefense: false },
                    sourceCommandType: 'SELECT_ABILITY',
                    timestamp: 200,
                }],
                random: fixedRandom,
            } as any);
            const events = result && !Array.isArray(result) ? result.events ?? [] : [];
            expect(events.some(event => event.type === 'PENDING_ATTACK_UPDATED')).toBe(false);
            expect(events.some(event => event.type === 'CP_CHANGED')).toBe(false);
        }
    });

    it('应包含 Accuracy（精准）— consumable, onOffensiveRollEnd, 不叠加', () => {
        const acc = PALADIN_TOKENS.find(t => t.id === TOKEN_IDS.ACCURACY);
        expect(acc).toBeDefined();
        expect(acc!.category).toBe('consumable');
        expect(acc!.stackLimit).toBe(1);
        expect(acc!.activeUse).toBeDefined();
        expect(acc!.activeUse!.timing).toContain('onOffensiveRollEnd');
    });

    it('拜拜了您嘞不是改骰牌，确认骰面响应窗口不能打出', () => {
        const state = createHeroMatchup('paladin', 'monk')(['0', '1'], fixedRandom);
        const paladin = state.core.players['0'];
        const opponent = state.core.players['1'];
        paladin.tokens[TOKEN_IDS.ACCURACY] = 1;
        opponent.hand = [getCardById('card-bye-bye')];
        opponent.resources.cp = 5;
        state.core.rollConfirmed = true;
        state.core.turnPhase = 'offensiveRoll';

        const result = checkPlayCard(
            state.core,
            '1',
            opponent.hand[0],
            'offensiveRoll',
            'afterRollConfirmed',
        );
        expect(result).toEqual({ ok: false, reason: 'wrongPhaseForCard' });
    });

    it('确认骰面窗口只放行改骰牌，受伤响应牌只能在对应伤害窗口使用', () => {
        const state = createHeroMatchup('monk', 'gunslinger')(['0', '1'], fixedRandom);
        const attacker = state.core.players['0'];
        const defender = state.core.players['1'];
        const flick = getCardById('card-flick');
        const nextTime = getCardById('card-next-time');

        attacker.hand = [];
        defender.hand = [flick, nextTime];
        defender.resources.cp = 5;
        state.core.rollCount = 1;
        state.core.rollConfirmed = true;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'fist-attack',
            isDefendable: true,
        } as any;
        state.core.pendingDamage = {
            id: 'next-time-damage',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 6,
            currentDamage: 6,
            responseType: 'beforeDamageReceived',
            responderId: '1',
            isFullyEvaded: false,
        };

        expect(checkPlayCard(state.core, '1', flick, 'offensiveRoll', 'afterRollConfirmed'))
            .toEqual({ ok: true });
        expect(checkPlayCard(state.core, '1', nextTime, 'offensiveRoll', 'afterRollConfirmed'))
            .toEqual({ ok: false, reason: 'wrongPhaseForCard' });

        expect(checkPlayCard(state.core, '1', nextTime, 'main2', 'afterAttackResolved'))
            .toEqual({ ok: true });
    });

    it('精准被拜拜了您嘞移除后，进攻投掷阶段收口不会再请求精准', () => {
        const state = createHeroMatchup('paladin', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.ACCURACY] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'holy-strike-large',
            damage: 8,
            isDefendable: true,
            offensiveRollEndTokenResolved: false,
        } as any;

        const result = diceThroneFlowHooks.onPhaseExit?.({
            state,
            from: 'offensiveRoll',
            to: 'defensiveRoll',
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: {}, timestamp: 300 } as any,
            random: fixedRandom,
        } as any);
        const events = Array.isArray(result) ? result : result?.events ?? [];
        expect(events.some(event => event.type === 'CHOICE_REQUESTED')).toBe(false);
        expect(events.some(event => event.type === 'ATTACK_INITIATED')).toBe(false);
    });

    it('应包含 Protect（守护）— consumable, beforeDamageReceived, 伤害减半', () => {
        const prot = PALADIN_TOKENS.find(t => t.id === TOKEN_IDS.PROTECT);
        expect(prot).toBeDefined();
        expect(prot!.category).toBe('consumable');
        expect(prot!.stackLimit).toBe(1);
        expect(prot!.activeUse).toBeDefined();
        expect(prot!.activeUse!.timing).toContain('beforeDamageReceived');
        expect(prot!.activeUse!.effect.type).toBe('modifyDamageReceived');
        expect(prot!.activeUse!.effect.value).toBe(0); // 动态计算减半
    });

    it('应包含 Retribution（神罚）— consumable, beforeDamageReceived, 不叠加', () => {
        const ret = PALADIN_TOKENS.find(t => t.id === TOKEN_IDS.RETRIBUTION);
        expect(ret).toBeDefined();
        expect(ret!.category).toBe('consumable');
        expect(ret!.stackLimit).toBe(1);
        expect(ret!.activeUse).toBeDefined();
        expect(ret!.activeUse!.timing).toContain('beforeDamageReceived');
    });

    it('应包含 Blessing of Divinity（神圣祝福）— consumable, onDamageReceived 致死保护元数据', () => {
        const blessing = PALADIN_TOKENS.find(t => t.id === TOKEN_IDS.BLESSING_OF_DIVINITY);
        expect(blessing).toBeDefined();
        expect(blessing!.category).toBe('consumable');
        expect(blessing!.stackLimit).toBe(1);
        expect(blessing!.passiveTrigger).toBeDefined();
        expect(blessing!.passiveTrigger!.timing).toBe('onDamageReceived');
        expect(blessing!.passiveTrigger!.removable).toBe(false);
        expect(blessing!.passiveTrigger!.actions ?? []).toEqual([]);
    });

    it('Token 数量应为 6', () => {
        expect(PALADIN_TOKENS).toHaveLength(6);
    });
});

// ============================================================================
// 2. 初始状态验证
// ============================================================================

describe('圣骑士初始 Token 状态', () => {
    it('所有状态初始值为 0', () => {
        expect(PALADIN_INITIAL_TOKENS[TOKEN_IDS.CRIT]).toBe(0);
        expect(PALADIN_INITIAL_TOKENS[TOKEN_IDS.ACCURACY]).toBe(0);
        expect(PALADIN_INITIAL_TOKENS[TOKEN_IDS.PROTECT]).toBe(0);
        expect(PALADIN_INITIAL_TOKENS[TOKEN_IDS.RETRIBUTION]).toBe(0);
        expect(PALADIN_INITIAL_TOKENS[TOKEN_IDS.BLESSING_OF_DIVINITY]).toBe(0);
    });

    it('初始状态键数量与 Token 定义一致', () => {
        expect(Object.keys(PALADIN_INITIAL_TOKENS)).toHaveLength(PALADIN_TOKENS.length);
    });
});

// ============================================================================
// 3. 角色注册数据一致性
// ============================================================================

describe('圣骑士角色注册', () => {
    it('CHARACTER_DATA_MAP 中 paladin 数据正确', () => {
        const data = CHARACTER_DATA_MAP.paladin;
        expect(data.id).toBe('paladin');
        expect(data.abilities).toBe(PALADIN_ABILITIES);
        expect(data.tokens).toBe(PALADIN_TOKENS);
        expect(data.initialTokens).toEqual(PALADIN_INITIAL_TOKENS);
        expect(data.diceDefinitionId).toBe('paladin-dice');
        expect(data.getStartingDeck).toBe(getPaladinStartingDeck);
    });

    it('技能等级初始值全为 1', () => {
        const data = CHARACTER_DATA_MAP.paladin;
        for (const level of Object.values(data.initialAbilityLevels)) {
            expect(level).toBe(1);
        }
    });

    it('技能等级映射覆盖所有技能', () => {
        const data = CHARACTER_DATA_MAP.paladin;
        const abilityIds = PALADIN_ABILITIES.map(a => a.id);
        const mappedIds = Object.keys(data.initialAbilityLevels);
        for (const id of abilityIds) {
            expect(mappedIds).toContain(id);
        }
    });
});


// ============================================================================
// 4. 骰子定义验证
// ============================================================================

describe('圣骑士骰子定义', () => {
    it('骰子 ID 为 paladin-dice', () => {
        expect(paladinDiceDefinition.id).toBe('paladin-dice');
    });

    it('应有 6 个骰面', () => {
        expect(paladinDiceDefinition.faces).toHaveLength(6);
    });

    it('骰面符号正确映射', () => {
        const faces = paladinDiceDefinition.faces;
        // 1, 2 → sword
        expect(faces[0].symbols).toContain(PALADIN_DICE_FACE_IDS.SWORD);
        expect(faces[1].symbols).toContain(PALADIN_DICE_FACE_IDS.SWORD);
        // 3, 4 → helm
        expect(faces[2].symbols).toContain(PALADIN_DICE_FACE_IDS.HELM);
        expect(faces[3].symbols).toContain(PALADIN_DICE_FACE_IDS.HELM);
        // 5 → heart
        expect(faces[4].symbols).toContain(PALADIN_DICE_FACE_IDS.HEART);
        // 6 → pray
        expect(faces[5].symbols).toContain(PALADIN_DICE_FACE_IDS.PRAY);
    });
});

// ============================================================================
// 5. 技能 grantToken 引用一致性
// ============================================================================

describe('圣骑士 - 技能 grantToken 引用验证', () => {
    /** 递归收集所有 effects 中的 grantToken tokenId */
    function collectGrantTokenIds(abilities: typeof PALADIN_ABILITIES): string[] {
        const ids: string[] = [];
        for (const ability of abilities) {
            const allEffects = [
                ...(ability.effects ?? []),
                ...(ability.variants?.flatMap(v => v.effects) ?? []),
            ];
            for (const effect of allEffects) {
                const action = effect.action as any;
                if (action.type === 'grantToken' && action.tokenId) {
                    ids.push(action.tokenId);
                }
                if (action.type === 'choice' && action.choiceOptions) {
                    for (const opt of action.choiceOptions) {
                        if (opt.tokenId) ids.push(opt.tokenId);
                    }
                }
            }
        }
        return [...new Set(ids)];
    }

    it('所有 grantToken 引用的 tokenId 都在 TOKEN_IDS 中', () => {
        const usedIds = collectGrantTokenIds(PALADIN_ABILITIES);
        const validIds = new Set(Object.values(TOKEN_IDS));
        for (const id of usedIds) {
            expect(validIds.has(id)).toBe(true);
        }
    });

    it('技能引用了 CRIT、ACCURACY、RETRIBUTION、BLESSING_OF_DIVINITY', () => {
        const usedIds = collectGrantTokenIds(PALADIN_ABILITIES);
        expect(usedIds).toContain(TOKEN_IDS.CRIT);
        expect(usedIds).toContain(TOKEN_IDS.ACCURACY);
        expect(usedIds).toContain(TOKEN_IDS.RETRIBUTION);
        expect(usedIds).toContain(TOKEN_IDS.BLESSING_OF_DIVINITY);
    });
});
