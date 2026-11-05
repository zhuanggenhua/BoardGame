import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { HudPortal, UI_Z_INDEX } from '../../core';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { useVisualEventStream } from '../../components/game/framework/hooks/useVisualEventStream';
import type { EventStreamEntry } from '../../engine/types';
import type { BetrayalEvent } from './events';
import type { BetrayalCore, BetrayalExplorerSummary, BetrayalRoomNode } from './game';
import { buildRoomAtlasImageStyle, resolveBetrayalRoomNodeTileVisual } from './roomAtlas';
import { EXPLORER_TOKEN_SILHOUETTE } from './roomEntitySceneModel';

export interface RoomDiscoverySceneEntry {
    id: string;
    room: BetrayalRoomNode;
    explorer: BetrayalExplorerSummary;
}

/** Presentation-only queue. Completion never sends a rule command or changes discovery outcomes. */
export function useRoomDiscoveryScene({ core, entries, rollbackRevision, viewerPlayerId, enabled = true }: {
    core: BetrayalCore;
    entries: EventStreamEntry[];
    rollbackRevision: number;
    viewerPlayerId: string;
    enabled?: boolean;
}) {
    const [queue, setQueue] = React.useState<readonly RoomDiscoverySceneEntry[]>([]);
    const previous = React.useRef({ rollbackRevision, viewerPlayerId });
    const { consumeNew } = useVisualEventStream({ entries, strategy: 'requiredSequence', consumeInitialEntries: false, consumeOnReconcile: true });
    React.useLayoutEffect(() => {
        const before = previous.current;
        previous.current = { rollbackRevision, viewerPlayerId };
        const delta = consumeNew();
        if (!enabled || delta.didReset || delta.didOptimisticRollback || before.rollbackRevision !== rollbackRevision || before.viewerPlayerId !== viewerPlayerId) {
            setQueue(current => current.length ? [] : current);
            return;
        }
        const additions: RoomDiscoverySceneEntry[] = [];
        for (const entry of delta.entries) {
            const event = entry.event as BetrayalEvent;
            if (event.type !== 'ROOM_EXPLORED' || event.payload.playerId !== viewerPlayerId) continue;
            const room = core.rooms.find(item => item.id === event.payload.roomId && item.state === 'discovered');
            const explorer = [core.currentExplorer, ...core.otherExplorers].find(item => item.playerId === event.payload.playerId);
            if (room && explorer) additions.push({ id: `${rollbackRevision}:${entry.id}`, room: { ...room }, explorer: { ...explorer } });
        }
        if (additions.length) setQueue(current => {
            const known = new Set(current.map(item => item.id));
            return [...current, ...additions.filter(item => !known.has(item.id))];
        });
    }, [consumeNew, core, enabled, entries, rollbackRevision, viewerPlayerId]);
    const complete = React.useCallback((id: string) => {
        setQueue(current => current[0]?.id === id ? current.slice(1) : current);
    }, []);
    return { scene: queue[0] ?? null, complete };
}

/** Full-stage reveal using our formal room and token art, not the reference game's illustrations. */
export function RoomDiscoverySceneSurface({ scene, locale, discoveryLabel, skipLabel, onComplete }: {
    scene: RoomDiscoverySceneEntry;
    locale: string;
    discoveryLabel: string;
    skipLabel: string;
    onComplete: (id: string) => void;
}) {
    const reduced = useReducedMotion();
    const [loaded, setLoaded] = React.useState({ room: false, actor: false });
    const [skipping, setSkipping] = React.useState(false);
    const completed = React.useRef(false);
    const button = React.useRef<HTMLButtonElement>(null);
    const visual = React.useMemo(() => resolveBetrayalRoomNodeTileVisual(scene.room, true), [scene.room]);
    const atlasStyle = React.useMemo(() => buildRoomAtlasImageStyle(visual), [visual]);
    const ready = loaded.room && (loaded.actor || !scene.explorer.tokenAsset);
    const phase = skipping ? 'skip' : ready ? 'play' : 'waiting';
    const settle = React.useCallback(() => {
        if (completed.current) return;
        completed.current = true;
        onComplete(scene.id);
    }, [onComplete, scene.id]);
    const finishAsset = (key: 'room' | 'actor') => setLoaded(current => current[key] ? current : { ...current, [key]: true });
    React.useLayoutEffect(() => {
        const previousFocus = document.activeElement;
        button.current?.focus({ preventScroll: true });
        return () => { if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true }); };
    }, []);
    const duration = reduced ? 0.55 : 3;
    return <HudPortal>
        <motion.button ref={button} type="button" aria-label={`${scene.room.name} · ${skipLabel}`}
            data-testid="betrayal-room-discovery-scene" data-scene-id={scene.id} data-presentation-stage={phase}
            className="fixed inset-0 isolate overflow-hidden border-0 bg-[#050c09] p-0 text-[#f1e8d4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c5a56c]"
            style={{ zIndex: UI_Z_INDEX.modalFullscreenGate }}
            onClick={() => setSkipping(true)} onKeyDown={event => {
                event.stopPropagation();
                if (event.key === 'Tab') event.preventDefault();
                if (event.key === 'Escape') { event.preventDefault(); setSkipping(true); }
            }}
            initial="waiting" animate={phase}
            variants={{ waiting: { opacity: 1 }, play: { opacity: [0, 1, 1, 0], transition: { duration, times: [0, .12, .92, 1] } }, skip: { opacity: 0, transition: { duration: .2 } } }}
            onAnimationComplete={stage => { if (stage === 'skip' || (stage === 'play' && !skipping)) settle(); }}>
            <motion.span aria-hidden="true" className="pointer-events-none absolute inset-[-3%] overflow-hidden"
                variants={{ waiting: { scale: reduced ? 1 : 1.12, x: reduced ? '0%' : '2%', filter: 'brightness(.25)' }, play: { scale: reduced ? 1 : 1.02, x: '0%', filter: 'brightness(.65)', transition: { duration: reduced ? .1 : duration, ease: 'easeOut', filter: { duration: reduced ? .1 : .8, ease: 'easeOut' } } }, skip: { opacity: 0, transition: { duration: .12 } } }}>
                <span className="absolute left-1/2 top-1/2 block aspect-square w-[max(110vw,110vh)] -translate-x-1/2 -translate-y-1/2 overflow-hidden blur-[3px]">
                    <OptimizedImage src={visual.image} locale={locale} alt="" draggable={false} placeholder={false}
                        data-testid="betrayal-room-scene-art" className="absolute left-0 top-0 max-w-none" style={atlasStyle}
                        onLoad={() => finishAsset('room')} onError={() => finishAsset('room')} />
                </span>
            </motion.span>
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_45%_60%,transparent_35%,rgba(0,0,0,.8)_100%)]" />
            {scene.explorer.tokenAsset ? <motion.span aria-hidden="true" className="pointer-events-none absolute bottom-[16%] left-[15%] block w-[clamp(140px,24vw,380px)]"
                variants={{ waiting: { opacity: 0, x: reduced ? '0%' : '-70%' }, play: { opacity: 1, x: '0%', transition: { duration: reduced ? .1 : 1.4, ease: [.2, .7, .3, 1] } }, skip: { opacity: 0, transition: { duration: .12 } } }}>
                <OptimizedImage src={scene.explorer.tokenAsset} locale={locale} alt="" draggable={false} placeholder={false}
                    data-testid="betrayal-room-scene-actor" className="block w-full object-contain"
                    style={{ clipPath: `polygon(${EXPLORER_TOKEN_SILHOUETTE.map(point => `${point.x * 100}% ${point.y * 100}%`).join(',')})` }}
                    onLoad={() => finishAsset('actor')} onError={() => finishAsset('actor')} />
            </motion.span> : null}
            <motion.span className="pointer-events-none absolute bottom-[17%] right-[7%] max-w-[58%] text-right"
                variants={{ waiting: { opacity: 0, filter: reduced ? 'none' : 'blur(3px)' }, play: { opacity: 1, filter: 'blur(0px)', transition: { duration: reduced ? .1 : 1.1, delay: reduced ? 0 : .5 } }, skip: { opacity: 0, transition: { duration: .12 } } }}>
                <span className="block font-serif text-[clamp(28px,4vw,60px)] font-bold tracking-[.18em]" style={{ textShadow: '0 3px 8px #000,0 0 24px #000' }}>{scene.room.name}</span>
                <span className="mt-2 block text-[14px] tracking-[.14em] text-[#c5a56c]">{discoveryLabel} · {scene.explorer.displayName}</span>
            </motion.span>
            {['top', 'bottom'].map(edge => <motion.span key={edge} aria-hidden="true" className="pointer-events-none absolute inset-x-0 h-[9%] bg-black"
                style={{ top: edge === 'top' ? 0 : undefined, bottom: edge === 'bottom' ? 0 : undefined }}
                variants={{ waiting: { y: reduced ? '0%' : edge === 'top' ? '-100%' : '100%' }, play: { y: '0%', transition: { duration: reduced ? .1 : .5 } }, skip: { opacity: 0, transition: { duration: .12 } } }} />)}
            <span className="pointer-events-none absolute bottom-[2.5%] inset-x-0 z-10 text-center text-[12px] tracking-widest text-[#c9bb9d]">{skipLabel}</span>
        </motion.button>
    </HudPortal>;
}
