type PromptLikeOption = {
    id: string;
    disabled?: boolean;
    value?: unknown;
};

export type FieldPromptObjectType = 'minion' | 'base' | 'ongoing' | 'action' | 'titan' | 'card' | 'player';

type FieldSourceTargetPromptOptionValue = {
    fieldInteractionType?: unknown;
    fieldSourceType?: unknown;
    fieldTargetType?: unknown;
    sourceUid?: unknown;
    sourceBaseIndex?: unknown;
    targetUid?: unknown;
    targetBaseIndex?: unknown;
    targetMinionUid?: unknown;
    minionUid?: unknown;
    baseIndex?: unknown;
    fromBaseIndex?: unknown;
};

type FieldSourceActionPromptOptionValue = {
    fieldInteractionType?: unknown;
    fieldSourceType?: unknown;
    sourceUid?: unknown;
    sourceBaseIndex?: unknown;
    fromBaseIndex?: unknown;
};

export type FieldSourceTargetParsedValue = {
    sourceType: FieldPromptObjectType;
    targetType: FieldPromptObjectType;
    sourceUid: string;
    sourceBaseIndex?: number;
    targetUid?: string;
    targetBaseIndex?: number;
    targetMinionUid?: string;
};

export type FieldSourceActionParsedValue = {
    sourceType: FieldPromptObjectType;
    sourceUid: string;
    sourceBaseIndex?: number;
};

export type FieldSourceTargetEntry = {
    sourceUid: string;
    sourceType: FieldPromptObjectType;
    sourceBaseIndex?: number;
    targetTypes: Set<FieldPromptObjectType>;
    targetOptionIdsByBaseIndex: Map<number, string>;
    targetOptionIdsByMinionUid: Map<string, string>;
};

export type FieldSourceActionEntry = {
    sourceUid: string;
    sourceType: FieldPromptObjectType;
    sourceBaseIndex?: number;
    optionId: string;
};

export type FieldSourceTargetPromptModel = {
    sourceUidsByType: Map<FieldPromptObjectType, Set<string>>;
    sourceMinionUids: Set<string>;
    sourceOngoingUids: Set<string>;
    sourceTitanUids: Set<string>;
    sourceTargetOptions: Map<string, FieldSourceTargetEntry>;
};

export type FieldSourceActionPromptModel = {
    sourceUidsByType: Map<FieldPromptObjectType, Set<string>>;
    sourceMinionUids: Set<string>;
    sourceOngoingUids: Set<string>;
    sourceTitanUids: Set<string>;
    sourceActionOptions: Map<string, FieldSourceActionEntry>;
    sourceOptionIdsByUid: Map<string, string>;
};

export type FieldSourceTargetSelectionState = {
    isReady: boolean;
    selectedEntry?: FieldSourceTargetEntry;
    targetOptionIdsByBaseIndex: Map<number, string>;
    targetOptionIdsByMinionUid: Map<string, string>;
    selectableMinionUids?: Set<string>;
    selectableOngoingUids?: Set<string>;
    selectableTitanUids?: Set<string>;
};

export function readFieldSourceTargetValue(value: unknown): FieldSourceTargetParsedValue | null {
    const candidate = value as FieldSourceTargetPromptOptionValue | undefined;
    if (!candidate) return null;

    if (
        candidate.fieldInteractionType === 'source-target'
        && typeof candidate.fieldSourceType === 'string'
        && typeof candidate.fieldTargetType === 'string'
        && typeof candidate.sourceUid === 'string'
    ) {
        const targetBaseIndex = typeof candidate.targetBaseIndex === 'number' && candidate.targetBaseIndex >= 0
            ? candidate.targetBaseIndex
            : undefined;
        const targetMinionUid = typeof candidate.targetMinionUid === 'string'
            ? candidate.targetMinionUid
            : candidate.fieldTargetType === 'minion' && typeof candidate.targetUid === 'string'
                ? candidate.targetUid
                : undefined;
        if (candidate.fieldTargetType === 'base' && targetBaseIndex === undefined) return null;
        if (candidate.fieldTargetType === 'minion' && !targetMinionUid) return null;
        return {
            sourceType: candidate.fieldSourceType as FieldPromptObjectType,
            targetType: candidate.fieldTargetType as FieldPromptObjectType,
            sourceUid: candidate.sourceUid,
            targetUid: typeof candidate.targetUid === 'string' ? candidate.targetUid : targetMinionUid,
            targetBaseIndex,
            targetMinionUid,
            sourceBaseIndex: typeof candidate.sourceBaseIndex === 'number'
                ? candidate.sourceBaseIndex
                : typeof candidate.fromBaseIndex === 'number'
                    ? candidate.fromBaseIndex
                    : undefined,
        };
    }

    return null;
}

export function isFieldSourceTargetValue(value: unknown): boolean {
    return readFieldSourceTargetValue(value) !== null;
}

export function readFieldSourceActionValue(value: unknown): FieldSourceActionParsedValue | null {
    const candidate = value as FieldSourceActionPromptOptionValue | undefined;
    if (!candidate) return null;

    if (
        candidate.fieldInteractionType === 'source-action'
        && typeof candidate.fieldSourceType === 'string'
        && typeof candidate.sourceUid === 'string'
    ) {
        return {
            sourceType: candidate.fieldSourceType as FieldPromptObjectType,
            sourceUid: candidate.sourceUid,
            sourceBaseIndex: typeof candidate.sourceBaseIndex === 'number'
                ? candidate.sourceBaseIndex
                : typeof candidate.fromBaseIndex === 'number'
                    ? candidate.fromBaseIndex
                    : undefined,
        };
    }

    return null;
}

export function isFieldSourceActionValue(value: unknown): boolean {
    return readFieldSourceActionValue(value) !== null;
}

export function buildFieldSourceTargetPromptModel(params: {
    isCurrentPromptForPlayer: boolean;
    targetType: unknown;
    options?: readonly PromptLikeOption[];
}): FieldSourceTargetPromptModel | null {
    if (!params.isCurrentPromptForPlayer) return null;
    if (params.targetType !== 'field-source-target') return null;

    const sourceTargetOptions = new Map<string, FieldSourceTargetEntry>();
    const sourceUidsByType = new Map<FieldPromptObjectType, Set<string>>();

    for (const opt of params.options ?? []) {
        if (opt.disabled) continue;
        const parsed = readFieldSourceTargetValue(opt.value);
        if (!parsed) continue;
        if (parsed.sourceType !== 'minion' && parsed.sourceType !== 'ongoing' && parsed.sourceType !== 'action' && parsed.sourceType !== 'titan') continue;
        if (parsed.targetType !== 'base' && parsed.targetType !== 'minion') continue;
        if (parsed.targetType === 'base' && parsed.targetBaseIndex === undefined) continue;
        if (parsed.targetType === 'minion' && !parsed.targetMinionUid) continue;

        const sourceSet = sourceUidsByType.get(parsed.sourceType) ?? new Set<string>();
        sourceSet.add(parsed.sourceUid);
        sourceUidsByType.set(parsed.sourceType, sourceSet);

        const entry = sourceTargetOptions.get(parsed.sourceUid) ?? {
            sourceUid: parsed.sourceUid,
            sourceType: parsed.sourceType,
            sourceBaseIndex: parsed.sourceBaseIndex,
            targetTypes: new Set<FieldPromptObjectType>(),
            targetOptionIdsByBaseIndex: new Map<number, string>(),
            targetOptionIdsByMinionUid: new Map<string, string>(),
        };
        entry.targetTypes.add(parsed.targetType);
        if (parsed.targetType === 'base' && parsed.targetBaseIndex !== undefined) {
            entry.targetOptionIdsByBaseIndex.set(parsed.targetBaseIndex, opt.id);
        }
        if (parsed.targetType === 'minion' && parsed.targetMinionUid) {
            entry.targetOptionIdsByMinionUid.set(parsed.targetMinionUid, opt.id);
        }
        sourceTargetOptions.set(parsed.sourceUid, entry);
    }

    if (sourceTargetOptions.size === 0) return null;

    return {
        sourceUidsByType,
        sourceMinionUids: sourceUidsByType.get('minion') ?? new Set<string>(),
        sourceOngoingUids: new Set<string>([
            ...(sourceUidsByType.get('ongoing') ?? new Set<string>()),
            ...(sourceUidsByType.get('action') ?? new Set<string>()),
        ]),
        sourceTitanUids: sourceUidsByType.get('titan') ?? new Set<string>(),
        sourceTargetOptions,
    };
}

export function buildFieldSourceActionPromptModel(params: {
    isCurrentPromptForPlayer: boolean;
    targetType: unknown;
    options?: readonly PromptLikeOption[];
}): FieldSourceActionPromptModel | null {
    if (!params.isCurrentPromptForPlayer) return null;
    if (params.targetType !== 'field-source-action') return null;

    const sourceActionOptions = new Map<string, FieldSourceActionEntry>();
    const sourceOptionIdsByUid = new Map<string, string>();
    const sourceUidsByType = new Map<FieldPromptObjectType, Set<string>>();

    for (const opt of params.options ?? []) {
        if (opt.disabled) continue;
        const parsed = readFieldSourceActionValue(opt.value);
        if (!parsed) continue;
        if (parsed.sourceType !== 'minion' && parsed.sourceType !== 'ongoing' && parsed.sourceType !== 'action' && parsed.sourceType !== 'titan') continue;

        const sourceSet = sourceUidsByType.get(parsed.sourceType) ?? new Set<string>();
        sourceSet.add(parsed.sourceUid);
        sourceUidsByType.set(parsed.sourceType, sourceSet);

        const entry = {
            sourceUid: parsed.sourceUid,
            sourceType: parsed.sourceType,
            sourceBaseIndex: parsed.sourceBaseIndex,
            optionId: opt.id,
        };
        sourceActionOptions.set(parsed.sourceUid, entry);
        sourceOptionIdsByUid.set(parsed.sourceUid, opt.id);
    }

    if (sourceActionOptions.size === 0) return null;

    return {
        sourceUidsByType,
        sourceMinionUids: sourceUidsByType.get('minion') ?? new Set<string>(),
        sourceOngoingUids: new Set<string>([
            ...(sourceUidsByType.get('ongoing') ?? new Set<string>()),
            ...(sourceUidsByType.get('action') ?? new Set<string>()),
        ]),
        sourceTitanUids: sourceUidsByType.get('titan') ?? new Set<string>(),
        sourceActionOptions,
        sourceOptionIdsByUid,
    };
}

export function resolveFieldSourceTargetSelectionState(
    model: FieldSourceTargetPromptModel | null,
    selectedSourceUid: string | null,
): FieldSourceTargetSelectionState {
    const isReady = !!model
        && selectedSourceUid !== null
        && model.sourceTargetOptions.has(selectedSourceUid);
    const selectedEntry = model && selectedSourceUid
        ? model.sourceTargetOptions.get(selectedSourceUid)
        : undefined;
    const targetOptionIdsByBaseIndex = selectedEntry?.targetOptionIdsByBaseIndex ?? new Map<number, string>();
    const targetOptionIdsByMinionUid = selectedEntry?.targetOptionIdsByMinionUid ?? new Map<string, string>();

    if (!model) {
        return {
            isReady,
            selectedEntry,
            targetOptionIdsByBaseIndex,
            targetOptionIdsByMinionUid,
        };
    }

    if (!isReady || !selectedSourceUid) {
        return {
            isReady,
            selectedEntry,
            targetOptionIdsByBaseIndex,
            targetOptionIdsByMinionUid,
            selectableMinionUids: model.sourceMinionUids,
            selectableOngoingUids: model.sourceOngoingUids,
            selectableTitanUids: model.sourceTitanUids,
        };
    }

    const selectableMinionUids = new Set<string>();
    if (selectedEntry?.sourceType === 'minion') selectableMinionUids.add(selectedSourceUid);
    for (const minionUid of targetOptionIdsByMinionUid.keys()) {
        selectableMinionUids.add(minionUid);
    }

    const selectableOngoingUids =
        selectedEntry?.sourceType === 'ongoing' || selectedEntry?.sourceType === 'action'
            ? new Set<string>([selectedSourceUid])
            : new Set<string>();
    const selectableTitanUids = selectedEntry?.sourceType === 'titan'
        ? new Set<string>([selectedSourceUid])
        : new Set<string>();

    return {
        isReady,
        selectedEntry,
        targetOptionIdsByBaseIndex,
        targetOptionIdsByMinionUid,
        selectableMinionUids,
        selectableOngoingUids,
        selectableTitanUids,
    };
}
