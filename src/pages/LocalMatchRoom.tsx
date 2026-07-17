import { lazy, Suspense, useMemo, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getGameImplementation } from '../games/registry';
import { GameModeProvider } from '../contexts/GameModeContext';
import { getGameById } from '../config/games.config';
import { getGamePageDataAttributes, syncGamePageDocumentAttributes } from '../games/mobileSupport';
import { CriticalImageGate } from '../components/game/framework/CriticalImageGate';
import { MobileBoardShell } from '../components/game/framework/MobileBoardShell';
import { LoadingScreen } from '../components/system/LoadingScreen';
import { GameNamespaceLoadError } from '../components/system/GameNamespaceLoadError';
import { usePerformanceMonitor } from '../hooks/ui/usePerformanceMonitor';
import { LocalGameProvider, BoardBridge } from '../engine/transport/localReact';
import type { GameBoardProps } from '../engine/transport/protocol';
import type { ComponentType } from 'react';
import { useToast } from '../contexts/ToastContext';
import { playDeniedSound } from '../lib/audio/useGameAudio';
import { isUiHintOnlyError, resolveCommandError } from '../engine/transport/errorI18n';
import {
    buildLocalMatchSetupData,
    resolveLocalMatchPlayerCount,
    resolveSetupSelectionsFromSearchParams,
    resolveSeatControllersFromSearchParams,
} from '../engine/ai/seatControllers';
import { applySetupDefaultsForGame, resolveAllowedPlayerCountsForGame } from '../games/roomSetupRegistry';
import { GameCursorProvider } from '../core/cursor/GameCursorProvider';
import { useGameNamespaceReady } from '../hooks/useGameNamespaceReady';
import { useGameImplementationReady } from '../hooks/useGameImplementationReady';
import { createLocalMatchSeed, ensureLocalMatchSeedSearchParams } from '../engine/transport/localSession';
import { GamePageRuntimeProvider } from '../games/pageRuntimeAdapter';
import { QidahenPregameScenarioGate } from '../games/qidahen/QidahenPregameScenarioGate';

// 教程系统正常拦截，不弹 toast
const TUTORIAL_SILENT_ERRORS = new Set(['tutorial_command_blocked', 'tutorial_step_locked']);
const LocalGameHUD = lazy(() =>
    import('../components/game/framework/widgets/GameHUD').then((module) => ({ default: module.GameHUD })),
);

export const LocalMatchRoom = () => {
    usePerformanceMonitor();
    const { gameId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation('lobby');
    const toast = useToast();
    const {
        isGameNamespaceReady,
        gameNamespaceError,
        retryGameNamespaceLoad,
    } = useGameNamespaceReady(gameId, i18n);
    const {
        isGameImplementationReady,
        gameImplementationError,
        retryGameImplementationLoad,
    } = useGameImplementationReady(gameId);

    const gameConfig = gameId ? getGameById(gameId) : undefined;
    const shouldKeepBoardMountedOnTurnFollow = gameId === 'betrayal';
    const gamePageDataAttributes = useMemo(
        () => getGamePageDataAttributes(gameId, gameConfig),
        [gameConfig, gameId],
    );

    useEffect(() => syncGamePageDocumentAttributes(gamePageDataAttributes), [gamePageDataAttributes]);


    const seedFromUrl = searchParams.get('seed');
    const [fallbackSeed] = useState(() => seedFromUrl || createLocalMatchSeed());
    const gameSeed = seedFromUrl || fallbackSeed;

    useEffect(() => {
        if (seedFromUrl) return;
        const nextSearch = ensureLocalMatchSeedSearchParams(searchParams, fallbackSeed);
        navigate(
            {
                pathname: gameId ? `/play/${gameId}/local` : undefined,
                search: `?${nextSearch.toString()}`,
            },
            { replace: true },
        );
    }, [fallbackSeed, gameId, navigate, searchParams, seedFromUrl]);

    const defaultSetupSelections = useMemo(
        () => {
            const parsedSelections = resolveSetupSelectionsFromSearchParams({
                gameManifest: gameConfig,
                searchParams,
            });
            const requestedPlayers = Number(searchParams.get('players'));
            const setupScopedPlayerOptions = resolveAllowedPlayerCountsForGame({
                gameManifest: gameConfig ?? undefined,
                setupData: parsedSelections,
            });
            const fallbackPlayerCount = gameConfig?.bestPlayers?.find((count) => setupScopedPlayerOptions.includes(count))
                ?? setupScopedPlayerOptions[0]
                ?? gameConfig?.playerOptions?.[0]
                ?? 2;
            return applySetupDefaultsForGame({
                gameManifest: gameConfig ?? undefined,
                numPlayers: Number.isInteger(requestedPlayers)
                    ? requestedPlayers
                    : fallbackPlayerCount,
                setupSelections: parsedSelections,
            });
        },
        [gameConfig, searchParams],
    );
    const currentPlayerOptions = useMemo(
        () => resolveAllowedPlayerCountsForGame({
            gameManifest: gameConfig ?? undefined,
            setupData: defaultSetupSelections,
        }),
        [defaultSetupSelections, gameConfig],
    );
    const defaultLocalPlayerCount = resolveLocalMatchPlayerCount(searchParams.get('players'), currentPlayerOptions);
    const defaultResolvedSetupSelections = useMemo(
        () => applySetupDefaultsForGame({
            gameManifest: gameConfig ?? undefined,
            numPlayers: defaultLocalPlayerCount,
            setupSelections: defaultSetupSelections,
        }),
        [defaultLocalPlayerCount, defaultSetupSelections, gameConfig],
    );
    const defaultSeatControllers = useMemo(
        () => resolveSeatControllersFromSearchParams({
            numPlayers: defaultLocalPlayerCount,
            searchParams,
            aiSupport: gameConfig?.ai,
        }),
        [defaultLocalPlayerCount, gameConfig?.ai, searchParams],
    );
    const defaultLocalSetupData = useMemo(
        () => buildLocalMatchSetupData(defaultResolvedSetupSelections),
        [defaultResolvedSetupSelections],
    );
    const defaultHasAiSeat = useMemo(
        () => Object.values(defaultSeatControllers).some((controller) => controller.type !== 'human'),
        [defaultSeatControllers],
    );

    // 从游戏实现中获取引擎配置
    const engineConfig = useMemo(() => {
        if (!gameId || !isGameImplementationReady) return null;
        return getGameImplementation(gameId)?.engineConfig ?? null;
    }, [gameId, isGameImplementationReady]);

    // 包装 Board 组件，注入 CriticalImageGate
    const WrappedBoard = useMemo<ComponentType<GameBoardProps> | null>(() => {
        if (!gameId || !isGameImplementationReady) return null;
        const impl = getGameImplementation(gameId);
        if (!impl) return null;
        const Board = impl.board as unknown as ComponentType<GameBoardProps>;
        const WrappedLocalBoard: ComponentType<GameBoardProps> = (props) => (
            <CriticalImageGate
                gameId={gameId}
                gameState={props?.G}
                locale={i18n.language}
                playerID={props?.playerID}
                loadingDescription={t('matchRoom.loadingResources')}
            >
                <Board {...props} />
            </CriticalImageGate>
        );
        return WrappedLocalBoard;
    }, [gameId, i18n.language, t, isGameImplementationReady]);

    // 命令被拒绝时的统一反馈（拒绝音效 + toast 提示）
    // tutorial_command_blocked / tutorial_step_locked 是教程系统的正常拦截，不弹 toast
    const handleCommandRejected = useCallback((_type: string, error: string) => {
        if (TUTORIAL_SILENT_ERRORS.has(error)) return;
        if (isUiHintOnlyError(error, i18n, gameId)) return;
        playDeniedSound();
        toast.warning(resolveCommandError(i18n, error, gameId), undefined, { dedupeKey: `local.rejected.${error}` });
    }, [toast, i18n, gameId]);

    if (!gameConfig) {
        return <div className="text-white">{t('matchRoom.noGame')}</div>;
    }

    if (gameNamespaceError) {
        return (
            <GameNamespaceLoadError
                gameId={gameId}
                error={gameNamespaceError}
                onRetry={retryGameNamespaceLoad}
            />
        );
    }

    if (gameImplementationError) {
        return (
            <GameNamespaceLoadError
                gameId={gameId}
                error={gameImplementationError}
                onRetry={retryGameImplementationLoad}
                titleKey="matchRoom.clientLoadFailed"
                descriptionKey="matchRoom.clientLoadFailedDesc"
            />
        );
    }

    if (!isGameNamespaceReady) {
        return <LoadingScreen description={t('matchRoom.preparingMatch')} progressText={t('matchRoom.loadingProgress.loadingGameModule')} />;
    }

    if (!isGameImplementationReady) {
        return <LoadingScreen description={t('matchRoom.preparingMatch')} progressText={t('matchRoom.loadingProgress.loadingGameModule')} />;
    }

    return (
        <div className="relative w-full game-page-viewport bg-black overflow-hidden font-sans" {...gamePageDataAttributes}>
            <GamePageRuntimeProvider gameId={gameId}>
                <MobileBoardShell battlefieldZoomMode={gameConfig?.mobileBattlefieldZoom}>
                    <div
                        className="w-full h-full"
                        style={{
                            '--font-game-display': gameConfig?.fontFamily?.display ? `'${gameConfig.fontFamily.display}', serif` : undefined,
                        } as React.CSSProperties}
                    >
                        <GameModeProvider mode="local">
                            <GameCursorProvider themeId={gameConfig?.cursorTheme} gameId={gameId}>
                                {engineConfig && WrappedBoard ? (
                                    gameId === 'qidahen' ? (
                                        <QidahenPregameScenarioGate
                                            searchParams={searchParams}
                                            onSearchParamsChange={(nextSearchParams) => {
                                                navigate(
                                                    {
                                                        pathname: `/play/${gameId}/local`,
                                                        search: `?${nextSearchParams.toString()}`,
                                                    },
                                                    { replace: true },
                                                );
                                            }}
                                        >
                                            {({ numPlayers, setupData }) => {
                                                const seatControllers = resolveSeatControllersFromSearchParams({
                                                    numPlayers,
                                                    searchParams,
                                                    aiSupport: gameConfig?.ai,
                                                });
                                                const hasAiSeat = Object.values(seatControllers).some((controller) => controller.type !== 'human');
                                                return (
                                                    <>
                                                        <Suspense fallback={null}>
                                                            <LocalGameHUD
                                                                mode="local"
                                                                gameId={gameId}
                                                                localModeLabel={hasAiSeat ? t('actions.playAi') : t('actions.singleDevice')}
                                                                seatControllers={seatControllers}
                                                            />
                                                        </Suspense>
                                                        <LocalGameProvider
                                                            key={`local:${gameId ?? 'unknown'}:${gameSeed}:${numPlayers}`}
                                                            config={engineConfig}
                                                            numPlayers={numPlayers}
                                                            seed={gameSeed}
                                                            setupData={setupData}
                                                            onCommandRejected={handleCommandRejected}
                                                            seatControllers={seatControllers}
                                                            followCurrentTurnPlayer
                                                            persistSession
                                                        >
                                                            <BoardBridge
                                                                board={WrappedBoard}
                                                                remountKey={shouldKeepBoardMountedOnTurnFollow ? false : undefined}
                                                                loading={<LoadingScreen anchor="container" title={t('matchRoom.title.local')} description={t('matchRoom.preparingMatch')} progressText={t('matchRoom.loadingProgress.preparingRoom')} />}
                                                            />
                                                        </LocalGameProvider>
                                                    </>
                                                );
                                            }}
                                        </QidahenPregameScenarioGate>
                                    ) : (
                                        <>
                                            <Suspense fallback={null}>
                                                <LocalGameHUD
                                                    mode="local"
                                                    gameId={gameId}
                                                    localModeLabel={defaultHasAiSeat ? t('actions.playAi') : t('actions.singleDevice')}
                                                    seatControllers={defaultSeatControllers}
                                                />
                                            </Suspense>
                                            <LocalGameProvider
                                                key={`local:${gameId ?? 'unknown'}:${gameSeed}:${defaultLocalPlayerCount}`}
                                            config={engineConfig}
                                            numPlayers={defaultLocalPlayerCount}
                                            seed={gameSeed}
                                            setupData={defaultLocalSetupData}
                                            onCommandRejected={handleCommandRejected}
                                            seatControllers={defaultSeatControllers}
                                            followCurrentTurnPlayer
                                            persistSession
                                        >
                                            <BoardBridge
                                                board={WrappedBoard}
                                                remountKey={shouldKeepBoardMountedOnTurnFollow ? false : undefined}
                                                loading={<LoadingScreen anchor="container" title={t('matchRoom.title.local')} description={t('matchRoom.preparingMatch')} progressText={t('matchRoom.loadingProgress.preparingRoom')} />}
                                            />
                                        </LocalGameProvider>
                                        </>
                                    )
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/50">
                                        {t('matchRoom.noClient')}
                                    </div>
                                )}
                            </GameCursorProvider>
                        </GameModeProvider>
                    </div>
                </MobileBoardShell>
            </GamePageRuntimeProvider>
        </div>
    );
};
