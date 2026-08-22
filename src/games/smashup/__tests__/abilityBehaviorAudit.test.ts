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
import { readdirSync, readFileSync } from 'fs';
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
import { getAllCardDefs, getFactionCards } from '../data/cards';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry, getRegisteredAbilityKeys } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { getRegisteredOngoingEffectIds } from '../domain/ongoingEffects';
import { getRegisteredModifierIds } from '../domain/ongoingModifiers';
import type { CardDef, ActionCardDef, MinionCardDef } from '../domain/types';
import { actionLikeNeedsPlayBase, actionLikeNeedsPlayMinion, actionLikePlayTargetMinionController } from '../domain/utils';
import { FACTION_METADATA, getVisibleFactionMetadata } from '../ui/factionMeta';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { hasSpecialSemanticsRegistration } from './helpers/auditUtils';

// ============================================================================
// i18n 数据
// ============================================================================

const zhCN = JSON.parse(
    readFileSync(resolve(__dirname, '../../../../public/locales/zh-CN/game-smashup.json'), 'utf-8'),
);
const enUS = JSON.parse(
    readFileSync(resolve(__dirname, '../../../../public/locales/en/game-smashup.json'), 'utf-8'),
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

function collectPodFactionIdsFromDataFiles(): string[] {
    const factionsDir = resolve(__dirname, '../data/factions');
    const podFactionIds = new Set<string>();

    for (const fileName of readdirSync(factionsDir)) {
        if (!fileName.endsWith('_pod.ts')) continue;

        const content = readFileSync(resolve(factionsDir, fileName), 'utf-8');
        for (const match of content.matchAll(/faction:\s*'([^']+_pod)'/g)) {
            podFactionIds.add(match[1]);
        }
        for (const match of content.matchAll(/faction:\s*SMASHUP_FACTION_IDS\.([A-Z0-9_]+_POD)/g)) {
            podFactionIds.add(match[1].toLowerCase());
        }
    }

    return Array.from(podFactionIds).sort();
}

type EntrySubject = 'base' | 'minion';

function normalizeAuditText(text: string): string {
    return text
        .replace(/\s+/g, '')
        .replace(/仆从/g, '随从')
        .replace(/战斗力/g, '战力')
        .replace(/力量/g, '战力');
}

function inferInitialEntrySubject(effectText: string): EntrySubject | undefined {
    const normalized = normalizeAuditText(effectText);
    const firstClause = normalized.split(/[。；;]/)[0] ?? normalized;

    const minionFirstPatterns = [
        /^选择[^基地。；，]*随从/,
        /^将[^。；，]*随从(移动|放到|返回|置于)/,
        /^移动[^。；，]*随从/,
        /^消灭[^。；，]*随从/,
        /^你的一个随从/,
        /^一个随从/,
        /^一名随从/,
        /^至多[^。；，]*随从/,
        /^任意数量[^。；，]*随从/,
        /^在至多[^。；，]*随从上/,
    ];
    if (minionFirstPatterns.some(pattern => pattern.test(firstClause))) return 'minion';

    const baseFirstPatterns = [
        /^选择[^。；，]*基地/,
        /^将一个基地/,
        /^消灭一个基地/,
        /^一个基地/,
        /^在一个基地/,
        /^将[^。；，]*破坏点/,
        /^将[^。；，]*爆破点/,
    ];
    if (baseFirstPatterns.some(pattern => pattern.test(firstClause))) return 'base';

    return undefined;
}

function getDeclaredPlayEntrySubject(actionDef: ActionCardDef): EntrySubject | undefined {
    const needsBase = actionLikeNeedsPlayBase(actionDef);
    const needsMinion = actionLikeNeedsPlayMinion(actionDef);
    if (needsBase === needsMinion) return undefined;
    return needsBase ? 'base' : 'minion';
}

function inferPlayTargetMinionController(effectText: string): 'self' | 'opponent' | undefined {
    const normalized = normalizeAuditText(effectText);
    const firstClause = normalized.split(/[。；;]/)[0] ?? normalized;
    if (/不由你控制[^。；;，,]*(随从|仆从)/.test(firstClause)) return 'opponent';
    if (/(其他玩家|另一位玩家|对手|敌方|另一个玩家)[^。；;，,]*(随从|仆从)/.test(firstClause)) return 'opponent';
    if (/(你的|你控制|己方)[^。；;，,]*(随从|仆从)/.test(firstClause)) return 'self';
    return undefined;
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

function collectAbilityFileUsage(pattern: RegExp): string[] {
    const abilitiesDir = resolve(__dirname, '../abilities');
    return readdirSync(abilitiesDir)
        .filter((fileName) => fileName.endsWith('.ts'))
        .filter((fileName) => {
            const source = readFileSync(resolve(abilitiesDir, fileName), 'utf-8');
            const matcher = new RegExp(pattern.source, pattern.flags);
            return matcher.test(source);
        })
        .sort();
}

function collectAbilitySourceWindows(sourceId: string, radiusBefore = 1800, radiusAfter = 2600): string[] {
    const abilitiesDir = resolve(__dirname, '../abilities');
    const windows: string[] = [];
    for (const fileName of readdirSync(abilitiesDir).filter((name) => name.endsWith('.ts'))) {
        const source = readFileSync(resolve(abilitiesDir, fileName), 'utf-8');
        let index = 0;
        while ((index = source.indexOf(sourceId, index)) >= 0) {
            windows.push(source.slice(Math.max(0, index - radiusBefore), index + radiusAfter));
            index += sourceId.length;
        }
    }
    return windows;
}

function hasOptionalRejectionImplementationEvidence(sourceId: string): boolean {
    return collectAbilitySourceWindows(sourceId).some((window) => (
        /createSkipOption/.test(window)
        || /optional:\s*true/.test(window)
        || /autoResolveIfSingle:\s*false/.test(window)
        || /multi:\s*\{[^}]*min:\s*0/.test(window)
        || /\bskip\b/.test(window)
    ));
}

function collectDisallowedAutoResolveSingleChoice(): string[] {
    const roots = [
        resolve(__dirname, '../abilities'),
        resolve(__dirname, '../domain'),
    ];
    const files = roots.flatMap((root) => readdirSync(root)
        .filter((fileName) => fileName.endsWith('.ts'))
        .map((fileName) => ({ root, fileName })));
    const violations: string[] = [];

    for (const { root, fileName } of files) {
        const fullPath = resolve(root, fileName);
        const relative = `${root.endsWith('abilities') ? 'abilities' : 'domain'}/${fileName}`;
        const source = readFileSync(fullPath, 'utf-8');
        source.split(/\r?\n/).forEach((line, index) => {
            const match = line.match(/autoResolveIfSingle:\s*([^,}]+)/);
            if (!match) return;
            const value = match[1].trim();
            if (value === 'false') return;
            const isMechanicalContinue = relative === 'domain/actionCounter.ts' && value === 'true';
            const isMechanicalNoRemaining = relative === 'abilities/huluwawa.ts'
                && value === 'context.remainingCards.length === 0';
            const isHelperPassThrough = relative === 'abilities/penguins.ts'
                && value === 'config.autoResolveIfSingle';
            const isDefaultFalseHelper = relative === 'domain/abilityHelpers.ts'
                && value === 'autoResolve';
            if (isMechanicalContinue || isMechanicalNoRemaining || isHelperPassThrough || isDefaultFalseHelper) return;
            violations.push(`${relative}:${index + 1} ${line.trim()}`);
        });
    }

    return violations;
}

function collectKnownSingleCandidateChoiceBypasses(): string[] {
    const checks = [
        {
            file: 'abilities/half_the_battle.ts',
            pattern: /targets\.length === 1/,
            meaning: 'Half the Battle 目标选择',
        },
        {
            file: 'abilities/kaiju.ts',
            pattern: /options\.length === 1/,
            meaning: 'Kaiju 消灭目标选择',
        },
        {
            file: 'abilities/mythic_greeks.ts',
            pattern: /targets\.length === 1\s*&&\s*!options\.optional/,
            meaning: 'Mythic Greeks 目标选择',
        },
    ];

    return checks.flatMap(({ file, pattern, meaning }) => {
        const [rootName, fileName] = file.split('/');
        const root = resolve(__dirname, `../${rootName}`);
        const source = readFileSync(resolve(root, fileName), 'utf-8');
        return pattern.test(source) ? [`${file} ${meaning}`] : [];
    });
}

function isOptionalChoiceText(effectText: string): boolean {
    return /(你可以|可以选择|至多|任意数量)/.test(effectText)
        && /(移动|消灭|选择|加入|洗回|放置|抽|弃|返回)/.test(effectText);
}

/** 收集所有已注册的 ongoing 效果 ID（合并所有注册表） */
function collectAllRegisteredIds(): Set<string> {
    const {
        protectionIds,
        restrictionIds,
        triggerIds,
        interceptorIds,
        baseAbilitySuppressionIds,
        baseScoringSuppressionIds,
        baseVpModifierIds,
        cardAbilitySuppressionIds,
    } = getRegisteredOngoingEffectIds();
    const { powerModifierIds, breakpointModifierIds } = getRegisteredModifierIds();
    const abilityKeys = getRegisteredAbilityKeys();
    const all = new Set<string>();
    for (const id of protectionIds) all.add(id);
    for (const id of restrictionIds) all.add(id);
    for (const id of triggerIds.keys()) all.add(id);
    for (const id of interceptorIds) all.add(id);
    for (const id of baseAbilitySuppressionIds) all.add(id);
    for (const id of baseScoringSuppressionIds) all.add(id);
    for (const id of baseVpModifierIds) all.add(id);
    for (const id of cardAbilitySuppressionIds) all.add(id);
    for (const id of powerModifierIds) all.add(id);
    for (const id of breakpointModifierIds) all.add(id);
    for (const key of abilityKeys) all.add(key.split('::')[0]);
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
    describe('能力 runtime 迁移边界', () => {
        it('遗留 registerAbility 仅允许存在于明确未迁完的旧能力文件', () => {
            const allowedLegacyFiles = [
                'bear_cavalry.ts',
                'cowboys.ts',
                'elder_things.ts',
                'giant_ants.ts',
                'huluwawa.ts',
                'kaiju.ts',
                'magical_girls.ts',
                'mega_troopers.ts',
                'mermaids.ts',
                'miskatonic.ts',
                'ninjas.ts',
                'pirates.ts',
                'podAutoMapping.ts',
                'skeletons.ts',
                'titans.ts',
                'tricksters.ts',
                'vampires.ts',
                'vikings.ts',
                'world_champs.ts',
                'zombies.ts',
            ];
            expect(collectAbilityFileUsage(/\bregisterAbility\(/g)).toEqual(allowedLegacyFiles);
        });

        it('遗留 registerInteractionHandler 仅允许存在于明确未迁完的旧能力文件', () => {
            const allowedLegacyHandlerFiles = [
                'bear_cavalry.ts',
                'dragons.ts',
                'geeks.ts',
                'huluwawa.ts',
                'kaiju.ts',
                'magical_girls.ts',
                'mega_troopers.ts',
                'skeletons.ts',
                'superheroes.ts',
                'titans.ts',
                'yuanhou.ts',
            ];
            expect(collectAbilityFileUsage(/\bregisterInteractionHandler\(/g)).toEqual(allowedLegacyHandlerFiles);
        });

        it('玩家选择语义不得通过 autoResolveIfSingle 自动提交唯一候选', () => {
            expect(collectDisallowedAutoResolveSingleChoice()).toEqual([]);
        });

        it('已确认的单候选目标选择不得保留硬编码直结算旁路', () => {
            expect(collectKnownSingleCandidateChoiceBypasses()).toEqual([]);
        });
    });

    describe('POD 阵营接入完整性', () => {
        it('所有 POD 阵营数据文件都已接入 cards / ids / factionMeta / locale', () => {
            const podFactionIds = collectPodFactionIdsFromDataFiles();
            const knownFactionIds = new Set(Object.values(SMASHUP_FACTION_IDS));
            const metaIds = new Set(FACTION_METADATA.map(meta => meta.id));
            const violations: string[] = [];

            for (const factionId of podFactionIds) {
                if (!knownFactionIds.has(factionId)) {
                    violations.push(`[ids] 缺少 ${factionId}`);
                }

                if (getFactionCards(factionId as any).length === 0) {
                    violations.push(`[cards] ${factionId} 在 getFactionCards() 中为空`);
                }

                if (!metaIds.has(factionId)) {
                    violations.push(`[factionMeta] 缺少 ${factionId}`);
                }

                if (!zhCN.factions?.[factionId]) {
                    violations.push(`[zh-CN locale] 缺少 factions.${factionId}`);
                }

                if (!enUS.factions?.[factionId]) {
                    violations.push(`[en locale] 缺少 factions.${factionId}`);
                }
            }

            expect(violations, '以下 POD 阵营存在直接接入缺口').toEqual([]);
        });

        it('POD 阵营在中英文派系选择列表里都可见', () => {
            const podFactionIds = collectPodFactionIdsFromDataFiles();
            const zhVisibleIds = new Set(getVisibleFactionMetadata('zh-CN').map((meta) => meta.id));
            const enVisibleIds = new Set(getVisibleFactionMetadata('en').map((meta) => meta.id));

            for (const factionId of podFactionIds) {
                expect(zhVisibleIds.has(factionId), `zh-CN 缺少 ${factionId}`).toBe(true);
                expect(enVisibleIds.has(factionId), `en 缺少 ${factionId}`).toBe(true);
            }

            expect(enVisibleIds.has(SMASHUP_FACTION_IDS.PIRATES)).toBe(false);
            expect(enVisibleIds.has(SMASHUP_FACTION_IDS.PIRATES_POD)).toBe(true);
            expect(zhVisibleIds.has(SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS)).toBe(true);
            expect(enVisibleIds.has(SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS)).toBe(false);
            expect(zhVisibleIds.has(SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS_POD)).toBe(true);
            expect(enVisibleIds.has(SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS_POD)).toBe(true);
            expect(zhVisibleIds.has(SMASHUP_FACTION_IDS.SAMURAI)).toBe(true);
            expect(enVisibleIds.has(SMASHUP_FACTION_IDS.SAMURAI)).toBe(false);
            expect(zhVisibleIds.has(SMASHUP_FACTION_IDS.SAMURAI_POD)).toBe(true);
            expect(enVisibleIds.has(SMASHUP_FACTION_IDS.SAMURAI_POD)).toBe(true);
            expect(zhVisibleIds.has(SMASHUP_FACTION_IDS.COWBOYS)).toBe(true);
            expect(enVisibleIds.has(SMASHUP_FACTION_IDS.COWBOYS)).toBe(false);
            expect(zhVisibleIds.has(SMASHUP_FACTION_IDS.COWBOYS_POD)).toBe(true);
            expect(enVisibleIds.has(SMASHUP_FACTION_IDS.COWBOYS_POD)).toBe(true);
            expect(zhVisibleIds.has(SMASHUP_FACTION_IDS.VIKINGS)).toBe(true);
            expect(enVisibleIds.has(SMASHUP_FACTION_IDS.VIKINGS)).toBe(false);
            expect(zhVisibleIds.has(SMASHUP_FACTION_IDS.VIKINGS_POD)).toBe(true);
            expect(enVisibleIds.has(SMASHUP_FACTION_IDS.VIKINGS_POD)).toBe(true);
        });

        it('tricksters_pod 牌组总数保持 20 张', () => {
            const total = getFactionCards(SMASHUP_FACTION_IDS.TRICKSTERS_POD as any)
                .reduce((sum, def) => sum + def.count, 0);
            expect(total).toBe(20);
        });

        it('tricksters_pod 牌组总数保持 20 张', () => {
            const total = getFactionCards(SMASHUP_FACTION_IDS.TRICKSTERS_POD as any)
                .reduce((sum, def) => sum + def.count, 0);
            expect(total).toBe(20);
        });
    });

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

        it('描述含"基地计分后/计分后"的卡牌必须声明可执行的 special 语义或 afterScoring 触发器', () => {
            const entities = buildEntities();
            const violations: string[] = [];
            for (const e of entities) {
                if (!/基地计分后|在这个基地计分后|在一个基地计分后|计分后/.test(e.descriptionText)) continue;
                if (!hasSpecialSemanticsRegistration(e.id, e.descriptionText)) {
                    violations.push(`[${e.id}]（${e.name}）描述含"计分后"但缺少可执行的 special/afterScoring 语义声明`);
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
            const interceptorBasedWhitelist = new Set([
                'steampunk_steam_queen_pod',
            ]);
            const entities = buildEntities();
            const { protectionIds } = getRegisteredOngoingEffectIds();
            const violations: string[] = [];
            for (const e of entities) {
                if (!e.descriptionText.includes('持续')) continue;
                if (!/不.*受.*影响|不会受到.*影响/.test(e.descriptionText)) continue;
                if (interceptorBasedWhitelist.has(e.id)) continue;
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
                'world_champs_shark_tattoo',        // 世界冠军：持续阶段通过放置 +1 指示物实现，不是静态 powerModifier
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
            const falsePositiveWhitelist = new Set([
                'trickster_hideout_pod',
            ]);
            const entities = buildEntities();
            const { triggerIds } = getRegisteredOngoingEffectIds();
            const violations: string[] = [];
            for (const e of entities) {
                if (!e.descriptionText.includes('持续')) continue;
                if (!/随从移动到.*消灭|移动到这里.*消灭/.test(e.descriptionText)) continue;
                if (falsePositiveWhitelist.has(e.id)) continue;
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
                'vampire_the_count_pod', // 同上，POD 版是持续触发而非自身 onDestroy
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
            'zombie_theyre_coming_to_get_you_pod', // 通过弃牌堆出牌提供器实现，不走 ongoing 注册表
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

        it('standard 行动卡的直接入口字段必须匹配描述动作链的第一选择对象', () => {
            const allDefs = getAllCardDefs();
            const violations: string[] = [];
            const auditedIds: string[] = [];
            const auditedSubjects = new Set<EntrySubject>();

            for (const def of allDefs) {
                if (def.type !== 'action') continue;
                const actionDef = def as ActionCardDef;
                if (actionDef.subtype !== 'standard') continue;

                const i18n = zhCN.cards?.[def.id];
                const effectText: string = i18n?.effectText ?? '';
                if (!effectText) continue;

                const needsBase = actionLikeNeedsPlayBase(actionDef);
                const needsMinion = actionLikeNeedsPlayMinion(actionDef);
                if (needsBase && needsMinion) {
                    violations.push(
                        `[${def.id}]（${i18n?.name ?? def.id}）` +
                        `同时声明 playNeedsBase 与 playNeedsMinion，UI 第一入口存在双重真相` +
                        `\n  effectText: ${effectText.slice(0, 80)}...`,
                    );
                    continue;
                }

                const declaredEntry = getDeclaredPlayEntrySubject(actionDef);
                if (!declaredEntry) continue;

                const describedEntry = inferInitialEntrySubject(effectText);
                if (!describedEntry) continue;

                auditedIds.push(def.id);
                auditedSubjects.add(describedEntry);

                if (declaredEntry !== describedEntry) {
                    violations.push(
                        `[${def.id}]（${i18n?.name ?? def.id}）` +
                        `描述动作链第一入口为 ${describedEntry}，但静态字段声明为 ${declaredEntry}` +
                        `\n  playNeedsBase=${needsBase} playNeedsMinion=${needsMinion}` +
                        `\n  effectText: ${effectText.slice(0, 80)}...`,
                    );
                }
            }

            expect(auditedIds.length, '入口语义审计不能退化成空跑或只覆盖极少数 standard 行动卡').toBeGreaterThan(20);
            expect(Array.from(auditedSubjects).sort(), '入口语义审计必须同时覆盖基地入口与随从入口').toEqual(['base', 'minion']);
            expect(violations, '以下 standard 行动卡的 UI 第一入口字段与描述动作链不一致').toEqual([]);
        });

        it('需要直接选择随从的行动卡必须声明目标随从控制者约束', () => {
            const violations: string[] = [];
            const auditedIds: string[] = [];
            const auditedControllers = new Set<string>();

            for (const def of getAllCardDefs()) {
                if (def.type !== 'action') continue;
                const actionDef = def as ActionCardDef;
                if (!actionLikeNeedsPlayMinion(actionDef)) continue;

                const i18n = zhCN.cards?.[def.id];
                const effectText: string = i18n?.effectText ?? '';
                if (!effectText) continue;

                const describedController = inferPlayTargetMinionController(effectText);
                if (!describedController) continue;

                auditedIds.push(def.id);
                auditedControllers.add(describedController);

                const declaredController = actionLikePlayTargetMinionController(actionDef);
                if (declaredController !== describedController) {
                    violations.push(
                        `[${def.id}]（${i18n?.name ?? def.id}）` +
                        `描述要求 ${describedController} 随从，但 playTargetMinionController=${declaredController}` +
                        `\n  effectText: ${effectText.slice(0, 100)}...`,
                    );
                }
            }

            expect(auditedIds.length, '控制者约束审计不能空跑').toBeGreaterThan(0);
            expect(auditedControllers.has('self'), '控制者约束审计至少要覆盖“你的随从”入口').toBe(true);
            expect(violations, '以下行动卡的目标随从控制者约束与描述不一致').toEqual([]);
        });

        it('已纳入全面审计的新派系可选/至多交互必须有拒绝或空选实现证据', () => {
            const auditedFactionIds = new Set([
                SMASHUP_FACTION_IDS.SHARKS,
                SMASHUP_FACTION_IDS.TORNADOS,
                SMASHUP_FACTION_IDS.MYTHIC_GREEKS,
            ]);
            const auditedIds: string[] = [];
            const violations: string[] = [];

            for (const def of getAllCardDefs()) {
                if (!auditedFactionIds.has(def.faction as any)) continue;
                const i18n = zhCN.cards?.[def.id];
                const effectText: string = i18n?.abilityText ?? i18n?.effectText ?? '';
                if (!isOptionalChoiceText(effectText)) continue;

                auditedIds.push(def.id);
                if (!hasOptionalRejectionImplementationEvidence(def.id)) {
                    violations.push(
                        `[${def.id}]（${i18n?.name ?? def.id}）` +
                        `描述含可选/至多/任意数量交互，但能力实现附近缺少 skip / optional / multi min=0 等拒绝或空选证据` +
                        `\n  text: ${effectText.slice(0, 100)}...`,
                    );
                }
            }

            expect(auditedIds.length, '可选交互审计不能空跑；新增三派系必须纳入该维度').toBeGreaterThan(10);
            expect(auditedIds, 'Twister/Monster Tornado 这类有合法目标也可拒绝的移动效果必须纳入审计集合')
                .toEqual(expect.arrayContaining(['tornados_twister', 'tornados_monster_tornado']));
            expect(violations, '以下新增派系可选交互缺少拒绝/空选实现证据').toEqual([]);
        });
    });
});
