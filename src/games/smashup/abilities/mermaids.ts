import type { PlayerId } from '../../../engine/types';
import { registerAbility, registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import {
    addTempPower,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildFieldSourceToBaseTargetOptions,
    buildFieldSourceTargetPromptConfig,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedMoveEvents,
    changeMinionController,
    createSkipOption,
    getMinionPower,
    grantContextualExtraAction,
    grantContextualExtraMinion,
} from '../domain/abilityHelpers';
import { buildOngoingDetachedEvent } from '../domain/ongoingDetach';
import { SU_EVENTS } from '../domain/types';
import type {
    MinionMetadataUpdatedEvent,
    OngoingAttachedEvent,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { getBaseDef, getCardDef } from '../data/cards';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { createFootprint, createPromptDslProgram } from '../domain/effectDsl';

type MinionChoice = { minionUid?: string; baseIndex?: number; defId?: string; skip?: boolean };
type BaseChoice = { baseIndex?: number; skip?: boolean };
type ModeChoice = { mode?: 'move' | 'control'; skip?: boolean };
type HandMinionChoice = { cardUid?: string; defId?: string; ownerId?: PlayerId; power?: number; skip?: boolean };

type CharmerMoveContinuation = {
    charmerUid: string;
    charmerDefId: string;
    fromBaseIndex: number;
};

type CharmerTargetContinuation = {
    targetBaseIndex: number;
};

type MermaidQueenModeContinuation = {
    targetBaseIndex: number;
};

type CaptiveAudienceContinuation = {
    bonusPower: number;
};

type UltimateSongContinuation = {
    casterPlayerId: PlayerId;
    targetBaseIndex: number;
    remainingPlayerIds: PlayerId[];
    forcedPlayerId: PlayerId;
};

type SirenSongDestinationContinuation = {
    fromBaseIndex: number;
    remainingPlayerIds: PlayerId[];
};

type SirenSongTargetContinuation = {
    fromBaseIndex: number;
    toBaseIndex: number;
    remainingPlayerIds: PlayerId[];
};

type OngoingMoveContinuation = {
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
    fromBaseIndex: number;
    reason: string;
};

type OngoingMoveSnapshot = {
    metadata?: Record<string, unknown>;
    talentUsed?: boolean;
};

type CharmedContinuation = {
    minionUid: string;
    minionDefId: string;
    fromBaseIndex: number;
};

type MermaidsPromptContext = {
    matchState: AbilityContext['matchState'];
    playerId: PlayerId;
    now: number;
};

type MermaidsCharmerMovePromptContext = MermaidsPromptContext & CharmerMoveContinuation;
type MermaidsCharmerTargetPromptContext = MermaidsPromptContext & CharmerTargetContinuation;
type MermaidsMermaidQueenModePromptContext = MermaidsPromptContext & MermaidQueenModeContinuation;
type MermaidsMermaidQueenTargetPromptContext = MermaidsPromptContext & { targetBaseIndex: number };
type MermaidsCaptiveAudiencePromptContext = MermaidsPromptContext & CaptiveAudienceContinuation & { baseIndex: number };
type MermaidsOngoingMovePromptContext = MermaidsPromptContext & OngoingMoveContinuation & {
    title: string;
    titleKey?: string;
    titleParams?: Record<string, string | number>;
    allowSkip?: boolean;
    skipLabel?: string;
    skipLabelKey?: string;
};
type MermaidsUltimateSongHandPromptContext = MermaidsPromptContext & UltimateSongContinuation;
type MermaidsSirenSongDestinationPromptContext = MermaidsPromptContext & SirenSongDestinationContinuation;
type MermaidsSirenSongTargetPromptContext = MermaidsPromptContext & SirenSongTargetContinuation & { targetPlayerId: PlayerId };
type MermaidsCharmedDestinationPromptContext = MermaidsPromptContext & CharmedContinuation;

const MERMAIDS_CHARMED_SUPPRESSED_TURN_META = 'mermaidsCharmedSuppressedTurn';
const MERMAIDS_TEMP_CONTROL_CONTROLLER_META = 'mermaidsTemporaryControlOriginalController';
const MERMAIDS_TEMP_CONTROL_PLAYER_META = 'mermaidsTemporaryControlPlayerId';
const MERMAIDS_TEMP_CONTROL_TURN_META = 'mermaidsTemporaryControlTurn';
const selfDetachOrderingContract = {
    reads: [],
    writes: [],
};

function createMermaidsPromptContext<TExtra extends Record<string, unknown> = Record<string, never>>(
    matchState: AbilityContext['matchState'],
    playerId: PlayerId,
    now: number,
    extra?: TExtra,
): MermaidsPromptContext & TExtra {
    return {
        matchState,
        playerId,
        now,
        ...(extra ?? {} as TExtra),
    };
}

function getBaseLabel(state: SmashUpCore, baseIndex: number): string {
    return getBaseDef(state.bases[baseIndex]?.defId ?? '')?.name ?? `基地 ${baseIndex + 1}`;
}

function getOtherPlayers(state: SmashUpCore, playerId: PlayerId): PlayerId[] {
    return state.turnOrder.filter(candidate => candidate !== playerId);
}

function getOtherBases(state: SmashUpCore, fromBaseIndex: number) {
    return state.bases
        .map((base, baseIndex) => ({
            baseIndex,
            label: getBaseLabel(state, baseIndex),
        }))
        .filter(base => base.baseIndex !== fromBaseIndex);
}

function collectBasesWithOwnMinions(state: SmashUpCore, playerId: PlayerId, excludeBaseIndex?: number) {
    return state.bases
        .map((base, baseIndex) => ({
            baseIndex,
            label: getBaseLabel(state, baseIndex),
            hasOwnMinion: base.minions.some(minion => minion.controller === playerId),
        }))
        .filter(base => base.hasOwnMinion && base.baseIndex !== excludeBaseIndex)
        .map(({ baseIndex, label }) => ({ baseIndex, label }));
}

function collectMinions(
    state: SmashUpCore,
    predicate: (minion: SmashUpCore['bases'][number]['minions'][number], baseIndex: number) => boolean,
) {
    return state.bases.flatMap((base, baseIndex) => {
        const baseLabel = getBaseLabel(state, baseIndex);
        return base.minions
            .filter(minion => predicate(minion, baseIndex))
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                controller: minion.controller,
                owner: minion.owner,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${baseLabel}`,
            }));
    });
}

function collectMinionsOnBase(
    state: SmashUpCore,
    baseIndex: number,
    predicate: (minion: SmashUpCore['bases'][number]['minions'][number]) => boolean,
) {
    const base = state.bases[baseIndex];
    if (!base) return [];
    const baseLabel = getBaseLabel(state, baseIndex);
    return base.minions
        .filter(minion => predicate(minion))
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            controller: minion.controller,
            owner: minion.owner,
            label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${baseLabel}`,
        }));
}

function buildHandMinionOptions(state: SmashUpCore, playerId: PlayerId, maxPower?: number) {
    const hand = state.players[playerId]?.hand ?? [];
    return hand
        .filter(card => {
            if (card.type !== 'minion') return false;
            const def = getCardDef(card.defId);
            if (!def || def.type !== 'minion') return false;
            return maxPower === undefined || def.power <= maxPower;
        })
        .map((card, index) => {
            const def = getCardDef(card.defId);
            const power = def && def.type === 'minion' ? def.power : 0;
            return {
                id: `hand-${playerId}-${index}`,
                label: `${def?.name ?? card.defId} (力量 ${power})`,
                value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner, power },
                _source: 'hand' as const,
                displayMode: 'card' as const,
            };
        });
}

function buildMermaidsMetadataUpdatedEvent(
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

function buildMoveOngoingEvents(
    cardUid: string,
    defId: string,
    ownerId: PlayerId,
    sourcePlayerId: PlayerId,
    targetBaseIndex: number,
    reason: string,
    timestamp: number,
    snapshot?: OngoingMoveSnapshot,
): SmashUpEvent[] {
    return [
        buildOngoingDetachedEvent({
            cardUid,
            defId,
            ownerId,
            reason,
            now: timestamp,
        }),
        {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid,
                defId,
                ownerId,
                ...(ownerId !== sourcePlayerId ? { sourcePlayerId } : {}),
                targetType: 'base',
                targetBaseIndex,
                ...(snapshot?.metadata ? { metadata: snapshot.metadata } : {}),
                ...(snapshot?.talentUsed !== undefined ? { talentUsed: snapshot.talentUsed } : {}),
            },
            timestamp,
        } as OngoingAttachedEvent,
    ];
}

function findOngoingOwnerOnBases(
    state: SmashUpCore,
    cardUid: string,
    defId: string,
    fallbackPlayerId: PlayerId,
): PlayerId {
    for (const base of state.bases) {
        const ongoing = base.ongoingActions.find(action => action.uid === cardUid && action.defId === defId);
        if (ongoing) {
            return ongoing.ownerId;
        }
    }
    return fallbackPlayerId;
}

function getMermaidsCharmerCandidates(
    state: SmashUpCore,
    playerId: PlayerId,
    targetBaseIndex: number,
) {
    return collectMinions(
        state,
        (minion, baseIndex) => (
            minion.controller !== playerId
            && baseIndex !== targetBaseIndex
            && getMinionPower(state, minion, baseIndex) <= 3
        ),
    );
}

function advanceUltimateSongHandPrompt(
    matchState: AbilityContext['matchState'],
    state: SmashUpCore,
    casterPlayerId: PlayerId,
    targetBaseIndex: number,
    remainingPlayerIds: PlayerId[],
    now: number,
) {
    const events: SmashUpEvent[] = [];
    const pending = [...remainingPlayerIds];

    while (pending.length > 0) {
        const forcedPlayerId = pending.shift()!;
        const options = buildHandMinionOptions(state, forcedPlayerId, 3);
        if (options.length === 0) {
            events.push(buildAbilityFeedback(forcedPlayerId, 'feedback.no_valid_targets', now));
            continue;
        }
        return {
            events,
            context: createMermaidsPromptContext(matchState, forcedPlayerId, now, {
                casterPlayerId,
                targetBaseIndex,
                remainingPlayerIds: pending,
                forcedPlayerId,
            }) satisfies MermaidsUltimateSongHandPromptContext,
            nextProgram: mermaidsUltimateSongHandPromptProgram,
        };
    }

    return {
        events: [
            ...events,
            grantContextualExtraMinion({ playerId: casterPlayerId, now, matchState }, 'mermaids_ultimate_song'),
            grantContextualExtraAction({ playerId: casterPlayerId, now, matchState }, 'mermaids_ultimate_song'),
        ],
    };
}

function advanceSirenSongTargetPrompt(
    matchState: AbilityContext['matchState'],
    state: SmashUpCore,
    playerId: PlayerId,
    fromBaseIndex: number,
    toBaseIndex: number,
    remainingPlayerIds: PlayerId[],
    now: number,
) {
    const pending = [...remainingPlayerIds];
    while (pending.length > 0) {
        const targetPlayerId = pending.shift()!;
        const candidates = collectMinionsOnBase(
            state,
            fromBaseIndex,
            minion => minion.controller === targetPlayerId,
        );
        const options = buildMinionTargetOptions(candidates, {
            state,
            sourcePlayerId: playerId,
            sourceDefId: 'mermaids_siren_song',
            effectType: 'move',
        });
        if (options.length === 0) continue;

        return {
            events: [],
            context: createMermaidsPromptContext(matchState, playerId, now, {
                fromBaseIndex,
                toBaseIndex,
                targetPlayerId,
                remainingPlayerIds: pending,
            }) satisfies MermaidsSirenSongTargetPromptContext,
            nextProgram: mermaidsSirenSongTargetPromptProgram,
        };
    }

    return { events: [] };
}

const mermaidsCharmerTargetPromptProgram = createPromptProgram<MermaidsCharmerTargetPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mermaids_charmer_target',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `mermaids_charmer_target_${context.now}`,
        context.playerId,
        '迷人的人：你可以把另一个玩家一个力量 3 或以下的随从移到这里',
        [
            createSkipOption('不移动别人的随从', 'ui.mermaids_charmer_target_skip_option'),
            ...buildMinionTargetOptions(
                getMermaidsCharmerCandidates(context.matchState.core, context.playerId, context.targetBaseIndex),
                {
                    state: context.matchState.core,
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'mermaids_charmer',
                    effectType: 'move',
                },
            ),
        ] as any[],
        { sourceId: 'mermaids_charmer_target', targetType: 'minion', titleKey: 'ui.mermaids_charmer_target_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as MinionChoice;
        if (selected.skip || !selected.minionUid || selected.baseIndex === undefined || !selected.defId) {
            return { events: [] };
        }
        return {
            events: buildValidatedMoveEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                toBaseIndex: context.targetBaseIndex,
                reason: 'mermaids_charmer',
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceDefId: 'mermaids_charmer',
                sourceControllerId: context.playerId,
            }),
        };
    },
});

const mermaidsCharmerMovePromptProgram = createPromptProgram<MermaidsCharmerMovePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mermaids_charmer_move',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `mermaids_charmer_move_${context.now}`,
        context.playerId,
        '迷人的人：你可以先移动这个随从',
        [
            createSkipOption('不移动这个随从', 'ui.mermaids_charmer_move_skip_option'),
            ...buildBaseTargetOptions(getOtherBases(context.matchState.core, context.fromBaseIndex), context.matchState.core),
        ] as any[],
        { sourceId: 'mermaids_charmer_move', targetType: 'base', titleKey: 'ui.mermaids_charmer_move_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as BaseChoice;
        const targetBaseIndex = selected.skip || selected.baseIndex === undefined
            ? context.fromBaseIndex
            : selected.baseIndex;
        const moveEvents = (!selected.skip && selected.baseIndex !== undefined)
            ? buildValidatedMoveEvents(state, {
                minionUid: context.charmerUid,
                minionDefId: context.charmerDefId,
                fromBaseIndex: context.fromBaseIndex,
                toBaseIndex: selected.baseIndex,
                reason: 'mermaids_charmer',
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceCardUid: context.charmerUid,
                sourceDefId: context.charmerDefId,
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.fromBaseIndex,
            })
            : [];

        if (getMermaidsCharmerCandidates(state.core, context.playerId, targetBaseIndex).length === 0) {
            return { events: moveEvents };
        }

        return {
            events: moveEvents,
            context: createMermaidsPromptContext(state, context.playerId, timestamp, {
                targetBaseIndex,
            }) satisfies MermaidsCharmerTargetPromptContext,
            nextProgram: mermaidsCharmerTargetPromptProgram,
        };
    },
});

const mermaidsMermaidQueenMovePromptProgram = createPromptDslProgram<MermaidsMermaidQueenTargetPromptContext>({
    sourceId: 'mermaids_mermaid_queen_move',
    footprint: (context) => {
        const targets = collectMinions(context.matchState.core, (minion, baseIndex) => (
            minion.controller !== context.playerId && baseIndex !== context.targetBaseIndex
        ));
        return createFootprint({
            reads: [
                { kind: 'base', index: context.targetBaseIndex },
                ...targets.flatMap(target => [
                    { kind: 'minion' as const, uid: target.minion.uid },
                    { kind: 'base' as const, index: target.baseIndex },
                ]),
            ],
            writes: [
                { kind: 'base', index: context.targetBaseIndex },
                { kind: 'targetAvailability', baseIndex: context.targetBaseIndex },
                ...targets.flatMap(target => [
                    { kind: 'minion' as const, uid: target.minion.uid },
                    { kind: 'base' as const, index: target.baseIndex },
                    { kind: 'targetAvailability' as const, baseIndex: target.baseIndex },
                ]),
            ],
            opensInteraction: true,
        });
    },
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `mermaids_mermaid_queen_move_${context.now}`,
        context.playerId,
        '人鱼女王：选择一个其他玩家的随从移到这里',
        buildMinionTargetOptions(
            collectMinions(context.matchState.core, (minion, baseIndex) => (
                minion.controller !== context.playerId && baseIndex !== context.targetBaseIndex
            )),
            {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'mermaids_mermaid_queen',
                effectType: 'move',
            },
        ) as any[],
        { sourceId: 'mermaids_mermaid_queen_move', targetType: 'minion', titleKey: 'ui.mermaids_mermaid_queen_move_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as MinionChoice;
        if (!selected.minionUid || selected.baseIndex === undefined || !selected.defId) return { events: [] };
        return {
            events: buildValidatedMoveEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                toBaseIndex: context.targetBaseIndex,
                reason: 'mermaids_mermaid_queen',
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceDefId: 'mermaids_mermaid_queen',
                sourceControllerId: context.playerId,
            }),
        };
    },
});

const mermaidsMermaidQueenControlPromptProgram = createPromptProgram<MermaidsMermaidQueenTargetPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mermaids_mermaid_queen_control',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `mermaids_mermaid_queen_control_${context.now}`,
        context.playerId,
        'ui.mermaids_mermaid_queen_control_title',
        buildMinionTargetOptions(
            collectMinionsOnBase(
                context.matchState.core,
                context.targetBaseIndex,
                minion => minion.controller !== context.playerId
                    && getMinionPower(context.matchState.core, minion, context.targetBaseIndex) <= 3,
            ),
            {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'mermaids_mermaid_queen',
                effectType: 'affect',
            },
        ) as any[],
        { sourceId: 'mermaids_mermaid_queen_control', targetType: 'minion', titleKey: 'ui.mermaids_mermaid_queen_control_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as MinionChoice;
        if (!selected.minionUid || selected.baseIndex === undefined || !selected.defId) return { events: [] };
        const minion = state.core.bases[selected.baseIndex]?.minions.find(entry => entry.uid === selected.minionUid);
        if (!minion || minion.controller === context.playerId) return { events: [] };
        return {
            events: [
                changeMinionController(
                    minion.uid,
                    minion.defId,
                    selected.baseIndex,
                    minion.owner,
                    minion.controller,
                    context.playerId,
                    context.playerId,
                    'mermaids_mermaid_queen',
                    timestamp,
                ),
                buildMermaidsMetadataUpdatedEvent(
                    minion.uid,
                    selected.baseIndex,
                    {
                        [MERMAIDS_TEMP_CONTROL_CONTROLLER_META]: minion.controller,
                        [MERMAIDS_TEMP_CONTROL_PLAYER_META]: context.playerId,
                        [MERMAIDS_TEMP_CONTROL_TURN_META]: state.core.turnNumber,
                    },
                    'mermaids_mermaid_queen',
                    timestamp,
                ),
            ],
        };
    },
});

const mermaidsMermaidQueenModePromptProgram = createPromptProgram<MermaidsMermaidQueenModePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mermaids_mermaid_queen_mode',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `mermaids_mermaid_queen_mode_${context.now}`,
        context.playerId,
        '人鱼女王：选择要执行的效果',
        [
            { id: 'move', label: '把一个其他玩家的随从移到这里', labelKey: 'ui.mermaids_mermaid_queen_mode_move_option', value: { mode: 'move' }, displayMode: 'button' as const },
            { id: 'control', label: '直到回合结束获得这里一个力量 3 或以下随从的控制权', labelKey: 'ui.mermaids_mermaid_queen_mode_control_option', value: { mode: 'control' }, displayMode: 'button' as const },
        ],
        { sourceId: 'mermaids_mermaid_queen_mode', targetType: 'static', titleKey: 'ui.mermaids_mermaid_queen_mode_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as ModeChoice;
        if (!selected.mode) return { events: [] };
        if (selected.mode === 'move') {
            const moveTargets = collectMinions(
                state.core,
                (minion, baseIndex) => minion.controller !== context.playerId && baseIndex !== context.targetBaseIndex,
            );
            if (moveTargets.length === 0) {
                return { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', timestamp)] };
            }
            return {
                events: [],
                context: createMermaidsPromptContext(state, context.playerId, timestamp, {
                    targetBaseIndex: context.targetBaseIndex,
                }) satisfies MermaidsMermaidQueenTargetPromptContext,
                nextProgram: mermaidsMermaidQueenMovePromptProgram,
            };
        }

        const controlTargets = collectMinionsOnBase(
            state.core,
            context.targetBaseIndex,
            minion => minion.controller !== context.playerId
                && getMinionPower(state.core, minion, context.targetBaseIndex) <= 3,
        );
        if (controlTargets.length === 0) {
            return { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', timestamp)] };
        }
        return {
            events: [],
            context: createMermaidsPromptContext(state, context.playerId, timestamp, {
                targetBaseIndex: context.targetBaseIndex,
            }) satisfies MermaidsMermaidQueenTargetPromptContext,
            nextProgram: mermaidsMermaidQueenControlPromptProgram,
        };
    },
});

const mermaidsCaptiveAudiencePromptProgram = createPromptProgram<MermaidsCaptiveAudiencePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mermaids_captive_audience',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `mermaids_captive_audience_${context.now}`,
        context.playerId,
        `迷倒观众：选择你的一个随从，获得 +${context.bonusPower} 力量直到回合结束`,
        buildMinionTargetOptions(
            collectMinionsOnBase(context.matchState.core, context.baseIndex, minion => minion.controller === context.playerId),
            {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'mermaids_captive_audience',
            },
        ) as any[],
        { sourceId: 'mermaids_captive_audience', targetType: 'minion', titleKey: 'ui.mermaids_captive_audience_title', titleParams: { bonusPower: context.bonusPower } },
    ),
    onResolve: ({ context, value, timestamp }) => {
        const selected = value as MinionChoice;
        if (!selected.minionUid || selected.baseIndex === undefined) {
            return {
                events: [grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: context.matchState }, 'mermaids_captive_audience')],
            };
        }
        return {
            events: [
                addTempPower(selected.minionUid, selected.baseIndex, context.bonusPower, 'mermaids_captive_audience', timestamp),
                grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: context.matchState }, 'mermaids_captive_audience'),
            ],
        };
    },
});

const mermaidsOngoingMovePromptProgram = createPromptProgram<MermaidsOngoingMovePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mermaids_becalmed_shores',
    interactionSourceIds: ['mermaids_shipwreck_cove_after_scoring'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.reason}_${context.now}`,
        context.playerId,
        context.title,
        [
            ...(context.allowSkip ? [{
                ...createSkipOption(context.skipLabel ?? '跳过'),
                ...(context.skipLabelKey ? { labelKey: context.skipLabelKey } : {}),
            }] : []),
            ...buildFieldSourceToBaseTargetOptions(
                {
                    type: 'ongoing',
                    uid: context.cardUid,
                    defId: context.defId,
                    fromBaseIndex: context.fromBaseIndex,
                },
                getOtherBases(context.matchState.core, context.fromBaseIndex),
                context.matchState.core,
            ),
        ] as any[],
        buildFieldSourceTargetPromptConfig({
            sourceId: context.reason === 'mermaids_shipwreck_cove'
                ? 'mermaids_shipwreck_cove_after_scoring'
                : 'mermaids_becalmed_shores',
            titleKey: context.titleKey,
            titleParams: context.titleParams,
        }),
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as BaseChoice;
        if (selected.skip || selected.baseIndex === undefined || selected.baseIndex === context.fromBaseIndex) {
            return { events: [] };
        }
        const currentOngoing = state.core.bases[context.fromBaseIndex]?.ongoingActions.find(action => action.uid === context.cardUid);
        return {
            events: buildMoveOngoingEvents(
                context.cardUid,
                context.defId,
                context.ownerId,
                context.playerId,
                selected.baseIndex,
                context.reason,
                timestamp,
                currentOngoing ? { metadata: currentOngoing.metadata, talentUsed: currentOngoing.talentUsed } : undefined,
            ),
        };
    },
});

const mermaidsUltimateSongHandPromptProgram = createPromptProgram<MermaidsUltimateSongHandPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mermaids_ultimate_song_hand',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `mermaids_ultimate_song_hand_${context.forcedPlayerId}_${context.now}`,
        context.forcedPlayerId,
        '最后的歌声：选择一张力量 3 或以下的随从额外打出到目标基地',
        buildHandMinionOptions(context.matchState.core, context.forcedPlayerId, 3) as any[],
        { sourceId: 'mermaids_ultimate_song_hand', targetType: 'hand', titleKey: 'ui.mermaids_ultimate_song_hand_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as HandMinionChoice;
        if (!selected.cardUid || !selected.defId) return { events: [] };
        const selectedCard = state.core.players[context.forcedPlayerId]?.hand.find(card =>
            card.uid === selected.cardUid
            && card.defId === selected.defId
            && card.type === 'minion',
        );
        if (!selectedCard) return { events: [] };

        const playedEvent: SmashUpEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId: context.forcedPlayerId,
                cardUid: selected.cardUid,
                defId: selected.defId,
                ownerId: selectedCard.owner,
                baseIndex: context.targetBaseIndex,
                baseDefId: state.core.bases[context.targetBaseIndex]?.defId,
                power: selected.power ?? 0,
                consumesNormalLimit: false,
                skipOnPlayAbility: true,
                reason: 'mermaids_ultimate_song',
            },
            timestamp,
        };

        const advanced = advanceUltimateSongHandPrompt(
            state,
            state.core,
            context.casterPlayerId,
            context.targetBaseIndex,
            context.remainingPlayerIds,
            timestamp,
        );
        return { ...advanced, events: [playedEvent, ...advanced.events] };
    },
});

const mermaidsUltimateSongBasePromptProgram = createPromptProgram<MermaidsPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mermaids_ultimate_song_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `mermaids_ultimate_song_base_${context.now}`,
        context.playerId,
        '最后的歌声：选择目标基地',
        buildBaseTargetOptions(collectBasesWithOwnMinions(context.matchState.core, context.playerId), context.matchState.core) as any[],
        { sourceId: 'mermaids_ultimate_song_base', targetType: 'base', titleKey: 'ui.mermaids_ultimate_song_base_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as BaseChoice;
        if (selected.baseIndex === undefined) return { events: [] };
        return advanceUltimateSongHandPrompt(
            state,
            state.core,
            context.playerId,
            selected.baseIndex,
            getOtherPlayers(state.core, context.playerId),
            timestamp,
        );
    },
});

const mermaidsSirenSongTargetPromptProgram = createPromptProgram<MermaidsSirenSongTargetPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mermaids_siren_song_target',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `mermaids_siren_song_target_${context.targetPlayerId}_${context.now}`,
        context.playerId,
        `塞壬的歌声：选择玩家 ${context.targetPlayerId} 的一个随从移动`,
        buildMinionTargetOptions(
            collectMinionsOnBase(
                context.matchState.core,
                context.fromBaseIndex,
                minion => minion.controller === context.targetPlayerId,
            ),
            {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'mermaids_siren_song',
                effectType: 'move',
            },
        ) as any[],
        { sourceId: 'mermaids_siren_song_target', targetType: 'minion', titleKey: 'ui.mermaids_siren_song_target_title', titleParams: { targetPlayerId: context.targetPlayerId } },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as MinionChoice;
        if (!selected.minionUid || selected.baseIndex === undefined || !selected.defId) return { events: [] };
        const advanced = advanceSirenSongTargetPrompt(
            state,
            state.core,
            context.playerId,
            context.fromBaseIndex,
            context.toBaseIndex,
            context.remainingPlayerIds,
            timestamp,
        );
        return {
            ...advanced,
            events: [
                ...buildValidatedMoveEvents(state, {
                    minionUid: selected.minionUid,
                    minionDefId: selected.defId,
                    fromBaseIndex: selected.baseIndex,
                    toBaseIndex: context.toBaseIndex,
                    reason: 'mermaids_siren_song',
                    now: timestamp,
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'mermaids_siren_song',
                    sourceControllerId: context.playerId,
                }),
                ...advanced.events,
            ],
        };
    },
});

const mermaidsSirenSongDestinationPromptProgram = createPromptProgram<MermaidsSirenSongDestinationPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mermaids_siren_song_destination',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `mermaids_siren_song_destination_${context.now}`,
        context.playerId,
        '塞壬的歌声：选择目标基地',
        buildBaseTargetOptions(collectBasesWithOwnMinions(context.matchState.core, context.playerId, context.fromBaseIndex), context.matchState.core) as any[],
        { sourceId: 'mermaids_siren_song_destination', targetType: 'base', titleKey: 'ui.mermaids_siren_song_destination_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as BaseChoice;
        if (selected.baseIndex === undefined) return { events: [] };
        return advanceSirenSongTargetPrompt(
            state,
            state.core,
            context.playerId,
            context.fromBaseIndex,
            selected.baseIndex,
            context.remainingPlayerIds,
            timestamp,
        );
    },
});

const mermaidsSirenSongBasePromptProgram = createPromptProgram<MermaidsPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mermaids_siren_song_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `mermaids_siren_song_base_${context.now}`,
        context.playerId,
        '塞壬的歌声：选择来源基地',
        buildBaseTargetOptions(
            context.matchState.core.bases
                .map((base, baseIndex) => ({
                    baseIndex,
                    label: getBaseLabel(context.matchState.core, baseIndex),
                    opponentMinionCount: base.minions.filter(minion => minion.controller !== context.playerId).length,
                    destinationCount: collectBasesWithOwnMinions(context.matchState.core, context.playerId, baseIndex).length,
                }))
                .filter(base => base.opponentMinionCount > 0 && base.destinationCount > 0),
            context.matchState.core,
        ) as any[],
        { sourceId: 'mermaids_siren_song_base', targetType: 'base', titleKey: 'ui.mermaids_siren_song_base_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as BaseChoice;
        if (selected.baseIndex === undefined) return { events: [] };
        const destinationBases = collectBasesWithOwnMinions(state.core, context.playerId, selected.baseIndex);
        if (destinationBases.length === 0) {
            return { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', timestamp)] };
        }
        return {
            events: [],
            context: createMermaidsPromptContext(state, context.playerId, timestamp, {
                fromBaseIndex: selected.baseIndex,
                remainingPlayerIds: getOtherPlayers(state.core, context.playerId),
            }) satisfies MermaidsSirenSongDestinationPromptContext,
            nextProgram: mermaidsSirenSongDestinationPromptProgram,
        };
    },
});

const mermaidsCharmedDestinationPromptProgram = createPromptProgram<MermaidsCharmedDestinationPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mermaids_charmed_destination',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `mermaids_charmed_destination_${context.now}`,
        context.playerId,
        '魅惑：你可以把它移动到另一个你有随从的基地',
        [
            createSkipOption('不移动，直接完成', 'ui.mermaids_charmed_destination_skip_option'),
            ...buildBaseTargetOptions(collectBasesWithOwnMinions(context.matchState.core, context.playerId, context.fromBaseIndex), context.matchState.core),
        ] as any[],
        { sourceId: 'mermaids_charmed_destination', targetType: 'base', titleKey: 'ui.mermaids_charmed_destination_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as BaseChoice;
        const metadataBaseIndex = selected.skip || selected.baseIndex === undefined
            ? context.fromBaseIndex
            : selected.baseIndex;
        const metadataEvent = buildMermaidsMetadataUpdatedEvent(
            context.minionUid,
            metadataBaseIndex,
            { [MERMAIDS_CHARMED_SUPPRESSED_TURN_META]: state.core.turnNumber },
            'mermaids_charmed',
            timestamp,
        );
        if (selected.skip || selected.baseIndex === undefined) {
            return {
                events: [
                    metadataEvent,
                    grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: context.matchState }, 'mermaids_charmed'),
                ],
            };
        }
        return {
            events: [
                ...buildValidatedMoveEvents(state, {
                    minionUid: context.minionUid,
                    minionDefId: context.minionDefId,
                    fromBaseIndex: context.fromBaseIndex,
                    toBaseIndex: selected.baseIndex,
                    reason: 'mermaids_charmed',
                    now: timestamp,
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'mermaids_charmed',
                    sourceControllerId: context.playerId,
                }),
                metadataEvent,
                grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: context.matchState }, 'mermaids_charmed'),
            ],
        };
    },
});

const mermaidsCharmedPromptProgram = createPromptProgram<MermaidsPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'mermaids_charmed',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `mermaids_charmed_${context.now}`,
        context.playerId,
        'ui.mermaids_charmed_title',
        buildMinionTargetOptions(
            collectMinions(context.matchState.core, (minion, baseIndex) => getMinionPower(context.matchState.core, minion, baseIndex) <= 3),
            {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'mermaids_charmed',
                effectType: 'affect',
            },
        ) as any[],
        { sourceId: 'mermaids_charmed', targetType: 'minion', titleKey: 'ui.mermaids_charmed_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as MinionChoice;
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };
        const minion = state.core.bases[selected.baseIndex]?.minions.find(entry => entry.uid === selected.minionUid);
        if (!minion) return { events: [] };
        const destinationBases = collectBasesWithOwnMinions(state.core, context.playerId, selected.baseIndex);
        if (destinationBases.length === 0) {
            return {
                events: [
                    buildMermaidsMetadataUpdatedEvent(
                        selected.minionUid,
                        selected.baseIndex,
                        { [MERMAIDS_CHARMED_SUPPRESSED_TURN_META]: state.core.turnNumber },
                        'mermaids_charmed',
                        timestamp,
                    ),
                    grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: context.matchState }, 'mermaids_charmed'),
                ],
            };
        }
        return {
            events: [],
            context: createMermaidsPromptContext(state, context.playerId, timestamp, {
                minionUid: selected.minionUid,
                minionDefId: minion.defId,
                fromBaseIndex: selected.baseIndex,
            }) satisfies MermaidsCharmedDestinationPromptContext,
            nextProgram: mermaidsCharmedDestinationPromptProgram,
        };
    },
});

function mermaidsCharmerTalent(ctx: AbilityContext): AbilityResult {
    const otherBases = getOtherBases(ctx.state, ctx.baseIndex);
    const hasMoveTarget = otherBases.length > 0;
    const hasPullTarget = collectMinions(
        ctx.state,
        (minion, baseIndex) => (
            minion.controller !== ctx.playerId
            && baseIndex !== ctx.baseIndex
            && getMinionPower(ctx.state, minion, baseIndex) <= 3
        ),
    ).length > 0;
    if (!hasMoveTarget && !hasPullTarget) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const result = executeAbilityProgram(
        mermaidsCharmerMovePromptProgram,
        createMermaidsPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            charmerUid: ctx.cardUid,
            charmerDefId: ctx.defId,
            fromBaseIndex: ctx.baseIndex,
        }) satisfies MermaidsCharmerMovePromptContext,
    );
    return { events: result.events, matchState: result.matchState };
}

function mermaidsMermaidQueenOnPlay(ctx: AbilityContext): AbilityResult {
    const moveTargets = collectMinions(
        ctx.state,
        (minion, baseIndex) => minion.controller !== ctx.playerId && baseIndex !== ctx.baseIndex,
    );
    const controlTargets = collectMinionsOnBase(
        ctx.state,
        ctx.baseIndex,
        minion => minion.controller !== ctx.playerId && getMinionPower(ctx.state, minion, ctx.baseIndex) <= 3,
    );

    if (moveTargets.length === 0 && controlTargets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    if (moveTargets.length > 0 && controlTargets.length === 0) {
        const result = executeAbilityProgram(
            mermaidsMermaidQueenMovePromptProgram,
            createMermaidsPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
                targetBaseIndex: ctx.baseIndex,
            }) satisfies MermaidsMermaidQueenTargetPromptContext,
        );
        return { events: result.events, matchState: result.matchState };
    }

    if (moveTargets.length === 0) {
        const result = executeAbilityProgram(
            mermaidsMermaidQueenControlPromptProgram,
            createMermaidsPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
                targetBaseIndex: ctx.baseIndex,
            }) satisfies MermaidsMermaidQueenTargetPromptContext,
        );
        return { events: result.events, matchState: result.matchState };
    }

    const result = executeAbilityProgram(
        mermaidsMermaidQueenModePromptProgram,
        createMermaidsPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            targetBaseIndex: ctx.baseIndex,
        }) satisfies MermaidsMermaidQueenModePromptContext,
    );
    return { events: result.events, matchState: result.matchState };
}

function mermaidsCaptiveAudienceOnPlay(ctx: AbilityContext): AbilityResult {
    const targetBase = ctx.state.bases[ctx.baseIndex];
    if (!targetBase) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const bonusPower = targetBase.minions.filter(minion => minion.controller !== ctx.playerId).length;
    const ownMinions = collectMinionsOnBase(
        ctx.state,
        ctx.baseIndex,
        minion => minion.controller === ctx.playerId,
    );
    if (bonusPower <= 0 || ownMinions.length === 0) {
        return {
            events: [grantContextualExtraAction({ playerId: ctx.playerId, now: ctx.now, matchState: ctx.matchState }, 'mermaids_captive_audience')],
        };
    }

    const result = executeAbilityProgram(
        mermaidsCaptiveAudiencePromptProgram,
        createMermaidsPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            bonusPower,
            baseIndex: ctx.baseIndex,
        }) satisfies MermaidsCaptiveAudiencePromptContext,
    );
    return { events: result.events, matchState: result.matchState };
}

function mermaidsBecalmedShoresTalent(ctx: AbilityContext): AbilityResult {
    const baseTargets = getOtherBases(ctx.state, ctx.baseIndex);
    if (baseTargets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const ownerId = findOngoingOwnerOnBases(ctx.state, ctx.cardUid, ctx.defId, ctx.playerId);
    const result = executeAbilityProgram(
        mermaidsOngoingMovePromptProgram,
        createMermaidsPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            cardUid: ctx.cardUid,
            defId: ctx.defId,
            ownerId,
            fromBaseIndex: ctx.baseIndex,
            reason: 'mermaids_becalmed_shores',
            title: '安静的海岸：把这张牌移到另一个基地',
        }) satisfies MermaidsOngoingMovePromptContext,
    );
    return { events: result.events, matchState: result.matchState };
}

function mermaidsUltimateSongOnPlay(ctx: AbilityContext): AbilityResult {
    const baseTargets = collectBasesWithOwnMinions(ctx.state, ctx.playerId);
    if (baseTargets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        mermaidsUltimateSongBasePromptProgram,
        createMermaidsPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function mermaidsSirenSongOnPlay(ctx: AbilityContext): AbilityResult {
    const sourceBases = ctx.state.bases
        .map((base, baseIndex) => ({
            baseIndex,
            label: getBaseLabel(ctx.state, baseIndex),
            opponentMinionCount: base.minions.filter(minion => minion.controller !== ctx.playerId).length,
            destinationCount: collectBasesWithOwnMinions(ctx.state, ctx.playerId, baseIndex).length,
        }))
        .filter(base => base.opponentMinionCount > 0 && base.destinationCount > 0);
    if (sourceBases.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const result = executeAbilityProgram(
        mermaidsSirenSongBasePromptProgram,
        createMermaidsPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function mermaidsTollBayOnPlay(ctx: AbilityContext): AbilityResult {
    const targetBase = ctx.state.bases[ctx.baseIndex];
    if (!targetBase) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const opponentMinionCount = targetBase.minions.filter(minion => minion.controller !== ctx.playerId).length;
    return {
        events: buildStandardDrawEvents(ctx.state, ctx.playerId, opponentMinionCount, ctx.random, ctx.now),
    };
}

function mermaidsShipwreckCoveSpecial(): AbilityResult {
    return { events: [] };
}

function mermaidsDesertIslandOnPlay(): AbilityResult {
    return { events: [] };
}

function mermaidsCharmedOnPlay(ctx: AbilityContext): AbilityResult {
    const targets = collectMinions(ctx.state, (minion, baseIndex) => getMinionPower(ctx.state, minion, baseIndex) <= 3);
    if (targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        mermaidsCharmedPromptProgram,
        createMermaidsPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function mermaidsShipwreckCoveAfterScoring(ctx: TriggerContext): AbilityResult {
    if (!ctx.sourceCardUid || !ctx.sourceControllerId || ctx.sourceBaseIndex === undefined) {
        return { events: [] };
    }
    const baseTargets = getOtherBases(ctx.state, ctx.sourceBaseIndex);
    if (baseTargets.length === 0) {
        return { events: [] };
    }
    if (!ctx.matchState) return { events: [] };
    const sourceDefId = ctx.sourceDefId ?? 'mermaids_shipwreck_cove';
    const ownerId = findOngoingOwnerOnBases(ctx.state, ctx.sourceCardUid, sourceDefId, ctx.sourceControllerId);
    return executeAbilityProgram(
        mermaidsOngoingMovePromptProgram,
        createMermaidsPromptContext(ctx.matchState, ctx.sourceControllerId, ctx.now, {
            cardUid: ctx.sourceCardUid,
            defId: sourceDefId,
            ownerId,
            fromBaseIndex: ctx.sourceBaseIndex,
            reason: sourceDefId,
            title: '沉船湾：你可以把这张牌移到另一个基地',
            titleKey: 'ui.mermaids_shipwreck_cove_move_title',
            allowSkip: true,
            skipLabelKey: 'ui.mermaids_shipwreck_cove_skip_move',
        }) satisfies MermaidsOngoingMovePromptContext,
    );
}

function canTriggerMermaidsShipwreckCoveAfterScoring(ctx: TriggerContext): boolean {
    if (!ctx.sourceCardUid || !ctx.sourceControllerId || ctx.sourceBaseIndex === undefined || !ctx.matchState) {
        return false;
    }
    return getOtherBases(ctx.state, ctx.sourceBaseIndex).length > 0;
}

function mermaidsDesertIslandOnTurnStart(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || !ctx.sourceControllerId) return [];
    if (ctx.playerId !== ctx.sourceControllerId) return [];
    const ownerId = (() => {
        for (const base of ctx.state.bases) {
            for (const minion of base.minions) {
                const attached = minion.attachedActions.find(action => action.uid === ctx.sourceCardUid);
                if (attached) return attached.ownerId;
            }
        }
        return ctx.sourceControllerId;
    })();
    return [buildOngoingDetachedEvent({
        cardUid: ctx.sourceCardUid,
        defId: ctx.sourceDefId ?? 'mermaids_desert_island',
        ownerId,
        reason: ctx.sourceDefId ?? 'mermaids_desert_island',
        now: ctx.now,
    })];
}

export function registerMermaidsAbilities(): void {
    registerAbilityProgram('mermaids_charmer', 'talent', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mermaidsCharmerTalent) });
    registerAbilityProgram('mermaids_charmer_pod', 'talent', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mermaidsCharmerTalent) });
    registerAbilityProgram('mermaids_mermaid_queen', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mermaidsMermaidQueenOnPlay) });
    registerAbilityProgram('mermaids_mermaid_queen_pod', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mermaidsMermaidQueenOnPlay) });
    registerAbilityProgram('mermaids_ultimate_song', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mermaidsUltimateSongOnPlay) });
    registerAbilityProgram('mermaids_ultimate_song_pod', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mermaidsUltimateSongOnPlay) });
    registerAbilityProgram('mermaids_captive_audience', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mermaidsCaptiveAudienceOnPlay) });
    registerAbilityProgram('mermaids_captive_audience_pod', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mermaidsCaptiveAudienceOnPlay) });
    registerAbilityProgram('mermaids_becalmed_shores', 'talent', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mermaidsBecalmedShoresTalent) });
    registerAbilityProgram('mermaids_becalmed_shores_pod', 'talent', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mermaidsBecalmedShoresTalent) });
    registerAbilityProgram('mermaids_siren_song', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mermaidsSirenSongOnPlay) });
    registerAbilityProgram('mermaids_siren_song_pod', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mermaidsSirenSongOnPlay) });
    registerAbility('mermaids_toll_bay', 'onPlay', mermaidsTollBayOnPlay);
    registerAbility('mermaids_toll_bay_pod', 'onPlay', mermaidsTollBayOnPlay);
    registerAbility('mermaids_shipwreck_cove', 'special', mermaidsShipwreckCoveSpecial);
    registerAbility('mermaids_shipwreck_cove_pod', 'special', mermaidsShipwreckCoveSpecial);
    registerAbilityProgram('mermaids_charmed', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mermaidsCharmedOnPlay) });
    registerAbilityProgram('mermaids_charmed_pod', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(mermaidsCharmedOnPlay) });
    registerAbility('mermaids_desert_island', 'onPlay', mermaidsDesertIslandOnPlay);
    registerAbility('mermaids_desert_island_pod', 'onPlay', mermaidsDesertIslandOnPlay);

    registerTrigger('mermaids_shipwreck_cove', 'afterScoring', mermaidsShipwreckCoveAfterScoring, {
        optional: true,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: canTriggerMermaidsShipwreckCoveAfterScoring,
    });
    registerTrigger('mermaids_shipwreck_cove_pod', 'afterScoring', mermaidsShipwreckCoveAfterScoring, {
        optional: true,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: canTriggerMermaidsShipwreckCoveAfterScoring,
    });
    registerTrigger('mermaids_desert_island', 'onTurnStart', mermaidsDesertIslandOnTurnStart, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        effectContract: selfDetachOrderingContract,
    });
    registerTrigger('mermaids_desert_island_pod', 'onTurnStart', mermaidsDesertIslandOnTurnStart, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        effectContract: selfDetachOrderingContract,
    });
}

export function registerMermaidsInteractionHandlers(): void {
}
