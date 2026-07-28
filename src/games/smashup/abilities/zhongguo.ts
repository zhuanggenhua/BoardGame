import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { registerAbilityProgram, type AbilityContext, type AbilityResult } from '../domain/abilityRegistry';
import { registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import {
    addTempPower,
    addPowerCounter,
    addOngoingCardCounter,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildSemanticOngoingAttachEvents,
    buildStandardDrawEvents,
    buildStandardDrawEventsFromRuntimeContext,
    buildValidatedCardToDeckBottomEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    buildValidatedReturnEvents,
    createSkipOption,
    getMinionPower,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    inspectDeck,
    modifyBreakpoint,
    revealDeckTop,
    removePowerCounter,
    recoverCardsFromDiscard,
} from '../domain/abilityHelpers';
import {
    registerBaseVpModifier,
    registerProtection,
    registerTrigger,
    type ProtectionCheckContext,
    type TriggerContext,
    type TriggerResult,
} from '../domain/ongoingEffects';
import { buildOngoingDetachedEvent } from '../domain/ongoingDetach';
import {
    SU_EVENTS,
    type CardInstance,
    type MinionDestroyedEvent,
    type MinionMetadataUpdatedEvent,
    type MinionMovedEvent,
    type MinionOnBase,
    type MinionReturnedEvent,
    type OngoingActionOnBase,
    type PermanentPowerAddedEvent,
    type PowerCounterAddedEvent,
    type PowerCounterRemovedEvent,
    type SmashUpCore,
    type SmashUpEvent,
    type TempPowerAddedEvent,
} from '../domain/types';
import { getEffectivePower, getPlayerEffectivePowerOnBase, registerPowerModifier } from '../domain/ongoingModifiers';
import { getBaseDef, getCardDef } from '../data/cards';

type ZhongguoPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

type MinionChoice = {
    minionUid?: string;
    baseIndex?: number;
    defId?: string;
    skip?: boolean;
};

type BaseChoice = {
    baseIndex?: number;
    skip?: boolean;
};

type BaseOngoingActionChoice = {
    actionUid?: string;
    baseIndex?: number;
    defId?: string;
    skip?: boolean;
};

type TruckersActionMode = 'transfer' | 'control' | 'transfer_and_control' | 'extra_action';

type TruckersActionModeChoice = {
    mode?: TruckersActionMode;
};

type BaseOngoingActionCandidate = {
    uid: string;
    defId: string;
    baseIndex: number;
    ownerId: PlayerId;
    controllerId: PlayerId;
    talentUsed?: boolean;
    metadata?: Record<string, unknown>;
    label: string;
};

type CounterTransferChoice = {
    amount?: number;
    value?: number;
};

type ExpertTimingCardChoice = {
    kind?: 'minion' | 'ongoingAction';
    minionUid?: string;
    actionUid?: string;
    baseIndex?: number;
    defId?: string;
};

type CardChoice = {
    kind?: 'minion' | 'ongoingAction';
    minionUid?: string;
    actionUid?: string;
    baseIndex?: number;
    defId?: string;
    skip?: boolean;
};

type CounterTransferCandidate = {
    uid: string;
    defId: string;
    baseIndex: number;
    label: string;
};

type CounterTransferContext = ZhongguoPromptContext & {
    reason: string;
    sourcePromptTitle: string;
    targetPromptTitle: string;
    amountPromptTitle: string;
    allowSkip?: boolean;
    fixedAmount?: number;
    allowedAddBaseIndex?: number;
    sourceMinionUid?: string;
    sourceBaseIndex?: number;
    sourceCounterAmount?: number;
    targetMinionUid?: string;
    targetBaseIndex?: number;
};

type AncientChineseArtModeContext = ZhongguoPromptContext & {
    cardUid: string;
    baseIndex: number;
};

type LetsGetItOnContext = ZhongguoPromptContext & {
    sourceMinionUid?: string;
    sourceBaseIndex?: number;
    sourcePower?: number;
};

type EverybodyKnewContext = ZhongguoPromptContext;

type EverybodyWasDestroySelection = {
    playerId: PlayerId;
    minionUid: string;
    minionDefId: string;
    baseIndex: number;
};

type EverybodyWasContext = ZhongguoPromptContext & {
    baseIndex?: number;
    remainingPlayerIds?: PlayerId[];
    selections?: EverybodyWasDestroySelection[];
};

type ABitFrighteningContext = ZhongguoPromptContext & {
    referenceMinionUid?: string;
    referenceBaseIndex?: number;
    referencePower?: number;
};

type OhHohHohHoahContext = ZhongguoPromptContext & {
    baseIndex: number;
};

type DiscoDancingKingContext = ZhongguoPromptContext & {
    sourceCardUid: string;
    sourceBaseIndex: number;
    sourceControllerId: PlayerId;
    affectedMinionUid: string;
    affectEvent: SmashUpEvent;
};

type DiscoIWillSurviveContext = ZhongguoPromptContext & {
    sourceCardUid: string;
    sourceBaseIndex: number;
    sourceBaseDefId: string;
};

type TruckersHighSpeedChaseContext = ZhongguoPromptContext & {
    sourceCardUid: string;
    sourceBaseIndex: number;
    sourceControllerId: PlayerId;
    minionUid?: string;
    minionDefId?: string;
};

type TruckersDekotoraContext = ZhongguoPromptContext & {
    sourceCardUid: string;
    sourceBaseIndex: number;
    sourceControllerId: PlayerId;
    targetBaseIndex?: number;
};

type TruckersCabOverPeteContext = ZhongguoPromptContext & {
    sourceCardUid: string;
    sourceBaseIndex: number;
    sourceControllerId: PlayerId;
    targetBaseIndex?: number;
};

type TruckersHotwireContext = ZhongguoPromptContext & {
    actionUid?: string;
    actionBaseIndex?: number;
    actionDefId?: string;
    actionOwnerId?: PlayerId;
    actionControllerId?: PlayerId;
    actionMode?: TruckersActionMode;
    availableModes?: TruckersActionMode[];
};

type TruckersElBandidoTransferContext = ZhongguoPromptContext & {
    actionUid?: string;
    actionBaseIndex?: number;
    actionDefId?: string;
    actionOwnerId?: PlayerId;
    actionControllerId?: PlayerId;
};

type TruckersSkinnyMinnieContext = ZhongguoPromptContext & {
    selfUid: string;
    selfBaseIndex: number;
    targetBaseIndex?: number;
};

type TruckersTurnTheBeatAroundContext = ZhongguoPromptContext & {
    sourceBaseIndex: number;
    affectedMinionUid?: string;
    affectedBaseIndex?: number;
};

type VigilantesDeathWisherContext = ZhongguoPromptContext & {
    selfUid: string;
    selfBaseIndex: number;
    destroyerId: PlayerId;
};

type VigilantesBrojakContext = ZhongguoPromptContext & {
    selfUid: string;
    selfBaseIndex: number;
    targetBaseIndex: number;
};

type KungFuExpertTimingMode = 'transfer' | 'talent' | 'both';

type KungFuExpertTimingContext = ZhongguoPromptContext & {
    mode?: KungFuExpertTimingMode;
    talentCardKind?: 'minion' | 'ongoingAction';
    talentMinionUid?: string;
    talentActionUid?: string;
    talentBaseIndex?: number;
    sourceCardKind?: 'minion' | 'ongoingAction';
    sourceMinionUid?: string;
    sourceActionUid?: string;
    sourceBaseIndex?: number;
    sourceCounterAmount?: number;
};

const TRUCKERS_ACTION_MODE_LABEL_BY_MODE: Record<TruckersActionMode, string> = {
    transfer: '只转移',
    control: '只控权',
    transfer_and_control: '转移并控权',
    extra_action: '额外行动',
};

const TRUCKERS_ACTION_MODE_LABEL_KEY_BY_MODE: Record<TruckersActionMode, string> = {
    transfer: 'ui.truckers_action_mode_transfer_option',
    control: 'ui.truckers_action_mode_control_option',
    transfer_and_control: 'ui.truckers_action_mode_transfer_and_control_option',
    extra_action: 'ui.truckers_action_mode_extra_action_option',
};

const ZHONGGUO_PROMPT_TITLES = {
    kungFuFastAsLightning: '快如闪电：选择一个随从',
    kungFuEverybodyWasBase: '人人都是功夫高手：选择一个基地',
    kungFuEverybodyWasTarget: '人人都是功夫高手：选择要消灭的其他玩家随从',
    kungFuExpertTimingMode: '掌握时机：选择效果',
    kungFuExpertTimingTalent: '掌握时机：选择额外使用天赋的随从',
    kungFuExpertTimingSource: '掌握时机：选择要转出全部 +1 标记的随从',
    kungFuExpertTimingTarget: '掌握时机：选择接收全部 +1 标记的另一个随从',
    moveOwnMinionDestination: '选择目标基地',
    vigilantesDeathWisher: '猛龙怪客：选择一个消灭者控制的随从并消灭之',
    vigilantesBrojak: '神探布洛杰克：是否移动到刚才移动随从所在的基地并获得 +1 战力？',
    truckersRally: '车友聚会：选择计分基地的一个随从',
    truckersTurnTheBeatAroundPenalty: '节拍一转：选择同基地一个随从 -1 战力',
    truckersTurnTheBeatAroundBoost: '节拍一转：选择计分基地一个随从 +1 战力',
    truckersHighSpeedChaseBase: '高速追逐战：选择目标基地',
    truckersHighSpeedChaseMinion: '高速追逐战：选择你在此基地的一个随从',
    truckersDekotoraMinions: '暴走卡车：选择至多 3 个你的随从移动',
    truckersDekotoraBase: '暴走卡车：选择目标基地',
    truckersCabOverPeteBase: '平头彼特：选择目标基地',
    truckersCabOverPeteCard: '平头彼特：选择此处另一张你控制的牌',
    truckersHotwireBase: '短路点火：选择目标基地',
    truckersHotwireMode: '短路点火：选择效果',
    truckersHotwireAction: '短路点火：选择基地上的一张战术',
    truckersElBandidoTakeControl: '埃尔班迪多：你可以获得一张基地战术的控制权',
    truckersElBandidoTransferBase: '埃尔班迪多：选择目标基地',
    truckersElBandidoTransferAction: '埃尔班迪多：选择要转移的基地战术',
    truckersElBandidoTalentMode: '埃尔班迪多：选择天赋效果',
    truckersSkinnyMinnieAction: '皮包骨米妮：选择要一起转移的基地战术',
    truckersSkinnyMinnieBase: '皮包骨米妮：选择目标基地',
    discoDancingKing: '舞王：选择另一个同基地随从复制这次普通战术影响',
    discoIWillSurvive: '我会活下去：选择计分基地中的一个己方随从返回拥有者手牌',
    vigilantesBrojakFollowOption: '移动并 +1 战力',
} as const;

function createPromptContext<TExtra extends object>(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    extra?: TExtra,
): ZhongguoPromptContext & TExtra {
    return {
        matchState,
        playerId,
        now,
        ...(extra ?? {} as TExtra),
    };
}

const DISCO_DANCERS_DIVA_TRIGGERED_TURN_META = 'discoDancersDivaTriggeredTurn';
const DISCO_DANCERS_DANCING_KING_TRIGGERED_TURN_META = 'discoDancersDancingKingTriggeredTurn';
const DISCO_DANCERS_WE_ARE_FAMILY_TRIGGERED_TURNS_META = 'discoDancersWeAreFamilyTriggeredTurns';
const VIGILANTES_DEATH_WISHER_TRIGGERED_TURN_META = 'vigilantesDeathWisherTriggeredTurn';
const KUNG_FU_FAST_AS_LIGHTNING_RETURN_TURN_META = 'kungFuFastAsLightningReturnTurn';
const KUNG_FU_FAST_AS_LIGHTNING_SOURCE_PLAYER_META = 'kungFuFastAsLightningSourcePlayer';

function runtimeResultToTriggerResult(
    result: ReturnType<typeof executeAbilityProgram<unknown, SmashUpCore, SmashUpEvent>>,
    fallbackState: MatchState<SmashUpCore>,
): TriggerResult {
    return {
        events: result.events,
        matchState: result.matchState ?? fallbackState,
    };
}

function isStandardActionDefId(defId?: string): boolean {
    if (!defId) return false;
    const def = getCardDef(defId);
    return !!def && def.type === 'action' && def.subtype === 'standard';
}

function normalizeSourceDefIdFromReason(reason?: string): string | undefined {
    if (!reason) return undefined;
    return reason
        .replace(/_(self_destruct|destroy|discard|expired|return|returned|shuffle|shuffled|detach|detached)$/u, '')
        .replace(/_pod$/u, '_pod');
}

function resolveSourceDefIdFromEvent(event: SmashUpEvent): string | undefined {
    const payload = (event as { payload?: Record<string, unknown> }).payload;
    if (!payload) return undefined;
    const explicit = payload.sourceDefId;
    if (typeof explicit === 'string' && explicit.length > 0) return explicit;
    const reason = payload.reason;
    return typeof reason === 'string' ? normalizeSourceDefIdFromReason(reason) : undefined;
}

function buildMinionMetadataUpdatedEvent(
    minionUid: string,
    baseIndex: number,
    metadataUpdate: Record<string, unknown>,
    reason: string,
    timestamp: number,
): MinionMetadataUpdatedEvent {
    return {
        type: SU_EVENTS.MINION_METADATA_UPDATED,
        payload: {
            minionUid,
            baseIndex,
            metadataUpdate,
            reason,
        },
        timestamp,
    };
}

function buildDiscoMirrorEvents(
    state: SmashUpCore,
    event: SmashUpEvent,
    target: {
        uid: string;
        defId: string;
        baseIndex: number;
        ownerId: PlayerId;
        controllerId: PlayerId;
    },
    sourceDefId: string,
    now: number,
): SmashUpEvent[] {
    switch (event.type) {
        case SU_EVENTS.POWER_COUNTER_ADDED: {
            const payload = (event as PowerCounterAddedEvent).payload;
            return [addPowerCounter(
                target.uid,
                target.baseIndex,
                payload.amount,
                `${sourceDefId}_copy_power_counter_added`,
                event.timestamp ?? now,
                {
                    sourcePlayerId: target.controllerId,
                    sourceCardUid: target.uid,
                    sourceDefId,
                    sourceControllerId: target.controllerId,
                    sourceBaseIndex: target.baseIndex,
                },
            ) as PowerCounterAddedEvent];
        }
        case SU_EVENTS.POWER_COUNTER_REMOVED: {
            const payload = (event as PowerCounterRemovedEvent).payload;
            return [removePowerCounter(
                target.uid,
                target.baseIndex,
                payload.amount,
                `${sourceDefId}_copy_power_counter_removed`,
                event.timestamp ?? now,
                {
                    sourcePlayerId: target.controllerId,
                    sourceCardUid: target.uid,
                    sourceDefId,
                    sourceControllerId: target.controllerId,
                    sourceBaseIndex: target.baseIndex,
                },
            ) as PowerCounterRemovedEvent];
        }
        case SU_EVENTS.TEMP_POWER_ADDED: {
            const payload = (event as TempPowerAddedEvent).payload;
            return [addTempPower(
                target.uid,
                target.baseIndex,
                payload.amount,
                `${sourceDefId}_copy_temp_power`,
                event.timestamp ?? now,
                {
                    sourcePlayerId: target.controllerId,
                    sourceCardUid: target.uid,
                    sourceDefId,
                    sourceControllerId: target.controllerId,
                    sourceBaseIndex: target.baseIndex,
                },
            ) as TempPowerAddedEvent];
        }
        case SU_EVENTS.PERMANENT_POWER_ADDED: {
            const payload = (event as PermanentPowerAddedEvent).payload;
            return [{
                type: SU_EVENTS.PERMANENT_POWER_ADDED,
                payload: {
                    minionUid: target.uid,
                    baseIndex: target.baseIndex,
                    amount: payload.amount,
                    reason: `${sourceDefId}_copy_permanent_power`,
                    ...(payload.expiresOnTurnNumber !== undefined ? { expiresOnTurnNumber: payload.expiresOnTurnNumber } : {}),
                    sourcePlayerId: target.controllerId,
                    sourceCardUid: target.uid,
                    sourceDefId,
                    sourceControllerId: target.controllerId,
                    sourceBaseIndex: target.baseIndex,
                },
                timestamp: event.timestamp ?? now,
            } as PermanentPowerAddedEvent];
        }
        case SU_EVENTS.MINION_DESTROYED:
            return buildValidatedDestroyEvents(state, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: target.baseIndex,
                destroyerId: (event as MinionDestroyedEvent).payload.destroyerId,
                reason: `${sourceDefId}_copy_destroyed`,
                now: event.timestamp ?? now,
                sourcePlayerId: target.controllerId,
                sourceCardUid: target.uid,
                sourceDefId,
                sourceControllerId: target.controllerId,
                sourceBaseIndex: target.baseIndex,
                sourceKind: 'nonAction',
                targetSnapshot: {
                    ownerId: target.ownerId,
                    controllerId: target.controllerId,
                },
            });
        case SU_EVENTS.MINION_MOVED: {
            const payload = (event as MinionMovedEvent).payload;
            return buildValidatedMoveEvents(state, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: target.baseIndex,
                toBaseIndex: payload.toBaseIndex,
                toBaseDefId: payload.toBaseDefId,
                reason: `${sourceDefId}_copy_moved`,
                now: event.timestamp ?? now,
                sourcePlayerId: target.controllerId,
                sourceCardUid: target.uid,
                sourceDefId,
                sourceControllerId: target.controllerId,
                sourceBaseIndex: target.baseIndex,
                sourceKind: 'nonAction',
                targetSnapshot: {
                    ownerId: target.ownerId,
                    controllerId: target.controllerId,
                },
            });
        }
        case SU_EVENTS.MINION_RETURNED: {
            const payload = (event as MinionReturnedEvent).payload;
            return buildValidatedReturnEvents(state, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: target.baseIndex,
                toPlayerId: payload.toPlayerId ?? target.ownerId,
                reason: `${sourceDefId}_copy_returned`,
                now: event.timestamp ?? now,
                sourcePlayerId: target.controllerId,
                sourceCardUid: target.uid,
                sourceDefId,
                sourceControllerId: target.controllerId,
                sourceBaseIndex: target.baseIndex,
                targetSnapshot: {
                    ownerId: target.ownerId,
                    controllerId: target.controllerId,
                },
            });
        }
        default:
            return [];
    }
}

function collectAllMinions(state: SmashUpCore): CounterTransferCandidate[] {
    const result: CounterTransferCandidate[] = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        const base = state.bases[baseIndex];
        for (const minion of base.minions) {
            result.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            });
        }
    }
    return result;
}

function collectOwnMinions(state: SmashUpCore, playerId: PlayerId): CounterTransferCandidate[] {
    return collectAllMinions(state).filter((candidate) => {
        const minion = state.bases[candidate.baseIndex]?.minions.find(entry => entry.uid === candidate.uid);
        return minion?.controller === playerId;
    });
}

function collectMinionsMatching(
    state: SmashUpCore,
    predicate: (minion: MinionOnBase, baseIndex: number) => boolean,
): CounterTransferCandidate[] {
    return collectAllMinions(state).filter((candidate) => {
        const minion = state.bases[candidate.baseIndex]?.minions.find(entry => entry.uid === candidate.uid);
        return !!minion && predicate(minion, candidate.baseIndex);
    });
}

function collectOtherBases(state: SmashUpCore, baseIndex: number): Array<{ baseIndex: number; label: string }> {
    return state.bases
        .map((base, index) => ({ baseIndex: index, label: getCardDef(base.defId)?.name ?? base.defId }))
        .filter(candidate => candidate.baseIndex !== baseIndex);
}

function getBaseOngoingActionControllerId(action: OngoingActionOnBase): PlayerId {
    return ((action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId);
}

function collectBaseOngoingActions(
    state: SmashUpCore,
    predicate?: (action: BaseOngoingActionCandidate) => boolean,
): BaseOngoingActionCandidate[] {
    const results: BaseOngoingActionCandidate[] = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        const base = state.bases[baseIndex];
        const baseLabel = getCardDef(base.defId)?.name ?? base.defId;
        for (const action of base.ongoingActions) {
            const candidate: BaseOngoingActionCandidate = {
                uid: action.uid,
                defId: action.defId,
                baseIndex,
                ownerId: action.ownerId,
                controllerId: getBaseOngoingActionControllerId(action),
                talentUsed: action.talentUsed,
                metadata: action.metadata,
                label: `${getCardDef(action.defId)?.name ?? action.defId}（${baseLabel}）`,
            };
            if (!predicate || predicate(candidate)) {
                results.push(candidate);
            }
        }
    }
    return results;
}

function findBaseOngoingAction(
    state: SmashUpCore,
    actionUid: string,
    baseIndex?: number,
): BaseOngoingActionCandidate | undefined {
    return collectBaseOngoingActions(
        state,
        (candidate) => candidate.uid === actionUid && (baseIndex === undefined || candidate.baseIndex === baseIndex),
    )[0];
}

function buildBaseOngoingActionOptions(
    candidates: BaseOngoingActionCandidate[],
): Array<{
    id: string;
    label: string;
    value: { actionUid: string; baseIndex: number; defId: string };
    _source: 'field';
}> {
    return candidates.map((candidate, index) => ({
        id: `ongoing-${index}`,
        label: candidate.label,
        value: {
            actionUid: candidate.uid,
            baseIndex: candidate.baseIndex,
            defId: candidate.defId,
        },
        _source: 'field' as const,
    }));
}

function buildCardChoiceOptions(candidates: Array<{
    uid: string;
    defId: string;
    baseIndex: number;
    kind: 'minion' | 'ongoingAction';
    label: string;
}>): Array<{
    id: string;
    label: string;
    value: CardChoice;
    _source: 'field';
    displayMode: 'card';
}> {
    return candidates.map((candidate, index) => ({
        id: `${candidate.kind}-${index}`,
        label: candidate.label,
        value: candidate.kind === 'minion'
            ? {
                kind: 'minion',
                minionUid: candidate.uid,
                baseIndex: candidate.baseIndex,
                defId: candidate.defId,
            }
            : {
                kind: 'ongoingAction',
                actionUid: candidate.uid,
                baseIndex: candidate.baseIndex,
                defId: candidate.defId,
            },
        _source: 'field' as const,
        displayMode: 'card' as const,
    }));
}

function collectCabOverPeteControlledCards(
    state: SmashUpCore,
    playerId: PlayerId,
    sourceBaseIndex: number,
    sourceCardUid: string,
): Array<{ uid: string; defId: string; baseIndex: number; kind: 'minion' | 'ongoingAction'; label: string }> {
    const base = state.bases[sourceBaseIndex];
    if (!base) return [];
    return [
        ...base.minions
            .filter(minion => minion.controller === playerId)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: sourceBaseIndex,
                kind: 'minion' as const,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            })),
        ...collectBaseOngoingActions(
            state,
            candidate =>
                candidate.baseIndex === sourceBaseIndex
                && candidate.uid !== sourceCardUid
                && candidate.controllerId === playerId,
        ).map(action => ({
            uid: action.uid,
            defId: action.defId,
            baseIndex: action.baseIndex,
            kind: 'ongoingAction' as const,
            label: action.label,
        })),
    ];
}

function stripBaseOngoingActionControlMetadata(
    metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
    if (!metadata) return undefined;
    const nextMetadata = { ...metadata };
    delete nextMetadata.sourceControllerId;
    delete nextMetadata.sourcePlayerId;
    return Object.keys(nextMetadata).length > 0 ? nextMetadata : {};
}

function buildBaseOngoingActionAttachMetadata(
    action: BaseOngoingActionCandidate,
    controllerId: PlayerId,
): Record<string, unknown> | undefined {
    if (controllerId !== action.ownerId) {
        return {
            ...(action.metadata ?? {}),
            sourceControllerId: controllerId,
            sourcePlayerId: controllerId,
        };
    }
    return stripBaseOngoingActionControlMetadata(action.metadata);
}

function buildBaseOngoingActionControlEvents(
    state: MatchState<SmashUpCore>,
    action: BaseOngoingActionCandidate,
    targetBaseIndex: number,
    controllerId: PlayerId,
    reason: string,
    now: number,
    options?: {
        includeDetach?: boolean;
        talentUsed?: boolean;
    },
): SmashUpEvent[] {
    const metadata = buildBaseOngoingActionAttachMetadata(action, controllerId);
    return [
        ...(options?.includeDetach
            ? [buildOngoingDetachedEvent({
                cardUid: action.uid,
                defId: action.defId,
                ownerId: action.ownerId,
                reason,
                now,
            })]
            : []),
        ...buildSemanticOngoingAttachEvents(state, {
            cardUid: action.uid,
            defId: action.defId,
            ownerId: action.ownerId,
            ...(controllerId !== action.ownerId ? { sourcePlayerId: controllerId } : {}),
            targetBaseIndex,
            ...(metadata !== undefined ? { metadata } : {}),
            ...(options?.talentUsed !== undefined ? { talentUsed: options.talentUsed } : {}),
            now,
        }),
    ];
}

function hasOtherBaseTarget(state: SmashUpCore, baseIndex: number): boolean {
    return collectOtherBases(state, baseIndex).length > 0;
}

function getTruckersHotwireModes(
    state: SmashUpCore,
    playerId: PlayerId,
    action: BaseOngoingActionCandidate,
): TruckersActionMode[] {
    const modes: TruckersActionMode[] = [];
    if (hasOtherBaseTarget(state, action.baseIndex)) {
        modes.push('transfer');
    }
    if (action.controllerId !== playerId) {
        modes.push('control');
        if (hasOtherBaseTarget(state, action.baseIndex)) {
            modes.push('transfer_and_control');
        }
    }
    return modes;
}

function buildTruckersActionModeOptions(modes: TruckersActionMode[]): Array<{
    id: string;
    label: string;
    labelKey: string;
    value: TruckersActionModeChoice;
    displayMode: 'button';
}> {
    return modes.map((mode) => ({
        id: mode,
        label: TRUCKERS_ACTION_MODE_LABEL_BY_MODE[mode],
        labelKey: TRUCKERS_ACTION_MODE_LABEL_KEY_BY_MODE[mode],
        value: { mode },
        displayMode: 'button' as const,
    }));
}

function countControlledHighPowerMinions(state: SmashUpCore, playerId: PlayerId, minPower: number): number {
    let count = 0;
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        for (const minion of state.bases[baseIndex].minions) {
            if (minion.controller === playerId && getMinionPower(state, minion, baseIndex) >= minPower) {
                count += 1;
            }
        }
    }
    return count;
}

function hasOwnMinionOnBase(state: SmashUpCore, baseIndex: number, playerId: PlayerId): boolean {
    return state.bases[baseIndex]?.minions.some(minion => minion.controller === playerId) ?? false;
}

function isPlayerWinningScoredBase(state: SmashUpCore, baseIndex: number, playerId: PlayerId): boolean {
    const base = state.bases[baseIndex];
    if (!base) return false;
    const highestPower = Math.max(
        ...state.turnOrder.map(candidatePlayerId => getPlayerEffectivePowerOnBase(state, base, baseIndex, candidatePlayerId)),
        0,
    );
    return getPlayerEffectivePowerOnBase(state, base, baseIndex, playerId) >= highestPower;
}

function buildShuffleMinionIntoDeckEvents(
    state: MatchState<SmashUpCore>,
    minion: MinionOnBase,
    baseIndex: number,
    sourcePlayerId: PlayerId,
    sourceDefId: string,
    now: number,
    random: RandomFn,
): SmashUpEvent[] {
    const owner = state.core.players[minion.owner];
    if (!owner) return [];
    const toDeckEvents = buildValidatedCardToDeckBottomEvents(state, {
        cardUid: minion.uid,
        defId: minion.defId,
        ownerId: minion.owner,
        sourcePlayerId,
        sourceDefId,
        sourceControllerId: sourcePlayerId,
        sourceBaseIndex: baseIndex,
        reason: sourceDefId,
        now,
        expectedLocation: 'bases',
    });
    if (!toDeckEvents.some(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)) return toDeckEvents;
    return [
        ...toDeckEvents,
        {
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId: minion.owner,
                deckUids: random.shuffle([...owner.deck.map(card => card.uid), minion.uid]),
                reason: sourceDefId,
            },
            timestamp: now,
        } as SmashUpEvent,
    ];
}

function topDeckCardsFromDiscard(
    selectedCards: CardInstance[],
    playerId: PlayerId,
    reason: string,
    now: number,
): SmashUpEvent[] {
    if (selectedCards.length === 0) return [];
    return selectedCards
        .slice()
        .reverse()
        .map(card => buildCardToDeckTopEvent(card, playerId, reason, now));
}

function buildCardToDeckTopEvent(card: CardInstance, playerId: PlayerId, reason: string, now: number): SmashUpEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            sourcePlayerId: playerId,
            sourceDefId: reason,
            sourceControllerId: playerId,
            reason,
        },
        timestamp: now,
    } as SmashUpEvent;
}

type SimpleMinionEffectKind =
    | 'tempPower'
    | 'tempPowerDraw'
    | 'destroy'
    | 'destroyDraw'
    | 'shuffleIntoDeck'
    | 'addCounter'
    | 'addCounterDraw'
    | 'destroyOwnVp';

type SimpleMinionEffectContext = ZhongguoPromptContext & {
    sourceDefId: string;
    title: string;
    candidates: CounterTransferCandidate[];
    effectKind: SimpleMinionEffectKind;
    amount?: number;
    allowSkip?: boolean;
};

type MoveOwnMinionContext = ZhongguoPromptContext & {
    sourceDefId: string;
    title: string;
    candidates: CounterTransferCandidate[];
    selectedMinionUid?: string;
    fromBaseIndex?: number;
    requireOwn?: boolean;
    drawAfter?: boolean;
    extraActionAfter?: boolean;
};

function resolveSimpleMinionEffect(
    state: MatchState<SmashUpCore>,
    context: SimpleMinionEffectContext,
    selected: MinionChoice | undefined,
    timestamp: number,
    random: RandomFn,
): AbilityResult {
    if (selected?.skip) return { events: [] };
    if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
    const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
    if (!target) return { events: [] };

    if (context.effectKind === 'tempPower') {
        return {
            events: [addTempPower(target.uid, selected.baseIndex, context.amount ?? 0, context.sourceDefId, timestamp, {
                sourcePlayerId: context.playerId,
                sourceDefId: context.sourceDefId,
                sourceControllerId: context.playerId,
            })],
        };
    }

    if (context.effectKind === 'tempPowerDraw') {
        return {
            events: [
                addTempPower(target.uid, selected.baseIndex, context.amount ?? 0, context.sourceDefId, timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.sourceDefId,
                    sourceControllerId: context.playerId,
                }),
                ...buildStandardDrawEvents(state, context.playerId, 1, random, timestamp),
            ],
        };
    }

    if (context.effectKind === 'destroy' || context.effectKind === 'destroyDraw') {
        const destroyEvents = buildValidatedDestroyEvents(state, {
            minionUid: target.uid,
            minionDefId: target.defId,
            fromBaseIndex: selected.baseIndex,
            destroyerId: context.playerId,
            reason: context.sourceDefId,
            now: timestamp,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceDefId,
            sourceControllerId: context.playerId,
            sourceKind: 'action',
        });
        return {
            events: [
                ...destroyEvents,
                ...(context.effectKind === 'destroyDraw' && destroyEvents.some(event => event.type === SU_EVENTS.MINION_DESTROYED)
                    ? buildStandardDrawEvents(state, context.playerId, 1, random, timestamp)
                    : []),
            ],
        };
    }

    if (context.effectKind === 'shuffleIntoDeck') {
        return {
            events: buildShuffleMinionIntoDeckEvents(
                state,
                target,
                selected.baseIndex,
                context.playerId,
                context.sourceDefId,
                timestamp,
                random,
            ),
        };
    }

    if (context.effectKind === 'addCounter' || context.effectKind === 'addCounterDraw') {
        return {
            events: [
                addPowerCounter(target.uid, selected.baseIndex, context.amount ?? 1, context.sourceDefId, timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.sourceDefId,
                    sourceControllerId: context.playerId,
                }),
                ...(context.effectKind === 'addCounterDraw'
                    ? buildStandardDrawEvents(state, context.playerId, 1, random, timestamp)
                    : []),
            ],
        };
    }

    if (context.effectKind === 'destroyOwnVp') {
        if (target.controller !== context.playerId) return { events: [] };
        const destroyEvents = buildValidatedDestroyEvents(state, {
            minionUid: target.uid,
            minionDefId: target.defId,
            fromBaseIndex: selected.baseIndex,
            destroyerId: context.playerId,
            reason: context.sourceDefId,
            now: timestamp,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceDefId,
            sourceControllerId: context.playerId,
            sourceKind: 'action',
        });
        return {
            events: [
                ...destroyEvents,
                ...(destroyEvents.some(event => event.type === SU_EVENTS.MINION_DESTROYED)
                    ? [{
                        type: SU_EVENTS.VP_AWARDED,
                        payload: { playerId: context.playerId, amount: 1, reason: context.sourceDefId },
                        timestamp,
                    } as SmashUpEvent]
                    : []),
            ],
        };
    }

    return { events: [] };
}

const simpleMinionEffectPromptProgram = createPromptProgram<SimpleMinionEffectContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'zhongguo_simple_minion_effect',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceDefId}_${context.now}`,
        context.playerId,
        context.title,
        [
            ...(context.allowSkip ? [createSkipOption()] : []),
            ...buildMinionTargetOptions(context.candidates, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: context.sourceDefId,
                sourceKind: 'action',
                effectType: context.effectKind === 'destroy' || context.effectKind === 'destroyDraw' || context.effectKind === 'destroyOwnVp'
                    ? 'destroy'
                    : context.effectKind === 'shuffleIntoDeck'
                        ? 'move'
                        : 'affect',
                respectActionProtection: true,
            }),
        ],
        {
            sourceId: context.sourceDefId,
            targetType: 'minion',
            autoRefresh: 'field',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ state, context, value, timestamp, random }) =>
        resolveSimpleMinionEffect(state, context, value as MinionChoice | undefined, timestamp, random),
});

const moveOwnMinionDestinationPromptProgram = createPromptProgram<MoveOwnMinionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'zhongguo_move_own_minion_destination',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceDefId}_destination_${context.now}`,
        context.playerId,
        ZHONGGUO_PROMPT_TITLES.moveOwnMinionDestination,
        buildBaseTargetOptions(collectOtherBases(context.matchState.core, context.fromBaseIndex ?? -1), context.matchState.core),
        {
            sourceId: `${context.sourceDefId}_destination`,
            targetType: 'base',
            autoRefresh: 'field',
            responseValidationMode: 'live',
        },
    ),
    onResolve: (args) => {
        const { state, context, value, timestamp } = args;
        const selected = value as BaseChoice | undefined;
        if (!context.selectedMinionUid || context.fromBaseIndex === undefined || selected?.baseIndex === undefined) {
            return { events: [] };
        }
        const minion = state.core.bases[context.fromBaseIndex]?.minions.find(candidate => candidate.uid === context.selectedMinionUid);
        if (!minion || (context.requireOwn !== false && minion.controller !== context.playerId)) return { events: [] };
        const moveEvents = buildValidatedMoveEvents(state, {
            minionUid: minion.uid,
            minionDefId: minion.defId,
            fromBaseIndex: context.fromBaseIndex,
            toBaseIndex: selected.baseIndex,
            reason: context.sourceDefId,
            now: timestamp,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceDefId,
            sourceControllerId: context.playerId,
            sourceKind: 'action',
        });
        return {
            events: [
                ...moveEvents,
                ...(context.drawAfter && moveEvents.some(event => event.type === SU_EVENTS.MINION_MOVED)
                    ? buildStandardDrawEventsFromRuntimeContext(args, context.playerId, 1)
                    : []),
                ...(context.extraActionAfter && moveEvents.some(event => event.type === SU_EVENTS.MINION_MOVED)
                    ? [grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: state }, context.sourceDefId)]
                    : []),
            ],
        };
    },
});

const moveOwnMinionPromptProgram = createPromptProgram<MoveOwnMinionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'zhongguo_move_own_minion',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceDefId}_${context.now}`,
        context.playerId,
        context.title,
        buildMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceDefId,
            sourceKind: 'action',
            effectType: 'move',
            respectActionProtection: true,
        }),
        {
            sourceId: context.sourceDefId,
            targetType: 'minion',
            autoRefresh: 'field',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, value }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        return {
            events: [],
            context: {
                ...context,
                selectedMinionUid: selected.minionUid,
                fromBaseIndex: selected.baseIndex,
            },
            nextProgram: moveOwnMinionDestinationPromptProgram,
        };
    },
});

const vigilantesDeathWisherPromptProgram = createPromptProgram<VigilantesDeathWisherContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vigilantes_death_wisher',
    buildInteraction: (context) => {
        const candidates = collectMinionsMatching(
            context.matchState.core,
            minion => minion.controller === context.destroyerId,
        );
        return createAbilityRuntimeSimpleChoice(
            `vigilantes_death_wisher_${context.now}`,
            context.playerId,
            ZHONGGUO_PROMPT_TITLES.vigilantesDeathWisher,
            [
                createSkipOption('跳过（不消灭）', 'ui.vigilantes_death_wisher_skip_option'),
                ...buildMinionTargetOptions(candidates, {
                    state: context.matchState.core,
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'vigilantes_death_wisher',
                    sourceKind: 'nonAction',
                    effectType: 'destroy',
                }),
            ],
            {
                sourceId: 'vigilantes_death_wisher',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (selected?.skip || !selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const self = state.core.bases[context.selfBaseIndex]?.minions.find(minion => minion.uid === context.selfUid);
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        if (!self || !target || target.controller !== context.destroyerId) {
            return { events: [] };
        }
        return {
            events: [
                buildMinionMetadataUpdatedEvent(
                    self.uid,
                    context.selfBaseIndex,
                    { [VIGILANTES_DEATH_WISHER_TRIGGERED_TURN_META]: state.core.turnNumber },
                    'vigilantes_death_wisher_once_per_turn',
                    timestamp,
                ),
                ...buildValidatedDestroyEvents(state, {
                    minionUid: target.uid,
                    minionDefId: target.defId,
                    fromBaseIndex: selected.baseIndex,
                    destroyerId: context.playerId,
                    reason: 'vigilantes_death_wisher',
                    now: timestamp,
                    sourcePlayerId: context.playerId,
                    sourceCardUid: self.uid,
                    sourceDefId: 'vigilantes_death_wisher',
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.selfBaseIndex,
                    sourceKind: 'nonAction',
                }),
            ],
        };
    },
});

const vigilantesBrojakPromptProgram = createPromptProgram<VigilantesBrojakContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vigilantes_brojak',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `vigilantes_brojak_${context.now}`,
        context.playerId,
        ZHONGGUO_PROMPT_TITLES.vigilantesBrojak,
        [
            {
                id: 'follow',
                label: ZHONGGUO_PROMPT_TITLES.vigilantesBrojakFollowOption,
                labelKey: 'ui.vigilantes_brojak_follow_option',
                value: { skip: false },
                displayMode: 'button',
            },
            createSkipOption('跳过（不移动）', 'ui.vigilantes_brojak_skip_option'),
        ],
        {
            sourceId: 'vigilantes_brojak',
            targetType: 'button',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { skip?: boolean } | undefined;
        if (selected?.skip) return { events: [] };
        const self = state.core.bases[context.selfBaseIndex]?.minions.find(minion => minion.uid === context.selfUid);
        if (!self || context.targetBaseIndex === context.selfBaseIndex) {
            return { events: [] };
        }
        const moveEvents = buildValidatedMoveEvents(state, {
            minionUid: self.uid,
            minionDefId: self.defId,
            fromBaseIndex: context.selfBaseIndex,
            toBaseIndex: context.targetBaseIndex,
            reason: 'vigilantes_brojak',
            now: timestamp,
            sourcePlayerId: context.playerId,
            sourceCardUid: self.uid,
            sourceDefId: 'vigilantes_brojak',
            sourceControllerId: context.playerId,
            sourceBaseIndex: context.selfBaseIndex,
            sourceKind: 'nonAction',
        });
        if (!moveEvents.some(event => event.type === SU_EVENTS.MINION_MOVED)) {
            return { events: [] };
        }
        return {
            events: [
                ...moveEvents,
                addTempPower(self.uid, context.targetBaseIndex, 1, 'vigilantes_brojak', timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceCardUid: self.uid,
                    sourceDefId: 'vigilantes_brojak',
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.targetBaseIndex,
                }),
            ],
        };
    },
});

const truckersRallyPromptProgram = createPromptProgram<ZhongguoPromptContext & { sourceBaseIndex: number }, SmashUpCore, SmashUpEvent>({
    sourceId: 'truckers_rally',
    buildInteraction: (context) => {
        const candidates = collectMinionsMatching(context.matchState.core, (_minion, baseIndex) => baseIndex === context.sourceBaseIndex);
        return createAbilityRuntimeSimpleChoice(
            `truckers_rally_${context.now}`,
            context.playerId,
            ZHONGGUO_PROMPT_TITLES.truckersRally,
            buildMinionTargetOptions(candidates, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'truckers_rally',
                sourceKind: 'action',
                effectType: 'affect',
                respectActionProtection: true,
            }),
            {
                sourceId: 'truckers_rally',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        if (!target) return { events: [] };
        const controlledActions = state.core.bases[selected.baseIndex]?.ongoingActions.filter(action =>
            (((action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId) === playerId),
        ).length ?? 0;
        if (controlledActions <= 0) return { events: [] };
        return {
            events: [addTempPower(target.uid, selected.baseIndex, controlledActions * 2, 'truckers_rally', timestamp, {
                sourcePlayerId: playerId,
                sourceDefId: 'truckers_rally',
                sourceControllerId: playerId,
                sourceBaseIndex: selected.baseIndex,
            })],
        };
    },
});

const truckersTurnTheBeatAroundPenaltyPromptProgram = createPromptProgram<TruckersTurnTheBeatAroundContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'truckers_turn_the_beat_around_penalty',
    buildInteraction: (context) => {
        const candidates = collectMinionsMatching(
            context.matchState.core,
            (_minion, baseIndex) => baseIndex === context.affectedBaseIndex,
        );
        return createAbilityRuntimeSimpleChoice(
            `truckers_turn_the_beat_around_penalty_${context.now}`,
            context.playerId,
            ZHONGGUO_PROMPT_TITLES.truckersTurnTheBeatAroundPenalty,
            buildMinionTargetOptions(candidates, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'truckers_turn_the_beat_around',
                sourceKind: 'action',
                effectType: 'affect',
                respectActionProtection: true,
            }),
            {
                sourceId: 'truckers_turn_the_beat_around_penalty',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!context.affectedMinionUid || context.affectedBaseIndex === undefined || !selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const boostedMinion = state.core.bases[context.affectedBaseIndex]?.minions.find(minion => minion.uid === context.affectedMinionUid);
        const penalizedMinion = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        if (!boostedMinion || !penalizedMinion) return { events: [] };
        return {
            events: [
                addTempPower(boostedMinion.uid, context.affectedBaseIndex, 1, 'truckers_turn_the_beat_around', timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'truckers_turn_the_beat_around',
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.affectedBaseIndex,
                }),
                addTempPower(penalizedMinion.uid, selected.baseIndex, -1, 'truckers_turn_the_beat_around', timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'truckers_turn_the_beat_around',
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.affectedBaseIndex,
                }),
            ],
        };
    },
});

const truckersTurnTheBeatAroundBoostPromptProgram = createPromptProgram<TruckersTurnTheBeatAroundContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'truckers_turn_the_beat_around',
    buildInteraction: (context) => {
        const candidates = collectMinionsMatching(
            context.matchState.core,
            (_minion, baseIndex) => baseIndex === context.sourceBaseIndex,
        );
        return createAbilityRuntimeSimpleChoice(
            `truckers_turn_the_beat_around_${context.now}`,
            context.playerId,
            ZHONGGUO_PROMPT_TITLES.truckersTurnTheBeatAroundBoost,
            buildMinionTargetOptions(candidates, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'truckers_turn_the_beat_around',
                sourceKind: 'action',
                effectType: 'affect',
                respectActionProtection: true,
            }),
            {
                sourceId: 'truckers_turn_the_beat_around',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ context, value }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        return {
            events: [],
            context: {
                ...context,
                affectedMinionUid: selected.minionUid,
                affectedBaseIndex: selected.baseIndex,
            },
            nextProgram: truckersTurnTheBeatAroundPenaltyPromptProgram,
        };
    },
});

const truckersHighSpeedChaseBasePromptProgram = createPromptProgram<TruckersHighSpeedChaseContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'truckers_high_speed_chase_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `truckers_high_speed_chase_base_${context.now}`,
        context.playerId,
        ZHONGGUO_PROMPT_TITLES.truckersHighSpeedChaseBase,
        buildBaseTargetOptions(collectOtherBases(context.matchState.core, context.sourceBaseIndex), context.matchState.core),
        {
            sourceId: 'truckers_high_speed_chase_base',
            targetType: 'base',
            titleKey: 'ui.truckers_high_speed_chase_base_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as BaseChoice | undefined;
        if (!context.minionUid || !context.minionDefId || selected?.baseIndex === undefined) return { events: [] };
        const action = findBaseOngoingAction(state.core, context.sourceCardUid, context.sourceBaseIndex);
        if (!action) return { events: [] };
        const moveEvents = buildValidatedMoveEvents(state, {
            minionUid: context.minionUid,
            minionDefId: context.minionDefId,
            fromBaseIndex: context.sourceBaseIndex,
            toBaseIndex: selected.baseIndex,
            reason: 'truckers_high_speed_chase',
            now: timestamp,
            sourcePlayerId: context.sourceControllerId,
            sourceDefId: 'truckers_high_speed_chase',
            sourceControllerId: context.sourceControllerId,
            sourceBaseIndex: context.sourceBaseIndex,
            sourceKind: 'action',
        });
        return {
            events: [
                ...buildBaseOngoingActionControlEvents(
                    state,
                    action,
                    selected.baseIndex,
                    context.sourceControllerId,
                    'truckers_high_speed_chase',
                    timestamp,
                    { includeDetach: true, talentUsed: true },
                ),
                ...moveEvents,
                ...(moveEvents.length > 0
                    ? [addTempPower(context.minionUid, selected.baseIndex, 3, 'truckers_high_speed_chase', timestamp)]
                    : []),
            ],
        };
    },
});

const truckersHighSpeedChaseMinionPromptProgram = createPromptProgram<TruckersHighSpeedChaseContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'truckers_high_speed_chase_minion',
    buildInteraction: (context) => {
        const ownMinions = context.matchState.core.bases[context.sourceBaseIndex]?.minions
            .filter(minion => minion.controller === context.playerId)
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.sourceBaseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            })) ?? [];
        return createAbilityRuntimeSimpleChoice(
            `truckers_high_speed_chase_minion_${context.now}`,
            context.playerId,
            ZHONGGUO_PROMPT_TITLES.truckersHighSpeedChaseMinion,
            buildMinionTargetOptions(ownMinions, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'truckers_high_speed_chase',
                effectType: 'move',
            }),
            {
                sourceId: 'truckers_high_speed_chase_minion',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
                titleKey: 'ui.truckers_high_speed_chase_minion_title',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined || !selected.defId) {
            return { events: [] };
        }
        return {
            events: [],
            context: createPromptContext(state, context.playerId, timestamp, {
                sourceCardUid: context.sourceCardUid,
                sourceBaseIndex: selected.baseIndex,
                sourceControllerId: context.playerId,
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
            }),
            nextProgram: truckersHighSpeedChaseBasePromptProgram,
        };
    },
});

const truckersDekotoraMinionsPromptProgram = createPromptProgram<TruckersDekotoraContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'truckers_dekotora_minions',
    buildInteraction: (context) => {
        const ownMinions = context.matchState.core.bases[context.sourceBaseIndex]?.minions
            .filter(minion => minion.controller === context.playerId)
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.sourceBaseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            })) ?? [];
        return createAbilityRuntimeSimpleChoice(
            `truckers_dekotora_minions_${context.now}`,
            context.playerId,
            ZHONGGUO_PROMPT_TITLES.truckersDekotoraMinions,
            buildMinionTargetOptions(ownMinions, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'truckers_dekotora',
                effectType: 'move',
            }),
            {
                sourceId: 'truckers_dekotora_minions',
                targetType: 'minion',
                multi: { min: 0, max: Math.min(3, ownMinions.length) },
                autoRefresh: 'field',
                responseValidationMode: 'live',
                titleKey: 'ui.truckers_dekotora_minions_title',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        if (context.targetBaseIndex === undefined) return { events: [] };
        const action = findBaseOngoingAction(state.core, context.sourceCardUid, context.sourceBaseIndex);
        if (!action) return { events: [] };
        const selections = (Array.isArray(value) ? value : []) as MinionChoice[];
        const uniqueSelections = new Map<string, MinionChoice>();
        for (const selection of selections) {
            if (!selection.minionUid || selection.baseIndex === undefined || !selection.defId) continue;
            uniqueSelections.set(selection.minionUid, selection);
        }
        const moveEvents = [...uniqueSelections.values()].flatMap((selection) => buildValidatedMoveEvents(state, {
            minionUid: selection.minionUid!,
            minionDefId: selection.defId!,
            fromBaseIndex: context.sourceBaseIndex,
            toBaseIndex: context.targetBaseIndex!,
            reason: 'truckers_dekotora',
            now: timestamp,
            sourcePlayerId: context.sourceControllerId,
            sourceDefId: 'truckers_dekotora',
            sourceControllerId: context.sourceControllerId,
            sourceBaseIndex: context.sourceBaseIndex,
            sourceKind: 'action',
        }));
        return {
            events: [
                ...buildBaseOngoingActionControlEvents(
                    state,
                    action,
                    context.targetBaseIndex,
                    context.sourceControllerId,
                    'truckers_dekotora',
                    timestamp,
                    { includeDetach: true, talentUsed: true },
                ),
                ...moveEvents,
            ],
        };
    },
});

const truckersDekotoraBasePromptProgram = createPromptProgram<TruckersDekotoraContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'truckers_dekotora_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `truckers_dekotora_base_${context.now}`,
        context.playerId,
        ZHONGGUO_PROMPT_TITLES.truckersDekotoraBase,
        buildBaseTargetOptions(collectOtherBases(context.matchState.core, context.sourceBaseIndex), context.matchState.core),
        {
            sourceId: 'truckers_dekotora_base',
            targetType: 'base',
            titleKey: 'ui.truckers_dekotora_base_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as BaseChoice | undefined;
        if (selected?.baseIndex === undefined) return { events: [] };
        const ownMinions = state.core.bases[context.sourceBaseIndex]?.minions
            .filter(minion => minion.controller === context.playerId) ?? [];
        if (ownMinions.length === 0) {
            const action = findBaseOngoingAction(state.core, context.sourceCardUid, context.sourceBaseIndex);
            if (!action) return { events: [] };
            return {
                events: buildBaseOngoingActionControlEvents(
                    state,
                    action,
                    selected.baseIndex,
                    context.sourceControllerId,
                    'truckers_dekotora',
                    timestamp,
                    { includeDetach: true, talentUsed: true },
                ),
            };
        }
        return {
            events: [],
            context: createPromptContext(state, context.playerId, timestamp, {
                ...context,
                targetBaseIndex: selected.baseIndex,
            }),
            nextProgram: truckersDekotoraMinionsPromptProgram,
        };
    },
});

const truckersCabOverPeteCardPromptProgram = createPromptProgram<TruckersCabOverPeteContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'truckers_cab_over_pete_card',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `truckers_cab_over_pete_card_${context.now}`,
        context.playerId,
        ZHONGGUO_PROMPT_TITLES.truckersCabOverPeteCard,
        buildCardChoiceOptions(collectCabOverPeteControlledCards(
            context.matchState.core,
            context.playerId,
            context.sourceBaseIndex,
            context.sourceCardUid,
        )),
        {
            sourceId: 'truckers_cab_over_pete_card',
            targetType: 'card',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.truckers_cab_over_pete_card_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as CardChoice | undefined;
        if (context.targetBaseIndex === undefined || !selected?.kind || selected.baseIndex === undefined || !selected.defId) {
            return { events: [] };
        }
        const selfAction = findBaseOngoingAction(state.core, context.sourceCardUid, context.sourceBaseIndex);
        if (!selfAction) return { events: [] };
        const events: SmashUpEvent[] = [
            ...buildBaseOngoingActionControlEvents(
                state,
                selfAction,
                context.targetBaseIndex,
                context.sourceControllerId,
                'truckers_cab_over_pete',
                timestamp,
                { includeDetach: true, talentUsed: true },
            ),
        ];
        if (selected.kind === 'minion' && selected.minionUid) {
            events.push(...buildValidatedMoveEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: context.sourceBaseIndex,
                toBaseIndex: context.targetBaseIndex,
                reason: 'truckers_cab_over_pete',
                now: timestamp,
                sourcePlayerId: context.sourceControllerId,
                sourceCardUid: context.sourceCardUid,
                sourceDefId: 'truckers_cab_over_pete',
                sourceControllerId: context.sourceControllerId,
                sourceBaseIndex: context.sourceBaseIndex,
                sourceKind: 'action',
            }));
        } else if (selected.kind === 'ongoingAction' && selected.actionUid) {
            const targetAction = findBaseOngoingAction(state.core, selected.actionUid, context.sourceBaseIndex);
            if (targetAction && targetAction.controllerId === context.sourceControllerId) {
                events.push(...buildBaseOngoingActionControlEvents(
                    state,
                    targetAction,
                    context.targetBaseIndex,
                    context.sourceControllerId,
                    'truckers_cab_over_pete',
                    timestamp,
                    { includeDetach: true, talentUsed: targetAction.talentUsed },
                ));
            }
        }
        return { events };
    },
});

const truckersCabOverPeteBasePromptProgram = createPromptProgram<TruckersCabOverPeteContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'truckers_cab_over_pete_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `truckers_cab_over_pete_base_${context.now}`,
        context.playerId,
        ZHONGGUO_PROMPT_TITLES.truckersCabOverPeteBase,
        buildBaseTargetOptions(collectOtherBases(context.matchState.core, context.sourceBaseIndex), context.matchState.core),
        {
            sourceId: 'truckers_cab_over_pete_base',
            targetType: 'base',
            titleKey: 'ui.truckers_cab_over_pete_base_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as BaseChoice | undefined;
        if (selected?.baseIndex === undefined) return { events: [] };
        return {
            events: [],
            context: createPromptContext(state, context.playerId, timestamp, {
                ...context,
                targetBaseIndex: selected.baseIndex,
            }),
            nextProgram: truckersCabOverPeteCardPromptProgram,
        };
    },
});

const truckersHotwireBasePromptProgram = createPromptProgram<TruckersHotwireContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'truckers_hotwire_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `truckers_hotwire_base_${context.now}`,
        context.playerId,
        ZHONGGUO_PROMPT_TITLES.truckersHotwireBase,
        buildBaseTargetOptions(collectOtherBases(context.matchState.core, context.actionBaseIndex ?? -1), context.matchState.core),
        {
            sourceId: 'truckers_hotwire_base',
            targetType: 'base',
            titleKey: 'ui.truckers_hotwire_base_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as BaseChoice | undefined;
        if (
            !context.actionUid
            || context.actionBaseIndex === undefined
            || context.actionControllerId === undefined
            || selected?.baseIndex === undefined
        ) {
            return { events: [] };
        }
        const action = findBaseOngoingAction(state.core, context.actionUid, context.actionBaseIndex);
        if (!action) return { events: [] };
        const controllerId = context.actionMode === 'transfer_and_control'
            ? context.playerId
            : context.actionControllerId;
        return {
            events: buildBaseOngoingActionControlEvents(
                state,
                action,
                selected.baseIndex,
                controllerId,
                'truckers_hotwire',
                timestamp,
                { includeDetach: true },
            ),
        };
    },
});

const truckersHotwireModePromptProgram = createPromptProgram<TruckersHotwireContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'truckers_hotwire_mode',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `truckers_hotwire_mode_${context.now}`,
        context.playerId,
        ZHONGGUO_PROMPT_TITLES.truckersHotwireMode,
        buildTruckersActionModeOptions(context.availableModes ?? []),
        {
            sourceId: 'truckers_hotwire_mode',
            targetType: 'button',
            titleKey: 'ui.truckers_hotwire_mode_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as TruckersActionModeChoice | undefined;
        if (
            !selected?.mode
            || !context.actionUid
            || context.actionBaseIndex === undefined
            || context.actionControllerId === undefined
        ) {
            return { events: [] };
        }
        const action = findBaseOngoingAction(state.core, context.actionUid, context.actionBaseIndex);
        if (!action) return { events: [] };
        if (selected.mode === 'control') {
            return {
                events: buildBaseOngoingActionControlEvents(
                    state,
                    action,
                    context.actionBaseIndex,
                    context.playerId,
                    'truckers_hotwire',
                    timestamp,
                ),
            };
        }
        return {
            events: [],
            context: createPromptContext(state, context.playerId, timestamp, {
                ...context,
                actionMode: selected.mode,
            }),
            nextProgram: truckersHotwireBasePromptProgram,
        };
    },
});

const truckersHotwireActionPromptProgram = createPromptProgram<ZhongguoPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'truckers_hotwire_action',
    buildInteraction: (context) => {
        const candidates = collectBaseOngoingActions(
            context.matchState.core,
            candidate => getTruckersHotwireModes(context.matchState.core, context.playerId, candidate).length > 0,
        );
        return createAbilityRuntimeSimpleChoice(
            `truckers_hotwire_action_${context.now}`,
            context.playerId,
            ZHONGGUO_PROMPT_TITLES.truckersHotwireAction,
            buildBaseOngoingActionOptions(candidates),
            {
                sourceId: 'truckers_hotwire_action',
                targetType: 'generic',
                responseValidationMode: 'live',
                titleKey: 'ui.truckers_hotwire_action_title',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as BaseOngoingActionChoice | undefined;
        if (!selected?.actionUid || selected.baseIndex === undefined || !selected.defId) return { events: [] };
        const action = findBaseOngoingAction(state.core, selected.actionUid, selected.baseIndex);
        if (!action) return { events: [] };
        const modes = getTruckersHotwireModes(state.core, context.playerId, action);
        if (modes.length === 0) {
            return { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', timestamp)] };
        }
        if (modes.length === 1 && modes[0] === 'control') {
            return {
                events: buildBaseOngoingActionControlEvents(
                    state,
                    action,
                    action.baseIndex,
                    context.playerId,
                    'truckers_hotwire',
                    timestamp,
                ),
            };
        }
        const nextContext = createPromptContext(state, context.playerId, timestamp, {
            actionUid: action.uid,
            actionBaseIndex: action.baseIndex,
            actionDefId: action.defId,
            actionOwnerId: action.ownerId,
            actionControllerId: action.controllerId,
            availableModes: modes,
            ...(modes.length === 1 ? { actionMode: modes[0] } : {}),
        });
        return {
            events: [],
            context: nextContext,
            nextProgram: modes.length === 1 ? truckersHotwireBasePromptProgram : truckersHotwireModePromptProgram,
        };
    },
});

const truckersElBandidoTakeControlPromptProgram = createPromptProgram<ZhongguoPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'truckers_el_bandido_take_control',
    buildInteraction: (context) => {
        const candidates = collectBaseOngoingActions(
            context.matchState.core,
            candidate => candidate.controllerId !== context.playerId,
        );
        return createAbilityRuntimeSimpleChoice(
            `truckers_el_bandido_take_control_${context.now}`,
            context.playerId,
            ZHONGGUO_PROMPT_TITLES.truckersElBandidoTakeControl,
            [
                createSkipOption('跳过（不获得控制权）', 'ui.truckers_el_bandido_take_control_skip_option'),
                ...buildBaseOngoingActionOptions(candidates),
            ],
            {
                sourceId: 'truckers_el_bandido_take_control',
                targetType: 'generic',
                responseValidationMode: 'live',
                titleKey: 'ui.truckers_el_bandido_take_control_title',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as BaseOngoingActionChoice | undefined;
        if (selected?.skip) return { events: [] };
        if (!selected?.actionUid || selected.baseIndex === undefined) return { events: [] };
        const action = findBaseOngoingAction(state.core, selected.actionUid, selected.baseIndex);
        if (!action) return { events: [] };
        return {
            events: buildBaseOngoingActionControlEvents(
                state,
                action,
                action.baseIndex,
                context.playerId,
                'truckers_el_bandido',
                timestamp,
            ),
        };
    },
});

const truckersElBandidoTransferBasePromptProgram = createPromptProgram<TruckersElBandidoTransferContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'truckers_el_bandido_transfer_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `truckers_el_bandido_transfer_base_${context.now}`,
        context.playerId,
        ZHONGGUO_PROMPT_TITLES.truckersElBandidoTransferBase,
        buildBaseTargetOptions(collectOtherBases(context.matchState.core, context.actionBaseIndex ?? -1), context.matchState.core),
        {
            sourceId: 'truckers_el_bandido_transfer_base',
            targetType: 'base',
            titleKey: 'ui.truckers_el_bandido_transfer_base_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as BaseChoice | undefined;
        if (
            !context.actionUid
            || context.actionBaseIndex === undefined
            || context.actionControllerId === undefined
            || selected?.baseIndex === undefined
        ) {
            return { events: [] };
        }
        const action = findBaseOngoingAction(state.core, context.actionUid, context.actionBaseIndex);
        if (!action) return { events: [] };
        return {
            events: buildBaseOngoingActionControlEvents(
                state,
                action,
                selected.baseIndex,
                context.actionControllerId,
                'truckers_el_bandido',
                timestamp,
                { includeDetach: true },
            ),
        };
    },
});

const truckersElBandidoTransferActionPromptProgram = createPromptProgram<ZhongguoPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'truckers_el_bandido_transfer_action',
    buildInteraction: (context) => {
        const candidates = collectBaseOngoingActions(
            context.matchState.core,
            candidate => hasOtherBaseTarget(context.matchState.core, candidate.baseIndex),
        );
        return createAbilityRuntimeSimpleChoice(
            `truckers_el_bandido_transfer_action_${context.now}`,
            context.playerId,
            ZHONGGUO_PROMPT_TITLES.truckersElBandidoTransferAction,
            buildBaseOngoingActionOptions(candidates),
            {
                sourceId: 'truckers_el_bandido_transfer_action',
                targetType: 'generic',
                responseValidationMode: 'live',
                titleKey: 'ui.truckers_el_bandido_transfer_action_title',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as BaseOngoingActionChoice | undefined;
        if (!selected?.actionUid || selected.baseIndex === undefined || !selected.defId) return { events: [] };
        const action = findBaseOngoingAction(state.core, selected.actionUid, selected.baseIndex);
        if (!action) return { events: [] };
        return {
            events: [],
            context: createPromptContext(state, context.playerId, timestamp, {
                actionUid: action.uid,
                actionBaseIndex: action.baseIndex,
                actionDefId: action.defId,
                actionOwnerId: action.ownerId,
                actionControllerId: action.controllerId,
            }),
            nextProgram: truckersElBandidoTransferBasePromptProgram,
        };
    },
});

const truckersElBandidoTalentModePromptProgram = createPromptProgram<ZhongguoPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'truckers_el_bandido_talent_mode',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `truckers_el_bandido_talent_mode_${context.now}`,
        context.playerId,
        ZHONGGUO_PROMPT_TITLES.truckersElBandidoTalentMode,
        buildTruckersActionModeOptions(['extra_action', 'transfer']),
        {
            sourceId: 'truckers_el_bandido_talent_mode',
            targetType: 'button',
            titleKey: 'ui.truckers_el_bandido_talent_mode_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as TruckersActionModeChoice | undefined;
        if (!selected?.mode) return { events: [] };
        if (selected.mode === 'extra_action') {
            return {
                events: [grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: state }, 'truckers_el_bandido')],
            };
        }
        return {
            events: [],
            context: createPromptContext(state, context.playerId, timestamp),
            nextProgram: truckersElBandidoTransferActionPromptProgram,
        };
    },
});

const truckersSkinnyMinnieActionPromptProgram = createPromptProgram<TruckersSkinnyMinnieContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'truckers_skinny_minnie_action',
    buildInteraction: (context) => {
        const candidates = collectBaseOngoingActions(
            context.matchState.core,
            candidate => candidate.baseIndex === context.selfBaseIndex,
        );
        return createAbilityRuntimeSimpleChoice(
            `truckers_skinny_minnie_action_${context.now}`,
            context.playerId,
            ZHONGGUO_PROMPT_TITLES.truckersSkinnyMinnieAction,
            buildBaseOngoingActionOptions(candidates),
            {
                sourceId: 'truckers_skinny_minnie_action',
                targetType: 'generic',
                responseValidationMode: 'live',
                titleKey: 'ui.truckers_skinny_minnie_action_title',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        if (context.targetBaseIndex === undefined) return { events: [] };
        const selected = value as BaseOngoingActionChoice | undefined;
        if (!selected?.actionUid || selected.baseIndex === undefined || !selected.defId) return { events: [] };
        const self = state.core.bases[context.selfBaseIndex]?.minions.find(minion => minion.uid === context.selfUid);
        const action = findBaseOngoingAction(state.core, selected.actionUid, selected.baseIndex);
        if (!self || !action || self.controller !== context.playerId) return { events: [] };
        const moveEvents = buildValidatedMoveEvents(state, {
            minionUid: self.uid,
            minionDefId: self.defId,
            fromBaseIndex: context.selfBaseIndex,
            toBaseIndex: context.targetBaseIndex,
            reason: 'truckers_skinny_minnie',
            now: timestamp,
            sourcePlayerId: context.playerId,
            sourceDefId: 'truckers_skinny_minnie',
            sourceControllerId: context.playerId,
            sourceBaseIndex: context.selfBaseIndex,
            sourceKind: 'nonAction',
        });
        if (moveEvents.length === 0) return { events: [] };
        return {
            events: [
                ...moveEvents,
                ...buildBaseOngoingActionControlEvents(
                    state,
                    action,
                    context.targetBaseIndex,
                    action.controllerId,
                    'truckers_skinny_minnie',
                    timestamp,
                    { includeDetach: true },
                ),
            ],
        };
    },
});

const truckersSkinnyMinnieBasePromptProgram = createPromptProgram<TruckersSkinnyMinnieContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'truckers_skinny_minnie_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `truckers_skinny_minnie_base_${context.now}`,
        context.playerId,
        ZHONGGUO_PROMPT_TITLES.truckersSkinnyMinnieBase,
        buildBaseTargetOptions(collectOtherBases(context.matchState.core, context.selfBaseIndex), context.matchState.core),
        {
            sourceId: 'truckers_skinny_minnie_base',
            targetType: 'base',
            titleKey: 'ui.truckers_skinny_minnie_base_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as BaseChoice | undefined;
        if (selected?.baseIndex === undefined) return { events: [] };
        return {
            events: [],
            context: createPromptContext(state, context.playerId, timestamp, {
                ...context,
                targetBaseIndex: selected.baseIndex,
            }),
            nextProgram: truckersSkinnyMinnieActionPromptProgram,
        };
    },
});

function collectCounterTransferSources(state: SmashUpCore): CounterTransferCandidate[] {
    const result: CounterTransferCandidate[] = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        const base = state.bases[baseIndex];
        for (const minion of base.minions) {
            const powerCounters = minion.powerCounters ?? 0;
            if (powerCounters <= 0) continue;
            const name = getCardDef(minion.defId)?.name ?? minion.defId;
            result.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${name}（指示物 ${powerCounters}）`,
            });
        }
    }
    return result;
}

function collectCounterTransferTargets(
    state: SmashUpCore,
    sourceMinionUid: string,
    allowedAddBaseIndex?: number,
): CounterTransferCandidate[] {
    return collectAllMinions(state).filter((candidate) => {
        if (candidate.uid === sourceMinionUid) return false;
        if (allowedAddBaseIndex !== undefined && candidate.baseIndex !== allowedAddBaseIndex) return false;
        return true;
    });
}

function resolveTransferAmount(
    selected: CounterTransferChoice,
    maxAmount: number,
): number {
    const raw = typeof selected.amount === 'number'
        ? selected.amount
        : typeof selected.value === 'number'
            ? selected.value
            : maxAmount;
    const normalized = Math.floor(raw);
    return Math.max(1, Math.min(normalized, maxAmount));
}

function performCounterTransfer(
    sourceUid: string,
    sourceBaseIndex: number,
    targetUid: string,
    targetBaseIndex: number,
    amount: number,
    reason: string,
    now: number,
): SmashUpEvent[] {
    return [
        removePowerCounter(sourceUid, sourceBaseIndex, amount, reason, now),
        addPowerCounter(targetUid, targetBaseIndex, amount, reason, now),
    ];
}

const kungFuCounterTransferAmountPromptProgram = createPromptProgram<CounterTransferContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_counter_transfer_amount',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `kung_fu_counter_transfer_amount_${context.now}`,
            context.playerId,
            context.amountPromptTitle,
            [{
                id: 'confirm-transfer',
                label: '确认转移',
                labelKey: 'ui.kung_fu_fighters_counter_transfer_confirm_option',
                value: {
                    amount: context.sourceCounterAmount,
                    value: context.sourceCounterAmount,
                },
                displayMode: 'button' as const,
            }],
            {
                sourceId: 'kung_fu_counter_transfer_amount',
                targetType: 'button',
            },
        );
        (interaction.data as Record<string, unknown>).slider = {
            min: 1,
            max: context.sourceCounterAmount,
            step: 1,
            defaultValue: context.sourceCounterAmount,
            confirmOptionId: 'confirm-transfer',
        };
        return interaction;
    },
    onResolve: ({ state, context, value, timestamp }) => {
        if (
            !context.sourceMinionUid
            || context.sourceBaseIndex === undefined
            || !context.targetMinionUid
            || context.targetBaseIndex === undefined
        ) {
            return { events: [] };
        }
        const source = state.core.bases[context.sourceBaseIndex]?.minions.find(minion => minion.uid === context.sourceMinionUid);
        const target = state.core.bases[context.targetBaseIndex]?.minions.find(minion => minion.uid === context.targetMinionUid);
        const sourcePowerCounters = source?.powerCounters ?? 0;
        if (!source || !target || sourcePowerCounters <= 0) {
            return { events: [] };
        }
        const amount = resolveTransferAmount(value as CounterTransferChoice, sourcePowerCounters);
        return {
            events: performCounterTransfer(
                source.uid,
                context.sourceBaseIndex,
                target.uid,
                context.targetBaseIndex,
                amount,
                context.reason,
                timestamp,
            ),
        };
    },
});

const kungFuCounterTransferTargetPromptProgram = createPromptProgram<CounterTransferContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_counter_transfer_target',
    buildInteraction: (context) => {
        const targets = collectCounterTransferTargets(
            context.matchState.core,
            context.sourceMinionUid ?? '',
            context.allowedAddBaseIndex,
        );
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_counter_transfer_target_${context.now}`,
            context.playerId,
            context.targetPromptTitle,
            buildMinionTargetOptions(targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'affect',
            }),
            {
                sourceId: 'kung_fu_counter_transfer_target',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined || !context.sourceMinionUid || context.sourceBaseIndex === undefined) {
            return { events: [] };
        }
        const source = state.core.bases[context.sourceBaseIndex]?.minions.find(minion => minion.uid === context.sourceMinionUid);
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        const sourcePowerCounters = source?.powerCounters ?? 0;
        if (!source || !target || source.uid === target.uid || sourcePowerCounters <= 0) {
            return { events: [] };
        }

        const fixedAmount = context.fixedAmount ?? (sourcePowerCounters === 1 ? 1 : undefined);
        if (fixedAmount !== undefined) {
            return {
                events: performCounterTransfer(
                    source.uid,
                    context.sourceBaseIndex,
                    target.uid,
                    selected.baseIndex,
                    fixedAmount,
                    context.reason,
                    timestamp,
                ),
            };
        }

        return {
            events: [],
            context: {
                ...context,
                targetMinionUid: target.uid,
                targetBaseIndex: selected.baseIndex,
                sourceCounterAmount: sourcePowerCounters,
            },
            nextProgram: kungFuCounterTransferAmountPromptProgram,
        };
    },
});

const kungFuCounterTransferSourcePromptProgram = createPromptProgram<CounterTransferContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_counter_transfer_source',
    buildInteraction: (context) => {
        const sourceOptions = buildMinionTargetOptions(
            collectCounterTransferSources(context.matchState.core),
            {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'affect',
            },
        );
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_counter_transfer_source_${context.now}`,
            context.playerId,
            context.sourcePromptTitle,
            context.allowSkip ? [createSkipOption(), ...sourceOptions] : sourceOptions,
            {
                sourceId: 'kung_fu_counter_transfer_source',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ state, context, value }) => {
        const selected = value as MinionChoice | undefined;
        if (selected?.skip) {
            return { events: [] };
        }
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const source = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        const sourcePowerCounters = source?.powerCounters ?? 0;
        if (!source || sourcePowerCounters <= 0) {
            return { events: [] };
        }
        const targets = collectCounterTransferTargets(state.core, source.uid, context.allowedAddBaseIndex);
        if (targets.length === 0) {
            return { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)] };
        }
        return {
            events: [],
            context: {
                ...context,
                sourceMinionUid: source.uid,
                sourceBaseIndex: selected.baseIndex,
                sourceCounterAmount: sourcePowerCounters,
            },
            nextProgram: kungFuCounterTransferTargetPromptProgram,
        };
    },
});

function collectEverybodyWasBaseCandidates(state: SmashUpCore): Array<{ baseIndex: number; label: string }> {
    return state.bases
        .map((base, baseIndex) => {
            const controllers = new Set(base.minions.map(minion => minion.controller));
            return {
                baseIndex,
                label: getCardDef(base.defId)?.name ?? base.defId,
                controllerCount: controllers.size,
            };
        })
        .filter(candidate => candidate.controllerCount >= 2)
        .map(({ baseIndex, label }) => ({ baseIndex, label }));
}

function getEverybodyWasParticipantIds(state: SmashUpCore, baseIndex: number): PlayerId[] {
    const seen = new Set<PlayerId>();
    const participants: PlayerId[] = [];
    for (const minion of state.bases[baseIndex]?.minions ?? []) {
        if (seen.has(minion.controller)) continue;
        seen.add(minion.controller);
        participants.push(minion.controller);
    }
    return participants;
}

function buildEverybodyWasDestroyEvents(
    state: MatchState<SmashUpCore>,
    selections: EverybodyWasDestroySelection[],
    now: number,
): SmashUpEvent[] {
    return selections.flatMap(selection => buildValidatedDestroyEvents(state, {
        minionUid: selection.minionUid,
        minionDefId: selection.minionDefId,
        fromBaseIndex: selection.baseIndex,
        destroyerId: selection.playerId,
        reason: 'kung_fu_fighters_everybody_was_kung_fu_fighting',
        now,
        sourcePlayerId: selection.playerId,
        sourceDefId: 'kung_fu_fighters_everybody_was_kung_fu_fighting',
        sourceControllerId: selection.playerId,
        sourceBaseIndex: selection.baseIndex,
        sourceKind: 'action',
    }));
}

const everybodyWasTargetPromptProgram = createPromptProgram<EverybodyWasContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_everybody_was_kung_fu_fighting_target',
    buildInteraction: (context) => {
        const baseIndex = context.baseIndex ?? -1;
        const activePlayerId = context.remainingPlayerIds?.[0] ?? context.playerId;
        const selectedUids = new Set((context.selections ?? []).map(selection => selection.minionUid));
        const candidates = (context.matchState.core.bases[baseIndex]?.minions ?? [])
            .filter(minion => minion.controller !== activePlayerId && !selectedUids.has(minion.uid))
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            }));
        const options = buildMinionTargetOptions(candidates, {
            state: context.matchState.core,
            sourcePlayerId: activePlayerId,
            sourceDefId: 'kung_fu_fighters_everybody_was_kung_fu_fighting',
            sourceKind: 'action',
            effectType: 'destroy',
        });
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_fighters_everybody_was_target_${context.now}_${activePlayerId}`,
            activePlayerId,
            ZHONGGUO_PROMPT_TITLES.kungFuEverybodyWasTarget,
            options.length > 0 ? options : [createSkipOption()],
            {
                sourceId: 'kung_fu_fighters_everybody_was_kung_fu_fighting_target',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
                titleKey: 'ui.kung_fu_fighters_everybody_was_target_title',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const baseIndex = context.baseIndex;
        const remaining = [...(context.remainingPlayerIds ?? [])];
        const activePlayerId = remaining.shift();
        if (baseIndex === undefined || !activePlayerId) return { events: [] };
        const selected = value as MinionChoice | undefined;
        const selections = [...(context.selections ?? [])];
        if (!selected?.skip && selected?.minionUid && selected.baseIndex !== undefined) {
            const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
            if (target && target.controller !== activePlayerId) {
                selections.push({
                    playerId: activePlayerId,
                    minionUid: target.uid,
                    minionDefId: target.defId,
                    baseIndex: selected.baseIndex,
                });
            }
        }
        if (remaining.length === 0) {
            return { events: buildEverybodyWasDestroyEvents(state, selections, timestamp) };
        }
        return {
            events: [],
            context: createPromptContext(state, remaining[0]!, timestamp, {
                ...context,
                playerId: remaining[0]!,
                remainingPlayerIds: remaining,
                selections,
            }),
            nextProgram: everybodyWasTargetPromptProgram,
        };
    },
});

const everybodyWasBasePromptProgram = createPromptProgram<EverybodyWasContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_everybody_was_kung_fu_fighting_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `kung_fu_fighters_everybody_was_base_${context.now}`,
        context.playerId,
        ZHONGGUO_PROMPT_TITLES.kungFuEverybodyWasBase,
        buildBaseTargetOptions(collectEverybodyWasBaseCandidates(context.matchState.core), context.matchState.core),
        {
            sourceId: 'kung_fu_fighters_everybody_was_kung_fu_fighting_base',
            targetType: 'base',
            titleKey: 'ui.kung_fu_fighters_everybody_was_base_title',
        },
    ),
    onResolve: ({ state, value, timestamp }) => {
        const selected = value as BaseChoice | undefined;
        if (selected?.baseIndex === undefined) return { events: [] };
        const participants = getEverybodyWasParticipantIds(state.core, selected.baseIndex);
        if (participants.length === 0) return { events: [] };
        return {
            events: [],
            context: createPromptContext(state, participants[0]!, timestamp, {
                baseIndex: selected.baseIndex,
                remainingPlayerIds: participants,
                selections: [],
            }),
            nextProgram: everybodyWasTargetPromptProgram,
        };
    },
});

function collectExpertTimingTalentTargets(state: SmashUpCore, playerId: PlayerId): Array<{
    uid: string;
    defId: string;
    baseIndex: number;
    kind: 'minion' | 'ongoingAction';
    label: string;
}> {
    const ownMinionTargets = collectOwnMinions(state, playerId)
        .filter((candidate) => {
            const def = getCardDef(candidate.defId) as { abilityTags?: string[] } | undefined;
            return def?.abilityTags?.includes('talent') === true;
        })
        .map((candidate) => ({
            ...candidate,
            kind: 'minion' as const,
        }));

    const ownBaseActionTargets = collectBaseOngoingActions(
        state,
        (candidate) => {
            if (candidate.controllerId !== playerId) return false;
            const def = getCardDef(candidate.defId) as { abilityTags?: string[] } | undefined;
            return def?.abilityTags?.includes('talent') === true;
        },
    ).map((candidate) => ({
        uid: candidate.uid,
        defId: candidate.defId,
        baseIndex: candidate.baseIndex,
        kind: 'ongoingAction' as const,
        label: candidate.label,
    }));

    return [...ownMinionTargets, ...ownBaseActionTargets];
}

function buildExpertTimingExtraTalentEvent(
    selected: ExpertTimingCardChoice,
    now: number,
): SmashUpEvent | undefined {
    if (selected.baseIndex === undefined) return undefined;
    if (selected.kind === 'ongoingAction' && selected.actionUid) {
        return addOngoingCardCounter(
            selected.actionUid,
            selected.baseIndex,
            0,
            'kung_fu_fighters_expert_timing_extra_talent',
            now,
            {
                metadataUpdate: {
                    mythicHorsesSeastarExtraTalent: true,
                    mythicHorsesSeastarExtraTalentConsumed: false,
                },
            },
        );
    }
    if (selected.kind === 'minion' && selected.minionUid) {
        return buildMinionMetadataUpdatedEvent(
            selected.minionUid,
            selected.baseIndex,
            { mythicHorsesSeastarExtraTalent: true, mythicHorsesSeastarExtraTalentConsumed: false },
            'kung_fu_fighters_expert_timing_extra_talent',
            now,
        );
    }
    return undefined;
}

function collectExpertTimingCounterSources(state: SmashUpCore): Array<{
    uid: string;
    defId: string;
    baseIndex: number;
    kind: 'minion' | 'ongoingAction';
    label: string;
    counterAmount: number;
}> {
    const minionSources = collectCounterTransferSources(state).map((candidate) => {
        const minion = state.bases[candidate.baseIndex]?.minions.find(item => item.uid === candidate.uid);
        return {
            ...candidate,
            kind: 'minion' as const,
            counterAmount: minion?.powerCounters ?? 0,
        };
    });
    const ongoingSources = collectBaseOngoingActions(state)
        .map((candidate) => {
            const counterAmount = Number(candidate.metadata?.powerCounters ?? 0);
            return counterAmount > 0 ? {
                uid: candidate.uid,
                defId: candidate.defId,
                baseIndex: candidate.baseIndex,
                kind: 'ongoingAction' as const,
                label: `${candidate.label}（指示物 ${counterAmount}）`,
                counterAmount,
            } : undefined;
        })
        .filter((candidate): candidate is NonNullable<typeof candidate> => !!candidate);
    return [...minionSources, ...ongoingSources];
}

function collectExpertTimingCounterTargets(
    state: SmashUpCore,
    source: ExpertTimingCardChoice,
): Array<{
    uid: string;
    defId: string;
    baseIndex: number;
    kind: 'minion' | 'ongoingAction';
    label: string;
}> {
    const minionTargets = collectAllMinions(state)
        .filter(candidate => !(source.kind === 'minion' && source.minionUid === candidate.uid))
        .map(candidate => ({
            ...candidate,
            kind: 'minion' as const,
        }));
    const ongoingTargets = collectBaseOngoingActions(state)
        .filter(candidate => !(source.kind === 'ongoingAction' && source.actionUid === candidate.uid))
        .map(candidate => ({
            uid: candidate.uid,
            defId: candidate.defId,
            baseIndex: candidate.baseIndex,
            kind: 'ongoingAction' as const,
            label: candidate.label,
        }));
    return [...minionTargets, ...ongoingTargets];
}

function buildExpertTimingTransferEvents(
    state: MatchState<SmashUpCore>,
    context: KungFuExpertTimingContext,
    target: ExpertTimingCardChoice | undefined,
    timestamp: number,
): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    if ((context.mode === 'both' || context.mode === 'talent') && context.talentBaseIndex !== undefined) {
        const extraTalentEvent = buildExpertTimingExtraTalentEvent({
            kind: context.talentCardKind,
            minionUid: context.talentMinionUid,
            actionUid: context.talentActionUid,
            baseIndex: context.talentBaseIndex,
        }, timestamp);
        if (extraTalentEvent) {
            events.push(extraTalentEvent);
        }
    }

    if (
        !target?.kind
        || context.sourceCardKind === undefined
        || context.sourceBaseIndex === undefined
        || context.sourceCounterAmount === undefined
    ) {
        return events;
    }

    const amount = context.sourceCounterAmount;
    if (amount <= 0) return events;

    if (
        context.sourceCardKind === 'minion'
        && context.sourceMinionUid
        && target.kind === 'minion'
        && target.minionUid
        && target.baseIndex !== undefined
    ) {
        const source = state.core.bases[context.sourceBaseIndex]?.minions.find(minion => minion.uid === context.sourceMinionUid);
        const targetMinion = state.core.bases[target.baseIndex]?.minions.find(minion => minion.uid === target.minionUid);
        if (source && targetMinion && source.uid !== targetMinion.uid) {
            events.push(...performCounterTransfer(
                source.uid,
                context.sourceBaseIndex,
                targetMinion.uid,
                target.baseIndex,
                amount,
                'kung_fu_fighters_expert_timing',
                timestamp,
            ));
            return events;
        }
    }

    if (
        context.sourceCardKind === 'ongoingAction'
        && context.sourceActionUid
        && target.kind === 'minion'
        && target.minionUid
        && target.baseIndex !== undefined
    ) {
        events.push(
            addOngoingCardCounter(
                context.sourceActionUid,
                context.sourceBaseIndex,
                0,
                'kung_fu_fighters_expert_timing',
                timestamp,
                {
                    metadataUpdate: { powerCounters: 0 },
                    replaceMode: true,
                },
            ),
            addPowerCounter(target.minionUid, target.baseIndex, amount, 'kung_fu_fighters_expert_timing', timestamp),
        );
        return events;
    }

    if (
        context.sourceCardKind === 'minion'
        && context.sourceMinionUid
        && target.kind === 'ongoingAction'
        && target.actionUid
        && target.baseIndex !== undefined
    ) {
        events.push(
            removePowerCounter(context.sourceMinionUid, context.sourceBaseIndex, amount, 'kung_fu_fighters_expert_timing', timestamp),
            addOngoingCardCounter(
                target.actionUid,
                target.baseIndex,
                0,
                'kung_fu_fighters_expert_timing',
                timestamp,
                {
                    metadataUpdate: { powerCounters: amount },
                    replaceMode: true,
                },
            ),
        );
        return events;
    }

    if (
        context.sourceCardKind === 'ongoingAction'
        && context.sourceActionUid
        && target.kind === 'ongoingAction'
        && target.actionUid
        && target.baseIndex !== undefined
        && target.actionUid !== context.sourceActionUid
    ) {
        const targetAction = findBaseOngoingAction(state.core, target.actionUid, target.baseIndex);
        const targetCounters = Number(targetAction?.metadata?.powerCounters ?? 0);
        events.push(
            addOngoingCardCounter(
                context.sourceActionUid,
                context.sourceBaseIndex,
                0,
                'kung_fu_fighters_expert_timing',
                timestamp,
                {
                    metadataUpdate: { powerCounters: 0 },
                    replaceMode: true,
                },
            ),
            addOngoingCardCounter(
                target.actionUid,
                target.baseIndex,
                0,
                'kung_fu_fighters_expert_timing',
                timestamp,
                {
                    metadataUpdate: { powerCounters: targetCounters + amount },
                    replaceMode: true,
                },
            ),
        );
        return events;
    }

    return events;
}

const expertTimingTargetPromptProgram = createPromptProgram<KungFuExpertTimingContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_expert_timing_target',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `kung_fu_fighters_expert_timing_target_${context.now}`,
        context.playerId,
        ZHONGGUO_PROMPT_TITLES.kungFuExpertTimingTarget,
        buildCardChoiceOptions(collectExpertTimingCounterTargets(context.matchState.core, {
            kind: context.sourceCardKind,
            minionUid: context.sourceMinionUid,
            actionUid: context.sourceActionUid,
            baseIndex: context.sourceBaseIndex,
        })),
        {
            sourceId: 'kung_fu_fighters_expert_timing_target',
            targetType: 'card',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.kung_fu_fighters_expert_timing_target_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => ({
        events: buildExpertTimingTransferEvents(state, context, value as ExpertTimingCardChoice | undefined, timestamp),
    }),
});

const expertTimingSourcePromptProgram = createPromptProgram<KungFuExpertTimingContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_expert_timing_source',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `kung_fu_fighters_expert_timing_source_${context.now}`,
        context.playerId,
        ZHONGGUO_PROMPT_TITLES.kungFuExpertTimingSource,
        buildCardChoiceOptions(collectExpertTimingCounterSources(context.matchState.core)),
        {
            sourceId: 'kung_fu_fighters_expert_timing_source',
            targetType: 'card',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.kung_fu_fighters_expert_timing_source_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as ExpertTimingCardChoice | undefined;
        if (!selected?.kind || selected.baseIndex === undefined) {
            if ((context.mode === 'both' || context.mode === 'talent') && context.talentBaseIndex !== undefined) {
                const extraTalentEvent = buildExpertTimingExtraTalentEvent({
                    kind: context.talentCardKind,
                    minionUid: context.talentMinionUid,
                    actionUid: context.talentActionUid,
                    baseIndex: context.talentBaseIndex,
                }, timestamp);
                return { events: extraTalentEvent ? [extraTalentEvent] : [] };
            }
            return { events: [] };
        }
        const sourceCounters = selected.kind === 'minion'
            ? (state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid)?.powerCounters ?? 0)
            : Number(findBaseOngoingAction(state.core, selected.actionUid ?? '', selected.baseIndex)?.metadata?.powerCounters ?? 0);
        if (sourceCounters <= 0) {
            if ((context.mode === 'both' || context.mode === 'talent') && context.talentBaseIndex !== undefined) {
                const extraTalentEvent = buildExpertTimingExtraTalentEvent({
                    kind: context.talentCardKind,
                    minionUid: context.talentMinionUid,
                    actionUid: context.talentActionUid,
                    baseIndex: context.talentBaseIndex,
                }, timestamp);
                return { events: extraTalentEvent ? [extraTalentEvent] : [] };
            }
            return { events: [] };
        }
        return {
            events: [],
            context: {
                ...context,
                sourceCardKind: selected.kind,
                sourceMinionUid: selected.minionUid,
                sourceActionUid: selected.actionUid,
                sourceBaseIndex: selected.baseIndex,
                sourceCounterAmount: sourceCounters,
            },
            nextProgram: expertTimingTargetPromptProgram,
        };
    },
});

const expertTimingTalentPromptProgram = createPromptProgram<KungFuExpertTimingContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_expert_timing_talent',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `kung_fu_fighters_expert_timing_talent_${context.now}`,
        context.playerId,
        ZHONGGUO_PROMPT_TITLES.kungFuExpertTimingTalent,
        buildCardChoiceOptions(collectExpertTimingTalentTargets(context.matchState.core, context.playerId)),
        {
            sourceId: 'kung_fu_fighters_expert_timing_talent',
            targetType: 'card',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.kung_fu_fighters_expert_timing_talent_title',
        },
    ),
    onResolve: ({ context, value, timestamp }) => {
        const selected = value as ExpertTimingCardChoice | undefined;
        if (!selected?.kind || selected.baseIndex === undefined) return { events: [] };
        if (context.mode === 'both') {
            return {
                events: [],
                context: {
                    ...context,
                    talentCardKind: selected.kind,
                    talentMinionUid: selected.minionUid,
                    talentActionUid: selected.actionUid,
                    talentBaseIndex: selected.baseIndex,
                },
                nextProgram: expertTimingSourcePromptProgram,
            };
        }
        const extraTalentEvent = buildExpertTimingExtraTalentEvent(selected, timestamp);
        return { events: extraTalentEvent ? [extraTalentEvent] : [] };
    },
});

const expertTimingModePromptProgram = createPromptProgram<KungFuExpertTimingContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_expert_timing_mode',
    buildInteraction: (context) => {
        const canTransfer = collectExpertTimingCounterSources(context.matchState.core).length > 0
            && (collectAllMinions(context.matchState.core).length + collectBaseOngoingActions(context.matchState.core).length) > 1;
        const canTalent = collectExpertTimingTalentTargets(context.matchState.core, context.playerId).length > 0;
        const options: Array<{
            id: string;
            label: string;
            labelKey: string;
            value: { mode: KungFuExpertTimingMode };
            displayMode: 'button';
        }> = [];
        if (canTransfer) {
            options.push({
                id: 'transfer',
                label: '转移全部 +1 标记',
                labelKey: 'ui.kung_fu_fighters_expert_timing_transfer_option',
                value: { mode: 'transfer' },
                displayMode: 'button',
            });
        }
        if (canTalent) {
            options.push({
                id: 'talent',
                label: '额外使用一次天赋',
                labelKey: 'ui.kung_fu_fighters_expert_timing_talent_option',
                value: { mode: 'talent' },
                displayMode: 'button',
            });
        }
        if (canTransfer && canTalent) {
            options.push({
                id: 'both',
                label: '两者都做',
                labelKey: 'ui.kung_fu_fighters_expert_timing_both_option',
                value: { mode: 'both' },
                displayMode: 'button',
            });
        }
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_fighters_expert_timing_mode_${context.now}`,
            context.playerId,
            ZHONGGUO_PROMPT_TITLES.kungFuExpertTimingMode,
            options,
            {
                sourceId: 'kung_fu_fighters_expert_timing_mode',
                targetType: 'button',
                titleKey: 'ui.kung_fu_fighters_expert_timing_mode_title',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { mode?: KungFuExpertTimingMode } | undefined;
        if (!selected?.mode) return { events: [] };
        const nextContext = createPromptContext(state, context.playerId, timestamp, {
            ...context,
            mode: selected.mode,
        });
        return {
            events: [],
            context: nextContext,
            nextProgram: selected.mode === 'talent' || selected.mode === 'both'
                ? expertTimingTalentPromptProgram
                : expertTimingSourcePromptProgram,
        };
    },
});

const fastAsLightningPromptProgram = createPromptProgram<ZhongguoPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_fast_as_lightning',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `kung_fu_fighters_fast_as_lightning_${context.now}`,
        context.playerId,
        ZHONGGUO_PROMPT_TITLES.kungFuFastAsLightning,
        buildMinionTargetOptions(
            collectAllMinions(context.matchState.core),
            {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'kung_fu_fighters_fast_as_lightning',
                sourceKind: 'action',
                effectType: 'affect',
            },
        ),
        {
            sourceId: 'kung_fu_fighters_fast_as_lightning',
            targetType: 'minion',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.kung_fu_fighters_fast_as_lightning_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        if (!target) return { events: [] };
        return {
            events: [
                addTempPower(target.uid, selected.baseIndex, 2, 'kung_fu_fighters_fast_as_lightning', timestamp),
                buildMinionMetadataUpdatedEvent(
                    target.uid,
                    selected.baseIndex,
                    {
                        [KUNG_FU_FAST_AS_LIGHTNING_RETURN_TURN_META]: state.core.turnNumber,
                        [KUNG_FU_FAST_AS_LIGHTNING_SOURCE_PLAYER_META]: context.playerId,
                    },
                    'kung_fu_fighters_fast_as_lightning_return_marker',
                    timestamp,
                ),
            ],
        };
    },
});

const ancientChineseArtModePromptProgram = createPromptProgram<AncientChineseArtModeContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_ancient_chinese_art_mode',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.baseIndex];
        const canAdd = (base?.minions.length ?? 0) > 0;
        const canTransfer = collectCounterTransferSources(context.matchState.core).length > 0
            && collectAllMinions(context.matchState.core).length > 1;
        const options = [];
        if (canAdd) {
            options.push({
                id: 'add-counter',
                label: '放置 1 枚指示物',
                labelKey: 'ui.kung_fu_fighters_ancient_chinese_art_mode_add_option',
                value: { mode: 'add' },
                displayMode: 'button' as const,
            });
        }
        if (canTransfer) {
            options.push({
                id: 'transfer-counters',
                label: '转移指示物',
                labelKey: 'ui.kung_fu_fighters_ancient_chinese_art_mode_transfer_option',
                value: { mode: 'transfer' },
                displayMode: 'button' as const,
            });
        }
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_fighters_ancient_chinese_art_mode_${context.now}`,
            context.playerId,
            '古老的中国艺术：选择要发动的效果',
            options,
            {
                sourceId: 'kung_fu_fighters_ancient_chinese_art_mode',
                targetType: 'button',
                titleKey: 'ui.kung_fu_fighters_ancient_chinese_art_mode_title',
            },
        );
    },
    onResolve: ({ context, state, value, playerId, timestamp }) => {
        const selected = value as { mode?: 'add' | 'transfer' } | undefined;
        if (selected?.mode === 'add') {
            const base = state.core.bases[context.baseIndex];
            const targets = (base?.minions ?? []).map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            }));
            if (targets.length === 0) {
                return { events: [buildAbilityFeedback(playerId, 'feedback.no_valid_targets', timestamp)] };
            }
            return {
                events: [],
                context: createPromptContext(state, playerId, timestamp, {
                    reason: 'kung_fu_fighters_ancient_chinese_art',
                    sourcePromptTitle: '',
                    targetPromptTitle: '古老的中国艺术：选择本基地一个随从放置 1 枚指示物',
                    amountPromptTitle: '',
                    fixedAmount: 1,
                    allowedAddBaseIndex: context.baseIndex,
                    sourceMinionUid: '__virtual_counter_source__',
                    sourceBaseIndex: context.baseIndex,
                    sourceCounterAmount: 1,
                }),
                nextProgram: ancientChineseArtAddCounterPromptProgram,
            };
        }
        if (selected?.mode === 'transfer') {
            return runCounterTransferProgram(
                state,
                playerId,
                timestamp,
                {
                    reason: 'kung_fu_fighters_ancient_chinese_art',
                    sourcePromptTitle: '古老的中国艺术：选择要转出指示物的随从',
                    targetPromptTitle: '古老的中国艺术：选择接收指示物的另一个随从',
                    amountPromptTitle: '古老的中国艺术：选择要转移的指示物数量',
                },
            );
        }
        return { events: [] };
    },
});

const ancientChineseArtAddCounterPromptProgram = createPromptProgram<CounterTransferContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_ancient_chinese_art_add_counter',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.allowedAddBaseIndex ?? -1];
        const targets = (base?.minions ?? []).map((minion) => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: context.allowedAddBaseIndex ?? 0,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        }));
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_fighters_ancient_chinese_art_add_counter_${context.now}`,
            context.playerId,
            context.targetPromptTitle,
            buildMinionTargetOptions(targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'affect',
            }),
            {
                sourceId: 'kung_fu_fighters_ancient_chinese_art_add_counter',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const target = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!target) {
            return { events: [] };
        }
        return {
            events: [addPowerCounter(target.uid, selected.baseIndex, 1, context.reason, timestamp)],
        };
    },
});

const everybodyKnewPromptProgram = createPromptProgram<EverybodyKnewContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_everybody_knew_their_part',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `kung_fu_fighters_everybody_knew_their_part_${context.now}`,
        context.playerId,
        '各尽其责：选择你的一个随从',
        buildMinionTargetOptions(
            collectOwnMinions(context.matchState.core, context.playerId),
            {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
            },
        ),
        {
            sourceId: 'kung_fu_fighters_everybody_knew_their_part',
            targetType: 'minion',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.kung_fu_fighters_everybody_knew_their_part_title',
        },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const source = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!source || source.controller !== playerId) {
            return { events: [] };
        }
        const powerMax = getMinionPower(state.core, source, selected.baseIndex) - 1;
        if (powerMax < 0) {
            return { events: [buildAbilityFeedback(playerId, 'feedback.no_valid_targets', timestamp)] };
        }
        return {
            events: [
                grantContextualExtraMinion(
                    { playerId, now: timestamp, matchState: state },
                    'kung_fu_fighters_everybody_knew_their_part',
                    selected.baseIndex,
                    { powerMax },
                ),
            ],
        };
    },
});

const aLittleBitFrighteningRewardPromptProgram = createPromptProgram<ABitFrighteningContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_a_little_bit_frightening_reward',
    buildInteraction: (context) => {
        const baseIndex = context.referenceBaseIndex ?? -1;
        const ownMinions = (context.matchState.core.bases[baseIndex]?.minions ?? [])
            .filter((minion) => minion.controller === context.playerId)
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            }));
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_fighters_a_little_bit_frightening_reward_${context.now}`,
            context.playerId,
            '有些胆寒：选择该处你的一个随从放置 2 枚指示物',
            buildMinionTargetOptions(ownMinions, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'affect',
            }),
            {
                sourceId: 'kung_fu_fighters_a_little_bit_frightening_reward',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
                titleKey: 'ui.kung_fu_fighters_a_little_bit_frightening_reward_title',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const target = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!target || target.controller !== context.playerId || selected.baseIndex !== context.referenceBaseIndex) {
            return { events: [] };
        }
        return {
            events: [addPowerCounter(target.uid, selected.baseIndex, 2, 'kung_fu_fighters_a_little_bit_frightening', timestamp)],
        };
    },
});

const aLittleBitFrighteningDestroyPromptProgram = createPromptProgram<ABitFrighteningContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_a_little_bit_frightening_destroy',
    buildInteraction: (context) => {
        const baseIndex = context.referenceBaseIndex ?? -1;
        const threshold = context.referencePower ?? 0;
        const targets = (context.matchState.core.bases[baseIndex]?.minions ?? [])
            .filter((minion) => minion.uid !== context.referenceMinionUid && getMinionPower(context.matchState.core, minion, baseIndex) < threshold)
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量 ${getMinionPower(context.matchState.core, minion, baseIndex)}）`,
            }));
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_fighters_a_little_bit_frightening_destroy_${context.now}`,
            context.playerId,
            '有些胆寒：选择该基地一个更低战力的随从消灭',
            buildMinionTargetOptions(targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'destroy',
            }),
            {
                sourceId: 'kung_fu_fighters_a_little_bit_frightening_destroy',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
                titleKey: 'ui.kung_fu_fighters_a_little_bit_frightening_destroy_title',
            },
        );
    },
    onResolve: ({ state, context, value, playerId, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined || context.referenceBaseIndex === undefined) {
            return { events: [] };
        }
        const base = state.core.bases[context.referenceBaseIndex];
        const target = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!base || !target || selected.baseIndex !== context.referenceBaseIndex) {
            return { events: [] };
        }
        const destroyEvents = buildValidatedDestroyEvents(state, {
            minionUid: target.uid,
            minionDefId: target.defId,
            fromBaseIndex: selected.baseIndex,
            destroyerId: playerId,
            reason: 'kung_fu_fighters_a_little_bit_frightening',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'kung_fu_fighters_a_little_bit_frightening',
            sourceControllerId: playerId,
            sourceBaseIndex: context.referenceBaseIndex,
        });
        if (!destroyEvents.some((event) => event.type === SU_EVENTS.MINION_DESTROYED)) {
            return { events: destroyEvents };
        }
        const ownMinions = base.minions.filter((minion) => minion.controller === playerId);
        if (ownMinions.length === 0) {
            return { events: destroyEvents };
        }
        if (ownMinions.length === 1) {
            return {
                events: [
                    ...destroyEvents,
                    addPowerCounter(ownMinions[0].uid, context.referenceBaseIndex, 2, 'kung_fu_fighters_a_little_bit_frightening', timestamp),
                ],
            };
        }
        return {
            events: destroyEvents,
            context,
            nextProgram: aLittleBitFrighteningRewardPromptProgram,
        };
    },
});

const aLittleBitFrighteningReferencePromptProgram = createPromptProgram<ABitFrighteningContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_a_little_bit_frightening_reference',
    buildInteraction: (context) => {
        const candidates = collectAllMinions(context.matchState.core).filter((candidate) => {
            const base = context.matchState.core.bases[candidate.baseIndex];
            const reference = base?.minions.find((minion) => minion.uid === candidate.uid);
            if (!base || !reference) return false;
            const referencePower = getMinionPower(context.matchState.core, reference, candidate.baseIndex);
            const hasLowerPowerTarget = base.minions.some((minion) =>
                minion.uid !== reference.uid && getMinionPower(context.matchState.core, minion, candidate.baseIndex) < referencePower,
            );
            const hasOwnRecipient = base.minions.some((minion) => minion.controller === context.playerId);
            return hasLowerPowerTarget && hasOwnRecipient;
        }).map((candidate) => {
            const minion = context.matchState.core.bases[candidate.baseIndex]?.minions.find((entry) => entry.uid === candidate.uid);
            const power = minion ? getMinionPower(context.matchState.core, minion, candidate.baseIndex) : 0;
            return {
                ...candidate,
                label: `${candidate.label}（力量 ${power}）`,
            };
        });
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_fighters_a_little_bit_frightening_reference_${context.now}`,
            context.playerId,
            '有些胆寒：选择一个随从作为参照',
            buildMinionTargetOptions(candidates, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
            }),
            {
                sourceId: 'kung_fu_fighters_a_little_bit_frightening_reference',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
                titleKey: 'ui.kung_fu_fighters_a_little_bit_frightening_reference_title',
            },
        );
    },
    onResolve: ({ state, value, playerId, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const reference = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!reference) {
            return { events: [] };
        }
        return {
            events: [],
            context: createPromptContext(state, playerId, timestamp, {
                referenceMinionUid: reference.uid,
                referenceBaseIndex: selected.baseIndex,
                referencePower: getMinionPower(state.core, reference, selected.baseIndex),
            }),
            nextProgram: aLittleBitFrighteningDestroyPromptProgram,
        };
    },
});

const letsGetItOnChooseTargetsPromptProgram = createPromptProgram<LetsGetItOnContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_lets_get_it_on_targets',
    buildInteraction: (context) => {
        const baseIndex = context.sourceBaseIndex ?? -1;
        const base = context.matchState.core.bases[baseIndex];
        const threshold = context.sourcePower ?? 0;
        const targets = (base?.minions ?? [])
            .filter((minion) => getMinionPower(context.matchState.core, minion, baseIndex) <= threshold)
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量 ${getMinionPower(context.matchState.core, minion, baseIndex)}）`,
            }));
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_fighters_lets_get_it_on_targets_${context.now}`,
            context.playerId,
            '让我们躁起来：选择一个或多个要消灭的随从',
            buildMinionTargetOptions(targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'destroy',
            }),
            {
                sourceId: 'kung_fu_fighters_lets_get_it_on_targets',
                targetType: 'minion',
                multi: { min: 1, max: Math.max(1, targets.length) },
                autoRefresh: 'field',
                responseValidationMode: 'live',
                titleKey: 'ui.kung_fu_fighters_lets_get_it_on_targets_title',
            },
        );
    },
    onResolve: ({ state, value, playerId, timestamp }) => {
        const selections = Array.isArray(value) ? value as MinionChoice[] : [];
        const uniqueSelections = new Map<string, MinionChoice>();
        for (const selection of selections) {
            if (!selection.minionUid || selection.baseIndex === undefined) continue;
            uniqueSelections.set(`${selection.baseIndex}:${selection.minionUid}`, selection);
        }
        if (uniqueSelections.size === 0) {
            return { events: [] };
        }
        const events: SmashUpEvent[] = [];
        for (const selection of uniqueSelections.values()) {
            const target = state.core.bases[selection.baseIndex!]?.minions.find((minion) => minion.uid === selection.minionUid);
            if (!target) continue;
            events.push(...buildValidatedDestroyEvents(state, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: selection.baseIndex!,
                destroyerId: playerId,
                reason: 'kung_fu_fighters_lets_get_it_on',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'kung_fu_fighters_lets_get_it_on',
                sourceControllerId: playerId,
                sourceBaseIndex: selection.baseIndex,
            }));
        }
        return { events };
    },
});

const letsGetItOnChooseSourcePromptProgram = createPromptProgram<LetsGetItOnContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_lets_get_it_on_source',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `kung_fu_fighters_lets_get_it_on_source_${context.now}`,
        context.playerId,
        '让我们躁起来：选择你的一个随从',
        buildMinionTargetOptions(
            collectOwnMinions(context.matchState.core, context.playerId),
            {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
            },
        ),
        {
            sourceId: 'kung_fu_fighters_lets_get_it_on_source',
            targetType: 'minion',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.kung_fu_fighters_lets_get_it_on_source_title',
        },
    ),
    onResolve: ({ state, value, playerId, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const source = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!source || source.controller !== playerId) {
            return { events: [] };
        }
        const sourcePower = getMinionPower(state.core, source, selected.baseIndex);
        const targetCount = state.core.bases[selected.baseIndex]?.minions.filter((minion) =>
            getMinionPower(state.core, minion, selected.baseIndex!) <= sourcePower,
        ).length ?? 0;
        if (targetCount === 0) {
            return { events: [buildAbilityFeedback(playerId, 'feedback.no_valid_targets', timestamp)] };
        }
        return {
            events: [],
            context: createPromptContext(state, playerId, timestamp, {
                sourceMinionUid: source.uid,
                sourceBaseIndex: selected.baseIndex,
                sourcePower,
            }),
            nextProgram: letsGetItOnChooseTargetsPromptProgram,
        };
    },
});

const ohHohHohHoahPromptProgram = createPromptProgram<OhHohHohHoahContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_oh_hoh_hoh_hoah',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.baseIndex];
        const ownMinions = (base?.minions ?? [])
            .filter((minion) => minion.controller === context.playerId)
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            }));
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_fighters_oh_hoh_hoh_hoah_${context.now}`,
            context.playerId,
            '哦-厚-厚-厚-厚：选择你的一个随从放置 1 枚指示物',
            buildMinionTargetOptions(ownMinions, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'affect',
            }),
            {
                sourceId: 'kung_fu_fighters_oh_hoh_hoh_hoah',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
                titleKey: 'ui.kung_fu_fighters_oh_hoh_hoh_hoah_title',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const target = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!target || target.controller !== context.playerId) {
            return { events: [] };
        }
        return {
            events: [addPowerCounter(target.uid, selected.baseIndex, 1, 'kung_fu_fighters_oh_hoh_hoh_hoah', timestamp)],
        };
    },
});

const cricketOnPlayProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) =>
    runCounterTransferProgram(
        ctx.matchState,
        ctx.playerId,
        ctx.now,
        {
            reason: 'kung_fu_fighters_cricket',
            sourcePromptTitle: '蟋蟀：选择要转出 1 枚指示物的随从',
            targetPromptTitle: '蟋蟀：选择接收该指示物的另一个随从',
            amountPromptTitle: '',
            allowSkip: true,
            fixedAmount: 1,
        },
    ));

const fastAsLightningOnPlayProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    if (collectAllMinions(ctx.state).length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        fastAsLightningPromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
});

const everybodyWasOnPlayProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    if (collectEverybodyWasBaseCandidates(ctx.state).length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        everybodyWasBasePromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
});

const expertTimingProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const canTransfer = collectCounterTransferSources(ctx.state).length > 0
        && collectAllMinions(ctx.state).length > 1;
    const canTalent = collectExpertTimingTalentTargets(ctx.state, ctx.playerId).length > 0;
    if (!canTransfer && !canTalent) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        expertTimingModePromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
});

const dragonWarriorTalentProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) =>
    runCounterTransferProgram(
        ctx.matchState,
        ctx.playerId,
        ctx.now,
        {
            reason: 'kung_fu_fighters_dragon_warrior',
            sourcePromptTitle: '神龙武者：选择要转出指示物的随从',
            targetPromptTitle: '神龙武者：选择接收指示物的另一个随从',
            amountPromptTitle: '神龙武者：选择要转移的指示物数量',
        },
    ));

const ancientChineseArtTalentProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const base = ctx.state.bases[ctx.baseIndex];
    const canAdd = (base?.minions.length ?? 0) > 0;
    const canTransfer = collectCounterTransferSources(ctx.state).length > 0
        && collectAllMinions(ctx.state).length > 1;
    if (!canAdd && !canTransfer) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (canAdd && !canTransfer) {
        const onlyTargets = (base?.minions ?? []);
        if (onlyTargets.length === 1) {
            return { events: [addPowerCounter(onlyTargets[0].uid, ctx.baseIndex, 1, 'kung_fu_fighters_ancient_chinese_art', ctx.now)] };
        }
        const result = executeAbilityProgram(
            ancientChineseArtAddCounterPromptProgram,
            createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
                reason: 'kung_fu_fighters_ancient_chinese_art',
                sourcePromptTitle: '',
                targetPromptTitle: '古老的中国艺术：选择本基地一个随从放置 1 枚指示物',
                amountPromptTitle: '',
                allowedAddBaseIndex: ctx.baseIndex,
            }),
        );
        return { events: result.events, matchState: result.matchState };
    }
    if (!canAdd && canTransfer) {
        return runCounterTransferProgram(
            ctx.matchState,
            ctx.playerId,
            ctx.now,
            {
                reason: 'kung_fu_fighters_ancient_chinese_art',
                sourcePromptTitle: '古老的中国艺术：选择要转出指示物的随从',
                targetPromptTitle: '古老的中国艺术：选择接收指示物的另一个随从',
                amountPromptTitle: '古老的中国艺术：选择要转移的指示物数量',
            },
        );
    }
    const result = executeAbilityProgram(
        ancientChineseArtModePromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            cardUid: ctx.cardUid,
            baseIndex: ctx.baseIndex,
        }),
    );
    return { events: result.events, matchState: result.matchState };
});

const everybodyKnewOnPlayProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        everybodyKnewPromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
});

const aLittleBitFrighteningOnPlayProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const hasReference = collectAllMinions(ctx.state).some((candidate) => {
        const base = ctx.state.bases[candidate.baseIndex];
        const reference = base?.minions.find((minion) => minion.uid === candidate.uid);
        if (!base || !reference) return false;
        const referencePower = getMinionPower(ctx.state, reference, candidate.baseIndex);
        const hasLowerPowerTarget = base.minions.some((minion) =>
            minion.uid !== reference.uid && getMinionPower(ctx.state, minion, candidate.baseIndex) < referencePower,
        );
        const hasOwnRecipient = base.minions.some((minion) => minion.controller === ctx.playerId);
        return hasLowerPowerTarget && hasOwnRecipient;
    });
    if (!hasReference) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        aLittleBitFrighteningReferencePromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
});

const letsGetItOnOnPlayProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        letsGetItOnChooseSourcePromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
});

function runCounterTransferProgram(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    config: Omit<CounterTransferContext, 'matchState' | 'playerId' | 'now'>,
): AbilityResult {
    const sources = collectCounterTransferSources(matchState.core);
    if (sources.length === 0 || collectAllMinions(matchState.core).length < 2) {
        return { events: [buildAbilityFeedback(playerId, 'feedback.no_valid_targets', now)] };
    }
    const result = executeAbilityProgram(
        kungFuCounterTransferSourcePromptProgram,
        createPromptContext(matchState, playerId, now, config),
    );
    return {
        events: result.events,
        matchState: result.matchState,
    };
}

function drunkenMasterTalent(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find((minion) => minion.uid === ctx.cardUid);
    if (!self || self.controller !== ctx.playerId) {
        return { events: [] };
    }
    if ((self.powerCounters ?? 0) > 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    }
    return {
        events: [addPowerCounter(self.uid, ctx.baseIndex, 1, 'kung_fu_fighters_drunken_master', ctx.now)],
    };
}

function ladyWhirlwindTalent(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find((minion) => minion.uid === ctx.cardUid);
    if (!self || self.controller !== ctx.playerId) {
        return { events: [] };
    }
    if (self.powerCounters > 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    }
    const selfPower = getMinionPower(ctx.state, self, ctx.baseIndex);
    const targets = ctx.state.bases[ctx.baseIndex]?.minions
        .filter((minion) => minion.uid !== ctx.cardUid && getMinionPower(ctx.state, minion, ctx.baseIndex) < selfPower)
        .map((minion) => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: ctx.baseIndex,
            label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量 ${getMinionPower(ctx.state, minion, ctx.baseIndex)}）`,
        })) ?? [];
    if (targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (targets.length === 1) {
        const target = targets[0];
        const destroyEvents = buildValidatedDestroyEvents(ctx.matchState, {
            minionUid: target.uid,
            minionDefId: target.defId,
            fromBaseIndex: ctx.baseIndex,
            destroyerId: ctx.playerId,
            reason: 'kung_fu_fighters_lady_whirlwind',
            now: ctx.now,
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: 'kung_fu_fighters_lady_whirlwind',
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
            sourceKind: 'nonAction',
        });
        return {
            events: [
                ...destroyEvents,
                ...(destroyEvents.some((event) => event.type === SU_EVENTS.MINION_DESTROYED)
                    ? [addPowerCounter(self.uid, ctx.baseIndex, 1, 'kung_fu_fighters_lady_whirlwind', ctx.now)]
                    : []),
            ],
        };
    }
    const result = executeAbilityProgram(
        ladyWhirlwindPromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            selfUid: ctx.cardUid,
            selfBaseIndex: ctx.baseIndex,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

const ladyWhirlwindPromptProgram = createPromptProgram<
    ZhongguoPromptContext & { selfUid: string; selfBaseIndex: number },
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'kung_fu_fighters_lady_whirlwind',
    buildInteraction: (context) => {
        const self = context.matchState.core.bases[context.selfBaseIndex]?.minions.find((minion) => minion.uid === context.selfUid);
        const selfPower = self ? getMinionPower(context.matchState.core, self, context.selfBaseIndex) : 0;
        const targets = context.matchState.core.bases[context.selfBaseIndex]?.minions
            .filter((minion) => minion.uid !== context.selfUid && getMinionPower(context.matchState.core, minion, context.selfBaseIndex) < selfPower)
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.selfBaseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量 ${getMinionPower(context.matchState.core, minion, context.selfBaseIndex)}）`,
            })) ?? [];
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_fighters_lady_whirlwind_${context.now}`,
            context.playerId,
            '旋风女侠：选择要消灭的更低战力随从',
            buildMinionTargetOptions(targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'destroy',
            }),
            {
                sourceId: 'kung_fu_fighters_lady_whirlwind',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
                titleKey: 'ui.kung_fu_fighters_lady_whirlwind_title',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const self = state.core.bases[context.selfBaseIndex]?.minions.find((minion) => minion.uid === context.selfUid);
        const target = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!self || !target || self.controller !== context.playerId) {
            return { events: [] };
        }
        const destroyEvents = buildValidatedDestroyEvents(state, {
            minionUid: target.uid,
            minionDefId: target.defId,
            fromBaseIndex: selected.baseIndex,
            destroyerId: context.playerId,
            reason: 'kung_fu_fighters_lady_whirlwind',
            now: timestamp,
            sourcePlayerId: context.playerId,
            sourceCardUid: context.selfUid,
            sourceDefId: 'kung_fu_fighters_lady_whirlwind',
            sourceControllerId: context.playerId,
            sourceBaseIndex: context.selfBaseIndex,
            sourceKind: 'nonAction',
        });
        return {
            events: [
                ...destroyEvents,
                ...(destroyEvents.some((event) => event.type === SU_EVENTS.MINION_DESTROYED)
                    ? [addPowerCounter(self.uid, context.selfBaseIndex, 1, 'kung_fu_fighters_lady_whirlwind', timestamp)]
                    : []),
            ],
        };
    },
});

function canTriggerOhHohHohHoah(ctx: TriggerContext): boolean {
    if (ctx.baseIndex === undefined || ctx.sourceControllerId === undefined) {
        return false;
    }
    if (ctx.playerId === ctx.sourceControllerId) {
        return false;
    }
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) {
        return false;
    }
    return base.minions.some((minion) => minion.controller === ctx.sourceControllerId);
}

function fastAsLightningReturnTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined || !ctx.triggerMinionUid || !ctx.triggerMinionDefId) {
        return [];
    }
    const minion = ctx.triggerMinion
        ?? ctx.state.bases[ctx.baseIndex]?.minions.find(candidate => candidate.uid === ctx.triggerMinionUid);
    if (!minion) return [];
    const markedTurn = Number(minion.metadata?.[KUNG_FU_FAST_AS_LIGHTNING_RETURN_TURN_META] ?? -1);
    if (markedTurn !== ctx.state.turnNumber) {
        return [];
    }
    const sourcePlayerId = (minion.metadata?.[KUNG_FU_FAST_AS_LIGHTNING_SOURCE_PLAYER_META] as PlayerId | undefined)
        ?? minion.controller;
    return buildValidatedReturnEvents(ctx.state, {
        minionUid: minion.uid,
        minionDefId: minion.defId,
        fromBaseIndex: ctx.baseIndex,
        toPlayerId: minion.owner,
        reason: 'kung_fu_fighters_fast_as_lightning',
        now: ctx.now,
        sourcePlayerId,
        sourceDefId: 'kung_fu_fighters_fast_as_lightning',
        sourceControllerId: sourcePlayerId,
        sourceBaseIndex: ctx.baseIndex,
        sourceKind: 'action',
    });
}

function ohHohHohHoahTrigger(
    ctx: TriggerContext,
): SmashUpEvent[] | { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    if (!canTriggerOhHohHohHoah(ctx) || ctx.baseIndex === undefined || ctx.sourceControllerId === undefined) {
        return [];
    }
    const base = ctx.state.bases[ctx.baseIndex];
    const ownMinions = base?.minions.filter((minion) => minion.controller === ctx.sourceControllerId) ?? [];
    if (ownMinions.length === 0) {
        return [];
    }
    if (ownMinions.length === 1) {
        return {
            events: [addPowerCounter(ownMinions[0].uid, ctx.baseIndex, 1, 'kung_fu_fighters_oh_hoh_hoh_hoah', ctx.now)],
        };
    }
    if (!ctx.matchState) {
        return {
            events: [addPowerCounter(ownMinions[0].uid, ctx.baseIndex, 1, 'kung_fu_fighters_oh_hoh_hoh_hoah', ctx.now)],
        };
    }
    const result = executeAbilityProgram(
        ohHohHohHoahPromptProgram,
        createPromptContext(ctx.matchState, ctx.sourceControllerId, ctx.now, {
            baseIndex: ctx.baseIndex,
        }),
    );
    return {
        events: result.events,
        matchState: result.matchState ?? ctx.matchState,
    };
}

function ancientDojoOnMinionPlayed(ctx: BaseAbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    const played = ctx.minionUid ? base?.minions.find((minion) => minion.uid === ctx.minionUid) : undefined;
    if (!base || !played) {
        return { events: [] };
    }
    const playedPower = getEffectivePower(ctx.state, played, ctx.baseIndex);
    const targets = base.minions.filter((minion) =>
        minion.uid !== played.uid
        && minion.controller === ctx.playerId
        && getEffectivePower(ctx.state, minion, ctx.baseIndex) < playedPower,
    );
    return {
        events: targets.map((minion) => addPowerCounter(minion.uid, ctx.baseIndex, 1, 'base_ancient_dojo', ctx.now)),
    };
}

function runSimpleMinionEffect(
    ctx: AbilityContext,
    config: Omit<SimpleMinionEffectContext, 'matchState' | 'playerId' | 'now' | 'candidates'> & {
        candidates: CounterTransferCandidate[];
    },
): AbilityResult {
    if (config.candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (config.candidates.length === 1 && !config.allowSkip) {
        return resolveSimpleMinionEffect(
            ctx.matchState,
            createPromptContext(ctx.matchState, ctx.playerId, ctx.now, config),
            {
                minionUid: config.candidates[0].uid,
                baseIndex: config.candidates[0].baseIndex,
                defId: config.candidates[0].defId,
            },
            ctx.now,
            ctx.random,
        );
    }
    const result = executeAbilityProgram(
        simpleMinionEffectPromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now, config),
    );
    return { events: result.events, matchState: result.matchState };
}

function vigilantesShrugItOffTalent(ctx: AbilityContext): AbilityResult {
    return {
        events: [{
            type: SU_EVENTS.BASE_ABILITY_SUPPRESSED,
            payload: {
                baseIndex: ctx.baseIndex,
                suppressorPlayerId: ctx.playerId,
                reason: 'vigilantes_shrug_it_off',
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: 'vigilantes_shrug_it_off',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}

function vigilantesWhoLovesYaBaby(ctx: AbilityContext): AbilityResult {
    const count = countControlledHighPowerMinions(ctx.state, ctx.playerId, 4);
    return { events: buildStandardDrawEvents(ctx.matchState, ctx.playerId, count, ctx.random, ctx.now) };
}

function vigilantesAWholeLotMeaner(ctx: AbilityContext): AbilityResult {
    return runSimpleMinionEffect(ctx, {
        sourceDefId: 'vigilantes_a_whole_lot_meaner',
        title: '凶恶百倍：选择一个随从 +3 战力',
        candidates: collectAllMinions(ctx.state),
        effectKind: 'tempPower',
        amount: 3,
    });
}

function vigilantesMakeMyDay(ctx: AbilityContext): AbilityResult {
    const candidates = collectMinionsMatching(ctx.state, (minion, baseIndex) =>
        hasOwnMinionOnBase(ctx.state, baseIndex, ctx.playerId)
        && getMinionPower(ctx.state, minion, baseIndex) <= 3,
    );
    return runSimpleMinionEffect(ctx, {
        sourceDefId: 'vigilantes_make_my_day',
        title: '一天的快乐：选择要消灭的战力 3 或更低随从',
        candidates,
        effectKind: 'destroyDraw',
    });
}

function vigilantesMakeMyDayPod(ctx: AbilityContext): AbilityResult {
    const candidates = collectMinionsMatching(ctx.state, (minion, baseIndex) =>
        hasOwnMinionOnBase(ctx.state, baseIndex, ctx.playerId)
        && minion.basePower <= 3,
    );
    return runSimpleMinionEffect(ctx, {
        sourceDefId: 'vigilantes_make_my_day_pod',
        title: '一天的快乐 POD：选择要消灭的印刷战力 3 或更低随从',
        candidates,
        effectKind: 'destroy',
    });
}

function vigilantesScaredStraightPod(ctx: AbilityContext): AbilityResult {
    const candidates = collectMinionsMatching(ctx.state, (minion, baseIndex) =>
        minion.controller !== ctx.playerId
        && hasOwnMinionOnBase(ctx.state, baseIndex, ctx.playerId),
    );
    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const isFirstCardPlayedThisTurn = (ctx.state.cardsPlayedThisTurn ?? 1) <= 1;
    const result = executeAbilityProgram(moveOwnMinionPromptProgram, createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        sourceDefId: 'vigilantes_scared_straight_pod',
        title: '直面恐惧 POD：选择要移动的其他玩家随从',
        candidates,
        requireOwn: false,
        extraActionAfter: isFirstCardPlayedThisTurn,
    }));
    return {
        events: result.events,
        matchState: result.matchState,
    };
}

function vigilantesWhoLovesYaBabyPod(ctx: AbilityContext): AbilityResult {
    const top = ctx.state.players[ctx.playerId]?.deck[0];
    if (!top) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    const topDef = getCardDef(top.defId);
    const revealEvents = [
        inspectDeck(ctx.playerId, ctx.playerId, 1, 'vigilantes_who_loves_ya_baby_pod', ctx.now),
        revealDeckTop(ctx.playerId, 'all', [{ uid: top.uid, defId: top.defId }], 1, 'vigilantes_who_loves_ya_baby_pod', ctx.now, ctx.playerId),
    ];
    if (topDef?.type !== 'minion' || topDef.power !== 4) {
        return { events: revealEvents };
    }
    return {
        events: [
            ...revealEvents,
            ...buildStandardDrawEvents(ctx.matchState, ctx.playerId, 1, ctx.random, ctx.now),
        ],
    };
}

function vigilantesAWholeLotMeanerPod(ctx: AbilityContext): AbilityResult {
    return runSimpleMinionEffect(ctx, {
        sourceDefId: 'vigilantes_a_whole_lot_meaner_pod',
        title: '凶恶百倍 POD：选择你的一个随从放置 3 个 +1 战力标记',
        candidates: collectOwnMinions(ctx.state, ctx.playerId),
        effectKind: 'addCounter',
        amount: 3,
        allowSkip: true,
    });
}

function vigilantesTheRevenge(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    if (isPlayerWinningScoredBase(ctx.state, ctx.baseIndex, ctx.playerId)) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    }
    const candidates = collectMinionsMatching(
        ctx.state,
        (minion, baseIndex) => baseIndex === ctx.baseIndex && minion.controller === ctx.playerId,
    );
    if (candidates.length === 0 || !hasOtherBaseTarget(ctx.state, ctx.baseIndex)) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        moveOwnMinionPromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceDefId: 'vigilantes_the_revenge',
            title: '复仇：选择计分基地中的一个己方随从移动到其他基地',
            candidates,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function vigilantesKnockedIntoNextWeek(ctx: AbilityContext): AbilityResult {
    return runSimpleMinionEffect(ctx, {
        sourceDefId: 'vigilantes_knocked_into_next_week',
        title: '打到穿越：选择要洗回牌库的随从',
        candidates: collectAllMinions(ctx.state),
        effectKind: 'shuffleIntoDeck',
    });
}

function vigilantesStoneford(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const selected = player?.deck.find(card => getCardDef(card.defId)?.type === 'action');
    if (!player || !selected) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return {
        events: [
            {
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: ctx.playerId,
                    deckUids: [selected.uid, ...player.deck.filter(card => card.uid !== selected.uid).map(card => card.uid)],
                    reason: 'vigilantes_stoneford',
                },
                timestamp: ctx.now,
            } as SmashUpEvent,
            {
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: ctx.playerId, count: 1, cardUids: [selected.uid] },
                timestamp: ctx.now,
            } as SmashUpEvent,
        ],
    };
}

function vigilantesShift(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const selected = player.discard.filter(card => getCardDef(card.defId)?.type === 'minion').slice(0, 2);
    if (selected.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return { events: topDeckCardsFromDiscard(selected, ctx.playerId, 'vigilantes_shift', ctx.now) };
}

function vigilantesDustyHenry(ctx: AbilityContext): AbilityResult {
    const candidates = collectMinionsMatching(ctx.state, (_minion, baseIndex) => baseIndex === ctx.baseIndex);
    return runSimpleMinionEffect(ctx, {
        sourceDefId: 'vigilantes_dusty_henry',
        title: '瞌睡的亨利：选择本基地一个随从洗回牌库',
        candidates,
        effectKind: 'shuffleIntoDeck',
        allowSkip: true,
    });
}

function vigilantesDustyHenryPod(ctx: AbilityContext): AbilityResult {
    const candidates = collectMinionsMatching(ctx.state, (minion, baseIndex) =>
        baseIndex === ctx.baseIndex && minion.basePower <= 5,
    );
    return runSimpleMinionEffect(ctx, {
        sourceDefId: 'vigilantes_dusty_henry_pod',
        title: '瞌睡的亨利 POD：选择本基地一个印刷战力 5 或更低随从洗回牌库',
        candidates,
        effectKind: 'shuffleIntoDeck',
        allowSkip: true,
    });
}

function truckersGoodBuddy(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    const hasOwnAction = base?.ongoingActions.some(action =>
        ((action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId) === ctx.playerId,
    ) ?? false;
    return hasOwnAction
        ? { events: buildStandardDrawEvents(ctx.matchState, ctx.playerId, 1, ctx.random, ctx.now) }
        : { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
}

function truckersHotwire(ctx: AbilityContext): AbilityResult {
    const candidates = collectBaseOngoingActions(
        ctx.state,
        candidate => getTruckersHotwireModes(ctx.state, ctx.playerId, candidate).length > 0,
    );
    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        truckersHotwireActionPromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function truckersSkinnyMinnieTalent(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    if (!self || self.controller !== ctx.playerId) return { events: [] };
    const baseActions = collectBaseOngoingActions(ctx.state, candidate => candidate.baseIndex === ctx.baseIndex);
    if (baseActions.length === 0 || !hasOtherBaseTarget(ctx.state, ctx.baseIndex)) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        truckersSkinnyMinnieBasePromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            selfUid: self.uid,
            selfBaseIndex: ctx.baseIndex,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function truckersElBandidoOnPlay(ctx: AbilityContext): AbilityResult {
    const candidates = collectBaseOngoingActions(
        ctx.state,
        candidate => candidate.controllerId !== ctx.playerId,
    );
    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        truckersElBandidoTakeControlPromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function truckersElBandidoTalent(ctx: AbilityContext): AbilityResult {
    const hasTransferTarget = collectBaseOngoingActions(
        ctx.state,
        candidate => hasOtherBaseTarget(ctx.state, candidate.baseIndex),
    ).length > 0;
    if (!hasTransferTarget) {
        return { events: [grantContextualExtraAction(ctx, 'truckers_el_bandido')] };
    }
    const result = executeAbilityProgram(
        truckersElBandidoTalentModePromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function truckersHighSpeedChaseTalent(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base || !hasOtherBaseTarget(ctx.state, ctx.baseIndex)) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const ownMinions = base.minions.filter(minion => minion.controller === ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        truckersHighSpeedChaseMinionPromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceCardUid: ctx.cardUid,
            sourceBaseIndex: ctx.baseIndex,
            sourceControllerId: ctx.playerId,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function truckersDekotoraTalent(ctx: AbilityContext): AbilityResult {
    if (!hasOtherBaseTarget(ctx.state, ctx.baseIndex)) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        truckersDekotoraBasePromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceCardUid: ctx.cardUid,
            sourceBaseIndex: ctx.baseIndex,
            sourceControllerId: ctx.playerId,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function truckersCabOverPeteTalent(ctx: AbilityContext): AbilityResult {
    if (!hasOtherBaseTarget(ctx.state, ctx.baseIndex)) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const candidates = collectCabOverPeteControlledCards(ctx.state, ctx.playerId, ctx.baseIndex, ctx.cardUid);
    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        truckersCabOverPeteBasePromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceCardUid: ctx.cardUid,
            sourceBaseIndex: ctx.baseIndex,
            sourceControllerId: ctx.playerId,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function truckersRally(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base || base.minions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        truckersRallyPromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceBaseIndex: ctx.baseIndex,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function truckersTurnTheBeatAround(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base || base.minions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        truckersTurnTheBeatAroundBoostPromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceBaseIndex: ctx.baseIndex,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

const discoDancingKingPromptProgram = createPromptProgram<DiscoDancingKingContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'disco_dancers_dancing_king',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.sourceBaseIndex];
        const candidates = (base?.minions ?? [])
            .filter(minion => minion.uid !== context.affectedMinionUid)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.sourceBaseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            }));
        return createAbilityRuntimeSimpleChoice(
            `disco_dancers_dancing_king_${context.now}`,
            context.playerId,
            ZHONGGUO_PROMPT_TITLES.discoDancingKing,
            [
                ...buildMinionTargetOptions(candidates, {
                    state: context.matchState.core,
                    sourcePlayerId: context.playerId,
                }),
                createSkipOption('跳过（不复制）', 'ui.disco_dancers_dancing_king_skip_option'),
            ],
            {
                sourceId: 'disco_dancers_dancing_king',
                targetType: 'minion',
                titleKey: 'ui.disco_dancers_dancing_king_title',
            },
        );
    },
    onResolve: ({ state, value, timestamp, context }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const sourceMinion = state.core.bases[context.sourceBaseIndex]?.minions.find(
            minion => minion.uid === context.sourceCardUid,
        );
        const targetMinion = state.core.bases[selected.baseIndex]?.minions.find(
            minion => minion.uid === selected.minionUid,
        );
        if (!sourceMinion || !targetMinion) {
            return { events: [] };
        }
        const mirroredEvents = buildDiscoMirrorEvents(
            state.core,
            context.affectEvent,
            {
                uid: targetMinion.uid,
                defId: targetMinion.defId,
                baseIndex: selected.baseIndex,
                ownerId: targetMinion.owner,
                controllerId: targetMinion.controller,
            },
            'disco_dancers_dancing_king',
            timestamp,
        );
        if (mirroredEvents.length === 0) {
            return { events: [] };
        }
        return {
            events: [
                buildMinionMetadataUpdatedEvent(
                    sourceMinion.uid,
                    context.sourceBaseIndex,
                    { [DISCO_DANCERS_DANCING_KING_TRIGGERED_TURN_META]: state.core.turnNumber },
                    'disco_dancers_dancing_king_once_per_turn',
                    timestamp,
                ),
                ...mirroredEvents,
            ],
        };
    },
});

const discoIWillSurvivePromptProgram = createPromptProgram<DiscoIWillSurviveContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'disco_dancers_i_will_survive',
    buildInteraction: (context) => {
        const candidates = collectMinionsMatching(
            context.matchState.core,
            (minion, baseIndex) => baseIndex === context.sourceBaseIndex && minion.controller === context.playerId,
        );
        return createAbilityRuntimeSimpleChoice(
            `disco_dancers_i_will_survive_${context.now}`,
            context.playerId,
            ZHONGGUO_PROMPT_TITLES.discoIWillSurvive,
            buildMinionTargetOptions(candidates, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
            }),
            {
                sourceId: 'disco_dancers_i_will_survive',
                targetType: 'minion',
                titleKey: 'ui.disco_dancers_i_will_survive_title',
            },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const minion = state.core.bases[selected.baseIndex]?.minions.find(candidate => candidate.uid === selected.minionUid);
        if (!minion) {
            return { events: [] };
        }
        return {
            events: buildValidatedReturnEvents(state, {
                minionUid: minion.uid,
                minionDefId: minion.defId,
                fromBaseIndex: selected.baseIndex,
                toPlayerId: minion.owner,
                reason: 'disco_dancers_i_will_survive',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'disco_dancers_i_will_survive',
                sourceControllerId: playerId,
                sourceBaseIndex: selected.baseIndex,
            }),
        };
    },
});

function discoGetDownTonight(ctx: AbilityContext): AbilityResult {
    return runSimpleMinionEffect(ctx, {
        sourceDefId: 'disco_dancers_get_down_tonight',
        title: '就在今晚：选择一个随从 +2 战力',
        candidates: collectAllMinions(ctx.state),
        effectKind: 'tempPowerDraw',
        amount: 2,
    });
}

function discoUlDiscoLou(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const discardAction = player?.discard.find(card => getCardDef(card.defId)?.type === 'action');
    if (discardAction) {
        return { events: [buildCardToDeckTopEvent(discardAction, ctx.playerId, 'disco_dancers_ul_disco_lou', ctx.now)] };
    }
    return { events: [grantContextualExtraAction(ctx, 'disco_dancers_ul_disco_lou')] };
}

function discoInferno(ctx: AbilityContext): AbilityResult {
    return runSimpleMinionEffect(ctx, {
        sourceDefId: 'disco_dancers_disco_inferno',
        title: '迪斯科地狱：选择一个随从放置 +1 战力标记',
        candidates: collectAllMinions(ctx.state),
        effectKind: 'addCounterDraw',
        amount: 1,
        allowSkip: true,
    });
}

function discoCelebration(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            grantContextualExtraAction(ctx, 'disco_dancers_celebration'),
            grantContextualExtraAction(ctx, 'disco_dancers_celebration'),
        ],
    };
}

function discoItsRainingMen(ctx: AbilityContext): AbilityResult {
    return { events: [grantContextualExtraMinion(ctx, 'disco_dancers_its_raining_men')] };
}

function discoImSoExcited(ctx: AbilityContext): AbilityResult {
    const candidates = collectOwnMinions(ctx.state, ctx.playerId)
        .filter(candidate => collectOtherBases(ctx.state, candidate.baseIndex).length > 0);
    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        moveOwnMinionPromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceDefId: 'disco_dancers_im_so_excited',
            title: '我很亢奋：选择要移动的己方随从',
            candidates,
            drawAfter: true,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function discoLastDance(ctx: AbilityContext): AbilityResult {
    return runSimpleMinionEffect(ctx, {
        sourceDefId: 'disco_dancers_last_dance',
        title: '最后的舞曲：选择自己的一个随从消灭并获得 1 VP',
        candidates: collectOwnMinions(ctx.state, ctx.playerId),
        effectKind: 'destroyOwnVp',
        allowSkip: true,
    });
}

function discoStayinAlive(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const ownInPlayDefIds = new Set(collectOwnMinions(ctx.state, ctx.playerId).map(candidate => candidate.defId));
    const card = player.discard.find(candidate => ownInPlayDefIds.has(candidate.defId));
    if (!card) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return {
        events: [{
            type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
            payload: { playerId: ctx.playerId, cardUids: [card.uid], reason: 'disco_dancers_stayin_alive' },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}

function discoIWillSurvive(ctx: AbilityContext): AbilityResult {
    const hasOwnMinion = ctx.state.bases[ctx.baseIndex]?.minions.some(minion => minion.controller === ctx.playerId) ?? false;
    if (!hasOwnMinion) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return runtimeResultToTriggerResult(
        executeAbilityProgram(
            discoIWillSurvivePromptProgram,
            createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
                sourceCardUid: ctx.cardUid,
                sourceBaseIndex: ctx.baseIndex,
                sourceBaseDefId: ctx.state.bases[ctx.baseIndex]?.defId ?? '',
            }),
        ),
        ctx.matchState,
    );
}

function discoIWillSurviveAfterScoring(ctx: TriggerContext): SmashUpEvent[] | TriggerResult {
    const { state, baseIndex, now, sourceCardUid } = ctx;
    if (baseIndex === undefined || !sourceCardUid) return [];
    const armedEntry = (state.pendingAfterScoringSpecials ?? []).find(
        special => special.sourceDefId === 'disco_dancers_i_will_survive'
            && special.baseIndex === baseIndex
            && special.cardUid === sourceCardUid,
    );
    if (!armedEntry) return [];
    const consumedEvent = {
        type: SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED,
        payload: {
            sourceDefId: armedEntry.sourceDefId,
            playerId: armedEntry.playerId,
            baseIndex: armedEntry.baseIndex,
            cardUid: armedEntry.cardUid,
        },
        timestamp: now,
    } as SmashUpEvent;
    const ownMinions = state.bases[baseIndex]?.minions.filter(minion => minion.controller === armedEntry.playerId) ?? [];
    if (ownMinions.length === 0 || !ctx.matchState) {
        return { events: [consumedEvent] };
    }
    const result = executeAbilityProgram(
        discoIWillSurvivePromptProgram,
        createPromptContext(ctx.matchState, armedEntry.playerId, now, {
            sourceCardUid: armedEntry.cardUid,
            sourceBaseIndex: armedEntry.baseIndex,
            sourceBaseDefId: state.bases[armedEntry.baseIndex]?.defId ?? '',
        }),
    );
    return {
        events: [consumedEvent, ...result.events],
        matchState: result.matchState ?? ctx.matchState,
    };
}

function attachedActionProtection(sourceDefId: string): (ctx: ProtectionCheckContext) => boolean {
    return (ctx) => ctx.targetMinion.attachedActions.some(action => action.defId === sourceDefId);
}

function baseOwnMinionProtection(sourceDefId: string, types: ReadonlySet<string>): (ctx: ProtectionCheckContext) => boolean {
    return (ctx) => {
        if (!types.has(ctx.protectionType)) return false;
        if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
        const base = ctx.state.bases[ctx.targetBaseIndex];
        return base?.ongoingActions.some(action =>
            action.defId === sourceDefId
            && (((action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId) === ctx.targetMinion.controller),
        ) ?? false;
    };
}

function hideoutProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    return ctx.state.bases[ctx.targetBaseIndex]?.defId === 'base_hideout';
}

function findAttachedActionHost(
    state: SmashUpCore,
    actionUid: string,
): { minion: MinionOnBase; baseIndex: number } | undefined {
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        const minion = state.bases[baseIndex].minions.find(candidate =>
            candidate.attachedActions.some(action => action.uid === actionUid),
        );
        if (minion) return { minion, baseIndex };
    }
    return undefined;
}

function vigilantesDeathWisherTrigger(ctx: TriggerContext): SmashUpEvent[] | TriggerResult {
    if (!ctx.matchState || ctx.baseIndex === undefined || !ctx.sourceCardUid || !ctx.sourceControllerId || !ctx.destroyerId) {
        return [];
    }
    if (ctx.destroyerId === ctx.sourceControllerId) return [];
    const destroyedControllerId = ctx.triggerMinion?.controller ?? ctx.controllerId;
    if (!destroyedControllerId || destroyedControllerId === ctx.destroyerId) return [];

    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!self) return [];
    const usedTurn = Number(self.metadata?.[VIGILANTES_DEATH_WISHER_TRIGGERED_TURN_META] ?? -1);
    if (usedTurn === ctx.state.turnNumber) return [];

    const candidates = collectMinionsMatching(ctx.state, minion => minion.controller === ctx.destroyerId);
    if (candidates.length === 0) return [];

    return runtimeResultToTriggerResult(
        executeAbilityProgram(
            vigilantesDeathWisherPromptProgram,
            createPromptContext(ctx.matchState, ctx.sourceControllerId, ctx.now, {
                selfUid: self.uid,
                selfBaseIndex: ctx.baseIndex,
                destroyerId: ctx.destroyerId,
            }),
        ),
        ctx.matchState,
    );
}

function vigilantesTheRevengeAfterScoring(ctx: TriggerContext): SmashUpEvent[] | TriggerResult {
    if (!ctx.matchState || ctx.baseIndex === undefined || !ctx.sourceCardUid) return [];
    const armedEntry = (ctx.state.pendingAfterScoringSpecials ?? []).find(special =>
        special.sourceDefId === 'vigilantes_the_revenge'
        && special.baseIndex === ctx.baseIndex
        && special.cardUid === ctx.sourceCardUid,
    );
    if (!armedEntry) return [];

    const consumedEvent = {
        type: SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED,
        payload: {
            sourceDefId: armedEntry.sourceDefId,
            playerId: armedEntry.playerId,
            baseIndex: armedEntry.baseIndex,
            cardUid: armedEntry.cardUid,
        },
        timestamp: ctx.now,
    } as SmashUpEvent;

    if (isPlayerWinningScoredBase(ctx.state, ctx.baseIndex, armedEntry.playerId)) {
        return { events: [consumedEvent] };
    }

    const result = vigilantesTheRevenge({
        state: ctx.state,
        matchState: ctx.matchState,
        playerId: armedEntry.playerId,
        cardUid: armedEntry.cardUid,
        defId: armedEntry.sourceDefId,
        baseIndex: armedEntry.baseIndex,
        random: ctx.random,
        now: ctx.now,
    });
    return {
        events: [consumedEvent, ...result.events],
        matchState: result.matchState ?? ctx.matchState,
    };
}

function vigilantesBrojakTrigger(ctx: TriggerContext): SmashUpEvent[] | TriggerResult {
    if (!ctx.matchState || !ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    if (ctx.moveToBaseIndex === undefined || ctx.moveToBaseIndex === ctx.sourceBaseIndex) return [];
    if (ctx.triggerMinionUid === ctx.sourceCardUid) return [];

    const self = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!self || self.controller !== ctx.sourceControllerId) return [];

    return runtimeResultToTriggerResult(
        executeAbilityProgram(
            vigilantesBrojakPromptProgram,
            createPromptContext(ctx.matchState, ctx.sourceControllerId, ctx.now, {
                selfUid: self.uid,
                selfBaseIndex: ctx.sourceBaseIndex,
                targetBaseIndex: ctx.moveToBaseIndex,
            }),
        ),
        ctx.matchState,
    );
}

function letsFinishThisTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const triggerBaseIndex = ctx.sourceBaseIndex ?? ctx.baseIndex;
    if (triggerBaseIndex === undefined || !ctx.sourceControllerId) return [];
    if (ctx.playerId !== ctx.sourceControllerId) return [];
    const base = ctx.state.bases[triggerBaseIndex];
    const baseDef = base ? getBaseDef(base.defId) : undefined;
    if (!base || !baseDef) return [];
    const hasOwn = base.minions.some(minion => minion.controller === ctx.sourceControllerId);
    const hasOther = base.minions.some(minion => minion.controller !== ctx.sourceControllerId);
    if (!hasOwn || !hasOther) return [];
    return [modifyBreakpoint(triggerBaseIndex, -baseDef.breakpoint, 'vigilantes_lets_finish_this', ctx.now)];
}

function jackyBillTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined || !ctx.sourceCardUid || !ctx.sourceControllerId) return [];
    if (ctx.playerId === ctx.sourceControllerId) return [];
    const base = ctx.state.bases[ctx.baseIndex];
    const self = base?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!self) return [];
    return [addTempPower(self.uid, ctx.baseIndex, 2, 'vigilantes_jacky_bill', ctx.now, {
        sourcePlayerId: ctx.sourceControllerId,
        sourceDefId: 'vigilantes_jacky_bill',
        sourceControllerId: ctx.sourceControllerId,
    })];
}

function foxyGreenTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined || !ctx.sourceCardUid || !ctx.sourceControllerId) return [];
    if (ctx.sourceControllerId === ctx.playerId) return [];
    const base = ctx.state.bases[ctx.baseIndex];
    const self = base?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!self) return [];
    return [addPowerCounter(self.uid, ctx.baseIndex, 1, 'vigilantes_foxy_green', ctx.now, {
        sourcePlayerId: ctx.sourceControllerId,
        sourceDefId: 'vigilantes_foxy_green',
        sourceControllerId: ctx.sourceControllerId,
    })];
}

function feelingLuckyTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.matchState || !ctx.sourceCardUid || !ctx.sourceControllerId) return [];
    const host = findAttachedActionHost(ctx.state, ctx.sourceCardUid);
    if (!host) return [];
    if (ctx.playerId !== host.minion.controller) return [];
    return buildValidatedDestroyEvents(ctx.matchState, {
        minionUid: host.minion.uid,
        minionDefId: host.minion.defId,
        fromBaseIndex: host.baseIndex,
        destroyerId: ctx.sourceControllerId,
        reason: 'vigilantes_feeling_lucky',
        now: ctx.now,
        sourcePlayerId: ctx.sourceControllerId,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId: 'vigilantes_feeling_lucky',
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: host.baseIndex,
        sourceKind: 'nonAction',
    });
}

function discoDivaTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.affectEvent) return [];
    if (ctx.triggerMinionUid === ctx.sourceCardUid) return [];

    const actionDefId = resolveSourceDefIdFromEvent(ctx.affectEvent) ?? normalizeSourceDefIdFromReason(ctx.reason);
    if (!isStandardActionDefId(actionDefId)) return [];

    const sourceMinion = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    const affectedMinion = ctx.triggerMinionUid
        ? ctx.state.bases[ctx.baseIndex ?? ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.triggerMinionUid) ?? ctx.triggerMinion
        : ctx.triggerMinion;
    if (!sourceMinion || !affectedMinion) return [];
    if (affectedMinion.controller !== sourceMinion.controller) return [];

    const usedTurn = Number(sourceMinion.metadata?.[DISCO_DANCERS_DIVA_TRIGGERED_TURN_META] ?? -1);
    if (usedTurn === ctx.state.turnNumber) return [];

    const mirroredEvents = buildDiscoMirrorEvents(
        ctx.state,
        ctx.affectEvent,
        {
            uid: sourceMinion.uid,
            defId: sourceMinion.defId,
            baseIndex: ctx.sourceBaseIndex,
            ownerId: sourceMinion.owner,
            controllerId: sourceMinion.controller,
        },
        'disco_dancers_diva',
        ctx.now,
    );
    if (mirroredEvents.length === 0) return [];

    return [
        buildMinionMetadataUpdatedEvent(
            sourceMinion.uid,
            ctx.sourceBaseIndex,
            { [DISCO_DANCERS_DIVA_TRIGGERED_TURN_META]: ctx.state.turnNumber },
            'disco_dancers_diva_once_per_turn',
            ctx.now,
        ),
        ...mirroredEvents,
    ];
}

function discoWeAreFamilyTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || !ctx.affectEvent) return [];
    const host = findAttachedActionHost(ctx.state, ctx.sourceCardUid);
    if (!host) return [];
    if (ctx.triggerMinionUid === host.minion.uid) return [];

    const actionDefId = resolveSourceDefIdFromEvent(ctx.affectEvent) ?? normalizeSourceDefIdFromReason(ctx.reason);
    if (!isStandardActionDefId(actionDefId)) return [];

    const affectedMinion = ctx.triggerMinionUid
        ? ctx.state.bases[ctx.baseIndex ?? host.baseIndex]?.minions.find(minion => minion.uid === ctx.triggerMinionUid) ?? ctx.triggerMinion
        : ctx.triggerMinion;
    if (!affectedMinion || affectedMinion.controller !== host.minion.controller) return [];

    const triggeredTurns = (host.minion.metadata?.[DISCO_DANCERS_WE_ARE_FAMILY_TRIGGERED_TURNS_META] as Record<string, unknown> | undefined) ?? {};
    const usedTurn = Number(triggeredTurns[ctx.sourceCardUid] ?? -1);
    if (usedTurn === ctx.state.turnNumber) return [];

    const mirroredEvents = buildDiscoMirrorEvents(
        ctx.state,
        ctx.affectEvent,
        {
            uid: host.minion.uid,
            defId: host.minion.defId,
            baseIndex: host.baseIndex,
            ownerId: host.minion.owner,
            controllerId: host.minion.controller,
        },
        'disco_dancers_we_are_family',
        ctx.now,
    );
    if (mirroredEvents.length === 0) return [];

    return [
        buildMinionMetadataUpdatedEvent(
            host.minion.uid,
            host.baseIndex,
            {
                [DISCO_DANCERS_WE_ARE_FAMILY_TRIGGERED_TURNS_META]: {
                    ...triggeredTurns,
                    [ctx.sourceCardUid]: ctx.state.turnNumber,
                },
            },
            'disco_dancers_we_are_family_once_per_turn',
            ctx.now,
        ),
        ...mirroredEvents,
    ];
}

function discoDancingKingTrigger(ctx: TriggerContext): SmashUpEvent[] | TriggerResult {
    if (!ctx.matchState || !ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.affectEvent) return [];
    const actionDefId = resolveSourceDefIdFromEvent(ctx.affectEvent) ?? normalizeSourceDefIdFromReason(ctx.reason);
    if (!isStandardActionDefId(actionDefId)) return [];

    const sourceMinion = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!sourceMinion) return [];
    const usedTurn = Number(sourceMinion.metadata?.[DISCO_DANCERS_DANCING_KING_TRIGGERED_TURN_META] ?? -1);
    if (usedTurn === ctx.state.turnNumber) return [];

    const affectedMinionUid = ctx.triggerMinionUid ?? ctx.triggerMinion?.uid;
    if (!affectedMinionUid) return [];
    const candidateCount = ctx.state.bases[ctx.sourceBaseIndex]?.minions.filter(minion => minion.uid !== affectedMinionUid).length ?? 0;
    if (candidateCount === 0) return [];

    return runtimeResultToTriggerResult(
        executeAbilityProgram(
            discoDancingKingPromptProgram,
            createPromptContext(ctx.matchState, sourceMinion.controller, ctx.now, {
                sourceCardUid: sourceMinion.uid,
                sourceBaseIndex: ctx.sourceBaseIndex,
                sourceControllerId: sourceMinion.controller,
                affectedMinionUid,
                affectEvent: ctx.affectEvent,
            }),
        ),
        ctx.matchState,
    );
}

function discoRollerTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined || !ctx.sourceCardUid || ctx.triggerMinionUid !== ctx.sourceCardUid) return [];
    const base = ctx.state.bases[ctx.baseIndex];
    const self = base?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!self) return [];
    const powerCountersBeforeAffect = typeof ctx.counterDelta === 'number'
        ? self.powerCounters - ctx.counterDelta
        : self.powerCounters;
    if (powerCountersBeforeAffect > 0) return [];
    return [addPowerCounter(self.uid, ctx.baseIndex, 1, 'disco_dancers_roller', ctx.now, {
        sourcePlayerId: self.controller,
        sourceDefId: 'disco_dancers_roller',
        sourceControllerId: self.controller,
    })];
}

export function registerZhongguoAbilities(): void {
    registerAbilityProgram('vigilantes_shrug_it_off', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vigilantesShrugItOffTalent),
    });
    registerAbilityProgram('vigilantes_scared_straight', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
            const candidates = collectMinionsMatching(ctx.state, (minion, baseIndex) =>
                minion.controller !== ctx.playerId
                && hasOwnMinionOnBase(ctx.state, baseIndex, ctx.playerId),
            );
            if (candidates.length === 0) {
                return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
            }
            const result = executeAbilityProgram(moveOwnMinionPromptProgram, createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
                sourceDefId: 'vigilantes_scared_straight',
                title: '直面恐惧：选择要移动的其他玩家随从',
                candidates,
                requireOwn: false,
                extraActionAfter: true,
            }));
            return {
                events: result.events,
                matchState: result.matchState,
            };
        }),
    });
    registerAbilityProgram('vigilantes_scared_straight_pod', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vigilantesScaredStraightPod),
    });
    registerAbilityProgram('vigilantes_who_loves_ya_baby', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vigilantesWhoLovesYaBaby),
    });
    registerAbilityProgram('vigilantes_who_loves_ya_baby_pod', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vigilantesWhoLovesYaBabyPod),
    });
    registerAbilityProgram('vigilantes_a_whole_lot_meaner', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vigilantesAWholeLotMeaner),
    });
    registerAbilityProgram('vigilantes_a_whole_lot_meaner_pod', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vigilantesAWholeLotMeanerPod),
    });
    registerAbilityProgram('vigilantes_a_whole_lot_meaner_pod', 'special', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vigilantesAWholeLotMeanerPod),
    });
    registerAbilityProgram('vigilantes_stoneford', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vigilantesStoneford),
    });
    registerAbilityProgram('vigilantes_shift', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vigilantesShift),
    });
    registerAbilityProgram('vigilantes_dusty_henry', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vigilantesDustyHenry),
    });
    registerAbilityProgram('vigilantes_dusty_henry_pod', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vigilantesDustyHenryPod),
    });
    registerAbilityProgram('vigilantes_knocked_into_next_week', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vigilantesKnockedIntoNextWeek),
    });
    registerAbilityProgram('vigilantes_make_my_day', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vigilantesMakeMyDay),
    });
    registerAbilityProgram('vigilantes_make_my_day_pod', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vigilantesMakeMyDayPod),
    });
    registerAbilityProgram('vigilantes_make_my_day_pod', 'special', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vigilantesMakeMyDayPod),
    });
    registerAbilityProgram('vigilantes_the_revenge', 'special', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vigilantesTheRevenge),
    });
    registerProtection('base_hideout', 'action', hideoutProtection);
    registerProtection('base_hideout', 'affect', hideoutProtection);
    registerProtection('base_hideout', 'destroy', hideoutProtection);
    registerProtection('base_hideout', 'move', hideoutProtection);
    registerProtection('vigilantes_street_justice', 'affect', baseOwnMinionProtection('vigilantes_street_justice', new Set(['affect', 'destroy', 'move', 'action'])));
    registerProtection('vigilantes_street_justice', 'destroy', baseOwnMinionProtection('vigilantes_street_justice', new Set(['affect', 'destroy', 'move', 'action'])));
    registerProtection('vigilantes_street_justice', 'move', baseOwnMinionProtection('vigilantes_street_justice', new Set(['affect', 'destroy', 'move', 'action'])));
    registerProtection('vigilantes_street_justice', 'action', baseOwnMinionProtection('vigilantes_street_justice', new Set(['affect', 'destroy', 'move', 'action'])));
    registerProtection('vigilantes_tough_it_out', 'destroy', attachedActionProtection('vigilantes_tough_it_out'));
    registerPowerModifier('vigilantes_tough_it_out_pod', (ctx) =>
        -3 * ctx.minion.attachedActions.filter(action => action.defId === 'vigilantes_tough_it_out_pod').length, { variantPolicy: 'override' });
    registerProtection('vigilantes_tough_it_out_pod', 'destroy', attachedActionProtection('vigilantes_tough_it_out_pod'));
    registerProtection('truckers_armored_truck', 'destroy', baseOwnMinionProtection('truckers_armored_truck', new Set(['destroy', 'move'])));
    registerProtection('truckers_armored_truck', 'move', baseOwnMinionProtection('truckers_armored_truck', new Set(['destroy', 'move'])));

    registerAbilityProgram('truckers_fixin_to_fix_it', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
            const discardActions = ctx.state.players[ctx.playerId]?.discard.filter(card => getCardDef(card.defId)?.type === 'action') ?? [];
            if (discardActions.length === 0) {
                return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
            }
            const selected = discardActions[0];
            return {
                events: [
                    recoverCardsFromDiscard(ctx.playerId, [selected.uid], 'truckers_fixin_to_fix_it', ctx.now),
                ],
            };
        }),
    });
    registerAbilityProgram('truckers_good_buddy', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(truckersGoodBuddy),
    });
    registerAbilityProgram('truckers_hotwire', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(truckersHotwire),
    });
    registerAbilityProgram('truckers_skinny_minnie', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(truckersSkinnyMinnieTalent),
        validateUse: (ctx) => {
            const self = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
            if (!self || self.controller !== ctx.playerId) return '当前无法发动此天赋';
            const hasAction = collectBaseOngoingActions(ctx.state, candidate => candidate.baseIndex === ctx.baseIndex).length > 0;
            return hasAction && hasOtherBaseTarget(ctx.state, ctx.baseIndex) ? null : '当前没有可转移的基地战术';
        },
    });
    registerAbilityProgram('truckers_el_bandido', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(truckersElBandidoOnPlay),
    });
    registerAbilityProgram('truckers_el_bandido', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(truckersElBandidoTalent),
    });
    registerAbilityProgram('truckers_high_speed_chase', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(truckersHighSpeedChaseTalent),
        validateUse: (ctx) => {
            const base = ctx.state.bases[ctx.baseIndex];
            if (!base || !hasOtherBaseTarget(ctx.state, ctx.baseIndex)) return '当前没有可选择的目标';
            return base.minions.some(minion => minion.controller === ctx.playerId) ? null : '当前没有可选择的目标';
        },
    });
    registerAbilityProgram('truckers_dekotora', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(truckersDekotoraTalent),
        validateUse: (ctx) => hasOtherBaseTarget(ctx.state, ctx.baseIndex) ? null : '当前没有可选择的目标',
    });
    registerAbilityProgram('truckers_cab_over_pete', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(truckersCabOverPeteTalent),
        validateUse: (ctx) => {
            if (!hasOtherBaseTarget(ctx.state, ctx.baseIndex)) return '当前没有可选择的目标';
            const candidates = collectCabOverPeteControlledCards(ctx.state, ctx.playerId, ctx.baseIndex, ctx.cardUid);
            return candidates.length > 0 ? null : '当前没有可移动的己方牌';
        },
    });
    registerAbilityProgram('truckers_rally', 'special', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(truckersRally),
    });
    registerAbilityProgram('truckers_turn_the_beat_around', 'special', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(truckersTurnTheBeatAround),
    });
    registerAbilityProgram('disco_dancers_get_down_tonight', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(discoGetDownTonight),
    });
    registerAbilityProgram('disco_dancers_ul_disco_lou', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(discoUlDiscoLou),
    });
    registerAbilityProgram('disco_dancers_disco_inferno', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(discoInferno),
    });
    registerAbilityProgram('disco_dancers_celebration', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(discoCelebration),
    });
    registerAbilityProgram('disco_dancers_i_will_survive', 'special', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(discoIWillSurvive),
    });
    registerAbilityProgram('disco_dancers_its_raining_men', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(discoItsRainingMen),
    });
    registerAbilityProgram('disco_dancers_im_so_excited', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(discoImSoExcited),
    });
    registerAbilityProgram('disco_dancers_last_dance', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(discoLastDance),
    });
    registerAbilityProgram('disco_dancers_stayin_alive', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(discoStayinAlive),
    });

    registerAbilityProgram('kung_fu_fighters_cricket', 'onPlay', {
        program: cricketOnPlayProgram,
    });
    registerAbilityProgram('kung_fu_fighters_fast_as_lightning', 'onPlay', {
        program: fastAsLightningOnPlayProgram,
    });
    registerAbilityProgram('kung_fu_fighters_dragon_warrior', 'talent', {
        program: dragonWarriorTalentProgram,
        validateUse: (ctx) => {
            const hasSource = collectCounterTransferSources(ctx.state).length > 0;
            const hasTarget = collectAllMinions(ctx.state).length > 1;
            return hasSource && hasTarget ? null : '当前没有可转移指示物的有效目标';
        },
    });
    registerAbilityProgram('kung_fu_fighters_drunken_master', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(drunkenMasterTalent),
        validateUse: (ctx) => {
            const self = ctx.state.bases[ctx.baseIndex]?.minions.find((minion) => minion.uid === ctx.cardUid);
            if (!self || self.controller !== ctx.playerId) return '当前无法发动此天赋';
            return (self.powerCounters ?? 0) === 0 ? null : '此随从上已有 +1 战力标记';
        },
    });
    registerAbilityProgram('kung_fu_fighters_lady_whirlwind', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(ladyWhirlwindTalent),
        validateUse: (ctx) => {
            const self = ctx.state.bases[ctx.baseIndex]?.minions.find((minion) => minion.uid === ctx.cardUid);
            if (!self || self.controller !== ctx.playerId) return '当前无法发动此天赋';
            if (self.powerCounters > 0) return '此随从上已有 +1 战力标记';
            const selfPower = getMinionPower(ctx.state, self, ctx.baseIndex);
            const hasTarget = ctx.state.bases[ctx.baseIndex]?.minions.some((minion) =>
                minion.uid !== ctx.cardUid && getMinionPower(ctx.state, minion, ctx.baseIndex) < selfPower,
            ) ?? false;
            return hasTarget ? null : '当前没有可选择的目标';
        },
    });
    registerAbilityProgram('kung_fu_fighters_ancient_chinese_art', 'talent', {
        program: ancientChineseArtTalentProgram,
        validateUse: (ctx) => {
            const baseHasMinion = (ctx.state.bases[ctx.baseIndex]?.minions.length ?? 0) > 0;
            const canTransfer = collectCounterTransferSources(ctx.state).length > 0
                && collectAllMinions(ctx.state).length > 1;
            return baseHasMinion || canTransfer ? null : '当前没有可选择的目标';
        },
    });
    registerAbilityProgram('kung_fu_fighters_everybody_knew_their_part', 'onPlay', {
        program: everybodyKnewOnPlayProgram,
    });
    registerAbilityProgram('kung_fu_fighters_everybody_was_kung_fu_fighting', 'onPlay', {
        program: everybodyWasOnPlayProgram,
    });
    registerAbilityProgram('kung_fu_fighters_expert_timing', 'onPlay', {
        program: expertTimingProgram,
    });
    registerAbilityProgram('kung_fu_fighters_expert_timing', 'special', {
        program: expertTimingProgram,
    });
    registerAbilityProgram('kung_fu_fighters_a_little_bit_frightening', 'onPlay', {
        program: aLittleBitFrighteningOnPlayProgram,
    });
    registerAbilityProgram('kung_fu_fighters_lets_get_it_on', 'onPlay', {
        program: letsGetItOnOnPlayProgram,
    });

    registerTrigger('kung_fu_fighters_fast_as_lightning', 'onMinionDestroyed', fastAsLightningReturnTrigger, {
        phase: 'replacement',
        global: true,
        globalZones: ['discard'],
    });
    registerTrigger('kung_fu_fighters_fast_as_lightning', 'onMinionDiscardedFromBase', fastAsLightningReturnTrigger, {
        phase: 'replacement',
        global: true,
        globalZones: ['discard'],
    });
    registerProtection('kung_fu_fighters_dragon_warrior', 'destroy', (ctx) => ctx.targetMinion.defId === 'kung_fu_fighters_dragon_warrior');
    registerTrigger('kung_fu_fighters_oh_hoh_hoh_hoah', 'onMinionPlayed', ohHohHohHoahTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: canTriggerOhHohHohHoah,
    });

    registerBaseAbility('base_ancient_dojo', 'onMinionPlayed', ancientDojoOnMinionPlayed);
    registerBaseVpModifier('base_tournament_site', (state, baseIndex, playerId, currentVp) => {
        if (currentVp <= 0) return 0;
        const base = state.bases[baseIndex];
        if (!base) return 0;
        const powers = state.turnOrder.map((candidatePlayerId) => ({
            playerId: candidatePlayerId,
            power: getPlayerEffectivePowerOnBase(state, base, baseIndex, candidatePlayerId),
        }));
        const highestPower = Math.max(...powers.map((entry) => entry.power), 0);
        if (highestPower <= 0) return 0;
        const leaders = powers.filter((entry) => entry.power === highestPower);
        if (leaders.length !== 1 || leaders[0]?.playerId !== playerId) return 0;
        return powers.filter((entry) => entry.power <= 0).length;
    });

    registerTrigger('vigilantes_lets_finish_this', 'onTurnStart', letsFinishThisTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('vigilantes_death_wisher', 'onMinionDestroyed', vigilantesDeathWisherTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('vigilantes_the_revenge', 'afterScoring', vigilantesTheRevengeAfterScoring, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('vigilantes_brojak', 'onMinionMoved', vigilantesBrojakTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: false,
    });
    registerTrigger('vigilantes_jacky_bill', 'onActionPlayed', jackyBillTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('vigilantes_foxy_green', 'onMinionAffected', foxyGreenTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('vigilantes_feeling_lucky', 'onActionPlayed', feelingLuckyTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('disco_dancers_diva', 'onMinionAffected', discoDivaTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('disco_dancers_we_are_family', 'onMinionAffected', discoWeAreFamilyTrigger, {
        perInstance: true,
        playerContext: 'sourceHostController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('disco_dancers_dancing_king', 'onMinionAffected', discoDancingKingTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('disco_dancers_roller', 'onMinionAffected', discoRollerTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('disco_dancers_i_will_survive', 'afterScoring', discoIWillSurviveAfterScoring, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
}
