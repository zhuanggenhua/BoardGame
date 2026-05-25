import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventStreamRollbackContext, type EventStreamRollbackValue } from '../../../engine/hooks/EventStreamRollbackContext';
import { CARDIA_EVENTS } from '../domain/events';
import { useCardiaEventAnimations } from '../hooks/useCardiaEventAnimations';

describe('useCardiaEventAnimations rollback consumer', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('optimistic rollback 后恢复旧事件时不应重播能力闪光', async () => {
        let now = 1000;
        vi.spyOn(Date, 'now').mockImplementation(() => now);

        const animations = {
            triggerAbilityFlash: vi.fn(),
            addModifierToken: vi.fn(),
            addOngoingMarker: vi.fn(),
            addSignetMove: vi.fn(),
        };
        const toast = { warning: vi.fn() };
        const cardRefs = { current: new Map<string, HTMLElement>() };

        let rollbackValue: EventStreamRollbackValue = { watermark: null, seq: 0, reconcileSeq: 0 };

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            React.createElement(EventStreamRollbackContext.Provider, { value: rollbackValue }, children)
        );

        const bootstrapEntry = {
            id: 1,
            event: { type: 'BOOTSTRAP', payload: {}, timestamp: 500 },
        } as any;
        const oldEntry = {
            id: 2,
            event: { type: CARDIA_EVENTS.ABILITY_ACTIVATED.type, payload: {}, timestamp: 1000 },
        } as any;
        const newEntry = {
            id: 3,
            event: { type: CARDIA_EVENTS.ABILITY_ACTIVATED.type, payload: {}, timestamp: 2000 },
        } as any;

        const { rerender } = renderHook(
            ({ entries }: { entries: any[] }) => useCardiaEventAnimations({
                eventStreamEntries: entries,
                animations,
                toast,
                t: (key: string, fallback?: string) => fallback ?? key,
                cardRefs,
            }),
            { initialProps: { entries: [bootstrapEntry] }, wrapper },
        );

        await act(async () => {});

        rerender({ entries: [bootstrapEntry, oldEntry] });
        await waitFor(() => {
            expect(animations.triggerAbilityFlash).toHaveBeenCalledTimes(1);
        });

        rollbackValue = { watermark: null, seq: 1, reconcileSeq: 0 };
        rerender({ entries: [] });

        now = 2000;
        rerender({ entries: [bootstrapEntry, oldEntry] });
        await waitFor(() => {
            expect(animations.triggerAbilityFlash).toHaveBeenCalledTimes(1);
        });

        now = 3000;
        rerender({ entries: [bootstrapEntry, oldEntry, newEntry] });
        await waitFor(() => {
            expect(animations.triggerAbilityFlash).toHaveBeenCalledTimes(2);
        });
    });
});
