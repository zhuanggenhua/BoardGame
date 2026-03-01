/**
 * 大杀四方 - 审计工具函数模块
 *
 * 提供审计测试所需的数据访问、注册表检查、关键词→行为映射等工具函数。
 * 所有函数均为纯查询，不修改任何注册表状态。
 *
 * Requirements: 10.1, 10.2, 10.3
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { CardDef, BaseCardDef, ActionCardDef, FactionId } from '../../domain/types';
import { getFactionCards, getAllCardDefs as _getAllCardDefs, getAllBaseDefs as _getAllBaseDefs } from '../../data/cards';
import { hasAbility, getRegisteredAbilityKeys } from '../../domain/abilityRegistry';
import { getRegisteredOngoingEffectIds } from '../../domain/ongoingEffects';
import type { TriggerTiming } from '../../domain/ongoingEffects';
import { getRegisteredModifierIds } from '../../domain/ongoingModifiers';
import { hasBaseAbility } from '../../domain/baseAbilities';
import type { BaseTriggerTiming } from '../../domain/baseAbilities';
import { getRegisteredInteractionHandlerIds } from '../../domain/abilityInteractionHandlers';

// ============================================================================
// 重新导出测试辅助函数
// ============================================================================

export {
    makeMinion,
    makeMinionFromOverrides,
    makePlayer,
    makePlayerWithFactions,
    makeCard,
    makeBase,
    makeState,
    makeStateWithBases,
    makeStateWithMadness,
    makeMatchState,
    applyEvents,
    callHandler,
    triggerBaseAbilityWithMS,
    getInteractionsFromResult,
    getInteractionsFromMS,
} from '../helpers';

// ============================================================================
// i18n 数据缓存
// ============================================================================

let _zhCNCache: Record<string, unknown> | null = null;

/** 获取中文 i18n 数据（懒加载 + 缓存） */
function getZhCN(): Record<string, unknown> {
    if (!_zhCNCache) {
        _zhCNCache = JSON.parse(
            readFileSync(
                resolve(__dirname, '../../../../../public/locales/zh-CN/game-smashup.json'),
                'utf-8',
            ),
        );
    }
    return _zhCNCache!;
}

// ============================================================================
// 卡牌定义查询
// ============================================================================

/** 获取指定派系的所有卡牌定义 */
export function getAllCardDefs(factionId?: FactionId): CardDef[] {
    if (factionId) {
        return getFactionCards(factionId);
    }
    return _getAllCardDefs();
}

/** 获取所有基地定义 */
export function getAllBaseDefs(): BaseCardDef[] {
    return _getAllBaseDefs();
}

// ============================================================================
// i18n 描述文本查询
// ============================================================================

/** i18n 卡牌描述信息 */
export interface CardI18nDescription {
    name: string;
    /** 随从卡的能力描述 */
    abilityText: string;
    /** 行动卡的效果描述 */
    effectText: string;
}

/** 读取指定 defId 的 i18n 描述文本 */
export function getCardI18nDescription(defId: string): CardI18nDescription {
    const zhCN = getZhCN();
    const cards = zhCN.cards as Record<string, Record<string, string>> | undefined;
    const entry = cards?.[defId];
    return {
        name: entry?.name ?? '',
        abilityText: entry?.abilityText ?? '',
        effectText: entry?.effectText ?? '',
    };
}

/**
 * 获取卡牌的描述文本（根据类型自动选择 abilityText 或 effectText）
 * - 随从卡 → abilityText
 * - 行动卡 → effectText
 */
export function getCardDescriptionText(defId: string, cardType: 'minion' | 'action'): string {
    const desc = getCardI18nDescription(defId);
    return cardType === 'minion' ? desc.abilityText : desc.effectText;
}

/** 读取基地卡的 i18n 描述文本（基地卡与普通卡共用 cards 命名空间） */
export function getBaseI18nDescription(baseDefId: string): { name: string; abilityText: string } {
    const zhCN = getZhCN();
    const cards = zhCN.cards as Record<string, Record<string, string>> | undefined;
    const entry = cards?.[baseDefId];
    return {
        name: entry?.name ?? '',
        abilityText: entry?.abilityText ?? '',
    };
}


// ============================================================================
// 注册表覆盖检查
// ============================================================================

/** 能力注册检查结果 */
export interface AbilityRegistrationResult {
    registered: boolean;
    key: string; // defId::tag
}

/** 检查能力注册表中是否有指定 defId + tag 的执行器 */
export function checkAbilityRegistration(defId: string, tag: string): AbilityRegistrationResult {
    const key = `${defId}::${tag}`;
    return {
        registered: hasAbility(defId, tag as import('../../domain/types').AbilityTag),
        key,
    };
}

/** 持续效果注册检查结果 */
export interface OngoingRegistrationResult {
    /** 是否在任一 ongoing 注册表中有注册 */
    registered: boolean;
    /** 具体注册位置 */
    registries: {
        protection: boolean;
        restriction: boolean;
        trigger: boolean;
        triggerTimings: TriggerTiming[];
        interceptor: boolean;
        baseAbilitySuppression: boolean;
        powerModifier: boolean;
        breakpointModifier: boolean;
    };
}

/** 检查持续效果注册表中是否有指定 defId 的注册 */
export function checkOngoingRegistration(defId: string): OngoingRegistrationResult {
    const { protectionIds, restrictionIds, triggerIds, interceptorIds, baseAbilitySuppressionIds } =
        getRegisteredOngoingEffectIds();
    const { powerModifierIds, breakpointModifierIds } = getRegisteredModifierIds();

    const registries = {
        protection: protectionIds.has(defId),
        restriction: restrictionIds.has(defId),
        trigger: triggerIds.has(defId),
        triggerTimings: triggerIds.get(defId) ?? [],
        interceptor: interceptorIds.has(defId),
        baseAbilitySuppression: baseAbilitySuppressionIds.has(defId),
        powerModifier: powerModifierIds.has(defId),
        breakpointModifier: breakpointModifierIds.has(defId),
    };

    const registered =
        registries.protection ||
        registries.restriction ||
        registries.trigger ||
        registries.interceptor ||
        registries.baseAbilitySuppression ||
        registries.powerModifier ||
        registries.breakpointModifier;

    return { registered, registries };
}

/** 基地能力注册检查结果 */
export interface BaseAbilityRegistrationResult {
    /** 是否在任一时机有注册 */
    registered: boolean;
    /** 各时机的注册状态 */
    timings: Record<BaseTriggerTiming, boolean>;
}

/** 所有基地能力触发时机 */
const ALL_BASE_TIMINGS: BaseTriggerTiming[] = [
    'onMinionPlayed',
    'beforeScoring',
    'afterScoring',
    'onTurnStart',
    'onActionPlayed',
];

/** 检查基地能力注册表中是否有指定 baseDefId 的注册 */
export function checkBaseAbilityRegistration(baseDefId: string): BaseAbilityRegistrationResult {
    const timings = {} as Record<BaseTriggerTiming, boolean>;
    let registered = false;

    for (const timing of ALL_BASE_TIMINGS) {
        const has = hasBaseAbility(baseDefId, timing);
        timings[timing] = has;
        if (has) registered = true;
    }

    return { registered, timings };
}

/** 检查交互处理函数注册表中是否有指定 sourceId 的 handler */
export function checkInteractionHandler(sourceId: string): boolean {
    const registeredIds = getRegisteredInteractionHandlerIds();
    return registeredIds.has(sourceId);
}

// ============================================================================
// 批量查询辅助
// ============================================================================

/** 获取所有已注册的能力键（defId::tag 格式） */
export function getAbilityKeys(): Set<string> {
    return getRegisteredAbilityKeys();
}

/** 获取所有已注册的交互处理函数 sourceId */
export function getInteractionHandlerIds(): Set<string> {
    return getRegisteredInteractionHandlerIds();
}

/**
 * 收集所有已注册的 ongoing 效果 ID（合并所有注册表）。
 * 用于快速判断某个 defId 是否在任一 ongoing 注册表中有注册。
 */
export function collectAllOngoingRegisteredIds(): Set<string> {
    const { protectionIds, restrictionIds, triggerIds, interceptorIds, baseAbilitySuppressionIds } =
        getRegisteredOngoingEffectIds();
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


// ============================================================================
// 关键词→行为映射表
// ============================================================================

/** 关键词行为映射条目 */
export interface KeywordBehaviorEntry {
    /** 匹配关键词列表（字符串或正则） */
    keywords: (string | RegExp)[];
    /** 预期注册表 */
    expectedRegistry: string;
    /** 预期能力标签（仅 abilityRegistry 类型） */
    expectedTag?: string;
    /** 预期触发时机（仅 ongoingEffects.trigger 类型） */
    expectedTiming?: TriggerTiming;
}

/**
 * 描述关键词 → 预期注册表条目的映射规则。
 *
 * 审计器使用此映射表来识别 i18n 描述中的能力语义，
 * 并验证对应的注册表条目是否存在。
 */
export const KEYWORD_BEHAVIOR_MAP: Record<string, KeywordBehaviorEntry> = {
    // ── 能力标签相关 ──
    onPlay: {
        keywords: ['打出时', '当你打出这张卡时'],
        expectedRegistry: 'abilityRegistry',
        expectedTag: 'onPlay',
    },
    talent: {
        keywords: ['天赋', '才能'],
        expectedRegistry: 'abilityRegistry',
        expectedTag: 'talent',
    },
    onDestroy: {
        keywords: ['被消灭时', '被消灭后', '本随从被消灭'],
        expectedRegistry: 'abilityRegistry',
        expectedTag: 'onDestroy',
    },
    special: {
        keywords: ['特殊', '基地计分前', '基地计分后'],
        expectedRegistry: 'abilityRegistry',
        expectedTag: 'special',
    },

    // ── 持续效果相关 ──
    ongoingProtection: {
        keywords: ['不能被消灭', '不可被消灭', '不受影响'],
        expectedRegistry: 'ongoingEffects.protection',
    },
    ongoingRestriction: {
        keywords: ['不能打出', '不能移动到'],
        expectedRegistry: 'ongoingEffects.restriction',
    },
    ongoingTrigger_turnStart: {
        keywords: ['回合开始时'],
        expectedRegistry: 'ongoingEffects.trigger',
        expectedTiming: 'onTurnStart',
    },
    ongoingTrigger_turnEnd: {
        keywords: ['回合结束时'],
        expectedRegistry: 'ongoingEffects.trigger',
        expectedTiming: 'onTurnEnd',
    },
    ongoingTrigger_minionPlayed: {
        keywords: [/当.*打出随从到此基地/],
        expectedRegistry: 'ongoingEffects.trigger',
        expectedTiming: 'onMinionPlayed',
    },
    ongoingTrigger_minionDestroyed: {
        keywords: ['随从被消灭后', /当.*随从被消灭/],
        expectedRegistry: 'ongoingEffects.trigger',
        expectedTiming: 'onMinionDestroyed',
    },

    // ── 力量修正相关 ──
    powerModifier: {
        keywords: [/[+＋]\d+力量/, /力量[+＋]\d+/, /-\d+力量/],
        expectedRegistry: 'ongoingModifiers.power',
    },
    breakpointModifier: {
        keywords: ['临界点', '爆破点'],
        expectedRegistry: 'ongoingModifiers.breakpoint',
    },
} as const;

// ============================================================================
// 关键词匹配工具
// ============================================================================

/** 关键词匹配结果 */
export interface KeywordMatchResult {
    /** 匹配到的行为类别 key */
    behaviorKey: string;
    /** 匹配到的具体关键词 */
    matchedKeyword: string | RegExp;
    /** 预期注册表 */
    expectedRegistry: string;
    /** 预期能力标签 */
    expectedTag?: string;
    /** 预期触发时机 */
    expectedTiming?: TriggerTiming;
}

/**
 * 从描述文本中匹配关键词，返回所有匹配到的行为映射。
 * 用于审计时自动检测描述中暗示的注册表条目。
 */
export function matchKeywordsInDescription(descriptionText: string): KeywordMatchResult[] {
    if (!descriptionText) return [];

    const results: KeywordMatchResult[] = [];

    for (const [behaviorKey, entry] of Object.entries(KEYWORD_BEHAVIOR_MAP)) {
        for (const keyword of entry.keywords) {
            const matched =
                typeof keyword === 'string'
                    ? descriptionText.includes(keyword)
                    : keyword.test(descriptionText);

            if (matched) {
                results.push({
                    behaviorKey,
                    matchedKeyword: keyword,
                    expectedRegistry: entry.expectedRegistry,
                    expectedTag: entry.expectedTag,
                    expectedTiming: entry.expectedTiming,
                });
                break; // 同一行为类别只记录第一个匹配
            }
        }
    }

    return results;
}

/**
 * 验证描述中匹配到的关键词是否在对应注册表中有注册。
 * 返回未注册的匹配项列表（即"描述有但实现缺失"的偏差）。
 */
export function validateKeywordRegistration(
    defId: string,
    descriptionText: string,
): KeywordMatchResult[] {
    const matches = matchKeywordsInDescription(descriptionText);
    const missing: KeywordMatchResult[] = [];

    for (const match of matches) {
        let registered = false;

        switch (match.expectedRegistry) {
            case 'abilityRegistry': {
                if (match.expectedTag) {
                    registered = checkAbilityRegistration(defId, match.expectedTag).registered;
                }
                break;
            }
            case 'ongoingEffects.protection': {
                const result = checkOngoingRegistration(defId);
                registered = result.registries.protection;
                break;
            }
            case 'ongoingEffects.restriction': {
                const result = checkOngoingRegistration(defId);
                registered = result.registries.restriction;
                break;
            }
            case 'ongoingEffects.trigger': {
                const result = checkOngoingRegistration(defId);
                if (match.expectedTiming) {
                    registered = result.registries.triggerTimings.includes(match.expectedTiming);
                } else {
                    registered = result.registries.trigger;
                }
                break;
            }
            case 'ongoingModifiers.power': {
                const result = checkOngoingRegistration(defId);
                registered = result.registries.powerModifier;
                break;
            }
            case 'ongoingModifiers.breakpoint': {
                const result = checkOngoingRegistration(defId);
                registered = result.registries.breakpointModifier;
                break;
            }
        }

        if (!registered) {
            missing.push(match);
        }
    }

    return missing;
}
