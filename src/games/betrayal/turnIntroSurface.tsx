import React from 'react';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { motion, useReducedMotion } from 'framer-motion';
import { HudPortal, UI_Z_INDEX } from '../../core';
import { AudioManager } from '../../lib/audio/AudioManager';
import { COMMON_AUDIO_BASE_PATH, loadCommonAudioRegistry } from '../../lib/audio/commonRegistry';
import { BETRAYAL_TURN_BELL_KEY } from './audio.config';
import { useVisualEventStream } from '../../components/game/framework/hooks/useVisualEventStream';
import type { EventStreamEntry } from '../../engine/types';

/** A transient turn announcement: skip the mounted baseline, announce newly acquired turns only. */
export function useBetrayalTurnIntro({ phase, currentPlayer, viewerPlayerId, entries, rollbackRevision, canAnnounceTurn = true }: {
    phase: string;
    currentPlayer: string;
    viewerPlayerId: string;
    entries: EventStreamEntry[];
    rollbackRevision: number;
    canAnnounceTurn?: boolean;
}) {
    const isOwnTurn = canAnnounceTurn && (phase === 'preHaunt' || phase === 'haunt') && currentPlayer === viewerPlayerId;
    const previousRef = React.useRef({ isOwnTurn, rollbackRevision });
    const [pendingKey, setPendingKey] = React.useState<string | null>(null);
    const { consumeNew } = useVisualEventStream({ entries, strategy: 'transientNotification', consumeInitialEntries: false, consumeOnReconcile: true });
    React.useEffect(() => {
        const previous = previousRef.current;
        previousRef.current = { isOwnTurn, rollbackRevision };
        const delta = consumeNew();
        if (previous.rollbackRevision !== rollbackRevision || delta.didReset || delta.didOptimisticRollback || !isOwnTurn) {
            setPendingKey(null);
            return;
        }
        const newTurn = delta.entries.filter(entry => entry.event.type === 'TURN_ENDED').at(-1);
        if (!previous.isOwnTurn || newTurn) setPendingKey(`${currentPlayer}:${newTurn?.id ?? 'start'}`);
    }, [consumeNew, currentPlayer, isOwnTurn, rollbackRevision]);
    const dismissTurnIntro = React.useCallback(() => setPendingKey(null), []);
    return { turnIntroKey: isOwnTurn ? pendingKey : null, dismissTurnIntro };
}

export function BetrayalTurnIntroSurface({ title, skipLabel, onComplete, portraitAsset, actorLabel, subtitle, locale = 'zh-CN' }: {
    title: string;
    skipLabel: string;
    portraitAsset?: string;
    actorLabel?: string;
    subtitle?: string;
    locale?: string;
    onComplete: () => void;
}) {
    const reduceMotion = useReducedMotion();
    const [skipping, setSkipping] = React.useState(false);
    const completed = React.useRef(false);
    const finish = React.useCallback(() => {
        if (completed.current) return;
        completed.current = true;
        onComplete();
    }, [onComplete]);
    React.useEffect(() => {
        if (skipping) return;
        let cancelled = false;
        let secondBell: ReturnType<typeof setTimeout> | undefined;
        const playIfReady = () => {
            if (!cancelled && AudioManager.getSfxLoadState(BETRAYAL_TURN_BELL_KEY) === 'loaded') AudioManager.play(BETRAYAL_TURN_BELL_KEY);
        };
        void loadCommonAudioRegistry().then(async registry => {
            if (cancelled) return;
            AudioManager.registerRegistryEntries(registry.entries, COMMON_AUDIO_BASE_PATH);
            await AudioManager.preloadBlockingKeys([BETRAYAL_TURN_BELL_KEY]);
            if (cancelled) return;
            playIfReady();
            if (!reduceMotion) secondBell = setTimeout(playIfReady, 1500);
        }).catch(() => {
            // Audio failure never retains the announcement.
        });
        return () => {
            cancelled = true;
            clearTimeout(secondBell);
            AudioManager.stopSfx(BETRAYAL_TURN_BELL_KEY);
        };
    }, [reduceMotion, skipping]);
    const skip = () => {
        AudioManager.stopSfx(BETRAYAL_TURN_BELL_KEY);
        setSkipping(true);
    };
    const stage = skipping ? 'skip' : 'play';
    const duration = reduceMotion ? 0.55 : 2.7;

    return <HudPortal>
        <motion.button
            type="button"
            data-testid="betrayal-turn-intro-skip"
            data-presentation-stage={stage}
            aria-label={skipLabel}
            className="fixed inset-0 isolate flex cursor-pointer items-center justify-center overflow-hidden border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c5a56c]"
            style={{ zIndex: UI_Z_INDEX.modalFullscreenGate }}
            onClick={skip}
            initial="hidden"
            animate={stage}
            variants={{
                hidden: { opacity: 0 },
                play: { opacity: [0, 1, 1, 0], transition: { duration, times: [0, 0.12, 0.82, 1] } },
                skip: { opacity: 0, transition: { duration: 0.2 } },
            }}
            onAnimationComplete={definition => {
                if (definition === 'skip' || (definition === 'play' && !skipping)) finish();
            }}
        >
            <motion.span
                data-testid="betrayal-turn-intro-banner"
                aria-hidden="true"
                className="pointer-events-none relative flex w-full flex-col items-center justify-center px-6 py-5"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(3,9,7,.94) 18%, rgba(3,9,7,.94) 82%, transparent)' }}
                variants={{
                    hidden: { scaleY: reduceMotion ? 1 : 0.2, opacity: 0 },
                    play: { scaleY: 1, opacity: 1, transition: { duration: reduceMotion ? 0.1 : 0.5, ease: [0.2, 0.8, 0.3, 1] } },
                    skip: { opacity: 0, transition: { duration: 0.12 } },
                }}
            >
                <span className="mb-3 h-px w-[60%] bg-[linear-gradient(90deg,transparent,rgba(197,165,108,.7),transparent)]" />
                {portraitAsset ? <span className="mb-3 block h-[72px] w-[72px] overflow-hidden rounded-full border-2 border-[#c5a56c] bg-[#13251c] shadow-[0_0_18px_rgba(197,165,108,.25)]">
                    <OptimizedImage src={portraitAsset} locale={locale} alt="" className="h-full w-full object-cover" />
                </span> : null}
                <motion.span
                    data-testid="betrayal-turn-intro-title"
                    className="block text-center font-serif font-bold leading-tight text-[#e6cf9c]"
                    style={{ fontSize: 'clamp(32px, 3vw, 48px)', textShadow: '0 0 20px rgba(230,207,156,.25)' }}
                    variants={{
                        hidden: { opacity: 0, letterSpacing: reduceMotion ? '.24em' : '.6em', filter: reduceMotion ? 'none' : 'blur(6px)' },
                        play: { opacity: 1, letterSpacing: '.24em', filter: 'blur(0px)', transition: { duration: reduceMotion ? 0.1 : 0.8, ease: 'easeOut' } },
                        skip: { opacity: 0, letterSpacing: '.24em', filter: 'blur(0px)', transition: { duration: 0.12 } },
                    }}
                >{title}</motion.span>
                {actorLabel || subtitle ? <span className="mt-3 text-center text-[14px] tracking-[.14em] text-[#c5a56c]">
                    {[actorLabel, subtitle].filter(Boolean).join(' · ')}
                </span> : null}
                <span className="mt-4 h-px w-[60%] bg-[linear-gradient(90deg,transparent,rgba(197,165,108,.7),transparent)]" />
            </motion.span>
            <span className="sr-only">{title}</span>
        </motion.button>
    </HudPortal>;
}
