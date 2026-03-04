import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useModalStack } from '../../contexts/ModalStackContext';
import { useTranslation } from 'react-i18next';
import { LogOut, History, MessageSquare, Bell, MousePointer2, Settings } from 'lucide-react';
import { MatchHistoryModal } from './MatchHistoryModal';
import { FriendsChatModal, SYSTEM_NOTIFICATION_ID } from './FriendsChatModal';
import { AccountSettingsModal } from '../auth/AccountSettingsModal';
import { CursorSettingsModal } from '../settings/CursorSettingsModal';
import { NOTIFICATION_API_URL } from '../../config/server';
import { useSocial } from '../../contexts/SocialContext';

const NOTIFICATION_SEEN_KEY = 'notification_last_seen';

interface UserMenuProps {
    onLogout: () => void;
}

export const UserMenu = ({ onLogout }: UserMenuProps) => {
    const { user } = useAuth();
    const { openModal, closeModal } = useModalStack();
    const { requests, unreadTotal } = useSocial();
    const { t } = useTranslation(['auth', 'social']);
    const [isOpen, setIsOpen] = useState(false);
    const [hasNewNotification, setHasNewNotification] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const accountModalIdRef = useRef<string | null>(null);
    const cursorModalIdRef = useRef<string | null>(null);

    // 铃铛红点 = 系统通知 OR 好友请求 OR 未读消息
    const hasBellBadge = hasNewNotification || requests.length > 0 || unreadTotal > 0;

    // 检查是否有新通知（对比 localStorage 记录的上次查看时间）
    useEffect(() => {
        let active = true;
        fetch(NOTIFICATION_API_URL)
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(data => {
                if (!active) return;
                const list = data.notifications as { _id: string; createdAt: string }[];
                if (list.length === 0) return;
                const lastSeen = localStorage.getItem(NOTIFICATION_SEEN_KEY) || '';
                const latestTime = list[0].createdAt;
                if (latestTime > lastSeen) setHasNewNotification(true);
            })
            .catch(() => {});
        return () => { active = false; };
    }, []);

    // 点击外部关闭
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const markNotificationsSeen = useCallback(() => {
        setHasNewNotification(false);
        localStorage.setItem(NOTIFICATION_SEEN_KEY, new Date().toISOString());
    }, []);

    const handleOpenFriends = () => {
        setIsOpen(false);
        openModal({
            closeOnBackdrop: true,
            closeOnEsc: true,
            render: ({ close }) => (
                <FriendsChatModal isOpen onClose={close} />
            ),
        });
    };

    const handleOpenNotifications = () => {
        setIsOpen(false);
        markNotificationsSeen();
        openModal({
            closeOnBackdrop: true,
            closeOnEsc: true,
            render: ({ close }) => (
                <FriendsChatModal isOpen onClose={close} initialFriendId={SYSTEM_NOTIFICATION_ID} />
            ),
        });
    };

    const handleOpenHistory = () => {
        setIsOpen(false);
        openModal({
            closeOnBackdrop: true,
            closeOnEsc: true,
            render: ({ close }) => (
                <MatchHistoryModal isOpen onClose={close} />
            ),
        });
    };

    const handleOpenAccount = () => {
        setIsOpen(false);
        if (accountModalIdRef.current) {
            closeModal(accountModalIdRef.current);
            accountModalIdRef.current = null;
        }
        accountModalIdRef.current = openModal({
            closeOnBackdrop: true,
            closeOnEsc: true,
            lockScroll: true,
            onClose: () => { accountModalIdRef.current = null; },
            render: ({ close, closeOnBackdrop }) => (
                <AccountSettingsModal isOpen onClose={close} closeOnBackdrop={closeOnBackdrop} />
            ),
        });
    };

    const handleOpenCursor = () => {
        setIsOpen(false);
        if (cursorModalIdRef.current) {
            closeModal(cursorModalIdRef.current);
            cursorModalIdRef.current = null;
        }
        cursorModalIdRef.current = openModal({
            closeOnBackdrop: true,
            closeOnEsc: true,
            lockScroll: true,
            onClose: () => { cursorModalIdRef.current = null; },
            render: ({ close, closeOnBackdrop }) => (
                <CursorSettingsModal isOpen onClose={close} closeOnBackdrop={closeOnBackdrop} />
            ),
        });
    };

    if (!user) return null;

    return (
        <div className="relative flex items-center gap-1" ref={menuRef}>
            {/* 通知铃铛 */}
            <button
                onClick={handleOpenNotifications}
                className="relative p-1.5 text-parchment-base-text hover:text-parchment-brown transition-colors"
                aria-label="通知"
            >
                <Bell size={18} />
                {hasBellBadge && (
                    <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
                )}
            </button>

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="group relative flex items-center gap-2 cursor-pointer transition-colors px-2 py-1 outline-none"
            >
                {user.avatar ? (
                    <img
                        src={user.avatar}
                        className="w-8 h-8 rounded-full object-cover border border-parchment-card-border shadow-sm group-hover:border-parchment-light-text transition-colors"
                        alt={user.username}
                    />
                ) : (
                    <div className="relative group-hover:text-parchment-brown text-parchment-base-text">
                        <span className="font-bold text-sm tracking-tight">{user.username}</span>
                        <span className="underline-center" />
                    </div>
                )}
            </button>

            {isOpen && (
                <div className="absolute top-[calc(100%+0.5rem)] right-0 bg-parchment-card-bg shadow-parchment-card-hover border border-parchment-card-border rounded-sm py-2 px-2 z-50 min-w-[200px] animate-in fade-in slide-in-from-top-1 flex flex-col gap-1">
                    {/* 对战历史 */}
                    <button
                        onClick={handleOpenHistory}
                        className="w-full px-4 py-2.5 text-left cursor-pointer text-parchment-base-text font-bold text-xs hover:bg-parchment-base-bg rounded flex items-center gap-3 transition-colors"
                    >
                        <History size={16} />
                        {t('social:menu.matchHistory')}
                    </button>

                    {/* 好友与聊天 */}
                    <button
                        onClick={handleOpenFriends}
                        className="w-full px-4 py-2.5 text-left cursor-pointer text-parchment-base-text font-bold text-xs hover:bg-parchment-base-bg rounded flex items-center gap-3 transition-colors"
                    >
                        <MessageSquare size={16} />
                        {t('social:menu.friendsAndChat')}
                    </button>

                    <div className="h-px bg-parchment-card-border/30 my-1 mx-2 opacity-50" />

                    {/* 账户设置 */}
                    <button
                        onClick={handleOpenAccount}
                        className="w-full px-4 py-2.5 text-left cursor-pointer text-parchment-base-text font-bold text-xs hover:bg-parchment-base-bg rounded flex items-center gap-3 transition-colors"
                    >
                        <Settings size={16} />
                        {t('auth:menu.accountSettings')}
                    </button>

                    {/* 光标设置 */}
                    <button
                        onClick={handleOpenCursor}
                        className="w-full px-4 py-2.5 text-left cursor-pointer text-parchment-base-text font-bold text-xs hover:bg-parchment-base-bg rounded flex items-center gap-3 transition-colors"
                    >
                        <MousePointer2 size={16} />
                        {t('auth:menu.setCursor')}
                    </button>

                    {/* 退出登录 */}
                    <button
                        onClick={() => { setIsOpen(false); onLogout(); }}
                        className="w-full px-4 py-2.5 text-left cursor-pointer text-parchment-light-text hover:text-red-500 font-bold text-xs hover:bg-parchment-base-bg rounded flex items-center gap-3 transition-colors"
                    >
                        <LogOut size={16} />
                        {t('auth:menu.logout')}
                    </button>
                </div>
            )}
        </div>
    );
};
