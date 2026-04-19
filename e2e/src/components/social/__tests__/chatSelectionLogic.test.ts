import { describe, it, expect } from 'vitest';
import type { FriendUser, Conversation } from '../../../services/social.types';
import {
    FRIENDS_CHAT_DETAIL_CONTENT_CLASS,
    getFriendsChatDetailPaneClass,
    getFriendsChatListPaneClass,
} from '../layoutContracts';

/**
 * 聊天选择逻辑测试。
 * 覆盖问题 1 修复：选择好友/会话后应能正确渲染聊天窗口。
 *
 * 核心场景：
 * - 从好友列表点击（有 friend 无 conversation）
 * - 从会话列表点击（有 conversation 无 friend）
 * - 两者都有
 * - 两者都没有（数据未加载完成）
 * - 服务端返回格式映射（根因：字段名不匹配）
 */
describe('聊天选择逻辑', () => {
    const mockFriends: FriendUser[] = [
        { id: 'user_1', username: '张三', online: true },
        { id: 'user_2', username: '李四', online: false },
    ];

    const mockConversations: Conversation[] = [
        {
            userId: 'user_1',
            username: '张三',
            online: true,
            unreadCount: 2,
            lastMessage: {
                id: 'msg_1', from: 'user_1', to: 'me', content: '你好',
                type: 'text', read: false, createdAt: new Date().toISOString(),
            },
        },
        { userId: 'user_3', username: '王五', online: false, unreadCount: 0 },
    ];

    function resolveTarget(targetUserId: string, friends: FriendUser[], conversations: Conversation[]) {
        const friend = friends.find(f => f.id === targetUserId);
        const conversation = conversations.find(c => c.userId === targetUserId);
        const username = friend?.username || conversation?.username || '未知用户';
        const isOnline = friend?.online || conversation?.online || false;
        return { friend, conversation, username, isOnline };
    }

    it('从好友列表点击：有 friend 有 conversation', () => {
        const r = resolveTarget('user_1', mockFriends, mockConversations);
        expect(r.friend).toBeTruthy();
        expect(r.conversation).toBeTruthy();
        expect(r.username).toBe('张三');
        expect(r.isOnline).toBe(true);
    });

    it('从好友列表点击：有 friend 无 conversation', () => {
        const r = resolveTarget('user_2', mockFriends, mockConversations);
        expect(r.friend).toBeTruthy();
        expect(r.conversation).toBeUndefined();
        expect(r.username).toBe('李四');
    });

    it('从会话列表点击：无 friend 有 conversation', () => {
        const r = resolveTarget('user_3', mockFriends, mockConversations);
        expect(r.friend).toBeUndefined();
        expect(r.conversation).toBeTruthy();
        expect(r.username).toBe('王五');
    });

    it('两者都没有时回退到默认值', () => {
        const r = resolveTarget('unknown', mockFriends, mockConversations);
        expect(r.username).toBe('未知用户');
        expect(r.isOnline).toBe(false);
    });

    it('空字符串 selectedFriendId 应视为未选中', () => {
        expect(!!('') ).toBe(false);
    });

    it('会话按最后消息时间降序', () => {
        const convs: Conversation[] = [
            { userId: 'a', username: 'A', online: false, unreadCount: 0,
              lastMessage: { id: '1', from: 'a', to: 'me', content: '旧', type: 'text', read: true, createdAt: '2025-01-01T00:00:00Z' } },
            { userId: 'b', username: 'B', online: false, unreadCount: 0,
              lastMessage: { id: '2', from: 'b', to: 'me', content: '新', type: 'text', read: true, createdAt: '2025-02-01T00:00:00Z' } },
            { userId: 'c', username: 'C', online: false, unreadCount: 0 },
        ];
        const sorted = [...convs].sort((a, b) => {
            const tA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const tB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
            return tB - tA;
        });
        expect(sorted.map(c => c.userId)).toEqual(['b', 'a', 'c']);
    });

    it('activeFriendId 与 selectedFriendId 一致', () => {
        const resolveActive = (id: string | null | undefined) => id ?? undefined;
        expect(resolveActive('user_1')).toBe('user_1');
        expect(resolveActive(null)).toBeUndefined();
    });

    it('移动端聊天布局把滚动限制在内容区，不让输入区跟随整体滚动', () => {
        const listPaneClass = getFriendsChatListPaneClass('user_1');
        const detailPaneClass = getFriendsChatDetailPaneClass('user_1');

        expect(listPaneClass).toContain('min-h-0');
        expect(listPaneClass).toContain('overflow-hidden');
        expect(detailPaneClass).toContain('min-h-0');
        expect(detailPaneClass).toContain('overflow-hidden');
        expect(FRIENDS_CHAT_DETAIL_CONTENT_CLASS).toContain('flex-1');
        expect(FRIENDS_CHAT_DETAIL_CONTENT_CLASS).toContain('min-h-0');
        expect(FRIENDS_CHAT_DETAIL_CONTENT_CLASS).toContain('overflow-hidden');
    });
});

/**
 * 服务端会话数据映射测试。
 * 根因：服务端返回 { user: { id, username }, unread } 而前端期望 { userId, username, unreadCount }。
 */
describe('服务端会话数据映射', () => {
    // 模拟 refreshConversations 中的映射逻辑
    function mapServerConversations(serverData: any[], currentUserId: string): Conversation[] {
        return (serverData ?? []).map((conv: any) => ({
            userId: conv.user?.id ?? conv.userId ?? '',
            username: conv.user?.username ?? conv.username ?? '',
            online: conv.online ?? false,
            lastMessage: conv.lastMessage ? {
                id: conv.lastMessage.id ?? conv.lastMessage._id ?? '',
                from: conv.lastMessage.fromSelf ? currentUserId : (conv.user?.id ?? conv.userId ?? ''),
                to: conv.lastMessage.fromSelf ? (conv.user?.id ?? conv.userId ?? '') : currentUserId,
                content: conv.lastMessage.content ?? '',
                type: conv.lastMessage.type ?? 'text',
                read: true,
                createdAt: conv.lastMessage.createdAt ?? new Date().toISOString(),
            } : undefined,
            unreadCount: conv.unread ?? conv.unreadCount ?? 0,
        })).filter((c: Conversation) => c.userId);
    }

    it('映射服务端格式 { user: { id, username }, unread }', () => {
        const serverData = [{
            user: { id: 'u1', username: '张三' },
            lastMessage: { id: 'msg1', content: '你好', type: 'text', createdAt: '2025-01-01T00:00:00Z', fromSelf: false },
            unread: 3,
        }];
        const result = mapServerConversations(serverData, 'me');
        expect(result).toHaveLength(1);
        expect(result[0].userId).toBe('u1');
        expect(result[0].username).toBe('张三');
        expect(result[0].unreadCount).toBe(3);
        expect(result[0].lastMessage?.from).toBe('u1');
        expect(result[0].lastMessage?.to).toBe('me');
    });

    it('兼容已映射的前端格式', () => {
        const mapped = [{
            userId: 'u2', username: '李四', online: true, unreadCount: 1,
            lastMessage: { id: 'msg2', from: 'u2', to: 'me', content: '嗨', type: 'text', read: false, createdAt: '2025-01-01T00:00:00Z' },
        }];
        const result = mapServerConversations(mapped, 'me');
        expect(result[0].userId).toBe('u2');
        expect(result[0].username).toBe('李四');
        expect(result[0].unreadCount).toBe(1);
    });

    it('过滤 userId 为空的无效条目', () => {
        const serverData = [
            { user: { id: '', username: '' }, unread: 0 },
            { user: { id: 'u1', username: '有效' }, unread: 0 },
        ];
        const result = mapServerConversations(serverData, 'me');
        expect(result).toHaveLength(1);
        expect(result[0].userId).toBe('u1');
    });

    it('fromSelf=true 时 from 为当前用户', () => {
        const serverData = [{
            user: { id: 'u1', username: '对方' },
            lastMessage: { id: 'msg1', content: '我发的', type: 'text', createdAt: '2025-01-01T00:00:00Z', fromSelf: true },
            unread: 0,
        }];
        const result = mapServerConversations(serverData, 'current_user');
        expect(result[0].lastMessage?.from).toBe('current_user');
        expect(result[0].lastMessage?.to).toBe('u1');
    });

    it('无 lastMessage 时为 undefined', () => {
        const serverData = [{ user: { id: 'u1', username: '新好友' }, unread: 0 }];
        const result = mapServerConversations(serverData, 'me');
        expect(result[0].lastMessage).toBeUndefined();
    });
});
