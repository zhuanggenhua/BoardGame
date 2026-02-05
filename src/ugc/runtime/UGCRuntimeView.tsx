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

  const previewConfig = useMemo(() => extractBuilderPreviewConfig(state), [state]);
  const handleAction = useCallback(async (action: RuntimeZoneAction, context: Record<string, unknown>) => {
    const result = await executeActionHook({
      action,
      context,
      state,
      sdk: sdkRef.current,
    });
    if (!result.success) {
      setActionError(result.error || '动作钩子执行失败');
    }
  }, [state]);

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
        className="h-full"
        onAction={handleAction}
      />
      {actionError && (
        <div className="absolute bottom-3 left-3 right-3 rounded bg-red-900/70 text-red-100 text-xs px-3 py-2 border border-red-500/40">
          {actionError}
        </div>
      )}
    </div>
  );
}
