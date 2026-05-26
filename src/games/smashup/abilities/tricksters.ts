/**
 * 大杀四方 - 诡术师派系能力
 *
 * 主题：陷阱、干扰对手、消灭随从
 */

import { registerAbility, registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    destroyMinion,
    getMinionPower,
    buildMinionTargetOptions,
    grantContextualExtraMinion,
    buildAbilityFeedback,
    createSkipOption,
    buildStandardDrawEvents,
    isSpecialLimitBlocked,
    emitSpecialLimitUsed,
} from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type {
    CardInstance,
    CardsDiscardedEvent,
    OngoingDetachedEvent,
    SmashUpEvent,
    PowerCounterAddedEvent,
    BreakpointModifiedEvent,
} from '../domain/types';
import type { MinionCardDef } from '../domain/types';
import { matchesDefId } from '../domain/utils';
import { registerInterceptor, registerProtection, registerRestriction, registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import { getCardDef } from '../data/cards';
import { FACTION_DISPLAY_NAMES } from '../domain/ids';
import { getOpponentLabel } from '../domain/utils';
import type { MatchState, PlayerId } from '../../../engine/types';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';

type TricksterPromptContext = {
    matchState: MatchState<any>;
    playerId: PlayerId;
    now: number;
};

type TricksterBlockThePathPromptContext = TricksterPromptContext & {
    cardUid: string;
    baseIndex: number;
};

type TricksterBlockThePathPodPromptContext = TricksterPromptContext & {
    cardUid: string;
    baseIndex: number;
};

type TricksterHideoutPodSwapPromptContext = TricksterPromptContext & {
    baseIndex: number;
    hideoutUid: string;
};

type TricksterHideoutPodDestroyPromptContext = TricksterPromptContext & {
    baseIndex: number;
};

type TricksterPixiePodMinionPromptContext = TricksterPromptContext & {
    baseIndex: number;
};

type TricksterFlameTrapPodPromptContext = TricksterPromptContext & {
    baseIndex: number;
    trapUid: string;
};

type TricksterGnomePromptContext = TricksterPromptContext & {
    baseIndex: number;
    cardUid: string;
};

function createTricksterPromptContext<TExtra extends Record<string, unknown> = Record<string, never>>(
    matchState: MatchState<any>,
    playerId: PlayerId,
    now: number,
    extra?: TExtra,
): TricksterPromptContext & TExtra {
    return {
        matchState,
        playerId,
        now,
        ...(extra ?? {} as TExtra),
    };
}

function isDestroyPipelineDiscardTrigger(ctx: TriggerContext): boolean {
    return typeof ctx.sourceEventId === 'string' && ctx.sourceEventId.startsWith('minion-discarded-from-base:');
}

function buildTricksterGnomePromptOptions(
    state: AbilityContext['state'],
    playerId: PlayerId,
    baseIndex: number,
    cardUid: string,
) {
    const base = state.bases[baseIndex];
    if (!base) {
        return { candidates: [], options: [createSkipOption()] as any[] };
    }

    const myMinionCount = base.minions.filter(m => m.controller === playerId).length;
    const candidates = base.minions.filter(
        m => m.uid !== cardUid && getMinionPower(state, m, baseIndex) < myMinionCount,
    );
    const options = buildMinionTargetOptions(
        candidates.map((target) => {
            const def = getCardDef(target.defId) as MinionCardDef | undefined;
            const name = def?.name ?? target.defId;
            const power = getMinionPower(state, target, baseIndex);
            return { uid: target.uid, defId: target.defId, baseIndex, label: `${name} (力量 ${power})` };
        }),
        { state, sourcePlayerId: playerId, effectType: 'destroy' },
    );
    return { candidates, options: [...options, createSkipOption()] as any[] };
}

function collectDisenchantTargets(state: AbilityContext['state']): Array<{ uid: string; defId: string; ownerId: string; label: string }> {
    const targets: Array<{ uid: string; defId: string; ownerId: string; label: string }> = [];
    for (let index = 0; index < state.bases.length; index += 1) {
        const base = state.bases[index];
        for (const ongoing of base.ongoingActions) {
            const def = getCardDef(ongoing.defId);
            const name = def?.name ?? ongoing.defId;
            targets.push({ uid: ongoing.uid, defId: ongoing.defId, ownerId: ongoing.ownerId, label: `${name} (基地行动)` });
        }
        for (const minion of base.minions) {
            for (const attached of minion.attachedActions) {
                const def = getCardDef(attached.defId);
                const name = def?.name ?? attached.defId;
                targets.push({ uid: attached.uid, defId: attached.defId, ownerId: attached.ownerId, label: `${name} (附着行动)` });
            }
        }
    }
    return targets;
}

function collectBlockThePathFactions(state: AbilityContext['state']): string[] {
    const factionSet = new Set<string>();
    for (const base of state.bases) {
        for (const minion of base.minions) {
            const def = getCardDef(minion.defId);
            if (def?.faction) factionSet.add(def.faction);
        }
    }
    for (const pid of state.turnOrder) {
        const player = state.players[pid];
        for (const card of player.hand) {
            const def = getCardDef(card.defId);
            if (def?.faction) factionSet.add(def.faction);
        }
    }
    return Array.from(factionSet);
}

const tricksterDisenchantPromptProgram = createPromptProgram<TricksterPromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'trickster_disenchant',
    buildInteraction: (context) => {
        const targets = collectDisenchantTargets(context.matchState.core);
        const options = targets.map((target, index) => ({
            id: `action-${index}`,
            label: target.label,
            value: { cardUid: target.uid, defId: target.defId, ownerId: target.ownerId },
            _source: 'ongoing' as const,
            displayMode: 'card' as const,
        }));
        return createAbilityRuntimeSimpleChoice(
            `trickster_disenchant_${context.now}`,
            context.playerId,
            '选择要消灭的行动牌',
            options as any[],
            { sourceId: 'trickster_disenchant', targetType: 'ongoing' },
        );
    },
    onResolve: ({ value, timestamp }) => {
        const selected = value as { cardUid?: string; defId?: string; ownerId?: string } | undefined;
        if (!selected?.cardUid || !selected.defId || !selected.ownerId) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: selected.cardUid,
                    defId: selected.defId,
                    ownerId: selected.ownerId,
                    reason: 'trickster_disenchant',
                },
                timestamp,
            } as OngoingDetachedEvent],
        };
    },
});

const tricksterBlockThePathPromptProgram = createPromptProgram<TricksterBlockThePathPromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'trickster_block_the_path',
    buildInteraction: (context) => {
        const options = collectBlockThePathFactions(context.matchState.core).map((factionId, index) => ({
            id: `faction-${index}`,
            label: FACTION_DISPLAY_NAMES[factionId] || factionId,
            value: { factionId },
        }));
        return createAbilityRuntimeSimpleChoice(
            `trickster_block_the_path_${context.now}`,
            context.playerId,
            '封路：选择一个派系（该派系随从不能被打出到此基地）',
            options as any[],
            { sourceId: 'trickster_block_the_path', targetType: 'generic', autoCancelOption: true },
        );
    },
    onResolve: ({ context, state, value }) => {
        if ((value as { __cancel__?: boolean } | undefined)?.__cancel__) return { events: [] };
        const factionId = (value as { factionId?: string } | undefined)?.factionId;
        if (!factionId) return { events: [] };
        const newBases = state.core.bases.map((base, index) => {
            if (index !== context.baseIndex) return base;
            return {
                ...base,
                ongoingActions: base.ongoingActions.map((ongoing) => {
                    if (ongoing.uid !== context.cardUid) return ongoing;
                    return { ...ongoing, metadata: { blockedFaction: factionId } };
                }),
            };
        });
        return {
            events: [],
            matchState: { ...state, core: { ...state.core, bases: newBases } },
        };
    },
});

const tricksterMarkOfSleepPromptProgram = createPromptProgram<TricksterPromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'trickster_mark_of_sleep',
    buildInteraction: (context) => {
        const options = context.matchState.core.turnOrder.map((pid, index) => ({
            id: `player-${index}`,
            label: pid === context.playerId ? '你自己' : getOpponentLabel(pid),
            value: { pid },
        }));
        return createAbilityRuntimeSimpleChoice(
            `trickster_mark_of_sleep_${context.now}`,
            context.playerId,
            '选择一个玩家（其下回合不能打行动卡）',
            options as any[],
            { sourceId: 'trickster_mark_of_sleep', targetType: 'player', autoCancelOption: true },
        );
    },
    onResolve: ({ state, value }) => {
        if ((value as { __cancel__?: boolean } | undefined)?.__cancel__) return { events: [] };
        const pid = (value as { pid?: string } | undefined)?.pid;
        if (!pid) return { events: [] };
        const currentMarked = state.core.sleepMarkedPlayers ?? [];
        if (currentMarked.includes(pid)) return { events: [] };
        return {
            events: [],
            matchState: {
                ...state,
                core: {
                    ...state.core,
                    sleepMarkedPlayers: [...currentMarked, pid],
                },
            },
        };
    },
});

const tricksterMarkOfSleepPodPromptProgram = createPromptProgram<TricksterPromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'trickster_mark_of_sleep_pod',
    buildInteraction: (context) => {
        const otherPlayers = context.matchState.core.turnOrder.filter(pid => pid !== context.playerId);
        const combos: { noActions: string[]; noMove: string[]; label: string }[] = [];
        const total = 1 << otherPlayers.length;
        for (let mask = 0; mask < total; mask += 1) {
            const noActions: string[] = [];
            const noMove: string[] = [];
            const parts: string[] = [];
            for (let index = 0; index < otherPlayers.length; index += 1) {
                const pid = otherPlayers[index];
                const pickNoActions = ((mask >> index) & 1) === 1;
                if (pickNoActions) {
                    noActions.push(pid);
                    parts.push(`${getOpponentLabel(pid)}：不能打战术`);
                } else {
                    noMove.push(pid);
                    parts.push(`${getOpponentLabel(pid)}：不能移动随从`);
                }
            }
            combos.push({ noActions, noMove, label: parts.join('；') });
        }
        const options = combos.map((combo, index) => ({
            id: `combo-${index}`,
            label: combo.label,
            value: { noActions: combo.noActions, noMove: combo.noMove },
        }));
        return createAbilityRuntimeSimpleChoice(
            `trickster_mark_of_sleep_pod_${context.now}`,
            context.playerId,
            '睡眠印记：为每个对手选择限制（持续到你下回合开始）',
            options as any[],
            { sourceId: 'trickster_mark_of_sleep_pod', targetType: 'player', autoCancelOption: true },
        );
    },
    onResolve: ({ state, value }) => {
        if ((value as { __cancel__?: boolean } | undefined)?.__cancel__) return { events: [] };
        const selected = value as { noActions?: string[]; noMove?: string[] } | undefined;
        const noActions = selected?.noActions ?? [];
        const noMove = selected?.noMove ?? [];
        const expiresOnTurnNumber = state.core.turnNumber + state.core.turnOrder.length;
        return {
            events: [],
            matchState: {
                ...state,
                core: {
                    ...state.core,
                    sleepMarkedPlayers: noActions.length ? noActions : undefined,
                    sleepMoveMarkedPlayers: noMove.length ? noMove : undefined,
                    sleepMarkExpiresOnTurnNumber: expiresOnTurnNumber,
                } as any,
            },
        };
    },
});

function isPlayOnBaseOngoingAction(defId: string): boolean {
    const def = getCardDef(defId);
    return def?.type === 'action' && def.subtype === 'ongoing' && ((def.ongoingTarget ?? 'base') === 'base');
}

function buildHideoutPodSwapOptions(state: AbilityContext['state'], playerId: PlayerId) {
    const player = state.players[playerId];
    if (!player) return [];

    return [
        ...player.hand
            .filter(card => card.type === 'action' && isPlayOnBaseOngoingAction(card.defId))
            .map((card, index) => {
                const def = getCardDef(card.defId);
                return {
                    id: `hand-${index}`,
                    label: `手牌：${def?.name ?? card.defId}`,
                    value: { zone: 'hand' as const, cardUid: card.uid, defId: card.defId },
                    _source: 'hand' as const,
                    displayMode: 'card' as const,
                };
            }),
        ...player.deck
            .filter(card => card.type === 'action' && isPlayOnBaseOngoingAction(card.defId))
            .map((card, index) => {
                const def = getCardDef(card.defId);
                return {
                    id: `deck-${index}`,
                    label: `牌库：${def?.name ?? card.defId}`,
                    value: { zone: 'deck' as const, cardUid: card.uid, defId: card.defId },
                    _source: 'deck' as const,
                    displayMode: 'card' as const,
                };
            }),
        createSkipOption() as any,
    ];
}

function buildTricksterControlledMinionOptions(
    state: AbilityContext['state'],
    playerId: PlayerId,
) {
    const options: Array<{
        id: string;
        label: string;
        value: { minionUid: string; baseIndex: number };
        _source: 'minion';
        displayMode: 'card';
    }> = [];

    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        const base = state.bases[baseIndex];
        for (const minion of base.minions) {
            if (minion.controller !== playerId) continue;
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            const name = def?.name ?? minion.defId;
            const power = getMinionPower(state, minion, baseIndex);
            options.push({
                id: `minion-${options.length}`,
                label: `${name} (力量 ${power})`,
                value: { minionUid: minion.uid, baseIndex },
                _source: 'minion',
                displayMode: 'card',
            });
        }
    }

    return options;
}

function buildTricksterBaseControlledMinionOptions(
    state: AbilityContext['state'],
    playerId: PlayerId,
    baseIndex: number,
) {
    const base = state.bases[baseIndex];
    if (!base) return [];

    return base.minions
        .filter(minion => minion.controller === playerId)
        .map((minion, index) => {
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            const name = def?.name ?? minion.defId;
            const power = getMinionPower(state, minion, baseIndex);
            return {
                id: `minion-${index}`,
                label: `${name} (力量 ${power})`,
                value: { minionUid: minion.uid, baseIndex },
                _source: 'minion' as const,
                displayMode: 'card' as const,
            };
        });
}

function buildHideoutPodDestroyOptions(
    state: AbilityContext['state'],
    baseIndex: number,
) {
    const base = state.bases[baseIndex];
    if (!base) return [];

    return [
        ...base.minions
            .filter(minion => getMinionPower(state, minion, baseIndex) <= 2)
            .map((minion, index) => {
                const def = getCardDef(minion.defId) as MinionCardDef | undefined;
                const name = def?.name ?? minion.defId;
                const power = getMinionPower(state, minion, baseIndex);
                return {
                    id: `minion-${index}`,
                    label: `${name} (战斗力 ${power})`,
                    value: { minionUid: minion.uid, baseIndex },
                    _source: 'minion' as const,
                    displayMode: 'card' as const,
                };
            }),
        createSkipOption() as any,
    ];
}

function buildBlockThePathPodCombos(
    state: AbilityContext['state'],
    playerId: PlayerId,
): Array<{ blocked: Record<string, string>; label: string }> {
    const opponents = state.turnOrder
        .filter(pid => pid !== playerId)
        .map(pid => ({
            pid,
            factions: (state.players[pid]?.factions ?? []).filter(Boolean) as string[],
        }));

    if (opponents.length === 0 || opponents.some(entry => entry.factions.length === 0)) {
        return [];
    }

    const combos: Array<{ blocked: Record<string, string>; label: string }> = [];
    const walk = (
        index: number,
        blocked: Record<string, string>,
        labels: string[],
    ) => {
        if (index >= opponents.length) {
            combos.push({ blocked: { ...blocked }, label: labels.join('；') });
            return;
        }

        const { pid, factions } = opponents[index];
        for (const factionId of factions) {
            blocked[pid] = factionId;
            labels.push(`${getOpponentLabel(pid)}：${FACTION_DISPLAY_NAMES[factionId] ?? factionId}`);
            walk(index + 1, blocked, labels);
            labels.pop();
            delete blocked[pid];
        }
    };

    walk(0, {}, []);
    return combos;
}

const tricksterHideoutPodDestroyPromptProgram = createPromptProgram<TricksterHideoutPodDestroyPromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'trickster_hideout_pod_destroy',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `trickster_hideout_pod_destroy_${context.now}`,
        context.playerId,
        '藏身处：你可以消灭这里一个战斗力≤2的随从（或跳过）',
        buildHideoutPodDestroyOptions(context.matchState.core, context.baseIndex) as any[],
        { sourceId: 'trickster_hideout_pod_destroy', targetType: 'minion' },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        if (!target) return { events: [] };
        return {
            events: [destroyMinion(target.uid, target.defId, selected.baseIndex, target.owner, playerId, 'trickster_hideout_pod', timestamp)],
        };
    },
});

const tricksterHideoutPodSwapPromptProgram = createPromptProgram<TricksterHideoutPodSwapPromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'trickster_hideout_pod_swap',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `trickster_hideout_pod_swap_${context.now}`,
        context.playerId,
        '藏身处：选择要交换进来的“打出到基地上”的持续战术（或跳过）',
        buildHideoutPodSwapOptions(context.matchState.core, context.playerId) as any[],
        { sourceId: 'trickster_hideout_pod_swap', targetType: 'generic' },
    ),
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        if ((value as { __cancel__?: boolean } | undefined)?.__cancel__) return { events: [] };

        const selected = value as { zone?: 'hand' | 'deck'; cardUid?: string; defId?: string } | undefined;
        if (!selected?.zone || !selected.cardUid || !selected.defId) return { events: [] };

        const base = state.core.bases[context.baseIndex];
        const hideout = base?.ongoingActions.find(ongoing => ongoing.uid === context.hideoutUid);
        const player = state.core.players[playerId];
        if (!base || !hideout || !player) return { events: [] };
        const selectedCard = selected.zone === 'hand'
            ? player.hand.find(card => card.uid === selected.cardUid && card.defId === selected.defId)
            : player.deck.find(card => card.uid === selected.cardUid && card.defId === selected.defId);
        if (!selectedCard) return { events: [] };

        const nextHand = selected.zone === 'hand'
            ? player.hand.filter(card => card.uid !== selected.cardUid)
            : player.hand;
        const nextDeckWithoutSelection = selected.zone === 'deck'
            ? player.deck.filter(card => card.uid !== selected.cardUid)
            : player.deck;
        const hideoutCard: CardInstance = {
            uid: hideout.uid,
            defId: hideout.defId,
            type: 'action',
            owner: hideout.ownerId,
        };
        const updatedDeck = selected.zone === 'deck'
            ? ((random.shuffle
                ? random.shuffle([...nextDeckWithoutSelection, hideoutCard])
                : [...nextDeckWithoutSelection, hideoutCard]) as CardInstance[])
            : nextDeckWithoutSelection;

        const nextState: MatchState<AbilityContext['state']> = {
            ...state,
            core: {
                ...state.core,
                bases: state.core.bases.map((currentBase, index) => {
                    if (index !== context.baseIndex) return currentBase;
                    return {
                        ...currentBase,
                        ongoingActions: [
                            ...currentBase.ongoingActions.filter(ongoing => ongoing.uid !== context.hideoutUid),
                            { uid: selected.cardUid!, defId: selected.defId!, ownerId: selectedCard.owner, talentUsed: false },
                        ],
                    };
                }),
                players: {
                    ...state.core.players,
                    [playerId]: {
                        ...player,
                        hand: selected.zone === 'hand'
                            ? [...nextHand, hideoutCard]
                            : nextHand,
                        deck: updatedDeck,
                    },
                },
            },
        };

        const events: SmashUpEvent[] = [];
        if (selected.zone === 'deck') {
            events.push({
                type: SU_EVENTS.DECK_REORDERED,
                payload: { playerId, deckUids: updatedDeck.map(card => card.uid) },
                timestamp,
            } as any);
        }

        const destroyOptions = buildHideoutPodDestroyOptions(nextState.core, context.baseIndex);
        if (destroyOptions.length <= 1) {
            return { events, matchState: nextState };
        }

        return {
            events,
            matchState: nextState,
            context: createTricksterPromptContext(nextState, playerId, timestamp, {
                baseIndex: context.baseIndex,
            }) satisfies TricksterHideoutPodDestroyPromptContext,
            nextProgram: tricksterHideoutPodDestroyPromptProgram,
        };
    },
});

const tricksterPixiePodMinionPromptProgram = createPromptProgram<TricksterPixiePodMinionPromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'trickster_pixie_pod_minion',
    buildInteraction: (context) => {
        const options = buildTricksterBaseControlledMinionOptions(context.matchState.core, context.playerId, context.baseIndex);
        return createAbilityRuntimeSimpleChoice(
            `trickster_pixie_pod_minion_${context.now}`,
            context.playerId,
            '小精灵：选择任意数量己方随从放置 +1 力量指示物（可不选）',
            options as any[],
            {
                sourceId: 'trickster_pixie_pod_minion',
                targetType: 'minion',
                multi: { min: 0, max: options.length },
            },
        );
    },
    onResolve: ({ value, timestamp }) => {
        const selections = (Array.isArray(value) ? value : [value]) as Array<{ minionUid?: string; baseIndex?: number }>;
        const valid = selections.filter(selection => selection.minionUid && selection.baseIndex !== undefined) as Array<{ minionUid: string; baseIndex: number }>;
        return {
            events: valid.map(selection => ({
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: { minionUid: selection.minionUid, baseIndex: selection.baseIndex, amount: 1, reason: 'trickster_pixie_pod_minion' },
                timestamp,
            } as PowerCounterAddedEvent)),
        };
    },
});

const tricksterPixiePodActionCountersPromptProgram = createPromptProgram<TricksterPromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'trickster_pixie_pod_action_counters',
    buildInteraction: (context) => {
        const options = buildTricksterControlledMinionOptions(context.matchState.core, context.playerId);
        return createAbilityRuntimeSimpleChoice(
            `trickster_pixie_pod_action_counters_${context.now}`,
            context.playerId,
            '小精灵（战术）：选择 1-2 个己方随从放置两枚 +1 指示物',
            options as any[],
            {
                sourceId: 'trickster_pixie_pod_action_counters',
                targetType: 'minion',
                multi: { min: 1, max: Math.min(2, options.length) },
            },
        );
    },
    onResolve: ({ value, timestamp }) => {
        const selections = (Array.isArray(value) ? value : [value]) as Array<{ minionUid?: string; baseIndex?: number }>;
        const valid = selections.filter(selection => selection.minionUid && selection.baseIndex !== undefined) as Array<{ minionUid: string; baseIndex: number }>;
        if (valid.length === 0) return { events: [] };

        if (valid.length === 1) {
            return {
                events: [{
                    type: SU_EVENTS.POWER_COUNTER_ADDED,
                    payload: { minionUid: valid[0].minionUid, baseIndex: valid[0].baseIndex, amount: 2, reason: 'trickster_pixie_pod_action' },
                    timestamp,
                } as PowerCounterAddedEvent],
            };
        }

        return {
            events: valid.slice(0, 2).map(selection => ({
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: { minionUid: selection.minionUid, baseIndex: selection.baseIndex, amount: 1, reason: 'trickster_pixie_pod_action' },
                timestamp,
            } as PowerCounterAddedEvent)),
        };
    },
});

const tricksterPixiePodActionDestroyPromptProgram = createPromptProgram<TricksterPromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'trickster_pixie_pod_action_destroy',
    buildInteraction: (context) => {
        const targets = collectDisenchantTargets(context.matchState.core);
        return createAbilityRuntimeSimpleChoice(
            `trickster_pixie_pod_action_destroy_${context.now}`,
            context.playerId,
            '小精灵（战术）：选择要消灭的已打出战术',
            targets.map((target, index) => ({
                id: `action-${index}`,
                label: target.label,
                value: { cardUid: target.uid, defId: target.defId, ownerId: target.ownerId },
                _source: 'ongoing' as const,
                displayMode: 'card' as const,
            })) as any[],
            { sourceId: 'trickster_pixie_pod_action_destroy', targetType: 'ongoing', autoCancelOption: true },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        if ((value as { __cancel__?: boolean } | undefined)?.__cancel__) return { events: [] };
        const selected = value as { cardUid?: string; defId?: string; ownerId?: string } | undefined;
        if (!selected?.cardUid || !selected.defId || !selected.ownerId) return { events: [] };

        const events: SmashUpEvent[] = [{
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: { cardUid: selected.cardUid, defId: selected.defId, ownerId: selected.ownerId, reason: 'trickster_pixie_pod_action' },
            timestamp,
        } as OngoingDetachedEvent];

        const nextOptions = buildTricksterControlledMinionOptions(state.core, playerId);
        if (nextOptions.length === 0) {
            return { events };
        }

        return {
            events,
            context: createTricksterPromptContext(state, playerId, timestamp),
            nextProgram: tricksterPixiePodActionCountersPromptProgram,
        };
    },
});

const tricksterBlockThePathPodPromptProgram = createPromptProgram<TricksterBlockThePathPodPromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'trickster_block_the_path_pod',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `trickster_block_the_path_pod_${context.now}`,
        context.playerId,
        '通路禁止：为每个对手指定一个派系',
        buildBlockThePathPodCombos(context.matchState.core, context.playerId).map((combo, index) => ({
            id: `combo-${index}`,
            label: combo.label,
            value: { blocked: combo.blocked },
        })) as any[],
        { sourceId: 'trickster_block_the_path_pod', targetType: 'option', autoCancelOption: true },
    ),
    onResolve: ({ context, state, value }) => {
        if ((value as { __cancel__?: boolean } | undefined)?.__cancel__) return { events: [] };
        const blocked = (value as { blocked?: Record<string, string> } | undefined)?.blocked;
        if (!blocked) return { events: [] };

        const updatedBases = state.core.bases.map((base, index) => {
            if (index !== context.baseIndex) return base;
            return {
                ...base,
                ongoingActions: base.ongoingActions.map((ongoing) => {
                    if (ongoing.uid !== context.cardUid) return ongoing;
                    return { ...ongoing, metadata: { ...(ongoing.metadata ?? {}), blockedFactionsByPlayer: blocked } };
                }),
            };
        });

        return {
            events: [],
            matchState: { ...state, core: { ...state.core, bases: updatedBases } },
        };
    },
});

const tricksterFlameTrapPodBreakpointPromptProgram = createPromptProgram<TricksterFlameTrapPodPromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'trickster_flame_trap_pod_bp',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `trickster_flame_trap_pod_bp_${context.now}`,
        context.playerId,
        '火焰陷阱：是否降低此基地爆分线？',
        [
            { id: 'yes', label: '是（本回合该基地 breakpoint -4）', value: { yes: true }, displayMode: 'button' as const },
            { id: 'no', label: '否', value: { yes: false }, displayMode: 'button' as const },
        ],
        { sourceId: 'trickster_flame_trap_pod_bp', targetType: 'option', autoCancelOption: false },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        if ((value as { yes?: boolean } | undefined)?.yes !== true) return { events: [] };
        const trap = state.core.bases[context.baseIndex]?.ongoingActions.find(ongoing => ongoing.uid === context.trapUid);
        if (!trap) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.BREAKPOINT_MODIFIED,
                payload: { baseIndex: context.baseIndex, delta: -4, reason: 'trickster_flame_trap_pod' },
                timestamp,
            } as BreakpointModifiedEvent],
        };
    },
});

const tricksterGnomePromptProgram = createPromptProgram<TricksterGnomePromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'trickster_gnome',
    buildInteraction: (context) => {
        const { options } = buildTricksterGnomePromptOptions(
            context.matchState.core,
            context.playerId,
            context.baseIndex,
            context.cardUid,
        );
        return createAbilityRuntimeSimpleChoice(
            `trickster_gnome_${context.now}`,
            context.playerId,
            '选择要消灭的随从（力量低于己方随从数量），或跳过',
            options,
            { sourceId: 'trickster_gnome', targetType: 'minion' },
        );
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selectedUid = (value as { minionUid?: string } | undefined)?.minionUid;
        if (!selectedUid) return { events: [] };

        const { candidates } = buildTricksterGnomePromptOptions(
            state.core,
            context.playerId,
            context.baseIndex,
            context.cardUid,
        );
        const target = candidates.find(m => m.uid === selectedUid);
        if (!target) return { events: [] };

        return {
            events: [destroyMinion(target.uid, target.defId, context.baseIndex, target.owner, playerId, 'trickster_gnome', timestamp)],
        };
    },
});

const tricksterGnomePodPromptProgram = createPromptProgram<TricksterGnomePromptContext, AbilityContext['state'], SmashUpEvent>({
    sourceId: 'trickster_gnome_pod',
    buildInteraction: (context) => {
        const { options } = buildTricksterGnomePromptOptions(
            context.matchState.core,
            context.playerId,
            context.baseIndex,
            context.cardUid,
        );
        return createAbilityRuntimeSimpleChoice(
            `trickster_gnome_pod_${context.now}`,
            context.playerId,
            '侏儒：你可以消灭这里一个力量低于你在此基地随从数量的随从（或跳过）',
            options,
            { sourceId: 'trickster_gnome_pod', targetType: 'minion' },
        );
    },
    onResolve: ({ context, state, value, timestamp, playerId }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selectedUid = (value as { minionUid?: string } | undefined)?.minionUid;
        if (!selectedUid) return { events: [] };

        const { candidates } = buildTricksterGnomePromptOptions(
            state.core,
            context.playerId,
            context.baseIndex,
            context.cardUid,
        );
        const target = candidates.find(m => m.uid === selectedUid);
        if (!target) return { events: [] };

        return {
            events: [destroyMinion(target.uid, target.defId, context.baseIndex, target.owner, playerId, 'trickster_gnome_pod', timestamp)],
        };
    },
});

/** 侏儒 onPlay：消灭力量低于己方随从数量的随从 */
function tricksterGnome(ctx: AbilityContext): AbilityResult {
    const { candidates } = buildTricksterGnomePromptOptions(ctx.state, ctx.playerId, ctx.baseIndex, ctx.cardUid);
    if (candidates.length === 0) {
        return { events: [] };
    }
    const result = executeAbilityProgram(
        tricksterGnomePromptProgram,
        createTricksterPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            baseIndex: ctx.baseIndex,
            cardUid: ctx.cardUid,
        }) satisfies TricksterGnomePromptContext,
    );
    return { events: result.events, matchState: result.matchState };
}

/** 带走宝物 onPlay：每个其他玩家随机弃两张手牌 */
function tricksterTakeTheShinies(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const player = ctx.state.players[pid];
        if (player.hand.length === 0) continue;

        // 随机选择至多2?
        const handCopy = [...player.hand];
        const discardUids: string[] = [];
        const count = Math.min(2, handCopy.length);
        for (let i = 0; i < count; i++) {
            const idx = Math.floor(ctx.random.random() * handCopy.length);
            discardUids.push(handCopy[idx].uid);
            handCopy.splice(idx, 1);
        }

        const evt: CardsDiscardedEvent = {
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId: pid, cardUids: discardUids },
            timestamp: ctx.now,
        };
        events.push(evt);
    }
    return { events };
}

/** 隐蔽迷雾 onPlay：打出当回合给予额外随从（与大法师同理，ongoing 能力在进入场上时生效） */
function tricksterEnshroudingMistOnPlay(ctx: AbilityContext): AbilityResult {
    return {
        events: [grantContextualExtraMinion(ctx, 'trickster_enshrouding_mist', ctx.baseIndex)],
    };
}

/** 注册诡术师派系所有能力*/
export function registerTricksterAbilities(): void {
    registerAbility('trickster_gnome', 'onPlay', tricksterGnome);
    // 带走宝物（行动卡）：每个对手随机弃两张手牌
    registerAbility('trickster_take_the_shinies', 'onPlay', tricksterTakeTheShinies);
    // 幻想破碎（行动卡）：消灭一个已打出的行动卡
    registerAbilityProgram('trickster_disenchant', 'onPlay', {
        program: createEffectProgram<AbilityContext, AbilityContext['state'], SmashUpEvent>((ctx) => {
            const targets = collectDisenchantTargets(ctx.state);
            if (targets.length === 0) {
                return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
            }
            return {
                events: [],
                context: createTricksterPromptContext(ctx.matchState, ctx.playerId, ctx.now),
                nextProgram: tricksterDisenchantPromptProgram,
            };
        }),
    });
    // 小妖精?onDestroy：被消灭后抽1张牌 + 对手随机?张牌
    registerAbility('trickster_gremlin', 'onDestroy', tricksterGremlinOnDestroy);
    // 沉睡印记（行动卡）：对手下回合不能打行动
    registerAbilityProgram('trickster_mark_of_sleep', 'onPlay', {
        program: createEffectProgram<AbilityContext, AbilityContext['state'], SmashUpEvent>((ctx) => ({
            events: [],
            context: createTricksterPromptContext(ctx.matchState, ctx.playerId, ctx.now),
            nextProgram: tricksterMarkOfSleepPromptProgram,
        })),
    });
    // 封路（ongoing）：打出时选择一个派系
    registerAbilityProgram('trickster_block_the_path', 'onPlay', {
        program: createEffectProgram<AbilityContext, AbilityContext['state'], SmashUpEvent>((ctx) => {
            const factions = collectBlockThePathFactions(ctx.state);
            if (factions.length === 0) {
                return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
            }
            return {
                events: [],
                context: createTricksterPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
                    cardUid: ctx.cardUid,
                    baseIndex: ctx.baseIndex,
                }),
                nextProgram: tricksterBlockThePathPromptProgram,
            };
        }),
    });
    // 隐蔽迷雾（ongoing）：打出当回合也给予额外随从（与大法师同理）
    registerAbility('trickster_enshrouding_mist', 'onPlay', tricksterEnshroudingMistOnPlay);

    // 注册 ongoing 拦截?
    registerTricksterOngoingEffects();
    registerTricksterPodAbilities();
}

function tricksterEnshroudingMistPodTalent(ctx: AbilityContext): AbilityResult {
    return {
        events: [grantContextualExtraMinion(ctx, 'trickster_enshrouding_mist_pod', ctx.baseIndex)],
    };
}

function tricksterGnomePodSpecial(ctx: AbilityContext): AbilityResult {
    if (isSpecialLimitBlocked(ctx.state, 'trickster_gnome_pod', ctx.baseIndex)) {
        return { events: [] };
    }
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const myCount = base.minions.filter(m => m.controller === ctx.playerId).length;
    if (myCount <= 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };

    const targets = base.minions.filter(
        m => m.uid !== ctx.cardUid && getMinionPower(ctx.state, m, ctx.baseIndex) < myCount,
    );
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    const limitEvt = emitSpecialLimitUsed(ctx.playerId, 'trickster_gnome_pod', ctx.baseIndex, ctx.now);
    const limitEvents = limitEvt ? [limitEvt] : [];

    const result = executeAbilityProgram(
        tricksterGnomePodPromptProgram,
        createTricksterPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            baseIndex: ctx.baseIndex,
            cardUid: ctx.cardUid,
        }) satisfies TricksterGnomePromptContext,
    );
    if (result.matchState) {
        return { events: [...limitEvents, ...result.events], matchState: result.matchState };
    }
    return { events: [...limitEvents, ...result.events] };
}

function registerTricksterPodAbilities(): void {
    registerAbility('trickster_take_the_shinies_pod', 'onPlay', tricksterTakeTheShinies);
    registerAbilityProgram('trickster_mark_of_sleep_pod', 'onPlay', {
        program: createEffectProgram<AbilityContext, AbilityContext['state'], SmashUpEvent>((ctx) => {
            const otherPlayers = ctx.state.turnOrder.filter(pid => pid !== ctx.playerId);
            if (otherPlayers.length === 0) return { events: [] };
            return {
                events: [],
                context: createTricksterPromptContext(ctx.matchState, ctx.playerId, ctx.now),
                nextProgram: tricksterMarkOfSleepPodPromptProgram,
            };
        }),
    });
    registerAbilityProgram('trickster_pixie_pod', 'onPlay', {
        program: createEffectProgram<AbilityContext, AbilityContext['state'], SmashUpEvent>(tricksterPixiePodOnPlay),
    });
    registerAbility('trickster_enshrouding_mist_pod', 'talent', tricksterEnshroudingMistPodTalent);
    registerAbilityProgram('trickster_hideout_pod', 'talent', {
        program: createEffectProgram<AbilityContext, AbilityContext['state'], SmashUpEvent>(tricksterHideoutPodTalent),
        validateUse: (ctx) => {
            const owner = ctx.state.players[ctx.playerId];
            if (!owner) return '当前条件不满足';

            const hasCandidate =
                owner.hand.some(card => card.type === 'action' && isPlayOnBaseOngoingAction(card.defId)) ||
                owner.deck.some(card => card.type === 'action' && isPlayOnBaseOngoingAction(card.defId));

            return hasCandidate ? null : '当前条件不满足';
        },
    });
    registerAbility('trickster_gnome_pod', 'special', tricksterGnomePodSpecial);
    registerAbility('trickster_gremlin_pod', 'onDestroy', () => ({ events: [] }));
    registerTricksterPodOngoingEffects();
}

function tricksterHideoutPodTalent(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const options = buildHideoutPodSwapOptions(ctx.state, ctx.playerId);
    if (options.length <= 1) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    }

    const result = executeAbilityProgram(
        tricksterHideoutPodSwapPromptProgram,
        createTricksterPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            baseIndex: ctx.baseIndex,
            hideoutUid: ctx.cardUid,
        }) satisfies TricksterHideoutPodSwapPromptContext,
    );
    return { events: result.events, matchState: result.matchState };
}

/** 注册诡术师派系的交互解决处理函数 */
export function registerTricksterInteractionHandlers(): void {
    // 已迁移到 abilityRuntime prompt program，保留空函数维持注册入口结构一致。
}

/** 小妖精?onDestroy：被消灭后抽1张牌 + 每个对手随机?张牌 */
function tricksterGremlinOnDestroy(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];

    // ?张牌
    events.push(...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now));

    // 每个对手随机?张牌
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const opponent = ctx.state.players[pid];
        if (!opponent || opponent.hand.length === 0) continue;
        const idx = Math.floor(ctx.random.random() * opponent.hand.length);
        const discardUid = opponent.hand[idx].uid;
        events.push({
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId: pid, cardUids: [discardUid] },
            timestamp: ctx.now,
        } as CardsDiscardedEvent);
    }

    return { events };
}

function tricksterPixiePodOnPlay(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };

    // 判定当前 pixie 是否作为随从在该基地上（融合卡：通过 uid 在 minions 中存在来区分）
    const isPixieMinion = base.minions.some(m => m.uid === ctx.cardUid);
    if (isPixieMinion) {
        // 条件：手牌张数 > 至少一名其他玩家
        const me = ctx.state.players[ctx.playerId];
        if (!me) return { events: [] };
        const myHand = me.hand.length;
        const hasLessOpponent = ctx.state.turnOrder
            .filter(pid => pid !== ctx.playerId)
            .some(pid => (ctx.state.players[pid]?.hand.length ?? 0) < myHand);
        if (!hasLessOpponent) {
            return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
        }

        const options = buildTricksterBaseControlledMinionOptions(ctx.state, ctx.playerId, ctx.baseIndex);
        if (options.length === 0) return { events: [] };
        const result = executeAbilityProgram(
            tricksterPixiePodMinionPromptProgram,
            createTricksterPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
                baseIndex: ctx.baseIndex,
            }) satisfies TricksterPixiePodMinionPromptContext,
        );
        return { events: result.events, matchState: result.matchState };
    }

    // Pixie as action: choose an action in play to destroy, then distribute two +1 counters among your minions
    const targets = collectDisenchantTargets(ctx.state);
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const result = executeAbilityProgram(
        tricksterPixiePodActionDestroyPromptProgram,
        createTricksterPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

// executeMarkOfSleep 已移除，沉睡印记改为标记模式（在对手回合开始时生效）

// ============================================================================
// Ongoing 拦截器注册?
// ============================================================================

function canTriggerTricksterBaseOngoingAgainstOtherPlayer(
    ctx: TriggerContext,
    sourceDefId: string,
    options?: { requiresHand?: boolean; exactDefId?: boolean },
): boolean {
    if (!ctx.triggerMinionUid || ctx.baseIndex === undefined) return false;
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return false;
    const source = base.ongoingActions.find(ongoing =>
        options?.exactDefId ? ongoing.defId === sourceDefId : matchesDefId(ongoing.defId, sourceDefId));
    const controllerId = source?.metadata?.sourceControllerId ?? source?.ownerId;
    if (!source || controllerId === ctx.playerId) return false;
    if (options?.requiresHand && ((ctx.state.players[ctx.playerId]?.hand.length ?? 0) === 0)) return false;
    return true;
}

function canTriggerTricksterLeprechaun(ctx: TriggerContext, sourceDefId: string, options?: { exactDefId?: boolean }): boolean {
    if (!ctx.triggerMinionUid || ctx.baseIndex === undefined) return false;
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return false;
    const playedMinion = base.minions.find(minion => minion.uid === ctx.triggerMinionUid);
    if (!playedMinion) return false;
    const playedPower = getMinionPower(ctx.state, playedMinion, ctx.baseIndex);
    return base.minions.some((leprechaun) => {
        const matchesSource = options?.exactDefId
            ? leprechaun.defId === sourceDefId
            : matchesDefId(leprechaun.defId, sourceDefId);
        if (!matchesSource || leprechaun.controller === ctx.playerId) return false;
        if (options?.exactDefId && (leprechaun as any).metadata?.leprechaunPodLastTurnTriggered === ctx.state.turnNumber) {
            return false;
        }
        return playedPower < getMinionPower(ctx.state, leprechaun, ctx.baseIndex!);
    });
}

function canTriggerTricksterBrowniePod(ctx: TriggerContext): boolean {
    if (!ctx.triggerMinionUid || ctx.baseIndex === undefined) return false;
    return ctx.state.bases.some((base, baseIndex) =>
        baseIndex !== ctx.baseIndex
        && base.minions.some((brownie) => {
            if (brownie.defId !== 'trickster_brownie_pod' || brownie.controller === ctx.playerId) return false;
            if ((brownie as any).metadata?.browniePodLastTurnTriggered === ctx.state.turnNumber) return false;
            const player = ctx.state.players[brownie.controller];
            return ((player?.deck.length ?? 0) + (player?.discard.length ?? 0)) > 0;
        }));
}

function canTriggerTricksterBrownieAffected(ctx: TriggerContext): boolean {
    if (ctx.triggerMinionDefId !== 'trickster_brownie') return false;
    if (ctx.sourceCardUid && ctx.sourceCardUid !== ctx.triggerMinionUid) return false;
    const brownieOwner = ctx.triggerMinion?.controller;
    if (!brownieOwner || brownieOwner === ctx.playerId) return false;
    return (ctx.state.players[ctx.playerId]?.hand.length ?? 0) > 0;
}

/** 注册诡术师派系的 ongoing 拦截?*/
function registerTricksterOngoingEffects(): void {
    // 小矮妖：其他玩家打出力量更低的随从到同基地时消灭该随从
    registerTrigger('trickster_leprechaun', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || !trigCtx.triggerMinionDefId || trigCtx.baseIndex === undefined) return [];
        // 找到 leprechaun 所在基地
        for (let i = 0; i < trigCtx.state.bases.length; i++) {
            const base = trigCtx.state.bases[i];
            const leprechaun = base.minions.find(m => matchesDefId(m.defId, 'trickster_leprechaun'));
            if (!leprechaun) continue;
            // 只在同基地触?
            if (i !== trigCtx.baseIndex) continue;
            // 只对其他玩家触发
            if (leprechaun.controller === trigCtx.playerId) continue;
            // 检查打出的随从力量是否低于 leprechaun
            const lepPower = getMinionPower(trigCtx.state, leprechaun, i);
            const triggerMinion = base.minions.find(m => m.uid === trigCtx.triggerMinionUid);
            if (!triggerMinion) continue;
            const trigPower = getMinionPower(trigCtx.state, triggerMinion, i);
            if (trigPower < lepPower) {
                return [{
                    type: SU_EVENTS.MINION_DESTROYED,
                    payload: {
                        minionUid: trigCtx.triggerMinionUid,
                        minionDefId: trigCtx.triggerMinionDefId,
                        fromBaseIndex: i,
                        ownerId: triggerMinion.owner,
                        controllerId: triggerMinion.controller,
                        destroyerId: leprechaun.controller,
                        reason: 'trickster_leprechaun',
                    },
                    timestamp: trigCtx.now,
                }];
            }
        }
        return [];
    }, {
        canTrigger: (ctx) => canTriggerTricksterLeprechaun(ctx, 'trickster_leprechaun'),
    });

    // 布朗尼：被对手卡牌效果影响时，对手弃两张牌
    // "影响"包含：消灭、移动、负力量修改、附着对手行动卡（规则术语映射）
    registerTrigger('trickster_brownie', 'onMinionAffected', (trigCtx) => {
        if (trigCtx.triggerMinionDefId !== 'trickster_brownie') return [];
        const brownieOwner = trigCtx.triggerMinion?.controller;
        if (!brownieOwner || brownieOwner === trigCtx.playerId) return [];
        // 对手（触发影响的玩家）弃两张牌
        const opponent = trigCtx.state.players[trigCtx.playerId];
        if (!opponent || opponent.hand.length === 0) return [];
        const discardCount = Math.min(2, opponent.hand.length);
        const discardUids: string[] = [];
        const handCopy = [...opponent.hand];
        for (let j = 0; j < discardCount; j++) {
            const idx = Math.floor(trigCtx.random.random() * handCopy.length);
            discardUids.push(handCopy[idx].uid);
            handCopy.splice(idx, 1);
        }
        return [{
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId: trigCtx.playerId, cardUids: discardUids },
            timestamp: trigCtx.now,
        }];
    }, {
        canTrigger: canTriggerTricksterBrownieAffected,
        playerContext: 'sourceController',
    });

    // 藏身处：保护同基地己方随从不受对手行动卡影响（消耗型：触发后自毁）
    registerProtection('trickster_hideout', 'action', (ctx) => {
        // 检查目标随从是否附着了 hideout（附着在随从上的情况）
        const attachedHideout = ctx.targetMinion.attachedActions.find(a => a.defId === 'trickster_hideout');
        if (attachedHideout) {
            const controllerId = attachedHideout.metadata?.sourceControllerId ?? attachedHideout.ownerId;
            // 只保护 Hideout 拥有者的随从，且行动卡来自对手
            return ctx.targetMinion.controller === controllerId && ctx.sourcePlayerId !== controllerId;
        }
        // 也检查基地上的 ongoing（打在基地上的情况）
        const base = ctx.state.bases[ctx.targetBaseIndex];
        const baseHideout = base?.ongoingActions.find(o => o.defId === 'trickster_hideout');
        if (baseHideout) {
            const controllerId = baseHideout.metadata?.sourceControllerId ?? baseHideout.ownerId;
            // 只保护 Hideout 拥有者的随从，且行动卡来自对手
            return ctx.targetMinion.controller === controllerId && ctx.sourcePlayerId !== controllerId;
        }
        return false;
    }, { consumable: true });

    // 火焰陷阱：其他玩家打出随从到此基地时消灭该随从
    registerTrigger('trickster_flame_trap', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || !trigCtx.triggerMinionDefId || trigCtx.baseIndex === undefined) return [];
        for (let i = 0; i < trigCtx.state.bases.length; i++) {
            const base = trigCtx.state.bases[i];
            const trap = base.ongoingActions.find(o => matchesDefId(o.defId, 'trickster_flame_trap'));
            if (!trap || i !== trigCtx.baseIndex) continue;
            const controllerId = trap.metadata?.sourceControllerId ?? trap.ownerId;
            // 只对其他玩家触发
            if (controllerId === trigCtx.playerId) continue;
            const triggerMinion = base.minions.find(m => m.uid === trigCtx.triggerMinionUid);
            return [
                // 消灭打出的随从
                {
                    type: SU_EVENTS.MINION_DESTROYED,
                    payload: {
                        minionUid: trigCtx.triggerMinionUid,
                        minionDefId: trigCtx.triggerMinionDefId,
                        fromBaseIndex: i,
                        ownerId: triggerMinion?.owner ?? trigCtx.playerId,
                        controllerId: triggerMinion?.controller ?? trigCtx.playerId,
                        destroyerId: controllerId,
                        reason: 'trickster_flame_trap',
                    },
                    timestamp: trigCtx.now,
                },
                // 消灭火焰陷阱本身
                {
                    type: SU_EVENTS.ONGOING_DETACHED,
                    payload: {
                        cardUid: trap.uid,
                        defId: trap.defId,
                        ownerId: trap.ownerId,
                        reason: 'trickster_flame_trap_self_destruct',
                    },
                    timestamp: trigCtx.now,
                },
            ];
        }
        return [];
    }, {
        canTrigger: (ctx) => canTriggerTricksterBaseOngoingAgainstOtherPlayer(ctx, 'trickster_flame_trap'),
    });

    // 封路：指定派系不能打出随从到此基地（描述无"对手"限定，对所有玩家生效）
    registerRestriction('trickster_block_the_path', 'play_minion', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return false;
        const blockAction = base.ongoingActions.find(o => matchesDefId(o.defId, 'trickster_block_the_path'));
        if (!blockAction) return false;
        // 检查被限制的派系
        const blockedFaction = blockAction.metadata?.blockedFaction as string | undefined;
        if (!blockedFaction) return false;
        // 检查打出的随从是否属于被限制的派系
        const minionDefId = ctx.extra?.minionDefId as string | undefined;
        if (!minionDefId) return false;
        const def = getCardDef(minionDefId);
        return def?.faction === blockedFaction;
    });

    // 付笛手的钱：对手打出随从后弃一张牌
    registerTrigger('trickster_pay_the_piper', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || trigCtx.baseIndex === undefined) return [];
        for (let i = 0; i < trigCtx.state.bases.length; i++) {
            const base = trigCtx.state.bases[i];
            const piper = base.ongoingActions.find(o => matchesDefId(o.defId, 'trickster_pay_the_piper'));
            if (!piper || i !== trigCtx.baseIndex) continue;
            const controllerId = piper.metadata?.sourceControllerId ?? piper.ownerId;
            // 只对其他玩家触发
            if (controllerId === trigCtx.playerId) continue;
            // 对手随机弃一张牌
            const opponent = trigCtx.state.players[trigCtx.playerId];
            if (!opponent || opponent.hand.length === 0) continue;
            const idx = Math.floor(trigCtx.random.random() * opponent.hand.length);
            return [{
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: trigCtx.playerId, cardUids: [opponent.hand[idx].uid] },
                timestamp: trigCtx.now,
            }];
        }
        return [];
    }, {
        canTrigger: (ctx) => canTriggerTricksterBaseOngoingAgainstOtherPlayer(ctx, 'trickster_pay_the_piper', {
            requiresHand: true,
        }),
    });
}

function registerTricksterPodOngoingEffects(): void {
    registerTrigger('trickster_brownie_pod', 'onMinionAffected', () => [], {
    });
    registerTrigger('trickster_enshrouding_mist_pod', 'onTurnStart', () => [], {
    });
    registerProtection('trickster_hideout_pod', 'action', () => false);
    // Hideout POD：其他玩家不能将随从移动到此基地（用事件拦截器阻止移动）
    registerInterceptor('trickster_hideout_pod', (state, event) => {
        if (event.type !== SU_EVENTS.MINION_MOVED) return undefined;
        const { toBaseIndex, fromBaseIndex, minionUid } = (event as any).payload as { toBaseIndex: number; fromBaseIndex: number; minionUid: string };
        const toBase = state.bases[toBaseIndex];
        if (!toBase) return undefined;
        const hideout = toBase.ongoingActions.find(o => o.defId === 'trickster_hideout_pod');
        if (!hideout) return undefined;
        const fromBase = state.bases[fromBaseIndex];
        const moving = fromBase?.minions.find(m => m.uid === minionUid);
        if (!moving) return undefined;
        const controllerId = hideout.metadata?.sourceControllerId ?? hideout.ownerId;
        if (moving.controller !== controllerId) return null;
        return undefined;
    });

    // Leprechaun POD：每回合第一次“对手打出力量更低的随从到此基地（结算后仍在场）”时消灭之
    registerTrigger('trickster_leprechaun_pod', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || !trigCtx.triggerMinionDefId || trigCtx.baseIndex === undefined) return [];
        const baseIndex = trigCtx.baseIndex;
        const base = trigCtx.state.bases[baseIndex];
        if (!base) return [];

        // 找到该基地上的 leprechaun（可能多个）
        const leps = base.minions.filter(m => m.defId === 'trickster_leprechaun_pod');
        if (leps.length === 0) return [];

        // 触发的随从必须仍在该基地（避免 Twister 等在结算中移动）
        const playedMinion = base.minions.find(m => m.uid === trigCtx.triggerMinionUid);
        if (!playedMinion) return [];

        const events: SmashUpEvent[] = [];
        for (const lep of leps) {
            // 只对其他玩家触发
            if (lep.controller === trigCtx.playerId) continue;

            const used = (lep as any).metadata?.leprechaunPodLastTurnTriggered as number | undefined;
            if (used === trigCtx.state.turnNumber) continue;

            const lepPower = getMinionPower(trigCtx.state, lep, baseIndex);
            const playedPower = getMinionPower(trigCtx.state, playedMinion, baseIndex);
            if (playedPower >= lepPower) continue;

            events.push({
                type: SU_EVENTS.MINION_DESTROYED,
                payload: {
                    minionUid: playedMinion.uid,
                    minionDefId: playedMinion.defId,
                    fromBaseIndex: baseIndex,
                    ownerId: playedMinion.owner,
                    controllerId: playedMinion.controller,
                    destroyerId: lep.controller,
                    reason: 'trickster_leprechaun_pod',
                },
                timestamp: trigCtx.now,
            });
            events.push({
                type: SU_EVENTS.MINION_METADATA_UPDATED,
                payload: {
                    minionUid: lep.uid,
                    baseIndex,
                    metadataUpdate: { leprechaunPodLastTurnTriggered: trigCtx.state.turnNumber },
                    reason: 'trickster_leprechaun_pod_once_per_turn',
                },
                timestamp: trigCtx.now,
            } as any);
            break;
        }
        return events;
    }, {
        canTrigger: (ctx) => canTriggerTricksterLeprechaun(ctx, 'trickster_leprechaun_pod', {
            exactDefId: true,
        }),
    });

    // Brownie POD：每回合一次，当对手在另一基地打出随从后，你抽 1 张牌
    registerTrigger('trickster_brownie_pod', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || trigCtx.baseIndex === undefined) return [];
        // 对手打出的随从：playerId=打出者；需要找到所有 brownie_pod（可能多个）
        const events: SmashUpEvent[] = [];
        for (let bi = 0; bi < trigCtx.state.bases.length; bi++) {
            const base = trigCtx.state.bases[bi];
            for (const brownie of base.minions.filter(m => m.defId === 'trickster_brownie_pod')) {
                if (brownie.controller === trigCtx.playerId) continue;
                if (bi === trigCtx.baseIndex) continue; // 另一基地
                const ownerId = brownie.controller;
                const used = (brownie as any).metadata?.browniePodLastTurnTriggered as number | undefined;
                if (used === trigCtx.state.turnNumber) continue;

                // 抽 1
                const owner = trigCtx.state.players[ownerId];
                if (!owner) continue;
                const drawEvents = buildStandardDrawEvents(trigCtx.state, ownerId, 1, trigCtx.random, trigCtx.now);
                if (drawEvents.length === 0) continue;
                events.push(...drawEvents);
                events.push({
                    type: SU_EVENTS.MINION_METADATA_UPDATED,
                    payload: {
                        minionUid: brownie.uid,
                        baseIndex: bi,
                        metadataUpdate: { browniePodLastTurnTriggered: trigCtx.state.turnNumber },
                        reason: 'trickster_brownie_pod_once_per_turn',
                    },
                    timestamp: trigCtx.now,
                } as any);
            }
        }
        return events;
    }, {
        canTrigger: canTriggerTricksterBrowniePod,
    });

    // Gremlin POD：被消灭进入弃牌堆后抽 1；若被消灭则每位对手随机弃 1
    registerTrigger('trickster_gremlin_pod', 'onMinionDestroyed', (trigCtx) => {
        if (trigCtx.triggerMinionDefId !== 'trickster_gremlin_pod') return [];
        const ownerId = trigCtx.triggerMinion?.owner ?? trigCtx.playerId;
        const player = trigCtx.state.players[ownerId];
        if (!player) return [];
        const events: SmashUpEvent[] = [];
        events.push(...buildStandardDrawEvents(trigCtx.state, ownerId, 1, trigCtx.random, trigCtx.now));
        for (const pid of trigCtx.state.turnOrder) {
            if (pid === ownerId) continue;
            const opp = trigCtx.state.players[pid];
            if (!opp || opp.hand.length === 0) continue;
            const idx = Math.floor(trigCtx.random.random() * opp.hand.length);
            events.push({
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: pid, cardUids: [opp.hand[idx].uid] },
                timestamp: trigCtx.now,
            } as CardsDiscardedEvent);
        }
        return events;
    });

    // Gremlin POD：基地计分清场时进入弃牌堆（非消灭）也抽 1
    registerTrigger('trickster_gremlin_pod', 'onMinionDiscardedFromBase', (trigCtx) => {
        if (trigCtx.triggerMinionDefId !== 'trickster_gremlin_pod') return [];
        if (isDestroyPipelineDiscardTrigger(trigCtx)) return [];
        const ownerId = trigCtx.triggerMinion?.owner ?? trigCtx.playerId;
        const player = trigCtx.state.players[ownerId];
        if (!player) return [];
        return buildStandardDrawEvents(trigCtx.state, ownerId, 1, trigCtx.random, trigCtx.now);
    }, {
        global: true,
        globalZones: ['discard'],
    });

    // Flame Trap POD：对手打出随从到此基地后，先自毁再尝试消灭该随从
    registerTrigger('trickster_flame_trap_pod', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || !trigCtx.triggerMinionDefId || trigCtx.baseIndex === undefined) return [];
        const bi = trigCtx.baseIndex;
        const base = trigCtx.state.bases[bi];
        if (!base) return [];
        const trap = base.ongoingActions.find(o => o.defId === 'trickster_flame_trap_pod');
        if (!trap) return [];
        const controllerId = trap.metadata?.sourceControllerId ?? trap.ownerId;
        if (controllerId === trigCtx.playerId) return [];
        const triggerMinion = base.minions.find(m => m.uid === trigCtx.triggerMinionUid);
        return [
            {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: { cardUid: trap.uid, defId: trap.defId, ownerId: trap.ownerId, reason: 'trickster_flame_trap_pod' },
                timestamp: trigCtx.now,
            } as OngoingDetachedEvent,
            {
                type: SU_EVENTS.MINION_DESTROYED,
                payload: {
                    minionUid: trigCtx.triggerMinionUid,
                    minionDefId: trigCtx.triggerMinionDefId,
                    fromBaseIndex: bi,
                    ownerId: triggerMinion?.owner ?? trigCtx.playerId,
                    controllerId: triggerMinion?.controller ?? trigCtx.playerId,
                    destroyerId: controllerId,
                    reason: 'trickster_flame_trap_pod',
                },
                timestamp: trigCtx.now,
            },
        ];
    }, {
        canTrigger: (ctx) => canTriggerTricksterBaseOngoingAgainstOtherPlayer(ctx, 'trickster_flame_trap_pod', {
            exactDefId: true,
        }),
    });

    // Flame Trap POD：你回合开始时，可以让此基地本回合 breakpoint -4
    registerTrigger('trickster_flame_trap_pod', 'onTurnStart', (trigCtx) => {
        if (!trigCtx.matchState || trigCtx.sourceBaseIndex === undefined || !trigCtx.sourceCardUid) return [];
        const trap = trigCtx.state.bases[trigCtx.sourceBaseIndex]?.ongoingActions.find(ongoing => ongoing.uid === trigCtx.sourceCardUid);
        const controllerId = trap ? (trap.metadata?.sourceControllerId ?? trap.ownerId) : undefined;
        if (!trap || controllerId !== trigCtx.playerId) return [];
        return executeAbilityProgram(
            tricksterFlameTrapPodBreakpointPromptProgram,
            createTricksterPromptContext(trigCtx.matchState, trigCtx.playerId, trigCtx.now, {
                baseIndex: trigCtx.sourceBaseIndex,
                trapUid: trigCtx.sourceCardUid,
            }) satisfies TricksterFlameTrapPodPromptContext,
        );
    }, {
        playerContext: 'sourceController',
        perInstance: true,
    });

    // Pay the Piper POD：对手在此基地打出随从后，该玩家弃 1 张牌（先按随机实现，后续可升级为选择弃牌）
    registerTrigger('trickster_pay_the_piper_pod', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || trigCtx.baseIndex === undefined) return [];
        const bi = trigCtx.baseIndex;
        const base = trigCtx.state.bases[bi];
        if (!base) return [];
        const piper = base.ongoingActions.find(o => o.defId === 'trickster_pay_the_piper_pod');
        if (!piper) return [];
        const controllerId = piper.metadata?.sourceControllerId ?? piper.ownerId;
        if (controllerId === trigCtx.playerId) return [];
        const opponent = trigCtx.state.players[trigCtx.playerId];
        if (!opponent || opponent.hand.length === 0) return [];
        const idx = Math.floor(trigCtx.random.random() * opponent.hand.length);
        return [{
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId: trigCtx.playerId, cardUids: [opponent.hand[idx].uid] },
            timestamp: trigCtx.now,
        } as CardsDiscardedEvent];
    }, {
        canTrigger: (ctx) => canTriggerTricksterBaseOngoingAgainstOtherPlayer(ctx, 'trickster_pay_the_piper_pod', {
            exactDefId: true,
            requiresHand: true,
        }),
    });

    // Block the Path POD：对每个对手指定其拥有的一个派系，阻止该对手派系随从打到此基地
    registerAbilityProgram('trickster_block_the_path_pod', 'onPlay', {
        program: createEffectProgram<AbilityContext, AbilityContext['state'], SmashUpEvent>((ctx) => {
            const combos = buildBlockThePathPodCombos(ctx.state, ctx.playerId);
            if (combos.length === 0) {
                return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
            }
            return {
                events: [],
                context: createTricksterPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
                    cardUid: ctx.cardUid,
                    baseIndex: ctx.baseIndex,
                }) satisfies TricksterBlockThePathPodPromptContext,
                nextProgram: tricksterBlockThePathPodPromptProgram,
            };
        }),
    });

    registerRestriction('trickster_block_the_path_pod', 'play_minion', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return false;
        const block = base.ongoingActions.find(o => o.defId === 'trickster_block_the_path_pod');
        if (!block) return false;
        const per = block.metadata?.blockedFactionsByPlayer as Record<string, string> | undefined;
        const blockedFaction = per?.[ctx.playerId];
        if (!blockedFaction) return false;
        const minionDefId = ctx.extra?.minionDefId as string | undefined;
        if (!minionDefId) return false;
        const def = getCardDef(minionDefId);
        return def?.faction === blockedFaction;
    });

    // Mark of Sleep POD：限制“被标记者”的移动（用事件拦截器实现）
    registerInterceptor('trickster_mark_of_sleep_pod', (state, event) => {
        if (event.type !== SU_EVENTS.MINION_MOVED) return undefined;
        const marked = (state.sleepMoveMarkedPlayers ?? []) as string[];
        if (marked.length === 0) return undefined;
        const { fromBaseIndex, minionUid } = (event as any).payload as { fromBaseIndex: number; minionUid: string };
        const fromBase = state.bases[fromBaseIndex];
        const minion = fromBase?.minions.find(m => m.uid === minionUid);
        if (!minion) return undefined;
        const expires = (state.sleepMarkExpiresOnTurnNumber as number | undefined);
        if (expires !== undefined && state.turnNumber >= expires) return undefined;
        if (marked.includes(minion.controller)) return null;
        return undefined;
    });
}
