/* @vitest-environment happy-dom */
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SeatEmoteOverlay } from '../SeatEmoteOverlay';
import type { MatchEmoteEvent } from '../../../../../services/matchSocket';
import type { EmoteDefinition } from '../../../../../shared/emotes';

vi.mock('../../../../common/media/OptimizedImage', () => ({
    OptimizedImage: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
        <img src={src} alt={alt} className={className} />
    ),
}));

const createEvent = (createdAt: string, playerId = 'p0'): MatchEmoteEvent => ({
    matchId: 'm1',
    playerId,
    emoteId: 'dicethrone.moon-elf.speechless-facepalm',
    createdAt,
});

const testEmote: EmoteDefinition = {
    id: 'dicethrone.moon-elf.speechless-facepalm',
    scope: 'common',
    emotion: 'speechless',
    label: '无语',
    assetPath: 'dicethrone/emotes/moon-elf/speechless-facepalm-chibi-v1',
    enabled: true,
};

const resolveEmote = (emoteId: string) => (
    emoteId === testEmote.id ? testEmote : undefined
);

describe('SeatEmoteOverlay', () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-22T12:00:01.000Z'));
        HTMLElement.prototype.getBoundingClientRect = vi.fn(() => ({
            x: 100,
            y: 200,
            left: 100,
            top: 200,
            right: 180,
            bottom: 260,
            width: 80,
            height: 60,
            toJSON: () => ({}),
        }));
    });

    afterEach(() => {
        HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
        vi.useRealTimers();
    });

    it('renders the latest emote per player at the seat anchor', () => {
        const anchor = document.createElement('div');
        anchor.setAttribute('data-player-seat-anchor', 'p0');
        document.body.appendChild(anchor);

        render(
            <SeatEmoteOverlay
                events={[
                    createEvent('2026-05-22T12:00:00.000Z'),
                    createEvent('2026-05-22T12:00:01.000Z'),
                ]}
                resolveEmote={resolveEmote}
            />,
        );

        expect(screen.getByTestId('seat-emote-overlay')).toBeInTheDocument();
        expect(screen.getAllByAltText('无语')).toHaveLength(1);
        expect(screen.getByTestId('seat-emote-p0')).toHaveStyle({
            left: '140px',
            top: '210.8px',
        });
    });

    it('places top-edge seat emotes below the anchor to keep them visible', () => {
        HTMLElement.prototype.getBoundingClientRect = vi.fn(() => ({
            x: 500,
            y: 12,
            left: 500,
            top: 12,
            right: 620,
            bottom: 72,
            width: 120,
            height: 60,
            toJSON: () => ({}),
        }));
        const anchor = document.createElement('div');
        anchor.setAttribute('data-player-seat-anchor', 'p1');
        document.body.appendChild(anchor);

        render(
            <SeatEmoteOverlay
                events={[createEvent('2026-05-22T12:00:01.000Z', 'p1')]}
                resolveEmote={resolveEmote}
            />,
        );

        expect(screen.getByTestId('seat-emote-p1')).toHaveStyle({
            left: '560px',
            top: '80px',
            transform: 'translate(-50%, 0)',
        });
    });
});
