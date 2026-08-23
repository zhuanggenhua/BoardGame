import type { AiActionMetadata } from './ai/types';
import type { ChoiceRequestDiagnosticSnapshot } from './ChoiceRequest';
import type {
    EventCommitEvidence,
    MatchState,
    PlayerId,
    RefereeTraceEntry,
    ResolutionFrame,
    ResponseWindowState,
} from './types';
import type { InteractionDescriptor, SimpleChoiceData } from './systems/InteractionSystem';
import { getCurrentResponderId } from './systems/ResponseWindowSystem';

export type RefereeMessageType =
    | 'referee:idle'
    | 'referee:interaction'
    | 'referee:blocked-interaction'
    | 'referee:response-window'
    | 'referee:resolution-frame'
    | 'referee:event-commit';

export interface RefereeMessage<TPayload = unknown> {
    type: RefereeMessageType;
    payload: TPayload;
}

export interface RefereeInteractionOptionSummary {
    total: number;
    enabledOptionIds: string[];
    disabledOptionIds: string[];
}

export interface RefereeInteractionSnapshot {
    visible: true;
    id: string;
    kind: string;
    playerId: PlayerId;
    sourceId?: string;
    resolutionFrameId?: string;
    optionSummary?: RefereeInteractionOptionSummary;
    choiceRequest?: Partial<ChoiceRequestDiagnosticSnapshot>;
    metadata?: AiActionMetadata;
}

export interface RefereeBlockedInteractionSnapshot {
    visible: false;
    blockedByPlayerId: PlayerId;
}

export interface RefereeResponseWindowSnapshot {
    id: string;
    windowType: string;
    sourceId?: string;
    responderQueue: PlayerId[];
    currentResponderId?: PlayerId;
    currentResponderIndex: number;
    passedPlayers: PlayerId[];
    pendingInteractionId?: string;
    requiredInteractionId?: string;
    resolutionFrameId?: string;
    isCurrentResponder?: boolean;
}

export interface RefereeResolutionFrameSnapshot {
    id: string;
    kind: string;
    status: ResolutionFrame['status'];
    ordering: ResolutionFrame['ordering'];
    parentFrameId?: string;
    foregroundOwner?: ResolutionFrame['foregroundOwner'];
    blockedBy?: ResolutionFrame['blockedBy'];
    phase?: string;
    deferredEventTypes: string[];
    deferredActionCount: number;
    metadata?: Record<string, unknown>;
}

export interface RefereeResolutionSnapshot {
    activeFrameId?: string;
    frames: RefereeResolutionFrameSnapshot[];
}

export interface RefereeTraceSnapshot {
    entries: Array<{
        id: number;
        evidence: EventCommitEvidence;
    }>;
}

export interface RefereeDecisionSnapshot {
    decisionEpoch: number;
    playerId?: PlayerId;
    interaction?: RefereeInteractionSnapshot | RefereeBlockedInteractionSnapshot;
    responseWindow?: RefereeResponseWindowSnapshot;
    resolution?: RefereeResolutionSnapshot;
    trace?: RefereeTraceSnapshot;
    messages: RefereeMessage[];
}

export interface BuildRefereeDecisionSnapshotOptions {
    /**
     * 填入玩家时，隐藏其它玩家的私有 interaction 候选，只保留“被谁阻塞”的事实。
     * 不填时生成裁判 / 测试 / 审计视角快照。
     */
    playerId?: PlayerId;
    /** 保留最近多少条事件提交证据；默认 5。 */
    traceLimit?: number;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : undefined;
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function optionId(option: unknown): string | undefined {
    return asString(asRecord(option)?.id);
}

function summarizeSimpleChoiceOptions(data: unknown): RefereeInteractionOptionSummary | undefined {
    const options = asRecord(data)?.options;
    if (!Array.isArray(options)) return undefined;

    const enabledOptionIds: string[] = [];
    const disabledOptionIds: string[] = [];
    for (const option of options) {
        const id = optionId(option);
        if (!id) continue;
        if (asRecord(option)?.disabled === true) {
            disabledOptionIds.push(id);
        } else {
            enabledOptionIds.push(id);
        }
    }

    return {
        total: options.length,
        enabledOptionIds,
        disabledOptionIds,
    };
}

function interactionSourceId(interaction: InteractionDescriptor): string | undefined {
    return asString((interaction as { sourceId?: unknown }).sourceId)
        ?? asString(asRecord(interaction.data)?.sourceId);
}

function interactionMetadata(interaction: InteractionDescriptor): AiActionMetadata | undefined {
    return asRecord(asRecord(interaction.data)?.metadata) as AiActionMetadata | undefined;
}

function interactionChoiceRequest(interaction: InteractionDescriptor): Partial<ChoiceRequestDiagnosticSnapshot> | undefined {
    const choiceRequest = asRecord((interaction.data as Partial<SimpleChoiceData>)?.choiceRequest);
    return choiceRequest as Partial<ChoiceRequestDiagnosticSnapshot> | undefined;
}

function buildInteractionSnapshot(
    interaction: InteractionDescriptor | undefined,
    playerId?: PlayerId,
): RefereeInteractionSnapshot | RefereeBlockedInteractionSnapshot | undefined {
    if (!interaction) return undefined;
    if (playerId && interaction.playerId !== playerId) {
        return {
            visible: false,
            blockedByPlayerId: interaction.playerId,
        };
    }

    return {
        visible: true,
        id: interaction.id,
        kind: interaction.kind,
        playerId: interaction.playerId,
        sourceId: interactionSourceId(interaction),
        resolutionFrameId: interaction.resolutionFrameId,
        optionSummary: summarizeSimpleChoiceOptions(interaction.data),
        choiceRequest: interactionChoiceRequest(interaction),
        metadata: interactionMetadata(interaction),
    };
}

function buildResponseWindowSnapshot(
    window: ResponseWindowState['current'] | undefined,
    playerId?: PlayerId,
): RefereeResponseWindowSnapshot | undefined {
    if (!window) return undefined;
    const currentResponderId = getCurrentResponderId(window);
    const passedPlayers = Array.isArray(window.passedPlayers) ? window.passedPlayers : [];
    return {
        id: window.id,
        windowType: window.windowType,
        sourceId: window.sourceId,
        responderQueue: [...window.responderQueue],
        currentResponderId,
        currentResponderIndex: window.currentResponderIndex,
        passedPlayers: [...passedPlayers],
        pendingInteractionId: window.pendingInteractionId,
        requiredInteractionId: window.requiredInteractionId,
        resolutionFrameId: window.resolutionFrameId,
        ...(playerId ? { isCurrentResponder: currentResponderId === playerId } : {}),
    };
}

function summarizeResolutionFrame(frame: ResolutionFrame): RefereeResolutionFrameSnapshot {
    return {
        id: frame.id,
        kind: frame.kind,
        status: frame.status,
        ordering: frame.ordering,
        parentFrameId: frame.parentFrameId,
        foregroundOwner: frame.foregroundOwner,
        blockedBy: frame.blockedBy,
        phase: frame.phase,
        deferredEventTypes: (frame.deferredEvents ?? []).map(event => event.type),
        deferredActionCount: frame.deferredActions?.length ?? 0,
        metadata: frame.metadata,
    };
}

function buildResolutionSnapshot<TCore>(state: MatchState<TCore>): RefereeResolutionSnapshot | undefined {
    const resolution = state.sys.resolution;
    if (!resolution || resolution.frames.length === 0) return undefined;
    return {
        activeFrameId: resolution.activeFrameId,
        frames: resolution.frames.map(summarizeResolutionFrame),
    };
}

function buildTraceSnapshot<TCore>(
    state: MatchState<TCore>,
    traceLimit: number,
): RefereeTraceSnapshot | undefined {
    const entries = state.sys.refereeTrace?.entries ?? [];
    if (entries.length === 0 || traceLimit <= 0) return undefined;
    const start = Math.max(0, entries.length - traceLimit);
    return {
        entries: entries.slice(start).map((entry: RefereeTraceEntry) => ({
            id: entry.id,
            evidence: entry.evidence,
        })),
    };
}

function buildMessages(snapshot: Omit<RefereeDecisionSnapshot, 'messages'>): RefereeMessage[] {
    const messages: RefereeMessage[] = [];

    if (snapshot.interaction) {
        messages.push({
            type: snapshot.interaction.visible ? 'referee:interaction' : 'referee:blocked-interaction',
            payload: snapshot.interaction,
        });
    }
    if (snapshot.responseWindow) {
        messages.push({
            type: 'referee:response-window',
            payload: snapshot.responseWindow,
        });
    }
    if (snapshot.resolution?.activeFrameId) {
        const activeFrame = snapshot.resolution.frames.find(frame => frame.id === snapshot.resolution?.activeFrameId);
        if (activeFrame) {
            messages.push({
                type: 'referee:resolution-frame',
                payload: activeFrame,
            });
        }
    }
    for (const entry of snapshot.trace?.entries ?? []) {
        messages.push({
            type: 'referee:event-commit',
            payload: entry,
        });
    }

    if (messages.length === 0) {
        messages.push({
            type: 'referee:idle',
            payload: {
                decisionEpoch: snapshot.decisionEpoch,
            },
        });
    }

    return messages;
}

/**
 * 生成统一裁判决策快照。
 *
 * 这是只读查询面：不发现 opportunity、不创建 interaction、不推进 response window，
 * 也不替代 playerView / AI legal-action 的规则授权。
 */
export function buildRefereeDecisionSnapshot<TCore>(
    state: MatchState<TCore>,
    options: BuildRefereeDecisionSnapshotOptions = {},
): RefereeDecisionSnapshot {
    const traceLimit = options.traceLimit ?? 5;
    const snapshotWithoutMessages: Omit<RefereeDecisionSnapshot, 'messages'> = {
        decisionEpoch: state.sys.decisionEpoch ?? 0,
        playerId: options.playerId,
        interaction: buildInteractionSnapshot(state.sys.interaction?.current, options.playerId),
        responseWindow: buildResponseWindowSnapshot(state.sys.responseWindow?.current, options.playerId),
        resolution: buildResolutionSnapshot(state),
        trace: buildTraceSnapshot(state, traceLimit),
    };

    return {
        ...snapshotWithoutMessages,
        messages: buildMessages(snapshotWithoutMessages),
    };
}

export function getRefereeMessages<TCore>(
    state: MatchState<TCore>,
    options: BuildRefereeDecisionSnapshotOptions = {},
): RefereeMessage[] {
    return buildRefereeDecisionSnapshot(state, options).messages;
}
