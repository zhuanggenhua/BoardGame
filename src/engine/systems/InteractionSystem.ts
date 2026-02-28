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
 * 选项引用来源（显式声明，用于框架层刷新校验）
 * - 'hand'：手牌中的卡（按 cardUid 校验是否仍在手牌）
 * - 'discard'：弃牌堆中的卡（按 cardUid 校验是否仍在弃牌堆）
 * - 'field'：场上随从（按 minionUid 校验是否仍在场上）
 * - 'base'：基地（按 baseIndex 校验是否仍存在）
 * - 'ongoing'：场上 ongoing 卡（按 cardUid 校验是否仍附着）
 * - 'static'：静态选项，不需要校验（如 skip/done/confirm）
 */
export type PromptOptionSource = 'hand' | 'discard' | 'field' | 'base' | 'ongoing' | 'static';

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
    /**
     * 选项引用来源（显式声明）。
     * 框架层刷新时根据此字段决定如何校验选项是否仍然有效。
     * 未声明时视为 'static'，不做校验（向后兼容）。
     */
    _source?: PromptOptionSource;
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
     * - 'hand': 高亮手牌区的候选卡牌，点击卡牌完成选择
     * - 'ongoing': 高亮棋盘上的候选持续行动卡，点击行动卡完成选择
     * - undefined / 'generic': 使用通用弹窗选择
     */
    targetType?: 'base' | 'minion' | 'hand' | 'ongoing' | 'generic';
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
    /** 当其他玩家有未完成的交互时为 true，此时当前玩家不应发送任何命令（如结束回合） */
    isBlocked?: boolean;
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
    if (!data || typeof data !== 'object') return data;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { optionsGenerator, ...rest } = data as Record<string, unknown>;
    return rest;
}

/**
 * 从 InteractionDescriptor 中移除不可序列化的字段。
 */
export function stripNonSerializable(interaction: InteractionDescriptor | undefined): InteractionDescriptor | undefined {
    if (!interaction) return undefined;
    return { ...interaction, data: stripNonSerializableFromData(interaction.data) };
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
    /** 选择目标类型，决定 UI 渲染方式（'base' | 'minion' | 'hand' | 'ongoing' | 'generic'） */
    targetType?: 'base' | 'minion' | 'hand' | 'ongoing' | 'generic';
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

/**
 * 创建 multistep-choice 交互
 */
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

    const { current, queue } = state.sys.interaction;

    if (!current) {
        // 如果当前没有交互，新交互立即成为 current
        // 如果有选项生成器，立即基于当前状态生成选项
        console.log('[InteractionSystem] popInteraction: No current, making new interaction current:', {
            interactionId: interaction.id,
            kind: interaction.kind,
        });
        
        if (interaction.kind === 'simple-choice') {
            const data = interaction.data as SimpleChoiceData;
            console.log('[InteractionSystem] popInteraction: Checking optionsGenerator:', {
                hasOptionsGenerator: !!data.optionsGenerator,
                hasContinuationContext: !!(data as any).continuationContext,
                continuationContext: (data as any).continuationContext,
                originalOptionsCount: data.options?.length,
            });
            
            if (data.optionsGenerator) {
                // 传递 state 和 data（包含 continuationContext）给 optionsGenerator
                console.log('[InteractionSystem] popInteraction: Calling optionsGenerator...');
                const freshOptions = data.optionsGenerator(state, data);
                console.log('[InteractionSystem] popInteraction: optionsGenerator returned:', {
                    freshOptionsCount: freshOptions.length,
                    freshOptions,
                });
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
    // urgent 交互插入队列头部，确保链式交互不被打断
    const newQueue = options?.urgent ? [interaction, ...queue] : [...queue, interaction];
    
    return {
        ...state,
        sys: {
            ...state.sys,
            interaction: {
                ...state.sys.interaction,
                queue: newQueue,
            },
        },
    };
}

/**
 * 解决当前交互并弹出下一个
 *
 * 如果下一个交互有 optionsGenerator，则基于当前最新状态生成选项。
 * 否则使用通用刷新逻辑（根据选项的 _source 字段显式校验）。
 * 这确保了串行交互（如连续弃牌）中，后续交互看到的是最新状态。
 */
export function resolveInteraction<TCore>(
    state: MatchState<TCore>,
): MatchState<TCore> {
    const { queue } = state.sys.interaction;
    let next = queue[0];
    const newQueue = queue.slice(1);

    console.log('[InteractionSystem] resolveInteraction START:', {
        hasNext: !!next,
        nextId: next?.id,
        nextKind: next?.kind,
        queueLength: queue.length,
    });

    // 如果下一个交互是 simple-choice，刷新选项
    if (next && next.kind === 'simple-choice') {
        const data = next.data as SimpleChoiceData;
        
        console.log('[InteractionSystem] Processing simple-choice:', {
            interactionId: next.id,
            hasOptionsGenerator: !!data.optionsGenerator,
            hasContinuationContext: !!(data as any).continuationContext,
            continuationContext: (data as any).continuationContext,
            originalOptionsCount: data.options?.length,
            originalOptions: data.options,
        });
        
        // 优先使用手动提供的 optionsGenerator
        let freshOptions: PromptOption[];
        if (data.optionsGenerator) {
            console.log('[InteractionSystem] Calling optionsGenerator...');
            freshOptions = data.optionsGenerator(state, data);
            console.log('[InteractionSystem] optionsGenerator returned:', {
                freshOptionsCount: freshOptions.length,
                freshOptions,
            });
        } else {
            // 使用通用刷新逻辑
            console.log('[InteractionSystem] Using generic refresh...');
            freshOptions = refreshOptionsGeneric(state, next, data.options);
        }
        
        // 智能处理 multi.min 限制
        if (!(data.multi?.min && freshOptions.length < data.multi.min)) {
            next = {
                ...next,
                data: { ...data, options: freshOptions },
            };
            console.log('[InteractionSystem] Updated next interaction with fresh options:', {
                interactionId: next.id,
                newOptionsCount: freshOptions.length,
            });
        } else {
            console.warn('[InteractionSystem] Fresh options do not meet multi.min requirement, keeping original options');
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

/**
 * 通用选项刷新逻辑（框架层）
 *
 * 自动推断选项类型并校验是否仍然有效：
 * 1. 优先使用显式声明的 _source 字段
 * 2. 未声明时根据 value 的字段自动推断：
 *    - 有 cardUid → 检查手牌/弃牌堆/ongoing
 *    - 有 minionUid → 检查场上随从
 *    - 有 baseIndex → 检查基地是否存在
 *    - 其他 → 视为静态选项，保留
 * 
 * 这样游戏层无需手动添加 _source 字段，框架层自动处理。
 */
function refreshOptionsGeneric<T>(
    state: any,
    interaction: InteractionDescriptor,
    originalOptions: PromptOption<T>[],
): PromptOption<T>[] {
    return originalOptions.filter((opt) => {
        const val = opt.value as any;
        
        // 优先使用显式声明的 _source
        const explicitSource = opt._source;
        
        // 自动推断类型（当未显式声明时）
        const inferredSource = explicitSource || (() => {
            if (!val || typeof val !== 'object') return 'static';
            
            // 跳过/完成/取消等操作选项
            if (val.skip || val.done || val.cancel || val.__cancel__) return 'static';
            
            // 根据字段推断类型
            if (val.minionUid !== undefined) return 'field';
            if (val.baseIndex !== undefined) return 'base';
            if (val.cardUid !== undefined) {
                // cardUid 可能是手牌、弃牌堆或 ongoing，需要进一步检查
                // 默认先检查手牌，如果不在手牌则检查弃牌堆和 ongoing
                return 'hand'; // 默认假设是手牌，后续会尝试其他来源
            }
            
            return 'static';
        })();

        switch (inferredSource) {
            case 'hand': {
                const player = state.core?.players?.[interaction.playerId];
                if (player?.hand?.some((c: any) => c.uid === val?.cardUid)) return true;
                // 如果不在手牌，尝试弃牌堆（向后兼容）
                if (player?.discard?.some((c: any) => c.uid === val?.cardUid)) return true;
                return false;
            }
            case 'discard': {
                const player = state.core?.players?.[interaction.playerId];
                return player?.discard?.some((c: any) => c.uid === val?.cardUid) ?? false;
            }
            case 'field': {
                for (const base of state.core?.bases || []) {
                    if (base.minions?.some((m: any) => m.uid === val?.minionUid)) return true;
                }
                return false;
            }
            case 'base': {
                return typeof val?.baseIndex === 'number' &&
                    val.baseIndex >= 0 &&
                    val.baseIndex < (state.core?.bases?.length || 0);
            }
            case 'ongoing': {
                // ongoing 卡附着在基地或随从上，检查是否仍存在
                for (const base of state.core?.bases || []) {
                    if (base.ongoingActions?.some((o: any) => o.uid === val?.cardUid)) return true;
                    for (const m of base.minions || []) {
                        if (m.attachedActions?.some((o: any) => o.uid === val?.cardUid)) return true;
                    }
                }
                return false;
            }
            case 'static':
            default:
                // 静态选项或无法推断的选项：一律保留
                return true;
        }
    });
}

/**
 * 刷新当前交互的选项
 *
 * 在状态更新时调用，确保交互选项反映最新状态。
 *
 * 刷新策略：
 * 1. 如果手动提供了 optionsGenerator，优先使用
 * 2. 否则使用通用刷新逻辑（根据选项的 _source 字段显式校验）
 * 3. 如果过滤后无法满足 multi.min 限制，保持原始选项（安全降级）
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
        // 使用通用刷新逻辑
        freshOptions = refreshOptionsGeneric(state, currentInteraction, data.options);
    }
    
    // 智能处理 multi.min 限制
    // 如果过滤后无法满足最小选择数，保持原始选项（安全降级）
    if (data.multi?.min && freshOptions.length < data.multi.min) {
        return state;
    }
    
    // 更新交互选项
    return {
        ...state,
        sys: {
            ...state.sys,
            interaction: {
                ...state.sys.interaction,
                current: {
                    ...currentInteraction,
                    data: { ...data, options: freshOptions },
                },
            },
        },
    };
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
            // ---- 交互取消（通用，所有 kind 都能用） ----
            if (command.type === INTERACTION_COMMANDS.CANCEL) {
                const ts = resolveCommandTimestamp(command);
                return handleInteractionCancel(state, command.playerId, ts);
            }

            // ---- 通用阻塞：有交互时阻塞 ADVANCE_PHASE ----
            const current = state.sys.interaction.current;
            if (current && command.type === 'ADVANCE_PHASE') {
                return { halt: true, error: '请先完成当前交互' };
            }
        },

        playerView: (state, playerId): Partial<{ interaction: InteractionState }> => {
            const { current, queue } = state.sys.interaction;

            console.error('[InteractionSystem playerView] START:', {
                playerId,
                hasCurrent: !!current,
                currentId: current?.id,
                currentOptionsCount: (current?.data as any)?.options?.length,
                currentOptions: (current?.data as any)?.options,
            });

            const filteredCurrent =
                current?.playerId === playerId ? stripNonSerializable(current) : undefined;
            
            console.error('[InteractionSystem playerView] After stripNonSerializable:', {
                hasFilteredCurrent: !!filteredCurrent,
                filteredOptionsCount: (filteredCurrent?.data as any)?.options?.length,
                filteredOptions: (filteredCurrent?.data as any)?.options,
            });
            
            const filteredQueue = queue.filter((i) => i?.playerId === playerId).map(i => stripNonSerializable(i)!);
            // 当其他玩家有未完成交互时，通知当前玩家被阻塞（不暴露交互详情）
            const isBlocked = !!current && current.playerId !== playerId;

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
            interactionData: stripNonSerializableFromData(current.data),
        },
        timestamp,
    };

    return { halt: false, state: newState, events: [event] };
}
