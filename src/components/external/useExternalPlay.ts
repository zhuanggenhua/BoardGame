import { useEffect, useState } from 'react';
import { startExternalSession, updateExternalSession } from '../../api/external-games';

/** 页面的前台时间是估算，服务端负责截断离线窗口和合并重叠会话。 */
export function useExternalPlay(gameId: string, token: string | null, enabled: boolean) {
    const [seconds, setSeconds] = useState(0);
    const [syncError, setSyncError] = useState(false);
    useEffect(() => {
        if (!enabled) { setSeconds(0); return; }
        let alive = true;
        let last = performance.now();
        let visible = document.visibilityState === 'visible';
        let elapsed = 0;
        let lastSentElapsed = 0;
        let sequence = 0;
        let sessionId: string | undefined;
        let sessionStartClock: number | undefined;
        let starting = false;
        let flushing = false;
        const pending: Array<{ sequence: number; active: boolean; elapsedMs: number; offsetMs: number; ended?: boolean }> = [];
        const accumulate = () => {
            const now = performance.now();
            if (visible) elapsed += Math.max(0, now - last);
            last = now;
            if (alive) setSeconds(Math.floor(elapsed / 1000));
        };
        const flush = async () => {
            if (!token || !sessionId || flushing) return;
            flushing = true;
            while (pending.length) {
                try {
                    const result = await updateExternalSession(token, sessionId, pending[0]);
                    if (!result.accepted) throw new Error('时长状态发生变化');
                    pending.shift();
                    if (alive) setSyncError(false);
                } catch { if (alive) setSyncError(true); break; }
            }
            flushing = false;
            if (!alive && !pending.length) window.removeEventListener('online', retry);
        };
        const retry = () => { void flush(); };
        const send = (active: boolean, ended = false) => {
            if (!token || (!sessionId && !starting) || sessionStartClock == null) return;
            const elapsedMs = Math.min(20_000, Math.max(0, Math.floor(elapsed - lastSentElapsed)));
            lastSentElapsed = elapsed;
            pending.push({ sequence: ++sequence, active, elapsedMs, offsetMs: Math.max(0, Math.floor(performance.now() - sessionStartClock)), ended });
            void flush();
        };
        const start = () => {
            if (!token || sessionId || starting || !visible) return;
            starting = true;
            sessionStartClock = performance.now();
            lastSentElapsed = elapsed;
            void startExternalSession(token, gameId).then(result => {
                sessionId = result.sessionId;
                starting = false;
                void flush();
            }).catch(() => {
                starting = false; sessionStartClock = undefined; pending.length = 0;
                if (alive) setSyncError(true); else window.removeEventListener('online', retry);
            });
        };
        const visibility = () => {
            accumulate();
            visible = document.visibilityState === 'visible';
            last = performance.now();
            if (visible) start();
            send(visible);
        };
        start();
        window.addEventListener('online', retry);
        document.addEventListener('visibilitychange', visibility);
        const timer = window.setInterval(() => {
            accumulate();
            if (visible) { start(); send(true); }
        }, 10_000);
        const display = window.setInterval(accumulate, 1000);
        return () => {
            accumulate();
            alive = false;
            document.removeEventListener('visibilitychange', visibility);
            clearInterval(timer); clearInterval(display);
            send(false, true);
            if (!pending.length && !starting) window.removeEventListener('online', retry);
        };
    }, [gameId, token, enabled]);
    return { seconds, syncError };
}
