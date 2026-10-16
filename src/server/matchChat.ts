import type { Server, Socket } from 'socket.io';
import { nanoid } from 'nanoid';
import { MATCH_CHAT_EVENTS, MAX_CHAT_MESSAGES, type MatchChatIdentity, type MatchChatMessage, type MatchChatResult } from '../shared/chat';
import type { MatchMetadata, MatchStorage } from '../engine/transport/storage';
import { sanitizeChatText } from './chatUtils';

// 历史与 Socket 路由共享同一个频道合同；旧消息保持原有的全房间可见性。
export const chatHistoryByMatch = new Map<string, MatchChatMessage[]>();
const chatSendsInFlight = new Map<string, { fingerprint: string; promise: Promise<MatchChatResult> }>();
const roomKey = (matchId: string, channel: string) => `matchchat:${matchId}:${channel}`;
export const resolveChatPlayer = (metadata: MatchMetadata, identity: MatchChatIdentity) => {
    const player = identity.playerId != null ? metadata.players[identity.playerId] : undefined;
    return player?.credentials && identity.credentials === player.credentials ? player : null;
};
export const getVisibleChatHistory = (history: MatchChatMessage[], isPlayer: boolean) => (
    history.filter(message => message.channel !== 'players' || isPlayer)
);

export function registerMatchChat(io: Server, socket: Socket, storage: Pick<MatchStorage, 'fetch'>) {
    let joined: { matchId: string; identity: MatchChatIdentity } | undefined;
    let joinRevision = 0;
    const leave = () => {
        joinRevision += 1;
        if (joined) {
            void socket.leave(roomKey(joined.matchId, 'room'));
            void socket.leave(roomKey(joined.matchId, 'players'));
        }
        joined = undefined;
        socket.data.matchChatIdentity = undefined;
    };
    socket.on(MATCH_CHAT_EVENTS.LEAVE, leave);
    socket.on('disconnect', leave);
    socket.on(MATCH_CHAT_EVENTS.JOIN, async (payload?: MatchChatIdentity & { matchId?: string }) => {
        leave();
        const revision = joinRevision;
        if (!payload?.matchId) return;
        try {
            const { metadata } = await storage.fetch(payload.matchId, { metadata: true });
            if (!metadata || !socket.connected || revision !== joinRevision) return;
            const identity: MatchChatIdentity = {
                playerId: payload.playerId, credentials: payload.credentials,
                senderName: typeof payload.senderName === 'string' ? (sanitizeChatText(payload.senderName) ?? '').slice(0, 40) : undefined,
            };
            const player = resolveChatPlayer(metadata, identity);
            joined = { matchId: payload.matchId, identity };
            socket.data.matchChatIdentity = identity;
            await socket.join(roomKey(joined.matchId, 'room'));
            if (player) await socket.join(roomKey(joined.matchId, 'players'));
            // join/leave 在 adapter 异步操作期间仍可能发生；过期任务不能回推历史。
            if (revision !== joinRevision) return;
            socket.emit(MATCH_CHAT_EVENTS.HISTORY, getVisibleChatHistory(chatHistoryByMatch.get(joined.matchId) ?? [], !!player));
        } catch {
            // 加入失败时不建立成员身份，发送会返回 not_joined。
        }
    });
    socket.on(MATCH_CHAT_EVENTS.SEND, async (
        payload: { text?: string; channel?: string; clientMessageId?: string } | undefined,
        ack?: (result: MatchChatResult) => void,
    ) => {
        const membership = joined;
        if (!membership) { ack?.({ ok: false, reason: 'not_joined' }); return; }
        const clientMessageId = payload?.clientMessageId;
        if (clientMessageId !== undefined && (typeof clientMessageId !== 'string' || !/^[\w-]{1,100}$/.test(clientMessageId))) {
            ack?.({ ok: false, reason: 'invalid_message' }); return;
        }
        const channel = payload?.channel ?? 'room';
        const text = typeof payload?.text === 'string' ? sanitizeChatText(payload.text) : '';
        if ((channel !== 'players' && channel !== 'room') || !text) {
            ack?.({ ok: false, reason: 'invalid_message' }); return;
        }
        const fingerprint = JSON.stringify([channel, text, membership.identity.playerId ?? null]);
        const requestKey = clientMessageId ? `${membership.matchId}:${clientMessageId}` : undefined;
        if (requestKey) {
            const prior = chatHistoryByMatch.get(membership.matchId)?.find(message => message.clientMessageId === clientMessageId);
            if (prior) {
                ack?.(prior.channel === channel && prior.text === text ? { ok: true } : { ok: false, reason: 'invalid_message' });
                return;
            }
            const inFlight = chatSendsInFlight.get(requestKey);
            if (inFlight) {
                ack?.(inFlight.fingerprint === fingerprint ? await inFlight.promise : { ok: false, reason: 'invalid_message' });
                return;
            }
        }
        const operation = (async (): Promise<MatchChatResult> => {
        try {
            const { metadata } = await storage.fetch(membership.matchId, { metadata: true });
            if (!metadata) { leave(); return { ok: false, reason: 'match_not_found' }; }
            if (joined !== membership) return { ok: false, reason: 'not_joined' };
            const player = resolveChatPlayer(metadata, membership.identity);
            if (!player) await socket.leave(roomKey(membership.matchId, 'players'));
            if (channel === 'players' && !player) return { ok: false, reason: 'not_player' };
            const message: MatchChatMessage = {
                id: nanoid(), clientMessageId, matchId: membership.matchId, channel, text,
                senderId: player ? membership.identity.playerId : socket.id,
                senderName: player?.name || membership.identity.senderName || '观众',
                senderRole: player ? 'player' : 'spectator', createdAt: new Date().toISOString(),
            };
            // 发送前重新核验玩家订阅，离座或凭证失效后不能继续接收私有消息。
            if (channel === 'players') {
                const recipients = await io.in(roomKey(membership.matchId, 'players')).fetchSockets();
                for (const recipient of recipients) {
                    const identity = recipient.data.matchChatIdentity as MatchChatIdentity | undefined;
                    if (!identity || !resolveChatPlayer(metadata, identity)) await recipient.leave(roomKey(membership.matchId, 'players'));
                }
            }
            // 可能失败的 adapter 操作完成后才落历史，避免失败回执留下可见消息并在重试时重复。
            const history = [...(chatHistoryByMatch.get(membership.matchId) ?? []), message];
            // 每个频道各自保留上限，公共聊天不能挤掉玩家频道历史。
            const other = channel === 'room' ? 'players' : 'room';
            chatHistoryByMatch.set(membership.matchId, [
                ...history.filter(item => (item.channel ?? 'room') === other).slice(-MAX_CHAT_MESSAGES),
                ...history.filter(item => (item.channel ?? 'room') === channel).slice(-MAX_CHAT_MESSAGES),
            ].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
            io.to(roomKey(membership.matchId, channel)).emit(MATCH_CHAT_EVENTS.MESSAGE, message);
            return { ok: true };
        } catch { return { ok: false, reason: 'unavailable' }; }
        })();
        if (requestKey) chatSendsInFlight.set(requestKey, { fingerprint, promise: operation });
        const result = await operation;
        if (requestKey) chatSendsInFlight.delete(requestKey);
        ack?.(result);
    });
}
