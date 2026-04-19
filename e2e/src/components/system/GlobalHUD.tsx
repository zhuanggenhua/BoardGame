import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOptionalSocial } from '../../contexts/SocialContext';
import { useModalStack } from '../../contexts/ModalStackContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { FabMenu, type FabAction } from './FabMenu';
import { MessageSquare, Settings, Info, MessageSquareWarning, Maximize, Minimize, Download, RefreshCw } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import {
    readAndroidLiveUpdateActivityState,
    readAndroidLiveUpdateConfig,
    requestAndroidLiveUpdateCheck,
    subscribeAndroidLiveUpdateActivityState,
} from '../../lib/mobile/androidLiveUpdates';
import { resolveAndroidWebAppDownload } from '../../lib/mobile/androidNativeUpdates';
import { isNativeAndroidRuntime } from '../../lib/mobile/androidRuntime';
import { shouldShowAndroidOtaToastOncePerDay } from '../../lib/mobile/otaToastGate';

const HUD_MODAL_NS = 'hud';
const LazyAudioProvider = lazy(() => import('../../contexts/AudioContext').then(m => ({ default: m.AudioProvider })));
const LazyAudioControlSection = lazy(() => import('../game/framework/widgets/AudioControlSection').then(m => ({ default: m.AudioControlSection })));
const LazyFriendsChatModal = lazy(() => import('../social/FriendsChatModal').then(m => ({ default: m.FriendsChatModal })));
const LazyAboutModal = lazy(() => import('./AboutModal').then(m => ({ default: m.AboutModal })));
const LazyFeedbackModal = lazy(() => import('./FeedbackModal').then(m => ({ default: m.FeedbackModal })));

type LegacyFullscreenDocument = Document & {
    msExitFullscreen?: () => Promise<void> | void;
    mozCancelFullScreen?: () => Promise<void> | void;
    webkitExitFullscreen?: () => Promise<void> | void;
};

type LegacyFullscreenElement = HTMLElement & {
    msRequestFullscreen?: () => Promise<void> | void;
    mozRequestFullScreen?: () => Promise<void> | void;
    webkitRequestFullscreen?: (keyboardInput?: number) => Promise<void> | void;
};

const LEGACY_KEYBOARD_INPUT_ALLOWED = 1;

const openExternalUrlInNewTab = (url: string) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.click();
};

export const GlobalHUD = () => {
    const isNativeAndroid = isNativeAndroidRuntime();
    const otaConfig = readAndroidLiveUpdateConfig(import.meta.env);
    const otaEnabledForCurrentShell = isNativeAndroid && otaConfig.enabled;
    const { t } = useTranslation('game');
    const { unreadTotal, requests, ensureRealtimeConnection } = useOptionalSocial();
    const { openModal, closeModal, closeByNamespace } = useModalStack();
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
    const [otaActivityState, setOtaActivityState] = useState(() => readAndroidLiveUpdateActivityState());

    const toggleFullscreen = async () => {
        const doc = document as LegacyFullscreenDocument;
        const elem = document.documentElement as LegacyFullscreenElement;

        if (!document.fullscreenElement) {
            try {
                if (elem.requestFullscreen) {
                    await elem.requestFullscreen();
                } else if (elem.msRequestFullscreen) {
                    await elem.msRequestFullscreen();
                } else if (elem.mozRequestFullScreen) {
                    await elem.mozRequestFullScreen();
                } else if (elem.webkitRequestFullscreen) {
                    await elem.webkitRequestFullscreen(LEGACY_KEYBOARD_INPUT_ALLOWED);
                }
                setIsFullscreen(true);
            } catch {
                toast.error(t('hud.fullscreen.enterFailed'));
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
        } catch {
            toast.error(t('hud.fullscreen.exitFailed'));
        }
    };

    const handleOpenAppDownload = async () => {
        const resolvedDownload = await resolveAndroidWebAppDownload();
        if (!resolvedDownload.url) {
            if (resolvedDownload.reason === 'manifest-unavailable') {
                toast.error(t('hud.download.resolveFailed'));
                return;
            }

            toast.warning(t('hud.download.missingLink'));
            return;
        }

        openExternalUrlInNewTab(resolvedDownload.url);
    };

    const handleCheckAppUpdate = () => {
        if (!otaEnabledForCurrentShell) {
            if (shouldShowAndroidOtaToastOncePerDay('disabled')) {
                toast.warning('当前测试版 App 已禁用 OTA 更新，请改用正式版安装包。');
            }
            return;
        }
        if (otaActivityState.active) {
            return;
        }
        requestAndroidLiveUpdateCheck({
            interactive: true,
            applyMode: 'immediate',
            initialImmediatePhase: 'checking',
        });
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

    useEffect(() => {
        if (!isNativeAndroid) {
            return;
        }

        return subscribeAndroidLiveUpdateActivityState((state) => {
            setOtaActivityState(state);
        });
    }, [isNativeAndroid]);

    // 从游戏页返回大厅/主页时，清理 HUD 自己打开的弹窗，避免遗留。
    useEffect(() => {
        if (isGamePage) return;
        closeByNamespace(HUD_MODAL_NS);
        queueMicrotask(() => {
            setSocialModalId(null);
        });
    }, [closeByNamespace, isGamePage]);

    if (isGamePage) return null;

    const isImmediateOtaActive = otaEnabledForCurrentShell && otaActivityState.active;

    // 定义菜单项（主按钮优先）
    const items: FabAction[] = [];

    // 0. 主按钮：设置（主页不需要红点，社交通知由铃铛承载）
    items.push({
        id: 'settings',
        icon: <Settings size={22} />,
        label: t('hud.actions.settings'),
        content: (
            <Suspense fallback={null}>
                <LazyAudioProvider>
                    <div>
                        <LazyAudioControlSection isDark={isDark} />
                    </div>
                </LazyAudioProvider>
            </Suspense>
        )
    });

    // 1. 全屏
    items.push({
        id: 'fullscreen',
        icon: isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />,
        label: isFullscreen ? t('hud.actions.exitFullscreen') : t('hud.actions.fullscreen'),
        onClick: toggleFullscreen
    });

    // 2. 网页端下载 App
    if (!isNativeAndroid) {
        items.push({
            id: 'download-app',
            icon: <Download size={20} />,
            label: t('hud.actions.downloadApp'),
            onClick: handleOpenAppDownload,
        });
    } else {
        items.push({
            id: 'check-update',
            icon: <RefreshCw size={20} className={isImmediateOtaActive ? 'animate-spin' : undefined} />,
            label: otaEnabledForCurrentShell
                ? t(isImmediateOtaActive ? 'hud.actions.checkingUpdate' : 'hud.actions.checkUpdate')
                : '测试版 OTA 已禁用',
            onClick: handleCheckAppUpdate,
        });
    }

    // 3. 关于
    items.push({
        id: 'about',
        icon: <Info size={20} />,
        label: t('hud.actions.about'),
        onClick: () => setShowAbout((prev) => !prev)
    });

    // 4. 反馈
    items.push({
        id: 'feedback',
        icon: <MessageSquareWarning size={20} />,
        label: t('hud.actions.feedback'),
        onClick: () => setShowFeedback((prev) => !prev)
    });

    // 5. 社交（仅登录用户）
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
            label: t('hud.actions.social'),
            onClick: () => {
                ensureRealtimeConnection();
                if (socialModalId) {
                    closeModal(socialModalId);
                    return;
                }
                const id = openModal({
                    id: `${HUD_MODAL_NS}_social`,
                    closeOnBackdrop: true,
                    closeOnEsc: true,
                    onClose: () => setSocialModalId(null),
                    render: ({ close }) => (
                        <Suspense fallback={null}>
                            <LazyFriendsChatModal isOpen onClose={close} />
                        </Suspense>
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

            {showAbout && (
                <Suspense fallback={null}>
                    <LazyAboutModal onClose={() => setShowAbout(false)} />
                </Suspense>
            )}
            {showFeedback && (
                <Suspense fallback={null}>
                    <LazyFeedbackModal onClose={() => setShowFeedback(false)} />
                </Suspense>
            )}
        </>
    );
};
