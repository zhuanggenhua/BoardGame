import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOptionalSocial } from '../../contexts/SocialContext';
import { useModalStack } from '../../contexts/ModalStackContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { FabMenu, type FabAction } from './FabMenu';
import { MessageSquare, Settings, Info, MessageSquareWarning, Maximize, Minimize, Download, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    HOME_ENTRY_STYLE_QUERY_VERSION_KEY,
    HOME_ENTRY_STYLE_VERSION,
    isHomeEntryRoute,
    isHomeV2PreviewRoute,
    persistHomeEntryStyle,
    resolveHomeEntryStyle,
    subscribeHomeEntryStyleChange,
    type HomeEntryStyle,
} from '../../lib/homeV2Routing';
import {
    readAndroidLiveUpdateActivityState,
    readAndroidLiveUpdateConfig,
    requestAndroidLiveUpdateCheck,
    subscribeAndroidLiveUpdateActivityState,
} from '../../lib/mobile/androidLiveUpdates';
import { resolveAndroidWebAppDownload } from '../../lib/mobile/androidNativeUpdates';
import { isNativeAndroidRuntime } from '../../lib/mobile/androidRuntime';
import { shouldShowAndroidOtaToastOncePerDay } from '../../lib/mobile/otaToastGate';
import { toggleDocumentFullscreen } from '../../lib/webFullscreen';

const HUD_MODAL_NS = 'hud';
const LazyAudioProvider = lazy(() => import('../../contexts/AudioContext').then(m => ({ default: m.AudioProvider })));
const LazyAudioControlSection = lazy(() => import('../game/framework/widgets/AudioControlSection').then(m => ({ default: m.AudioControlSection })));
const LazyFriendsChatModal = lazy(() => import('../social/FriendsChatModal').then(m => ({ default: m.FriendsChatModal })));
const LazyAboutModal = lazy(() => import('./AboutModal').then(m => ({ default: m.AboutModal })));
const LazyFeedbackModal = lazy(() => import('./FeedbackModal').then(m => ({ default: m.FeedbackModal })));

const HOME_STYLE_QUERY_PARAM = 'homeStyle';
const shouldHideOnRoute = (pathname: string) => (
    pathname === '/games/summonerwars/config'
    || pathname.startsWith('/games/summonerwars/config/')
    || pathname === '/games/dicethrone/config'
    || pathname.startsWith('/games/dicethrone/config/')
);

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
    const navigate = useNavigate();
    const toast = useToast();
    const [homeStyleRevision, setHomeStyleRevision] = useState(0);

    // 根据路由判断主题
    const isGamePage = location.pathname.startsWith('/play/');
    const shouldHideHud = shouldHideOnRoute(location.pathname);
    const isHomeEntryStyleRoute = isNativeAndroid && isHomeEntryRoute(location.pathname);
    const currentHomeEntryStyle: HomeEntryStyle = isHomeV2PreviewRoute(location.pathname)
        ? 'book'
        : resolveHomeEntryStyle(location.search);
    void homeStyleRevision;

    const isDark = false;

    const totalBadge = unreadTotal + requests.length;

    const [showAbout, setShowAbout] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
    const [socialModalId, setSocialModalId] = useState<string | null>(null);
    const [otaActivityState, setOtaActivityState] = useState(() => readAndroidLiveUpdateActivityState());

    const applyHomeEntryStyle = (nextStyle: HomeEntryStyle, closePanel?: () => void) => {
        persistHomeEntryStyle(nextStyle);
        closePanel?.();
        const nextSearchParams = new URLSearchParams();
        nextSearchParams.set(HOME_STYLE_QUERY_PARAM, nextStyle);
        if (nextStyle === 'book') {
            nextSearchParams.set(HOME_ENTRY_STYLE_QUERY_VERSION_KEY, HOME_ENTRY_STYLE_VERSION);
        }
        navigate(
            {
                pathname: '/',
                search: `?${nextSearchParams.toString()}`,
            },
            { replace: true },
        );
    };

    const toggleFullscreen = async () => {
        const result = await toggleDocumentFullscreen();
        if (result.ok) {
            setIsFullscreen(result.state === 'entered');
            return;
        }

        if (result.reason === 'ios-web-limited') {
            toast.info(t('hud.fullscreen.iosLimited'));
            return;
        }

        toast.error(t(
            result.reason === 'exit-failed'
                ? 'hud.fullscreen.exitFailed'
                : 'hud.fullscreen.enterFailed',
        ));
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

    useEffect(() => {
        return subscribeHomeEntryStyleChange(() => {
            setHomeStyleRevision((value) => value + 1);
        });
    }, []);

    // 从游戏页返回大厅/主页时，清理 HUD 自己打开的弹窗，避免遗留。
    useEffect(() => {
        if (isGamePage) return;
        closeByNamespace(HUD_MODAL_NS);
        queueMicrotask(() => {
            setSocialModalId(null);
        });
    }, [closeByNamespace, isGamePage]);

    if (isGamePage || shouldHideHud) return null;

    const isImmediateOtaActive = otaEnabledForCurrentShell && otaActivityState.active;

    // 定义菜单项（主按钮优先）
    const items: FabAction[] = [];

    // 0. 主按钮：设置（主页不需要红点，社交通知由铃铛承载）
    items.push({
        id: 'settings',
        icon: <Settings size={22} />,
        label: t('hud.actions.settings'),
        content: ({ closePanel }) => (
            <div className="space-y-4">
                {isHomeEntryStyleRoute ? (
                    <section className="space-y-2 border-b border-white/10 pb-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b6a47]">
                            {t('hud.homeStyle.title')}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {([
                                { id: 'book', label: t('hud.homeStyle.book') },
                                { id: 'classic', label: t('hud.homeStyle.classic') },
                            ] as Array<{ id: HomeEntryStyle; label: string }>).map((option) => {
                                const isActive = currentHomeEntryStyle === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        className={`rounded-[10px] border px-3 py-2.5 text-sm font-semibold transition-colors ${
                                            isActive
                                                ? 'border-[#b98741] bg-[linear-gradient(180deg,_rgba(247,232,192,0.96)_0%,_rgba(238,214,164,0.96)_100%)] text-[#5b391f] shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_1px_3px_rgba(91,57,31,0.10)]'
                                                : 'border-[#d7c3a4] bg-[rgba(255,251,241,0.82)] text-[#7a5a39] hover:border-[#c8ae84] hover:bg-[rgba(255,248,235,0.94)]'
                                        }`}
                                        onClick={() => applyHomeEntryStyle(option.id, closePanel)}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                ) : null}
                <Suspense fallback={null}>
                    <LazyAudioProvider>
                        <div>
                            <LazyAudioControlSection isDark={isDark} />
                        </div>
                    </LazyAudioProvider>
                </Suspense>
            </div>
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
                key={`global-hud-${location.pathname}-${currentHomeEntryStyle}`}
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
