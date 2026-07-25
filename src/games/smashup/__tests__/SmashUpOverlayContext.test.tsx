import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { SmashUpOverlayProvider, useSmashUpOverlay } from '../ui/SmashUpOverlayContext';

vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: null, token: null }),
}));

function FactionSyncProbe({ onRender }: { onRender: (factionCount: number) => void }) {
    const { selectedFactions, setSelectedFactions } = useSmashUpOverlay();

    useEffect(() => {
        onRender(selectedFactions.size);
    });

    return (
        <div>
            <div data-testid="faction-count">{selectedFactions.size}</div>
            <button type="button" onClick={() => setSelectedFactions(['star_roamers', 'elder_things_pod'])}>
                同步派系
            </button>
        </div>
    );
}

describe('SmashUpOverlayProvider', () => {
    it('重复同步相同派系列表时不再刷新消费者', () => {
        const onRender = vi.fn();

        render(
            <SmashUpOverlayProvider>
                <FactionSyncProbe onRender={onRender} />
            </SmashUpOverlayProvider>,
        );

        fireEvent.click(screen.getByRole('button', { name: '同步派系' }));
        expect(screen.getByTestId('faction-count')).toHaveTextContent('2');
        const callsAfterFirstSync = onRender.mock.calls.length;

        fireEvent.click(screen.getByRole('button', { name: '同步派系' }));

        expect(onRender).toHaveBeenCalledTimes(callsAfterFirstSync);
    });
});
