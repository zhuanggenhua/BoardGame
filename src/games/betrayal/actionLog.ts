import type {
    ActionLogEntry,
    ActionLogSegment,
    Command,
    GameEvent,
    MatchState,
} from '../../engine/types';
import { BETRAYAL_COMMANDS } from './commands';
import type { BetrayalCore } from './game';

export const BETRAYAL_ACTION_LOG_ALLOWLIST = Object.values(BETRAYAL_COMMANDS);
export const BETRAYAL_UNDO_ALLOWLIST = BETRAYAL_ACTION_LOG_ALLOWLIST;

const NS = 'game-betrayal';

const i18nSeg = (
    key: string,
    params?: Record<string, string | number>,
): ActionLogSegment => ({
    type: 'i18n',
    ns: NS,
    key,
    ...(params ? { params } : {}),
});

const playerNumberOf = (core: BetrayalCore, playerId: string) => {
    const index = core.playerIds.indexOf(playerId);
    return index >= 0 ? index + 1 : playerId;
};

const roomNameOf = (core: BetrayalCore, roomId: unknown) => (
    typeof roomId === 'string'
        ? core.rooms.find((room) => room.id === roomId)?.name
        : undefined
);

const entry = (
    command: Command,
    state: MatchState<unknown>,
    segments: ActionLogSegment[],
): ActionLogEntry => {
    const timestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;
    return {
        id: `betrayal-${command.type}-${command.playerId}-${timestamp}-${state.sys.actionLog.entries.length}`,
        timestamp,
        actorId: command.playerId,
        kind: command.type,
        segments,
    };
};

export function formatBetrayalActionEntry({
    command,
    state,
    afterEventsRound,
}: {
    command: Command;
    state: MatchState<unknown>;
    events: GameEvent[];
    afterEventsRound?: number;
}): ActionLogEntry | null {
    if ((afterEventsRound ?? 0) > 0) {
        return null;
    }

    const core = state.core as BetrayalCore;
    const payload = command.payload as Record<string, unknown>;
    const actor = playerNumberOf(core, command.playerId);

    switch (command.type) {
        case BETRAYAL_COMMANDS.SELECT_EXPLORER:
            return entry(command, state, [i18nSeg('actionLog.selectExplorer', { player: actor })]);
        case BETRAYAL_COMMANDS.CONFIRM_EXPLORER:
            return entry(command, state, [i18nSeg('actionLog.confirmExplorer', { player: actor })]);
        case BETRAYAL_COMMANDS.PROPOSE_SCENARIO_CARD:
            return entry(command, state, [i18nSeg('actionLog.proposeScenarioCard', { player: actor })]);
        case BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD:
            return entry(command, state, [i18nSeg('actionLog.confirmScenarioCard', { player: actor })]);
        case BETRAYAL_COMMANDS.START_SCENARIO:
            return entry(command, state, [i18nSeg('actionLog.startScenario', { player: actor })]);
        case BETRAYAL_COMMANDS.MOVE_TO_ROOM: {
            const room = roomNameOf(core, payload.roomId);
            return entry(command, state, [i18nSeg(
                room ? 'actionLog.moveToRoom' : 'actionLog.move',
                room ? { player: actor, room } : { player: actor },
            )]);
        }
        case BETRAYAL_COMMANDS.EXPLORE_ROOM: {
            const roomId = typeof payload.roomId === 'string'
                ? payload.roomId
                : core.currentExplorer.roomId;
            const room = roomNameOf(core, roomId);
            return entry(command, state, [i18nSeg(
                room ? 'actionLog.exploreRoom' : 'actionLog.explore',
                room ? { player: actor, room } : { player: actor },
            )]);
        }
        case BETRAYAL_COMMANDS.USE_POSSESSION:
            return entry(command, state, [i18nSeg('actionLog.usePossession', { player: actor })]);
        case BETRAYAL_COMMANDS.USE_RABBIT_FOOT:
            return entry(command, state, [i18nSeg('actionLog.useRabbitFoot', { player: actor })]);
        case BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM:
            return entry(command, state, [i18nSeg('actionLog.useRollRerollItem', { player: actor })]);
        case BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE:
            return entry(command, state, [i18nSeg('actionLog.resolveEventChoice', { player: actor })]);
        case BETRAYAL_COMMANDS.USE_ROOM_EFFECT: {
            const room = roomNameOf(core, core.currentExplorer.roomId);
            return entry(command, state, [i18nSeg(
                room ? 'actionLog.useRoomEffectAt' : 'actionLog.useRoomEffect',
                room ? { player: actor, room } : { player: actor },
            )]);
        }
        case BETRAYAL_COMMANDS.TRADE_POSSESSION:
            return entry(command, state, [i18nSeg('actionLog.tradeRequest', {
                player: actor,
                target: typeof payload.targetPlayerId === 'string'
                    ? playerNumberOf(core, payload.targetPlayerId)
                    : '?',
            })]);
        case BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT:
            return entry(command, state, [i18nSeg(
                payload.accept === false
                    ? 'actionLog.declineTrade'
                    : 'actionLog.acceptTrade',
                { player: actor },
            )]);
        case BETRAYAL_COMMANDS.LOOT_CORPSE:
            return entry(command, state, [i18nSeg('actionLog.lootCorpse', { player: actor })]);
        case BETRAYAL_COMMANDS.END_TURN:
            return entry(command, state, [i18nSeg('actionLog.endTurn', { player: actor })]);
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL:
            return entry(command, state, [i18nSeg('actionLog.acknowledgeTurnEndRoll', { player: actor })]);
        case BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION:
            return entry(command, state, [i18nSeg('actionLog.resolveDamageAllocation', { player: actor })]);
        case BETRAYAL_COMMANDS.HAUNT_ATTACK: {
            const key = payload.target === 'traitor'
                ? 'actionLog.attackTraitor'
                : payload.target === 'jack-spirit'
                    ? 'actionLog.attackJackSpirit'
                    : payload.target === 'troll-hand'
                        ? 'actionLog.attackTrollHand'
                    : 'actionLog.attackHero';
            return entry(command, state, [i18nSeg(key, { player: actor })]);
        }
        case BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE:
            return entry(command, state, [i18nSeg('actionLog.resolveMonsterDamage', { player: actor })]);
        case BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START:
            return entry(command, state, [i18nSeg('actionLog.resolveMonsterTurnStart', { player: actor })]);
        case BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP:
            return entry(command, state, [i18nSeg('actionLog.rollMonsterMovementGroup', { player: actor })]);
        case BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM:
            return entry(command, state, [i18nSeg('actionLog.moveMonster', { player: actor })]);
        case BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO:
            return entry(command, state, [i18nSeg('actionLog.monsterAttackHero', { player: actor })]);
        case BETRAYAL_COMMANDS.PLAY_PEEKABOO:
            return entry(command, state, [i18nSeg('actionLog.playPeekaboo', { player: actor })]);
        case BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN:
            return entry(command, state, [i18nSeg('actionLog.endBloodFromStoneMonsterTurn', { player: actor })]);
        case BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS:
            return entry(command, state, [i18nSeg('actionLog.placeBloodFromStoneExtraStoneCherubs', { player: actor })]);
        case BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND:
            return entry(command, state, [i18nSeg('actionLog.moveTrollHand', { player: actor })]);
        case BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK:
            return entry(command, state, [i18nSeg(
                payload.combined === true
                    ? 'actionLog.trollHandCombinedAttack'
                    : 'actionLog.trollHandAttack',
                { player: actor },
            )]);
        case BETRAYAL_COMMANDS.RESOLVE_HELPING_HANDS_ATTACK_REWARD:
            return entry(command, state, [i18nSeg(
                payload.choice === 'steal'
                    ? 'actionLog.resolveTrollHandAttackRewardSteal'
                    : 'actionLog.resolveTrollHandAttackRewardDamage',
                { player: actor },
            )]);
        case BETRAYAL_COMMANDS.END_HELPING_HANDS_MONSTER_TURN:
            return entry(command, state, [i18nSeg('actionLog.endTrollHandMonsterTurn', { player: actor })]);
        case BETRAYAL_COMMANDS.LEARN_ABOUT_JACK:
            return entry(command, state, [i18nSeg('actionLog.learnAboutJack', { player: actor })]);
        case BETRAYAL_COMMANDS.STUDY_EXORCISM:
            return entry(command, state, [i18nSeg('actionLog.studyExorcism', { player: actor })]);
        case BETRAYAL_COMMANDS.EXORCISE_JACK:
            return entry(command, state, [i18nSeg('actionLog.exorciseJack', { player: actor })]);
        case BETRAYAL_COMMANDS.STUDY_MUMMY_NAME:
            return entry(command, state, [i18nSeg('actionLog.studyMummyName', { player: actor })]);
        case BETRAYAL_COMMANDS.LEARN_MUMMY_BANISHMENT:
            return entry(command, state, [i18nSeg('actionLog.learnMummyBanishment', { player: actor })]);
        case BETRAYAL_COMMANDS.BANISH_MUMMY:
            return entry(command, state, [i18nSeg('actionLog.banishMummy', { player: actor })]);
        case BETRAYAL_COMMANDS.PICK_UP_MUMMY_GIRL:
            return entry(command, state, [i18nSeg('actionLog.pickUpMummyGirl', { player: actor })]);
        case BETRAYAL_COMMANDS.GIVE_GIRL_TO_MUMMY:
            return entry(command, state, [i18nSeg('actionLog.giveGirlToMummy', { player: actor })]);
        case BETRAYAL_COMMANDS.GIVE_OMEN_TO_MUMMY:
            return entry(command, state, [i18nSeg('actionLog.giveOmenToMummy', { player: actor })]);
        case BETRAYAL_COMMANDS.SEARCH_FOR_CURE:
            return entry(command, state, [i18nSeg('actionLog.searchForCure', { player: actor })]);
        case BETRAYAL_COMMANDS.CURE_THE_DUST:
            return entry(command, state, [i18nSeg('actionLog.cureTheDust', { player: actor })]);
        case BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE:
            return entry(command, state, [i18nSeg('actionLog.requestSicknessExchange', { player: actor })]);
        case BETRAYAL_COMMANDS.RESOLVE_SICKNESS_EXCHANGE:
            return entry(command, state, [i18nSeg(
                payload.accept === false
                    ? 'actionLog.declineSicknessExchange'
                    : 'actionLog.acceptSicknessExchange',
                { player: actor },
            )]);
        case BETRAYAL_COMMANDS.TAKE_PHOTO:
            return entry(command, state, [i18nSeg('actionLog.takePhoto', { player: actor })]);
        case BETRAYAL_COMMANDS.SMASH_MAGIC_CAMERA:
            return entry(command, state, [i18nSeg('actionLog.smashMagicCamera', { player: actor })]);
        case BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK:
            return entry(command, state, [i18nSeg('actionLog.phantomPhotographerAttack', { player: actor })]);
        case BETRAYAL_COMMANDS.COMPLETE_SCENARIO:
            return entry(command, state, [i18nSeg('actionLog.completeScenario', { player: actor })]);
        default:
            return null;
    }
}
