import { useState } from 'react';
import { useSocial } from '../../contexts/SocialContext';
import { User, Search, UserPlus, Inbox, Check, X, MessageSquare, Bell } from 'lucide-react';
import { SYSTEM_NOTIFICATION_ID } from './FriendsChatModal';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

interface FriendListProps {
    onSelectFriend: (userId: string) => void;
    activeFriendId?: string;
}

export const FriendList = ({ onSelectFriend, activeFriendId }: FriendListProps) => {
    const { friends, requests, conversations, acceptFriendRequest, rejectFriendRequest, searchUsers, sendFriendRequest } = useSocial();
    const [tab, setTab] = useState<'chats' | 'friends' | 'requests' | 'add'>('chats');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Awaited<ReturnType<typeof searchUsers>>>([]);
    const [searching, setSearching] = useState(false);
    const { t } = useTranslation(['social', 'common']);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setSearching(true);
        try {
            const results = await searchUsers(searchQuery);
            setSearchResults(results);
        } finally {
            setSearching(false);
        }
    };

    const handleSendRequest = async (userId: string) => {
        await sendFriendRequest(userId);
        setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, status: 'pending' } : u));
    };

    const sortedConversations = [...conversations].sort((a, b) => {
        const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return timeB - timeA;
    });

    return (
        <div className="flex flex-col h-full bg-parchment-card-bg border-r border-parchment-card-border/30">
            {/* 顶部栏 / 标签页 */}
            <div className="flex items-center justify-around border-b border-parchment-card-border/30 p-2 bg-parchment-base-bg">
                <button
                    onClick={() => setTab('chats')}
                    className={clsx("p-2 rounded hover:bg-parchment-card-border/20 transition-colors relative", tab === 'chats' && "text-parchment-light-text")}
                    title={t('social:tabs.chats')}
                >
                    <MessageSquare size={20} />
                </button>
                <button
                    onClick={() => setTab('friends')}
                    className={clsx("p-2 rounded hover:bg-parchment-card-border/20 transition-colors relative", tab === 'friends' && "text-parchment-light-text")}
                    title={t('social:tabs.friends')}
                >
                    <User size={20} />
                </button>
                <button
                    onClick={() => setTab('requests')}
                    className={clsx("p-2 rounded hover:bg-parchment-card-border/20 transition-colors relative", tab === 'requests' && "text-parchment-light-text")}
                    title={t('social:tabs.requests')}
                >
                    <Inbox size={20} />
                    {requests.length > 0 && (
                        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#f3f0e6]" />
                    )}
                </button>
                <button
                    onClick={() => setTab('add')}
                    className={clsx("p-2 rounded hover:bg-parchment-card-border/20 transition-colors", tab === 'add' && "text-parchment-light-text")}
                    title={t('social:tabs.add')}
                >
                    <UserPlus size={20} />
                </button>
            </div>

            {/* 内容区 */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {tab === 'chats' && (
                    <div className="p-2 space-y-1">
                        {/* 固定置顶：系统通知 */}
                        <button
                            onClick={() => onSelectFriend(SYSTEM_NOTIFICATION_ID)}
                            className={clsx(
                                "w-full flex items-center p-2 rounded gap-3 transition-all",
                                activeFriendId === SYSTEM_NOTIFICATION_ID
                                    ? "bg-parchment-card-border/20 shadow-inner"
                                    : "hover:bg-parchment-base-bg"
                            )}
                        >
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                <Bell size={18} />
                            </div>
                            <div className="flex-1 text-left">
                                <div className="font-bold text-parchment-base-text text-sm">{t('social:notification.title')}</div>
                                <div className="text-xs text-parchment-light-text truncate">{t('social:notification.subtitle')}</div>
                            </div>
                        </button>

                        <div key="divider" className="h-px bg-parchment-card-border/20 mx-1" />

                        {sortedConversations.length === 0 && (
                            <div className="text-center text-parchment-light-text py-8 text-sm italic opacity-70">
                                {t('social:chats.empty')}
                            </div>
                        )}
                        {sortedConversations.map(conv => (
                            <button
                                key={conv.userId}
                                onClick={() => onSelectFriend(conv.userId)}
                                className={clsx(
                                    "w-full flex items-center p-2 rounded gap-3 transition-all",
                                    activeFriendId === conv.userId
                                        ? "bg-parchment-card-border/20 shadow-inner"
                                        : "hover:bg-parchment-base-bg"
                                )}
                            >
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-parchment-card-border flex items-center justify-center text-parchment-card-bg font-bold text-lg">
                                        {conv.username?.[0]?.toUpperCase() ?? '?'}
                                    </div>
                                    <div className={clsx(
                                        "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-parchment-card-bg",
                                        conv.online ? "bg-green-500" : "bg-gray-400"
                                    )} />
                                </div>
                                <div className="flex-1 text-left overflow-hidden">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <div className="font-bold text-parchment-base-text text-sm truncate">{conv.username}</div>
                                        {conv.lastMessage && (
                                            <div className="text-[10px] text-parchment-light-text opacity-80">
                                                {new Date(conv.lastMessage.createdAt).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="text-xs text-parchment-light-text truncate max-w-[120px]">
                                            {conv.lastMessage?.type === 'invite' ? t('social:chat.gameInvite') : conv.lastMessage?.content}
                                        </div>
                                        {conv.unreadCount > 0 && (
                                            <div className="min-w-[16px] h-4 px-1 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                                                {conv.unreadCount}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {tab === 'friends' && (
                    <div className="p-2 space-y-1">
                        {friends.length === 0 && (
                            <div className="text-center text-parchment-light-text py-8 text-sm italic opacity-70">
                                {t('social:friends.empty')}
                            </div>
                        )}
                        {friends.map(friend => (
                            <button
                                key={friend.id}
                                onClick={() => onSelectFriend(friend.id)}
                                className={clsx(
                                    "w-full flex items-center p-2 rounded gap-3 transition-all",
                                    activeFriendId === friend.id
                                        ? "bg-parchment-card-border/20 shadow-inner"
                                        : "hover:bg-parchment-base-bg"
                                )}
                            >
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-parchment-card-border flex items-center justify-center text-parchment-card-bg font-bold text-lg">
                                        {friend.username[0].toUpperCase()}
                                    </div>
                                    <div className={clsx(
                                        "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-parchment-card-bg",
                                        friend.online ? "bg-green-500" : "bg-gray-400"
                                    )} />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-bold text-parchment-base-text text-sm">{friend.username}</div>
                                    <div className="text-[10px] text-parchment-light-text">
                                        {friend.online ? t('social:status.online') : t('social:status.offline')}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {tab === 'requests' && (
                    <div className="p-2 space-y-2">
                        {requests.length === 0 && (
                            <div className="text-center text-[#8c7b64] py-8 text-sm italic opacity-70">
                                {t('social:requests.empty')}
                            </div>
                        )}
                        {requests.map(req => (
                            <div key={req.id} className="bg-white p-3 rounded shadow-sm border border-parchment-card-border/30">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-parchment-card-border flex items-center justify-center text-parchment-card-bg font-bold text-sm">
                                        {req.fromUser.username[0].toUpperCase()}
                                    </div>
                                    <div className="font-bold text-parchment-base-text text-sm">{req.fromUser.username}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => acceptFriendRequest(req.id)}
                                        className="flex-1 flex items-center justify-center gap-1 bg-parchment-base-text text-parchment-card-bg py-1.5 rounded text-xs hover:bg-parchment-brown transition-colors"
                                    >
                                        <Check size={12} /> {t('common:accept')}
                                    </button>
                                    <button
                                        onClick={() => rejectFriendRequest(req.id)}
                                        className="flex-1 flex items-center justify-center gap-1 bg-parchment-card-border/20 text-parchment-base-text py-1.5 rounded text-xs hover:bg-parchment-card-border/40 transition-colors"
                                    >
                                        <X size={12} /> {t('common:reject')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'add' && (
                    <div className="p-3">
                        <form onSubmit={handleSearch} className="mb-4 relative">
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('social:search.placeholder')}
                                className="w-full bg-white border border-parchment-card-border/40 rounded pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-parchment-base-text transition-colors placeholder-parchment-light-text/50"
                            />
                            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-parchment-light-text" />
                        </form>

                        <div className="space-y-2">
                            {searching && <div className="text-center text-xs text-[#8c7b64]">{t('common:loading')}</div>}
                            {searchResults.map(user => (
                                <div key={user.id} className="flex items-center justify-between p-2 bg-white rounded border border-parchment-card-border/30 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-parchment-card-border flex items-center justify-center text-parchment-card-bg font-bold text-xs">
                                            {user.username[0].toUpperCase()}
                                        </div>
                                        <div className="text-sm font-bold text-parchment-base-text">{user.username}</div>
                                    </div>
                                    {user.status === 'none' && (
                                        <button
                                            onClick={() => handleSendRequest(user.id)}
                                            className="p-1.5 rounded bg-[#f3f0e6] text-[#433422] hover:bg-[#e5e0d0] transition-colors"
                                            title={t('social:actions.addFriend')}
                                        >
                                            <UserPlus size={16} />
                                        </button>
                                    )}
                                    {user.status === 'pending' && <span className="text-xs text-[#8c7b64]">{t('social:status.sent')}</span>}
                                    {user.status === 'incoming' && <span className="text-xs text-[#8c7b64]">{t('social:status.incoming')}</span>}
                                    {user.status === 'accepted' && <span className="text-xs text-green-600">{t('social:status.friend')}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
