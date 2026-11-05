import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EventStreamEntry } from '../../../engine/types';
import { useBetrayalTurnIntro } from '../turnIntroSurface';

describe('Betrayal turn intro ownership', () => {
    const ended = (id: number): EventStreamEntry[] => [{ id, event: { type: 'TURN_ENDED', payload: {}, timestamp: id } }];
    const props = { phase: 'characterSelect' as const, currentPlayer: '0', viewerPlayerId: '0', entries: ended(1), rollbackRevision: 0 };
    it('announces a newly acquired turn once, then stays dismissed during that turn', () => {
        const { result, rerender } = renderHook(useBetrayalTurnIntro, { initialProps: { ...props, phase: 'characterSelect' as string } });
        expect(result.current.turnIntroKey).toBeNull();
        rerender({ ...props, phase: 'preHaunt' });
        expect(result.current.turnIntroKey).not.toBeNull();
        act(() => result.current.dismissTurnIntro());
        rerender({ ...props, phase: 'preHaunt' });
        expect(result.current.turnIntroKey).toBeNull();
        rerender({ ...props, phase: 'preHaunt', currentPlayer: '1', entries: ended(2) });
        expect(result.current.turnIntroKey).toBeNull();
        rerender({ ...props, phase: 'preHaunt', entries: ended(3) });
        expect(result.current.turnIntroKey).toBe('0:3');
    });
    it('does not replay a dismissed intro when sync temporarily strips or restores event history', () => {
        const { result, rerender } = renderHook(useBetrayalTurnIntro, { initialProps: { ...props, phase: 'characterSelect' as string } });
        rerender({ ...props, phase: 'preHaunt' });
        act(() => result.current.dismissTurnIntro());
        rerender({ ...props, phase: 'preHaunt', entries: [] });
        expect(result.current.turnIntroKey).toBeNull();
        rerender({ ...props, phase: 'preHaunt' });
        expect(result.current.turnIntroKey).toBeNull();
        rerender({ ...props, phase: 'preHaunt', entries: ended(2) });
        expect(result.current.turnIntroKey).toBe('0:2');
    });
    it('does not replay the existing turn when rejoining a running game', () => {
        const { result } = renderHook(useBetrayalTurnIntro, { initialProps: { ...props, phase: 'preHaunt' } });
        expect(result.current.turnIntroKey).toBeNull();
    });
    it('clears an interrupted intro on rollback without announcing the rewound turn', () => {
        const { result, rerender } = renderHook(useBetrayalTurnIntro, { initialProps: { ...props, phase: 'characterSelect' as string } });
        rerender({ ...props, phase: 'preHaunt' });
        expect(result.current.turnIntroKey).not.toBeNull();
        rerender({ ...props, phase: 'preHaunt', rollbackRevision: 1 });
        expect(result.current.turnIntroKey).toBeNull();
    });
    it('does not announce AI turns when the local view follows the acting seat', () => {
        const { result, rerender } = renderHook(useBetrayalTurnIntro, { initialProps: { ...props, phase: 'characterSelect' as string, canAnnounceTurn: true } });
        rerender({ ...props, phase: 'preHaunt', canAnnounceTurn: true });
        expect(result.current.turnIntroKey).not.toBeNull();
        rerender({ ...props, phase: 'preHaunt', currentPlayer: '1', viewerPlayerId: '1', entries: ended(2), canAnnounceTurn: false });
        expect(result.current.turnIntroKey).toBeNull();
        rerender({ ...props, phase: 'preHaunt', entries: ended(3), canAnnounceTurn: true });
        expect(result.current.turnIntroKey).toBe('0:3');
    });
    it('does not announce a spectator following the active seat', () => {
        const { result, rerender } = renderHook(useBetrayalTurnIntro, { initialProps: { ...props, phase: 'characterSelect' as string, canAnnounceTurn: false } });
        rerender({ ...props, phase: 'preHaunt', canAnnounceTurn: false });
        expect(result.current.turnIntroKey).toBeNull();
    });

});
