import { useState, type CSSProperties } from 'react';
import { FriendList } from './FriendList';
import { ChatWindow } from './ChatWindow';
import { SystemNotificationView } from './SystemNotificationView';
import { X, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { FRIENDS_CHAT_DETAIL_CONTENT_CLASS } from './layoutContracts';
import { SYSTEM_NOTIFICATION_ID } from './constants';

type ModalViewportCssVars = {
    '--modal-active-viewport-height': string;
    '--modal-active-bottom-inset': string;
    '--modal-max-height': string;
};

interface FriendsChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    inviteData?: {
        matchId: string;
        gameName: string;
    };
    /** 初始选中的会话 ID（如系统通知） */
    initialFriendId?: string;
}

export const FriendsChatModal = ({ isOpen, onClose, inviteData, initialFriendId }: FriendsChatModalProps) => {
    const [selectedFriendId, setSelectedFriendId] = useState<string | null>(initialFriendId ?? null);
    const { t } = useTranslation(['social']);

    if (!isOpen) return null;

    return (
        <div
            className="modal-base-container fixed inset-0 z-50 flex items-center justify-center p-4"
            data-lock-layout-viewport="true"
            style={({
                '--modal-active-viewport-height': 'var(--layout-viewport-height, var(--runtime-viewport-height, 100vh))',
                '--modal-active-bottom-inset': 'var(--runtime-modal-bottom-inset)',
                '--modal-max-height': 'calc(var(--layout-viewport-height, var(--runtime-viewport-height, 100vh)) - max(1rem, var(--safe-area-top)) - max(1rem, var(--modal-active-bottom-inset, var(--runtime-modal-bottom-inset))))',
                paddingTop: 'max(1rem, var(--safe-area-top))',
                paddingRight: 'max(1rem, var(--safe-area-right))',
                paddingBottom: 'max(1rem, var(--modal-active-bottom-inset, var(--runtime-modal-bottom-inset)))',
                paddingLeft: 'max(1rem, var(--safe-area-left))',
            } as CSSProperties & ModalViewportCssVars)}
        >
            {/* 遮罩层 */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            {/* 弹窗内容 */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                data-testid="friends-chat-modal-content"
                className="relative bg-parchment-card-bg w-full max-w-4xl min-h-0 rounded-lg shadow-2xl overflow-hidden flex flex-col md:flex-row border border-parchment-card-border/30"
                style={{ height: 'min(600px, var(--modal-max-height, var(--runtime-modal-max-height)))' }}
            >
                {/* 关闭按钮 */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 p-2 rounded-full bg-parchment-card-bg/80 hover:bg-parchment-base-bg transition-colors"
                >
                    <X size={20} className="text-parchment-base-text" />
                </button>

                {/* 左侧区域：好友列表 */}
                <div className={clsx(
                    'w-full md:w-80 h-full min-h-0 overflow-hidden border-r border-parchment-card-border/30 flex flex-col transition-all duration-300 absolute md:relative bg-parchment-card-bg',
                    selectedFriendId
                        ? '-translate-x-full pointer-events-none z-0 md:translate-x-0 md:pointer-events-auto md:z-10'
                        : 'translate-x-0 pointer-events-auto z-10'
                )}>
                    <div className="p-4 border-b border-parchment-card-border/30 bg-parchment-base-bg">
                        <h2 className="font-bold text-lg text-parchment-base-text">{t('social:modal.title')}</h2>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <FriendList
                            onSelectFriend={(id) => {
                                if (!id) return;
                                setSelectedFriendId(id);
                            }}
                            activeFriendId={selectedFriendId || undefined}
                        />
                    </div>
                </div>

                {/* 右侧区域：聊天窗口 */}
                <div className={clsx(
                    'flex-1 h-full min-h-0 overflow-hidden flex flex-col transition-all duration-300 absolute md:relative w-full md:w-auto bg-parchment-card-bg',
                    selectedFriendId
                        ? 'translate-x-0 pointer-events-auto z-20'
                        : 'translate-x-full pointer-events-none z-0 md:translate-x-0 md:pointer-events-auto md:z-auto'
                )}>
                    {selectedFriendId ? (
                        <>
                            {/* 移动端返回按钮 */}
                            <div className="md:hidden h-14 border-b border-parchment-card-border/30 flex items-center px-2 bg-parchment-base-bg">
                                <button
                                    onClick={() => setSelectedFriendId(null)}
                                    className="p-2 hover:bg-parchment-card-border/20 rounded-full"
                                >
                                    <ChevronLeft size={20} className="text-parchment-base-text" />
                                </button>
                                <span className="font-bold text-parchment-base-text ml-2">{t('common:back')}</span>
                            </div>
                            <div className={FRIENDS_CHAT_DETAIL_CONTENT_CLASS}>
                                {selectedFriendId === SYSTEM_NOTIFICATION_ID ? (
                                    <SystemNotificationView />
                                ) : (
                                    <ChatWindow targetUserId={selectedFriendId} inviteData={inviteData} />
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="hidden md:flex flex-col items-center justify-center h-full text-parchment-light-text opacity-50 space-y-4">
                            <div className="w-32 h-32 rounded-full bg-parchment-card-border/20 flex items-center justify-center">
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                </svg>
                            </div>
                            <p>{t('social:modal.selectFriend')}</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
