import { createContext, useContext, useEffect, useState, useMemo, type ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { socialSocket, SOCIAL_EVENTS, type FriendStatusPayload, type FriendRequestPayload, type NewMessagePayload } from '../services/socialSocket';
import { AUTH_API_URL } from '../config/server';
import type { FriendUser, FriendRequest, Conversation, Message, SearchUserResult } from '../services/social.types';
import i18n from '../lib/i18n';

interface SocialContextType {
    friends: FriendUser[];
    requests: FriendRequest[];
    conversations: Conversation[];
    unreadTotal: number;
    isConnected: boolean;

    refreshFriends: () => Promise<void>;
    refreshRequests: () => Promise<void>;
    refreshConversations: () => Promise<void>;

    searchUsers: (query: string) => Promise<SearchUserResult[]>;
    sendFriendRequest: (userId: string) => Promise<void>;
    acceptFriendRequest: (requestId: string) => Promise<void>;
    rejectFriendRequest: (requestId: string) => Promise<void>;
    deleteFriend: (userId: string) => Promise<void>;

    sendMessage: (toUserId: string, content: string, type?: 'text' | 'invite') => Promise<Message>;
    markAsRead: (fromUserId: string) => Promise<void>;
    getMessages: (userId: string, before?: string) => Promise<Message[]>;
}

const SocialContext = createContext<SocialContextType | undefined>(undefined);

export function SocialProvider({ children }: { children: ReactNode }) {
    const { token, user } = useAuth();
    const [friends, setFriends] = useState<FriendUser[]>([]);
    const [requests, setRequests] = useState<FriendRequest[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isConnected, setIsConnected] = useState(false);

    // 计算总未读数
    const unreadTotal = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

    const authenticatedFetch = useCallback(async (path: string, options: RequestInit = {}) => {
        if (!token) throw new Error('Not authenticated');

        const headers = {
            'Content-Type': 'application/json',
            'Accept-Language': i18n.language,
            'Authorization': `Bearer ${token}`,
            ...options.headers,
        };

        const response = await fetch(`${AUTH_API_URL}${path}`, { ...options, headers });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `Request failed: ${response.status}`);
        }

        return response.json();
    }, [token]);

    const refreshFriends = useCallback(async () => {
        if (!token) return;
        try {
            const data = await authenticatedFetch('/friends');
            setFriends(data.friends);
        } catch (error) {
            console.error('[SocialContext] Failed to fetch friends:', error);
        }
    }, [authenticatedFetch, token]);

    const refreshRequests = useCallback(async () => {
        if (!token) return;
        try {
            const data = await authenticatedFetch('/friends/requests');
            setRequests(data.requests);
        } catch (error) {
            console.error('[SocialContext] Failed to fetch requests:', error);
        }
    }, [authenticatedFetch, token]);

    const refreshConversations = useCallback(async () => {
        if (!token) return;
        try {
            const data = await authenticatedFetch('/messages/conversations');
            setConversations(data.conversations);
        } catch (error) {
            console.error('[SocialContext] Failed to fetch conversations:', error);
        }
    }, [authenticatedFetch, token]);

    // WebSocket 连接管理：连接生命周期只跟鉴权状态走，避免热更新触发断开
    useEffect(() => {
        if (token) {
            socialSocket.connect(token);
            return;
        }

        socialSocket.disconnect();
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sync reset on logout; socket won't fire events after disconnect()
        setIsConnected(false);
        setFriends([]);
        setRequests([]);
        setConversations([]);
    }, [token]);

    // 心跳定时器：定期发送 heartbeat 刷新服务端在线状态缓存（TTL 60s，每 30s 发一次）
    useEffect(() => {
        if (!token) return;

        const HEARTBEAT_INTERVAL = 30_000;
        const timer = setInterval(() => {
            if (socialSocket.connected) {
                socialSocket.emit(SOCIAL_EVENTS.HEARTBEAT);
            }
        }, HEARTBEAT_INTERVAL);

        return () => clearInterval(timer);
    }, [token]);

    // WebSocket 事件绑定：只清理监听，不主动断开连接
    useEffect(() => {
        if (!token || !user) {
            return;
        }

        const handleConnect = () => setIsConnected(true);
        const handleDisconnect = () => setIsConnected(false);

        const handleFriendOnline = ({ userId }: FriendStatusPayload) => {
            setFriends(prev => prev.map(f => f.id === userId ? { ...f, online: true } : f));
            // 同时也更新会话列表中的在线状态
            setConversations(prev => prev.map(c => c.userId === userId ? { ...c, online: true } : c));
        };

        const handleFriendOffline = ({ userId }: FriendStatusPayload) => {
            setFriends(prev => prev.map(f => f.id === userId ? { ...f, online: false } : f));
            setConversations(prev => prev.map(c => c.userId === userId ? { ...c, online: false } : c));
        };

        const handleFriendRequest = (payload: FriendRequestPayload) => {
            // 收到好友请求，刷新请求列表
            refreshRequests();
            // 可以加个 Toast 通知
            console.log('Received friend request:', payload);
        };

        const handleNewMessage = (payload: NewMessagePayload) => {
            // 如果是新消息，更新会话列表
            // 如果当前未打开该会话，增加未读数 (这里简单粗暴先刷新会话列表)
            // 理想做法是乐观更新
            refreshConversations();
            console.log('Received new message:', payload);
        };

        const cleanupConnect = socialSocket.on('connect', handleConnect);
        const cleanupDisconnect = socialSocket.on('disconnect', handleDisconnect);
        const cleanupOnline = socialSocket.on(SOCIAL_EVENTS.FRIEND_ONLINE, handleFriendOnline);
        const cleanupOffline = socialSocket.on(SOCIAL_EVENTS.FRIEND_OFFLINE, handleFriendOffline);
        const cleanupRequest = socialSocket.on(SOCIAL_EVENTS.FRIEND_REQUEST, handleFriendRequest);
        const cleanupMessage = socialSocket.on(SOCIAL_EVENTS.NEW_MESSAGE, handleNewMessage);

        // 若连接已存在，避免漏掉已发生的 connect 事件
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync with external socket state before listeners fire
        setIsConnected(socialSocket.connected);

        // 初始加载数据
        refreshFriends();
        refreshRequests();
        refreshConversations();

        return () => {
            cleanupConnect();
            cleanupDisconnect();
            cleanupOnline();
            cleanupOffline();
            cleanupRequest();
            cleanupMessage();
        };
    }, [token, user, refreshFriends, refreshRequests, refreshConversations]);

    const searchUsers = useCallback(async (query: string): Promise<SearchUserResult[]> => {
        const data = await authenticatedFetch(`/friends/search?q=${encodeURIComponent(query)}`);
        return data.users;
    }, [authenticatedFetch]);

    const sendFriendRequest = useCallback(async (userId: string) => {
        await authenticatedFetch('/friends/request', {
            method: 'POST',
            body: JSON.stringify({ userId }),
        });
    }, [authenticatedFetch]);

    const acceptFriendRequest = useCallback(async (requestId: string) => {
        await authenticatedFetch(`/friends/accept/${requestId}`, { method: 'POST' });
        await refreshRequests();
        await refreshFriends();
    }, [authenticatedFetch, refreshRequests, refreshFriends]);

    const rejectFriendRequest = useCallback(async (requestId: string) => {
        await authenticatedFetch(`/friends/reject/${requestId}`, { method: 'POST' });
        await refreshRequests();
    }, [authenticatedFetch, refreshRequests]);

    const deleteFriend = useCallback(async (userId: string) => {
        await authenticatedFetch(`/friends/${userId}`, { method: 'DELETE' });
        await refreshFriends();
    }, [authenticatedFetch, refreshFriends]);

    const sendMessage = useCallback(async (toUserId: string, content: string, type: 'text' | 'invite' = 'text') => {
        const data = await authenticatedFetch('/messages/send', {
            method: 'POST',
            body: JSON.stringify({ toUserId, content, type }),
        });

        // 发送成功后立即刷新会话列表与该会话消息历史
        await refreshConversations();

        // fire-and-forget：不阻塞 UI
        void authenticatedFetch(`/messages/${toUserId}`).catch(() => undefined);

        return data.message;
    }, [authenticatedFetch, refreshConversations]);

    const markAsRead = useCallback(async (fromUserId: string) => {
        await authenticatedFetch(`/messages/read/${fromUserId}`, { method: 'POST' });
        // 本地更新未读数
        setConversations(prev => prev.map(c =>
            c.userId === fromUserId ? { ...c, unreadCount: 0 } : c
        ));
    }, [authenticatedFetch]);

    const getMessages = useCallback(async (userId: string, before?: string): Promise<Message[]> => {
        const url = `/messages/${userId}${before ? `?before=${before}` : ''}`;
        const data = await authenticatedFetch(url);
        return data.messages;
    }, [authenticatedFetch]);

    // useMemo 包裹 Provider value，避免每次渲染创建新对象导致所有消费者重渲染
    const value = useMemo(() => ({
        friends,
        requests,
        conversations,
        unreadTotal,
        isConnected,
        refreshFriends,
        refreshRequests,
        refreshConversations,
        searchUsers,
        sendFriendRequest,
        acceptFriendRequest,
        rejectFriendRequest,
        deleteFriend,
        sendMessage,
        markAsRead,
        getMessages,
    }), [
        friends, requests, conversations, unreadTotal, isConnected,
        refreshFriends, refreshRequests, refreshConversations,
        searchUsers, sendFriendRequest, acceptFriendRequest,
        rejectFriendRequest, deleteFriend, sendMessage, markAsRead, getMessages,
    ]);

    return (
        <SocialContext.Provider value={value}>
            {children}
        </SocialContext.Provider>
    );
}

export function useSocial() {
    const context = useContext(SocialContext);
    if (!context) {
        throw new Error('useSocial must be used within a SocialProvider');
    }
    return context;
}
