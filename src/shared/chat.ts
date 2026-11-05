export const MAX_CHAT_LENGTH = 200;
export const MAX_CHAT_MESSAGES = 200;

export type MatchChatChannel = 'players' | 'room';
export interface MatchChatIdentity {
    playerId?: string;
    credentials?: string;
    senderName?: string;
}
export interface MatchChatMessage {
    id: string;
    clientMessageId?: string;
    matchId: string;
    channel?: MatchChatChannel;
    senderId?: string;
    senderName: string;
    senderRole?: 'player' | 'spectator';
    text: string;
    createdAt: string;
}
export const MATCH_CHAT_EVENTS = {
    JOIN: 'matchChat:join', LEAVE: 'matchChat:leave', SEND: 'matchChat:send',
    MESSAGE: 'matchChat:message', HISTORY: 'matchChat:history',
} as const;
export type MatchChatResult = { ok: true } | {
    ok: false;
    reason: 'not_connected' | 'not_joined' | 'not_player' | 'match_not_found' | 'invalid_message' | 'unavailable';
};
