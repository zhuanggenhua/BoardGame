import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { isBackofficeRole, useAuth } from '../../contexts/AuthContext';
import { useModalStack } from '../../contexts/ModalStackContext';
import { useTranslation } from 'react-i18next';
import { Bell, ChevronDown, LayoutDashboard, LogOut, History, MessageSquare, MousePointer2, Settings, User as UserIcon } from 'lucide-react';
import { MatchHistoryModal } from './MatchHistoryModal';
import { FriendsChatModal } from './FriendsChatModal';
import { SYSTEM_NOTIFICATION_ID } from './constants';
import { AccountSettingsModal } from '../auth/AccountSettingsModal';
import { CursorSettingsModal } from '../settings/CursorSettingsModal';
import { NOTIFICATION_API_URL } from '../../config/server';
import { readLocalStorageItem, writeLocalStorageItem } from '../../lib/browserStorage';
import { useSocial } from '../../contexts/SocialContext';
import { RewardPointsBadge } from '../common/labels/RewardPointsBadge';
import { MyFeedbackModal } from './MyFeedbackModal';

const NOTIFICATION_SEEN_KEY = 'notification_last_seen';
const getNotificationSeenStorageKey = (userId?: string | null) => {
    return userId ? `${NOTIFICATION_SEEN_KEY}:${userId}` : NOTIFICATION_SEEN_KEY;
};

const parseTimestamp = (value?: string | null) => {
    if (!value) return 0;
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && numeric > 0) {
        return numeric;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const getLatestNotificationTimestamp = (list: { createdAt?: string }[]) => {
    return list.reduce((latest, item) => {
        const createdAt = parseTimestamp(item.createdAt ?? null);
        return createdAt > latest ? createdAt : latest;
    }, 0);
};

interface UserMenuProps {
    onLogout: () => void;
    variant?: 'classic' | 'book';
    triggerTestId?: string;
}

export const UserMenu = ({ onLogout, variant = 'classic', triggerTestId = 'user-menu-trigger' }: UserMenuProps) => {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const { openModal, closeModal } = useModalStack();
    const { requests, unreadTotal, ensureRealtimeConnection } = useSocial();
    const { t } = useTranslation(['auth', 'social']);
    const [isOpen, setIsOpen] = useState(false);
    const [hasNewNotification, setHasNewNotification] = useState(false);
    const [latestNotificationTimestamp, setLatestNotificationTimestamp] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);
    const accountModalIdRef = useRef<string | null>(null);
    const cursorModalIdRef = useRef<string | null>(null);
    const isBookVariant = variant === 'book';

    // 铃铛红点 = 系统通知 OR 好友请求 OR 未读消息
    const hasBellBadge = hasNewNotification || requests.length > 0 || unreadTotal > 0;

    // 检查是否有新通知（对比 localStorage 记录的上次查看时间）
    useEffect(() => {
        let active = true;

        const syncNotificationBadge = async () => {
            try {
                const [notificationsResponse, readStateResponse] = await Promise.all([
                    fetch(NOTIFICATION_API_URL),
                    token
                        ? fetch(`${NOTIFICATION_API_URL}/read-state`, {
                            headers: { Authorization: `Bearer ${token}` },
                        })
                        : Promise.resolve(null),
                ]);

                if (!notificationsResponse.ok) {
                    return;
                }

                const data = await notificationsResponse.json() as {
                    notifications?: { _id: string; createdAt: string }[];
                };

                if (!active) {
                    return;
                }

                const list = data.notifications ?? [];
                const latestTime = getLatestNotificationTimestamp(list);
                setLatestNotificationTimestamp(latestTime);

                if (list.length === 0) {
                    setHasNewNotification(false);
                    return;
                }

                const scopedSeenKey = getNotificationSeenStorageKey(user?.id);
                const localSeenAt = Math.max(
                    parseTimestamp(readLocalStorageItem(NOTIFICATION_SEEN_KEY)),
                    parseTimestamp(readLocalStorageItem(scopedSeenKey)),
                );

                let persistedSeenAt = 0;
                if (readStateResponse?.ok) {
                    const readState = await readStateResponse.json() as { lastSeenAt?: string | null };
                    persistedSeenAt = parseTimestamp(readState.lastSeenAt ?? null);
                }

                setHasNewNotification(latestTime > Math.max(localSeenAt, persistedSeenAt));
            } catch {
                // ignore network errors
            }
        };

        void syncNotificationBadge();
        return () => { active = false; };
    }, [token, user?.id]);

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
        const seenAt = Math.max(Date.now(), latestNotificationTimestamp);
        const seenAtRaw = seenAt.toString();
        writeLocalStorageItem(NOTIFICATION_SEEN_KEY, seenAtRaw);
        writeLocalStorageItem(getNotificationSeenStorageKey(user?.id), seenAtRaw);

        if (token) {
            void fetch(`${NOTIFICATION_API_URL}/read-state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ seenAt: new Date(seenAt).toISOString() }),
            }).catch(() => {
                // ignore network errors
            });
        }
    }, [latestNotificationTimestamp, token, user?.id]);

    const handleOpenFriends = () => {
        ensureRealtimeConnection();
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
        ensureRealtimeConnection();
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

    const handleOpenAdmin = () => {
        setIsOpen(false);
        navigate('/admin');
    };

    const handleOpenMyFeedback = () => {
        setIsOpen(false);
        openModal({
            closeOnBackdrop: false,
            closeOnEsc: true,
            lockScroll: true,
            render: ({ close }) => (
                <MyFeedbackModal isOpen onClose={close} />
            ),
        });
    };

    if (!user) return null;

    const canAccessBackoffice = isBackofficeRole(user.role);
    const trigger = isBookVariant ? (
        <button
            onClick={() => setIsOpen(!isOpen)}
            className="group relative flex h-full w-full items-center justify-end gap-2 border-0 bg-transparent p-0 font-serif text-[#2f2116] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1c36c]/70"
            data-testid={triggerTestId}
            aria-haspopup="menu"
            aria-expanded={isOpen}
        >
            <RewardPointsBadge
                points={user.feedbackPoints ?? 0}
                className="shrink-0 border-amber-400/75 bg-amber-50/92 px-1.5 py-0.5 text-[10px] shadow-[0_1px_0_rgba(120,53,15,0.06)]"
                textClassName="text-[10px]"
            />
            {user.avatar ? (
                <img
                    src={user.avatar}
                    className="h-7 w-7 shrink-0 rounded-full border border-[#8b633e]/45 object-cover shadow-[0_1px_2px_rgba(72,45,24,0.16)]"
                    alt={user.username}
                />
            ) : (
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#8b633e]/35 bg-[rgba(244,227,194,0.7)] text-[#6d4a2b]">
                    <UserIcon size={15} />
                </span>
            )}
            <span
                className="truncate font-serif text-[#2f2116]"
                style={{ maxWidth: 'calc(100% - 5.75rem)' }}
            >
                {user.username}
            </span>
            <ChevronDown aria-hidden="true" size={16} className="shrink-0 text-[#6d4a2b]" />
            {hasBellBadge ? (
                <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-red-500" />
            ) : null}
        </button>
    ) : (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="group relative flex h-8 items-center gap-2 cursor-pointer px-2 outline-none transition-colors"
                data-testid={triggerTestId}
            >
                <RewardPointsBadge points={user.feedbackPoints ?? 0} className="shrink-0" />
                {user.avatar ? (
                    <img
                        src={user.avatar}
                        className="w-8 h-8 rounded-full object-cover border border-parchment-card-border shadow-sm group-hover:border-parchment-light-text transition-colors"
                        alt={user.username}
                    />
                ) : (
                    <div className="relative inline-flex h-8 items-center text-parchment-base-text group-hover:text-parchment-brown">
                        <span className="font-bold text-sm tracking-tight">{user.username}</span>
                        <span className="underline-center" />
                    </div>
                )}
            </button>

            <button
                onClick={handleOpenNotifications}
                className="group relative inline-flex h-8 items-center pl-1 pr-3 text-parchment-base-text hover:text-parchment-brown transition-colors cursor-pointer"
                aria-label={t('social:menu.notifications')}
                data-testid="user-menu-notifications"
            >
                <span className="font-bold text-sm leading-none tracking-tight">{t('social:menu.notifications')}</span>
                <span className="underline-center" />
                {hasBellBadge && (
                    <span className="absolute right-0 top-0.5 h-2 w-2 rounded-full bg-red-500" />
                )}
            </button>
        </>
    );

    return (
        <div className={isBookVariant ? 'relative h-full w-full' : 'relative flex h-8 items-center gap-1'} ref={menuRef}>
            {trigger}

            {isOpen && (
                <div className={isBookVariant
                    ? 'absolute right-0 top-[calc(100%+0.35rem)] z-50 flex min-w-[220px] flex-col gap-1 rounded-[6px] border border-[#8b633e]/35 bg-[#f6ead0] px-2 py-2 text-[#3c2819] shadow-[0_12px_24px_rgba(44,28,18,0.18)] animate-in fade-in slide-in-from-top-1'
                    : 'absolute top-[calc(100%+0.5rem)] right-0 bg-parchment-card-bg shadow-parchment-card-hover border border-parchment-card-border rounded-sm py-2 px-2 z-50 min-w-[200px] animate-in fade-in slide-in-from-top-1 flex flex-col gap-1'}
                >
                    {isBookVariant ? (
                        <>
                            <button
                                onClick={handleOpenNotifications}
                                className="flex w-full items-center gap-3 rounded px-4 py-2.5 text-left font-bold text-xs text-[#3c2819] transition-colors hover:bg-[rgba(120,84,48,0.12)]"
                                data-testid="user-menu-notifications"
                            >
                                <Bell size={16} />
                                <span className="flex-1">{t('social:menu.notifications')}</span>
                                {hasBellBadge ? (
                                    <span className="h-2 w-2 rounded-full bg-red-500" />
                                ) : null}
                            </button>
                            <div className="mx-2 my-1 h-px bg-[#8b633e]/18" />
                        </>
                    ) : null}
                    {/* 对战历史 */}
                    <button
                        onClick={handleOpenHistory}
                        className={isBookVariant
                            ? 'w-full rounded px-4 py-2.5 text-left cursor-pointer text-[#3c2819] font-bold text-xs hover:bg-[rgba(120,84,48,0.12)] flex items-center gap-3 transition-colors'
                            : 'w-full px-4 py-2.5 text-left cursor-pointer text-parchment-base-text font-bold text-xs hover:bg-parchment-base-bg rounded flex items-center gap-3 transition-colors'}
                    >
                        <History size={16} />
                        {t('social:menu.matchHistory')}
                    </button>

                    {/* 好友与聊天 */}
                    <button
                        onClick={handleOpenFriends}
                        className={isBookVariant
                            ? 'w-full rounded px-4 py-2.5 text-left cursor-pointer text-[#3c2819] font-bold text-xs hover:bg-[rgba(120,84,48,0.12)] flex items-center gap-3 transition-colors'
                            : 'w-full px-4 py-2.5 text-left cursor-pointer text-parchment-base-text font-bold text-xs hover:bg-parchment-base-bg rounded flex items-center gap-3 transition-colors'}
                        data-testid="user-menu-friends-chat"
                    >
                        <MessageSquare size={16} />
                        {t('social:menu.friendsAndChat')}
                    </button>

                    <div className={isBookVariant ? 'mx-2 my-1 h-px bg-[#8b633e]/18' : 'h-px bg-parchment-card-border/30 my-1 mx-2 opacity-50'} />

                    {/* 账户设置 */}
                    <button
                        onClick={handleOpenAccount}
                        className={isBookVariant
                            ? 'w-full rounded px-4 py-2.5 text-left cursor-pointer text-[#3c2819] font-bold text-xs hover:bg-[rgba(120,84,48,0.12)] flex items-center gap-3 transition-colors'
                            : 'w-full px-4 py-2.5 text-left cursor-pointer text-parchment-base-text font-bold text-xs hover:bg-parchment-base-bg rounded flex items-center gap-3 transition-colors'}
                        data-testid="user-menu-account-settings"
                    >
                        <Settings size={16} />
                        {t('auth:menu.accountSettings')}
                    </button>

                    {/* 光标设置 */}
                    <button
                        onClick={handleOpenCursor}
                        className={isBookVariant
                            ? 'w-full rounded px-4 py-2.5 text-left cursor-pointer text-[#3c2819] font-bold text-xs hover:bg-[rgba(120,84,48,0.12)] flex items-center gap-3 transition-colors'
                            : 'w-full px-4 py-2.5 text-left cursor-pointer text-parchment-base-text font-bold text-xs hover:bg-parchment-base-bg rounded flex items-center gap-3 transition-colors'}
                    >
                        <MousePointer2 size={16} />
                        {t('auth:menu.setCursor')}
                    </button>

                    {canAccessBackoffice ? (
                        <button
                            onClick={handleOpenAdmin}
                            className={isBookVariant
                                ? 'w-full rounded px-4 py-2.5 text-left cursor-pointer text-[#3c2819] font-bold text-xs hover:bg-[rgba(120,84,48,0.12)] flex items-center gap-3 transition-colors'
                                : 'w-full px-4 py-2.5 text-left cursor-pointer text-parchment-base-text font-bold text-xs hover:bg-parchment-base-bg rounded flex items-center gap-3 transition-colors'}
                        >
                            <LayoutDashboard size={16} />
                            {t('auth:menu.adminDashboard')}
                        </button>
                    ) : null}

                    <button
                        onClick={handleOpenMyFeedback}
                        className={isBookVariant
                            ? 'w-full rounded px-4 py-2.5 text-left cursor-pointer text-[#3c2819] font-bold text-xs hover:bg-[rgba(120,84,48,0.12)] flex items-center gap-3 transition-colors'
                            : 'w-full px-4 py-2.5 text-left cursor-pointer text-parchment-base-text font-bold text-xs hover:bg-parchment-base-bg rounded flex items-center gap-3 transition-colors'}
                        data-testid="user-menu-my-feedback"
                    >
                        <MessageSquare size={16} />
                        {t('auth:menu.myFeedback')}
                    </button>

                    {/* 退出登录 */}
                    <button
                        onClick={() => { setIsOpen(false); onLogout(); }}
                        className={isBookVariant
                            ? 'w-full rounded px-4 py-2.5 text-left cursor-pointer font-bold text-xs text-[#8f3b23] hover:bg-[rgba(120,84,48,0.12)] hover:text-[#b44324] flex items-center gap-3 transition-colors'
                            : 'w-full px-4 py-2.5 text-left cursor-pointer text-parchment-light-text hover:text-red-500 font-bold text-xs hover:bg-parchment-base-bg rounded flex items-center gap-3 transition-colors'}
                    >
                        <LogOut size={16} />
                        {t('auth:menu.logout')}
                    </button>
                </div>
            )}
        </div>
    );
};
