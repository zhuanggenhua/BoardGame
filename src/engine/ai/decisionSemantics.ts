import type { PlayerId } from '../types';
import { createAiLegalActionId } from './context';
import type { AiActionMetadata, AiCommandSpec, AiHint, AiLegalAction } from './types';

export type AiDecisionKind =
    | 'select-player'
    | 'select-card'
    | 'select-object'
    | 'select-dice'
    | 'modify-value'
    | 'choose-option'
    | 'confirm'
    | 'optional-skip';

export type AiInteractionSupportStatus = 'semantic' | 'adapter' | 'unsupported';

export interface AiInteractionSupportDeclaration {
    status: AiInteractionSupportStatus;
    /**
     * 现实含义：这个交互的 AI 支持路径说明。
     * 例如 semantic 表示交互自身暴露 AI 决策语义，adapter 表示游戏 AI 运行时有专用适配器，
     * unsupported 表示该交互明确不支持 AI。
     */
    reason?: string;
    adapterId?: string;
    decisions?: AiDecisionDescriptor[];
}

export interface AiSelectionBounds {
    min: number;
    max: number;
    ordered?: boolean;
    maxGeneratedSelections?: number;
}

export type AiDecisionSkipPolicy = 'forbidden' | 'optional' | 'required';

export interface AiDecisionCandidate {
    id: string;
    label?: string;
    disabled?: boolean;
    disabledReason?: string;
    aiHints?: AiHint[];
    metadata?: AiActionMetadata;
    actionKeyParts?: Array<string | number | undefined | null>;
}

export interface AiSelectPlayerDecisionCandidate extends AiDecisionCandidate {
    playerId: PlayerId;
}

export interface AiSelectCardDecisionCandidate extends AiDecisionCandidate {
    cardId: string;
    zoneId?: string;
    ownerId?: PlayerId;
}

export interface AiSelectObjectDecisionCandidate extends AiDecisionCandidate {
    objectId: string;
    objectKind?: string;
    ownerId?: PlayerId;
}

export interface AiSelectDiceDecisionCandidate extends AiDecisionCandidate {
    dieId: string | number;
    ownerId?: PlayerId;
}

export interface AiChooseOptionDecisionCandidate extends AiDecisionCandidate {
    value?: unknown;
}

export interface AiBaseDecisionDescriptor<TKind extends AiDecisionKind, TCandidate extends AiDecisionCandidate> {
    kind: TKind;
    interactionId: string;
    actorPlayerId: PlayerId;
    sourceId?: string;
    candidates: TCandidate[];
    selection: AiSelectionBounds;
    skipPolicy?: AiDecisionSkipPolicy;
    metadata?: AiActionMetadata;
}

export type AiSelectPlayerDecisionDescriptor =
    AiBaseDecisionDescriptor<'select-player', AiSelectPlayerDecisionCandidate>;

export type AiSelectCardDecisionDescriptor =
    AiBaseDecisionDescriptor<'select-card', AiSelectCardDecisionCandidate>;

export type AiSelectObjectDecisionDescriptor =
    AiBaseDecisionDescriptor<'select-object', AiSelectObjectDecisionCandidate>;

export type AiSelectDiceDecisionDescriptor =
    AiBaseDecisionDescriptor<'select-dice', AiSelectDiceDecisionCandidate>;

export type AiChooseOptionDecisionDescriptor =
    AiBaseDecisionDescriptor<'choose-option', AiChooseOptionDecisionCandidate>;

export interface AiModifyValueDecisionDescriptor extends AiBaseDecisionDescriptor<'modify-value', AiChooseOptionDecisionCandidate> {
    minValue?: number;
    maxValue?: number;
    step?: number;
    defaultValue?: number;
}

export interface AiConfirmDecisionDescriptor extends AiBaseDecisionDescriptor<'confirm', AiChooseOptionDecisionCandidate> {
    commands: AiCommandSpec[];
}

export interface AiOptionalSkipDecisionDescriptor extends AiBaseDecisionDescriptor<'optional-skip', AiChooseOptionDecisionCandidate> {
    commands: AiCommandSpec[];
}

export type AiDecisionDescriptor =
    | AiSelectPlayerDecisionDescriptor
    | AiSelectCardDecisionDescriptor
    | AiSelectObjectDecisionDescriptor
    | AiSelectDiceDecisionDescriptor
    | AiChooseOptionDecisionDescriptor
    | AiModifyValueDecisionDescriptor
    | AiConfirmDecisionDescriptor
    | AiOptionalSkipDecisionDescriptor;

type AiInteractionRespondDecisionDescriptor = Exclude<
    AiDecisionDescriptor,
    AiConfirmDecisionDescriptor | AiOptionalSkipDecisionDescriptor
>;

export interface BuildAiDecisionActionsOptions<
    TCandidate extends AiDecisionCandidate,
    TDescriptor extends AiBaseDecisionDescriptor<AiDecisionKind, TCandidate>,
> {
    descriptor: TDescriptor;
    defaultActionKind?: string;
    emptyAction?: (descriptor: TDescriptor) => AiLegalAction | null;
    buildCommands: (selection: TCandidate[], descriptor: TDescriptor) => AiCommandSpec[];
    buildActionKeyParts?: (selection: TCandidate[], descriptor: TDescriptor, selectionIndex: number) => Array<string | number | undefined | null>;
    buildActionKind?: (selection: TCandidate[], descriptor: TDescriptor) => string | undefined;
    buildLabel?: (selection: TCandidate[], descriptor: TDescriptor) => string | undefined;
    buildMetadata?: (selection: TCandidate[], descriptor: TDescriptor) => AiActionMetadata | undefined;
    buildAiHints?: (selection: TCandidate[], descriptor: TDescriptor) => AiHint[] | undefined;
}

const DEFAULT_MAX_GENERATED_SELECTIONS = 500;

const normalizeSelectionBounds = (
    bounds: AiSelectionBounds,
    candidateCount: number,
): AiSelectionBounds => {
    const min = Math.max(0, Math.min(bounds.min, candidateCount));
    const max = Math.max(min, Math.min(bounds.max, candidateCount));
    return {
        min,
        max,
        ordered: bounds.ordered === true,
        maxGeneratedSelections: bounds.maxGeneratedSelections ?? DEFAULT_MAX_GENERATED_SELECTIONS,
    };
};

const enumerateUnorderedSelections = <T>(
    candidates: T[],
    min: number,
    max: number,
    limit: number,
): T[][] => {
    const results: T[][] = [];
    const path: T[] = [];

    const dfs = (startIndex: number) => {
        if (results.length >= limit) return;
        if (path.length >= min && path.length <= max) {
            results.push([...path]);
        }
        if (path.length === max) return;

        for (let index = startIndex; index < candidates.length; index += 1) {
            path.push(candidates[index]);
            dfs(index + 1);
            path.pop();
            if (results.length >= limit) return;
        }
    };

    dfs(0);
    return results;
};

const enumerateOrderedSelections = <T>(
    candidates: T[],
    min: number,
    max: number,
    limit: number,
): T[][] => {
    const results: T[][] = [];
    const path: T[] = [];
    const used = new Set<number>();

    const dfs = () => {
        if (results.length >= limit) return;
        if (path.length >= min && path.length <= max) {
            results.push([...path]);
        }
        if (path.length === max) return;

        for (let index = 0; index < candidates.length; index += 1) {
            if (used.has(index)) continue;
            used.add(index);
            path.push(candidates[index]);
            dfs();
            path.pop();
            used.delete(index);
            if (results.length >= limit) return;
        }
    };

    dfs();
    return results;
};

export function enumerateAiDecisionSelections<TCandidate extends AiDecisionCandidate>(
    candidates: TCandidate[],
    bounds: AiSelectionBounds,
): TCandidate[][] {
    const availableCandidates = candidates.filter((candidate) => candidate.disabled !== true);
    if (bounds.min > availableCandidates.length) return [];
    const normalizedBounds = normalizeSelectionBounds(bounds, availableCandidates.length);
    const limit = Math.max(0, normalizedBounds.maxGeneratedSelections ?? DEFAULT_MAX_GENERATED_SELECTIONS);
    if (normalizedBounds.min > normalizedBounds.max || limit === 0) return [];
    if (normalizedBounds.max === 0) return [[]];

    return normalizedBounds.ordered
        ? enumerateOrderedSelections(availableCandidates, normalizedBounds.min, normalizedBounds.max, limit)
        : enumerateUnorderedSelections(availableCandidates, normalizedBounds.min, normalizedBounds.max, limit);
}

const defaultSelectionLabel = <TCandidate extends AiDecisionCandidate>(
    selection: TCandidate[],
    descriptor: AiBaseDecisionDescriptor<AiDecisionKind, TCandidate>,
): string => {
    if (selection.length === 0) return descriptor.kind;
    return selection.map((candidate) => candidate.label ?? candidate.id).join(', ');
};

const defaultSelectionKeyParts = <TCandidate extends AiDecisionCandidate>(
    selection: TCandidate[],
    selectionIndex: number,
): Array<string | number | undefined | null> => {
    if (selection.length === 0) return ['empty', selectionIndex];
    return selection.flatMap((candidate) => candidate.actionKeyParts ?? [candidate.id]);
};

const mergeSelectionHints = <TCandidate extends AiDecisionCandidate>(selection: TCandidate[]): AiHint[] => (
    selection.flatMap((candidate) => candidate.aiHints ?? [])
);

const mergeSelectionMetadata = <TCandidate extends AiDecisionCandidate>(
    selection: TCandidate[],
): AiActionMetadata | undefined => {
    const metadataEntries = selection
        .map((candidate) => candidate.metadata)
        .filter((metadata): metadata is AiActionMetadata => !!metadata);
    if (metadataEntries.length === 0) return undefined;
    return { candidateMetadata: metadataEntries };
};

export function buildAiLegalActionsFromDecision<
    TCandidate extends AiDecisionCandidate,
    TDescriptor extends AiBaseDecisionDescriptor<AiDecisionKind, TCandidate>,
>(options: BuildAiDecisionActionsOptions<TCandidate, TDescriptor>): AiLegalAction[] {
    const selections = enumerateAiDecisionSelections(options.descriptor.candidates, options.descriptor.selection);
    if (selections.length === 0) {
        const emptyAction = options.emptyAction?.(options.descriptor);
        return emptyAction ? [emptyAction] : [];
    }

    return selections
        .map((selection, selectionIndex): AiLegalAction | null => {
            const commands = options.buildCommands(selection, options.descriptor);
            if (commands.length === 0) return null;
            const actionKind = options.buildActionKind?.(selection, options.descriptor)
                ?? options.defaultActionKind
                ?? 'interaction-choice';
            const keyParts = options.buildActionKeyParts?.(selection, options.descriptor, selectionIndex)
                ?? defaultSelectionKeyParts(selection, selectionIndex);
            const aiHints = options.buildAiHints?.(selection, options.descriptor)
                ?? mergeSelectionHints(selection);
            const metadata = options.buildMetadata?.(selection, options.descriptor)
                ?? mergeSelectionMetadata(selection);

            return {
                actionId: createAiLegalActionId('interaction', options.descriptor.interactionId, options.descriptor.kind, ...keyParts),
                kind: actionKind,
                label: options.buildLabel?.(selection, options.descriptor)
                    ?? defaultSelectionLabel(selection, options.descriptor),
                commands,
                ...(aiHints.length > 0 ? { aiHints } : {}),
                ...(metadata ? { metadata } : {}),
            };
        })
        .filter((action): action is AiLegalAction => action !== null);
}

export function buildSelectPlayerDecisionActions(
    options: Omit<
        BuildAiDecisionActionsOptions<AiSelectPlayerDecisionCandidate, AiSelectPlayerDecisionDescriptor>,
        'defaultActionKind'
    > & {
        defaultActionKind?: string;
    },
): AiLegalAction[] {
    return buildAiLegalActionsFromDecision({
        defaultActionKind: 'interaction-select-player',
        ...options,
    });
}

const buildInteractionRespondPayload = (
    descriptor: AiBaseDecisionDescriptor<AiDecisionKind, AiDecisionCandidate>,
    selection: AiDecisionCandidate[],
): Record<string, unknown> => {
    const selectedIds = selection.map((candidate) => candidate.id);
    if (selectedIds.length === 1) {
        return {
            interactionId: descriptor.interactionId,
            optionId: selectedIds[0],
        };
    }
    return {
        interactionId: descriptor.interactionId,
        optionIds: selectedIds,
    };
};

const buildDescriptorMetadata = (
    descriptor: AiBaseDecisionDescriptor<AiDecisionKind, AiDecisionCandidate>,
    selection: AiDecisionCandidate[],
): AiActionMetadata => ({
    interactionId: descriptor.interactionId,
    decisionKind: descriptor.kind,
    sourceId: descriptor.sourceId,
    ...(descriptor.metadata ?? {}),
    ...(mergeSelectionMetadata(selection) ?? {}),
});

function buildInteractionRespondDecisionActions(
    descriptor: AiInteractionRespondDecisionDescriptor,
): AiLegalAction[] {
    const baseDescriptor = descriptor as AiBaseDecisionDescriptor<AiDecisionKind, AiDecisionCandidate>;
    return buildAiLegalActionsFromDecision({
        descriptor: baseDescriptor,
        defaultActionKind: 'interaction-choice',
        buildCommands: (selection, currentDescriptor) => [{
            type: 'SYS_INTERACTION_RESPOND',
            payload: buildInteractionRespondPayload(currentDescriptor, selection),
        }],
        buildMetadata: (selection, currentDescriptor) => buildDescriptorMetadata(currentDescriptor, selection),
    });
}

const buildCommandOnlyDecisionAction = (
    descriptor: AiConfirmDecisionDescriptor | AiOptionalSkipDecisionDescriptor,
): AiLegalAction[] => {
    if (descriptor.commands.length === 0) return [];
    return [{
        actionId: createAiLegalActionId('interaction', descriptor.interactionId, descriptor.kind, 'command'),
        kind: descriptor.kind === 'confirm' ? 'interaction-confirm' : 'interaction-skip',
        label: descriptor.candidates[0]?.label ?? (descriptor.kind === 'confirm' ? '确认' : '跳过'),
        commands: descriptor.commands,
        metadata: {
            interactionId: descriptor.interactionId,
            decisionKind: descriptor.kind,
            sourceId: descriptor.sourceId,
            ...(descriptor.metadata ?? {}),
        },
    }];
};

export function buildAiLegalActionsFromInteractionDecision(
    descriptor: AiDecisionDescriptor,
): AiLegalAction[] {
    if (descriptor.kind === 'confirm' || descriptor.kind === 'optional-skip') {
        return buildCommandOnlyDecisionAction(descriptor);
    }
    return buildInteractionRespondDecisionActions(descriptor);
}
