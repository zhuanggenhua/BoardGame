import type { ActionLogEntry, ActionLogSegment, Command, GameEvent, MatchState } from '../../engine/types';
import { FATE_ATTACK_BY_ID, FATE_MASTERS } from './data';
import { resolveFatePlayerAbility } from './domain/abilityRegistry';
import type { FateBattleScoreAdjustedEvent, FateDefeatDeclaredEvent, FateDefeatPreventedEvent, FateDominationCore, LocationId } from './domain/types';

export const FATE_LOG_COMMANDS = [
    'SELECT_MASTER', 'SELECT_SERVANT', 'DEPLOY_MASTER', 'CONFIRM_ATTACK', 'INSPECT_CARD',
    'ADVANCE_PHASE', 'MOVE_PLAYER', 'PASS_ACTION', 'RESOLVE_LOCATION', 'PLAY_SKILL', 'USE_COMMAND_SPELL', 'SYS_INTERACTION_RESPOND',
] as const;

// 确认攻击提交的是尚未写入权威状态的两张牌，因此是独立决策点。
export const FATE_UNDO_COMMANDS = [
    'SELECT_MASTER', 'SELECT_SERVANT', 'DEPLOY_MASTER', 'CONFIRM_ATTACK', 'MOVE_PLAYER', 'PLAY_SKILL', 'USE_COMMAND_SPELL',
] as const;

function segment(key: string, params?: Record<string, string>, paramI18nKeys?: string[]): ActionLogSegment {
    return { type: 'i18n', ns: 'game-fate-domination', key: `log.${key}`, ...(params && { params }), ...(paramI18nKeys && { paramI18nKeys }) };
}

function formatFateCommandLog({ command, state, events, afterEventsRound }: {
    command: Command; state: MatchState<unknown>; events: GameEvent[]; afterEventsRound: number;
}): ActionLogEntry | null {
    const core = state.core as FateDominationCore;
    const payload = (command.payload ?? {}) as Record<string, unknown>;
    const player = core.players[command.playerId];
    const skillId = typeof payload.skillId === 'string' ? payload.skillId : '';
    const ability = skillId ? resolveFatePlayerAbility(core, command.playerId, skillId) : undefined;
    const masterName = FATE_MASTERS.find(master => master.id === payload.masterId)?.name;
    const locationId = typeof payload.locationId === 'string' ? payload.locationId as LocationId : undefined;
    const location = locationId && core.battlefield[locationId] ? `log.locations.${locationId}` : 'log.unknownLocation';
    const cardId = payload.cardId;
    const handCard = player?.hand.find(card => card.id === cardId);
    const cardName = handCard ? FATE_ATTACK_BY_ID[handCard.definitionId]?.name
        : cardId === core.situation.id ? core.situation.name : cardId === core.miyamaEvent.id ? core.miyamaEvent.name : undefined;
    const resolved = command.type === 'SYS_INTERACTION_RESPOND' ? events.find(event => [
        'FATE_RIDING_CARDS_PLAYED', 'FATE_CHARIOT_RESOLVED', 'FATE_INVESTIGATION_RESOLVED',
        'FATE_POST_BATTLE_SEAL_CHOSEN', 'FATE_BATTLEFIELD_ATTACK_DECIDED',
    ].includes(event.type)) : undefined;
    const timestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;
    const sequence = state.sys.eventStream?.nextId ?? 0;
    if (resolved) {
        const result = resolved.payload as { cardIds?: string[]; restore?: boolean; placed?: boolean };
        const labels: Record<string, ActionLogSegment | undefined> = {
            FATE_RIDING_CARDS_PLAYED: result.cardIds?.length ? segment('ridingPlayed') : undefined,
            FATE_CHARIOT_RESOLVED: segment('chariotResolved'),
            FATE_INVESTIGATION_RESOLVED: segment('investigationResolved'),
            FATE_POST_BATTLE_SEAL_CHOSEN: result.restore ? segment('restoreSeal') : undefined,
            FATE_BATTLEFIELD_ATTACK_DECIDED: segment(result.placed ? 'fieldPlaced' : 'fieldClosed'),
        };
        const label = labels[resolved.type];
        return label ? { id: `${resolved.type}-${command.playerId}-${timestamp}-${sequence}`, timestamp,
            actorId: command.playerId, kind: resolved.type, segments: [label] } : null;
    }
    if (afterEventsRound !== 0 || command.type === 'SYS_INTERACTION_RESPOND') return null;
    const revealedHand = events.some(event => (event.type === 'ATTACKS_CONFIRMED' || event.type === 'ACTION_PASSED')
        && (event.payload as { revealHand?: boolean }).revealHand === true);
    const labels: Record<string, ActionLogSegment> = {
        SELECT_MASTER: segment('selectMaster', { name: masterName ?? 'log.unknownMaster' }, masterName ? undefined : ['name']),
        SELECT_SERVANT: segment('selectServant'),
        DEPLOY_MASTER: segment('deploy', { location }, ['location']),
        CONFIRM_ATTACK: segment(revealedHand ? 'confirmAttackWithRevealedHand' : 'confirmAttack'),
        INSPECT_CARD: cardName ? segment('inspectNamed', { name: cardName }) : segment('inspect'),
        ADVANCE_PHASE: events.some(event => event.type === 'INITIAL_ATTACK_HAND_DEALT')
            ? segment('finishSetup') : segment('advance', { phase: `phases.${core.phase}` }, ['phase']),
        MOVE_PLAYER: segment('move', { location }, ['location']),
        PASS_ACTION: segment(revealedHand ? 'passWithRevealedHand' : 'pass'),
        RESOLVE_LOCATION: segment('resolveLocation', { location }, ['location']),
        PLAY_SKILL: ability?.effects.some(effect => effect.type === 'riding') ? segment('riding')
            : ability ? segment('playSkill', { name: ability.name }) : segment('playAbility'),
        USE_COMMAND_SPELL: segment('commandSpell'),
    };
    const label = labels[command.type];
    if (!label || (command.type === 'PLAY_SKILL' && events.some(event => event.type === 'FATE_ABILITY_UNIMPLEMENTED'))) return null;
    const entry: ActionLogEntry & { fatePrivateInspection?: boolean } = {
        id: `${command.type}-${command.playerId}-${timestamp}-${sequence}`, timestamp,
        actorId: command.playerId, kind: command.type, segments: [label],
        ...(command.type === 'INSPECT_CARD' && { fatePrivateInspection: Boolean(handCard) }),
    };
    return entry;
}

export function formatFateActionLog(args: Parameters<typeof formatFateCommandLog>[0]): ActionLogEntry[] {
    const commandEntry = formatFateCommandLog(args);
    const entries = commandEntry ? [commandEntry] : [];
    const timestamp = args.command.timestamp ?? 0;
    const sequence = args.state.sys.eventStream?.nextId ?? 0;
    const append = (id: string, actorId: string, kind: string, label: ActionLogSegment) => {
        entries.push({ id, timestamp, actorId, kind, segments: [label] });
    };
    for (const event of args.events) {
        if (event.type === 'FATE_DEFEAT_DECLARED') {
            const { playerId, markerId } = (event as FateDefeatDeclaredEvent).payload;
            append(`fate-defeat-${markerId}-${sequence}`, playerId, event.type, segment('battleDefeat'));
        }
        if (event.type === 'FATE_DEFEAT_PREVENTED') {
            const { playerId, sourceId } = (event as FateDefeatPreventedEvent).payload;
            append(`fate-defeat-prevented-${sourceId}-${playerId}-${sequence}`, playerId, event.type, segment('battleDefeatPrevented'));
        }
        if (event.type === 'FATE_BATTLE_SCORE_ADJUSTED') {
            const { sourceId, changes } = (event as FateBattleScoreAdjustedEvent).payload;
            for (const { playerId, amount } of changes) {
                append(`fate-score-${sourceId}-${playerId}-${sequence}`, playerId, event.type,
                    segment(amount > 0 ? 'battleScoreGain' : 'battleScoreLoss', { amount: String(Math.abs(amount)) }));
            }
        }
    }
    return entries;
}

export function projectFateLogEntry(entry: ActionLogEntry, core: FateDominationCore, viewerId: string): ActionLogEntry {
    if (entry.kind === 'SELECT_SERVANT') return { ...entry, segments: [segment('selectServant')] };
    if (entry.kind === 'SELECT_ATTACK_CARD') return { ...entry, segments: [segment('legacySelection')] };
    if (entry.kind === 'INSPECT_CARD' && entry.actorId !== viewerId) {
        const publicNames = [core.situation.name, core.miyamaEvent.name];
        const isPublic = entry.segments.some(part => part.type === 'i18n'
            ? part.key === 'log.inspectNamed' && publicNames.some(name => part.params?.name === name)
            : part.type === 'text' && publicNames.some(name => part.text === `查看卡牌：${name}`));
        if ((entry as ActionLogEntry & { fatePrivateInspection?: boolean }).fatePrivateInspection !== false || !isPublic) {
            return { ...entry, segments: [segment('inspect')] };
        }
    }
    return entry;
}
