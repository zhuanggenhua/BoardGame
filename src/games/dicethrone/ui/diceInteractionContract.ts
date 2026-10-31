import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import type { MultistepInteractionState } from '../../../engine/systems/useMultistepInteraction';
import type { DieModifyConfig } from '../domain/core-types';
import type { PlayerId } from '../../../engine/types';
import type { DiceModifyResult, DiceSelectResult } from '../domain/diceInteraction';
import type { InteractionHint, InteractionPresentationContract } from './interactionPresentationContract';

export type DiceSelectionMode = 'reroll' | 'bonusGroupReroll' | 'choice';

export type DiceInteractionMeta = {
    selectCount: number;
    diceOwnerId?: PlayerId;
    targetOpponentDice: boolean;
} & (
    | { dtType: 'modifyDie'; dieModifyConfig: DieModifyConfig }
    | {
        dtType: 'selectDie';
        selectionMode: DiceSelectionMode;
        allowRepeatedDieSelection?: boolean;
    }
);

export type DiceInteractionHintSurface = 'game-hints' | 'dice-tray' | 'response-window';

export type DiceInteractionHint = InteractionHint & {
    /** 普通骰子交互沿用 GameHints；效果骰整组重掷提示贴其骰盘。 */
    surface: DiceInteractionHintSurface;
    /** 保留操作语义与下一步，不能在达到额度时退化为孤立的“完成”。 */
    detail?: InteractionHint;
};

type DiceInteractionHintText = Omit<DiceInteractionHint, 'surface'>;

export type DiceInteractionAction = {
    kind: 'cancel' | 'submitSelection' | 'confirmInteraction' | 'confirmSettlement' | 'confirmTokenResponse';
    labelKey: string;
    buttonTestId?: string;
    tutorialId?: string;
    ariaLabelKey?: string;
    ariaLabelParams?: Record<string, string | number>;
};

/**
 * UI-facing projection of a dice interaction. DiceTray, its action buttons, and
 * the hint all read candidates, progress, result, and action roles from here.
 */
type DiceInteractionContractBase = Omit<InteractionPresentationContract<'multistep' | 'bonusSettlement' | 'tokenResponseSettlement'>, 'hint'> & {
    hint: DiceInteractionHint;
    interactionId?: string;
    allowedDieIds?: number[];
    completedDieIds: number[];
    completedCount: number;
    result: DiceModifyResult | DiceSelectResult | null;
    actions: {
        left?: DiceInteractionAction;
        right: DiceInteractionAction;
    };
};

export type DiceMultistepInteractionContract = DiceInteractionContractBase & {
    kind: 'multistep';
    meta: DiceInteractionMeta;
    controller: MultistepInteractionState<DiceModifyResult | DiceSelectResult>;
};

export type DiceBonusSettlementInteractionContract = DiceInteractionContractBase & {
    kind: 'bonusSettlement';
    meta?: never;
    controller?: never;
};

export type DiceTokenResponseSettlementContract = DiceInteractionContractBase & {
    kind: 'tokenResponseSettlement';
    responseKind: 'token';
    meta?: never;
    controller?: never;
};

export type DiceInteractionContract = DiceMultistepInteractionContract
    | DiceBonusSettlementInteractionContract
    | DiceTokenResponseSettlementContract;

const isFiniteNumber = (value: unknown): value is number => (
    typeof value === 'number' && Number.isFinite(value)
);

const isNonNegativeInteger = (value: unknown): value is number => (
    isFiniteNumber(value) && Number.isInteger(value) && value >= 0
);

const isDieFaceValue = (value: unknown): value is number => (
    isFiniteNumber(value) && Number.isInteger(value) && value >= 1 && value <= 6
);

export type ParsedDiceInteraction =
    | { kind: 'none' }
    | { kind: 'invalid'; reason: string }
    | {
        kind: 'valid';
        meta: DiceInteractionMeta;
        allowedDieIds?: number[];
        completedDieIds: number[];
        completedCount: number;
    };

const isRecord = (value: unknown): value is Record<string, unknown> => (
    value !== null && typeof value === 'object' && !Array.isArray(value)
);

function parseIntegerList(value: unknown, allowDuplicates: boolean): number[] | undefined {
    if (!Array.isArray(value)) return undefined;
    if (
        value.some(id => !isFiniteNumber(id) || !Number.isInteger(id))
        || (!allowDuplicates && new Set(value).size !== value.length)
    ) return undefined;
    return value as number[];
}

function parseDieModifyConfig(value: unknown): DieModifyConfig | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const config = value as Record<string, unknown>;

    switch (config.mode) {
        case 'set': {
            const hasTargetValue = config.targetValue !== undefined;
            const hasAllowedValues = config.allowedValues !== undefined;
            if (hasTargetValue === hasAllowedValues) return undefined;
            if (isDieFaceValue(config.targetValue)) {
                return { mode: 'set', targetValue: config.targetValue };
            }
            if (
                Array.isArray(config.allowedValues)
                && config.allowedValues.length > 0
                && config.allowedValues.every(isDieFaceValue)
                && new Set(config.allowedValues).size === config.allowedValues.length
            ) {
                return { mode: 'set', allowedValues: config.allowedValues as [number, ...number[]] };
            }
            return undefined;
        }
        case 'adjust': {
            const range = config.adjustRange;
            if (
                !range
                || typeof range !== 'object'
                || !Number.isInteger((range as Record<string, unknown>).min)
                || !Number.isInteger((range as Record<string, unknown>).max)
                || !isFiniteNumber((range as Record<string, unknown>).min)
                || !isFiniteNumber((range as Record<string, unknown>).max)
                || (range as { min: number }).min > (range as { max: number }).max
            ) return undefined;
            return {
                mode: 'adjust',
                adjustRange: {
                    min: (range as { min: number }).min,
                    max: (range as { max: number }).max,
                },
            };
        }
        case 'copy': return { mode: 'copy' };
        case 'any': return { mode: 'any' };
        default: return undefined;
    }
}

function readInteractionProgress(
    data: Record<string, unknown>,
    meta: DiceInteractionMeta,
): Omit<Extract<ParsedDiceInteraction, { kind: 'valid' }>, 'kind' | 'meta'> | undefined {
    const minSteps = data.minSteps;
    const maxSteps = data.maxSteps;
    const rawCompletedSteps = data.completedSteps;
    const allowRepeatedDieSelection = meta.dtType === 'selectDie' && meta.allowRepeatedDieSelection === true;

    if (minSteps !== undefined && (!isNonNegativeInteger(minSteps) || minSteps > meta.selectCount)) return undefined;
    if (maxSteps !== undefined && (!isNonNegativeInteger(maxSteps) || maxSteps > meta.selectCount)) return undefined;
    if (minSteps !== undefined && maxSteps !== undefined && minSteps > maxSteps) return undefined;
    if (rawCompletedSteps !== undefined && (!isNonNegativeInteger(rawCompletedSteps) || rawCompletedSteps > meta.selectCount)) return undefined;

    const allowedDieIds = data.allowedDieIds === undefined
        ? undefined
        : parseIntegerList(data.allowedDieIds, false);
    if (data.allowedDieIds !== undefined && !allowedDieIds) return undefined;

    const parsedCompletedDieIds = data.completedDieIds === undefined
        ? []
        : parseIntegerList(data.completedDieIds, allowRepeatedDieSelection);
    if (data.completedDieIds !== undefined && !parsedCompletedDieIds) return undefined;
    const completedDieIds = parsedCompletedDieIds ?? [];

    if (Array.isArray(allowedDieIds) && completedDieIds.some(id => !allowedDieIds.includes(id))) return undefined;

    const completedIdsCount = allowRepeatedDieSelection ? completedDieIds.length : new Set(completedDieIds).size;
    if (rawCompletedSteps !== undefined && data.completedDieIds !== undefined && rawCompletedSteps !== completedIdsCount) return undefined;
    const completedCount = rawCompletedSteps ?? completedIdsCount;
    if (completedCount > meta.selectCount || (maxSteps !== undefined && completedCount > maxSteps)) return undefined;

    return { allowedDieIds, completedDieIds, completedCount };
}

function parseDiceInteraction(interaction?: InteractionDescriptor): ParsedDiceInteraction {
    if (interaction?.kind !== 'multistep-choice') return { kind: 'none' };
    const data = isRecord(interaction.data) ? interaction.data : {};
    const rawMetaValue = data.meta;
    const rawMeta = isRecord(rawMetaValue) ? rawMetaValue : undefined;
    if (rawMeta?.dtType === undefined) {
        const allowedDieIds = data.allowedDieIds === undefined ? undefined : parseIntegerList(data.allowedDieIds, false);
        if (data.allowedDieIds !== undefined && !allowedDieIds) return { kind: 'invalid', reason: 'Invalid allowed die candidates' };
        if (data.completedDieIds !== undefined && !parseIntegerList(data.completedDieIds, true)) {
            return { kind: 'invalid', reason: 'Invalid completed die history' };
        }
        return { kind: 'none' };
    }

    const selectCount = rawMeta.selectCount;
    if (!isNonNegativeInteger(selectCount) || selectCount < 1) return { kind: 'invalid', reason: 'Invalid dice interaction contract' };
    if (rawMeta.diceOwnerId !== undefined && (typeof rawMeta.diceOwnerId !== 'string' || rawMeta.diceOwnerId.length === 0)) {
        return { kind: 'invalid', reason: 'Invalid dice interaction contract' };
    }
    if (typeof rawMeta.targetOpponentDice !== 'boolean') return { kind: 'invalid', reason: 'Invalid dice interaction contract' };
    if (rawMeta.allowRepeatedDieSelection !== undefined && typeof rawMeta.allowRepeatedDieSelection !== 'boolean') {
        return { kind: 'invalid', reason: 'Invalid dice interaction contract' };
    }

    const diceOwnerId = typeof rawMeta.diceOwnerId === 'string' ? rawMeta.diceOwnerId : undefined;
    const targetOpponentDice = rawMeta.targetOpponentDice;
    let meta: DiceInteractionMeta;
    if (rawMeta.dtType === 'modifyDie') {
        if (rawMeta.allowRepeatedDieSelection === true) return { kind: 'invalid', reason: 'Invalid dice interaction contract' };
        const dieModifyConfig = parseDieModifyConfig(rawMeta.dieModifyConfig);
        if (!dieModifyConfig || (dieModifyConfig.mode === 'copy' && selectCount !== 2)) {
            return { kind: 'invalid', reason: 'Invalid dice interaction contract' };
        }
        meta = { dtType: 'modifyDie', dieModifyConfig, selectCount, diceOwnerId, targetOpponentDice };
    } else if (rawMeta.dtType === 'selectDie') {
        if (rawMeta.selectionMode !== 'reroll' && rawMeta.selectionMode !== 'bonusGroupReroll' && rawMeta.selectionMode !== 'choice') {
            return { kind: 'invalid', reason: 'Invalid dice interaction contract' };
        }
        if (rawMeta.selectionMode === 'bonusGroupReroll' && rawMeta.allowRepeatedDieSelection === true) {
            return { kind: 'invalid', reason: 'Invalid dice interaction contract' };
        }
        meta = {
            dtType: 'selectDie',
            selectionMode: rawMeta.selectionMode,
            allowRepeatedDieSelection: rawMeta.allowRepeatedDieSelection === true,
            selectCount,
            diceOwnerId,
            targetOpponentDice,
        };
    } else {
        return { kind: 'invalid', reason: 'Invalid dice interaction contract' };
    }

    const progress = readInteractionProgress(data, meta);
    if (!progress) return { kind: 'invalid', reason: 'Invalid dice interaction contract' };
    return { kind: 'valid', meta, ...progress };
}

export function getDiceInteractionMeta(interaction?: InteractionDescriptor): DiceInteractionMeta | undefined {
    const parsed = parseDiceInteraction(interaction);
    return parsed.kind === 'valid' ? parsed.meta : undefined;
}

export function parseDiceInteractionContract(interaction?: InteractionDescriptor): ParsedDiceInteraction {
    return parseDiceInteraction(interaction);
}

export function getCompletedDiceStepCount(interaction?: InteractionDescriptor, _meta?: DiceInteractionMeta): number {
    const parsed = parseDiceInteraction(interaction);
    return parsed.kind === 'valid' ? parsed.completedCount : 0;
}

function getSelectDieHint(input: {
    meta: Extract<DiceInteractionMeta, { dtType: 'selectDie' }>;
    interaction?: InteractionDescriptor;
    result: DiceSelectResult;
    completedCount: number;
    rootPlayerId: PlayerId;
    teamIdByPlayerId?: Record<PlayerId, string>;
}): DiceInteractionHintText {
    const { meta, result, completedCount } = input;
    if (meta.selectionMode === 'choice') {
        const data = isRecord(input.interaction?.data) ? input.interaction?.data : {};
        return {
            key: typeof data.titleKey === 'string' ? data.titleKey : 'interaction.hint_choose_dice',
            detail: {
                key: 'interaction.hint_choose_dice_detail',
                params: {
                    selected: result.selectedDiceIds.length,
                    remaining: Math.max(0, meta.selectCount - result.selectedDiceIds.length),
                    count: meta.selectCount,
                },
            },
        };
    }
    if (meta.selectionMode === 'bonusGroupReroll') {
        const selectedCount = result.selectedDiceIds.length;
        return {
            key: selectedCount ? 'interaction.hint_group_reroll_selected' : 'interaction.hint_group_reroll',
            params: { count: selectedCount },
        };
    }

    const count = completedCount + result.selectedDiceIds.length;
    const selected = result.selectedDiceIds.length;
    const remaining = meta.selectCount - count;
    let key = meta.targetOpponentDice ? 'interaction.hint_select_opponent' : 'interaction.hint_select';
    if (meta.diceOwnerId && meta.diceOwnerId !== input.rootPlayerId) {
        const ownerTeam = input.teamIdByPlayerId?.[meta.diceOwnerId];
        const rootTeam = input.teamIdByPlayerId?.[input.rootPlayerId];
        key = ownerTeam && ownerTeam === rootTeam ? 'interaction.hint_select_ally' : 'interaction.hint_select_opponent';
    }
    const ready = count >= meta.selectCount;
    const canFinish = completedCount > 0 && selected === 0;
    const detailKey = ready
        ? selected > 0 ? 'interaction.hint_reroll_ready_detail' : 'interaction.hint_reroll_done_detail'
        : canFinish
            ? meta.allowRepeatedDieSelection ? 'interaction.hint_reroll_continue_repeat_detail' : 'interaction.hint_reroll_continue_detail'
            : meta.allowRepeatedDieSelection ? 'interaction.hint_reroll_repeat_detail' : 'interaction.hint_reroll_detail';
    return {
        key: ready ? selected > 0 ? 'interaction.hint_reroll_ready' : 'interaction.hint_reroll_done' : key,
        params: { current: count, max: meta.selectCount },
        detail: { key: detailKey, params: { completed: completedCount, selected, remaining } },
    };
}

/** 提示、候选进度和提交共读同一个多步交互合同；每种骰子操作都必须产生提示。 */
function assertNever(value: never): never {
    throw new Error(`Unsupported DiceThrone interaction mode: ${String(value)}`);
}

export function getDiceInteractionHint(input: {
    meta: DiceInteractionMeta;
    interaction?: InteractionDescriptor;
    result?: DiceModifyResult | DiceSelectResult;
    completedCount?: number;
    rootPlayerId: PlayerId;
    teamIdByPlayerId?: Record<PlayerId, string>;
}): DiceInteractionHintText {
    const { meta } = input;
    const completedCount = input.completedCount ?? getCompletedDiceStepCount(input.interaction, meta);
    if (meta.dtType === 'selectDie') {
        return getSelectDieHint({
            meta,
            interaction: input.interaction,
            result: (input.result as DiceSelectResult | undefined) ?? { selectedDiceIds: [] },
            completedCount,
            rootPlayerId: input.rootPlayerId,
            teamIdByPlayerId: input.teamIdByPlayerId,
        });
    }

    const modify = input.result as DiceModifyResult | undefined;
    const count = completedCount + (modify?.modCount ?? 0);
    const done = count >= meta.selectCount;
    const config = meta.dieModifyConfig;
    switch (config.mode) {
        case 'set': {
            const value = config.targetValue ?? modify?.targetValue;
            return done ? { key: 'interaction.hint_done' }
                : value === undefined ? { key: 'interaction.hint_choose_value' }
                : { key: 'interaction.hint_set', params: { value } };
        }
        case 'copy': return count === 0 ? { key: 'interaction.hint_copy_step1' }
            : count === 1 ? { key: 'interaction.hint_copy_step2', params: { value: Object.values(modify?.modifications ?? {})[0] } }
            : { key: 'interaction.hint_done' };
        case 'adjust': return { key: 'interaction.hint_adjust' };
        case 'any': return { key: done ? 'interaction.hint_done' : 'interaction.hint_any' };
        default: return assertNever(config);
    }
}

export function createDiceInteractionContract(input: {
    interaction?: InteractionDescriptor;
    controller?: MultistepInteractionState<DiceModifyResult | DiceSelectResult>;
    rootPlayerId: PlayerId;
    teamIdByPlayerId?: Record<PlayerId, string>;
    isBonusDiceSettlement?: boolean;
    isTokenEvasionConfirmation?: boolean;
}): DiceInteractionContract | undefined {
    const {
        interaction,
        controller,
        rootPlayerId,
        teamIdByPlayerId,
        isBonusDiceSettlement = false,
        isTokenEvasionConfirmation = false,
    } = input;
    if (isTokenEvasionConfirmation) {
        if (
            interaction?.kind !== 'dt:token-response'
            || String(interaction.playerId) !== String(rootPlayerId)
        ) {
            throw new Error('[DiceThrone] Token evasion confirmation requires the active player\'s token-response interaction');
        }
        return {
            kind: 'tokenResponseSettlement',
            interactionId: interaction.id,
            responseKind: 'token',
            completedDieIds: [],
            completedCount: 0,
            result: null,
            hint: { key: 'response.yourTurn', surface: 'response-window' },
            actions: {
                right: {
                    kind: 'confirmTokenResponse',
                    labelKey: 'common.confirm',
                    buttonTestId: 'dice-token-response-confirm-button',
                    tutorialId: 'dice-confirm-button',
                },
            },
        };
    }

    const parsed = parseDiceInteraction(interaction);
    if (parsed.kind === 'invalid') {
        throw new Error(`[DiceThrone] ${parsed.reason}: ${interaction?.id ?? 'unknown interaction'}`);
    }

    if (parsed.kind !== 'valid') {
        const isSettlementOwnerInteraction = interaction === undefined || interaction.kind === 'dt:bonus-dice';
        if (!isBonusDiceSettlement || !isSettlementOwnerInteraction) return undefined;
        return {
            kind: 'bonusSettlement',
            completedDieIds: [],
            completedCount: 0,
            result: null,
            hint: { key: 'interaction.hint_bonus_settlement', surface: 'dice-tray' },
            actions: { right: { kind: 'confirmSettlement', labelKey: 'common.confirm', buttonTestId: 'dice-bonus-settlement-confirm-button', tutorialId: 'dice-confirm-button' } },
        };
    }
    const { meta, allowedDieIds, completedDieIds, completedCount } = parsed;
    if (!controller) {
        throw new Error(`[DiceThrone] Dice interaction requires its shared controller: ${interaction?.id ?? 'unknown interaction'}`);
    }
    if (meta.dtType === 'selectDie' && meta.selectionMode === 'bonusGroupReroll' && !allowedDieIds?.length) {
        throw new Error(`[DiceThrone] Bonus group reroll requires explicit die candidates: ${interaction?.id ?? 'unknown interaction'}`);
    }
    if (meta.dtType === 'selectDie' && meta.selectionMode === 'choice' && !allowedDieIds?.length) {
        throw new Error(`[DiceThrone] Dice choice requires explicit die candidates: ${interaction?.id ?? 'unknown interaction'}`);
    }
    const isBonusGroupReroll = meta.dtType === 'selectDie' && meta.selectionMode === 'bonusGroupReroll';
    if (isBonusGroupReroll && !isBonusDiceSettlement) {
        throw new Error(`[DiceThrone] Bonus group reroll requires its pending settlement: ${interaction?.id ?? 'unknown interaction'}`);
    }

    const rawResult = controller.result;
    const result: DiceModifyResult | DiceSelectResult | null = rawResult ?? null;
    const remainingSelectCount = meta.selectCount - completedCount;
    if (result && meta.dtType === 'selectDie') {
        if (
            !isRecord(result)
            || !('selectedDiceIds' in result)
            || !Array.isArray(result.selectedDiceIds)
            || result.selectedDiceIds.some(id => !isFiniteNumber(id) || !Number.isInteger(id))
            || (!meta.allowRepeatedDieSelection && new Set(result.selectedDiceIds).size !== result.selectedDiceIds.length)
            || (!meta.allowRepeatedDieSelection && result.selectedDiceIds.some(id => completedDieIds.includes(id)))
            || result.selectedDiceIds.length > remainingSelectCount
            || (allowedDieIds && result.selectedDiceIds.some(id => !allowedDieIds.includes(id)))
        ) {
            throw new Error(`[DiceThrone] Invalid current die selection: ${interaction?.id ?? 'unknown interaction'}`);
        }
    }
    if (result && meta.dtType === 'modifyDie') {
        const config = meta.dieModifyConfig;
        const modifications = isRecord(result) ? result.modifications : undefined;
        const modificationEntries = isRecord(modifications) ? Object.entries(modifications) : undefined;
        const targetValue = isRecord(result) ? result.targetValue : undefined;
        const expectedSetValue = config.mode === 'set' ? (config.targetValue ?? targetValue) : undefined;
        if (
            !isRecord(result)
            || !modificationEntries
            || !isNonNegativeInteger(result.modCount)
            || result.modCount > remainingSelectCount
            || result.modCount !== modificationEntries.length
            || !isFiniteNumber(result.totalAdjustment)
            || !Number.isInteger(result.totalAdjustment)
            || modificationEntries.some(([dieId, value]) => (
                !Number.isInteger(Number(dieId))
                || String(Number(dieId)) !== dieId
                || !isDieFaceValue(value)
                || completedDieIds.includes(Number(dieId))
                || (allowedDieIds && !allowedDieIds.includes(Number(dieId)))
            ))
            || (config.mode === 'set' && targetValue !== undefined && (
                !isDieFaceValue(targetValue)
                || (config.targetValue !== undefined && targetValue !== config.targetValue)
                || (config.allowedValues !== undefined && !config.allowedValues.includes(targetValue))
            ))
            || (config.mode !== 'set' && targetValue !== undefined)
            || (config.mode === 'set' && modificationEntries.some(([, value]) => value !== expectedSetValue))
            || (config.mode === 'copy' && (
                modificationEntries.length > 2
                || (modificationEntries.length === 2 && modificationEntries[0][1] !== modificationEntries[1][1])
            ))
            || (config.mode === 'adjust' && (
                result.totalAdjustment < config.adjustRange.min
                || result.totalAdjustment > config.adjustRange.max
            ))
            || (config.mode !== 'adjust' && result.totalAdjustment !== 0)
        ) {
            throw new Error(`[DiceThrone] Invalid current die modification: ${interaction?.id ?? 'unknown interaction'}`);
        }
    }
    const hint = getDiceInteractionHint({
        meta,
        interaction,
        result: result ?? undefined,
        completedCount,
        rootPlayerId,
        teamIdByPlayerId,
    });
    const selectedGroupRerollCount = meta.dtType === 'selectDie'
        && meta.selectionMode === 'bonusGroupReroll'
        && result
        && 'selectedDiceIds' in result
        ? result.selectedDiceIds.length
        : 0;
    const isBonusGroupSettlement = isBonusGroupReroll && isBonusDiceSettlement;
    const isOrdinaryReroll = meta.dtType === 'selectDie' && meta.selectionMode === 'reroll';
    const hasPendingReroll = isOrdinaryReroll && result && 'selectedDiceIds' in result
        && result.selectedDiceIds.length > 0;
    const rerollLabel = !hasPendingReroll && completedCount > 0
        ? 'interaction.finish_reroll'
        : !hasPendingReroll && controller.canConfirm
            ? 'interaction.skip_reroll'
            : 'interaction.confirm_reroll';

    const left = isBonusGroupSettlement
        ? selectedGroupRerollCount > 0
            ? {
                kind: 'submitSelection' as const,
                labelKey: 'dice.reroll_action',
                buttonTestId: 'dice-reroll-selected-group',
                tutorialId: 'dice-reroll-selected-group',
                ariaLabelKey: 'dice.rerollSelectedGroup',
                ariaLabelParams: { count: selectedGroupRerollCount },
            }
            : undefined
        : interaction?.cancelPolicy === 'forbidden'
            ? undefined
            : {
            kind: 'cancel' as const,
            labelKey: 'common.cancel',
        };
    const right: DiceInteractionAction = isBonusGroupSettlement
        ? {
            kind: 'confirmSettlement',
            labelKey: 'common.confirm',
            buttonTestId: 'dice-bonus-settlement-confirm-button',
            tutorialId: 'dice-confirm-button',
        }
        : {
            kind: 'confirmInteraction',
            labelKey: isOrdinaryReroll ? rerollLabel : 'common.confirm',
            buttonTestId: 'dice-interaction-confirm-button',
        };

    return {
        kind: 'multistep',
        interactionId: interaction?.id,
        meta,
        allowedDieIds,
        completedDieIds,
        completedCount,
        result,
        hint: {
            ...hint,
            surface: isBonusGroupSettlement ? 'dice-tray' : 'game-hints',
        },
        controller,
        actions: { left, right },
    };
}
