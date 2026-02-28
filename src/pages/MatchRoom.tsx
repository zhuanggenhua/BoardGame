import { useEffect, useLayoutEffect, useState, useMemo, useRef, useCallback } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import * as matchApi from '../services/matchApi';
import { loadGameImplementation, getGameImplementation } from '../games/registry';
import { GameProvider, LocalGameProvider, BoardBridge, useGameClient } from '../engine/transport/react';
import type { GameEngineConfig } from '../engine/transport/server';
import type { GameBoardProps } from '../engine/transport/protocol';
import type { MatchState } from '../engine/types';
import { useDebug } from '../contexts/DebugContext';
import { TutorialOverlay } from '../components/tutorial/TutorialOverlay';
import { useTutorial } from '../contexts/TutorialContext';
import { useGameMode } from '../contexts/GameModeContext';
import { RematchProvider } from '../contexts/RematchContext';
import {
    useMatchStatus,
    destroyMatch,
    leaveMatch,
    rejoinMatch,
    persistMatchCredentials,
    clearMatchCredentials,
    clearOwnerActiveMatch,
    suppressOwnerActiveMatch,
    readStoredMatchCredentials,
    validateStoredMatchSeat,
} from '../hooks/match/useMatchStatus';
import { getOrCreateGuestId } from '../hooks/match/ownerIdentity';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmModal } from '../components/common/overlays/ConfirmModal';
import { useModalStack } from '../contexts/ModalStackContext';
import { useToast } from '../contexts/ToastContext';
import { getGameServerUrl } from '../config/server';
import { getGameById, refreshUgcGames, subscribeGameRegistry } from '../config/games.config';
import { useLobbyMatchPresence } from '../hooks/useLobbyMatchPresence';
import { GameHUD } from '../components/game/framework/widgets/GameHUD';
import { GameModeProvider } from '../contexts/GameModeContext';
import { SEO } from '../components/common/SEO';
import { createUgcClientGame } from '../ugc/client/game';
import { createUgcRemoteHostBoard } from '../ugc/client/board';
import { LoadingScreen } from '../components/system/LoadingScreen';
import { ConnectionLoadingScreen } from '../components/system/ConnectionLoadingScreen';
import { usePerformanceMonitor } from '../hooks/ui/usePerformanceMonitor';
import { CriticalImageGate } from '../components/game/framework';
import { preloadWarmImages } from '../core';
import { resolveCriticalImages } from '../core/CriticalImageResolverRegistry';
import { UI_Z_INDEX } from '../core';
import { playDeniedSound } from '../lib/audio/useGameAudio';
import { resolveCommandError } from '../engine/transport/errorI18n';
import { GameCursorProvider } from '../core/cursor';

// 系统级错误（连接/认证），不需要 toast 提示给玩家
const SYSTEM_ERRORS = new Set(['unauthorized', 'match_not_found', 'sync_timeout', 'command_failed']);
// 教程系统正常拦截，不弹 toast（用户跟着教程走时的正常行为）
const TUTORIAL_SILENT_ERRORS = new Set(['tutorial_command_blocked', 'tutorial_step_locked']);

/**
 * 教程 dispatch 桥接组件
 *
 * 放在 LocalGameProvider 内部、CriticalImageGate/BoardBridge 外部。
 * 作用：在 Board 渲染之前就调用 bindDispatch，让教程 START 命令可以在
 * CriticalImageGate 预加载期间执行。
 *
 * 问题背景：CriticalImageGate 阻塞 Board 渲染 → Board 中的 useTutorialBridge
 * 无法调用 bindDispatch → pending START 命令无法消费 → 教程卡在 setup 阶段
 * 的预加载上，完成后又要预加载 playing 阶段，导致双重延迟甚至卡死。
 *
 * 有了这个桥接组件，START 命令在预加载期间就执行，state 直接跳到 playing 阶段，
 * CriticalImageGate 只需预加载一次 playing 阶段的资源。
 */
const TutorialDispatchBridge = ({ children }: { children: ReactNode }) => {
    const { dispatch, state } = useGameClient();
    const { bindDispatch, unbindDispatch, syncTutorialState } = useTutorial();
    const gameMode = useGameMode();
    const isTutorialMode = gameMode?.mode === 'tutorial';
    const dispatchRef = useRef(dispatch);
    dispatchRef.current = dispatch;
    const contextRef = useRef({ bindDispatch, unbindDispatch, syncTutorialState });
    contextRef.current = { bindDispatch, unbindDispatch, syncTutorialState };

    // 提前 bindDispatch，不等 Board 渲染
    // 使用 useLayoutEffect 确保在 CriticalImageGate 的 useEffect 之前执行，
    // 这样 START 命令的 setState 会同步触发重新渲染，CriticalImageGate 直接看到
    // playing 阶段的 state，只需预加载一次。
    useLayoutEffect(() => {
        if (!isTutorialMode) return;
        const gen = contextRef.current.bindDispatch(
            (...args: [string, unknown?]) => dispatchRef.current(...args),
        );
        return () => {
            contextRef.current.unbindDispatch(gen);
        };
    }, [isTutorialMode]);

    // 提前同步教程状态（Board 被 CriticalImageGate 阻塞时也能同步）
    const lastSyncRef = useRef<string | null>(null);
    useEffect(() => {
        if (!isTutorialMode || !state) return;
        const tutorial = (state as MatchState).sys.tutorial;
        if (!tutorial) return;
        const sig = `${tutorial.active}-${tutorial.stepIndex}-${tutorial.step?.id ?? ''}`;
        if (lastSyncRef.current === sig) return;
        lastSyncRef.current = sig;
        contextRef.current.syncTutorialState(tutorial);
    }, [isTutorialMode, state]);

    return <>{children}</>;
};

export const MatchRoom = () => {
    usePerformanceMonitor();
    const { playerID: debugPlayerID, setPlayerID } = useDebug();
    const { gameId, matchId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { startTutorial, closeTutorial, isActive, currentStep, isBoardMounted } = useTutorial();
    const { openModal, closeModal } = useModalStack();
    const toast = useToast();
    const { t, i18n } = useTranslation('lobby');
    const { user } = useAuth();

    const gameConfig = gameId ? getGameById(gameId) : undefined;
    const isUgcGame = Boolean(gameConfig?.isUgc);
    const isTutorialRoute = window.location.pathname.endsWith('/tutorial');

    // 异步加载游戏实现（Board/engineConfig/tutorial/latencyConfig）
    const [gameImplReady, setGameImplReady] = useState(false);
    useEffect(() => {
        if (!gameId || isUgcGame) return;
        
        // HMR 优化：如果游戏实现已经加载（通过检查 getGameImplementation），跳过重新加载
        // 这避免了 HMR 时短暂的 gameImplReady=false 导致显示"未找到游戏客户端"
        const impl = getGameImplementation(gameId);
        if (impl) {
            setGameImplReady(true);
            return;
        }
        
        let cancelled = false;
        setGameImplReady(false);
        loadGameImplementation(gameId).then(() => {
            if (!cancelled) setGameImplReady(true);
        }).catch(() => {
            if (!cancelled) setGameImplReady(true); // 允许显示错误状态
        });
        return () => { cancelled = true; };
    }, [gameId, isUgcGame]);

    // 在线模式：命令被服务端拒绝时的统一反馈
    const handleGameError = useCallback((error: string) => {
        if (SYSTEM_ERRORS.has(error)) return; // 系统错误由其他逻辑处理
        playDeniedSound();
        toast.warning(resolveCommandError(i18n, error, gameId));
    }, [toast, i18n, gameId]);

    // 本地/教学模式：命令被引擎拒绝时的统一反馈
    // tutorial_command_blocked / tutorial_step_locked 是教程系统的正常拦截，同样静默
    // AI 命令失败的静默已在 LocalGameProvider 层面通过 __tutorialAiCommand 标记处理
    const handleCommandRejected = useCallback((_type: string, error: string) => {
        if (TUTORIAL_SILENT_ERRORS.has(error)) return;
        playDeniedSound();
        toast.warning(resolveCommandError(i18n, error, gameId));
    }, [toast, i18n, gameId]);

    // 包装 Board 组件（注入 CriticalImageGate）
    // 注意：不能依赖 t 函数引用，否则 i18n namespace 加载完成时 t 变化
    // → WrappedBoard 重建 → Board 卸载重挂载 → CriticalImageGate 重新预加载 → 循环
    const tRef = useRef(t);
    tRef.current = t;
    const WrappedBoard = useMemo<ComponentType<GameBoardProps> | null>(() => {
        if (!gameId || !gameImplReady) return null;
        const impl = getGameImplementation(gameId);
        if (!impl) return null;
        const Board = impl.board as unknown as ComponentType<GameBoardProps>;
        const Wrapped: ComponentType<GameBoardProps> = (props) => (
            <CriticalImageGate
                gameId={gameId}
                gameState={props?.G}
                locale={i18n.language}
                playerID={props?.playerID}
                enabled={!isUgcGame}
                loadingDescription={tRef.current('matchRoom.loadingResources')}
            >
                <Board {...props} />
            </CriticalImageGate>
        );
        Wrapped.displayName = 'WrappedOnlineBoard';
        return Wrapped;
    }, [gameId, i18n.language, isUgcGame, gameImplReady]);

    // 从游戏实现中获取引擎配置（教学模式用）
    const engineConfig = useMemo(() => {
        if (!gameId || !gameImplReady) return null;
        return getGameImplementation(gameId)?.engineConfig ?? null;
    }, [gameId, gameImplReady]);

    // 从游戏实现中获取延迟优化配置
    const latencyConfig = useMemo(() => {
        if (!gameId || !gameImplReady) return undefined;
        return getGameImplementation(gameId)?.latencyConfig;
    }, [gameId, gameImplReady]);

    // 在线模式是否就绪
    const hasOnlineBoard = Boolean(WrappedBoard && gameId && !isUgcGame);

    const [ugcEngineConfig, setUgcEngineConfig] = useState<GameEngineConfig | null>(null);
    const [ugcBoard, setUgcBoard] = useState<ComponentType<GameBoardProps> | null>(null);
    const [ugcLoading, setUgcLoading] = useState(false);
    const [ugcError, setUgcError] = useState<string | null>(null);
    const [registryVersion, setRegistryVersion] = useState(0);

    useEffect(() => {
        if (!gameId) return;
        const unsubscribe = subscribeGameRegistry(() => {
            setRegistryVersion((version) => version + 1);
        });
        const current = getGameById(gameId);
        if (!current || current.isUgc) {
            void refreshUgcGames();
        }
        return () => {
            unsubscribe();
        };
    }, [gameId]);

    useEffect(() => {
        if (!gameId || !isUgcGame || isTutorialRoute) {
            setUgcEngineConfig(null);
            setUgcBoard(null);
            setUgcLoading(false);
            setUgcError(null);
            return;
        }

        let cancelled = false;
        setUgcLoading(true);
        setUgcError(null);

        createUgcClientGame(gameId)
            .then(({ engineConfig, config }) => {
                if (cancelled) return;
                const BaseBoard = createUgcRemoteHostBoard({
                    packageId: gameId,
                    viewUrl: config.viewUrl,
                });
                // UGC Board 现在直接接受 GameBoardProps
                const UgcWrapped: ComponentType<GameBoardProps> = BaseBoard as ComponentType<GameBoardProps>;
                UgcWrapped.displayName = 'WrappedUgcBoard';
                setUgcEngineConfig(engineConfig);
                setUgcBoard(() => UgcWrapped);
            })
            .catch((error) => {
                if (cancelled) return;
                const message = error instanceof Error ? error.message : t('matchRoom.ugc.loadFailedShort');
                setUgcError(message);
                setUgcEngineConfig(null);
                setUgcBoard(null);
            })
            .finally(() => {
                if (cancelled) return;
                setUgcLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [gameId, isUgcGame, isTutorialRoute, t]);

    // 教程模式是否就绪
    const hasTutorialBoard = Boolean(WrappedBoard && engineConfig && gameId);

    const [isLeaving, setIsLeaving] = useState(false);
    const [isGameNamespaceReady, setIsGameNamespaceReady] = useState(() => {
        // 如果有 gameId，namespace 需要加载，初始为 false 避免 Board 先挂载再卸载
        if (!gameId) return true;
        const namespace = `game-${gameId}`;
        return i18n.hasLoadedNamespace(namespace);
    });
    const [destroyModalId, setDestroyModalId] = useState<string | null>(null);
    const [forceExitModalId, setForceExitModalId] = useState<string | null>(null);
    const [shouldShowMatchError, setShouldShowMatchError] = useState(false);
    const [localStorageTick, setLocalStorageTick] = useState(0);
    const tutorialStartedRef = useRef(false);
    const lastTutorialStepIdRef = useRef<string | null>(null);
    const tutorialModalIdRef = useRef<string | null>(null);
    const errorToastRef = useRef<{ key: string; timestamp: number } | null>(null);
    const handledMissingMatchRef = useRef<string | null>(null);

    useEffect(() => {
        if (!gameId) return;
        const namespace = `game-${gameId}`;

        // 如果 namespace 已加载（如从同游戏的在线对局返回后进入教程），
        // 跳过 false→true 的状态翻转，避免不必要的 unmount/remount 循环。
        // 该循环会导致 LocalGameProvider 重建、tutorialStartedRef 残留为 true，
        // 使 startTutorial useLayoutEffect 在第二次挂载时跳过启动。
        if (i18n.hasLoadedNamespace(namespace)) {
            setIsGameNamespaceReady(true);
            return;
        }

        let isActive = true;
        setIsGameNamespaceReady(false);
        i18n.loadNamespaces(namespace)
            .then(() => {
                if (isActive) {
                    setIsGameNamespaceReady(true);
                }
            })
            .catch(() => {
                if (isActive) {
                    setIsGameNamespaceReady(true);
                }
            });

        return () => {
            isActive = false;
        };
    }, [gameId, i18n]);

    // 大厅阶段暖预加载：在 i18n namespace 就绪后，后台预取当前游戏的图片资源。
    // 与 socket 连接/状态同步并行执行，利用等待时间把图片拉到浏览器缓存，
    // 减少 CriticalImageGate 挂载后的实际加载时间。
    // 使用 preloadWarmImages（requestIdleCallback）不阻塞主线程。
    const lobbyPreloadStartedRef = useRef<string | null>(null);
    useEffect(() => {
        if (!gameId || !isGameNamespaceReady || isTutorialRoute || isUgcGame) return;
        if (lobbyPreloadStartedRef.current === gameId) return;
        lobbyPreloadStartedRef.current = gameId;
        // resolver 无状态降级：返回该游戏的基础资源列表
        const resolved = resolveCriticalImages(gameId, undefined, i18n.language);
        const allPaths = [...new Set([...resolved.critical, ...resolved.warm])];
        if (allPaths.length > 0) {
            preloadWarmImages(allPaths, i18n.language, gameId);
        }
    }, [gameId, isGameNamespaceReady, isTutorialRoute, isUgcGame, i18n.language]);


    // 从地址查询参数中获取 playerID
    const urlPlayerID = searchParams.get('playerID');
    const shouldAutoJoin = searchParams.get('join') === 'true';
    const spectateParam = searchParams.get('spectate');
    const storedMatchCreds = useMemo(() => {
        // 教程模式不需要房间凭据
        if (isTutorialRoute || !matchId) return null;
        const raw = localStorage.getItem(`match_creds_${matchId}`);
        if (!raw) return null;
        try {
            return JSON.parse(raw) as { playerID?: string; credentials?: string };
        } catch {
            return null;
        }
    }, [matchId, isTutorialRoute, localStorageTick]);
    const storedPlayerID = storedMatchCreds?.playerID;
    const hasStoredSeat = Boolean(storedPlayerID);
    const isSpectatorRoute = !isTutorialRoute
        && !shouldAutoJoin
        && !urlPlayerID
        && !hasStoredSeat
        && (spectateParam === null || spectateParam === '1' || spectateParam === 'true');
    useEffect(() => {
        // 日志已移除：Spectate 调试信息过于频繁
    }, [gameId, matchId, urlPlayerID, shouldAutoJoin, spectateParam, isSpectatorRoute]);

    // 自动加入逻辑（调试重置跳转）
    const [isAutoJoining, setIsAutoJoining] = useState(false);
    const autoJoinStartedRef = useRef(false);
    // 自动加入完成后的宽限期（防止 validateStoredMatchSeat 在 matchStatus 刷新前清除凭据）
    const autoJoinGraceRef = useRef(false);
    useEffect(() => {
        if (!shouldAutoJoin || !gameId || !matchId || isTutorialRoute) return;
        if (autoJoinStartedRef.current) {
            return;
        }
        autoJoinStartedRef.current = true;

        let cancelled = false;
        let retryTimer: number | undefined;

        // 如果已有凭据，直接触发 localStorageTick 让 navigate effect 处理跳转
        const stored = localStorage.getItem(`match_creds_${matchId}`);
        if (stored) {
            try {
                const data = JSON.parse(stored);
                if (data?.playerID) {
                    // 已有凭据，触发 tick 让 navigate effect 更新 URL
                    setLocalStorageTick((t) => t + 1);
                    return;
                }
            } catch {
                // 解析失败，继续自动加入
            }
        }

        setIsAutoJoining(true);
        const guestId = getOrCreateGuestId();
        const playerName = user?.username || t('player.guest', { id: guestId, ns: 'lobby' });

        let retryCount = 0;
        const maxRetries = 5;

        const scheduleRetry = (delay: number) => {
            if (retryTimer !== undefined) {
                window.clearTimeout(retryTimer);
            }
            retryTimer = window.setTimeout(() => {
                if (!cancelled) {
                    void tryJoin();
                }
            }, delay);
        };

        const tryJoin = async () => {
            if (cancelled) return;
            try {
                const matchInfo = await matchApi.getMatch(gameId, matchId);
                if (cancelled) return;
                const openSeat = [...matchInfo.players]
                    .sort((a, b) => a.id - b.id)
                    .find(p => !p.name);
                if (!openSeat) {
                    if (!cancelled) setIsAutoJoining(false);
                    return;
                }
                const targetPlayerID = String(openSeat.id);
                const { success } = await rejoinMatch(gameId, matchId, targetPlayerID, playerName, { guestId: user?.id ? undefined : guestId });
                if (cancelled) return;
                if (success) {
                    // rejoinMatch 内部已调用 persistMatchCredentials，
                    // 会触发 match-credentials-changed 事件 → localStorageTick 更新
                    // → storedPlayerID 有值 → navigate effect 自动更新 URL
                    // 设置宽限期，防止 validateStoredMatchSeat 在 matchStatus 刷新前清除凭据
                    autoJoinGraceRef.current = true;
                    window.setTimeout(() => { autoJoinGraceRef.current = false; }, 5000);
                    // 显式触发 tick，确保 storedMatchCreds 立即重新计算
                    setLocalStorageTick((t) => t + 1);
                    setIsAutoJoining(false);
                } else {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        scheduleRetry(500);
                    } else {
                        if (!cancelled) setIsAutoJoining(false);
                    }
                }
            } catch {
                if (cancelled) return;
                retryCount++;
                if (retryCount < maxRetries) {
                    scheduleRetry(500);
                } else {
                    if (!cancelled) setIsAutoJoining(false);
                }
            }
        };

        // 延迟 1 秒，等待房主完全加入
        scheduleRetry(1000);

        return () => {
            cancelled = true;
            if (retryTimer !== undefined) {
                window.clearTimeout(retryTimer);
            }
            autoJoinStartedRef.current = false;
        };
    }, [shouldAutoJoin, gameId, matchId, isTutorialRoute, t, user]);

    // 获取凭据
    const credentials = useMemo(() => {
        if (!matchId) return undefined;
        const resolvedPlayerID = urlPlayerID ?? storedPlayerID;
        if (!resolvedPlayerID) return undefined;
        const stored = localStorage.getItem(`match_creds_${matchId}`);
        if (stored) {
            try {
                const data = JSON.parse(stored) as { playerID?: string; credentials?: string };
                if (data.playerID === resolvedPlayerID) {
                    return data.credentials;
                }
            } catch {
                return undefined;
            }
        }
        return undefined;
    }, [matchId, urlPlayerID, storedPlayerID]);

    useEffect(() => {
        if (!matchId || !gameId) return;
        const stored = localStorage.getItem(`match_creds_${matchId}`);
        if (!stored) return;
        try {
            const data = JSON.parse(stored);
            if (data.gameName !== gameId) {
                persistMatchCredentials(matchId, {
                    ...data,
                    matchID: data.matchID || matchId,
                    gameName: gameId,
                });
            }
        } catch {
            return;
        }
    }, [gameId, matchId]);

    const tutorialPlayerID = debugPlayerID ?? urlPlayerID ?? '0';

    // 进入联机对局时，调试面板自动切换到自己对应的玩家视角
    useEffect(() => {
        if (isTutorialRoute) return;
        if (!urlPlayerID) return;
        if (debugPlayerID === urlPlayerID) return;
        setPlayerID(urlPlayerID);
    }, [debugPlayerID, isTutorialRoute, setPlayerID, urlPlayerID]);

    // 联机对局始终使用地址中的玩家编号，缺失时回退到本地凭据
    const effectivePlayerID = isTutorialRoute
        ? tutorialPlayerID
        : (urlPlayerID ?? storedPlayerID ?? undefined);

    const statusPlayerID = isTutorialRoute
        ? (urlPlayerID ?? debugPlayerID ?? null)
        : (urlPlayerID ?? storedPlayerID ?? null);

    useEffect(() => {
        const handleStorage = () => setLocalStorageTick((t) => t + 1);
        const handleCredentialsChange = () => setLocalStorageTick((t) => t + 1);
        const handleOwnerActive = () => setLocalStorageTick((t) => t + 1);
        window.addEventListener('storage', handleStorage);
        window.addEventListener('match-credentials-changed', handleCredentialsChange);
        window.addEventListener('owner-active-match-changed', handleOwnerActive);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('match-credentials-changed', handleCredentialsChange);
            window.removeEventListener('owner-active-match-changed', handleOwnerActive);
        };
    }, []);

    useEffect(() => {
        if (isTutorialRoute) return;
        if (urlPlayerID || !storedPlayerID) return;
        if (spectateParam === '1' || spectateParam === 'true') return;
        if (!gameId || !matchId) return;
        navigate(`/play/${gameId}/match/${matchId}?playerID=${storedPlayerID}`, { replace: true });
    }, [gameId, matchId, navigate, spectateParam, storedPlayerID, urlPlayerID, isTutorialRoute]);

    // 使用房间状态钩子（以真实玩家身份为准）
    // 教程模式不需要房间状态检查
    const matchStatus = useMatchStatus(
        isTutorialRoute ? undefined : gameId,
        isTutorialRoute ? undefined : matchId,
        isTutorialRoute ? null : statusPlayerID
    );
    useEffect(() => {
        if (isTutorialRoute) return;
        if (!matchId || !statusPlayerID) return;
        if (matchStatus.isLoading || matchStatus.players.length === 0) return;
        // 自动加入过程中或刚完成自动加入时跳过验证（matchStatus 可能还未反映新加入的玩家）
        if (shouldAutoJoin || isAutoJoining || autoJoinGraceRef.current) return;

        const stored = readStoredMatchCredentials(matchId);
        const validation = validateStoredMatchSeat(stored, matchStatus.players, statusPlayerID);
        if (!validation.shouldClear) return;

        clearMatchCredentials(matchId);
        clearOwnerActiveMatch(matchId);
        setLocalStorageTick((t) => t + 1);
        toast.warning({ kind: 'i18n', key: 'error.localStateCleared', ns: 'lobby' });
    }, [isTutorialRoute, matchId, statusPlayerID, matchStatus.isLoading, matchStatus.players, toast, shouldAutoJoin, isAutoJoining]);
    // 教程启动 effect
    // 使用 useLayoutEffect 确保在 CriticalImageGate 的 useEffect 之前执行。
    // 配合 TutorialDispatchBridge 的 useLayoutEffect（先 bindDispatch），
    // startTutorial 可以直接通过 controller 执行 START 命令，
    // setState 在 useLayoutEffect 中同步触发重新渲染，
    // CriticalImageGate 直接看到 playing 阶段的 state，只需预加载一次。
    const gameImplReadyRef = useRef(gameImplReady);
    gameImplReadyRef.current = gameImplReady;

    useLayoutEffect(() => {
        if (!isTutorialRoute) return;
        // 等待 i18n 命名空间加载完成，避免在 namespace 加载期间启动教程
        // （namespace 加载会导致 Board 卸载重挂载，重置游戏状态）
        if (!isGameNamespaceReady) return;
        // 等待游戏实现加载完成，否则 getGameImplementation 返回 null
        if (!gameImplReadyRef.current) return;
        
        // 只在未激活且未启动过时调用 startTutorial
        // 不依赖 tutorial.manifestId/steps.length，避免 startTutorial 的 setTutorial 触发循环
        if (!isActive && !tutorialStartedRef.current) {
            const impl = gameId ? getGameImplementation(gameId) : null;
            if (impl?.tutorial) {
                tutorialStartedRef.current = true;
                startTutorial(impl.tutorial!);
            }
        }
    }, [startTutorial, isTutorialRoute, isActive, gameId, isGameNamespaceReady]);

    // gameImplReady 变为 true 时补触发一次教程启动
    // 场景：dev 模式首次加载时 i18n namespace 先于游戏实现加载完成，
    // 上面的 useLayoutEffect 执行时 gameImplReady 还是 false（通过 ref 读取），
    // 等游戏实现加载完后需要重新尝试启动教程。
    useEffect(() => {
        if (!gameImplReady) return;
        if (!isTutorialRoute) return;
        if (!isGameNamespaceReady) return;
        if (isActive || tutorialStartedRef.current) return;
        const impl = gameId ? getGameImplementation(gameId) : null;
        if (impl?.tutorial) {
            tutorialStartedRef.current = true;
            startTutorial(impl.tutorial!);
        }
    }, [gameImplReady, isTutorialRoute, isGameNamespaceReady, isActive, gameId, startTutorial]);

    // 组件真正卸载时清理教程
    // 使用 setTimeout(0) 延迟执行：如果是 StrictMode 的 unmount→remount，
    // remount 会在同一微任务内发生，可以在 setTimeout 回调前取消清理。
    // 如果是真正卸载（路由切换），setTimeout 回调正常执行。
    const closeTutorialRef = useRef(closeTutorial);
    closeTutorialRef.current = closeTutorial;
    const cleanupTimerRef = useRef<number | undefined>(undefined);
    useEffect(() => {
        // mount 时取消待执行的清理（StrictMode remount 场景）
        if (cleanupTimerRef.current !== undefined) {
            window.clearTimeout(cleanupTimerRef.current);
            cleanupTimerRef.current = undefined;
        }
        return () => {
            if (tutorialStartedRef.current) {
                // 延迟清理：给 StrictMode remount 一个取消的机会
                cleanupTimerRef.current = window.setTimeout(() => {
                    cleanupTimerRef.current = undefined;
                    if (tutorialStartedRef.current) {
                        tutorialStartedRef.current = false;
                        closeTutorialRef.current();
                    }
                }, 0);
            }
        };
    }, []);

    useEffect(() => {
        if (!isTutorialRoute) return;
        if (!isActive) return;
        // 教程已激活时同步标记（兜底：如果 startTutorial 之外的路径激活了教程）
        tutorialStartedRef.current = true;
    }, [isTutorialRoute, isActive]);

    useEffect(() => {
        if (!isTutorialRoute) return;
        if (currentStep?.id) {
            lastTutorialStepIdRef.current = currentStep.id;
        }
    }, [currentStep?.id, isTutorialRoute]);

    // 教程视角自动切换：步骤指定 viewAs 时切换到对应玩家视角，步骤结束后恢复到 '0'
    useEffect(() => {
        if (!isTutorialRoute) return;
        const targetView = currentStep?.viewAs ?? '0';
        setPlayerID(targetView);
    }, [currentStep?.viewAs, isTutorialRoute, setPlayerID]);

    useEffect(() => {
        if (!isTutorialRoute) return;
        if (!tutorialStartedRef.current) return;

        // 教程模式下，部分游戏会在初始化/重置时短暂触发 tutorial.active=false。
        // 这里避免把"瞬间失活"误判为"教程已结束"，导致刚进入就 navigate(-1) 退回首页。
        if (!isActive) {
            const timer = window.setTimeout(() => {
                if (!tutorialStartedRef.current) return;
                // 二次确认仍未激活，且已进入完成步骤时才认为教程结束并返回。
                if (!isActive && lastTutorialStepIdRef.current === 'finish') {
                    navigate(-1);
                }
            }, 600);
            return () => window.clearTimeout(timer);
        }
    }, [isTutorialRoute, isActive, navigate]);

    useEffect(() => {
        // 关键约束：教程提示层只允许在 /tutorial 路由出现。
        // 否则如果某个联机对局状态中残留了 sys.tutorial.active=true（例如历史教程状态被持久化），
        // 就会在联机模式下误弹出教程提示。
        if (!isTutorialRoute) {
            if (tutorialModalIdRef.current) {
                closeModal(tutorialModalIdRef.current);
                tutorialModalIdRef.current = null;
            }
            // 联机/非教程路由下，不主动 closeTutorial()，避免在用户确实处于教程流程但路由切换瞬间被误关。
            return;
        }

        if (isActive && !tutorialModalIdRef.current && isBoardMounted) {
            tutorialModalIdRef.current = openModal({
                closeOnBackdrop: false,
                closeOnEsc: false,
                lockScroll: true,
                allowPointerThrough: true,
                onClose: () => {
                    tutorialModalIdRef.current = null;
                },
                render: () => <TutorialOverlay />,
            });
        }

        // Board 被 CriticalImageGate 卸载（phaseKey 变化触发重新预加载）时，
        // 关闭教程弹窗，避免弹窗悬浮在 LoadingScreen 上方。
        // Board 重新挂载后 isBoardMounted 恢复为 true，弹窗会重新打开。
        if (tutorialModalIdRef.current && !isBoardMounted) {
            closeModal(tutorialModalIdRef.current);
            tutorialModalIdRef.current = null;
        }

        if (!isActive && tutorialModalIdRef.current) {
            closeModal(tutorialModalIdRef.current);
            tutorialModalIdRef.current = null;
        }
    }, [closeModal, closeTutorial, isActive, isBoardMounted, isTutorialRoute, openModal]);

    const clearMatchLocalState = () => {
        if (!matchId) return;
        clearMatchCredentials(matchId);
        clearOwnerActiveMatch(matchId);
        // 关键：强制退出时，也要增加对当前房间的“主页活跃对局”抑制，
        // 确保即使在跨标签页同步延迟时，主页也能立即排除此房间。
        suppressOwnerActiveMatch(matchId);
    };

    const lobbyPresence = useLobbyMatchPresence({
        gameId,
        matchId,
        enabled: !isTutorialRoute && Boolean(gameId && matchId),
        // 旧房间可能从未出现在当前大厅快照中，仍需判定为缺失。
        requireSeen: false,
    });

    useEffect(() => {
        if (isTutorialRoute || !matchId || !lobbyPresence.isMissing) return;
        // 自动加入过程中不检查房间是否缺失（lobby 快照可能尚未包含该房间）
        if (shouldAutoJoin || isAutoJoining || autoJoinGraceRef.current) return;
        // 如果 matchStatus 没有报错，说明房间仍然存在（可能只是游戏结束后从大厅列表移除了）
        // 此时不应该跳转，让玩家看到结果和再来一局按钮
        if (!matchStatus.error) return;
        if (handledMissingMatchRef.current === matchId) return;
        handledMissingMatchRef.current = matchId;
        clearMatchLocalState();
        toast.warning(
            { kind: 'i18n', key: 'error.roomDestroyed', ns: 'lobby' },
            undefined,
            { dedupeKey: `matchRoom.missing.${matchId}` }
        );
        navigateBackToLobby();
    }, [isTutorialRoute, matchId, lobbyPresence.isMissing, matchStatus.error, toast, shouldAutoJoin, isAutoJoining]);

    const handleForceExitLocal = () => {
        clearMatchLocalState();
        navigateBackToLobby();
    };

    const openForceExitModal = () => {
        if (forceExitModalId) return;
        const modalId = openModal({
            closeOnBackdrop: true,
            closeOnEsc: true,
            lockScroll: true,
            onClose: () => {
                setForceExitModalId(null);
            },
            render: ({ close, closeOnBackdrop }) => (
                <ConfirmModal
                    title={t('matchRoom.destroy.forceExitTitle')}
                    description={t('matchRoom.destroy.forceExitDescription')}
                    confirmText={t('matchRoom.destroy.forceExitConfirm')}
                    onConfirm={() => {
                        close();
                        handleForceExitLocal();
                    }}
                    onCancel={() => {
                        close();
                    }}
                    tone="cool"
                    closeOnBackdrop={closeOnBackdrop}
                />
            ),
        });
        setForceExitModalId(modalId);
    };

    const navigateBackToLobby = () => {
        if (gameId) {
            navigate(`/?game=${gameId}`, { replace: true });
            return;
        }
        navigate('/', { replace: true });
    };

    // 离开房间处理 - 主动离开时释放座位（房主/非房主一致）
    const handleLeaveRoom = async () => {
        if (!matchId) {
            navigateBackToLobby();
            return;
        }

        // 观战 / 未绑定身份：直接返回大厅
        if (!statusPlayerID || !credentials) {
            navigateBackToLobby();
            return;
        }

        setIsLeaving(true);
        const result = await leaveMatch(gameId || 'tictactoe', matchId, statusPlayerID, credentials);
        setIsLeaving(false);
        if (!result.success) {
            toast.error({ kind: 'i18n', key: 'matchRoom.leaveFailed', ns: 'lobby' });
            return;
        }
        navigateBackToLobby();
    };

    const handleConfirmDestroy = async () => {
        if (!matchId || !statusPlayerID || !credentials || !matchStatus.isHost) {
            toast.warning({ kind: 'i18n', key: 'matchRoom.destroy.notAllowed', ns: 'lobby' });
            return;
        }

        setIsLeaving(true);
        const result = await destroyMatch(gameId || 'tictactoe', matchId, statusPlayerID, credentials);
        if (!result.success) {
            // 关键：销毁失败时不要清理本地凭证，也不要跳转。
            // 否则会出现「后端房间仍存在 + 前端以为销毁了」的累加/脏数据问题。
            toast.error({ kind: 'i18n', key: 'matchRoom.destroy.failed', ns: 'lobby' });
            setIsLeaving(false);
            openForceExitModal();
            return;
        }

        clearMatchLocalState();
        navigateBackToLobby();
    };

    // 真正销毁房间（仅房主可用）
    const handleDestroyRoom = async () => {
        if (!matchId || !statusPlayerID || !credentials || !matchStatus.isHost) {
            if (!credentials) {
                toast.error({ kind: 'i18n', key: 'matchRoom.destroy.missingCredentials', ns: 'lobby' });
            }
            return;
        }

        if (destroyModalId) {
            closeModal(destroyModalId);
            setDestroyModalId(null);
        }
        const modalId = openModal({
            closeOnBackdrop: true,
            closeOnEsc: true,
            lockScroll: true,
            onClose: () => {
                setDestroyModalId(null);
            },
            render: ({ close, closeOnBackdrop }) => (
                <ConfirmModal
                    title={t('matchRoom.destroy.title')}
                    description={t('matchRoom.destroy.description')}
                    onConfirm={() => {
                        close();
                        handleConfirmDestroy();
                    }}
                    onCancel={() => {
                        close();
                    }}
                    tone="cool"
                    closeOnBackdrop={closeOnBackdrop}
                />
            ),
        });
        setDestroyModalId(modalId);
    };

    useEffect(() => {
        if (isTutorialRoute) {
            setShouldShowMatchError(false);
            return;
        }
        if (!matchStatus.error) {
            setShouldShowMatchError(false);
            return;
        }
        const timer = window.setTimeout(() => {
            setShouldShowMatchError(true);
        }, 4000);
        return () => window.clearTimeout(timer);
    }, [isTutorialRoute, matchStatus.error]);

    // 如果房间不存在，显示错误并自动跳转
    useEffect(() => {
        if (shouldShowMatchError) {
            const timer = setTimeout(() => {
                navigate('/');
            }, 2500); // 2.5 秒后自动跳转

            return () => clearTimeout(timer);
        }
    }, [shouldShowMatchError, isTutorialRoute, navigate]);

    useEffect(() => {
        return () => {
            if (destroyModalId) {
                closeModal(destroyModalId);
                setDestroyModalId(null);
            }
            if (forceExitModalId) {
                closeModal(forceExitModalId);
                setForceExitModalId(null);
            }
            if (tutorialModalIdRef.current) {
                closeModal(tutorialModalIdRef.current);
                tutorialModalIdRef.current = null;
            }
        };
    }, [closeModal, destroyModalId, forceExitModalId]);

    useEffect(() => {
        if (!shouldShowMatchError) return;
        const key = `matchRoom.error.${gameId ?? 'unknown'}.${matchId ?? 'unknown'}`;
        const now = Date.now();
        const last = errorToastRef.current;
        if (last && last.key === key && now - last.timestamp < 3000) return;
        errorToastRef.current = { key, timestamp: now };
        toast.error(
            { kind: 'text', text: matchStatus.error ?? t('matchRoom.error.matchMissing') },
            { kind: 'i18n', key: 'error.serviceUnavailable.title', ns: 'lobby' },
            { dedupeKey: key }
        );
    }, [gameId, matchId, shouldShowMatchError, t, toast]);

    if (!isGameNamespaceReady) {
        return <LoadingScreen description={t('matchRoom.loadingResources')} />;
    }

    // 自动加入过程中显示加载状态
    if (isAutoJoining || (shouldAutoJoin && !credentials)) {
        return <LoadingScreen description={t('matchRoom.joiningRoom')} />;
    }

    if (shouldShowMatchError) {
        return (
            <div className="w-full h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="text-white/60 text-lg mb-4">{matchStatus.error}</div>
                    <div className="text-white/40 text-sm mb-6 animate-pulse">{t('matchRoom.redirecting')}</div>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                    >
                        {t('matchRoom.returnHome')}
                    </button>
                </div>
            </div>
        );
    }
    return (
        <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
            <SEO
                title={isTutorialRoute
                    ? t('matchRoom.tutorialTitle', { game: gameId ? t(`common:game_names.${gameId}`, { ns: 'common' }) : '' })
                    : t('matchRoom.matchTitle', { game: gameId ? t(`common:game_names.${gameId}`, { ns: 'common' }) : '' })}
                ogType="game"
            />
            {/* 统一的游戏 HUD */}
            <GameHUD
                mode={isTutorialRoute ? 'tutorial' : 'online'}
                matchId={matchId}
                gameId={gameId}
                isHost={matchStatus.isHost}
                credentials={credentials}
                myPlayerId={effectivePlayerID}
                opponentName={matchStatus.opponentName}
                opponentConnected={matchStatus.opponentConnected}
                players={matchStatus.players}
                onLeave={handleLeaveRoom}
                onDestroy={handleDestroyRoom}
                onForceExit={handleForceExitLocal}
                isLoading={isLeaving}
            />

            {isSpectatorRoute && !isTutorialRoute && (
                <div
                    className="absolute inset-0 bg-transparent pointer-events-auto"
                    style={{ zIndex: UI_Z_INDEX.loading }}
                    aria-hidden="true"
                />
            )}

            {/* 游戏棋盘 - 全屏 */}
            <div
                className={`w-full h-full ${isUgcGame ? 'ugc-preview-container' : ''}`}
                style={{
                    '--font-game-display': gameConfig?.fontFamily?.display ? `'${gameConfig.fontFamily.display}', serif` : undefined,
                } as React.CSSProperties}
            >
                <GameCursorProvider themeId={gameConfig?.cursorTheme} gameId={gameId} playerID={effectivePlayerID}>
                {isTutorialRoute ? (
                    <GameModeProvider mode="tutorial">
                        {!gameImplReady ? (
                            <LoadingScreen fullScreen={false} title={t('matchRoom.title.tutorial')} description={t('matchRoom.loadingResources')} />
                        ) : hasTutorialBoard && engineConfig && WrappedBoard ? (
                            <LocalGameProvider config={engineConfig} numPlayers={2} seed={`tutorial-${gameId}`} playerId="0" onCommandRejected={handleCommandRejected}>
                                <TutorialDispatchBridge>
                                    <BoardBridge
                                        board={WrappedBoard}
                                        loading={<LoadingScreen title={t('matchRoom.title.tutorial')} description={t('matchRoom.loadingResources')} />}
                                    />
                                </TutorialDispatchBridge>
                            </LocalGameProvider>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/50">
                                {t('matchRoom.noTutorial')}
                            </div>
                        )}
                    </GameModeProvider>
                ) : (
                    isUgcGame && ugcLoading ? (
                        <LoadingScreen fullScreen={false} description={t('matchRoom.ugc.loading')} />
                    ) : isUgcGame && ugcError ? (
                        <div className="w-full h-full flex items-center justify-center text-red-300 text-sm">
                            {t('matchRoom.ugc.loadFailed', { error: ugcError })}
                        </div>
                    ) : isUgcGame && ugcBoard && ugcEngineConfig && matchId ? (
                        <GameModeProvider mode="online" isSpectator={isSpectatorRoute}>
                            <RematchProvider
                                matchId={matchId}
                                playerId={effectivePlayerID ?? undefined}
                                isMultiplayer={true}
                            >
                                <GameProvider
                                    server={getGameServerUrl()}
                                    matchId={matchId}
                                    playerId={isSpectatorRoute ? null : (effectivePlayerID ?? null)}
                                    credentials={credentials}
                                    onError={handleGameError}
                                >
                                    <BoardBridge
                                        board={ugcBoard}
                                        loading={<ConnectionLoadingScreen title={t('matchRoom.title.joining')} description={t('matchRoom.joiningRoom')} gameId={gameId} />}
                                    />
                                </GameProvider>
                            </RematchProvider>
                        </GameModeProvider>
                    ) : hasOnlineBoard && WrappedBoard && matchId ? (
                        <GameModeProvider mode="online" isSpectator={isSpectatorRoute}>
                            <RematchProvider
                                matchId={matchId}
                                playerId={effectivePlayerID ?? undefined}
                                isMultiplayer={true}
                            >
                                <GameProvider
                                    server={getGameServerUrl()}
                                    matchId={matchId}
                                    playerId={isSpectatorRoute ? null : (effectivePlayerID ?? null)}
                                    credentials={credentials}
                                    engineConfig={engineConfig ?? undefined}
                                    latencyConfig={latencyConfig}
                                    onError={handleGameError}
                                >
                                    <BoardBridge
                                        board={WrappedBoard}
                                        loading={<ConnectionLoadingScreen title={t('matchRoom.title.connecting')} description={t('matchRoom.loadingResources')} gameId={gameId} />}
                                    />
                                </GameProvider>
                            </RematchProvider>
                        </GameModeProvider>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/50">
                            {t('matchRoom.noClient')}
                        </div>
                    )
                )}
                </GameCursorProvider>
            </div>

        </div>
    );
};
