import type {
    ActionLogEntry,
    ActionLogInteractiveParam,
    ActionLogSegment,
    Command,
    GameEvent,
    MatchState,
} from '../../engine/types';
import { BETRAYAL_COMMANDS } from './commands';
import type { BetrayalCore, BetrayalTraitKey } from './game';
import {
    getBetrayalEventPreviewRef,
    getBetrayalPossessionPreviewRef,
    getBetrayalRoomPreviewRef,
} from './cardPreviewRef';

export const BETRAYAL_ACTION_LOG_ALLOWLIST = [
    BETRAYAL_COMMANDS.SELECT_EXPLORER,
    BETRAYAL_COMMANDS.CONFIRM_EXPLORER,
    BETRAYAL_COMMANDS.MOVE_TO_ROOM,
    BETRAYAL_COMMANDS.EXPLORE_ROOM,
    BETRAYAL_COMMANDS.USE_POSSESSION,
    BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
    BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM,
    BETRAYAL_COMMANDS.ROLL_EVENT,
    BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL,
    BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
    BETRAYAL_COMMANDS.USE_ROOM_EFFECT,
    BETRAYAL_COMMANDS.TRADE_POSSESSION,
    BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT,
    BETRAYAL_COMMANDS.LOOT_CORPSE,
    BETRAYAL_COMMANDS.END_TURN,
    BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
    BETRAYAL_COMMANDS.HAUNT_ATTACK,
    BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE,
    BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START,
    BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
    BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM,
    BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
    BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN,
    BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS,
    BETRAYAL_COMMANDS.BREAK_MIRROR_CURSE,
    BETRAYAL_COMMANDS.GIVE_MIRROR_HINT,
    BETRAYAL_COMMANDS.RESOLVE_HELPING_HANDS_ATTACK_REWARD,
    BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND,
    BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK,
    BETRAYAL_COMMANDS.END_HELPING_HANDS_MONSTER_TURN,
    BETRAYAL_COMMANDS.LEARN_ABOUT_JACK,
    BETRAYAL_COMMANDS.STUDY_EXORCISM,
    BETRAYAL_COMMANDS.EXORCISE_JACK,
    BETRAYAL_COMMANDS.STUDY_MUMMY_NAME,
    BETRAYAL_COMMANDS.LEARN_MUMMY_BANISHMENT,
    BETRAYAL_COMMANDS.BANISH_MUMMY,
    BETRAYAL_COMMANDS.PICK_UP_MUMMY_GIRL,
    BETRAYAL_COMMANDS.GIVE_GIRL_TO_MUMMY,
    BETRAYAL_COMMANDS.GIVE_OMEN_TO_MUMMY,
    BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD,
    BETRAYAL_COMMANDS.SEARCH_FOR_CURE,
    BETRAYAL_COMMANDS.CURE_THE_DUST,
    BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE,
    BETRAYAL_COMMANDS.RESOLVE_SICKNESS_EXCHANGE,
    BETRAYAL_COMMANDS.TAKE_PHOTO,
    BETRAYAL_COMMANDS.SMASH_MAGIC_CAMERA,
    BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK,
    BETRAYAL_COMMANDS.PLAY_PEEKABOO,
    BETRAYAL_COMMANDS.COMPLETE_SCENARIO,
] as const;
export const BETRAYAL_UNDO_ALLOWLIST = [
    BETRAYAL_COMMANDS.SELECT_EXPLORER,
    BETRAYAL_COMMANDS.CONFIRM_EXPLORER,
    BETRAYAL_COMMANDS.PROPOSE_SCENARIO_CARD,
    BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD,
    BETRAYAL_COMMANDS.START_SCENARIO,
    BETRAYAL_COMMANDS.MOVE_TO_ROOM,
    BETRAYAL_COMMANDS.EXPLORE_ROOM,
    BETRAYAL_COMMANDS.USE_POSSESSION,
    BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
    BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM,
    BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
    BETRAYAL_COMMANDS.USE_ROOM_EFFECT,
    BETRAYAL_COMMANDS.TRADE_POSSESSION,
    BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT,
    BETRAYAL_COMMANDS.LOOT_CORPSE,
    BETRAYAL_COMMANDS.END_TURN,
    BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
    BETRAYAL_COMMANDS.HAUNT_ATTACK,
    BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE,
    BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START,
    BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
    BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM,
    BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
    BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN,
    BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS,
    BETRAYAL_COMMANDS.BREAK_MIRROR_CURSE,
    BETRAYAL_COMMANDS.GIVE_MIRROR_HINT,
    BETRAYAL_COMMANDS.RESOLVE_HELPING_HANDS_ATTACK_REWARD,
    BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND,
    BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK,
    BETRAYAL_COMMANDS.END_HELPING_HANDS_MONSTER_TURN,
    BETRAYAL_COMMANDS.LEARN_ABOUT_JACK,
    BETRAYAL_COMMANDS.STUDY_EXORCISM,
    BETRAYAL_COMMANDS.EXORCISE_JACK,
    BETRAYAL_COMMANDS.STUDY_MUMMY_NAME,
    BETRAYAL_COMMANDS.LEARN_MUMMY_BANISHMENT,
    BETRAYAL_COMMANDS.BANISH_MUMMY,
    BETRAYAL_COMMANDS.PICK_UP_MUMMY_GIRL,
    BETRAYAL_COMMANDS.GIVE_GIRL_TO_MUMMY,
    BETRAYAL_COMMANDS.GIVE_OMEN_TO_MUMMY,
    BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD,
    BETRAYAL_COMMANDS.SEARCH_FOR_CURE,
    BETRAYAL_COMMANDS.CURE_THE_DUST,
    BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE,
    BETRAYAL_COMMANDS.RESOLVE_SICKNESS_EXCHANGE,
    BETRAYAL_COMMANDS.TAKE_PHOTO,
    BETRAYAL_COMMANDS.SMASH_MAGIC_CAMERA,
    BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK,
    BETRAYAL_COMMANDS.PLAY_PEEKABOO,
    BETRAYAL_COMMANDS.COMPLETE_SCENARIO,
] as const;

const NS = 'game-betrayal';

const i18nSeg = (
    key: string,
    params?: Record<string, string | number>,
    paramI18nKeys?: string[],
    interactiveParams?: Record<string, ActionLogInteractiveParam>,
): ActionLogSegment => ({
    type: 'i18n',
    ns: NS,
    key,
    ...(params ? { params } : {}),
    ...(paramI18nKeys ? { paramI18nKeys } : {}),
    ...(interactiveParams ? { interactiveParams } : {}),
});

const roomNameOf = (core: BetrayalCore, roomId: unknown) => (
    typeof roomId === 'string'
        ? core.rooms.find((room) => room.id === roomId)?.name
        : undefined
);

const roomVisualIdOf = (core: BetrayalCore, roomId: unknown) => (
    typeof roomId === 'string'
        ? core.rooms.find((room) => room.id === roomId)?.visualId
        : undefined
);

const roomInteractiveParam = (
    roomName: string,
    visualId?: string,
): Record<string, ActionLogInteractiveParam> => ({
    room: {
        text: roomName,
        tooltip: `房间：${roomName}`,
        ...(visualId ? { previewRef: getBetrayalRoomPreviewRef(visualId) } : {}),
    },
});

const possessionInteractiveParam = (
    cardId: string,
    cardName: string,
): ActionLogInteractiveParam => ({
    text: cardName,
    tooltip: `卡牌：${cardName}`,
    previewRef: getBetrayalPossessionPreviewRef(cardId),
});

const eventInteractiveParam = (
    eventName: string,
): ActionLogInteractiveParam => ({
    text: eventName,
    tooltip: `事件牌：${eventName}`,
    previewRef: getBetrayalEventPreviewRef(eventName),
});

const playerParams = (
    playerId: string,
    params: Record<string, string | number> = {},
): Record<string, string | number> => ({
    playerId,
    ...params,
});

const asRecord = (value: unknown): Record<string, unknown> | null => (
    value && typeof value === 'object' ? value as Record<string, unknown> : null
);

const stringValue = (value: unknown): string | undefined => (
    typeof value === 'string' && value ? value : undefined
);

const numberValue = (value: unknown): number | undefined => (
    typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

const BETRAYAL_TRAIT_LABEL: Record<BetrayalTraitKey, string> = {
    might: '力量',
    speed: '速度',
    knowledge: '知识',
    sanity: '神志',
};

const isBetrayalTraitKey = (value: unknown): value is BetrayalTraitKey => (
    value === 'might' || value === 'speed' || value === 'knowledge' || value === 'sanity'
);

const formatTraitList = (traits: BetrayalTraitKey[]): string => (
    traits.map((trait) => BETRAYAL_TRAIT_LABEL[trait]).join('、')
);

const entry = (
    command: Command,
    state: MatchState<unknown>,
    segments: ActionLogSegment[],
    suffix?: string,
): ActionLogEntry => {
    const timestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;
    const suffixPart = suffix ? `-${suffix}` : '';
    return {
        id: `betrayal-${command.type}-${command.playerId}-${timestamp}${suffixPart}-${state.sys.actionLog.entries.length}`,
        timestamp,
        actorId: command.playerId,
        kind: command.type,
        segments,
    };
};

const eventEntry = (
    command: Command,
    state: MatchState<unknown>,
    event: GameEvent,
    suffix: string,
    segments: ActionLogSegment[],
): ActionLogEntry => {
    const timestamp = typeof event.timestamp === 'number'
        ? event.timestamp
        : typeof command.timestamp === 'number'
            ? command.timestamp
            : 0;
    return {
        id: `betrayal-${event.type}-${command.playerId}-${timestamp}-${suffix}-${state.sys.actionLog.entries.length}`,
        timestamp,
        actorId: command.playerId,
        kind: event.type,
        segments,
    };
};

const isGenericEventDiscoveryTitle = (title: string | undefined): boolean => (
    !title || title === '事件符号' || title === '跳过事件'
);

const buildRoomExploredEventEntries = (
    command: Command,
    state: MatchState<unknown>,
    event: GameEvent,
): ActionLogEntry[] => {
    if (event.type !== 'ROOM_EXPLORED') {
        return [];
    }

    const payload = asRecord(event.payload);
    if (!payload) {
        return [];
    }

    const room = asRecord(payload.room);
    const roomName = stringValue(room?.name);
    const roomVisualId = stringValue(room?.visualId);
    const roomParams = roomName ? { room: roomName } : {};
    const roomInteractive = roomName ? roomInteractiveParam(roomName, roomVisualId) : undefined;
    const discovery = asRecord(payload.discovery);
    const eventTitle = stringValue(discovery?.title) ?? '事件';
    const entries: ActionLogEntry[] = [];

    if (payload.deckKind === 'event') {
        if (!isGenericEventDiscoveryTitle(eventTitle)) {
            entries.push(eventEntry(command, state, event, 'event-trigger', [i18nSeg(
                roomName ? 'actionLog.exploreRoomEvent' : 'actionLog.exploreEvent',
                roomName
                    ? playerParams(command.playerId, { ...roomParams, event: eventTitle })
                    : playerParams(command.playerId, { event: eventTitle }),
                undefined,
                {
                    ...(roomInteractive ?? {}),
                    event: eventInteractiveParam(eventTitle),
                },
            )]));
        }
    }

    const appendGainedCardEntry = (card: Record<string, unknown>, suffix: string, key: string) => {
        const cardId = stringValue(card.id);
        const cardName = stringValue(card.name);
        if (!cardId || !cardName) return;
        entries.push(eventEntry(command, state, event, suffix, [i18nSeg(
            key,
            playerParams(command.playerId, {
                ...roomParams,
                card: cardName,
            }),
            undefined,
            {
                ...(roomInteractive ?? {}),
                card: possessionInteractiveParam(cardId, cardName),
            },
        )]));
    };

    const roomDiscoveryCards = Array.isArray(payload.roomDiscoveryCards)
        ? payload.roomDiscoveryCards.map(asRecord).filter((card): card is Record<string, unknown> => Boolean(card))
        : [];
    roomDiscoveryCards.forEach((card, index) => appendGainedCardEntry(card, `room-reward-${index}`, 'actionLog.exploreRoomCard'));
    const buriedRoomDiscoveryCards = Array.isArray(payload.buriedRoomDiscoveryCards)
        ? payload.buriedRoomDiscoveryCards.map(asRecord).filter((card): card is Record<string, unknown> => Boolean(card))
        : [];
    buriedRoomDiscoveryCards.forEach((card, index) => appendGainedCardEntry(card, `room-buried-${index}`, 'actionLog.exploreRoomCardBuried'));

    const drawnCard = asRecord(payload.drawnCard);
    if (drawnCard && payload.deckKind !== 'event') {
        appendGainedCardEntry(drawnCard, 'drawn-card', 'actionLog.exploreRoomCard');
    }

    const eventRoll = asRecord(payload.eventRoll);
    const rollLabel = stringValue(eventRoll?.rollLabel);
    const total = numberValue(eventRoll?.total);
    const result = stringValue(eventRoll?.label);
    if (rollLabel && total !== undefined && result) {
        entries.push(eventEntry(command, state, event, 'event-roll-result', [i18nSeg(
            'actionLog.eventRollResult',
            playerParams(command.playerId, { event: eventTitle, roll: rollLabel, total, result }),
            undefined,
            { event: eventInteractiveParam(eventTitle) },
        )]));
    }

    return entries;
};

const formatDamageRolls = (rolls: number[]): string => rolls.join(' / ');

const buildEventRolledDamageEntries = (
    command: Command,
    state: MatchState<unknown>,
    core: BetrayalCore,
): ActionLogEntry[] => {
    const recentRoll = core.recentRoll;
    const rolledDamageResults = recentRoll?.kind === 'eventRolledDamage'
        ? recentRoll.eventRolledDamageResults ?? []
        : recentRoll?.eventEffectSnapshot?.rolledDamageResults ?? [];
    if (
        !recentRoll
        || (
            recentRoll.kind !== 'eventRolledDamage'
            && recentRoll.kind !== 'eventTraitCheck'
            && recentRoll.kind !== 'eventDiceRoll'
        )
        || rolledDamageResults.length === 0
    ) {
        return [];
    }

    return rolledDamageResults.map((damage, index) => entry(command, state, [i18nSeg(
        damage.damageKind === 'physical'
            ? 'actionLog.eventRolledPhysicalDamageResult'
            : 'actionLog.eventRolledMentalDamageResult',
        playerParams(recentRoll.playerId, {
            event: recentRoll.sourceTitle,
            diceCount: damage.rolls.length,
            damageRolls: formatDamageRolls(damage.rolls),
            damageTotal: damage.total,
            appliedDamage: damage.appliedAmount,
        }),
    )], `event-rolled-damage-${index}`));
};

const buildDamageAllocationEntry = (
    command: Command,
    state: MatchState<unknown>,
    events: GameEvent[],
): ActionLogEntry | null => {
    const damageEvent = events.find((event) => event.type === 'DAMAGE_ALLOCATION_RESOLVED');
    const eventPayload = asRecord(damageEvent?.payload);
    if (!eventPayload) {
        return null;
    }

    const damageKind = stringValue(eventPayload.damageKind);
    const key = damageKind === 'physical'
        ? 'actionLog.resolvePhysicalDamageAllocationDetail'
        : damageKind === 'mental'
            ? 'actionLog.resolveMentalDamageAllocationDetail'
            : 'actionLog.resolveGeneralDamageAllocationDetail';
    const traits = Array.isArray(eventPayload.traits)
        ? eventPayload.traits.filter(isBetrayalTraitKey)
        : [];
    const source = stringValue(eventPayload.sourceTitle) ?? '伤害';
    const amount = numberValue(eventPayload.amount) ?? traits.length;
    const playerId = stringValue(eventPayload.playerId) ?? command.playerId;

    return entry(command, state, [i18nSeg(key, playerParams(playerId, {
        source,
        amount,
        traits: formatTraitList(traits),
    }))]);
};

export function formatBetrayalActionEntry({
    command,
    state,
    events,
    afterEventsRound,
}: {
    command: Command;
    state: MatchState<unknown>;
    events: GameEvent[];
    afterEventsRound?: number;
}): ActionLogEntry | ActionLogEntry[] | null {
    if ((afterEventsRound ?? 0) > 0) {
        return null;
    }

    const core = state.core as BetrayalCore;
    const payload = command.payload as Record<string, unknown>;

    switch (command.type) {
        case BETRAYAL_COMMANDS.SELECT_EXPLORER:
            return entry(command, state, [i18nSeg('actionLog.selectExplorer', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.CONFIRM_EXPLORER:
            return entry(command, state, [i18nSeg('actionLog.confirmExplorer', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.MOVE_TO_ROOM: {
            const room = roomNameOf(core, payload.roomId);
            return entry(command, state, [i18nSeg(
                room ? 'actionLog.moveToRoom' : 'actionLog.move',
                room ? playerParams(command.playerId, { room }) : playerParams(command.playerId),
                undefined,
                room ? roomInteractiveParam(room, typeof payload.roomId === 'string' ? core.rooms.find((candidate) => candidate.id === payload.roomId)?.visualId : undefined) : undefined,
            )]);
        }
        case BETRAYAL_COMMANDS.EXPLORE_ROOM: {
            const roomId = typeof payload.roomId === 'string'
                ? payload.roomId
                : core.currentExplorer.roomId;
            const room = roomNameOf(core, roomId);
            return [
                entry(command, state, [i18nSeg(
                    room ? 'actionLog.exploreRoom' : 'actionLog.explore',
                    room ? playerParams(command.playerId, { room }) : playerParams(command.playerId),
                    undefined,
                    room ? roomInteractiveParam(room, typeof roomId === 'string' ? core.rooms.find((candidate) => candidate.id === roomId)?.visualId : undefined) : undefined,
                )]),
                ...events.flatMap((event) => buildRoomExploredEventEntries(
                    command,
                    state,
                    event,
                )),
            ];
        }
        case BETRAYAL_COMMANDS.USE_POSSESSION:
            return entry(command, state, [i18nSeg('actionLog.usePossession', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.USE_RABBIT_FOOT:
            return entry(command, state, [i18nSeg('actionLog.useRabbitFoot', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM:
            return entry(command, state, [i18nSeg('actionLog.useRollRerollItem', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.ROLL_EVENT: {
            const recentRoll = core.recentRoll;
            const sourceTitle = stringValue(payload.sourceTitle);
            if (
                !recentRoll
                || recentRoll.kind !== 'eventDiceRoll'
                || (sourceTitle && recentRoll.sourceTitle !== sourceTitle)
            ) {
                return null;
            }
            const total = recentRoll.dice.reduce((sum, value) => sum + value, 0)
                + recentRoll.passiveBonus;
            const rollLabel = recentRoll.rollLabel
                || `投 ${recentRoll.dice.length} 颗骰子`;
            return entry(command, state, [i18nSeg(
                'actionLog.eventRollResult',
                playerParams(command.playerId, {
                    event: recentRoll.sourceTitle,
                    roll: rollLabel,
                    total,
                    result: recentRoll.latestLabel,
                }),
            )]);
        }
        case BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE:
            return entry(command, state, [i18nSeg('actionLog.resolveEventChoice', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL: {
            const damageEntries = buildEventRolledDamageEntries(command, state, core);
            return damageEntries.length > 0 ? damageEntries : null;
        }
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION:
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL:
            return null;
        case BETRAYAL_COMMANDS.USE_ROOM_EFFECT: {
            const room = roomNameOf(core, core.currentExplorer.roomId);
            return entry(command, state, [i18nSeg(
                room ? 'actionLog.useRoomEffectAt' : 'actionLog.useRoomEffect',
                room ? playerParams(command.playerId, { room }) : playerParams(command.playerId),
                undefined,
                room ? roomInteractiveParam(room, roomVisualIdOf(core, core.currentExplorer.roomId)) : undefined,
            )]);
        }
        case BETRAYAL_COMMANDS.TRADE_POSSESSION:
            return entry(command, state, [i18nSeg('actionLog.tradeRequest', playerParams(command.playerId, {
                targetPlayerId: typeof payload.targetPlayerId === 'string' ? payload.targetPlayerId : '?',
            }))]);
        case BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT:
            return entry(command, state, [i18nSeg(
                payload.accept === false
                    ? 'actionLog.declineTrade'
                    : 'actionLog.acceptTrade',
                playerParams(command.playerId),
            )]);
        case BETRAYAL_COMMANDS.LOOT_CORPSE:
            return entry(command, state, [i18nSeg('actionLog.lootCorpse', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.END_TURN:
            return entry(command, state, [i18nSeg('actionLog.endTurn', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL:
            return null;
        case BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION:
            return buildDamageAllocationEntry(command, state, events)
                ?? entry(command, state, [i18nSeg('actionLog.resolveDamageAllocation', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.HAUNT_ATTACK: {
            const key = payload.target === 'traitor'
                ? 'actionLog.attackTraitor'
                : payload.target === 'jack-spirit'
                    ? 'actionLog.attackJackSpirit'
                    : payload.target === 'troll-hand'
                        ? 'actionLog.attackTrollHand'
                    : 'actionLog.attackHero';
            return entry(command, state, [i18nSeg(key, playerParams(command.playerId))]);
        }
        case BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE:
            return entry(command, state, [i18nSeg('actionLog.resolveMonsterDamage', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START:
            return entry(command, state, [i18nSeg('actionLog.resolveMonsterTurnStart', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP:
            return entry(command, state, [i18nSeg('actionLog.rollMonsterMovementGroup', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM:
            return entry(command, state, [i18nSeg('actionLog.moveMonster', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO:
            return entry(command, state, [i18nSeg('actionLog.monsterAttackHero', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.PLAY_PEEKABOO:
            return entry(command, state, [i18nSeg('actionLog.playPeekaboo', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN:
            return entry(command, state, [i18nSeg('actionLog.endBloodFromStoneMonsterTurn', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS:
            return entry(command, state, [i18nSeg('actionLog.placeBloodFromStoneExtraStoneCherubs', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND:
            return entry(command, state, [i18nSeg('actionLog.moveTrollHand', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK:
            return entry(command, state, [i18nSeg(
                payload.combined === true
                    ? 'actionLog.trollHandCombinedAttack'
                    : 'actionLog.trollHandAttack',
                playerParams(command.playerId),
            )]);
        case BETRAYAL_COMMANDS.RESOLVE_HELPING_HANDS_ATTACK_REWARD:
            return entry(command, state, [i18nSeg(
                payload.choice === 'steal'
                    ? 'actionLog.resolveTrollHandAttackRewardSteal'
                    : 'actionLog.resolveTrollHandAttackRewardDamage',
                playerParams(command.playerId),
            )]);
        case BETRAYAL_COMMANDS.END_HELPING_HANDS_MONSTER_TURN:
            return entry(command, state, [i18nSeg('actionLog.endTrollHandMonsterTurn', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.LEARN_ABOUT_JACK:
            return entry(command, state, [i18nSeg('actionLog.learnAboutJack', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.STUDY_EXORCISM:
            return entry(command, state, [i18nSeg('actionLog.studyExorcism', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.EXORCISE_JACK:
            return entry(command, state, [i18nSeg('actionLog.exorciseJack', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.STUDY_MUMMY_NAME:
            return entry(command, state, [i18nSeg('actionLog.studyMummyName', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.LEARN_MUMMY_BANISHMENT:
            return entry(command, state, [i18nSeg('actionLog.learnMummyBanishment', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.BANISH_MUMMY:
            return entry(command, state, [i18nSeg('actionLog.banishMummy', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD:
            return entry(command, state, [i18nSeg(
                payload.choice === 'steal'
                    ? 'actionLog.resolveMummyAttackRewardSteal'
                    : 'actionLog.resolveMummyAttackRewardDamage',
                playerParams(command.playerId),
            )]);
        case BETRAYAL_COMMANDS.PICK_UP_MUMMY_GIRL:
            return entry(command, state, [i18nSeg('actionLog.pickUpMummyGirl', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.GIVE_GIRL_TO_MUMMY:
            return entry(command, state, [i18nSeg('actionLog.giveGirlToMummy', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.GIVE_OMEN_TO_MUMMY:
            return entry(command, state, [i18nSeg('actionLog.giveOmenToMummy', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.SEARCH_FOR_CURE:
            return entry(command, state, [i18nSeg('actionLog.searchForCure', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.CURE_THE_DUST:
            return entry(command, state, [i18nSeg('actionLog.cureTheDust', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE:
            return entry(command, state, [i18nSeg('actionLog.requestSicknessExchange', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.RESOLVE_SICKNESS_EXCHANGE:
            return entry(command, state, [i18nSeg(
                payload.accept === false
                    ? 'actionLog.declineSicknessExchange'
                    : 'actionLog.acceptSicknessExchange',
                playerParams(command.playerId),
            )]);
        case BETRAYAL_COMMANDS.TAKE_PHOTO:
            return entry(command, state, [i18nSeg('actionLog.takePhoto', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.SMASH_MAGIC_CAMERA:
            return entry(command, state, [i18nSeg('actionLog.smashMagicCamera', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK:
            return entry(command, state, [i18nSeg('actionLog.phantomPhotographerAttack', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.GIVE_MIRROR_HINT:
            return entry(command, state, [i18nSeg('actionLog.giveMirrorHint', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.BREAK_MIRROR_CURSE:
            return entry(command, state, [i18nSeg('actionLog.breakMirrorCurse', playerParams(command.playerId))]);
        case BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY:
            return null;
        case BETRAYAL_COMMANDS.COMPLETE_SCENARIO:
            return entry(command, state, [i18nSeg('actionLog.completeScenario', playerParams(command.playerId))]);
        default:
            return null;
    }
}
