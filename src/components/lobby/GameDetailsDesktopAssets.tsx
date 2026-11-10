import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { downloadFgoAssets, hasDownloadedFgoAssets } from '../../games/fate-domination/fgo-runtime/fgoAssets';

type DownloadState = { status: 'idle' | 'downloading' | 'complete' | 'failed'; done: number; total: number; error?: string };
let state: DownloadState = { status: 'idle', done: 0, total: 0 };
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
const snapshot = () => state;
const publish = (next: DownloadState) => { state = next; listeners.forEach(listener => listener()); };

function startDownload() {
  if (state.status === 'downloading') return;
  publish({ status: 'downloading', done: 0, total: 0 });
  void downloadFgoAssets((done, total) => publish({ status: 'downloading', done, total }))
    .then(() => publish({ ...state, status: 'complete' }))
    .catch(error => publish({ ...state, status: 'failed', error: error instanceof Error ? error.message : String(error) }));
}

export function GameDetailsDesktopAssets({ gameId }: { gameId: string }) {
  const { t } = useTranslation('lobby');
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    if (gameId !== 'fate-domination' || state.status !== 'idle') return;
    void hasDownloadedFgoAssets().then(available => {
      if (available && state.status === 'idle') publish({ ...state, status: 'complete' });
    }).catch(error => console.warn('检查本地战斗素材失败', error));
  }, [gameId]);
  if (gameId !== 'fate-domination' || typeof window === 'undefined'
    || typeof window.matchMedia !== 'function' || !window.matchMedia('(pointer: fine)').matches) return null;
  const label = current.status === 'downloading'
    ? t('packageManager.desktopFgoProgress', { done: current.done, total: current.total })
    : current.status === 'complete' ? t('packageManager.desktopFgoComplete')
      : current.status === 'failed' ? t('packageManager.desktopFgoRetry') : t('packageManager.desktopFgoDownload');
  return <div className="inline-flex flex-col items-center gap-1">
    <button type="button" data-testid="fate-desktop-assets-download" onClick={startDownload}
      disabled={current.status === 'downloading'} title={current.error || label}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-[#8d6a46]/60 px-3 text-sm font-semibold text-[#4d301e] hover:bg-[#e9d5b6] disabled:opacity-70">
      <Download size={16} aria-hidden="true" />{label}
    </button>
    {current.status === 'failed' && <span role="alert" className="max-w-60 text-xs text-red-800">{current.error}</span>}
  </div>;
}
