/**
 * 大杀四方 - 远古之物派系能力
 *
 * 主题：疯狂卡操控、惩罚持有疯狂卡的对手?
 * 克苏鲁扩展派系，核心机制围绕 Madness 牌库底
 */

import { registerAbility, registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    drawMadnessCards,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    buildValidatedDestroyEvents,
    getMinionPower,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    addPowerCounter,
    revealHand,
    buildAbilityFeedback,
    buildValidatedCardToDeckBottomEvents,
    findMinionOnBases,
    buildStandardDrawEventsFromRuntimeContext,
    buildStandardDrawEvents,
} from '../domain/abilityHelpers';
import { SU_EVENTS, MADNESS_CARD_DEF_ID } from '../domain/types';
import type {
    SmashUpCore,
    SmashUpEvent,
    CardsDiscardedEvent,
    DeckReshuffledEvent,
    MinionCardDef,
} from '../domain/types';
import { matchesDefId } from '../domain/utils';
import { getFactionCards, getCardDef, getBaseDef } from '../data/cards';
import { registerTrigger, registerProtection } from '../domain/ongoingEffects';
import type { TriggerContext, ProtectionCheckContext } from '../domain/ongoingEffects';
import { getPlayerEffectivePowerOnBase, getScoringEligibleBaseIndices } from '../domain/ongoingModifiers';
import { getSmashUpReactionWindowContext } from '../domain/reactionWindowState';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import type { MatchState, PlayerId } from '../../../engine/types';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';

/** 注册远古之物派系所有能力*/
function getOrderedOpponentIds(state: SmashUpCore, playerId: string): string[] {
    const self = String(playerId);
    const seen = new Set<string>();
    const ordered: string[] = [];

    for (const rawPid of state.turnOrder as unknown[]) {
        const pid = String(rawPid);
        if (pid === self) continue;
        if (seen.has(pid)) continue;
        if (!state.players[pid]) continue;
        seen.add(pid);
        ordered.push(pid);
    }

    if (ordered.length > 0) return ordered;
    return Object.keys(state.players).filter(pid => pid !== self);
}

type ElderThingPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    cardUid: string;
};

type ElderThingMiGoPromptContext = ElderThingPromptContext & {
    opponents: string[];
    opponentIdx: number;
};

type ElderThingBeginTheSummoningPromptContext = ElderThingPromptContext;

type ElderThingUnfathomableGoalsPromptContext = ElderThingPromptContext & {
    opponents: string[];
    opponentIdx: number;
};

type ElderThingSelfDestroyChoice = {
    minionUid: string;
    baseIndex: number;
    defId: string;
};

type ElderThingOnPlayPromptContext = ElderThingPromptContext & {
    elderThingDefId: string;
    baseIndex: number;
};

type ElderThingDestroySecondPromptContext = ElderThingOnPlayPromptContext & {
    firstTarget: ElderThingSelfDestroyChoice;
};

type ElderThingShoggothPromptContext = ElderThingPromptContext & {
    casterPlayerId: PlayerId;
    baseIndex: number;
    opponents: string[];
    opponentIdx: number;
};

type ElderThingShoggothDestroyPromptContext = ElderThingShoggothPromptContext & {
    targetPlayerId: PlayerId;
};

type ElderThingPodModePromptContext = ElderThingPromptContext & {
    baseIndex: number;
};

type ElderThingShoggothPodPromptContext = ElderThingPromptContext & {
    casterPlayerId: PlayerId;
    baseIndex: number;
    opponents: string[];
    opponentIdx: number;
    decliners: PlayerId[];
};

type ElderThingShoggothPodDestroyPromptContext = ElderThingShoggothPodPromptContext & {
    declinerIdx: number;
};

type ElderThingMiGoPodPromptContext = ElderThingPromptContext & {
    casterPlayerId: PlayerId;
    baseIndex: number;
    opponents: string[];
    opponentIdx: number;
    anyDrew: boolean;
    declinedCount: number;
};

type ElderThingBeginTheSummoningPodPromptContext = ElderThingPromptContext;

type ElderThingSpreadingHorrorPodOpponentPromptContext = ElderThingPromptContext & {
    casterPlayerId: PlayerId;
    opponents: string[];
    idx: number;
    decliners: PlayerId[];
};

type ElderThingSpreadingHorrorPodMayPlayPromptContext = ElderThingPromptContext & {
    casterPlayerId: PlayerId;
    remaining: number;
    usedBases: number[];
};

type ElderThingSpreadingHorrorPodChooseBasePromptContext = ElderThingSpreadingHorrorPodMayPlayPromptContext;

type ElderThingSpreadingHorrorPodChooseMinionPromptContext = ElderThingSpreadingHorrorPodMayPlayPromptContext & {
    chosenBaseIndex: number;
};

type ElderThingPowerOfMadnessPodPromptContext = ElderThingPromptContext & {
    opponents: string[];
    idx: number;
};

type ElderThingPriceOfPowerPodChooseBasePromptContext = ElderThingPromptContext & {
    perMadnessCounterAmount: number;
};

type ElderThingDunwichHorrorPodChoicePromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    baseIndex: number;
    minionUid: string;
    minionDefId: string;
    ownerId: string;
};

function attachOptionsGenerator<T>(
    interaction: InteractionDescriptor<T>,
    optionsGenerator: (state: MatchState<SmashUpCore>) => unknown[],
): InteractionDescriptor<T> {
    return {
        ...interaction,
        data: {
            ...(interaction.data ?? {}),
            optionsGenerator,
        },
    };
}

function buildDiscardMinionCardOptions(state: SmashUpCore, playerId: PlayerId) {
    const player = state.players[playerId];
    return player.discard
        .filter(c => c.type === 'minion')
        .map((c, index) => {
            const def = getCardDef(c.defId);
            const name = def?.name ?? c.defId;
            return {
                id: `card-${index}`,
                label: name,
                value: { cardUid: c.uid, defId: c.defId },
                _source: 'discard' as const,
                displayMode: 'card' as const,
            };
        });
}

function getSelectedCard(value: unknown): { cardUid: string; defId: string } | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as { cardUid?: unknown; defId?: unknown };
    if (typeof record.cardUid !== 'string' || typeof record.defId !== 'string') return null;
    return { cardUid: record.cardUid, defId: record.defId };
}

function collectOpponentMinions(
    state: SmashUpCore,
    playerId: PlayerId,
): Array<{ uid: string; defId: string; baseIndex: number; owner: string; power: number }> {
    const minions: Array<{ uid: string; defId: string; baseIndex: number; owner: string; power: number }> = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        for (const minion of state.bases[baseIndex].minions) {
            if (minion.controller !== playerId) continue;
            minions.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                owner: minion.owner,
                power: getMinionPower(state, minion, baseIndex),
            });
        }
    }
    return minions;
}

function buildUnfathomableGoalsOptions(
    state: SmashUpCore,
    playerId: PlayerId,
) {
    return collectOpponentMinions(state, playerId).map((minion) => {
        const def = getCardDef(minion.defId) as MinionCardDef | undefined;
        const name = def?.name ?? minion.defId;
        const baseDef = getBaseDef(state.bases[minion.baseIndex].defId);
        const baseName = baseDef?.name ?? `基地 ${minion.baseIndex + 1}`;
        return {
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: minion.baseIndex,
            label: `${name} (力量 ${minion.power}) @ ${baseName}`,
        };
    });
}

function buildUnfathomableGoalsTargetOptions(
    state: SmashUpCore,
    targetPlayerId: PlayerId,
    sourcePlayerId: PlayerId,
) {
    return buildMinionTargetOptions(
        buildUnfathomableGoalsOptions(state, targetPlayerId),
        {
            state,
            sourcePlayerId,
            sourceDefId: 'elder_thing_unfathomable_goals',
            effectType: 'destroy',
        },
    );
}

function collectUnfathomableGoalsDestroyableMinions(
    state: SmashUpCore,
    targetPlayerId: PlayerId,
    sourcePlayerId: PlayerId,
): Array<{ uid: string; defId: string; baseIndex: number; owner: string; power: number }> {
    const allowedUids = new Set(
        buildUnfathomableGoalsTargetOptions(state, targetPlayerId, sourcePlayerId)
            .map((option) => option.value.minionUid),
    );
    return collectOpponentMinions(state, targetPlayerId)
        .filter((minion) => allowedUids.has(minion.uid));
}

function createElderThingPromptContext<TExtra extends Record<string, unknown>>(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    extra: TExtra,
): ElderThingPromptContext & TExtra {
    return {
        matchState,
        playerId,
        now,
        cardUid: typeof extra.cardUid === 'string' ? extra.cardUid : '',
        ...extra,
    };
}

function collectFriendlyOtherMinions(
    state: SmashUpCore,
    playerId: PlayerId,
    elderThingUid: string,
    excludedMinionUids: string[] = [],
): Array<{ uid: string; defId: string; baseIndex: number; owner: string; label: string }> {
    const excluded = new Set(excludedMinionUids);
    const result: Array<{ uid: string; defId: string; baseIndex: number; owner: string; label: string }> = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        for (const minion of state.bases[baseIndex].minions) {
            if (minion.controller !== playerId) continue;
            if (minion.uid === elderThingUid) continue;
            if (excluded.has(minion.uid)) continue;
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            const baseDef = getBaseDef(state.bases[baseIndex].defId);
            result.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                owner: minion.owner,
                label: `${def?.name ?? minion.defId} (力量 ${getMinionPower(state, minion, baseIndex)}) @ ${baseDef?.name ?? `基地 ${baseIndex + 1}`}`,
            });
        }
    }
    return result;
}

function getSelectedMinionChoice(value: unknown): ElderThingSelfDestroyChoice | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as { minionUid?: unknown; baseIndex?: unknown; defId?: unknown };
    if (
        typeof record.minionUid !== 'string'
        || typeof record.baseIndex !== 'number'
        || typeof record.defId !== 'string'
    ) {
        return null;
    }
    return {
        minionUid: record.minionUid,
        baseIndex: record.baseIndex,
        defId: record.defId,
    };
}

function buildElderThingDestroyPromptOptions(
    state: SmashUpCore,
    playerId: PlayerId,
    elderThingUid: string,
    excludedMinionUids: string[] = [],
) {
    return buildMinionTargetOptions(
        collectFriendlyOtherMinions(state, playerId, elderThingUid, excludedMinionUids),
        { state, sourcePlayerId: playerId },
    );
}

function buildShoggothDestroyPromptOptions(
    state: SmashUpCore,
    casterPlayerId: PlayerId,
    targetPlayerId: PlayerId,
    baseIndex: number,
) {
    const base = state.bases[baseIndex];
    if (!base) return [];
    const candidates = base.minions
        .filter((minion) => minion.controller === targetPlayerId)
        .map((minion) => {
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            return {
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: def?.name ?? minion.defId,
            };
        });
    return buildMinionTargetOptions(candidates, {
        state,
        sourcePlayerId: casterPlayerId,
        effectType: 'destroy',
    });
}

function getSelectedMinionChoices(value: unknown): ElderThingSelfDestroyChoice[] {
    const rawSelections = Array.isArray(value) ? value : [value];
    return rawSelections
        .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const record = entry as { minionUid?: unknown; uid?: unknown; baseIndex?: unknown; defId?: unknown };
            const minionUid = typeof record.minionUid === 'string'
                ? record.minionUid
                : typeof record.uid === 'string'
                    ? record.uid
                    : undefined;
            if (!minionUid || typeof record.baseIndex !== 'number' || typeof record.defId !== 'string') {
                return null;
            }
            return {
                minionUid,
                baseIndex: record.baseIndex,
                defId: record.defId,
            } satisfies ElderThingSelfDestroyChoice;
        })
        .filter((entry): entry is ElderThingSelfDestroyChoice => !!entry);
}

function finalizeShoggothPodEvents(
    state: MatchState<SmashUpCore>,
    casterPlayerId: PlayerId,
    baseIndex: number,
    timestamp: number,
) {
    const base = state.core.bases[baseIndex];
    const myPower = base ? getPlayerEffectivePowerOnBase(state.core, base, baseIndex, casterPlayerId) : 0;
    if (myPower >= 12) {
        return [] as SmashUpEvent[];
    }
    const event = drawMadnessCards(casterPlayerId, 2, state.core, 'elder_thing_shoggoth_pod', timestamp);
    return event ? [event] : [];
}

function buildDiscardSmallMinionOptions(
    state: SmashUpCore,
    playerId: PlayerId,
) {
    return state.players[playerId].discard
        .filter((card) => {
            if (card.type !== 'minion') return false;
            const def = getCardDef(card.defId) as MinionCardDef | undefined;
            return (def?.power ?? Infinity) <= 3;
        })
        .map((card, index) => ({
            id: `m-${index}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            displayMode: 'card' as const,
            _source: 'discard' as const,
        }));
}

function buildAvailableBaseOptions(
    state: SmashUpCore,
    usedBases: number[],
) {
    return state.bases
        .map((base, baseIndex) => ({
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
        }))
        .filter((candidate) => !usedBases.includes(candidate.baseIndex));
}

function buildAllMinionAffectOptions(
    state: SmashUpCore,
    sourcePlayerId: PlayerId,
) {
    const candidates = state.bases.flatMap((base, baseIndex) => base.minions.map((minion) => ({
        uid: minion.uid,
        defId: minion.defId,
        baseIndex,
        label: getCardDef(minion.defId)?.name ?? minion.defId,
    })));
    return buildMinionTargetOptions(candidates, {
        state,
        sourcePlayerId,
        effectType: 'affect',
    });
}

function buildPowerOfMadnessPodActionOptions(state: SmashUpCore) {
    const factionIds = new Set<string>();
    for (const player of Object.values(state.players)) {
        const factions = (player as { factions?: [string, string] }).factions;
        if (!factions) continue;
        factionIds.add(factions[0]);
        factionIds.add(factions[1]);
    }

    const actionDefIds = new Set<string>();
    for (const factionId of factionIds) {
        for (const def of getFactionCards(factionId as never)) {
            if (def.type !== 'action') continue;
            actionDefIds.add(def.id);
        }
    }
    actionDefIds.add(MADNESS_CARD_DEF_ID);

    return Array.from(actionDefIds)
        .sort((left, right) => (getCardDef(left)?.name ?? left).localeCompare(getCardDef(right)?.name ?? right, 'zh-CN'))
        .map((defId, index) => ({
            id: `a-${index}`,
            label: getCardDef(defId)?.name ?? defId,
            value: { defId },
            displayMode: 'button' as const,
        }));
}

const elderThingMiGoPromptProgram = createPromptProgram<ElderThingMiGoPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_mi_go',
    buildInteraction: (context) => {
        const currentOpponent = context.opponents[context.opponentIdx];
        return createAbilityRuntimeSimpleChoice(
            `elder_thing_mi_go_${currentOpponent}_${context.now}`,
            currentOpponent,
            '米-格：你可以抽一张疯狂卡，否则对方抽一张牌',
            [
                { id: 'draw_madness', label: '抽一张疯狂卡', labelKey: 'ui.elder_thing_draw_madness_option', value: { choice: 'draw_madness' }, displayMode: 'button' as const },
                { id: 'decline', label: '拒绝（让对方抽一张牌）', labelKey: 'ui.elder_thing_mi_go_decline_draw_option', value: { choice: 'decline' }, displayMode: 'button' as const },
            ],
            { sourceId: 'elder_thing_mi_go', targetType: 'button', titleKey: 'ui.elder_thing_mi_go_title' },
        );
    },
    onResolve: (args) => {
        const { context, value, timestamp } = args;
        const choice = (value as { choice?: string } | undefined)?.choice;
        const currentOpponent = context.opponents[context.opponentIdx];
        const events: SmashUpEvent[] = [];

        if (choice === 'draw_madness') {
            const evt = drawMadnessCards(currentOpponent, 1, context.matchState.core, 'elder_thing_mi_go', timestamp);
            if (evt) events.push(evt);
        } else {
            events.push(...buildStandardDrawEventsFromRuntimeContext({ ...args, state: context.matchState }, context.playerId, 1));
        }

        const nextIdx = context.opponentIdx + 1;
        if (nextIdx >= context.opponents.length) {
            return { events };
        }

        return {
            events,
            context: {
                ...context,
                opponentIdx: nextIdx,
            },
            nextProgram: elderThingMiGoPromptProgram,
        };
    },
});

const elderThingMiGoProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const opponents = getOrderedOpponentIds(ctx.state, ctx.playerId);
    if (opponents.length === 0) {
        return { events: [] };
    }
    return {
        events: [],
        context: {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            cardUid: ctx.cardUid,
            opponents,
            opponentIdx: 0,
        } satisfies ElderThingMiGoPromptContext,
        nextProgram: elderThingMiGoPromptProgram,
    };
});

const elderThingBeginTheSummoningPromptProgram = createPromptProgram<ElderThingBeginTheSummoningPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_begin_the_summoning',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `elder_thing_begin_the_summoning_${context.now}`,
            context.playerId,
            '选择要放到牌库顶的随从',
            buildDiscardMinionCardOptions(context.matchState.core, context.playerId),
            {
                sourceId: 'elder_thing_begin_the_summoning',
                titleKey: 'ui.elder_thing_begin_the_summoning_title',
                targetType: 'generic',
                autoRefresh: 'discard',
                responseValidationMode: 'live',
            },
        );
        return attachOptionsGenerator(interaction, (state) => buildDiscardMinionCardOptions(state.core, context.playerId));
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = getSelectedCard(value);
        if (!selected) {
            return { events: [] };
        }
        const player = state.core.players[context.playerId];
        const inDiscard = player.discard.find((card) => card.uid === selected.cardUid && card.type === 'minion');
        if (!inDiscard) {
            return { events: [] };
        }
        return {
            events: [
                {
                    type: SU_EVENTS.CARD_TO_DECK_TOP,
                    payload: {
                        cardUid: selected.cardUid,
                        defId: selected.defId,
                        ownerId: inDiscard.owner,
                        sourcePlayerId: context.playerId,
                        reason: 'elder_thing_begin_the_summoning',
                    },
                    timestamp,
                } as SmashUpEvent,
                grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: state }, 'elder_thing_begin_the_summoning'),
            ],
        };
    },
});

const elderThingBeginTheSummoningProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const player = ctx.state.players[ctx.playerId];
    const minionsInDiscard = player.discard.filter(c => c.type === 'minion');
    if (minionsInDiscard.length === 0) {
        return {
            events: [
                buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now),
                grantContextualExtraAction(ctx, 'elder_thing_begin_the_summoning'),
            ],
        };
    }
    return {
        events: [],
        context: {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            cardUid: ctx.cardUid,
        } satisfies ElderThingBeginTheSummoningPromptContext,
        nextProgram: elderThingBeginTheSummoningPromptProgram,
    };
});

const elderThingUnfathomableGoalsScanProgram = createEffectProgram<ElderThingUnfathomableGoalsPromptContext, SmashUpCore, SmashUpEvent>((context) => {
    const events: SmashUpEvent[] = [];
    let nextIdx = context.opponentIdx;

    while (nextIdx < context.opponents.length) {
        const opponentId = context.opponents[nextIdx];
        const opponentMinions = collectUnfathomableGoalsDestroyableMinions(
            context.matchState.core,
            opponentId,
            context.playerId,
        );

        if (opponentMinions.length === 0) {
            nextIdx += 1;
            continue;
        }

        if (opponentMinions.length === 1) {
            const target = opponentMinions[0];
            events.push(...buildValidatedDestroyEvents(context.matchState, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: target.baseIndex,
                destroyerId: context.playerId,
                reason: 'elder_thing_unfathomable_goals',
                now: context.now,
                sourcePlayerId: context.playerId,
                sourceCardUid: context.cardUid,
                sourceDefId: 'elder_thing_unfathomable_goals',
                sourceControllerId: context.playerId,
                sourceBaseIndex: target.baseIndex,
                sourceKind: 'action',
            }));
            nextIdx += 1;
            continue;
        }

        return {
            events,
            context: {
                ...context,
                opponentIdx: nextIdx,
            },
            nextProgram: elderThingUnfathomableGoalsPromptProgram,
        };
    }

    return { events };
});

const elderThingUnfathomableGoalsPromptProgram = createPromptProgram<ElderThingUnfathomableGoalsPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_unfathomable_goals',
    buildInteraction: (context) => {
        const opponentId = context.opponents[context.opponentIdx];
        const interaction = createAbilityRuntimeSimpleChoice(
            `elder_thing_unfathomable_goals_${opponentId}_${context.now}`,
            opponentId,
            '你手中有疯狂卡，必须消灭一个自己的随从',
            buildUnfathomableGoalsTargetOptions(context.matchState.core, opponentId, context.playerId),
            {
                sourceId: 'elder_thing_unfathomable_goals',
                targetType: 'minion',
                titleKey: 'ui.elder_thing_unfathomable_goals_title',
            },
        );
        return attachOptionsGenerator(
            interaction,
            (state) => buildUnfathomableGoalsTargetOptions(state.core, opponentId, context.playerId),
        );
    },
    onResolve: ({ context, value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }

        const base = context.matchState.core.bases[selected.baseIndex];
        const target = base?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!target) {
            return { events: [] };
        }

        return {
            events: buildValidatedDestroyEvents(context.matchState, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: context.playerId,
                reason: 'elder_thing_unfathomable_goals',
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceCardUid: context.cardUid,
                sourceDefId: 'elder_thing_unfathomable_goals',
                sourceControllerId: context.playerId,
                sourceBaseIndex: selected.baseIndex,
                sourceKind: 'action',
            }),
            context: {
                ...context,
                opponentIdx: context.opponentIdx + 1,
            },
            nextProgram: elderThingUnfathomableGoalsScanProgram,
        };
    },
});

const elderThingUnfathomableGoalsProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const events: SmashUpEvent[] = [];
    const allRevealCards: { uid: string; defId: string }[] = [];
    const revealTargetIds: string[] = [];

    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const opponent = ctx.state.players[pid];
        if (opponent.hand.length > 0) {
            revealTargetIds.push(pid);
            for (const card of opponent.hand) {
                allRevealCards.push({ uid: card.uid, defId: card.defId });
            }
        }
    }

    if (allRevealCards.length > 0) {
        const targetIds = revealTargetIds.length === 1 ? revealTargetIds[0] : revealTargetIds;
        events.push(revealHand(targetIds, 'all', allRevealCards, 'elder_thing_unfathomable_goals', ctx.now, ctx.playerId));
    }

    const opponentsWithMadness = ctx.state.turnOrder.filter((pid) => (
        pid !== ctx.playerId && ctx.state.players[pid].hand.some((card) => card.defId === MADNESS_CARD_DEF_ID)
    ));

    if (opponentsWithMadness.length === 0) {
        return { events };
    }

    return {
        events,
        context: {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            cardUid: ctx.cardUid,
            opponents: opponentsWithMadness,
            opponentIdx: 0,
        } satisfies ElderThingUnfathomableGoalsPromptContext,
        nextProgram: elderThingUnfathomableGoalsScanProgram,
    };
});

export function registerElderThingAbilities(): void {
    // 拜亚基 onPlay：每位在这里有随从的其他玩家各抽一张疯狂卡
    registerAbility('elder_thing_byakhee', 'onPlay', elderThingByakhee);
    // ??onPlay：每个对手可抽疯狂卡，不收回抽的让你抽一张牌（MVP：对手全部抽疯狂卡）
    registerAbilityProgram('elder_thing_mi_go', 'onPlay', { program: elderThingMiGoProgram });
    // 精神错乱（行动卡）：每个对手抽两张疯狂卡
    registerAbility('elder_thing_insanity', 'onPlay', elderThingInsanity);
    // 疯狂接触（行动卡）：每个对手抽一张疯狂卡，你抽一张牌并额外打出一张行动
    registerAbility('elder_thing_touch_of_madness', 'onPlay', elderThingTouchOfMadness);
    // 疯狂之力（行动卡）：所有对手弃掉手牌中的疯狂卡并洗弃牌堆回牌库
    registerAbility('elder_thing_power_of_madness', 'onPlay', elderThingPowerOfMadness);
    // 散播恐怖（行动卡）：每位对手随机弃牌直到弃出非疯狂卡?
    registerAbility('elder_thing_spreading_horror', 'onPlay', elderThingSpreadingHorror);
    // 开始召唤（行动卡）：弃牌堆随从放牌库顶 + 额外行动
    registerAbilityProgram('elder_thing_begin_the_summoning', 'onPlay', { program: elderThingBeginTheSummoningProgram });
    // 深不收回可测的目的（行动卡）：对手展示手牌，有疯狂卡的必须消灭一个随从
    registerAbilityProgram('elder_thing_unfathomable_goals', 'onPlay', { program: elderThingUnfathomableGoalsProgram });

    // 远古之物 onPlay：消灭两个己方随从或放牌库底 + 不收回受对手影响
    registerAbilityProgram('elder_thing_elder_thing', 'onPlay', { program: elderThingElderThingProgram });
    // 修格斯?onPlay：对手选择抽疯狂卡或被消灭随从
    registerAbilityProgram('elder_thing_shoggoth', 'onPlay', { program: elderThingShoggothProgram });

    // === POD 版本 ===
    registerAbilityProgram('elder_thing_elder_thing_pod', 'onPlay', { program: elderThingElderThingPodProgram });
    registerAbilityProgram('elder_thing_shoggoth_pod', 'onPlay', { program: elderThingShoggothPodProgram });
    registerAbilityProgram('elder_thing_mi_go_pod', 'onPlay', { program: elderThingMiGoPodProgram });
    registerAbility('elder_thing_byakhee_pod', 'onPlay', elderThingByakheePod);

    registerAbilityProgram('elder_thing_begin_the_summoning_pod', 'onPlay', { program: elderThingBeginTheSummoningPodProgram });
    registerAbilityProgram('elder_thing_the_price_of_power_pod', 'onPlay', { program: elderThingPriceOfPowerPodOnPlayProgram });
    registerAbility('elder_thing_insanity_pod', 'onPlay', elderThingInsanityPod);
    registerAbilityProgram('elder_thing_power_of_madness_pod', 'onPlay', { program: elderThingPowerOfMadnessPodProgram });
    registerAbilityProgram('elder_thing_spreading_horror_pod', 'onPlay', { program: elderThingSpreadingHorrorPodProgram });
    registerAbility('elder_thing_the_price_of_power_pod', 'special', elderThingPriceOfPowerPodSpecial);
    registerAbility('elder_thing_unfathomable_goals_pod', 'onPlay', elderThingUnfathomableGoalsPod);
    registerAbility('elder_thing_touch_of_madness_pod', 'onPlay', elderThingTouchOfMadnessPod);

    // Dunwich Horror POD：before scoring trigger (mandatory)
    registerTrigger('elder_thing_dunwich_horror_pod', 'beforeScoring', elderThingDunwichHorrorPodBeforeScoring, {
        mandatory: true,
        perInstance: true,
        playerContext: 'sourceHostController',
    });
    // POD 版不会“回合结束自动消灭”，这里显式注册 no-op，阻止 alias 继承原版 onTurnEnd 触发。
    registerTrigger('elder_thing_dunwich_horror_pod', 'onTurnEnd', elderThingDunwichHorrorPodOnTurnEndNoop, {
    });

    // 远古之物 POD：不受对手卡牌影响
    registerProtection('elder_thing_elder_thing_pod', 'destroy', elderThingPodProtectionChecker);
    registerProtection('elder_thing_elder_thing_pod', 'move', elderThingPodProtectionChecker);
    registerProtection('elder_thing_elder_thing_pod', 'affect', elderThingPodProtectionChecker);

    // === ongoing 效果注册 ===
    // 郦威奇恐怖：回合结束时消灭附着了此卡的随从
    registerTrigger('elder_thing_dunwich_horror', 'onTurnEnd', elderThingDunwichHorrorTrigger, {
        playerContext: 'sourceController',
    });
    // 力量的代价：基地计分前按对手疑狂卡数给己方随从力量
    registerAbility('elder_thing_the_price_of_power', 'special', elderThingPriceOfPowerSpecial);
    // 远古之物：不收回受对手卡牌影响（保护 destroy + move?
    registerProtection('elder_thing_elder_thing', 'destroy', elderThingProtectionChecker);
    registerProtection('elder_thing_elder_thing', 'move', elderThingProtectionChecker);
    registerProtection('elder_thing_elder_thing', 'affect', elderThingProtectionChecker);
}

/** 拜亚基 onPlay：每位在这里有随从的其他玩家各抽一张疯狂卡 */
function elderThingByakhee(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };

    const events: SmashUpEvent[] = [];
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        if (!base.minions.some(m => m.controller === pid)) continue;
        const evt = drawMadnessCards(pid, 1, ctx.state, 'elder_thing_byakhee', ctx.now);
        if (evt) events.push(evt);
    }
    return { events };
}

/** 精神错乱 onPlay：每个对手抽两张疯狂卡?*/
function elderThingInsanity(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const evt = drawMadnessCards(pid, 2, ctx.state, 'elder_thing_insanity', ctx.now);
        if (evt) events.push(evt);
    }
    return { events };
}

/** 疯狂接触 onPlay：每个对手抽一张疯狂卡，你抽一张牌并额外打出一张行动*/
function elderThingTouchOfMadness(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];

    // 对手各抽一张疯狂卡
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const evt = drawMadnessCards(pid, 1, ctx.state, 'elder_thing_touch_of_madness', ctx.now);
        if (evt) events.push(evt);
    }

    // 你抽一张牌
    events.push(...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now));

    // 额外打出一张行动
    events.push(grantContextualExtraAction(ctx, 'elder_thing_touch_of_madness'));

    return { events };
}

/** 疯狂之力 onPlay：所有对手展示手牌，弃掉手牌中的疯狂卡并洗弃牌堆回牌库 */
function elderThingPowerOfMadness(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];

    // 收集所有对手的手牌用于合并展示（避免多人时多次展示覆盖）
    const allRevealCards: { uid: string; defId: string }[] = [];
    const revealTargetIds: string[] = [];

    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const opponent = ctx.state.players[pid];

        // 收集对手手牌（规则："所有其他玩家展示他们的手牌"）
        if (opponent.hand.length > 0) {
            revealTargetIds.push(pid);
            for (const c of opponent.hand) {
                allRevealCards.push({ uid: c.uid, defId: c.defId });
            }
        }

        // 找出手牌中的疯狂卡
        const madnessInHand = opponent.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID);
        if (madnessInHand.length > 0) {
            const discardEvt: CardsDiscardedEvent = {
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: pid, cardUids: madnessInHand.map(c => c.uid) },
                timestamp: ctx.now,
            };
            events.push(discardEvt);
        }

        // 洗弃牌堆回牌库（包括刚弃掉的疯狂卡）
        const allDiscardCards = [...opponent.discard, ...madnessInHand];
        if (allDiscardCards.length > 0) {
            const newDeck = ctx.random.shuffle([...opponent.deck, ...allDiscardCards]);
            const reshuffleEvt: DeckReshuffledEvent = {
                type: SU_EVENTS.DECK_RESHUFFLED,
                payload: { playerId: pid, deckUids: newDeck.map(c => c.uid) },
                timestamp: ctx.now,
            };
            events.push(reshuffleEvt);
        }
    }

    // 合并展示所有对手手牌（一个事件，避免多人覆盖）
    if (allRevealCards.length > 0) {
        const targetIds = revealTargetIds.length === 1 ? revealTargetIds[0] : revealTargetIds;
        events.unshift(revealHand(targetIds, 'all', allRevealCards, 'elder_thing_power_of_madness', ctx.now, ctx.playerId));
    }

    return { events };
}


/** 散播恐惧?onPlay：每位对手随机弃牌直到弃出一张非疯狂卡?*/
function elderThingSpreadingHorror(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];

    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const opponent = ctx.state.players[pid];
        if (opponent.hand.length === 0) continue;

        // 随机排列手牌，依次弃掉直到弃出非疯狂卡?
        const shuffledHand = ctx.random.shuffle([...opponent.hand]);
        const discardUids: string[] = [];
        for (const card of shuffledHand) {
            discardUids.push(card.uid);
            if (card.defId !== MADNESS_CARD_DEF_ID) break; // 弃出非疯狂卡，停止?
        }

        if (discardUids.length > 0) {
            const discardEvt: CardsDiscardedEvent = {
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: pid, cardUids: discardUids },
                timestamp: ctx.now,
            };
            events.push(discardEvt);
        }
    }

    return { events };
}

// ============================================================================
// 远古之物 (Elder Thing) - onPlay + 保护
// ============================================================================

/** 远古之物保护检查：不收回受对手卡牌影响 */
function elderThingProtectionChecker(ctx: ProtectionCheckContext): boolean {
    // 只保护?elder_thing_elder_thing 自身，且只拦截对手发起的效果
    if (!matchesDefId(ctx.targetMinion.defId, 'elder_thing_elder_thing')) return false;
    return ctx.sourcePlayerId !== ctx.targetMinion.controller;
}

function elderThingPodProtectionChecker(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    return ctx.targetMinion.defId === 'elder_thing_elder_thing_pod';
}

// ============================================================================
// POD implementations
// ============================================================================

function elderThingByakheePod(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const events: SmashUpEvent[] = [];
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        if (!base.minions.some(m => m.controller === pid)) continue;
        const evt = drawMadnessCards(pid, 1, ctx.state, 'elder_thing_byakhee_pod', ctx.now);
        if (evt) events.push(evt);
    }
    return { events };
}

type PodYesNoChoiceValue = { choice: 'yes' } | { choice: 'no' };

function getNextMiGoPodContext(
    context: ElderThingMiGoPodPromptContext,
    state: MatchState<SmashUpCore>,
    timestamp: number,
): ElderThingMiGoPodPromptContext | null {
    const nextIdx = context.opponentIdx + 1;
    if (nextIdx >= context.opponents.length) return null;
    return createElderThingPromptContext(state, context.playerId, timestamp, {
        cardUid: context.cardUid,
        casterPlayerId: context.casterPlayerId,
        baseIndex: context.baseIndex,
        opponents: context.opponents,
        opponentIdx: nextIdx,
        anyDrew: context.anyDrew,
        declinedCount: context.declinedCount,
    }) satisfies ElderThingMiGoPodPromptContext;
}

const elderThingMiGoPodCounterPromptProgram = createPromptProgram<ElderThingMiGoPodPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_mi_go_pod_counter',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `elder_thing_mi_go_pod_counter_${context.now}`,
            context.casterPlayerId,
            '米-格：你可以在一个随从上放置+1战斗力指示物',
            [
                { id: 'skip', label: '跳过', labelKey: 'ui.skip', value: { skip: true }, displayMode: 'button' as const },
                ...buildAllMinionAffectOptions(context.matchState.core, context.casterPlayerId),
            ],
            { sourceId: 'elder_thing_mi_go_pod_counter', targetType: 'minion', titleKey: 'ui.elder_thing_mi_go_pod_counter_title' },
        );
        interaction.data.optionsGenerator = (state) => [
            { id: 'skip', label: '跳过', labelKey: 'ui.skip', value: { skip: true }, displayMode: 'button' as const },
            ...buildAllMinionAffectOptions(state.core as SmashUpCore, context.casterPlayerId),
        ];
        return interaction;
    },
    onResolve: ({ value, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        return {
            events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'elder_thing_mi_go_pod', timestamp)],
        };
    },
});

const elderThingMiGoPodPromptProgram = createPromptProgram<ElderThingMiGoPodPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_mi_go_pod',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `elder_thing_mi_go_pod_${context.opponents[context.opponentIdx]}_${context.now}`,
        context.opponents[context.opponentIdx],
        '米-格：你可以抽一张疯狂卡',
        [
            { id: 'yes', label: '抽一张疯狂卡', labelKey: 'ui.elder_thing_draw_madness_option', value: { choice: 'yes' } satisfies PodYesNoChoiceValue, displayMode: 'button' as const },
            { id: 'no', label: '不抽', labelKey: 'ui.elder_thing_no_draw_option', value: { choice: 'no' } satisfies PodYesNoChoiceValue, displayMode: 'button' as const },
        ],
        { sourceId: 'elder_thing_mi_go_pod', targetType: 'button', titleKey: 'ui.elder_thing_mi_go_pod_title' },
    ),
    onResolve: (args) => {
        const { context, state, value, timestamp } = args;
        const choice = (value as PodYesNoChoiceValue | undefined)?.choice;
        const opponent = context.opponents[context.opponentIdx];
        const events: SmashUpEvent[] = [];
        let nextContext = context;

        if (choice === 'yes') {
            const evt = drawMadnessCards(opponent, 1, state.core, 'elder_thing_mi_go_pod', timestamp);
            if (evt) events.push(evt);
            nextContext = { ...context, anyDrew: true };
        } else {
            events.push(...buildStandardDrawEventsFromRuntimeContext(args, context.casterPlayerId, 1));
            nextContext = { ...context, declinedCount: context.declinedCount + 1 };
        }

        const pendingContext = getNextMiGoPodContext(nextContext, state, timestamp);
        if (pendingContext) {
            return { events, context: pendingContext, nextProgram: elderThingMiGoPodPromptProgram };
        }

        if (!nextContext.anyDrew && buildAllMinionAffectOptions(state.core, nextContext.casterPlayerId).length > 0) {
            return { events, context: nextContext, nextProgram: elderThingMiGoPodCounterPromptProgram };
        }

        return { events };
    },
});

const elderThingMiGoPodProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const opponents = getOrderedOpponentIds(ctx.state, ctx.playerId);
    if (opponents.length === 0) return { events: [] };
    return {
        events: [],
        context: createElderThingPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            cardUid: ctx.cardUid,
            casterPlayerId: ctx.playerId,
            baseIndex: ctx.baseIndex,
            opponents,
            opponentIdx: 0,
            anyDrew: false,
            declinedCount: 0,
        }) satisfies ElderThingMiGoPodPromptContext,
        nextProgram: elderThingMiGoPodPromptProgram,
    };
});

const elderThingElderThingPodDestroyPromptProgram = createPromptProgram<ElderThingPodModePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_elder_thing_pod_destroy',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `elder_thing_elder_thing_pod_destroy_${context.now}`,
            context.playerId,
            '远古之物：选择要消灭的两个你的其他随从',
            buildElderThingDestroyPromptOptions(context.matchState.core, context.playerId, context.cardUid),
            {
                sourceId: 'elder_thing_elder_thing_pod_destroy',
                titleKey: 'ui.elder_thing_elder_thing_pod_destroy_title',
                targetType: 'minion',
                multi: { min: 2, max: 2 },
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = (state) => buildElderThingDestroyPromptOptions(
            state.core as SmashUpCore,
            context.playerId,
            context.cardUid,
        );
        return interaction;
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const picks = getSelectedMinionChoices(value).slice(0, 2);
        if (picks.length < 2) {
            return { events: [] };
        }

        const sourceOwnerId = findMinionOnBases(state.core, context.cardUid)?.minion.owner ?? context.playerId;
        const destroyEvents: SmashUpEvent[] = [];
        for (const pick of picks) {
            const minion = state.core.bases[pick.baseIndex]?.minions.find((candidate) => candidate.uid === pick.minionUid);
            if (!minion) continue;
            destroyEvents.push(...buildValidatedDestroyEvents(state, {
                minionUid: pick.minionUid,
                minionDefId: pick.defId,
                fromBaseIndex: pick.baseIndex,
                destroyerId: context.playerId,
                sourcePlayerId: context.playerId,
                sourceCardUid: context.cardUid,
                sourceDefId: 'elder_thing_elder_thing_pod',
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.baseIndex,
                reason: 'elder_thing_elder_thing_pod',
                now: timestamp,
            }));
        }

        const destroyCount = destroyEvents.filter((event) => event.type === SU_EVENTS.MINION_DESTROYED).length;
        if (destroyCount < 2) {
            return {
                events: [
                    ...destroyEvents,
                    ...buildValidatedCardToDeckBottomEvents(state, {
                        cardUid: context.cardUid,
                        defId: 'elder_thing_elder_thing_pod',
                        ownerId: sourceOwnerId,
                        sourcePlayerId: context.playerId,
                        sourceCardUid: context.cardUid,
                        sourceDefId: 'elder_thing_elder_thing_pod',
                        sourceControllerId: context.playerId,
                        sourceBaseIndex: context.baseIndex,
                        reason: 'elder_thing_elder_thing_pod_fallback',
                        now: timestamp,
                        expectedLocation: 'bases',
                    }),
                ],
            };
        }

        return { events: destroyEvents };
    },
});

const elderThingElderThingPodModePromptProgram = createPromptProgram<ElderThingPodModePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_elder_thing_pod_mode',
    buildInteraction: (context) => {
        const canDestroy = collectFriendlyOtherMinions(
            context.matchState.core,
            context.playerId,
            context.cardUid,
        ).length >= 2;
        return createAbilityRuntimeSimpleChoice(
            `elder_thing_elder_thing_pod_mode_${context.now}`,
            context.playerId,
            '远古之物：消灭两个你的其他随从，否则将其放到牌库底',
            [
                {
                    id: 'destroy',
                    label: '消灭两个你的其他随从',
                    labelKey: canDestroy ? 'ui.elder_thing_destroy_two_other_minions_option' : 'ui.elder_thing_destroy_two_other_minions_disabled_option',
                    value: { mode: 'destroy' },
                    displayMode: 'button' as const,
                    disabled: !canDestroy,
                },
                {
                    id: 'bottom',
                    label: '将本随从放到牌库底',
                    labelKey: 'ui.elder_thing_put_this_minion_on_bottom_option',
                    value: { mode: 'bottom' },
                    displayMode: 'button' as const,
                },
            ],
            {
                sourceId: 'elder_thing_elder_thing_pod_mode',
                targetType: 'button',
                titleKey: 'ui.elder_thing_elder_thing_pod_mode_title',
                displayCard: { defId: 'elder_thing_elder_thing_pod', cardUid: context.cardUid },
            },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const sourceOwnerId = findMinionOnBases(state.core, context.cardUid)?.minion.owner ?? context.playerId;
        const mode = (value as { mode?: 'destroy' | 'bottom' } | undefined)?.mode;
        if (mode === 'bottom') {
            return {
                events: buildValidatedCardToDeckBottomEvents(state, {
                    cardUid: context.cardUid,
                    defId: 'elder_thing_elder_thing_pod',
                    ownerId: sourceOwnerId,
                    sourcePlayerId: context.playerId,
                    sourceCardUid: context.cardUid,
                    sourceDefId: 'elder_thing_elder_thing_pod',
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.baseIndex,
                    reason: 'elder_thing_elder_thing_pod',
                    now: timestamp,
                    expectedLocation: 'bases',
                }),
            };
        }

        const canDestroy = collectFriendlyOtherMinions(state.core, context.playerId, context.cardUid).length >= 2;
        if (!canDestroy) {
            return {
                events: buildValidatedCardToDeckBottomEvents(state, {
                    cardUid: context.cardUid,
                    defId: 'elder_thing_elder_thing_pod',
                    ownerId: sourceOwnerId,
                    sourcePlayerId: context.playerId,
                    sourceCardUid: context.cardUid,
                    sourceDefId: 'elder_thing_elder_thing_pod',
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.baseIndex,
                    reason: 'elder_thing_elder_thing_pod_forced',
                    now: timestamp,
                    expectedLocation: 'bases',
                }),
            };
        }

        return {
            events: [],
            context,
            nextProgram: elderThingElderThingPodDestroyPromptProgram,
        };
    },
});

const elderThingElderThingPodProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => ({
    events: [],
    context: createElderThingPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        cardUid: ctx.cardUid,
        baseIndex: ctx.baseIndex,
    }) satisfies ElderThingPodModePromptContext,
    nextProgram: elderThingElderThingPodModePromptProgram,
}));

function getNextShoggothPodPromptContext(
    context: ElderThingShoggothPodPromptContext,
    state: MatchState<SmashUpCore>,
    timestamp: number,
): ElderThingShoggothPodPromptContext | null {
    const nextIdx = context.opponentIdx + 1;
    if (nextIdx >= context.opponents.length) {
        return null;
    }
    return createElderThingPromptContext(state, context.playerId, timestamp, {
        cardUid: context.cardUid,
        casterPlayerId: context.casterPlayerId,
        baseIndex: context.baseIndex,
        opponents: context.opponents,
        opponentIdx: nextIdx,
        decliners: context.decliners,
    }) satisfies ElderThingShoggothPodPromptContext;
}

function getNextShoggothPodDeclinerContext(
    context: ElderThingShoggothPodDestroyPromptContext,
    state: MatchState<SmashUpCore>,
    timestamp: number,
): ElderThingShoggothPodDestroyPromptContext | null {
    const nextDeclinerIdx = context.declinerIdx + 1;
    if (nextDeclinerIdx >= context.decliners.length) {
        return null;
    }
    return createElderThingPromptContext(state, context.playerId, timestamp, {
        cardUid: context.cardUid,
        casterPlayerId: context.casterPlayerId,
        baseIndex: context.baseIndex,
        opponents: context.opponents,
        opponentIdx: context.opponentIdx,
        decliners: context.decliners,
        declinerIdx: nextDeclinerIdx,
    }) satisfies ElderThingShoggothPodDestroyPromptContext;
}

const elderThingShoggothPodDestroyPromptProgram = createPromptProgram<ElderThingShoggothPodDestroyPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_shoggoth_pod_destroy',
    buildInteraction: (context) => {
        const targetPlayerId = context.decliners[context.declinerIdx];
        const interaction = createAbilityRuntimeSimpleChoice(
            `elder_thing_shoggoth_pod_destroy_${context.now}_${context.declinerIdx}`,
            context.casterPlayerId,
            `修格斯：选择消灭 ${targetPlayerId} 在此基地的一个随从`,
            buildShoggothDestroyPromptOptions(
                context.matchState.core,
                context.casterPlayerId,
                targetPlayerId,
                context.baseIndex,
            ),
            {
                sourceId: 'elder_thing_shoggoth_pod_destroy',
                targetType: 'minion',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = (state) => buildShoggothDestroyPromptOptions(
            state.core as SmashUpCore,
            context.casterPlayerId,
            targetPlayerId,
            context.baseIndex,
        );
        return interaction;
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = getSelectedMinionChoice(value);
        const events = selected
            ? buildValidatedDestroyEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: context.casterPlayerId,
                sourcePlayerId: context.casterPlayerId,
                sourceCardUid: context.cardUid,
                sourceDefId: 'elder_thing_shoggoth_pod',
                sourceControllerId: context.casterPlayerId,
                sourceBaseIndex: context.baseIndex,
                reason: 'elder_thing_shoggoth_pod',
                now: timestamp,
            })
            : [];

        const nextDecliner = getNextShoggothPodDeclinerContext(context, state, timestamp);
        if (!nextDecliner) {
            return {
                events: [...events, ...finalizeShoggothPodEvents(state, context.casterPlayerId, context.baseIndex, timestamp)],
            };
        }

        const nextTargetPlayerId = nextDecliner.decliners[nextDecliner.declinerIdx];
        const nextOptions = buildShoggothDestroyPromptOptions(
            state.core,
            context.casterPlayerId,
            nextTargetPlayerId,
            context.baseIndex,
        );
        if (nextOptions.length === 0) {
            const skippedContext = getNextShoggothPodDeclinerContext(nextDecliner, state, timestamp);
            if (!skippedContext) {
                return {
                    events: [...events, ...finalizeShoggothPodEvents(state, context.casterPlayerId, context.baseIndex, timestamp)],
                };
            }
            return {
                events,
                context: skippedContext,
                nextProgram: elderThingShoggothPodDestroyPromptProgram,
            };
        }

        return {
            events,
            context: nextDecliner,
            nextProgram: elderThingShoggothPodDestroyPromptProgram,
        };
    },
});

const elderThingShoggothPodPromptProgram = createPromptProgram<ElderThingShoggothPodPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_shoggoth_pod',
    buildInteraction: (context) => {
        const targetPlayerId = context.opponents[context.opponentIdx];
        return createAbilityRuntimeSimpleChoice(
            `elder_thing_shoggoth_pod_${targetPlayerId}_${context.now}`,
            targetPlayerId,
            '修格斯：你可以抽一张疯狂卡',
            [
                { id: 'yes', label: '抽一张疯狂卡', labelKey: 'ui.elder_thing_draw_madness_option', value: { choice: 'yes' }, displayMode: 'button' as const },
                { id: 'no', label: '不抽', labelKey: 'ui.elder_thing_no_draw_option', value: { choice: 'no' }, displayMode: 'button' as const },
            ],
            { sourceId: 'elder_thing_shoggoth_pod', targetType: 'button', titleKey: 'ui.elder_thing_shoggoth_pod_title' },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = (value as { choice?: 'yes' | 'no' } | undefined)?.choice;
        const targetPlayerId = context.opponents[context.opponentIdx];
        const events: SmashUpEvent[] = [];
        const decliners = [...context.decliners];
        if (choice === 'yes') {
            const event = drawMadnessCards(targetPlayerId, 1, state.core, 'elder_thing_shoggoth_pod', timestamp);
            if (event) events.push(event);
        } else {
            decliners.push(targetPlayerId);
        }

        const nextPrompt = getNextShoggothPodPromptContext({
            ...context,
            decliners,
        }, state, timestamp);
        if (nextPrompt) {
            return { events, context: nextPrompt, nextProgram: elderThingShoggothPodPromptProgram };
        }

        if (decliners.length === 0) {
            return {
                events: [...events, ...finalizeShoggothPodEvents(state, context.casterPlayerId, context.baseIndex, timestamp)],
            };
        }

        const firstDestroyContext = createElderThingPromptContext(state, context.playerId, timestamp, {
            cardUid: context.cardUid,
            casterPlayerId: context.casterPlayerId,
            baseIndex: context.baseIndex,
            opponents: context.opponents,
            opponentIdx: context.opponentIdx,
            decliners,
            declinerIdx: 0,
        }) satisfies ElderThingShoggothPodDestroyPromptContext;
        const firstDecliner = decliners[0];
        const destroyOptions = buildShoggothDestroyPromptOptions(
            state.core,
            context.casterPlayerId,
            firstDecliner,
            context.baseIndex,
        );
        if (destroyOptions.length === 0) {
            const skippedContext = getNextShoggothPodDeclinerContext(firstDestroyContext, state, timestamp);
            if (!skippedContext) {
                return {
                    events: [...events, ...finalizeShoggothPodEvents(state, context.casterPlayerId, context.baseIndex, timestamp)],
                };
            }
            return {
                events,
                context: skippedContext,
                nextProgram: elderThingShoggothPodDestroyPromptProgram,
            };
        }

        return {
            events,
            context: firstDestroyContext,
            nextProgram: elderThingShoggothPodDestroyPromptProgram,
        };
    },
});

const elderThingShoggothPodProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const opponents = getOrderedOpponentIds(ctx.state, ctx.playerId);
    if (opponents.length === 0) {
        return { events: [] };
    }
    return {
        events: [],
        context: createElderThingPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            cardUid: ctx.cardUid,
            casterPlayerId: ctx.playerId,
            baseIndex: ctx.baseIndex,
            opponents,
            opponentIdx: 0,
            decliners: [] as PlayerId[],
        }) satisfies ElderThingShoggothPodPromptContext,
        nextProgram: elderThingShoggothPodPromptProgram,
    };
});

const elderThingBeginTheSummoningPodPromptProgram = createPromptProgram<ElderThingBeginTheSummoningPodPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_begin_the_summoning_pod',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `elder_thing_begin_the_summoning_pod_${context.now}`,
            context.playerId,
            '选择要放到牌库顶的随从',
            buildDiscardMinionCardOptions(context.matchState.core, context.playerId),
            {
                sourceId: 'elder_thing_begin_the_summoning_pod',
                titleKey: 'ui.elder_thing_begin_the_summoning_pod_title',
                targetType: 'generic',
                autoRefresh: 'discard',
                responseValidationMode: 'live',
            },
        );
        return attachOptionsGenerator(interaction, (state) => buildDiscardMinionCardOptions(state.core, context.playerId));
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = getSelectedCard(value);
        if (!selected) return { events: [] };
        const player = state.core.players[context.playerId];
        const inDiscard = player.discard.find((card) => card.uid === selected.cardUid && card.type === 'minion');
        if (!inDiscard) return { events: [] };
        const evt: SmashUpEvent = {
            type: SU_EVENTS.CARD_TO_DECK_TOP,
            payload: {
                cardUid: selected.cardUid,
                defId: selected.defId,
                ownerId: inDiscard.owner,
                sourcePlayerId: context.playerId,
                reason: 'elder_thing_begin_the_summoning_pod',
            },
            timestamp,
        };
        return {
            events: [
                evt,
                grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: state }, 'elder_thing_begin_the_summoning_pod'),
            ],
        };
    },
});

const elderThingBeginTheSummoningPodProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const player = ctx.state.players[ctx.playerId];
    const minionsInDiscard = player.discard.filter((card) => card.type === 'minion');
    if (minionsInDiscard.length === 0) {
        return { events: [grantContextualExtraAction(ctx, 'elder_thing_begin_the_summoning_pod')] };
    }
    return {
        events: [],
        context: createElderThingPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            cardUid: ctx.cardUid,
        }) satisfies ElderThingBeginTheSummoningPodPromptContext,
        nextProgram: elderThingBeginTheSummoningPodPromptProgram,
    };
});

function elderThingDunwichHorrorPodOnPlay(ctx: AbilityContext): AbilityResult {
    // POD：+5 仅来自 ongoing 修正；onPlay 不应再额外叠加永久力量，避免与 ongoing 叠加成 +10。
    void ctx;
    return { events: [] };
}

function elderThingInsanityPod(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const evt = drawMadnessCards(pid, 2, ctx.state, 'elder_thing_insanity_pod', ctx.now);
        if (evt) events.push(evt);
    }
    const ownerId = ctx.state.players[ctx.playerId]?.hand.find(card => card.uid === ctx.cardUid)?.owner
        ?? ctx.state.players[ctx.playerId]?.discard.find(card => card.uid === ctx.cardUid)?.owner
        ?? ctx.playerId;
    // POD: Place this action in the box (remove from game) after resolving.
    events.push({
        type: SU_EVENTS.CARD_REMOVED_FROM_GAME,
        payload: { playerId: ownerId, cardUid: ctx.cardUid, defId: ctx.defId, reason: 'elder_thing_insanity_pod_box' },
        timestamp: ctx.now,
    });
    return { events };
}

const elderThingPowerOfMadnessPodPromptProgram = createPromptProgram<ElderThingPowerOfMadnessPodPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_power_of_madness_pod_choose',
    interactionSourceIds: ['elder_thing_power_of_madness_pod_start'],
    buildInteraction: (context) => {
        const targetPid = context.opponents[context.idx];
        return createAbilityRuntimeSimpleChoice(
            `elder_thing_power_of_madness_pod_choose_${targetPid}_${context.now}`,
            context.playerId,
            `疯狂之力：为 ${targetPid} 选择要命名的战术`,
            buildPowerOfMadnessPodActionOptions(context.matchState.core),
            { sourceId: 'elder_thing_power_of_madness_pod_choose', targetType: 'button' },
        );
    },
    onResolve: ({ context, state, value, random, timestamp }) => {
        const targetPid = context.opponents[context.idx];
        const namedDefId = (value as { defId?: string } | undefined)?.defId;
        const opponent = state.core.players[targetPid];
        const events: SmashUpEvent[] = [];

        if (opponent.hand.length > 0) {
            events.push(revealHand(
                targetPid,
                'all',
                opponent.hand.map((card) => ({ uid: card.uid, defId: card.defId })),
                'elder_thing_power_of_madness_pod',
                timestamp,
                context.playerId,
            ));
        }

        if (namedDefId) {
            const discardedCards = opponent.hand.filter((card) => card.defId === namedDefId);
            const discards = discardedCards.map((card) => card.uid);
            if (discards.length > 0) {
                events.push({
                    type: SU_EVENTS.CARDS_DISCARDED,
                    payload: { playerId: targetPid, cardUids: discards },
                    timestamp,
                } as CardsDiscardedEvent);
            }
            const newDeck = random.shuffle([...opponent.deck, ...opponent.discard, ...discardedCards]);
            events.push({
                type: SU_EVENTS.DECK_RESHUFFLED,
                payload: { playerId: targetPid, deckUids: newDeck.map((card) => card.uid) },
                timestamp,
            } as DeckReshuffledEvent);
        } else {
            const newDeck = random.shuffle([...opponent.deck, ...opponent.discard]);
            events.push({
                type: SU_EVENTS.DECK_RESHUFFLED,
                payload: { playerId: targetPid, deckUids: newDeck.map((card) => card.uid) },
                timestamp,
            } as DeckReshuffledEvent);
        }

        const nextIdx = context.idx + 1;
        if (nextIdx >= context.opponents.length) {
            return { events };
        }
        return {
            events,
            context: createElderThingPromptContext(state, context.playerId, timestamp, {
                cardUid: context.cardUid,
                opponents: context.opponents,
                idx: nextIdx,
            }) satisfies ElderThingPowerOfMadnessPodPromptContext,
            nextProgram: elderThingPowerOfMadnessPodPromptProgram,
        };
    },
});

const elderThingPowerOfMadnessPodProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const opponents = ctx.state.turnOrder.filter((pid) => pid !== ctx.playerId);
    if (opponents.length === 0) return { events: [] };
    return {
        events: [],
        context: createElderThingPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            cardUid: ctx.cardUid,
            opponents,
            idx: 0,
        }) satisfies ElderThingPowerOfMadnessPodPromptContext,
        nextProgram: elderThingPowerOfMadnessPodPromptProgram,
    };
});

const elderThingSpreadingHorrorPodChooseMinionPromptProgram = createPromptProgram<ElderThingSpreadingHorrorPodChooseMinionPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_spreading_horror_pod_choose_minion',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `elder_thing_spreading_horror_pod_choose_minion_${context.now}_${context.remaining}`,
            context.casterPlayerId,
            '散播恐怖：选择要从弃牌堆打出的随从（战斗力≤3）',
            buildDiscardSmallMinionOptions(context.matchState.core, context.casterPlayerId),
            {
                sourceId: 'elder_thing_spreading_horror_pod_choose_minion',
                titleKey: 'ui.elder_thing_spreading_horror_pod_choose_minion_title',
                targetType: 'generic',
                autoRefresh: 'discard',
                responseValidationMode: 'live',
            },
        );
        return attachOptionsGenerator(interaction, (state) => buildDiscardSmallMinionOptions(state.core, context.casterPlayerId));
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = getSelectedCard(value);
        if (!selected) return { events: [] };
        const selectedCard = state.core.players[context.casterPlayerId]?.discard.find((card) =>
            card.uid === selected.cardUid
            && card.defId === selected.defId
            && card.type === 'minion',
        );
        if (!selectedCard) return { events: [] };
        const def = getCardDef(selectedCard.defId) as MinionCardDef | undefined;
        const playedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId: context.casterPlayerId,
                cardUid: selectedCard.uid,
                defId: selectedCard.defId,
                ownerId: selectedCard.owner,
                baseIndex: context.chosenBaseIndex,
                power: def?.power ?? 0,
                fromDiscard: true,
                consumesNormalLimit: false,
                discardPlaySourceId: 'elder_thing_spreading_horror_pod',
            },
            timestamp,
        } as SmashUpEvent;
        const events = [playedEvent];
        const remaining = context.remaining - 1;
        if (remaining <= 0) return { events };
        return {
            events,
            context: createElderThingPromptContext(state, context.playerId, timestamp, {
                cardUid: context.cardUid,
                casterPlayerId: context.casterPlayerId,
                remaining,
                usedBases: [...context.usedBases, context.chosenBaseIndex],
            }) satisfies ElderThingSpreadingHorrorPodMayPlayPromptContext,
            nextProgram: elderThingSpreadingHorrorPodMayPlayDecisionProgram,
        };
    },
});

const elderThingSpreadingHorrorPodChooseBasePromptProgram = createPromptProgram<ElderThingSpreadingHorrorPodChooseBasePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_spreading_horror_pod_choose_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `elder_thing_spreading_horror_pod_choose_base_${context.now}_${context.remaining}`,
        context.casterPlayerId,
        '散播恐怖：选择要打出随从的基地（每次必须不同）',
        buildBaseTargetOptions(buildAvailableBaseOptions(context.matchState.core, context.usedBases), context.matchState.core),
        {
            sourceId: 'elder_thing_spreading_horror_pod_choose_base',
            titleKey: 'ui.elder_thing_spreading_horror_pod_choose_base_title',
            targetType: 'base',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const baseIndex = (value as { baseIndex?: number } | undefined)?.baseIndex;
        if (baseIndex === undefined || context.usedBases.includes(baseIndex)) {
            return { events: [] };
        }
        if (buildDiscardSmallMinionOptions(state.core, context.casterPlayerId).length === 0) {
            const remaining = context.remaining - 1;
            if (remaining <= 0) return { events: [] };
            return {
                events: [],
                context: createElderThingPromptContext(state, context.playerId, timestamp, {
                    cardUid: context.cardUid,
                    casterPlayerId: context.casterPlayerId,
                    remaining,
                    usedBases: context.usedBases,
                }) satisfies ElderThingSpreadingHorrorPodMayPlayPromptContext,
                nextProgram: elderThingSpreadingHorrorPodMayPlayDecisionProgram,
            };
        }
        return {
            events: [],
            context: createElderThingPromptContext(state, context.playerId, timestamp, {
                cardUid: context.cardUid,
                casterPlayerId: context.casterPlayerId,
                remaining: context.remaining,
                usedBases: context.usedBases,
                chosenBaseIndex: baseIndex,
            }) satisfies ElderThingSpreadingHorrorPodChooseMinionPromptContext,
            nextProgram: elderThingSpreadingHorrorPodChooseMinionPromptProgram,
        };
    },
});

const elderThingSpreadingHorrorPodMayPlayPromptProgram = createPromptProgram<ElderThingSpreadingHorrorPodMayPlayPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_spreading_horror_pod_may_play',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `elder_thing_spreading_horror_pod_may_${context.now}_${context.remaining}`,
        context.casterPlayerId,
        '散播恐怖：你可以从弃牌堆打出一个战斗力≤3的随从',
        [
            { id: 'yes', label: '打出一个随从', labelKey: 'ui.elder_thing_play_minion_option', value: { choice: 'yes' } satisfies PodYesNoChoiceValue, displayMode: 'button' as const },
            { id: 'no', label: '不打出', labelKey: 'ui.elder_thing_do_not_play_minion_option', value: { choice: 'no' } satisfies PodYesNoChoiceValue, displayMode: 'button' as const },
        ],
        { sourceId: 'elder_thing_spreading_horror_pod_may_play', targetType: 'button', titleKey: 'ui.elder_thing_spreading_horror_pod_may_play_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = (value as PodYesNoChoiceValue | undefined)?.choice;
        if (choice !== 'yes') {
            const remaining = context.remaining - 1;
            if (remaining <= 0) return { events: [] };
            return {
                events: [],
                context: createElderThingPromptContext(state, context.playerId, timestamp, {
                    cardUid: context.cardUid,
                    casterPlayerId: context.casterPlayerId,
                    remaining,
                    usedBases: context.usedBases,
                }) satisfies ElderThingSpreadingHorrorPodMayPlayPromptContext,
                nextProgram: elderThingSpreadingHorrorPodMayPlayDecisionProgram,
            };
        }
        return {
            events: [],
            context: createElderThingPromptContext(state, context.playerId, timestamp, {
                cardUid: context.cardUid,
                casterPlayerId: context.casterPlayerId,
                remaining: context.remaining,
                usedBases: context.usedBases,
            }) satisfies ElderThingSpreadingHorrorPodChooseBasePromptContext,
            nextProgram: elderThingSpreadingHorrorPodChooseBasePromptProgram,
        };
    },
});

const elderThingSpreadingHorrorPodMayPlayDecisionProgram = createEffectProgram<ElderThingSpreadingHorrorPodMayPlayPromptContext, SmashUpCore, SmashUpEvent>((context) => {
    if (context.remaining <= 0) {
        return { events: [] };
    }

    const hasPlayableDiscardMinion = buildDiscardSmallMinionOptions(context.matchState.core, context.casterPlayerId).length > 0;
    const hasAvailableBase = buildAvailableBaseOptions(context.matchState.core, context.usedBases).length > 0;
    if (!hasPlayableDiscardMinion || !hasAvailableBase) {
        return {
            events: [],
            context: {
                ...context,
                remaining: context.remaining - 1,
            },
            nextProgram: elderThingSpreadingHorrorPodMayPlayDecisionProgram,
        };
    }

    return {
        events: [],
        context,
        nextProgram: elderThingSpreadingHorrorPodMayPlayPromptProgram,
    };
});

const elderThingSpreadingHorrorPodOpponentPromptProgram = createPromptProgram<ElderThingSpreadingHorrorPodOpponentPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_spreading_horror_pod_opponent',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `elder_thing_spreading_horror_pod_${context.opponents[context.idx]}_${context.now}`,
        context.opponents[context.idx],
        '散播恐怖：你可以弃置两张非疯狂卡',
        [
            { id: 'yes', label: '弃置两张非疯狂卡', labelKey: 'ui.elder_thing_discard_two_non_madness_option', value: { choice: 'yes' } satisfies PodYesNoChoiceValue, displayMode: 'button' as const },
            { id: 'no', label: '不弃置', labelKey: 'ui.elder_thing_do_not_discard_option', value: { choice: 'no' } satisfies PodYesNoChoiceValue, displayMode: 'button' as const },
        ],
        { sourceId: 'elder_thing_spreading_horror_pod_opponent', targetType: 'button', titleKey: 'ui.elder_thing_spreading_horror_pod_opponent_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const pid = context.opponents[context.idx];
        const player = state.core.players[pid];
        const nonMadness = player.hand.filter((card) => card.defId !== MADNESS_CARD_DEF_ID);
        const events: SmashUpEvent[] = [];
        const decliners = [...context.decliners];
        if ((value as PodYesNoChoiceValue | undefined)?.choice === 'yes' && nonMadness.length >= 2) {
            events.push({
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: pid, cardUids: [nonMadness[0].uid, nonMadness[1].uid] },
                timestamp,
            } as CardsDiscardedEvent);
        } else {
            decliners.push(pid);
        }

        const nextIdx = context.idx + 1;
        if (nextIdx < context.opponents.length) {
            return {
                events,
                context: createElderThingPromptContext(state, context.playerId, timestamp, {
                    cardUid: context.cardUid,
                    casterPlayerId: context.casterPlayerId,
                    opponents: context.opponents,
                    idx: nextIdx,
                    decliners,
                }) satisfies ElderThingSpreadingHorrorPodOpponentPromptContext,
                nextProgram: elderThingSpreadingHorrorPodOpponentPromptProgram,
            };
        }

        if (decliners.length === 0) return { events };
        return {
            events,
            context: createElderThingPromptContext(state, context.playerId, timestamp, {
                cardUid: context.cardUid,
                casterPlayerId: context.casterPlayerId,
                remaining: decliners.length,
                usedBases: [] as number[],
            }) satisfies ElderThingSpreadingHorrorPodMayPlayPromptContext,
            nextProgram: elderThingSpreadingHorrorPodMayPlayDecisionProgram,
        };
    },
});

const elderThingSpreadingHorrorPodProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const opponents = ctx.state.turnOrder.filter((pid) => pid !== ctx.playerId);
    if (opponents.length === 0) return { events: [] };
    return {
        events: [],
        context: createElderThingPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            cardUid: ctx.cardUid,
            casterPlayerId: ctx.playerId,
            opponents,
            idx: 0,
            decliners: [] as PlayerId[],
        }) satisfies ElderThingSpreadingHorrorPodOpponentPromptContext,
        nextProgram: elderThingSpreadingHorrorPodOpponentPromptProgram,
    };
});

function elderThingUnfathomableGoalsPod(ctx: AbilityContext): AbilityResult {
    const opponents = ctx.state.turnOrder.filter(pid => pid !== ctx.playerId);
    const events: SmashUpEvent[] = [];
    const allRevealCards: { uid: string; defId: string }[] = [];
    const revealTargetIds: string[] = [];
    let anyTwoMadness = false;
    let totalMadness = 0;
    for (const pid of opponents) {
        const p = ctx.state.players[pid];
        if (p.hand.length > 0) {
            revealTargetIds.push(pid);
            for (const c of p.hand) allRevealCards.push({ uid: c.uid, defId: c.defId });
        }
        const count = p.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length;
        if (count >= 2) anyTwoMadness = true;
        totalMadness += count;
    }
    if (allRevealCards.length > 0) {
        const targetIds = revealTargetIds.length === 1 ? revealTargetIds[0] : revealTargetIds;
        events.push(revealHand(targetIds, 'all', allRevealCards, 'elder_thing_unfathomable_goals_pod', ctx.now, ctx.playerId));
    }
    if (anyTwoMadness) events.push(grantContextualExtraMinion(ctx, 'elder_thing_unfathomable_goals_pod'));
    if (totalMadness >= 4) events.push(grantContextualExtraAction(ctx, 'elder_thing_unfathomable_goals_pod'));
    return { events };
}

function elderThingTouchOfMadnessPod(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const evt = drawMadnessCards(pid, 1, ctx.state, 'elder_thing_touch_of_madness_pod', ctx.now);
        if (evt) events.push(evt);
    }
    events.push(...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now));
    events.push(grantContextualExtraAction(ctx, 'elder_thing_touch_of_madness_pod'));
    return { events };
}

function elderThingPriceOfPowerPodSpecial(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const scoringBase = ctx.state.bases[ctx.baseIndex];
    const inBeforeScoringWindow = ctx.matchState.sys.phase === 'scoreBases'
        || ctx.matchState.sys.responseWindow?.current?.windowType === 'meFirst';

    const opponents = ctx.state.turnOrder.filter(pid => pid !== ctx.playerId).filter(pid => {
        if (!inBeforeScoringWindow) return true;
        return !!scoringBase?.minions.some(m => m.controller === pid);
    });

    const allRevealCards: { uid: string; defId: string }[] = [];
    const revealTargetIds: string[] = [];
    let totalMadness = 0;
    for (const pid of opponents) {
        const p = ctx.state.players[pid];
        if (p.hand.length > 0) {
            revealTargetIds.push(pid);
            for (const c of p.hand) allRevealCards.push({ uid: c.uid, defId: c.defId });
        }
        totalMadness += p.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length;
    }

    if (allRevealCards.length > 0) {
        const targetIds = revealTargetIds.length === 1 ? revealTargetIds[0] : revealTargetIds;
        events.push(revealHand(targetIds, 'all', allRevealCards, 'elder_thing_the_price_of_power_pod', ctx.now, ctx.playerId));
    }

    if (totalMadness === 0) return { events };

    const myMinions: Array<{ uid: string; baseIndex: number }> = [];
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex++) {
        for (const m of ctx.state.bases[baseIndex].minions) {
            if (m.controller === ctx.playerId) {
                myMinions.push({ uid: m.uid, baseIndex });
            }
        }
    }
    if (myMinions.length === 0) return { events };

    // 目前沿用“自动分配”实现：按轮询分配每个 +1 指示物（后续可升级为逐次可选目标交互）。
    for (let i = 0; i < totalMadness; i++) {
        const target = myMinions[i % myMinions.length];
        events.push(addPowerCounter(target.uid, target.baseIndex, 1, 'elder_thing_the_price_of_power_pod', ctx.now));
    }
    return { events };
}

function elderThingDunwichHorrorPodBeforeScoring(ctx: TriggerContext): SmashUpEvent[] | { events: SmashUpEvent[]; matchState?: any } {
    const result = executeAbilityProgram(elderThingDunwichHorrorPodBeforeScoringProgram, ctx);
    return {
        events: result.events,
        ...(result.matchState ? { matchState: result.matchState } : {}),
    };
}

const elderThingDunwichHorrorPodChoicePromptProgram = createPromptProgram<ElderThingDunwichHorrorPodChoicePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_dunwich_horror_pod_choice',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `elder_thing_dunwich_horror_pod_${context.minionUid}_${context.now}`,
        context.playerId,
        '敦威治恐怖：抽两张疯狂卡，或者消灭该随从',
        [
            { id: 'draw', label: '抽两张疯狂卡', labelKey: 'ui.elder_thing_draw_two_madness_option', value: { choice: 'draw' }, displayMode: 'button' as const },
            { id: 'destroy', label: '消灭该随从', labelKey: 'ui.elder_thing_destroy_that_minion_option', value: { choice: 'destroy' }, displayMode: 'button' as const },
        ],
        { sourceId: 'elder_thing_dunwich_horror_pod_choice', targetType: 'button', titleKey: 'ui.elder_thing_dunwich_horror_pod_choice_title' },
    ),
    onResolve: ({ context, value, state, timestamp }) => {
        const choice = (value as { choice?: 'draw' | 'destroy' } | undefined)?.choice;
        if (choice === 'draw') {
            const evt = drawMadnessCards(context.playerId, 2, state.core, 'elder_thing_dunwich_horror_pod', timestamp);
            return { events: evt ? [evt] : [] };
        }
        return {
            events: buildValidatedDestroyEvents(state, {
                minionUid: context.minionUid,
                minionDefId: context.minionDefId,
                fromBaseIndex: context.baseIndex,
                destroyerId: context.playerId,
                reason: 'elder_thing_dunwich_horror_pod',
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceCardUid: context.cardUid,
                sourceDefId: 'elder_thing_dunwich_horror_pod',
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.baseIndex,
            }),
        };
    },
});

const elderThingDunwichHorrorPodBeforeScoringProgram = createEffectProgram<TriggerContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const { state, baseIndex, now } = ctx;
    if (baseIndex === undefined || !ctx.matchState) return { events: [] };
    const base = state.bases[baseIndex];
    if (!base) return { events: [] };

    const sourceHost = ctx.sourceCardUid
        ? base.minions.find(minion => minion.attachedActions.some(action =>
            action.uid === ctx.sourceCardUid && action.defId === 'elder_thing_dunwich_horror_pod'))
        : undefined;
    const target = sourceHost ?? base.minions.find(minion =>
        minion.attachedActions.some(action => action.defId === 'elder_thing_dunwich_horror_pod'));
    if (!target) return { events: [] };

    return {
        events: [],
        context: {
            matchState: ctx.matchState,
            playerId: target.controller,
            now,
            baseIndex,
            minionUid: target.uid,
            minionDefId: target.defId,
            ownerId: target.owner,
        } satisfies ElderThingDunwichHorrorPodChoicePromptContext,
        nextProgram: elderThingDunwichHorrorPodChoicePromptProgram,
    };
});

function elderThingDunwichHorrorPodOnTurnEndNoop(_ctx: TriggerContext): SmashUpEvent[] {
    return [];
}

const elderThingDestroySecondPromptProgram = createPromptProgram<ElderThingDestroySecondPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_elder_thing_destroy_second',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `elder_thing_elder_thing_destroy_second_${context.now}`,
            context.playerId,
            '远古之物：点击第二个要消灭的随从',
            buildElderThingDestroyPromptOptions(
                context.matchState.core,
                context.playerId,
                context.cardUid,
                [context.firstTarget.minionUid],
            ),
            {
                sourceId: 'elder_thing_elder_thing_destroy_second',
                targetType: 'minion',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.elder_thing_destroy_second_title',
            },
        );
        interaction.data.optionsGenerator = (state) => buildElderThingDestroyPromptOptions(
            state.core as SmashUpCore,
            context.playerId,
            context.cardUid,
            [context.firstTarget.minionUid],
        );
        return interaction;
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = getSelectedMinionChoice(value);
        if (!selected) {
            return { events: [] };
        }
        const sourceOwnerId = findMinionOnBases(state.core, context.cardUid)?.minion.owner ?? context.playerId;

        const firstTarget = context.firstTarget;
        const proposed: SmashUpEvent[] = [
            ...buildValidatedDestroyEvents(state, {
                minionUid: firstTarget.minionUid,
                minionDefId: firstTarget.defId,
                fromBaseIndex: firstTarget.baseIndex,
                destroyerId: context.playerId,
                sourcePlayerId: context.playerId,
                sourceCardUid: context.cardUid,
                sourceDefId: context.elderThingDefId,
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.baseIndex,
                reason: 'elder_thing_elder_thing',
                now: timestamp,
            }),
            ...buildValidatedDestroyEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: context.playerId,
                sourcePlayerId: context.playerId,
                sourceCardUid: context.cardUid,
                sourceDefId: context.elderThingDefId,
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.baseIndex,
                reason: 'elder_thing_elder_thing',
                now: timestamp,
            }),
        ];
        const destroyCount = proposed.filter((event) => event.type === SU_EVENTS.MINION_DESTROYED).length;
        if (destroyCount < 2) {
            return {
                events: buildValidatedCardToDeckBottomEvents(state, {
                    cardUid: context.cardUid,
                    defId: context.elderThingDefId,
                    ownerId: sourceOwnerId,
                    sourcePlayerId: context.playerId,
                    sourceCardUid: context.cardUid,
                    sourceDefId: context.elderThingDefId,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.baseIndex,
                    reason: 'elder_thing_elder_thing_failed_destroy',
                    now: timestamp,
                    expectedLocation: 'bases',
                }),
            };
        }

        return { events: proposed };
    },
});

const elderThingDestroyFirstPromptProgram = createPromptProgram<ElderThingOnPlayPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_elder_thing_destroy_first',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `elder_thing_elder_thing_destroy_first_${context.now}`,
            context.playerId,
            '远古之物：点击第一个要消灭的随从',
            buildElderThingDestroyPromptOptions(context.matchState.core, context.playerId, context.cardUid),
            {
                sourceId: 'elder_thing_elder_thing_destroy_first',
                targetType: 'minion',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.elder_thing_destroy_first_title',
            },
        );
        interaction.data.optionsGenerator = (state) => buildElderThingDestroyPromptOptions(
            state.core as SmashUpCore,
            context.playerId,
            context.cardUid,
        );
        return interaction;
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const firstTarget = getSelectedMinionChoice(value);
        if (!firstTarget) {
            return { events: [] };
        }
        const sourceOwnerId = findMinionOnBases(state.core, context.cardUid)?.minion.owner ?? context.playerId;

        const remaining = collectFriendlyOtherMinions(
            state.core,
            context.playerId,
            context.cardUid,
            [firstTarget.minionUid],
        );
        if (remaining.length === 0) {
            return {
                events: buildValidatedCardToDeckBottomEvents(state, {
                    cardUid: context.cardUid,
                    defId: context.elderThingDefId,
                    ownerId: sourceOwnerId,
                    sourcePlayerId: context.playerId,
                    sourceCardUid: context.cardUid,
                    sourceDefId: context.elderThingDefId,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.baseIndex,
                    reason: 'elder_thing_elder_thing_failed_destroy',
                    now: timestamp,
                    expectedLocation: 'bases',
                }),
            };
        }

        return {
            events: [],
            context: createElderThingPromptContext(state, context.playerId, timestamp, {
                cardUid: context.cardUid,
                elderThingDefId: context.elderThingDefId,
                baseIndex: context.baseIndex,
                firstTarget,
            }) satisfies ElderThingDestroySecondPromptContext,
            nextProgram: elderThingDestroySecondPromptProgram,
        };
    },
});

const elderThingChoicePromptProgram = createPromptProgram<ElderThingOnPlayPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_elder_thing_choice',
    buildInteraction: (context) => {
        const candidateCount = collectFriendlyOtherMinions(
            context.matchState.core,
            context.playerId,
            context.cardUid,
        ).length;
        return createAbilityRuntimeSimpleChoice(
            `elder_thing_elder_thing_choice_${context.now}`,
            context.playerId,
            '选择远古之物的效果',
            [
                {
                    id: 'destroy',
                    label: candidateCount >= 2 ? '消灭两个己方其他随从' : '消灭两个己方其他随从（随从不足）',
                    labelKey: candidateCount >= 2 ? 'ui.elder_thing_destroy_two_other_friendly_minions_option' : 'ui.elder_thing_destroy_two_other_friendly_minions_disabled_option',
                    value: { choice: 'destroy' },
                    displayMode: 'button' as const,
                    disabled: candidateCount < 2,
                },
                {
                    id: 'deckbottom',
                    label: '将本随从放到牌库底',
                    labelKey: 'ui.elder_thing_put_this_minion_on_bottom_option',
                    value: { choice: 'deckbottom' },
                    displayMode: 'button' as const,
                },
            ],
            {
                sourceId: 'elder_thing_elder_thing_choice',
                targetType: 'button',
                displayCard: { defId: context.elderThingDefId, cardUid: context.cardUid },
                titleKey: 'ui.elder_thing_choice_title',
            },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = (value as { choice?: string } | undefined)?.choice;
        const sourceOwnerId = findMinionOnBases(state.core, context.cardUid)?.minion.owner ?? context.playerId;
        if (choice === 'deckbottom') {
            return {
                events: buildValidatedCardToDeckBottomEvents(state, {
                    cardUid: context.cardUid,
                    defId: context.elderThingDefId,
                    ownerId: sourceOwnerId,
                    sourcePlayerId: context.playerId,
                    sourceCardUid: context.cardUid,
                    sourceDefId: context.elderThingDefId,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.baseIndex,
                    reason: 'elder_thing_elder_thing',
                    now: timestamp,
                    expectedLocation: 'bases',
                }),
            };
        }

        const candidates = collectFriendlyOtherMinions(state.core, context.playerId, context.cardUid);
        if (candidates.length < 2) {
            return {
                events: buildValidatedCardToDeckBottomEvents(state, {
                    cardUid: context.cardUid,
                    defId: context.elderThingDefId,
                    ownerId: sourceOwnerId,
                    sourcePlayerId: context.playerId,
                    sourceCardUid: context.cardUid,
                    sourceDefId: context.elderThingDefId,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.baseIndex,
                    reason: 'elder_thing_elder_thing_failed_destroy',
                    now: timestamp,
                    expectedLocation: 'bases',
                }),
            };
        }

        if (candidates.length === 2) {
            const proposed: SmashUpEvent[] = candidates.flatMap((candidate) => buildValidatedDestroyEvents(state, {
                minionUid: candidate.uid,
                minionDefId: candidate.defId,
                fromBaseIndex: candidate.baseIndex,
                destroyerId: context.playerId,
                sourcePlayerId: context.playerId,
                sourceCardUid: context.cardUid,
                sourceDefId: context.elderThingDefId,
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.baseIndex,
                reason: 'elder_thing_elder_thing',
                now: timestamp,
            }));
            const destroyCount = proposed.filter((event) => event.type === SU_EVENTS.MINION_DESTROYED).length;
            if (destroyCount < 2) {
                return {
                    events: buildValidatedCardToDeckBottomEvents(state, {
                        cardUid: context.cardUid,
                        defId: context.elderThingDefId,
                        ownerId: sourceOwnerId,
                        sourcePlayerId: context.playerId,
                        sourceCardUid: context.cardUid,
                        sourceDefId: context.elderThingDefId,
                        sourceControllerId: context.playerId,
                        sourceBaseIndex: context.baseIndex,
                        reason: 'elder_thing_elder_thing_failed_destroy',
                        now: timestamp,
                        expectedLocation: 'bases',
                    }),
                };
            }
            return { events: proposed };
        }

        return {
            events: [],
            context,
            nextProgram: elderThingDestroyFirstPromptProgram,
        };
    },
});

const elderThingElderThingProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => ({
    events: [],
    context: createElderThingPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
        cardUid: ctx.cardUid,
        elderThingDefId: ctx.defId,
        baseIndex: ctx.baseIndex,
    }) satisfies ElderThingOnPlayPromptContext,
    nextProgram: elderThingChoicePromptProgram,
}));

function getNextShoggothPromptContext(
    context: ElderThingShoggothPromptContext,
    state: MatchState<SmashUpCore>,
    timestamp: number,
): ElderThingShoggothPromptContext | null {
    const nextIdx = context.opponentIdx + 1;
    if (nextIdx >= context.opponents.length) {
        return null;
    }
    return createElderThingPromptContext(state, context.playerId, timestamp, {
        cardUid: context.cardUid,
        casterPlayerId: context.casterPlayerId,
        baseIndex: context.baseIndex,
        opponents: context.opponents,
        opponentIdx: nextIdx,
    }) satisfies ElderThingShoggothPromptContext;
}

const elderThingShoggothDestroyPromptProgram = createPromptProgram<ElderThingShoggothDestroyPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_shoggoth_destroy',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `elder_thing_shoggoth_destroy_${context.opponentIdx}_${context.now}`,
            context.casterPlayerId,
            '修格斯：选择消灭对手在此基地的一个随从',
            buildShoggothDestroyPromptOptions(
                context.matchState.core,
                context.casterPlayerId,
                context.targetPlayerId,
                context.baseIndex,
            ),
            {
                sourceId: 'elder_thing_shoggoth_destroy',
                targetType: 'minion',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.elder_thing_shoggoth_destroy_title',
            },
        );
        interaction.data.optionsGenerator = (state) => buildShoggothDestroyPromptOptions(
            state.core as SmashUpCore,
            context.casterPlayerId,
            context.targetPlayerId,
            context.baseIndex,
        );
        return interaction;
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = getSelectedMinionChoice(value);
        const events = selected
            ? buildValidatedDestroyEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: context.casterPlayerId,
                sourcePlayerId: context.casterPlayerId,
                sourceCardUid: context.cardUid,
                sourceDefId: 'elder_thing_shoggoth',
                sourceControllerId: context.casterPlayerId,
                sourceBaseIndex: context.baseIndex,
                reason: 'elder_thing_shoggoth',
                now: timestamp,
            })
            : [];
        const nextContext = getNextShoggothPromptContext(context, state, timestamp);
        return nextContext
            ? { events, context: nextContext, nextProgram: elderThingShoggothPromptProgram }
            : { events };
    },
});

const elderThingShoggothPromptProgram = createPromptProgram<ElderThingShoggothPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_shoggoth_opponent',
    buildInteraction: (context) => {
        const targetPlayerId = context.opponents[context.opponentIdx];
        return createAbilityRuntimeSimpleChoice(
            `elder_thing_shoggoth_opponent_${context.opponentIdx}_${context.now}`,
            targetPlayerId,
            '修格斯：你可以抽一张疯狂卡，否则你在此基地的一个随从将被消灭',
            [
                { id: 'draw_madness', label: '抽一张疯狂卡', labelKey: 'ui.elder_thing_draw_madness_option', value: { choice: 'draw_madness' }, displayMode: 'button' as const },
                { id: 'decline', label: '拒绝（被消灭一个随从）', labelKey: 'ui.elder_thing_shoggoth_decline_destroy_option', value: { choice: 'decline' }, displayMode: 'button' as const },
            ],
            { sourceId: 'elder_thing_shoggoth_opponent', targetType: 'button', titleKey: 'ui.elder_thing_shoggoth_opponent_title' },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = (value as { choice?: string } | undefined)?.choice;
        const targetPlayerId = context.opponents[context.opponentIdx];
        if (choice === 'draw_madness') {
            const event = drawMadnessCards(targetPlayerId, 1, state.core, 'elder_thing_shoggoth', timestamp);
            const nextContext = getNextShoggothPromptContext(context, state, timestamp);
            const events = event ? [event] : [];
            return nextContext
                ? { events, context: nextContext, nextProgram: elderThingShoggothPromptProgram }
                : { events };
        }

        const destroyOptions = buildShoggothDestroyPromptOptions(
            state.core,
            context.casterPlayerId,
            targetPlayerId,
            context.baseIndex,
        );
        if (destroyOptions.length === 0) {
            const nextContext = getNextShoggothPromptContext(context, state, timestamp);
            return nextContext
                ? { events: [], context: nextContext, nextProgram: elderThingShoggothPromptProgram }
                : { events: [] };
        }
        if (destroyOptions.length === 1) {
            const onlyOption = destroyOptions[0]?.value as ElderThingSelfDestroyChoice | undefined;
            const events = onlyOption
                ? buildValidatedDestroyEvents(state, {
                    minionUid: onlyOption.minionUid,
                    minionDefId: onlyOption.defId,
                    fromBaseIndex: onlyOption.baseIndex,
                    destroyerId: context.casterPlayerId,
                    sourcePlayerId: context.casterPlayerId,
                    sourceCardUid: context.cardUid,
                    sourceDefId: 'elder_thing_shoggoth',
                    sourceControllerId: context.casterPlayerId,
                    sourceBaseIndex: context.baseIndex,
                    reason: 'elder_thing_shoggoth',
                    now: timestamp,
                })
                : [];
            const nextContext = getNextShoggothPromptContext(context, state, timestamp);
            return nextContext
                ? { events, context: nextContext, nextProgram: elderThingShoggothPromptProgram }
                : { events };
        }

        return {
            events: [],
            context: createElderThingPromptContext(state, context.playerId, timestamp, {
                cardUid: context.cardUid,
                casterPlayerId: context.casterPlayerId,
                targetPlayerId,
                baseIndex: context.baseIndex,
                opponents: context.opponents,
                opponentIdx: context.opponentIdx,
            }) satisfies ElderThingShoggothDestroyPromptContext,
            nextProgram: elderThingShoggothDestroyPromptProgram,
        };
    },
});

const elderThingShoggothProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const base = ctx.state.bases[ctx.baseIndex];
    if (base) {
        const playerPower = getPlayerEffectivePowerOnBase(ctx.state, base, ctx.baseIndex, ctx.playerId);
        if (playerPower < 6) {
            return { events: [] };
        }
    }

    const opponents = getOrderedOpponentIds(ctx.state, ctx.playerId);
    if (opponents.length === 0) {
        return { events: [] };
    }

    return {
        events: [],
        context: createElderThingPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            cardUid: ctx.cardUid,
            casterPlayerId: ctx.playerId,
            baseIndex: ctx.baseIndex,
            opponents,
            opponentIdx: 0,
        }) satisfies ElderThingShoggothPromptContext,
        nextProgram: elderThingShoggothPromptProgram,
    };
});

/** 注册远古之物派系的交互解决处理函数 */
export function registerElderThingInteractionHandlers(): void {
    // =========================
    // POD handlers
    // =========================

}

// ============================================================================
// ongoing 效果触发器
// ============================================================================

/**
 * 力量的代价 special 能力：基地计分前打出
 *
 * 效果：在计分基地上，每个对手手牌中的疯狂卡给己方随从 +2 力量
 * ctx.baseIndex 为计分基地索引（由 Me First! 窗口传入）
 */
function elderThingPriceOfPowerSpecial(ctx: AbilityContext): AbilityResult {
    return applyPriceOfPower(ctx, {
        sourceId: 'elder_thing_the_price_of_power',
        perMadnessCounterAmount: 2,
    });
}

function applyPriceOfPower(
    ctx: AbilityContext,
    params: {
        sourceId: string;
        perMadnessCounterAmount: number;
        baseIndex?: number;
    },
): AbilityResult {
    const events: SmashUpEvent[] = [];
    const baseIndex = params.baseIndex ?? ctx.baseIndex;
    if (baseIndex === undefined) return { events };
    const base = ctx.state.bases[baseIndex];
    if (!base) return { events };

    const allRevealCards: { uid: string; defId: string }[] = [];
    const revealTargetIds: string[] = [];
    let totalMadness = 0;
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        if (!base.minions.some(m => m.controller === pid)) continue;
        const opponent = ctx.state.players[pid];
        if (opponent.hand.length > 0) {
            revealTargetIds.push(pid);
            for (const c of opponent.hand) {
                allRevealCards.push({ uid: c.uid, defId: c.defId });
            }
        }
        totalMadness += opponent.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length;
    }

    if (allRevealCards.length > 0) {
        const targetIds = revealTargetIds.length === 1 ? revealTargetIds[0] : revealTargetIds;
        events.push(revealHand(targetIds, 'all', allRevealCards, params.sourceId, ctx.now, ctx.playerId));
    }

    if (totalMadness === 0) return { events };

    const myMinions = base.minions.filter(m => m.controller === ctx.playerId);
    if (myMinions.length === 0) return { events };
    for (let i = 0; i < totalMadness; i++) {
        const target = myMinions[i % myMinions.length];
        events.push(addPowerCounter(target.uid, baseIndex, params.perMadnessCounterAmount, params.sourceId, ctx.now));
    }
    return { events };
}

function resolvePriceOfPowerPodBaseIndex(ctx: AbilityContext): number | undefined {
    if (ctx.targetBaseIndex !== undefined) return ctx.targetBaseIndex;
    const candidates = getPriceOfPowerPodCandidateBases(ctx);
    if (candidates.length === 1) {
        return candidates[0].baseIndex;
    }
    return undefined;
}

function getPriceOfPowerPodCandidateBases(params: {
    state: SmashUpCore;
    matchState: MatchState<SmashUpCore>;
}): Array<{ baseIndex: number; label: string }> {
    const windowType = getSmashUpReactionWindowContext(params.matchState)?.windowType;
    const candidateIndices = windowType === 'meFirst'
        ? getScoringEligibleBaseIndices(params.state)
        : params.state.bases.map((_, index) => index);

    return candidateIndices
        .map(baseIndex => {
            const base = params.state.bases[baseIndex];
            if (!base) return null;
            const baseDef = getBaseDef(base.defId);
            return {
                baseIndex,
                label: baseDef?.name ?? `基地 ${baseIndex + 1}`,
            };
        })
        .filter((candidate): candidate is { baseIndex: number; label: string } => candidate !== null);
}

const elderThingPriceOfPowerPodChooseBasePromptProgram = createPromptProgram<ElderThingPriceOfPowerPodChooseBasePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'elder_thing_the_price_of_power_pod_choose_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `elder_thing_the_price_of_power_pod_choose_base_${context.now}`,
        context.playerId,
        '力量的代价：选择一个基地',
        buildBaseTargetOptions(
            getPriceOfPowerPodCandidateBases({
                state: context.matchState.core,
                matchState: context.matchState,
            }),
            context.matchState.core,
        ),
        {
            sourceId: 'elder_thing_the_price_of_power_pod_choose_base',
            titleKey: 'ui.elder_thing_the_price_of_power_pod_choose_base_title',
            targetType: 'base',
        },
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const baseIndex = (value as { baseIndex?: number } | undefined)?.baseIndex;
        if (baseIndex === undefined) {
            return { events: [] };
        }
        return applyPriceOfPower({
            state: state.core,
            matchState: state,
            playerId: context.playerId,
            cardUid: context.cardUid,
            defId: 'elder_thing_the_price_of_power_pod',
            baseIndex,
            random,
            now: timestamp,
        }, {
            sourceId: 'elder_thing_the_price_of_power_pod',
            perMadnessCounterAmount: context.perMadnessCounterAmount,
            baseIndex,
        });
    },
});

const elderThingPriceOfPowerPodOnPlayProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const perMadnessCounterAmount = 1;
    const resolvedBaseIndex = resolvePriceOfPowerPodBaseIndex(ctx);
    if (resolvedBaseIndex !== undefined) {
        return applyPriceOfPower(ctx, {
            sourceId: 'elder_thing_the_price_of_power_pod',
            perMadnessCounterAmount,
            baseIndex: resolvedBaseIndex,
        });
    }

    const candidates = getPriceOfPowerPodCandidateBases(ctx);
    if (candidates.length === 0) {
        return { events: [] };
    }

    return {
        events: [],
        context: createElderThingPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            cardUid: ctx.cardUid,
            perMadnessCounterAmount,
        }) satisfies ElderThingPriceOfPowerPodChooseBasePromptContext,
        nextProgram: elderThingPriceOfPowerPodChooseBasePromptProgram,
    };
});


/** 邓威奇恐怖触发：回合结束时消灭附着了此卡的随从 */
function elderThingDunwichHorrorTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.sourceCardUid) {
        const candidateBases = ctx.sourceBaseIndex !== undefined
            ? [{ base: ctx.state.bases[ctx.sourceBaseIndex], baseIndex: ctx.sourceBaseIndex }]
            : ctx.state.bases.map((base, baseIndex) => ({ base, baseIndex }));
        for (const { base, baseIndex } of candidateBases) {
            const host = base?.minions.find(minion => minion.attachedActions.some(action =>
                action.uid === ctx.sourceCardUid && matchesDefId(action.defId, 'elder_thing_dunwich_horror')));
            if (!host) continue;
            const horror = host.attachedActions.find(action =>
                action.uid === ctx.sourceCardUid && matchesDefId(action.defId, 'elder_thing_dunwich_horror'));
            if (!horror) return [];
            const destroyerId = (horror.metadata?.sourceControllerId as PlayerId | undefined) ?? horror.ownerId;
            if (destroyerId !== ctx.playerId) return [];
            return buildValidatedDestroyEvents(ctx.state, {
                minionUid: host.uid,
                minionDefId: host.defId,
                fromBaseIndex: baseIndex,
                destroyerId,
                reason: 'elder_thing_dunwich_horror',
                now: ctx.now,
                sourcePlayerId: destroyerId,
                sourceCardUid: horror.uid,
                sourceDefId: horror.defId,
                sourceControllerId: destroyerId,
                sourceBaseIndex: baseIndex,
            });
        }
        return [];
    }

    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            const horror = m.attachedActions.find((a) =>
                matchesDefId(a.defId, 'elder_thing_dunwich_horror')
                && ((a.metadata?.sourceControllerId as PlayerId | undefined) ?? a.ownerId) === ctx.playerId,
            );
            if (!horror) continue;
            const destroyerId = horror.metadata?.sourceControllerId ?? horror.ownerId;
            events.push(...buildValidatedDestroyEvents(ctx.state, {
                minionUid: m.uid,
                minionDefId: m.defId,
                fromBaseIndex: i,
                destroyerId,
                reason: 'elder_thing_dunwich_horror',
                now: ctx.now,
                sourcePlayerId: destroyerId,
                sourceCardUid: horror.uid,
                sourceDefId: horror.defId,
                sourceControllerId: destroyerId,
                sourceBaseIndex: i,
            }));
        }
    }
    return events;
}




