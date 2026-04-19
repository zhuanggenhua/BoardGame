import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UGCGameState, PlayerId } from '../sdk/types';
import { createHostBridge, type UGCHostBridge } from './hostBridge';
import { RuntimeDomainExecutor, type RuntimeCommand, type RuntimeGameEvent } from './domainExecutor';
import { UGCRuntimeView, type RuntimeViewMode } from './UGCRuntimeView';
import { attachBuilderPreviewConfig, type BuilderPreviewConfig } from './previewConfig';

interface UGCRuntimeHostProps {
  mode: RuntimeViewMode;
  config: BuilderPreviewConfig;
  rulesCode: string;
  className?: string;
  iframeSrc?: string;
  packageId?: string;
  currentPlayerId?: PlayerId;
  playerIds?: PlayerId[];
}

export function UGCRuntimeHost({
  mode,
  config,
  rulesCode,
  className = '',
  iframeSrc = '/dev/ugc/runtime-view',
  packageId = 'ugc-builder-preview',
  currentPlayerId = 'player-1',
  playerIds,
}: UGCRuntimeHostProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const bridgeRef = useRef<UGCHostBridge | null>(null);
  const stateRef = useRef<UGCGameState | null>(null);
  const executorRef = useRef<RuntimeDomainExecutor | null>(null);
  const coreStateRef = useRef<UGCGameState | null>(null);
  const seedRef = useRef<number>(Date.now());
  const [iframeReady, setIframeReady] = useState(false);
  const [runtimeState, setRuntimeState] = useState<UGCGameState | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const derivedPlayerIds = useMemo(() => {
    const hiddenGroupIds = new Set(
      (config.layoutGroups || [])
        .filter(group => group.hidden)
        .map(group => group.id)
    );
    const visibleComponents = config.layout.filter(comp => {
      const groupId = (comp.data.groupId as string) || 'default';
      return !hiddenGroupIds.has(groupId);
    });
    const playerAreas = visibleComponents.filter(comp => comp.type === 'player-area');
    if (playerAreas.length === 0) return [];
    return Array.from({ length: playerAreas.length }, (_, index) => `player-${index + 1}`);
  }, [config.layout, config.layoutGroups]);

  const normalizedPlayerIds = useMemo(() => {
    const ids = playerIds && playerIds.length > 0
      ? playerIds
      : (derivedPlayerIds.length > 0 ? derivedPlayerIds : [currentPlayerId]);
    return Array.from(new Set(ids.map(id => String(id))));
  }, [playerIds, derivedPlayerIds, currentPlayerId]);

  const resolvedCurrentPlayerId = useMemo(() => {
    if (normalizedPlayerIds.length === 0) return String(currentPlayerId);
    const candidate = String(currentPlayerId);
    if (normalizedPlayerIds.includes(candidate)) return candidate;
    return normalizedPlayerIds[0];
  }, [currentPlayerId, normalizedPlayerIds]);

  const buildViewState = useCallback((state: UGCGameState | null) => {
    if (!state) return null;
    const domain = executorRef.current?.getDomainCore();
    const viewState = domain?.playerView
      ? { ...state, ...domain.playerView(state, resolvedCurrentPlayerId) }
      : state;
    return attachBuilderPreviewConfig(viewState, config);
  }, [config, resolvedCurrentPlayerId]);

  const applyGameOver = useCallback(async (state: UGCGameState, executor: RuntimeDomainExecutor) => {
    const result = await executor.isGameOver(state);
    if (!result.success) {
      setRuntimeError(result.error || '胜负判定失败');
      return state;
    }
    if (!result.result) return state;
    return {
      ...state,
      gameOver: {
        winner: result.result.winner,
        draw: result.result.draw,
        winners: result.result.winners,
        scores: result.result.scores,
      },
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const executor = new RuntimeDomainExecutor({ allowConsole: true });
    executorRef.current = executor;

    const loadDomain = async () => {
      setRuntimeError(null);
      if (!rulesCode || !rulesCode.trim()) {
        setRuntimeError('规则代码为空，无法启动运行时');
        coreStateRef.current = null;
        setRuntimeState(null);
        return;
      }

      const loadResult = await executor.loadCode(rulesCode);
      if (!loadResult.success) {
        if (cancelled) return;
        setRuntimeError(loadResult.error || '规则加载失败');
        coreStateRef.current = null;
        setRuntimeState(null);
        return;
      }

      const setupResult = await executor.setup(normalizedPlayerIds, seedRef.current++);
      if (!setupResult.success || !setupResult.result) {
        if (cancelled) return;
        setRuntimeError(setupResult.error || '规则初始化失败');
        coreStateRef.current = null;
        setRuntimeState(null);
        return;
      }

      const setupState = await applyGameOver(setupResult.result, executor);
      if (cancelled) return;
      coreStateRef.current = setupState;
      setRuntimeState(buildViewState(setupState));
    };

    loadDomain();

    return () => {
      cancelled = true;
      executor.unload();
      executorRef.current = null;
      coreStateRef.current = null;
    };
  }, [rulesCode, normalizedPlayerIds, buildViewState, applyGameOver]);

  useEffect(() => {
    stateRef.current = runtimeState;
    if (bridgeRef.current) {
      bridgeRef.current.sendStateUpdate();
    }
  }, [runtimeState]);

  useEffect(() => {
    if (!bridgeRef.current || !runtimeError) return;
    bridgeRef.current.sendError('RUNTIME_ERROR', runtimeError);
  }, [runtimeError]);

  const handleCommand = useCallback(async (commandType: string, playerId: PlayerId, params: Record<string, unknown>) => {
    const executor = executorRef.current;
    const currentState = coreStateRef.current;
    if (!executor || !currentState) {
      return { success: false, error: '规则未加载' };
    }

    const command: RuntimeCommand = {
      type: commandType,
      playerId,
      payload: params,
      timestamp: Date.now(),
    };

    const validation = await executor.validate(currentState, command);
    if (!validation.success) {
      return { success: false, error: validation.error || '规则校验失败' };
    }
    if (!validation.result?.valid) {
      return { success: false, error: validation.result?.error || '命令不合法' };
    }

    const executeResult = await executor.execute(currentState, command, seedRef.current++);
    if (!executeResult.success || !executeResult.result) {
      return { success: false, error: executeResult.error || '执行命令失败' };
    }

    let nextState = currentState;
    for (const event of executeResult.result) {
      const reduceResult = await executor.reduce(nextState, event as RuntimeGameEvent);
      if (!reduceResult.success || !reduceResult.result) {
        return { success: false, error: reduceResult.error || '状态更新失败' };
      }
      nextState = reduceResult.result as UGCGameState;
    }

    const withGameOver = await applyGameOver(nextState, executor);
    coreStateRef.current = withGameOver;
    setRuntimeState(buildViewState(withGameOver));

    return { success: true, events: executeResult.result };
  }, [applyGameOver, buildViewState]);

  useEffect(() => {
    if (mode !== 'iframe') return;
    if (!iframeReady || !iframeRef.current) return;

    const bridge = createHostBridge({
      iframe: iframeRef.current,
      packageId,
      currentPlayerId: resolvedCurrentPlayerId,
      playerIds: normalizedPlayerIds,
      onCommand: handleCommand,
      getState: () => stateRef.current || runtimeState || {
        phase: 'bootstrap',
        activePlayerId: resolvedCurrentPlayerId,
        turnNumber: 0,
        players: {},
        publicZones: {},
      },
      onError: error => {
        console.error(`[UGCRuntimeHost] error=${error}`);
      },
    });
    bridge.start();
    bridgeRef.current = bridge;

    return () => {
      bridge.stop();
      bridgeRef.current = null;
    };
  }, [mode, iframeReady, packageId, resolvedCurrentPlayerId, normalizedPlayerIds, handleCommand]);

  if (mode === 'inline') {
    if (runtimeError) {
      return (
        <div className={`flex items-center justify-center bg-slate-950 text-red-300 text-xs ${className}`}>
          {runtimeError}
        </div>
      );
    }
    return <UGCRuntimeView mode="inline" initialState={runtimeState} className={className} />;
  }

  return (
    <div className={`relative ${className}`}>
      <iframe
        ref={iframeRef}
        title="UGC Runtime Preview"
        src={iframeSrc}
        className="w-full h-full border-0"
        onLoad={() => setIframeReady(true)}
      />
    </div>
  );
}
