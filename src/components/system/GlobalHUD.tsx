import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSocial } from '../../contexts/SocialContext';
import { useModalStack } from '../../contexts/ModalStackContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { FriendsChatModal } from '../social/FriendsChatModal';
import { FabMenu, type FabAction } from './FabMenu';
import { AudioControlSection } from '../game/AudioControlSection';
import { MessageSquare, Settings, Info, MessageSquareWarning, Maximize, Minimize } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { AboutModal } from './AboutModal';
import { FeedbackModal } from './FeedbackModal';

export const GlobalHUD = () => {
    const { t } = useTranslation('game');
    const { unreadTotal, requests } = useSocial();
    const { openModal, closeModal } = useModalStack();
    const { user } = useAuth();
    const location = useLocation();
    const toast = useToast();

    // 根据路由判断主题
    const isGamePage = location.pathname.startsWith('/play/');

    const isDark = false;

    const totalBadge = unreadTotal + requests.length;

    const [showAbout, setShowAbout] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
    const [socialModalId, setSocialModalId] = useState<string | null>(null);

    const toggleFullscreen = async () => {
        const doc = document as any;
        const elem = document.documentElement as any;

        if (!document.fullscreenElement) {
            try {
                if (elem.requestFullscreen) {
                    await elem.requestFullscreen();
                } else if (elem.msRequestFullscreen) {
                    await elem.msRequestFullscreen();
                } else if (elem.mozRequestFullScreen) {
                    await elem.mozRequestFullScreen();
                } else if (elem.webkitRequestFullscreen) {
                    await elem.webkitRequestFullscreen((Element as any).ALLOW_KEYBOARD_INPUT);
                }
                setIsFullscreen(true);
            } catch (error) {
                toast.error('全屏失败，请检查浏览器权限或是否被系统全屏占用。');
            }
            return;
        }

        try {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if (doc.msExitFullscreen) {
                await doc.msExitFullscreen();
            } else if (doc.mozCancelFullScreen) {
                await doc.mozCancelFullScreen();
            } else if (doc.webkitExitFullscreen) {
                await doc.webkitExitFullscreen();
            }
            setIsFullscreen(false);
        } catch (error) {
            toast.error('退出全屏失败，请检查浏览器权限或系统状态。');
        }
    };

    useEffect(() => {
        if (isGamePage) {
            return;
        }
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, [isGamePage]);

    if (isGamePage) return null;

    // 定义菜单项（主按钮优先）
    const items: FabAction[] = [];

    // 0. 主按钮：设置
    items.push({
        id: 'settings',
        icon: (
            <div className="relative">
                <Settings size={22} />
                {totalBadge > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-black/50" />
                )}
            </div>
        ),
        label: t('hud.actions.settings') || 'Settings',
        content: (
            <div>
                <AudioControlSection isDark={isDark} />
            </div>
        )
    });

    // 1. 全屏
    items.push({
        id: 'fullscreen',
        icon: isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />,
        label: isFullscreen ? t('hud.actions.exitFullscreen') || '退出全屏' : t('hud.actions.fullscreen') || '全屏',
        onClick: toggleFullscreen
    });

    // 2. 关于
    items.push({
        id: 'about',
        icon: <Info size={20} />,
        label: t('hud.actions.about'),
        onClick: () => setShowAbout((prev) => !prev)
    });

    // 3. 反馈
    items.push({
        id: 'feedback',
        icon: <MessageSquareWarning size={20} />,
        label: t('hud.actions.feedback'),
        onClick: () => setShowFeedback((prev) => !prev)
    });

    // 4. 社交（仅登录用户）
    if (user) {
        items.push({
            id: 'social',
            icon: (
                <div className="relative">
                    <MessageSquare size={20} />
                    {totalBadge > 0 && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 bg-red-500 rounded-full text-[8px] text-white font-bold border border-black/20 overflow-hidden leading-none">
                            {totalBadge > 9 ? '9+' : totalBadge}
                        </span>
                    )}
                </div>
            ),
            label: t('hud.actions.social') || '好友',
            onClick: () => {
                if (socialModalId) {
                    closeModal(socialModalId);
                    return;
                }
                const id = openModal({
                    id: 'hud_social',
                    closeOnBackdrop: true,
                    closeOnEsc: true,
                    onClose: () => setSocialModalId(null),
                    render: ({ close }) => (
                        <FriendsChatModal isOpen onClose={close} />
                    ),
                });
                setSocialModalId(id);
            }
        });
    }

    return (
        <>
            <FabMenu
                isDark={isDark}
                items={items}
                position="bottom-right"
            />

            {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
            {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
        </>
    );
};
