// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { io, type Socket } from 'socket.io-client';
import { chatHistoryByMatch, registerMatchChat } from '../matchChat';
import { MATCH_CHAT_EVENTS, type MatchChatMessage, type MatchChatIdentity } from '../../shared/chat';
import type { MatchMetadata } from '../../engine/transport/storage';

describe('对局聊天频道的服务端权限', () => {
    let http: HttpServer;
    let server: Server;
    let url: string;
    let metadata: MatchMetadata;
    const clients: Socket[] = [];
    const join = async (identity: MatchChatIdentity = {}) => {
        const socket = io(url, { transports: ['websocket'], forceNew: true });
        clients.push(socket);
        await new Promise<void>(resolve => socket.once('connect', resolve));
        const history = new Promise<MatchChatMessage[]>(resolve => socket.once(MATCH_CHAT_EVENTS.HISTORY, resolve));
        socket.emit(MATCH_CHAT_EVENTS.JOIN, { matchId: 'match', ...identity });
        return { socket, history: await history };
    };
    const send = (socket: Socket, channel: string, text: string, clientMessageId?: string) => socket.timeout(1500).emitWithAck(MATCH_CHAT_EVENTS.SEND, { channel, text, clientMessageId });
    beforeEach(async () => {
        metadata = { gameName: 'dicethrone', createdAt: 0, updatedAt: 0, players: {
            '0': { name: '房主', credentials: 'host-secret' }, '1': { name: '客座', credentials: 'guest-secret' },
        } };
        chatHistoryByMatch.clear();
        http = createServer(); server = new Server(http);
        server.on('connection', socket => registerMatchChat(server, socket, { fetch: async id => ({ metadata: id === 'match' ? metadata : undefined }) }));
        await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
        const address = http.address();
        if (!address || typeof address === 'string') throw new Error('未分配测试端口');
        url = `http://127.0.0.1:${address.port}`;
    });
    afterEach(async () => {
        clients.splice(0).forEach(socket => socket.disconnect());
        await new Promise<void>(resolve => server.close(() => resolve()));
        chatHistoryByMatch.clear();
        vi.restoreAllMocks();
    });
    it('玩家频道只向有效座位广播，观众公共发言对双方可见且身份由服务端确定', async () => {
        const host = await join({ playerId: '0', credentials: 'host-secret', senderName: '伪造名字' });
        const guest = await join({ playerId: '1', credentials: 'guest-secret' });
        const spectator = await join({ playerId: '0', credentials: 'wrong', senderName: '围观朋友' });
        const guestMessages: MatchChatMessage[] = []; const audienceMessages: MatchChatMessage[] = [];
        guest.socket.on(MATCH_CHAT_EVENTS.MESSAGE, message => guestMessages.push(message));
        spectator.socket.on(MATCH_CHAT_EVENTS.MESSAGE, message => audienceMessages.push(message));
        expect(await send(host.socket, 'players', '私有消息')).toEqual({ ok: true });
        const received = new Promise<MatchChatMessage>(resolve => host.socket.once(MATCH_CHAT_EVENTS.MESSAGE, resolve));
        expect(await send(spectator.socket, 'room', '大家好')).toEqual({ ok: true });
        expect(await received).toMatchObject({ senderName: '围观朋友', senderRole: 'spectator', channel: 'room' });
        expect(guestMessages[0]).toMatchObject({ text: '私有消息', senderName: '房主', senderRole: 'player' });
        expect(audienceMessages.map(message => message.text)).toEqual(['大家好']);
    });
    it('观众不能通过指定玩家ID或频道发送私有消息', async () => {
        const { socket } = await join({ playerId: '0' });
        expect(await send(socket, 'players', '越权')).toEqual({ ok: false, reason: 'not_player' });
        expect(await send(socket, 'admin', '越权')).toEqual({ ok: false, reason: 'invalid_message' });
        expect(chatHistoryByMatch.size).toBe(0);
    });
    it('玩家频道 adapter 广播失败时不把失败消息写入历史', async () => {
        const host = await join({ playerId: '0', credentials: 'host-secret' });
        const originalIn = server.in.bind(server);
        vi.spyOn(server, 'in').mockImplementation((rooms) => {
            const operator = originalIn(rooms);
            vi.spyOn(operator, 'fetchSockets').mockRejectedValue(new Error('adapter unavailable'));
            return operator;
        });
        expect(await send(host.socket, 'players', '不应留下的消息')).toEqual({ ok: false, reason: 'unavailable' });
        expect(chatHistoryByMatch.get('match') ?? []).toEqual([]);
    });
    it('同一发送请求并发重试时只广播和记录一次', async () => {
        const host = await join({ playerId: '0', credentials: 'host-secret' });
        const received: MatchChatMessage[] = [];
        host.socket.on(MATCH_CHAT_EVENTS.MESSAGE, message => received.push(message));
        const results = await Promise.all([
            send(host.socket, 'players', '只应出现一次', 'retry-request-1'),
            send(host.socket, 'players', '只应出现一次', 'retry-request-1'),
        ]);
        expect(results).toEqual([{ ok: true }, { ok: true }]);
        expect(chatHistoryByMatch.get('match')).toHaveLength(1);
        expect(received).toHaveLength(1);
    });
    it('重新加入只回推有权读取的历史，旧全房间消息不变为私有', async () => {
        const host = await join({ playerId: '0', credentials: 'host-secret' });
        await send(host.socket, 'players', '玩家讨论'); await send(host.socket, 'room', '公开讨论');
        expect((await join()).history.map(message => message.text)).toEqual(['公开讨论']);
        expect((await join({ playerId: '1', credentials: 'guest-secret' })).history.map(message => message.text)).toEqual(['玩家讨论', '公开讨论']);
    });
    it('已离座的客户端不能继续接收玩家频道', async () => {
        const host = await join({ playerId: '0', credentials: 'host-secret' });
        const guest = await join({ playerId: '1', credentials: 'guest-secret' });
        const received: MatchChatMessage[] = [];
        guest.socket.on(MATCH_CHAT_EVENTS.MESSAGE, message => received.push(message));
        delete metadata.players['1'].credentials;
        await send(host.socket, 'players', '离座后私有');
        const marker = new Promise<void>(resolve => guest.socket.once(MATCH_CHAT_EVENTS.MESSAGE, () => resolve()));
        await send(host.socket, 'room', '公开收口'); await marker;
        expect(received.map(message => message.text)).toEqual(['公开收口']);
        expect(await send(guest.socket, 'players', '过期凭证')).toEqual({ ok: false, reason: 'not_player' });
    });
});
