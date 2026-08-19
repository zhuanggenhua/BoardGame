import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getAllGames, getGameById } from '../config/games.config';
import { AuthModal } from '../components/auth/AuthModal';
import { LobbyDirectory, type HomeV2ContinueMatch, type LobbyCategory } from '../components/home-v2/LobbyDirectory';
import { GameDetailsLeft, GameDetailsRight } from '../components/home-v2/GameDetails';
import { FoldLinePageFlipStage } from '../components/home-v2/FoldLinePageFlipStage';
import { HomeVersionFooter } from '../components/home/HomeVersionFooter';
import { HomeV2DangerConfirmModal } from '../components/common/overlays/HomeV2DangerConfirmModal';
import {
    claimSeat,
    destroyMatch as destroyOwnedMatch,
    getLatestStoredMatchCredentials,
    getOwnerActiveMatch,
    readStoredMatchCredentials,
} from '../hooks/match/useMatchStatus';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getGuestName, getOrCreateGuestId } from '../hooks/match/ownerIdentity';
import { useGamePopularityRanking } from '../hooks/useGamePopularityRanking';
import { useLobbyStats } from '../hooks/useLobbyStats';
import { getOptimizedImageUrls } from '../core/AssetLoader';

const HOME_V2_ASSET_ROOT = 'common/images/home-v2';
const HOME_V2_OVERVIEW_BACKGROUND = getOptimizedImageUrls(`${HOME_V2_ASSET_ROOT}/book-catalog-wide/1.png`).webp;
const HOME_V2_MOBILE_LANDSCAPE_MAX_HEIGHT = 520;
const HOME_V2_MOBILE_LANDSCAPE_MAX_WIDTH = 1100;
const HOME_V2_OVERVIEW_STAGE_WIDTH = 1864;
const HOME_V2_OVERVIEW_STAGE_HEIGHT = 843;
const HOME_V2_OVERVIEW_STAGE_ASPECT_RATIO = HOME_V2_OVERVIEW_STAGE_WIDTH / HOME_V2_OVERVIEW_STAGE_HEIGHT;
const HOME_V2_STAGE_STANDARD_WIDTH = 1864;
const HOME_V2_STAGE_STANDARD_HEIGHT = 843;
const HOME_V2_STAGE_STANDARD_ASPECT_RATIO = HOME_V2_STAGE_STANDARD_WIDTH / HOME_V2_STAGE_STANDARD_HEIGHT;
const HOME_V2_INTERNAL_PAGE_FLIP_DURATION_MS = 560;
const HOME_V2_DETAIL_LEFT_RECT = { left: '10.80%', top: '9.35%', width: '37.20%', height: '77.60%' };
const HOME_V2_DETAIL_RIGHT_RECT = { left: '51.40%', top: '9.35%', width: '38.80%', height: '77.60%' };
const HOME_V2_FLIP_TO_DETAIL_RECT = { left: '50.55%', top: '6.40%', width: '37.10%', height: '84.80%' };
const HOME_V2_FLIP_TO_OVERVIEW_RECT = { left: '11.95%', top: '6.40%', width: '37.10%', height: '84.80%' };
const HOME_V2_CATEGORY_ORDER: LobbyCategory[] = ['all', 'card', 'dice', 'abstract', 'wargame', 'casual', 'tools'];

type HomeV2SceneState =
    | 'overview'
    | 'detail'
    | 'flippingToDetail'
    | 'flippingToOverview'
    | 'flippingCategoryForward'
    | 'flippingCategoryBackward'
    | 'flippingCatalogPageForward'
    | 'flippingCatalogPageBackward';

type HomeV2StageStyle = React.CSSProperties & {
    '--home-v2-stage-scale': number;
};

function renderAbsoluteRect(rect: { left: string; top: string; width: string; height: string }): React.CSSProperties {
    return {
        position: 'absolute',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
    };
}

function renderStageStyle(layout: { width: number; height: number; scale: number }): HomeV2StageStyle {
    return {
        width: layout.width,
        height: layout.height,
        '--home-v2-stage-scale': layout.scale,
    };
}

export const HomeV2 = () => {
    const { t } = useTranslation('lobby');
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const toast = useToast();
    const [sceneState, setSceneState] = React.useState<HomeV2SceneState>('overview');
    const [selectedGameId, setSelectedGameId] = React.useState<string | null>(null);
    const [pendingGameId, setPendingGameId] = React.useState<string | null>(null);
    const [activeCategory, setActiveCategory] = React.useState<LobbyCategory>('all');
    const [pendingCategory, setPendingCategory] = React.useState<LobbyCategory | null>(null);
    const [catalogPageIndex, setCatalogPageIndex] = React.useState(0);
    const [pendingCatalogPageIndex, setPendingCatalogPageIndex] = React.useState<number | null>(null);
    const [authMode, setAuthMode] = React.useState<'login' | 'register' | 'reset'>('login');
    const [authModalOpen, setAuthModalOpen] = React.useState(false);
    const [matchStorageTick, setMatchStorageTick] = React.useState(0);
    const [pendingDestroyMatch, setPendingDestroyMatch] = React.useState<HomeV2ContinueMatch | null>(null);
    const [isDestroyingMatch, setIsDestroyingMatch] = React.useState(false);
    const pendingGameIdRef = React.useRef<string | null>(null);
    const [viewportSize, setViewportSize] = React.useState(() => ({
        width: typeof window === 'undefined' ? 0 : window.innerWidth,
        height: typeof window === 'undefined' ? 0 : window.innerHeight,
    }));
    const gamePopularityRanking = useGamePopularityRanking();
    const { mostPopularGameId } = useLobbyStats();

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
    const overviewGames = React.useMemo(
        () => getAllGames().filter((game) => game.enabled),
        [],
    );
    const continueMatch = React.useMemo<HomeV2ContinueMatch | null>(() => {
        void matchStorageTick;
        const stored = getLatestStoredMatchCredentials();
        const ownerActive = getOwnerActiveMatch();
        const guestId = user?.id ? undefined : getOrCreateGuestId();

        const resolveGameLabel = (gameName?: string) => {
            const game = gameName ? getGameById(gameName) : null;
            return game ? game.titleKey ? t(game.titleKey) : game.id : (gameName || '未知游戏');
        };

        if (stored?.matchID && stored.gameName) {
            return {
                matchID: stored.matchID,
                gameName: stored.gameName,
                gameLabel: resolveGameLabel(stored.gameName),
                playerID: stored.playerID,
                playerLabel: stored.playerID ? `玩家 ${stored.playerID}` : undefined,
                isHost: stored.playerID === '0',
            };
        }

        if (ownerActive?.matchID && ownerActive.gameName && (!ownerActive.ownerKey || ownerActive.ownerKey === `guest:${guestId}` || ownerActive.ownerKey === `user:${user?.id}`)) {
            return {
                matchID: ownerActive.matchID,
                gameName: ownerActive.gameName,
                gameLabel: resolveGameLabel(ownerActive.gameName),
                playerID: '0',
                playerLabel: '玩家 0',
                isHost: true,
            };
        }

        return null;
    }, [matchStorageTick, t, user?.id]);
    const isExactHomepageOverview = sceneState === 'overview';
    const isOverviewDetailFlip = sceneState === 'flippingToDetail' || sceneState === 'flippingToOverview';
    const isCategoryFlip = sceneState === 'flippingCategoryForward' || sceneState === 'flippingCategoryBackward';
    const isCatalogPageFlip = sceneState === 'flippingCatalogPageForward' || sceneState === 'flippingCatalogPageBackward';
    const createStageLayout = React.useCallback((standardWidth: number, aspectRatio: number) => {
        const viewportWidth = Math.max(0, viewportSize.width);
        const viewportHeight = Math.max(0, viewportSize.height);
        if (isPhoneLandscapeViewport && viewportWidth > 0) {
            const width = viewportWidth * (aspectRatio > 2 ? 0.99 : 0.94);
            const height = width / aspectRatio;
            return {
                width,
                height,
                scale: width > 0 ? width / standardWidth : 1,
            };
        }
        const maxWidth = Math.max(0, viewportWidth - 16);
        const maxHeight = Math.max(0, viewportHeight - 8);
        let width = maxWidth;
        let height = width / aspectRatio;

        if (height > maxHeight) {
            height = maxHeight;
            width = height * aspectRatio;
        }

        return {
            width,
            height,
            scale: width > 0 ? width / standardWidth : 1,
        };
    }, [isPhoneLandscapeViewport, viewportSize.height, viewportSize.width]);
    const overviewStageLayout = React.useMemo(
        () => createStageLayout(HOME_V2_OVERVIEW_STAGE_WIDTH, HOME_V2_OVERVIEW_STAGE_ASPECT_RATIO),
        [createStageLayout],
    );
    const detailStageLayout = React.useMemo(
        () => createStageLayout(HOME_V2_STAGE_STANDARD_WIDTH, HOME_V2_STAGE_STANDARD_ASPECT_RATIO),
        [createStageLayout],
    );
    const stagedDetailGameId = selectedGameId ?? (sceneState === 'flippingToDetail' ? pendingGameId : null);
    const selectedGame = stagedDetailGameId ? getGameById(stagedDetailGameId) ?? null : null;
    const isExactDetailView = sceneState === 'detail';
    const isPageFlipping = sceneState === 'flippingToDetail'
        || sceneState === 'flippingToOverview'
        || sceneState === 'flippingCategoryForward'
        || sceneState === 'flippingCategoryBackward'
        || sceneState === 'flippingCatalogPageForward'
        || sceneState === 'flippingCatalogPageBackward';

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

    const handleOpenAuthModal = React.useCallback(() => {
        if (sceneState !== 'overview' || isPageFlipping) {
            return;
        }

        setAuthMode('login');
        setAuthModalOpen(true);
    }, [isPageFlipping, sceneState]);

    const handleCategoryChange = React.useCallback((nextCategory: LobbyCategory) => {
        if (sceneState !== 'overview' || isPageFlipping || nextCategory === activeCategory) {
            return;
        }

        const currentIndex = HOME_V2_CATEGORY_ORDER.indexOf(activeCategory);
        const nextIndex = HOME_V2_CATEGORY_ORDER.indexOf(nextCategory);
        const isForward = nextIndex >= currentIndex;

        setPendingCategory(nextCategory);
        setPendingCatalogPageIndex(0);
        setSceneState(isForward ? 'flippingCategoryForward' : 'flippingCategoryBackward');
    }, [activeCategory, isPageFlipping, sceneState]);

    const handleCatalogPageChange = React.useCallback((nextPageIndex: number) => {
        if (sceneState !== 'overview' || isPageFlipping || nextPageIndex === catalogPageIndex) {
            return;
        }

        setPendingCatalogPageIndex(nextPageIndex);
        setSceneState(nextPageIndex > catalogPageIndex ? 'flippingCatalogPageForward' : 'flippingCatalogPageBackward');
    }, [catalogPageIndex, isPageFlipping, sceneState]);

    const handleContinueMatch = React.useCallback((match: HomeV2ContinueMatch) => {
        if (!match.matchID || !match.gameName) return;
        navigate(`/play/${match.gameName}/match/${match.matchID}?playerID=${match.playerID ?? '0'}`);
    }, [navigate]);

    const handleDestroyContinueMatch = React.useCallback(async () => {
        if (!pendingDestroyMatch || isDestroyingMatch) {
            return;
        }

        const guestId = user?.id ? undefined : getOrCreateGuestId();
        const guestName = getGuestName(t, guestId);
        setIsDestroyingMatch(true);
        try {
            const storedCredentials = readStoredMatchCredentials(pendingDestroyMatch.matchID);
            let destroyPlayerID = storedCredentials?.playerID ?? pendingDestroyMatch.playerID ?? '0';
            let destroyCredentials = storedCredentials?.credentials ?? null;

            if (!destroyCredentials || destroyPlayerID !== '0') {
                const claimResult = await claimSeat(pendingDestroyMatch.gameName, pendingDestroyMatch.matchID, '0', {
                    token: token ?? undefined,
                    guestId,
                    playerName: user?.username ?? guestName,
                });
                if (!claimResult.success || !claimResult.credentials) {
                    toast.error({ kind: 'i18n', key: 'error.ownerClaimFailed', ns: 'lobby' });
                    return;
                }
                destroyPlayerID = '0';
                destroyCredentials = claimResult.credentials;
            }

            let result = await destroyOwnedMatch(pendingDestroyMatch.gameName, pendingDestroyMatch.matchID, destroyPlayerID, destroyCredentials);
            if (!result.success && result.error === 'forbidden') {
                const claimResult = await claimSeat(pendingDestroyMatch.gameName, pendingDestroyMatch.matchID, '0', {
                    token: token ?? undefined,
                    guestId,
                    playerName: user?.username ?? guestName,
                });
                if (!claimResult.success || !claimResult.credentials) {
                    toast.error({ kind: 'i18n', key: 'error.ownerClaimFailed', ns: 'lobby' });
                    return;
                }
                result = await destroyOwnedMatch(pendingDestroyMatch.gameName, pendingDestroyMatch.matchID, '0', claimResult.credentials);
            }

            if (!result.success) {
                if (result.error === 'forbidden') {
                    toast.error({ kind: 'i18n', key: 'error.destroyForbidden', ns: 'lobby' });
                } else {
                    toast.error({ kind: 'i18n', key: 'error.destroyNetwork', ns: 'lobby' });
                }
                return;
            }

            setPendingDestroyMatch(null);
            setMatchStorageTick((tick) => tick + 1);
        } finally {
            setIsDestroyingMatch(false);
        }
    }, [isDestroyingMatch, pendingDestroyMatch, t, toast, token, user?.id, user?.username]);

    React.useEffect(() => {
        const refresh = () => setMatchStorageTick((tick) => tick + 1);
        window.addEventListener('match-credentials-changed', refresh);
        window.addEventListener('owner-active-match-changed', refresh);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener('match-credentials-changed', refresh);
            window.removeEventListener('owner-active-match-changed', refresh);
            window.removeEventListener('storage', refresh);
        };
    }, []);

    const renderOverviewStageForCategory = React.useCallback((
        category: LobbyCategory,
        pageIndex: number,
        onCategorySelect: (nextCategory: LobbyCategory) => void,
        onCatalogPageSelect: (nextPageIndex: number) => void,
        { includeTestId = true }: { includeTestId?: boolean } = {},
    ) => (
        <div
            data-testid={includeTestId ? 'home-v2-book-stage' : undefined}
            className="relative overflow-visible"
            style={renderStageStyle(overviewStageLayout)}
        >
            <img
                src={HOME_V2_OVERVIEW_BACKGROUND}
                alt=""
                className="absolute inset-0 h-full w-full object-contain"
            />
            <div className="absolute inset-0 z-10" data-scene-slot="overview_spread_body">
                <LobbyDirectory.OverviewSpread
                    games={overviewGames}
                    popularityByGameId={gamePopularityRanking.popularityByGameId}
                    mostPopularGameId={mostPopularGameId}
                    activeCategory={category}
                    onCategoryChange={onCategorySelect}
                    catalogPageIndex={pageIndex}
                    onCatalogPageChange={onCatalogPageSelect}
                    onGameClick={handleGameOpen}
                    onAccountClick={handleOpenAuthModal}
                    continueMatch={continueMatch}
                    onContinueMatch={handleContinueMatch}
                    onDestroyContinueMatch={(match) => setPendingDestroyMatch(match)}
                />
                <HomeVersionFooter
                    align="left"
                    compact
                    positionMode="absolute"
                    positionClassName="left-[10.8%] top-[77.6%]"
                    theme="book"
                />
            </div>
        </div>
    ), [continueMatch, gamePopularityRanking.popularityByGameId, handleContinueMatch, handleGameOpen, handleOpenAuthModal, mostPopularGameId, overviewGames, overviewStageLayout.height, overviewStageLayout.scale, overviewStageLayout.width]);

    const renderCurrentOverviewStage = React.useCallback(
        ({ includeTestId = true }: { includeTestId?: boolean } = {}) => renderOverviewStageForCategory(
            activeCategory,
            catalogPageIndex,
            handleCategoryChange,
            handleCatalogPageChange,
            { includeTestId },
        ),
        [activeCategory, catalogPageIndex, handleCatalogPageChange, handleCategoryChange, renderOverviewStageForCategory],
    );

    const renderPendingOverviewStage = React.useCallback(
        ({ includeTestId = true }: { includeTestId?: boolean } = {}) => renderOverviewStageForCategory(
            pendingCategory ?? activeCategory,
            pendingCatalogPageIndex ?? catalogPageIndex,
            () => undefined,
            () => undefined,
            { includeTestId },
        ),
        [activeCategory, catalogPageIndex, pendingCatalogPageIndex, pendingCategory, renderOverviewStageForCategory],
    );

    const renderOverviewFlipStage = React.useCallback(({ includeTestId = true }: { includeTestId?: boolean } = {}) => (
        <div
            data-testid={includeTestId ? 'home-v2-book-stage' : undefined}
            className="relative overflow-visible"
            style={renderStageStyle(overviewStageLayout)}
        >
            <img
                src={HOME_V2_OVERVIEW_BACKGROUND}
                alt=""
                className="absolute inset-0 h-full w-full object-contain"
            />
        </div>
    ), [overviewStageLayout.height, overviewStageLayout.scale, overviewStageLayout.width]);

    const renderDetailStage = React.useCallback(({ includeTestId = true }: { includeTestId?: boolean } = {}) => (
        <div
            data-testid={includeTestId ? 'home-v2-book-stage' : undefined}
            className="relative overflow-visible"
            style={renderStageStyle(detailStageLayout)}
        >
            <img
                src={HOME_V2_OVERVIEW_BACKGROUND}
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
    ), [detailStageLayout.height, detailStageLayout.scale, detailStageLayout.width, handleBackToOverview, selectedGame]);

    const renderDetailFlipStage = React.useCallback(({ includeTestId = true }: { includeTestId?: boolean } = {}) => (
        <div
            data-testid={includeTestId ? 'home-v2-book-stage' : undefined}
            className="relative overflow-visible"
            style={renderStageStyle(detailStageLayout)}
        >
            <img
                src={HOME_V2_OVERVIEW_BACKGROUND}
                alt=""
                className="absolute inset-0 h-full w-full object-fill"
            />
        </div>
    ), [detailStageLayout.height, detailStageLayout.scale, detailStageLayout.width]);

    const isOverviewInternalForwardFlip = sceneState === 'flippingCategoryForward' || sceneState === 'flippingCatalogPageForward';
    const isOverviewInternalBackwardFlip = sceneState === 'flippingCategoryBackward' || sceneState === 'flippingCatalogPageBackward';
    const isOverviewInternalFlip = isCategoryFlip || isCatalogPageFlip;
    const foldLineMode = isOverviewInternalForwardFlip
        ? 'flippingToDetail'
        : isOverviewInternalBackwardFlip
            ? 'flippingToOverview'
            : sceneState;
    const foldLineRenderOverviewStage = isOverviewInternalBackwardFlip
        ? renderPendingOverviewStage
        : renderCurrentOverviewStage;
    const foldLineRenderDetailStage = isOverviewInternalForwardFlip
        ? renderPendingOverviewStage
        : isOverviewInternalBackwardFlip
            ? renderCurrentOverviewStage
            : renderDetailStage;
    const foldLineRenderOverviewFlipStage = isOverviewInternalFlip ? undefined : renderOverviewFlipStage;
    const foldLineRenderDetailFlipStage = isOverviewInternalFlip ? undefined : renderDetailFlipStage;
    const foldLineDetailStageSize = isOverviewInternalFlip ? overviewStageLayout : detailStageLayout;

    return (
        <main
            data-testid="home-v2-root"
            data-bg-friendly-screen="true"
            className="overflow-hidden bg-[linear-gradient(180deg,_#3a2b1f_0%,_#30241b_100%)]"
            style={{ height: 'var(--runtime-viewport-height, 100vh)' }}
        >
            <div className="relative flex h-full items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(92,70,48,0.28)_0%,_rgba(13,10,8,0.92)_68%,_rgba(10,8,7,1)_100%)]" />
                <div className="relative flex h-full w-full items-center justify-center">
                    {isExactHomepageOverview || isExactDetailView || isOverviewDetailFlip || isCategoryFlip || isCatalogPageFlip ? (
                        <FoldLinePageFlipStage
                            mode={isExactHomepageOverview ? 'overview' : isExactDetailView ? 'detail' : foldLineMode}
                            testId="home-v2-fold-line-flip"
                            renderOverviewStage={foldLineRenderOverviewStage}
                            renderDetailStage={foldLineRenderDetailStage}
                            renderOverviewFlipStage={foldLineRenderOverviewFlipStage}
                            renderDetailFlipStage={foldLineRenderDetailFlipStage}
                            overviewStageSize={overviewStageLayout}
                            detailStageSize={foldLineDetailStageSize}
                            leftPageRect={HOME_V2_FLIP_TO_OVERVIEW_RECT}
                            rightPageRect={HOME_V2_FLIP_TO_DETAIL_RECT}
                            durationMs={isOverviewInternalFlip ? HOME_V2_INTERNAL_PAGE_FLIP_DURATION_MS : undefined}
                            enableDetailPreview={!isOverviewInternalFlip}
                            flippingShellContent={isOverviewInternalFlip ? 'source' : 'target'}
                            onFlipToDetailComplete={() => {
                                if (sceneState === 'flippingCategoryForward') {
                                    setActiveCategory(pendingCategory ?? activeCategory);
                                    setCatalogPageIndex(pendingCatalogPageIndex ?? 0);
                                    setPendingCategory(null);
                                    setPendingCatalogPageIndex(null);
                                    setSceneState('overview');
                                    return;
                                }
                                if (sceneState === 'flippingCatalogPageForward') {
                                    setCatalogPageIndex(pendingCatalogPageIndex ?? catalogPageIndex);
                                    setPendingCatalogPageIndex(null);
                                    setSceneState('overview');
                                    return;
                                }
                                setSelectedGameId(pendingGameIdRef.current);
                                setPendingGameId(null);
                                setSceneState('detail');
                            }}
                            onFlipToOverviewComplete={() => {
                                if (sceneState === 'flippingCategoryBackward') {
                                    setActiveCategory(pendingCategory ?? activeCategory);
                                    setCatalogPageIndex(pendingCatalogPageIndex ?? 0);
                                    setPendingCategory(null);
                                    setPendingCatalogPageIndex(null);
                                    setSceneState('overview');
                                    return;
                                }
                                if (sceneState === 'flippingCatalogPageBackward') {
                                    setCatalogPageIndex(pendingCatalogPageIndex ?? catalogPageIndex);
                                    setPendingCatalogPageIndex(null);
                                    setSceneState('overview');
                                    return;
                                }
                                setSelectedGameId(null);
                                setPendingGameId(null);
                                setSceneState('overview');
                            }}
                        />
                    ) : (
                        null
                    )}
                </div>
            </div>
            {authModalOpen ? (
                <AuthModal
                    isOpen
                    onClose={() => setAuthModalOpen(false)}
                    initialMode={authMode}
                    onModeChange={setAuthMode}
                    closeOnBackdrop
                    visualStyle="home-v2"
                />
            ) : null}
            <HomeV2DangerConfirmModal
                open={Boolean(pendingDestroyMatch)}
                title={t('confirm.destroy.title')}
                description={t('homeV2.confirm.destroyDescription')}
                subject={pendingDestroyMatch ? `${pendingDestroyMatch.gameLabel} #${pendingDestroyMatch.matchID.slice(-4).toUpperCase()}` : ''}
                cancelLabel={t('common:button.cancel')}
                confirmLabel={t('actions.destroy')}
                processingLabel={t('button.processing')}
                isProcessing={isDestroyingMatch}
                onCancel={() => setPendingDestroyMatch(null)}
                onConfirm={() => void handleDestroyContinueMatch()}
                panelTestId="home-v2-overview-destroy-room-panel"
                surfaceTestId="home-v2-overview-destroy-room-surface"
                confirmTestId="home-v2-overview-destroy-room-confirm"
                cancelTestId="home-v2-overview-destroy-room-cancel"
            />
        </main>
    );
};
