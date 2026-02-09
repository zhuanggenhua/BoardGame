/**
 * UGC 试玩/沙盒页
 *
 * 从本地草稿加载规则与预览配置，启动运行态对局。
 */

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client } from 'boardgame.io/react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { GameModeProvider } from '../../../contexts/GameModeContext';
import { createUgcDraftGame } from '../../client/game';
import { createUgcRemoteHostBoard } from '../../client/board';
import type { BuilderState } from '../context';
import { LoadingScreen } from '../../../components/system/LoadingScreen';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'ugc-builder-state';

type DraftSaveData = Pick<
  BuilderState,
  'name' | 'rulesCode' | 'schemas' | 'layout' | 'layoutGroups' | 'instances' | 'renderComponents'
>;

const loadDraftFromStorage = (): DraftSaveData | null => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DraftSaveData> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      rulesCode: typeof parsed.rulesCode === 'string' ? parsed.rulesCode : '',
      schemas: Array.isArray(parsed.schemas) ? parsed.schemas : [],
      layout: Array.isArray(parsed.layout) ? parsed.layout : [],
      layoutGroups: Array.isArray(parsed.layoutGroups) ? parsed.layoutGroups : [],
      instances: parsed.instances && typeof parsed.instances === 'object' ? parsed.instances : {},
      renderComponents: Array.isArray(parsed.renderComponents) ? parsed.renderComponents : [],
    };
  } catch (error) {
    return null;
  }
};

export function UGCSandbox() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<DraftSaveData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sandboxClient, setSandboxClient] = useState<ComponentType<{ playerID?: string | null }> | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxError, setSandboxError] = useState<string | null>(null);

  const handleReload = useCallback(() => {
    const loaded = loadDraftFromStorage();
    if (!loaded) {
      setDraft(null);
      setLoadError('本地草稿为空，请先在 Builder 保存草稿。');
      return;
    }
    setLoadError(null);
    setDraft(loaded);
  }, []);

  useEffect(() => {
    handleReload();
  }, [handleReload]);

  const schemaDefaults = useMemo(() => {
    if (!draft?.schemas) return undefined;
    const entries = draft.schemas
      .filter(schema => typeof schema.defaultRenderComponentId === 'string' && schema.defaultRenderComponentId.trim())
      .map(schema => [schema.id, schema.defaultRenderComponentId!.trim()] as const);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }, [draft?.schemas]);

  const previewConfig = useMemo(() => {
    if (!draft) return null;
    return {
      layout: draft.layout ?? [],
      renderComponents: draft.renderComponents ?? [],
      instances: draft.instances ?? {},
      layoutGroups: draft.layoutGroups ?? [],
      schemaDefaults,
    };
  }, [draft, schemaDefaults]);

  const previewPlayerIds = useMemo(() => {
    if (!previewConfig) return ['player-1', 'player-2'];
    const hiddenGroupIds = new Set(
      (previewConfig.layoutGroups || []).filter(group => group.hidden).map(group => group.id)
    );
    const visibleComponents = previewConfig.layout.filter(comp => {
      const groupId = (comp.data.groupId as string) || 'default';
      return !hiddenGroupIds.has(groupId);
    });
    const playerAreas = visibleComponents.filter(comp => comp.type === 'player-area');
    if (playerAreas.length === 0) return [];
    const includesSelf = playerAreas.some(comp => {
      const playerRef = String(comp.data.playerRef || 'index');
      if (playerRef === 'current' || playerRef === 'self') return true;
      const rawIndex = comp.data.playerRefIndex;
      const index = typeof rawIndex === 'number' ? rawIndex : Number(rawIndex ?? NaN);
      return Number.isFinite(index) && index === 0;
    });
    const totalPlayers = includesSelf ? playerAreas.length : playerAreas.length + 1;
    return Array.from({ length: totalPlayers }, (_, index) => `player-${index + 1}`);
  }, [previewConfig]);

  const previewPlayerCount = Math.max(2, previewPlayerIds.length);

  useEffect(() => {
    if (!draft || !previewConfig) {
      setSandboxClient(null);
      setSandboxLoading(false);
      return;
    }

    const rulesCode = String(draft.rulesCode || '').trim();
    if (!rulesCode) {
      setSandboxClient(null);
      setSandboxLoading(false);
      setSandboxError('规则代码为空，无法启动沙盒');
      return;
    }

    let cancelled = false;
    setSandboxClient(null);
    setSandboxLoading(true);
    setSandboxError(null);

    createUgcDraftGame({
      packageId: 'ugc-builder-sandbox',
      rulesCode,
      minPlayers: previewPlayerCount,
      maxPlayers: previewPlayerCount,
    })
      .then((game) => {
        if (cancelled) return;
        const board = createUgcRemoteHostBoard({
          packageId: 'ugc-builder-sandbox',
          viewUrl: '/dev/ugc/runtime-view',
          previewConfig,
        });
        const client = Client({
          game,
          board,
          debug: false,
          numPlayers: previewPlayerCount,
          loading: () => <LoadingScreen title="Sandbox" description="Initializing game sandbox..." />
        });
        setSandboxClient(() => client as ComponentType<{ playerID?: string | null }>);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : '沙盒加载失败';
        setSandboxError(message);
        setSandboxClient(null);
      })
      .finally(() => {
        if (cancelled) return;
        setSandboxLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [draft, previewConfig, previewPlayerCount]);

  const draftName = draft?.name?.trim() ? draft.name.trim() : '未命名草稿';
  const errorMessage = loadError || sandboxError;

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white">
      <header className="flex items-center justify-between px-4 py-2 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dev/ugc')}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> 返回 Builder
          </button>
          <div>
            <div className="text-sm font-semibold">UGC 试玩/沙盒</div>
            <div className="text-xs text-slate-400">当前草稿：{draftName}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReload}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm"
          >
            <RefreshCw className="w-4 h-4" /> 重新加载草稿
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col">
        {errorMessage ? (
          <div className="flex-1 flex items-center justify-center text-red-300 text-sm">
            {errorMessage}
          </div>
        ) : sandboxLoading ? (
          <LoadingScreen description="沙盒加载中…" />
        ) : sandboxClient ? (
          <div className="ugc-preview-container flex-1">
            <GameModeProvider mode="local">
              {(() => {
                const SandboxClient = sandboxClient;
                return <SandboxClient playerID="0" />;
              })()}
            </GameModeProvider>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            沙盒未就绪
          </div>
        )}
      </div>
    </div>
  );
}

export default UGCSandbox;
