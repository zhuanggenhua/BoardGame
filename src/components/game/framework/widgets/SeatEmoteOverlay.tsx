import { useEffect, useMemo, useState } from 'react';
import { UI_Z_INDEX } from '../../../../core';
import { OptimizedImage } from '../../../common/media/OptimizedImage';
import type { EmoteDefinition } from '../../../../shared/emotes';
import type { MatchEmoteEvent } from '../../../../services/matchSocket';

interface SeatEmoteOverlayProps {
    events: MatchEmoteEvent[];
    resolveEmote: (emoteId: string) => EmoteDefinition | undefined;
}

const EMOTE_LIFETIME_MS = 3000;
const EMOTE_SIZE_PX = 112;

type SeatEmotePosition = {
    x: number;
    y: number;
    placement: 'above' | 'below';
};

const escapeSeatAnchorValue = (value: string): string => {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(value);
    }
    return value.replace(/["\\]/g, '\\$&');
};

const clamp = (value: number, min: number, max: number): number => (
    Math.min(Math.max(value, min), max)
);

const resolveSeatAnchorPosition = (playerId: string): SeatEmotePosition => {
    if (typeof document === 'undefined') {
        return { x: 0, y: 0, placement: 'above' };
    }

    const selector = `[data-player-seat-anchor="${escapeSeatAnchorValue(playerId)}"]`;
    const anchor = document.querySelector<HTMLElement>(selector);
    if (anchor) {
        const rect = anchor.getBoundingClientRect();
        const viewportWidth = window.innerWidth || 1024;
        const viewportHeight = window.innerHeight || 768;
        const x = clamp(rect.left + rect.width / 2, EMOTE_SIZE_PX / 2 + 8, viewportWidth - EMOTE_SIZE_PX / 2 - 8);
        const shouldPlaceBelow = rect.top < EMOTE_SIZE_PX + 24;
        const rawY = shouldPlaceBelow ? rect.bottom + 8 : rect.top + rect.height * 0.18;
        return {
            x,
            y: clamp(rawY, 8, viewportHeight - EMOTE_SIZE_PX - 8),
            placement: shouldPlaceBelow ? 'below' : 'above',
        };
    }

    return {
        x: window.innerWidth - 144,
        y: window.innerHeight - 180,
        placement: 'above',
    };
};

export const SeatEmoteOverlay = ({ events, resolveEmote }: SeatEmoteOverlayProps) => {
    const [now, setNow] = useState(() => Date.now());
    const latestEventKey = events.length > 0
        ? `${events[events.length - 1].playerId}:${events[events.length - 1].createdAt}`
        : null;

    useEffect(() => {
        if (!latestEventKey) return;
        const frame = window.requestAnimationFrame(() => setNow(Date.now()));
        return () => window.cancelAnimationFrame(frame);
    }, [latestEventKey]);

    useEffect(() => {
        if (events.length === 0) return;
        const referenceNow = Date.now();

        const nextExpiry = events.reduce<number | null>((candidate, event) => {
            const expiresAt = Date.parse(event.createdAt) + EMOTE_LIFETIME_MS;
            if (expiresAt <= referenceNow) return candidate;
            return candidate == null ? expiresAt : Math.min(candidate, expiresAt);
        }, null);

        if (nextExpiry == null) return;
        const delay = Math.max(0, nextExpiry - referenceNow);
        const timer = window.setTimeout(() => setNow(Date.now()), delay + 16);

        return () => window.clearTimeout(timer);
    }, [events, now]);

    const visibleEmotes = useMemo(() => {
        const byPlayer = new Map<string, MatchEmoteEvent>();
        for (const event of events) {
            const eventTime = Date.parse(event.createdAt);
            if (!Number.isFinite(eventTime) || now - eventTime > EMOTE_LIFETIME_MS) continue;
            const prev = byPlayer.get(event.playerId);
            if (!prev || event.createdAt.localeCompare(prev.createdAt) >= 0) {
                byPlayer.set(event.playerId, event);
            }
        }
        return Array.from(byPlayer.values());
    }, [events, now]);

    if (visibleEmotes.length === 0) return null;

    return (
        <div
            className="pointer-events-none fixed inset-0"
            style={{ zIndex: UI_Z_INDEX.emergencyHud + 1 }}
            data-testid="seat-emote-overlay"
        >
            {visibleEmotes.map((event) => {
                const emote = resolveEmote(event.emoteId);
                if (!emote) return null;
                const position = resolveSeatAnchorPosition(event.playerId);
                const key = `${event.playerId}:${event.createdAt}`;

                return (
                    <div
                        key={key}
                        className="absolute"
                        style={{
                            left: position.x,
                            top: position.y,
                            transform: position.placement === 'below'
                                ? 'translate(-50%, 0)'
                                : 'translate(-50%, -92%)',
                        }}
                        data-testid={`seat-emote-${event.playerId}`}
                    >
                        <div className="seat-emote-pop relative h-24 w-24 sm:h-28 sm:w-28">
                            <OptimizedImage
                                src={emote.assetPath}
                                alt={emote.label}
                                placeholder={false}
                                draggable={false}
                                className="relative h-full w-full object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,0.55)]"
                            />
                            <div className="absolute bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-white/40 bg-white/70 shadow-sm" />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
