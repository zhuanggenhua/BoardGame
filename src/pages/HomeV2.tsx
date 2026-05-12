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
import { FoldLinePageFlipStage } from '../components/home-v2/FoldLinePageFlipStage';
import { HomeSceneRenderer, type HomeV2SceneState } from '../ui-scene/runtime';

const HOME_V2_ASSET_ROOT = '/assets/common/images/home-v2';
const HOME_V2_BOOK_DESK = `${HOME_V2_ASSET_ROOT}/book-desk/compressed/1.webp`;
const HOME_V2_BOOK_IDLE_BACKGROUND = `${HOME_V2_ASSET_ROOT}/book-idle/1.png`;
const HOME_V2_OVERVIEW_BACKGROUND = `${HOME_V2_ASSET_ROOT}/overview-spread/1.png`;
const HOME_V2_MOBILE_LANDSCAPE_MAX_HEIGHT = 520;
const HOME_V2_MOBILE_LANDSCAPE_MAX_WIDTH = 1100;
const HOME_V2_PHONE_PRESENTATION_SCALE = 1.36;
const HOME_V2_PHONE_PRESENTATION_OFFSET_Y_PCT = 1.5;
const HOME_V2_STAGE_STANDARD_WIDTH = 1672;
const HOME_V2_STAGE_STANDARD_HEIGHT = 941;
const HOME_V2_STAGE_STANDARD_ASPECT_RATIO = HOME_V2_STAGE_STANDARD_WIDTH / HOME_V2_STAGE_STANDARD_HEIGHT;
const HOME_V2_ROOMS_LEFT_RECT = { left: '14.80%', top: '16.90%', width: '31.30%', height: '63.50%' };
const HOME_V2_ROOMS_RIGHT_RECT = { left: '50.15%', top: '16.90%', width: '33.20%', height: '63.50%' };
const HOME_V2_DETAIL_LEFT_RECT = { left: '15.20%', top: '18.60%', width: '30.80%', height: '60.20%' };
const HOME_V2_DETAIL_RIGHT_RECT = { left: '50.55%', top: '18.55%', width: '32.45%', height: '60.50%' };
const HOME_V2_FLIP_TO_DETAIL_RECT = { left: '50.55%', top: '6.40%', width: '37.10%', height: '84.80%' };
const HOME_V2_FLIP_TO_OVERVIEW_RECT = { left: '11.95%', top: '6.40%', width: '37.10%', height: '84.80%' };

type HomeV2TabId = 'lobby' | 'rooms';

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
    const [pendingGameId, setPendingGameId] = React.useState<string | null>(null);
    const [authMode, setAuthMode] = React.useState<'login' | 'register' | 'reset'>('login');
    const pendingGameIdRef = React.useRef<string | null>(null);
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
    const isOverviewDetailFlip = activeTab === 'lobby' && (sceneState === 'flippingToDetail' || sceneState === 'flippingToOverview');
    const bookStageLayout = React.useMemo(() => {
        const viewportWidth = Math.max(0, viewportSize.width);
        const viewportHeight = Math.max(0, viewportSize.height);
        if (isPhoneLandscapeViewport && viewportWidth > 0) {
            const width = viewportWidth * 0.94;
            const height = width / HOME_V2_STAGE_STANDARD_ASPECT_RATIO;
            return {
                width,
                height,
                scale: width > 0 ? width / HOME_V2_STAGE_STANDARD_WIDTH : 1,
            };
        }
        const maxWidth = Math.max(0, viewportWidth - 16);
        const maxHeight = Math.max(0, viewportHeight - 8);
        let width = maxWidth;
        let height = width / HOME_V2_STAGE_STANDARD_ASPECT_RATIO;

        if (height > maxHeight) {
            height = maxHeight;
            width = height * HOME_V2_STAGE_STANDARD_ASPECT_RATIO;
        }

        return {
            width,
            height,
            scale: width > 0 ? width / HOME_V2_STAGE_STANDARD_WIDTH : 1,
        };
    }, [isPhoneLandscapeViewport, viewportSize.height, viewportSize.width]);
    const stagedDetailGameId = selectedGameId ?? (sceneState === 'flippingToDetail' ? pendingGameId : null);
    const selectedGame = stagedDetailGameId ? getGameById(stagedDetailGameId) ?? null : null;
    const isExactDetailView = sceneState === 'detail';
    const isExactRoomsView = sceneState === 'overview' && activeTab === 'rooms';
    const isPageFlipping = sceneState === 'flippingToDetail'
        || sceneState === 'flippingToOverview';

    const handleGameOpen = React.useCallback((gameId: string) => {
        if (sceneState !== 'overview' || isPageFlipping) {
            return;
        }

        pendingGameIdRef.current = gameId;
        setPendingGameId(gameId);
        setSceneState('flippingToDetail');
    }, [isPageFlipping, sceneState]);

    const handleBackToOverview = React.useCallback(() => {
        if (sceneState !== 'detail' || isPageFlipping || !selectedGameId) {
            return;
        }

        pendingGameIdRef.current = null;
        setPendingGameId(null);
        setSceneState('flippingToOverview');
    }, [isPageFlipping, sceneState, selectedGameId]);

    const handleTabChange = React.useCallback((tabId: HomeV2TabId) => {
        if (tabId === activeTab || isPageFlipping) {
            return;
        }

        if (tabId === 'rooms') {
            setAuthMode('login');
        }

        if (sceneState !== 'overview') {
            return;
        }
        setActiveTab(tabId);
    }, [activeTab, isPageFlipping, sceneState]);

    const renderOverviewStage = React.useCallback(({ includeTestId = true }: { includeTestId?: boolean } = {}) => (
        <div
            data-testid={includeTestId ? 'home-v2-book-stage' : undefined}
            className="relative overflow-visible"
            style={{
                width: bookStageLayout.width,
                height: bookStageLayout.height,
                ['--home-v2-stage-scale' as const]: bookStageLayout.scale,
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
    ), [handleGameOpen, handleTabChange, overviewGames, bookStageLayout.height, bookStageLayout.scale, bookStageLayout.width]);

    const renderOverviewFlipStage = React.useCallback(({ includeTestId = true }: { includeTestId?: boolean } = {}) => (
        <div
            data-testid={includeTestId ? 'home-v2-book-stage' : undefined}
            className="relative overflow-visible"
            style={{
                width: bookStageLayout.width,
                height: bookStageLayout.height,
                ['--home-v2-stage-scale' as const]: bookStageLayout.scale,
            }}
        >
            <img
                src={HOME_V2_OVERVIEW_BACKGROUND}
                alt=""
                className="absolute inset-0 h-full w-full object-contain"
            />
        </div>
    ), [bookStageLayout.height, bookStageLayout.scale, bookStageLayout.width]);

    const renderDetailStage = React.useCallback(({ includeTestId = true }: { includeTestId?: boolean } = {}) => (
        <div
            data-testid={includeTestId ? 'home-v2-book-stage' : undefined}
            className="relative overflow-visible"
            style={{
                width: bookStageLayout.width,
                height: bookStageLayout.height,
                ['--home-v2-stage-scale' as const]: bookStageLayout.scale,
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
            </div>
        </div>
    ), [bookStageLayout.height, bookStageLayout.scale, bookStageLayout.width, handleBackToOverview, selectedGame]);

    const renderDetailFlipStage = React.useCallback(({ includeTestId = true }: { includeTestId?: boolean } = {}) => (
        <div
            data-testid={includeTestId ? 'home-v2-book-stage' : undefined}
            className="relative overflow-visible"
            style={{
                width: bookStageLayout.width,
                height: bookStageLayout.height,
                ['--home-v2-stage-scale' as const]: bookStageLayout.scale,
            }}
        >
            <img
                src={HOME_V2_BOOK_IDLE_BACKGROUND}
                alt=""
                className="absolute inset-0 h-full w-full object-contain"
            />
        </div>
    ), [bookStageLayout.height, bookStageLayout.scale, bookStageLayout.width]);

    const renderRoomsStage = React.useCallback(({ includeTestId = true }: { includeTestId?: boolean } = {}) => (
        <div
            data-testid={includeTestId ? 'home-v2-book-stage' : undefined}
            className="relative overflow-visible"
            style={{
                width: bookStageLayout.width,
                height: bookStageLayout.height,
                ['--home-v2-stage-scale' as const]: bookStageLayout.scale,
            }}
        >
            <img
                src={HOME_V2_BOOK_IDLE_BACKGROUND}
                alt=""
                className="absolute inset-0 h-full w-full object-contain"
            />
            <div className="absolute inset-0 z-10">
                <button
                    type="button"
                    data-testid="home-v2-rooms-back-to-lobby"
                    className="absolute border-0 bg-transparent p-0 text-[#5a4028]"
                    style={{
                        left: '15.4%',
                        top: '7.1%',
                        width: '13.2%',
                        height: '6.1%',
                        fontSize: 'calc(28px * var(--home-v2-stage-scale))',
                        fontWeight: 700,
                    }}
                    onClick={() => handleTabChange('lobby')}
                >
                    <span className="relative inline-flex h-full items-center justify-center px-[calc(6px*var(--home-v2-stage-scale))]">
                        {t('homeV2.catalog.allGames')}
                        <span
                            aria-hidden="true"
                            className="absolute bottom-[10%] left-1/2 h-[calc(2px*var(--home-v2-stage-scale))] w-[72%] -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,rgba(128,140,67,0)_0%,rgba(128,140,67,0.95)_20%,rgba(128,140,67,0.95)_80%,rgba(128,140,67,0)_100%)]"
                        />
                    </span>
                </button>
                <div style={renderAbsoluteRect(HOME_V2_ROOMS_LEFT_RECT)}>
                    <HomeV2LoginPanel
                        mode={authMode}
                        onModeChange={setAuthMode}
                    />
                </div>
                <div style={renderAbsoluteRect(HOME_V2_ROOMS_RIGHT_RECT)}>
                    <HomeV2AuthFormPanel
                        mode={authMode}
                        onModeChange={setAuthMode}
                    />
                </div>
            </div>
        </div>
    ), [authMode, bookStageLayout.height, bookStageLayout.scale, bookStageLayout.width, handleTabChange, t]);

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
                    {isExactHomepageOverview || isExactDetailView || isOverviewDetailFlip ? (
                        <FoldLinePageFlipStage
                            mode={isExactHomepageOverview ? 'overview' : isExactDetailView ? 'detail' : sceneState}
                            testId="home-v2-fold-line-flip"
                            renderOverviewStage={renderOverviewStage}
                            renderDetailStage={renderDetailStage}
                            renderOverviewFlipStage={renderOverviewFlipStage}
                            renderDetailFlipStage={renderDetailFlipStage}
                            overviewStageSize={bookStageLayout}
                            detailStageSize={bookStageLayout}
                            leftPageRect={HOME_V2_FLIP_TO_OVERVIEW_RECT}
                            rightPageRect={HOME_V2_FLIP_TO_DETAIL_RECT}
                            onFlipToDetailComplete={() => {
                                setSelectedGameId(pendingGameIdRef.current);
                                setPendingGameId(null);
                                setSceneState('detail');
                            }}
                            onFlipToOverviewComplete={() => {
                                setSelectedGameId(null);
                                setPendingGameId(null);
                                setSceneState('overview');
                            }}
                        />
                    ) : isExactRoomsView ? (
                        renderRoomsStage({ includeTestId: true })
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
                                onIntroOpenComplete={() => setSceneState('overview')}
                                onIntroTabsComplete={() => undefined}
                            />
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
};

