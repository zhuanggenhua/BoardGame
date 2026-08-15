import { AlertTriangle, ArrowLeft, Check, Copy, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { UI_Z_INDEX } from '../../core';
import { useModalStack } from '../../contexts/ModalStackContext';
import { extractGameIdFromPlayPath } from '../../shared/mobileSupport';
import { getLastErrorContext } from '../../lib/feedback/errorContext';
import { navigateBackToLobbyWithModalCleanup } from '../../lib/navigation/navigateBackToLobbyWithModalCleanup';
import { copyToClipboard } from '../../lib/utils';

const INITIAL_LOADER_ID = 'initial-loader';
const MIN_RENDERABLE_SIZE_PX = 48;
const MIN_MEANINGFUL_AREA_PX = 48 * 48;
const MAX_VISIBLE_ELEMENT_SCAN = 160;

export const GAME_PAGE_RESCUE_GRACE_MS = 60_000;
export const GAME_PAGE_RESCUE_CONFIRM_MS = 6_000;

export type GamePageRescueSignal =
    | 'game-viewport-missing'
    | 'game-shell-collapsed'
    | 'game-content-missing';

export interface GamePageRescueSignalInput {
    pathname: string;
    elapsedMs: number;
    hasFriendlyScreen: boolean;
    hasLoadingScreen: boolean;
    hasBootstrapLoader: boolean;
    viewportRect?: { width: number; height: number } | null;
    shellRect?: { width: number; height: number } | null;
    contentRect?: { width: number; height: number } | null;
    meaningfulContentCount: number;
}

interface RescueSnapshot {
    signal: GamePageRescueSignal | null;
    elapsedMs: number;
    elapsedSinceHealthyMs?: number;
    viewportRect?: { width: number; height: number } | null;
    shellRect?: { width: number; height: number } | null;
    contentRect?: { width: number; height: number } | null;
    meaningfulContentCount: number;
    hasFriendlyScreen: boolean;
    hasLoadingScreen: boolean;
    hasBootstrapLoader: boolean;
}

const isGameRoutePath = (pathname: string) => pathname.startsWith('/play/');

const toRectSize = (element: Element | null | undefined) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
    };
};

const isMeaningfullyVisible = (element: Element) => {
    const htmlElement = element as HTMLElement;
    const rect = htmlElement.getBoundingClientRect();
    if (rect.width * rect.height < MIN_MEANINGFUL_AREA_PX) {
        return false;
    }

    const style = window.getComputedStyle(htmlElement);
    if (
        style.display === 'none'
        || style.visibility === 'hidden'
        || Number.parseFloat(style.opacity || '1') <= 0.05
    ) {
        return false;
    }

    return true;
};

const countMeaningfulVisibleDescendants = (container: Element | null) => {
    if (!container) return 0;

    const elements = Array.from(container.querySelectorAll('*')).slice(0, MAX_VISIBLE_ELEMENT_SCAN);
    let count = 0;

    for (const element of elements) {
        if (
            element instanceof HTMLElement
            && (
                element.dataset.bgFriendlyScreen === 'true'
                || element.dataset.testid === 'loading-screen'
            )
        ) {
            continue;
        }

        if (isMeaningfullyVisible(element)) {
            count += 1;
        }
    }

    return count;
};

export const detectGamePageRescueSignal = ({
    pathname,
    elapsedMs,
    hasFriendlyScreen,
    hasLoadingScreen,
    hasBootstrapLoader,
    viewportRect,
    shellRect,
    contentRect,
    meaningfulContentCount,
}: GamePageRescueSignalInput): GamePageRescueSignal | null => {
    if (!isGameRoutePath(pathname)) {
        return null;
    }

    if (
        hasFriendlyScreen
        || hasLoadingScreen
        || hasBootstrapLoader
        || elapsedMs < GAME_PAGE_RESCUE_GRACE_MS
    ) {
        return null;
    }

    if (!viewportRect) {
        return 'game-viewport-missing';
    }

    if (
        viewportRect.width < MIN_RENDERABLE_SIZE_PX
        || viewportRect.height < MIN_RENDERABLE_SIZE_PX
        || (shellRect && (shellRect.width < MIN_RENDERABLE_SIZE_PX || shellRect.height < MIN_RENDERABLE_SIZE_PX))
        || (contentRect && (contentRect.width < MIN_RENDERABLE_SIZE_PX || contentRect.height < MIN_RENDERABLE_SIZE_PX))
    ) {
        return 'game-shell-collapsed';
    }

    if (meaningfulContentCount === 0) {
        return 'game-content-missing';
    }

    return null;
};

const removeInitialLoaderIfPresent = () => {
    if (typeof document === 'undefined') return;
    document.getElementById(INITIAL_LOADER_ID)?.remove();
};

const readRescueSnapshot = (pathname: string, enteredAt: number): Omit<RescueSnapshot, 'signal'> => {
    const loadingScreen = document.querySelector('[data-testid="loading-screen"]');
    const friendlyScreen = document.querySelector('[data-bg-friendly-screen="true"]:not([data-bg-rescue-gate="true"])');
    const bootstrapLoader = document.getElementById(INITIAL_LOADER_ID);
    const viewport = document.querySelector('.game-page-viewport');
    const shell = document.querySelector('.mobile-board-shell');
    const content = document.querySelector('.mobile-board-shell__content') ?? viewport;
    const elapsedMs = Date.now() - enteredAt;
    const meaningfulContentCount = countMeaningfulVisibleDescendants(content);

    return {
        elapsedMs,
        viewportRect: toRectSize(viewport),
        shellRect: toRectSize(shell),
        contentRect: toRectSize(content),
        meaningfulContentCount,
        hasFriendlyScreen: Boolean(friendlyScreen),
        hasLoadingScreen: Boolean(loadingScreen),
        hasBootstrapLoader: Boolean(bootstrapLoader),
    };
};

export const GamePageRescueGate = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { closeAll } = useModalStack();
    const { t } = useTranslation('lobby');
    const [copied, setCopied] = useState(false);
    const [snapshot, setSnapshot] = useState<RescueSnapshot | null>(null);
    const lastHealthyAtRef = useRef<number | null>(null);
    const firstBadAtRef = useRef<number | null>(null);

    useEffect(() => {
        if (!isGameRoutePath(location.pathname)) {
            setSnapshot(null);
            removeInitialLoaderIfPresent();
            return undefined;
        }

        const enteredAt = Date.now();
        lastHealthyAtRef.current = enteredAt;
        firstBadAtRef.current = null;
        const runCheck = () => {
            const baseSnapshot = readRescueSnapshot(location.pathname, enteredAt);
            const now = Date.now();
            const hasMeaningfulContent = baseSnapshot.meaningfulContentCount > 0;
            const hasActiveScreen = baseSnapshot.hasFriendlyScreen
                || baseSnapshot.hasLoadingScreen
                || baseSnapshot.hasBootstrapLoader;
            const isHealthyForGrace = hasActiveScreen || hasMeaningfulContent;

            if (isHealthyForGrace) {
                lastHealthyAtRef.current = now;
                firstBadAtRef.current = null;
            }

            const elapsedSinceHealthy = now - (lastHealthyAtRef.current ?? enteredAt);
            const signal = detectGamePageRescueSignal({
                pathname: location.pathname,
                elapsedMs: elapsedSinceHealthy,
                hasFriendlyScreen: baseSnapshot.hasFriendlyScreen,
                hasLoadingScreen: baseSnapshot.hasLoadingScreen,
                hasBootstrapLoader: baseSnapshot.hasBootstrapLoader,
                viewportRect: baseSnapshot.viewportRect,
                shellRect: baseSnapshot.shellRect,
                contentRect: baseSnapshot.contentRect,
                meaningfulContentCount: baseSnapshot.meaningfulContentCount,
            });

            if (baseSnapshot.hasFriendlyScreen || baseSnapshot.hasLoadingScreen || hasMeaningfulContent) {
                removeInitialLoaderIfPresent();
            }

            let nextSnapshot: RescueSnapshot | null = null;
            if (signal) {
                if (firstBadAtRef.current === null) {
                    firstBadAtRef.current = now;
                }
                const badDuration = now - (firstBadAtRef.current ?? now);
                if (badDuration >= GAME_PAGE_RESCUE_CONFIRM_MS) {
                    nextSnapshot = {
                        ...baseSnapshot,
                        signal,
                        elapsedSinceHealthyMs: elapsedSinceHealthy,
                    };
                }
            } else {
                firstBadAtRef.current = null;
            }

            setSnapshot(nextSnapshot);
        };

        runCheck();
        const intervalId = window.setInterval(runCheck, 1200);
        window.addEventListener('resize', runCheck);
        window.visualViewport?.addEventListener('resize', runCheck);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('resize', runCheck);
            window.visualViewport?.removeEventListener('resize', runCheck);
        };
    }, [location.pathname]);

    const diagnosticText = useMemo(() => {
        if (!snapshot) return '';

        const error = getLastErrorContext();
        const visualViewport = typeof window !== 'undefined' ? window.visualViewport : null;
        const lines = [
            `signal=${snapshot.signal ?? 'none'}`,
            `path=${location.pathname}${location.search}`,
            `elapsedMs=${snapshot.elapsedMs}`,
            `elapsedSinceHealthyMs=${snapshot.elapsedSinceHealthyMs ?? 'unknown'}`,
            `inner=${window.innerWidth}x${window.innerHeight}`,
            `visual=${Math.round(visualViewport?.width ?? window.innerWidth)}x${Math.round(visualViewport?.height ?? window.innerHeight)}`,
            `viewport=${snapshot.viewportRect ? `${snapshot.viewportRect.width}x${snapshot.viewportRect.height}` : 'missing'}`,
            `shell=${snapshot.shellRect ? `${snapshot.shellRect.width}x${snapshot.shellRect.height}` : 'missing'}`,
            `content=${snapshot.contentRect ? `${snapshot.contentRect.width}x${snapshot.contentRect.height}` : 'missing'}`,
            `meaningfulContentCount=${snapshot.meaningfulContentCount}`,
            `userAgent=${navigator.userAgent}`,
        ];

        if (error) {
            lines.push(`errorSource=${error.source ?? 'unknown'}`);
            lines.push(`errorName=${error.name ?? 'Error'}`);
            lines.push(`errorMessage=${error.message}`);
        }

        return lines.join('\n');
    }, [location.pathname, location.search, snapshot]);

    const handleCopyDiagnostics = useCallback(async () => {
        if (!diagnosticText) return;
        const success = await copyToClipboard(diagnosticText);
        if (!success) return;
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
    }, [diagnosticText]);

    const handleBackToLobby = useCallback(() => {
        navigateBackToLobbyWithModalCleanup({
            navigate,
            closeAll,
            gameId: extractGameIdFromPlayPath(location.pathname) ?? undefined,
        });
    }, [closeAll, location.pathname, navigate]);

    if (!snapshot?.signal) {
        return null;
    }

    const lastError = getLastErrorContext();

    return (
        <div
            data-bg-friendly-screen="true"
            data-bg-rescue-gate="true"
            data-testid="game-page-rescue-gate"
            className="fixed inset-0 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(214,173,96,0.16),_transparent_36%),linear-gradient(180deg,_#0d0905_0%,_#130d07_46%,_#060403_100%)]"
            style={{ zIndex: UI_Z_INDEX.modalTooltip + 30 }}
        >
            <div className="absolute inset-0 opacity-45" aria-hidden="true">
                <div className="absolute inset-x-0 top-0 h-44 bg-[linear-gradient(180deg,_rgba(255,214,130,0.12),_transparent)]" />
                <div className="absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-red-500/10 blur-3xl" />
            </div>

            <div className="relative flex h-full min-h-0 items-center justify-center px-5 py-[max(1.5rem,env(safe-area-inset-top))]">
                <section className="w-full max-w-[25rem] rounded-[20px] border border-amber-200/15 bg-[#161008]/94 p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-md">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/20 bg-amber-100/5 text-amber-200">
                        <AlertTriangle size={28} />
                    </div>

                    <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/70">
                        {t('matchRoom.rescue.eyebrow')}
                    </p>
                    <h2 className="mt-2 text-[1.45rem] font-bold leading-tight text-amber-50">
                        {t('matchRoom.rescue.title')}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-amber-100/75">
                        {t('matchRoom.rescue.description')}
                    </p>

                    <div className="mt-5 rounded-2xl border border-amber-200/12 bg-black/20 px-4 py-3 text-left text-xs leading-6 text-amber-100/80">
                        <div className="font-semibold text-amber-50">
                            {t(`matchRoom.rescue.reason.${snapshot.signal}`)}
                        </div>
                        {lastError?.message ? (
                            <div className="mt-2 break-all text-amber-100/65">
                                {lastError.message}
                            </div>
                        ) : null}
                    </div>

                    <div className="mt-5 flex flex-wrap justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-amber-200/20 bg-amber-50/10 px-5 py-2.5 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-50/16"
                        >
                            <RefreshCw size={16} />
                            <span>{t('matchRoom.rescue.reload')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleBackToLobby}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/6 px-5 py-2.5 text-sm font-semibold text-white/82 transition-colors hover:bg-white/10"
                        >
                            <ArrowLeft size={16} />
                            <span>{t('matchRoom.rescue.backToLobby')}</span>
                        </button>
                    </div>

                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={() => void handleCopyDiagnostics()}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-amber-200/12 px-4 py-2 text-xs font-semibold tracking-[0.16em] text-amber-100/78 transition-colors hover:bg-white/6"
                        >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                            <span>{copied ? t('matchRoom.rescue.copied') : t('matchRoom.rescue.copyDiagnostics')}</span>
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default GamePageRescueGate;
