/**
 * 大杀四方 - 能力注册表
 *
 * 以 defId + AbilityTag 为键的函数注册表。
 * 每个派系独立注册能力执行函数，在游戏初始化时调用。
 */

import type { PlayerId, RandomFn, MatchState } from '../../../engine/types';
import type { SmashUpCore, SmashUpEvent, AbilityTag, ActiveDuel, ValidationResult } from './types';
import { getBaseDef, getCardDef, getTitanDef } from '../data/cards';
import { isCardSuppressed } from './ongoingEffects';
import { shouldGenerateSmashUpPodAlias } from './variantBindingRuntime';
import {
    createEffectProgram,
    executeAbilityProgram,
    type AbilityProgram,
} from './abilityRuntime';

// ============================================================================
// 能力执行上下文与结果
// ============================================================================

/** 能力执行上下文 */
export interface AbilityContext {
    state: SmashUpCore;
    /** 完整的 match 状态，用于调用 queueInteraction */
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    cardUid: string;
    defId: string;
    /** 随从所在基地 / 行动卡目标基地 */
    baseIndex: number;
    /** 行动卡在命令层显式选择的目标基地；未选择时保持 undefined。 */
    targetBaseIndex?: number;
    /** 行动卡目标随从 */
    targetMinionUid?: string;
    /** 当前决斗上下文（仅 duel 内核触发的卡牌结算时提供） */
    duel?: ActiveDuel;
    /** 行动卡结算时，牌离手后的手牌数。外部来源打行动时由调用方显式传入。 */
    handSizeAfterPlay?: number;
    /** 本次卡牌是否从弃牌堆打出。 */
    fromDiscard?: boolean;
    /** 本次卡牌是否从牌库打出。 */
    fromDeck?: boolean;
    /** 本次卡牌是否从暂存/停滞区打出。 */
    fromStored?: boolean;
    /** 本次卡牌是否从埋葬区打出。 */
    fromBuried?: boolean;
    random: RandomFn;
    now: number;
}

/** 能力执行结果 */
export interface AbilityResult {
    events: SmashUpEvent[];
    /** 如果能力修改了 matchState（如创建了 Interaction），返回更新后的 matchState */
    matchState?: MatchState<SmashUpCore>;
}

/** 能力执行函数签名 */
export type AbilityExecutor = (ctx: AbilityContext) => AbilityResult;

/** 可选的发动前校验：返回 null 表示可发动，否则返回错误原因 */
export type AbilityUseValidator = (ctx: AbilityContext) => string | null;

export type SmashUpAbilityProgram<TContext = AbilityContext> =
    AbilityProgram<TContext, SmashUpCore, SmashUpEvent>;

export type AbilityProgramContextFactory<TContext = AbilityContext> = (
    ctx: AbilityContext,
) => TContext;

export interface AbilityProgramRegistration<TContext = AbilityContext> {
    program: SmashUpAbilityProgram<TContext>;
    createContext?: AbilityProgramContextFactory<TContext>;
    validateUse?: AbilityUseValidator;
}

export interface SimpleAbilityRegistration {
    execute: AbilityExecutor;
    validateUse?: AbilityUseValidator;
}

interface LegacyRegisteredAbility {
    execute: AbilityExecutor;
    validateUse?: AbilityUseValidator;
}

export interface RegisteredAbility {
    program: SmashUpAbilityProgram<any>;
    createContext: AbilityProgramContextFactory<any>;
    execute: AbilityExecutor;
    validateUse?: AbilityUseValidator;
    generatedPodAlias?: boolean;
}

export type AbilityRegistration =
    | AbilityExecutor
    | LegacyRegisteredAbility
    | AbilityProgramRegistration<any>;

// ============================================================================
// 注册表实现
// ============================================================================

/** 内部存储：defId → Map<AbilityTag, RegisteredAbility> */
const registry = new Map<string, Map<AbilityTag, RegisteredAbility>>();

function normalizeRegistration(registration: AbilityRegistration): RegisteredAbility {
    const createContext: AbilityProgramContextFactory = (ctx) => ctx;
    if (typeof registration === 'function') {
        const program = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(registration);
        return {
            program,
            createContext,
            execute: createProgramExecutor(program, createContext),
            generatedPodAlias: false,
        };
    }

    if ('program' in registration) {
        const program = registration.program;
        const contextFactory = registration.createContext ?? createContext;
        return {
            program,
            createContext: contextFactory,
            execute: createProgramExecutor(program, contextFactory),
            validateUse: registration.validateUse,
            generatedPodAlias: false,
        };
    }

    const program = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(registration.execute);
    return {
        program,
        createContext,
        execute: createProgramExecutor(program, createContext),
        validateUse: registration.validateUse,
        generatedPodAlias: false,
    };
}

function createProgramExecutor<TContext>(
    program: SmashUpAbilityProgram<TContext>,
    createContext: AbilityProgramContextFactory<TContext>,
): AbilityExecutor {
    return (ctx) => {
        const result = executeAbilityProgram(program, createContext(ctx));
        return {
            events: result.events,
            matchState: result.matchState,
        };
    };
}

/** 注册一个能力执行函数 */
export function registerAbility(
    defId: string,
    tag: AbilityTag,
    registration: AbilityRegistration
): void {
    let tagMap = registry.get(defId);
    if (!tagMap) {
        tagMap = new Map();
        registry.set(defId, tagMap);
    }
    tagMap.set(tag, normalizeRegistration(registration));
}

export function registerAbilityProgram<TContext>(
    defId: string,
    tag: AbilityTag,
    registration: AbilityProgramRegistration<TContext>,
): void {
    registerAbility(defId, tag, registration);
}

export function registerSimpleAbility(
    defId: string,
    tag: AbilityTag,
    registration: AbilityExecutor | SimpleAbilityRegistration,
): void {
    const normalized = typeof registration === 'function'
        ? { execute: registration }
        : registration;
    registerAbilityProgram(defId, tag, {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(normalized.execute),
        ...(normalized.validateUse ? { validateUse: normalized.validateUse } : {}),
    });
}

/** 按 defId + tag 解析能力定义 */
export function resolveAbilityDefinition(
    defId: string,
    tag: AbilityTag
): RegisteredAbility | undefined {
    return registry.get(defId)?.get(tag);
}

export function resolveAbilityProgram(
    defId: string,
    tag: AbilityTag,
): SmashUpAbilityProgram<any> | undefined {
    return resolveAbilityDefinition(defId, tag)?.program;
}

/** 按 defId + tag 解析能力执行函数 */
export function resolveAbility(
    defId: string,
    tag: AbilityTag
): AbilityExecutor | undefined {
    return resolveAbilityDefinition(defId, tag)?.execute;
}

function buildMissingAbilityError(
    defId: string,
    tag: AbilityTag,
    reason?: string,
): Error {
    return new Error(`SmashUp ability 缺少声明: ${defId}::${tag}${reason ? ` (${reason})` : ''}`);
}

export function requireAbilityDefinition(
    defId: string,
    tag: AbilityTag,
    reason?: string,
): RegisteredAbility {
    const definition = resolveAbilityDefinition(defId, tag);
    if (!definition) {
        throw buildMissingAbilityError(defId, tag, reason);
    }
    return definition;
}

export function requireAbility(
    defId: string,
    tag: AbilityTag,
    reason?: string,
): AbilityExecutor {
    return requireAbilityDefinition(defId, tag, reason).execute;
}

/** 快捷：解析 onPlay 能力 */
export function resolveOnPlay(defId: string): AbilityExecutor | undefined {
    return resolveAbility(defId, 'onPlay');
}

export function requireOnPlay(defId: string, reason?: string): AbilityExecutor {
    return requireAbility(defId, 'onPlay', reason);
}

/** 快捷：解析 talent 能力 */
export function resolveTalent(defId: string): AbilityExecutor | undefined {
    return resolveAbility(defId, 'talent');
}

function validateAbilityUseByTag(ctx: AbilityContext, tag: AbilityTag): ValidationResult {
    if (isCardSuppressed(ctx.state, ctx.cardUid)) {
        return { valid: false, error: '该卡牌能力已被压制' };
    }
    const validator = resolveAbilityDefinition(ctx.defId, tag)?.validateUse;
    const error = validator?.(ctx) ?? null;
    return error ? { valid: false, error } : { valid: true };
}

export function validateTalentUse(ctx: AbilityContext): ValidationResult {
    return validateAbilityUseByTag(ctx, 'talent');
}

/** 快捷：解析 special 能力 */
export function resolveSpecial(defId: string): AbilityExecutor | undefined {
    return resolveAbility(defId, 'special');
}

export function requireSpecial(defId: string, reason?: string): AbilityExecutor {
    return requireAbility(defId, 'special', reason);
}

export function validateSpecialUse(ctx: AbilityContext): ValidationResult {
    return validateAbilityUseByTag(ctx, 'special');
}

/** 快捷：解析 onDestroy 能力 */
export function resolveOnDestroy(defId: string): AbilityExecutor | undefined {
    return resolveAbility(defId, 'onDestroy');
}

/** 快捷：解析 onUncover 能力 */
export function resolveOnUncover(defId: string): AbilityExecutor | undefined {
    return resolveAbility(defId, 'onUncover');
}

export function requireOnUncover(defId: string, reason?: string): AbilityExecutor {
    return requireAbility(defId, 'onUncover', reason);
}

/** 快捷：解析在场主动 ongoing 能力 */
export function resolveOngoingActivation(defId: string): AbilityExecutor | undefined {
    return resolveAbility(defId, 'ongoingActivation');
}

/** 检查某 defId 是否注册了指定 tag 的能力 */
export function hasAbility(defId: string, tag: AbilityTag): boolean {
    return registry.get(defId)?.has(tag) ?? false;
}

/** 清空注册表（测试用） */
export function clearRegistry(): void {
    registry.clear();
}

/** 获取注册表大小（调试用） */
export function getRegistrySize(): number {
    let count = 0;
    for (const tagMap of registry.values()) {
        count += tagMap.size;
    }
    return count;
}

/**
 * 为所有 POD 版本的卡牌批量注册能力别名。
 *
 * POD 版 defId 格式为“原版defId + _pod”（如 ninja_master_pod）。
 * 此函数遍历已注册表，将符合原始形式的 defId 的所有 tag 能力复制给对应的 _pod 版本。
 * 这样无需为每个 POD 卡单独编写能力代码，就能让其自动继承基础版的全套游戏逻辑。
 *
 * 必须在所有功能注册完毕后调用此函数。
 */
export function registerPodAbilityAliases(): void {
    const allEntries = Array.from(registry.entries());

    for (const [defId, tagMap] of allEntries) {
        // 跳过已经是 _pod 和非完整 defId 的条目
        if (defId.endsWith('_pod')) continue;
        if (defId.includes('_pod_')) continue;
        if (getTitanDef(defId)) continue;
        if (!shouldGenerateSmashUpPodAlias('ability', defId)) continue;

        const podDefId = `${defId}_pod`;
        const podTagMap = registry.get(podDefId) ?? new Map<AbilityTag, RegisteredAbility>();
        for (const [tag, definition] of tagMap.entries()) {
            if (podTagMap.has(tag)) continue;
            podTagMap.set(tag, { ...definition, generatedPodAlias: true });
        }
        registry.set(podDefId, podTagMap);
    }
}

/** 获取所有已注册的 defId::tag 键（用于能力行为审计） */
export function getRegisteredAbilityKeys(): Set<string> {
    const keys = new Set<string>();
    for (const [defId, tagMap] of registry.entries()) {
        if (shouldHideGeneratedPodAbilityAlias(defId, tagMap)) continue;
        for (const tag of tagMap.keys()) {
            keys.add(`${defId}::${tag}`);
        }
    }
    return keys;
}

function shouldExposePodAbilityAlias(defId: string): boolean {
    const podCard = getCardDef(`${defId}_pod`);
    if (podCard) {
        return true;
    }
    return Boolean(getBaseDef(`${defId}_pod`) || getTitanDef(`${defId}_pod`));
}

function shouldHideGeneratedPodAbilityAlias(
    defId: string,
    tagMap: Map<AbilityTag, RegisteredAbility>,
): boolean {
    if (!defId.endsWith('_pod')) return false;
    if (!tagMap.size) return false;
    if ([...tagMap.values()].some((definition) => !definition.generatedPodAlias)) return false;
    return !shouldExposePodAbilityAlias(defId.slice(0, -4));
}


