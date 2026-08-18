import type { PlayerId, MatchState, RandomFn } from '../../../engine/types';
import { createSimpleChoice, queueInteraction, type PromptOption } from '../../../engine/systems/InteractionSystem';
import { registerAbility, type AbilityContext, type AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    addTempPower,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildPlayerTargetOptions,
    buildStandardDrawEvents,
    buildValidatedControlChangeEvents,
    buildValidatedMoveEvents,
    grantExtraAction,
} from '../domain/abilityHelpers';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import { registerTrigger, type TriggerContext } from '../domain/ongoingEffects';
import { getBaseDef, getCardDef } from '../data/cards';
import { getEffectivePower } from '../domain/ongoingModifiers';
import { SU_EVENTS, type MinionOnBase, type SmashUpCore, type SmashUpEvent } from '../domain/types';

const FAE_FIGHTER = 'munchkin_elves_fae_fighter';
const LORD_OF_THE_PRANCE = 'munchkin_elves_lord_of_the_prance';
const FLOWER_CHILD = 'munchkin_elves_flower_child';
const ELF_HELP_GURU = 'munchkin_elves_elf_help_guru';
const AFTER_YOU = 'munchkin_elves_after_you';
const DANCING_ROOT = 'munchkin_elves_dancing_root';
const HELPING_HANDS = 'munchkin_elves_helping_hands';
const PUMPING_IRON = 'munchkin_elves_pumping_iron';
const RUN_AWAY = 'munchkin_elves_run_away';
const RUN_AWAY_MORE = 'munchkin_elves_run_away_more';
const TRADE = 'munchkin_elves_trade';
const TRAVELING_ELF = 'munchkin_elves_traveling_elf';
const TREEHOUSE = 'base_treehouse';

const FAE_CHOOSE_TARGET = 'munchkin_elves_fae_fighter_choose_target';
const LORD_CHOOSE_PLAYER = 'munchkin_elves_lord_of_the_prance_choose_player';
const FLOWER_CHOOSE_PLAYER = 'munchkin_elves_flower_child_choose_player';
const FLOWER_CHOOSE_MINION = 'munchkin_elves_flower_child_choose_minion';
const PUMPING_CHOOSE_PLAYER = 'munchkin_elves_pumping_iron_choose_player';
const PUMPING_CHOOSE_OTHER_MINION = 'munchkin_elves_pumping_iron_choose_other_minion';
const PUMPING_CHOOSE_SELF_MINION = 'munchkin_elves_pumping_iron_choose_self_minion';
const RUN_CHOOSE_OWN_MINION = 'munchkin_elves_run_away_choose_own_minion';
const RUN_CHOOSE_OTHER_MINION = 'munchkin_elves_run_away_choose_other_minion';
const RUN_CHOOSE_DESTINATION = 'munchkin_elves_run_away_choose_destination';
const RUN_MORE_CHOOSE_DESTINATION = 'munchkin_elves_run_away_more_choose_destination';
const RUN_MORE_CHOOSE_MINIONS = 'munchkin_elves_run_away_more_choose_minions';
const TRADE_CHOOSE_PLAYER = 'munchkin_elves_trade_choose_player';
const TRAVELING_ELF_CHOOSE_DESTINATION = 'munchkin_elves_traveling_elf_choose_destination';
const HELPING_CHOOSE_PLAYER = 'munchkin_elves_helping_hands_choose_player';
const HELPING_CHOOSE_MINION = 'munchkin_elves_helping_hands_choose_minion';
const HELPING_CHOOSE_VP = 'munchkin_elves_helping_hands_choose_vp';
const TREEHOUSE_CHOOSE_PLAYER = 'base_treehouse_choose_player';
const TREEHOUSE_CHOOSE_DRAW = 'base_treehouse_choose_draw';

type PlayerChoice = { targetPlayerId?: PlayerId; skip?: boolean };
type MinionChoice = { minionUid?: string; baseIndex?: number; minionDefId?: string; skip?: boolean };
type BaseChoice = { baseIndex?: number; skip?: boolean };
type InteractionData = Record<string, unknown>;

function nameOfCard(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function nameOfBase(defId: string, baseIndex: number): string {
    return getBaseDef(defId)?.name ?? `基地 ${baseIndex + 1}`;
}

function skipOption(label = '跳过'): PromptOption<{ skip: true }> {
    return { id: 'skip', label, value: { skip: true }, displayMode: 'button' };
}

function otherPlayerOptions(state: SmashUpCore, playerId: PlayerId) {
    return buildPlayerTargetOptions(
        Object.keys(state.players)
            .filter(candidateId => candidateId !== playerId)
            .map(candidateId => ({
                id: `player-${candidateId}`,
                label: `玩家 ${candidateId}`,
                targetPlayerId: candidateId,
            })),
        { state, sourcePlayerId: playerId },
    );
}

function minionOptions(
    state: SmashUpCore,
    candidates: MinionOnBase[],
    sourcePlayerId: PlayerId,
    sourceDefId: string,
) {
    return buildMinionTargetOptions(
        candidates.map((minion) => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: findMinionBaseIndex(state, minion.uid) ?? 0,
            label: `${nameOfCard(minion.defId)}（力量 ${getEffectivePower(state, minion, findMinionBaseIndex(state, minion.uid) ?? 0)}）`,
        })),
        { state, sourcePlayerId, sourceDefId, effectType: 'power_change' },
    );
}

function minionOptionsAtBase(
    state: SmashUpCore,
    baseIndex: number,
    sourcePlayerId: PlayerId,
    controller?: PlayerId,
    sourceDefId = RUN_AWAY,
) {
    const base = state.bases[baseIndex];
    if (!base) return [];
    const candidates = base.minions.filter(minion => controller === undefined || minion.controller === controller);
    return buildMinionTargetOptions(
        candidates.map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: `${nameOfCard(minion.defId)}（力量 ${getEffectivePower(state, minion, baseIndex)}）`,
        })),
        { state, sourcePlayerId, sourceDefId, effectType: 'move' },
    );
}

function findMinionBaseIndex(state: SmashUpCore, minionUid: string): number | undefined {
    return state.bases.findIndex(base => base.minions.some(minion => minion.uid === minionUid)) >= 0
        ? state.bases.findIndex(base => base.minions.some(minion => minion.uid === minionUid))
        : undefined;
}

function findMinion(state: SmashUpCore, baseIndex: number | undefined, minionUid: string | undefined) {
    if (!minionUid) return undefined;
    if (baseIndex !== undefined) {
        const direct = state.bases[baseIndex]?.minions.find(minion => minion.uid === minionUid);
        if (direct) return { minion: direct, baseIndex };
    }
    const actualBaseIndex = findMinionBaseIndex(state, minionUid);
    return actualBaseIndex === undefined
        ? undefined
        : { minion: state.bases[actualBaseIndex].minions.find(candidate => candidate.uid === minionUid)!, baseIndex: actualBaseIndex };
}

function queueSimpleChoice<T>(
    matchState: MatchState<SmashUpCore>,
    interaction: ReturnType<typeof createSimpleChoice<T>>,
) {
    return queueInteraction(matchState, interaction);
}

function drawSequentially(
    initialState: SmashUpCore,
    playerIds: PlayerId[],
    countFor: (playerId: PlayerId) => number,
    random: RandomFn,
    now: number,
): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    for (const playerId of playerIds) {
        const next = buildStandardDrawEvents(initialState, playerId, countFor(playerId), random, now);
        events.push(...next);
    }
    return events;
}

function faeFighterTrigger(ctx: TriggerContext): SmashUpEvent[] | { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    if (!ctx.matchState || ctx.baseIndex === undefined || !ctx.sourceControllerId || !ctx.triggerMinionUid) return [];
    if (ctx.triggerMinion?.controller === ctx.sourceControllerId) return [];
    const targets = minionOptionsAtBase(ctx.state, ctx.baseIndex, ctx.sourceControllerId, ctx.sourceControllerId, FAE_FIGHTER);
    if (targets.length === 0) return [];
    const interaction = createSimpleChoice<MinionChoice>(
        `${FAE_CHOOSE_TARGET}_${ctx.sourceCardUid ?? 'fae'}_${ctx.now}`,
        ctx.sourceControllerId,
        '精灵斗士：选择一个己方随从放置力量指示物',
        [skipOption(), ...targets],
        {
            sourceId: FAE_CHOOSE_TARGET,
            targetType: 'minion',
            titleKey: 'ui.munchkin_elves_fae_fighter_title',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
            autoRefresh: 'field',
            displayCard: { defId: FAE_FIGHTER, cardUid: ctx.sourceCardUid },
        },
    );
    return {
        events: [],
        matchState: queueSimpleChoice(ctx.matchState, {
            ...interaction,
            data: { ...interaction.data, playedMinionUid: ctx.triggerMinionUid, baseIndex: ctx.baseIndex },
        }),
    };
}

function lordTalent(ctx: AbilityContext): AbilityResult {
    const options = otherPlayerOptions(ctx.state, ctx.playerId);
    if (!ctx.matchState || options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<PlayerChoice>(
        `${LORD_CHOOSE_PLAYER}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '优雅贵族：选择另一位玩家抽一张牌',
        options,
        {
            sourceId: LORD_CHOOSE_PLAYER,
            targetType: 'player',
            titleKey: 'ui.munchkin_elves_lord_of_the_prance_title',
            autoResolveIfSingle: false,
        },
    );
    return { events: [], matchState: queueSimpleChoice(ctx.matchState, interaction) };
}

function flowerChildOnPlay(ctx: AbilityContext): AbilityResult {
    const options = otherPlayerOptions(ctx.state, ctx.playerId);
    if (!ctx.matchState || options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<PlayerChoice>(
        `${FLOWER_CHOOSE_PLAYER}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '花之子：选择另一位玩家交换控制权',
        [skipOption(), ...options],
        {
            sourceId: FLOWER_CHOOSE_PLAYER,
            targetType: 'player',
            titleKey: 'ui.munchkin_elves_flower_child_player_title',
            autoResolveIfSingle: false,
        },
    );
    return {
        events: [],
        matchState: queueSimpleChoice(ctx.matchState, {
            ...interaction,
            data: { ...interaction.data, sourceCardUid: ctx.cardUid, sourceBaseIndex: ctx.baseIndex },
        }),
    };
}

function elfHelpGuruTalent(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    return {
        events: base.minions
            .filter(minion => minion.controller !== ctx.playerId)
            .map(minion => addTempPower(minion.uid, ctx.baseIndex, 1, ELF_HELP_GURU, ctx.now, {
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ELF_HELP_GURU,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            })),
    };
}

function afterYouOnPlay(ctx: AbilityContext): AbilityResult {
    const playerIds = Object.keys(ctx.state.players);
    return {
        events: drawSequentially(
            ctx.state,
            playerIds,
            playerId => playerId === ctx.playerId ? playerIds.length : 1,
            ctx.random,
            ctx.now,
        ),
    };
}

function dancingRootOnPlay(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    let drawState = ctx.state;
    for (const player of Object.values(ctx.state.players)) {
        if (player.discard.length === 0) continue;
        const deckUids = ctx.random.shuffle([...player.deck, ...player.discard]).map(card => card.uid);
        const event = { type: SU_EVENTS.DECK_RESHUFFLED, payload: { playerId: player.id, deckUids }, timestamp: ctx.now } as SmashUpEvent;
        events.push(event);
        if (player.id === ctx.playerId) {
            const cardsByUid = new Map([...player.deck, ...player.discard].map(card => [card.uid, card]));
            drawState = {
                ...drawState,
                players: {
                    ...drawState.players,
                    [player.id]: {
                        ...player,
                        deck: deckUids
                            .map(uid => cardsByUid.get(uid))
                            .filter((card): card is NonNullable<typeof card> => !!card),
                        discard: [],
                    },
                },
            };
        }
    }
    const draw = buildStandardDrawEvents(drawState, ctx.playerId, 1, ctx.random, ctx.now);
    return { events: [...events, ...draw] };
}

function pumpingIronOnPlay(ctx: AbilityContext): AbilityResult {
    if (!ctx.matchState) return { events: [] };
    const options = otherPlayerOptions(ctx.state, ctx.playerId);
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<PlayerChoice>(
        `${PUMPING_CHOOSE_PLAYER}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '力量训练：选择另一位玩家',
        options,
        { sourceId: PUMPING_CHOOSE_PLAYER, targetType: 'player', titleKey: 'ui.munchkin_elves_pumping_iron_player_title', autoResolveIfSingle: false },
    );
    return { events: [], matchState: queueSimpleChoice(ctx.matchState, { ...interaction, data: { ...interaction.data, sourceCardUid: ctx.cardUid, sourcePlayerId: ctx.playerId } }) };
}

function runAwayOnPlay(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    if (!ctx.matchState || baseIndex === undefined) return { events: [] };
    const own = minionOptionsAtBase(ctx.state, baseIndex, ctx.playerId, ctx.playerId, RUN_AWAY);
    if (own.length === 0) return { events: [] };
    const interaction = createSimpleChoice<MinionChoice>(
        `${RUN_CHOOSE_OWN_MINION}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '逃跑吧：选择一个己方随从',
        own,
        { sourceId: RUN_CHOOSE_OWN_MINION, targetType: 'minion', titleKey: 'ui.munchkin_elves_run_away_own_title', autoResolveIfSingle: false, responseValidationMode: 'live', autoRefresh: 'field', displayCard: { defId: RUN_AWAY, cardUid: ctx.cardUid } },
    );
    return { events: [], matchState: queueSimpleChoice(ctx.matchState, { ...interaction, data: { ...interaction.data, sourceCardUid: ctx.cardUid, sourceBaseIndex: baseIndex } }) };
}

function runAwayMoreOnPlay(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    if (!ctx.matchState || baseIndex === undefined || !ctx.state.bases[baseIndex]) return { events: [] };
    const destinations = ctx.state.bases.map((base, index) => ({ baseIndex: index, label: nameOfBase(base.defId, index) })).filter(candidate => candidate.baseIndex !== baseIndex);
    if (destinations.length === 0 || !ctx.state.bases[baseIndex].minions.some(minion => minion.controller === ctx.playerId)) return { events: [] };
    const interaction = createSimpleChoice<BaseChoice>(
        `${RUN_MORE_CHOOSE_DESTINATION}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '赶紧逃跑吧：选择另一个基地',
        buildBaseTargetOptions(destinations, ctx.state),
        { sourceId: RUN_MORE_CHOOSE_DESTINATION, targetType: 'base', titleKey: 'ui.munchkin_elves_run_away_more_destination_title', autoResolveIfSingle: false, displayCard: { defId: RUN_AWAY_MORE, cardUid: ctx.cardUid } },
    );
    return { events: [], matchState: queueSimpleChoice(ctx.matchState, { ...interaction, data: { ...interaction.data, sourceCardUid: ctx.cardUid, sourceBaseIndex: baseIndex } }) };
}

function tradeOnPlay(ctx: AbilityContext): AbilityResult {
    if (!ctx.matchState || !ctx.state.players[ctx.playerId]?.hand.length) return { events: [] };
    const options = otherPlayerOptions(ctx.state, ctx.playerId).filter(option => (ctx.state.players[option.value.targetPlayerId]?.hand.length ?? 0) > 0);
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<PlayerChoice>(
        `${TRADE_CHOOSE_PLAYER}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '贸易：选择一位有手牌的玩家交换一张手牌',
        options,
        { sourceId: TRADE_CHOOSE_PLAYER, targetType: 'player', titleKey: 'ui.munchkin_elves_trade_title', autoResolveIfSingle: false },
    );
    return { events: [], matchState: queueSimpleChoice(ctx.matchState, { ...interaction, data: { ...interaction.data, sourceCardUid: ctx.cardUid } }) };
}

function travelingElfTalent(ctx: AbilityContext): AbilityResult {
    const host = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.attachedActions.some(action => action.uid === ctx.cardUid));
    const destinations = ctx.state.bases.map((base, index) => ({ baseIndex: index, label: nameOfBase(base.defId, index) })).filter(candidate => candidate.baseIndex !== ctx.baseIndex);
    if (!ctx.matchState || !host || host.controller !== ctx.playerId || destinations.length === 0) return { events: [] };
    const interaction = createSimpleChoice<BaseChoice>(
        `${TRAVELING_ELF_CHOOSE_DESTINATION}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '旅行精灵：选择目标基地',
        buildBaseTargetOptions(destinations, ctx.state),
        { sourceId: TRAVELING_ELF_CHOOSE_DESTINATION, targetType: 'base', titleKey: 'ui.munchkin_elves_traveling_elf_title', autoResolveIfSingle: false, displayCard: { defId: TRAVELING_ELF, cardUid: ctx.cardUid } },
    );
    return { events: [], matchState: queueSimpleChoice(ctx.matchState, { ...interaction, data: { ...interaction.data, hostUid: host.uid, hostDefId: host.defId, sourceBaseIndex: ctx.baseIndex, sourceCardUid: ctx.cardUid } }) };
}

function helpingHandsSpecial(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    if (!ctx.matchState || baseIndex === undefined) return { events: [] };
    const own = ctx.state.bases[baseIndex]?.minions.filter(minion => minion.controller === ctx.playerId) ?? [];
    const players = otherPlayerOptions(ctx.state, ctx.playerId);
    if (own.length === 0 || players.length === 0) return { events: [] };
    const interaction = createSimpleChoice<PlayerChoice>(
        `${HELPING_CHOOSE_PLAYER}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '援手：选择另一位玩家',
        players,
        { sourceId: HELPING_CHOOSE_PLAYER, targetType: 'player', titleKey: 'ui.munchkin_elves_helping_hands_player_title', autoResolveIfSingle: false, displayCard: { defId: HELPING_HANDS, cardUid: ctx.cardUid } },
    );
    return { events: [], matchState: queueSimpleChoice(ctx.matchState, { ...interaction, data: { ...interaction.data, sourceCardUid: ctx.cardUid, sourceBaseIndex: baseIndex } }) };
}

function buildFlowerSwapEvents(state: SmashUpCore, playerId: PlayerId, source: MinionOnBase, target: MinionOnBase, baseIndex: number, sourceCardUid: string, now: number) {
    const events: SmashUpEvent[] = [
        ...buildValidatedControlChangeEvents(state, { minionUid: source.uid, minionDefId: source.defId, baseIndex, toControllerId: target.controller, sourcePlayerId: playerId, sourceCardUid, sourceDefId: FLOWER_CHILD, sourceControllerId: playerId, sourceBaseIndex: baseIndex, sourceKind: 'nonAction', reason: FLOWER_CHILD, now }),
        ...buildValidatedControlChangeEvents(state, { minionUid: target.uid, minionDefId: target.defId, baseIndex, toControllerId: playerId, sourcePlayerId: playerId, sourceCardUid, sourceDefId: FLOWER_CHILD, sourceControllerId: playerId, sourceBaseIndex: baseIndex, sourceKind: 'nonAction', reason: FLOWER_CHILD, now }),
        { type: SU_EVENTS.MINION_METADATA_UPDATED, payload: { minionUid: source.uid, baseIndex, metadataUpdate: { flowerChildPartnerUid: target.uid, flowerChildOriginalController: source.controller }, reason: FLOWER_CHILD }, timestamp: now } as SmashUpEvent,
        { type: SU_EVENTS.MINION_METADATA_UPDATED, payload: { minionUid: target.uid, baseIndex, metadataUpdate: { flowerChildPartnerUid: source.uid, flowerChildOriginalController: target.controller }, reason: FLOWER_CHILD }, timestamp: now } as SmashUpEvent,
    ];
    return events;
}

function flowerChildLeaveTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const left = ctx.triggerMinion;
    const partnerUid = left?.metadata?.flowerChildPartnerUid;
    const originalController = left?.metadata?.flowerChildOriginalController;
    if (typeof partnerUid !== 'string' || typeof originalController !== 'string') return [];
    const partnerLocation = findMinion(ctx.state, undefined, partnerUid);
    if (!partnerLocation || partnerLocation.minion.controller === originalController) return [];
    return buildValidatedControlChangeEvents(ctx.state, {
        minionUid: partnerLocation.minion.uid,
        minionDefId: partnerLocation.minion.defId,
        baseIndex: partnerLocation.baseIndex,
        toControllerId: originalController,
        sourcePlayerId: ctx.sourceControllerId ?? ctx.playerId,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId: FLOWER_CHILD,
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: partnerLocation.baseIndex,
        sourceKind: 'nonAction',
        reason: `${FLOWER_CHILD}_leave`,
        now: ctx.now,
    });
}

function queueTargetChoice(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    id: string,
    title: string,
    titleKey: string,
    sourceId: string,
    options: PromptOption<MinionChoice>[],
    data: InteractionData,
    displayCard?: { defId: string; cardUid?: string },
) {
    const interaction = createSimpleChoice<MinionChoice>(id, playerId, title, options, {
        sourceId,
        targetType: 'minion',
        titleKey,
        autoResolveIfSingle: false,
        responseValidationMode: 'live',
        autoRefresh: 'field',
        displayCard,
    });
    return queueSimpleChoice(state, { ...interaction, data: { ...interaction.data, ...data } });
}

export function registerMunchkinElvesAbilities(): void {
    registerAbility(LORD_OF_THE_PRANCE, 'talent', lordTalent);
    registerAbility(FLOWER_CHILD, 'onPlay', flowerChildOnPlay);
    registerAbility(ELF_HELP_GURU, 'talent', elfHelpGuruTalent);
    registerAbility(AFTER_YOU, 'onPlay', afterYouOnPlay);
    registerAbility(DANCING_ROOT, 'onPlay', dancingRootOnPlay);
    registerAbility(HELPING_HANDS, 'special', helpingHandsSpecial);
    registerAbility(PUMPING_IRON, 'onPlay', pumpingIronOnPlay);
    registerAbility(RUN_AWAY, 'special', runAwayOnPlay);
    registerAbility(RUN_AWAY_MORE, 'special', runAwayMoreOnPlay);
    registerAbility(TRADE, 'onPlay', tradeOnPlay);
    registerAbility(TRAVELING_ELF, 'talent', travelingElfTalent);

    registerTrigger(FAE_FIGHTER, 'onMinionPlayed', faeFighterTrigger, { optional: true, perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });
    registerTrigger(FLOWER_CHILD, 'onMinionDestroyed', flowerChildLeaveTrigger, { perInstance: true, playerContext: 'sourceController' });
    registerTrigger(FLOWER_CHILD, 'onMinionDiscardedFromBase', flowerChildLeaveTrigger, { perInstance: true, playerContext: 'sourceController' });
    registerTrigger(HELPING_HANDS, 'afterScoring', helpingHandsAfterScoring, { playerContext: 'sourceController' });
}

function helpingHandsAfterScoring(ctx: TriggerContext): SmashUpEvent[] | { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    if (ctx.baseIndex === undefined || !ctx.rankings || !ctx.matchState) return [];
    const armed = (ctx.state.pendingAfterScoringSpecials ?? []).filter(entry => entry.sourceDefId === HELPING_HANDS && entry.baseIndex === ctx.baseIndex);
    const entry = armed[0];
    const targetPlayerId = entry?.metadata?.targetPlayerId;
    if (!entry || typeof targetPlayerId !== 'string') return [];
    const events: SmashUpEvent[] = [{ type: SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED, payload: { sourceDefId: entry.sourceDefId, playerId: entry.playerId, baseIndex: entry.baseIndex, cardUid: entry.cardUid }, timestamp: ctx.now } as SmashUpEvent];
    if (ctx.rankings[0]?.playerId !== targetPlayerId || (ctx.state.players[targetPlayerId]?.vp ?? 0) <= 0) return events;
    const interaction = createSimpleChoice<{ take?: boolean }>(
        `${HELPING_CHOOSE_VP}_${entry.cardUid}_${ctx.now}`,
        entry.playerId,
        '援手：是否从获胜玩家处获得 1 VP？',
        [
            { id: 'take', label: '获得 1 VP', labelKey: 'ui.munchkin_elves_helping_hands_vp_take_option', value: { take: true }, displayMode: 'button' },
            skipOption('不获得'),
        ],
        { sourceId: HELPING_CHOOSE_VP, targetType: 'button', buttonIntent: 'mode', titleKey: 'ui.munchkin_elves_helping_hands_vp_title', autoResolveIfSingle: false, displayCard: { defId: HELPING_HANDS, cardUid: entry.cardUid } },
    );
    return { events, matchState: queueSimpleChoice(ctx.matchState, { ...interaction, data: { ...interaction.data, targetPlayerId } }) };
}

export function registerMunchkinElvesInteractionHandlers(): void {
    registerInteractionHandler(FAE_CHOOSE_TARGET, (state, playerId, value, data, _random, timestamp) => {
        const choice = value as MinionChoice;
        if (choice.skip || !choice.minionUid || typeof data?.baseIndex !== 'number' || typeof data?.playedMinionUid !== 'string') return { state, events: [] };
        const own = findMinion(state.core, choice.baseIndex, choice.minionUid)?.minion;
        const played = findMinion(state.core, data.baseIndex as number, data.playedMinionUid)?.minion;
        if (!own || !played || own.controller !== playerId || played.controller === playerId) return { state, events: [] };
        return { state, events: [addPowerCounter(played.uid, data.baseIndex as number, 1, FAE_FIGHTER, timestamp), addPowerCounter(own.uid, choice.baseIndex!, 1, FAE_FIGHTER, timestamp)] };
    });

    registerInteractionHandler(LORD_CHOOSE_PLAYER, (state, playerId, value, _data, random, timestamp) => {
        const targetPlayerId = (value as PlayerChoice)?.targetPlayerId;
        if (!targetPlayerId || targetPlayerId === playerId || !state.core.players[targetPlayerId]) return { state, events: [] };
        return { state, events: drawSequentially(state.core, [targetPlayerId, playerId], () => 1, random, timestamp) };
    });

    registerInteractionHandler(FLOWER_CHOOSE_PLAYER, (state, playerId, value, data, _random, timestamp) => {
        const choice = value as PlayerChoice;
        const sourceBaseIndex = typeof data?.sourceBaseIndex === 'number' ? data.sourceBaseIndex : undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        if (choice.skip || !choice.targetPlayerId || sourceBaseIndex === undefined || !sourceCardUid) return { state, events: [] };
        const options = minionOptionsAtBase(state.core, sourceBaseIndex, playerId, choice.targetPlayerId, FLOWER_CHILD)
            .filter(option => getEffectivePower(state.core, state.core.bases[sourceBaseIndex].minions.find(minion => minion.uid === option.value.minionUid)!, sourceBaseIndex) <= 3);
        if (options.length === 0) return { state, events: [] };
        return { state: queueTargetChoice(state, playerId, `${FLOWER_CHOOSE_MINION}_${sourceCardUid}_${timestamp}`, '花之子：选择对方力量 3 或更少的随从', 'ui.munchkin_elves_flower_child_minion_title', FLOWER_CHOOSE_MINION, options, { sourcePlayerId: playerId, targetPlayerId: choice.targetPlayerId, sourceCardUid, sourceBaseIndex }, { defId: FLOWER_CHILD, cardUid: sourceCardUid }), events: [] };
    });

    registerInteractionHandler(FLOWER_CHOOSE_MINION, (state, playerId, value, data, _random, timestamp) => {
        const choice = value as MinionChoice;
        const sourceBaseIndex = typeof data?.sourceBaseIndex === 'number' ? data.sourceBaseIndex : undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const targetPlayerId = typeof data?.targetPlayerId === 'string' ? data.targetPlayerId : undefined;
        if (!choice.minionUid || sourceBaseIndex === undefined || !sourceCardUid || !targetPlayerId) return { state, events: [] };
        const source = findMinion(state.core, sourceBaseIndex, sourceCardUid)?.minion;
        const target = findMinion(state.core, sourceBaseIndex, choice.minionUid)?.minion;
        if (!source || !target || source.controller !== playerId || target.controller !== targetPlayerId || getEffectivePower(state.core, target, sourceBaseIndex) > 3) return { state, events: [] };
        return { state, events: buildFlowerSwapEvents(state.core, playerId, source, target, sourceBaseIndex, sourceCardUid, timestamp) };
    });

    registerInteractionHandler(PUMPING_CHOOSE_PLAYER, (state, playerId, value, data, _random, timestamp) => {
        const targetPlayerId = (value as PlayerChoice)?.targetPlayerId;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        if (!targetPlayerId || !sourcePlayerId) return { state, events: [] };
        const options = minionOptions(state.core, Object.values(state.core.bases).flatMap(base => base.minions).filter(minion => minion.controller === targetPlayerId), targetPlayerId, PUMPING_IRON);
        if (options.length === 0) return { state, events: [] };
        return { state: queueTargetChoice(state, targetPlayerId, `${PUMPING_CHOOSE_OTHER_MINION}_${timestamp}`, '力量训练：选择一个己方随从获得 +2', 'ui.munchkin_elves_pumping_iron_other_minion_title', PUMPING_CHOOSE_OTHER_MINION, options, { sourcePlayerId, targetPlayerId, sourceCardUid: data?.sourceCardUid }, { defId: PUMPING_IRON, cardUid: data?.sourceCardUid as string | undefined }), events: [] };
    });

    registerInteractionHandler(PUMPING_CHOOSE_OTHER_MINION, (state, playerId, value, data, _random, timestamp) => {
        const choice = value as MinionChoice;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        if (!choice.minionUid || !sourcePlayerId || choice.baseIndex === undefined) return { state, events: [] };
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const own = findMinion(state.core, choice.baseIndex, choice.minionUid)?.minion;
        const options = minionOptions(state.core, Object.values(state.core.bases).flatMap(base => base.minions).filter(minion => minion.controller === sourcePlayerId), sourcePlayerId, PUMPING_IRON);
        if (!own || own.controller !== playerId || options.length === 0) return { state, events: [] };
        return { state: queueTargetChoice(state, sourcePlayerId, `${PUMPING_CHOOSE_SELF_MINION}_${timestamp}`, '力量训练：选择一个己方随从获得 +3', 'ui.munchkin_elves_pumping_iron_self_minion_title', PUMPING_CHOOSE_SELF_MINION, options, { sourcePlayerId, otherMinionUid: own.uid, otherBaseIndex: choice.baseIndex, sourceCardUid }, { defId: PUMPING_IRON, cardUid: sourceCardUid }), events: [] };
    });

    registerInteractionHandler(PUMPING_CHOOSE_SELF_MINION, (state, playerId, value, data, _random, timestamp) => {
        const choice = value as MinionChoice;
        const otherMinionUid = typeof data?.otherMinionUid === 'string' ? data.otherMinionUid : undefined;
        const otherBaseIndex = typeof data?.otherBaseIndex === 'number' ? data.otherBaseIndex : undefined;
        if (!choice.minionUid || choice.baseIndex === undefined || !otherMinionUid || otherBaseIndex === undefined) return { state, events: [] };
        const own = findMinion(state.core, choice.baseIndex, choice.minionUid)?.minion;
        const other = findMinion(state.core, otherBaseIndex, otherMinionUid)?.minion;
        if (!own || !other || own.controller !== playerId) return { state, events: [] };
        return { state, events: [addTempPower(other.uid, otherBaseIndex, 2, PUMPING_IRON, timestamp), addTempPower(own.uid, choice.baseIndex, 3, PUMPING_IRON, timestamp)] };
    });

    registerInteractionHandler(RUN_CHOOSE_OWN_MINION, (state, playerId, value, data, _random, timestamp) => {
        const choice = value as MinionChoice;
        const sourceBaseIndex = typeof data?.sourceBaseIndex === 'number' ? data.sourceBaseIndex : undefined;
        if (!choice.minionUid || sourceBaseIndex === undefined) return { state, events: [] };
        const options = minionOptionsAtBase(state.core, sourceBaseIndex, playerId, undefined, RUN_AWAY)
            .filter(option => option.value.minionUid !== choice.minionUid)
            .filter(option => state.core.bases[sourceBaseIndex].minions.find(minion => minion.uid === option.value.minionUid)?.controller !== playerId);
        const sourceCardUid = data?.sourceCardUid as string | undefined;
        if (options.length === 0 || !sourceCardUid) return { state, events: [] };
        return { state: queueTargetChoice(state, playerId, `${RUN_CHOOSE_OTHER_MINION}_${timestamp}`, '逃跑吧：选择另一位玩家的随从', 'ui.munchkin_elves_run_away_other_minion_title', RUN_CHOOSE_OTHER_MINION, options.filter(option => state.core.bases[sourceBaseIndex].minions.find(minion => minion.uid === option.value.minionUid)?.controller !== playerId), { sourceBaseIndex, sourceCardUid, ownMinionUid: choice.minionUid }, { defId: RUN_AWAY, cardUid: sourceCardUid }), events: [] };
    });

    registerInteractionHandler(RUN_CHOOSE_OTHER_MINION, (state, playerId, value, data, _random, timestamp) => {
        const choice = value as MinionChoice;
        const sourceBaseIndex = typeof data?.sourceBaseIndex === 'number' ? data.sourceBaseIndex : undefined;
        const ownMinionUid = typeof data?.ownMinionUid === 'string' ? data.ownMinionUid : undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        if (!choice.minionUid || choice.baseIndex === undefined || !ownMinionUid || sourceBaseIndex === undefined || !sourceCardUid) return { state, events: [] };
        const destinations = state.core.bases.map((base, index) => ({ baseIndex: index, label: nameOfBase(base.defId, index) })).filter(candidate => candidate.baseIndex !== sourceBaseIndex);
        const interaction = createSimpleChoice<BaseChoice>(`${RUN_CHOOSE_DESTINATION}_${timestamp}`, playerId, '逃跑吧：选择目标基地', buildBaseTargetOptions(destinations, state.core), { sourceId: RUN_CHOOSE_DESTINATION, targetType: 'base', titleKey: 'ui.munchkin_elves_run_away_destination_title', autoResolveIfSingle: false, displayCard: { defId: RUN_AWAY, cardUid: sourceCardUid } });
        return { state: queueSimpleChoice(state, { ...interaction, data: { ...interaction.data, sourceBaseIndex, sourceCardUid, ownMinionUid, otherMinionUid: choice.minionUid, otherMinionDefId: choice.minionDefId } }), events: [] };
    });

    registerInteractionHandler(RUN_CHOOSE_DESTINATION, (state, playerId, value, data, _random, timestamp) => {
        const choice = value as BaseChoice;
        const sourceBaseIndex = typeof data?.sourceBaseIndex === 'number' ? data.sourceBaseIndex : undefined;
        const ownMinionUid = data?.ownMinionUid as string | undefined;
        const otherMinionUid = data?.otherMinionUid as string | undefined;
        if (choice.baseIndex === undefined || sourceBaseIndex === undefined || !ownMinionUid || !otherMinionUid) return { state, events: [] };
        const own = findMinion(state.core, sourceBaseIndex, ownMinionUid)?.minion;
        const other = findMinion(state.core, sourceBaseIndex, otherMinionUid)?.minion;
        if (!own || !other || own.controller !== playerId || other.controller === playerId) return { state, events: [] };
        return { state, events: [
            ...buildValidatedMoveEvents(state.core, { minionUid: own.uid, minionDefId: own.defId, fromBaseIndex: sourceBaseIndex, toBaseIndex: choice.baseIndex, reason: RUN_AWAY, now: timestamp, sourcePlayerId: playerId, sourceDefId: RUN_AWAY, sourceControllerId: playerId, sourceBaseIndex }),
            ...buildValidatedMoveEvents(state.core, { minionUid: other.uid, minionDefId: other.defId, fromBaseIndex: sourceBaseIndex, toBaseIndex: choice.baseIndex, reason: RUN_AWAY, now: timestamp, sourcePlayerId: playerId, sourceDefId: RUN_AWAY, sourceControllerId: playerId, sourceBaseIndex }),
        ] };
    });

    registerInteractionHandler(RUN_MORE_CHOOSE_DESTINATION, (state, playerId, value, data, _random, timestamp) => {
        const choice = value as BaseChoice;
        const sourceBaseIndex = typeof data?.sourceBaseIndex === 'number' ? data.sourceBaseIndex : undefined;
        const sourceCardUid = data?.sourceCardUid as string | undefined;
        if (choice.baseIndex === undefined || sourceBaseIndex === undefined || !sourceCardUid) return { state, events: [] };
        const options = minionOptionsAtBase(state.core, sourceBaseIndex, playerId, playerId, RUN_AWAY_MORE);
        if (options.length === 0) return { state, events: [] };
        const interaction = createSimpleChoice<MinionChoice[]>(`${RUN_MORE_CHOOSE_MINIONS}_${timestamp}`, playerId, '赶紧逃跑吧：选择任意数量己方随从', options, { sourceId: RUN_MORE_CHOOSE_MINIONS, targetType: 'minion', titleKey: 'ui.munchkin_elves_run_away_more_minions_title', autoResolveIfSingle: false, multi: { min: 0, max: options.length }, responseValidationMode: 'live', autoRefresh: 'field', displayCard: { defId: RUN_AWAY_MORE, cardUid: sourceCardUid } });
        return { state: queueSimpleChoice(state, { ...interaction, data: { ...interaction.data, sourceBaseIndex, targetBaseIndex: choice.baseIndex, sourceCardUid } }), events: [] };
    });

    registerInteractionHandler(RUN_MORE_CHOOSE_MINIONS, (state, playerId, value, data, _random, timestamp) => {
        const sourceBaseIndex = typeof data?.sourceBaseIndex === 'number' ? data.sourceBaseIndex : undefined;
        const targetBaseIndex = typeof data?.targetBaseIndex === 'number' ? data.targetBaseIndex : undefined;
        if (sourceBaseIndex === undefined || targetBaseIndex === undefined) return { state, events: [] };
        const choices = (Array.isArray(value) ? value : [value]) as MinionChoice[];
        const events: SmashUpEvent[] = [];
        for (const choice of choices) {
            if (!choice?.minionUid) continue;
            const target = findMinion(state.core, sourceBaseIndex, choice.minionUid)?.minion;
            if (!target || target.controller !== playerId) continue;
            events.push(...buildValidatedMoveEvents(state.core, { minionUid: target.uid, minionDefId: target.defId, fromBaseIndex: sourceBaseIndex, toBaseIndex: targetBaseIndex, reason: RUN_AWAY_MORE, now: timestamp, sourcePlayerId: playerId, sourceDefId: RUN_AWAY_MORE, sourceControllerId: playerId, sourceBaseIndex }));
        }
        return { state, events };
    });

    registerInteractionHandler(TRADE_CHOOSE_PLAYER, (state, playerId, value, data, random, timestamp) => {
        const targetPlayerId = (value as PlayerChoice)?.targetPlayerId;
        const source = state.core.players[playerId];
        const target = targetPlayerId ? state.core.players[targetPlayerId] : undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourceCard = sourceCardUid
            ? [...source?.hand ?? [], ...source?.discard ?? [], ...source?.deck ?? []].find(card => card.uid === sourceCardUid)
            : undefined;
        if (!targetPlayerId || !source || !target || targetPlayerId === playerId || !sourceCard || sourceCard.defId !== TRADE || target.hand.length === 0) return { state, events: [] };
        const targetCard = random.shuffle([...target.hand])[0];
        if (!targetCard) return { state, events: [] };
        return { state, events: [
            { type: SU_EVENTS.CARD_TRANSFERRED, payload: { cardUid: targetCard.uid, defId: targetCard.defId, fromPlayerId: targetPlayerId, toPlayerId: playerId, ownerId: targetCard.owner, reason: TRADE }, timestamp },
            { type: SU_EVENTS.CARD_TRANSFERRED, payload: { cardUid: sourceCard.uid, defId: sourceCard.defId, fromPlayerId: playerId, toPlayerId: targetPlayerId, ownerId: sourceCard.owner, reason: TRADE }, timestamp },
            grantExtraAction(playerId, TRADE, timestamp),
        ] as SmashUpEvent[] };
    });

    registerInteractionHandler(TRAVELING_ELF_CHOOSE_DESTINATION, (state, playerId, value, data, _random, timestamp) => {
        const choice = value as BaseChoice;
        const sourceBaseIndex = typeof data?.sourceBaseIndex === 'number' ? data.sourceBaseIndex : undefined;
        const hostUid = data?.hostUid as string | undefined;
        const hostDefId = data?.hostDefId as string | undefined;
        if (choice.baseIndex === undefined || sourceBaseIndex === undefined || !hostUid || !hostDefId) return { state, events: [] };
        const host = findMinion(state.core, sourceBaseIndex, hostUid)?.minion;
        if (!host || host.controller !== playerId) return { state, events: [] };
        return { state, events: buildValidatedMoveEvents(state.core, { minionUid: host.uid, minionDefId: hostDefId, fromBaseIndex: sourceBaseIndex, toBaseIndex: choice.baseIndex, reason: TRAVELING_ELF, now: timestamp, sourcePlayerId: playerId, sourceDefId: TRAVELING_ELF, sourceControllerId: playerId, sourceBaseIndex }) };
    });

    registerInteractionHandler(HELPING_CHOOSE_PLAYER, (state, playerId, value, data, _random, timestamp) => {
        const targetPlayerId = (value as PlayerChoice)?.targetPlayerId;
        const sourceBaseIndex = typeof data?.sourceBaseIndex === 'number' ? data.sourceBaseIndex : undefined;
        const sourceCardUid = data?.sourceCardUid as string | undefined;
        if (!targetPlayerId || sourceBaseIndex === undefined || !sourceCardUid) return { state, events: [] };
        const options = minionOptionsAtBase(state.core, sourceBaseIndex, playerId, playerId, HELPING_HANDS);
        if (options.length === 0) return { state, events: [] };
        return { state: queueTargetChoice(state, playerId, `${HELPING_CHOOSE_MINION}_${timestamp}`, '援手：选择一个己方随从获得 -2（最低为 0）', 'ui.munchkin_elves_helping_hands_minion_title', HELPING_CHOOSE_MINION, options, { targetPlayerId, sourceBaseIndex, sourceCardUid }, { defId: HELPING_HANDS, cardUid: sourceCardUid }), events: [] };
    });

    registerInteractionHandler(HELPING_CHOOSE_MINION, (state, playerId, value, data, _random, timestamp) => {
        const choice = value as MinionChoice;
        const sourceBaseIndex = typeof data?.sourceBaseIndex === 'number' ? data.sourceBaseIndex : undefined;
        const targetPlayerId = data?.targetPlayerId as PlayerId | undefined;
        const sourceCardUid = data?.sourceCardUid as string | undefined;
        if (!choice.minionUid || choice.baseIndex === undefined || sourceBaseIndex === undefined || !targetPlayerId || !sourceCardUid) return { state, events: [] };
        const own = findMinion(state.core, choice.baseIndex, choice.minionUid)?.minion;
        if (!own || own.controller !== playerId) return { state, events: [] };
        return { state, events: [
            { type: SU_EVENTS.TEMP_BASE_POWER_MODIFIED, payload: { playerId: targetPlayerId, baseIndex: sourceBaseIndex, amount: 2, reason: HELPING_HANDS }, timestamp },
            addTempPower(own.uid, choice.baseIndex, -2, HELPING_HANDS, timestamp),
            { type: SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED, payload: { sourceDefId: HELPING_HANDS, playerId, baseIndex: sourceBaseIndex, cardUid: sourceCardUid, metadata: { targetPlayerId } }, timestamp },
        ] as SmashUpEvent[] };
    });

    registerInteractionHandler(HELPING_CHOOSE_VP, (state, playerId, value, data, _random, timestamp) => {
        if (!(value as { take?: boolean })?.take) return { state, events: [] };
        const targetPlayerId = data?.targetPlayerId as PlayerId | undefined;
        if (!targetPlayerId || (state.core.players[targetPlayerId]?.vp ?? 0) <= 0) return { state, events: [] };
        return { state, events: [
            { type: SU_EVENTS.VP_AWARDED, payload: { playerId: targetPlayerId, amount: -1, reason: HELPING_HANDS }, timestamp },
            { type: SU_EVENTS.VP_AWARDED, payload: { playerId, amount: 1, reason: HELPING_HANDS }, timestamp },
        ] as SmashUpEvent[] };
    });

    registerInteractionHandler(TREEHOUSE_CHOOSE_PLAYER, (state, playerId, value, data, _random, timestamp) => {
        const targetPlayerId = (value as PlayerChoice)?.targetPlayerId;
        if (!targetPlayerId || targetPlayerId === playerId) return { state, events: [] };
        const interaction = createSimpleChoice<{ draw?: boolean }>(`${TREEHOUSE_CHOOSE_DRAW}_${timestamp}`, targetPlayerId, '树屋：是否抽一张牌？', [{ id: 'draw', label: '抽一张牌', labelKey: 'ui.base_treehouse_draw_option', value: { draw: true }, displayMode: 'button' }, skipOption('跳过')], { sourceId: TREEHOUSE_CHOOSE_DRAW, targetType: 'button', titleKey: 'ui.base_treehouse_draw_title', autoResolveIfSingle: false });
        return { state: queueSimpleChoice(state, { ...interaction, data: { ...interaction.data, sourcePlayerId: playerId } }), events: [] };
    });

    registerInteractionHandler(TREEHOUSE_CHOOSE_DRAW, (state, playerId, value, _data, random, timestamp) => (
        (value as { draw?: boolean })?.draw ? { state, events: buildStandardDrawEvents(state.core, playerId, 1, random, timestamp) } : { state, events: [] }
    ));
}

export function registerMunchkinElvesBaseAbilities(): void {
    registerBaseAbility(TREEHOUSE, 'onMinionPlayed', (ctx: BaseAbilityContext) => {
        if (!ctx.matchState || !ctx.minionUid) return { events: [] };
        const played = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.minionUid);
        if (!played || played.controller !== ctx.playerId) return { events: [] };
        const options = otherPlayerOptions(ctx.state, ctx.playerId);
        if (options.length === 0) return { events: [] };
        const interaction = createSimpleChoice<PlayerChoice>(`${TREEHOUSE_CHOOSE_PLAYER}_${ctx.minionUid}_${ctx.now}`, ctx.playerId, '树屋：选择另一位玩家', options, { sourceId: TREEHOUSE_CHOOSE_PLAYER, targetType: 'player', titleKey: 'ui.base_treehouse_player_title', autoResolveIfSingle: false });
        return { events: [], matchState: queueSimpleChoice(ctx.matchState, { ...interaction, data: { ...interaction.data, sourceBaseIndex: ctx.baseIndex, minionUid: ctx.minionUid } }) };
    }, { mandatory: false });
}
