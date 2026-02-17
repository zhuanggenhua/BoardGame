/**
 * 统一交互系统（InteractionSystem）
 *
 * 替代 PromptSystem，提供统一的「阻塞式玩家交互」引擎原语。
 * 内置 kind='simple-choice' 覆盖旧 PromptSystem 全部能力；
 * 未来 kind='dt:card-interaction' / 'sw:soul-transfer' 等由各游戏扩展。
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
import { resolveCommandTimestamp } from '../utils';
import type { EngineSystem, HookResult } from './types';
import { SYSTEM_IDS } from './types';

// ============================================================================
// 交互选项类型（原属 types.ts，逻辑上归属交互系统）
// ============================================================================

/**
 * 交互选项（simple-choice 的单个选项）
 */
export interface PromptOption<T = unknown> {
    id: string;
    label: string;
    value: T;
    disabled?: boolean;
    /**
     * UI 渲染模式声明：
     * - 'card': 以卡牌预览图展示（UI 层从 value 中的 defId 查找预览图）
     * - 'button' | undefined: 普通按钮
     */
    displayMode?: 'card' | 'button';
}

/**
 * 多选配置
 */
export interface PromptMultiConfig {
    min?: number;
    max?: number;
}

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
    data: TData;
}

/**
 * simple-choice 专用数据（等价于旧 PromptState['current'] 的业务字段）
 */
export interface SimpleChoiceData<T = unknown> {
    title: string;
    options: PromptOption<T>[];
    sourceId?: string;
    timeout?: number;
    multi?: PromptMultiConfig;
    /**
     * 选择目标类型，用于 UI 层决定渲染方式：
     * - 'base': 高亮棋盘上的候选基地，点击基地完成选择
     * - 'minion': 高亮棋盘上的候选随从，点击随从完成选择
     * - undefined / 'generic': 使用通用弹窗选择
     */
    targetType?: 'base' | 'minion' | 'generic';
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
     */
    optionsGenerator?: <TCore>(state: { core: TCore; sys: any }) => PromptOption<T>[];
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

/**
 * 交互系统状态
 */
export interface InteractionState {
    current?: InteractionDescriptor;
    queue: InteractionDescriptor[];
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
} as const;

// ============================================================================
// 工厂 & 辅助函数
// ============================================================================

/**
 * createSimpleChoice 的配置参数
 */
export interface SimpleChoiceConfig {
    sourceId?: string;
    timeout?: number;
    multi?: PromptMultiConfig;
    /** 选择目标类型，决定 UI 渲染方式（'base' | 'minion' | 'generic'） */
    targetType?: 'base' | 'minion' | 'generic';
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
            label: '取消',
            value: { __cancel__: true } as T,
        };
        finalOptions = [...options, cancelOption];
    }
    
    return {
        id,
        kind: 'simple-choice',
        playerId,
        data: {
            title,
            options: finalOptions,
            sourceId: config.sourceId,
            timeout: config.timeout,
            multi: config.multi,
            targetType: config.targetType,
            autoResolveIfSingle: config.autoResolveIfSingle,
        },
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

/**
 * 将交互加入队列（替代旧 queuePrompt）
 * 
 * 如果交互有 optionsGenerator：
 * - 成为 current 时：立即基于当前状态生成选项
 * - 加入 queue 时：保留生成器，延迟到 resolveInteraction 时生成
 */
export function queueInteraction<TCore>(
    state: MatchState<TCore>,
    interaction: InteractionDescriptor,
): MatchState<TCore> {
    if (!interaction) return state;

    const { current, queue } = state.sys.interaction;

    if (!current) {
        // 如果当前没有交互，新交互立即成为 current
        // 如果有选项生成器，立即基于当前状态生成选项
        if (interaction.kind === 'simple-choice') {
            const data = interaction.data as SimpleChoiceData;
            if (data.optionsGenerator) {
                const freshOptions = data.optionsGenerator(state);
                interaction = {
                    ...interaction,
                    data: { ...data, options: freshOptions },
                };
            }
        }

        return {
            ...state,
            sys: {
                ...state.sys,
                interaction: { ...state.sys.interaction, current: interaction },
            },
        };
    }

    // 否则加入队列（选项生成延迟到 resolveInteraction 时）
    return {
        ...state,
        sys: {
            ...state.sys,
            interaction: {
                ...state.sys.interaction,
                queue: [...queue, interaction],
            },
        },
    };
}

/**
 * 解决当前交互并弹出下一个
 * 
 * 如果下一个交互有 optionsGenerator，则基于当前最新状态生成选项。
 * 这确保了串行交互（如连续弃牌）中，后续交互看到的是最新状态。
 */
export function resolveInteraction<TCore>(
    state: MatchState<TCore>,
): MatchState<TCore> {
    const { queue } = state.sys.interaction;
    let next = queue[0];
    const newQueue = queue.slice(1);

    // 如果下一个交互有选项生成器，基于当前状态生成选项
    if (next && next.kind === 'simple-choice') {
        const data = next.data as SimpleChoiceData;
        if (data.optionsGenerator) {
            const freshOptions = data.optionsGenerator(state);
            next = {
                ...next,
                data: { ...data, options: freshOptions },
            };
        }
    }

    return {
        ...state,
        sys: {
            ...state.sys,
            interaction: { current: next, queue: newQueue },
        },
    };
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
            // ---- simple-choice 响应 ----
            if (command.type === INTERACTION_COMMANDS.RESPOND) {
                const ts = resolveCommandTimestamp(command);
                return handleSimpleChoiceRespond(
                    state,
                    command.playerId,
                    command.payload as { optionId?: string; optionIds?: string[] },
                    ts,
                );
            }

            // ---- simple-choice 超时 ----
            if (command.type === INTERACTION_COMMANDS.TIMEOUT) {
                const ts = resolveCommandTimestamp(command);
                return handleSimpleChoiceTimeout(state, ts);
            }

            // ---- 交互取消（离线裁决 / 系统兜底） ----
            if (command.type === INTERACTION_COMMANDS.CANCEL) {
                const ts = resolveCommandTimestamp(command);
                return handleInteractionCancel(state, command.playerId, ts);
            }

            // ---- 阻塞逻辑 ----
            const current = state.sys.interaction.current;
            if (current) {
                if (current.kind === 'simple-choice') {
                    // simple-choice: 阻塞该玩家的所有非系统命令
                    if (current.playerId === command.playerId && !command.type.startsWith('SYS_')) {
                        return { halt: true, error: '请先完成当前选择' };
                    }
                } else {
                    // 其他 kind（dt:card-interaction 等）: 只阻塞 ADVANCE_PHASE（任何玩家）
                    if (command.type === 'ADVANCE_PHASE') {
                        return { halt: true, error: '请先完成当前交互' };
                    }
                }
            }
        },

        playerView: (state, playerId): Partial<{ interaction: InteractionState }> => {
            const { current, queue } = state.sys.interaction;

            const filteredCurrent =
                current?.playerId === playerId ? current : undefined;
            const filteredQueue = queue.filter((i) => i?.playerId === playerId);

            return {
                interaction: { current: filteredCurrent, queue: filteredQueue },
            };
        },
    };
}

// ============================================================================
// simple-choice 处理函数（移植自 PromptSystem）
// ============================================================================

function handleSimpleChoiceRespond<TCore>(
    state: MatchState<TCore>,
    playerId: PlayerId,
    payload: { optionId?: string; optionIds?: string[]; mergedValue?: unknown },
    timestamp: number,
): HookResult<TCore> {
    const current = state.sys.interaction.current;

    if (!current) {
        return { halt: true, error: '没有待处理的选择' };
    }
    if (current.playerId !== playerId) {
        return { halt: true, error: '不是你的选择回合' };
    }
    if (current.kind !== 'simple-choice') {
        return { halt: true, error: '当前交互不是 simple-choice' };
    }

    const data = current.data as SimpleChoiceData;
    const isMulti = !!data.multi;
    let selectedOptions: PromptOption[] = [];
    let selectedOptionIds: string[] = [];

    if (isMulti) {
        const optionIds = Array.isArray(payload.optionIds)
            ? payload.optionIds
            : typeof payload.optionId === 'string'
              ? [payload.optionId]
              : [];
        const uniqueIds = Array.from(new Set(optionIds)).filter(
            (id) => typeof id === 'string',
        );
        const optionsById = new Map(data.options.map((o) => [o.id, o]));
        if (uniqueIds.find((id) => !optionsById.has(id))) {
            return { halt: true, error: '无效的选择' };
        }
        if (uniqueIds.find((id) => optionsById.get(id)?.disabled)) {
            return { halt: true, error: '该选项不可用' };
        }
        const minSelections = data.multi?.min ?? 1;
        const maxSelections = data.multi?.max;
        if (uniqueIds.length < minSelections) {
            return { halt: true, error: `至少选择 ${minSelections} 项` };
        }
        if (maxSelections !== undefined && uniqueIds.length > maxSelections) {
            return { halt: true, error: `最多选择 ${maxSelections} 项` };
        }
        selectedOptionIds = uniqueIds;
        selectedOptions = uniqueIds.map((id) => optionsById.get(id)!);
    } else {
        if (typeof payload.optionId !== 'string') {
            return { halt: true, error: '无效的选择' };
        }
        const selectedOption = data.options.find(
            (o) => o.id === payload.optionId,
        );
        if (!selectedOption) {
            return { halt: true, error: '无效的选择' };
        }
        if (selectedOption.disabled) {
            return { halt: true, error: '该选项不可用' };
        }
        selectedOptionIds = [selectedOption.id];
        selectedOptions = [selectedOption];
    }

    const newState = resolveInteraction(state);

    const resolvedValue = payload.mergedValue !== undefined
        ? payload.mergedValue
        : isMulti
            ? selectedOptions.map((o) => o.value)
            : selectedOptions[0]?.value;

    const event: GameEvent = {
        type: INTERACTION_EVENTS.RESOLVED,
        payload: {
            interactionId: current.id,
            playerId,
            optionId:
                selectedOptionIds.length > 0 ? selectedOptionIds[0] : null,
            optionIds: isMulti ? selectedOptionIds : undefined,
            value: resolvedValue,
            sourceId: data.sourceId,
            interactionData: current.data,
        },
        timestamp,
    };

    return { halt: false, state: newState, events: [event] };
}

function handleSimpleChoiceTimeout<TCore>(
    state: MatchState<TCore>,
    timestamp: number,
): HookResult<TCore> {
    const current = state.sys.interaction.current;

    if (!current) {
        return { halt: true, error: '没有待处理的选择' };
    }
    if (current.kind !== 'simple-choice') {
        return { halt: true, error: '当前交互不是 simple-choice' };
    }

    const data = current.data as SimpleChoiceData;
    const newState = resolveInteraction(state);

    const event: GameEvent = {
        type: INTERACTION_EVENTS.EXPIRED,
        payload: {
            interactionId: current.id,
            playerId: current.playerId,
            sourceId: data.sourceId,
        },
        timestamp,
    };

    return { state: newState, events: [event] };
}

function handleInteractionCancel<TCore>(
    state: MatchState<TCore>,
    playerId: PlayerId,
    timestamp: number,
): HookResult<TCore> {
    const current = state.sys.interaction.current;

    if (!current) {
        return { halt: true, error: '没有待处理的交互' };
    }
    if (current.playerId !== playerId) {
        return { halt: true, error: '不是你的交互' };
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
            interactionData: current.data,
        },
        timestamp,
    };

    return { halt: false, state: newState, events: [event] };
}
