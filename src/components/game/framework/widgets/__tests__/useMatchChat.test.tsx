import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchChatMessage } from '../../../../../shared/chat';
import { useMatchChat } from '../useMatchChat';

const state = vi.hoisted(() => ({
    onMessage: null as null | ((message: MatchChatMessage) => void),
    onHistory: null as null | ((messages: MatchChatMessage[]) => void),
    send: vi.fn(), error: vi.fn(), join: vi.fn(), leave: vi.fn(),
}));
vi.mock('../../../../../services/matchSocket', () => ({ matchSocket: {
    joinChat: state.join, leaveChat: state.leave, sendChat: state.send,
    subscribeChat: (callback: typeof state.onMessage) => { state.onMessage = callback; return () => { state.onMessage = null; }; },
    subscribeChatHistory: (callback: typeof state.onHistory) => { state.onHistory = callback; return () => { state.onHistory = null; }; },
    isOwnChatMessage: (message: MatchChatMessage) => message.senderId === '0',
} }));
vi.mock('../../../../../contexts/ToastContext', () => ({ useToast: () => ({ error: state.error }) }));
const options = { isOnline: true, matchId: 'a', playerId: '0', credentials: 'secret', displayName: '房主' };
const message = (channel: 'players' | 'room', id = 'message'): MatchChatMessage => ({
    id, channel, matchId: 'a', senderId: '1', senderName: '朋友', senderRole: 'player', text: '你好', createdAt: '2026-10-15T00:00:00Z',
});

describe('同窗口聊天频道交互', () => {
    beforeEach(() => { vi.clearAllMocks(); state.send.mockResolvedValue({ ok: true }); });
    it('切换频道分别保留草稿，离开房间后清空旧会话', async () => {
        const { result, rerender } = renderHook(props => useMatchChat(props), { initialProps: options });
        act(() => result.current.setInput('只给玩家的草稿'));
        act(() => result.current.selectChannel('room'));
        expect(result.current.input).toBe('');
        act(() => result.current.setInput('公开草稿'));
        act(() => result.current.selectChannel('players'));
        expect(result.current.input).toBe('只给玩家的草稿');
        rerender({ ...options, matchId: 'b' });
        await waitFor(() => expect(result.current.input).toBe(''));
    });
    it('另一频道独立累计未读，打开当前频道不会清掉另一频道', () => {
        const { result } = renderHook(() => useMatchChat(options));
        act(() => result.current.onOpenChange(true));
        act(() => state.onMessage?.(message('room')));
        expect(result.current.unread).toEqual({ players: 0, room: 1 });
        act(() => result.current.onOpenChange(false));
        act(() => result.current.onOpenChange(true));
        expect(result.current.unread.room).toBe(1);
        act(() => result.current.selectChannel('room'));
        expect(result.current.unreadTotal).toBe(0);
    });
    it('重复收到同一消息 ID 不重复触发未读和提醒', () => {
        const { result } = renderHook(() => useMatchChat(options));
        const replayedMessage = message('room', 'stable-replay-id');
        act(() => result.current.selectChannel('room'));

        act(() => state.onMessage?.(replayedMessage));
        const latestIncoming = result.current.latestIncoming;
        act(() => state.onMessage?.(replayedMessage));

        expect(result.current.messages).toEqual([replayedMessage]);
        expect(result.current.unread.room).toBe(1);
        expect(result.current.latestIncoming).toBe(latestIncoming);
    });
    it('房间频道流量不会挤掉仍保留的玩家频道去重记录', () => {
        const { result } = renderHook(() => useMatchChat(options));
        const olderPlayerMessage = message('players', 'older-player-message');

        act(() => {
            state.onMessage?.(olderPlayerMessage);
            for (let index = 0; index < 400; index += 1) {
                state.onMessage?.(message('room', `room-${index}`));
            }
            state.onMessage?.(olderPlayerMessage);
        });

        expect(result.current.unread.players).toBe(1);
        expect(result.current.messages).toEqual([olderPlayerMessage]);
    });
    it('观众默认进入房间频道，私有历史和实时事件不能进入消息或未读', () => {
        const { result } = renderHook(() => useMatchChat({ ...options, playerId: null, credentials: undefined }));
        expect(result.current.channel).toBe('room');
        act(() => { state.onHistory?.([message('players')]); state.onMessage?.(message('players', 'live')); });
        expect(result.current.messages).toEqual([]);
        expect(result.current.unreadTotal).toBe(0);
        act(() => result.current.selectChannel('players'));
        expect(result.current.channel).toBe('room');
    });
    it('服务端拒绝发送时保留原频道草稿并显示错误', async () => {
        state.send.mockResolvedValue({ ok: false, reason: 'not_player' });
        const { result } = renderHook(() => useMatchChat(options));
        act(() => result.current.setInput('需要保留的消息'));
        await act(async () => { await result.current.send(); });
        expect(result.current.input).toBe('需要保留的消息');
        expect(state.send).toHaveBeenCalledWith('需要保留的消息', 'players', expect.any(String));
        expect(state.error).toHaveBeenCalled();
    });
    it('发送确认超时时保留同一个请求 ID，重试不会重复广播', async () => {
        state.send.mockResolvedValueOnce({ ok: false, reason: 'unavailable' }).mockResolvedValueOnce({ ok: true });
        const { result } = renderHook(() => useMatchChat(options));
        act(() => result.current.setInput('网络延迟的消息'));
        await act(async () => { await result.current.send(); });
        const firstId = state.send.mock.calls[0][2];
        await act(async () => { await result.current.send(); });
        expect(state.send.mock.calls[1][2]).toBe(firstId);
        expect(result.current.input).toBe('');
    });
});
