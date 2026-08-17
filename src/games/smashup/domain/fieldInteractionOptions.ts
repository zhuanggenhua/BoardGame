import type { AiHint } from '../../../engine/ai';
import type {
    PromptOption as EnginePromptOption,
    SimpleChoiceConfig,
    SimpleChoiceTargetType,
} from '../../../engine/systems/InteractionSystem';
import type { SmashUpCore } from './types';

export type FieldObjectType = 'minion' | 'base' | 'ongoing' | 'action' | 'titan' | 'card' | 'player';

export const FIELD_SOURCE_TARGET_PROMPT_TARGET_TYPE: SimpleChoiceTargetType = 'field-source-target';
export const FIELD_SOURCE_ACTION_PROMPT_TARGET_TYPE: SimpleChoiceTargetType = 'field-source-action';

export function buildFieldSourceTargetPromptConfig<TConfig extends Omit<SimpleChoiceConfig, 'targetType'> & { sourceId: string }>(
    config: TConfig,
): TConfig & { targetType: typeof FIELD_SOURCE_TARGET_PROMPT_TARGET_TYPE } {
    return {
        ...config,
        targetType: FIELD_SOURCE_TARGET_PROMPT_TARGET_TYPE,
    };
}

export function buildFieldSourceActionPromptConfig<TConfig extends Omit<SimpleChoiceConfig, 'targetType'> & { sourceId: string }>(
    config: TConfig,
): TConfig & { targetType: typeof FIELD_SOURCE_ACTION_PROMPT_TARGET_TYPE } {
    return {
        ...config,
        targetType: FIELD_SOURCE_ACTION_PROMPT_TARGET_TYPE,
    };
}

export type FieldSourceTargetValue<TExtra extends Record<string, unknown> = Record<string, never>> = TExtra & {
    fieldInteractionType: 'source-target';
    fieldSourceType: FieldObjectType;
    fieldTargetType: FieldObjectType;
    sourceUid: string;
    cardUid?: string;
    ongoingUid?: string;
    targetUid?: string;
    sourceBaseIndex?: number;
    targetBaseIndex?: number;
    fromBaseIndex?: number;
    minionUid?: string;
    targetMinionUid?: string;
    minionDefId?: string;
    targetMinionDefId?: string;
    defId?: string;
    targetDefId?: string;
    baseIndex?: number;
    baseDefId?: string;
};

export type FieldSourceToBaseTargetValue<TExtra extends Record<string, unknown> = Record<string, never>> =
    FieldSourceTargetValue<TExtra> & {
        fieldTargetType: 'base';
        targetBaseIndex: number;
        baseIndex: number;
    };

export type FieldSourceToMinionTargetValue<TExtra extends Record<string, unknown> = Record<string, never>> =
    FieldSourceTargetValue<TExtra> & {
        fieldTargetType: 'minion';
        targetUid: string;
        targetMinionUid: string;
        baseIndex: number;
    };

export type FieldSourceTargetSource = {
    type: FieldObjectType;
    uid: string;
    defId?: string;
    baseIndex?: number;
    fromBaseIndex?: number;
};

export type FieldSourceActionValue<TExtra extends Record<string, unknown> = Record<string, never>> = TExtra & {
    fieldInteractionType: 'source-action';
    fieldSourceType: FieldObjectType;
    sourceUid: string;
    sourceBaseIndex?: number;
    fromBaseIndex?: number;
    baseIndex?: number;
    minionUid?: string;
    minionDefId?: string;
    cardUid?: string;
    ongoingUid?: string;
    titanUid?: string;
    defId?: string;
};

export type FieldSourceTargetTarget = {
    type: FieldObjectType;
    label: string;
    uid?: string;
    defId?: string;
    baseIndex?: number;
    aiHint?: AiHint;
};

/**
 * 构建“点击场上来源对象本体即可执行”的共享交互选项。
 *
 * 规则语义：来源对象本体是第一入口且没有第二目标；跳过/不发动等分支仍用按钮承载。
 */
export function buildFieldSourceActionOptions<TExtra extends Record<string, unknown> = Record<string, never>>(
    source: FieldSourceTargetSource & { label: string; labelKey?: string },
    extra?: TExtra,
): EnginePromptOption<FieldSourceActionValue<TExtra>>[] {
    const sourceBaseIndex = source.fromBaseIndex ?? source.baseIndex;
    return [{
        id: `source-${source.uid}-action`,
        label: source.label,
        ...(source.labelKey ? { labelKey: source.labelKey } : {}),
        value: {
            ...((extra ?? {}) as TExtra),
            fieldInteractionType: 'source-action',
            fieldSourceType: source.type,
            sourceUid: source.uid,
            ...(sourceBaseIndex !== undefined ? { sourceBaseIndex, fromBaseIndex: sourceBaseIndex, baseIndex: sourceBaseIndex } : {}),
            ...(source.type === 'minion' ? {
                minionUid: source.uid,
                ...(source.defId ? { minionDefId: source.defId, defId: source.defId } : {}),
            } : {}),
            ...(source.type === 'ongoing' || source.type === 'action' ? {
                cardUid: source.uid,
                ongoingUid: source.uid,
                ...(source.defId ? { defId: source.defId } : {}),
            } : {}),
            ...(source.type === 'titan' ? {
                titanUid: source.uid,
                ...(source.defId ? { defId: source.defId } : {}),
            } : {}),
        } as FieldSourceActionValue<TExtra>,
        _source: 'field' as const,
        displayMode: 'card' as const,
    }];
}

/**
 * 构建“先点场上来源对象，再点目标对象”的共享交互选项。
 *
 * 规则语义：来源对象本体是第一入口；目标对象只有在来源被玩家点选后才高亮。
 * handler 仍消费同一份 live option，不允许 UI 反推来源或目标。
 */
export function buildFieldSourceTargetOptions<TExtra extends Record<string, unknown> = Record<string, never>>(
    source: FieldSourceTargetSource,
    targets: FieldSourceTargetTarget[],
    extra?: TExtra,
): EnginePromptOption<FieldSourceTargetValue<TExtra>>[] {
    return targets.map((target, index) => {
        const sourceBaseIndex = source.fromBaseIndex ?? source.baseIndex;
        const targetIdentity = target.type === 'base' && target.baseIndex !== undefined
            ? `base-${target.baseIndex}`
            : `${target.type}-${target.uid ?? index}`;
        return {
            id: `source-${source.uid}-${targetIdentity}-${index}`,
            label: target.label,
            value: {
                ...((extra ?? {}) as TExtra),
                fieldInteractionType: 'source-target',
                fieldSourceType: source.type,
                fieldTargetType: target.type,
                sourceUid: source.uid,
                ...(target.uid ? { targetUid: target.uid } : {}),
                ...(sourceBaseIndex !== undefined ? { sourceBaseIndex, fromBaseIndex: sourceBaseIndex } : {}),
                ...(source.type === 'minion' ? {
                    minionUid: source.uid,
                    ...(source.defId ? { minionDefId: source.defId, defId: source.defId } : {}),
                } : {}),
                ...(source.type === 'ongoing' || source.type === 'action' ? {
                    cardUid: source.uid,
                    ongoingUid: source.uid,
                    ...(source.defId ? { defId: source.defId } : {}),
                } : {}),
                ...(target.type === 'minion' && target.uid ? {
                    targetMinionUid: target.uid,
                    ...(target.defId ? { targetMinionDefId: target.defId, targetDefId: target.defId } : {}),
                    ...(target.baseIndex !== undefined ? { baseIndex: target.baseIndex } : {}),
                } : {}),
                ...(target.type === 'base' && target.baseIndex !== undefined ? {
                    targetBaseIndex: target.baseIndex,
                    baseIndex: target.baseIndex,
                    ...(target.defId ? { baseDefId: target.defId } : {}),
                } : {}),
            } as FieldSourceTargetValue<TExtra>,
            _source: 'field' as const,
            displayMode: 'card' as const,
            ...(target.aiHint ? { _ai: target.aiHint } : {}),
        };
    });
}

/**
 * 任意场上来源对象 -> 基地目标的共享包装。
 * 只负责把基地候选补上稳定 baseDefId；来源类型仍由 source.type 声明。
 */
export function buildFieldSourceToBaseTargetOptions<TExtra extends Record<string, unknown> = Record<string, never>>(
    source: FieldSourceTargetSource,
    targets: { baseIndex: number; label: string }[],
    state: SmashUpCore,
    extra?: TExtra,
): EnginePromptOption<FieldSourceToBaseTargetValue<TExtra>>[] {
    return buildFieldSourceTargetOptions<TExtra>(
        source,
        targets.map(target => ({
            type: 'base',
            label: target.label,
            baseIndex: target.baseIndex,
            defId: state.bases[target.baseIndex]?.defId,
        })),
        extra,
    ) as EnginePromptOption<FieldSourceToBaseTargetValue<TExtra>>[];
}
