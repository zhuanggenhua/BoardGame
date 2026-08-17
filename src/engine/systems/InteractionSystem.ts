/**
 * 统一交互系统（InteractionSystem）
 *
 * 替代 PromptSystem，提供统一的「阻塞式玩家交互」引擎原语。
 * 内置 kind='simple-choice' 覆盖旧 PromptSystem 全部能力；
 * 其它 kind 由各游戏扩展。
 *
 * 状态：sys.interaction.current / sys.interaction.queue
 * 命令：SYS_INTERACTION_RESPOND / TIMEOUT / STEP / CONFIRM / CANCEL
 * 事件：SYS_INTERACTION_RESOLVED / EXPIRED / STEPPED / CONFIRMED / CANCELLED
 */

import type {
    MatchState,
    PlayerId,
    GameEvent,
} from '../types';
import type { AiHint } from '../ai/types';
import type { AiInteractionSupportDeclaration } from '../ai/decisionSemantics';
import { resolveCommandTimestamp } from '../utils';
import type { EngineSystem, HookResult } from './types';
import { SYSTEM_IDS } from './types';
import { clearActiveResolutionBlock, getActiveResolutionFrame, syncActiveResolutionWithInteraction } from './resolutionStack';

function isSamePlayerId(a: unknown, b: unknown): boolean {
    if (a === undefined || a === null || b === undefined || b === null) return false;
    return String(a) === String(b);
}

function asPlainRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object') return {};
    return value as Record<string, unknown>;
}

function resolveDecisionEpochValue(state: MatchState<unknown>): number {
    return typeof state.sys?.decisionEpoch === 'number' ? state.sys.decisionEpoch : 0;
}

function bumpDecisionEpoch<TCore>(state: MatchState<TCore>): MatchState<TCore> {
    return {
        ...state,
        sys: {
            ...state.sys,
            decisionEpoch: resolveDecisionEpochValue(state as MatchState<unknown>) + 1,
        },
    };
}

function resolveInteractionSourceId(interaction?: InteractionDescriptor): string {
    if (!interaction) return '';
    const directSourceId = (interaction as { sourceId?: unknown }).sourceId;
    if (typeof directSourceId === 'string') return directSourceId;
    const dataSourceId = (interaction.data as { sourceId?: unknown } | undefined)?.sourceId;
    return typeof dataSourceId === 'string' ? dataSourceId : '';
}

function buildInteractionOptionSignature(interaction?: InteractionDescriptor): string {
    const options = (interaction?.data as { options?: Array<{ id?: unknown; disabled?: unknown }> } | undefined)?.options;
    if (!Array.isArray(options)) return '';
    return options
        .map((option) => {
            const optionId = typeof option?.id === 'string' ? option.id : '';
            const disabledFlag = option?.disabled === true ? '1' : '0';
            return `${optionId}:${disabledFlag}`;
        })
        .join(',');
}

function buildInteractionDecisionSignature(interaction?: InteractionDescriptor): string {
    if (!interaction) return '';
    return [
        interaction.id ?? '',
        interaction.kind ?? '',
        interaction.playerId ?? '',
        resolveInteractionSourceId(interaction),
        buildInteractionOptionSignature(interaction),
    ].join('|');
}

export function getCurrentTrackedIdTopSnapshot<TId extends string | number>(
    currentIds: readonly TId[],
    trackedIds: readonly TId[],
): TId[] {
    const trackedSet = new Set(trackedIds);
    const snapshot: TId[] = [];
    for (const id of currentIds) {
        if (!trackedSet.has(id)) break;
        snapshot.push(id);
    }
    return snapshot;
}

export function getCurrentTrackedCardTopSnapshot<TCard extends { uid: string; defId?: string }>(
    currentCards: readonly { uid: string; defId?: string }[],
    trackedCards: readonly TCard[],
): TCard[] {
    const trackedByUid = new Map(trackedCards.map((card) => [card.uid, card] as const));
    const snapshot: TCard[] = [];
    for (const card of currentCards) {
        const tracked = trackedByUid.get(card.uid);
        if (!tracked) break;
        if (tracked.defId !== undefined && card.defId !== tracked.defId) break;
        snapshot.push(tracked);
    }
    return snapshot;
}

function writeInteractionState<TCore>(
    state: MatchState<TCore>,
    interaction: InteractionState,
): MatchState<TCore> {
    const decisionChanged = buildInteractionDecisionSignature(state.sys.interaction?.current)
        !== buildInteractionDecisionSignature(interaction.current);
    const nextState: MatchState<TCore> = {
        ...state,
        sys: {
            ...state.sys,
            interaction,
        },
    };
    return decisionChanged ? bumpDecisionEpoch(nextState) : nextState;
}

function bindInteractionToResolutionFrame<TCore>(
    state: MatchState<TCore>,
    interaction: InteractionDescriptor,
): InteractionDescriptor {
    if (interaction.resolutionFrameId) {
        return interaction;
    }
    const activeFrameId = getActiveResolutionFrame(state)?.id;
    if (!activeFrameId) {
        return interaction;
    }
    return {
        ...interaction,
        resolutionFrameId: activeFrameId,
    };
}

// ============================================================================
// 交互选项类型（原属 types.ts，逻辑上归属交互系统）
// ============================================================================

/**
 * 交互选项（simple-choice 的单个选项）
 */
export interface PromptOption<T = unknown> {
    id: string;
    label: string;
    /**
     * 可选的 i18n key。
     * UI 层若检测到此字段，会优先用 key + params 渲染 label。
     */
    labelKey?: string;
    /**
     * labelKey 对应的插值参数。
     */
    labelParams?: Record<string, string | number>;
    value: T;
    disabled?: boolean;
    /**
     * 可选：禁用原因的原始文案。
     * 仅用于诊断/反馈，不参与规则执行。
     */
    disabledReason?: string;
    /**
     * 可选：禁用原因 i18n key。
     * UI/反馈层可据此还原“为什么不能选”。
     */
    disabledReasonKey?: string;
    /**
     * disabledReasonKey 对应的插值参数。
     */
    disabledReasonParams?: Record<string, string | number>;
    /**
     * UI 渲染模式声明：
     * - 'card': 以卡牌预览图展示（UI 层从 value 中的 defId 查找预览图）
     * - 'button' | undefined: 普通按钮
     */
    displayMode?: 'card' | 'button';
    /**
     * 仅供 AI 使用的语义 hints。
     * 必须与业务 value 隔离，不能被规则处理器当成真实输入消费。
     */
    _ai?: AiHint;
}

type UnsatisfiableSimpleChoiceReason =
    | 'empty-options'
    | 'all-options-disabled'
    | 'min-selection-unreachable';

/**
 * 多选配置
 */
export interface PromptMultiConfig {
    min?: number;
    max?: number;
    /**
     * 是否要求保留选择顺序。
     * - false / undefined: 视为无序多选（组合语义）
     * - true: 视为有序多选（排列语义）
     */
    ordered?: boolean;
}

export type SimpleChoiceAutoRefresh =
    | 'hand'
    | 'discard'
    | 'hand_or_discard'
    | 'deck'
    | 'field'
    | 'base'
    | 'ongoing'
    | 'buried';

export type SimpleChoiceResponseValidationMode = 'snapshot' | 'live';

export type SimpleChoiceTargetType =
    | 'base'
    | 'minion'
    | 'hand'
    | 'ongoing'
    | 'field-source-target'
    | 'field-source-action'
    | 'player'
    | 'button'
    | 'discard'
    | 'discard_minion'
    | 'generic';

// ============================================================================
// 核心类型
// ============================================================================

/**
 * 交互描述符 — 任何需要玩家输入的交互
 * kind 字段区分交互类型，data 包含 kind 特定数据
 */
export interface InteractionDescriptor<TData = unknown> {
    id: string;
    kind: string;
    playerId: PlayerId;
    /** 所属 resolution frame（可选；未提供时由 queueInteraction 绑定当前 active frame） */
    resolutionFrameId?: string;
    /** AI 支持声明：语义描述、游戏适配器或明确不支持。UI 不应依赖此字段渲染。 */
    ai?: AiInteractionSupportDeclaration;
    data: TData;
}

/**
 * simple-choice 专用数据（等价于旧 PromptState['current'] 的业务字段）
 */
export interface SimpleChoiceData<T = unknown> {
    title: string;
    titleKey?: string;
    titleParams?: Record<string, string | number>;
    /** 标题下方的补充说明（可选） */
    subtitle?: string;
    subtitleKey?: string;
    subtitleParams?: Record<string, string | number>;
    options: PromptOption<T>[];
    sourceId?: string;
    timeout?: number;
    multi?: PromptMultiConfig;
    slider?: Record<string, unknown>;
    /**
     * 选择目标类型，用于 UI 层决定渲染方式：
     * - 'base': 高亮棋盘上的候选基地，点击基地完成选择
     * - 'minion': 高亮棋盘上的候选随从，点击随从完成选择
     * - 'hand': 高亮手牌区的候选卡牌，点击卡牌完成选择
     * - 'ongoing': 高亮棋盘上的候选持续行动卡，点击行动卡完成选择
     * - 'field-source-target': 先高亮场上来源对象，点击来源后再高亮目标对象
     * - 'player': 使用通用弹窗中的玩家选项按钮完成选择
     * - 'button': 使用通用弹窗中的纯分支/确认按钮完成选择
     * - 'discard_minion': 使用游戏自定义的“弃牌堆选随从后再点击基地”直点交互
     * - undefined / 'generic': 使用通用弹窗选择
     */
    targetType?: SimpleChoiceTargetType;
    /** 可选：按钮类/目标类交互需要同时展示的一张上下文卡牌 */
    displayCard?: {
        defId: string;
        cardUid?: string;
    };
    /**
     * 单候选时是否自动解决（跳过玩家选择）。
     * - true（默认）：强制效果，只有一个候选时自动执行
     * - false：可选效果或"你可以"类效果，始终让玩家确认
     */
    autoResolveIfSingle?: boolean;
    /**
     * 动态选项生成器（可选）。
     * 当交互从队列弹出时，调用此函数基于当前最新状态生成选项列表。
     * 用于解决"同时触发多个交互时，后续交互看到过期状态"的问题。
     *
     * 使用场景：
     * - 连续弃牌（幽灵 + 鬼屋）：第二次弃牌时应该看到第一次弃牌后的手牌
     * - 连续选择场上单位：第一次选择后单位可能已被消灭/移动
     *
     * 如果提供了 optionsGenerator，则 options 字段会在交互弹出时被覆盖。
     *
     * @param state - 当前最新的游戏状态
     * @param data - 交互数据（包含 continuationContext 等上下文信息）
     */
    optionsGenerator?: <TCore>(state: { core: TCore; sys: any }, data: SimpleChoiceData<T>) => PromptOption<T>[];
    autoRefresh?: SimpleChoiceAutoRefresh;
    /**
     * 响应校验语义：
     * - snapshot: 按交互创建/弹出时的候选快照校验（默认，兼容旧行为）
     * - live: 按玩家响应时的最新状态重算候选并校验
     *
     * 经验规则：
     * - 只有“候选本身是活引用”的交互才应使用 live（如牌库/弃牌堆/场上可变对象）
     * - 已冻结候选池的多步交互通常应保持 snapshot
     */
    responseValidationMode?: SimpleChoiceResponseValidationMode;
    revalidateOnRespond?: boolean;
    /**
     * 在该 simple-choice 挂起期间允许继续执行的命令白名单。
     * 仅对当前交互所属玩家生效。
     */
    allowedCommands?: string[];
    /** AI 支持声明：语义描述、游戏适配器或明确不支持。 */
    ai?: AiInteractionSupportDeclaration;
}

/**
 * slider-choice 专用数据 — 从连续数值范围中选择一个值
 *
 * 适用场景：花费资源（CP/金币/能量）换取等量效果、分配数值等。
 * UI 层渲染为滑动条 + 确认/跳过按钮。
 */
export interface SliderChoiceData {
    /** 弹窗标题（i18n key） */
    title: string;
    /** 最小值（含） */
    min: number;
    /** 最大值（含） */
    max: number;
    /** 步长，默认 1 */
    step?: number;
    /** 默认值（未指定时取 max） */
    defaultValue?: number;
    /** 来源技能/卡牌 ID */
    sourceId?: string;
    /** 是否允许跳过（值为 0 / 不花费），默认 true */
    allowSkip?: boolean;
    /** 滑动条标签格式化 key（i18n），接收 {value} 插值 */
    valueLabelKey?: string;
    /** 确认按钮文案 key（i18n），接收 {value} 插值 */
    confirmLabelKey?: string;
    /** 跳过按钮文案 key（i18n） */
    skipLabelKey?: string;
    /** 附加元数据（透传给事件消费方，如 tokenId / customId） */
    meta?: Record<string, unknown>;
}

export interface CompareRollChoiceParticipant {
    playerId?: PlayerId;
    label: string;
    labelKey?: string;
    labelParams?: Record<string, string | number>;
    roll: number;
    face?: string;
    characterId?: string;
    effectKey?: string;
    effectParams?: Record<string, string | number>;
}

export interface CompareRollChoiceData<T = unknown> {
    title: string;
    sourceId?: string;
    contestants: [CompareRollChoiceParticipant, CompareRollChoiceParticipant];
    resultText?: string;
    resultTextKey?: string;
    resultTextParams?: Record<string, string | number>;
    resultTone?: 'neutral' | 'success' | 'warning' | 'danger';
    options?: PromptOption<T>[];
    /**
     * 无显式按钮时，UI 可在展示完成后发送 SYS_INTERACTION_CONFIRM。
     * 若提供 confirmValue，这次确认会被转换为 RESOLVED 事件，
     * 方便复用既有的 follow-up handler 链路。
     */
    confirmValue?: T;
    autoConfirmDelayMs?: number;
}

/**
 * 交互系统状态
 */
export interface InteractionState {
    current?: InteractionDescriptor;
    queue: InteractionDescriptor[];
    /** 当其他玩家有未完成的交互时为 true，此时当前玩家不应发送任何命令（如结束回合） */
    isBlocked?: boolean;
}

function sanitizeStoredPromptText(text: string | undefined, key: string | undefined): string {
    if (typeof key === 'string' && key.trim()) {
        return key;
    }
    return text ?? '';
}

function sanitizePromptOption<T>(option: PromptOption<T>): PromptOption<T> {
    return {
        ...option,
        label: sanitizeStoredPromptText(option.label, option.labelKey),
        ...(typeof option.disabledReasonKey === 'string' && option.disabledReasonKey.trim()
            ? { disabledReason: option.disabledReasonKey }
            : {}),
    };
}

type ControlChoiceOptionLike = {
    id?: unknown;
    disabled?: unknown;
    value?: unknown;
};

const CONTROL_CHOICE_OPTION_IDS = new Set([
    'skip',
    'pass',
    'done',
    'cancel',
    '__cancel__',
    '__emergency_skip__',
]);

const SKIP_LIKE_CONTROL_CHOICE_OPTION_IDS = new Set([
    'skip',
    'pass',
    '__emergency_skip__',
]);

function asControlChoiceValueRecord(value: unknown): {
    skip?: unknown;
    pass?: unknown;
    done?: unknown;
    cancel?: unknown;
    __cancel__?: unknown;
    __emergency_skip__?: unknown;
    kind?: unknown;
} | null {
    if (!value || typeof value !== 'object') return null;
    return value as {
        skip?: unknown;
        pass?: unknown;
        done?: unknown;
        cancel?: unknown;
        __cancel__?: unknown;
        __emergency_skip__?: unknown;
        kind?: unknown;
    };
}

function isControlChoiceId(id: unknown): boolean {
    return typeof id === 'string' && CONTROL_CHOICE_OPTION_IDS.has(id);
}

function isSkipLikeControlChoiceId(id: unknown): boolean {
    return typeof id === 'string' && SKIP_LIKE_CONTROL_CHOICE_OPTION_IDS.has(id);
}

export function isPassChoiceValue(value: unknown): boolean {
    const candidate = asControlChoiceValueRecord(value);
    return Boolean(candidate && (candidate.pass || candidate.kind === 'pass'));
}

export function isSkipLikeControlChoiceValue(value: unknown): boolean {
    const candidate = asControlChoiceValueRecord(value);
    return Boolean(
        candidate
        && (
            candidate.skip
            || candidate.__emergency_skip__
            || candidate.pass
            || candidate.kind === 'pass'
        ),
    );
}

export function isDoneControlChoiceValue(value: unknown): boolean {
    const candidate = asControlChoiceValueRecord(value);
    return Boolean(candidate?.done);
}

export function isSystemCancelControlChoiceValue(value: unknown): boolean {
    const candidate = asControlChoiceValueRecord(value);
    return Boolean(candidate?.__cancel__);
}

export function isControlChoiceValue(value: unknown): boolean {
    const candidate = asControlChoiceValueRecord(value);
    return Boolean(
        candidate
        && (
            candidate.cancel
            || candidate.__cancel__
            || candidate.done
            || candidate.skip
            || candidate.__emergency_skip__
            || candidate.pass
            || candidate.kind === 'pass'
        ),
    );
}

export function isControlChoiceOption(option: ControlChoiceOptionLike): boolean {
    return isControlChoiceId(option.id) || isControlChoiceValue(option.value);
}

export function isSkipLikeControlChoiceOption(option: ControlChoiceOptionLike): boolean {
    return isSkipLikeControlChoiceId(option.id) || isSkipLikeControlChoiceValue(option.value);
}

export function isDoneControlChoiceOption(option: ControlChoiceOptionLike): boolean {
    return option.id === 'done' || isDoneControlChoiceValue(option.value);
}

export function isSystemCancelControlChoiceOption(option: ControlChoiceOptionLike): boolean {
    return option.id === '__cancel__' || isSystemCancelControlChoiceValue(option.value);
}

export function isEnabledControlChoiceOption<T>(option: PromptOption<T>): boolean {
    return option.disabled !== true && isControlChoiceOption(option);
}

function resolveUnsatisfiableSimpleChoiceReason<T>(
    options: PromptOption<T>[],
    data: Pick<SimpleChoiceData<T>, 'multi'>,
): UnsatisfiableSimpleChoiceReason | null {
    const minSelections = data.multi?.min ?? 1;
    if (minSelections <= 0) {
        return null;
    }
    if (options.length === 0) {
        return 'empty-options';
    }
    const enabledOptions = options.filter((option) => option.disabled !== true);
    if (enabledOptions.length === 0) {
        return 'all-options-disabled';
    }
    if (enabledOptions.length < minSelections) {
        return 'min-selection-unreachable';
    }
    return null;
}

function ensureResolvableSimpleChoiceOptions<T>(
    options: PromptOption<T>[],
    data: Pick<SimpleChoiceData<T>, 'multi'>,
): PromptOption<T>[] {
    const reason = resolveUnsatisfiableSimpleChoiceReason(options, data);
    if (!reason) {
        return options;
    }
    if (options.some((option) => isEnabledControlChoiceOption(option))) {
        return options;
    }
    if (options.some((option) => option.id === '__emergency_skip__' && option.disabled !== true)) {
        return options;
    }
    return [...options, buildEmergencySkipOption<T>(reason)];
}

// ============================================================================
// 序列化安全工具
// ============================================================================

/**
 * 从交互数据中移除不可序列化的字段（如 optionsGenerator 函数），
 * 防止 JSON patch / JSON.stringify 序列化失败。
 * 用于事件 payload 和 playerView 输出。
 */
export function stripNonSerializableFromData(data: unknown): unknown {
    if (typeof data === 'function') return undefined;
    if (!data || typeof data !== 'object') return data;
    if (Array.isArray(data)) {
        return data
            .map((item) => stripNonSerializableFromData(item))
            .filter((item) => item !== undefined);
    }

    const cloned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (key === 'optionsGenerator' || typeof value === 'function') continue;
        const sanitized = stripNonSerializableFromData(value);
        if (sanitized !== undefined) {
            cloned[key] = sanitized;
        }
    }
    return cloned;
}

/**
 * 从 InteractionDescriptor 中移除不可序列化的字段。
 */
export function stripNonSerializable(interaction: InteractionDescriptor | undefined): InteractionDescriptor | undefined {
    if (!interaction) return undefined;
    return { ...interaction, data: stripNonSerializableFromData(interaction.data) };
}

function canPlayerViewCompareRollInteraction(
    interaction: InteractionDescriptor | undefined,
    playerId: PlayerId,
): boolean {
    if (!interaction || interaction.kind !== 'compare-roll-choice') {
        return false;
    }

    if (isSamePlayerId(interaction.playerId, playerId)) {
        return true;
    }

    const contestants = (interaction.data as { contestants?: Array<{ playerId?: PlayerId }> } | undefined)?.contestants;
    if (!Array.isArray(contestants)) {
        return false;
    }

    return contestants.some((contestant) => isSamePlayerId(contestant?.playerId, playerId));
}

// ============================================================================
// 命令 & 事件常量
// ============================================================================

export const INTERACTION_COMMANDS = {
    /** simple-choice 响应（payload: { optionId?, optionIds?, mergedValue? }） */
    RESPOND: 'SYS_INTERACTION_RESPOND',
    /** simple-choice 超时 */
    TIMEOUT: 'SYS_INTERACTION_TIMEOUT',
    /** 多步交互推进（P2+） */
    STEP: 'SYS_INTERACTION_STEP',
    /** 多步交互确认（P2+） */
    CONFIRM: 'SYS_INTERACTION_CONFIRM',
    /** 多步交互取消（P2+） */
    CANCEL: 'SYS_INTERACTION_CANCEL',
    FORCE_UNLOCK: 'SYS_FORCE_UNLOCK',
} as const;

export const INTERACTION_EVENTS = {
    /** 交互已解决（simple-choice 选择完成） */
    RESOLVED: 'SYS_INTERACTION_RESOLVED',
    /** 交互超时 */
    EXPIRED: 'SYS_INTERACTION_EXPIRED',
    /** 多步交互步骤完成（P2+） */
    STEPPED: 'SYS_INTERACTION_STEPPED',
    /** 多步交互确认完成（P2+） */
    CONFIRMED: 'SYS_INTERACTION_CONFIRMED',
    /** 多步交互已取消（P2+） */
    CANCELLED: 'SYS_INTERACTION_CANCELLED',
    FORCE_UNLOCKED: 'SYS_INTERACTION_FORCE_UNLOCKED',
} as const;

// ============================================================================
// 工厂 & 辅助函数
// ============================================================================

/**
 * createSimpleChoice 的配置参数
 */
export interface SimpleChoiceConfig {
    titleKey?: string;
    titleParams?: Record<string, string | number>;
    subtitle?: string;
    subtitleKey?: string;
    subtitleParams?: Record<string, string | number>;
    sourceId?: string;
    timeout?: number;
    multi?: PromptMultiConfig;
    /** 选择目标类型，决定 UI 渲染方式（'base' | 'minion' | 'hand' | 'ongoing' | 'field-source-target' | 'field-source-action' | 'player' | 'button' | 'discard_minion' | 'generic'） */
    targetType?: SimpleChoiceTargetType;
    /** 可选：按钮类/目标类交互需要同时展示的一张上下文卡牌 */
    displayCard?: {
        defId: string;
        cardUid?: string;
    };
    /** 单候选时是否自动解决，默认 true（强制效果自动跳过） */
    autoResolveIfSingle?: boolean;
    /**
     * 是否自动添加取消选项，默认 false
     * - true: 自动在选项列表末尾添加取消选项 { id: '__cancel__', label: '取消', value: { __cancel__: true } }
     * - false: 不添加取消选项
     *
     * 取消选项的 value 会包含 __cancel__: true 标记，handler 可以检查此标记来跳过执行
     */
    autoCancelOption?: boolean;
    /**
     * 自动刷新选项来源（opt-in 模式）
     *
     * 显式声明后，框架层会在状态更新时自动过滤失效的选项：
     * - 'hand': 检查 cardUid 是否仍在手牌中
     * - 'discard': 检查 cardUid 是否仍在弃牌堆中
     * - 'deck': 检查 cardUid 是否仍在牌库中
     * - 'field': 检查 minionUid 是否仍在场上
     * - 'base': 检查 baseIndex 是否仍然有效
     * - 'ongoing': 检查 cardUid 是否仍附着在场上
     * - 'buried': 检查 cardUid 是否仍埋葬在指定基地
     * - undefined: 不自动刷新（默认，向后兼容）
     *
     * 注意：
     * - 如果提供了 optionsGenerator，autoRefresh 会被忽略（optionsGenerator 优先级更高）
     * - 对于复杂场景（如从多个来源选择、基于数量生成选项），应使用 optionsGenerator
     * - autoRefresh 只适用于简单的"引用类型选项"（cardUid/minionUid/baseIndex）
     */
    autoRefresh?: SimpleChoiceAutoRefresh;
    /**
     * 显式声明响应期使用快照还是最新状态。
     * 默认保持 snapshot；只有明确需要防止过期引用时才用 live。
     */
    responseValidationMode?: SimpleChoiceResponseValidationMode;
    revalidateOnRespond?: boolean;
    /**
     * 在该 simple-choice 挂起期间允许继续执行的命令白名单。
     * 仅对当前交互所属玩家生效。
     */
    allowedCommands?: string[];
    /** AI 支持声明：语义描述、游戏适配器或明确不支持。 */
    ai?: AiInteractionSupportDeclaration;
}

/**
 * 创建 simple-choice 交互（替代旧 createPrompt）
 */
export function createSimpleChoice<T>(
    id: string,
    playerId: PlayerId,
    title: string,
    options: PromptOption<T>[],
    sourceIdOrConfig?: string | SimpleChoiceConfig,
    timeout?: number,
    multi?: PromptMultiConfig,
): InteractionDescriptor<SimpleChoiceData<T>> {
    // 兼容旧签名：第5个参数可以是 string（sourceId）或 config 对象
    const config: SimpleChoiceConfig = typeof sourceIdOrConfig === 'string'
        ? { sourceId: sourceIdOrConfig, timeout, multi }
        : { ...sourceIdOrConfig, timeout: sourceIdOrConfig?.timeout ?? timeout, multi: sourceIdOrConfig?.multi ?? multi };

    // 自动添加取消选项
    let finalOptions = options;
    if (config.autoCancelOption) {
        const cancelOption: PromptOption<T> = {
            id: '__cancel__',
            label: 'common:button.cancel',
            labelKey: 'common:button.cancel',
            value: { __cancel__: true } as T,
        };
        finalOptions = [...options, cancelOption];
    }

    // 运行时检查：防止创建空选项交互（会导致玩家卡死）
    if (finalOptions.length === 0) {
        console.error(`[InteractionSystem] 创建了空选项交互！id=${id}, sourceId=${config.sourceId}, title=${title}`);
        console.error('[InteractionSystem] 这会导致玩家无法选择任何选项而卡死。请在调用 createSimpleChoice 前检查选项列表不为空。');
        console.trace(); // 打印调用栈
    }
    finalOptions = ensureResolvableSimpleChoiceOptions(finalOptions, { multi: config.multi });
    finalOptions = finalOptions.map((option) => sanitizePromptOption(option));

    return {
        id,
        kind: 'simple-choice',
        playerId,
        ...(config.ai ? { ai: config.ai } : {}),
        data: {
            title: sanitizeStoredPromptText(title, config.titleKey),
            titleKey: config.titleKey,
            titleParams: config.titleParams,
            subtitle: sanitizeStoredPromptText(config.subtitle, config.subtitleKey),
            subtitleKey: config.subtitleKey,
            subtitleParams: config.subtitleParams,
            options: finalOptions,
            sourceId: config.sourceId,
            timeout: config.timeout,
            multi: config.multi,
            targetType: config.targetType,
            displayCard: config.displayCard,
            autoResolveIfSingle: config.autoResolveIfSingle,
            // 将 autoRefresh 传递到 data 中（作为私有字段）
            autoRefresh: config.autoRefresh,
            responseValidationMode: config.responseValidationMode ?? (config.revalidateOnRespond ? 'live' : undefined),
            revalidateOnRespond: config.revalidateOnRespond,
            allowedCommands: config.allowedCommands,
            ai: config.ai,
        } as any,
    };
}

/**
 * 创建 slider-choice 交互 — 从连续数值范围中选择
 */
export function createSliderChoice(
    id: string,
    playerId: PlayerId,
    data: SliderChoiceData,
): InteractionDescriptor<SliderChoiceData> {
    return {
        id,
        kind: 'slider-choice',
        playerId,
        data,
    };
}

export function createCompareRollChoice<T>(
    id: string,
    playerId: PlayerId,
    data: CompareRollChoiceData<T>,
): InteractionDescriptor<CompareRollChoiceData<T>> {
    return {
        id,
        kind: 'compare-roll-choice',
        playerId,
        data,
    };
}

/**
 * multistep-choice 专用数据 — 多步调整 → 预览 → 确认
 *
 * 中间步骤纯本地执行（localReducer），不经过 pipeline，不发网络请求。
 * 确认时 toCommands() 生成命令列表，依次 dispatch 到引擎。
 *
 * 适用场景：骰子修改（多次 +/- 后确认）、资源分配、多目标选择等。
 */
export interface MultistepChoiceData<TStep = unknown, TResult = unknown> {
    /** 弹窗标题（i18n key） */
    title: string;
    /** 来源技能/卡牌 ID */
    sourceId?: string;
    /** 最大步骤数（达到后自动确认，可选） */
    maxSteps?: number;
    /** 最小步骤数（未达到时禁止确认，默认 0） */
    minSteps?: number;
    /**
     * 本地 reducer：处理中间步骤
     * 纯客户端执行，不经过 pipeline，不发网络请求。
     * 返回更新后的累积结果。
     */
    localReducer: (current: TResult, step: TStep) => TResult;
    /**
     * 结果转命令：确认时将累积结果转换为引擎命令列表
     * 返回的命令会被依次 dispatch 到引擎。
     */
    toCommands: (result: TResult) => Array<{ type: string; payload: unknown }>;
    /** 初始累积结果 */
    initialResult: TResult;
    /** 验证函数：判断当前步骤是否合法（可选） */
    validateStep?: (current: TResult, step: TStep) => boolean;
    /**
     * 从累积结果中提取"已完成步骤数"（可选）。
     * 用于 auto-confirm 判定：当返回值 >= maxSteps 时自动确认。
     * 未提供时退化为按 step() 调用次数计数。
     * 典型场景：骰子 any 模式下，每次 +/- 都是一次 step()，
     * 但只有修改了不同骰子才算"完成一步"。
     */
    getCompletedSteps?: (result: TResult) => number;
    /** 附加元数据（透传给 UI 层，如骰子模式配置） */
    meta?: Record<string, unknown>;
}

export function createMultistepChoice<TStep, TResult>(
    id: string,
    playerId: PlayerId,
    data: MultistepChoiceData<TStep, TResult>,
): InteractionDescriptor<MultistepChoiceData<TStep, TResult>> {
    return {
        id,
        kind: 'multistep-choice',
        playerId,
        data,
    };
}

/**
 * 将交互加入队列（替代旧 queuePrompt）
 *
 * 如果交互有 optionsGenerator：
 * - 成为 current 时：立即基于当前状态生成选项
 * - 加入 queue 时：保留生成器，延迟到 resolveInteraction 时生成
 *
 * 自动 optionsGenerator 注入（面向100个游戏）：
 * - 如果交互选项包含 cardUid 字段，自动生成 optionsGenerator
 * - 确保后续交互看到最新的手牌/场上单位状态
 */
/**
 * 将交互加入队列
 *
 * 如果当前没有交互，新交互立即成为 current。
 * 否则加入队列末尾（或头部，如果标记为 urgent）。
 *
 * urgent 用于链式交互的后续步骤，确保不被其他交互插队。
 *
 * 注意：
 * - 如果交互有 optionsGenerator，会在成为 current 时立即生成选项
 * - 确保后续交互看到最新的手牌/场上单位状态
 */
export function queueInteraction<TCore>(
    state: MatchState<TCore>,
    interaction: InteractionDescriptor,
    options?: { urgent?: boolean }, // 新增：urgent 标志
): MatchState<TCore> {
    if (!interaction) return state;
    interaction = bindInteractionToResolutionFrame(state, interaction);

    const { current, queue } = state.sys.interaction;

    if (!current) {
        // 如果当前没有交互，新交互立即成为 current
        // 如果有选项生成器，立即基于当前状态生成选项
        if (interaction.kind === 'simple-choice') {
            const data = interaction.data as SimpleChoiceData;
            if (data.optionsGenerator) {
                // 传递 state 和 data（包含 continuationContext）给 optionsGenerator
                const generatedOptions = data.optionsGenerator(state, data);
                const freshOptions = normalizeFreshSimpleChoiceOptions(generatedOptions, data);

                // 更新交互选项
                const updatedInteraction = {
                    ...interaction,
                    data: { ...data, options: freshOptions },
                };

                interaction = updatedInteraction;
            }
        }

        return syncActiveResolutionWithInteraction(writeInteractionState(state, {
            ...state.sys.interaction,
            current: interaction,
        }));
    }

    // 否则加入队列（选项生成延迟到 resolveInteraction 时）
    // urgent 交互插入队列头部，确保链式交互不被打断
    const newQueue = options?.urgent ? [interaction, ...queue] : [...queue, interaction];

    return syncActiveResolutionWithInteraction(writeInteractionState(state, {
        ...state.sys.interaction,
        queue: newQueue,
    }));
}

/**
 * 解决当前交互并弹出下一个
 *
 * 如果下一个交互有 optionsGenerator，则基于当前最新状态生成选项。
 * 否则检查是否显式声明了 autoRefresh，如果有则使用通用刷新逻辑。
 * 如果都没有，保持原始选项不变（向后兼容）。
 * 这确保了串行交互（如连续弃牌）中，后续交互看到的是最新状态。
 */
export function resolveInteraction<TCore>(
    state: MatchState<TCore>,
): MatchState<TCore> {
    const { queue } = state.sys.interaction;
    let next = queue[0];
    const newQueue = queue.slice(1);

    // 如果下一个交互是 simple-choice，刷新选项
    if (next && next.kind === 'simple-choice') {
        const data = next.data as SimpleChoiceData;

        // 优先使用手动提供的 optionsGenerator
        let freshOptions: PromptOption[];
        if (data.optionsGenerator) {
            freshOptions = data.optionsGenerator(state, data);
        } else {
            // 使用通用刷新逻辑（opt-in：只有显式声明了 autoRefresh 才刷新）
            const autoRefresh = (data as any).autoRefresh as 'hand' | 'discard' | 'hand_or_discard' | 'deck' | 'field' | 'base' | 'ongoing' | 'buried' | undefined;
            freshOptions = refreshOptionsGeneric(state, next, data.options, autoRefresh);
        }

        freshOptions = normalizeFreshSimpleChoiceOptions(freshOptions, data);

        // 智能处理 multi.min 限制
        const hasEmergencySkip = freshOptions.some(
            (option) => option.id === '__emergency_skip__' && option.disabled !== true,
        );
        if (!(data.multi?.min && freshOptions.length > 0 && freshOptions.length < data.multi.min && !hasEmergencySkip)) {
            next = {
                ...next,
                data: { ...data, options: freshOptions },
            };
        } else {
            console.warn('[InteractionSystem] Fresh options do not meet multi.min requirement, keeping original options');
        }
    }

    return syncActiveResolutionWithInteraction(writeInteractionState(state, {
        current: next,
        queue: newQueue,
    }));
}

/**
 * UI 辅助：从 InteractionDescriptor 提取 simple-choice 扁平数据
 * 返回与旧 PromptState['current'] 兼容的形状，方便 UI 层迁移
 */
export function asSimpleChoice(
    interaction?: InteractionDescriptor,
): (SimpleChoiceData & { id: string; playerId: PlayerId }) | undefined {
    if (!interaction || interaction.kind !== 'simple-choice') return undefined;
    const data = interaction.data as SimpleChoiceData;
    return { ...data, id: interaction.id, playerId: interaction.playerId };
}

/**
 * UI 辅助：从 InteractionDescriptor 提取 slider-choice 扁平数据
 */
export function asSliderChoice(
    interaction?: InteractionDescriptor,
): (SliderChoiceData & { id: string; playerId: PlayerId }) | undefined {
    if (!interaction || interaction.kind !== 'slider-choice') return undefined;
    const data = interaction.data as SliderChoiceData;
    return { ...data, id: interaction.id, playerId: interaction.playerId };
}

/**
 * UI 辅助：从 InteractionDescriptor 提取 multistep-choice 扁平数据
 */
export function asMultistepChoice<TStep = unknown, TResult = unknown>(
    interaction?: InteractionDescriptor,
): (MultistepChoiceData<TStep, TResult> & { id: string; playerId: PlayerId }) | undefined {
    if (!interaction || interaction.kind !== 'multistep-choice') return undefined;
    const data = interaction.data as MultistepChoiceData<TStep, TResult>;
    return { ...data, id: interaction.id, playerId: interaction.playerId };
}

export function asCompareRollChoice<T = unknown>(
    interaction?: InteractionDescriptor,
): (CompareRollChoiceData<T> & { id: string; playerId: PlayerId }) | undefined {
    if (!interaction || interaction.kind !== 'compare-roll-choice') return undefined;
    const data = interaction.data as CompareRollChoiceData<T>;
    return { ...data, id: interaction.id, playerId: interaction.playerId };
}

/**
 * 通用选项刷新逻辑（框架层）— opt-in 模式
 *
 * 只有显式声明了 autoRefresh 的交互才会自动刷新选项。
 * 未声明时保持原始选项不变（向后兼容）。
 *
 * 支持的 autoRefresh 值：
 * - 'hand': 检查 cardUid 是否仍在手牌中
 * - 'discard': 检查 cardUid 是否仍在弃牌堆中
 * - 'deck': 检查 cardUid 是否仍在牌库中
 * - 'field': 检查 minionUid 是否仍在场上
 * - 'base': 检查 baseIndex 是否仍然有效
 * - 'ongoing': 检查 cardUid 是否仍附着在场上
 * - undefined: 不刷新（默认）
 *
 * @param state - 最新的游戏状态
 * @param interaction - 当前交互描述符
 * @param originalOptions - 原始选项列表
 * @param autoRefresh - 显式声明的刷新来源（opt-in）
 * @returns 过滤后的选项列表（如果 autoRefresh 未声明，返回原始选项）
 */
function refreshOptionsGeneric<T>(
    state: any,
    interaction: InteractionDescriptor,
    originalOptions: PromptOption<T>[],
    autoRefresh?: SimpleChoiceAutoRefresh,
): PromptOption<T>[] {
    // opt-in：未声明 autoRefresh 时不刷新
    if (!autoRefresh) {
        return originalOptions;
    }

    return originalOptions.filter((opt) => {
        const val = opt.value as any;

        // 跳过/完成/取消等操作选项：一律保留
        if (!val || typeof val !== 'object') return true;
        if (isControlChoiceValue(val)) return true;

        switch (autoRefresh) {
            case 'hand': {
                if (!val.cardUid) return true; // 非卡牌选项，保留
                const player = state.core?.players?.[interaction.playerId];
                return player?.hand?.some((c: any) => c.uid === val.cardUid) ?? false;
            }
            case 'discard': {
                const player = state.core?.players?.[interaction.playerId];
                if (val.cardUid) {
                    return player?.discard?.some((c: any) => c.uid === val.cardUid) ?? false;
                }
                if (val.defId) {
                    return player?.discard?.some((c: any) => c.defId === val.defId) ?? false;
                }
                return true;
            }
            case 'hand_or_discard': {
                if (!val.cardUid) return true;
                const player = state.core?.players?.[interaction.playerId];
                const zoneHint = val.zone ?? val.from ?? val.sourceZone;
                if (zoneHint === 'hand') {
                    return player?.hand?.some((c: any) => c.uid === val.cardUid) ?? false;
                }
                if (zoneHint === 'discard') {
                    return player?.discard?.some((c: any) => c.uid === val.cardUid) ?? false;
                }
                return (player?.hand?.some((c: any) => c.uid === val.cardUid) ?? false)
                    || (player?.discard?.some((c: any) => c.uid === val.cardUid) ?? false);
            }
            case 'deck': {
                if (!val.cardUid) return true;
                const player = state.core?.players?.[interaction.playerId];
                return player?.deck?.some((c: any) => c.uid === val.cardUid) ?? false;
            }
            case 'field': {
                if (!val.minionUid) return true; // 非随从选项，保留
                for (const base of state.core?.bases || []) {
                    if (base.minions?.some((m: any) => m.uid === val.minionUid)) return true;
                }
                return false;
            }
            case 'base': {
                if (typeof val.baseIndex !== 'number') return true; // 非基地选项，保留
                return val.baseIndex >= 0 && val.baseIndex < (state.core?.bases?.length || 0);
            }
            case 'ongoing': {
                if (!val.cardUid) return true;
                for (const base of state.core?.bases || []) {
                    if (base.ongoingActions?.some((o: any) => o.uid === val.cardUid)) return true;
                    for (const m of base.minions || []) {
                        if (m.attachedActions?.some((o: any) => o.uid === val.cardUid)) return true;
                    }
                }
                return false;
            }
            case 'buried': {
                if (!val.cardUid) return true;
                if (typeof val.baseIndex !== 'number') return false;
                const base = state.core?.bases?.[val.baseIndex];
                return base?.buriedCards?.some((card: any) => card.uid === val.cardUid) ?? false;
            }
            default:
                return true;
        }
    });
}

function buildEmergencySkipOption<T>(reason: UnsatisfiableSimpleChoiceReason): PromptOption<T> {
    return {
        id: '__emergency_skip__',
        label: 'common:interaction.emergencySkip',
        labelKey: 'common:interaction.emergencySkip',
        value: {
            __emergency_skip__: true,
            __emergency_skip_reason__: reason,
        } as T,
        displayMode: 'button' as const,
    };
}

function mergeRenderableOptionMetadata<T>(
    freshOptions: PromptOption<T>[],
    previousOptions: PromptOption<T>[] | undefined,
): PromptOption<T>[] {
    if (freshOptions.length === 0 || !previousOptions || previousOptions.length === 0) {
        return freshOptions;
    }

    const previousById = new Map(previousOptions.map((option) => [option.id, option] as const));

    return freshOptions.map((option) => {
        const previous = previousById.get(option.id);
        if (!previous) return option;

        let nextOption = option;
        let optionChanged = false;

        if (!nextOption.displayMode && previous.displayMode) {
            nextOption = { ...nextOption, displayMode: previous.displayMode };
            optionChanged = true;
        }

        const previousSource = (previous as { _source?: unknown })._source;
        if ((nextOption as { _source?: unknown })._source === undefined && previousSource !== undefined) {
            nextOption = { ...asPlainRecord(nextOption), _source: previousSource } as unknown as PromptOption<T>;
            optionChanged = true;
        }

        const previousAiHints = previous._ai;
        if (nextOption._ai === undefined && previousAiHints !== undefined) {
            nextOption = { ...nextOption, _ai: previousAiHints };
            optionChanged = true;
        }

        const currentValue = nextOption.value;
        const previousValue = previous.value;
        if (
            currentValue
            && typeof currentValue === 'object'
            && previousValue
            && typeof previousValue === 'object'
        ) {
            const mergedValue = { ...(currentValue as Record<string, unknown>) };
            let valueChanged = false;

            for (const key of ['defId', 'minionDefId', 'baseDefId'] as const) {
                if (typeof mergedValue[key] !== 'string' && typeof (previousValue as Record<string, unknown>)[key] === 'string') {
                    mergedValue[key] = (previousValue as Record<string, unknown>)[key];
                    valueChanged = true;
                }
            }

            if (valueChanged) {
                nextOption = { ...nextOption, value: mergedValue as T };
                optionChanged = true;
            }
        }

        return optionChanged ? nextOption : option;
    });
}

function normalizeFreshSimpleChoiceOptions<T>(
    freshOptions: PromptOption<T>[],
    data: SimpleChoiceData<T>,
): PromptOption<T>[] {
    const optionsToNormalize = freshOptions.length === 0
        ? data.options.filter((option) => isEnabledControlChoiceOption(option))
        : freshOptions;
    const hydratedOptions = mergeRenderableOptionMetadata(optionsToNormalize, data.options);
    return ensureResolvableSimpleChoiceOptions(hydratedOptions, data);
}

export function getFreshSimpleChoiceOptions<TCore, T = unknown>(
    state: MatchState<TCore>,
    interaction: InteractionDescriptor<SimpleChoiceData<T>>,
): PromptOption<T>[] {
    const data = interaction.data;
    const freshOptions = data.optionsGenerator
        ? data.optionsGenerator(state, data)
        : refreshOptionsGeneric(state, interaction, data.options, data.autoRefresh);
    return normalizeFreshSimpleChoiceOptions(freshOptions, data);
}

export function getSimpleChoiceResponseValidationMode(
    data: Pick<SimpleChoiceData, 'responseValidationMode' | 'revalidateOnRespond'>,
): SimpleChoiceResponseValidationMode {
    if (data.responseValidationMode) return data.responseValidationMode;
    return data.revalidateOnRespond ? 'live' : 'snapshot';
}

/**
 * 刷新当前交互的选项
 *
 * 在状态更新时调用，确保交互选项反映最新状态。
 *
 * 刷新策略（opt-in 模式）：
 * 1. 如果手动提供了 optionsGenerator，优先使用
 * 2. 否则检查是否显式声明了 autoRefresh，如果有则使用通用刷新逻辑
 * 3. 如果都没有，保持原始选项不变（向后兼容）
 * 4. 如果过滤后无法满足 multi.min 限制，保持原始选项（安全降级）
 */
export function refreshInteractionOptions<TCore>(
    state: MatchState<TCore>,
): MatchState<TCore> {
    const currentInteraction = state.sys.interaction?.current;

    // 没有当前交互，直接返回
    if (!currentInteraction) return state;

    // 只处理 simple-choice 类型
    if (currentInteraction.kind !== 'simple-choice') return state;

    const data = currentInteraction.data as SimpleChoiceData;

    // 优先使用手动提供的 optionsGenerator
    let freshOptions: PromptOption[];
    if (data.optionsGenerator) {
        freshOptions = data.optionsGenerator(state, data);
    } else {
        // 使用通用刷新逻辑（opt-in：只有显式声明了 autoRefresh 才刷新）
        const autoRefresh = (data as any).autoRefresh as 'hand' | 'discard' | 'hand_or_discard' | 'deck' | 'field' | 'base' | 'ongoing' | 'buried' | undefined;
        freshOptions = refreshOptionsGeneric(state, currentInteraction, data.options, autoRefresh);
    }

    freshOptions = normalizeFreshSimpleChoiceOptions(freshOptions, data);

    // 智能处理 multi.min 限制
    // 如果过滤后无法满足最小选择数，且又不是“已经明确没有任何可选项”的场景，则保持原始选项（安全降级）
    const hasEmergencySkip = freshOptions.some(
        (option) => option.id === '__emergency_skip__' && option.disabled !== true,
    );
    if (data.multi?.min && freshOptions.length > 0 && freshOptions.length < data.multi.min && !hasEmergencySkip) {
        return state;
    }

    // 更新交互选项
    return writeInteractionState(state, {
        ...state.sys.interaction,
        current: {
            ...currentInteraction,
            data: { ...data, options: freshOptions },
        },
    });
}

// ============================================================================
// 系统配置
// ============================================================================

export interface InteractionSystemConfig {
    /** 默认超时时间（毫秒） */
    defaultTimeout?: number;
}

// ============================================================================
// 创建交互系统
// ============================================================================

export function createInteractionSystem<TCore>(
    config: InteractionSystemConfig = {},
): EngineSystem<TCore> {
    void config;
    return {
        id: SYSTEM_IDS.INTERACTION,
        name: '交互系统',
        priority: 20,

        setup: (): Partial<{ interaction: InteractionState }> => ({
            interaction: { queue: [] },
        }),

        beforeCommand: ({ state, command }): HookResult<TCore> | void => {
            if (command.type === INTERACTION_COMMANDS.FORCE_UNLOCK) {
                const ts = resolveCommandTimestamp(command);
                const current = state.sys.interaction.current;
                const queue = state.sys.interaction.queue ?? [];
                const nextState = clearActiveResolutionBlock(
                    syncActiveResolutionWithInteraction(writeInteractionState(state, { queue: [] })),
                );
                const event: GameEvent = {
                    type: INTERACTION_EVENTS.FORCE_UNLOCKED,
                    payload: {
                        playerId: command.playerId,
                        interactionId: current?.id ?? null,
                        queueLength: queue.length,
                    },
                    timestamp: ts,
                };
                return { halt: true, state: nextState, events: [event] };
            }

            // ---- 交互取消（通用，所有 kind 都能用） ----
            if (command.type === INTERACTION_COMMANDS.CANCEL) {
                const ts = resolveCommandTimestamp(command);
                const { reason, interactionId } = (() => {
                    const payload = command.payload as { reason?: unknown; interactionId?: unknown } | undefined;
                    return {
                        reason: typeof payload?.reason === 'string' ? payload.reason : undefined,
                        interactionId: typeof payload?.interactionId === 'string' ? payload.interactionId : undefined,
                    };
                })();
                return handleInteractionCancel(state, command.playerId, ts, reason, interactionId);
            }

            // ---- 通用阻塞：有交互时阻塞 ADVANCE_PHASE ----
            const current = state.sys.interaction.current;
            if (current && command.type === 'ADVANCE_PHASE') {
                return { halt: true, error: '请先完成当前交互' };
            }
        },

        playerView: (state, playerId): Partial<{ interaction: InteractionState }> => {
            const { current, queue } = state.sys.interaction;

            // 如果交互有 optionsGenerator，先调用它生成选项，再序列化
            let processedCurrent = current;
            if (current && isSamePlayerId(current.playerId, playerId) && current.kind === 'simple-choice') {
                const data = current.data as SimpleChoiceData;
                if (data.optionsGenerator) {
                    const freshOptions = normalizeFreshSimpleChoiceOptions(data.optionsGenerator(state, data), data);
                    processedCurrent = {
                        ...current,
                        data: { ...data, options: freshOptions },
                    };
                }
            }

            const canViewCurrent = isSamePlayerId(processedCurrent?.playerId, playerId)
                || canPlayerViewCompareRollInteraction(processedCurrent, playerId);
            const filteredCurrent = canViewCurrent ? stripNonSerializable(processedCurrent) : undefined;

            // 同样处理 queue 中的交互
            const processedQueue = queue
                .filter((i) => isSamePlayerId(i?.playerId, playerId))
                .map((i) => {
                    if (i.kind === 'simple-choice') {
                        const data = i.data as SimpleChoiceData;
                        if (data.optionsGenerator) {
                            const freshOptions = normalizeFreshSimpleChoiceOptions(data.optionsGenerator(state, data), data);
                            return {
                                ...i,
                                data: { ...data, options: freshOptions },
                            };
                        }
                    }
                    return i;
                });
            const filteredQueue = processedQueue.map(i => stripNonSerializable(i)!);
            // 当其他玩家有未完成交互时，通知当前玩家被阻塞（不暴露交互详情）
            const isBlocked = !!current && !isSamePlayerId(current.playerId, playerId);

            return {
                interaction: { current: filteredCurrent, queue: filteredQueue, isBlocked },
            };
        },
    };
}




function handleInteractionCancel<TCore>(
    state: MatchState<TCore>,
    playerId: PlayerId,
    timestamp: number,
    reason?: string,
    interactionId?: string,
): HookResult<TCore> {
    const current = state.sys.interaction.current;

    if (!current) {
        return { halt: true, error: '没有待处理的交互' };
    }
    if (!isSamePlayerId(current.playerId, playerId)) {
        return { halt: true, error: '不是你的交互' };
    }
    if (typeof interactionId === 'string' && interactionId !== current.id) {
        return { halt: true, error: '交互已过期' };
    }

    const sourceId = (() => {
        if (!current.data || typeof current.data !== 'object') return undefined;
        const maybeSource = (current.data as { sourceId?: unknown }).sourceId;
        return typeof maybeSource === 'string' ? maybeSource : undefined;
    })();

    const newState = resolveInteraction(state);
    const event: GameEvent = {
        type: INTERACTION_EVENTS.CANCELLED,
        payload: {
            interactionId: current.id,
            playerId,
            sourceId,
            interactionData: stripNonSerializableFromData(current.data),
            ...(reason ? { reason } : {}),
        },
        timestamp,
    };

    return { halt: false, state: newState, events: [event] };
}
