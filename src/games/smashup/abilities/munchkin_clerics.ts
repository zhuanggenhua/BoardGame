import { registerAbility, type AbilityContext, type AbilityResult } from '../domain/abilityRegistry';
import {
    addTempPower,
    buildActionMinionTargetOptions,
    buildBaseTargetOptions,
    buildValidatedMoveEvents,
    createSkipOption,
    grantExtraAction,
    recoverCardsFromDiscard,
} from '../domain/abilityHelpers';
import { buildValidatedOngoingDetachEvents, findLiveOngoingCardLocation } from '../domain/ongoingDetach';
import { registerCardAbilitySuppression, registerTrigger, type TriggerContext, type TriggerResult } from '../domain/ongoingEffects';
import { registerBaseAbility, type BaseAbilityContext, type BaseAbilityResult } from '../domain/baseAbilities';
import { getBaseDef, getCardDef } from '../data/cards';
import { isMunchkinUndeadMonster } from '../data/factions/munchkin';
import { SU_EVENTS, type CardInstance, type SmashUpCore, type SmashUpEvent } from '../domain/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import type { MatchState } from '../../../engine/types';

const CARDINAL = 'munchkin_clerics_cardinal';
const DEEP_FRIAR = 'munchkin_clerics_deep_friar';
const TURNER = 'munchkin_clerics_turner';
const HOLY_ROLLER = 'munchkin_clerics_holy_roller';
const BIN_AND_GONE = 'munchkin_clerics_bin_and_gone';
const COLLECTION_PLATE = 'munchkin_clerics_collection_plate';
const CURSE_OF_IMPRISONMENT = 'munchkin_clerics_curse_of_imprisonment';
const GOOD_HABITS = 'munchkin_clerics_good_habits';
const JOIN_THE_CLUB = 'munchkin_clerics_join_the_club';
const REMOVE_CURSE = 'munchkin_clerics_remove_curse';
const WORD_OF_RECALL = 'munchkin_clerics_word_of_recall';
const BASE_HOTEL_OF_HOLINESS = 'base_hotel_of_holiness';

const DEEP_FRIAR_MINION_SOURCE_ID = 'munchkin_clerics_deep_friar_minion';
const DEEP_FRIAR_BASE_SOURCE_ID = 'munchkin_clerics_deep_friar_base';
const TURNER_MODE_SOURCE_ID = 'munchkin_clerics_turner_mode';
const TURNER_MONSTER_SOURCE_ID = 'munchkin_clerics_turner_monster';
const HOLY_ROLLER_MODE_SOURCE_ID = 'munchkin_clerics_holy_roller_mode';
const BIN_AND_GONE_MINION_SOURCE_ID = 'munchkin_clerics_bin_and_gone_minion';
const REMOVE_CURSE_ACTION_SOURCE_ID = 'munchkin_clerics_remove_curse_action';
const WORD_OF_RECALL_ACTION_SOURCE_ID = 'munchkin_clerics_word_of_recall_action';
const HOTEL_OF_HOLINESS_MINION_SOURCE_ID = 'munchkin_clerics_hotel_of_holiness_minion';

type MinionChoice = {
    minionUid?: string;
    minionDefId?: string;
    baseIndex?: number;
};

type BaseChoice = {
    baseIndex?: number;
    baseDefId?: string;
};

type TurnerMode = 'destroyUndead' | 'recoverMinion';

type TurnerModeChoice = {
    mode?: TurnerMode;
};

type HolyRollerModeChoice = {
    shuffle?: boolean;
    skip?: boolean;
};

type DeepFriarInteractionData = {
    sourceMinionUid?: string;
    sourceBaseIndex?: number;
};

type TurnerInteractionData = {
    sourceMinionUid?: string;
    sourceBaseIndex?: number;
};

type BinAndGoneInteractionData = {
    sourceCardUid?: string;
    sourceBaseIndex?: number;
    scoringBaseIndex?: number;
    sourcePlayerId?: string;
};

type HotelInteractionData = {
    baseIndex?: number;
    pendingMinionUids?: string[];
};

type WordOfRecallCardChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: string;
    skip?: boolean;
};

type AttachedActionChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: string;
    baseIndex?: number;
};

function buildOwnDiscardMinionOptions(state: SmashUpCore, playerId: string) {
    const player = state.players[playerId];
    if (!player) return [];
    return player.discard
        .filter(card => getCardDef(card.defId)?.type === 'minion' || card.type === 'minion')
        .map((card, index) => ({
            id: `munchkin-clerics-discard-minion-${index}-${card.uid}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'discard' as const,
            displayMode: 'card' as const,
        }));
}

function isUndeadMonster(defId: string): boolean {
    return isMunchkinUndeadMonster(defId);
}

function buildUndeadMonsterOptions(state: SmashUpCore, baseIndex: number) {
    return (state.bases[baseIndex]?.monsters ?? [])
        .filter(monster => monster.controllerId === undefined && isUndeadMonster(monster.defId))
        .map((monster, index) => ({
            id: `munchkin-clerics-undead-${index}-${monster.uid}`,
            label: getCardDef(monster.defId)?.name ?? monster.defId,
            value: { monsterUid: monster.uid, defId: monster.defId, baseIndex },
            _source: 'field' as const,
            displayMode: 'card' as const,
        }));
}

function buildDeepFriarMinionOptions(state: SmashUpCore, playerId: string, baseIndex: number, sourceMinionUid: string) {
    return (state.bases[baseIndex]?.minions ?? [])
        .filter(minion => minion.controller === playerId && minion.uid !== sourceMinionUid)
        .map((minion, index) => ({
            id: `munchkin-clerics-deep-friar-minion-${index}-${minion.uid}`,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
            value: { minionUid: minion.uid, minionDefId: minion.defId, baseIndex } satisfies MinionChoice,
            _source: 'field' as const,
            displayMode: 'card' as const,
        }));
}

function buildOtherBaseOptions(state: SmashUpCore, excludedBaseIndex: number) {
    return state.bases.flatMap((base, baseIndex) => baseIndex === excludedBaseIndex
        ? []
        : [{
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? base.defId,
        }]);
}

function isDeepFriarSourceValid(state: SmashUpCore, playerId: string, sourceBaseIndex: number, sourceMinionUid: string): boolean {
    const source = state.bases[sourceBaseIndex]?.minions.find(minion => minion.uid === sourceMinionUid);
    return source?.defId === DEEP_FRIAR && source.controller === playerId;
}

function isTurnerSourceValid(state: SmashUpCore, playerId: string, sourceBaseIndex: number, sourceMinionUid: string): boolean {
    const source = state.bases[sourceBaseIndex]?.minions.find(minion => minion.uid === sourceMinionUid);
    return source?.defId === TURNER && source.controller === playerId;
}

function shuffleDiscardCardIntoDeck(
    state: SmashUpCore,
    playerId: string,
    card: CardInstance,
    random: AbilityContext['random'],
    reason: string,
    timestamp: number,
): SmashUpEvent {
    const player = state.players[playerId];
    const deckUids = random.shuffle([...(player?.deck ?? []), card]).map(candidate => candidate.uid);
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: { playerId, deckUids, reason },
        timestamp,
    } as SmashUpEvent;
}

function cardinalTalent(ctx: AbilityContext): AbilityResult {
    const discard = ctx.state.players[ctx.playerId]?.discard ?? [];
    if (discard.length < 5) return { events: [] };
    const selected = ctx.random.shuffle([...discard]).slice(0, 2);
    return {
        events: [recoverCardsFromDiscard(ctx.playerId, selected.map(card => card.uid), CARDINAL, ctx.now)],
    };
}

function cardinalValidateUse(ctx: AbilityContext): string | null {
    return (ctx.state.players[ctx.playerId]?.discard.length ?? 0) >= 5
        ? null
        : '你的弃牌堆至少需要有五张牌';
}

function deepFriarValidateUse(ctx: AbilityContext): string | null {
    if (ctx.baseIndex === undefined) return '当前没有可计分基地';
    if (buildDeepFriarMinionOptions(ctx.state, ctx.playerId, ctx.baseIndex, ctx.cardUid).length === 0) {
        return '该基地没有可移动的另一个己方仆从';
    }
    if (buildOtherBaseOptions(ctx.state, ctx.baseIndex).length === 0) {
        return '没有可移动到的其他基地';
    }
    return null;
}

function deepFriarSpecial(ctx: AbilityContext): AbilityResult {
    if (ctx.baseIndex === undefined || !ctx.matchState) return { events: [] };
    const options = [
        createSkipOption('不移动', 'ui.munchkin_clerics_deep_friar_skip'),
        ...buildDeepFriarMinionOptions(ctx.state, ctx.playerId, ctx.baseIndex, ctx.cardUid),
    ];
    if (options.length === 1) return { events: [] };
    const interaction = createSimpleChoice<MinionChoice & { skip?: true }>(
        `${DEEP_FRIAR_MINION_SOURCE_ID}_${ctx.cardUid}_${ctx.baseIndex}_${ctx.now}`,
        ctx.playerId,
        '资深修士：选择另一个己方仆从移动，或跳过',
        options,
        {
            sourceId: DEEP_FRIAR_MINION_SOURCE_ID,
            targetType: 'minion',
            titleKey: 'ui.munchkin_clerics_deep_friar_minion_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            autoResolveIfSingle: false,
            displayCard: { defId: DEEP_FRIAR, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = latestState => [
        createSkipOption('不移动', 'ui.munchkin_clerics_deep_friar_skip'),
        ...buildDeepFriarMinionOptions(latestState.core as SmashUpCore, ctx.playerId, ctx.baseIndex!, ctx.cardUid),
    ];
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceMinionUid: ctx.cardUid,
                sourceBaseIndex: ctx.baseIndex,
            } satisfies DeepFriarInteractionData,
        }),
    };
}

function turnerModeOptions(state: SmashUpCore, baseIndex: number, playerId: string) {
    const options: Array<{
        id: string;
        label: string;
        value: TurnerModeChoice;
        displayMode: 'button';
    }> = [];
    if (buildUndeadMonsterOptions(state, baseIndex).length > 0) {
        options.push({
            id: 'destroy-undead',
            label: '摧毁这里的亡灵怪物',
            labelKey: 'ui.munchkin_clerics_turner_destroy_undead_option',
            value: { mode: 'destroyUndead' },
            displayMode: 'button',
        });
    }
    if (buildOwnDiscardMinionOptions(state, playerId).length > 0) {
        options.push({
            id: 'recover-minion',
            label: '将弃牌堆随机随从重洗进牌库',
            labelKey: 'ui.munchkin_clerics_turner_recover_minion_option',
            value: { mode: 'recoverMinion' },
            displayMode: 'button',
        });
    }
    return options;
}

function turnerOnPlay(ctx: AbilityContext): AbilityResult {
    if (ctx.baseIndex === undefined || !ctx.matchState) return { events: [] };
    const options = turnerModeOptions(ctx.state, ctx.baseIndex, ctx.playerId);
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<TurnerModeChoice>(
        `${TURNER_MODE_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '特纳：选择要发动的效果',
        options,
        {
            sourceId: TURNER_MODE_SOURCE_ID,
            targetType: 'button',
            titleKey: 'ui.munchkin_clerics_turner_mode_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            autoResolveIfSingle: false,
        },
    );
    interaction.data.optionsGenerator = latestState => turnerModeOptions(latestState.core as SmashUpCore, ctx.baseIndex!, ctx.playerId);
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceMinionUid: ctx.cardUid,
                sourceBaseIndex: ctx.baseIndex,
            } satisfies TurnerInteractionData,
        }),
    };
}

function holyRollerOnPlay(ctx: AbilityContext): AbilityResult {
    if (!ctx.matchState || (ctx.state.players[ctx.playerId]?.discard.length ?? 0) === 0) return { events: [] };
    const interaction = createSimpleChoice<HolyRollerModeChoice>(
        `${HOLY_ROLLER_MODE_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '圣临者：是否将弃牌堆随机牌重洗进牌库？',
        [
            { id: 'shuffle', label: '重洗一张', labelKey: 'ui.munchkin_clerics_holy_roller_shuffle_option', value: { shuffle: true }, displayMode: 'button' },
            createSkipOption('跳过', 'ui.munchkin_clerics_holy_roller_skip'),
        ],
        {
            sourceId: HOLY_ROLLER_MODE_SOURCE_ID,
            targetType: 'button',
            titleKey: 'ui.munchkin_clerics_holy_roller_mode_title',
            responseValidationMode: 'live',
            autoRefresh: 'discard',
            autoResolveIfSingle: false,
        },
    );
    interaction.data.optionsGenerator = latestState => (
        (latestState.core as SmashUpCore).players[ctx.playerId]?.discard.length ?? 0
    ) > 0
        ? [
            { id: 'shuffle', label: '重洗一张', labelKey: 'ui.munchkin_clerics_holy_roller_shuffle_option', value: { shuffle: true }, displayMode: 'button' },
            createSkipOption('跳过', 'ui.munchkin_clerics_holy_roller_skip'),
        ]
        : [createSkipOption('跳过', 'ui.munchkin_clerics_holy_roller_skip')];
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: { ...interaction.data, sourceCardUid: ctx.cardUid, sourcePlayerId: ctx.playerId },
        }),
    };
}

function collectionPlateOnPlay(ctx: AbilityContext): AbilityResult {
    const discard = ctx.state.players[ctx.playerId]?.discard ?? [];
    if (discard.length === 0) return { events: [] };
    const selected = ctx.random.shuffle([...discard]).slice(0, 2);
    return {
        events: [recoverCardsFromDiscard(ctx.playerId, selected.map(card => card.uid), COLLECTION_PLATE, ctx.now)],
    };
}

function goodHabitsOnPlay(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const [baseIndex, base] of ctx.state.bases.entries()) {
        for (const minion of base.minions) {
            events.push(addTempPower(minion.uid, baseIndex, 1, GOOD_HABITS, ctx.now, {
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: GOOD_HABITS,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: baseIndex,
            }));
        }
    }
    return { events };
}

function joinTheClubOnPlay(ctx: AbilityContext): AbilityResult {
    const targetBaseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const base = ctx.state.bases[targetBaseIndex];
    if (!base) return { events: [] };
    return {
        events: base.minions.map(minion => addTempPower(
            minion.uid,
            targetBaseIndex,
            1,
            JOIN_THE_CLUB,
            ctx.now,
            {
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: JOIN_THE_CLUB,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: targetBaseIndex,
            },
        )),
    };
}

function buildAttachedActionOptions(state: SmashUpCore) {
    const options: Array<{
        id: string;
        label: string;
        value: AttachedActionChoice;
        _source: 'field';
        displayMode: 'card';
    }> = [];
    for (const [baseIndex, base] of state.bases.entries()) {
        const baseName = getBaseDef(base.defId)?.name ?? base.defId;
        for (const ongoing of base.ongoingActions) {
            options.push({
                id: `munchkin-clerics-remove-curse-base-${ongoing.uid}`,
                label: `${getCardDef(ongoing.defId)?.name ?? ongoing.defId}（${baseName}）`,
                value: { cardUid: ongoing.uid, defId: ongoing.defId, ownerId: ongoing.ownerId, baseIndex },
                _source: 'field',
                displayMode: 'card',
            });
        }
        for (const minion of base.minions) {
            for (const attached of minion.attachedActions) {
                options.push({
                    id: `munchkin-clerics-remove-curse-minion-${attached.uid}`,
                    label: `${getCardDef(attached.defId)?.name ?? attached.defId}（${getCardDef(minion.defId)?.name ?? minion.defId}）`,
                    value: { cardUid: attached.uid, defId: attached.defId, ownerId: attached.ownerId, baseIndex },
                    _source: 'field',
                    displayMode: 'card',
                });
            }
        }
    }
    return options;
}

function removeCurseOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildAttachedActionOptions(ctx.state);
    if (options.length === 0 || !ctx.matchState) return { events: [] };
    const interaction = createSimpleChoice<AttachedActionChoice>(
        `${REMOVE_CURSE_ACTION_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '解除诅咒：选择要摧毁的附着行动',
        options,
        {
            sourceId: REMOVE_CURSE_ACTION_SOURCE_ID,
            targetType: 'ongoing',
            titleKey: 'ui.munchkin_clerics_remove_curse_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            autoResolveIfSingle: false,
            displayCard: { defId: REMOVE_CURSE, cardUid: ctx.cardUid },
        },
    );
    interaction.data.sourceCardUid = ctx.cardUid;
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function buildWordOfRecallCandidates(state: SmashUpCore, playerId: string, random: AbilityContext['random']) {
    return state.turnOrder
        .filter(otherPlayerId => otherPlayerId !== playerId)
        .flatMap(otherPlayerId => {
            const actions = (state.players[otherPlayerId]?.discard ?? [])
                .filter(card => getCardDef(card.defId)?.type === 'action' || card.type === 'action');
            const selected = random.shuffle([...actions])[0];
            return selected
                ? [{ cardUid: selected.uid, defId: selected.defId, ownerId: otherPlayerId }]
                : [];
        });
}

function buildWordOfRecallOptions(candidates: Array<{ cardUid: string; defId: string; ownerId: string }>) {
    return [
        ...candidates.map((candidate, index) => ({
            id: `munchkin-clerics-word-of-recall-${index}-${candidate.cardUid}`,
            label: `${getCardDef(candidate.defId)?.name ?? candidate.defId}（其他玩家弃牌堆）`,
            value: candidate,
            _source: 'discard' as const,
            displayMode: 'card' as const,
        })),
        createSkipOption('不打出', 'ui.munchkin_clerics_word_of_recall_skip'),
    ];
}

function wordOfRecallOnPlay(ctx: AbilityContext): AbilityResult {
    if (!ctx.matchState) return { events: [] };
    const candidates = buildWordOfRecallCandidates(ctx.state, ctx.playerId, ctx.random);
    if (candidates.length === 0) return { events: [] };
    const interaction = createSimpleChoice<WordOfRecallCardChoice>(
        `${WORD_OF_RECALL_ACTION_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '回忆祷词：选择一张行动作为额外行动打出，或不打出',
        buildWordOfRecallOptions(candidates),
        {
            sourceId: WORD_OF_RECALL_ACTION_SOURCE_ID,
            targetType: 'hand',
            titleKey: 'ui.munchkin_clerics_word_of_recall_title',
            responseValidationMode: 'live',
            autoRefresh: 'discard',
            autoResolveIfSingle: false,
            displayCard: { defId: WORD_OF_RECALL, cardUid: ctx.cardUid },
        },
    );
    interaction.data.sourceCardUid = ctx.cardUid;
    interaction.data.candidates = candidates;
    interaction.data.optionsGenerator = (_latestState, data) => buildWordOfRecallOptions(
        (data?.candidates as Array<{ cardUid: string; defId: string; ownerId: string }> | undefined) ?? candidates,
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function binAndGoneCanTrigger(ctx: TriggerContext): boolean {
    if (ctx.sourceBaseIndex === undefined || ctx.baseIndex === undefined || ctx.sourceBaseIndex === ctx.baseIndex) return false;
    const sourcePlayerId = ctx.sourceControllerId;
    return Boolean(sourcePlayerId && ctx.state.bases[ctx.baseIndex]?.minions.some(minion => minion.controller === sourcePlayerId));
}

function binAndGoneAfterScoring(ctx: TriggerContext): TriggerResult {
    if (!ctx.matchState || ctx.sourceBaseIndex === undefined || ctx.baseIndex === undefined || !ctx.sourceControllerId) {
        return { events: [] };
    }
    const candidates = (ctx.state.bases[ctx.baseIndex]?.minions ?? [])
        .filter(minion => minion.controller === ctx.sourceControllerId)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: ctx.baseIndex!,
            label: `${getCardDef(minion.defId)?.name ?? minion.defId}（${getBaseDef(ctx.state.bases[ctx.baseIndex!]?.defId ?? '')?.name ?? '计分基地'}）`,
        }));
    if (candidates.length === 0) return { events: [] };
    const interaction = createSimpleChoice<{ minionUid?: string; baseIndex?: number; defId?: string; skip?: boolean }>(
        `${BIN_AND_GONE_MINION_SOURCE_ID}_${ctx.sourceCardUid ?? 'source'}_${ctx.baseIndex}_${ctx.now}`,
        ctx.sourceControllerId,
        '垃圾处理：选择一个随从移动到垃圾处理所在基地，或跳过',
        [
            createSkipOption('不移动', 'ui.munchkin_clerics_bin_and_gone_skip'),
            ...buildActionMinionTargetOptions(candidates, {
                state: ctx.state,
                sourcePlayerId: ctx.sourceControllerId,
                sourceDefId: BIN_AND_GONE,
                effectType: 'move',
            }),
        ],
        {
            sourceId: BIN_AND_GONE_MINION_SOURCE_ID,
            targetType: 'minion',
            titleKey: 'ui.munchkin_clerics_bin_and_gone_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            autoResolveIfSingle: false,
            displayCard: { defId: BIN_AND_GONE, cardUid: ctx.sourceCardUid },
        },
    );
    interaction.data = {
        ...interaction.data,
        sourceCardUid: ctx.sourceCardUid,
        sourceBaseIndex: ctx.sourceBaseIndex,
        scoringBaseIndex: ctx.baseIndex,
        sourcePlayerId: ctx.sourceControllerId,
    } satisfies BinAndGoneInteractionData & Record<string, unknown>;
    interaction.data.optionsGenerator = latestState => [
        createSkipOption('不移动', 'ui.munchkin_clerics_bin_and_gone_skip'),
        ...buildActionMinionTargetOptions(
            ((latestState.core as SmashUpCore).bases[ctx.baseIndex!]?.minions ?? [])
                .filter(minion => minion.controller === ctx.sourceControllerId)
                .map(minion => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex: ctx.baseIndex!,
                    label: getCardDef(minion.defId)?.name ?? minion.defId,
                })),
            {
                state: latestState.core as SmashUpCore,
                sourcePlayerId: ctx.sourceControllerId!,
                sourceDefId: BIN_AND_GONE,
                effectType: 'move',
            },
        ),
    ];
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function buildHotelMinionOptions(state: SmashUpCore, baseIndex: number, pendingMinionUids: string[]) {
    const pending = new Set(pendingMinionUids);
    return (state.bases[baseIndex]?.minions ?? [])
        .filter(minion => pending.has(minion.uid))
        .map((minion, index) => ({
            id: `${HOTEL_OF_HOLINESS_MINION_SOURCE_ID}-${index}-${minion.uid}`,
            label: `${getCardDef(minion.defId)?.name ?? minion.defId}（${minion.owner}的牌库）`,
            value: { minionUid: minion.uid, minionDefId: minion.defId },
            _source: 'field' as const,
            displayMode: 'card' as const,
        }));
}

function queueHotelOfHolinessPrompt(
    state: MatchState<SmashUpCore>,
    playerId: string,
    baseIndex: number,
    pendingMinionUids: string[],
    timestamp: number,
) {
    const options = buildHotelMinionOptions(state.core, baseIndex, pendingMinionUids);
    if (options.length === 0) return state;
    const interaction = createSimpleChoice<{ minionUid?: string; minionDefId?: string }>(
        `${HOTEL_OF_HOLINESS_MINION_SOURCE_ID}_${baseIndex}_${timestamp}_${pendingMinionUids.length}`,
        playerId,
        '圣洁酒店：选择下一张放到牌库顶的随从',
        options,
        {
            sourceId: HOTEL_OF_HOLINESS_MINION_SOURCE_ID,
            targetType: 'minion',
            titleKey: 'ui.munchkin_clerics_hotel_of_holiness_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            autoResolveIfSingle: false,
            displayCard: { defId: BASE_HOTEL_OF_HOLINESS },
        },
    );
    interaction.data = {
        ...interaction.data,
        baseIndex,
        pendingMinionUids,
    } satisfies HotelInteractionData & Record<string, unknown>;
    interaction.data.optionsGenerator = (latestState, data) => buildHotelMinionOptions(
        latestState.core as SmashUpCore,
        baseIndex,
        (data?.pendingMinionUids as string[] | undefined) ?? pendingMinionUids,
    );
    return queueInteraction(state, interaction);
}

function hotelOfHolinessAfterScoring(ctx: BaseAbilityContext): BaseAbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base || !ctx.matchState || base.minions.length === 0) return { events: [] };
    return {
        events: [],
        matchState: queueHotelOfHolinessPrompt(
            ctx.matchState,
            ctx.playerId,
            ctx.baseIndex,
            base.minions.map(minion => minion.uid),
            ctx.now,
        ),
    };
}

export function registerMunchkinClericsAbilities(): void {
    registerAbility(CARDINAL, 'talent', { execute: cardinalTalent, validateUse: cardinalValidateUse });
    registerAbility(DEEP_FRIAR, 'special', { execute: deepFriarSpecial, validateUse: deepFriarValidateUse });
    registerAbility(TURNER, 'onPlay', turnerOnPlay);
    registerAbility(HOLY_ROLLER, 'onPlay', holyRollerOnPlay);
    registerAbility(COLLECTION_PLATE, 'onPlay', collectionPlateOnPlay);
    registerAbility(GOOD_HABITS, 'onPlay', goodHabitsOnPlay);
    registerAbility(JOIN_THE_CLUB, 'onPlay', joinTheClubOnPlay);
    registerAbility(REMOVE_CURSE, 'onPlay', removeCurseOnPlay);
    registerAbility(WORD_OF_RECALL, 'onPlay', wordOfRecallOnPlay);

    registerBaseAbility(BASE_HOTEL_OF_HOLINESS, 'afterScoring', hotelOfHolinessAfterScoring, {
        mandatory: true,
        canTrigger: ctx => (ctx.state.bases[ctx.baseIndex]?.minions.length ?? 0) > 0,
    });

    registerTrigger(BIN_AND_GONE, 'afterScoring', binAndGoneAfterScoring, {
        mandatory: true,
        perInstance: true,
        sourceScope: 'any',
        playerContext: 'sourceController',
        canTrigger: binAndGoneCanTrigger,
    });

    registerCardAbilitySuppression(CURSE_OF_IMPRISONMENT, state => state.bases.flatMap(base =>
        base.minions
            .filter(minion => minion.attachedActions.some(action => action.defId === CURSE_OF_IMPRISONMENT))
            .map(minion => minion.uid),
    ));
}

export function registerMunchkinClericsInteractionHandlers(): void {
    registerInteractionHandler(DEEP_FRIAR_MINION_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as DeepFriarInteractionData | undefined;
        if (!data?.sourceMinionUid || data.sourceBaseIndex === undefined || (value as { skip?: boolean } | undefined)?.skip) {
            return { state, events: [] };
        }
        if (!isDeepFriarSourceValid(state.core, playerId, data.sourceBaseIndex, data.sourceMinionUid)) {
            return { state, events: [] };
        }
        const choice = value as MinionChoice | undefined;
        if (!choice?.minionUid || choice.baseIndex !== data.sourceBaseIndex) return { state, events: [] };
        const target = state.core.bases[data.sourceBaseIndex]?.minions.find(minion =>
            minion.uid === choice.minionUid
            && minion.controller === playerId
            && minion.uid !== data.sourceMinionUid,
        );
        if (!target) return { state, events: [] };
        const baseOptions = buildBaseTargetOptions(buildOtherBaseOptions(state.core, data.sourceBaseIndex), state.core);
        if (baseOptions.length === 0) return { state, events: [] };
        const interaction = createSimpleChoice<BaseChoice>(
            `${DEEP_FRIAR_BASE_SOURCE_ID}_${data.sourceMinionUid}_${target.uid}_${timestamp}`,
            playerId,
            '资深修士：选择要移动到的其他基地',
            baseOptions,
            {
                sourceId: DEEP_FRIAR_BASE_SOURCE_ID,
                targetType: 'base',
                titleKey: 'ui.munchkin_clerics_deep_friar_base_title',
                responseValidationMode: 'live',
                autoRefresh: 'field',
                autoResolveIfSingle: false,
                displayCard: { defId: DEEP_FRIAR, cardUid: data.sourceMinionUid },
            },
        );
        interaction.data.optionsGenerator = latestState => buildBaseTargetOptions(
            buildOtherBaseOptions(latestState.core as SmashUpCore, data.sourceBaseIndex!),
            latestState.core as SmashUpCore,
        );
        return {
            state: queueInteraction(state, {
                ...interaction,
                data: {
                    ...interaction.data,
                    sourceMinionUid: data.sourceMinionUid,
                    sourceBaseIndex: data.sourceBaseIndex,
                    targetMinionUid: target.uid,
                    targetMinionDefId: target.defId,
                },
            }),
            events: [],
        };
    });

    registerInteractionHandler(DEEP_FRIAR_BASE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as DeepFriarInteractionData & {
            targetMinionUid?: string;
            targetMinionDefId?: string;
        } | undefined;
        const targetBaseIndex = (value as BaseChoice | undefined)?.baseIndex;
        if (!data?.sourceMinionUid || data.sourceBaseIndex === undefined || !data.targetMinionUid || !data.targetMinionDefId || targetBaseIndex === undefined) {
            return { state, events: [] };
        }
        if (targetBaseIndex === data.sourceBaseIndex || !isDeepFriarSourceValid(state.core, playerId, data.sourceBaseIndex, data.sourceMinionUid)) {
            return { state, events: [] };
        }
        const target = state.core.bases[data.sourceBaseIndex]?.minions.find(minion =>
            minion.uid === data.targetMinionUid
            && minion.defId === data.targetMinionDefId
            && minion.controller === playerId,
        );
        if (!target) return { state, events: [] };
        return {
            state,
            events: buildValidatedMoveEvents(state.core, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: data.sourceBaseIndex,
                toBaseIndex: targetBaseIndex,
                reason: DEEP_FRIAR,
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid: data.sourceMinionUid,
                sourceDefId: DEEP_FRIAR,
                sourceControllerId: playerId,
                sourceBaseIndex: data.sourceBaseIndex,
            }),
        };
    });

    registerInteractionHandler(TURNER_MODE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as TurnerInteractionData | undefined;
        const mode = (value as TurnerModeChoice | undefined)?.mode;
        if (!data?.sourceMinionUid || data.sourceBaseIndex === undefined || !mode) return { state, events: [] };
        if (!isTurnerSourceValid(state.core, playerId, data.sourceBaseIndex, data.sourceMinionUid)) return { state, events: [] };
        if (mode === 'recoverMinion') {
            const options = buildOwnDiscardMinionOptions(state.core, playerId);
            const selected = _random.shuffle(options.map(option => option.value.cardUid).map(cardUid =>
                state.core.players[playerId]?.discard.find(card => card.uid === cardUid),
            ).filter((card): card is CardInstance => Boolean(card)))[0];
            if (!selected) return { state, events: [] };
            return {
                state,
                events: [shuffleDiscardCardIntoDeck(state.core, playerId, selected, _random, TURNER, timestamp)],
            };
        }
        const monsterOptions = buildUndeadMonsterOptions(state.core, data.sourceBaseIndex);
        if (monsterOptions.length === 0) return { state, events: [] };
        const interaction = createSimpleChoice<{ monsterUid?: string; baseIndex?: number }>(
            `${TURNER_MONSTER_SOURCE_ID}_${data.sourceMinionUid}_${timestamp}`,
            playerId,
            '特纳：选择要摧毁的亡灵怪物',
            monsterOptions,
            {
                sourceId: TURNER_MONSTER_SOURCE_ID,
                targetType: 'monster',
                titleKey: 'ui.munchkin_clerics_turner_monster_title',
                responseValidationMode: 'live',
                autoRefresh: 'field',
                autoResolveIfSingle: false,
                displayCard: { defId: TURNER, cardUid: data.sourceMinionUid },
            },
        );
        interaction.data.optionsGenerator = latestState => buildUndeadMonsterOptions(latestState.core as SmashUpCore, data.sourceBaseIndex!);
        return {
            state: queueInteraction(state, {
                ...interaction,
                data: {
                    ...interaction.data,
                    sourceMinionUid: data.sourceMinionUid,
                    sourceBaseIndex: data.sourceBaseIndex,
                },
            }),
            events: [],
        };
    });

    registerInteractionHandler(TURNER_MONSTER_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as TurnerInteractionData | undefined;
        const choice = value as { monsterUid?: string; baseIndex?: number } | undefined;
        if (!data?.sourceMinionUid || data.sourceBaseIndex === undefined || !choice?.monsterUid || choice.baseIndex === undefined) {
            return { state, events: [] };
        }
        if (!isTurnerSourceValid(state.core, playerId, data.sourceBaseIndex, data.sourceMinionUid) || choice.baseIndex !== data.sourceBaseIndex) {
            return { state, events: [] };
        }
        const monster = state.core.bases[choice.baseIndex]?.monsters?.find(candidate =>
            candidate.uid === choice.monsterUid
            && candidate.controllerId === undefined
            && isUndeadMonster(candidate.defId),
        );
        if (!monster) return { state, events: [] };
        return {
            state,
            events: [{
                type: SU_EVENTS.MUNCHKIN_MONSTER_DEFEATED,
                payload: {
                    playerId,
                    baseIndex: choice.baseIndex,
                    monsterUid: monster.uid,
                    monsterDefId: monster.defId,
                    reason: TURNER,
                },
                timestamp,
            } as SmashUpEvent],
        };
    });

    registerInteractionHandler(HOLY_ROLLER_MODE_SOURCE_ID, (state, playerId, value, _interactionData, random, timestamp) => {
        const choice = value as HolyRollerModeChoice | undefined;
        if (!choice?.shuffle) return { state, events: [] };
        const discard = state.core.players[playerId]?.discard ?? [];
        const selected = random.shuffle([...discard])[0];
        if (!selected) return { state, events: [] };
        return {
            state,
            events: [shuffleDiscardCardIntoDeck(state.core, playerId, selected, random, HOLY_ROLLER, timestamp)],
        };
    });

    registerInteractionHandler(REMOVE_CURSE_ACTION_SOURCE_ID, (state, playerId, value, _interactionData, _random, timestamp) => {
        const choice = value as AttachedActionChoice | undefined;
        if (!choice?.cardUid || !choice.defId || choice.baseIndex === undefined) return { state, events: [] };
        const location = findLiveOngoingCardLocation(state.core, choice.cardUid);
        if (!location || location.defId !== choice.defId || location.baseIndex !== choice.baseIndex) {
            return { state, events: [] };
        }
        return {
            state,
            events: buildValidatedOngoingDetachEvents(state.core, {
                cardUid: location.cardUid,
                defId: location.defId,
                ownerId: location.ownerId,
                reason: REMOVE_CURSE,
                now: timestamp,
                expectedLocation: 'any',
                sourcePlayerId: playerId,
                sourceDefId: REMOVE_CURSE,
                sourceControllerId: playerId,
                sourceBaseIndex: choice.baseIndex,
            }),
        };
    });

    registerInteractionHandler(WORD_OF_RECALL_ACTION_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as WordOfRecallCardChoice | undefined;
        if (!choice || choice.skip || !choice.cardUid || !choice.defId || !choice.ownerId) return { state, events: [] };
        const sourcePlayer = state.core.players[choice.ownerId];
        const selected = sourcePlayer?.discard.find(card => card.uid === choice.cardUid && card.defId === choice.defId);
        if (!selected) return { state, events: [] };
        return {
            state,
            events: [
                {
                    type: SU_EVENTS.CARD_TRANSFERRED,
                    payload: {
                        cardUid: selected.uid,
                        defId: selected.defId,
                        fromPlayerId: choice.ownerId,
                        toPlayerId: playerId,
                        ownerId: selected.owner,
                        reason: WORD_OF_RECALL,
                    },
                    timestamp,
                } as SmashUpEvent,
                grantExtraAction(playerId, WORD_OF_RECALL, timestamp, {
                    playTiming: 'immediate',
                    restrictToCardUid: selected.uid,
                }),
            ],
        };
    });

    registerInteractionHandler(BIN_AND_GONE_MINION_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as { minionUid?: string; baseIndex?: number; defId?: string; skip?: boolean } | undefined;
        const data = interactionData as BinAndGoneInteractionData | undefined;
        if (
            !data?.sourcePlayerId
            || data.sourceBaseIndex === undefined
            || data.scoringBaseIndex === undefined
            || playerId !== data.sourcePlayerId
            || choice?.skip
        ) {
            return { state, events: [] };
        }
        if (choice.baseIndex !== data.scoringBaseIndex || !choice.minionUid || !choice.defId) {
            return { state, events: [] };
        }
        const target = state.core.bases[data.scoringBaseIndex]?.minions.find(minion =>
            minion.uid === choice.minionUid
            && minion.defId === choice.defId
            && minion.controller === playerId,
        );
        if (!target) return { state, events: [] };
        return {
            state,
            events: buildValidatedMoveEvents(state.core, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: data.scoringBaseIndex,
                toBaseIndex: data.sourceBaseIndex,
                reason: BIN_AND_GONE,
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: BIN_AND_GONE,
                sourceControllerId: playerId,
                sourceBaseIndex: data.sourceBaseIndex,
            }),
        };
    });

    registerInteractionHandler(HOTEL_OF_HOLINESS_MINION_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as { minionUid?: string; minionDefId?: string } | undefined;
        const data = interactionData as HotelInteractionData | undefined;
        if (
            data?.baseIndex === undefined
            || !data.pendingMinionUids?.length
            || !choice?.minionUid
            || !choice.minionDefId
        ) {
            return { state, events: [] };
        }
        const minion = state.core.bases[data.baseIndex]?.minions.find(candidate =>
            candidate.uid === choice.minionUid
            && candidate.defId === choice.minionDefId
        );
        if (!minion || !data.pendingMinionUids.includes(minion.uid)) return { state, events: [] };
        const remaining = data.pendingMinionUids.filter(uid => uid !== minion.uid);
        const nextState = remaining.length > 0
            ? queueHotelOfHolinessPrompt(state, playerId, data.baseIndex, remaining, timestamp)
            : state;
        return {
            state: nextState,
            events: [{
                type: SU_EVENTS.CARD_TO_DECK_TOP,
                payload: {
                    cardUid: minion.uid,
                    defId: minion.defId,
                    ownerId: minion.owner,
                    sourcePlayerId: minion.owner,
                    reason: BASE_HOTEL_OF_HOLINESS,
                    sourceDefId: BASE_HOTEL_OF_HOLINESS,
                    sourceControllerId: playerId,
                    sourceBaseIndex: data.baseIndex,
                },
                timestamp,
            } as SmashUpEvent],
        };
    });
}
