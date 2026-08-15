import { createSimpleChoice, queueInteraction, type PromptOption } from '../../../engine/systems/InteractionSystem';
import { registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import {
    addTempPower,
    buildAbilityFeedback,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    grantContextualExtraMinion,
    buildValidatedDestroyEvents,
    getMinionPower,
    shuffleBaseDeck,
} from '../domain/abilityHelpers';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { appendResolvedActionAbility, getExternalActionEffectiveHandSize } from '../domain/externalActionPlay';
import { registerBaseAbilitySuppression, registerBaseVpModifier, registerTrigger, type TriggerContext } from '../domain/ongoingEffects';
import { validateActionPlaySemantics } from '../domain/playLegality';
import { createCardObjectRefFromInstance, createCardTransferEvent } from '../domain/objectProvenance';
import type { ActionCardDef, SmashUpCore, SmashUpEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { matchesDefId } from '../domain/utils';
import { getBaseDef, getCardDef } from '../data/cards';

type DragonsTarget = {
    uid: string;
    defId: string;
    baseIndex: number;
    label: string;
};

type DragonsPromptContext = {
    matchState: AbilityContext['matchState'];
    playerId: string;
    now: number;
    sourceId: 'dragons_wyvern';
    sourceCardUid: string;
    sourceBaseIndex: number;
    targets: DragonsTarget[];
};

type MinionChoice = {
    minionUid?: string;
    baseIndex?: number;
    defId?: string;
    skip?: boolean;
};

type HandCardChoice = {
    cardUid?: string;
    defId?: string;
    skip?: boolean;
    __cancel__?: boolean;
    __emergency_skip__?: boolean;
};

type BurnItDownChoice = {
    source?: 'deck' | 'discard';
    baseDefId?: string;
};

type BurnItDownPromptContext = {
    matchState: AbilityContext['matchState'];
    playerId: string;
    now: number;
    baseIndex: number;
    oldBaseDefId: string;
    topDeckBaseDefId?: string;
    discardBaseDefIds: string[];
};

type FlankAttackSearchScope = 'deck' | 'discard' | 'both';

type FlankAttackSourceChoice = {
    searchScope?: FlankAttackSearchScope;
};

type FlankAttackCardChoice = {
    cardUid?: string;
    defId?: string;
    sourceZone?: 'deck' | 'discard';
    __cancel__?: boolean;
    __emergency_skip__?: boolean;
};

type FlankAttackBaseChoice = {
    baseIndex?: number;
    baseDefId?: string;
    __cancel__?: boolean;
    __emergency_skip__?: boolean;
};

type FlankAttackPromptContext = {
    matchState: AbilityContext['matchState'];
    playerId: string;
    now: number;
    searchScope?: FlankAttackSearchScope;
    replayCardUid?: string;
    replayDefId?: string;
    replayOwnerId?: string;
};

function removeFirstDefId(defIds: string[], targetDefId: string): string[] {
    const index = defIds.indexOf(targetDefId);
    return index >= 0
        ? [...defIds.slice(0, index), ...defIds.slice(index + 1)]
        : defIds;
}

function buildBurnItDownOptions(context: BurnItDownPromptContext): PromptOption<BurnItDownChoice>[] {
    const options: PromptOption<BurnItDownChoice>[] = [];
    if (context.topDeckBaseDefId) {
        options.push({
            id: 'deck-top',
            label: '基地牌库顶牌',
            labelKey: 'ui.dragons_burn_it_down_deck_top_option',
            value: { source: 'deck' },
            displayMode: 'button',
        });
    }
    for (let index = 0; index < context.discardBaseDefIds.length; index += 1) {
        const baseDefId = context.discardBaseDefIds[index];
        const baseDef = getBaseDef(baseDefId);
        options.push({
            id: `discard-${index}`,
            label: `基地弃牌堆：${baseDef?.name ?? baseDefId}`,
            value: { source: 'discard', baseDefId },
            displayMode: 'button',
        });
    }
    return options;
}

function isFlankAttackReplayableBaseAction(
    core: SmashUpCore,
    playerId: string,
    defId: string,
    effectiveHandSize: number,
): boolean {
    const def = getCardDef(defId) as ActionCardDef | undefined;
    if (!def || def.type !== 'action') return false;
    if (!def.playNeedsBase && def.ongoingTarget !== 'base') return false;

    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex += 1) {
        const ok = validateActionPlaySemantics(core, playerId, {
            defId,
            targetBaseIndex: baseIndex,
            effectiveHandSize,
        });
        if (ok.valid) return true;
    }
    return false;
}

function buildFlankAttackSourceOptions(
    core: SmashUpCore,
    playerId: string,
): PromptOption<FlankAttackSourceChoice>[] {
    const effectiveHandSize = (core.players[playerId]?.hand.length ?? 0) + 1;
    const hasDeck = core.players[playerId]?.deck.some((card) =>
        isFlankAttackReplayableBaseAction(core, playerId, card.defId, effectiveHandSize),
    ) ?? false;
    const hasDiscard = core.players[playerId]?.discard.some((card) =>
        isFlankAttackReplayableBaseAction(core, playerId, card.defId, effectiveHandSize),
    ) ?? false;

    const options: PromptOption<FlankAttackSourceChoice>[] = [];
    if (hasDeck) {
        options.push({
            id: 'deck',
            label: '搜索牌库',
            labelKey: 'ui.dragons_flank_attack_search_deck_option',
            value: { searchScope: 'deck' },
            displayMode: 'button',
        });
    }
    if (hasDiscard) {
        options.push({
            id: 'discard',
            label: '搜索弃牌堆',
            labelKey: 'ui.dragons_flank_attack_search_discard_option',
            value: { searchScope: 'discard' },
            displayMode: 'button',
        });
    }
    if (hasDeck && hasDiscard) {
        options.push({
            id: 'both',
            label: '两处都搜',
            labelKey: 'ui.dragons_flank_attack_search_both_option',
            value: { searchScope: 'both' },
            displayMode: 'button',
        });
    }
    return options;
}

function buildFlankAttackCardOptions(
    core: SmashUpCore,
    playerId: string,
    searchScope: FlankAttackSearchScope,
): PromptOption<FlankAttackCardChoice>[] {
    const effectiveHandSize = (core.players[playerId]?.hand.length ?? 0) + 1;
    const options: PromptOption<FlankAttackCardChoice>[] = [];
    const includeDeck = searchScope === 'deck' || searchScope === 'both';
    const includeDiscard = searchScope === 'discard' || searchScope === 'both';

    if (includeDeck) {
        for (const card of core.players[playerId]?.deck ?? []) {
            if (!isFlankAttackReplayableBaseAction(core, playerId, card.defId, effectiveHandSize)) continue;
            const def = getCardDef(card.defId);
            options.push({
                id: `deck-${options.length}`,
                label: `${def?.name ?? card.defId}（牌库）`,
                value: { cardUid: card.uid, defId: card.defId, sourceZone: 'deck' },
                _source: 'deck' as const,
                displayMode: 'card' as const,
            });
        }
    }

    if (includeDiscard) {
        for (const card of core.players[playerId]?.discard ?? []) {
            if (!isFlankAttackReplayableBaseAction(core, playerId, card.defId, effectiveHandSize)) continue;
            const def = getCardDef(card.defId);
            options.push({
                id: `discard-${options.length}`,
                label: `${def?.name ?? card.defId}（弃牌堆）`,
                value: { cardUid: card.uid, defId: card.defId, sourceZone: 'discard' },
                _source: 'discard' as const,
                displayMode: 'card' as const,
            });
        }
    }

    return options;
}

function buildFlankAttackBaseOptions(
    matchState: AbilityContext['matchState'],
    playerId: string,
    defId: string,
): PromptOption<FlankAttackBaseChoice>[] {
    return matchState.core.bases
        .map((base, baseIndex) => ({ base, baseIndex }))
        .filter(({ baseIndex }) => validateActionPlaySemantics(matchState.core, playerId, {
            defId,
            targetBaseIndex: baseIndex,
            effectiveHandSize: getExternalActionEffectiveHandSize(matchState, playerId, true),
        }).valid)
        .map(({ base, baseIndex }) => ({
            id: `base-${baseIndex}`,
            label: getBaseDef(base.defId)?.name ?? base.defId,
            value: { baseIndex, baseDefId: base.defId },
            _source: 'base' as const,
            displayMode: 'card' as const,
        }));
}

function buildFlankAttackAttachedEvent(
    context: Pick<FlankAttackPromptContext, 'replayCardUid' | 'replayDefId' | 'replayOwnerId'>,
    sourcePlayerId: string,
    targetBaseIndex: number,
    timestamp: number,
): SmashUpEvent {
    const ownerId = context.replayOwnerId ?? sourcePlayerId;
    return {
        type: SU_EVENTS.ONGOING_ATTACHED,
        payload: {
            cardUid: context.replayCardUid,
            defId: context.replayDefId,
            ownerId,
            ...(ownerId !== sourcePlayerId ? { sourcePlayerId } : {}),
            targetType: 'base',
            targetBaseIndex,
        },
        timestamp,
    } as SmashUpEvent;
}

function buildBurnItDownReplacementEvents(
    core: SmashUpCore,
    context: BurnItDownPromptContext,
    selected: BurnItDownChoice,
    timestamp: number,
): SmashUpEvent[] {
    const base = core.bases[context.baseIndex];
    if (!base) return [];

    const newBaseDefId = selected.source === 'deck'
        ? context.topDeckBaseDefId
        : selected.baseDefId;
    if (!newBaseDefId) return [];

    const events: SmashUpEvent[] = [];

    if (selected.source === 'discard') {
        events.push({
            type: SU_EVENTS.BASE_DECK_REORDERED,
            payload: {
                topDefIds: [newBaseDefId],
                reason: 'dragons_burn_it_down',
            },
            timestamp,
        });
    }

    for (const action of base.ongoingActions) {
        events.push(...buildValidatedOngoingDetachEvents(core, {
            cardUid: action.uid,
            reason: 'dragons_burn_it_down',
            now: timestamp,
            expectedLocation: 'base',
        }));
    }

    events.push({
        type: SU_EVENTS.BASE_REPLACED,
        payload: {
            baseIndex: context.baseIndex,
            oldBaseDefId: context.oldBaseDefId,
            newBaseDefId,
            keepCards: true,
            allowMissingFromBaseDeck: true,
        },
        timestamp,
    });

    const finalBaseDeck = selected.source === 'deck'
        ? removeFirstDefId(core.baseDeck, newBaseDefId)
        : core.baseDeck;
    const finalBaseDiscard = [
        ...removeFirstDefId(core.baseDiscard ?? [], newBaseDefId),
        context.oldBaseDefId,
    ];

    events.push(shuffleBaseDeck(
        finalBaseDeck,
        'dragons_burn_it_down',
        timestamp,
        { newBaseDiscardDefIds: finalBaseDiscard },
    ));

    return events;
}

function collectWeakMinionsOnBase(
    state: SmashUpCore,
    baseIndex: number,
    powerMax: number,
    excludeUid?: string,
): DragonsTarget[] {
    const base = state.bases[baseIndex];
    if (!base) return [];

    return base.minions
        .filter((minion) => minion.uid !== excludeUid && getMinionPower(state, minion, baseIndex) <= powerMax)
        .map((minion) => {
            const def = getCardDef(minion.defId);
            const power = getMinionPower(state, minion, baseIndex);
            return {
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${def?.name ?? minion.defId} (力量 ${power})`,
            };
        });
}

const wyvernDestroyPromptProgram = createPromptProgram<DragonsPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'dragons_wyvern_destroy',
    interactionSourceIds: ['dragons_wyvern'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `dragons_wyvern_${context.now}`,
        context.playerId,
        '飞龙：选择要消灭的力量 3 或以下随从',
        buildMinionTargetOptions(context.targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceKind: 'minion',
            effectType: 'destroy',
        }),
        {
            sourceId: 'dragons_wyvern',
            titleKey: 'ui.dragons_wyvern_destroy_title',
            targetType: 'minion',
        },
    ),
    onResolve: ({ state, context, value, playerId, timestamp }) => {
        const choice = value as MinionChoice;
        if (!choice.minionUid || choice.baseIndex === undefined) {
            return { events: [] };
        }
        const target = context.targets.find((entry) => entry.uid === choice.minionUid && entry.baseIndex === choice.baseIndex);
        if (!target) return { events: [] };
        return {
            events: buildValidatedDestroyEvents(state, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: target.baseIndex,
                destroyerId: playerId,
                reason: 'dragons_wyvern',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid: context.sourceCardUid,
                sourceDefId: 'dragons_wyvern',
                sourceControllerId: playerId,
                sourceBaseIndex: context.sourceBaseIndex,
                sourceKind: 'minion',
            }),
        };
    },
});

const burnItDownPromptProgram = createPromptProgram<BurnItDownPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'dragons_burn_it_down',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `dragons_burn_it_down_${context.now}`,
        context.playerId,
        '烧毁它：选择替换基地来源',
        buildBurnItDownOptions(context),
        {
            sourceId: 'dragons_burn_it_down',
            titleKey: 'ui.dragons_burn_it_down_title',
            targetType: 'button',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as BurnItDownChoice | undefined;
        if (!selected?.source) {
            return { matchState: state, events: [] };
        }
        if (selected.source === 'deck' && !state.core.baseDeck[0]) {
            return { matchState: state, events: [] };
        }
        if (selected.source === 'discard' && (!selected.baseDefId || !state.core.baseDiscard?.includes(selected.baseDefId))) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: buildBurnItDownReplacementEvents(state.core, context, selected, timestamp),
        };
    },
});

const flankAttackChooseBasePromptProgram = createPromptProgram<FlankAttackPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'dragons_flank_attack_base',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `dragons_flank_attack_base_${context.now}`,
            context.playerId,
            '侧翼攻击：选择要打出到的基地',
            buildFlankAttackBaseOptions(context.matchState, context.playerId, context.replayDefId ?? ''),
            {
                sourceId: 'dragons_flank_attack_base',
                titleKey: 'ui.dragons_flank_attack_base_title',
                targetType: 'base',
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = (state) =>
            buildFlankAttackBaseOptions(state as AbilityContext['matchState'], context.playerId, context.replayDefId ?? '');
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        const selected = value as FlankAttackBaseChoice | undefined;
        if (
            selected?.__cancel__
            || selected?.__emergency_skip__
            || typeof selected?.baseIndex !== 'number'
            || !context.replayCardUid
            || !context.replayDefId
        ) {
            return { events: [] };
        }

        const inHand = state.core.players[playerId]?.hand.some((card) => card.uid === context.replayCardUid) ?? false;
        if (!inHand) return { events: [] };

        const ok = validateActionPlaySemantics(state.core, playerId, {
            defId: context.replayDefId,
            targetBaseIndex: selected.baseIndex,
            effectiveHandSize: getExternalActionEffectiveHandSize(state, playerId, true),
        });
        if (!ok.valid) return { events: [] };

        const def = getCardDef(context.replayDefId) as ActionCardDef | undefined;
        if (!def) return { events: [] };

        const events: SmashUpEvent[] = [
            buildActionPlayedEvent({
                playerId,
                cardUid: context.replayCardUid,
                defId: context.replayDefId,
                ownerId: context.replayOwnerId,
                timestamp,
                targetBaseIndex: selected.baseIndex,
                isExtraAction: true,
            }),
        ];
        if (def.subtype === 'ongoing') {
            events.push(buildFlankAttackAttachedEvent(context, playerId, selected.baseIndex, timestamp));
        }

        return appendResolvedActionAbility({
            state,
            playerId,
            cardUid: context.replayCardUid,
            defId: context.replayDefId,
            random,
            timestamp,
            baseIndex: selected.baseIndex,
            events,
        });
    },
});

const flankAttackChooseCardPromptProgram = createPromptProgram<FlankAttackPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'dragons_flank_attack_card',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `dragons_flank_attack_card_${context.now}`,
            context.playerId,
            '侧翼攻击：选择要额外打出的行动卡',
            buildFlankAttackCardOptions(context.matchState.core, context.playerId, context.searchScope ?? 'deck'),
            {
                sourceId: 'dragons_flank_attack_card',
                titleKey: 'ui.dragons_flank_attack_card_title',
                targetType: 'generic',
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = (state) =>
            buildFlankAttackCardOptions((state.core ?? state) as SmashUpCore, context.playerId, context.searchScope ?? 'deck');
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        const selected = value as FlankAttackCardChoice | undefined;
        if (
            selected?.__cancel__
            || selected?.__emergency_skip__
            || !selected?.cardUid
            || !selected?.sourceZone
        ) {
            return { events: [] };
        }

        const defId = selected.defId ?? '';
        const effectiveHandSize = (state.core.players[playerId]?.hand.length ?? 0) + 1;
        if (!isFlankAttackReplayableBaseAction(state.core, playerId, defId, effectiveHandSize)) {
            return { events: [] };
        }

        const player = state.core.players[playerId];
        if (!player) return { events: [] };

        const events: SmashUpEvent[] = [];
        if (selected.sourceZone === 'deck') {
            const chosen = player.deck.find((card) => card.uid === selected.cardUid && card.defId === defId);
            if (!chosen) return { events: [] };
            const shuffledRemaining = random.shuffle(player.deck.filter((card) => card.uid !== selected.cardUid));
            events.push({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId, count: 1, cardUids: [selected.cardUid] },
                timestamp,
            } as SmashUpEvent);
            if (shuffledRemaining.length > 0) {
                events.push({
                    type: SU_EVENTS.DECK_REORDERED,
                    payload: { playerId, deckUids: shuffledRemaining.map((card) => card.uid) },
                    timestamp,
                } as SmashUpEvent);
            }
        } else {
            const liveCard = player.discard.find((card) => card.uid === selected.cardUid && card.defId === defId);
            if (!liveCard) return { events: [] };
            events.push(createCardTransferEvent({
                card: createCardObjectRefFromInstance(liveCard),
                fromPlayerId: playerId,
                toPlayerId: playerId,
                reason: 'dragons_flank_attack',
                timestamp,
            }) as SmashUpEvent);

            if (context.searchScope === 'both' && player.deck.length > 0) {
                const shuffledDeck = random.shuffle([...player.deck]);
                events.push({
                    type: SU_EVENTS.DECK_REORDERED,
                    payload: { playerId, deckUids: shuffledDeck.map((card) => card.uid) },
                    timestamp,
                } as SmashUpEvent);
            }
        }

        return {
            events,
            context: {
                matchState: state,
                playerId,
                now: timestamp,
                replayCardUid: selected.cardUid,
                replayDefId: defId,
                replayOwnerId: player.deck.find((card) => card.uid === selected.cardUid)?.owner
                    ?? player.discard.find((card) => card.uid === selected.cardUid)?.owner
                    ?? playerId,
            },
            nextProgram: flankAttackChooseBasePromptProgram,
        };
    },
});

const flankAttackChooseSourcePromptProgram = createPromptProgram<FlankAttackPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'dragons_flank_attack_source',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `dragons_flank_attack_source_${context.now}`,
        context.playerId,
        '侧翼攻击：选择搜索范围',
        buildFlankAttackSourceOptions(context.matchState.core, context.playerId),
        {
            sourceId: 'dragons_flank_attack_source',
            titleKey: 'ui.dragons_flank_attack_source_title',
            targetType: 'button',
        },
    ),
    onResolve: ({ context, value }) => {
        const selected = value as FlankAttackSourceChoice | undefined;
        if (!selected?.searchScope) {
            return { events: [] };
        }
        return {
            events: [],
            context: {
                ...context,
                searchScope: selected.searchScope,
            },
            nextProgram: flankAttackChooseCardPromptProgram,
        };
    },
});

function dragonsWyvernOnPlay(ctx: AbilityContext): AbilityResult {
    const targets = collectWeakMinionsOnBase(ctx.state, ctx.baseIndex, 3, ctx.cardUid);
    if (targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (targets.length === 1) {
        const [target] = targets;
        if (!target) return { events: [] };
        return {
            events: buildValidatedDestroyEvents(ctx.matchState, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: target.baseIndex,
                destroyerId: ctx.playerId,
                reason: 'dragons_wyvern',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: 'dragons_wyvern',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
                sourceKind: 'minion',
            }),
        };
    }
    const result = executeAbilityProgram(wyvernDestroyPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'dragons_wyvern',
        sourceCardUid: ctx.cardUid,
        sourceBaseIndex: ctx.baseIndex,
        targets,
    });
    return { events: result.events, matchState: result.matchState };
}

function dragonsFlankAttackOnPlay(ctx: AbilityContext): AbilityResult {
    const sourceOptions = buildFlankAttackSourceOptions(ctx.state, ctx.playerId);
    if (sourceOptions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const searchScope = sourceOptions.length === 1
        ? sourceOptions[0]?.value.searchScope
        : undefined;
    const context: FlankAttackPromptContext = {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        ...(searchScope ? { searchScope } : {}),
    };

    if (searchScope) {
        return {
            events: [],
            matchState: executeAbilityProgram(flankAttackChooseCardPromptProgram, context).matchState,
        };
    }

    const result = executeAbilityProgram(flankAttackChooseSourcePromptProgram, context);
    return {
        events: result.events,
        matchState: result.matchState,
    };
}

function dragonsBurnItDownOnPlay(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const base = ctx.state.bases[baseIndex];
    if (!base) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const topDeckBaseDefId = ctx.state.baseDeck[0];
    const discardBaseDefIds = ctx.state.baseDiscard ?? [];

    if (!topDeckBaseDefId && discardBaseDefIds.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const promptContext: BurnItDownPromptContext = {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        baseIndex,
        oldBaseDefId: base.defId,
        topDeckBaseDefId,
        discardBaseDefIds,
    };

    if (topDeckBaseDefId && discardBaseDefIds.length === 0) {
        return {
            events: buildBurnItDownReplacementEvents(ctx.state, promptContext, { source: 'deck' }, ctx.now),
        };
    }

    if (!topDeckBaseDefId && discardBaseDefIds.length === 1) {
        return {
            events: buildBurnItDownReplacementEvents(
                ctx.state,
                promptContext,
                { source: 'discard', baseDefId: discardBaseDefIds[0] },
                ctx.now,
            ),
        };
    }

    if (!ctx.matchState) {
        return { events: [] };
    }

    const result = executeAbilityProgram(burnItDownPromptProgram, promptContext);
    return { events: result.events, matchState: result.matchState };
}

function dragonsWyvernTalent(ctx: AbilityContext): AbilityResult {
    return {
        events: [{
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: {
                baseIndex: ctx.baseIndex,
                delta: -3,
                reason: 'dragons_wyvern',
            },
            timestamp: ctx.now,
        }],
    };
}

function dragonsImperialDragonTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceControllerId) return [];
    return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
}

function dragonsHatchlingTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined || !ctx.triggerMinionUid) return [];
    return [addTempPower(ctx.triggerMinionUid, ctx.baseIndex, -1, 'dragons_hatchling', ctx.now)];
}

function movedIntoTriggerBase(ctx: TriggerContext): boolean {
    return ctx.baseIndex !== undefined
        && ctx.moveToBaseIndex !== undefined
        && ctx.baseIndex === ctx.moveToBaseIndex;
}

function isOtherPlayerMoveOrPlay(ctx: TriggerContext): boolean {
    return !!ctx.sourceControllerId && ctx.playerId !== ctx.sourceControllerId;
}

function getOngoingActionControllerId(action: { ownerId: string; metadata?: { sourceControllerId?: string } }): string {
    return action.metadata?.sourceControllerId ?? action.ownerId;
}

function buildDangerousGroundHandOptions(state: SmashUpCore, playerId: string): PromptOption<HandCardChoice>[] {
    const player = state.players[playerId];
    if (!player) return [];
    return player.hand.map((card, index) => {
        const def = getCardDef(card.defId);
        return {
            id: `card-${index}`,
            label: def?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'hand' as const,
            displayMode: 'card' as const,
        };
    });
}

function dragonsDangerousGroundTrigger(ctx: TriggerContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player || player.hand.length === 0) {
        return { events: [] };
    }
    if (player.hand.length === 1) {
        return {
            events: [{
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: ctx.playerId, cardUids: [player.hand[0].uid] },
                timestamp: ctx.now,
            }],
        };
    }
    if (!ctx.matchState) {
        return { events: [] };
    }

    const interaction = createSimpleChoice(
        `dragons_dangerous_ground_${ctx.now}`,
        ctx.playerId,
        '险地：选择要弃掉的卡牌',
        buildDangerousGroundHandOptions(ctx.state, ctx.playerId),
        {
            sourceId: 'dragons_dangerous_ground',
            titleKey: 'ui.dragons_dangerous_ground_title',
            targetType: 'hand',
            responseValidationMode: 'live',
        },
    );
    interaction.data.optionsGenerator = (state) =>
        buildDangerousGroundHandOptions(state.core as SmashUpCore, ctx.playerId);

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function dragonsBringDownTheWallsTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined) return [];
    const playerId = ctx.sourceControllerId ?? ctx.playerId;
    return [
        grantContextualExtraMinion(
            { playerId, now: ctx.now, matchState: ctx.matchState },
            'dragons_bring_down_the_walls',
            ctx.baseIndex,
        ),
    ];
}

export function registerDragonAbilities(): void {
    registerAbilityProgram('dragons_burn_it_down', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(dragonsBurnItDownOnPlay),
    });
    registerAbilityProgram('dragons_flank_attack', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(dragonsFlankAttackOnPlay),
    });
    registerAbilityProgram('dragons_wyvern', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(dragonsWyvernOnPlay),
    });
    registerAbilityProgram('dragons_wyvern', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(dragonsWyvernTalent),
    });

    registerTrigger('dragons_imperial_dragon', 'onMinionPlayed', dragonsImperialDragonTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: isOtherPlayerMoveOrPlay,
    });
    registerTrigger('dragons_imperial_dragon', 'onMinionMoved', dragonsImperialDragonTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: (ctx) => movedIntoTriggerBase(ctx) && isOtherPlayerMoveOrPlay(ctx),
    });

    registerTrigger('dragons_hatchling', 'onMinionPlayed', dragonsHatchlingTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: isOtherPlayerMoveOrPlay,
    });
    registerTrigger('dragons_hatchling', 'onMinionMoved', dragonsHatchlingTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: (ctx) => movedIntoTriggerBase(ctx) && isOtherPlayerMoveOrPlay(ctx),
    });

    registerTrigger('dragons_dangerous_ground', 'onMinionPlayed', dragonsDangerousGroundTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
        canTrigger: (ctx) => !!ctx.sourceControllerId && ctx.playerId !== ctx.sourceControllerId,
    });

    registerTrigger('dragons_bring_down_the_walls', 'beforeScoring', dragonsBringDownTheWallsTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });

    registerBaseAbilitySuppression('dragons_raze', (state, baseIndex) =>
        state.bases[baseIndex]?.ongoingActions.some(action => matchesDefId(action.defId, 'dragons_raze')) ?? false,
    );
    registerBaseVpModifier('dragons_great_wyrm', (state, baseIndex, playerId, currentVp) => {
        if (currentVp <= 0) return 0;
        const base = state.bases[baseIndex];
        if (!base) return 0;
        const penalty = base.minions.filter(minion =>
            matchesDefId(minion.defId, 'dragons_great_wyrm')
            && minion.controller !== playerId,
        ).length;
        return -penalty;
    });
    registerBaseVpModifier('dragons_ruins', (state, baseIndex, playerId, currentVp) => {
        if (currentVp <= 0) return 0;
        const base = state.bases[baseIndex];
        if (!base) return 0;
        const penalty = base.ongoingActions.filter(action =>
            matchesDefId(action.defId, 'dragons_ruins')
            && getOngoingActionControllerId(action) !== playerId,
        ).length;
        return -penalty;
    });

    registerInteractionHandler('dragons_dangerous_ground', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as HandCardChoice;
        if (selected.skip || selected.__cancel__ || selected.__emergency_skip__ || !selected.cardUid) {
            return { state, events: [] };
        }
        const player = state.core.players[playerId];
        if (!player?.hand.some((card) => card.uid === selected.cardUid)) {
            return { state, events: [] };
        }
        return {
            state,
            events: [{
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId, cardUids: [selected.cardUid] },
                timestamp,
            }],
        };
    });
}
