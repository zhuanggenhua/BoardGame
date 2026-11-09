import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { getLocalStorage } from '../../lib/browserStorage';
import { completePendingRematch, readPendingRematch, REMATCH_RECOVERY_NEEDED_EVENT } from '../../hooks/match/pendingRematchRecovery';
import { recoverRematch, getMatch } from '../../services/matchApi';
import { LoadingScreen } from './LoadingScreen';

/** Must wrap AppContent: a sibling effect runs too late to stop missing-room cleanup. */
export function RematchRecoveryGate({ children }: { children: ReactNode }) {
    const auth = useAuth();
    const authRef = useRef(auth); authRef.current = auth;
    const [pending, setPending] = useState(readPendingRematch);
    const [status, setStatus] = useState<'loading' | 'done' | 'failed' | 'redirecting'>(pending ? 'loading' : 'done');
    const [attempt, setAttempt] = useState(0);
    const { t } = useTranslation('common');
    useEffect(() => {
        const recover = () => {
            const current = readPendingRematch();
            setPending(current); setStatus(current ? 'loading' : 'done'); setAttempt(value => value + 1);
        };
        window.addEventListener(REMATCH_RECOVERY_NEEDED_EVENT, recover);
        return () => window.removeEventListener(REMATCH_RECOVERY_NEEDED_EVENT, recover);
    }, []);
    useEffect(() => {
        if (!pending || auth.isLoading) return;
        if ((auth.user?.id ?? null) !== pending.authUserID) { setStatus('failed'); return; }
        let active = true;
        const controller = new AbortController();
        const userID = auth.user?.id;
        const authToken = auth.token;
        let rawAuth: string | null;
        try {
            const storage = getLocalStorage();
            if (!storage) { setStatus('failed'); return; }
            rawAuth = storage.getItem('auth_token');
        } catch { setStatus('failed'); return; }
        const sameAuth = () => {
            try {
                const storage = getLocalStorage();
                return active && !controller.signal.aborted && Boolean(storage)
                    && authRef.current.user?.id === userID && authRef.current.token === authToken
                    && storage!.getItem('auth_token') === rawAuth;
            } catch { return false; }
        };
        setStatus('loading');
        const timer = window.setTimeout(() => { controller.abort(); if (active) setStatus('failed'); }, 8000);
        void (async () => {
            try {
                const result = await recoverRematch(pending.gameName, pending.sourceMatchID, pending, authToken ?? undefined, controller.signal);
                if (!sameAuth()) return;
                const saved = await completePendingRematch(pending, result, sameAuth);
                if (!active || controller.signal.aborted) return;
                if (!saved) { setStatus('failed'); return; }
                if (window.location.pathname === `/play/${pending.gameName}/match/${pending.sourceMatchID}`) {
                    setStatus('redirecting');
                    window.location.replace(`/play/${pending.gameName}/match/${pending.nextMatchID}?playerID=0`);
                } else setStatus('done');
            } catch (error) {
                // A saved request may never have left the closed tab. Only a
                // separate source read can establish that the old room still exists.
                if ((error as { status?: number })?.status === 404 && sameAuth()) {
                    try {
                        await getMatch(pending.gameName, pending.sourceMatchID, { signal: controller.signal, expectedStatuses: [404] });
                        if (sameAuth()) { setStatus('done'); return; }
                    } catch { /* Keep pending: a 404 cannot prove the create did not commit. */ }
                }
                if (active && !controller.signal.aborted) setStatus('failed');
            } finally {
                window.clearTimeout(timer);
                // Auth changed without a React render (e.g. a cross-tab logout).
                if (active && !controller.signal.aborted && !sameAuth()) setStatus('failed');
            }
        })();
        return () => { active = false; controller.abort(); window.clearTimeout(timer); };
    }, [pending, auth.isLoading, auth.token, auth.user?.id, attempt]);
    if (status === 'loading' || status === 'redirecting') return <LoadingScreen description={t('rematch.recovering')} />;
    if (status === 'failed' && pending && window.location.pathname === `/play/${pending.gameName}/match/${pending.sourceMatchID}`) {
        return <div role="alert" className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950 p-8 text-center text-white">
            <p>{t('rematch.recoveryPending')}</p>
            <button type="button" className="rounded bg-indigo-600 px-6 py-2" onClick={() => setAttempt(value => value + 1)}>{t('rematch.retryRecovery')}</button>
            <a className="underline" href="/">{t('rematch.returnLobby')}</a>
        </div>;
    }
    return children;
}
