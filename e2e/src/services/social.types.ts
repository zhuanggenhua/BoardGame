export interface FriendUser {
    id: string;
    username: string;
    avatar?: string;
    online: boolean;
}

export interface FriendRequest {
    id: string;
    fromUser: {
        id: string;
        username: string;
        avatar?: string;
    };
    createdAt?: string;
}

export interface SearchUserResult {
    id: string;
    username: string;
    avatar?: string;
    status: 'none' | 'pending' | 'incoming' | 'accepted';
}

export interface Message {
    id: string;
    from: string;
    to: string;
    content: string;
    type: 'text' | 'invite' | 'system';
    read: boolean;
    createdAt: string;
}

export interface Conversation {
    userId: string;
    username: string;
    avatar?: string;
    online: boolean;
    lastMessage?: Message;
    unreadCount: number;
}
