import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initGlobalSdk, type UGCViewSdk } from './viewSdk';
import type { UGCGameState } from '../sdk/types';
import { extractBuilderPreviewConfig } from './previewConfig';
import { PreviewCanvas } from '../builder/ui/RenderPreview';
import { executeActionHook, type RuntimeZoneAction } from './actionHooks';

export type RuntimeViewMode = 'inline' | 'iframe';

interface UGCRuntimeViewProps {
  mode: RuntimeViewMode;
  initialState?: UGCGameState | null;
  className?: string;
}

export function UGCRuntimeView({ mode, initialState = null, className = '' }: UGCRuntimeViewProps) {
  const [state, setState] = useState<UGCGameState | null>(initialState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const sdkRef = useRef<UGCViewSdk | null>(null);

  useEffect(() => {
    if (mode !== 'iframe') return undefined;
    const sdk = initGlobalSdk({
      onInit: data => setState(data.state),
      onStateUpdate: nextState => setState(nextState),
      onError: (code, message) => setErrorMessage(`UGC_VIEW_ERROR code=${code} message=${message}`),
    });
    sdkRef.current = sdk;
    return () => sdk.stop();
  }, [mode]);

  useEffect(() => {
    if (mode !== 'inline') return;
    setState(initialState ?? null);
    sdkRef.current = null;
  }, [mode, initialState]);

  useEffect(() => {
    if (!actionError) return undefined;
    const timer = window.setTimeout(() => setActionError(null), 3000);
    return () => window.clearTimeout(timer);
  }, [actionError]);

  useEffect(() => {
    if (!actionSuccess) return undefined;
    const timer = window.setTimeout(() => setActionSuccess(null), 2000);
    return () => window.clearTimeout(timer);
  }, [actionSuccess]);

  const handleCommandResult = useCallback((result: { success: boolean; error?: string }) => {
    if (result.success) {
      setActionSuccess('命令执行成功');
      return;
    }
    setActionError(result.error || '命令执行失败');
  }, []);

  const previewConfig = useMemo(() => extractBuilderPreviewConfig(state), [state]);
  const runtimePlayerIds = useMemo(() => {
    if (!state) return [] as string[];
    const zones = state.publicZones as Record<string, unknown> | undefined;
    const playerOrder = Array.isArray(zones?.playerOrder)
      ? (zones?.playerOrder as Array<string | number>).map(id => String(id))
      : [];
    if (playerOrder.length > 0) return playerOrder;
    return Object.keys(state.players || {});
  }, [state]);
  const runtimeCurrentPlayerId = useMemo(() => {
    if (!state) return null;
    const candidate = state.activePlayerId ? String(state.activePlayerId) : '';
    if (candidate) return candidate;
    return runtimePlayerIds[0] ?? null;
  }, [state, runtimePlayerIds]);
  const handleAction = useCallback(async (action: RuntimeZoneAction, context: Record<string, unknown>) => {
    const result = await executeActionHook({
      action,
      context,
      state,
      sdk: sdkRef.current,
      onCommandResult: handleCommandResult,
    });
    if (!result.success) {
      setActionError(result.error || '动作钩子执行失败');
      return;
    }
    if (result.commandId) {
      setActionSuccess('命令已发送');
    }
  }, [state]);

  const handlePlayCard = useCallback((cardId: string) => {
    if (!sdkRef.current) return;
    sdkRef.current.playCard(cardId, undefined, handleCommandResult);
  }, []);

  if (errorMessage) {
    return (
      <div className={`flex items-center justify-center bg-slate-950 text-red-300 text-xs ${className}`}>
        {errorMessage}
      </div>
    );
  }

  if (!previewConfig) {
    return (
      <div className={`flex items-center justify-center bg-slate-950 text-slate-400 text-xs ${className}`}>
        等待运行时数据…
      </div>
    );
  }

  return (
    <div className={`relative flex-1 bg-slate-950 ${className}`}>
      <PreviewCanvas
        components={previewConfig.layout}
        renderComponents={previewConfig.renderComponents}
        instances={previewConfig.instances}
        layoutGroups={previewConfig.layoutGroups}
        schemaDefaults={previewConfig.schemaDefaults}
        className="h-full"
        interactive
        currentPlayerId={runtimeCurrentPlayerId}
        playerIds={runtimePlayerIds}
        runtimeState={state}
        onAction={handleAction}
        onPlayCard={handlePlayCard}
      />
      {actionError && (
        <div className="absolute bottom-3 left-3 right-3 rounded bg-red-900/70 text-red-100 text-xs px-3 py-2 border border-red-500/40">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="absolute top-3 right-3 rounded bg-emerald-900/70 text-emerald-100 text-xs px-3 py-2 border border-emerald-500/40">
          {actionSuccess}
        </div>
      )}
    </div>
  );
}
