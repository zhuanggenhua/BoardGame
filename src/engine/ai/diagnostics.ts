import type { MatchState, PlayerId } from '../types';
import { createAiLegalActionId } from './context';
import type { AiInteractionSupportDeclaration } from './decisionSemantics';
import type { AiLegalAction } from './types';

export type AiBlockingInteractionDiagnosticStatus =
    | 'ok'
    | 'declared-unsupported'
    | 'missing-actions'
    | 'missing-support';

export interface AiBlockingInteractionDiagnostic {
    status: AiBlockingInteractionDiagnosticStatus;
    interactionId?: string;
    interactionKind?: string;
    sourceId?: string;
    ownerPlayerId?: PlayerId;
    hasSemanticDecision: boolean;
    hasAdapter: boolean;
    unsupportedReason?: string;
    reason: string;
}

export interface DiagnoseAiOwnedBlockingInteractionArgs {
    playerId: PlayerId;
    state: MatchState<unknown>;
    legalActions: AiLegalAction[];
    adapterInteractionKinds?: Iterable<string>;
}

export interface BuildAiOwnedBlockingInteractionFallbackActionsArgs extends DiagnoseAiOwnedBlockingInteractionArgs {
    actionKind?: string;
    label?: string;
}

type InteractionLike = {
    id?: unknown;
    kind?: unknown;
    playerId?: unknown;
    sourceId?: unknown;
    ai?: unknown;
    data?: {
        sourceId?: unknown;
        ai?: unknown;
    };
};

const resolveSourceId = (interaction: InteractionLike): string | undefined => {
    if (typeof interaction.sourceId === 'string') return interaction.sourceId;
    if (typeof interaction.data?.sourceId === 'string') return interaction.data.sourceId;
    return undefined;
};

const resolveAiSupportDeclaration = (interaction: InteractionLike): AiInteractionSupportDeclaration | undefined => {
    const rawAi = interaction.ai && typeof interaction.ai === 'object'
        ? interaction.ai
        : interaction.data?.ai && typeof interaction.data.ai === 'object'
            ? interaction.data.ai
            : undefined;
    return rawAi as AiInteractionSupportDeclaration | undefined;
};

export function diagnoseAiOwnedBlockingInteraction(
    args: DiagnoseAiOwnedBlockingInteractionArgs,
): AiBlockingInteractionDiagnostic {
    const current = args.state.sys?.interaction?.current as InteractionLike | null | undefined;
    const ownerPlayerId = typeof current?.playerId === 'string' ? current.playerId : undefined;
    const interactionKind = typeof current?.kind === 'string' ? current.kind : undefined;
    const interactionId = typeof current?.id === 'string' ? current.id : undefined;

    if (!current || ownerPlayerId !== args.playerId || !interactionKind || !interactionId) {
        return {
            status: 'ok',
            hasSemanticDecision: false,
            hasAdapter: false,
            reason: '当前没有该 AI 座位拥有的阻塞交互',
        };
    }

    const ai = resolveAiSupportDeclaration(current);
    const hasSemanticDecision = ai?.status === 'semantic' && Array.isArray(ai.decisions) && ai.decisions.length > 0;
    const hasAdapter = ai?.status === 'adapter'
        || new Set(args.adapterInteractionKinds ?? []).has(interactionKind);
    const common = {
        interactionId,
        interactionKind,
        sourceId: resolveSourceId(current),
        ownerPlayerId,
        hasSemanticDecision,
        hasAdapter,
    };

    if (args.legalActions.length > 0) {
        return {
            ...common,
            status: 'ok',
            reason: '阻塞交互已生成 AI 合法动作',
        };
    }

    if (ai?.status === 'unsupported') {
        return {
            ...common,
            status: 'declared-unsupported',
            unsupportedReason: ai.reason,
            reason: ai.reason ?? '该阻塞交互已明确声明不支持 AI',
        };
    }

    if (hasSemanticDecision || hasAdapter) {
        return {
            ...common,
            status: 'missing-actions',
            reason: hasSemanticDecision
                ? '阻塞交互有 AI 决策语义，但没有生成合法动作'
                : '阻塞交互有游戏 AI 适配器声明，但没有生成合法动作',
        };
    }

    return {
        ...common,
        status: 'missing-support',
        reason: '阻塞交互没有 AI 决策语义、游戏适配器声明或明确不支持标记',
    };
}

export function buildAiOwnedBlockingInteractionFallbackActions(
    args: BuildAiOwnedBlockingInteractionFallbackActionsArgs,
): AiLegalAction[] {
    const diagnostic = diagnoseAiOwnedBlockingInteraction(args);
    if (diagnostic.status === 'ok') return [];
    if (!diagnostic.interactionId) return [];

    return [{
        actionId: createAiLegalActionId(
            'interaction',
            diagnostic.interactionId,
            'fallback-cancel',
            diagnostic.status,
        ),
        kind: args.actionKind ?? 'interaction-cancel',
        label: args.label ?? '取消交互（AI 无可用动作）',
        commands: [{
            type: 'SYS_INTERACTION_CANCEL',
            payload: {
                interactionId: diagnostic.interactionId,
                reason: diagnostic.status,
            },
        }],
        metadata: {
            interactionId: diagnostic.interactionId,
            interactionKind: diagnostic.interactionKind,
            sourceId: diagnostic.sourceId,
            reason: diagnostic.reason,
            diagnosticStatus: diagnostic.status,
            emergencyFallback: true,
        },
    }];
}
