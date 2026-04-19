import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { getAllGames, getGameById } from '../config/games.config';
import {
    HomeV2ChangelogPanel,
    HomeV2RoomsPanel,
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
const HOME_V2_OVERVIEW_LEFT_PAGE_CAPACITY = 9;

type HomeV2TabId = 'lobby' | 'rooms' | 'changelog';
const HOME_V2_TAB_ORDER: HomeV2TabId[] = ['lobby', 'rooms', 'changelog'];

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
    const pendingGameIdRef = React.useRef<string | null>(null);
    const pendingTabIdRef = React.useRef<HomeV2TabId | null>(null);
    const queuedTabAfterOverviewRef = React.useRef<HomeV2TabId | null>(null);
    const debugRegions = searchParams.get('homeV2Debug') === '1';
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

    const handleDirectGameDetailOpen = React.useCallback((gameId: string) => {
        pendingGameIdRef.current = null;
        setSelectedGameId(gameId);
        setSceneState('detail');
    }, []);

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
            changelog: t('homeV2.sceneTabs.changelog'),
        },
    }), [activeTab, t]);

    const actionHandlers = React.useMemo<Record<string, () => void>>(() => ({
        openLobbyTab: () => handleTabChange('lobby'),
        openRoomsTab: () => handleTabChange('rooms'),
        openChangelogTab: () => handleTabChange('changelog'),
    }), [handleTabChange]);

    const sceneSlots = React.useMemo(() => {
        const slots: Record<string, React.ReactNode> = {};

        if (activeTab === 'lobby') {
            slots.overview_left_page = (
                <LobbyDirectory.Left
                    games={overviewGames.slice(0, HOME_V2_OVERVIEW_LEFT_PAGE_CAPACITY)}
                    onGameClick={handleGameOpen}
                />
            );
            slots.overview_right_page = (
                <LobbyDirectory.Right
                    games={overviewGames.slice(HOME_V2_OVERVIEW_LEFT_PAGE_CAPACITY)}
                    onGameClick={handleGameOpen}
                />
            );
        } else if (activeTab === 'rooms') {
            slots.overview_left_page = <HomeV2LoginPanel />;
            slots.overview_right_page = (
                <HomeV2RoomsPanel
                    games={overviewGames}
                    onOpenGame={handleDirectGameDetailOpen}
                />
            );
        } else if (activeTab === 'changelog') {
            slots.overview_left_page = (
                <HomeV2ChangelogPanel
                    games={overviewGames}
                    onOpenGame={handleDirectGameDetailOpen}
                />
            );
            slots.overview_right_page = <HomeV2LoginPanel />;
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
    }, [activeTab, handleBackToOverview, handleDirectGameDetailOpen, handleGameOpen, overviewGames, sceneState, selectedGame]);

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
                    >
                        <HomeSceneRenderer
                            testId="home-v2-book-stage"
                            debugRegions={debugRegions}
                            sceneState={sceneState}
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

