/**
 * 大杀四方 - 持续力量修正系统
 *
 * 纯计算层：根据场上状态动态计算随从的力量修正。
 * 不修改状态，只在需要计算力量时调用。
 *
 * 设计原则：
 * - 每个持续能力注册一个 PowerModifierFn
 * - 计算时遍历基地上所有随从，对每个随从调用所有相关修正函数
 * - 修正函数接收当前游戏状态和目标随从信息，返回力量增减值
 */

import type { PlayerId } from '../../../engine/types';
import type { SmashUpCore, MinionOnBase, BaseInPlay, TitanState } from './types';
import { getMunchkinSpecialCardDescriptor } from '../data/factions/munchkin';
import { getBaseDef, getCardDef } from '../data/cards';
import { getSuppressionFilteredStateForSource, isBaseAbilitySuppressed, isBaseScoringSuppressed, isCardSuppressed } from './ongoingEffects';
import { shouldGenerateSmashUpPodAlias } from './variantBindingRuntime';
import {
    countSemanticControlledMinionCandidates,
    countSemanticControlledRuntimeActions,
    countSemanticMatchedMinionCandidates,
    filterSemanticMatchedRuntimeActions,
    getSemanticActionControllerId,
    matchesSemanticRuntimeDefId,
    type SemanticControllerLens,
    type SemanticRuntimeAction,
    type SemanticRuntimeActionMatchOptions,
} from './effectSemantics';

// ============================================================================
// 类型定义
// ============================================================================

/** 力量修正上下文 */
export interface PowerModifierContext {
    /** 当前游戏状态 */
    state: SmashUpCore;
    /** 被计算的随从 */
    minion: MinionOnBase;
    /** 随从所在基地索引 */
    baseIndex: number;
    /** 随从所在基地 */
    base: BaseInPlay;
    /** 当前正在计算的修正来源 defId；用于 POD/base 共享规则的精确来源收口 */
    modifierSourceDefId?: string;
}

/** 力量修正函数：返回力量增减值（正数=加，负数=减） */
export type PowerModifierFn = (ctx: PowerModifierContext) => number;

/** POD 变体 authoring 语义 */
export type ModifierVariantPolicy =
    | 'inherit'     // 基础版默认可被 POD 继承；若存在显式 _pod 注册则由 _pod 覆盖
    | 'override'    // 显式 _pod 规则覆盖基础版语义，不允许补充后回流污染基础版
    | 'baseOnly';   // 规则只属于基础版，不自动生成 _pod alias，也不暴露 _pod 审计项

/** 运行时内部 POD 注册策略；`selfManaged` 仅保留给 legacy 例外 */
export type PodVariantStrategy =
    | ModifierVariantPolicy
    | 'selfManaged';

export type OngoingControllerLens = SemanticControllerLens;

export type ModifierExceptionAuditTag = 'legacySelfManaged';

interface ModifierRegistrationOptions {
    variantPolicy?: ModifierVariantPolicy;
    podStrategy?: PodVariantStrategy;
    exceptionAuditTag?: ModifierExceptionAuditTag;
}

export interface PowerModifierDefinition extends ModifierRegistrationOptions {
    sourceDefId: string;
    modifier: PowerModifierFn;
}

/** 修正来源信息 */
interface ModifierEntry {
    /** 来源随从 defId（提供修正的随从） */
    sourceDefId: string;
    /** 修正函数 */
    modifier: PowerModifierFn;
    /** POD 变体注册策略 */
    podStrategy: PodVariantStrategy;
    /** 受审计的 legacy 例外标签 */
    exceptionAuditTag?: ModifierExceptionAuditTag;
}

export type ModifierRuntimeAction = SemanticRuntimeAction;

export type RuntimeActionMatchOptions = SemanticRuntimeActionMatchOptions;

export interface RuntimeActionControlOptions {
    controllerLens?: OngoingControllerLens;
    includeBaseOngoings?: boolean;
    includeMinionAttachments?: boolean;
}

export interface RuntimeMinionCountOptions {
    controllerId?: PlayerId;
    excludeSelf?: boolean;
}

export interface PowerModifierRuntimeHelpers {
    matchesRuntimeDefId(defId: unknown, baseDefId: string): boolean;
    getActionControllerId(action: ModifierRuntimeAction, lens?: OngoingControllerLens): PlayerId;
    getMinionAttachmentCount(ctx: PowerModifierContext): number;
    countMinionsOnBaseControlledBy(
        ctx: PowerModifierContext,
        controllerId: PlayerId,
        options?: { excludeSelf?: boolean },
    ): number;
    countMinionsOnBaseMatchingRuntimeDefId(
        ctx: PowerModifierContext,
        baseDefId: string,
        options?: RuntimeMinionCountOptions,
    ): number;
    countMinionsInPlayControlledBy(
        ctx: PowerModifierContext,
        controllerId: PlayerId,
        options?: { excludeSelf?: boolean },
    ): number;
    countMinionsInPlayMatchingRuntimeDefId(
        ctx: PowerModifierContext,
        baseDefId: string,
        options?: RuntimeMinionCountOptions,
    ): number;
    countMinionAttachmentsMatchingRuntimeDefId(
        ctx: PowerModifierContext,
        baseDefId: string,
        options?: RuntimeActionMatchOptions,
    ): number;
    sumMinionAttachmentsMatchingRuntimeDefId(
        ctx: PowerModifierContext,
        baseDefId: string,
        mapper: (action: ModifierRuntimeAction) => number,
        options?: RuntimeActionMatchOptions,
    ): number;
    countBaseOngoingsMatchingRuntimeDefId(
        ctx: PowerModifierContext,
        baseDefId: string,
        options?: RuntimeActionMatchOptions,
    ): number;
    sumBaseOngoingsMatchingRuntimeDefId(
        ctx: PowerModifierContext,
        baseDefId: string,
        mapper: (action: ModifierRuntimeAction) => number,
        options?: RuntimeActionMatchOptions,
    ): number;
    countActionsOnBaseControlledBy(
        ctx: PowerModifierContext,
        controllerId: PlayerId,
        options?: RuntimeActionControlOptions,
    ): number;
    hasMinionOnBaseControlledBy(base: BaseInPlay, controllerId: PlayerId): boolean;
}

/** 临界点修正上下文 */
export interface BreakpointModifierContext {
    /** 当前游戏状态 */
    state: SmashUpCore;
    /** 基地索引 */
    baseIndex: number;
    /** 基地 */
    base: BaseInPlay;
    /** 原始临界点值 */
    originalBreakpoint: number;
}

/** 临界点修正函数：返回增减值（正数=提高临界点，负数=降低） */
export type BreakpointModifierFn = (ctx: BreakpointModifierContext) => number;

/** 基地级别力量修正上下文 */
export interface BasePowerModifierContext {
    /** 当前游戏状态 */
    state: SmashUpCore;
    /** 基地索引 */
    baseIndex: number;
    /** 基地 */
    base: BaseInPlay;
    /** 玩家 ID */
    playerId: PlayerId;
    /** 当前处理的 ongoing 卡（可选，用于判断卡的所有者） */
    ongoing?: { uid: string; defId: string; ownerId: string; metadata?: Record<string, unknown> };
}

/** 基地级别力量修正函数：返回该玩家在该基地的额外力量 */
export type BasePowerModifierFn = (ctx: BasePowerModifierContext) => number;

/** 临界点修正来源 */
interface BreakpointModifierEntry {
    sourceDefId: string;
    modifier: BreakpointModifierFn;
    podStrategy: PodVariantStrategy;
    exceptionAuditTag?: ModifierExceptionAuditTag;
}

export interface BreakpointModifierDefinition extends ModifierRegistrationOptions {
    sourceDefId: string;
    modifier: BreakpointModifierFn;
}

interface BasePowerModifierEntry {
    defId: string;
    modifier: BasePowerModifierFn;
    podStrategy: PodVariantStrategy;
    exceptionAuditTag?: ModifierExceptionAuditTag;
}

export interface BasePowerModifierDefinition extends ModifierRegistrationOptions {
    defId: string;
    modifier: BasePowerModifierFn;
}

export interface CustomPowerModifierDefinition extends ModifierRegistrationOptions {
    sourceDefId: string;
    runtimeIdentity?: 'entity' | 'actionFamily' | 'synthetic';
    compute: (ctx: PowerModifierContext, helpers: PowerModifierRuntimeHelpers) => number;
}

export interface CustomBasePowerModifierDefinition extends ModifierRegistrationOptions {
    defId: string;
    compute: (ctx: BasePowerModifierContext, helpers: PowerModifierRuntimeHelpers) => number;
}

export interface CustomBreakpointModifierDefinition extends ModifierRegistrationOptions {
    sourceDefId: string;
    runtimeIdentity?: 'entity' | 'actionFamily' | 'synthetic';
    compute: (ctx: BreakpointModifierContext, helpers: PowerModifierRuntimeHelpers) => number;
}

export interface ModifierExceptionAuditSnapshot {
    powerModifierIds: string[];
    breakpointModifierIds: string[];
    basePowerModifierIds: string[];
}

// ============================================================================
// 注册表
// ============================================================================

/** 持续力量修正注册表 */
const modifierRegistry: ModifierEntry[] = [];
const generatedPodModifierAliases = new Set<string>();

/** 持续临界点修正注册表 */
const breakpointModifierRegistry: BreakpointModifierEntry[] = [];
const generatedPodBreakpointAliases = new Set<string>();

/** 基地级别力量修正注册表 */
const basePowerModifiers: Map<string, BasePowerModifierEntry> = new Map();
const generatedPodBasePowerAliases = new Set<string>();

export interface TitanPowerModifierContext {
    state: SmashUpCore;
    titan: TitanState;
    baseIndex: number;
    base: BaseInPlay;
    playerId: PlayerId;
}

export type TitanPowerModifierFn = (ctx: TitanPowerModifierContext) => number;

const titanPowerModifiers: Map<string, TitanPowerModifierFn> = new Map();

function normalizeDefId(defId: string): string {
    return defId.endsWith('_pod') ? defId.slice(0, -4) : defId;
}

export function matchesRuntimeDefId(defId: unknown, baseDefId: string): boolean {
    return matchesSemanticRuntimeDefId(defId, baseDefId);
}

export function getActionControllerId(
    action: ModifierRuntimeAction,
    lens: OngoingControllerLens = 'sourceController',
): PlayerId {
    return getSemanticActionControllerId(action, lens);
}

function isEntityBackedModifierSource(defId: string): boolean {
    return Boolean(getCardDef(defId) || getBaseDef(defId));
}

function shouldExposePodModifierAlias(defId: string): boolean {
    const podCard = getCardDef(`${defId}_pod`);
    if (podCard) {
        return podCard.abilityTags?.includes('ongoing') ?? false;
    }
    return Boolean(getBaseDef(`${defId}_pod`));
}

function getPodStrategy(
    sourceDefId: string,
    options?: ModifierRegistrationOptions,
): PodVariantStrategy {
    if (options?.podStrategy) {
        return options.podStrategy;
    }
    if (options?.variantPolicy === 'baseOnly') {
        return 'baseOnly';
    }
    if (options?.variantPolicy === 'override') {
        if (!sourceDefId.endsWith('_pod')) {
            throw new Error(`variantPolicy "override" 需要显式 _pod defId：${sourceDefId}`);
        }
        return 'inherit';
    }
    return 'inherit';
}

function shouldAutoCreatePodAlias(strategy: PodVariantStrategy): boolean {
    return strategy === 'inherit';
}

function shouldExposeSelfManagedPodAudit(defId: string, strategy: PodVariantStrategy): boolean {
    return strategy === 'selfManaged'
        && isEntityBackedModifierSource(defId)
        && shouldExposePodModifierAlias(defId);
}

function shouldSkipPowerModifierForTarget(
    entry: ModifierEntry,
    minion: MinionOnBase,
): boolean {
    if (entry.sourceDefId.endsWith('_pod')) {
        return minion.defId === entry.sourceDefId.slice(0, -4);
    }

    const podId = `${entry.sourceDefId}_pod`;
    if (minion.defId !== podId) {
        return false;
    }

    if (entry.podStrategy === 'baseOnly') {
        return true;
    }

    return modifierRegistry.some((candidate) => candidate.sourceDefId === podId);
}

function getFilteredPowerModifierContext(
    state: SmashUpCore,
    minion: MinionOnBase,
    baseIndex: number,
    sourceDefId: string,
    includePodAlias = false,
): PowerModifierContext {
    let filteredState = getSuppressionFilteredStateForSource(state, sourceDefId);
    if (includePodAlias && !sourceDefId.endsWith('_pod')) {
        filteredState = getSuppressionFilteredStateForSource(filteredState, `${sourceDefId}_pod`);
    }
    const filteredBase = filteredState.bases[baseIndex] ?? state.bases[baseIndex];
    const filteredMinion = filteredBase?.minions.find(candidate => candidate.uid === minion.uid) ?? minion;
    return {
        state: filteredState,
        minion: filteredMinion,
        baseIndex,
        base: filteredBase,
        modifierSourceDefId: sourceDefId,
    };
}

function getFilteredBreakpointModifierContext(
    state: SmashUpCore,
    baseIndex: number,
    sourceDefId: string,
    originalBreakpoint: number,
): BreakpointModifierContext {
    const filteredState = getSuppressionFilteredStateForSource(state, sourceDefId);
    return {
        state: filteredState,
        baseIndex,
        base: filteredState.bases[baseIndex] ?? state.bases[baseIndex],
        originalBreakpoint,
    };
}

function rewriteBaseOngoingDefIdForPodAlias(
    state: SmashUpCore,
    baseIndex: number,
    podDefId: string,
    baseDefId: string,
): { state: SmashUpCore; base: BaseInPlay } {
    const originalBase = state.bases[baseIndex] ?? { defId: 'missing_base', minions: [], ongoingActions: [] };
    const rewrittenBase: BaseInPlay = {
        ...originalBase,
        ongoingActions: originalBase.ongoingActions.map((action) => (
            action.defId === podDefId ? { ...action, defId: baseDefId } : action
        )),
    };
    const rewrittenBases = state.bases.slice();
    rewrittenBases[baseIndex] = rewrittenBase;
    return {
        state: { ...state, bases: rewrittenBases },
        base: rewrittenBase,
    };
}

/**
 * 注册一个持续力量修正
 * 
 * @param sourceDefId 提供修正的随从 defId（如 'robot_microbot_alpha'）
 * @param modifier 修正函数
 * @param options 可选配置
 * @param options.podStrategy POD 变体策略。默认 `inherit`：
 * - `inherit`：基础版默认可被 POD 继承，若存在显式 `_pod` 注册则由 `_pod` 覆盖
 * - `selfManaged`：legacy 兼容入口；只有当前 unified authoring surface 表达不了时才允许保留
 * - `baseOnly`：规则只属于基础版，不自动生成 `_pod`
 */
export function registerPowerModifier(
    sourceDefId: string,
    modifier: PowerModifierFn,
    options?: ModifierRegistrationOptions,
): void {
    // 去重保护：同一 sourceDefId 只注册一次（防止 HMR 重复注册）
    if (modifierRegistry.some(e => e.sourceDefId === sourceDefId)) return;
    modifierRegistry.push({
        sourceDefId,
        modifier,
        podStrategy: getPodStrategy(sourceDefId, options),
        exceptionAuditTag: options?.exceptionAuditTag,
    });
}

export function registerPowerModifiers(
    definitions: readonly PowerModifierDefinition[],
): void {
    for (const definition of definitions) {
        registerPowerModifier(definition.sourceDefId, definition.modifier, {
            variantPolicy: definition.variantPolicy,
            podStrategy: definition.podStrategy,
            exceptionAuditTag: definition.exceptionAuditTag,
        });
    }
}

/**
 * 注册一个基地级别力量修正
 * 
 * @param defId ongoing 行动卡的 defId（如 'steampunk_aggromotive'）
 * @param modifier 修正函数
 */
export function registerBasePowerModifier(
    defId: string,
    modifier: BasePowerModifierFn,
    options?: ModifierRegistrationOptions,
): void {
    basePowerModifiers.set(defId, {
        defId,
        modifier,
        podStrategy: getPodStrategy(defId, options),
        exceptionAuditTag: options?.exceptionAuditTag,
    });
}

export function registerBasePowerModifiers(
    definitions: readonly BasePowerModifierDefinition[],
): void {
    for (const definition of definitions) {
        registerBasePowerModifier(definition.defId, definition.modifier, {
            variantPolicy: definition.variantPolicy,
            podStrategy: definition.podStrategy,
            exceptionAuditTag: definition.exceptionAuditTag,
        });
    }
}

export function registerTitanPowerModifier(defId: string, modifier: TitanPowerModifierFn): void {
    titanPowerModifiers.set(defId, modifier);
}

/**
 * 计算玩家在基地的额外力量（来自基地级别修正）
 * 
 * @param state 当前游戏状态
 * @param baseIndex 基地索引
 * @param playerId 玩家 ID
 * @returns 额外力量值
 */
export function getBasePowerModifiers(
    state: SmashUpCore,
    baseIndex: number,
    playerId: PlayerId
): number {
    const base = state.bases[baseIndex];
    let total = 0;

    const baseEntry = basePowerModifiers.get(base.defId);
    if (baseEntry && !isBaseAbilitySuppressed(state, baseIndex)) {
        const filteredState = getSuppressionFilteredStateForSource(state, base.defId);
        total += baseEntry.modifier({
            state: filteredState,
            baseIndex,
            base: filteredState.bases[baseIndex] ?? base,
            playerId,
        });
    }

    // 遍历基地上的所有 ongoing 行动卡
    for (const ongoing of base.ongoingActions) {
        if (isCardSuppressed(state, ongoing.uid)) continue;
        const entry = basePowerModifiers.get(ongoing.defId);
        if (entry) {
            const filteredState = getSuppressionFilteredStateForSource(state, ongoing.defId);
            total += entry.modifier({
                state: filteredState,
                baseIndex,
                base: filteredState.bases[baseIndex] ?? base,
                playerId,
                ongoing,
            });
        }
    }

    return total;
}

export function getTempBasePowerModifier(
    state: SmashUpCore,
    baseIndex: number,
    playerId: PlayerId,
): number {
    const baseInstanceId = state.bases[baseIndex]?.instanceId;
    return (baseInstanceId ? state.tempBasePowerModifiersByBaseId?.[baseInstanceId]?.[playerId] : undefined)
        ?? state.tempBasePowerModifiers?.[baseIndex]?.[playerId]
        ?? 0;
}

// ============================================================================
// 声明式 ongoing 力量修正 API（通用，自动按实例数叠加）
// ============================================================================

/** ongoing 卡附着位置 */
export type OngoingLocation = 'base' | 'minion';

/** ongoing 卡生效目标 */
export type OngoingTarget =
    | 'allMinions'       // 基地上所有随从
    | 'opponentMinions'  // 基地上非 owner 的随从
    | 'ownerMinions'     // 基地上 owner 的随从
    | 'self'             // 被附着的随从自身
    | 'firstOwnerMinion'; // owner 在此基地的第一个随从（用于"总力量+N"效果）

export interface OngoingPowerModifierDefinition {
    defId: string;
    location: OngoingLocation;
    target: OngoingTarget;
    delta: number;
    variantPolicy?: ModifierVariantPolicy;
    controllerLens?: OngoingControllerLens;
    condition?: (ctx: PowerModifierContext) => boolean;
}

/**
 * 声明式注册 ongoing 力量修正（通用，自动按实例数叠加）
 *
 * 适用于"基地/随从上有 N 张该 ongoing 卡 → 每张给目标 +delta 力量"的标准模式。
 * 计算层自动 filter 实例数并乘以 delta，无需手写查询逻辑。
 *
 * @param defId ongoing 行动卡的 defId
 * @param location 卡附着在基地上还是随从上
 * @param target 修正生效的目标随从范围
 * @param delta 每张卡的力量修正值（正=加，负=减）
 * @param condition 额外生效条件（可选，返回 false 时该张卡不生效）
 */
export function registerOngoingPowerModifier(
    defId: string,
    location: OngoingLocation,
    target: OngoingTarget,
    delta: number,
    condition?: (ctx: PowerModifierContext) => boolean,
    options?: Pick<OngoingPowerModifierDefinition, 'variantPolicy' | 'controllerLens'>,
): void {
    registerPowerModifier(defId, (ctx: PowerModifierContext) => {
        if (location === 'minion') {
            const count = powerModifierRuntimeHelpers.countMinionAttachmentsMatchingRuntimeDefId(ctx, defId);
            if (count === 0) return 0;
            if (condition && !condition(ctx)) return 0;
            return count * delta;
        }

        switch (target) {
            case 'opponentMinions': {
                const count = powerModifierRuntimeHelpers.countBaseOngoingsMatchingRuntimeDefId(ctx, defId, {
                    controllerLens: options?.controllerLens,
                    relationToTargetController: 'different',
                });
                if (count === 0) return 0;
                if (condition && !condition(ctx)) return 0;
                return count * delta;
            }
            case 'ownerMinions': {
                const count = powerModifierRuntimeHelpers.countBaseOngoingsMatchingRuntimeDefId(ctx, defId, {
                    controllerLens: options?.controllerLens,
                    relationToTargetController: 'same',
                });
                if (count === 0) return 0;
                if (condition && !condition(ctx)) return 0;
                return count * delta;
            }
            case 'firstOwnerMinion': {
                const count = powerModifierRuntimeHelpers.countBaseOngoingsMatchingRuntimeDefId(ctx, defId, {
                    controllerLens: options?.controllerLens,
                    relationToTargetController: 'same',
                });
                if (count === 0) return 0;
                const firstMinion = ctx.base.minions.find(m => m.controller === ctx.minion.controller);
                if (!firstMinion || firstMinion.uid !== ctx.minion.uid) return 0;
                if (condition && !condition(ctx)) return 0;
                return count * delta;
            }
            case 'allMinions': {
                const count = powerModifierRuntimeHelpers.countBaseOngoingsMatchingRuntimeDefId(ctx, defId, {
                    controllerLens: options?.controllerLens,
                });
                if (count === 0) return 0;
                if (condition && !condition(ctx)) return 0;
                return count * delta;
            }
            case 'self':
            default:
                return 0; // 'self' 对基地 ongoing 无意义
        }
    }, {
        podStrategy: options?.variantPolicy === 'baseOnly' ? 'baseOnly' : 'selfManaged',
    });
}

export function registerOngoingPowerModifiers(
    definitions: readonly OngoingPowerModifierDefinition[],
): void {
    for (const definition of definitions) {
        registerOngoingPowerModifier(
            definition.defId,
            definition.location,
            definition.target,
            definition.delta,
            definition.condition,
            {
                variantPolicy: definition.variantPolicy,
                controllerLens: definition.controllerLens,
            },
        );
    }
}

/**
 * 统一 custom authoring surface：
 * 复杂规则允许自定义算法，但必须复用 shared runtime helpers，而不是继续散落 raw `_pod` / controller 判断。
 */
export function registerCustomPowerModifiers(
    definitions: readonly CustomPowerModifierDefinition[],
): void {
    for (const definition of definitions) {
        const variantOptions = definition.runtimeIdentity === 'actionFamily'
            ? { podStrategy: 'selfManaged' as const }
            : definition.runtimeIdentity === 'synthetic'
                ? { podStrategy: 'baseOnly' as const }
                : { variantPolicy: definition.variantPolicy };
        registerPowerModifier(
            definition.sourceDefId,
            (ctx) => definition.compute(ctx, powerModifierRuntimeHelpers),
            variantOptions,
        );
    }
}

export function registerCustomBasePowerModifiers(
    definitions: readonly CustomBasePowerModifierDefinition[],
): void {
    for (const definition of definitions) {
        registerBasePowerModifier(
            definition.defId,
            (ctx) => definition.compute(ctx, powerModifierRuntimeHelpers),
            { variantPolicy: definition.variantPolicy },
        );
    }
}

export function registerCustomBreakpointModifiers(
    definitions: readonly CustomBreakpointModifierDefinition[],
): void {
    for (const definition of definitions) {
        const variantOptions = definition.runtimeIdentity === 'actionFamily'
            ? { podStrategy: 'selfManaged' as const }
            : definition.runtimeIdentity === 'synthetic'
                ? { podStrategy: 'baseOnly' as const }
                : { variantPolicy: definition.variantPolicy };
        registerBreakpointModifier(
            definition.sourceDefId,
            (ctx) => definition.compute(ctx, powerModifierRuntimeHelpers),
            variantOptions,
        );
    }
}

/**
 * 注册一个临界点修正
 * 
 * @param sourceDefId 提供修正的来源 defId
 * @param modifier 修正函数
 */
export function registerBreakpointModifier(
    sourceDefId: string,
    modifier: BreakpointModifierFn,
    options?: ModifierRegistrationOptions,
): void {
    // 去重保护：同一 sourceDefId 只注册一次（防止 HMR 重复注册）
    if (breakpointModifierRegistry.some(e => e.sourceDefId === sourceDefId)) return;
    breakpointModifierRegistry.push({
        sourceDefId,
        modifier,
        podStrategy: getPodStrategy(sourceDefId, options),
        exceptionAuditTag: options?.exceptionAuditTag,
    });
}

export function registerBreakpointModifiers(
    definitions: readonly BreakpointModifierDefinition[],
): void {
    for (const definition of definitions) {
        registerBreakpointModifier(definition.sourceDefId, definition.modifier, {
            variantPolicy: definition.variantPolicy,
            podStrategy: definition.podStrategy,
            exceptionAuditTag: definition.exceptionAuditTag,
        });
    }
}

/** 清空所有修正注册表（测试用） */
export function clearPowerModifierRegistry(): void {
    modifierRegistry.length = 0;
    breakpointModifierRegistry.length = 0;
    basePowerModifiers.clear();
    titanPowerModifiers.clear();
    generatedPodModifierAliases.clear();
    generatedPodBreakpointAliases.clear();
    generatedPodBasePowerAliases.clear();
}

/**
 * 自动为所有基础版力量修正创建 POD 版本映射
 * 
 * 必须在所有力量修正注册完毕后调用此函数。
 * 默认只为 `inherit` 策略生成 `_pod` alias。
 */
export function registerPodPowerModifierAliases(): void {
    let _mappedCount = 0;
    let _skippedCount = 0;
    
    // 1. 随从力量修正（modifierRegistry）
    const powerModsToAdd: ModifierEntry[] = [];
    for (const entry of modifierRegistry) {
        if (!entry.sourceDefId.endsWith('_pod')) {
            if (!shouldGenerateSmashUpPodAlias('powerModifier', entry.sourceDefId)) {
                continue;
            }
            const podId = entry.sourceDefId + '_pod';
            // 检查是否已经手动注册了 POD 版本
            if (!modifierRegistry.some(e => e.sourceDefId === podId)) {
                if (!shouldAutoCreatePodAlias(entry.podStrategy)) {
                    _skippedCount++;
                    continue;
                }
                powerModsToAdd.push({
                    sourceDefId: podId,
                    modifier: entry.modifier,
                    podStrategy: 'inherit',
                });
                generatedPodModifierAliases.add(podId);
                _mappedCount++;
            }
        }
    }
    modifierRegistry.push(...powerModsToAdd);
    
    // 2. 临界点修正（breakpointModifierRegistry）
    const breakpointModsToAdd: BreakpointModifierEntry[] = [];
    for (const entry of breakpointModifierRegistry) {
        if (!entry.sourceDefId.endsWith('_pod')) {
            const baseDefId = entry.sourceDefId;
            if (!shouldGenerateSmashUpPodAlias('powerModifier', baseDefId)) {
                continue;
            }
            const podId = `${baseDefId}_pod`;
            if (!breakpointModifierRegistry.some(e => e.sourceDefId === podId)) {
                if (!shouldAutoCreatePodAlias(entry.podStrategy)) {
                    _skippedCount++;
                    continue;
                }
                breakpointModsToAdd.push({
                    sourceDefId: podId,
                    modifier: (ctx) => {
                        const rewritten = rewriteBaseOngoingDefIdForPodAlias(
                            ctx.state,
                            ctx.baseIndex,
                            podId,
                            baseDefId,
                        );
                        return entry.modifier({
                            ...ctx,
                            state: rewritten.state,
                            base: rewritten.base,
                        });
                    },
                    podStrategy: 'inherit',
                });
                generatedPodBreakpointAliases.add(podId);
                _mappedCount++;
            }
        }
    }
    breakpointModifierRegistry.push(...breakpointModsToAdd);
    
    // 3. 基地级别力量修正（basePowerModifiers）
    const basePowerModsToAdd: BasePowerModifierEntry[] = [];
    for (const [defId, entry] of basePowerModifiers.entries()) {
        if (!defId.endsWith('_pod')) {
            const baseDefId = defId;
            if (!shouldGenerateSmashUpPodAlias('powerModifier', baseDefId)) {
                continue;
            }
            const podId = `${baseDefId}_pod`;
            if (!basePowerModifiers.has(podId)) {
                if (!shouldAutoCreatePodAlias(entry.podStrategy)) {
                    _skippedCount++;
                    continue;
                }
                basePowerModsToAdd.push({
                    defId: podId,
                    modifier: (ctx) => {
                    const rewritten = rewriteBaseOngoingDefIdForPodAlias(
                        ctx.state,
                        ctx.baseIndex,
                        podId,
                        baseDefId,
                    );
                    return entry.modifier({
                        ...ctx,
                        state: rewritten.state,
                        base: rewritten.base,
                        ongoing: ctx.ongoing?.defId === podId
                            ? { ...ctx.ongoing, defId: baseDefId }
                            : ctx.ongoing,
                    });
                    },
                    podStrategy: 'inherit',
                });
                generatedPodBasePowerAliases.add(podId);
                _mappedCount++;
            }
        }
    }
    for (const entry of basePowerModsToAdd) {
        basePowerModifiers.set(entry.defId, entry);
    }
    
    // 映射完成（已自动映射 POD 版本的力量修正）
}

/** 获取所有已注册的 sourceDefId（用于能力行为审计） */
export function getRegisteredModifierIds(): {
    powerModifierIds: Set<string>;
    breakpointModifierIds: Set<string>;
} {
    const powerModifierIds = new Set<string>();

    for (const entry of modifierRegistry) {
        if (
            generatedPodModifierAliases.has(entry.sourceDefId)
            && entry.sourceDefId.endsWith('_pod')
            && !shouldExposePodModifierAlias(entry.sourceDefId.slice(0, -4))
        ) {
            continue;
        }
        powerModifierIds.add(entry.sourceDefId);
        if (!entry.sourceDefId.endsWith('_pod')
            && shouldExposeSelfManagedPodAudit(entry.sourceDefId, entry.podStrategy)) {
            powerModifierIds.add(`${entry.sourceDefId}_pod`);
        }
    }

    for (const entry of basePowerModifiers.values()) {
        const defId = entry.defId;
        if (
            generatedPodBasePowerAliases.has(defId)
            && defId.endsWith('_pod')
            && !shouldExposePodModifierAlias(defId.slice(0, -4))
        ) {
            continue;
        }
        powerModifierIds.add(defId);
        if (!defId.endsWith('_pod')
            && shouldExposeSelfManagedPodAudit(defId, entry.podStrategy)) {
            powerModifierIds.add(`${defId}_pod`);
        }
    }

    for (const defId of titanPowerModifiers.keys()) {
        powerModifierIds.add(defId);
    }

    return {
        powerModifierIds,
        breakpointModifierIds: new Set(
            breakpointModifierRegistry
                .filter((entry) => !(
                    generatedPodBreakpointAliases.has(entry.sourceDefId)
                    && entry.sourceDefId.endsWith('_pod')
                    && !shouldExposePodModifierAlias(entry.sourceDefId.slice(0, -4))
                ))
                .flatMap((entry) => {
                    const ids = [entry.sourceDefId];
                    if (!entry.sourceDefId.endsWith('_pod')
                        && shouldExposeSelfManagedPodAudit(entry.sourceDefId, entry.podStrategy)) {
                        ids.push(`${entry.sourceDefId}_pod`);
                    }
                    return ids;
                }),
        ),
    };
}

export function getModifierExceptionAuditSnapshot(): ModifierExceptionAuditSnapshot {
    const powerModifierIds = modifierRegistry
        .filter((entry) => entry.exceptionAuditTag === 'legacySelfManaged')
        .map((entry) => entry.sourceDefId)
        .sort();
    const breakpointModifierIds = breakpointModifierRegistry
        .filter((entry) => entry.exceptionAuditTag === 'legacySelfManaged')
        .map((entry) => entry.sourceDefId)
        .sort();
    const basePowerModifierIds = [...basePowerModifiers.values()]
        .filter((entry) => entry.exceptionAuditTag === 'legacySelfManaged')
        .map((entry) => entry.defId)
        .sort();

    return {
        powerModifierIds,
        breakpointModifierIds,
        basePowerModifierIds,
    };
}

function filterRuntimeMatchedActions(
    ctx: PowerModifierContext,
    actions: readonly ModifierRuntimeAction[],
    baseDefId: string,
    options?: RuntimeActionMatchOptions,
): ModifierRuntimeAction[] {
    const explicitPodSourceId = ctx.modifierSourceDefId && !ctx.modifierSourceDefId.endsWith('_pod')
        ? `${ctx.modifierSourceDefId}_pod`
        : undefined;
    const exactDefId = options?.exactDefId
        ?? (
            explicitPodSourceId
            && ctx.modifierSourceDefId === baseDefId
            && modifierRegistry.some(entry => entry.sourceDefId === explicitPodSourceId)
                ? ctx.modifierSourceDefId
                : undefined
        );
    return filterSemanticMatchedRuntimeActions(
        { state: ctx.state, minion: ctx.minion, baseIndex: ctx.baseIndex },
        actions,
        baseDefId,
        exactDefId ? { ...options, exactDefId } : options,
    ) as ModifierRuntimeAction[];
}

function getScopedExactRuntimeDefId(
    ctx: PowerModifierContext,
    baseDefId: string,
): string | undefined {
    if (!ctx.modifierSourceDefId) return undefined;
    return normalizeDefId(ctx.modifierSourceDefId) === normalizeDefId(baseDefId)
        ? ctx.modifierSourceDefId
        : undefined;
}

const powerModifierRuntimeHelpers: PowerModifierRuntimeHelpers = {
    matchesRuntimeDefId,
    getActionControllerId,
    getMinionAttachmentCount: (ctx) => ctx.minion.attachedActions.length,
    countMinionsOnBaseControlledBy: (ctx, controllerId, options) => (
        countSemanticControlledMinionCandidates(
            ctx.base.minions.map((minion) => ({ minion, baseIndex: ctx.baseIndex })),
            controllerId,
            { excludeMinionUid: options?.excludeSelf ? ctx.minion.uid : undefined },
        )
    ),
    countMinionsOnBaseMatchingRuntimeDefId: (ctx, baseDefId, options) => (
        countSemanticMatchedMinionCandidates(
            ctx.state,
            ctx.base.minions.map((minion) => ({ minion, baseIndex: ctx.baseIndex })),
            baseDefId,
            {
                controllerId: options?.controllerId,
                exactDefId: getScopedExactRuntimeDefId(ctx, baseDefId),
                excludeMinionUid: options?.excludeSelf ? ctx.minion.uid : undefined,
                semanticRole: 'material',
            },
        )
    ),
    countMinionsInPlayControlledBy: (ctx, controllerId, options) => (
        countSemanticControlledMinionCandidates(
            ctx.state.bases.flatMap((base, baseIndex) => base.minions.map((minion) => ({ minion, baseIndex }))),
            controllerId,
            { excludeMinionUid: options?.excludeSelf ? ctx.minion.uid : undefined },
        )
    ),
    countMinionsInPlayMatchingRuntimeDefId: (ctx, baseDefId, options) => (
        countSemanticMatchedMinionCandidates(
            ctx.state,
            ctx.state.bases.flatMap((base, baseIndex) => base.minions.map((minion) => ({ minion, baseIndex }))),
            baseDefId,
            {
                controllerId: options?.controllerId,
                exactDefId: getScopedExactRuntimeDefId(ctx, baseDefId),
                excludeMinionUid: options?.excludeSelf ? ctx.minion.uid : undefined,
                semanticRole: 'material',
            },
        )
    ),
    countMinionAttachmentsMatchingRuntimeDefId: (ctx, baseDefId, options) => (
        filterRuntimeMatchedActions(ctx, ctx.minion.attachedActions, baseDefId, options).length
    ),
    sumMinionAttachmentsMatchingRuntimeDefId: (ctx, baseDefId, mapper, options) => (
        filterRuntimeMatchedActions(ctx, ctx.minion.attachedActions, baseDefId, options)
            .reduce((total, action) => total + mapper(action), 0)
    ),
    countBaseOngoingsMatchingRuntimeDefId: (ctx, baseDefId, options) => (
        filterRuntimeMatchedActions(ctx, ctx.base.ongoingActions, baseDefId, options).length
    ),
    sumBaseOngoingsMatchingRuntimeDefId: (ctx, baseDefId, mapper, options) => (
        filterRuntimeMatchedActions(ctx, ctx.base.ongoingActions, baseDefId, options)
            .reduce((total, action) => total + mapper(action), 0)
    ),
    countActionsOnBaseControlledBy: (ctx, controllerId, options) => (
        countSemanticControlledRuntimeActions(ctx.base, controllerId, {
            controllerLens: options?.controllerLens,
            includeBaseOngoings: options?.includeBaseOngoings,
            includeMinionAttachments: options?.includeMinionAttachments,
        })
    ),
    hasMinionOnBaseControlledBy: (base, controllerId) => (
        base.minions.some((minion) => minion.controller === controllerId)
    ),
};

// ============================================================================
// 力量计算
// ============================================================================

/** 力量修正明细（单个来源） */
export interface PowerModifierDetail {
    /** 来源随从/卡牌 defId */
    sourceDefId: string;
    /** 显示名称（i18n key，如 cards.xxx.name） */
    sourceName: string;
    /** 修正值 */
    value: number;
}

/**
 * 获取随从的持续力量修正明细列表
 *
 * 与 getOngoingPowerModifier 逻辑一致，但返回每个非零修正的来源信息，
 * 而非仅返回总和。用于 ActionLog breakdown 展示。
 */
export function getOngoingPowerModifierDetails(
    state: SmashUpCore,
    minion: MinionOnBase,
    baseIndex: number
): PowerModifierDetail[] {
    if (modifierRegistry.length === 0) return [];

    const base = state.bases[baseIndex];
    if (!base) return [];

    const details: PowerModifierDetail[] = [];
    for (const entry of modifierRegistry) {
        if (shouldSkipPowerModifierForTarget(entry, minion)) {
            continue;
        }
        if (isCardSuppressed(state, minion.uid)
            && normalizeDefId(minion.defId) === normalizeDefId(entry.sourceDefId)) {
            continue;
        }
        const ctx = getFilteredPowerModifierContext(
            state,
            minion,
            baseIndex,
            entry.sourceDefId,
            entry.podStrategy === 'selfManaged',
        );
        const value = entry.modifier(ctx);
        if (value !== 0) {
            // 修正来源可能是卡牌或基地；tooltip 里不要暴露内部 defId。
            const cardDef = getCardDef(entry.sourceDefId);
            const baseDef = getBaseDef(entry.sourceDefId);
            details.push({
                sourceDefId: entry.sourceDefId,
                sourceName: cardDef?.name ?? baseDef?.name ?? entry.sourceDefId,
                value,
            });
        }
    }
    return details;
}

/**
 * 获取随从的完整力量 breakdown
 *
 * 组合基础力量、永久修正、临时修正和持续修正明细。
 * 不修改现有 getEffectivePower 的计算逻辑。
 */
export function getEffectivePowerBreakdown(
    state: SmashUpCore,
    minion: MinionOnBase,
    baseIndex: number
): {
    basePower: number;
    powerCounters: number;
    permanentModifier: number;
    tempModifier: number;
    ongoingDetails: PowerModifierDetail[];
    finalPower: number;
} {
    const ongoingDetails = getOngoingPowerModifierDetails(state, minion, baseIndex);
    const ongoingTotal = ongoingDetails.reduce((sum, d) => sum + d.value, 0);
    const counters = minion.powerCounters ?? 0;
    return {
        basePower: minion.basePower,
        powerCounters: counters,
        permanentModifier: minion.powerModifier,
        tempModifier: minion.tempPowerModifier ?? 0,
        ongoingDetails,
        finalPower: Math.max(0, minion.basePower + counters + minion.powerModifier + (minion.tempPowerModifier ?? 0) + ongoingTotal),
    };
}

/**
 * 计算随从的持续力量修正总和
 * 
 * 遍历所有注册的修正函数，累加结果。
 * 只有当基地上存在提供修正的随从时，对应修正才生效。
 */
export function getOngoingPowerModifier(
    state: SmashUpCore,
    minion: MinionOnBase,
    baseIndex: number
): number {
    if (modifierRegistry.length === 0) return 0;

    const base = state.bases[baseIndex];
    if (!base) return 0;

    let total = 0;
    for (const entry of modifierRegistry) {
        if (shouldSkipPowerModifierForTarget(entry, minion)) {
            continue;
        }
        if (isCardSuppressed(state, minion.uid)
            && normalizeDefId(minion.defId) === normalizeDefId(entry.sourceDefId)) {
            continue;
        }
        const ctx = getFilteredPowerModifierContext(
            state,
            minion,
            baseIndex,
            entry.sourceDefId,
            entry.podStrategy === 'selfManaged',
        );
        total += entry.modifier(ctx);
    }
    return total;
}



/**
 * 获取随从的有效力量（含持续修正）
 * 
 * = basePower + powerCounters（力量指示物） + powerModifier（永久修正） + tempPowerModifier（临时，回合结束清零） + ongoingModifier（持续能力）
 */
export function getEffectivePower(
    state: SmashUpCore,
    minion: MinionOnBase,
    baseIndex: number
): number {
    // 力量最低为 0（规则：睡眠孢子等负面修正不能使力量低于 0）
    return Math.max(0, minion.basePower + (minion.powerCounters ?? 0) + minion.powerModifier + (minion.tempPowerModifier ?? 0) + getOngoingPowerModifier(state, minion, baseIndex));
}

function isMinionPowerContributionCancelled(state: SmashUpCore, minion: MinionOnBase): boolean {
    return minion.attachedActions.some(action => (
        normalizeDefId(action.defId) === 'luchadors_pin'
        && !isCardSuppressed(state, action.uid)
    ));
}

/**
 * 获取 ongoing 卡上的力量指示物贡献（如 vampire_summon_wolves）
 * 
 * 规则：ongoing 卡的力量指示物无需随从即可生效。
 * 只要玩家有至少 1 点力量（无论来源），就有资格参与计分。
 */
export function getOngoingCardPowerContribution(
    base: BaseInPlay,
    playerId: PlayerId
): number {
    let total = 0;
    for (const oa of base.ongoingActions) {
        const ongoingControllerId = (oa.metadata?.sourceControllerId as PlayerId | undefined) ?? oa.ownerId;
        if (ongoingControllerId !== playerId) continue;
        const counters = (oa.metadata?.powerCounters as number) ?? 0;
        if (counters > 0) total += counters;
    }
    return total;
}

/**
 * 获取玩家在基地上的泰坦力量贡献。
 *
 * 当前基础模型先只纳入泰坦上的力量指示物。
 * 各泰坦自身的持续文字带来的额外力量，后续通过专门修正器接入统一查询。
 */
export function getTitanPowerContribution(
    state: SmashUpCore,
    baseIndex: number,
    playerId: PlayerId,
): number {
    let total = 0;
    const base = state.bases[baseIndex];
    if (!base) return 0;
    for (const titan of state.titans ?? []) {
        if (titan.location.zone !== 'base' || titan.location.baseIndex !== baseIndex) continue;
        if (titan.controllerId !== playerId) continue;
        total += titan.powerCounters;
        total += titanPowerModifiers.get(titan.defId)?.({
            state,
            titan,
            baseIndex,
            base,
            playerId,
        }) ?? 0;
    }
    return total;
}

/**
 * 获取玩家在基地上的总有效力量（含持续修正 + ongoing 卡力量贡献 + 基地级别力量修正）
 */
export function getPlayerEffectivePowerOnBase(
    state: SmashUpCore,
    base: BaseInPlay,
    baseIndex: number,
    playerId: PlayerId
): number {
    const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
    const opposingSirens = base.minions.filter((minion) =>
        minion.controller !== playerId
        && normalizeDefId(minion.defId) === 'mermaids_siren'
        && !isCardSuppressed(state, minion.uid),
    ).length;
    const reefPenaltyPerMinion = (
        base.defId === 'base_mermaid_reef'
        && currentPlayerId
        && playerId !== currentPlayerId
        && !isBaseAbilitySuppressed(state, baseIndex)
    ) ? 1 : 0;
    const desertIslandActive = base.ongoingActions.some(
        action => normalizeDefId(action.defId) === 'mermaids_desert_island'
            && !isCardSuppressed(state, action.uid),
    );
    const personalPenalty = opposingSirens + reefPenaltyPerMinion;
    const wereUpYoureDown = base.metadata?.halfTheBattleWereUpYoureDown as {
        sourcePlayerId?: PlayerId;
        expiresOnTurnNumber?: number;
        expiresOnPlayerId?: PlayerId;
    } | undefined;
    const wereUpYoureDownActive = Boolean(
        wereUpYoureDown?.sourcePlayerId
        && wereUpYoureDown.sourcePlayerId !== playerId
        && (
            typeof wereUpYoureDown.expiresOnTurnNumber !== 'number'
            || state.turnNumber < wereUpYoureDown.expiresOnTurnNumber
            || (
                wereUpYoureDown.expiresOnPlayerId !== undefined
                && currentPlayerId !== wereUpYoureDown.expiresOnPlayerId
            )
        ),
    );
    const minionPower = base.minions
        .filter(m => m.controller === playerId)
        .reduce((sum, m) => {
            const effectivePower = wereUpYoureDownActive ? m.basePower : getEffectivePower(state, m, baseIndex);
            let contribution = isMinionPowerContributionCancelled(state, m) ? 0 : effectivePower;

            const charmedTurn = Number(m.metadata?.mermaidsCharmedSuppressedTurn ?? -1);
            const charmedActive = charmedTurn === state.turnNumber;
            if (charmedActive || desertIslandActive) {
                contribution = 0;
            } else if (!wereUpYoureDownActive && personalPenalty > 0) {
                contribution = Math.max(0, contribution - personalPenalty);
            }

            return sum + contribution;
        }, 0);
    const ongoingCardPower = getOngoingCardPowerContribution(base, playerId);
    const titanPower = getTitanPowerContribution(state, baseIndex, playerId);
    const controlledMonsterPower = getControlledMonsterPowerOnBase(state, baseIndex, playerId);
    const basePowerBonus = getBasePowerModifiers(state, baseIndex, playerId);
    const tempBasePower = getTempBasePowerModifier(state, baseIndex, playerId);
    return minionPower + controlledMonsterPower + ongoingCardPower + titanPower + basePowerBonus + tempBasePower;
}

/**
 * 获取基地上的总有效力量（含持续修正 + ongoing 卡力量贡献 + 基地级别力量修正）
 */
export function getTotalEffectivePowerOnBase(
    state: SmashUpCore,
    base: BaseInPlay,
    baseIndex: number
): number {
    const minionPower = base.minions
        .reduce((sum, m) => (
            isMinionPowerContributionCancelled(state, m)
                ? sum
                : sum + getEffectivePower(state, m, baseIndex)
        ), 0);
    const controlledMonsterPower = (base.monsters ?? []).reduce((sum, monster) => (
        monster.controllerId ? sum + getMunchkinMonsterPrintedPower(monster.defId) : sum
    ), 0);
    // 累加所有玩家的 ongoing 卡力量贡献（不限于有随从的玩家）
    // 修复 Bug：只有 ongoing 卡但没有随从的玩家，其力量贡献也应该计入总力量
    let ongoingBonus = 0;
    let titanBonus = 0;
    let basePowerBonus = 0;
    for (const pid of Object.keys(state.players)) {
        ongoingBonus += getOngoingCardPowerContribution(base, pid);
        titanBonus += getTitanPowerContribution(state, baseIndex, pid);
        basePowerBonus += getBasePowerModifiers(state, baseIndex, pid);
        basePowerBonus += getTempBasePowerModifier(state, baseIndex, pid);
    }
    return minionPower + controlledMonsterPower + ongoingBonus + titanBonus + basePowerBonus;
}

/**
 * 获取基地的有效临界点（含持续修正 + 临时修正）
 * 
 * = baseDef.breakpoint + 持续修正 + 临时修正（回合结束清零）
 */
export function getEffectiveBreakpoint(
    state: SmashUpCore,
    baseIndex: number
): number {
    const base = state.bases[baseIndex];
    if (!base) return Infinity;
    const baseDef = getBaseDef(base.defId);
    if (!baseDef) return Infinity;

    let total = 0;
    if (breakpointModifierRegistry.length > 0) {
        for (const entry of breakpointModifierRegistry) {
            const ctx = getFilteredBreakpointModifierContext(
                state,
                baseIndex,
                entry.sourceDefId,
                baseDef.breakpoint,
            );
            total += entry.modifier(ctx);
        }
    }

    // 加上临时临界点修正（如 dino_rampage）
    const baseInstanceId = state.bases[baseIndex]?.instanceId;
    const tempDelta = (baseInstanceId ? state.tempBreakpointModifiersByBaseId?.[baseInstanceId] : undefined)
        ?? state.tempBreakpointModifiers?.[baseIndex]
        ?? 0;
    return Math.max(0, baseDef.breakpoint + getMonsterPowerOnBase(state, baseIndex) + total + tempDelta);
}

export function getMonsterPowerOnBase(state: SmashUpCore, baseIndex: number): number {
    const base = state.bases[baseIndex];
    if (!base?.monsters?.length) return 0;
    return base.monsters.reduce((sum, monster) => {
        if (monster.controllerId) return sum;
        return sum + getMunchkinMonsterPrintedPower(monster.defId);
    }, 0);
}

export function getControlledMonsterPowerOnBase(
    state: SmashUpCore,
    baseIndex: number,
    playerId: PlayerId,
): number {
    const base = state.bases[baseIndex];
    if (!base?.monsters?.length) return 0;
    return base.monsters.reduce((sum, monster) => (
        monster.controllerId === playerId
            ? sum + getMunchkinMonsterPrintedPower(monster.defId)
            : sum
    ), 0);
}

function getMunchkinMonsterPrintedPower(defId: string): number {
    const descriptor = getMunchkinSpecialCardDescriptor(defId);
    if (descriptor?.kind !== 'monster') return 0;
    return descriptor.power ?? 0;
}

export function getRealtimeScoringEligibleBaseIndices(state: SmashUpCore): number[] {
    const indices: number[] = [];
    for (let i = 0; i < state.bases.length; i++) {
        const base = state.bases[i];
        const baseDef = getBaseDef(base.defId);
        if (!baseDef) continue;
        if (isBaseScoringSuppressed(state, i)) continue;
        const totalPower = getTotalEffectivePowerOnBase(state, base, i);
        if (totalPower >= getEffectiveBreakpoint(state, i)) {
            indices.push(i);
        }
    }
    return normalizeScoringEligibleBaseIndices(indices);
}

/**
 * 获取当前可计分基地索引。
 *
 * `scoringEligibleBaseIndices` 只用于当前已选择基地/旧快照兼容；正常计分链应使用
 * getRealtimeScoringEligibleBaseIndices 重新检查桌面，而不是锁定阶段开始时的全部基地。
 */
export function getScoringEligibleBaseIndices(state: SmashUpCore): number[] {
    if (Array.isArray(state.scoringEligibleBaseIndices)) {
        return normalizeScoringEligibleBaseIndices(state.scoringEligibleBaseIndices);
    }
    return getRealtimeScoringEligibleBaseIndices(state);
}

export function normalizeScoringEligibleBaseIndices(indices: readonly number[]): number[] {
    const seen = new Set<number>();
    const normalized: number[] = [];
    for (const index of indices) {
        if (!Number.isInteger(index) || index < 0) continue;
        if (seen.has(index)) continue;
        seen.add(index);
        normalized.push(index);
    }
    return normalized;
}
