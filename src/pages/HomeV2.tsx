import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { getAllGames, getGameById } from '../config/games.config';
import {
    HomeV2AuthFormPanel,
    HomeV2LoginPanel,
} from '../components/home-v2/HomeTabPanels';
import { LobbyDirectory } from '../components/home-v2/LobbyDirectory';
import { GameDetailsLeft, GameDetailsRight } from '../components/home-v2/GameDetails';
import compiledHomeV2Scene from '../ui-scenes/home-v2/home-v2.compiled.json';
import { CompiledSceneRenderer, HomeSceneRenderer, type HomeV2SceneState } from '../ui-scene/runtime';
import type { UISceneCompiledArtifact } from '../ui-scene/types';

const HOME_V2_ASSET_ROOT = '/assets/common/images/home-v2';
const HOME_V2_BOOK_DESK = `${HOME_V2_ASSET_ROOT}/book-desk/compressed/1.webp`;
const HOME_V2_COMPILED_SCENE = compiledHomeV2Scene as UISceneCompiledArtifact;
const HOME_V2_MOBILE_LANDSCAPE_MAX_HEIGHT = 520;
const HOME_V2_MOBILE_LANDSCAPE_MAX_WIDTH = 1100;
const HOME_V2_PHONE_PRESENTATION_SCALE = 1.28;

type HomeV2TabId = 'lobby' | 'rooms';
const HOME_V2_TAB_ORDER: HomeV2TabId[] = ['lobby', 'rooms'];

function resolveTabFlipDirection(from: HomeV2TabId, to: HomeV2TabId): 'flippingTabForward' | 'flippingTabBackward' {
    const fromIndex = HOME_V2_TAB_ORDER.indexOf(from);
    const toIndex = HOME_V2_TAB_ORDER.indexOf(to);
    return toIndex >= fromIndex ? 'flippingTabForward' : 'flippingTabBackward';
}

export const HomeV2 = () => {
    const { t } = useTranslation('lobby');
    const [searchParams] = useSearchParams();
    const [sceneState, setSceneState] = React.useState<HomeV2SceneState>('open');
    const [activeTab, setActiveTab] = React.useState<HomeV2TabId>('lobby');
    const [selectedGameId, setSelectedGameId] = React.useState<string | null>(null);
    const [authMode, setAuthMode] = React.useState<'login' | 'register' | 'reset'>('login');
    const pendingGameIdRef = React.useRef<string | null>(null);
    const pendingTabIdRef = React.useRef<HomeV2TabId | null>(null);
    const queuedTabAfterOverviewRef = React.useRef<HomeV2TabId | null>(null);
    const debugRegions = searchParams.get('homeV2Debug') === '1';
    const [viewportSize, setViewportSize] = React.useState(() => ({
        width: typeof window === 'undefined' ? 0 : window.innerWidth,
        height: typeof window === 'undefined' ? 0 : window.innerHeight,
    }));

    React.useEffect(() => {
        const syncViewport = () => {
            setViewportSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };
        syncViewport();
        window.addEventListener('resize', syncViewport);
        return () => window.removeEventListener('resize', syncViewport);
    }, []);

    const isPhoneLandscapeViewport = viewportSize.width > viewportSize.height
        && viewportSize.height <= HOME_V2_MOBILE_LANDSCAPE_MAX_HEIGHT
        && viewportSize.width <= HOME_V2_MOBILE_LANDSCAPE_MAX_WIDTH;
    const viewportAspectRatio = viewportSize.height > 0 ? viewportSize.width / viewportSize.height : 0;
    const wideLandscapeShellScale = viewportAspectRatio >= 2 ? 1.14 : 1;
    const presentationOverride = React.useMemo(
        () => (isPhoneLandscapeViewport ? { scaleMultiplier: HOME_V2_PHONE_PRESENTATION_SCALE } : undefined),
        [isPhoneLandscapeViewport],
    );
    const overviewGames = React.useMemo(
        () => getAllGames().filter((game) => game.enabled && game.type === 'game'),
        [],
    );
    const selectedGame = selectedGameId ? getGameById(selectedGameId) ?? null : null;
    const isPageFlipping = sceneState === 'flippingToDetail'
        || sceneState === 'flippingToOverview'
        || sceneState === 'flippingTabForward'
        || sceneState === 'flippingTabBackward';

    const handleGameOpen = React.useCallback((gameId: string) => {
        if (sceneState !== 'overview' || isPageFlipping) {
            return;
        }

        pendingGameIdRef.current = gameId;
        setSceneState('flippingToDetail');
    }, [isPageFlipping, sceneState]);

    const handleBackToOverview = React.useCallback(() => {
        if (sceneState !== 'detail' || isPageFlipping || !selectedGameId) {
            return;
        }

        pendingGameIdRef.current = null;
        setSceneState('flippingToOverview');
    }, [isPageFlipping, sceneState, selectedGameId]);

    const handleTabChange = React.useCallback((tabId: HomeV2TabId) => {
        if (tabId === activeTab || isPageFlipping) {
            return;
        }

        if (tabId === 'rooms') {
            setAuthMode('login');
        }

        if (sceneState === 'detail') {
            queuedTabAfterOverviewRef.current = tabId;
            pendingGameIdRef.current = null;
            setSceneState('flippingToOverview');
            return;
        }

        if (sceneState !== 'overview') {
            return;
        }

        pendingTabIdRef.current = tabId;
        setSceneState(resolveTabFlipDirection(activeTab, tabId));
    }, [activeTab, isPageFlipping, sceneState]);

    const handleSceneEvent = React.useCallback((event: { eventId: string }) => {
        if (event.eventId === 'page.flip.to-detail.complete') {
            setSelectedGameId(pendingGameIdRef.current);
            setSceneState('detail');
            return;
        }

        if (event.eventId === 'page.flip.to-overview.complete') {
            setSelectedGameId(null);
            const queuedTab = queuedTabAfterOverviewRef.current;
            queuedTabAfterOverviewRef.current = null;
            if (queuedTab && queuedTab !== activeTab) {
                pendingTabIdRef.current = queuedTab;
                setSceneState(resolveTabFlipDirection(activeTab, queuedTab));
                return;
            }
            setSceneState('overview');
            return;
        }

        if (event.eventId === 'page.flip.tab.forward.complete' || event.eventId === 'page.flip.tab.backward.complete') {
            const nextTab = pendingTabIdRef.current;
            pendingTabIdRef.current = null;
            if (nextTab) {
                setActiveTab(nextTab);
            }
            setSceneState('overview');
        }
    }, [activeTab]);

    const sceneContext = React.useMemo(() => ({
        activeTab,
        tabLabels: {
            lobby: t('homeV2.sceneTabs.lobby'),
            rooms: t('homeV2.sceneTabs.rooms'),
        },
    }), [activeTab, t]);

    const actionHandlers = React.useMemo<Record<string, () => void>>(() => ({
        openLobbyTab: () => handleTabChange('lobby'),
        openRoomsTab: () => handleTabChange('rooms'),
    }), [handleTabChange]);

    const sceneSlots = React.useMemo(() => {
        const slots: Record<string, React.ReactNode> = {};

        if (activeTab === 'lobby') {
            slots.overview_left_page = (
                <LobbyDirectory.Left
                    games={overviewGames}
                    onGameClick={handleGameOpen}
                />
            );
        } else if (activeTab === 'rooms') {
            slots.overview_left_page = (
                <HomeV2LoginPanel
                    mode={authMode}
                    onModeChange={setAuthMode}
                />
            );
            slots.overview_right_page = (
                <HomeV2AuthFormPanel
                    mode={authMode}
                    onModeChange={setAuthMode}
                />
            );
        }

        if (sceneState === 'detail') {
            slots.detail_left_page = (
                <GameDetailsLeft
                    game={selectedGame}
                    onBack={handleBackToOverview}
                />
            );
            slots.detail_right_page = <GameDetailsRight game={selectedGame} />;
        }

        return slots;
    }, [activeTab, authMode, handleBackToOverview, handleGameOpen, overviewGames, sceneState, selectedGame]);

    return (
        <main
            data-testid="home-v2-root"
            data-bg-friendly-screen="true"
            className="h-screen overflow-hidden bg-[linear-gradient(180deg,_#1f130d_0%,_#120b07_100%)]"
        >
            <div className="relative flex h-full items-center justify-center overflow-hidden">
                <img
                    src={HOME_V2_BOOK_DESK}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,216,160,0.16)_0%,_rgba(0,0,0,0)_40%),linear-gradient(180deg,_rgba(20,11,7,0.2)_0%,_rgba(9,5,4,0.46)_100%)]" />
                <div className="relative flex h-full w-full items-center justify-center">
                    <div
                        data-testid="home-v2-shell-ready"
                        className="relative h-[100%] max-w-full aspect-[896/720] overflow-visible"
                        style={{
                            transform: `scale(${wideLandscapeShellScale})`,
                            transformOrigin: 'center center',
                        }}
                    >
                        <HomeSceneRenderer
                            testId="home-v2-book-stage"
                            debugRegions={debugRegions}
                            sceneState={sceneState}
                            presentationOverride={presentationOverride}
                            sceneContext={sceneContext}
                            onIntroOpenComplete={() => setSceneState('tabs')}
                            onIntroTabsComplete={() => setSceneState('overview')}
                            onSceneEvent={handleSceneEvent}
                        >
                            <CompiledSceneRenderer
                                scene={HOME_V2_COMPILED_SCENE}
                                activeState={sceneState}
                                slots={sceneSlots}
                                actionHandlers={actionHandlers}
                            />
                        </HomeSceneRenderer>
                    </div>
                </div>
            </div>
        </main>
    );
};

