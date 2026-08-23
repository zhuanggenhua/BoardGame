/**
 * 大杀四方 - 米斯卡塔尼克大学派系能力
 *
 * 主题：知识研究、抽牌、行动卡操控
 */

import { registerAbility, registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { requireOnPlay, requireSpecial, resolveOnPlay, resolveSpecial } from '../domain/abilityRegistry';
import { SU_EVENTS, MADNESS_CARD_DEF_ID } from '../domain/types';
import type { SmashUpEvent, CardsDrawnEvent, MinionCardDef, SmashUpCore } from '../domain/types';
import type { MatchState } from '../../../engine/types';
import {
    drawMadnessCards, grantContextualExtraAction, grantContextualExtraMinion, grantExtraAction, grantExtraMinion,
    returnMadnessCard, addTempPower, addPowerCounter, addPermanentPower,
    getMinionPower, buildMinionTargetOptions, buildActionMinionTargetOptions, buildBaseTargetOptions,
    buildAbilityFeedback,
    recoverCardsFromDiscard,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
} from '../domain/abilityHelpers';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import { getCardDef, getBaseDef } from '../data/cards';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
} from '../domain/abilityRuntime';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import { registerMadnessAbilities } from './cthulhu';


function resolvePlayedActionExecutor(defId: string) {
    return resolveSpecial(defId) ?? resolveOnPlay(defId);
}

function requirePlayedActionExecutor(defId: string) {
    const def = getCardDef(defId);
    if (def?.type === 'action' && def.subtype === 'special') {
        if (resolveSpecial(defId)) return requireSpecial(defId, 'miskatonic.resolvedActionAfterPlayed');
        return requireOnPlay(defId, 'miskatonic.resolvedActionAfterPlayed');
    }
    return requireOnPlay(defId, 'miskatonic.resolvedActionAfterPlayed');
}

type MiskatonicResolvedActionAfterPlayedContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: AbilityContext['playerId'];
    cardUid: string;
    defId: string;
    random: AbilityContext['random'];
    now: number;
    baseIndex: number;
    targetMinionUid?: string;
};

const miskatonicResolvedActionAfterPlayedProgram = createEffectProgram<
    MiskatonicResolvedActionAfterPlayedContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    const executor = resolvePlayedActionExecutor(context.defId) ?? requirePlayedActionExecutor(context.defId);
    const abilityCtx: AbilityContext = {
        state: context.matchState.core,
        matchState: context.matchState,
        playerId: context.playerId,
        cardUid: context.cardUid,
        defId: context.defId,
        baseIndex: context.baseIndex,
        targetMinionUid: context.targetMinionUid,
        random: context.random,
        now: context.now,
    };
    return executor(abilityCtx);
});

type MiskatonicMadnessBoostPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: AbilityContext['playerId'];
    now: number;
    cardUid: string;
    baseIndex: number;
    sourceId: 'miskatonic_mandatory_reading' | 'miskatonic_things_best_not_known_pod';
    drawSourceId: 'miskatonic_mandatory_reading_draw' | 'miskatonic_things_best_not_known_pod_draw';
    minionPromptTitle: string;
    minionPromptTitleKey: string;
    drawPromptTitle: string;
    drawPromptTitleKey: string;
    madnessSourceId: 'miskatonic_mandatory_reading' | 'miskatonic_things_best_not_known_pod';
    boostMode: 'permanent' | 'temp';
    minionUid?: string;
    minionDefId?: string;
};

type MiskatonicResearcherPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: AbilityContext['playerId'];
    now: number;
    cardUid: string;
    sourceId: 'miskatonic_researcher' | 'miskatonic_researcher_pod' | 'miskatonic_researcher_pod_choose_minion';
    minionCandidates?: Array<{ uid: string; defId: string; baseIndex: number; label: string }>;
};

type MiskatonicPsychologistPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: AbilityContext['playerId'];
    now: number;
    cardUid: string;
    sourceId: 'miskatonic_psychologist' | 'miskatonic_psychologist_pod';
    allowDrawDiscard: boolean;
};

type MiskatonicBookPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: AbilityContext['playerId'];
    now: number;
    cardUid: string;
    sourceId: 'miskatonic_book_of_iter_the_unseen' | 'miskatonic_jinkies_pod';
};

type MiskatonicFieldTripPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: AbilityContext['playerId'];
    now: number;
    cardUid: string;
    sourceId: 'miskatonic_field_trip' | 'miskatonic_field_trip_pod';
    includeMadness: boolean;
    drawBonus: number;
};

type MiskatonicLibrarianPodPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: AbilityContext['playerId'];
    now: number;
    cardUid: string;
    sourceId: 'miskatonic_librarian_pod' | 'miskatonic_librarian_pod_play_madness';
    baseIndex?: number;
};

type MiskatonicLibrarianAfterDiscardContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: AbilityContext['playerId'];
    now: number;
    random: AbilityContext['random'];
};

type MiskatonicItJustMightWorkPodPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: AbilityContext['playerId'];
    now: number;
    cardUid: string;
    maxDiscard: number;
};

type MiskatonicMeddlingKidsPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: AbilityContext['playerId'];
    now: number;
    cardUid: string;
    sourceId: 'miskatonic_those_meddling_kids' | 'miskatonic_those_meddling_kids_select' | 'miskatonic_those_meddling_kids_pod_mode';
    baseIndex?: number;
    removedActionUids?: string[];
};

type MiskatonicThingOnDoorstepPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: AbilityContext['playerId'];
    now: number;
    cardUid: string;
    baseIndex: number;
    candidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }>;
};

function createMiskatonicMadnessBoostPromptContext(
    ctx: AbilityContext,
    params: Omit<MiskatonicMadnessBoostPromptContext, 'matchState' | 'playerId' | 'now' | 'cardUid'>,
): MiskatonicMadnessBoostPromptContext {
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        cardUid: ctx.cardUid,
        ...params,
    };
}

function createMiskatonicResearcherPromptContext(
    ctx: AbilityContext,
    params: Pick<MiskatonicResearcherPromptContext, 'sourceId' | 'minionCandidates'>,
): MiskatonicResearcherPromptContext {
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        cardUid: ctx.cardUid,
        ...params,
    };
}

function createMiskatonicPsychologistPromptContext(
    ctx: AbilityContext,
    params: Pick<MiskatonicPsychologistPromptContext, 'sourceId' | 'allowDrawDiscard'>,
): MiskatonicPsychologistPromptContext {
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        cardUid: ctx.cardUid,
        ...params,
    };
}

function createMiskatonicBookPromptContext(
    ctx: AbilityContext,
    params: Pick<MiskatonicBookPromptContext, 'sourceId'>,
): MiskatonicBookPromptContext {
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        cardUid: ctx.cardUid,
        ...params,
    };
}

function createMiskatonicFieldTripPromptContext(
    ctx: AbilityContext,
    params: Pick<MiskatonicFieldTripPromptContext, 'sourceId' | 'includeMadness' | 'drawBonus'>,
): MiskatonicFieldTripPromptContext {
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        cardUid: ctx.cardUid,
        ...params,
    };
}

function createMiskatonicLibrarianPodPromptContext(
    ctx: AbilityContext,
    params: Pick<MiskatonicLibrarianPodPromptContext, 'sourceId' | 'baseIndex'>,
): MiskatonicLibrarianPodPromptContext {
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        cardUid: ctx.cardUid,
        ...params,
    };
}

function createMiskatonicItJustMightWorkPodPromptContext(
    ctx: AbilityContext,
    params: Pick<MiskatonicItJustMightWorkPodPromptContext, 'maxDiscard'>,
): MiskatonicItJustMightWorkPodPromptContext {
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        cardUid: ctx.cardUid,
        ...params,
    };
}

function createMiskatonicMeddlingKidsPromptContext(
    ctx: AbilityContext,
    params: Pick<MiskatonicMeddlingKidsPromptContext, 'sourceId' | 'baseIndex' | 'removedActionUids'>,
): MiskatonicMeddlingKidsPromptContext {
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        cardUid: ctx.cardUid,
        ...params,
    };
}

function createMiskatonicThingOnDoorstepPromptContext(
    ctx: AbilityContext,
    params: Pick<MiskatonicThingOnDoorstepPromptContext, 'baseIndex' | 'candidates'>,
): MiskatonicThingOnDoorstepPromptContext {
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        cardUid: ctx.cardUid,
        ...params,
    };
}

function buildMiskatonicMandatoryReadingMinionOptions(
    context: MiskatonicMadnessBoostPromptContext,
) {
    const base = context.matchState.core.bases[context.baseIndex];
    if (!base) {
        throw new Error(`Miskatonic mandatory reading 基地不存在: ${context.baseIndex}`);
    }
    return base.minions.map((minion) => {
        const def = getCardDef(minion.defId) as MinionCardDef | undefined;
        const name = def?.name ?? minion.defId;
        const power = getMinionPower(context.matchState.core, minion, context.baseIndex);
        return {
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: context.baseIndex,
            label: `${name} (力量 ${power})`,
        };
    });
}

function buildMiskatonicMandatoryReadingDrawOptions(
    context: MiskatonicMadnessBoostPromptContext,
) {
    const madnessDeckSize = context.matchState.core.madnessDeck?.length ?? 0;
    const maxDraw = Math.min(3, madnessDeckSize);
    if (maxDraw <= 0) {
        throw new Error(`${context.drawSourceId} 没有可抽取的疯狂卡`);
    }

    const options = [];
    for (let count = 1; count <= maxDraw; count += 1) {
        options.push({
            id: `draw-${count}`,
            label: context.boostMode === 'permanent'
                ? `抽${count}张疯狂卡（随从+${count * 2}力量）`
                : `抽 ${count} 张疯狂卡（该随从直到回合结束 +${count * 2} 战斗力）`,
            value: { count },
            displayMode: 'button' as const,
        });
    }
    options.push({
        id: 'skip',
        label: '不抽',
        labelKey: 'ui.miskatonic_mandatory_reading_skip_draw_option',
        value: { skip: true },
        displayMode: 'button' as const,
    });
    return options;
}

const miskatonicMandatoryReadingChooseMinionPromptProgram = createPromptProgram<MiskatonicMadnessBoostPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'miskatonic_mandatory_reading',
    interactionSourceIds: ['miskatonic_things_best_not_known_pod'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.minionPromptTitle,
        buildMinionTargetOptions(
            buildMiskatonicMandatoryReadingMinionOptions(context),
            {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'affect',
            },
        ),
        { sourceId: context.sourceId, targetType: 'minion', titleKey: context.minionPromptTitleKey },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as { minionUid?: string; defId?: string } | undefined;
        if (!selected?.minionUid || !selected.defId) {
            return { events: [], matchState: state };
        }
        const maxDraw = Math.min(3, state.core.madnessDeck?.length ?? 0);
        if (maxDraw <= 0) {
            return { events: [], matchState: state };
        }
        return {
            events: [],
            matchState: state,
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
            },
            nextProgram: miskatonicMandatoryReadingChooseDrawPromptProgram,
        };
    },
});

const miskatonicMandatoryReadingChooseDrawPromptProgram = createPromptProgram<MiskatonicMadnessBoostPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'miskatonic_mandatory_reading_draw',
    interactionSourceIds: ['miskatonic_things_best_not_known_pod_draw'],
    buildInteraction: (context) => {
        if (!context.minionUid || !context.minionDefId) {
            throw new Error(`${context.drawSourceId} 缺少目标随从上下文`);
        }
        if (context.drawSourceId === 'miskatonic_mandatory_reading_draw') {
            return createAbilityRuntimeSimpleChoice(
                `${context.drawSourceId}_${context.now}`,
                context.playerId,
                context.drawPromptTitle,
                buildMiskatonicMandatoryReadingDrawOptions(context),
                { sourceId: 'miskatonic_mandatory_reading_draw', targetType: 'button', titleKey: context.drawPromptTitleKey },
            );
        }
        return createAbilityRuntimeSimpleChoice(
            `${context.drawSourceId}_${context.now}`,
            context.playerId,
            context.drawPromptTitle,
            buildMiskatonicMandatoryReadingDrawOptions(context),
            { sourceId: 'miskatonic_things_best_not_known_pod_draw', targetType: 'button', titleKey: context.drawPromptTitleKey },
        );
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) {
            return { events: [], matchState: state };
        }
        if (!context.minionUid || !context.minionDefId) {
            throw new Error(`${context.drawSourceId} resolve 缺少目标随从上下文`);
        }
        const selected = value as { count?: number } | undefined;
        const count = Math.max(0, Math.min(3, Math.floor(selected?.count ?? 0)));
        if (count <= 0) {
            return { events: [], matchState: state };
        }

        const events: SmashUpEvent[] = [];
        const madnessEvent = drawMadnessCards(
            playerId,
            count,
            state.core,
            context.madnessSourceId,
            timestamp,
        );
        if (madnessEvent) {
            events.push(madnessEvent);
        }
        events.push(
            context.boostMode === 'permanent'
                ? addPermanentPower(
                    context.minionUid,
                    context.baseIndex,
                    count * 2,
                    context.madnessSourceId,
                    timestamp,
                )
                : addTempPower(
                    context.minionUid,
                    context.baseIndex,
                    count * 2,
                    context.madnessSourceId,
                    timestamp,
                ),
        );
        return { events, matchState: state };
    },
});

const miskatonicMandatoryReadingProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const baseIndex = ctx.baseIndex ?? 0;
    const base = ctx.state.bases[baseIndex];
    if (!base || base.minions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const context = createMiskatonicMadnessBoostPromptContext(ctx, {
        baseIndex,
        sourceId: 'miskatonic_mandatory_reading',
        drawSourceId: 'miskatonic_mandatory_reading_draw',
        minionPromptTitle: '最好不知道的事：选择一个随从',
        minionPromptTitleKey: 'ui.miskatonic_mandatory_reading_minion_title',
        drawPromptTitle: '最好不知道的事：选择抽取疯狂卡数量',
        drawPromptTitleKey: 'ui.miskatonic_mandatory_reading_draw_title',
        madnessSourceId: 'miskatonic_mandatory_reading',
        boostMode: 'permanent',
    });

    if (!ctx.matchState) return { events: [] };

    return {
        events: [],
        context,
        nextProgram: miskatonicMandatoryReadingChooseMinionPromptProgram,
    };
});

const miskatonicThingsBestNotKnownPodProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const baseIndex = ctx.baseIndex ?? 0;
    const base = ctx.state.bases[baseIndex];
    if (!base || base.minions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const context = createMiskatonicMadnessBoostPromptContext(ctx, {
        baseIndex,
        sourceId: 'miskatonic_things_best_not_known_pod',
        drawSourceId: 'miskatonic_things_best_not_known_pod_draw',
        minionPromptTitle: 'Things Best Not Known：选择一个随从',
        minionPromptTitleKey: 'ui.miskatonic_things_best_not_known_pod_minion_title',
        drawPromptTitle: 'Things Best Not Known：选择抽取疯狂卡数量',
        drawPromptTitleKey: 'ui.miskatonic_things_best_not_known_pod_draw_title',
        madnessSourceId: 'miskatonic_things_best_not_known_pod',
        boostMode: 'temp',
    });

    if (!ctx.matchState) return { events: [] };

    return {
        events: [],
        context,
        nextProgram: miskatonicMandatoryReadingChooseMinionPromptProgram,
    };
});

const miskatonicResearcherChooseMinionPromptProgram = createPromptProgram<MiskatonicResearcherPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'miskatonic_researcher_pod_choose_minion',
    buildInteraction: (context) => {
        if (!context.minionCandidates?.length) {
            throw new Error('miskatonic_researcher_pod_choose_minion 缺少候选随从');
        }
        return createAbilityRuntimeSimpleChoice(
            `miskatonic_researcher_pod_choose_minion_${context.now}`,
            context.playerId,
            '研究员：选择一个随从放置 +1 战斗力标记',
            buildMinionTargetOptions(context.minionCandidates, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'affect',
            }),
            { sourceId: 'miskatonic_researcher_pod_choose_minion', targetType: 'minion', titleKey: 'ui.miskatonic_researcher_pod_choose_minion_title' },
        );
    },
    onResolve: ({ context: _context, state, playerId, value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [], matchState: state };
        }
        const exists = state.core.bases[selected.baseIndex]?.minions.some((minion) => minion.uid === selected.minionUid) ?? false;
        if (!exists) {
            return { events: [], matchState: state };
        }
        const events: SmashUpEvent[] = [];
        const madnessEvent = drawMadnessCards(playerId, 1, state.core, 'miskatonic_researcher_pod', timestamp);
        if (madnessEvent) {
            events.push(madnessEvent);
        }
        events.push(addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'miskatonic_researcher_pod', timestamp));
        return { events, matchState: state };
    },
});

const miskatonicResearcherPromptProgram = createPromptProgram<MiskatonicResearcherPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'miskatonic_researcher',
    interactionSourceIds: ['miskatonic_researcher_pod'],
    buildInteraction: (context) => {
        const options = [
            {
                id: 'draw',
                label: context.sourceId === 'miskatonic_researcher'
                    ? '抽取疯狂卡'
                    : '抽疯狂卡并放置 +1 标记',
                labelKey: context.sourceId === 'miskatonic_researcher'
                    ? 'ui.miskatonic_researcher_draw_madness_option'
                    : 'ui.miskatonic_researcher_pod_draw_and_counter_option',
                value: { draw: true },
                displayMode: 'button' as const,
            },
            { id: 'skip', label: '跳过', labelKey: 'ui.skip', value: { skip: true }, displayMode: 'button' as const },
        ];
        if (context.sourceId === 'miskatonic_researcher') {
            return createAbilityRuntimeSimpleChoice(
                `${context.sourceId}_${context.now}`,
                context.playerId,
                '是否抽取一张疯狂卡？',
                options,
                { sourceId: 'miskatonic_researcher', targetType: 'button', titleKey: 'ui.miskatonic_researcher_title' },
            );
        }
        return createAbilityRuntimeSimpleChoice(
            `${context.sourceId}_${context.now}`,
            context.playerId,
            '研究员：你可以抽一张疯狂卡。若如此做，在一个随从上放置一个 +1 战斗力标记。',
            options,
            { sourceId: 'miskatonic_researcher_pod', targetType: 'button', titleKey: 'ui.miskatonic_researcher_pod_title' },
        );
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) {
            return { events: [], matchState: state };
        }
        if (context.sourceId === 'miskatonic_researcher') {
            const madnessEvent = drawMadnessCards(playerId, 1, state.core, 'miskatonic_researcher', timestamp);
            return { events: madnessEvent ? [madnessEvent] : [], matchState: state };
        }
        if (!context.minionCandidates?.length) {
            return { events: [], matchState: state };
        }
        return {
            events: [],
            matchState: state,
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                sourceId: 'miskatonic_researcher_pod_choose_minion',
            },
            nextProgram: miskatonicResearcherChooseMinionPromptProgram,
        };
    },
});

function buildMiskatonicPsychologistOptions(
    context: MiskatonicPsychologistPromptContext,
) {
    const player = context.matchState.core.players[context.playerId];
    const handMadness = player.hand.filter((card) => card.defId === MADNESS_CARD_DEF_ID && card.uid !== context.cardUid);
    const discardMadness = player.discard.filter((card) => card.defId === MADNESS_CARD_DEF_ID);
    const options: Array<{ id: string; label: string; labelKey?: string; value: { source: string } | { skip: true }; displayMode: 'button' }> = [];

    if (handMadness.length > 0) {
        options.push({
            id: 'hand',
            label: context.sourceId === 'miskatonic_psychologist'
                ? '从手牌返回1张疯狂卡'
                : '将手牌中的一张疯狂卡返回疯狂牌库',
            labelKey: context.sourceId === 'miskatonic_psychologist'
                ? 'ui.miskatonic_psychologist_return_hand_one_option'
                : 'ui.miskatonic_psychologist_pod_return_hand_option',
            value: { source: 'hand' },
            displayMode: 'button',
        });
    }
    if (discardMadness.length > 0) {
        options.push({
            id: 'discard',
            label: context.sourceId === 'miskatonic_psychologist'
                ? '从弃牌堆返回1张疯狂卡'
                : '将弃牌堆中的一张疯狂卡返回疯狂牌库',
            labelKey: context.sourceId === 'miskatonic_psychologist'
                ? 'ui.miskatonic_psychologist_return_discard_one_option'
                : 'ui.miskatonic_psychologist_pod_return_discard_option',
            value: { source: 'discard' },
            displayMode: 'button',
        });
        if (context.allowDrawDiscard) {
            options.push({
                id: 'draw_discard',
                label: '从弃牌堆抓一张疯狂卡',
                labelKey: 'ui.miskatonic_psychologist_draw_discard_option',
                value: { source: 'draw_discard' },
                displayMode: 'button',
            });
        }
    }
    options.push({
        id: 'skip',
        label: '跳过',
        labelKey: 'ui.skip',
        value: { skip: true },
        displayMode: 'button',
    });
    return options;
}

const miskatonicPsychologistPromptProgram = createPromptProgram<MiskatonicPsychologistPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'miskatonic_psychologist',
    interactionSourceIds: ['miskatonic_psychologist_pod'],
    buildInteraction: (context) => {
        const options = buildMiskatonicPsychologistOptions(context);
        if (context.sourceId === 'miskatonic_psychologist') {
            return createAbilityRuntimeSimpleChoice(
                `${context.sourceId}_${context.now}`,
                context.playerId,
                '选择要返回疯狂牌库的疯狂卡（可跳过）',
                options,
                { sourceId: 'miskatonic_psychologist', targetType: 'button', titleKey: 'ui.miskatonic_psychologist_title' },
            );
        }
        return createAbilityRuntimeSimpleChoice(
            `${context.sourceId}_${context.now}`,
            context.playerId,
            '心理学家：选择一个效果（可跳过）',
            options,
            { sourceId: 'miskatonic_psychologist_pod', targetType: 'button', titleKey: 'ui.miskatonic_psychologist_pod_title' },
        );
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) {
            return { events: [], matchState: state };
        }
        const selected = value as { source?: 'hand' | 'discard' | 'draw_discard' } | undefined;
        const source = selected?.source;
        if (!source) {
            return { events: [], matchState: state };
        }
        const player = state.core.players[playerId];
        if (source === 'draw_discard') {
            const card = player.discard.find((entry) => entry.defId === MADNESS_CARD_DEF_ID);
            if (!card) {
                return { events: [], matchState: state };
            }
            return {
                events: [recoverCardsFromDiscard(playerId, [card.uid], context.sourceId, timestamp)],
                matchState: state,
            };
        }
        const pool = source === 'hand' ? player.hand : player.discard;
        const card = pool.find((entry) => entry.defId === MADNESS_CARD_DEF_ID && (source !== 'hand' || entry.uid !== context.cardUid));
        if (!card) {
            return { events: [], matchState: state };
        }
        return {
            events: [returnMadnessCard(playerId, card.uid, context.sourceId, timestamp)],
            matchState: state,
        };
    },
});

function buildMiskatonicBookOptions(
    core: SmashUpCore,
    playerId: string,
    excludedCardUid: string,
) {
    const player = core.players[playerId];
    const handMadness = player.hand.filter((card) => card.defId === MADNESS_CARD_DEF_ID && card.uid !== excludedCardUid);
    const discardMadness = player.discard.filter((card) => card.defId === MADNESS_CARD_DEF_ID);
    const options: Array<{ id: string; label: string; labelKey?: string; value: Record<string, unknown>; displayMode: 'button' }> = [];

    if (handMadness.length >= 1) {
        options.push({ id: 'hand-1', label: '从手牌返回1张疯狂卡', labelKey: 'ui.miskatonic_book_return_hand_one_option', value: { source: 'hand', count: 1 }, displayMode: 'button' });
    }
    if (handMadness.length >= 2) {
        options.push({ id: 'hand-2', label: '从手牌返回2张疯狂卡', labelKey: 'ui.miskatonic_book_return_hand_two_option', value: { source: 'hand', count: 2 }, displayMode: 'button' });
    }
    if (discardMadness.length >= 1) {
        options.push({ id: 'discard-1', label: '从弃牌堆返回1张疯狂卡', labelKey: 'ui.miskatonic_book_return_discard_one_option', value: { source: 'discard', count: 1 }, displayMode: 'button' });
    }
    if (discardMadness.length >= 2) {
        options.push({ id: 'discard-2', label: '从弃牌堆返回2张疯狂卡', labelKey: 'ui.miskatonic_book_return_discard_two_option', value: { source: 'discard', count: 2 }, displayMode: 'button' });
    }
    if (handMadness.length >= 1 && discardMadness.length >= 1) {
        options.push({
            id: 'mixed',
            label: '手牌1张+弃牌堆1张',
            labelKey: 'ui.miskatonic_book_return_mixed_option',
            value: { source: 'mixed', handCount: 1, discardCount: 1 },
            displayMode: 'button',
        });
    }
    options.push({ id: 'skip', label: '不返回', labelKey: 'ui.miskatonic_book_skip_option', value: { skip: true }, displayMode: 'button' });
    return options;
}

const miskatonicBookPromptProgram = createPromptProgram<MiskatonicBookPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'miskatonic_book_of_iter_the_unseen',
    interactionSourceIds: ['miskatonic_jinkies_pod'],
    buildInteraction: (context) => {
        const options = buildMiskatonicBookOptions(context.matchState.core, context.playerId, context.cardUid);
        const interaction = context.sourceId === 'miskatonic_book_of_iter_the_unseen'
            ? createAbilityRuntimeSimpleChoice(
                `${context.sourceId}_${context.now}`,
                context.playerId,
                '金克丝!：选择要返回疯狂卡牌堆的疯狂卡',
                options,
                { sourceId: 'miskatonic_book_of_iter_the_unseen', targetType: 'generic', titleKey: 'ui.miskatonic_book_title' },
            )
            : createAbilityRuntimeSimpleChoice(
                `${context.sourceId}_${context.now}`,
                context.playerId,
                '金克丝!：选择要返回疯狂卡牌堆的疯狂卡',
                options,
                { sourceId: 'miskatonic_jinkies_pod', targetType: 'generic', titleKey: 'ui.miskatonic_book_title' },
            );
        interaction.data.optionsGenerator = (state: MatchState<SmashUpCore>) =>
            buildMiskatonicBookOptions(state.core, context.playerId, context.cardUid);
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) {
            return { events: [], matchState: state };
        }
        const selected = value as { source?: string; count?: number; handCount?: number; discardCount?: number } | undefined;
        const source = selected?.source;
        if (!source) {
            return { events: [], matchState: state };
        }
        const player = state.core.players[playerId];
        const handMadness = player.hand.filter((card) => card.defId === MADNESS_CARD_DEF_ID && card.uid !== context.cardUid);
        const discardMadness = player.discard.filter((card) => card.defId === MADNESS_CARD_DEF_ID);
        const events: SmashUpEvent[] = [];

        if (source === 'hand') {
            for (const card of handMadness.slice(0, selected?.count ?? 1)) {
                events.push(returnMadnessCard(playerId, card.uid, context.sourceId, timestamp));
            }
            return { events, matchState: state };
        }

        if (source === 'discard') {
            for (const card of discardMadness.slice(0, selected?.count ?? 1)) {
                events.push(returnMadnessCard(playerId, card.uid, context.sourceId, timestamp));
            }
            return { events, matchState: state };
        }

        if (source === 'mixed') {
            for (const card of handMadness.slice(0, selected?.handCount ?? 1)) {
                events.push(returnMadnessCard(playerId, card.uid, context.sourceId, timestamp));
            }
            for (const card of discardMadness.slice(0, selected?.discardCount ?? 1)) {
                events.push(returnMadnessCard(playerId, card.uid, context.sourceId, timestamp));
            }
        }

        return { events, matchState: state };
    },
});

function buildMiskatonicFieldTripOptions(
    core: SmashUpCore,
    playerId: string,
    excludedCardUid: string,
    includeMadness: boolean,
    skipLabel: string,
    skipLabelKey: string,
) {
    const handCards = core.players[playerId].hand.filter((card) =>
        card.uid !== excludedCardUid
        && (includeMadness || card.defId !== MADNESS_CARD_DEF_ID),
    );
    const options = handCards.map((card, index) => {
        const def = getCardDef(card.defId);
        return {
            id: `card-${index}`,
            label: def?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'hand' as const,
            displayMode: 'card' as const,
        };
    });
    return [
        ...options,
        { id: 'skip', label: skipLabel, labelKey: skipLabelKey, value: { skip: true }, displayMode: 'button' as const },
    ];
}

const miskatonicFieldTripPromptProgram = createPromptProgram<MiskatonicFieldTripPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'miskatonic_field_trip',
    interactionSourceIds: ['miskatonic_field_trip_pod'],
    buildInteraction: (context) => {
        const skipLabel = context.sourceId === 'miskatonic_field_trip' ? '跳过' : '不放置（仍抽 1）';
        const skipLabelKey = context.sourceId === 'miskatonic_field_trip' ? 'ui.skip' : 'ui.miskatonic_field_trip_pod_skip_option';
        const options = buildMiskatonicFieldTripOptions(
            context.matchState.core,
            context.playerId,
            context.cardUid,
            context.includeMadness,
            skipLabel,
            skipLabelKey,
        );
        const multi = {
            min: 0,
            max: context.matchState.core.players[context.playerId].hand.filter((card) =>
                card.uid !== context.cardUid && (context.includeMadness || card.defId !== MADNESS_CARD_DEF_ID),
            ).length,
        };
        const interaction = context.sourceId === 'miskatonic_field_trip'
            ? createAbilityRuntimeSimpleChoice(
                `${context.sourceId}_${context.now}`,
                context.playerId,
                '选择要放到牌库底的卡牌（抽等量）',
                options,
                { sourceId: 'miskatonic_field_trip', targetType: 'hand', multi, titleKey: 'ui.miskatonic_field_trip_title' },
            )
            : createAbilityRuntimeSimpleChoice(
                `${context.sourceId}_${context.now}`,
                context.playerId,
                '选择要放到牌库底的卡牌（抽取所选数量 + 1）',
                options,
                { sourceId: 'miskatonic_field_trip_pod', targetType: 'hand', multi, titleKey: 'ui.miskatonic_field_trip_pod_title' },
            );
        interaction.data.optionsGenerator = (state: MatchState<SmashUpCore>) =>
            buildMiskatonicFieldTripOptions(
                state.core,
                context.playerId,
                context.cardUid,
                context.includeMadness,
                skipLabel,
                skipLabelKey,
            );
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selectedCards = (Array.isArray(value) ? value : []) as Array<{ cardUid?: string }>;
        const player = state.core.players[playerId];
        const cardUids = selectedCards.map((entry) => entry.cardUid).filter((entry): entry is string => typeof entry === 'string');
        const movedCount = cardUids.length;

        if (context.sourceId === 'miskatonic_field_trip' && movedCount === 0) {
            return { events: [], matchState: state };
        }

        const events: SmashUpEvent[] = [];
        const newDeckUids = [...player.deck.map((card) => card.uid), ...cardUids];
        events.push({
            type: SU_EVENTS.HAND_SHUFFLED_INTO_DECK,
            payload: { playerId, newDeckUids, reason: context.sourceId },
            timestamp,
        } as SmashUpEvent);

        const drawCount = Math.min(movedCount + context.drawBonus, newDeckUids.length);
        if (drawCount > 0) {
            events.push({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId, count: drawCount, cardUids: newDeckUids.slice(0, drawCount) },
                timestamp,
            } as CardsDrawnEvent);
        }
        return { events, matchState: state };
    },
});

const miskatonicLibrarianPodPlayMadnessPromptProgram = createPromptProgram<MiskatonicLibrarianPodPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'miskatonic_librarian_pod_play_madness',
    buildInteraction: (context) => {
        const madnessCards = context.matchState.core.players[context.playerId].hand
            .filter((card) => card.defId === MADNESS_CARD_DEF_ID);
        const interaction = createAbilityRuntimeSimpleChoice(
            `miskatonic_librarian_pod_play_madness_${context.now}`,
            context.playerId,
            '图书管理员：选择一张疯狂卡，作为额外战术打出',
            madnessCards.map((card, index) => ({
                id: `madness-${index}`,
                label: getCardDef(card.defId)?.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId },
                _source: 'hand' as const,
                displayMode: 'card' as const,
            })),
            { sourceId: 'miskatonic_librarian_pod_play_madness', targetType: 'hand', titleKey: 'ui.miskatonic_librarian_pod_play_madness_title' },
        );
        interaction.data.optionsGenerator = (state: MatchState<SmashUpCore>) =>
            state.core.players[context.playerId].hand
                .filter((card) => card.defId === MADNESS_CARD_DEF_ID)
                .map((card, index) => ({
                    id: `madness-${index}`,
                    label: getCardDef(card.defId)?.name ?? card.defId,
                    value: { cardUid: card.uid, defId: card.defId },
                    _source: 'hand' as const,
                    displayMode: 'card' as const,
                }));
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        const selected = (Array.isArray(value) ? value[0] : value) as { cardUid?: string } | undefined;
        const cardUid = selected?.cardUid;
        if (!cardUid) {
            return { events: [], matchState: state };
        }
        const card = state.core.players[playerId].hand.find((entry) => entry.uid === cardUid && entry.defId === MADNESS_CARD_DEF_ID);
        if (!card) {
            return { events: [], matchState: state };
        }
        const events: SmashUpEvent[] = [buildActionPlayedEvent({
            playerId,
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            isExtraAction: true,
            timestamp,
        }) as SmashUpEvent];
        return {
            events,
            context: {
                matchState: state,
                playerId,
                cardUid: card.uid,
                defId: card.defId,
                random,
                now: timestamp,
                baseIndex: context.baseIndex ?? 0,
            } satisfies MiskatonicResolvedActionAfterPlayedContext,
            nextProgram: miskatonicResolvedActionAfterPlayedProgram,
        };
    },
});

const miskatonicLibrarianPodPromptProgram = createPromptProgram<MiskatonicLibrarianPodPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'miskatonic_librarian_pod',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `miskatonic_librarian_pod_${context.now}`,
        context.playerId,
        '图书管理员：选择一个效果',
        [
            { id: 'draw', label: '抓一张疯狂卡', labelKey: 'ui.miskatonic_librarian_pod_draw_option', value: { mode: 'draw' }, displayMode: 'button' as const },
            { id: 'extra', label: '你可以将一张疯狂卡作为额外战术打出', labelKey: 'ui.miskatonic_librarian_pod_extra_action_option', value: { mode: 'extra' }, displayMode: 'button' as const },
        ],
        { sourceId: 'miskatonic_librarian_pod', targetType: 'button', titleKey: 'ui.miskatonic_librarian_pod_title' },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selected = value as { mode?: 'draw' | 'extra' } | undefined;
        if (selected?.mode === 'draw') {
            const madnessEvent = drawMadnessCards(playerId, 1, state.core, 'miskatonic_librarian_pod', timestamp);
            return { events: madnessEvent ? [madnessEvent] : [], matchState: state };
        }
        if (selected?.mode !== 'extra') {
            return { events: [], matchState: state };
        }
        const hasMadness = state.core.players[playerId].hand.some((card) => card.defId === MADNESS_CARD_DEF_ID);
        if (!hasMadness) {
            return { events: [buildAbilityFeedback(playerId, 'feedback.hand_empty', timestamp)], matchState: state };
        }
        return {
            events: [],
            matchState: state,
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                sourceId: 'miskatonic_librarian_pod_play_madness',
            },
            nextProgram: miskatonicLibrarianPodPlayMadnessPromptProgram,
        };
    },
});

const miskatonicItJustMightWorkPodPromptProgram = createPromptProgram<MiskatonicItJustMightWorkPodPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'miskatonic_it_just_might_work_pod',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `miskatonic_it_just_might_work_pod_${context.now}`,
        context.playerId,
        '...没准能行：选择要弃置的疯狂卡数量（至多2张）',
        Array.from({ length: context.maxDiscard + 1 }, (_, index) => ({
            id: `discard-${index}`,
            label: index === 0 ? '不弃置' : `弃置${index}张疯狂卡（每张使你场上的随从+1战斗力直到回合结束）`,
            labelKey: index === 0
                ? 'ui.miskatonic_it_just_might_work_pod_no_discard_option'
                : 'ui.miskatonic_it_just_might_work_pod_discard_option',
            ...(index === 0 ? {} : { labelParams: { count: index } }),
            value: { count: index },
            displayMode: 'button' as const,
        })),
        { sourceId: 'miskatonic_it_just_might_work_pod', targetType: 'button', titleKey: 'ui.miskatonic_it_just_might_work_pod_title' },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const count = Math.max(0, Math.min(2, Math.floor(((value as { count?: number } | undefined)?.count) ?? 0)));
        const madness = state.core.players[playerId].hand
            .filter((card) => card.defId === MADNESS_CARD_DEF_ID)
            .slice(0, count);
        const events: SmashUpEvent[] = [];
        if (madness.length > 0) {
            events.push({
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId, cardUids: madness.map((card) => card.uid) },
                timestamp,
            } as SmashUpEvent);
            for (let baseIndex = 0; baseIndex < state.core.bases.length; baseIndex += 1) {
                for (const minion of state.core.bases[baseIndex].minions) {
                    if (minion.controller === playerId) {
                        events.push(addTempPower(minion.uid, baseIndex, madness.length, 'miskatonic_it_just_might_work_pod', timestamp));
                    }
                }
            }
        }
        return { events, matchState: state };
    },
});

function collectMeddlingKidsBaseCandidates(core: SmashUpCore) {
    const candidates: { baseIndex: number; label: string }[] = [];
    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex += 1) {
        const base = core.bases[baseIndex];
        let actionCount = base.ongoingActions.length;
        for (const minion of base.minions) {
            actionCount += minion.attachedActions.length;
        }
        if (actionCount <= 0) continue;
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        candidates.push({ baseIndex, label: `${baseName}（${actionCount}张行动卡）` });
    }
    return candidates;
}

function collectMeddlingKidsActionChoices(
    core: SmashUpCore,
    baseIndex: number,
    removedActionUids: string[] = [],
) {
    const base = core.bases[baseIndex];
    if (!base) return [];
    const removed = new Set(removedActionUids);
    const options: Array<{ uid: string; defId: string; ownerId: string; label: string }> = [];

    for (const ongoing of base.ongoingActions) {
        if (removed.has(ongoing.uid)) continue;
        options.push({
            uid: ongoing.uid,
            defId: ongoing.defId,
            ownerId: ongoing.ownerId,
            label: getCardDef(ongoing.defId)?.name ?? ongoing.defId,
        });
    }

    for (const minion of base.minions) {
        const minionName = getCardDef(minion.defId)?.name ?? minion.defId;
        for (const attached of minion.attachedActions) {
            if (removed.has(attached.uid)) continue;
            options.push({
                uid: attached.uid,
                defId: attached.defId,
                ownerId: attached.ownerId,
                label: `${getCardDef(attached.defId)?.name ?? attached.defId}（附着在 ${minionName} 上）`,
            });
        }
    }

    return options;
}

const miskatonicMeddlingKidsSelectPromptProgram = createPromptProgram<MiskatonicMeddlingKidsPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'miskatonic_those_meddling_kids_select',
    buildInteraction: (context) => {
        if (context.baseIndex === undefined) {
            throw new Error('miskatonic_those_meddling_kids_select 缺少 baseIndex');
        }
        const actionCards = collectMeddlingKidsActionChoices(
            context.matchState.core,
            context.baseIndex,
            context.removedActionUids ?? [],
        );
        if (actionCards.length === 0) {
            throw new Error('miskatonic_those_meddling_kids_select 没有可消灭的行动卡');
        }
        return createAbilityRuntimeSimpleChoice(
            `miskatonic_those_meddling_kids_select_${context.now}`,
            context.playerId,
            '多管闲事的小鬼：点击要消灭的行动卡（可选）',
            [
                { id: 'skip', label: '跳过（不再消灭）', labelKey: 'ui.miskatonic_meddling_kids_skip_destroy_option', value: { skip: true }, displayMode: 'button' as const },
                ...actionCards.map((card, index) => ({
                    id: `action-${index}`,
                    label: card.label,
                    value: { cardUid: card.uid, defId: card.defId, ownerId: card.ownerId },
                    _source: 'ongoing' as const,
                    displayMode: 'card' as const,
                })),
            ],
            { sourceId: 'miskatonic_those_meddling_kids_select', targetType: 'ongoing', titleKey: 'ui.miskatonic_meddling_kids_select_title' },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as { skip?: boolean; cardUid?: string; defId?: string; ownerId?: string } | undefined;
        if (selected?.skip || context.baseIndex === undefined || !selected?.cardUid || !selected.defId || !selected.ownerId) {
            return { events: [], matchState: state };
        }
        const currentChoices = collectMeddlingKidsActionChoices(
            state.core,
            context.baseIndex,
            context.removedActionUids ?? [],
        );
        if (!currentChoices.some((card) => card.uid === selected.cardUid && card.defId === selected.defId && card.ownerId === selected.ownerId)) {
            return { events: [], matchState: state };
        }

        const events: SmashUpEvent[] = buildValidatedOngoingDetachEvents(state, {
            cardUid: selected.cardUid,
            defId: selected.defId,
            ownerId: selected.ownerId,
            reason: 'miskatonic_those_meddling_kids',
            now: timestamp,
        });
        if (events.length === 0) {
            return { events: [], matchState: state };
        }

        const removedActionUids = [...(context.removedActionUids ?? []), selected.cardUid];
        if (collectMeddlingKidsActionChoices(state.core, context.baseIndex, removedActionUids).length <= 0) {
            return { events, matchState: state };
        }

        return {
            events,
            matchState: state,
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                removedActionUids,
            },
            nextProgram: miskatonicMeddlingKidsSelectPromptProgram,
        };
    },
});

const miskatonicMeddlingKidsBasePromptProgram = createPromptProgram<MiskatonicMeddlingKidsPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'miskatonic_those_meddling_kids',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `miskatonic_those_meddling_kids_${context.now}`,
        context.playerId,
        '选择一个基地消灭其上的行动卡',
        buildBaseTargetOptions(collectMeddlingKidsBaseCandidates(context.matchState.core), context.matchState.core),
        {
            sourceId: 'miskatonic_those_meddling_kids',
            targetType: 'base',
            autoResolveIfSingle: false,
            titleKey: 'ui.miskatonic_meddling_kids_base_title',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as { baseIndex?: number } | undefined;
        if (selected?.baseIndex === undefined) {
            return { events: [], matchState: state };
        }
        if (collectMeddlingKidsActionChoices(state.core, selected.baseIndex).length <= 0) {
            return { events: [], matchState: state };
        }
        return {
            events: [],
            matchState: state,
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                sourceId: 'miskatonic_those_meddling_kids_select',
                baseIndex: selected.baseIndex,
                removedActionUids: [],
            },
            nextProgram: miskatonicMeddlingKidsSelectPromptProgram,
        };
    },
});

const miskatonicThoseMeddlingKidsPodModePromptProgram = createPromptProgram<MiskatonicMeddlingKidsPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'miskatonic_those_meddling_kids_pod_mode',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `miskatonic_those_meddling_kids_pod_mode_${context.now}`,
        context.playerId,
        '那些爱管闲事的孩子：选择一个效果',
        [
            { id: 'destroy', label: '消灭一个基地上任意数量的战术', labelKey: 'ui.miskatonic_meddling_kids_pod_destroy_option', value: { mode: 'destroy' }, displayMode: 'button' as const },
            { id: 'madness', label: '抽一张疯狂卡并额外打出一张战术', labelKey: 'ui.miskatonic_meddling_kids_pod_madness_option', value: { mode: 'madness' }, displayMode: 'button' as const },
        ],
        { sourceId: 'miskatonic_those_meddling_kids_pod_mode', targetType: 'button', titleKey: 'ui.miskatonic_meddling_kids_pod_mode_title' },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selected = value as { mode?: 'destroy' | 'madness' } | undefined;
        if (selected?.mode === 'madness') {
            const events: SmashUpEvent[] = [];
            const madnessEvent = drawMadnessCards(playerId, 1, state.core, 'miskatonic_those_meddling_kids_pod', timestamp);
            if (madnessEvent) {
                events.push(madnessEvent);
            }
            events.push(grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, 'miskatonic_those_meddling_kids_pod'));
            return { events, matchState: state };
        }
        if (selected?.mode !== 'destroy') {
            return { events: [], matchState: state };
        }
        if (collectMeddlingKidsBaseCandidates(state.core).length <= 0) {
            return { events: [], matchState: state };
        }
        return {
            events: [],
            matchState: state,
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                sourceId: 'miskatonic_those_meddling_kids',
            },
            nextProgram: miskatonicMeddlingKidsBasePromptProgram,
        };
    },
});

/**
 * 这太疯狂了... onPlay：抽一张疯狂卡 + 全体己方随从+1力量直到回合结束 + 额外打出一个战术
 *
 * 中文版规则：抽一张疯狂卡。你的每个随从获得+1力量直到回合结束。本回合你可以打出一个额外的战术。
 */
function miskatonicPsychologicalProfiling(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    // 抽1张疯狂卡
    const madnessEvt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'miskatonic_psychological_profiling', ctx.now);
    if (madnessEvt) events.push(madnessEvt);
    // 全体己方随从+1力量直到回合结束
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) {
                events.push(addTempPower(m.uid, i, 1, 'miskatonic_psychological_profiling', ctx.now));
            }
        }
    }
    // 额外打出1个战术
    events.push(grantContextualExtraAction(ctx, 'miskatonic_psychological_profiling'));
    return { events };
}

/**
 * 通往超凡的门 talent（ongoing 行动卡）：抽一张疯狂卡，你可以额外打出一个随从到这
 *
 * 中文版规则：打出到基地上。天赋：抽一张疯狂卡，你可以额外打出一个随从到这。
 */
function miskatonicLostKnowledge(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    // 抽1张疯狂卡
    const madnessEvt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'miskatonic_lost_knowledge', ctx.now);
    if (madnessEvt) events.push(madnessEvt);
    // 额外打出1个随从到此基地（restrictToBase 限定到 ongoing 所在基地）
    if (ctx.baseIndex !== undefined) {
        events.push(grantContextualExtraMinion(ctx, 'miskatonic_lost_knowledge', ctx.baseIndex));
    } else {
        events.push(grantContextualExtraMinion(ctx, 'miskatonic_lost_knowledge'));
    }
    return { events };
}

/**
 * 教授 talent：弃1张疯狂卡 → 额外行动 + 额外随从
 *
 * 官方规则：Discard a Madness card. If you do, you may play an extra action and/or an extra minion.
 */
function miskatonicProfessorTalent(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const player = ctx.state.players[ctx.playerId];

    // 检查手中是否有疯狂卡
    const madnessCard = player.hand.find(c => c.defId === MADNESS_CARD_DEF_ID);
    if (!madnessCard) return { events: [] };

    // 弃掉疯狂卡（放入弃牌堆，不是返回疯狂牌库）
    events.push({
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: { playerId: ctx.playerId, cardUids: [madnessCard.uid] },
        timestamp: ctx.now,
    } as SmashUpEvent);

    // 额外行动 + 额外随从
    events.push(grantExtraAction(ctx.playerId, 'miskatonic_professor', ctx.now));
    events.push(grantExtraMinion(ctx.playerId, 'miskatonic_professor', ctx.now));

    return { events };
}

const miskatonicLibrarianAfterDiscardProgram = createEffectProgram<
    MiskatonicLibrarianAfterDiscardContext,
    SmashUpCore,
    SmashUpEvent
>((context) => ({
    events: buildStandardDrawEvents(context.matchState.core, context.playerId, 1, context.random, context.now),
}));

/**
 * 图书管理员 talent：弃1张疯狂卡 → 抽1张牌
 *
 * 官方规则：Discard a Madness card. If you do, draw a card.
 */
const miskatonicLibrarianTalentProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const player = ctx.state.players[ctx.playerId];

    // 检查手中是否有疯狂卡
    const madnessCard = player.hand.find(c => c.defId === MADNESS_CARD_DEF_ID);
    if (!madnessCard) return { events: [] };

    // 弃掉疯狂卡（放入弃牌堆）
    const discardEvent: SmashUpEvent = {
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: { playerId: ctx.playerId, cardUids: [madnessCard.uid] },
        timestamp: ctx.now,
    } as SmashUpEvent;

    return {
        events: [discardEvent],
        context: {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            random: ctx.random,
        } satisfies MiskatonicLibrarianAfterDiscardContext,
        nextProgram: miskatonicLibrarianAfterDiscardProgram,
    };
});

// ============================================================================
// Priority 2: 需要 Prompt 的疯狂卡能力
// ============================================================================

/**
 * 也许能行 onPlay：弃2张疯狂卡消灭一个随从
 */
/**
 * 它可能有用 onPlay：弃掉一张疯狂卡来使你的每个随从获得+1力量直到回合结束
 *
 * 中文版规则：弃掉一张疯狂卡来使你的每个随从获得+1力量直到回合结束。
 */
function miskatonicItMightJustWork(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const madnessInHand = player.hand.filter(
        c => c.defId === MADNESS_CARD_DEF_ID && c.uid !== ctx.cardUid
    );
    if (madnessInHand.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };

    const events: SmashUpEvent[] = [];
    // 弃掉1张疯狂卡
    events.push({
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: { playerId: ctx.playerId, cardUids: [madnessInHand[0].uid] },
        timestamp: ctx.now,
    } as SmashUpEvent);
    // 所有己方随从+1力量（临时，回合结束清零）
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) {
                events.push(addTempPower(m.uid, i, 1, 'miskatonic_it_might_just_work', ctx.now));
            }
        }
    }
    return { events };
}

function collectThingOnDoorstepTopMinions(
    core: SmashUpCore,
    baseIndex: number,
) {
    const base = core.bases[baseIndex];
    if (!base || base.minions.length === 0) return [];
    let maxPower = -Infinity;
    for (const minion of base.minions) {
        maxPower = Math.max(maxPower, getMinionPower(core, minion, baseIndex));
    }
    return base.minions
        .filter((minion) => getMinionPower(core, minion, baseIndex) === maxPower)
        .map((minion) => {
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            const name = def?.name ?? minion.defId;
            const power = getMinionPower(core, minion, baseIndex);
            return { uid: minion.uid, defId: minion.defId, baseIndex, label: `${name} (力量 ${power})` };
        });
}

const miskatonicThingOnTheDoorstepPromptProgram = createPromptProgram<MiskatonicThingOnDoorstepPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'miskatonic_thing_on_the_doorstep',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `miskatonic_thing_on_the_doorstep_${context.now}`,
        context.playerId,
        '老詹金斯!?：选择要消灭的最高力量随从',
        buildActionMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            effectType: 'destroy',
        }),
        { sourceId: 'miskatonic_thing_on_the_doorstep', targetType: 'minion', titleKey: 'ui.miskatonic_thing_on_the_doorstep_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as { minionUid?: string; defId?: string } | undefined;
        if (!selected?.minionUid || !selected.defId) {
            return { events: [], matchState: state };
        }
        const target = state.core.bases[context.baseIndex]?.minions
            .find((minion) => minion.uid === selected.minionUid && minion.defId === selected.defId);
        if (!target) {
            return { events: [], matchState: state };
        }
        return {
            events: buildValidatedDestroyEvents(state, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: context.baseIndex,
                destroyerId: undefined,
                reason: 'miskatonic_thing_on_the_doorstep',
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceDefId: 'miskatonic_thing_on_the_doorstep',
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.baseIndex,
                sourceKind: 'action',
            }),
            matchState: state,
        };
    },
});

/** 注册米斯卡塔尼克大学派系所有能力（放在所有函数定义之后，避免 Vite SSR 提升失效） */
export function registerMiskatonicAbilities(): void {
    // 疯狂牌堆是共享资源；米斯卡塔尼克单独注册时也需要 special_madness 的 onPlay。
    registerMadnessAbilities();

    // === 行动卡 ===
    // 这些多管闲事的小鬼：消灭一个基地上所有行动卡
    registerAbilityProgram('miskatonic_those_meddling_kids', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
            if (collectMeddlingKidsBaseCandidates(ctx.state).length <= 0) {
                return { events: [] };
            }
            return {
                events: [],
                context: createMiskatonicMeddlingKidsPromptContext(ctx, {
                    sourceId: 'miskatonic_those_meddling_kids',
                    baseIndex: undefined,
                    removedActionUids: [],
                }),
                nextProgram: miskatonicMeddlingKidsBasePromptProgram,
            };
        }),
    });
    registerAbilityProgram('miskatonic_those_meddling_kids_pod', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => ({
            events: [],
            context: createMiskatonicMeddlingKidsPromptContext(ctx, {
                sourceId: 'miskatonic_those_meddling_kids_pod_mode',
                baseIndex: undefined,
                removedActionUids: [],
            }),
            nextProgram: miskatonicThoseMeddlingKidsPodModePromptProgram,
        })),
    });
    // 心理分析（这太疯狂了...）：抽疯狂卡+全体己方随从+1力量+额外战术
    registerAbility('miskatonic_psychological_profiling', 'onPlay', miskatonicPsychologicalProfiling);
    registerAbility('miskatonic_thats_so_crazy_pod', 'onPlay', miskatonicPsychologicalProfiling);
    // 最好不知道的事：special，基地计分前选随从+抽疯狂卡+该随从+2力量/张
    registerAbilityProgram('miskatonic_mandatory_reading', 'special', { program: miskatonicMandatoryReadingProgram });
    registerAbilityProgram('miskatonic_things_best_not_known_pod', 'special', { program: miskatonicThingsBestNotKnownPodProgram });
    // 失落的知识（通往超凡的门）：ongoing talent，抽疯狂卡+额外随从到此基地
    registerAbility('miskatonic_lost_knowledge', 'talent', miskatonicLostKnowledge);
    registerAbility('miskatonic_eldritch_gate_pod', 'talent', miskatonicLostKnowledge);
    // 也许能行（它可能有用）：弃1张疯狂卡，己方所有随从+1力量直到回合结束
    registerAbility('miskatonic_it_might_just_work', 'onPlay', miskatonicItMightJustWork);
    registerAbilityProgram('miskatonic_it_just_might_work_pod', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
            const madnessInHand = ctx.state.players[ctx.playerId].hand
                .filter((card) => card.defId === MADNESS_CARD_DEF_ID && card.uid !== ctx.cardUid);
            if (madnessInHand.length === 0) {
                return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
            }
            return {
                events: [],
                context: createMiskatonicItJustMightWorkPodPromptContext(ctx, {
                    maxDiscard: Math.min(2, madnessInHand.length),
                }),
                nextProgram: miskatonicItJustMightWorkPodPromptProgram,
            };
        }),
    });
    // 不可见之书（金克丝!）：从手牌/弃牌堆返回至多2张疯狂卡到疯狂牌库
    registerAbilityProgram('miskatonic_book_of_iter_the_unseen', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
            const player = ctx.state.players[ctx.playerId];
            const handMadness = player.hand.filter((card) => card.defId === MADNESS_CARD_DEF_ID && card.uid !== ctx.cardUid);
            const discardMadness = player.discard.filter((card) => card.defId === MADNESS_CARD_DEF_ID);
            if (handMadness.length + discardMadness.length === 0) {
                return { events: [] };
            }
            return {
                events: [],
                context: createMiskatonicBookPromptContext(ctx, { sourceId: 'miskatonic_book_of_iter_the_unseen' }),
                nextProgram: miskatonicBookPromptProgram,
            };
        }),
    });
    registerAbilityProgram('miskatonic_jinkies_pod', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
            const player = ctx.state.players[ctx.playerId];
            const handMadness = player.hand.filter((card) => card.defId === MADNESS_CARD_DEF_ID && card.uid !== ctx.cardUid);
            const discardMadness = player.discard.filter((card) => card.defId === MADNESS_CARD_DEF_ID);
            if (handMadness.length + discardMadness.length === 0) {
                return { events: [] };
            }
            return {
                events: [],
                context: createMiskatonicBookPromptContext(ctx, { sourceId: 'miskatonic_jinkies_pod' }),
                nextProgram: miskatonicBookPromptProgram,
            };
        }),
    });
    // 老詹金斯!?：特殊，基地计分前消灭该基地最高力量随从
    registerAbilityProgram('miskatonic_thing_on_the_doorstep', 'special', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
            const baseIndex = ctx.baseIndex ?? 0;
            const candidates = collectThingOnDoorstepTopMinions(ctx.state, baseIndex);
            if (candidates.length === 0) {
                return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
            }
            const promptOptions = buildActionMinionTargetOptions(candidates, {
                state: ctx.state,
                sourcePlayerId: ctx.playerId,
                effectType: 'destroy',
            });
            if (promptOptions.length === 0) {
                return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.all_protected', ctx.now)] };
            }
            if (!ctx.matchState) return { events: [] };
            return {
                events: [],
                context: createMiskatonicThingOnDoorstepPromptContext(ctx, { baseIndex, candidates }),
                nextProgram: miskatonicThingOnTheDoorstepPromptProgram,
            };
        }),
    });
    registerAbilityProgram('miskatonic_old_man_jenkins_pod', 'special', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
            const baseIndex = ctx.baseIndex ?? 0;
            const candidates = collectThingOnDoorstepTopMinions(ctx.state, baseIndex);
            if (candidates.length === 0) {
                return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
            }
            const promptOptions = buildActionMinionTargetOptions(candidates, {
                state: ctx.state,
                sourcePlayerId: ctx.playerId,
                effectType: 'destroy',
            });
            if (promptOptions.length === 0) {
                return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.all_protected', ctx.now)] };
            }
            if (!ctx.matchState) return { events: [] };
            return {
                events: [],
                context: createMiskatonicThingOnDoorstepPromptContext(ctx, { baseIndex, candidates }),
                nextProgram: miskatonicThingOnTheDoorstepPromptProgram,
            };
        }),
    });
    // 实地考察：手牌放牌库底 + 抽等量牌
    registerAbilityProgram('miskatonic_field_trip', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
            const handCards = ctx.state.players[ctx.playerId].hand
                .filter((card) => card.uid !== ctx.cardUid && card.defId !== MADNESS_CARD_DEF_ID);
            if (handCards.length === 0) {
                return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.hand_empty', ctx.now)] };
            }
            return {
                events: [],
                context: createMiskatonicFieldTripPromptContext(ctx, {
                    sourceId: 'miskatonic_field_trip',
                    includeMadness: false,
                    drawBonus: 0,
                }),
                nextProgram: miskatonicFieldTripPromptProgram,
            };
        }),
    });
    registerAbilityProgram('miskatonic_field_trip_pod', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
            const handCards = ctx.state.players[ctx.playerId].hand
                .filter((card) => card.uid !== ctx.cardUid);
            if (handCards.length === 0) {
                return {
                    events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
                };
            }
            return {
                events: [],
                context: createMiskatonicFieldTripPromptContext(ctx, {
                    sourceId: 'miskatonic_field_trip_pod',
                    includeMadness: true,
                    drawBonus: 1,
                }),
                nextProgram: miskatonicFieldTripPromptProgram,
            };
        }),
    });

    // === 随从 ===
    // 教授（power 5, talent）：弃1张疯狂卡 → 额外行动 + 额外随从
    registerAbility('miskatonic_professor', 'talent', {
        execute: miskatonicProfessorTalent,
        validateUse: (ctx) => {
            const player = ctx.state.players[ctx.playerId];
            return player.hand.some(c => c.defId === MADNESS_CARD_DEF_ID) ? null : '手中没有疯狂卡';
        },
    });
    registerAbility('miskatonic_professor_pod', 'talent', {
        execute: miskatonicProfessorTalent,
        validateUse: (ctx) => {
            const player = ctx.state.players[ctx.playerId];
            return player.hand.some(c => c.defId === MADNESS_CARD_DEF_ID) ? null : '手中没有疯狂卡';
        },
    });
    // 图书管理员（power 4, talent）：弃1张疯狂卡 → 抽1张牌
    registerAbilityProgram('miskatonic_librarian', 'talent', {
        program: miskatonicLibrarianTalentProgram,
        validateUse: (ctx) => {
            const player = ctx.state.players[ctx.playerId];
            return player.hand.some(c => c.defId === MADNESS_CARD_DEF_ID) ? null : '手中没有疯狂卡';
        },
    });
    registerAbilityProgram('miskatonic_librarian_pod', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => ({
            events: [],
            context: createMiskatonicLibrarianPodPromptContext(ctx, {
                sourceId: 'miskatonic_librarian_pod',
                baseIndex: ctx.baseIndex,
            }),
            nextProgram: miskatonicLibrarianPodPromptProgram,
        })),
    });
    // 心理学家（power 3, onPlay）：将手牌或弃牌堆中的1张疯狂卡返回疯狂牌库
    registerAbilityProgram('miskatonic_psychologist', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
            const player = ctx.state.players[ctx.playerId];
            const handMadness = player.hand.filter((card) => card.defId === MADNESS_CARD_DEF_ID && card.uid !== ctx.cardUid);
            const discardMadness = player.discard.filter((card) => card.defId === MADNESS_CARD_DEF_ID);
            if (handMadness.length === 0 && discardMadness.length === 0) return { events: [] };
            return {
                events: [],
                context: createMiskatonicPsychologistPromptContext(ctx, {
                    sourceId: 'miskatonic_psychologist',
                    allowDrawDiscard: false,
                }),
                nextProgram: miskatonicPsychologistPromptProgram,
            };
        }),
    });
    registerAbilityProgram('miskatonic_psychologist_pod', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
            const player = ctx.state.players[ctx.playerId];
            const handMadness = player.hand.filter((card) => card.defId === MADNESS_CARD_DEF_ID && card.uid !== ctx.cardUid);
            const discardMadness = player.discard.filter((card) => card.defId === MADNESS_CARD_DEF_ID);
            if (handMadness.length === 0 && discardMadness.length === 0) return { events: [] };
            return {
                events: [],
                context: createMiskatonicPsychologistPromptContext(ctx, {
                    sourceId: 'miskatonic_psychologist_pod',
                    allowDrawDiscard: true,
                }),
                nextProgram: miskatonicPsychologistPromptProgram,
            };
        }),
    });
    // 研究员（power 2, onPlay）：抽1张疯狂卡
    registerAbilityProgram('miskatonic_researcher', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
            if (!ctx.state.madnessDeck || ctx.state.madnessDeck.length === 0) {
                return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
            }
            return {
                events: [],
                context: createMiskatonicResearcherPromptContext(ctx, { sourceId: 'miskatonic_researcher' }),
                nextProgram: miskatonicResearcherPromptProgram,
            };
        }),
    });
    registerAbilityProgram('miskatonic_researcher_pod', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
            if (!ctx.state.madnessDeck || ctx.state.madnessDeck.length === 0) {
                return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
            }
            const minionCandidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
            for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex += 1) {
                const base = ctx.state.bases[baseIndex];
                for (const minion of base.minions) {
                    const def = getCardDef(minion.defId) as MinionCardDef | undefined;
                    const name = def?.name ?? minion.defId;
                    const power = getMinionPower(ctx.state, minion, baseIndex);
                    minionCandidates.push({
                        uid: minion.uid,
                        defId: minion.defId,
                        baseIndex,
                        label: `${name} (力量 ${power})`,
                    });
                }
            }
            if (minionCandidates.length === 0) {
                return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
            }
            return {
                events: [],
                context: createMiskatonicResearcherPromptContext(ctx, {
                    sourceId: 'miskatonic_researcher_pod',
                    minionCandidates,
                }),
                nextProgram: miskatonicResearcherPromptProgram,
            };
        }),
    });
}

export function registerMiskatonicInteractionHandlers(): void {
    // 教授的交互处理器已移除（教授现在是 talent，不需要选择目标）
    // 它可能有用的交互处理器已移除（不再需要选择随从，改为全体+1力量）
}
