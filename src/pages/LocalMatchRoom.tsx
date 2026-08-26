import { lazy, Suspense, useMemo, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getGameImplementation } from '../games/registry';
import { GameModeProvider } from '../contexts/GameModeContext';
import { getGameById } from '../config/games.config';
import { shouldKeepBoardMountedOnPlayerViewChange } from '../games/pageShell';
import { getGamePageDataAttributes, syncGamePageDocumentAttributes } from '../shared/mobileSupport';
import { CriticalImageGate } from '../components/game/framework/CriticalImageGate';
import { MobileBoardShell } from '../components/game/framework/MobileBoardShell';
import { LoadingScreen } from '../components/system/LoadingScreen';
import { GameNamespaceLoadError } from '../components/system/GameNamespaceLoadError';
import { usePerformanceMonitor } from '../hooks/ui/usePerformanceMonitor';
import { LocalGameProvider, BoardBridge } from '../engine/transport/localReact';
import type { GameBoardProps } from '../engine/transport/protocol';
import type { GameBoardRenderer } from '../engine/boardRenderer';
import type { ComponentType } from 'react';
import { useToast } from '../contexts/ToastContext';
import { playDeniedSound } from '../lib/audio/useGameAudio';
import { isUiHintOnlyError, resolveCommandError } from '../engine/transport/errorI18n';
import {
    resolveSeatControllersFromSearchParams,
} from '../engine/ai/seatControllers';
import { GameCursorProvider } from '../core/cursor/GameCursorProvider';
import { useGameNamespaceReady } from '../hooks/useGameNamespaceReady';
import { useGameImplementationReady } from '../games/useGameImplementationReady';
import { createLocalMatchSeed, ensureLocalMatchSeedSearchParams } from '../engine/transport/localSession';
import { GamePageRuntimeProvider } from '../games/pageRuntimeAdapter';
import type { GameRuntimeLocalSetupResult } from '../games/gameRuntimeAdapter';
import { buildGameHudRuntimeProps } from './gameHudRuntimeProps';
import { resolveManifestLocalSetup, resolveRuntimeLocalSetupData } from './matchRoomLocalSetup';

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
    const shouldKeepBoardMountedOnTurnFollow = shouldKeepBoardMountedOnPlayerViewChange(gameConfig);
    const gamePageDataAttributes = useMemo(
        () => getGamePageDataAttributes(gameId, gameConfig),
        [gameConfig, gameId],
    );
    const gameHudRuntimeProps = useMemo(
        () => buildGameHudRuntimeProps({ gameId, gameConfig }),
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

    const defaultLocalSetup = useMemo(
        () => resolveManifestLocalSetup({
            gameManifest: gameConfig ?? undefined,
            searchParams,
            requestedPlayers: searchParams.get('players'),
        }),
        [gameConfig, searchParams],
    );
    const runtimeAdapter = useMemo(() => {
        if (!gameId || !isGameImplementationReady) return null;
        return getGameImplementation(gameId)?.runtimeAdapter ?? null;
    }, [gameId, isGameImplementationReady]);
    const runtimeLocalSetup = useMemo(
        () => runtimeAdapter?.resolveLocalSetup?.({ searchParams }) ?? null,
        [runtimeAdapter, searchParams],
    );
    const localSetupSearchKey = searchParams.toString();
    const localSetupGateResetKey = `${gameId ?? ''}:${gameSeed}:${localSetupSearchKey}`;
    const [confirmedLocalSetupState, setConfirmedLocalSetupState] = useState<{
        resetKey: string;
        setup: GameRuntimeLocalSetupResult;
    } | null>(null);
    const confirmedLocalSetup = confirmedLocalSetupState?.resetKey === localSetupGateResetKey
        ? confirmedLocalSetupState.setup
        : null;
    const handleConfirmLocalSetup = useCallback((setup: GameRuntimeLocalSetupResult) => {
        setConfirmedLocalSetupState({ resetKey: localSetupGateResetKey, setup });
    }, [localSetupGateResetKey]);

    const LocalSetupGate = runtimeAdapter?.LocalSetupGate;
    const initialLocalSetup: GameRuntimeLocalSetupResult = runtimeLocalSetup ?? defaultLocalSetup;
    const activeLocalSetup = confirmedLocalSetup ?? initialLocalSetup;
    const localPlayerCount = activeLocalSetup.numPlayers;
    const localSetupData = useMemo(
        () => resolveRuntimeLocalSetupData(activeLocalSetup) ?? defaultLocalSetup.setupData,
        [activeLocalSetup, defaultLocalSetup.setupData],
    );
    const localSetupKey = JSON.stringify(localSetupData ?? {});
    const localSeatControllers = useMemo(
        () => resolveSeatControllersFromSearchParams({
            numPlayers: localPlayerCount,
            searchParams,
            aiSupport: gameConfig?.ai,
        }),
        [gameConfig?.ai, localPlayerCount, searchParams],
    );
    const hasAiSeat = useMemo(
        () => Object.values(localSeatControllers).some((controller) => controller.type !== 'human'),
        [localSeatControllers],
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

    const WrappedBoardRenderer = useMemo<GameBoardRenderer | undefined>(() => {
        if (!gameId || !isGameImplementationReady) return undefined;
        const impl = getGameImplementation(gameId);
        const renderer = impl?.boardRenderer;
        if (!renderer) return undefined;

        if (renderer.kind === 'react') {
            const RendererBoard = renderer.component as unknown as ComponentType<GameBoardProps>;
            const WrappedLocalRendererBoard: ComponentType<GameBoardProps> = (props) => (
                <CriticalImageGate
                    gameId={gameId}
                    gameState={props?.G}
                    locale={i18n.language}
                    playerID={props?.playerID}
                    loadingDescription={t('matchRoom.loadingResources')}
                >
                    <RendererBoard {...props} />
                </CriticalImageGate>
            );
            return {
                kind: 'react',
                component: WrappedLocalRendererBoard,
            };
        }

        return renderer;
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
                                    <>
                                        {LocalSetupGate && !confirmedLocalSetup ? (
                                            <LocalSetupGate
                                                mode="local"
                                                searchParams={searchParams}
                                                initialSetup={initialLocalSetup}
                                                onConfirm={handleConfirmLocalSetup}
                                            />
                                        ) : (
                                            <>
                                                <Suspense fallback={null}>
                                                    <LocalGameHUD
                                                        mode="local"
                                                        gameId={gameId}
                                                        localModeLabel={hasAiSeat ? t('actions.playAi') : t('actions.singleDevice')}
                                                        {...gameHudRuntimeProps}
                                                    />
                                                </Suspense>
                                                <LocalGameProvider
                                                    key={`local:${gameId ?? 'unknown'}:${gameSeed}:${localPlayerCount}:${localSetupKey}`}
                                                    config={engineConfig}
                                                    numPlayers={localPlayerCount}
                                                    seed={gameSeed}
                                                    setupData={localSetupData}
                                                    onCommandRejected={handleCommandRejected}
                                                    seatControllers={localSeatControllers}
                                                    followCurrentTurnPlayer
                                                    persistSession
                                                >
                                                    <BoardBridge
                                                        board={WrappedBoard}
                                                        renderer={WrappedBoardRenderer}
                                                        remountKey={shouldKeepBoardMountedOnTurnFollow ? false : undefined}
                                                        loading={<LoadingScreen anchor="container" title={t('matchRoom.title.local')} description={t('matchRoom.preparingMatch')} progressText={t('matchRoom.loadingProgress.preparingRoom')} />}
                                                    />
                                                </LocalGameProvider>
                                            </>
                                        )}
                                    </>
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
