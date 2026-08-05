import { registerAbility, resolveTalent, validateTalentUse } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    addTempPower,
    buildValidatedDestroyEvents,
    buildActionMinionTargetOptions,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildStandardDrawEvents,
    buildSemanticOngoingAttachEvents,
    buildValidatedMoveEvents,
    buildValidatedReturnEvents,
    grantExtraAction,
    grantExtraMinion,
    recoverCardsFromDiscard,
    revealHand,
} from '../domain/abilityHelpers';
import { buildValidatedOngoingDetachEvents, findLiveOngoingCardLocation } from '../domain/ongoingDetach';
import {
    registerCardAbilitySuppression,
    isCardSuppressed,
    registerProtection,
    registerRestriction,
    registerTrigger,
} from '../domain/ongoingEffects';
import type { ProtectionCheckContext, RestrictionCheckContext, TriggerContext } from '../domain/ongoingEffects';
import { SU_EVENTS, type CardInstance, type MinionOnBase, type SmashUpCore, type SmashUpEvent } from '../domain/types';
import { registerBaseAbility, type BaseAbilityContext, type BaseAbilityResult } from '../domain/baseAbilities';
import { getEffectivePower, getPlayerEffectivePowerOnBase } from '../domain/ongoingModifiers';
import { getBaseDef, getCardDef, getMinionLikePower } from '../data/cards';
import { isCardActionLike, isCardMinionLike } from '../domain/utils';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { revealTopAndDrawMatches } from './disney_shared';
import { registerMunchkinMagesAbilities, registerMunchkinMagesBaseAbilities, registerMunchkinMagesInteractionHandlers } from './munchkin_mages';
import { registerMunchkinElvesAbilities, registerMunchkinElvesBaseAbilities, registerMunchkinElvesInteractionHandlers } from './munchkin_elves';
import { registerMunchkinClericsAbilities, registerMunchkinClericsInteractionHandlers } from './munchkin_clerics';
import { registerMunchkinOrcsAbilities, registerMunchkinOrcsInteractionHandlers } from './munchkin_orcs';

const BAG_OF_CALTROPS = 'munchkin_treasure_bag_of_caltrops';
const CROSSBOW = 'munchkin_treasure_crossbow';
const CROSSBOW_CHOOSE_FACTION_SOURCE_ID = 'munchkin_treasure_crossbow_choose_faction';
const DUNGEON_RULEBOOK = 'munchkin_treasure_dungeon_rulebook';
const DUNGEON_RULEBOOK_DESTROY_SOURCE_ID = 'munchkin_treasure_dungeon_rulebook_destroy';
const MAGIC_MISSILE = 'munchkin_treasure_magic_missile';
const MAGIC_MISSILE_DESTROY_SOURCE_ID = 'munchkin_treasure_magic_missile_destroy';
const POTION_OF_HALITOSIS = 'munchkin_treasure_potion_of_halitosis';
const POTION_OF_HALITOSIS_CHOOSE_PLAYER_SOURCE_ID = 'munchkin_treasure_potion_of_halitosis_choose_player';
const POTION_OF_HALITOSIS_MOVE_SOURCE_ID = 'munchkin_treasure_potion_of_halitosis_move';
const POTION_OF_DUPLICATION = 'munchkin_treasure_potion_of_duplication';
const POTION_OF_DUPLICATION_CHOOSE_TALENT_SOURCE_ID = 'munchkin_treasure_potion_of_duplication_choose_talent';
const POTION_OF_PARALYSIS = 'munchkin_treasure_potion_of_paralysis';
const POTION_OF_STRAIGHT_LINE_RUNNING_AWAY = 'munchkin_treasure_potion_of_straight_line_running_away';
const POTION_OF_STRAIGHT_LINE_RUNNING_AWAY_CHOOSE_TREASURE_SOURCE_ID =
    'munchkin_treasure_potion_of_straight_line_running_away_choose_treasure';
const ROCKET_BOOTS = 'munchkin_treasure_rocket_boots';
const ROCKET_BOOTS_MOVE_SOURCE_ID = 'munchkin_treasure_rocket_boots_move';
const TEMPORAL_DISPLACEMENT_JETPACK = 'munchkin_treasure_temporal_displacement_jetpack';
const TREASURE_FINDER = 'munchkin_treasure_treasure_finder';
const WISHING_RING = 'munchkin_treasure_wishing_ring';
const MUNCHKIN_TREASURE_FACTION_ID = 'munchkin_treasures';
const DWARVES_ANYTHING_FOR_MONEY = 'munchkin_dwarves_anything_for_money';
const DWARVES_ANYTHING_FOR_MONEY_DISCARD_SOURCE_ID = 'munchkin_dwarves_anything_for_money_discard';
const DWARVES_CASH_OUT = 'munchkin_dwarves_cash_out';
const DWARVES_CASH_OUT_CHOOSE_TREASURES_SOURCE_ID = 'munchkin_dwarves_cash_out_choose_treasures';
const DWARVES_CUNNING_PLAN = 'munchkin_dwarves_cunning_plan';
const DWARVES_GREED_IS_GOOD = 'munchkin_dwarves_greed_is_good';
const DWARVES_GREED_IS_GOOD_CHOOSE_TREASURE_SOURCE_ID = 'munchkin_dwarves_greed_is_good_choose_treasure';
const DWARVES_GOLD_DIGGER = 'munchkin_dwarves_gold_digger';
const DWARVES_GOLD_DIGGER_CHOOSE_TREASURE_SOURCE_ID = 'munchkin_dwarves_gold_digger_choose_treasure';
const DWARVES_HIDDEN_ASSETS = 'munchkin_dwarves_hidden_assets';
const DWARVES_MINE = 'munchkin_dwarves_mine';
const DWARVES_MINE_CHOOSE_TREASURE_SOURCE_ID = 'munchkin_dwarves_mine_choose_treasure';
const DWARVES_NO_MY_PRECIOUS = 'munchkin_dwarves_no_my_precious';
const DWARVES_NO_MY_PRECIOUS_DESTROY_SOURCE_ID = 'munchkin_dwarves_no_my_precious_destroy';
const DWARVES_SALVAGE = 'munchkin_dwarves_salvage';
const DWARVES_SALVAGE_CHOOSE_TREASURE_SOURCE_ID = 'munchkin_dwarves_salvage_choose_treasure';
const BASE_TREASURE_BATH = 'base_treasure_bath';
const HALFLINGS_SHIRE_MARSHAL = 'munchkin_halflings_shire_marshal';
const HALFLINGS_SHIRE_MARSHAL_CHOOSE_BASE_SOURCE_ID = 'munchkin_halflings_shire_marshal_choose_base';
const HALFLINGS_PESTLING = 'munchkin_halflings_pestling';
const HALFLINGS_BARDLING = 'munchkin_halflings_bardling';
const HALFLINGS_QUARTERLING = 'munchkin_halflings_quarterling';
const HALFLINGS_LAST_CALL = 'munchkin_halflings_last_call';
const HALFLINGS_LAST_CALL_CHOOSE_MINION_SOURCE_ID = 'munchkin_halflings_last_call_choose_minion';
const HALFLINGS_LUNCH_RUN = 'munchkin_halflings_lunch_run';
const HALFLINGS_OUT_OF_NOWHERE = 'munchkin_halflings_out_of_nowhere';
const HALFLINGS_RUDE_AWAKENING = 'munchkin_halflings_rude_awakening';
const HALFLINGS_SMALL_BUT_TOUGH = 'munchkin_halflings_small_but_tough';
const HALFLINGS_SNEAKSY = 'munchkin_halflings_sneaksy';
const HALFLINGS_SPOILED_BRATS = 'munchkin_halflings_spoiled_brats';
const HALFLINGS_SPOILED_BRATS_CHOOSE_MINIONS_SOURCE_ID = 'munchkin_halflings_spoiled_brats_choose_minions';
const HALFLINGS_UNEXPECTED_PARTY = 'munchkin_halflings_unexpected_party';
const HALFLINGS_UNEXPECTED_PARTY_CHOOSE_BASE_SOURCE_ID = 'munchkin_halflings_unexpected_party_choose_base';
const BASE_BIRTHDAY_PARTY = 'base_birthday_party';
const BASE_SUBTERRANEAN_LAIR = 'base_subterranean_lair';
const THIEVES_MASTER_THIEF = 'munchkin_thieves_master_thief';
const THIEVES_FENCE = 'munchkin_thieves_fence';
const THIEVES_FENCE_CHOOSE_TREASURES_SOURCE_ID = 'munchkin_thieves_fence_choose_treasures';
const THIEVES_BACKSTAB = 'munchkin_thieves_backstab';
const THIEVES_BACKSTAB_CHOOSE_TREASURE_SOURCE_ID = 'munchkin_thieves_backstab_choose_treasure';
const THIEVES_BACKSTAB_CHOOSE_MINION_SOURCE_ID = 'munchkin_thieves_backstab_choose_minion';
const THIEVES_CAT_BURGLAR = 'munchkin_thieves_cat_burglar';
const THIEVES_CAT_BURGLAR_CHOOSE_TREASURES_SOURCE_ID = 'munchkin_thieves_cat_burglar_choose_treasures';
const THIEVES_PICKPOCKET = 'munchkin_thieves_pickpocket';
const THIEVES_POTION_BANDOLIER = 'munchkin_thieves_potion_bandolier';
const THIEVES_POTION_BANDOLIER_CHOOSE_TREASURE_SOURCE_ID = 'munchkin_thieves_potion_bandolier_choose_treasure';
const THIEVES_SMUGGLING = 'munchkin_thieves_smuggling';
const THIEVES_SMUGGLING_CHOOSE_TREASURES_SOURCE_ID = 'munchkin_thieves_smuggling_choose_treasures';
const THIEVES_SWIPE = 'munchkin_thieves_swipe';
const THIEVES_CLEVER_DISTRACTION = 'munchkin_thieves_clever_distraction';
const THIEVES_MUGGING = 'munchkin_thieves_mugging';
const THIEVES_MUGGING_CHOOSE_ACTION_SOURCE_ID = 'munchkin_thieves_mugging_choose_action';
const THIEVES_MUGGING_CHOOSE_MINION_SOURCE_ID = 'munchkin_thieves_mugging_choose_minion';
const THIEVES_STRIP_BARE = 'munchkin_thieves_strip_bare';
const THIEVES_STRIP_BARE_CHOOSE_TREASURE_SOURCE_ID = 'munchkin_thieves_strip_bare_choose_treasure';
const BASE_THE_COFFERS = 'base_the_coffers';
const BASE_THIEVES_GUILD = 'base_thieves_guild';

type AttachedTreasureHost = {
    host: MinionOnBase;
    action: MinionOnBase['attachedActions'][number];
};
type MagicMissileMinionChoice = {
    minionUid?: string;
    baseIndex?: number;
    defId?: string;
    minionDefId?: string;
};
type MagicMissileInteractionData = {
    fromBaseIndex?: unknown;
    sourceCardUid?: unknown;
};
type CrossbowFactionChoice = {
    factionId?: string;
};
type CrossbowInteractionData = {
    targetBaseIndex?: unknown;
    sourceCardUid?: unknown;
};
type DungeonRulebookOngoingChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: string;
    baseIndex?: number;
    targetType?: 'base' | 'minion';
    targetMinionUid?: string;
};
type DungeonRulebookInteractionData = {
    sourceCardUid?: unknown;
};
type NoMyPreciousInteractionData = {
    sourceCardUid?: unknown;
};
type GoldDiggerTreasureChoice = {
    treasureDefId?: string;
    discardIndex?: number;
};
type GoldDiggerInteractionData = {
    sourceMinionUid?: unknown;
    sourceBaseIndex?: unknown;
};
type GreedIsGoodTreasureChoice = {
    mode?: 'draw' | 'recover';
    treasureDefId?: string;
    discardIndex?: number;
};
type GreedIsGoodInteractionData = {
    sourceCardUid?: unknown;
    sourcePlayerId?: unknown;
};
type AnythingForMoneyDiscardChoice = {
    cardUid?: string;
    defId?: string;
};
type AnythingForMoneyInteractionData = {
    sourceCardUid?: unknown;
    sourcePlayerId?: unknown;
};
type CashOutTreasureChoice = {
    cardUid?: string;
    defId?: string;
};
type CashOutInteractionData = {
    sourceCardUid?: unknown;
    sourcePlayerId?: unknown;
};
type HandTreasureChoice = {
    cardUid?: string;
    defId?: string;
};
type CatBurglarTreasureChoice = {
    cardUid?: string;
    defId?: string;
};
type CatBurglarInteractionData = {
    sourceMinionUid?: unknown;
    sourceBaseIndex?: unknown;
};
type FenceInteractionData = {
    sourceMinionUid?: unknown;
    sourceBaseIndex?: unknown;
};
type BackstabTreasureInteractionData = {
    sourceCardUid?: unknown;
    sourcePlayerId?: unknown;
};
type BackstabMinionChoice = {
    minionUid?: string;
    baseIndex?: number;
    defId?: string;
    minionDefId?: string;
};
type BackstabMinionInteractionData = {
    sourceCardUid?: unknown;
    sourcePlayerId?: unknown;
    treasureCardUid?: unknown;
    treasureDefId?: unknown;
};
type MuggingActionChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: string;
    baseIndex?: number;
    targetMinionUid?: string;
};
type MuggingActionInteractionData = {
    sourceCardUid?: unknown;
    sourcePlayerId?: unknown;
};
type MuggingMinionChoice = {
    minionUid?: string;
    baseIndex?: number;
    defId?: string;
    minionDefId?: string;
};
type MuggingMinionInteractionData = {
    sourceCardUid?: unknown;
    sourcePlayerId?: unknown;
    actionCardUid?: unknown;
    actionDefId?: unknown;
    actionOwnerId?: unknown;
    originalBaseIndex?: unknown;
    originalHostMinionUid?: unknown;
};
type StripBareTreasureChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: string;
    baseIndex?: number;
    targetType?: 'minion' | 'base' | 'attachedAction';
    targetMinionUid?: string;
};
type StripBareInteractionData = {
    sourceCardUid?: unknown;
    sourcePlayerId?: unknown;
};
type PotionBandolierTreasureInteractionData = {
    sourceCardUid?: unknown;
    sourcePlayerId?: unknown;
    targetMinionUid?: unknown;
    targetBaseIndex?: unknown;
};
type SmugglingInteractionData = {
    sourceCardUid?: unknown;
    sourcePlayerId?: unknown;
};
type MineTreasureHostChoice = {
    treasureDefId?: string;
    deckIndex?: number;
    targetBaseIndex?: number;
    targetMinionUid?: string;
    targetMinionDefId?: string;
};
type MineInteractionData = {
    sourceCardUid?: unknown;
    sourcePlayerId?: unknown;
};
type SalvageTreasureHostChoice = {
    treasureDefId?: string;
    discardIndex?: number;
    targetBaseIndex?: number;
    targetMinionUid?: string;
    targetMinionDefId?: string;
};
type SalvageInteractionData = {
    sourceCardUid?: unknown;
    sourcePlayerId?: unknown;
    sourceBaseIndex?: unknown;
};
type HalitosisPlayerChoice = {
    playerId?: string;
};
type HalitosisChoosePlayerInteractionData = {
    sourceCardUid?: unknown;
    sourcePlayerId?: unknown;
    targetBaseIndex?: unknown;
};
type HalitosisMoveChoice = {
    minionUid?: string;
    minionDefId?: string;
    fromBaseIndex?: number;
    toBaseIndex?: number;
    toBaseDefId?: string;
};
type HalitosisMoveInteractionData = {
    sourceCardUid?: unknown;
    sourcePlayerId?: unknown;
    selectedPlayerId?: unknown;
    targetBaseIndex?: unknown;
};
type DuplicationTalentChoice = {
    minionUid?: string;
    minionDefId?: string;
    baseIndex?: number;
};
type DuplicationTalentInteractionData = {
    hostMinionUid?: unknown;
    hostMinionDefId?: unknown;
    sourceCardUid?: unknown;
    sourceBaseIndex?: unknown;
};
type StraightLineRunningAwayTreasureChoice = {
    treasureUid?: string;
    treasureDefId?: string;
};
type StraightLineRunningAwayInteractionData = {
    sourceCardUid?: unknown;
    sourcePlayerId?: unknown;
};
type RocketBootsBaseChoice = { baseIndex?: number };
type RocketBootsInteractionData = {
    minionUid?: unknown;
    minionDefId?: unknown;
    fromBaseIndex?: unknown;
    sourceCardUid?: unknown;
};
type ShireMarshalBaseChoice = { baseIndex?: number; baseDefId?: string };
type ShireMarshalInteractionData = {
    sourceCardUid?: unknown;
    sourceBaseIndex?: unknown;
};
type HalflingHandMinionChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: string;
};
type LastCallInteractionData = {
    sourceCardUid?: unknown;
    sourcePlayerId?: unknown;
    targetBaseIndex?: unknown;
};
type SpoiledBratsInteractionData = {
    sourceCardUid?: unknown;
    sourcePlayerId?: unknown;
};
type UnexpectedPartyBaseChoice = { baseIndex?: number; baseDefId?: string; skip?: true };
type UnexpectedPartyInteractionData = {
    sourceCardUid?: unknown;
    sourcePlayerId?: unknown;
};

function minionPlayedWithoutAbilityEvent(params: {
    playerId: string;
    cardUid: string;
    defId: string;
    ownerId?: string;
    baseIndex: number;
    now: number;
}): SmashUpEvent {
    return {
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId: params.playerId,
            cardUid: params.cardUid,
            defId: params.defId,
            baseIndex: params.baseIndex,
            ownerId: params.ownerId,
            power: getMinionLikePower(params.defId) ?? 0,
            consumesNormalLimit: false,
            skipOnPlayAbility: true,
        },
        timestamp: params.now,
    };
}

function halflingHirelingOnPlay(ctx: AbilityContext): AbilityResult {
    return {
        events: [grantExtraMinion(ctx.playerId, ctx.defId, ctx.now)],
    };
}

function quarterlingOnPlay(ctx: AbilityContext): AbilityResult {
    if (ctx.baseIndex === undefined || !ctx.cardUid) return { events: [] };
    const ownMinionsHere = ctx.state.bases[ctx.baseIndex]?.minions.filter(minion => minion.controller === ctx.playerId) ?? [];
    if (ownMinionsHere.length !== 1 || ownMinionsHere[0]?.uid !== ctx.cardUid) return { events: [] };
    return {
        events: [grantExtraMinion(ctx.playerId, HALFLINGS_QUARTERLING, ctx.now, ctx.baseIndex)],
    };
}

function getPlayableHandMinions(
    state: SmashUpCore,
    playerId: string,
    sourceCardUid?: string,
): CardInstance[] {
    return (state.players[playerId]?.hand ?? [])
        .filter(card => card.uid !== sourceCardUid && isCardMinionLike(card));
}

function buildHandMinionOptions(
    state: SmashUpCore,
    playerId: string,
    sourceCardUid?: string,
) {
    return getPlayableHandMinions(state, playerId, sourceCardUid).map(card => ({
        id: `hand-minion-${card.uid}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: {
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
        } satisfies HalflingHandMinionChoice,
        _source: 'hand' as const,
        displayMode: 'card' as const,
    }));
}

function suppressPlayedMinionsUntilTurnEnd(params: {
    cardUids: string[];
    baseIndex: number;
    reason: string;
    playerId: string;
    sourceCardUid?: string;
    now: number;
}): SmashUpEvent | undefined {
    const cardUids = params.cardUids.filter(Boolean);
    if (cardUids.length === 0) return undefined;
    return {
        type: SU_EVENTS.CARDS_SUPPRESSED_UNTIL_TURN_END,
        payload: {
            cardUids,
            baseIndex: params.baseIndex,
            reason: params.reason,
            sourcePlayerId: params.playerId,
            sourceCardUid: params.sourceCardUid,
            sourceDefId: params.reason,
            sourceControllerId: params.playerId,
            sourceBaseIndex: params.baseIndex,
        },
        timestamp: params.now,
    };
}

function lastCallValidateUse(ctx: AbilityContext): string | null {
    const targetBaseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    if (targetBaseIndex === undefined || !ctx.state.bases[targetBaseIndex]) return '当前没有可选择的基地';
    return getPlayableHandMinions(ctx.state, ctx.playerId, ctx.cardUid).length > 0
        ? null
        : '当前手牌没有可打出的随从';
}

function lastCallSpecial(ctx: AbilityContext): AbilityResult {
    const targetBaseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const options = buildHandMinionOptions(ctx.state, ctx.playerId, ctx.cardUid);
    if (targetBaseIndex === undefined || !ctx.state.bases[targetBaseIndex] || options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }

    const interaction = createSimpleChoice<HalflingHandMinionChoice>(
        `${HALFLINGS_LAST_CALL_CHOOSE_MINION_SOURCE_ID}_${ctx.cardUid}_${targetBaseIndex}_${ctx.now}`,
        ctx.playerId,
        '最后通牒：选择要打到当前基地的随从',
        options,
        {
            sourceId: HALFLINGS_LAST_CALL_CHOOSE_MINION_SOURCE_ID,
            targetType: 'hand',
            titleKey: 'ui.munchkin_halflings_last_call_choose_minion_title',
            responseValidationMode: 'live',
            autoRefresh: 'hand',
            displayCard: { defId: HALFLINGS_LAST_CALL, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildHandMinionOptions(latestState.core as SmashUpCore, ctx.playerId, ctx.cardUid);

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceCardUid: ctx.cardUid,
                sourcePlayerId: ctx.playerId,
                targetBaseIndex,
            },
        }),
    };
}

function pestlingExtraMinion(ctx: AbilityContext | TriggerContext): AbilityResult {
    const baseIndex = ctx.baseIndex ?? ctx.sourceBaseIndex;
    const playerId = ctx.playerId ?? ctx.sourceControllerId;
    if (baseIndex === undefined || !playerId) return { events: [] };
    return {
        events: [grantExtraMinion(playerId, HALFLINGS_PESTLING, ctx.now, baseIndex)],
    };
}

function hasOpponentMorePowerAtBase(state: SmashUpCore, baseIndex: number, playerId: string): boolean {
    const base = state.bases[baseIndex];
    if (!base) return false;
    const ownPower = getPlayerEffectivePowerOnBase(state, base, baseIndex, playerId);
    return Object.keys(state.players).some((candidatePlayerId) => {
        if (candidatePlayerId === playerId) return false;
        return getPlayerEffectivePowerOnBase(state, base, baseIndex, candidatePlayerId) > ownPower;
    });
}

function shireMarshalCandidateBases(state: SmashUpCore, playerId: string) {
    return state.bases
        .map((base, baseIndex) => {
            if (!hasOpponentMorePowerAtBase(state, baseIndex, playerId)) return undefined;
            return {
                baseIndex,
                label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
            };
        })
        .filter((candidate): candidate is { baseIndex: number; label: string } => Boolean(candidate));
}

function shireMarshalValidateUse(ctx: AbilityContext): string | null {
    return shireMarshalCandidateBases(ctx.state, ctx.playerId).length > 0
        ? null
        : '当前没有另一玩家力量大于你的基地';
}

function shireMarshalTalent(ctx: AbilityContext): AbilityResult {
    const candidates = shireMarshalCandidateBases(ctx.state, ctx.playerId);
    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }
    if (candidates.length === 1) {
        return {
            events: [grantExtraMinion(ctx.playerId, HALFLINGS_SHIRE_MARSHAL, ctx.now, candidates[0].baseIndex)],
        };
    }

    const interaction = createSimpleChoice<ShireMarshalBaseChoice>(
        `${HALFLINGS_SHIRE_MARSHAL_CHOOSE_BASE_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '夏尔首领：选择额外随从基地',
        buildBaseTargetOptions(candidates, ctx.state),
        {
            sourceId: HALFLINGS_SHIRE_MARSHAL_CHOOSE_BASE_SOURCE_ID,
            targetType: 'base',
            titleKey: 'ui.munchkin_halflings_shire_marshal_choose_base_title',
            responseValidationMode: 'live',
            displayCard: { defId: HALFLINGS_SHIRE_MARSHAL, cardUid: ctx.cardUid },
        },
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceCardUid: ctx.cardUid,
                sourceBaseIndex: ctx.baseIndex,
            },
        }),
    };
}

function bardlingExtraMinion(ctx: AbilityContext | TriggerContext): AbilityResult {
    const baseIndex = ctx.baseIndex ?? ctx.sourceBaseIndex;
    const playerId = ctx.playerId ?? ctx.sourceControllerId;
    if (baseIndex === undefined || !playerId) return { events: [] };
    if (!hasOpponentMorePowerAtBase(ctx.state, baseIndex, playerId)) return { events: [] };
    return {
        events: [grantExtraMinion(playerId, HALFLINGS_BARDLING, ctx.now, baseIndex)],
    };
}

function outOfNowhereOnPlay(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const revealLimit = player.deck.length + player.discard.length;
    if (revealLimit <= 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    }
    return {
        events: revealTopAndDrawMatches({
            state: ctx.state,
            random: ctx.random,
            playerId: ctx.playerId,
            count: revealLimit,
            maxPick: 2,
            predicate: isCardMinionLike,
            reason: HALFLINGS_OUT_OF_NOWHERE,
            now: ctx.now,
        }).events,
    };
}

function rudeAwakeningOnPlay(ctx: AbilityContext): AbilityResult {
    const targetBaseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const targetBase = ctx.state.bases[targetBaseIndex];
    const player = ctx.state.players[ctx.playerId];
    if (!player || !targetBase) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }

    const revealedCards = player.hand.filter(card => card.uid !== ctx.cardUid);
    const minionsToPlay = revealedCards.filter(isCardMinionLike);
    const events: SmashUpEvent[] = [
        revealHand(
            ctx.playerId,
            'all',
            revealedCards.map(card => ({ uid: card.uid, defId: card.defId })),
            HALFLINGS_RUDE_AWAKENING,
            ctx.now,
            ctx.playerId,
        ),
        ...minionsToPlay.map(card => minionPlayedWithoutAbilityEvent({
            playerId: ctx.playerId,
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            baseIndex: targetBaseIndex,
            now: ctx.now,
        })),
    ];
    const suppression = suppressPlayedMinionsUntilTurnEnd({
        cardUids: minionsToPlay.map(card => card.uid),
        baseIndex: targetBaseIndex,
        reason: HALFLINGS_RUDE_AWAKENING,
        playerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        now: ctx.now,
    });
    if (suppression) events.push(suppression);

    return { events };
}

function lunchRunOnMinionPlayed(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceControllerId || ctx.sourceBaseIndex === undefined) return [];
    if (ctx.playerId !== ctx.sourceControllerId) return [];
    if (ctx.baseIndex !== ctx.sourceBaseIndex) return [];
    return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
}

function findSmallButToughHost(ctx: TriggerContext): MinionOnBase | undefined {
    if (ctx.baseIndex === undefined || !ctx.sourceCardUid) return undefined;
    return ctx.state.bases[ctx.baseIndex]?.minions.find(minion =>
        minion.uid === ctx.triggerMinionUid
        && minion.attachedActions.some(action =>
            action.uid === ctx.sourceCardUid
            && action.defId === HALFLINGS_SMALL_BUT_TOUGH
        )
    );
}

function smallButToughCanTrigger(ctx: TriggerContext): boolean {
    return Boolean(ctx.triggerMinionUid && findSmallButToughHost(ctx));
}

function smallButToughTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const host = findSmallButToughHost(ctx);
    if (!host || ctx.baseIndex === undefined || !ctx.triggerMinionUid) return [];
    return [{
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: {
            cardUid: ctx.triggerMinionUid,
            defId: host.defId,
            ownerId: host.owner,
            reason: HALFLINGS_SMALL_BUT_TOUGH,
            sourcePlayerId: ctx.sourceControllerId ?? ctx.playerId,
            sourceCardUid: ctx.sourceCardUid,
            sourceDefId: HALFLINGS_SMALL_BUT_TOUGH,
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: ctx.sourceBaseIndex ?? ctx.baseIndex,
        },
        timestamp: ctx.now,
    }];
}

function buildSpoiledBratsMinionOptions(state: SmashUpCore, playerId: string) {
    return (state.players[playerId]?.discard ?? [])
        .filter(isCardMinionLike)
        .map(card => ({
            id: `discard-minion-${card.uid}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: {
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner,
            } satisfies HalflingHandMinionChoice,
            _source: 'discard' as const,
            displayMode: 'card' as const,
        }));
}

function spoiledBratsOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildSpoiledBratsMinionOptions(ctx.state, ctx.playerId);
    if (options.length === 0) return { events: [] };

    const interaction = createSimpleChoice<HalflingHandMinionChoice>(
        `${HALFLINGS_SPOILED_BRATS_CHOOSE_MINIONS_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '被宠坏的小家伙：选择任意数量弃牌堆随从放到牌库顶',
        options,
        {
            sourceId: HALFLINGS_SPOILED_BRATS_CHOOSE_MINIONS_SOURCE_ID,
            targetType: 'discard',
            titleKey: 'ui.munchkin_halflings_spoiled_brats_choose_minions_title',
            responseValidationMode: 'live',
            autoRefresh: 'discard',
            multi: { min: 0, max: options.length },
            displayCard: { defId: HALFLINGS_SPOILED_BRATS, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildSpoiledBratsMinionOptions(latestState.core as SmashUpCore, ctx.playerId);

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceCardUid: ctx.cardUid,
                sourcePlayerId: ctx.playerId,
            },
        }),
    };
}

function buildUnexpectedPartyBaseOptions(state: SmashUpCore, playerId: string) {
    const baseOptions = state.bases
        .map((base, baseIndex) => ({ base, baseIndex }))
        .filter(({ base }) => !base.minions.some(minion => minion.controller === playerId))
        .map(({ base, baseIndex }) => ({
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
        }));
    return [
        {
            id: 'skip',
            label: '跳过',
            labelKey: 'ui.skip',
            value: { skip: true } satisfies UnexpectedPartyBaseChoice,
            displayMode: 'button' as const,
        },
        ...buildBaseTargetOptions(baseOptions, state),
    ];
}

function unexpectedPartyOnPlay(ctx: AbilityContext): AbilityResult {
    const hasHandMinion = getPlayableHandMinions(ctx.state, ctx.playerId, ctx.cardUid).length > 0;
    const legalBaseOptions = buildUnexpectedPartyBaseOptions(ctx.state, ctx.playerId)
        .filter(option => option.id !== 'skip');
    if (!hasHandMinion || legalBaseOptions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }

    const interaction = createSimpleChoice<UnexpectedPartyBaseChoice>(
        `${HALFLINGS_UNEXPECTED_PARTY_CHOOSE_BASE_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '意外的派对：选择没有己方随从的基地',
        buildUnexpectedPartyBaseOptions(ctx.state, ctx.playerId),
        {
            sourceId: HALFLINGS_UNEXPECTED_PARTY_CHOOSE_BASE_SOURCE_ID,
            targetType: 'base',
            titleKey: 'ui.munchkin_halflings_unexpected_party_choose_base_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            displayCard: { defId: HALFLINGS_UNEXPECTED_PARTY, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildUnexpectedPartyBaseOptions(latestState.core as SmashUpCore, ctx.playerId);

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceCardUid: ctx.cardUid,
                sourcePlayerId: ctx.playerId,
            },
        }),
    };
}

function sneaksyProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourceKind !== 'action') return false;
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    const base = ctx.state.bases[ctx.targetBaseIndex];
    return base?.ongoingActions.some(action =>
        action.defId === HALFLINGS_SNEAKSY
        && (((action.metadata?.sourceControllerId as string | undefined) ?? action.ownerId) === ctx.targetMinion.controller),
    ) ?? false;
}

function birthdayPartyRestriction(ctx: RestrictionCheckContext): boolean {
    if (ctx.restrictionType !== 'play_minion') return false;
    return ctx.state.bases.some((base, birthdayBaseIndex) => {
        if (base.defId !== BASE_BIRTHDAY_PARTY) return false;
        if (ctx.baseIndex === birthdayBaseIndex) return false;
        return !base.minions.some(minion => minion.controller === ctx.playerId);
    });
}

function subterraneanLairOnTurnStart(ctx: BaseAbilityContext): BaseAbilityResult {
    const hasOwnMinionHere = ctx.state.bases[ctx.baseIndex]?.minions.some(minion => minion.controller === ctx.playerId) ?? false;
    if (hasOwnMinionHere) return { events: [] };
    return {
        events: [grantExtraMinion(ctx.playerId, BASE_SUBTERRANEAN_LAIR, ctx.now, ctx.baseIndex, { playTiming: 'banked' })],
    };
}

function potionOfIdioticBraveryOnPlay(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid || ctx.targetBaseIndex === undefined) {
        return { events: [] };
    }

    return {
        events: [
            addTempPower(ctx.targetMinionUid, ctx.targetBaseIndex, 3, ctx.defId, ctx.now, {
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.targetBaseIndex,
            }),
        ],
    };
}

function munchkinTreasureToDeckBottom(
    cardUid: string,
    defId: string,
    ownerId: string,
    now: number,
    sourcePlayerId: string,
    reason: string,
    sourceBaseIndex?: number,
): SmashUpEvent {
    return {
        type: SU_EVENTS.MUNCHKIN_TREASURE_TO_DECK_BOTTOM,
        payload: {
            cardUid,
            defId,
            ownerId,
            reason,
            sourcePlayerId,
            sourceCardUid: cardUid,
            sourceDefId: defId,
            sourceControllerId: sourcePlayerId,
            ...(sourceBaseIndex !== undefined ? { sourceBaseIndex } : {}),
        },
        timestamp: now,
    };
}

function wishingRingOnPlay(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            {
                type: SU_EVENTS.VP_AWARDED,
                payload: {
                    playerId: ctx.playerId,
                    amount: 1,
                    reason: WISHING_RING,
                },
                timestamp: ctx.now,
            },
            munchkinTreasureToDeckBottom(
                ctx.cardUid,
                WISHING_RING,
                ctx.playerId,
                ctx.now,
                ctx.playerId,
                WISHING_RING,
                ctx.targetBaseIndex ?? ctx.baseIndex,
            ),
        ],
    };
}

function drawMunchkinTreasures(
    ctx: AbilityContext,
    count: number,
    reason: string,
    treasureUids?: string[],
): SmashUpEvent {
    return {
        type: SU_EVENTS.MUNCHKIN_TREASURES_DRAWN,
        payload: {
            playerId: ctx.playerId,
            count,
            ...(treasureUids ? { treasureUids } : {}),
            reason,
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.targetBaseIndex ?? ctx.baseIndex,
        },
        timestamp: ctx.now,
    };
}

function drawMunchkinTreasuresFromBase(
    ctx: BaseAbilityContext,
    count: number,
    reason: string,
): SmashUpEvent {
    return {
        type: SU_EVENTS.MUNCHKIN_TREASURES_DRAWN,
        payload: {
            playerId: ctx.playerId,
            count,
            reason,
            sourcePlayerId: ctx.playerId,
            sourceDefId: reason,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        },
        timestamp: ctx.now,
    };
}

function isFirstTreasureBathMinionPlayedByPlayerThisTurn(ctx: BaseAbilityContext): boolean {
    return (ctx.state.players[ctx.playerId]?.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0) === 1;
}

function treasureBathOnMinionPlayed(ctx: BaseAbilityContext): BaseAbilityResult {
    if (!isFirstTreasureBathMinionPlayedByPlayerThisTurn(ctx)) {
        return { events: [] };
    }

    return {
        events: [drawMunchkinTreasuresFromBase(ctx, 1, BASE_TREASURE_BATH)],
    };
}

function munchkinTreasuresMilled(ctx: AbilityContext, count: number, reason: string): SmashUpEvent {
    return {
        type: SU_EVENTS.MUNCHKIN_TREASURES_MILLED,
        payload: {
            count,
            reason,
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.targetBaseIndex ?? ctx.baseIndex,
        },
        timestamp: ctx.now,
    };
}

function hiddenAssetsOnPlay(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            munchkinTreasuresMilled(ctx, 3, DWARVES_HIDDEN_ASSETS),
            ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
            grantExtraAction(ctx.playerId, DWARVES_HIDDEN_ASSETS, ctx.now),
        ],
    };
}

function treasureFinderOnPlay(ctx: AbilityContext): AbilityResult {
    const treasureDeck = ctx.state.treasureDeck ?? [];
    const drawCount = Math.min(2, treasureDeck.length);
    const remainingDeck = treasureDeck.slice(drawCount);
    const shuffledDeck = ctx.random.shuffle([
        ...remainingDeck,
        TREASURE_FINDER,
        ...(ctx.state.treasureDiscard ?? []),
    ]);

    return {
        events: [
            drawMunchkinTreasures(ctx, 2, TREASURE_FINDER),
            {
                type: SU_EVENTS.MUNCHKIN_TREASURE_DECK_SHUFFLED,
                payload: {
                    deckDefIds: shuffledDeck,
                    cardUid: ctx.cardUid,
                    defId: TREASURE_FINDER,
                    ownerId: ctx.playerId,
                    reason: TREASURE_FINDER,
                    sourcePlayerId: ctx.playerId,
                    sourceCardUid: ctx.cardUid,
                    sourceDefId: TREASURE_FINDER,
                    sourceControllerId: ctx.playerId,
                    sourceBaseIndex: ctx.targetBaseIndex ?? ctx.baseIndex,
                },
                timestamp: ctx.now,
            },
        ],
    };
}

function getSelectedFactionIds(state: SmashUpCore): string[] {
    const factionIds = new Set<string>();
    for (const player of Object.values(state.players)) {
        for (const factionId of player.factions ?? []) {
            if (factionId) factionIds.add(factionId);
        }
    }
    return Array.from(factionIds);
}

function buildCrossbowEvents(
    state: SmashUpCore,
    baseIndex: number,
    factionId: string,
    source: {
        playerId: string;
        cardUid?: string;
        now: number;
    },
): SmashUpEvent[] {
    const base = state.bases[baseIndex];
    if (!base) return [];

    return base.minions
        .filter((minion) => getCardDef(minion.defId)?.faction === factionId)
        .map((minion) => addTempPower(minion.uid, baseIndex, 2, CROSSBOW, source.now, {
            sourcePlayerId: source.playerId,
            sourceCardUid: source.cardUid,
            sourceDefId: CROSSBOW,
            sourceControllerId: source.playerId,
            sourceBaseIndex: baseIndex,
        }));
}

function crossbowOnPlay(ctx: AbilityContext): AbilityResult {
    if (ctx.targetBaseIndex === undefined || !ctx.state.bases[ctx.targetBaseIndex]) {
        return { events: [] };
    }

    const options = getSelectedFactionIds(ctx.state).map((factionId, index) => ({
        id: `faction-${index}`,
        label: factionId,
        labelKey: `factions.${factionId}.name`,
        value: { factionId },
        displayMode: 'button' as const,
    }));
    if (options.length === 0) return { events: [] };

    const interaction = createSimpleChoice(
        `${CROSSBOW_CHOOSE_FACTION_SOURCE_ID}_${ctx.now}`,
        ctx.playerId,
        '十字弓：选择派系',
        options,
        {
            sourceId: 'munchkin_treasure_crossbow_choose_faction',
            targetType: 'button',
            titleKey: 'ui.munchkin_crossbow_choose_faction_title',
            responseValidationMode: 'live',
            displayCard: { defId: CROSSBOW, cardUid: ctx.cardUid },
        },
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                targetBaseIndex: ctx.targetBaseIndex,
                sourceCardUid: ctx.cardUid,
            },
        }),
    };
}

function buildDungeonRulebookOngoingOptions(state: SmashUpCore) {
    return state.bases.flatMap((base, baseIndex) => {
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        const baseActions = base.ongoingActions.map((action, index) => ({
            id: `base-action-${baseIndex}-${index}`,
            label: `${getCardDef(action.defId)?.name ?? action.defId}（${baseName}）`,
            value: {
                cardUid: action.uid,
                defId: action.defId,
                ownerId: action.ownerId,
                baseIndex,
                targetType: 'base' as const,
            },
            _source: 'field' as const,
            displayMode: 'card' as const,
        }));
        const attachedActions = base.minions.flatMap((minion) => {
            const minionName = getCardDef(minion.defId)?.name ?? minion.defId;
            return minion.attachedActions.map((action, index) => ({
                id: `attached-action-${baseIndex}-${minion.uid}-${index}`,
                label: `在 ${minionName}（${baseName}）`,
                value: {
                    cardUid: action.uid,
                    defId: action.defId,
                    ownerId: action.ownerId,
                    baseIndex,
                    targetType: 'minion' as const,
                    targetMinionUid: minion.uid,
                },
                _source: 'field' as const,
                displayMode: 'card' as const,
            }));
        });
        return [...baseActions, ...attachedActions];
    });
}

function buildAttachedActionOptions(state: SmashUpCore) {
    return state.bases.flatMap((base, baseIndex) => {
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        return base.minions.flatMap((minion) => {
            const minionName = getCardDef(minion.defId)?.name ?? minion.defId;
            return minion.attachedActions.map((action, index) => ({
                id: `attached-action-${baseIndex}-${minion.uid}-${index}`,
                label: `${getCardDef(action.defId)?.name ?? action.defId}（${minionName} / ${baseName}）`,
                value: {
                    cardUid: action.uid,
                    defId: action.defId,
                    ownerId: action.ownerId,
                    baseIndex,
                    targetType: 'minion' as const,
                    targetMinionUid: minion.uid,
                },
                _source: 'field' as const,
                displayMode: 'card' as const,
            }));
        });
    });
}

function dungeonRulebookOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildDungeonRulebookOngoingOptions(ctx.state);
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }

    const interaction = createSimpleChoice<DungeonRulebookOngoingChoice>(
        `${DUNGEON_RULEBOOK_DESTROY_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '地牢规则书：选择要摧毁的行动',
        options,
        {
            sourceId: 'munchkin_treasure_dungeon_rulebook_destroy',
            targetType: 'ongoing',
            titleKey: 'ui.munchkin_dungeon_rulebook_destroy_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            displayCard: { defId: DUNGEON_RULEBOOK, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildDungeonRulebookOngoingOptions(latestState.core as SmashUpCore);

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceCardUid: ctx.cardUid,
            },
        }),
    };
}

function isMunchkinTreasureCard(defId: string): boolean {
    return getCardDef(defId)?.faction === MUNCHKIN_TREASURE_FACTION_ID;
}

function isMunchkinTreasureAttachableToMinion(defId: string): boolean {
    const def = getCardDef(defId);
    return def?.faction === MUNCHKIN_TREASURE_FACTION_ID
        && def.type === 'action'
        && def.subtype === 'ongoing'
        && (def.ongoingTarget ?? 'base') === 'minion';
}

function collectOccupiedCardUids(state: SmashUpCore): Set<string> {
    const occupied = new Set<string>();

    for (const player of Object.values(state.players)) {
        for (const card of player.hand) occupied.add(card.uid);
        for (const card of player.deck) occupied.add(card.uid);
        for (const card of player.discard) occupied.add(card.uid);
    }

    for (const base of state.bases) {
        for (const minion of base.minions) {
            occupied.add(minion.uid);
            for (const attached of minion.attachedActions ?? []) {
                occupied.add(attached.uid);
            }
        }
        for (const ongoing of base.ongoingActions) {
            occupied.add(ongoing.uid);
        }
        for (const buried of base.buriedCards ?? []) {
            occupied.add(buried.uid);
        }
    }

    for (const titan of state.titans ?? []) {
        occupied.add(titan.uid);
    }

    for (const card of state.pendingMunchkinTreasureReward?.treasureCards ?? []) {
        occupied.add(card.uid);
    }

    return occupied;
}

function getNextMunchkinTreasureUid(state: SmashUpCore): string {
    const occupied = collectOccupiedCardUids(state);
    let nextUid = state.nextUid;
    while (occupied.has(`munchkin_treasure_${nextUid}`)) {
        nextUid += 1;
    }
    return `munchkin_treasure_${nextUid}`;
}

function buildImmediatePlayDrawnTreasureEvent(
    playerId: string,
    treasureUid: string,
    treasureDefId: string,
    reason: string,
    now: number,
): SmashUpEvent | undefined {
    const treasureDef = getCardDef(treasureDefId);
    if (treasureDef?.faction !== MUNCHKIN_TREASURE_FACTION_ID) return undefined;
    if (treasureDef.type === 'minion') {
        return grantExtraMinion(playerId, reason, now, undefined, {
            playTiming: 'immediate',
            specificCardUid: treasureUid,
        });
    }
    if (treasureDef.type === 'action') {
        return grantExtraAction(playerId, reason, now, {
            playTiming: 'immediate',
            restrictToCardUid: treasureUid,
        });
    }
    return undefined;
}

function getAnythingForMoneyDiscardableHandCards(
    state: SmashUpCore,
    playerId: string,
    sourceCardUid?: string,
): CardInstance[] {
    return (state.players[playerId]?.hand ?? []).filter(card => card.uid !== sourceCardUid);
}

function buildAnythingForMoneyDiscardOptions(
    state: SmashUpCore,
    playerId: string,
    sourceCardUid?: string,
) {
    return getAnythingForMoneyDiscardableHandCards(state, playerId, sourceCardUid).map(card => ({
        id: `hand-${card.uid}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: {
            cardUid: card.uid,
            defId: card.defId,
        } satisfies AnythingForMoneyDiscardChoice,
        _source: 'hand' as const,
        displayMode: 'card' as const,
    }));
}

function getCashOutPlayableTreasureCards(state: SmashUpCore, playerId: string): CardInstance[] {
    return (state.players[playerId]?.hand ?? [])
        .filter(card => isMunchkinTreasureCard(card.defId))
        .filter(card => isCardMinionLike(card) || isCardActionLike(card));
}

function buildCashOutTreasureOptions(state: SmashUpCore, playerId: string) {
    return getCashOutPlayableTreasureCards(state, playerId).map(card => ({
        id: `treasure-hand-${card.uid}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: {
            cardUid: card.uid,
            defId: card.defId,
        } satisfies CashOutTreasureChoice,
        _source: 'hand' as const,
        displayMode: 'card' as const,
    }));
}

function buildCatBurglarTreasureOptions(state: SmashUpCore, playerId: string) {
    return (state.players[playerId]?.hand ?? [])
        .filter(card => isMunchkinTreasureCard(card.defId))
        .map(card => ({
            id: `treasure-hand-${card.uid}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: {
                cardUid: card.uid,
                defId: card.defId,
            } satisfies CatBurglarTreasureChoice,
            _source: 'hand' as const,
            displayMode: 'card' as const,
        }));
}

function getHandTreasureCards(state: SmashUpCore, playerId: string): CardInstance[] {
    return (state.players[playerId]?.hand ?? [])
        .filter(card => isMunchkinTreasureCard(card.defId));
}

function buildHandTreasureOptions(state: SmashUpCore, playerId: string) {
    return getHandTreasureCards(state, playerId).map(card => ({
        id: `treasure-hand-${card.uid}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: {
            cardUid: card.uid,
            defId: card.defId,
        } satisfies HandTreasureChoice,
        _source: 'hand' as const,
        displayMode: 'card' as const,
    }));
}

function getSelectedHandTreasureCards(
    state: SmashUpCore,
    playerId: string,
    value: unknown,
    requiredCount: number,
): CardInstance[] | undefined {
    const selected = (Array.isArray(value) ? value : [value]) as HandTreasureChoice[];
    const selectedCardUids = [...new Set(selected
        .map(choice => choice?.cardUid)
        .filter((cardUid): cardUid is string => typeof cardUid === 'string'))];
    if (selectedCardUids.length !== requiredCount) return undefined;

    const handTreasures = getHandTreasureCards(state, playerId);
    const selectedTreasures = selectedCardUids
        .map(cardUid => handTreasures.find(card => card.uid === cardUid))
        .filter((card): card is CardInstance => card !== undefined);
    return selectedTreasures.length === requiredCount ? selectedTreasures : undefined;
}

function buildDiscardTreasureCostEvent(
    playerId: string,
    selectedCards: CardInstance[],
    timestamp: number,
): SmashUpEvent {
    return {
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: {
            playerId,
            cardUids: selectedCards.map(card => card.uid),
        },
        timestamp,
    };
}

function buildVpAwardedEvent(
    playerId: string,
    amount: number,
    reason: string,
    timestamp: number,
): SmashUpEvent {
    return {
        type: SU_EVENTS.VP_AWARDED,
        payload: { playerId, amount, reason },
        timestamp,
    };
}

function isActionInPlayerDiscard(
    state: SmashUpCore,
    playerId: string,
    sourceCardUid: string | undefined,
    defId: string,
): boolean {
    if (!sourceCardUid) return false;
    return state.players[playerId]?.discard.some(card =>
        card.uid === sourceCardUid
        && card.defId === defId
    ) ?? false;
}

function buildThievesBackstabMinionOptions(state: SmashUpCore, playerId: string) {
    const candidates = state.bases.flatMap((base, baseIndex) => {
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        return base.minions
            .filter(minion => getEffectivePower(state, minion, baseIndex) <= 3)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId}（${baseName}）`,
            }));
    });

    return buildActionMinionTargetOptions(candidates, {
        state,
        sourcePlayerId: playerId,
        sourceDefId: THIEVES_BACKSTAB,
        effectType: 'destroy',
    });
}

function findMinionChoiceTarget(
    state: SmashUpCore,
    choice: BackstabMinionChoice | undefined,
): { minion: MinionOnBase; baseIndex: number } | undefined {
    const targetMinionUid = typeof choice?.minionUid === 'string' ? choice.minionUid : undefined;
    const targetBaseIndex = typeof choice?.baseIndex === 'number' ? choice.baseIndex : undefined;
    if (!targetMinionUid || targetBaseIndex === undefined) return undefined;
    const minion = state.bases[targetBaseIndex]?.minions.find(candidate => candidate.uid === targetMinionUid);
    return minion ? { minion, baseIndex: targetBaseIndex } : undefined;
}

function getSmashUpCardName(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function getSmashUpBaseName(defId: string, baseIndex: number): string {
    return getBaseDef(defId)?.name ?? `基地 ${baseIndex + 1}`;
}

function hasPlayerMinionAtBase(state: SmashUpCore, playerId: string, baseIndex: number | undefined): boolean {
    return baseIndex !== undefined
        && (state.bases[baseIndex]?.minions.some(minion => minion.controller === playerId) ?? false);
}

function getCleverDistractionWinnerIds(state: SmashUpCore, baseIndex: number | undefined): string[] {
    if (baseIndex === undefined) return [];
    const base = state.bases[baseIndex];
    if (!base) return [];
    const contenders = Array.from(new Set(base.minions.map(minion => minion.controller)));
    if (contenders.length === 0) return [];
    const powers = contenders.map(playerId => ({
        playerId,
        power: getPlayerEffectivePowerOnBase(state, base, baseIndex, playerId),
    }));
    const maxPower = Math.max(...powers.map(entry => entry.power));
    return powers
        .filter(entry => entry.power === maxPower)
        .map(entry => entry.playerId);
}

function buildCleverDistractionEvents(
    state: SmashUpCore,
    playerId: string,
    baseIndex: number | undefined,
    timestamp: number,
): SmashUpEvent[] {
    if (!hasPlayerMinionAtBase(state, playerId, baseIndex)) return [];
    const winnerIds = getCleverDistractionWinnerIds(state, baseIndex);
    if (winnerIds.length === 0) return [];

    return [
        ...winnerIds.map(winnerId =>
            buildVpAwardedEvent(winnerId, -1, THIEVES_CLEVER_DISTRACTION, timestamp),
        ),
        buildVpAwardedEvent(playerId, 1, THIEVES_CLEVER_DISTRACTION, timestamp),
    ];
}

function findAttachedActionByUid(
    state: SmashUpCore,
    cardUid: string | undefined,
): { action: MinionOnBase['attachedActions'][number]; host: MinionOnBase; baseIndex: number } | undefined {
    if (!cardUid) return undefined;
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        for (const host of state.bases[baseIndex].minions) {
            const action = host.attachedActions.find(candidate => candidate.uid === cardUid);
            if (action) return { action, host, baseIndex };
        }
    }
    return undefined;
}

function buildThievesMuggingActionOptions(state: SmashUpCore) {
    return state.bases.flatMap((base, baseIndex) => {
        const baseName = getSmashUpBaseName(base.defId, baseIndex);
        return base.minions.flatMap((minion) => {
            const minionName = getSmashUpCardName(minion.defId);
            return minion.attachedActions.map((action, index) => ({
                id: `mugging-action-${baseIndex}-${minion.uid}-${action.uid}-${index}`,
                label: `${getSmashUpCardName(action.defId)}（${minionName} / ${baseName}）`,
                value: {
                    cardUid: action.uid,
                    defId: action.defId,
                    ownerId: action.ownerId,
                    baseIndex,
                    targetMinionUid: minion.uid,
                } satisfies MuggingActionChoice,
                _source: 'field' as const,
                displayMode: 'card' as const,
            }));
        });
    });
}

function buildThievesMuggingMinionOptions(
    state: SmashUpCore,
    playerId: string,
    originalHostMinionUid?: string,
    sourceDefId: string = THIEVES_MUGGING,
) {
    const candidates = state.bases.flatMap((base, baseIndex) => {
        const baseName = getSmashUpBaseName(base.defId, baseIndex);
        return base.minions
            .filter(minion =>
                minion.controller === playerId
                && minion.uid !== originalHostMinionUid
            )
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getSmashUpCardName(minion.defId)}（${baseName}）`,
            }));
    });

    return buildActionMinionTargetOptions(candidates, {
        state,
        sourcePlayerId: playerId,
        sourceDefId,
        effectType: 'affect',
    });
}

function buildStripBareTreasureOptions(state: SmashUpCore) {
    return state.bases.flatMap((base, baseIndex) => {
        const baseName = getSmashUpBaseName(base.defId, baseIndex);
        const treasureMinions = base.minions
            .filter(minion => isMunchkinTreasureCard(minion.defId))
            .map((minion) => ({
                id: `strip-bare-minion-${baseIndex}-${minion.uid}`,
                label: `${getSmashUpCardName(minion.defId)}（${baseName}）`,
                value: {
                    cardUid: minion.uid,
                    defId: minion.defId,
                    ownerId: minion.owner,
                    baseIndex,
                    targetType: 'minion' as const,
                } satisfies StripBareTreasureChoice,
                _source: 'field' as const,
                displayMode: 'card' as const,
            }));
        const treasureOngoingActions = base.ongoingActions
            .filter(action => isMunchkinTreasureCard(action.defId))
            .map((action) => ({
                id: `strip-bare-base-action-${baseIndex}-${action.uid}`,
                label: `${getSmashUpCardName(action.defId)}（${baseName}）`,
                value: {
                    cardUid: action.uid,
                    defId: action.defId,
                    ownerId: action.ownerId,
                    baseIndex,
                    targetType: 'base' as const,
                } satisfies StripBareTreasureChoice,
                _source: 'field' as const,
                displayMode: 'card' as const,
            }));
        const treasureAttachedActions = base.minions.flatMap((minion) => {
            const minionName = getSmashUpCardName(minion.defId);
            return minion.attachedActions
                .filter(action => isMunchkinTreasureCard(action.defId))
                .map((action) => ({
                    id: `strip-bare-attached-action-${baseIndex}-${minion.uid}-${action.uid}`,
                    label: `${getSmashUpCardName(action.defId)}（${minionName} / ${baseName}）`,
                    value: {
                        cardUid: action.uid,
                        defId: action.defId,
                        ownerId: action.ownerId,
                        baseIndex,
                        targetType: 'attachedAction' as const,
                        targetMinionUid: minion.uid,
                    } satisfies StripBareTreasureChoice,
                    _source: 'field' as const,
                    displayMode: 'card' as const,
                }));
        });
        return [
            ...treasureMinions,
            ...treasureOngoingActions,
            ...treasureAttachedActions,
        ];
    });
}

function findStripBareTreasureTarget(
    state: SmashUpCore,
    choice: StripBareTreasureChoice | undefined,
): StripBareTreasureChoice | undefined {
    const cardUid = typeof choice?.cardUid === 'string' ? choice.cardUid : undefined;
    const defId = typeof choice?.defId === 'string' ? choice.defId : undefined;
    const ownerId = typeof choice?.ownerId === 'string' ? choice.ownerId : undefined;
    const baseIndex = typeof choice?.baseIndex === 'number' ? choice.baseIndex : undefined;
    if (!cardUid || !defId || !ownerId || baseIndex === undefined || !isMunchkinTreasureCard(defId)) {
        return undefined;
    }

    const base = state.bases[baseIndex];
    if (!base) return undefined;
    if (choice?.targetType === 'minion') {
        const minion = base.minions.find(candidate =>
            candidate.uid === cardUid
            && candidate.defId === defId
            && candidate.owner === ownerId
            && isMunchkinTreasureCard(candidate.defId)
        );
        return minion ? { cardUid, defId, ownerId, baseIndex, targetType: 'minion' } : undefined;
    }
    if (choice?.targetType === 'base') {
        const ongoing = base.ongoingActions.find(candidate =>
            candidate.uid === cardUid
            && candidate.defId === defId
            && candidate.ownerId === ownerId
            && isMunchkinTreasureCard(candidate.defId)
        );
        return ongoing ? { cardUid, defId, ownerId, baseIndex, targetType: 'base' } : undefined;
    }
    if (choice?.targetType === 'attachedAction') {
        const targetMinionUid = typeof choice.targetMinionUid === 'string' ? choice.targetMinionUid : undefined;
        const host = base.minions.find(candidate => candidate.uid === targetMinionUid);
        const attached = host?.attachedActions.find(candidate =>
            candidate.uid === cardUid
            && candidate.defId === defId
            && candidate.ownerId === ownerId
            && isMunchkinTreasureCard(candidate.defId)
        );
        return attached ? { cardUid, defId, ownerId, baseIndex, targetType: 'attachedAction', targetMinionUid } : undefined;
    }

    return undefined;
}

function buildMineTreasureHostOptions(state: SmashUpCore, playerId: string) {
    const ownMinions = state.bases.flatMap((base, baseIndex) => {
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        return base.minions
            .filter(minion => minion.controller === playerId)
            .map(minion => ({
                baseIndex,
                baseName,
                minion,
                minionName: getCardDef(minion.defId)?.name ?? minion.defId,
            }));
    });
    if (ownMinions.length === 0) return [];

    return (state.treasureDeck ?? [])
        .map((defId, deckIndex) => ({ defId, deckIndex }))
        .filter(({ defId }) => isMunchkinTreasureAttachableToMinion(defId))
        .flatMap(({ defId, deckIndex }) => {
            return ownMinions.map(({ baseIndex, baseName, minion, minionName }) => ({
                id: `treasure-deck-${deckIndex}-${defId}-to-${minion.uid}`,
                label: `给 ${minionName}（${baseName}）`,
                value: {
                    treasureDefId: defId,
                    deckIndex,
                    targetBaseIndex: baseIndex,
                    targetMinionUid: minion.uid,
                    targetMinionDefId: minion.defId,
                } satisfies MineTreasureHostChoice,
                displayCard: { defId },
                _source: 'deck' as const,
                displayMode: 'card' as const,
            }));
        });
}

function buildSalvageTreasureHostOptions(
    state: SmashUpCore,
    playerId: string,
    baseIndex: number | undefined,
) {
    if (baseIndex === undefined) return [];
    const base = state.bases[baseIndex];
    if (!base) return [];

    const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
    const ownMinions = base.minions
        .filter(minion => minion.controller === playerId)
        .map(minion => ({
            baseIndex,
            baseName,
            minion,
            minionName: getCardDef(minion.defId)?.name ?? minion.defId,
        }));
    if (ownMinions.length === 0) return [];

    return (state.treasureDiscard ?? [])
        .map((defId, discardIndex) => ({ defId, discardIndex }))
        .filter(({ defId }) => isMunchkinTreasureAttachableToMinion(defId))
        .flatMap(({ defId, discardIndex }) => {
            return ownMinions.map(({ baseIndex: targetBaseIndex, baseName: targetBaseName, minion, minionName }) => ({
                id: `treasure-discard-${discardIndex}-${defId}-to-${minion.uid}`,
                label: `给 ${minionName}（${targetBaseName}）`,
                value: {
                    treasureDefId: defId,
                    discardIndex,
                    targetBaseIndex,
                    targetMinionUid: minion.uid,
                    targetMinionDefId: minion.defId,
                } satisfies SalvageTreasureHostChoice,
                displayCard: { defId },
                _source: 'field' as const,
                displayMode: 'card' as const,
            }));
        });
}

function buildGoldDiggerTreasureOptions(state: SmashUpCore) {
    return (state.treasureDiscard ?? [])
        .map((defId, discardIndex) => ({ defId, discardIndex }))
        .filter(({ defId }) => isMunchkinTreasureCard(defId))
        .map(({ defId, discardIndex }) => ({
            id: `treasure-discard-${discardIndex}-${defId}`,
            label: getCardDef(defId)?.name ?? defId,
            value: {
                treasureDefId: defId,
                discardIndex,
            } satisfies GoldDiggerTreasureChoice,
            _source: 'field' as const,
            displayMode: 'card' as const,
        }));
}

function buildGreedIsGoodTreasureOptions(state: SmashUpCore) {
    return [
        {
            id: 'draw-treasure',
            label: '抽一张宝藏牌',
            labelKey: 'ui.munchkin_greed_is_good_draw_treasure_option',
            value: { mode: 'draw' } satisfies GreedIsGoodTreasureChoice,
            displayMode: 'button' as const,
        },
        ...buildGoldDiggerTreasureOptions(state).map((option) => ({
            ...option,
            id: `recover-${option.id}`,
            value: {
                mode: 'recover' as const,
                treasureDefId: option.value.treasureDefId,
                discardIndex: option.value.discardIndex,
            } satisfies GreedIsGoodTreasureChoice,
        })),
    ];
}

function goldDiggerValidateUse(ctx: AbilityContext): string | null {
    return buildGoldDiggerTreasureOptions(ctx.state).length > 0
        ? null
        : '当前没有可选择的宝藏牌';
}

function goldDiggerTalent(ctx: AbilityContext): AbilityResult {
    const options = buildGoldDiggerTreasureOptions(ctx.state);
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }

    const interaction = createSimpleChoice<GoldDiggerTreasureChoice>(
        `${DWARVES_GOLD_DIGGER_CHOOSE_TREASURE_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '黄金挖掘者：选择宝藏弃牌',
        options,
        {
            sourceId: 'munchkin_dwarves_gold_digger_choose_treasure',
            targetType: 'card',
            titleKey: 'ui.munchkin_gold_digger_choose_treasure_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            displayCard: { defId: DWARVES_GOLD_DIGGER, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildGoldDiggerTreasureOptions(latestState.core as SmashUpCore);

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceMinionUid: ctx.cardUid,
                sourceBaseIndex: ctx.baseIndex,
            },
        }),
    };
}

function masterThiefTalent(ctx: AbilityContext): AbilityResult {
    return { events: [drawMunchkinTreasures(ctx, 1, THIEVES_MASTER_THIEF)] };
}

function swipeOnPlay(ctx: AbilityContext): AbilityResult {
    return { events: [drawMunchkinTreasures(ctx, 1, THIEVES_SWIPE)] };
}

function pickpocketOnPlay(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    const hasAnotherPickpocket = base?.minions.some(minion =>
        minion.uid !== ctx.cardUid
        && minion.defId === THIEVES_PICKPOCKET
    ) ?? false;

    return hasAnotherPickpocket
        ? { events: [drawMunchkinTreasures(ctx, 1, THIEVES_PICKPOCKET)] }
        : { events: [] };
}

function fenceValidateUse(ctx: AbilityContext): string | null {
    return getHandTreasureCards(ctx.state, ctx.playerId).length >= 2
        ? null
        : '你需要至少两张手牌宝藏牌';
}

function fenceTalent(ctx: AbilityContext): AbilityResult {
    const options = buildHandTreasureOptions(ctx.state, ctx.playerId);
    if (options.length < 2) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }

    const interaction = createSimpleChoice<HandTreasureChoice>(
        `${THIEVES_FENCE_CHOOSE_TREASURES_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '销赃犯：选择两张宝藏牌弃掉',
        options,
        {
            sourceId: 'munchkin_thieves_fence_choose_treasures',
            targetType: 'hand',
            titleKey: 'ui.munchkin_thieves_fence_choose_treasures_title',
            responseValidationMode: 'live',
            autoRefresh: 'hand',
            multi: { min: 2, max: 2 },
            displayCard: { defId: THIEVES_FENCE, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildHandTreasureOptions(latestState.core as SmashUpCore, ctx.playerId);

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceMinionUid: ctx.cardUid,
                sourceBaseIndex: ctx.baseIndex,
            },
        }),
    };
}

function backstabOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildHandTreasureOptions(ctx.state, ctx.playerId);
    const targetOptions = buildThievesBackstabMinionOptions(ctx.state, ctx.playerId);
    if (options.length === 0 || targetOptions.length === 0) {
        return { events: [] };
    }

    const interaction = createSimpleChoice<HandTreasureChoice>(
        `${THIEVES_BACKSTAB_CHOOSE_TREASURE_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '背刺：选择一张宝藏牌弃掉',
        options,
        {
            sourceId: 'munchkin_thieves_backstab_choose_treasure',
            targetType: 'hand',
            titleKey: 'ui.munchkin_thieves_backstab_choose_treasure_title',
            responseValidationMode: 'live',
            autoRefresh: 'hand',
            multi: { min: 1, max: 1 },
            displayCard: { defId: THIEVES_BACKSTAB, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildHandTreasureOptions(latestState.core as SmashUpCore, ctx.playerId);

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceCardUid: ctx.cardUid,
                sourcePlayerId: ctx.playerId,
            },
        }),
    };
}

function potionBandolierOnPlay(ctx: AbilityContext): AbilityResult {
    const targetBaseIndex = ctx.targetBaseIndex;
    const targetMinionUid = ctx.targetMinionUid;
    const target = targetBaseIndex === undefined
        ? undefined
        : ctx.state.bases[targetBaseIndex]?.minions.find(minion => minion.uid === targetMinionUid);
    const options = buildHandTreasureOptions(ctx.state, ctx.playerId);
    if (!target || options.length === 0) {
        return { events: [] };
    }

    const interaction = createSimpleChoice<HandTreasureChoice>(
        `${THIEVES_POTION_BANDOLIER_CHOOSE_TREASURE_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '药水腰带：选择一张宝藏牌弃掉',
        options,
        {
            sourceId: 'munchkin_thieves_potion_bandolier_choose_treasure',
            targetType: 'hand',
            titleKey: 'ui.munchkin_thieves_potion_bandolier_choose_treasure_title',
            responseValidationMode: 'live',
            autoRefresh: 'hand',
            multi: { min: 1, max: 1 },
            displayCard: { defId: THIEVES_POTION_BANDOLIER, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildHandTreasureOptions(latestState.core as SmashUpCore, ctx.playerId);

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceCardUid: ctx.cardUid,
                sourcePlayerId: ctx.playerId,
                targetMinionUid,
                targetBaseIndex,
            },
        }),
    };
}

function smugglingOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildHandTreasureOptions(ctx.state, ctx.playerId);
    if (options.length < 2) {
        return { events: [] };
    }

    const interaction = createSimpleChoice<HandTreasureChoice>(
        `${THIEVES_SMUGGLING_CHOOSE_TREASURES_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '走私：选择两张宝藏牌弃掉',
        options,
        {
            sourceId: 'munchkin_thieves_smuggling_choose_treasures',
            targetType: 'hand',
            titleKey: 'ui.munchkin_thieves_smuggling_choose_treasures_title',
            responseValidationMode: 'live',
            autoRefresh: 'hand',
            multi: { min: 2, max: 2 },
            displayCard: { defId: THIEVES_SMUGGLING, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildHandTreasureOptions(latestState.core as SmashUpCore, ctx.playerId);

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceCardUid: ctx.cardUid,
                sourcePlayerId: ctx.playerId,
            },
        }),
    };
}

function catBurglarOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildCatBurglarTreasureOptions(ctx.state, ctx.playerId);
    if (options.length === 0) {
        return { events: [] };
    }

    const interaction = createSimpleChoice<CatBurglarTreasureChoice>(
        `${THIEVES_CAT_BURGLAR_CHOOSE_TREASURES_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '猫咪窃贼：展示任意数量的宝藏牌',
        options,
        {
            sourceId: THIEVES_CAT_BURGLAR_CHOOSE_TREASURES_SOURCE_ID,
            targetType: 'hand',
            titleKey: 'ui.munchkin_cat_burglar_choose_treasures_title',
            responseValidationMode: 'live',
            autoRefresh: 'hand',
            multi: { min: 0, max: options.length },
            displayCard: { defId: THIEVES_CAT_BURGLAR, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildCatBurglarTreasureOptions(latestState.core as SmashUpCore, ctx.playerId);

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceMinionUid: ctx.cardUid,
                sourceBaseIndex: ctx.baseIndex,
            },
        }),
    };
}

function cleverDistractionValidateUse(ctx: AbilityContext): string | null {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    if (!hasPlayerMinionAtBase(ctx.state, ctx.playerId, baseIndex)) {
        return '你必须在该计分基地有一个仆从';
    }
    if (getCleverDistractionWinnerIds(ctx.state, baseIndex).length === 0) {
        return '该基地没有可结算的赢家';
    }
    return null;
}

function cleverDistractionSpecial(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    return {
        events: buildCleverDistractionEvents(ctx.state, ctx.playerId, baseIndex, ctx.now),
    };
}

function muggingOnPlay(ctx: AbilityContext): AbilityResult {
    const actionOptions = buildThievesMuggingActionOptions(ctx.state);
    const hasOwnMinion = ctx.state.bases.some(base =>
        base.minions.some(minion => minion.controller === ctx.playerId),
    );
    if (actionOptions.length === 0 || !hasOwnMinion) {
        return { events: [] };
    }

    const interaction = createSimpleChoice<MuggingActionChoice>(
        `${THIEVES_MUGGING_CHOOSE_ACTION_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '打劫：选择一个打出到仆从身上的行动',
        actionOptions,
        {
            sourceId: 'munchkin_thieves_mugging_choose_action',
            targetType: 'ongoing',
            titleKey: 'ui.munchkin_thieves_mugging_choose_action_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            displayCard: { defId: THIEVES_MUGGING, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildThievesMuggingActionOptions(latestState.core as SmashUpCore);

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceCardUid: ctx.cardUid,
                sourcePlayerId: ctx.playerId,
            },
        }),
    };
}

function stripBareOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildStripBareTreasureOptions(ctx.state);
    if (options.length === 0) {
        return { events: [] };
    }

    const interaction = createSimpleChoice<StripBareTreasureChoice>(
        `${THIEVES_STRIP_BARE_CHOOSE_TREASURE_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '剥光：选择场上的一张宝藏牌',
        options,
        {
            sourceId: 'munchkin_thieves_strip_bare_choose_treasure',
            targetType: 'board',
            titleKey: 'ui.munchkin_thieves_strip_bare_choose_treasure_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            displayCard: { defId: THIEVES_STRIP_BARE, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildStripBareTreasureOptions(latestState.core as SmashUpCore);

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceCardUid: ctx.cardUid,
                sourcePlayerId: ctx.playerId,
            },
        }),
    };
}

function cleverDistractionAfterScoringTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const baseIndex = ctx.baseIndex;
    if (baseIndex === undefined) return [];
    const armedEntries = (ctx.state.pendingAfterScoringSpecials ?? []).filter(entry =>
        entry.sourceDefId === THIEVES_CLEVER_DISTRACTION
        && entry.baseIndex === baseIndex
    );
    if (armedEntries.length === 0) return [];

    const events: SmashUpEvent[] = [];
    for (const entry of armedEntries) {
        events.push({
            type: SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED,
            payload: {
                sourceDefId: entry.sourceDefId,
                playerId: entry.playerId,
                baseIndex: entry.baseIndex,
                cardUid: entry.cardUid,
            },
            timestamp: ctx.now,
        } as SmashUpEvent);
        events.push(...buildCleverDistractionEvents(ctx.state, entry.playerId, baseIndex, ctx.now));
    }
    return events;
}

function theCoffersAfterScoring(ctx: BaseAbilityContext): BaseAbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const playerIds = Array.from(new Set(base.minions.map(minion => minion.controller)));
    return {
        events: playerIds.map(playerId => ({
            type: SU_EVENTS.MUNCHKIN_TREASURES_DRAWN,
            payload: {
                playerId,
                count: 1,
                reason: BASE_THE_COFFERS,
                sourcePlayerId: playerId,
                sourceDefId: BASE_THE_COFFERS,
                sourceControllerId: playerId,
                sourceBaseIndex: ctx.baseIndex,
            },
            timestamp: ctx.now,
        } as SmashUpEvent)),
    };
}

function theCoffersCanTrigger(ctx: BaseAbilityContext): boolean {
    return (ctx.state.bases[ctx.baseIndex]?.minions.length ?? 0) > 0;
}

function thievesGuildOnActionPlayed(ctx: BaseAbilityContext): BaseAbilityResult {
    if (ctx.actionTargetBaseIndex !== ctx.baseIndex) return { events: [] };
    if (ctx.actionTargetType !== 'base' && ctx.actionTargetType !== 'minion') return { events: [] };
    const triggerDef = ctx.triggerCardDefId ? getCardDef(ctx.triggerCardDefId) : undefined;
    if (triggerDef?.type !== 'action' || triggerDef.faction !== MUNCHKIN_TREASURE_FACTION_ID) {
        return { events: [] };
    }
    return {
        events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
    };
}

function thievesGuildCanTrigger(ctx: BaseAbilityContext): boolean {
    if (ctx.actionTargetBaseIndex !== ctx.baseIndex) return false;
    if (ctx.actionTargetType !== 'base' && ctx.actionTargetType !== 'minion') return false;
    const triggerDef = ctx.triggerCardDefId ? getCardDef(ctx.triggerCardDefId) : undefined;
    return triggerDef?.type === 'action' && triggerDef.faction === MUNCHKIN_TREASURE_FACTION_ID;
}

function anythingForMoneyOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildAnythingForMoneyDiscardOptions(ctx.state, ctx.playerId, ctx.cardUid);
    if (options.length === 0) {
        return { events: [] };
    }

    const interaction = createSimpleChoice<AnythingForMoneyDiscardChoice>(
        `${DWARVES_ANYTHING_FOR_MONEY_DISCARD_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '为了钱什么都可以：选择任意数量手牌弃掉',
        options,
        {
            sourceId: 'munchkin_dwarves_anything_for_money_discard',
            targetType: 'hand',
            titleKey: 'ui.munchkin_anything_for_money_discard_title',
            responseValidationMode: 'live',
            autoRefresh: 'hand',
            multi: { min: 0, max: options.length },
            displayCard: { defId: DWARVES_ANYTHING_FOR_MONEY, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState, data) => {
        const sourceCardUid = typeof (data as AnythingForMoneyInteractionData).sourceCardUid === 'string'
            ? (data as AnythingForMoneyInteractionData).sourceCardUid
            : undefined;
        return buildAnythingForMoneyDiscardOptions(
            latestState.core as SmashUpCore,
            ctx.playerId,
            sourceCardUid,
        );
    };

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceCardUid: ctx.cardUid,
                sourcePlayerId: ctx.playerId,
            },
        }),
    };
}

function cashOutOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildCashOutTreasureOptions(ctx.state, ctx.playerId);
    if (options.length === 0) {
        return { events: [] };
    }

    const interaction = createSimpleChoice<CashOutTreasureChoice>(
        `${DWARVES_CASH_OUT_CHOOSE_TREASURES_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '套现：选择至多三张宝藏牌作为额外的牌打出',
        options,
        {
            sourceId: 'munchkin_dwarves_cash_out_choose_treasures',
            targetType: 'hand',
            titleKey: 'ui.munchkin_cash_out_choose_treasures_title',
            responseValidationMode: 'live',
            autoRefresh: 'hand',
            multi: { min: 0, max: Math.min(3, options.length) },
            displayCard: { defId: DWARVES_CASH_OUT, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildCashOutTreasureOptions(latestState.core as SmashUpCore, ctx.playerId);

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceCardUid: ctx.cardUid,
                sourcePlayerId: ctx.playerId,
            },
        }),
    };
}

function cunningPlanSpecial(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const cardInHand = player?.hand.find(card =>
        card.uid === ctx.cardUid
        && card.defId === DWARVES_CUNNING_PLAN
    );
    if (!cardInHand) {
        return { events: [] };
    }

    const events: SmashUpEvent[] = [
        buildActionPlayedEvent({
            playerId: ctx.playerId,
            cardUid: ctx.cardUid,
            defId: DWARVES_CUNNING_PLAN,
            ownerId: cardInHand.owner,
            timestamp: ctx.now,
        }),
    ];

    const topTreasureDefId = ctx.state.treasureDeck?.[0];
    if (!topTreasureDefId || !isMunchkinTreasureCard(topTreasureDefId)) {
        return { events };
    }

    const treasureUid = getNextMunchkinTreasureUid(ctx.state);
    events.push(drawMunchkinTreasures(ctx, 1, DWARVES_CUNNING_PLAN, [treasureUid]));
    const immediatePlayEvent = buildImmediatePlayDrawnTreasureEvent(
        ctx.playerId,
        treasureUid,
        topTreasureDefId,
        DWARVES_CUNNING_PLAN,
        ctx.now,
    );
    if (immediatePlayEvent) {
        events.push(immediatePlayEvent);
    }

    return { events };
}

function greedIsGoodOnPlay(ctx: AbilityContext): AbilityResult {
    if (buildGoldDiggerTreasureOptions(ctx.state).length === 0) {
        return {
            events: [
                drawMunchkinTreasures(ctx, 1, DWARVES_GREED_IS_GOOD),
                grantExtraAction(ctx.playerId, DWARVES_GREED_IS_GOOD, ctx.now),
            ],
        };
    }

    const interaction = createSimpleChoice<GreedIsGoodTreasureChoice>(
        `${DWARVES_GREED_IS_GOOD_CHOOSE_TREASURE_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '贪婪是好的：选择抽宝藏或回收宝藏弃牌',
        buildGreedIsGoodTreasureOptions(ctx.state),
        {
            sourceId: 'munchkin_dwarves_greed_is_good_choose_treasure',
            targetType: 'card',
            titleKey: 'ui.munchkin_greed_is_good_choose_treasure_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            displayCard: { defId: DWARVES_GREED_IS_GOOD, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildGreedIsGoodTreasureOptions(latestState.core as SmashUpCore);

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceCardUid: ctx.cardUid,
                sourcePlayerId: ctx.playerId,
            },
        }),
    };
}

function mineOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildMineTreasureHostOptions(ctx.state, ctx.playerId);
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }

    const interaction = createSimpleChoice<MineTreasureHostChoice>(
        `${DWARVES_MINE_CHOOSE_TREASURE_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '我的！：选择宝藏和宿主',
        options,
        {
            sourceId: 'munchkin_dwarves_mine_choose_treasure',
            targetType: 'generic',
            titleKey: 'ui.munchkin_mine_choose_treasure_title',
            responseValidationMode: 'live',
            autoRefresh: 'deck',
            displayCard: { defId: DWARVES_MINE, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildMineTreasureHostOptions(latestState.core as SmashUpCore, ctx.playerId);

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceCardUid: ctx.cardUid,
                sourcePlayerId: ctx.playerId,
            },
        }),
    };
}

function salvageValidateUse(ctx: AbilityContext): string | null {
    return buildSalvageTreasureHostOptions(ctx.state, ctx.playerId, ctx.baseIndex).length > 0
        ? null
        : '当前没有可打捞的宝藏或宿主';
}

function salvageSpecial(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const cardInHand = player?.hand.find(card =>
        card.uid === ctx.cardUid
        && card.defId === DWARVES_SALVAGE
    );
    if (!cardInHand || ctx.baseIndex === undefined) {
        return { events: [] };
    }

    const options = buildSalvageTreasureHostOptions(ctx.state, ctx.playerId, ctx.baseIndex);
    const events: SmashUpEvent[] = [
        buildActionPlayedEvent({
            playerId: ctx.playerId,
            cardUid: ctx.cardUid,
            defId: DWARVES_SALVAGE,
            ownerId: cardInHand.owner,
            targetBaseIndex: ctx.baseIndex,
            timestamp: ctx.now,
        }),
    ];

    if (options.length === 0) {
        return { events };
    }

    const interaction = createSimpleChoice<SalvageTreasureHostChoice>(
        `${DWARVES_SALVAGE_CHOOSE_TREASURE_SOURCE_ID}_${ctx.cardUid}_${ctx.baseIndex}_${ctx.now}`,
        ctx.playerId,
        '打捞：选择宝藏和当前基地宿主',
        options,
        {
            sourceId: 'munchkin_dwarves_salvage_choose_treasure',
            targetType: 'generic',
            titleKey: 'ui.munchkin_salvage_choose_treasure_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            displayCard: { defId: DWARVES_SALVAGE, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildSalvageTreasureHostOptions(latestState.core as SmashUpCore, ctx.playerId, ctx.baseIndex);

    return {
        events,
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceCardUid: ctx.cardUid,
                sourcePlayerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            },
        }),
    };
}

function noMyPreciousOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildAttachedActionOptions(ctx.state);
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }

    const interaction = createSimpleChoice<DungeonRulebookOngoingChoice>(
        `${DWARVES_NO_MY_PRECIOUS_DESTROY_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '不！我的宝贝！：选择仆从身上的行动',
        options,
        {
            sourceId: 'munchkin_dwarves_no_my_precious_destroy',
            targetType: 'ongoing',
            titleKey: 'ui.munchkin_no_my_precious_destroy_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            displayCard: { defId: DWARVES_NO_MY_PRECIOUS, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildAttachedActionOptions(latestState.core as SmashUpCore);

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceCardUid: ctx.cardUid,
            },
        }),
    };
}

function buildHalitosisPlayerOptions(state: SmashUpCore, baseIndex: number) {
    const base = state.bases[baseIndex];
    if (!base || state.bases.length < 2) return [];

    return Object.keys(state.players)
        .filter(playerId => base.minions.some(minion => minion.controller === playerId))
        .map(playerId => ({
            id: `player-${playerId}`,
            label: `玩家 ${playerId}`,
            value: { playerId },
            displayMode: 'button' as const,
        }));
}

function buildHalitosisMoveOptions(state: SmashUpCore, baseIndex: number, selectedPlayerId: string) {
    const sourceBase = state.bases[baseIndex];
    if (!sourceBase) return [];

    return sourceBase.minions
        .filter(minion => minion.controller === selectedPlayerId)
        .flatMap(minion => {
            const minionName = getCardDef(minion.defId)?.name ?? minion.defId;
            return state.bases
                .map((base, toBaseIndex) => ({ base, toBaseIndex }))
                .filter(candidate => candidate.toBaseIndex !== baseIndex)
                .map(candidate => {
                    const destinationName = getBaseDef(candidate.base.defId)?.name ?? candidate.base.defId;
                    return {
                        id: `move-${minion.uid}-to-${candidate.toBaseIndex}`,
                        label: `${minionName} → ${destinationName}`,
                        value: {
                            minionUid: minion.uid,
                            minionDefId: minion.defId,
                            fromBaseIndex: baseIndex,
                            toBaseIndex: candidate.toBaseIndex,
                            toBaseDefId: candidate.base.defId,
                        } satisfies HalitosisMoveChoice,
                        _source: 'field' as const,
                        displayMode: 'card' as const,
                    };
                });
        });
}

function createHalitosisMovePrompt(
    state: SmashUpCore,
    selectedPlayerId: string,
    targetBaseIndex: number,
    sourcePlayerId: string,
    sourceCardUid: string,
    now: number,
) {
    const options = buildHalitosisMoveOptions(state, targetBaseIndex, selectedPlayerId);
    if (options.length === 0) return undefined;

    const interaction = createSimpleChoice<HalitosisMoveChoice>(
        `${POTION_OF_HALITOSIS_MOVE_SOURCE_ID}_${sourceCardUid}_${selectedPlayerId}_${now}`,
        selectedPlayerId,
        '口臭药水：选择要移动的仆从',
        options,
        {
            sourceId: 'munchkin_treasure_potion_of_halitosis_move',
            targetType: 'minion',
            titleKey: 'ui.munchkin_halitosis_move_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            displayCard: { defId: POTION_OF_HALITOSIS, cardUid: sourceCardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildHalitosisMoveOptions(latestState.core as SmashUpCore, targetBaseIndex, selectedPlayerId);

    return {
        ...interaction,
        data: {
            ...interaction.data,
            targetBaseIndex,
            selectedPlayerId,
            sourcePlayerId,
            sourceCardUid,
        },
    };
}

function potionOfHalitosisOnPlay(ctx: AbilityContext): AbilityResult {
    const targetBaseIndex = ctx.targetBaseIndex;
    if (targetBaseIndex === undefined || !ctx.state.bases[targetBaseIndex]) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }

    const options = buildHalitosisPlayerOptions(ctx.state, targetBaseIndex);
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }

    const interaction = createSimpleChoice<HalitosisPlayerChoice>(
        `${POTION_OF_HALITOSIS_CHOOSE_PLAYER_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '口臭药水：选择玩家',
        options,
        {
            sourceId: 'munchkin_treasure_potion_of_halitosis_choose_player',
            targetType: 'player',
            titleKey: 'ui.munchkin_halitosis_choose_player_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            displayCard: { defId: POTION_OF_HALITOSIS, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildHalitosisPlayerOptions(latestState.core as SmashUpCore, targetBaseIndex);

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                targetBaseIndex,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
            },
        }),
    };
}

function buildStraightLineRunningAwayTreasureOptions(state: SmashUpCore) {
    return (state.pendingMunchkinTreasureReward?.treasureCards ?? []).map((card) => ({
        id: card.uid,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: {
            treasureUid: card.uid,
            treasureDefId: card.defId,
        } satisfies StraightLineRunningAwayTreasureChoice,
        _source: 'field' as const,
        displayMode: 'card' as const,
    }));
}

function potionOfStraightLineRunningAwayValidateUse(ctx: AbilityContext): string | null {
    return buildStraightLineRunningAwayTreasureOptions(ctx.state).length > 0
        ? null
        : '当前没有已展示、未分发的宝藏';
}

function potionOfStraightLineRunningAwaySpecial(ctx: AbilityContext): AbilityResult {
    const options = buildStraightLineRunningAwayTreasureOptions(ctx.state);
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }

    const interaction = createSimpleChoice<StraightLineRunningAwayTreasureChoice>(
        `${POTION_OF_STRAIGHT_LINE_RUNNING_AWAY_CHOOSE_TREASURE_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '直线跑路药水：选择一张已展示的宝藏',
        options,
        {
            sourceId: 'munchkin_treasure_potion_of_straight_line_running_away_choose_treasure',
            targetType: 'card',
            titleKey: 'ui.munchkin_straight_line_running_away_choose_treasure_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            displayCard: { defId: POTION_OF_STRAIGHT_LINE_RUNNING_AWAY, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildStraightLineRunningAwayTreasureOptions(latestState.core as SmashUpCore);

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
            },
        }),
    };
}

function getCardUidsOnBaseForParalysis(state: SmashUpCore, baseIndex: number | undefined): string[] {
    if (baseIndex === undefined) return [];
    const base = state.bases[baseIndex];
    if (!base) return [];
    const cardUids = new Set<string>();
    for (const action of base.ongoingActions ?? []) {
        cardUids.add(action.uid);
    }
    for (const minion of base.minions) {
        cardUids.add(minion.uid);
        for (const action of minion.attachedActions ?? []) {
            cardUids.add(action.uid);
        }
    }
    return Array.from(cardUids);
}

function potionOfParalysisValidateUse(ctx: AbilityContext): string | null {
    return getCardUidsOnBaseForParalysis(ctx.state, ctx.baseIndex).length > 0
        ? null
        : '当前基地上没有可取消能力的牌';
}

function potionOfParalysisSpecial(ctx: AbilityContext): AbilityResult {
    const cardUids = getCardUidsOnBaseForParalysis(ctx.state, ctx.baseIndex);
    if (cardUids.length === 0 || ctx.baseIndex === undefined) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }

    return {
        events: [{
            type: SU_EVENTS.CARDS_SUPPRESSED_UNTIL_TURN_END,
            payload: {
                cardUids,
                baseIndex: ctx.baseIndex,
                reason: POTION_OF_PARALYSIS,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: POTION_OF_PARALYSIS,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            },
            timestamp: ctx.now,
        }],
    };
}

function findPotionOfDuplicationHost(
    state: SmashUpCore,
    baseIndex: number,
    sourceCardUid: string | undefined,
): MinionOnBase | undefined {
    return findAttachedTreasureHost(state, baseIndex, sourceCardUid, POTION_OF_DUPLICATION)?.host;
}

function hasCopyableMinionTalent(state: SmashUpCore, minion: MinionOnBase): boolean {
    const def = getCardDef(minion.defId);
    return Boolean(
        def
        && 'abilityTags' in def
        && def.abilityTags?.includes('talent')
        && resolveTalent(minion.defId)
        && !isCardSuppressed(state, minion.uid)
    );
}

function buildPotionOfDuplicationTalentOptions(
    state: SmashUpCore,
    host: MinionOnBase,
) {
    return state.bases.flatMap((base, baseIndex) => {
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        return base.minions
            .filter(minion => minion.uid !== host.uid && hasCopyableMinionTalent(state, minion))
            .map(minion => ({
                id: `talent-${baseIndex}-${minion.uid}`,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId}（${baseName}）`,
                value: {
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    baseIndex,
                } satisfies DuplicationTalentChoice,
                _source: 'field' as const,
                displayMode: 'card' as const,
            }));
    });
}

function potionOfDuplicationValidateUse(ctx: AbilityContext): string | null {
    const host = findPotionOfDuplicationHost(ctx.state, ctx.baseIndex, ctx.cardUid);
    if (!host) return '当前没有可选择的目标';
    return buildPotionOfDuplicationTalentOptions(ctx.state, host).length > 0
        ? null
        : '当前没有可选择的目标';
}

function potionOfDuplicationTalent(ctx: AbilityContext): AbilityResult {
    const host = findPotionOfDuplicationHost(ctx.state, ctx.baseIndex, ctx.cardUid);
    const options = host ? buildPotionOfDuplicationTalentOptions(ctx.state, host) : [];
    if (!host || options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }

    const interaction = createSimpleChoice<DuplicationTalentChoice>(
        `${POTION_OF_DUPLICATION_CHOOSE_TALENT_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '复制药水：选择另一个仆从的天赋',
        options,
        {
            sourceId: 'munchkin_treasure_potion_of_duplication_choose_talent',
            targetType: 'minion',
            titleKey: 'ui.munchkin_potion_of_duplication_choose_talent_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            displayCard: { defId: POTION_OF_DUPLICATION, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) => {
        const liveHost = findPotionOfDuplicationHost(latestState.core as SmashUpCore, ctx.baseIndex, ctx.cardUid);
        return liveHost ? buildPotionOfDuplicationTalentOptions(latestState.core as SmashUpCore, liveHost) : [];
    };

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                hostMinionUid: host.uid,
                hostMinionDefId: host.defId,
                sourceBaseIndex: ctx.baseIndex,
                sourceCardUid: ctx.cardUid,
            },
        }),
    };
}

function potionOfCowardiceSuppression(
    state: SmashUpCore,
    turnScopedSuppressedCardUids: ReadonlySet<string>,
): string[] {
    const suppressedMinionUids = new Set<string>();
    for (const base of state.bases) {
        for (const minion of base.minions) {
            const hasActiveCowardicePotion = minion.attachedActions.some((action) => (
                action.defId === 'munchkin_treasure_potion_of_cowardice'
                && !turnScopedSuppressedCardUids.has(action.uid)
            ));
            if (hasActiveCowardicePotion) {
                suppressedMinionUids.add(minion.uid);
            }
        }
    }
    return Array.from(suppressedMinionUids);
}

function bucklerOfSwashingProtection(ctx: ProtectionCheckContext): boolean {
    const base = ctx.state.bases[ctx.targetBaseIndex];
    const targetMinion = base?.minions.find((minion) => minion.uid === ctx.targetMinion.uid);
    if (!targetMinion) return false;
    return targetMinion.attachedActions.some((action) =>
        action.defId === 'munchkin_treasure_buckler_of_swashing'
    );
}

function hasTemporalJetpackAttached(minion: MinionOnBase | undefined, sourceCardUid: string | undefined): boolean {
    if (!minion || !sourceCardUid) return false;
    return minion.attachedActions.some((action) =>
        action.uid === sourceCardUid
        && action.defId === TEMPORAL_DISPLACEMENT_JETPACK
    );
}

function findTemporalJetpackHost(ctx: TriggerContext): MinionOnBase | undefined {
    if (ctx.triggerMinion && hasTemporalJetpackAttached(ctx.triggerMinion, ctx.sourceCardUid)) {
        return ctx.triggerMinion;
    }
    if (ctx.baseIndex === undefined || !ctx.sourceCardUid) return undefined;
    return ctx.state.bases[ctx.baseIndex]?.minions.find((minion) =>
        hasTemporalJetpackAttached(minion, ctx.sourceCardUid)
    );
}

function temporalDisplacementJetpackCanTrigger(ctx: TriggerContext): boolean {
    if (!ctx.triggerMinionUid) return false;
    return findTemporalJetpackHost(ctx)?.uid === ctx.triggerMinionUid;
}

function temporalDisplacementJetpackTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!temporalDisplacementJetpackCanTrigger(ctx) || !ctx.triggerMinionUid) return [];
    const ownerId = ctx.triggerMinion?.owner
        ?? Object.values(ctx.state.players).find((player) =>
            player.discard.some((card) => card.uid === ctx.triggerMinionUid)
        )?.id;
    if (!ownerId) return [];

    const owner = ctx.state.players[ownerId];
    if (owner?.discard.some((card) => card.uid === ctx.triggerMinionUid)) {
        return [recoverCardsFromDiscard(ownerId, [ctx.triggerMinionUid], TEMPORAL_DISPLACEMENT_JETPACK, ctx.now)];
    }

    const host = findTemporalJetpackHost(ctx);
    const baseIndex = ctx.baseIndex;
    if (!host || baseIndex === undefined) return [];
    return buildValidatedReturnEvents(ctx.state, {
        minionUid: ctx.triggerMinionUid,
        minionDefId: host.defId,
        fromBaseIndex: baseIndex,
        toPlayerId: ownerId,
        reason: TEMPORAL_DISPLACEMENT_JETPACK,
        now: ctx.now,
        sourcePlayerId: ctx.sourceControllerId ?? ctx.playerId,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId: TEMPORAL_DISPLACEMENT_JETPACK,
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: ctx.sourceBaseIndex ?? baseIndex,
        sourceKind: 'action',
    });
}

function findBagOfCaltropsSource(ctx: TriggerContext) {
    if (ctx.baseIndex === undefined || !ctx.sourceCardUid) return undefined;
    return ctx.state.bases[ctx.baseIndex]?.ongoingActions.find((action) =>
        action.uid === ctx.sourceCardUid
        && action.defId === BAG_OF_CALTROPS
    );
}

function getBagOfCaltropsController(ctx: TriggerContext): string | undefined {
    const source = findBagOfCaltropsSource(ctx);
    const metadata = source?.metadata as { sourceControllerId?: string; sourcePlayerId?: string } | undefined;
    return ctx.sourceControllerId ?? metadata?.sourceControllerId ?? metadata?.sourcePlayerId ?? source?.ownerId;
}

function findTriggeredMinion(ctx: TriggerContext): MinionOnBase | undefined {
    if (!ctx.triggerMinionUid || ctx.baseIndex === undefined) return undefined;
    return ctx.state.bases[ctx.baseIndex]?.minions.find((minion) => minion.uid === ctx.triggerMinionUid)
        ?? ctx.triggerMinion;
}

function bagOfCaltropsCanTrigger(ctx: TriggerContext): boolean {
    const targetMinion = findTriggeredMinion(ctx);
    if (!targetMinion || ctx.baseIndex === undefined) return false;
    if (!findBagOfCaltropsSource(ctx)) return false;
    const sourceControllerId = getBagOfCaltropsController(ctx);
    if (!sourceControllerId || targetMinion.controller === sourceControllerId) return false;
    return getEffectivePower(ctx.state, targetMinion, ctx.baseIndex) <= 3;
}

function bagOfCaltropsTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const source = findBagOfCaltropsSource(ctx);
    const targetMinion = findTriggeredMinion(ctx);
    if (!source || !targetMinion || ctx.baseIndex === undefined) return [];
    const sourcePlayerId = ctx.sourceControllerId ?? ctx.playerId;
    return [
        ...buildValidatedOngoingDetachEvents(ctx.state, {
            cardUid: source.uid,
            defId: source.defId,
            ownerId: source.ownerId,
            expectedLocation: 'base',
            reason: BAG_OF_CALTROPS,
            now: ctx.now,
            sourcePlayerId,
            sourceCardUid: source.uid,
            sourceDefId: BAG_OF_CALTROPS,
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: ctx.sourceBaseIndex ?? ctx.baseIndex,
        }),
        ...buildValidatedDestroyEvents(ctx.state, {
            minionUid: targetMinion.uid,
            minionDefId: targetMinion.defId,
            fromBaseIndex: ctx.baseIndex,
            destroyerId: sourcePlayerId,
            reason: BAG_OF_CALTROPS,
            now: ctx.now,
            sourcePlayerId,
            sourceCardUid: source.uid,
            sourceDefId: BAG_OF_CALTROPS,
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: ctx.sourceBaseIndex ?? ctx.baseIndex,
            sourceKind: 'action',
        }),
    ];
}

function findAttachedTreasureHost(
    state: SmashUpCore,
    baseIndex: number,
    sourceCardUid: string | undefined,
    defId: string,
): AttachedTreasureHost | undefined {
    if (!sourceCardUid) return undefined;
    for (const minion of state.bases[baseIndex]?.minions ?? []) {
        const action = minion.attachedActions.find((candidate) =>
            candidate.uid === sourceCardUid
            && candidate.defId === defId
        );
        if (action) return { host: minion, action };
    }
    return undefined;
}

function findRocketBootsHost(
    state: SmashUpCore,
    baseIndex: number,
    sourceCardUid: string | undefined,
): MinionOnBase | undefined {
    return findAttachedTreasureHost(state, baseIndex, sourceCardUid, ROCKET_BOOTS)?.host;
}

function magicMissileTargetCandidates(state: SmashUpCore, baseIndex: number) {
    return (state.bases[baseIndex]?.minions ?? [])
        .filter(minion => getEffectivePower(state, minion, baseIndex) <= 3)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        }));
}

function magicMissileTargetOptions(state: SmashUpCore, baseIndex: number, sourcePlayerId: string) {
    return buildActionMinionTargetOptions(
        magicMissileTargetCandidates(state, baseIndex),
        {
            state,
            sourcePlayerId,
            sourceDefId: MAGIC_MISSILE,
            effectType: 'destroy',
        },
    );
}

function magicMissileValidateUse(ctx: AbilityContext): string | null {
    const source = findAttachedTreasureHost(ctx.state, ctx.baseIndex, ctx.cardUid, MAGIC_MISSILE);
    if (!source) return '当前没有可选择的目标';
    return magicMissileTargetOptions(ctx.state, ctx.baseIndex, ctx.playerId).length > 0
        ? null
        : '当前没有可选择的目标';
}

function magicMissileTalent(ctx: AbilityContext): AbilityResult {
    const source = findAttachedTreasureHost(ctx.state, ctx.baseIndex, ctx.cardUid, MAGIC_MISSILE);
    const options = magicMissileTargetOptions(ctx.state, ctx.baseIndex, ctx.playerId);
    if (!source || options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }

    const interaction = createSimpleChoice<MagicMissileMinionChoice>(
        `${MAGIC_MISSILE_DESTROY_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '魔法导弹：选择力量3或更少的仆从',
        options,
        {
            sourceId: 'munchkin_treasure_magic_missile_destroy',
            targetType: 'minion',
            titleKey: 'ui.munchkin_magic_missile_destroy_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            displayCard: { defId: MAGIC_MISSILE, cardUid: ctx.cardUid },
        },
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                fromBaseIndex: ctx.baseIndex,
                sourceCardUid: ctx.cardUid,
            },
        }),
    };
}

function rocketBootsDestinationCandidates(state: SmashUpCore, fromBaseIndex: number) {
    return state.bases
        .map((base, baseIndex) => ({
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? base.defId,
        }))
        .filter(candidate => candidate.baseIndex !== fromBaseIndex);
}

function rocketBootsValidateUse(ctx: AbilityContext): string | null {
    const host = findRocketBootsHost(ctx.state, ctx.baseIndex, ctx.cardUid);
    if (!host) return '当前没有可选择的目标';
    return rocketBootsDestinationCandidates(ctx.state, ctx.baseIndex).length > 0
        ? null
        : '当前没有可选择的目标';
}

function rocketBootsTalent(ctx: AbilityContext): AbilityResult {
    const host = findRocketBootsHost(ctx.state, ctx.baseIndex, ctx.cardUid);
    const candidates = rocketBootsDestinationCandidates(ctx.state, ctx.baseIndex);
    if (!host || candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }

    const interaction = createSimpleChoice<RocketBootsBaseChoice>(
        `${ROCKET_BOOTS_MOVE_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '火箭靴：选择目标基地',
        buildBaseTargetOptions(candidates, ctx.state),
        {
            sourceId: 'munchkin_treasure_rocket_boots_move',
            targetType: 'base',
            titleKey: 'ui.munchkin_rocket_boots_move_title',
            responseValidationMode: 'live',
            displayCard: { defId: ROCKET_BOOTS, cardUid: ctx.cardUid },
        },
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                minionUid: host.uid,
                minionDefId: host.defId,
                fromBaseIndex: ctx.baseIndex,
                sourceCardUid: ctx.cardUid,
            },
        }),
    };
}

export function registerMunchkinAbilities(): void {
    registerMunchkinMagesAbilities();
    registerMunchkinMagesBaseAbilities();
    registerMunchkinElvesAbilities();
    registerMunchkinElvesBaseAbilities();
    registerMunchkinClericsAbilities();
    registerMunchkinOrcsAbilities();
    registerAbility('munchkin_treasure_halfling_hireling', 'onPlay', halflingHirelingOnPlay);
    registerAbility(HALFLINGS_SHIRE_MARSHAL, 'talent', {
        execute: shireMarshalTalent,
        validateUse: shireMarshalValidateUse,
    });
    registerAbility(HALFLINGS_PESTLING, 'onPlay', pestlingExtraMinion);
    registerAbility(HALFLINGS_BARDLING, 'onPlay', bardlingExtraMinion);
    registerAbility(HALFLINGS_QUARTERLING, 'onPlay', quarterlingOnPlay);
    registerAbility(HALFLINGS_LAST_CALL, 'special', {
        execute: lastCallSpecial,
        validateUse: lastCallValidateUse,
    });
    registerAbility(HALFLINGS_OUT_OF_NOWHERE, 'onPlay', outOfNowhereOnPlay);
    registerAbility(HALFLINGS_RUDE_AWAKENING, 'onPlay', rudeAwakeningOnPlay);
    registerAbility(HALFLINGS_SPOILED_BRATS, 'onPlay', spoiledBratsOnPlay);
    registerAbility(HALFLINGS_UNEXPECTED_PARTY, 'onPlay', unexpectedPartyOnPlay);
    registerAbility(CROSSBOW, 'onPlay', crossbowOnPlay);
    registerAbility(DUNGEON_RULEBOOK, 'onPlay', dungeonRulebookOnPlay);
    registerAbility(DUNGEON_RULEBOOK, 'special', dungeonRulebookOnPlay);
    registerAbility('munchkin_treasure_potion_of_idiotic_bravery', 'onPlay', potionOfIdioticBraveryOnPlay);
    registerAbility(POTION_OF_HALITOSIS, 'onPlay', potionOfHalitosisOnPlay);
    registerAbility(POTION_OF_HALITOSIS, 'special', potionOfHalitosisOnPlay);
    registerAbility(POTION_OF_DUPLICATION, 'talent', {
        execute: potionOfDuplicationTalent,
        validateUse: potionOfDuplicationValidateUse,
    });
    registerAbility(POTION_OF_PARALYSIS, 'special', {
        execute: potionOfParalysisSpecial,
        validateUse: potionOfParalysisValidateUse,
    });
    registerAbility(POTION_OF_STRAIGHT_LINE_RUNNING_AWAY, 'special', {
        execute: potionOfStraightLineRunningAwaySpecial,
        validateUse: potionOfStraightLineRunningAwayValidateUse,
    });
    registerAbility(TREASURE_FINDER, 'onPlay', treasureFinderOnPlay);
    registerAbility(WISHING_RING, 'onPlay', wishingRingOnPlay);
    registerAbility(DWARVES_ANYTHING_FOR_MONEY, 'onPlay', anythingForMoneyOnPlay);
    registerAbility(DWARVES_GOLD_DIGGER, 'talent', {
        execute: goldDiggerTalent,
        validateUse: goldDiggerValidateUse,
    });
    registerAbility(THIEVES_MASTER_THIEF, 'talent', masterThiefTalent);
    registerAbility(THIEVES_FENCE, 'talent', {
        execute: fenceTalent,
        validateUse: fenceValidateUse,
    });
    registerAbility(THIEVES_BACKSTAB, 'onPlay', backstabOnPlay);
    registerAbility(THIEVES_CAT_BURGLAR, 'onPlay', catBurglarOnPlay);
    registerAbility(THIEVES_CLEVER_DISTRACTION, 'special', {
        execute: cleverDistractionSpecial,
        validateUse: cleverDistractionValidateUse,
    });
    registerAbility(THIEVES_MUGGING, 'onPlay', muggingOnPlay);
    registerAbility(THIEVES_PICKPOCKET, 'onPlay', pickpocketOnPlay);
    registerAbility(THIEVES_POTION_BANDOLIER, 'onPlay', potionBandolierOnPlay);
    registerAbility(THIEVES_SMUGGLING, 'onPlay', smugglingOnPlay);
    registerAbility(THIEVES_STRIP_BARE, 'onPlay', stripBareOnPlay);
    registerAbility(THIEVES_SWIPE, 'onPlay', swipeOnPlay);
    registerAbility(DWARVES_CASH_OUT, 'onPlay', cashOutOnPlay);
    registerAbility(DWARVES_CUNNING_PLAN, 'special', cunningPlanSpecial);
    registerAbility(DWARVES_GREED_IS_GOOD, 'onPlay', greedIsGoodOnPlay);
    registerAbility(DWARVES_HIDDEN_ASSETS, 'onPlay', hiddenAssetsOnPlay);
    registerAbility(DWARVES_MINE, 'onPlay', mineOnPlay);
    registerAbility(DWARVES_NO_MY_PRECIOUS, 'onPlay', noMyPreciousOnPlay);
    registerAbility(DWARVES_SALVAGE, 'special', {
        execute: salvageSpecial,
        validateUse: salvageValidateUse,
    });
    registerBaseAbility(BASE_TREASURE_BATH, 'onMinionPlayed', treasureBathOnMinionPlayed, {
        canTrigger: isFirstTreasureBathMinionPlayedByPlayerThisTurn,
    });
    registerBaseAbility(BASE_SUBTERRANEAN_LAIR, 'onTurnStart', subterraneanLairOnTurnStart, {
        canTrigger: ctx => !(ctx.state.bases[ctx.baseIndex]?.minions.some(minion => minion.controller === ctx.playerId) ?? false),
    });
    registerBaseAbility(BASE_THE_COFFERS, 'afterScoring', theCoffersAfterScoring, {
        canTrigger: theCoffersCanTrigger,
    });
    registerBaseAbility(BASE_THIEVES_GUILD, 'onActionPlayed', thievesGuildOnActionPlayed, {
        canTrigger: thievesGuildCanTrigger,
    });
    registerAbility(MAGIC_MISSILE, 'talent', {
        execute: magicMissileTalent,
        validateUse: magicMissileValidateUse,
    });
    registerAbility(ROCKET_BOOTS, 'talent', {
        execute: rocketBootsTalent,
        validateUse: rocketBootsValidateUse,
    });
    registerCardAbilitySuppression('munchkin_treasure_potion_of_cowardice', potionOfCowardiceSuppression);
    registerProtection('munchkin_treasure_buckler_of_swashing', 'destroy', bucklerOfSwashingProtection);
    registerRestriction(BASE_BIRTHDAY_PARTY, 'play_minion', birthdayPartyRestriction, { global: true });
    registerTrigger(HALFLINGS_PESTLING, 'onTurnStart', pestlingExtraMinion, {
        perInstance: true,
        mandatory: true,
        playerContext: 'sourceController',
    });
    registerTrigger(HALFLINGS_BARDLING, 'onTurnStart', bardlingExtraMinion, {
        perInstance: true,
        mandatory: true,
        playerContext: 'sourceController',
    });
    registerTrigger(HALFLINGS_LUNCH_RUN, 'onMinionPlayed', lunchRunOnMinionPlayed, {
        perInstance: true,
        mandatory: true,
        playerContext: 'sourceController',
        canTrigger: ctx => ctx.playerId === ctx.sourceControllerId
            && ctx.baseIndex === ctx.sourceBaseIndex,
    });
    registerTrigger(HALFLINGS_SMALL_BUT_TOUGH, 'onMinionDiscardedFromBase', smallButToughTrigger, {
        canTrigger: smallButToughCanTrigger,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger(THIEVES_CLEVER_DISTRACTION, 'afterScoring', cleverDistractionAfterScoringTrigger, {
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerProtection(HALFLINGS_SNEAKSY, 'action', sneaksyProtection);
    registerProtection(HALFLINGS_SNEAKSY, 'affect', sneaksyProtection);
    registerProtection(HALFLINGS_SNEAKSY, 'destroy', sneaksyProtection);
    registerProtection(HALFLINGS_SNEAKSY, 'move', sneaksyProtection);
    registerTrigger(BAG_OF_CALTROPS, 'onMinionPlayed', bagOfCaltropsTrigger, {
        canTrigger: bagOfCaltropsCanTrigger,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger(TEMPORAL_DISPLACEMENT_JETPACK, 'onMinionDiscardedFromBase', temporalDisplacementJetpackTrigger, {
        canTrigger: temporalDisplacementJetpackCanTrigger,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
}

export function registerMunchkinInteractionHandlers(): void {
    registerMunchkinMagesInteractionHandlers();
    registerMunchkinElvesInteractionHandlers();
    registerMunchkinClericsInteractionHandlers();
    registerMunchkinOrcsInteractionHandlers();
    registerInteractionHandler(HALFLINGS_SHIRE_MARSHAL_CHOOSE_BASE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as ShireMarshalBaseChoice | undefined;
        const data = interactionData as ShireMarshalInteractionData | undefined;
        const targetBaseIndex = typeof choice?.baseIndex === 'number' ? choice.baseIndex : undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourceBaseIndex = typeof data?.sourceBaseIndex === 'number' ? data.sourceBaseIndex : undefined;
        if (targetBaseIndex === undefined || !sourceCardUid || sourceBaseIndex === undefined) {
            return { state, events: [] };
        }

        const source = state.core.bases[sourceBaseIndex]?.minions.find(minion =>
            minion.uid === sourceCardUid
            && minion.defId === HALFLINGS_SHIRE_MARSHAL
            && minion.controller === playerId
        );
        if (!source || !hasOpponentMorePowerAtBase(state.core, targetBaseIndex, playerId)) {
            return { state, events: [] };
        }

        return {
            state,
            events: [grantExtraMinion(playerId, HALFLINGS_SHIRE_MARSHAL, timestamp, targetBaseIndex)],
        };
    });

    registerInteractionHandler(HALFLINGS_LAST_CALL_CHOOSE_MINION_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as HalflingHandMinionChoice | undefined;
        const data = interactionData as LastCallInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        const targetBaseIndex = typeof data?.targetBaseIndex === 'number' ? data.targetBaseIndex : undefined;
        const cardUid = typeof choice?.cardUid === 'string' ? choice.cardUid : undefined;
        const defId = typeof choice?.defId === 'string' ? choice.defId : undefined;
        if (!sourceCardUid || !sourcePlayerId || playerId !== sourcePlayerId || targetBaseIndex === undefined || !cardUid || !defId) {
            return { state, events: [] };
        }

        const player = state.core.players[sourcePlayerId];
        const card = player?.hand.find(candidate =>
            candidate.uid === cardUid
            && candidate.defId === defId
            && isCardMinionLike(candidate)
        );
        if (!card || !player?.discard.some(candidate => candidate.uid === sourceCardUid && candidate.defId === HALFLINGS_LAST_CALL)) {
            return { state, events: [] };
        }
        if (!state.core.bases[targetBaseIndex]) return { state, events: [] };

        const suppression = suppressPlayedMinionsUntilTurnEnd({
            cardUids: [card.uid],
            baseIndex: targetBaseIndex,
            reason: HALFLINGS_LAST_CALL,
            playerId: sourcePlayerId,
            sourceCardUid,
            now: timestamp,
        });

        return {
            state,
            events: [
                minionPlayedWithoutAbilityEvent({
                    playerId: sourcePlayerId,
                    cardUid: card.uid,
                    defId: card.defId,
                    ownerId: card.owner,
                    baseIndex: targetBaseIndex,
                    now: timestamp,
                }),
                ...(suppression ? [suppression] : []),
            ],
        };
    });

    registerInteractionHandler(HALFLINGS_SPOILED_BRATS_CHOOSE_MINIONS_SOURCE_ID, (state, playerId, value, interactionData, random, timestamp) => {
        const data = interactionData as SpoiledBratsInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        if (!sourceCardUid || !sourcePlayerId || playerId !== sourcePlayerId) {
            return { state, events: [] };
        }

        const player = state.core.players[sourcePlayerId];
        if (!player?.discard.some(card => card.uid === sourceCardUid && card.defId === HALFLINGS_SPOILED_BRATS)) {
            return { state, events: [] };
        }

        const selected = (Array.isArray(value) ? value : [value]) as HalflingHandMinionChoice[];
        const selectedCardUids = [...new Set(selected
            .map(choice => choice?.cardUid)
            .filter((cardUid): cardUid is string => typeof cardUid === 'string'))];
        const validSelected = selectedCardUids
            .map(cardUid => player.discard.find(card => card.uid === cardUid && isCardMinionLike(card)))
            .filter((card): card is CardInstance => Boolean(card));
        if (validSelected.length === 0) return { state, events: [] };

        const shuffledSelected = random.shuffle(validSelected);
        const deckUids = [
            ...shuffledSelected.map(card => card.uid),
            ...player.deck.map(card => card.uid),
        ];
        return {
            state,
            events: [{
                type: SU_EVENTS.DECK_REORDERED,
                payload: { playerId: sourcePlayerId, deckUids },
                timestamp,
            }],
        };
    });

    registerInteractionHandler(HALFLINGS_UNEXPECTED_PARTY_CHOOSE_BASE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as UnexpectedPartyBaseChoice | undefined;
        const data = interactionData as UnexpectedPartyInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        if (choice?.skip === true) return { state, events: [] };
        const targetBaseIndex = typeof choice?.baseIndex === 'number' ? choice.baseIndex : undefined;
        if (!sourceCardUid || !sourcePlayerId || playerId !== sourcePlayerId || targetBaseIndex === undefined) {
            return { state, events: [] };
        }

        const player = state.core.players[sourcePlayerId];
        if (!player?.discard.some(card => card.uid === sourceCardUid && card.defId === HALFLINGS_UNEXPECTED_PARTY)) {
            return { state, events: [] };
        }
        const targetBase = state.core.bases[targetBaseIndex];
        if (!targetBase || targetBase.minions.some(minion => minion.controller === sourcePlayerId)) {
            return { state, events: [] };
        }
        if (getPlayableHandMinions(state.core, sourcePlayerId).length === 0) {
            return { state, events: [] };
        }

        return {
            state,
            events: [grantExtraMinion(sourcePlayerId, HALFLINGS_UNEXPECTED_PARTY, timestamp, targetBaseIndex, { playTiming: 'immediate' })],
        };
    });

    registerInteractionHandler(DWARVES_ANYTHING_FOR_MONEY_DISCARD_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as AnythingForMoneyInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        if (!sourceCardUid || !sourcePlayerId || playerId !== sourcePlayerId) {
            return { state, events: [] };
        }

        const sourcePlayer = state.core.players[sourcePlayerId];
        if (!sourcePlayer?.discard.some(card =>
            card.uid === sourceCardUid
            && card.defId === DWARVES_ANYTHING_FOR_MONEY
        )) {
            return { state, events: [] };
        }

        const selected = (Array.isArray(value) ? value : [value]) as AnythingForMoneyDiscardChoice[];
        const selectedCardUids = [...new Set(selected
            .map(choice => choice?.cardUid)
            .filter((cardUid): cardUid is string => typeof cardUid === 'string'))];
        const discardable = getAnythingForMoneyDiscardableHandCards(state.core, playerId, sourceCardUid);
        const validSelectedCardUids = selectedCardUids
            .filter(cardUid => discardable.some(card => card.uid === cardUid));

        if (validSelectedCardUids.length === 0) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                {
                    type: SU_EVENTS.CARDS_DISCARDED,
                    payload: {
                        playerId,
                        cardUids: validSelectedCardUids,
                    },
                    timestamp,
                },
                {
                    type: SU_EVENTS.MUNCHKIN_TREASURES_DRAWN,
                    payload: {
                        playerId,
                        count: validSelectedCardUids.length,
                        reason: DWARVES_ANYTHING_FOR_MONEY,
                        sourcePlayerId: playerId,
                        sourceCardUid,
                        sourceDefId: DWARVES_ANYTHING_FOR_MONEY,
                        sourceControllerId: playerId,
                    },
                    timestamp,
                },
            ],
        };
    });

    registerInteractionHandler(CROSSBOW_CHOOSE_FACTION_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as CrossbowFactionChoice | undefined;
        const data = interactionData as CrossbowInteractionData | undefined;
        const targetBaseIndex = typeof data?.targetBaseIndex === 'number' ? data.targetBaseIndex : undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const factionId = typeof choice?.factionId === 'string' ? choice.factionId : undefined;
        if (targetBaseIndex === undefined || !factionId) return { state, events: [] };

        const selectedFactions = new Set(getSelectedFactionIds(state.core));
        if (!selectedFactions.has(factionId)) return { state, events: [] };

        const player = state.core.players[playerId];
        if (sourceCardUid && !player?.discard.some((card) => card.uid === sourceCardUid && card.defId === CROSSBOW)) {
            return { state, events: [] };
        }

        return {
            state,
            events: buildCrossbowEvents(state.core, targetBaseIndex, factionId, {
                playerId,
                cardUid: sourceCardUid,
                now: timestamp,
            }),
        };
    });

    registerInteractionHandler(DUNGEON_RULEBOOK_DESTROY_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as DungeonRulebookOngoingChoice | undefined;
        const data = interactionData as DungeonRulebookInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const targetCardUid = typeof choice?.cardUid === 'string' ? choice.cardUid : undefined;
        if (!sourceCardUid || !targetCardUid) return { state, events: [] };

        const player = state.core.players[playerId];
        if (!player?.discard.some((card) => card.uid === sourceCardUid && card.defId === DUNGEON_RULEBOOK)) {
            return { state, events: [] };
        }

        const location = findLiveOngoingCardLocation(state.core, targetCardUid);
        if (!location) return { state, events: [] };
        if (choice.defId && choice.defId !== location.defId) return { state, events: [] };
        if (choice.ownerId && choice.ownerId !== location.ownerId) return { state, events: [] };
        if (choice.baseIndex !== undefined && choice.baseIndex !== location.baseIndex) return { state, events: [] };
        if (choice.targetType && choice.targetType !== location.targetType) return { state, events: [] };
        if (choice.targetMinionUid && choice.targetMinionUid !== location.targetMinionUid) return { state, events: [] };

        return {
            state,
            events: buildValidatedOngoingDetachEvents(state.core, {
                cardUid: location.cardUid,
                defId: location.defId,
                ownerId: location.ownerId,
                expectedLocation: 'any',
                destination: 'discard',
                reason: DUNGEON_RULEBOOK,
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid,
                sourceDefId: DUNGEON_RULEBOOK,
                sourceControllerId: playerId,
            }),
        };
    });

    registerInteractionHandler(DWARVES_NO_MY_PRECIOUS_DESTROY_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as DungeonRulebookOngoingChoice | undefined;
        const data = interactionData as NoMyPreciousInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const targetCardUid = typeof choice?.cardUid === 'string' ? choice.cardUid : undefined;
        if (!sourceCardUid || !targetCardUid) return { state, events: [] };

        const player = state.core.players[playerId];
        if (!player?.discard.some((card) => card.uid === sourceCardUid && card.defId === DWARVES_NO_MY_PRECIOUS)) {
            return { state, events: [] };
        }

        const location = findLiveOngoingCardLocation(state.core, targetCardUid);
        if (!location || location.targetType !== 'minion') return { state, events: [] };
        if (choice.defId && choice.defId !== location.defId) return { state, events: [] };
        if (choice.ownerId && choice.ownerId !== location.ownerId) return { state, events: [] };
        if (choice.baseIndex !== undefined && choice.baseIndex !== location.baseIndex) return { state, events: [] };
        if (choice.targetType && choice.targetType !== location.targetType) return { state, events: [] };
        if (choice.targetMinionUid && choice.targetMinionUid !== location.targetMinionUid) return { state, events: [] };

        const detachEvents = buildValidatedOngoingDetachEvents(state.core, {
            cardUid: location.cardUid,
            defId: location.defId,
            ownerId: location.ownerId,
            expectedLocation: 'minion',
            destination: 'discard',
            reason: DWARVES_NO_MY_PRECIOUS,
            now: timestamp,
            sourcePlayerId: playerId,
            sourceCardUid,
            sourceDefId: DWARVES_NO_MY_PRECIOUS,
            sourceControllerId: playerId,
        });
        const events: SmashUpEvent[] = [...detachEvents];
        if (detachEvents.length > 0 && isMunchkinTreasureCard(location.defId)) {
            events.push(grantExtraAction(playerId, DWARVES_NO_MY_PRECIOUS, timestamp));
        }

        return { state, events };
    });

    registerInteractionHandler(POTION_OF_HALITOSIS_CHOOSE_PLAYER_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as HalitosisPlayerChoice | undefined;
        const data = interactionData as HalitosisChoosePlayerInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        const targetBaseIndex = typeof data?.targetBaseIndex === 'number' ? data.targetBaseIndex : undefined;
        const selectedPlayerId = typeof choice?.playerId === 'string' ? choice.playerId : undefined;
        if (!sourceCardUid || !sourcePlayerId || targetBaseIndex === undefined || !selectedPlayerId) {
            return { state, events: [] };
        }
        if (playerId !== sourcePlayerId) return { state, events: [] };

        const sourcePlayer = state.core.players[sourcePlayerId];
        if (!sourcePlayer?.discard.some((card) => card.uid === sourceCardUid && card.defId === POTION_OF_HALITOSIS)) {
            return { state, events: [] };
        }

        const isStillValidPlayer = buildHalitosisPlayerOptions(state.core, targetBaseIndex)
            .some(option => option.value.playerId === selectedPlayerId);
        if (!isStillValidPlayer) return { state, events: [] };

        const movePrompt = createHalitosisMovePrompt(
            state.core,
            selectedPlayerId,
            targetBaseIndex,
            sourcePlayerId,
            sourceCardUid,
            timestamp,
        );
        if (!movePrompt) {
            return {
                state,
                events: [buildAbilityFeedback(sourcePlayerId, 'feedback.no_valid_target', timestamp)],
            };
        }

        return {
            state: queueInteraction(state, movePrompt),
            events: [],
        };
    });

    registerInteractionHandler(POTION_OF_HALITOSIS_MOVE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as HalitosisMoveChoice | undefined;
        const data = interactionData as HalitosisMoveInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        const selectedPlayerId = typeof data?.selectedPlayerId === 'string' ? data.selectedPlayerId : undefined;
        const targetBaseIndex = typeof data?.targetBaseIndex === 'number' ? data.targetBaseIndex : undefined;
        const minionUid = typeof choice?.minionUid === 'string' ? choice.minionUid : undefined;
        const minionDefId = typeof choice?.minionDefId === 'string' ? choice.minionDefId : undefined;
        const fromBaseIndex = typeof choice?.fromBaseIndex === 'number' ? choice.fromBaseIndex : undefined;
        const toBaseIndex = typeof choice?.toBaseIndex === 'number' ? choice.toBaseIndex : undefined;
        if (
            !sourceCardUid
            || !sourcePlayerId
            || !selectedPlayerId
            || targetBaseIndex === undefined
            || !minionUid
            || !minionDefId
            || fromBaseIndex !== targetBaseIndex
            || toBaseIndex === undefined
            || toBaseIndex === fromBaseIndex
            || playerId !== selectedPlayerId
        ) {
            return { state, events: [] };
        }

        const sourcePlayer = state.core.players[sourcePlayerId];
        if (!sourcePlayer?.discard.some((card) => card.uid === sourceCardUid && card.defId === POTION_OF_HALITOSIS)) {
            return { state, events: [] };
        }

        const liveMinion = state.core.bases[fromBaseIndex]?.minions.find(minion => minion.uid === minionUid);
        if (!liveMinion || liveMinion.defId !== minionDefId || liveMinion.controller !== selectedPlayerId) {
            return { state, events: [] };
        }
        if (!state.core.bases[toBaseIndex]) return { state, events: [] };

        return {
            state,
            events: buildValidatedMoveEvents(state.core, {
                minionUid: liveMinion.uid,
                minionDefId: liveMinion.defId,
                fromBaseIndex,
                toBaseIndex,
                toBaseDefId: choice.toBaseDefId,
                reason: POTION_OF_HALITOSIS,
                now: timestamp,
                sourcePlayerId,
                sourceCardUid,
                sourceDefId: POTION_OF_HALITOSIS,
                sourceControllerId: selectedPlayerId,
                sourceBaseIndex: targetBaseIndex,
                sourceKind: 'action',
            }),
        };
    });

    registerInteractionHandler(POTION_OF_DUPLICATION_CHOOSE_TALENT_SOURCE_ID, (state, playerId, value, interactionData, random, timestamp) => {
        const choice = value as DuplicationTalentChoice | undefined;
        const data = interactionData as DuplicationTalentInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourceBaseIndex = typeof data?.sourceBaseIndex === 'number' ? data.sourceBaseIndex : undefined;
        const hostMinionUid = typeof data?.hostMinionUid === 'string' ? data.hostMinionUid : undefined;
        const hostMinionDefId = typeof data?.hostMinionDefId === 'string' ? data.hostMinionDefId : undefined;
        const targetMinionUid = typeof choice?.minionUid === 'string' ? choice.minionUid : undefined;
        const targetMinionDefId = typeof choice?.minionDefId === 'string' ? choice.minionDefId : undefined;
        const targetBaseIndex = typeof choice?.baseIndex === 'number' ? choice.baseIndex : undefined;
        if (
            !sourceCardUid
            || sourceBaseIndex === undefined
            || !hostMinionUid
            || !hostMinionDefId
            || !targetMinionUid
            || !targetMinionDefId
            || targetBaseIndex === undefined
        ) {
            return { state, events: [] };
        }

        const host = findPotionOfDuplicationHost(state.core, sourceBaseIndex, sourceCardUid);
        if (!host || host.uid !== hostMinionUid || host.defId !== hostMinionDefId || host.controller !== playerId) {
            return { state, events: [] };
        }

        const target = state.core.bases[targetBaseIndex]?.minions.find(minion => minion.uid === targetMinionUid);
        if (
            !target
            || target.uid === host.uid
            || target.defId !== targetMinionDefId
            || !hasCopyableMinionTalent(state.core, target)
        ) {
            return { state, events: [] };
        }

        const executor = resolveTalent(target.defId);
        if (!executor) return { state, events: [] };

        const copiedTalentContext: AbilityContext = {
            state: state.core,
            matchState: state,
            playerId,
            cardUid: host.uid,
            defId: target.defId,
            baseIndex: sourceBaseIndex,
            random,
            now: timestamp,
        };
        const validation = validateTalentUse(copiedTalentContext);
        if (!validation.valid) {
            return {
                state,
                events: [buildAbilityFeedback(playerId, 'feedback.no_valid_target', timestamp)],
            };
        }

        const result = executor(copiedTalentContext);
        return {
            state: result.matchState ?? state,
            events: result.events,
        };
    });

    registerInteractionHandler(POTION_OF_STRAIGHT_LINE_RUNNING_AWAY_CHOOSE_TREASURE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as StraightLineRunningAwayTreasureChoice | undefined;
        const data = interactionData as StraightLineRunningAwayInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        const treasureUid = typeof choice?.treasureUid === 'string' ? choice.treasureUid : undefined;
        const treasureDefId = typeof choice?.treasureDefId === 'string' ? choice.treasureDefId : undefined;
        if (!sourceCardUid || !sourcePlayerId || playerId !== sourcePlayerId || !treasureUid || !treasureDefId) {
            return { state, events: [] };
        }

        const sourcePlayer = state.core.players[sourcePlayerId];
        if (!sourcePlayer?.discard.some((card) =>
            card.uid === sourceCardUid
            && card.defId === POTION_OF_STRAIGHT_LINE_RUNNING_AWAY
        )) {
            return { state, events: [] };
        }

        const pending = state.core.pendingMunchkinTreasureReward;
        const selectedTreasure = pending?.treasureCards.find((card) =>
            card.uid === treasureUid
            && card.defId === treasureDefId
        );
        if (!pending || !selectedTreasure) {
            return { state, events: [] };
        }

        return {
            state,
            events: [{
                type: SU_EVENTS.MUNCHKIN_TREASURE_REWARD_CLAIMED,
                payload: {
                    playerId: sourcePlayerId,
                    treasureUid,
                    reason: POTION_OF_STRAIGHT_LINE_RUNNING_AWAY,
                    sourcePlayerId,
                    sourceCardUid,
                    sourceDefId: POTION_OF_STRAIGHT_LINE_RUNNING_AWAY,
                    sourceControllerId: sourcePlayerId,
                    sourceBaseIndex: pending.baseIndex,
                },
                timestamp,
            }],
        };
    });

    registerInteractionHandler(DWARVES_GOLD_DIGGER_CHOOSE_TREASURE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as GoldDiggerTreasureChoice | undefined;
        const data = interactionData as GoldDiggerInteractionData | undefined;
        const sourceMinionUid = typeof data?.sourceMinionUid === 'string' ? data.sourceMinionUid : undefined;
        const sourceBaseIndex = typeof data?.sourceBaseIndex === 'number' ? data.sourceBaseIndex : undefined;
        const treasureDefId = typeof choice?.treasureDefId === 'string' ? choice.treasureDefId : undefined;
        const discardIndex = typeof choice?.discardIndex === 'number' ? choice.discardIndex : undefined;
        if (
            !sourceMinionUid
            || sourceBaseIndex === undefined
            || !treasureDefId
            || discardIndex === undefined
        ) {
            return { state, events: [] };
        }

        const sourceMinion = state.core.bases[sourceBaseIndex]?.minions.find((minion) =>
            minion.uid === sourceMinionUid
            && minion.defId === DWARVES_GOLD_DIGGER
            && minion.controller === playerId
        );
        if (!sourceMinion) return { state, events: [] };

        if (
            state.core.treasureDiscard?.[discardIndex] !== treasureDefId
            || !isMunchkinTreasureCard(treasureDefId)
        ) {
            return { state, events: [] };
        }

        return {
            state,
            events: [{
                type: SU_EVENTS.MUNCHKIN_TREASURE_RECOVERED_FROM_DISCARD,
                payload: {
                    playerId,
                    defId: treasureDefId,
                    reason: DWARVES_GOLD_DIGGER,
                    sourcePlayerId: playerId,
                    sourceCardUid: sourceMinionUid,
                    sourceDefId: DWARVES_GOLD_DIGGER,
                    sourceControllerId: playerId,
                    sourceBaseIndex,
                },
                timestamp,
            }],
        };
    });

    registerInteractionHandler(DWARVES_CASH_OUT_CHOOSE_TREASURES_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as CashOutInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        if (!sourceCardUid || !sourcePlayerId || playerId !== sourcePlayerId) {
            return { state, events: [] };
        }

        const sourcePlayer = state.core.players[sourcePlayerId];
        if (!sourcePlayer?.discard.some(card =>
            card.uid === sourceCardUid
            && card.defId === DWARVES_CASH_OUT
        )) {
            return { state, events: [] };
        }

        const selected = (Array.isArray(value) ? value : [value]) as CashOutTreasureChoice[];
        const selectedCardUids = [...new Set(selected
            .map(choice => choice?.cardUid)
            .filter((cardUid): cardUid is string => typeof cardUid === 'string'))]
            .slice(0, 3);
        const playableTreasures = getCashOutPlayableTreasureCards(state.core, playerId);
        const events: SmashUpEvent[] = [];

        for (const cardUid of selectedCardUids) {
            const treasure = playableTreasures.find(card => card.uid === cardUid);
            if (!treasure) continue;
            if (isCardMinionLike(treasure)) {
                events.push(grantExtraMinion(playerId, DWARVES_CASH_OUT, timestamp, undefined, {
                    playTiming: 'immediate',
                    specificCardUid: treasure.uid,
                }));
            } else if (isCardActionLike(treasure)) {
                events.push(grantExtraAction(playerId, DWARVES_CASH_OUT, timestamp, {
                    playTiming: 'immediate',
                    restrictToCardUid: treasure.uid,
                }));
            }
        }

        return { state, events };
    });

    registerInteractionHandler(THIEVES_FENCE_CHOOSE_TREASURES_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as FenceInteractionData | undefined;
        const sourceMinionUid = typeof data?.sourceMinionUid === 'string' ? data.sourceMinionUid : undefined;
        const sourceBaseIndex = typeof data?.sourceBaseIndex === 'number' ? data.sourceBaseIndex : undefined;
        if (!sourceMinionUid || sourceBaseIndex === undefined) {
            return { state, events: [] };
        }

        const sourceMinion = state.core.bases[sourceBaseIndex]?.minions.find(minion =>
            minion.uid === sourceMinionUid
            && minion.defId === THIEVES_FENCE
            && minion.controller === playerId
        );
        const selectedTreasureCards = getSelectedHandTreasureCards(state.core, playerId, value, 2);
        if (!sourceMinion || !selectedTreasureCards) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                buildDiscardTreasureCostEvent(playerId, selectedTreasureCards, timestamp),
                buildVpAwardedEvent(playerId, 1, THIEVES_FENCE, timestamp),
            ],
        };
    });

    registerInteractionHandler(THIEVES_BACKSTAB_CHOOSE_TREASURE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as BackstabTreasureInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        if (!sourceCardUid || !sourcePlayerId || playerId !== sourcePlayerId) {
            return { state, events: [] };
        }
        if (!isActionInPlayerDiscard(state.core, sourcePlayerId, sourceCardUid, THIEVES_BACKSTAB)) {
            return { state, events: [] };
        }

        const selectedTreasureCards = getSelectedHandTreasureCards(state.core, playerId, value, 1);
        const selectedTreasure = selectedTreasureCards?.[0];
        const targetOptions = buildThievesBackstabMinionOptions(state.core, playerId);
        if (!selectedTreasure || targetOptions.length === 0) {
            return { state, events: [] };
        }

        const interaction = createSimpleChoice<BackstabMinionChoice>(
            `${THIEVES_BACKSTAB_CHOOSE_MINION_SOURCE_ID}_${sourceCardUid}_${timestamp}`,
            playerId,
            '背刺：选择力量3或更少的仆从',
            targetOptions,
            {
                sourceId: 'munchkin_thieves_backstab_choose_minion',
                targetType: 'minion',
                titleKey: 'ui.munchkin_thieves_backstab_choose_minion_title',
                responseValidationMode: 'live',
                autoRefresh: 'field',
                displayCard: { defId: THIEVES_BACKSTAB, cardUid: sourceCardUid },
            },
        );
        interaction.data.optionsGenerator = (latestState) =>
            buildThievesBackstabMinionOptions(latestState.core as SmashUpCore, playerId);

        return {
            state: queueInteraction(state, {
                ...interaction,
                data: {
                    ...interaction.data,
                    sourceCardUid,
                    sourcePlayerId,
                    treasureCardUid: selectedTreasure.uid,
                    treasureDefId: selectedTreasure.defId,
                },
            }),
            events: [],
        };
    });

    registerInteractionHandler(THIEVES_BACKSTAB_CHOOSE_MINION_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as BackstabMinionChoice | undefined;
        const data = interactionData as BackstabMinionInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        const treasureCardUid = typeof data?.treasureCardUid === 'string' ? data.treasureCardUid : undefined;
        if (!sourceCardUid || !sourcePlayerId || playerId !== sourcePlayerId || !treasureCardUid) {
            return { state, events: [] };
        }
        if (!isActionInPlayerDiscard(state.core, sourcePlayerId, sourceCardUid, THIEVES_BACKSTAB)) {
            return { state, events: [] };
        }

        const selectedTreasureCards = getSelectedHandTreasureCards(
            state.core,
            playerId,
            [{ cardUid: treasureCardUid }],
            1,
        );
        const target = findMinionChoiceTarget(state.core, choice);
        if (!selectedTreasureCards || !target || getEffectivePower(state.core, target.minion, target.baseIndex) > 3) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                buildDiscardTreasureCostEvent(playerId, selectedTreasureCards, timestamp),
                ...buildValidatedDestroyEvents(state.core, {
                    minionUid: target.minion.uid,
                    minionDefId: target.minion.defId,
                    fromBaseIndex: target.baseIndex,
                    destroyerId: playerId,
                    reason: THIEVES_BACKSTAB,
                    now: timestamp,
                    sourcePlayerId: playerId,
                    sourceCardUid,
                    sourceDefId: THIEVES_BACKSTAB,
                    sourceControllerId: playerId,
                }),
            ],
        };
    });

    registerInteractionHandler(THIEVES_POTION_BANDOLIER_CHOOSE_TREASURE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as PotionBandolierTreasureInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        const targetMinionUid = typeof data?.targetMinionUid === 'string' ? data.targetMinionUid : undefined;
        const targetBaseIndex = typeof data?.targetBaseIndex === 'number' ? data.targetBaseIndex : undefined;
        if (!sourceCardUid || !sourcePlayerId || playerId !== sourcePlayerId || !targetMinionUid || targetBaseIndex === undefined) {
            return { state, events: [] };
        }
        if (!isActionInPlayerDiscard(state.core, sourcePlayerId, sourceCardUid, THIEVES_POTION_BANDOLIER)) {
            return { state, events: [] };
        }

        const target = state.core.bases[targetBaseIndex]?.minions.find(minion => minion.uid === targetMinionUid);
        const selectedTreasureCards = getSelectedHandTreasureCards(state.core, playerId, value, 1);
        if (!target || !selectedTreasureCards) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                buildDiscardTreasureCostEvent(playerId, selectedTreasureCards, timestamp),
                addTempPower(target.uid, targetBaseIndex, 3, THIEVES_POTION_BANDOLIER, timestamp, {
                    sourcePlayerId: playerId,
                    sourceCardUid,
                    sourceDefId: THIEVES_POTION_BANDOLIER,
                    sourceControllerId: playerId,
                }),
            ],
        };
    });

    registerInteractionHandler(THIEVES_SMUGGLING_CHOOSE_TREASURES_SOURCE_ID, (state, playerId, value, interactionData, random, timestamp) => {
        const data = interactionData as SmugglingInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        if (!sourceCardUid || !sourcePlayerId || playerId !== sourcePlayerId) {
            return { state, events: [] };
        }
        const player = state.core.players[sourcePlayerId];
        const sourceCard = player?.discard.find(card =>
            card.uid === sourceCardUid
            && card.defId === THIEVES_SMUGGLING
        );
        const selectedTreasureCards = getSelectedHandTreasureCards(state.core, playerId, value, 2);
        if (!player || !sourceCard || !selectedTreasureCards) {
            return { state, events: [] };
        }

        const shuffledDeckCards = random.shuffle([
            ...player.deck,
            ...player.discard.filter(card => card.uid !== sourceCardUid),
            ...selectedTreasureCards,
        ]);

        return {
            state,
            events: [
                buildDiscardTreasureCostEvent(playerId, selectedTreasureCards, timestamp),
                buildVpAwardedEvent(playerId, 1, THIEVES_SMUGGLING, timestamp),
                {
                    type: SU_EVENTS.DECK_REORDERED,
                    payload: {
                        playerId,
                        deckUids: shuffledDeckCards.map(card => card.uid),
                    },
                    timestamp,
                },
                {
                    type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                    payload: {
                        cardUid: sourceCard.uid,
                        defId: THIEVES_SMUGGLING,
                        ownerId: sourceCard.owner,
                        reason: THIEVES_SMUGGLING,
                        sourcePlayerId: playerId,
                        sourceCardUid: sourceCard.uid,
                        sourceDefId: THIEVES_SMUGGLING,
                        sourceControllerId: playerId,
                    },
                    timestamp,
                },
            ],
        };
    });

    registerInteractionHandler(THIEVES_CAT_BURGLAR_CHOOSE_TREASURES_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as CatBurglarInteractionData | undefined;
        const sourceMinionUid = typeof data?.sourceMinionUid === 'string' ? data.sourceMinionUid : undefined;
        const sourceBaseIndex = typeof data?.sourceBaseIndex === 'number' ? data.sourceBaseIndex : undefined;
        if (!sourceMinionUid || sourceBaseIndex === undefined) {
            return { state, events: [] };
        }

        const sourceMinion = state.core.bases[sourceBaseIndex]?.minions.find(minion =>
            minion.uid === sourceMinionUid
            && minion.defId === THIEVES_CAT_BURGLAR
            && minion.controller === playerId
        );
        if (!sourceMinion) return { state, events: [] };

        const selected = (Array.isArray(value) ? value : [value]) as CatBurglarTreasureChoice[];
        const selectedCardUids = [...new Set(selected
            .map(choice => choice?.cardUid)
            .filter((cardUid): cardUid is string => typeof cardUid === 'string'))];
        const treasureCardsInHand = (state.core.players[playerId]?.hand ?? [])
            .filter(card => isMunchkinTreasureCard(card.defId));
        const selectedTreasureCards = selectedCardUids
            .map(cardUid => treasureCardsInHand.find(card => card.uid === cardUid))
            .filter((card): card is CardInstance => card !== undefined);

        const events: SmashUpEvent[] = [];
        if (selectedTreasureCards.length > 0) {
            events.push(revealHand(
                playerId,
                'all',
                selectedTreasureCards.map(card => ({ uid: card.uid, defId: card.defId })),
                THIEVES_CAT_BURGLAR,
                timestamp,
                playerId,
            ));
        }

        for (const _card of selectedTreasureCards) {
            events.push(addPowerCounter(sourceMinion.uid, sourceBaseIndex, 1, THIEVES_CAT_BURGLAR, timestamp, {
                sourcePlayerId: playerId,
                sourceCardUid: sourceMinion.uid,
                sourceDefId: THIEVES_CAT_BURGLAR,
                sourceControllerId: playerId,
                sourceBaseIndex,
            }));
        }

        return { state, events };
    });

    registerInteractionHandler(THIEVES_MUGGING_CHOOSE_ACTION_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as MuggingActionChoice | undefined;
        const data = interactionData as MuggingActionInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        if (!sourceCardUid || !sourcePlayerId || playerId !== sourcePlayerId) {
            return { state, events: [] };
        }
        if (!isActionInPlayerDiscard(state.core, sourcePlayerId, sourceCardUid, THIEVES_MUGGING)) {
            return { state, events: [] };
        }

        const attached = findAttachedActionByUid(state.core, choice?.cardUid);
        if (!attached || attached.action.defId !== choice?.defId || attached.action.ownerId !== choice.ownerId) {
            return { state, events: [] };
        }

        const targetOptions = buildThievesMuggingMinionOptions(
            state.core,
            playerId,
            attached.host.uid,
            attached.action.defId,
        );
        if (targetOptions.length === 0) {
            return { state, events: [] };
        }

        const interaction = createSimpleChoice<MuggingMinionChoice>(
            `${THIEVES_MUGGING_CHOOSE_MINION_SOURCE_ID}_${sourceCardUid}_${timestamp}`,
            playerId,
            '打劫：选择你的一个仆从',
            targetOptions,
            {
                sourceId: 'munchkin_thieves_mugging_choose_minion',
                targetType: 'minion',
                titleKey: 'ui.munchkin_thieves_mugging_choose_minion_title',
                responseValidationMode: 'live',
                autoRefresh: 'field',
            },
        );
        interaction.data.optionsGenerator = (latestState, latestData) => {
            const latest = latestData as MuggingMinionInteractionData | undefined;
            const originalHostMinionUid = typeof latest?.originalHostMinionUid === 'string'
                ? latest.originalHostMinionUid
                : attached.host.uid;
            const actionDefId = typeof latest?.actionDefId === 'string'
                ? latest.actionDefId
                : attached.action.defId;
            return buildThievesMuggingMinionOptions(
                latestState.core as SmashUpCore,
                playerId,
                originalHostMinionUid,
                actionDefId,
            );
        };

        return {
            state: queueInteraction(state, {
                ...interaction,
                data: {
                    ...interaction.data,
                    sourceCardUid,
                    sourcePlayerId,
                    actionCardUid: attached.action.uid,
                    actionDefId: attached.action.defId,
                    actionOwnerId: attached.action.ownerId,
                    originalBaseIndex: attached.baseIndex,
                    originalHostMinionUid: attached.host.uid,
                },
            }),
            events: [],
        };
    });

    registerInteractionHandler(THIEVES_MUGGING_CHOOSE_MINION_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as MuggingMinionChoice | undefined;
        const data = interactionData as MuggingMinionInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        const actionCardUid = typeof data?.actionCardUid === 'string' ? data.actionCardUid : undefined;
        const actionDefId = typeof data?.actionDefId === 'string' ? data.actionDefId : undefined;
        const actionOwnerId = typeof data?.actionOwnerId === 'string' ? data.actionOwnerId : undefined;
        const originalHostMinionUid = typeof data?.originalHostMinionUid === 'string' ? data.originalHostMinionUid : undefined;
        if (!sourceCardUid || !sourcePlayerId || playerId !== sourcePlayerId || !actionCardUid || !actionDefId || !actionOwnerId) {
            return { state, events: [] };
        }
        if (!isActionInPlayerDiscard(state.core, sourcePlayerId, sourceCardUid, THIEVES_MUGGING)) {
            return { state, events: [] };
        }

        const attached = findAttachedActionByUid(state.core, actionCardUid);
        const target = findMinionChoiceTarget(state.core, choice as BackstabMinionChoice | undefined);
        if (!attached || !target || attached.action.defId !== actionDefId || attached.action.ownerId !== actionOwnerId) {
            return { state, events: [] };
        }
        if (target.minion.controller !== playerId || target.minion.uid === originalHostMinionUid) {
            return { state, events: [] };
        }

        return {
            state,
            events: buildSemanticOngoingAttachEvents(state.core, {
                cardUid: attached.action.uid,
                defId: attached.action.defId,
                ownerId: attached.action.ownerId,
                sourcePlayerId: playerId,
                sourceKind: 'action',
                targetBaseIndex: target.baseIndex,
                targetMinionUid: target.minion.uid,
                metadata: attached.action.metadata,
                talentUsed: attached.action.talentUsed,
                now: timestamp,
            }),
        };
    });

    registerInteractionHandler(THIEVES_STRIP_BARE_CHOOSE_TREASURE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as StripBareTreasureChoice | undefined;
        const data = interactionData as StripBareInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        if (!sourceCardUid || !sourcePlayerId || playerId !== sourcePlayerId) {
            return { state, events: [] };
        }
        if (!isActionInPlayerDiscard(state.core, sourcePlayerId, sourceCardUid, THIEVES_STRIP_BARE)) {
            return { state, events: [] };
        }

        const target = findStripBareTreasureTarget(state.core, choice);
        if (!target?.cardUid || !target.defId || !target.ownerId) {
            return { state, events: [] };
        }

        return {
            state,
            events: [{
                type: SU_EVENTS.CARD_TRANSFERRED,
                payload: {
                    cardUid: target.cardUid,
                    defId: target.defId,
                    fromPlayerId: target.ownerId,
                    toPlayerId: playerId,
                    ownerId: target.ownerId,
                    reason: THIEVES_STRIP_BARE,
                },
                timestamp,
            } as SmashUpEvent],
        };
    });

    registerInteractionHandler(DWARVES_GREED_IS_GOOD_CHOOSE_TREASURE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as GreedIsGoodTreasureChoice | undefined;
        const data = interactionData as GreedIsGoodInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        if (!sourceCardUid || !sourcePlayerId || playerId !== sourcePlayerId) {
            return { state, events: [] };
        }

        const sourcePlayer = state.core.players[sourcePlayerId];
        if (!sourcePlayer?.discard.some((card) =>
            card.uid === sourceCardUid
            && card.defId === DWARVES_GREED_IS_GOOD
        )) {
            return { state, events: [] };
        }

        if (choice?.mode === 'draw') {
            return {
                state,
                events: [
                    {
                        type: SU_EVENTS.MUNCHKIN_TREASURES_DRAWN,
                        payload: {
                            playerId,
                            count: 1,
                            reason: DWARVES_GREED_IS_GOOD,
                            sourcePlayerId: playerId,
                            sourceCardUid,
                            sourceDefId: DWARVES_GREED_IS_GOOD,
                            sourceControllerId: playerId,
                        },
                        timestamp,
                    },
                    grantExtraAction(playerId, DWARVES_GREED_IS_GOOD, timestamp),
                ],
            };
        }

        const treasureDefId = typeof choice?.treasureDefId === 'string' ? choice.treasureDefId : undefined;
        const discardIndex = typeof choice?.discardIndex === 'number' ? choice.discardIndex : undefined;
        if (
            choice?.mode !== 'recover'
            || !treasureDefId
            || discardIndex === undefined
            || state.core.treasureDiscard?.[discardIndex] !== treasureDefId
            || !isMunchkinTreasureCard(treasureDefId)
        ) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                {
                    type: SU_EVENTS.MUNCHKIN_TREASURE_RECOVERED_FROM_DISCARD,
                    payload: {
                        playerId,
                        defId: treasureDefId,
                        reason: DWARVES_GREED_IS_GOOD,
                        sourcePlayerId: playerId,
                        sourceCardUid,
                        sourceDefId: DWARVES_GREED_IS_GOOD,
                        sourceControllerId: playerId,
                    },
                    timestamp,
                },
                grantExtraAction(playerId, DWARVES_GREED_IS_GOOD, timestamp),
            ],
        };
    });

    registerInteractionHandler(DWARVES_MINE_CHOOSE_TREASURE_SOURCE_ID, (state, playerId, value, interactionData, random, timestamp) => {
        const choice = value as MineTreasureHostChoice | undefined;
        const data = interactionData as MineInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        const treasureDefId = typeof choice?.treasureDefId === 'string' ? choice.treasureDefId : undefined;
        const deckIndex = typeof choice?.deckIndex === 'number' ? choice.deckIndex : undefined;
        const targetBaseIndex = typeof choice?.targetBaseIndex === 'number' ? choice.targetBaseIndex : undefined;
        const targetMinionUid = typeof choice?.targetMinionUid === 'string' ? choice.targetMinionUid : undefined;
        const targetMinionDefId = typeof choice?.targetMinionDefId === 'string' ? choice.targetMinionDefId : undefined;
        if (
            !sourceCardUid
            || !sourcePlayerId
            || playerId !== sourcePlayerId
            || !treasureDefId
            || deckIndex === undefined
            || targetBaseIndex === undefined
            || !targetMinionUid
            || !targetMinionDefId
        ) {
            return { state, events: [] };
        }

        const sourcePlayer = state.core.players[sourcePlayerId];
        if (!sourcePlayer?.discard.some(card =>
            card.uid === sourceCardUid
            && card.defId === DWARVES_MINE
        )) {
            return { state, events: [] };
        }
        if (
            state.core.treasureDeck?.[deckIndex] !== treasureDefId
            || !isMunchkinTreasureAttachableToMinion(treasureDefId)
        ) {
            return { state, events: [] };
        }

        const targetMinion = state.core.bases[targetBaseIndex]?.minions.find(minion =>
            minion.uid === targetMinionUid
            && minion.defId === targetMinionDefId
            && minion.controller === playerId
        );
        if (!targetMinion) return { state, events: [] };

        const remainingDeck = [
            ...(state.core.treasureDeck ?? []).slice(0, deckIndex),
            ...(state.core.treasureDeck ?? []).slice(deckIndex + 1),
        ];
        const treasureUid = getNextMunchkinTreasureUid(state.core);

        return {
            state,
            events: [
                {
                    type: SU_EVENTS.MUNCHKIN_TREASURE_FOUND_FROM_DECK,
                    payload: {
                        playerId,
                        defId: treasureDefId,
                        deckIndex,
                        treasureUid,
                        shuffledDeckDefIds: random.shuffle([...remainingDeck]),
                        reason: DWARVES_MINE,
                        sourcePlayerId: playerId,
                        sourceCardUid,
                        sourceDefId: DWARVES_MINE,
                        sourceControllerId: playerId,
                        sourceBaseIndex: targetBaseIndex,
                    },
                    timestamp,
                },
                grantExtraAction(playerId, DWARVES_MINE, timestamp, {
                    playTiming: 'immediate',
                    restrictToCardUid: treasureUid,
                    restrictToMinionUid: targetMinionUid,
                }),
            ],
        };
    });

    registerInteractionHandler(DWARVES_SALVAGE_CHOOSE_TREASURE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as SalvageTreasureHostChoice | undefined;
        const data = interactionData as SalvageInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const sourcePlayerId = typeof data?.sourcePlayerId === 'string' ? data.sourcePlayerId : undefined;
        const sourceBaseIndex = typeof data?.sourceBaseIndex === 'number' ? data.sourceBaseIndex : undefined;
        const treasureDefId = typeof choice?.treasureDefId === 'string' ? choice.treasureDefId : undefined;
        const discardIndex = typeof choice?.discardIndex === 'number' ? choice.discardIndex : undefined;
        const targetBaseIndex = typeof choice?.targetBaseIndex === 'number' ? choice.targetBaseIndex : undefined;
        const targetMinionUid = typeof choice?.targetMinionUid === 'string' ? choice.targetMinionUid : undefined;
        const targetMinionDefId = typeof choice?.targetMinionDefId === 'string' ? choice.targetMinionDefId : undefined;
        if (
            !sourceCardUid
            || !sourcePlayerId
            || playerId !== sourcePlayerId
            || sourceBaseIndex === undefined
            || !treasureDefId
            || discardIndex === undefined
            || targetBaseIndex !== sourceBaseIndex
            || !targetMinionUid
            || !targetMinionDefId
        ) {
            return { state, events: [] };
        }

        const sourcePlayer = state.core.players[sourcePlayerId];
        if (!sourcePlayer?.discard.some(card =>
            card.uid === sourceCardUid
            && card.defId === DWARVES_SALVAGE
        )) {
            return { state, events: [] };
        }
        if (
            state.core.treasureDiscard?.[discardIndex] !== treasureDefId
            || !isMunchkinTreasureAttachableToMinion(treasureDefId)
        ) {
            return { state, events: [] };
        }

        const targetMinion = state.core.bases[sourceBaseIndex]?.minions.find(minion =>
            minion.uid === targetMinionUid
            && minion.defId === targetMinionDefId
            && minion.controller === playerId
        );
        if (!targetMinion) return { state, events: [] };

        const treasureUid = getNextMunchkinTreasureUid(state.core);

        return {
            state,
            events: [
                {
                    type: SU_EVENTS.MUNCHKIN_TREASURE_RECOVERED_FROM_DISCARD,
                    payload: {
                        playerId,
                        defId: treasureDefId,
                        treasureUid,
                        reason: DWARVES_SALVAGE,
                        sourcePlayerId: playerId,
                        sourceCardUid,
                        sourceDefId: DWARVES_SALVAGE,
                        sourceControllerId: playerId,
                        sourceBaseIndex,
                    },
                    timestamp,
                },
                grantExtraAction(playerId, DWARVES_SALVAGE, timestamp, {
                    playTiming: 'immediate',
                    restrictToBase: sourceBaseIndex,
                    restrictToCardUid: treasureUid,
                    restrictToMinionUid: targetMinionUid,
                }),
            ],
        };
    });

    registerInteractionHandler('munchkin_treasure_magic_missile_destroy', (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as MagicMissileMinionChoice | undefined;
        const data = interactionData as MagicMissileInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const fromBaseIndex = typeof data?.fromBaseIndex === 'number' ? data.fromBaseIndex : undefined;
        const targetMinionUid = typeof choice?.minionUid === 'string' ? choice.minionUid : undefined;
        if (!sourceCardUid || fromBaseIndex === undefined || !targetMinionUid || choice?.baseIndex !== fromBaseIndex) {
            return { state, events: [] };
        }

        const source = findAttachedTreasureHost(state.core, fromBaseIndex, sourceCardUid, MAGIC_MISSILE);
        if (!source || source.action.ownerId !== playerId) return { state, events: [] };

        const target = state.core.bases[fromBaseIndex]?.minions.find(minion => minion.uid === targetMinionUid);
        if (!target || getEffectivePower(state.core, target, fromBaseIndex) > 3) return { state, events: [] };

        return {
            state,
            events: [
                munchkinTreasureToDeckBottom(
                    source.action.uid,
                    MAGIC_MISSILE,
                    source.action.ownerId,
                    timestamp,
                    playerId,
                    MAGIC_MISSILE,
                    fromBaseIndex,
                ),
                ...buildValidatedDestroyEvents(state.core, {
                    minionUid: target.uid,
                    minionDefId: target.defId,
                    fromBaseIndex,
                    destroyerId: playerId,
                    reason: MAGIC_MISSILE,
                    now: timestamp,
                    sourcePlayerId: playerId,
                    sourceCardUid: source.action.uid,
                    sourceDefId: MAGIC_MISSILE,
                    sourceControllerId: playerId,
                    sourceBaseIndex: fromBaseIndex,
                    sourceKind: 'action',
                }),
            ],
        };
    });

    registerInteractionHandler('munchkin_treasure_rocket_boots_move', (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as RocketBootsBaseChoice | undefined;
        const data = interactionData as RocketBootsInteractionData | undefined;
        const minionUid = typeof data?.minionUid === 'string' ? data.minionUid : undefined;
        const minionDefId = typeof data?.minionDefId === 'string' ? data.minionDefId : undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const fromBaseIndex = typeof data?.fromBaseIndex === 'number' ? data.fromBaseIndex : undefined;
        if (
            !minionUid
            || !minionDefId
            || !sourceCardUid
            || fromBaseIndex === undefined
            || choice?.baseIndex === undefined
            || choice.baseIndex === fromBaseIndex
        ) {
            return { state, events: [] };
        }

        const liveHost = findRocketBootsHost(state.core, fromBaseIndex, sourceCardUid);
        if (!liveHost || liveHost.uid !== minionUid) return { state, events: [] };

        return {
            state,
            events: buildValidatedMoveEvents(state.core, {
                minionUid: liveHost.uid,
                minionDefId: liveHost.defId,
                fromBaseIndex,
                toBaseIndex: choice.baseIndex,
                reason: ROCKET_BOOTS,
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid,
                sourceDefId: ROCKET_BOOTS,
                sourceControllerId: playerId,
                sourceBaseIndex: fromBaseIndex,
                sourceKind: 'action',
            }),
        };
    });
}
