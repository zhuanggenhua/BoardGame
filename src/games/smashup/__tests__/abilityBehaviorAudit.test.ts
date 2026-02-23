/**
 * 大杀四方 - 能力行为审计测试
 *
 * 使用引擎层 abilityBehaviorAudit 框架，自动检测：
 * 1. 描述关键词 → 代码行为映射（如"消灭本卡"→自毁触发器）
 * 2. ongoing 行动卡注册覆盖（每张 ongoing 卡都有效果注册）
 * 3. 能力标签执行器覆盖（有 abilityTag 的卡都有执行器）
 * 4. 自毁行为完整性（描述含"消灭本卡"→代码有自毁逻辑）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
/** 可审计实体最小抽象 */
interface AuditableEntity {
    id: string;
    name: string;
    descriptionText: string;
    entityType: string;
    subtype?: string;
    abilityTags?: string[];
    meta?: Record<string, unknown>;
}
import { getAllCardDefs } from '../data/cards';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry, getRegisteredAbilityKeys } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { getRegisteredOngoingEffectIds } from '../domain/ongoingEffects';
import { getRegisteredModifierIds } from '../domain/ongoingModifiers';
import type { CardDef, ActionCardDef, MinionCardDef } from '../domain/types';

// ============================================================================
// i18n 数据
// ============================================================================

const zhCN = JSON.parse(
    readFileSync(resolve(__dirname, '../../../../public/locales/zh-CN/game-smashup.json'), 'utf-8'),
);

// ============================================================================
// 辅助函数
// ============================================================================

function getCardDescription(defId: string, def: CardDef): string {
    const i18n = zhCN.cards?.[defId];
    if (!i18n) return '';
    if (def.type === 'minion') return i18n.abilityText ?? '';
    return i18n.effectText ?? '';
}

function buildEntities(): AuditableEntity[] {
    return getAllCardDefs().map(def => ({
        id: def.id,
        name: zhCN.cards?.[def.id]?.name ?? def.id,
        descriptionText: getCardDescription(def.id, def),
        entityType: def.type,
        subtype: def.type === 'action' ? (def as ActionCardDef).subtype : undefined,
        abilityTags: def.abilityTags as string[] | undefined,
        meta: { faction: def.faction },
    }));
}

/** 收集所有已注册的 ongoing 效果 ID（合并所有注册表） */
function collectAllRegisteredIds(): Set<string> {
    const { protectionIds, restrictionIds, triggerIds, interceptorIds, baseAbilitySuppressionIds } = getRegisteredOngoingEffectIds();
    const { powerModifierIds, breakpointModifierIds } = getRegisteredModifierIds();
    const all = new Set<string>();
    for (const id of protectionIds) all.add(id);
    for (const id of restrictionIds) all.add(id);
    for (const id of triggerIds.keys()) all.add(id);
    for (const id of interceptorIds) all.add(id);
    for (const id of baseAbilitySuppressionIds) all.add(id);
    for (const id of powerModifierIds) all.add(id);
    for (const id of breakpointModifierIds) all.add(id);
    return all;
}

/** 获取所有 ongoing 行动卡 ID */
function getOngoingActionIds(): Set<string> {
    const ids = new Set<string>();
    for (const def of getAllCardDefs()) {
        if (def.type === 'action' && (def as ActionCardDef).subtype === 'ongoing') ids.add(def.id);
    }
    return ids;
}

// ============================================================================
// 初始化
// ============================================================================

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 测试套件
// ============================================================================

describe('SmashUp 能力行为审计', () => {

    // ── 1. 关键词→行为映射 ──
    describe('关键词→行为映射', () => {
        it('描述含"回合开始时抽"的持续卡必须有 onTurnStart 触发器', () => {
            const entities = buildEntities();
            const { triggerIds } = getRegisteredOngoingEffectIds();
            const violations: string[] = [];
            for (const e of entities) {
                if (!e.descriptionText.includes('持续')) continue;
                if (!/回合开始时.*抽|回合开始.*抽.*牌/.test(e.descriptionText)) continue;
                if (!triggerIds.get(e.id)?.includes('onTurnStart')) {
                    violations.push(`[${e.id}]（${e.name}）缺少 onTurnStart 触发器`);
                }
            }
            expect(violations).toEqual([]);
        });

        it('描述含"回合结束时"效果的持续卡必须有 onTurnEnd 触发器', () => {
            const entities = buildEntities();
            const { triggerIds } = getRegisteredOngoingEffectIds();
            const violations: string[] = [];
            for (const e of entities) {
                if (!e.descriptionText.includes('持续')) continue;
                if (!/回合结束时/.test(e.descriptionText)) continue;
                if (!triggerIds.get(e.id)?.includes('onTurnEnd')) {
                    violations.push(`[${e.id}]（${e.name}）缺少 onTurnEnd 触发器`);
                }
            }
            expect(violations).toEqual([]);
        });

        it('描述含"基地计分后/计分后"的卡牌必须声明 special 或注册 afterScoring 触发器', () => {
            const entities = buildEntities();
            const { triggerIds } = getRegisteredOngoingEffectIds();
            const violations: string[] = [];
            for (const e of entities) {
                if (!/基地计分后|在这个基地计分后|在一个基地计分后|计分后/.test(e.descriptionText)) continue;
                const hasSpecialTag = Array.isArray(e.abilityTags) && e.abilityTags.includes('special');
                const hasAfterScoringTrigger = triggerIds.get(e.id)?.includes('afterScoring') ?? false;
                if (!hasSpecialTag && !hasAfterScoringTrigger) {
                    violations.push(`[${e.id}]（${e.name}）描述含"计分后"但既无 special 标签也无 afterScoring 触发器`);
                }
            }
            expect(violations).toEqual([]);
        });

        it('描述含"不能被消灭"的持续卡必须有 destroy 保护注册', () => {
            const entities = buildEntities();
            const { protectionIds } = getRegisteredOngoingEffectIds();
            const violations: string[] = [];
            for (const e of entities) {
                if (!e.descriptionText.includes('持续')) continue;
                if (!/不能被消灭|不可被消灭|无法被消灭/.test(e.descriptionText)) continue;
                if (!protectionIds.has(e.id)) {
                    violations.push(`[${e.id}]（${e.name}）缺少 destroy 保护注册`);
                }
            }
            expect(violations).toEqual([]);
        });

        it('描述含"不能打出到此基地"的持续卡必须有 restriction 注册', () => {
            const entities = buildEntities();
            const { restrictionIds } = getRegisteredOngoingEffectIds();
            const violations: string[] = [];
            for (const e of entities) {
                if (!e.descriptionText.includes('持续')) continue;
                if (!/不能.*打出.*到此基地|不能.*打出随从到此|不能.*打出战术到/.test(e.descriptionText)) continue;
                if (!restrictionIds.has(e.id)) {
                    violations.push(`[${e.id}]（${e.name}）缺少 restriction 注册`);
                }
            }
            expect(violations).toEqual([]);
        });

        it('描述含"不受影响"的持续卡必须有 protection 注册', () => {
            const entities = buildEntities();
            const { protectionIds } = getRegisteredOngoingEffectIds();
            const violations: string[] = [];
            for (const e of entities) {
                if (!e.descriptionText.includes('持续')) continue;
                if (!/不.*受.*影响|不会受到.*影响/.test(e.descriptionText)) continue;
                if (!protectionIds.has(e.id)) {
                    violations.push(`[${e.id}]（${e.name}）缺少 protection 注册`);
                }
            }
            expect(violations).toEqual([]);
        });

        it('描述含力量修正的 ongoing 行动卡必须有 powerModifier 注册', () => {
            // 以下卡通过 trigger + addPowerCounter 实现力量指示物，非静态 powerModifier
            const counterBasedWhitelist = new Set([
                'frankenstein_german_engineering', // onMinionPlayed 触发放指示物
                'frankenstein_uberserum',          // onTurnStart 触发放指示物
                'vampire_opportunist',             // onMinionDestroyed 触发放指示物
                'vampire_summon_wolves',            // onTurnStart 触发放指示物（在卡上）
                'giant_ant_the_show_must_go_on',    // 巨蚁：持续保护语义，非静态 powerModifier
            ]);
            const entities = buildEntities();
            const { powerModifierIds } = getRegisteredModifierIds();
            const violations: string[] = [];
            for (const e of entities) {
                if (!e.descriptionText.includes('持续')) continue;
                if (e.subtype !== 'ongoing') continue;
                if (!/[+＋]\d+力量|力量[+＋]\d+|-\d+力量|力量-\d+/.test(e.descriptionText)) continue;
                if (counterBasedWhitelist.has(e.id)) continue;
                if (!powerModifierIds.has(e.id)) {
                    violations.push(`[${e.id}]（${e.name}）缺少 powerModifier 注册`);
                }
            }
            expect(violations).toEqual([]);
        });

        it('描述含"打出随从到此基地时消灭"的持续卡必须有 onMinionPlayed 触发器', () => {
            const entities = buildEntities();
            const { triggerIds } = getRegisteredOngoingEffectIds();
            const violations: string[] = [];
            for (const e of entities) {
                if (!e.descriptionText.includes('持续')) continue;
                // 精确匹配"当...打出随从到此/这...时，消灭它"模式
                // 排除"不能打出随从到此基地"（restriction）+ 后续自毁的组合
                if (!/当.*打出.*随从到此基地.*消灭|打出.*随从到这时.*消灭/.test(e.descriptionText)) continue;
                if (!triggerIds.get(e.id)?.includes('onMinionPlayed')) {
                    violations.push(`[${e.id}]（${e.name}）缺少 onMinionPlayed 触发器`);
                }
            }
            expect(violations).toEqual([]);
        });

        it('描述含"随从移动到...消灭"的持续卡必须有 onMinionMoved 触发器', () => {
            const entities = buildEntities();
            const { triggerIds } = getRegisteredOngoingEffectIds();
            const violations: string[] = [];
            for (const e of entities) {
                if (!e.descriptionText.includes('持续')) continue;
                if (!/随从移动到.*消灭|移动到这里.*消灭/.test(e.descriptionText)) continue;
                if (!triggerIds.get(e.id)?.includes('onMinionMoved')) {
                    violations.push(`[${e.id}]（${e.name}）缺少 onMinionMoved 触发器`);
                }
            }
            expect(violations).toEqual([]);
        });

        it('描述含"随从被消灭后"触发效果的持续随从必须有 onDestroy 能力注册', () => {
            // 以下随从的"随从被消灭后"指的是其他随从被消灭（通过 onMinionDestroyed trigger），而非自身 onDestroy
            const triggerBasedWhitelist = new Set([
                'vampire_the_count', // onMinionDestroyed 触发放指示物（对手随从被消灭）
            ]);
            const entities = buildEntities();
            const abilityKeys = getRegisteredAbilityKeys();
            const violations: string[] = [];
            for (const e of entities) {
                if (!e.descriptionText.includes('持续')) continue;
                if (e.entityType !== 'minion') continue;
                if (!/随从被消灭后|在.*随从被消灭后|在本随从被消灭后/.test(e.descriptionText)) continue;
                if (triggerBasedWhitelist.has(e.id)) continue;
                // onDestroy 能力注册在 abilityRegistry 中，不在 ongoingEffects 触发器中
                const key = `${e.id}::onDestroy`;
                if (!abilityKeys.has(key)) {
                    violations.push(`[${e.id}]（${e.name}）缺少 onDestroy 能力注册`);
                }
            }
            expect(violations).toEqual([]);
        });

        it('描述含"防止...被消灭"的实体必须注册 onMinionDestroyed 触发器', () => {
            const entities = buildEntities();
            const { triggerIds } = getRegisteredOngoingEffectIds();
            const violations: string[] = [];
            for (const e of entities) {
                if (!/防止.*被消灭/.test(e.descriptionText)) continue;
                if (!/随从/.test(e.descriptionText)) continue;
                if (!triggerIds.get(e.id)?.includes('onMinionDestroyed')) {
                    violations.push(`[${e.id}]（${e.name}）描述含"防止被消灭"但缺少 onMinionDestroyed 触发器`);
                }
            }
            expect(violations).toEqual([]);
        });
    });

    // ── 2. ongoing 行动卡注册覆盖 ──
    describe('ongoing 行动卡注册覆盖', () => {
        // 以下 ongoing 行动卡的效果通过 abilityRegistry 或特殊机制实现，
        // 不在 ongoingEffects/ongoingModifiers 注册表中
        const whitelist = new Set([
            'cthulhu_altar',              // 祭坛：天赋效果由 abilityRegistry 处理
            'cthulhu_complete_the_ritual', // 完成仪式：特殊效果
            'innsmouth_sacred_circle',    // 神圣之环：天赋效果
            'innsmouth_in_plain_sight',   // 众目睽睽：保护效果已注册
            'steampunk_zeppelin',         // 飞艇：天赋效果由 abilityRegistry 处理
            'ghost_make_contact',         // 交朋友：控制权转移由特殊逻辑处理
            'zombie_theyre_coming_to_get_you', // 它们为你而来：通过 DiscardPlayProvider 实现弃牌堆出牌
            'miskatonic_lost_knowledge',  // 通往超凡的门：天赋效果由 abilityRegistry 处理（talent）
            'werewolf_leader_of_the_pack', // 狼群领袖：ongoing(minion)+talent 由 abilityRegistry 处理
            'werewolf_moontouched',       // 月之触：ongoing(minion)+talent 由 abilityRegistry 处理
        ]);

        it('所有 ongoing 行动卡都有对应的效果注册', () => {
            const ongoingIds = getOngoingActionIds();
            const registeredIds = collectAllRegisteredIds();
            const missing: string[] = [];
            for (const id of ongoingIds) {
                if (whitelist.has(id)) continue;
                if (!registeredIds.has(id)) {
                    missing.push(id);
                }
            }
            expect(missing, '以下 ongoing 行动卡未注册任何效果').toEqual([]);
        });
    });

    // ── 3. 能力标签执行器覆盖 ──
    describe('能力标签执行器覆盖', () => {
        // 以下标签由其他系统处理，不需要 abilityRegistry 执行器
        const exemptTags = new Set(['ongoing', 'extra', 'special']);
        // 以下卡牌的能力尚未实现，暂时豁免
        const unimplementedCards = new Set<string>();

        it('所有非豁免能力标签都有对应的执行器注册', () => {
            const entities = buildEntities();
            const abilityKeys = getRegisteredAbilityKeys();
            const missing: string[] = [];
            for (const e of entities) {
                if (!e.abilityTags) continue;
                if (unimplementedCards.has(e.id)) continue;
                for (const tag of e.abilityTags) {
                    if (exemptTags.has(tag)) continue;
                    const key = `${e.id}::${tag}`;
                    if (!abilityKeys.has(key)) {
                        missing.push(`[${e.id}] tag="${tag}" → key="${key}" 未注册`);
                    }
                }
            }
            expect(missing, '以下能力标签缺少执行器注册').toEqual([]);
        });
    });

    // ── 4. 自毁行为完整性 ──
    describe('自毁行为完整性', () => {
        const selfDestructPatterns = [
            /在你.*回合开始.*消灭本卡/,
            /在你.*回合开始.*消灭本战术/,
            /回合开始时消灭本卡/,
            /下回合开始时消灭本卡/,
            /下回合开始.*消灭本卡/,
        ];

        it('描述中有"回合开始消灭本卡"的实体都有 onTurnStart 自毁触发器', () => {
            const entities = buildEntities();
            const { triggerIds } = getRegisteredOngoingEffectIds();
            const violations: string[] = [];
            for (const e of entities) {
                const hasSelfDestructText = selfDestructPatterns.some(p => p.test(e.descriptionText));
                if (!hasSelfDestructText) continue;
                const timings = triggerIds.get(e.id);
                if (!timings?.includes('onTurnStart')) {
                    violations.push(`[${e.id}]（${e.name}）描述含"消灭本卡"但缺少 onTurnStart 触发器`);
                }
            }
            expect(violations).toEqual([]);
        });
    });

    // ── 5. 卡牌定义结构完整性（描述语义 → 定义字段） ──
    describe('卡牌定义结构完整性', () => {
        /**
         * 匹配"打出到（一个）随从上"的描述模式，覆盖：
         * - "打出到一个随从上" / "打出到你的一个随从上"
         * - "打到一个随从上"（简写）
         */
        const minionTargetPatterns = [
            /打出到.*随从上/,
            /打到.*随从上/,
        ];

        it('描述含"打出到随从上"的 ongoing 行动卡必须有 ongoingTarget: "minion"', () => {
            const allDefs = getAllCardDefs();
            const violations: string[] = [];

            for (const def of allDefs) {
                // 只检查 subtype === 'ongoing' 的行动卡
                if (def.type !== 'action') continue;
                const actionDef = def as ActionCardDef;
                if (actionDef.subtype !== 'ongoing') continue;

                // 获取 i18n 描述
                const i18n = zhCN.cards?.[def.id];
                const effectText: string = i18n?.effectText ?? '';
                if (!effectText) continue;

                // 检查描述是否包含"打出到随从上"模式
                const targetsMinion = minionTargetPatterns.some(p => p.test(effectText));
                if (!targetsMinion) continue;

                // 验证定义中有 ongoingTarget: 'minion'
                if (actionDef.ongoingTarget !== 'minion') {
                    violations.push(
                        `[${def.id}]（${i18n?.name ?? def.id}）` +
                        `描述含"打出到随从上"但缺少 ongoingTarget: 'minion'` +
                        `\n  effectText: ${effectText.slice(0, 60)}...`,
                    );
                }
            }

            expect(violations, '以下 ongoing 行动卡的 ongoingTarget 字段缺失或错误').toEqual([]);
        });

        it('描述含条件性打出目标的 ongoing 行动卡必须有 playConstraint', () => {
            const allDefs = getAllCardDefs();
            const violations: string[] = [];

            // 匹配"打出到一个<条件>的基地上"模式
            // 例如："打出到一个你至少拥有一个随从的基地上"
            const conditionalPlayPatterns = [
                /打出到一个.*拥有.*随从.*基地/,
                /打出到.*你.*至少.*随从.*基地/,
                /打出到一个.*的基地上/,  // 通用：打出到一个<限定条件>的基地上
            ];

            for (const def of allDefs) {
                if (def.type !== 'action') continue;
                const actionDef = def as ActionCardDef;
                if (actionDef.subtype !== 'ongoing') continue;

                const i18n = zhCN.cards?.[def.id];
                const effectText: string = i18n?.effectText ?? '';
                if (!effectText) continue;

                const hasConditionalPlay = conditionalPlayPatterns.some(p => p.test(effectText));
                if (!hasConditionalPlay) continue;

                if (!actionDef.playConstraint) {
                    violations.push(
                        `[${def.id}]（${i18n?.name ?? def.id}）` +
                        `描述含条件性打出目标但缺少 playConstraint 字段` +
                        `\n  effectText: ${effectText.slice(0, 80)}...`,
                    );
                }
            }

            expect(violations, '以下 ongoing 行动卡描述含条件性打出目标但缺少 playConstraint').toEqual([]);
        });

        it('描述含条件性打出限制的随从卡必须有 playConstraint', () => {
            const allDefs = getAllCardDefs();
            const violations: string[] = [];

            // 匹配"只能将这张卡打到…的基地"、"只能打出到…力量…基地"等模式
            const conditionalMinionPatterns = [
                /只能.*打到.*基地/,
                /只能.*打出到.*基地/,
                /只能将.*打到.*基地/,
            ];

            for (const def of allDefs) {
                if (def.type !== 'minion') continue;
                const minionDef = def as MinionCardDef;

                const i18n = zhCN.cards?.[def.id];
                const abilityText: string = i18n?.abilityText ?? '';
                if (!abilityText) continue;

                const hasConditionalPlay = conditionalMinionPatterns.some(p => p.test(abilityText));
                if (!hasConditionalPlay) continue;

                if (!minionDef.playConstraint) {
                    violations.push(
                        `[${def.id}]（${i18n?.name ?? def.id}）` +
                        `描述含条件性打出限制但缺少 playConstraint 字段` +
                        `\n  abilityText: ${abilityText.slice(0, 80)}...`,
                    );
                }
            }

            expect(violations, '以下随从卡描述含条件性打出限制但缺少 playConstraint').toEqual([]);
        });

        it('描述含"打出到基地上"的 ongoing 行动卡不应有 ongoingTarget: "minion"', () => {
            const allDefs = getAllCardDefs();
            const violations: string[] = [];

            for (const def of allDefs) {
                if (def.type !== 'action') continue;
                const actionDef = def as ActionCardDef;
                if (actionDef.subtype !== 'ongoing') continue;

                const i18n = zhCN.cards?.[def.id];
                const effectText: string = i18n?.effectText ?? '';
                if (!effectText) continue;

                // 描述明确说"打出到基地上"
                if (!/打出到基地上/.test(effectText)) continue;

                // 不应标记为 minion 目标
                if (actionDef.ongoingTarget === 'minion') {
                    violations.push(
                        `[${def.id}]（${i18n?.name ?? def.id}）` +
                        `描述含"打出到基地上"但 ongoingTarget 错误地设为 'minion'`,
                    );
                }
            }

            expect(violations, '以下 ongoing 行动卡的 ongoingTarget 字段与描述矛盾').toEqual([]);
        });
    });
});
