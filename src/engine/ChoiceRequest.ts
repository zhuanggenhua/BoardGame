import type { PlayerId } from './types';
import { createAiLegalActionId } from './ai/context';
import {
    enumerateAiDecisionSelections,
    type AiDecisionCandidate,
    type AiSelectionBounds,
} from './ai/decisionSemantics';
import type { AiActionMetadata, AiCommandSpec, AiHint, AiLegalAction } from './ai/types';

export type ChoiceRequestKind =
    | 'select-player'
    | 'select-card'
    | 'select-object'
    | 'select-zone'
    | 'select-position'
    | 'select-dice'
    | 'modify-value'
    | 'choose-option'
    | 'confirm'
    | 'optional-skip'
    | 'pass';

export type ChoiceRequestSkipPolicy =
    | 'forbidden'
    | 'optional'
    | 'required'
    | 'confirm-current'
    | 'cancel-only';

export type ChoiceRequestAiSupportStatus =
    | 'shared-policy'
    | 'game-policy'
    | 'unsupported';

export interface ChoiceRequestAiSupport {
    status: ChoiceRequestAiSupportStatus;
    policyId?: string;
    reason?: string;
}

export const CHOICE_REQUEST_SHARED_AI_POLICY_IDS = {
    SKIP: 'choice-request:skip',
    PASS: 'choice-request:pass',
    CONFIRM_CURRENT: 'choice-request:confirm-current',
    SINGLE_REQUIRED_CANDIDATE: 'choice-request:single-required-candidate',
    ORDERED_SELECTION: 'choice-request:ordered-selection',
    UNORDERED_SELECTION: 'choice-request:unordered-selection',
    SIMPLE_TARGET: 'choice-request:simple-target',
} as const;

export type ChoiceRequestSharedAiPolicyId =
    typeof CHOICE_REQUEST_SHARED_AI_POLICY_IDS[keyof typeof CHOICE_REQUEST_SHARED_AI_POLICY_IDS];

export const DEFAULT_CHOICE_REQUEST_SHARED_AI_POLICY_IDS: readonly string[] = [
    ...Object.values(CHOICE_REQUEST_SHARED_AI_POLICY_IDS),
    // First-batch aliases kept stable while game files move to the generic IDs.
    'mage-wars-button-options',
    'qidahen-button-options',
    'dicethrone-choice-options',
];

export interface ChoiceRequestSelectionBounds {
    min: number;
    max: number;
    ordered?: boolean;
    maxGeneratedSelections?: number;
}

export interface ChoiceRequestCandidate<TValue = unknown> {
    id: string;
    label?: string;
    labelKey?: string;
    labelParams?: Record<string, string | number>;
    description?: string;
    value?: TValue;
    disabled?: boolean;
    disabledReason?: string;
    stale?: boolean;
    visibleToPlayerIds?: PlayerId[];
    displayMode?: 'card' | 'button';
    commands?: AiCommandSpec[];
    aiHints?: AiHint[];
    metadata?: AiActionMetadata;
    actionKind?: string;
    actionKeyParts?: Array<string | number | undefined | null>;
}

export interface ChoiceRequestRecoveryAction {
    id?: string;
    kind?: string;
    label: string;
    commands: AiCommandSpec[];
    metadata?: AiActionMetadata;
}

export type ChoiceRequestResolution<TValue = unknown> =
    | {
        type: 'candidate-commands';
    }
    | {
        type: 'commands';
        buildCommands(selection: ChoiceRequestCandidate<TValue>[], request: ChoiceRequest<TValue>): AiCommandSpec[];
    }
    | {
        type: 'interaction-response';
        interactionId?: string;
        commandType?: string;
    };

export interface ChoiceRequest<TValue = unknown> {
    requestId: string;
    gameId?: string;
    playerId: PlayerId;
    ownerFrameId?: string;
    kind: ChoiceRequestKind;
    sourceId?: string;
    candidates: ChoiceRequestCandidate<TValue>[];
    selection: ChoiceRequestSelectionBounds;
    skipPolicy?: ChoiceRequestSkipPolicy;
    recoveryAction?: ChoiceRequestRecoveryAction;
    resolution: ChoiceRequestResolution<TValue>;
    ai?: ChoiceRequestAiSupport;
    metadata?: AiActionMetadata;
}

export type ChoiceRequestDiagnosticSeverity = 'error' | 'warning';

export type ChoiceRequestDiagnosticCode =
    | 'missing-request-id'
    | 'missing-player-id'
    | 'missing-owner-frame'
    | 'duplicate-candidate-id'
    | 'invalid-selection-bounds'
    | 'mandatory-choice-unsatisfied'
    | 'missing-recovery-action'
    | 'candidate-missing-command'
    | 'stale-candidate';

export interface ChoiceRequestDiagnostic {
    severity: ChoiceRequestDiagnosticSeverity;
    code: ChoiceRequestDiagnosticCode;
    message: string;
}

export type ChoiceRequestAiDiagnosticStatus =
    | 'ok'
    | 'unsupported'
    | 'missing-policy'
    | 'invalid-request';

export interface ChoiceRequestAiDiagnostic {
    status: ChoiceRequestAiDiagnosticStatus;
    requestId: string;
    choiceKind: ChoiceRequestKind;
    sourceId?: string;
    policyId?: string;
    reason: string;
    diagnostics?: ChoiceRequestDiagnostic[];
}

export interface ChoiceRequestDiagnosticSnapshot {
    requestId: string;
    choiceKind: ChoiceRequestKind;
    sourceId?: string;
    metadata?: AiActionMetadata;
    aiStatus: ChoiceRequestAiSupportStatus | 'missing';
    policyId?: string;
    aiDiagnosticStatus: ChoiceRequestAiDiagnosticStatus;
    aiDiagnosticReason: string;
    diagnostics: Array<{
        severity: ChoiceRequestDiagnosticSeverity;
        code: ChoiceRequestDiagnosticCode;
        message: string;
    }>;
    candidateSummary: {
        total: number;
        enabledCandidateIds: string[];
        disabledCandidateIds: string[];
        staleCandidateIds: string[];
    };
    recoveryActionId?: string;
    projectedLegalActionCount: number;
}

export interface ProjectChoiceRequestLegalActionsResult {
    actions: AiLegalAction[];
    diagnostics: ChoiceRequestDiagnostic[];
}

export interface DiagnoseChoiceRequestForAiOptions {
    registeredGamePolicyIds?: Iterable<string>;
    registeredSharedPolicyIds?: Iterable<string>;
}

const DEFAULT_MAX_GENERATED_SELECTIONS = 500;
const DEFAULT_CHOICE_REQUEST_SHARED_AI_POLICY_ID_SET = new Set<string>(
    DEFAULT_CHOICE_REQUEST_SHARED_AI_POLICY_IDS,
);

function enabledCandidates<TValue>(request: ChoiceRequest<TValue>): ChoiceRequestCandidate<TValue>[] {
    return request.candidates.filter((candidate) => candidate.disabled !== true && candidate.stale !== true);
}

export function filterChoiceRequestForPlayer<TValue>(
    request: ChoiceRequest<TValue>,
    playerId: PlayerId,
): ChoiceRequest<TValue> {
    return {
        ...request,
        candidates: request.candidates.filter((candidate) => (
            !candidate.visibleToPlayerIds
            || candidate.visibleToPlayerIds.length === 0
            || candidate.visibleToPlayerIds.includes(playerId)
        )),
    };
}

function hasRecoveryAction(request: ChoiceRequest): boolean {
    return Array.isArray(request.recoveryAction?.commands) && request.recoveryAction.commands.length > 0;
}

export function resolveChoiceRequestSharedAiPolicyId<TValue>(
    request: ChoiceRequest<TValue>,
): string | undefined {
    if (request.ai?.status !== 'shared-policy') return undefined;
    if (request.ai.policyId) return request.ai.policyId;

    const skipPolicy = request.skipPolicy ?? 'forbidden';
    if (request.kind === 'pass') return CHOICE_REQUEST_SHARED_AI_POLICY_IDS.PASS;
    if (request.kind === 'confirm' || skipPolicy === 'confirm-current') {
        return CHOICE_REQUEST_SHARED_AI_POLICY_IDS.CONFIRM_CURRENT;
    }
    if (request.kind === 'optional-skip' || skipPolicy === 'required' || skipPolicy === 'cancel-only') {
        return CHOICE_REQUEST_SHARED_AI_POLICY_IDS.SKIP;
    }
    if (
        request.kind === 'select-player'
        || request.kind === 'select-card'
        || request.kind === 'select-object'
        || request.kind === 'select-zone'
        || request.kind === 'select-position'
        || request.kind === 'select-dice'
    ) {
        return CHOICE_REQUEST_SHARED_AI_POLICY_IDS.SIMPLE_TARGET;
    }
    if (request.selection.ordered === true) {
        return CHOICE_REQUEST_SHARED_AI_POLICY_IDS.ORDERED_SELECTION;
    }
    if (request.selection.min === 1 && request.selection.max === 1 && enabledCandidates(request).length === 1) {
        return CHOICE_REQUEST_SHARED_AI_POLICY_IDS.SINGLE_REQUIRED_CANDIDATE;
    }
    return CHOICE_REQUEST_SHARED_AI_POLICY_IDS.UNORDERED_SELECTION;
}

export function isChoiceRequestSharedAiPolicyRegistered(
    policyId: string | undefined,
    registeredSharedPolicyIds?: Iterable<string>,
): boolean {
    if (!policyId) return false;
    if (DEFAULT_CHOICE_REQUEST_SHARED_AI_POLICY_ID_SET.has(policyId)) return true;
    return new Set(registeredSharedPolicyIds ?? []).has(policyId);
}

function normalizeSelection(selection: ChoiceRequestSelectionBounds): AiSelectionBounds {
    return {
        min: selection.min,
        max: selection.max,
        ordered: selection.ordered === true,
        maxGeneratedSelections: selection.maxGeneratedSelections ?? DEFAULT_MAX_GENERATED_SELECTIONS,
    };
}

function toAiDecisionCandidate<TValue>(candidate: ChoiceRequestCandidate<TValue>): AiDecisionCandidate {
    return {
        id: candidate.id,
        label: candidate.label,
        disabled: candidate.disabled === true || candidate.stale === true,
        disabledReason: candidate.disabledReason,
        aiHints: candidate.aiHints,
        metadata: candidate.metadata,
        actionKeyParts: candidate.actionKeyParts,
    };
}

function buildRecoveryLegalAction<TValue>(request: ChoiceRequest<TValue>): AiLegalAction | null {
    if (!request.recoveryAction || request.recoveryAction.commands.length === 0) return null;
    return {
        actionId: createAiLegalActionId(
            'choice-request',
            request.requestId,
            request.recoveryAction.id ?? request.skipPolicy ?? 'recovery',
        ),
        kind: request.recoveryAction.kind ?? 'choice-request-recovery',
        label: request.recoveryAction.label,
        commands: request.recoveryAction.commands,
        metadata: {
            requestId: request.requestId,
            choiceKind: request.kind,
            sourceId: request.sourceId,
            recoveryAction: true,
            ...request.recoveryAction.metadata,
        },
    };
}

function buildSelectionCommands<TValue>(
    request: ChoiceRequest<TValue>,
    selection: ChoiceRequestCandidate<TValue>[],
): AiCommandSpec[] {
    switch (request.resolution.type) {
        case 'commands':
            return request.resolution.buildCommands(selection, request);
        case 'candidate-commands':
            return selection.flatMap((candidate) => candidate.commands ?? []);
        case 'interaction-response': {
            const interactionId = request.resolution.interactionId ?? request.requestId;
            const commandType = request.resolution.commandType ?? 'SYS_INTERACTION_RESPOND';
            const selectedIds = selection.map((candidate) => candidate.id);
            return [{
                type: commandType,
                payload: selectedIds.length === 1
                    ? { interactionId, optionId: selectedIds[0] }
                    : { interactionId, optionIds: selectedIds },
            }];
        }
        default:
            return [];
    }
}

function buildSelectionActionKind<TValue>(
    request: ChoiceRequest<TValue>,
    selection: ChoiceRequestCandidate<TValue>[],
): string {
    if (selection.length === 1 && selection[0].actionKind) {
        return selection[0].actionKind;
    }
    return `choice-${request.kind}`;
}

function buildSelectionLabel<TValue>(
    request: ChoiceRequest<TValue>,
    selection: ChoiceRequestCandidate<TValue>[],
): string {
    if (selection.length === 0) return request.kind;
    return selection.map((candidate) => candidate.label ?? candidate.id).join(', ');
}

function buildSelectionMetadata<TValue>(
    request: ChoiceRequest<TValue>,
    selection: ChoiceRequestCandidate<TValue>[],
): AiActionMetadata {
    const candidateMetadata = selection
        .map((candidate) => candidate.metadata)
        .filter((metadata): metadata is AiActionMetadata => !!metadata);
    return {
        requestId: request.requestId,
        choiceKind: request.kind,
        sourceId: request.sourceId,
        ...(request.metadata ?? {}),
        ...(candidateMetadata.length > 0 ? { candidateMetadata } : {}),
    };
}

function buildSelectionActionKeyParts<TValue>(
    selection: ChoiceRequestCandidate<TValue>[],
    selectionIndex: number,
): Array<string | number | undefined | null> {
    if (selection.length === 0) return ['empty', selectionIndex];
    return selection.flatMap((candidate) => candidate.actionKeyParts ?? [candidate.id]);
}

export function validateChoiceRequest<TValue>(request: ChoiceRequest<TValue>): ChoiceRequestDiagnostic[] {
    const diagnostics: ChoiceRequestDiagnostic[] = [];

    if (!request.requestId.trim()) {
        diagnostics.push({
            severity: 'error',
            code: 'missing-request-id',
            message: 'Choice Request 缺少稳定 requestId',
        });
    }
    if (!String(request.playerId ?? '').trim()) {
        diagnostics.push({
            severity: 'error',
            code: 'missing-player-id',
            message: 'Choice Request 缺少当前选择者 playerId',
        });
    }
    if (!request.ownerFrameId) {
        diagnostics.push({
            severity: 'warning',
            code: 'missing-owner-frame',
            message: 'Choice Request 未绑定 resolution frame；setup 或兼容入口可暂时允许，业务链路应补 ownerFrameId',
        });
    }
    if (request.selection.min < 0 || request.selection.max < request.selection.min) {
        diagnostics.push({
            severity: 'error',
            code: 'invalid-selection-bounds',
            message: 'Choice Request 的选择数量上下界无效',
        });
    }

    const seenCandidateIds = new Set<string>();
    for (const candidate of request.candidates) {
        if (seenCandidateIds.has(candidate.id)) {
            diagnostics.push({
                severity: 'error',
                code: 'duplicate-candidate-id',
                message: `Choice Request 存在重复候选 ID：${candidate.id}`,
            });
        }
        seenCandidateIds.add(candidate.id);

        if (candidate.stale === true) {
            diagnostics.push({
                severity: 'warning',
                code: 'stale-candidate',
                message: `候选 ${candidate.id} 已标记为过期，不会投影为 AI 可执行动作`,
            });
        }

        if (
            request.resolution.type === 'candidate-commands'
            && candidate.disabled !== true
            && candidate.stale !== true
            && (!candidate.commands || candidate.commands.length === 0)
        ) {
            diagnostics.push({
                severity: 'error',
                code: 'candidate-missing-command',
                message: `候选 ${candidate.id} 缺少最终命令`,
            });
        }
    }

    const min = Math.max(0, request.selection.min);
    const enabledCount = enabledCandidates(request).length;
    const skipPolicy = request.skipPolicy ?? 'forbidden';
    const canRecover = skipPolicy !== 'forbidden' && hasRecoveryAction(request);
    if (skipPolicy !== 'forbidden' && !hasRecoveryAction(request)) {
        diagnostics.push({
            severity: 'error',
            code: 'missing-recovery-action',
            message: 'Choice Request 声明可跳过/确认/取消，但缺少明确 recoveryAction 命令',
        });
    }
    if (min > enabledCount && !canRecover) {
        diagnostics.push({
            severity: 'error',
            code: 'mandatory-choice-unsatisfied',
            message: 'Choice Request 是必选步骤，但当前启用候选不足且没有显式恢复动作',
        });
    }

    return diagnostics;
}

export function diagnoseChoiceRequestForAi<TValue>(
    request: ChoiceRequest<TValue>,
    options: DiagnoseChoiceRequestForAiOptions = {},
): ChoiceRequestAiDiagnostic {
    const diagnostics = validateChoiceRequest(request).filter((diagnostic) => diagnostic.severity === 'error');
    if (diagnostics.length > 0) {
        return {
            status: 'invalid-request',
            requestId: request.requestId,
            choiceKind: request.kind,
            sourceId: request.sourceId,
            reason: diagnostics.map((diagnostic) => diagnostic.message).join('；'),
            diagnostics,
        };
    }

    if (request.ai?.status === 'unsupported') {
        return {
            status: 'unsupported',
            requestId: request.requestId,
            choiceKind: request.kind,
            sourceId: request.sourceId,
            reason: request.ai.reason ?? '该 Choice Request 明确声明不支持 AI',
        };
    }

    if (request.ai?.status === 'shared-policy') {
        const sharedPolicyId = resolveChoiceRequestSharedAiPolicyId(request);
        if (!isChoiceRequestSharedAiPolicyRegistered(sharedPolicyId, options.registeredSharedPolicyIds)) {
            return {
                status: 'missing-policy',
                requestId: request.requestId,
                choiceKind: request.kind,
                sourceId: request.sourceId,
                policyId: sharedPolicyId,
                reason: sharedPolicyId
                    ? 'Choice Request 声明共享 AI 策略，但该共享策略未注册'
                    : 'Choice Request 声明共享 AI 策略，但缺少可识别的共享策略 ID',
            };
        }
        return {
            status: 'ok',
            requestId: request.requestId,
            choiceKind: request.kind,
            sourceId: request.sourceId,
            policyId: sharedPolicyId,
            reason: 'Choice Request 使用共享 AI 策略',
        };
    }

    const registeredPolicies = new Set(options.registeredGamePolicyIds ?? []);
    if (request.ai?.status === 'game-policy' && request.ai.policyId && registeredPolicies.has(request.ai.policyId)) {
        return {
            status: 'ok',
            requestId: request.requestId,
            choiceKind: request.kind,
            sourceId: request.sourceId,
            policyId: request.ai.policyId,
            reason: 'Choice Request 使用已注册游戏 AI 策略',
        };
    }

    return {
        status: 'missing-policy',
        requestId: request.requestId,
        choiceKind: request.kind,
        sourceId: request.sourceId,
        policyId: request.ai?.policyId,
        reason: request.ai?.status === 'game-policy'
            ? 'Choice Request 声明需要游戏 AI 策略，但该策略未注册'
            : 'Choice Request 可以阻塞 AI 座位，但没有声明共享策略、游戏策略或 unsupported',
    };
}

export function projectChoiceRequestToAiLegalActions<TValue>(
    request: ChoiceRequest<TValue>,
): ProjectChoiceRequestLegalActionsResult {
    const diagnostics = validateChoiceRequest(request);
    if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
        return { actions: [], diagnostics };
    }

    const actions: AiLegalAction[] = [];
    const skipPolicy = request.skipPolicy ?? 'forbidden';
    const recoveryAction = buildRecoveryLegalAction(request);

    if (skipPolicy === 'required' || skipPolicy === 'confirm-current' || skipPolicy === 'cancel-only') {
        return { actions: recoveryAction ? [recoveryAction] : [], diagnostics };
    }

    const candidateById = new Map(request.candidates.map((candidate) => [candidate.id, candidate] as const));
    const aiCandidates = request.candidates.map(toAiDecisionCandidate);
    const selections = enumerateAiDecisionSelections(aiCandidates, normalizeSelection(request.selection));
    for (const [selectionIndex, aiSelection] of selections.entries()) {
        const selection = aiSelection
            .map((candidate) => candidateById.get(candidate.id))
            .filter((candidate): candidate is ChoiceRequestCandidate<TValue> => !!candidate);
        const commands = buildSelectionCommands(request, selection);
        if (commands.length === 0) continue;
        actions.push({
            actionId: createAiLegalActionId(
                'choice-request',
                request.requestId,
                request.kind,
                ...buildSelectionActionKeyParts(selection, selectionIndex),
            ),
            kind: buildSelectionActionKind(request, selection),
            label: buildSelectionLabel(request, selection),
            commands,
            aiHints: selection.flatMap((candidate) => candidate.aiHints ?? []),
            metadata: buildSelectionMetadata(request, selection),
        });
    }

    if (skipPolicy === 'optional' && recoveryAction) {
        actions.push(recoveryAction);
    }

    return { actions, diagnostics };
}

export function buildChoiceRequestDiagnosticSnapshot<TValue>(
    request: ChoiceRequest<TValue>,
    options: DiagnoseChoiceRequestForAiOptions = {},
): ChoiceRequestDiagnosticSnapshot {
    const diagnostics = validateChoiceRequest(request);
    const aiDiagnostic = diagnoseChoiceRequestForAi(request, options);
    const legalActionProjection = projectChoiceRequestToAiLegalActions(request);
    const enabled = enabledCandidates(request);
    const disabled = request.candidates.filter((candidate) => candidate.disabled === true);
    const stale = request.candidates.filter((candidate) => candidate.stale === true);

    return {
        requestId: request.requestId,
        choiceKind: request.kind,
        sourceId: request.sourceId,
        metadata: request.metadata,
        aiStatus: request.ai?.status ?? 'missing',
        policyId: aiDiagnostic.policyId ?? request.ai?.policyId,
        aiDiagnosticStatus: aiDiagnostic.status,
        aiDiagnosticReason: aiDiagnostic.reason,
        diagnostics: diagnostics.map((diagnostic) => ({
            severity: diagnostic.severity,
            code: diagnostic.code,
            message: diagnostic.message,
        })),
        candidateSummary: {
            total: request.candidates.length,
            enabledCandidateIds: enabled.map((candidate) => candidate.id),
            disabledCandidateIds: disabled.map((candidate) => candidate.id),
            staleCandidateIds: stale.map((candidate) => candidate.id),
        },
        ...(request.recoveryAction ? { recoveryActionId: request.recoveryAction.id ?? request.skipPolicy } : {}),
        projectedLegalActionCount: legalActionProjection.actions.length,
    };
}
