import { FLOW_COMMANDS } from '../../engine';
import type { Command, MatchState, PlayerId as EnginePlayerId } from '../../engine/types';
import {
    buildAiOwnedBlockingInteractionFallbackActions,
    buildDeterministicAiNoise,
    createAiLegalActionId,
    createActionKindScorer,
    createLookaheadLocalAiPolicy,
    createProfileAwareActionScorer,
    withAiActionStrategyTags,
} from '../../engine/ai';
import {
    OPTIONAL_SKIP_AI_HINT,
    buildTargetAiHint,
    createInteractionHintScorer,
} from '../../engine/ai/semantics';
import type {
    AiAssignmentEvaluation,
    AiDecisionContext,
    AiEffectIntent,
    AiHint,
    AiLegalAction,
    LocalAiActionEvaluation,
    AiStrategyProfile,
    GameAiRuntime,
    LocalAiActionScorer,
} from '../../engine/ai';
import type { InteractionDescriptor as EngineInteractionDescriptor, PromptMultiConfig } from '../../engine/systems/InteractionSystem';
import { SummonerWarsDomain } from './domain';
import { abilityRegistry } from './domain/abilities';
import { PHASE_END_ABILITIES } from './domain/flowHooks';
import { getActivatableAbilities, canActivateAbility } from './domain/abilityHelpers';
import { CARD_IDS, getBaseCardId } from './domain/ids';
import {
    BOARD_COLS,
    BOARD_ROWS,
    findUnitPositionByInstanceId,
    getAdjacentCells,
    getPlayerGates,
    getPlayerUnits,
    getSummoner,
    getUnitAt,
    getUnitAbilities,
    getStructureAt,
    getValidAttackTargetsEnhanced,
    getValidBuildPositions,
    getValidMoveTargetsEnhanced,
    getValidSummonPositions,
    isCellEmpty,
    manhattanDistance,
} from './domain/helpers';
import { SW_COMMANDS } from './domain/types';
import type {
    BoardUnit,
    CellCoord,
    FactionId,
    GamePhase,
    PlayerId as SummonerWarsPlayerId,
    SummonerWarsCore,
} from './domain/types';
import type { AbilityDef } from './domain/abilities';
import { FACTION_CATALOG } from './config/factions';
import {
    estimateSummonerWarsSummonerThreat,
    getSummonerWarsCardKeepValue,
    getSummonerWarsCenterScore,
    getSummonerWarsEnemyPlayerId,
    getSummonerWarsFrontRowScore,
} from './ai/evaluation';
import {
    getSummonerWarsFactionAiProfile,
    mergeSummonerWarsStrategyProfile,
    type SummonerWarsStrategyTag,
} from './ai/factionProfiles';
import { projectSummonerWarsActionDelta } from './ai/search';

type PlayerId = SummonerWarsPlayerId;
type SummonerWarsState = MatchState<SummonerWarsCore>;
const SUMMONER_WARS_AI_INTERACTION_ADAPTER_KINDS = ['simple-choice', 'multistep-choice'];
type SetupPhase = 'setup';
type SummonerWarsTurnPhase = SetupPhase | GamePhase;

type SummonerWarsInteractionOption = {
    id?: string;
    label?: string;
    value?: unknown;
    disabled?: boolean;
    _ai?: AiHint;
};

const SETUP_FACTION_POOL: FactionId[] = FACTION_CATALOG
    .filter((faction) => faction.selectable)
    .map((faction) => faction.id);

const INTERACTIVE_EVENT_BASE_IDS = new Set<string>([
    CARD_IDS.NECRO_HELLFIRE_BLADE,
    CARD_IDS.NECRO_BLOOD_SUMMON,
    CARD_IDS.NECRO_ANNIHILATE,
    CARD_IDS.TRICKSTER_MIND_CONTROL,
    CARD_IDS.TRICKSTER_STUN,
    CARD_IDS.TRICKSTER_HYPNOTIC_LURE,
    CARD_IDS.BARBARIC_CHANT_OF_POWER,
    CARD_IDS.BARBARIC_CHANT_OF_GROWTH,
    CARD_IDS.BARBARIC_CHANT_OF_WEAVING,
    CARD_IDS.BARBARIC_CHANT_OF_ENTANGLEMENT,
    CARD_IDS.FROST_GLACIAL_SHIFT,
    CARD_IDS.GOBLIN_SNEAK,
]);

const SUPPORTED_DIRECT_TARGET_PAYLOAD_FIELDS = new Set(['targetPosition']);

const createCommand = (playerId: PlayerId, type: string, payload: unknown = {}): Command => ({
    type,
    playerId,
    payload,
    timestamp: 0,
});

const isInteractionCommand = (type: string): boolean => type.startsWith('SYS_INTERACTION_');

const isCommandValid = (
    state: SummonerWarsState,
    playerId: PlayerId,
    type: string,
    payload: unknown = {},
): boolean => {
    if (isInteractionCommand(type)) {
        return validateInteractionCommand(state, playerId, type, payload);
    }
    const result = SummonerWarsDomain.validate(state, createCommand(playerId, type, payload) as never);
    return result.valid;
};

const appendAction = (
    actions: AiLegalAction[],
    state: SummonerWarsState,
    playerId: PlayerId,
    action: AiLegalAction,
): void => {
    if (action.commands.length === 0) return;
    const isValid = action.commands.every((command) => isCommandValid(state, playerId, command.type, command.payload));
    if (!isValid) return;
    actions.push(action);
};

const asSummonerWarsPlayerId = (playerId: EnginePlayerId): PlayerId | null => {
    if (playerId === '0' || playerId === '1') {
        return playerId;
    }
    return null;
};

const buildSimpleChoicePayload = (
    interactionId: string,
    optionIds: string[],
    multi: PromptMultiConfig | undefined,
    optionValue?: unknown,
): Record<string, unknown> => {
    const shouldUseMergedValue = (value: unknown): boolean => {
        if (!value || typeof value !== 'object') return false;
        return (value as { __useMergedValue?: boolean }).__useMergedValue === true;
    };

    if (optionIds.length <= 1 && !multi) {
        if (optionValue !== undefined && shouldUseMergedValue(optionValue)) {
            return { interactionId, optionId: optionIds[0], mergedValue: optionValue };
        }
        return { interactionId, optionId: optionIds[0] };
    }
    if (optionIds.length <= 1 && (multi?.min ?? 0) <= 1) {
        if (optionValue !== undefined && shouldUseMergedValue(optionValue)) {
            return { interactionId, optionId: optionIds[0], mergedValue: optionValue };
        }
        return { interactionId, optionId: optionIds[0] };
    }
    return { interactionId, optionIds };
};

const isRecoverableInteractionValue = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value as {
        skip?: unknown;
        done?: unknown;
        cancel?: unknown;
        __cancel__?: unknown;
        __emergency_skip__?: unknown;
    };
    return Boolean(
        candidate.skip
        || candidate.done
        || candidate.cancel
        || candidate.__cancel__
        || candidate.__emergency_skip__,
    );
};

const resolveSimpleChoiceFallbackReason = (
    options: SummonerWarsInteractionOption[],
    multi: PromptMultiConfig | undefined,
): 'empty-options' | 'all-options-disabled' | 'min-selection-unreachable' => {
    const minSelections = typeof multi?.min === 'number' ? multi.min : 1;
    if (options.length === 0) {
        return 'empty-options';
    }
    const enabledOptions = options.filter((option) => option.disabled !== true);
    if (enabledOptions.length === 0) {
        return 'all-options-disabled';
    }
    if (enabledOptions.length < Math.max(0, minSelections)) {
        return 'min-selection-unreachable';
    }
    return 'empty-options';
};

const buildEmergencyInteractionFallbackAction = (
    current: EngineInteractionDescriptor,
    reason: 'empty-options' | 'all-options-disabled' | 'min-selection-unreachable',
): AiLegalAction => {
    if (current.kind === 'simple-choice') {
        const data = current.data as {
            options?: SummonerWarsInteractionOption[];
            multi?: PromptMultiConfig;
        };
        const enabledOptions = (data.options ?? []).filter((option): option is Required<Pick<SummonerWarsInteractionOption, 'id'>> & SummonerWarsInteractionOption => {
            return typeof option?.id === 'string' && option.disabled !== true;
        });
        const recoverableOption = enabledOptions.find((option) => isRecoverableInteractionValue(option.value));
        if (recoverableOption) {
            return {
                actionId: createAiLegalActionId('interaction', current.id, recoverableOption.id),
                kind: 'interaction-choice',
                label: recoverableOption.label ?? '跳过交互',
                commands: [{
                    type: 'SYS_INTERACTION_RESPOND',
                    payload: buildSimpleChoicePayload(current.id, [recoverableOption.id], data.multi, recoverableOption.value),
                }],
                aiHints: [OPTIONAL_SKIP_AI_HINT],
                metadata: {
                    interactionId: current.id,
                    optionId: recoverableOption.id,
                    reason,
                    emergencyFallback: true,
                },
            };
        }

        if ((data.multi?.min ?? 1) === 0) {
            return {
                actionId: createAiLegalActionId('interaction', current.id, 'empty-selection'),
                kind: 'interaction-choice',
                label: '不选择任何项',
                commands: [{
                    type: 'SYS_INTERACTION_RESPOND',
                    payload: { interactionId: current.id, optionIds: [] },
                }],
                aiHints: [OPTIONAL_SKIP_AI_HINT],
                metadata: {
                    interactionId: current.id,
                    optionIds: [],
                    reason,
                    emergencyFallback: true,
                },
            };
        }
    }

    return {
        actionId: createAiLegalActionId('interaction', current.id, 'emergency-cancel'),
        kind: 'interaction-cancel',
        label: '取消交互',
        commands: [{
            type: 'SYS_INTERACTION_CANCEL',
            payload: { interactionId: current.id, reason },
        }],
        aiHints: [OPTIONAL_SKIP_AI_HINT],
        metadata: {
            interactionId: current.id,
            reason,
            emergencyFallback: true,
        },
    };
};

const validateInteractionCommand = (
    state: SummonerWarsState,
    playerId: PlayerId,
    type: string,
    payload: unknown,
): boolean => {
    const current = state.sys.interaction?.current as EngineInteractionDescriptor | undefined;
    if (!current || current.playerId !== playerId) return false;

    const interactionId = (payload as { interactionId?: unknown } | undefined)?.interactionId;
    if (typeof interactionId !== 'string' || interactionId !== current.id) return false;

    if (type === 'SYS_INTERACTION_CANCEL') {
        return true;
    }

    if (type === 'SYS_INTERACTION_CONFIRM') {
        return current.kind === 'multistep-choice';
    }

    if (type !== 'SYS_INTERACTION_RESPOND' || current.kind !== 'simple-choice') {
        return false;
    }

    const data = current.data as {
        options?: SummonerWarsInteractionOption[];
        multi?: PromptMultiConfig;
    };
    const availableOptions = (data.options ?? []).filter((option): option is Required<Pick<SummonerWarsInteractionOption, 'id'>> & SummonerWarsInteractionOption => {
        return typeof option?.id === 'string' && option.disabled !== true;
    });
    const optionsById = new Map(availableOptions.map((option) => [option.id, option] as const));
    const response = payload as { optionId?: unknown; optionIds?: unknown; mergedValue?: unknown };

    if (data.multi) {
        const rawOptionIds = Array.isArray(response.optionIds)
            ? response.optionIds
            : typeof response.optionId === 'string'
                ? [response.optionId]
                : [];
        const selectedIds = Array.from(new Set(rawOptionIds.filter((id): id is string => typeof id === 'string')));
        if (selectedIds.some((id) => !optionsById.has(id))) return false;
        if (response.mergedValue !== undefined) return false;

        const selectedOptions = selectedIds.map((id) => optionsById.get(id)!);
        const selectedSingleRecovery = selectedOptions.length === 1 && isRecoverableInteractionValue(selectedOptions[0]?.value);
        const minSelections = typeof data.multi.min === 'number' ? data.multi.min : 1;
        const maxSelections = typeof data.multi.max === 'number' ? data.multi.max : undefined;
        if (!selectedSingleRecovery && selectedIds.length < minSelections) return false;
        if (!selectedSingleRecovery && maxSelections !== undefined && selectedIds.length > maxSelections) return false;
        return true;
    }

    if (typeof response.optionId !== 'string') return false;
    return optionsById.has(response.optionId);
};

const buildOptionCombinations = (
    optionIds: string[],
    minCount: number,
    maxCount: number,
): string[][] => {
    if (optionIds.length === 0) return [];
    const normalizedMin = Math.max(1, minCount);
    const normalizedMax = Math.max(normalizedMin, maxCount);
    const results: string[][] = [];

    const walk = (start: number, selected: string[]): void => {
        if (selected.length >= normalizedMin && selected.length <= normalizedMax) {
            results.push([...selected]);
        }
        if (selected.length >= normalizedMax) return;
        for (let index = start; index < optionIds.length; index += 1) {
            selected.push(optionIds[index]);
            walk(index + 1, selected);
            selected.pop();
        }
    };

    walk(0, []);
    return results;
};

const getAllBoardUnitTargets = (core: SummonerWarsCore): Array<{ unit: BoardUnit; position: CellCoord }> => {
    const targets: Array<{ unit: BoardUnit; position: CellCoord }> = [];
    for (let row = 0; row < BOARD_ROWS; row += 1) {
        for (let col = 0; col < BOARD_COLS; col += 1) {
            const unit = core.board[row][col].unit;
            if (!unit) continue;
            targets.push({ unit, position: { row, col } });
        }
    }
    return targets;
};

const getAllBoardPositions = (): CellCoord[] => {
    const positions: CellCoord[] = [];
    for (let row = 0; row < BOARD_ROWS; row += 1) {
        for (let col = 0; col < BOARD_COLS; col += 1) {
            positions.push({ row, col });
        }
    }
    return positions;
};

const getEnemyPlayerId = getSummonerWarsEnemyPlayerId;

const buildPendingActiveEventActions = (
    state: SummonerWarsState,
    playerId: PlayerId,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const player = state.core.players[playerId];

    for (const activeEvent of player.activeEvents) {
        if (getBaseCardId(activeEvent.id) !== CARD_IDS.NECRO_FUNERAL_PYRE) {
            continue;
        }

        const charges = activeEvent.charges ?? 0;
        if (charges <= 0) {
            continue;
        }

        const woundedUnits = getPlayerUnits(state.core, playerId)
            .filter((unit) => unit.damage > 0);

        for (const unit of woundedUnits) {
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('active-event', activeEvent.id, 'heal', unit.instanceId),
                kind: 'activate-ability',
                label: `殉葬火堆治疗 ${unit.card.name}`,
                commands: [{
                    type: SW_COMMANDS.FUNERAL_PYRE_HEAL,
                    payload: {
                        cardId: activeEvent.id,
                        targetPosition: unit.position,
                    },
                }],
                aiHints: [
                    buildTargetAiHint({
                        actorPlayerId: playerId,
                        targetPlayerId: unit.owner,
                        targetKind: 'card',
                        effectIntent: 'buff',
                        tags: ['sw:active-event', 'event:funeral_pyre'],
                    }),
                ],
                metadata: withAiActionStrategyTags({
                    abilityId: 'funeral_pyre',
                    activeEventId: activeEvent.id,
                    targetPosition: unit.position,
                    targetOwner: unit.owner,
                    targetType: unit.card.unitClass,
                    sourceOwner: playerId,
                    healAmount: Math.min(charges, unit.damage),
                    targetDamage: unit.damage,
                    pendingActiveEvent: true,
                }, unit.card.unitClass === 'summoner'
                    ? ['summoner-defense']
                    : ['summoner-defense', 'board-control']),
            });
        }

        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('active-event', activeEvent.id, 'skip'),
            kind: 'activate-ability',
            label: '跳过殉葬火堆治疗',
            commands: [{
                type: SW_COMMANDS.FUNERAL_PYRE_HEAL,
                payload: {
                    cardId: activeEvent.id,
                    skip: true,
                },
            }],
            aiHints: [OPTIONAL_SKIP_AI_HINT],
            metadata: withAiActionStrategyTags({
                abilityId: 'funeral_pyre',
                activeEventId: activeEvent.id,
                pendingActiveEvent: true,
                skip: true,
            }, ['economy']),
        });
    }

    return actions;
};

const supportsDirectTargetSelectionAiExpansion = (abilityDef: AbilityDef): boolean => {
    const targetCount = abilityDef.targetSelection?.count ?? 1;
    if (targetCount !== 1) return false;
    const requiredFields = abilityDef.interactionChain?.payloadContract?.required ?? [];
    return requiredFields.every((field) => SUPPORTED_DIRECT_TARGET_PAYLOAD_FIELDS.has(field));
};

const pushStrategyTag = (
    tags: SummonerWarsStrategyTag[],
    tag: SummonerWarsStrategyTag,
): void => {
    if (!tags.includes(tag)) {
        tags.push(tag);
    }
};

const addStrategyWeight = (
    weights: Partial<Record<SummonerWarsStrategyTag, number>>,
    tag: SummonerWarsStrategyTag,
    value: number,
): void => {
    weights[tag] = Number(((weights[tag] ?? 0) + value).toFixed(3));
};

const getCurrentPhase = (state: SummonerWarsState): SummonerWarsTurnPhase => {
    if (!state.core.hostStarted) {
        return 'setup';
    }
    return state.core.phase;
};

const isFlowHalted = (state: SummonerWarsState): boolean => {
    const sys = state.sys as { flowHalted?: unknown } | undefined;
    return sys?.flowHalted === true;
};

const EFFECT_INTENT_PRIORITY: AiEffectIntent[] = [
    'destroy',
    'debuff',
    'buff',
    'move',
    'resource',
];

const inferAbilityEffectIntent = (abilityDef: AbilityDef | undefined): AiEffectIntent | null => {
    if (!abilityDef?.effects || abilityDef.effects.length === 0) return null;

    const found = new Set<AiEffectIntent>();
    for (const effect of abilityDef.effects) {
        switch (effect.type) {
            case 'damage':
            case 'destroyUnit':
                found.add('destroy');
                break;
            case 'takeControl':
            case 'preventMagicGain':
            case 'removeCharge':
                found.add('debuff');
                break;
            case 'heal':
            case 'addCharge':
            case 'grantExtraAttack':
            case 'doubleStrength':
            case 'reduceDamage':
                found.add('buff');
                break;
            case 'modifyStrength': {
                if (typeof effect.value === 'number') {
                    found.add(effect.value >= 0 ? 'buff' : 'debuff');
                }
                break;
            }
            case 'modifyLife': {
                if (typeof effect.value === 'number') {
                    found.add(effect.value >= 0 ? 'buff' : 'debuff');
                }
                break;
            }
            case 'modifyMagic':
            case 'setCharge':
                found.add('resource');
                break;
            case 'moveUnit':
            case 'pushPull':
            case 'extraMove':
                found.add('move');
                break;
            default:
                break;
        }
    }

    for (const intent of EFFECT_INTENT_PRIORITY) {
        if (found.has(intent)) return intent;
    }
    return null;
};

const getInteractionSourceAbility = (
    current: EngineInteractionDescriptor | undefined,
): AbilityDef | undefined => {
    const data = current?.data as { sourceId?: string } | undefined;
    const sourceId = typeof data?.sourceId === 'string' ? data.sourceId : undefined;
    return sourceId ? abilityRegistry.get(sourceId) : undefined;
};

const buildInteractionOptionAiHints = (
    state: SummonerWarsState,
    playerId: PlayerId,
    current: EngineInteractionDescriptor,
    option: SummonerWarsInteractionOption,
): AiHint[] => {
    const hints: AiHint[] = [];
    if (option._ai) hints.push(option._ai);

    const optionId = String(option.id ?? '').toLowerCase();
    if (optionId.includes('cancel') || optionId.includes('skip') || optionId.includes('pass')) {
        hints.push(OPTIONAL_SKIP_AI_HINT);
    }

    const value = option.value as { targetPosition?: CellCoord } | undefined;
    const targetPosition = value?.targetPosition;
    if (!targetPosition) return hints;

    const targetUnit = getUnitAt(state.core, targetPosition);
    const targetStructure = targetUnit ? null : getStructureAt(state.core, targetPosition);
    const targetOwner = targetUnit?.owner ?? targetStructure?.owner;

    const abilityDef = getInteractionSourceAbility(current);
    const effectIntent = inferAbilityEffectIntent(abilityDef);

    if (targetOwner) {
        hints.push(buildTargetAiHint({
            actorPlayerId: playerId,
            targetPlayerId: targetOwner,
            targetKind: 'card',
            effectIntent: effectIntent ?? 'affect',
            tags: [
                'sw:interaction',
                ...(abilityDef ? [`ability:${abilityDef.id}`] : []),
            ],
        }));
    }

    return hints;
};

const getCardKeepValue = getSummonerWarsCardKeepValue;
const getCenterScore = getSummonerWarsCenterScore;
const getFrontRowScore = getSummonerWarsFrontRowScore;

const readActionMetadataNumber = (action: AiLegalAction, key: string): number | null => {
    const value = action.metadata?.[key];
    return typeof value === 'number' ? value : null;
};

const readActionMetadataBoolean = (action: AiLegalAction, key: string): boolean | null => {
    const value = action.metadata?.[key];
    return typeof value === 'boolean' ? value : null;
};

const readActionMetadataString = (action: AiLegalAction, key: string): string | null => {
    const value = action.metadata?.[key];
    return typeof value === 'string' ? value : null;
};

const asOptionValueRecord = (value: unknown): Record<string, unknown> | null => {
    return value && typeof value === 'object'
        ? value as Record<string, unknown>
        : null;
};

const readOptionValueString = (value: Record<string, unknown>, key: string): string | null => {
    const field = value[key];
    return typeof field === 'string' ? field : null;
};

const readOptionValuePosition = (value: Record<string, unknown>, key: string): CellCoord | null => {
    const field = value[key];
    if (!field || typeof field !== 'object') return null;
    const candidate = field as { row?: unknown; col?: unknown };
    return typeof candidate.row === 'number' && typeof candidate.col === 'number'
        ? { row: candidate.row, col: candidate.col }
        : null;
};

const buildSummonerWarsFeatureSnapshot = (args: {
    playerId: PlayerId;
    state: SummonerWarsState;
    legalActions: AiLegalAction[];
}): Record<string, unknown> => {
    const enemyPlayerId = getEnemyPlayerId(args.playerId);
    const threat = estimateSummonerThreat(args.state.core, args.playerId);
    const ownUnits = getPlayerUnits(args.state.core, args.playerId);
    const enemyUnits = getPlayerUnits(args.state.core, enemyPlayerId);
    const ownFrontlineAverage = ownUnits.length > 0
        ? ownUnits.reduce((sum, unit) => sum + getFrontRowScore(unit.position, args.playerId), 0) / ownUnits.length
        : 0;
    const enemyFrontlineAverage = enemyUnits.length > 0
        ? enemyUnits.reduce((sum, unit) => sum + getFrontRowScore(unit.position, enemyPlayerId), 0) / enemyUnits.length
        : 0;
    const ownCenterControl = ownUnits.filter((unit) => getCenterScore(unit.position) >= 2).length;
    const enemyCenterControl = enemyUnits.filter((unit) => getCenterScore(unit.position) >= 2).length;
    const attackActions = args.legalActions.filter((action) => action.kind === 'declare-attack');
    const gatePressureActions = attackActions.filter((action) => readActionMetadataBoolean(action, 'targetIsGate') === true).length;
    const summonerPressureActions = attackActions.filter((action) => readActionMetadataString(action, 'targetType') === 'summoner').length;
    const antiThreatActions = attackActions.filter((action) => readActionMetadataBoolean(action, 'targetIsThreateningSummoner') === true).length;
    const pressureRatio = threat.remainingLife > 0
        ? Number((threat.directThreatDamage / threat.remainingLife).toFixed(3))
        : 0;

    return {
        threat: {
            remainingLife: threat.remainingLife,
            directThreatDamage: threat.directThreatDamage,
            nearbyEnemyPressure: threat.nearbyEnemyPressure,
            pressureRatio,
        },
        control: {
            ownCenterControl,
            enemyCenterControl,
            centerControlDelta: ownCenterControl - enemyCenterControl,
        },
        objective: {
            attackActionCount: attackActions.length,
            gatePressureActions,
            summonerPressureActions,
            antiThreatActions,
        },
        frontline: {
            ownFrontlineAverage: Number(ownFrontlineAverage.toFixed(3)),
            enemyFrontlineAverage: Number(enemyFrontlineAverage.toFixed(3)),
            frontlineDelta: Number((ownFrontlineAverage - enemyFrontlineAverage).toFixed(3)),
        },
    };
};

type SummonerWarsAssignmentMode = 'defense' | 'pressure';

const clampAssignmentScore = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    return Math.min(160, Math.max(-120, value));
};

const resolveSummonerWarsAssignmentMode = (args: {
    pressureRatio: number;
    underEmergency: boolean;
}): SummonerWarsAssignmentMode => {
    if (args.underEmergency || args.pressureRatio >= 1) {
        return 'defense';
    }
    return 'pressure';
};

const readPressureRatioFromFeatureSnapshot = (
    context: AiDecisionContext,
    fallbackThreat: ReturnType<typeof estimateSummonerThreat>,
): number => {
    const snapshot = context.featureSnapshot;
    if (!snapshot || typeof snapshot !== 'object') {
        return fallbackThreat.remainingLife > 0
            ? Number((fallbackThreat.directThreatDamage / fallbackThreat.remainingLife).toFixed(3))
            : 0;
    }

    const threat = (snapshot as Record<string, unknown>).threat;
    if (!threat || typeof threat !== 'object') {
        return fallbackThreat.remainingLife > 0
            ? Number((fallbackThreat.directThreatDamage / fallbackThreat.remainingLife).toFixed(3))
            : 0;
    }

    const pressureRatio = (threat as Record<string, unknown>).pressureRatio;
    if (typeof pressureRatio === 'number' && Number.isFinite(pressureRatio)) {
        return pressureRatio;
    }

    return fallbackThreat.remainingLife > 0
        ? Number((fallbackThreat.directThreatDamage / fallbackThreat.remainingLife).toFixed(3))
        : 0;
};

const buildSummonerWarsAssignmentIntent = (args: {
    action: AiLegalAction;
    mode: SummonerWarsAssignmentMode;
    pressureRatio: number;
    sourceUnit: BoardUnit;
    ownSummoner: BoardUnit | null;
    enemySummoner: BoardUnit | null;
}): {
    score: number;
    reason: string;
    metadata?: Record<string, unknown>;
} | null => {
    const { action, mode, pressureRatio, sourceUnit, ownSummoner, enemySummoner } = args;
    let score = 0;
    const reasons: string[] = [];

    if (mode === 'defense' && ownSummoner) {
        const distanceToOwnSummoner = manhattanDistance(sourceUnit.position, ownSummoner.position);
        score += Math.max(0, 5 - distanceToOwnSummoner) * 5;
    }
    if (mode === 'pressure' && enemySummoner) {
        const distanceToEnemySummoner = manhattanDistance(sourceUnit.position, enemySummoner.position);
        score += Math.max(0, 6 - distanceToEnemySummoner) * 4;
    }

    if (action.kind === 'declare-attack') {
        const targetType = readActionMetadataString(action, 'targetType') ?? 'unknown';
        const targetIsThreateningSummoner = readActionMetadataBoolean(action, 'targetIsThreateningSummoner') === true;
        const targetIsGate = readActionMetadataBoolean(action, 'targetIsGate') === true;
        const lethalLikely = readActionMetadataBoolean(action, 'lethalLikely') === true;

        if (targetIsThreateningSummoner) {
            score += mode === 'defense' ? 95 : 36;
            reasons.push('优先清理正在威胁召唤师的目标');
        }
        if (targetType === 'summoner') {
            score += mode === 'pressure' ? 32 : -18;
        } else if (targetType === 'champion') {
            score += 22;
        } else if (targetType === 'common') {
            score += 10;
        } else if (targetType === 'structure') {
            score += targetIsGate
                ? (mode === 'pressure' ? 18 : -28)
                : 6;
        }
        if (lethalLikely) {
            score += mode === 'pressure' ? 24 : 14;
        }
    } else if (action.kind === 'move-unit') {
        const distanceToEnemySummonerBefore = readActionMetadataNumber(action, 'distanceToEnemySummonerBefore');
        const distanceToEnemySummonerAfter = readActionMetadataNumber(action, 'distanceToEnemySummonerAfter');
        const distanceToOwnSummonerBefore = readActionMetadataNumber(action, 'distanceToOwnSummonerBefore');
        const distanceToOwnSummonerAfter = readActionMetadataNumber(action, 'distanceToOwnSummonerAfter');
        const directThreatDamageBefore = readActionMetadataNumber(action, 'directThreatDamageBefore');
        const directThreatDamageAfter = readActionMetadataNumber(action, 'directThreatDamageAfter');
        const nearbyEnemyPressureBefore = readActionMetadataNumber(action, 'nearbyEnemyPressureBefore');
        const nearbyEnemyPressureAfter = readActionMetadataNumber(action, 'nearbyEnemyPressureAfter');
        const attackTargetsAfterMove = readActionMetadataNumber(action, 'attackTargetsAfterMove') ?? 0;

        if (distanceToEnemySummonerBefore !== null && distanceToEnemySummonerAfter !== null && distanceToEnemySummonerAfter < distanceToEnemySummonerBefore) {
            score += mode === 'pressure'
                ? (distanceToEnemySummonerBefore - distanceToEnemySummonerAfter) * 16
                : (distanceToEnemySummonerBefore - distanceToEnemySummonerAfter) * 5;
        }
        if (distanceToOwnSummonerBefore !== null && distanceToOwnSummonerAfter !== null && distanceToOwnSummonerAfter < distanceToOwnSummonerBefore) {
            score += mode === 'defense'
                ? (distanceToOwnSummonerBefore - distanceToOwnSummonerAfter) * 16
                : (distanceToOwnSummonerBefore - distanceToOwnSummonerAfter) * 4;
        }
        if (directThreatDamageBefore !== null && directThreatDamageAfter !== null && directThreatDamageAfter < directThreatDamageBefore) {
            score += (directThreatDamageBefore - directThreatDamageAfter) * 28 + (mode === 'defense' ? 30 : 8);
            reasons.push('移动后能明显降低召唤师即时受伤风险');
        }
        if (nearbyEnemyPressureBefore !== null && nearbyEnemyPressureAfter !== null && nearbyEnemyPressureAfter < nearbyEnemyPressureBefore) {
            score += (nearbyEnemyPressureBefore - nearbyEnemyPressureAfter) * (mode === 'defense' ? 8 : 3);
        }
        if (attackTargetsAfterMove > 0) {
            score += attackTargetsAfterMove * (mode === 'pressure' ? 10 : 5);
        }
    } else if (action.kind === 'summon-unit' || action.kind === 'build-structure') {
        const distanceToEnemySummoner = readActionMetadataNumber(action, 'distanceToEnemySummoner') ?? 99;
        const distanceToOwnSummoner = readActionMetadataNumber(action, 'distanceToOwnSummoner') ?? 99;
        const isGate = readActionMetadataBoolean(action, 'isGate') === true;

        if (mode === 'defense') {
            score += Math.max(0, 5 - distanceToOwnSummoner) * 8;
            if (isGate) score -= 8;
            reasons.push('承压回合优先补防线');
        } else {
            score += Math.max(0, 7 - distanceToEnemySummoner) * 8;
            if (isGate) score += 18;
            reasons.push('低压回合优先推进前线');
        }
    } else if (action.kind === 'activate-ability') {
        const enemySummonerPressureCount = (readActionMetadataNumber(action, 'adjacentEnemySummonerPressureCount') ?? 0)
            + (readActionMetadataNumber(action, 'allEnemySummonerPressureCount') ?? 0);
        const adjacentAllyCount = readActionMetadataNumber(action, 'adjacentAllyCount') ?? 0;
        const allAllyCount = readActionMetadataNumber(action, 'allAllyCount') ?? 0;
        const supportCount = adjacentAllyCount + allAllyCount;
        score += enemySummonerPressureCount * (mode === 'pressure' ? 24 : 10);
        score += supportCount * (mode === 'defense' ? 9 : 6);
    }

    if (pressureRatio >= 1 && mode === 'defense' && action.kind === 'advance-phase') {
        score -= 24;
    }

    if (score === 0) return null;
    return {
        score: clampAssignmentScore(Number(score.toFixed(3))),
        reason: reasons[0] ?? (mode === 'defense' ? '优先安排单位回防' : '优先安排单位前压'),
        metadata: {
            mode,
            pressureRatio,
        },
    };
};

const evaluateSummonerWarsAssignments = (args: {
    context: AiDecisionContext;
    baseEvaluations: LocalAiActionEvaluation[];
}): AiAssignmentEvaluation[] => {
    const state = args.context.visibleState as SummonerWarsState;
    const playerId = asSummonerWarsPlayerId(args.context.playerId);
    if (!playerId) return [];
    const enemyPlayerId = getEnemyPlayerId(playerId);
    const ownSummoner = getSummoner(state.core, playerId);
    const enemySummoner = getSummoner(state.core, enemyPlayerId);
    const threat = estimateSummonerThreat(state.core, playerId);
    const pressureRatio = readPressureRatioFromFeatureSnapshot(args.context, threat);
    const underEmergency = threat.remainingLife > 0 && threat.directThreatDamage >= Math.max(1, threat.remainingLife - 1);
    const assignmentMode = resolveSummonerWarsAssignmentMode({
        pressureRatio,
        underEmergency,
    });
    const ownUnitsById = new Map(getPlayerUnits(state.core, playerId).map((unit) => [unit.instanceId, unit] as const));

    const baseAssignments = args.baseEvaluations
        .map((evaluation): (AiAssignmentEvaluation & { sourceUnitId: string; baseScore: number }) | null => {
            const sourceUnitId = readActionMetadataString(evaluation.action, 'sourceUnitId');
            if (!sourceUnitId) return null;
            const sourceUnit = ownUnitsById.get(sourceUnitId);
            if (!sourceUnit) return null;
            const intent = buildSummonerWarsAssignmentIntent({
                action: evaluation.action,
                mode: assignmentMode,
                pressureRatio,
                sourceUnit,
                ownSummoner,
                enemySummoner,
            });
            if (!intent) return null;

            return {
                actionId: evaluation.action.actionId,
                score: intent.score,
                reason: intent.reason,
                metadata: {
                    ...(intent.metadata ?? {}),
                    baseScore: intent.score,
                },
                sourceUnitId,
                baseScore: intent.score,
            };
        })
        .filter((item): item is AiAssignmentEvaluation & { sourceUnitId: string; baseScore: number } => item !== null);

    const assignmentsBySourceUnit = new Map<string, Array<AiAssignmentEvaluation & { sourceUnitId: string; baseScore: number }>>();
    for (const assignment of baseAssignments) {
        const existing = assignmentsBySourceUnit.get(assignment.sourceUnitId) ?? [];
        existing.push(assignment);
        assignmentsBySourceUnit.set(assignment.sourceUnitId, existing);
    }

    const finalAssignments: AiAssignmentEvaluation[] = [];
    for (const [sourceUnitId, group] of assignmentsBySourceUnit.entries()) {
        const ranked = [...group].sort((left, right) => right.baseScore - left.baseScore);
        for (let index = 0; index < ranked.length; index += 1) {
            const candidate = ranked[index];
            const ordinalAdjustment = index === 0
                ? 14
                : index === 1
                    ? -6
                    : -12 - (index - 2) * 2;
            const score = clampAssignmentScore(candidate.baseScore + ordinalAdjustment);
            if (score === 0) continue;
            finalAssignments.push({
                actionId: candidate.actionId,
                score,
                reason: `${candidate.reason}（单位任务排序 #${index + 1}）`,
                metadata: {
                    ...(candidate.metadata ?? {}),
                    sourceUnitId,
                    assignmentMode,
                    assignmentRank: index + 1,
                    ordinalAdjustment,
                    pressureRatio,
                },
            });
        }
    }

    return finalAssignments;
};

/** 计算在指定位置放置传送门后新增的召唤位置数量 */
const getSummonRangeExtension = (
    state: SummonerWarsCore,
    playerId: PlayerId,
    position: CellCoord,
): number => {
    const currentPositions = new Set(
        getAiValidSummonPositions(state, playerId).map((p) => `${p.row},${p.col}`),
    );
    let extension = 0;
    for (const adj of getAdjacentCells(position)) {
        const key = `${adj.row},${adj.col}`;
        if (!currentPositions.has(key) && isCellEmpty(state, adj)) {
            extension++;
        }
    }
    return extension;
};

const getAiValidSummonPositions = (
    state: SummonerWarsCore,
    playerId: PlayerId,
): CellCoord[] => {
    const positions = getValidSummonPositions(state, playerId);
    const positionSet = new Set(positions.map((p) => `${p.row},${p.col}`));
    const addIfEmpty = (position: CellCoord) => {
        const key = `${position.row},${position.col}`;
        if (positionSet.has(key) || !isCellEmpty(state, position)) return;
        positionSet.add(key);
        positions.push(position);
    };

    const player = state.players[playerId];
    const hasRekindleHope = player.activeEvents.some((eventCard) => (
        getBaseCardId(eventCard.id) === CARD_IDS.PALADIN_REKINDLE_HOPE
    ));
    if (hasRekindleHope) {
        const summoner = getSummoner(state, playerId);
        if (summoner) {
            for (const adjacent of getAdjacentCells(summoner.position)) {
                addIfEmpty(adjacent);
            }
        }
    }

    const chantOfWeaving = player.activeEvents.find((eventCard) => (
        getBaseCardId(eventCard.id) === CARD_IDS.BARBARIC_CHANT_OF_WEAVING
        && !!eventCard.targetUnitId
    ));
    if (chantOfWeaving?.targetUnitId) {
        const targetPosition = findUnitPositionByInstanceId(state, chantOfWeaving.targetUnitId);
        if (targetPosition) {
            for (const adjacent of getAdjacentCells(targetPosition)) {
                addIfEmpty(adjacent);
            }
        }
    }

    return positions;
};

const cloneCoreWithMovedUnit = (
    core: SummonerWarsCore,
    from: CellCoord,
    to: CellCoord,
): SummonerWarsCore | null => {
    const unit = core.board[from.row]?.[from.col]?.unit;
    if (!unit) return null;
    const board = core.board.map((row) => row.map((cell) => ({ ...cell })));
    board[from.row][from.col].unit = undefined;
    board[to.row][to.col].unit = {
        ...unit,
        position: to,
    };
    return {
        ...core,
        board,
    };
};

const estimateSummonerThreat = estimateSummonerWarsSummonerThreat;

const getSummonerWarsStrategyProfile = (
    state: SummonerWarsState,
    playerId: PlayerId,
): AiStrategyProfile<SummonerWarsStrategyTag> => {
    const phase = getCurrentPhase(state);
    const threat = estimateSummonerThreat(state.core, playerId);
    const weights: Partial<Record<SummonerWarsStrategyTag, number>> = {};
    const summary: string[] = [];

    if (threat.remainingLife > 0 && threat.directThreatDamage >= threat.remainingLife) {
        addStrategyWeight(weights, 'summoner-defense', 2.4);
        addStrategyWeight(weights, 'board-control', 1.1);
        summary.push('先保召唤师');
    } else if (threat.nearbyEnemyPressure >= 8) {
        addStrategyWeight(weights, 'summoner-defense', 2);
        addStrategyWeight(weights, 'board-control', 1);
        addStrategyWeight(weights, 'summoner-pressure', 0.45);
        addStrategyWeight(weights, 'gate-push', 0.3);
        summary.push('前线承压，优先回防');
    } else {
        addStrategyWeight(weights, 'summoner-pressure', 1.15);
        addStrategyWeight(weights, 'board-control', 0.9);
        addStrategyWeight(weights, 'gate-push', 0.85);
    }

    switch (phase) {
        case 'summon':
            addStrategyWeight(weights, 'summoner-pressure', 0.35);
            addStrategyWeight(weights, 'board-control', 0.15);
            addStrategyWeight(weights, 'gate-push', 0.2);
            break;
        case 'move':
            addStrategyWeight(weights, 'summoner-pressure', 0.4);
            addStrategyWeight(weights, 'board-control', 0.2);
            addStrategyWeight(weights, 'gate-push', 0.15);
            break;
        case 'attack':
            addStrategyWeight(weights, 'summoner-pressure', 0.55);
            addStrategyWeight(weights, 'board-control', 0.25);
            addStrategyWeight(weights, 'gate-push', 0.3);
            break;
        case 'build':
            addStrategyWeight(weights, 'gate-push', 1.2);
            addStrategyWeight(weights, 'board-control', 0.3);
            addStrategyWeight(weights, 'summoner-defense', 0.15);
            break;
        case 'magic':
            addStrategyWeight(weights, 'economy', 1.4);
            summary.push('资源回合优先经济');
            break;
        default:
            addStrategyWeight(weights, 'ability-tempo', 0.35);
            break;
    }

    if (summary.length === 0) {
        summary.push('保持中线与召唤师压力平衡');
    }

    const tags = (Object.entries(weights) as Array<[SummonerWarsStrategyTag, number]>)
        .filter(([, weight]) => weight >= 0.85)
        .map(([tag]) => tag);

    const baseProfile: AiStrategyProfile<SummonerWarsStrategyTag> = {
        tags,
        tagWeights: weights,
        summary,
    };
    return mergeSummonerWarsStrategyProfile(
        baseProfile,
        getSummonerWarsFactionAiProfile(state.core, playerId),
    );
};

const buildSummonStrategyTags = (args: {
    distanceToEnemySummoner: number;
    distanceToOwnSummoner: number;
    centerScore: number;
}): SummonerWarsStrategyTag[] => {
    const tags: SummonerWarsStrategyTag[] = [];
    if (args.distanceToOwnSummoner <= 1) {
        pushStrategyTag(tags, 'summoner-defense');
    }
    if (args.distanceToEnemySummoner <= 4) {
        pushStrategyTag(tags, 'summoner-pressure');
    }
    if (args.centerScore >= 2) {
        pushStrategyTag(tags, 'board-control');
    }
    return tags;
};

const buildMoveStrategyTags = (args: {
    attackTargetsAfterMove: number;
    distanceToEnemySummonerBefore: number;
    distanceToEnemySummonerAfter: number;
    distanceToOwnSummonerBefore: number;
    distanceToOwnSummonerAfter: number;
    directThreatDamageBefore: number;
    directThreatDamageAfter: number;
    nearbyEnemyPressureBefore: number;
    nearbyEnemyPressureAfter: number;
    centerScore: number;
}): SummonerWarsStrategyTag[] => {
    const tags: SummonerWarsStrategyTag[] = [];
    if (
        args.attackTargetsAfterMove > 0
        || args.distanceToEnemySummonerAfter < args.distanceToEnemySummonerBefore
    ) {
        pushStrategyTag(tags, 'summoner-pressure');
    }
    if (
        args.directThreatDamageAfter < args.directThreatDamageBefore
        || args.nearbyEnemyPressureAfter < args.nearbyEnemyPressureBefore
        || args.distanceToOwnSummonerAfter < args.distanceToOwnSummonerBefore
    ) {
        pushStrategyTag(tags, 'summoner-defense');
    }
    if (args.centerScore >= 2) {
        pushStrategyTag(tags, 'board-control');
    }
    return tags;
};

const buildAttackStrategyTags = (args: {
    targetType: string;
    targetIsThreateningSummoner: boolean;
    targetIsGate: boolean;
}): SummonerWarsStrategyTag[] => {
    const tags: SummonerWarsStrategyTag[] = [];
    if (args.targetType === 'summoner') {
        pushStrategyTag(tags, 'summoner-pressure');
    }
    if (args.targetIsThreateningSummoner) {
        pushStrategyTag(tags, 'summoner-defense');
    }
    // 攻击敌方传送门不是gate-push（那是己方前推），而是低效行为
    if (args.targetIsGate) {
        // 不加进攻性标签，让策略权重自然降低其优先级
    }
    if (args.targetType === 'champion' || args.targetType === 'common' || args.targetType === 'structure') {
        pushStrategyTag(tags, 'board-control');
    }
    return tags;
};

type ActivatedAbilityTargetSummary = {
    count: number;
    championCount: number;
    summonerCount: number;
    nearOwnSummonerCount: number;
    attackReadyCount: number;
    enemySummonerPressureCount: number;
};

const summarizeAbilityTargetUnits = (
    state: SummonerWarsState,
    units: BoardUnit[],
    ownSummonerPosition: CellCoord | null,
    enemySummonerPosition: CellCoord | null,
): ActivatedAbilityTargetSummary => {
    let championCount = 0;
    let summonerCount = 0;
    let nearOwnSummonerCount = 0;
    let attackReadyCount = 0;
    let enemySummonerPressureCount = 0;

    for (const unit of units) {
        if (unit.card.unitClass === 'champion') {
            championCount += 1;
        }
        if (unit.card.unitClass === 'summoner') {
            summonerCount += 1;
        }
        if (
            ownSummonerPosition
            && manhattanDistance(unit.position, ownSummonerPosition) <= 1
        ) {
            nearOwnSummonerCount += 1;
        }

        const attackTargets = getValidAttackTargetsEnhanced(state.core, unit.position);
        if (attackTargets.length > 0) {
            attackReadyCount += 1;
        }
        if (
            enemySummonerPosition
            && attackTargets.some((target) => {
                return target.row === enemySummonerPosition.row && target.col === enemySummonerPosition.col;
            })
        ) {
            enemySummonerPressureCount += 1;
        }
    }

    return {
        count: units.length,
        championCount,
        summonerCount,
        nearOwnSummonerCount,
        attackReadyCount,
        enemySummonerPressureCount,
    };
};

const buildActivatedAbilitySemantics = (args: {
    state: SummonerWarsState;
    playerId: PlayerId;
    unit: BoardUnit;
    abilityDef: AbilityDef;
}): {
    strategyTags: SummonerWarsStrategyTag[];
    metadata: Record<string, unknown>;
} => {
    const { state, playerId, unit, abilityDef } = args;
    const strategyTags: SummonerWarsStrategyTag[] = ['ability-tempo'];
    const ownSummoner = getSummoner(state.core, playerId);
    const enemySummoner = getSummoner(state.core, getEnemyPlayerId(playerId));
    const adjacentAllies = getAdjacentCells(unit.position)
        .map((position) => getUnitAt(state.core, position))
        .filter((candidate): candidate is BoardUnit => candidate !== undefined)
        .filter((candidate) => candidate.owner === playerId);
    const allAllies = getPlayerUnits(state.core, playerId).filter((candidate) => candidate.instanceId !== unit.instanceId);
    const effectTypes = abilityDef.effects.map((effect) => effect.type);
    const sourceAttackTargets = getValidAttackTargetsEnhanced(state.core, unit.position);

    const metadata: Record<string, unknown> = {
        abilityId: abilityDef.id,
        abilityEffectTypes: effectTypes,
        sourceUnitClass: unit.card.unitClass,
        sourceOwner: playerId,
        sourceBoostsBefore: unit.boosts ?? 0,
        sourceAttackTargetCount: sourceAttackTargets.length,
        costsMoveAction: abilityDef.costsMoveAction === true,
        costsAttackAction: abilityDef.costsAttackAction === true,
        selfChargeGain: 0,
        adjacentAllyCount: 0,
        adjacentChampionCount: 0,
        adjacentSummonerCount: 0,
        adjacentAttackReadyCount: 0,
        adjacentEnemySummonerPressureCount: 0,
        allAllyCount: 0,
        allChampionCount: 0,
        allSummonerCount: 0,
        allAttackReadyCount: 0,
        allEnemySummonerPressureCount: 0,
    };

    const applyFriendlyTargetSemantics = (target: string): void => {
        const summary = summarizeAbilityTargetUnits(
            state,
            target === 'adjacentAllies' ? adjacentAllies : allAllies,
            ownSummoner?.position ?? null,
            enemySummoner?.position ?? null,
        );
        const prefix = target === 'adjacentAllies' ? 'adjacent' : 'all';
        metadata[`${prefix}AllyCount`] = summary.count;
        metadata[`${prefix}ChampionCount`] = summary.championCount;
        metadata[`${prefix}SummonerCount`] = summary.summonerCount;
        metadata[`${prefix}NearOwnSummonerCount`] = summary.nearOwnSummonerCount;
        metadata[`${prefix}AttackReadyCount`] = summary.attackReadyCount;
        metadata[`${prefix}EnemySummonerPressureCount`] = summary.enemySummonerPressureCount;

        if (summary.count > 0) {
            pushStrategyTag(strategyTags, 'board-control');
        }
        if (summary.summonerCount > 0 || summary.nearOwnSummonerCount > 0) {
            pushStrategyTag(strategyTags, 'summoner-defense');
        }
        if (summary.attackReadyCount > 0 || summary.enemySummonerPressureCount > 0) {
            pushStrategyTag(strategyTags, 'summoner-pressure');
        }
    };

    for (const effect of abilityDef.effects) {
        switch (effect.type) {
            case 'addCharge':
                if (effect.target === 'self') {
                    metadata.selfChargeGain = (metadata.selfChargeGain as number) + effect.value;
                } else if (effect.target === 'adjacentAllies' || effect.target === 'allAllies') {
                    applyFriendlyTargetSemantics(effect.target);
                }
                break;
            case 'heal':
            case 'modifyStrength':
            case 'modifyLife':
            case 'grantExtraAttack':
                if (effect.target === 'adjacentAllies' || effect.target === 'allAllies') {
                    applyFriendlyTargetSemantics(effect.target);
                }
                break;
            default:
                break;
        }
    }

    return {
        strategyTags,
        metadata,
    };
};

const buildInteractionActions = (
    state: SummonerWarsState,
    playerId: PlayerId,
): AiLegalAction[] | null => {
    const current = state.sys.interaction?.current as EngineInteractionDescriptor | undefined;
    if (!current) return null;
    if (current.playerId !== playerId) return [];

    if (current.kind === 'simple-choice') {
        const data = current.data as {
            options?: SummonerWarsInteractionOption[];
            multi?: PromptMultiConfig;
        };
        const allOptions = data.options ?? [];
        const availableOptions = allOptions.filter((option): option is Required<Pick<SummonerWarsInteractionOption, 'id'>> & SummonerWarsInteractionOption => {
            return typeof option?.id === 'string' && option.disabled !== true;
        });
        const minCount = typeof data.multi?.min === 'number' ? data.multi.min : 1;
        const rawMaxCount = typeof data.multi?.max === 'number'
            ? data.multi.max
            : availableOptions.length;
        const maxCount = Math.max(minCount, Math.min(rawMaxCount, availableOptions.length));
        const actions: AiLegalAction[] = [];

        if (data.multi) {
            if (minCount === 0) {
                actions.push({
                    actionId: createAiLegalActionId('interaction', current.id, 'empty-selection'),
                    kind: 'interaction-choice',
                    label: '不选择任何项',
                    commands: [{
                        type: 'SYS_INTERACTION_RESPOND',
                        payload: { interactionId: current.id, optionIds: [] },
                    }],
                    aiHints: [OPTIONAL_SKIP_AI_HINT],
                    metadata: {
                        interactionId: current.id,
                        optionIds: [],
                    },
                });
            }

            if (maxCount > 0 && availableOptions.length > 0) {
                const combos = buildOptionCombinations(
                    availableOptions.map((option) => option.id),
                    Math.max(1, minCount),
                    Math.max(Math.max(1, minCount), maxCount),
                );
                actions.push(...combos.map((combo, index) => {
                    const aiHints = combo.flatMap((optionId) => {
                        const option = availableOptions.find((candidate) => candidate.id === optionId);
                        return option ? buildInteractionOptionAiHints(state, playerId, current, option) : [];
                    });
                    return {
                        actionId: createAiLegalActionId('interaction', current.id, ...combo),
                        kind: 'interaction-choice',
                        label: `交互组合 ${index + 1}`,
                        commands: [{
                            type: 'SYS_INTERACTION_RESPOND',
                            payload: buildSimpleChoicePayload(current.id, combo, data.multi),
                        }],
                        ...(aiHints.length > 0 ? { aiHints } : {}),
                        metadata: {
                            interactionId: current.id,
                            optionIds: combo,
                        },
                    };
                }));
            }
        } else {
            actions.push(...availableOptions.map((option, index) => {
                const aiHints = buildInteractionOptionAiHints(state, playerId, current, option);
                // 提取交互值中的位置信息和动作类型，用于位置感知评分
                const optionValue = option.value as { action?: string; targetPosition?: CellCoord; position?: CellCoord; newPosition?: CellCoord } | undefined;
                const interactionAction = optionValue?.action;
                const interactionTargetPosition = optionValue?.targetPosition ?? optionValue?.position ?? optionValue?.newPosition;
                return {
                    actionId: createAiLegalActionId('interaction', current.id, option.id),
                    kind: 'interaction-choice',
                    label: option.label ?? `交互选择 ${index + 1}`,
                    commands: [{
                        type: 'SYS_INTERACTION_RESPOND',
                        payload: buildSimpleChoicePayload(current.id, [option.id], data.multi, option.value),
                    }],
                    ...(aiHints.length > 0 ? { aiHints } : {}),
                    metadata: {
                        interactionId: current.id,
                        optionId: option.id,
                        optionValue: option.value,
                        interactionAction,
                        interactionTargetPosition,
                    },
                };
            }));
        }

        if (actions.length > 0) {
            return actions;
        }

        return [buildEmergencyInteractionFallbackAction(
            current,
            resolveSimpleChoiceFallbackReason(allOptions, data.multi),
        )];
    }

    if (current.kind === 'multistep-choice') {
        return [
            {
                actionId: createAiLegalActionId('interaction', current.id, 'confirm'),
                kind: 'interaction-confirm',
                label: '确认交互',
                commands: [{
                    type: 'SYS_INTERACTION_CONFIRM',
                    payload: { interactionId: current.id },
                }],
                metadata: { interactionId: current.id },
            },
            {
                actionId: createAiLegalActionId('interaction', current.id, 'cancel'),
                kind: 'interaction-cancel',
                label: '取消交互',
                commands: [{
                    type: 'SYS_INTERACTION_CANCEL',
                    payload: { interactionId: current.id },
                }],
                metadata: { interactionId: current.id },
            },
        ];
    }

    return buildAiOwnedBlockingInteractionFallbackActions({
        playerId,
        state: state as MatchState<unknown>,
        legalActions: [],
        adapterInteractionKinds: SUMMONER_WARS_AI_INTERACTION_ADAPTER_KINDS,
    });
};

const buildSetupActions = (
    state: SummonerWarsState,
    playerId: PlayerId,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const selectedFaction = state.core.selectedFactions[playerId];
    const isHost = playerId === state.core.hostPlayerId;
    const isReady = state.core.readyPlayers[playerId];

    if (!selectedFaction || selectedFaction === 'unselected') {
        const takenFactions = new Set<FactionId>();
        for (const value of Object.values(state.core.selectedFactions)) {
            if (value && value !== 'unselected') {
                takenFactions.add(value as FactionId);
            }
        }
        const candidates = SETUP_FACTION_POOL.filter((factionId) => !takenFactions.has(factionId));
        const availableFactions = candidates.length > 0 ? candidates : SETUP_FACTION_POOL;

        for (const factionId of availableFactions) {
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('setup', 'select-faction', factionId),
                kind: 'setup-select-faction',
                label: `选择阵营 ${factionId}`,
                commands: [{
                    type: SW_COMMANDS.SELECT_FACTION,
                    payload: { factionId },
                }],
                metadata: {
                    factionId,
                },
            });
        }
        return actions;
    }

    if (!isHost && !isReady) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('setup', 'player-ready'),
            kind: 'setup-ready',
            label: '准备完成',
            commands: [{
                type: SW_COMMANDS.PLAYER_READY,
                payload: {},
            }],
        });
    }

    if (isHost) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('setup', 'host-start'),
            kind: 'setup-host-start',
            label: '开始游戏',
            commands: [{
                type: SW_COMMANDS.HOST_START_GAME,
                payload: {},
            }],
        });
    }

    return actions;
};

const buildActivatedAbilityActions = (
    state: SummonerWarsState,
    playerId: PlayerId,
    phase: GamePhase,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const units = getPlayerUnits(state.core, playerId);

    for (const unit of units) {
        const abilityIds = getActivatableAbilities(unit, phase, state.core);
        for (const abilityId of abilityIds) {
            const abilityDef = abilityRegistry.get(abilityId);
            if (!abilityDef) continue;
            if (abilityDef.trigger !== 'activated') continue;
            if (!canActivateAbility(state.core, unit, abilityId, playerId)) continue;
            const semantics = buildActivatedAbilitySemantics({
                state,
                playerId,
                unit,
                abilityDef,
            });

            if (!abilityDef.requiresTargetSelection) {
                appendAction(actions, state, playerId, {
                    actionId: createAiLegalActionId('activate-ability', unit.instanceId, abilityId),
                    kind: 'activate-ability',
                    label: `发动技能 ${abilityDef.name}`,
                    commands: [{
                        type: SW_COMMANDS.ACTIVATE_ABILITY,
                        payload: {
                            abilityId,
                            sourceUnitId: unit.instanceId,
                        },
                    }],
                    metadata: withAiActionStrategyTags({
                        ...semantics.metadata,
                        sourceUnitId: unit.instanceId,
                        sourcePosition: unit.position,
                    }, semantics.strategyTags),
                });
                continue;
            }

            const targetSelection = abilityDef.targetSelection;
            if (!targetSelection || !supportsDirectTargetSelectionAiExpansion(abilityDef)) continue;
            const ownSummoner = getSummoner(state.core, playerId);
            const enemySummoner = getSummoner(state.core, getEnemyPlayerId(playerId));

            if (targetSelection.type === 'unit') {
                const targets = getAllBoardUnitTargets(state.core);
                for (const target of targets) {
                    const targetUnit = target.unit;
                    const targetLifeRemaining = targetUnit.card.life - targetUnit.damage;
                    const distanceToOwnSummoner = ownSummoner ? manhattanDistance(target.position, ownSummoner.position) : 99;
                    const distanceToEnemySummoner = enemySummoner ? manhattanDistance(target.position, enemySummoner.position) : 99;
                    const strategyTags = [...semantics.strategyTags];
                    if (targetUnit.owner === playerId) {
                        pushStrategyTag(strategyTags, 'board-control');
                        if (targetUnit.card.unitClass === 'summoner') {
                            pushStrategyTag(strategyTags, 'summoner-defense');
                        }
                    } else {
                        pushStrategyTag(strategyTags, 'summoner-pressure');
                    }

                    appendAction(actions, state, playerId, {
                        actionId: createAiLegalActionId(
                            'activate-ability',
                            unit.instanceId,
                            abilityId,
                            target.position.row,
                            target.position.col,
                        ),
                        kind: 'activate-ability',
                        label: `发动技能 ${abilityDef.name} → ${targetUnit.card.name}`,
                        commands: [{
                            type: SW_COMMANDS.ACTIVATE_ABILITY,
                            payload: {
                                abilityId,
                                sourceUnitId: unit.instanceId,
                                targetPosition: target.position,
                            },
                        }],
                        metadata: withAiActionStrategyTags({
                            ...semantics.metadata,
                            sourceUnitId: unit.instanceId,
                            sourcePosition: unit.position,
                            targetPosition: target.position,
                            targetOwner: targetUnit.owner,
                            targetType: targetUnit.card.unitClass,
                            targetUnitClass: targetUnit.card.unitClass,
                            targetLifeRemaining,
                            distanceToOwnSummoner,
                            distanceToEnemySummoner,
                        }, strategyTags),
                    });
                }
                continue;
            }

            if (targetSelection.type === 'position') {
                const positions = getAllBoardPositions();
                for (const targetPosition of positions) {
                    const targetUnit = getUnitAt(state.core, targetPosition);
                    const targetStructure = getStructureAt(state.core, targetPosition);
                    const targetType = targetUnit
                        ? targetUnit.card.unitClass
                        : targetStructure
                            ? 'structure'
                            : 'position';
                    const targetOwner = targetUnit?.owner ?? targetStructure?.owner;
                    const targetLifeRemaining = targetUnit
                        ? targetUnit.card.life - targetUnit.damage
                        : targetStructure
                            ? targetStructure.card.life - targetStructure.damage
                            : undefined;
                    const distanceToOwnSummoner = ownSummoner ? manhattanDistance(targetPosition, ownSummoner.position) : 99;
                    const distanceToEnemySummoner = enemySummoner ? manhattanDistance(targetPosition, enemySummoner.position) : 99;
                    const strategyTags = [...semantics.strategyTags];
                    if (targetOwner === playerId) {
                        pushStrategyTag(strategyTags, 'board-control');
                    } else if (targetOwner) {
                        pushStrategyTag(strategyTags, 'summoner-pressure');
                    }

                    appendAction(actions, state, playerId, {
                        actionId: createAiLegalActionId(
                            'activate-ability',
                            unit.instanceId,
                            abilityId,
                            targetPosition.row,
                            targetPosition.col,
                        ),
                        kind: 'activate-ability',
                        label: `发动技能 ${abilityDef.name} → (${targetPosition.row},${targetPosition.col})`,
                        commands: [{
                            type: SW_COMMANDS.ACTIVATE_ABILITY,
                            payload: {
                                abilityId,
                                sourceUnitId: unit.instanceId,
                                targetPosition,
                            },
                        }],
                        metadata: withAiActionStrategyTags({
                            ...semantics.metadata,
                            sourceUnitId: unit.instanceId,
                            sourcePosition: unit.position,
                            targetPosition,
                            targetOwner,
                            targetType,
                            targetUnitClass: targetUnit?.card.unitClass,
                            targetLifeRemaining,
                            distanceToOwnSummoner,
                            distanceToEnemySummoner,
                        }, strategyTags),
                    });
                }
            }
        }
    }

    return actions;
};

const buildSummonActions = (
    state: SummonerWarsState,
    playerId: PlayerId,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const player = state.core.players[playerId];
    const summonPositions = getAiValidSummonPositions(state.core, playerId);
    const enemySummoner = getSummoner(state.core, getEnemyPlayerId(playerId));
    const ownSummoner = getSummoner(state.core, playerId);
    const threat = estimateSummonerThreat(state.core, playerId);
    const ownGates = getPlayerGates(state.core, playerId);

    for (const card of player.hand) {
        if (card.cardType !== 'unit') continue;
        for (const position of summonPositions) {
            const distanceToEnemySummoner = enemySummoner ? manhattanDistance(position, enemySummoner.position) : 99;
            const distanceToOwnSummoner = ownSummoner ? manhattanDistance(position, ownSummoner.position) : 99;
            const centerScore = getCenterScore(position);
            // 检查是否在前推传送门附近召唤（非起始城门）
            const nearForwardGate = ownGates.some(gate => {
                if ((gate.card as import('./domain/types').StructureCard).isStartingGate) return false;
                return manhattanDistance(position, gate.position) <= 1
                    && getFrontRowScore(gate.position, playerId) >= 3;
            });
            const strategyTags = buildSummonStrategyTags({
                distanceToEnemySummoner,
                distanceToOwnSummoner,
                centerScore,
            });
            if (nearForwardGate) {
                pushStrategyTag(strategyTags, 'gate-push');
            }
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('summon-unit', card.id, position.row, position.col),
                kind: 'summon-unit',
                label: `召唤 ${card.name}`,
                commands: [{
                    type: SW_COMMANDS.SUMMON_UNIT,
                    payload: {
                        cardId: card.id,
                        position,
                    },
                }],
                metadata: withAiActionStrategyTags({
                    cardId: card.id,
                    cardName: card.name,
                    cost: card.cost,
                    strength: card.strength,
                    life: card.life,
                    position,
                    centerScore,
                    distanceToEnemySummoner,
                    distanceToOwnSummoner,
                    nearForwardGate,
                    remainingLife: threat.remainingLife,
                    directThreatDamage: threat.directThreatDamage,
                    nearbyEnemyPressure: threat.nearbyEnemyPressure,
                }, strategyTags),
            });
        }
    }

    return actions;
};

const buildMoveActions = (
    state: SummonerWarsState,
    playerId: PlayerId,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const enemySummoner = getSummoner(state.core, getEnemyPlayerId(playerId));
    const ownSummoner = getSummoner(state.core, playerId);
    const threatBefore = estimateSummonerThreat(state.core, playerId);
    const ownGates = getPlayerGates(state.core, playerId);

    for (const unit of getPlayerUnits(state.core, playerId)) {
        const targets = getValidMoveTargetsEnhanced(state.core, unit.position);
        for (const to of targets) {
            const movedCore = cloneCoreWithMovedUnit(state.core, unit.position, to);
            const attackTargetsAfterMove = movedCore ? getValidAttackTargetsEnhanced(movedCore, to).length : 0;
            const threatAfter = movedCore ? estimateSummonerThreat(movedCore, playerId) : threatBefore;
            const distanceToEnemySummonerBefore = enemySummoner ? manhattanDistance(unit.position, enemySummoner.position) : 99;
            const distanceToEnemySummonerAfter = enemySummoner ? manhattanDistance(to, enemySummoner.position) : 99;
            const distanceToOwnSummonerBefore = ownSummoner ? manhattanDistance(unit.position, ownSummoner.position) : 99;
            const distanceToOwnSummonerAfter = ownSummoner
                ? (unit.card.unitClass === 'summoner' ? 0 : manhattanDistance(to, ownSummoner.position))
                : 99;
            const centerScore = getCenterScore(to);
            // 移动后是否靠近己方前推传送门（用于保护传送门或配合战术）
            const nearOwnGateAfterMove = ownGates.some(gate => {
                if ((gate.card as import('./domain/types').StructureCard).isStartingGate) return false;
                return manhattanDistance(to, gate.position) <= 1
                    && getFrontRowScore(gate.position, playerId) >= 3;
            });
            const strategyTags = buildMoveStrategyTags({
                attackTargetsAfterMove,
                distanceToEnemySummonerBefore,
                distanceToEnemySummonerAfter,
                distanceToOwnSummonerBefore,
                distanceToOwnSummonerAfter,
                directThreatDamageBefore: threatBefore.directThreatDamage,
                directThreatDamageAfter: threatAfter.directThreatDamage,
                nearbyEnemyPressureBefore: threatBefore.nearbyEnemyPressure,
                nearbyEnemyPressureAfter: threatAfter.nearbyEnemyPressure,
                centerScore,
            });
            if (nearOwnGateAfterMove) {
                pushStrategyTag(strategyTags, 'gate-push');
            }
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('move-unit', unit.instanceId, to.row, to.col),
                kind: 'move-unit',
                label: `移动 ${unit.card.name}`,
                commands: [{
                    type: SW_COMMANDS.MOVE_UNIT,
                    payload: {
                        from: unit.position,
                        to,
                    },
                }],
                metadata: withAiActionStrategyTags({
                    sourceUnitId: unit.instanceId,
                    from: unit.position,
                    to,
                    attackTargetsAfterMove,
                    distanceToEnemySummonerBefore,
                    distanceToEnemySummonerAfter,
                    centerScore,
                    attackType: unit.card.attackType,
                    sourceUnitClass: unit.card.unitClass,
                    sourceIsSummoner: unit.card.unitClass === 'summoner',
                    distanceToOwnSummonerBefore,
                    distanceToOwnSummonerAfter,
                    nearOwnGateAfterMove,
                    remainingLifeBefore: threatBefore.remainingLife,
                    directThreatDamageBefore: threatBefore.directThreatDamage,
                    nearbyEnemyPressureBefore: threatBefore.nearbyEnemyPressure,
                    directThreatDamageAfter: threatAfter.directThreatDamage,
                    nearbyEnemyPressureAfter: threatAfter.nearbyEnemyPressure,
                }, strategyTags),
            });
        }
    }

    return actions;
};

const buildStructureStrategyTags = (args: {
    isGate: boolean;
    distanceToOwnSummoner: number;
    distanceToEnemySummoner: number;
    centerScore: number;
    frontRowScore: number;
    blocksEnemySummon: number;
}): SummonerWarsStrategyTag[] => {
    const tags: SummonerWarsStrategyTag[] = [];
    if (args.isGate) {
        // 传送门：前推 = 扩展召唤范围 = 进攻性
        if (args.frontRowScore >= 3) {
            pushStrategyTag(tags, 'gate-push');
            pushStrategyTag(tags, 'summoner-pressure');
        }
        if (args.distanceToEnemySummoner <= 4) {
            pushStrategyTag(tags, 'summoner-pressure');
        }
        // 阻挡敌方召唤位是传送门的核心战术价值（攻略：堵住敌方召唤格）
        if (args.blocksEnemySummon > 0) {
            pushStrategyTag(tags, 'gate-push');
            pushStrategyTag(tags, 'board-control');
        }
        if (args.centerScore >= 2) {
            pushStrategyTag(tags, 'board-control');
        }
    } else {
        // 防御建筑：靠近召唤师 = 防御性
        if (args.distanceToOwnSummoner <= 1) {
            pushStrategyTag(tags, 'summoner-defense');
        }
        if (args.centerScore >= 2) {
            pushStrategyTag(tags, 'board-control');
        }
    }
    return tags;
};

const buildStructureActions = (
    state: SummonerWarsState,
    playerId: PlayerId,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const player = state.core.players[playerId];
    const buildPositions = getValidBuildPositions(state.core, playerId);
    const ownSummoner = getSummoner(state.core, playerId);
    const enemySummoner = getSummoner(state.core, getEnemyPlayerId(playerId));
    const threat = estimateSummonerThreat(state.core, playerId);
    const enemyPlayerId = getEnemyPlayerId(playerId);
    const enemySummonPositions = new Set(
        getAiValidSummonPositions(state.core, enemyPlayerId).map(p => `${p.row},${p.col}`),
    );

    for (const card of player.hand) {
        if (card.cardType !== 'structure') continue;
        const isGate = (card as import('./domain/types').StructureCard).isGate === true
            && (card as import('./domain/types').StructureCard).isStartingGate !== true;
        for (const position of buildPositions) {
            const distanceToOwnSummoner = ownSummoner ? manhattanDistance(position, ownSummoner.position) : 99;
            const distanceToEnemySummoner = enemySummoner ? manhattanDistance(position, enemySummoner.position) : 99;
            const centerScore = getCenterScore(position);
            const frontRowScore = getFrontRowScore(position, playerId);
            const summonRangeExtension = isGate ? getSummonRangeExtension(state.core, playerId, position) : 0;
            // 放置后是否阻挡敌方召唤位（攻略核心战术：用传送门堵住敌方召唤格）
            let blocksEnemySummon = 0;
            if (isGate) {
                for (const adj of getAdjacentCells(position)) {
                    if (enemySummonPositions.has(`${adj.row},${adj.col}`)) {
                        blocksEnemySummon++;
                    }
                }
            }
            const strategyTags = buildStructureStrategyTags({
                isGate,
                distanceToOwnSummoner,
                distanceToEnemySummoner,
                centerScore,
                frontRowScore,
                blocksEnemySummon,
            });
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('build-structure', card.id, position.row, position.col),
                kind: 'build-structure',
                label: `建造 ${card.name}`,
                commands: [{
                    type: SW_COMMANDS.BUILD_STRUCTURE,
                    payload: {
                        cardId: card.id,
                        position,
                    },
                }],
                metadata: withAiActionStrategyTags({
                    cardId: card.id,
                    cost: card.cost,
                    life: card.life,
                    isGate,
                    position,
                    centerScore,
                    frontRowScore,
                    summonRangeExtension,
                    blocksEnemySummon,
                    distanceToOwnSummoner,
                    distanceToEnemySummoner,
                    remainingLife: threat.remainingLife,
                    directThreatDamage: threat.directThreatDamage,
                    nearbyEnemyPressure: threat.nearbyEnemyPressure,
                }, strategyTags),
            });
        }
    }

    return actions;
};

const buildAttackActions = (
    state: SummonerWarsState,
    playerId: PlayerId,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const threat = estimateSummonerThreat(state.core, playerId);
    const threateningEnemyIds = new Set(threat.threateningEnemyIds);

    for (const unit of getPlayerUnits(state.core, playerId)) {
        const targets = getValidAttackTargetsEnhanced(state.core, unit.position);
        for (const target of targets) {
            const targetUnit = getUnitAt(state.core, target);
            const targetStructure = getStructureAt(state.core, target);
            const targetType = targetUnit
                ? targetUnit.card.unitClass
                : targetStructure
                    ? 'structure'
                    : 'unknown';
            const targetLifeRemaining = targetUnit
                ? targetUnit.card.life - targetUnit.damage
                : targetStructure
                    ? targetStructure.card.life - targetStructure.damage
                    : 0;
            const targetIsThreateningSummoner = targetUnit ? threateningEnemyIds.has(targetUnit.instanceId) : false;
            const targetIsGate = targetStructure ? (targetStructure.card.isGate === true) : false;
            const strategyTags = buildAttackStrategyTags({
                targetType,
                targetIsThreateningSummoner,
                targetIsGate,
            });
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('declare-attack', unit.instanceId, target.row, target.col),
                kind: 'declare-attack',
                label: `攻击 ${targetUnit?.card.name ?? targetStructure?.card.name ?? '目标'}`,
                commands: [{
                    type: SW_COMMANDS.DECLARE_ATTACK,
                    payload: {
                        attacker: unit.position,
                        target,
                    },
                }],
                metadata: withAiActionStrategyTags({
                    sourceUnitId: unit.instanceId,
                    sourceUnitClass: unit.card.unitClass,
                    sourceIsSummoner: unit.card.unitClass === 'summoner',
                    attacker: unit.position,
                    target,
                    attackerStrength: unit.card.strength,
                    attackType: unit.card.attackType,
                    targetType,
                    targetLifeRemaining,
                    lethalLikely: unit.card.strength >= targetLifeRemaining,
                    targetOwner: targetUnit?.owner ?? targetStructure?.owner,
                    targetIsThreateningSummoner,
                    targetIsGate,
                    remainingLife: threat.remainingLife,
                    directThreatDamage: threat.directThreatDamage,
                    nearbyEnemyPressure: threat.nearbyEnemyPressure,
                }, strategyTags),
            });
        }
    }

    return actions;
};

const buildMagicActions = (
    state: SummonerWarsState,
    playerId: PlayerId,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const player = state.core.players[playerId];

    for (const card of player.hand) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('discard-for-magic', card.id),
            kind: 'discard-for-magic',
            label: `弃置 ${card.name} 换魔力`,
            commands: [{
                type: SW_COMMANDS.DISCARD_FOR_MAGIC,
                payload: { cardIds: [card.id] },
            }],
            metadata: withAiActionStrategyTags({
                cardId: card.id,
                cardType: card.cardType,
                keepValue: getCardKeepValue(card),
            }, ['economy']),
        });
    }

    return actions;
};

const buildEndPhaseAction = (
    state: SummonerWarsState,
    playerId: PlayerId,
): AiLegalAction => ({
    actionId: createAiLegalActionId('advance-phase', getCurrentPhase(state), playerId),
    kind: 'advance-phase',
    label: '结束当前阶段',
    commands: [{
        type: FLOW_COMMANDS.ADVANCE_PHASE,
        payload: {},
    }],
    metadata: {
        phase: getCurrentPhase(state),
    },
});

const buildFlowHaltedPhaseEndAbilityActions = (
    state: SummonerWarsState,
    playerId: PlayerId,
    phase: GamePhase,
): AiLegalAction[] => {
    if (!isFlowHalted(state)) {
        return [];
    }

    const pendingAbilityIds = PHASE_END_ABILITIES[phase] ?? [];
    if (pendingAbilityIds.length === 0) {
        return [];
    }

    const actions: AiLegalAction[] = [];
    for (const unit of getPlayerUnits(state.core, playerId)) {
        const unitAbilityIds = getUnitAbilities(unit, state.core);
        for (const abilityId of pendingAbilityIds) {
            if (!unitAbilityIds.includes(abilityId)) continue;
            if (!canActivateAbility(state.core, unit, abilityId, playerId)) continue;

            const abilityDef = abilityRegistry.get(abilityId);
            if (!abilityDef) continue;

            if (abilityId === 'ice_shards') {
                appendAction(actions, state, playerId, {
                    actionId: createAiLegalActionId('activate-ability', unit.instanceId, abilityId, 'flow-halted'),
                    kind: 'activate-ability',
                    label: `结算阶段技能 ${abilityDef.name}`,
                    commands: [{
                        type: SW_COMMANDS.ACTIVATE_ABILITY,
                        payload: {
                            abilityId,
                            sourceUnitId: unit.instanceId,
                        },
                    }],
                    metadata: withAiActionStrategyTags({
                        sourceUnitId: unit.instanceId,
                        sourcePosition: unit.position,
                        flowHalted: true,
                        phase,
                    }, ['board-control']),
                });
                continue;
            }

            if (abilityId === 'feed_beast') {
                const adjacentAllies = getAdjacentCells(unit.position)
                    .map((position) => {
                        const targetUnit = getUnitAt(state.core, position);
                        return targetUnit && targetUnit.owner === playerId && targetUnit.instanceId !== unit.instanceId
                            ? { position, unit: targetUnit }
                            : null;
                    })
                    .filter((entry): entry is { position: CellCoord; unit: NonNullable<ReturnType<typeof getUnitAt>> } => entry !== null);

                for (const adjacent of adjacentAllies) {
                    appendAction(actions, state, playerId, {
                        actionId: createAiLegalActionId(
                            'activate-ability',
                            unit.instanceId,
                            abilityId,
                            'destroy_adjacent',
                            adjacent.position.row,
                            adjacent.position.col,
                        ),
                        kind: 'activate-ability',
                        label: `结算阶段技能 ${abilityDef.name} → 吞噬相邻友军`,
                        commands: [{
                            type: SW_COMMANDS.ACTIVATE_ABILITY,
                            payload: {
                                abilityId,
                                sourceUnitId: unit.instanceId,
                                choice: 'destroy_adjacent',
                                targetPosition: adjacent.position,
                            },
                        }],
                        metadata: withAiActionStrategyTags({
                            sourceUnitId: unit.instanceId,
                            sourcePosition: unit.position,
                            targetPosition: adjacent.position,
                            targetOwner: adjacent.unit.owner,
                            targetUnitClass: adjacent.unit.card.unitClass,
                            flowHalted: true,
                            phase,
                        }, ['board-control']),
                    });
                }

                appendAction(actions, state, playerId, {
                    actionId: createAiLegalActionId('activate-ability', unit.instanceId, abilityId, 'self_destroy'),
                    kind: 'activate-ability',
                    label: `结算阶段技能 ${abilityDef.name} → 自毁`,
                    commands: [{
                        type: SW_COMMANDS.ACTIVATE_ABILITY,
                        payload: {
                            abilityId,
                            sourceUnitId: unit.instanceId,
                            choice: 'self_destroy',
                        },
                    }],
                    metadata: withAiActionStrategyTags({
                        sourceUnitId: unit.instanceId,
                        sourcePosition: unit.position,
                        flowHalted: true,
                        phase,
                    }, ['summoner-defense']),
                });
            }
        }
    }

    return actions;
};

const buildEventCardActions = (
    state: SummonerWarsState,
    playerId: PlayerId,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const player = state.core.players[playerId];

    for (const card of player.hand) {
        if (card.cardType !== 'event') continue;
        const baseId = getBaseCardId(card.id);
        const commandType = INTERACTIVE_EVENT_BASE_IDS.has(baseId)
            ? SW_COMMANDS.REQUEST_EVENT_INTERACTION
            : SW_COMMANDS.PLAY_EVENT;

        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('play-event', commandType, card.id),
            kind: 'play-event',
            label: `打出事件 ${card.name}`,
            commands: [{
                type: commandType,
                payload: { cardId: card.id },
            }],
            metadata: withAiActionStrategyTags({
                cardId: card.id,
                baseId,
                playPhase: card.playPhase,
                interaction: commandType === SW_COMMANDS.REQUEST_EVENT_INTERACTION,
            }, ['ability-tempo']),
        });
    }

    return actions;
};

const hasRekindleHopeActive = (
    state: SummonerWarsState,
    playerId: PlayerId,
): boolean => state.core.players[playerId].activeEvents.some((eventCard) => (
    getBaseCardId(eventCard.id) === CARD_IDS.PALADIN_REKINDLE_HOPE
));

export function buildSummonerWarsAiLegalActions(args: {
    playerId: EnginePlayerId;
    state: MatchState<unknown>;
}): AiLegalAction[] {
    const state = args.state as SummonerWarsState;
    const playerId = asSummonerWarsPlayerId(args.playerId);
    if (!playerId) return [];
    const interactionActions = buildInteractionActions(state, playerId);
    if (interactionActions !== null) {
        return interactionActions.filter((action) =>
            action.commands.every((command) => isCommandValid(state, playerId, command.type, command.payload)),
        );
    }

    const phase = getCurrentPhase(state);
    if (phase === 'setup') {
        return buildSetupActions(state, playerId);
    }

    if (state.core.currentPlayer !== playerId) {
        return [];
    }

    const pendingActiveEventActions = buildPendingActiveEventActions(state, playerId);
    if (pendingActiveEventActions.length > 0) {
        return pendingActiveEventActions;
    }

    const flowHaltedActions = buildFlowHaltedPhaseEndAbilityActions(state, playerId, phase);
    if (flowHaltedActions.length > 0) {
        return flowHaltedActions;
    }
    const canSummonThisPhase = phase === 'summon' || hasRekindleHopeActive(state, playerId);

    switch (phase) {
        case 'summon':
            return [
                ...buildActivatedAbilityActions(state, playerId, phase),
                ...buildEventCardActions(state, playerId),
                ...buildSummonActions(state, playerId),
                buildEndPhaseAction(state, playerId),
            ];
        case 'move':
            return [
                ...buildActivatedAbilityActions(state, playerId, phase),
                ...buildEventCardActions(state, playerId),
                ...(canSummonThisPhase ? buildSummonActions(state, playerId) : []),
                ...buildMoveActions(state, playerId),
                buildEndPhaseAction(state, playerId),
            ];
        case 'build':
            return [
                ...buildActivatedAbilityActions(state, playerId, phase),
                ...buildEventCardActions(state, playerId),
                ...(canSummonThisPhase ? buildSummonActions(state, playerId) : []),
                ...buildStructureActions(state, playerId),
                buildEndPhaseAction(state, playerId),
            ];
        case 'attack':
            return [
                ...buildActivatedAbilityActions(state, playerId, phase),
                ...buildEventCardActions(state, playerId),
                ...(canSummonThisPhase ? buildSummonActions(state, playerId) : []),
                ...buildAttackActions(state, playerId),
                buildEndPhaseAction(state, playerId),
            ];
        case 'magic':
            return [
                ...buildEventCardActions(state, playerId),
                ...(canSummonThisPhase ? buildSummonActions(state, playerId) : []),
                ...buildMagicActions(state, playerId),
                buildEndPhaseAction(state, playerId),
            ];
        case 'draw':
        default:
            return [buildEndPhaseAction(state, playerId)];
    }
}

const actionKindScorer = createActionKindScorer('action-kind', {
    'interaction-choice': 240,
    'interaction-confirm': 180,
    'interaction-cancel': -40,
    'setup-select-faction': 140,
    'setup-ready': 170,
    'setup-host-start': 220,
    'summon-unit': 130,
    'move-unit': 90,
    'build-structure': 80,
    'declare-attack': 210,
    'play-event': 85,
    'activate-ability': 110,
    'discard-for-magic': 25,
    'advance-phase': -80,
});

const interactionScorer: LocalAiActionScorer = {
    id: 'interaction-priority',
    score(_context, action) {
        if (action.kind !== 'interaction-choice') return null;
        const optionId = String(action.metadata?.optionId ?? '').toLowerCase();
        if (optionId.includes('confirm') || optionId.includes('accept') || optionId.includes('yes')) {
            return { score: 30, reason: '优先确认当前可执行的交互分支' };
        }
        if (optionId.includes('cancel') || optionId.includes('skip') || optionId.includes('pass')) {
            return { score: -20, reason: '能执行效果时尽量不直接跳过交互' };
        }
        return 5;
    },
};

const interactionHintScorer = createInteractionHintScorer({
    id: 'interaction-ai-hints',
    actionKinds: ['interaction-choice'],
    skipPenaltyWhenAlternativesExist: 35,
});

/** 交互位置感知评分：grab_follow/soul_transfer/mind_capture 等涉及位置选择的交互 */
const interactionPositionScorer: LocalAiActionScorer = {
    id: 'interaction-position',
    score(context, action) {
        if (action.kind !== 'interaction-choice') return null;
        const targetPosition = action.metadata?.interactionTargetPosition as CellCoord | undefined;
        const interactionAction = String(action.metadata?.interactionAction ?? '');
        if (!targetPosition) return null;

        const playerId = asSummonerWarsPlayerId(context.playerId);
        if (!playerId) return null;
        const state = context.visibleState as SummonerWarsState;
        const enemySummoner = getSummoner(state.core, getEnemyPlayerId(playerId));

        // grab_follow：抓附手跟随友方 → 前推价值高
        if (interactionAction === 'grab_follow') {
            const frontRowScore = getFrontRowScore(targetPosition, playerId);
            const centerScore = getCenterScore(targetPosition);
            const distanceToEnemySummoner = enemySummoner ? manhattanDistance(targetPosition, enemySummoner.position) : 99;
            return {
                score: frontRowScore * 8 + centerScore * 3 + Math.max(0, 8 - distanceToEnemySummoner) * 2,
                reason: frontRowScore >= 4
                    ? '抓附跟随到前排位置'
                    : '抓附跟随到更有利位置',
            };
        }

        // soul_transfer：灵魂转移 → 靠近敌方召唤师更有威胁
        if (interactionAction === 'soul_transfer') {
            const distanceToEnemySummoner = enemySummoner ? manhattanDistance(targetPosition, enemySummoner.position) : 99;
            const centerScore = getCenterScore(targetPosition);
            return {
                score: centerScore * 3 + Math.max(0, 8 - distanceToEnemySummoner) * 4,
                reason: '灵魂转移到更有威胁的位置',
            };
        }

        // mind_capture：心灵控制 → 取决于控制还是伤害
        if (interactionAction === 'mind_capture') {
            const distanceToEnemySummoner = enemySummoner ? manhattanDistance(targetPosition, enemySummoner.position) : 99;
            const centerScore = getCenterScore(targetPosition);
            return {
                score: centerScore * 3 + Math.max(0, 8 - distanceToEnemySummoner) * 3,
                reason: '心灵控制选择更有利位置',
            };
        }

        // glacial_shift_destination：冰霜移动 → 前推或控场
        if (interactionAction === 'glacial_shift_destination' || interactionAction === 'glacial_shift_building') {
            const frontRowScore = getFrontRowScore(targetPosition, playerId);
            const centerScore = getCenterScore(targetPosition);
            return {
                score: frontRowScore * 5 + centerScore * 3,
                reason: '冰霜移动到更有利位置',
            };
        }

        // sneak_destination：潜行 → 靠近敌方召唤师
        if (interactionAction === 'sneak_destination') {
            const distanceToEnemySummoner = enemySummoner ? manhattanDistance(targetPosition, enemySummoner.position) : 99;
            return {
                score: Math.max(0, 8 - distanceToEnemySummoner) * 6,
                reason: '潜行到接近敌方召唤师的位置',
            };
        }

        // 通用位置评分
        const frontRowScore = getFrontRowScore(targetPosition, playerId);
        const centerScore = getCenterScore(targetPosition);
        return {
            score: frontRowScore * 4 + centerScore * 2,
            reason: '选择更有战略价值的位置',
        };
    },
};

const interactionSemanticScorer: LocalAiActionScorer = {
    id: 'interaction-semantic',
    score(context, action) {
        if (action.kind !== 'interaction-choice') return null;
        const optionValue = asOptionValueRecord(action.metadata?.optionValue);
        if (!optionValue) return null;

        const state = context.visibleState as SummonerWarsState;
        const playerId = asSummonerWarsPlayerId(context.playerId);
        if (!playerId) return null;

        const interactionAction = readOptionValueString(optionValue, 'action');
        if (interactionAction === 'mind_capture') {
            const targetPosition = readOptionValuePosition(optionValue, 'targetPosition');
            const choice = readOptionValueString(optionValue, 'choice');
            if (!targetPosition || !choice) return null;

            const targetUnit = getUnitAt(state.core, targetPosition);
            if (!targetUnit || targetUnit.owner === playerId) return null;

            const targetValue = getCardKeepValue(targetUnit.card);
            const enemySummoner = getSummoner(state.core, getEnemyPlayerId(playerId));
            const pressureBonus = enemySummoner
                ? Math.max(0, 8 - manhattanDistance(targetPosition, enemySummoner.position)) * 4
                : 0;

            if (choice === 'control') {
                const classBonus = targetUnit.card.unitClass === 'champion'
                    ? 24
                    : targetUnit.card.unitClass === 'summoner'
                        ? 12
                        : 0;
                return {
                    score: 48 + Math.min(96, targetValue * 0.22) + pressureBonus + classBonus,
                    reason: targetUnit.card.unitClass === 'champion'
                        ? '优先夺取高价值冠军，而不是只做一次性伤害'
                        : '优先夺取敌方单位，长期收益高于直接消灭',
                };
            }

            if (choice === 'damage') {
                return {
                    score: 14 + Math.min(44, targetValue * 0.08) + Math.floor(pressureBonus / 3),
                    reason: '直接伤害仅兑现当前收益，通常低于夺取该单位',
                };
            }
        }

        if (interactionAction === 'feed_beast') {
            const sourceUnitId = readOptionValueString(optionValue, 'sourceUnitId');
            const choice = readOptionValueString(optionValue, 'choice');
            if (!sourceUnitId || !choice) return null;

            const sourcePosition = findUnitPositionByInstanceId(state.core, sourceUnitId);
            const sourceUnit = sourcePosition ? getUnitAt(state.core, sourcePosition) : null;
            if (!sourceUnit || sourceUnit.owner !== playerId) return null;

            const sourceValue = Math.max(0, getCardKeepValue(sourceUnit.card) - sourceUnit.damage * 8);
            const preserveSourceBonus = Math.min(140, sourceValue * 0.18);

            if (choice === 'self_destroy') {
                return {
                    score: -preserveSourceBonus,
                    reason: '喂养巨食兽时应尽量避免直接自毁主体',
                };
            }

            if (choice === 'destroy_adjacent') {
                const targetPosition = readOptionValuePosition(optionValue, 'targetPosition');
                if (!targetPosition) return null;

                const targetUnit = getUnitAt(state.core, targetPosition);
                if (!targetUnit || targetUnit.owner !== playerId) return null;

                const targetValue = Math.max(0, getCardKeepValue(targetUnit.card) - targetUnit.damage * 8);
                return {
                    score: preserveSourceBonus - Math.min(120, targetValue * 0.2),
                    reason: targetValue <= sourceValue
                        ? '优先牺牲较低价值友军，保留更值钱的巨食兽'
                        : '只有当相邻友军更值钱时，才考虑保留其余单位',
                };
            }
        }

        if (interactionAction === 'activated_ability_target') {
            const abilityId = readOptionValueString(optionValue, 'abilityId');
            const targetCardId = readOptionValueString(optionValue, 'targetCardId');
            if (!abilityId || !targetCardId) return null;

            const targetCard = state.core.players[playerId].discard.find((card) => card.id === targetCardId);
            if (!targetCard) return null;

            const keepValue = getCardKeepValue(targetCard);
            if (abilityId === 'revive_undead') {
                return {
                    score: 26 + Math.min(120, keepValue * 0.18),
                    reason: '复活死灵时优先挑选更高价值的亡灵单位',
                };
            }

            if (abilityId === 'fortress_power') {
                return {
                    score: 12 + Math.min(84, keepValue * 0.12),
                    reason: '城塞之力优先拿回保留价值更高的单位牌',
                };
            }
        }

        if (interactionAction === 'fire_sacrifice_summon') {
            const sacrificeUnitId = readOptionValueString(optionValue, 'sacrificeUnitId');
            if (!sacrificeUnitId) return null;

            const sacrificePosition = findUnitPositionByInstanceId(state.core, sacrificeUnitId);
            const sacrificeUnit = sacrificePosition ? getUnitAt(state.core, sacrificePosition) : null;
            if (!sacrificeUnit || sacrificeUnit.owner !== playerId) return null;

            const adjustedValue = Math.max(0, getCardKeepValue(sacrificeUnit.card) - sacrificeUnit.damage * 8);
            return {
                score: -Math.min(160, adjustedValue * 0.22),
                reason: '火祀召唤优先牺牲保留价值最低的友军',
            };
        }

        if (interactionAction === 'blood_summon_card') {
            const summonCardId = readOptionValueString(optionValue, 'summonCardId');
            if (!summonCardId) return null;

            const summonCard = state.core.players[playerId].hand.find((card) => card.id === summonCardId);
            if (!summonCard) return null;

            return {
                score: 18 + Math.min(96, getCardKeepValue(summonCard) * 0.14),
                reason: '血召唤优先选择当前收益更高的低费单位',
            };
        }

        return null;
    },
};

const setupScorer: LocalAiActionScorer = {
    id: 'setup-neutral',
    score(_context, action) {
        if (action.kind === 'setup-select-faction') {
            return {
                score: 0,
                reason: '从可选阵营池中随机选择',
            };
        }
        if (action.kind === 'setup-ready') {
            return { score: 120, reason: '选完阵营后尽快准备完成' };
        }
        if (action.kind === 'setup-host-start') {
            return { score: 200, reason: '双方已就绪时尽快开始对局' };
        }
        return null;
    },
};

const setupRandomScorer: LocalAiActionScorer = {
    id: 'setup-random',
    score(context, action) {
        if (action.kind !== 'setup-select-faction') return null;
        const noise = buildDeterministicAiNoise(context, action, 'setup');
        return {
            score: Number((noise * 9).toFixed(3)),
            reason: '可选阵营池内保留可复现随机',
        };
    },
};

const summonScorer: LocalAiActionScorer = {
    id: 'summon-value',
    score(_context, action) {
        if (action.kind !== 'summon-unit') return null;
        const cost = typeof action.metadata?.cost === 'number' ? action.metadata.cost : 0;
        const strength = typeof action.metadata?.strength === 'number' ? action.metadata.strength : 0;
        const life = typeof action.metadata?.life === 'number' ? action.metadata.life : 0;
        const centerScore = typeof action.metadata?.centerScore === 'number' ? action.metadata.centerScore : 0;
        const distanceToEnemySummoner = typeof action.metadata?.distanceToEnemySummoner === 'number'
            ? action.metadata.distanceToEnemySummoner
            : 99;
        const nearForwardGate = action.metadata?.nearForwardGate === true;
        let score = strength * 22 + life * 6 + cost * 8 + centerScore * 5 - distanceToEnemySummoner;
        if (nearForwardGate) score += 35;
        return {
            score,
            reason: nearForwardGate
                ? `利用前推传送门召唤 ${String(action.metadata?.cardName ?? '')}`
                : `优先召唤更有场面收益的单位 ${String(action.metadata?.cardName ?? '')}`,
        };
    },
};

const moveScorer: LocalAiActionScorer = {
    id: 'move-pressure',
    score(_context, action) {
        if (action.kind !== 'move-unit') return null;
        const before = typeof action.metadata?.distanceToEnemySummonerBefore === 'number'
            ? action.metadata.distanceToEnemySummonerBefore
            : 99;
        const after = typeof action.metadata?.distanceToEnemySummonerAfter === 'number'
            ? action.metadata.distanceToEnemySummonerAfter
            : 99;
        const attackTargetsAfterMove = typeof action.metadata?.attackTargetsAfterMove === 'number'
            ? action.metadata.attackTargetsAfterMove
            : 0;
        const centerScore = typeof action.metadata?.centerScore === 'number' ? action.metadata.centerScore : 0;
        const nearOwnGateAfterMove = action.metadata?.nearOwnGateAfterMove === true;
        let score = (before - after) * 20 + attackTargetsAfterMove * 45 + centerScore * 4;
        if (nearOwnGateAfterMove) score += 20;
        return {
            score,
            reason: attackTargetsAfterMove > 0
                ? '优先移动到能形成攻击威胁的位置'
                : nearOwnGateAfterMove
                    ? '移动到前推传送门附近保护或配合'
                    : '优先向敌方召唤师和中线施压',
        };
    },
};

const attackScorer: LocalAiActionScorer = {
    id: 'attack-value',
    score(_context, action) {
        if (action.kind !== 'declare-attack') return null;
        const targetType = String(action.metadata?.targetType ?? '');
        const attackerStrength = typeof action.metadata?.attackerStrength === 'number'
            ? action.metadata.attackerStrength
            : 0;
        const targetLifeRemaining = typeof action.metadata?.targetLifeRemaining === 'number'
            ? action.metadata.targetLifeRemaining
            : 99;
        const lethalLikely = action.metadata?.lethalLikely === true;

        let score = attackerStrength * 8;
        if (targetType === 'summoner') score += 180;
        if (targetType === 'champion') score += 70;
        if (targetType === 'common') score += 40;
        if (targetType === 'structure') score += 15;
        // 攻击敌方传送门通常是亏的：0费重建，浪费宝贵攻击机会
        // 只有在敌方只剩1个传送门且能击杀时才值得
        if (action.metadata?.targetIsGate === true) score -= 30;
        if (lethalLikely) score += 60;
        score += Math.max(0, 10 - targetLifeRemaining);

        return {
            score,
            reason: targetType === 'summoner'
                ? '优先压制敌方召唤师'
                : action.metadata?.targetIsGate === true
                    ? '攻击传送门通常亏（0费重建），优先攻击高价值目标'
                    : lethalLikely
                        ? '优先处理接近击杀的目标'
                    : '优先攻击更有价值的目标',
        };
    },
};

const strategyProfileScorer = createProfileAwareActionScorer<SummonerWarsStrategyTag>({
    id: 'strategy-profile-fit',
    allowedKinds: [
        'summon-unit',
        'move-unit',
        'build-structure',
        'declare-attack',
        'discard-for-magic',
        'activate-ability',
    ],
    getProfile(context) {
        const playerId = asSummonerWarsPlayerId(context.playerId);
        if (!playerId) {
            return {
                tags: ['board-control'],
                tagWeights: {
                    'board-control': 1,
                },
                summary: ['无效玩家视角，回退中性策略'],
            };
        }
        return getSummonerWarsStrategyProfile(context.visibleState as SummonerWarsState, playerId);
    },
});

const summonerSafetyScorer: LocalAiActionScorer = {
    id: 'summoner-safety',
    score(_context, action) {
        const remainingLife = typeof action.metadata?.remainingLife === 'number'
            ? action.metadata.remainingLife
            : 0;
        const directThreatDamage = typeof action.metadata?.directThreatDamage === 'number'
            ? action.metadata.directThreatDamage
            : 0;
        const nearbyEnemyPressure = typeof action.metadata?.nearbyEnemyPressure === 'number'
            ? action.metadata.nearbyEnemyPressure
            : 0;
        const lethalPressure = remainingLife > 0 && directThreatDamage >= remainingLife;
        const underPressure = lethalPressure || nearbyEnemyPressure >= 12;

        if (!underPressure) return null;

        if (action.kind === 'move-unit') {
            const directThreatDamageBefore = typeof action.metadata?.directThreatDamageBefore === 'number'
                ? action.metadata.directThreatDamageBefore
                : directThreatDamage;
            const directThreatDamageAfter = typeof action.metadata?.directThreatDamageAfter === 'number'
                ? action.metadata.directThreatDamageAfter
                : directThreatDamage;
            const nearbyEnemyPressureBefore = typeof action.metadata?.nearbyEnemyPressureBefore === 'number'
                ? action.metadata.nearbyEnemyPressureBefore
                : nearbyEnemyPressure;
            const nearbyEnemyPressureAfter = typeof action.metadata?.nearbyEnemyPressureAfter === 'number'
                ? action.metadata.nearbyEnemyPressureAfter
                : nearbyEnemyPressure;
            const sourceIsSummoner = action.metadata?.sourceIsSummoner === true;
            const distanceToOwnSummonerBefore = typeof action.metadata?.distanceToOwnSummonerBefore === 'number'
                ? action.metadata.distanceToOwnSummonerBefore
                : 99;
            const distanceToOwnSummonerAfter = typeof action.metadata?.distanceToOwnSummonerAfter === 'number'
                ? action.metadata.distanceToOwnSummonerAfter
                : 99;

            let score = 0;
            if (directThreatDamageAfter < directThreatDamageBefore) {
                score += 120 + (directThreatDamageBefore - directThreatDamageAfter) * 24;
            }
            if (nearbyEnemyPressureAfter < nearbyEnemyPressureBefore) {
                score += 40 + (nearbyEnemyPressureBefore - nearbyEnemyPressureAfter) * 3;
            }
            if (!sourceIsSummoner && distanceToOwnSummonerAfter < distanceToOwnSummonerBefore) {
                score += 24;
            }
            if (sourceIsSummoner && directThreatDamageAfter <= directThreatDamageBefore) {
                score += 45;
            }
            if (score === 0) return null;

            return {
                score,
                reason: lethalPressure
                    ? '召唤师有被击杀风险，先移动减压或补防线'
                    : '召唤师承压时优先回防而不是继续前压',
            };
        }

        if (action.kind === 'build-structure' && action.metadata?.isGate === true) {
            // 传送门：承压时仍应前推扩展召唤范围，不往召唤师身边缩
            return null;
        }
        if (action.kind === 'summon-unit' || action.kind === 'build-structure') {
            const distanceToOwnSummoner = typeof action.metadata?.distanceToOwnSummoner === 'number'
                ? action.metadata.distanceToOwnSummoner
                : 99;
            const score = distanceToOwnSummoner <= 1
                ? 95 - distanceToOwnSummoner * 12
                : distanceToOwnSummoner === 2
                    ? 38
                    : -18;
            return {
                score,
                reason: lethalPressure
                    ? '召唤师危险时优先在身边补单位或建筑挡刀'
                    : '压力较大时优先把资源投到召唤师附近',
            };
        }

        if (action.kind === 'declare-attack' && action.metadata?.targetIsThreateningSummoner === true) {
            return {
                score: action.metadata?.lethalLikely === true ? 150 : 95,
                reason: '优先清掉正在威胁己方召唤师的敌军',
            };
        }

        return null;
    },
};

const buildScorer: LocalAiActionScorer = {
    id: 'build-structure',
    score(_context, action) {
        if (action.kind !== 'build-structure') return null;
        const isGate = action.metadata?.isGate === true;
        const life = typeof action.metadata?.life === 'number' ? action.metadata.life : 0;
        const cost = typeof action.metadata?.cost === 'number' ? action.metadata.cost : 0;
        const centerScore = typeof action.metadata?.centerScore === 'number' ? action.metadata.centerScore : 0;

        if (isGate) {
            // 传送门：前推深度 + 召唤范围扩展 + 阻挡敌方召唤位 + 中线控制
            const frontRowScore = typeof action.metadata?.frontRowScore === 'number' ? action.metadata.frontRowScore : 0;
            const summonRangeExtension = typeof action.metadata?.summonRangeExtension === 'number' ? action.metadata.summonRangeExtension : 0;
            const blocksEnemySummon = typeof action.metadata?.blocksEnemySummon === 'number' ? action.metadata.blocksEnemySummon : 0;
            const distanceToEnemySummoner = typeof action.metadata?.distanceToEnemySummoner === 'number'
                ? action.metadata.distanceToEnemySummoner : 99;
            return {
                score: 40 + frontRowScore * 12 + summonRangeExtension * 18 + blocksEnemySummon * 25
                    + centerScore * 3 + Math.max(0, 8 - distanceToEnemySummoner) * 4,
                reason: blocksEnemySummon > 0
                    ? `传送门堵住${blocksEnemySummon}个敌方召唤位`
                    : summonRangeExtension > 0
                        ? `传送门前推扩展${summonRangeExtension}个召唤位`
                        : '传送门前推扩展召唤范围',
            };
        }
        // 防御建筑：生命 + 费用 + 中线
        return {
            score: 20 + life * 5 + cost * 4 + centerScore * 2,
            reason: '没有更高优先级动作时再考虑铺设建筑',
        };
    },
};

const discardScorer: LocalAiActionScorer = {
    id: 'discard-for-magic',
    score(_context, action) {
        if (action.kind !== 'discard-for-magic') return null;
        const keepValue = typeof action.metadata?.keepValue === 'number' ? action.metadata.keepValue : 999;
        return {
            score: 80 - keepValue,
            reason: '优先把保留价值较低的手牌换成魔力',
        };
    },
};

const activatedAbilityTargetScorer: LocalAiActionScorer = {
    id: 'activated-ability-target',
    score(context, action) {
        if (action.kind !== 'activate-ability') return null;
        const targetOwner = typeof action.metadata?.targetOwner === 'string'
            ? action.metadata.targetOwner
            : null;
        if (!targetOwner) return null;
        const targetType = String(action.metadata?.targetType ?? action.metadata?.targetUnitClass ?? '');
        const distanceToOwnSummoner = typeof action.metadata?.distanceToOwnSummoner === 'number'
            ? action.metadata.distanceToOwnSummoner
            : 99;
        const distanceToEnemySummoner = typeof action.metadata?.distanceToEnemySummoner === 'number'
            ? action.metadata.distanceToEnemySummoner
            : 99;
        const sourceOwner = typeof action.metadata?.sourceOwner === 'string'
            ? asSummonerWarsPlayerId(action.metadata.sourceOwner)
            : null;
        const isEnemy = sourceOwner ? targetOwner !== sourceOwner : false;
        const visibleState = context.visibleState as SummonerWarsState | undefined;
        const ownThreat = visibleState && sourceOwner
            ? estimateSummonerThreat(visibleState.core, sourceOwner)
            : null;

        let score = 0;
        if (isEnemy) {
            score = 45;
            if (targetType === 'summoner') score += 140;
            else if (targetType === 'champion') score += 70;
            else if (targetType === 'common') score += 40;
            else if (targetType === 'structure') score += 25;
            if (distanceToEnemySummoner <= 2) score += 18;
            return { score, reason: '优先用指向技能压制敌方关键单位' };
        }

        score = 30;
        if (targetType === 'summoner') {
            const underPressure = ownThreat
                ? (ownThreat.remainingLife > 0 && ownThreat.directThreatDamage >= ownThreat.remainingLife)
                    || ownThreat.nearbyEnemyPressure >= 8
                : false;
            score += underPressure ? 110 : 20;
        }
        else if (targetType === 'champion') score += 60;
        else if (targetType === 'common') score += 30;
        if (distanceToOwnSummoner <= 1) score += 24;
        return { score, reason: '优先把增益给核心友军或召唤师' };
    },
};

const abilityScorer: LocalAiActionScorer = {
    id: 'activated-ability',
    score(_context, action) {
        if (action.kind !== 'activate-ability') return null;
        const abilityId = String(action.metadata?.abilityId ?? '');
        const selfChargeGain = typeof action.metadata?.selfChargeGain === 'number'
            ? action.metadata.selfChargeGain
            : 0;
        const sourceBoostsBefore = typeof action.metadata?.sourceBoostsBefore === 'number'
            ? action.metadata.sourceBoostsBefore
            : 0;
        const costsMoveAction = action.metadata?.costsMoveAction === true;
        const costsAttackAction = action.metadata?.costsAttackAction === true;
        const adjacentAllyCount = typeof action.metadata?.adjacentAllyCount === 'number'
            ? action.metadata.adjacentAllyCount
            : 0;
        const adjacentChampionCount = typeof action.metadata?.adjacentChampionCount === 'number'
            ? action.metadata.adjacentChampionCount
            : 0;
        const adjacentSummonerCount = typeof action.metadata?.adjacentSummonerCount === 'number'
            ? action.metadata.adjacentSummonerCount
            : 0;
        const adjacentAttackReadyCount = typeof action.metadata?.adjacentAttackReadyCount === 'number'
            ? action.metadata.adjacentAttackReadyCount
            : 0;
        const adjacentEnemySummonerPressureCount = typeof action.metadata?.adjacentEnemySummonerPressureCount === 'number'
            ? action.metadata.adjacentEnemySummonerPressureCount
            : 0;
        const allAllyCount = typeof action.metadata?.allAllyCount === 'number'
            ? action.metadata.allAllyCount
            : 0;
        const allChampionCount = typeof action.metadata?.allChampionCount === 'number'
            ? action.metadata.allChampionCount
            : 0;
        const allAttackReadyCount = typeof action.metadata?.allAttackReadyCount === 'number'
            ? action.metadata.allAttackReadyCount
            : 0;
        const allEnemySummonerPressureCount = typeof action.metadata?.allEnemySummonerPressureCount === 'number'
            ? action.metadata.allEnemySummonerPressureCount
            : 0;
        const sourceAttackTargetCount = typeof action.metadata?.sourceAttackTargetCount === 'number'
            ? action.metadata.sourceAttackTargetCount
            : 0;

        let score = 72;
        const reasons: string[] = [];

        if (selfChargeGain > 0) {
            score += selfChargeGain * 16;
            score += sourceBoostsBefore === 0 ? 24 : 8;
            if (costsMoveAction) {
                score -= 12;
            }
            if (costsAttackAction) {
                score -= 16;
            }
            if (sourceAttackTargetCount > 0 && costsAttackAction) {
                score -= 12;
            }
            reasons.push(sourceBoostsBefore === 0 ? '先给关键单位充能' : '继续累积充能资源');
        }

        const supportTargetCount = adjacentAllyCount + allAllyCount;
        if (supportTargetCount > 0) {
            const championCount = adjacentChampionCount + allChampionCount;
            const attackReadyCount = adjacentAttackReadyCount + allAttackReadyCount;
            const enemySummonerPressureCount = adjacentEnemySummonerPressureCount + allEnemySummonerPressureCount;
            score += supportTargetCount * 24;
            score += championCount * 18;
            score += (adjacentSummonerCount > 0 ? 22 : 0);
            score += attackReadyCount * 12;
            score += enemySummonerPressureCount * 18;
            reasons.push(
                supportTargetCount >= 2
                    ? '一次能强化多个友军'
                    : '能顺手强化周围友军',
            );
        }

        return {
            score,
            reason: reasons.length > 0
                ? `${reasons.join('，')}：${abilityId}`
                : `可无目标发动的技能通常有即时收益：${abilityId}`,
        };
    },
};

const phaseTempoScorer: LocalAiActionScorer = {
    id: 'phase-tempo',
    score(context, action) {
        if (action.kind !== 'advance-phase') return null;
        const hasOtherPlayableActions = context.legalActions.some((candidate) => {
            return candidate.actionId !== action.actionId
                && candidate.kind !== 'interaction-cancel';
        });
        return {
            score: hasOtherPlayableActions ? -120 : 90,
            reason: hasOtherPlayableActions ? '当前阶段还有更高价值的动作，不应过早结束' : '当前阶段收益已接近耗尽，可以推进流程',
        };
    },
};

const featureSnapshotScorer: LocalAiActionScorer = {
    id: 'feature-snapshot',
    score(context, action) {
        const snapshot = context.featureSnapshot;
        if (!snapshot || typeof snapshot !== 'object') return null;

        const threat = (snapshot as Record<string, unknown>).threat as Record<string, unknown> | undefined;
        const objective = (snapshot as Record<string, unknown>).objective as Record<string, unknown> | undefined;
        const control = (snapshot as Record<string, unknown>).control as Record<string, unknown> | undefined;

        const pressureRatio = typeof threat?.pressureRatio === 'number' ? threat.pressureRatio : 0;
        const antiThreatActions = typeof objective?.antiThreatActions === 'number' ? objective.antiThreatActions : 0;
        const centerControlDelta = typeof control?.centerControlDelta === 'number' ? control.centerControlDelta : 0;

        let score = 0;
        const reasons: string[] = [];

        if (pressureRatio >= 1) {
            if (action.kind === 'declare-attack' && readActionMetadataBoolean(action, 'targetIsThreateningSummoner') === true) {
                score += 85;
                reasons.push('高压回合优先清除威胁己方召唤师的目标');
            }
            if (action.kind === 'move-unit') {
                const before = readActionMetadataNumber(action, 'directThreatDamageBefore');
                const after = readActionMetadataNumber(action, 'directThreatDamageAfter');
                if (before !== null && after !== null && after < before) {
                    score += (before - after) * 14;
                    reasons.push('移动可显著降低召唤师直伤压力');
                }
            }
        } else {
            if (action.kind === 'declare-attack') {
                const targetType = readActionMetadataString(action, 'targetType');
                if (targetType === 'summoner') {
                    score += 34;
                    reasons.push('低压局面可扩大对敌方召唤师压制');
                }
                if (readActionMetadataBoolean(action, 'targetIsGate') === true) {
                    score += 22;
                    reasons.push('低压局面可压制敌方传送门节奏');
                }
            }
            if (action.kind === 'move-unit') {
                const before = readActionMetadataNumber(action, 'distanceToEnemySummonerBefore');
                const after = readActionMetadataNumber(action, 'distanceToEnemySummonerAfter');
                if (before !== null && after !== null && after < before) {
                    score += (before - after) * 7;
                    reasons.push('前压移动能提升后续攻击机会');
                }
            }
        }

        if (action.kind === 'advance-phase' && antiThreatActions > 0 && pressureRatio >= 1) {
            score -= 96;
            reasons.push('仍有解压动作，不应提前结束阶段');
        }

        if (centerControlDelta < 0 && action.kind === 'move-unit') {
            const centerScore = readActionMetadataNumber(action, 'centerScore');
            if (centerScore !== null && centerScore >= 2) {
                score += 16;
                reasons.push('中心控制落后时优先补位中区');
            }
        }

        if (score === 0) return null;
        return {
            score: Number(score.toFixed(3)),
            reason: reasons.join('，'),
        };
    },
};

const getSummonerWarsEvaluatorScale = (context: AiDecisionContext): number => {
    switch (context.difficulty.evaluatorProfile) {
        case 'basic':
            return 0.5;
        case 'balanced':
            return 0.78;
        case 'strong':
            return 1;
        case 'expert':
            return 1.2;
        default:
            return 1;
    }
};

const projectSummonerWarsAction = (args: {
    context: AiDecisionContext;
    action: AiLegalAction;
    difficulty: AiDecisionContext['difficulty'];
    remainingBudgetMs: number;
}): { score: number; reason: string; metadata?: Record<string, unknown> } | null => {
    const projected = projectSummonerWarsActionDelta({
        context: args.context,
        action: args.action,
        difficulty: args.difficulty,
        remainingBudgetMs: args.remainingBudgetMs,
        scoreScale: getSummonerWarsEvaluatorScale(args.context),
        buildLegalActions: buildSummonerWarsAiLegalActions,
    });

    return projected.score === 0 ? null : projected;
};

const baselineLocalPolicy = createLookaheadLocalAiPolicy({
    id: 'baseline',
    scorers: [
        actionKindScorer,
        interactionHintScorer,
        interactionScorer,
        interactionPositionScorer,
        interactionSemanticScorer,
        setupScorer,
        setupRandomScorer,
        summonScorer,
        moveScorer,
        attackScorer,
        strategyProfileScorer,
        summonerSafetyScorer,
        buildScorer,
        discardScorer,
        activatedAbilityTargetScorer,
        abilityScorer,
        phaseTempoScorer,
        featureSnapshotScorer,
    ],
    maxReasonCount: 3,
    relativeUtility: {
        enabled: true,
        weight: 14,
        minimumUtility: 0.1,
    },
    candidateLoop: {
        enabled: true,
        maxIterations: 3,
        batchSize: 5,
        stopOnUtility: 0.9,
    },
    evaluateAssignments({ context, baseEvaluations }) {
        return evaluateSummonerWarsAssignments({
            context,
            baseEvaluations,
        });
    },
    projectAction({ context, action, difficulty, remainingBudgetMs }) {
        return projectSummonerWarsAction({
            context,
            action,
            difficulty,
            remainingBudgetMs,
        });
    },
});

export const summonerWarsAiRuntime: GameAiRuntime = {
    gameId: 'summonerwars',
    buildLegalActions: buildSummonerWarsAiLegalActions,
    defaultMinimumActionDelayMs: 1000,
    buildFeatureSnapshot(args) {
        const playerId = asSummonerWarsPlayerId(args.playerId);
        if (!playerId) return null;
        return buildSummonerWarsFeatureSnapshot({
            playerId,
            state: args.state as SummonerWarsState,
            legalActions: args.legalActions,
        });
    },
    localPolicies: {
        baseline: baselineLocalPolicy,
    },
    defaultLocalPolicyId: 'baseline',
};
