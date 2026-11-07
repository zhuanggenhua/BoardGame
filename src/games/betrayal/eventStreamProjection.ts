import type { GameEvent } from '../../engine/types';

// Events are server-side facts. Clients need only these public presentation
// fields for movement and feedback, not reducer snapshots or future decks.
const PRESENTATION_FIELDS: Readonly<Record<string, readonly string[]>> = {
  EXPLORER_MOVED: ['playerId', 'roomId', 'controlledToken', 'skeletonKeyCardId', 'usedActionId'],
  ROOM_EXPLORED: ['playerId', 'roomId', 'deckKind', 'hauntTriggered'],
  EVENT_CHOICE_RESOLVED: ['hauntTriggered'],
  POSSESSION_USED: ['cardId'],
  MONSTER_MOVED: ['monsterId', 'fromRoomId', 'toRoomId', 'teleportMove'],
  HELPING_HANDS_TROLL_HAND_MOVED: ['monsterId', 'fromRoomId', 'toRoomId'],
  HELPING_HANDS_ATTACK_REWARD_RESOLVED: ['choice'],
  MUMMY_ATTACK_REWARD_RESOLVED: ['choice'],
  JACK_EXORCISED: ['success'],
  MUMMY_BANISHED: ['success'],
};

export function projectBetrayalEventForPresentation(event: GameEvent): GameEvent {
  const input = event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
    ? event.payload as Record<string, unknown> : {};
  const payload: Record<string, string | number | boolean | null> = {};
  const fields = Object.prototype.hasOwnProperty.call(PRESENTATION_FIELDS, event.type) ? PRESENTATION_FIELDS[event.type] : [];
  for (const field of fields) {
    const value = input[field];
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      payload[field] = value;
    }
  }
  return {
    type: event.type,
    timestamp: event.timestamp,
    payload,
    ...(event.sourceCommandType === undefined ? {} : { sourceCommandType: event.sourceCommandType }),
    ...(event.sfxKey === undefined ? {} : { sfxKey: event.sfxKey }),
    ...(event.audioKey === undefined ? {} : { audioKey: event.audioKey }),
  };
}
