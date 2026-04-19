import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { getOptimizedImageUrls } from '../core/AssetLoader';
import { getAllGames, getGameById } from '../config/games.config';
import { LobbyDirectory } from '../components/home-v2/LobbyDirectory';
import { GameDetails } from '../components/home-v2/GameDetails';
import compiledHomeV2Scene from '../ui-scenes/home-v2/home-v2.compiled.json';
import { CompiledSceneRenderer, HomeSceneRenderer, type HomeV2SceneState } from '../ui-scene/runtime';
import type { UISceneCompiledArtifact } from '../ui-scene/types';

const HOME_V2_BOOK_DESK = getOptimizedImageUrls('/assets/common/images/home-v2/book-desk/1.png').webp;
const HOME_V2_COMPILED_SCENE = compiledHomeV2Scene as UISceneCompiledArtifact;
const HOME_V2_OVERVIEW_LEFT_PAGE_CAPACITY = 9;

type HomeV2TabId = 'lobby' | 'rooms' | 'leaderboard' | 'changelog' | 'about';

function HomeV2TabPlaceholder({ title, description }: { title: string; description: string }) {
    return (
        <div className="pointer-events-auto flex h-full w-full flex-col items-center justify-center px-[12%] text-center text-[#6a4a33]">
            <div className="mb-[4%] text-[clamp(18px,1.8vw,24px)] font-bold tracking-[0.08em] text-[#5b3822]">
                {title}
            </div>
            <div className="max-w-[82%] text-[clamp(11px,0.95vw,14px)] leading-[1.7] text-[#7a5d46]">
                {description}
            </div>
        </div>
    );
}

export const HomeV2 = () => {
    const [searchParams] = useSearchParams();
    const [sceneState, setSceneState] = React.useState<HomeV2SceneState>('open');
    const [activeTab, setActiveTab] = React.useState<HomeV2TabId>('lobby');
    const [selectedGameId, setSelectedGameId] = React.useState<string | null>(null);
    const pendingGameIdRef = React.useRef<string | null>(null);
    const debugRegions = searchParams.get('homeV2Debug') === '1';
    const overviewGames = React.useMemo(
        () => getAllGames().filter((game) => game.enabled && game.type === 'game'),
        [],
    );
    const selectedGame = selectedGameId ? getGameById(selectedGameId) ?? null : null;
    const isPageFlipping = sceneState === 'flippingToDetail' || sceneState === 'flippingToOverview';

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

    const handleSceneEvent = React.useCallback((event: { eventId: string }) => {
        if (event.eventId === 'page.flip.to-detail.complete') {
            setSelectedGameId(pendingGameIdRef.current);
            setSceneState('detail');
            return;
        }

        if (event.eventId === 'page.flip.to-overview.complete') {
            setSelectedGameId(null);
            setSceneState('overview');
        }
    }, []);

    const handleTabChange = React.useCallback((tabId: HomeV2TabId) => {
        setActiveTab(tabId);
        if (sceneState === 'detail') {
            setSelectedGameId(null);
            setSceneState('overview');
        }
    }, [sceneState]);

    const sceneContext = React.useMemo(() => ({
        activeTab,
        tabLabels: {
            lobby: '大厅',
            rooms: '房间',
            leaderboard: '榜单',
            changelog: '更新',
            about: '关于',
        },
    }), [activeTab]);

    const actionHandlers = React.useMemo<Record<string, () => void>>(() => ({
        openLobbyTab: () => handleTabChange('lobby'),
        openRoomsTab: () => handleTabChange('rooms'),
        openLeaderboardTab: () => handleTabChange('leaderboard'),
        openChangelogTab: () => handleTabChange('changelog'),
        openAboutTab: () => handleTabChange('about'),
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
            slots.overview_left_page = (
                <HomeV2TabPlaceholder
                    title="房间目录"
                    description="这里会接入按页签组织的房间列表和房间筛选。当前先保留书页容器与运行时交互链路。"
                />
            );
        } else if (activeTab === 'leaderboard') {
            slots.overview_left_page = (
                <HomeV2TabPlaceholder
                    title="排行榜"
                    description="这里会接入胜场排行、近期战绩和玩家概览。当前先保留书页布局与页签切换链路。"
                />
            );
        } else if (activeTab === 'changelog') {
            slots.overview_left_page = (
                <HomeV2TabPlaceholder
                    title="更新日志"
                    description="这里会接入按日期编排的版本日志与置顶公告。当前先保留书页版式与页签入口。"
                />
            );
        } else {
            slots.overview_left_page = (
                <HomeV2TabPlaceholder
                    title="关于"
                    description="这里会接入首页 V2 的项目说明、作者信息和入口说明。当前用于验证书签切换与内容占位。"
                />
            );
        }

        if (sceneState === 'detail') {
            slots.detail_left_page = (
                <GameDetails.Left
                    game={selectedGame}
                    onBack={handleBackToOverview}
                />
            );
            slots.detail_right_page = <GameDetails.Right game={selectedGame} />;
        }

        return slots;
    }, [activeTab, handleBackToOverview, handleGameOpen, overviewGames, sceneState, selectedGame]);

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
