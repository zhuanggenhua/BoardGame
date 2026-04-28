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
const HOME_V2_BOOK_IDLE_BACKGROUND = `${HOME_V2_ASSET_ROOT}/book-idle/1.png`;
const HOME_V2_OVERVIEW_BACKGROUND = `${HOME_V2_ASSET_ROOT}/overview-spread/1.png`;
const HOME_V2_COMPILED_SCENE = compiledHomeV2Scene as UISceneCompiledArtifact;
const HOME_V2_MOBILE_LANDSCAPE_MAX_HEIGHT = 520;
const HOME_V2_MOBILE_LANDSCAPE_MAX_WIDTH = 1100;
const HOME_V2_PHONE_PRESENTATION_SCALE = 1.36;
const HOME_V2_PHONE_PRESENTATION_OFFSET_Y_PCT = 1.5;
const HOME_V2_OVERVIEW_ASPECT_RATIO = 1672 / 941;
const HOME_V2_BOOK_ARTBOARD_WIDTH = 896;
const HOME_V2_BOOK_ARTBOARD_HEIGHT = 720;
const HOME_V2_BOOK_ASPECT_RATIO = HOME_V2_BOOK_ARTBOARD_WIDTH / HOME_V2_BOOK_ARTBOARD_HEIGHT;
const HOME_V2_DETAIL_LEFT_RECT = { left: '17.86%', top: '30.28%', width: '27.23%', height: '44.17%' };
const HOME_V2_DETAIL_RIGHT_RECT = { left: '54.58%', top: '30.28%', width: '27.23%', height: '44.17%' };
const HOME_V2_TAB_LOBBY_RECT = { left: '85.49%', top: '33.82%', width: '6.00%', height: '4.45%' };
const HOME_V2_TAB_ROOMS_RECT = { left: '85.49%', top: '39.10%', width: '6.00%', height: '4.45%' };

type HomeV2TabId = 'lobby' | 'rooms';
const HOME_V2_TAB_ORDER: HomeV2TabId[] = ['lobby', 'rooms'];

function resolveTabFlipDirection(from: HomeV2TabId, to: HomeV2TabId): 'flippingTabForward' | 'flippingTabBackward' {
    const fromIndex = HOME_V2_TAB_ORDER.indexOf(from);
    const toIndex = HOME_V2_TAB_ORDER.indexOf(to);
    return toIndex >= fromIndex ? 'flippingTabForward' : 'flippingTabBackward';
}

function renderAbsoluteRect(rect: { left: string; top: string; width: string; height: string }): React.CSSProperties {
    return {
        position: 'absolute',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
    };
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
        () => (isPhoneLandscapeViewport
            ? {
                scaleMultiplier: HOME_V2_PHONE_PRESENTATION_SCALE,
                offsetYPct: HOME_V2_PHONE_PRESENTATION_OFFSET_Y_PCT,
            }
            : undefined),
        [isPhoneLandscapeViewport],
    );
    const overviewGames = React.useMemo(
        () => getAllGames().filter((game) => game.enabled && game.type === 'game'),
        [],
    );
    const isExactHomepageOverview = sceneState === 'overview' && activeTab === 'lobby';
    const overviewStageLayout = React.useMemo(() => {
        const viewportWidth = Math.max(0, viewportSize.width);
        const viewportHeight = Math.max(0, viewportSize.height);
        if (isPhoneLandscapeViewport && viewportWidth > 0) {
            const width = viewportWidth * 0.94;
            const height = width / HOME_V2_OVERVIEW_ASPECT_RATIO;
            return {
                width,
                height,
                scale: width > 0 ? width / 1672 : 1,
            };
        }
        const maxWidth = Math.max(0, viewportWidth - 16);
        const maxHeight = Math.max(0, viewportHeight - 8);
        let width = maxWidth;
        let height = width / HOME_V2_OVERVIEW_ASPECT_RATIO;

        if (height > maxHeight) {
            height = maxHeight;
            width = height * HOME_V2_OVERVIEW_ASPECT_RATIO;
        }

        return {
            width,
            height,
            scale: width > 0 ? width / 1672 : 1,
        };
    }, [isPhoneLandscapeViewport, viewportSize.height, viewportSize.width]);
    const detailStageLayout = React.useMemo(() => {
        const viewportWidth = Math.max(0, viewportSize.width);
        const viewportHeight = Math.max(0, viewportSize.height);
        const maxWidth = Math.max(0, viewportWidth - (isPhoneLandscapeViewport ? 10 : 24));
        const maxHeight = Math.max(0, viewportHeight - (isPhoneLandscapeViewport ? 10 : 16));
        let width = maxWidth;
        let height = width / HOME_V2_BOOK_ASPECT_RATIO;

        if (height > maxHeight) {
            height = maxHeight;
            width = height * HOME_V2_BOOK_ASPECT_RATIO;
        }

        return {
            width,
            height,
            scale: width > 0 ? width / HOME_V2_BOOK_ARTBOARD_WIDTH : 1,
        };
    }, [isPhoneLandscapeViewport, viewportSize.height, viewportSize.width]);
    const selectedGame = selectedGameId ? getGameById(selectedGameId) ?? null : null;
    const isExactDetailView = sceneState === 'detail';
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
        showLegacyTabs: !(sceneState === 'overview' && activeTab === 'lobby'),
        tabLabels: {
            lobby: t('homeV2.sceneTabs.lobby'),
            rooms: t('homeV2.sceneTabs.rooms'),
        },
    }), [activeTab, sceneState, t]);

    const actionHandlers = React.useMemo<Record<string, () => void>>(() => ({
        openLobbyTab: () => handleTabChange('lobby'),
        openRoomsTab: () => handleTabChange('rooms'),
    }), [handleTabChange]);

    const sceneSlots = React.useMemo(() => {
        const slots: Record<string, React.ReactNode> = {};

        if (activeTab === 'rooms') {
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

        return slots;
    }, [activeTab, authMode]);

    return (
        <main
            data-testid="home-v2-root"
            data-bg-friendly-screen="true"
            className="h-screen overflow-hidden bg-[linear-gradient(180deg,_#3a2b1f_0%,_#30241b_100%)]"
        >
            <div className="relative flex h-full items-center justify-center overflow-hidden">
                {isExactHomepageOverview ? (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(92,70,48,0.28)_0%,_rgba(13,10,8,0.92)_68%,_rgba(10,8,7,1)_100%)]" />
                ) : (
                    <>
                        <img
                            src={HOME_V2_BOOK_DESK}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover object-top opacity-90"
                        />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,216,160,0.16)_0%,_rgba(0,0,0,0)_42%),linear-gradient(180deg,_rgba(30,20,14,0.05)_0%,_rgba(24,16,11,0.16)_100%)]" />
                    </>
                )}
                <div className="relative flex h-full w-full items-center justify-center">
                    {isExactHomepageOverview ? (
                        <div
                            data-testid="home-v2-book-stage"
                            className="relative overflow-visible"
                            style={{
                                width: overviewStageLayout.width,
                                height: overviewStageLayout.height,
                                ['--home-v2-stage-scale' as const]: overviewStageLayout.scale,
                            }}
                        >
                            <img
                                src={HOME_V2_OVERVIEW_BACKGROUND}
                                alt=""
                                className="absolute inset-0 h-full w-full object-contain"
                            />
                            <div className="absolute inset-0 z-10" data-scene-slot="overview_spread_body">
                                <LobbyDirectory.OverviewSpread
                                    games={overviewGames}
                                    onGameClick={handleGameOpen}
                                    onAccountClick={() => handleTabChange('rooms')}
                                />
                            </div>
                        </div>
                    ) : isExactDetailView ? (
                        <div
                            data-testid="home-v2-book-stage"
                            className="relative overflow-visible"
                            style={{
                                width: detailStageLayout.width,
                                height: detailStageLayout.height,
                                ['--home-v2-stage-scale' as const]: detailStageLayout.scale,
                            }}
                        >
                            <img
                                src={HOME_V2_BOOK_IDLE_BACKGROUND}
                                alt=""
                                className="absolute inset-0 h-full w-full object-contain"
                            />
                            <div className="absolute inset-0 z-10">
                                <div style={renderAbsoluteRect(HOME_V2_DETAIL_LEFT_RECT)}>
                                    <GameDetailsLeft
                                        game={selectedGame}
                                        onBack={handleBackToOverview}
                                    />
                                </div>
                                <div style={renderAbsoluteRect(HOME_V2_DETAIL_RIGHT_RECT)}>
                                    <GameDetailsRight game={selectedGame} />
                                </div>
                                <button
                                    type="button"
                                    aria-label={t('homeV2.sceneTabs.lobby')}
                                    style={renderAbsoluteRect(HOME_V2_TAB_LOBBY_RECT)}
                                    className="absolute z-20 bg-transparent"
                                    onClick={() => handleTabChange('lobby')}
                                />
                                <button
                                    type="button"
                                    aria-label={t('homeV2.sceneTabs.rooms')}
                                    style={renderAbsoluteRect(HOME_V2_TAB_ROOMS_RECT)}
                                    className="absolute z-20 bg-transparent"
                                    onClick={() => handleTabChange('rooms')}
                                />
                            </div>
                        </div>
                    ) : (
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
                    )}
                </div>
            </div>
        </main>
    );
};

