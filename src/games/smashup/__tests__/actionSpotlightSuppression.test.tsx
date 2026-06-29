import React, { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardSpotlightQueue, useCardSpotlightQueue } from '../../../components/game/framework';
import type { EventStreamEntry } from '../../../engine/types';

type PromptLike = { id: string } | null | undefined;

function makeActionPlayedEntry(id: number, playerId: string, defId: string): EventStreamEntry {
    return {
        id,
        event: {
            type: 'su:action_played',
            payload: {
                playerId,
                defId,
            },
            timestamp: id * 100,
        } as any,
    };
}

function SpotlightHarness({
    entries,
    currentPrompt,
    isBlocked = false,
    hasReactionWindow = false,
    currentPlayerId = '0',
}: {
    entries: EventStreamEntry[];
    currentPrompt?: PromptLike;
    isBlocked?: boolean;
    hasReactionWindow?: boolean;
    currentPlayerId?: string;
}) {
    const { queue, dismiss, dismissAll } = useCardSpotlightQueue<{ defId: string }>({
        entries,
        currentPlayerId,
        consumeOnReconcile: true,
        triggerEventTypes: ['su:action_played'],
        extractCard: (event) => {
            const payload = event.payload as { playerId?: string; defId?: string } | undefined;
            if (!payload?.playerId || !payload?.defId) return null;
            return {
                playerId: payload.playerId,
                cardData: { defId: payload.defId },
            };
        },
        maxQueue: 5,
    });

    useEffect(() => {
        if (!currentPrompt) return;
        dismissAll();
    }, [currentPrompt, dismissAll]);

    const shouldRenderCardSpotlightQueue = !currentPrompt && !(isBlocked && !hasReactionWindow);

    return (
        <CardSpotlightQueue
            queue={shouldRenderCardSpotlightQueue ? queue : []}
            onDismiss={dismiss}
            renderCard={(item) => (
                <div
                    data-testid="smashup-action-spotlight-card"
                    data-card-def-id={item.cardData.defId}
                >
                    {item.cardData.defId}
                </div>
            )}
        />
    );
}

describe('SmashUp action spotlight suppression', () => {
    it('owner-only child prompt 接管后应清空旧 spotlight，prompt 结束后也不应回流旧卡面', async () => {
        const eventEntries = [makeActionPlayedEntry(1, '1', 'time_travelers_stasis_field')];
        const { rerender } = render(
            <SpotlightHarness entries={[]} currentPrompt={null} />,
        );

        rerender(<SpotlightHarness entries={eventEntries} currentPrompt={null} />);

        expect(await screen.findByTestId('smashup-action-spotlight-card')).toHaveAttribute(
            'data-card-def-id',
            'time_travelers_stasis_field',
        );

        rerender(<SpotlightHarness entries={eventEntries} currentPrompt={{ id: 'secret-agent-discard' }} />);

        await waitFor(() => {
            expect(screen.queryByTestId('smashup-action-spotlight-card')).toBeNull();
            expect(screen.queryByTestId('card-spotlight-queue')).toBeNull();
        });

        rerender(<SpotlightHarness entries={eventEntries} currentPrompt={null} />);

        await waitFor(() => {
            expect(screen.queryByTestId('smashup-action-spotlight-card')).toBeNull();
            expect(screen.queryByTestId('card-spotlight-queue')).toBeNull();
        });
    });

    it('普通 blocked interaction 且无 reaction window 时，应抑制 spotlight 显示', async () => {
        const eventEntries = [makeActionPlayedEntry(2, '1', 'super_spies_hidden_base')];
        const { rerender } = render(
            <SpotlightHarness entries={[]} currentPrompt={null} />,
        );

        rerender(
            <SpotlightHarness
                entries={eventEntries}
                currentPrompt={null}
                isBlocked
                hasReactionWindow={false}
            />,
        );

        await waitFor(() => {
            expect(screen.queryByTestId('smashup-action-spotlight-card')).toBeNull();
            expect(screen.queryByTestId('card-spotlight-queue')).toBeNull();
        });
    });

    it('response window 存在时，即使 interaction 标记 blocked，也不应误抑制 spotlight', async () => {
        const eventEntries = [makeActionPlayedEntry(3, '1', 'super_spies_secret_agent')];
        const { rerender } = render(
            <SpotlightHarness entries={[]} currentPrompt={null} />,
        );

        rerender(
            <SpotlightHarness
                entries={eventEntries}
                currentPrompt={null}
                isBlocked
                hasReactionWindow
            />,
        );

        expect(await screen.findByTestId('smashup-action-spotlight-card')).toHaveAttribute(
            'data-card-def-id',
            'super_spies_secret_agent',
        );
    });

    it('spotlight 队列应允许空白背景接管点击，以便关闭当前特写', async () => {
        const eventEntries = [makeActionPlayedEntry(4, '1', 'princesses_heirloom')];
        const { rerender } = render(
            <SpotlightHarness entries={[]} currentPrompt={null} />,
        );

        rerender(
            <SpotlightHarness
                entries={eventEntries}
                currentPrompt={null}
            />,
        );

        const queue = await screen.findByTestId('card-spotlight-queue');
        const content = await screen.findByTestId('card-spotlight-content');
        const backdrop = await screen.findByRole('button', { name: 'cardSpotlightQueue.closeSpotlight' });

        expect(queue.className).toContain('pointer-events-none');
        expect(content.className).toContain('pointer-events-auto');
        expect(backdrop.className).toContain('pointer-events-auto');
    });
});
