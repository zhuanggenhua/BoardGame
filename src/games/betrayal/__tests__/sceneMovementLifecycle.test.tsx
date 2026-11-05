import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventStreamEntry } from '../../../engine/types';
import { useSceneMovement } from '../useSceneMovement';
import { createStartedFirstScenarioCore } from './helpers/firstScenarioRuntimeHarness';
import { BetrayalDomain, type BetrayalCore } from '../game';
import { resolveRoomCanvasLayout, resolveRoomCenterPoint } from '../roomMapModel';
import { resolveBetrayalEntitySceneSprites, resolveBetrayalRoomSceneSprites } from '../roomSceneModel';
import { getAllExplorers } from '../explorerReadModel';
import { AudioManager } from '../../../lib/audio/AudioManager';
import { BETRAYAL_FOOTSTEP_CARPET_KEYS, BETRAYAL_FOOTSTEP_WOOD_KEYS } from '../audio.config';

const move = (id: number, roomId: string): EventStreamEntry => ({ id, event: { type: 'EXPLORER_MOVED', payload: { playerId: '0', roomId, logText: '' }, timestamp: id } });
function input(core: BetrayalCore, entries: EventStreamEntry[] = [], rollbackRevision = 0) {
    const rooms = core.rooms.filter(room => room.floor === 'ground');
    const layout = resolveRoomCanvasLayout(rooms);
    const occupants = Object.fromEntries(rooms.map(room => [room.id, getAllExplorers(core).filter(explorer => explorer.roomId === room.id)]));
    return { core, entries, rollbackRevision, rooms, layout, locale: 'zh-CN',
    sprites: [...resolveBetrayalRoomSceneSprites(rooms, layout, 'zh-CN'),
        ...resolveBetrayalEntitySceneSprites(rooms, occupants, {}, layout, 'zh-CN', core.currentExplorer.playerId)] };
}
const after = (core: BetrayalCore, event: EventStreamEntry) => BetrayalDomain.reduce(structuredClone(core), event.event);

type ChangeListener = (event: MediaQueryListEvent) => void;

function installReducedMotionMediaQuery(initialMatches = false) {
    const listeners = new Set<ChangeListener>();
    let matches = initialMatches;
    const mediaQuery = {
        get matches() { return matches; },
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
            if (type === 'change') listeners.add(listener as ChangeListener);
        }),
        removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
            if (type === 'change') listeners.delete(listener as ChangeListener);
        }),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
    } as unknown as MediaQueryList;
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => mediaQuery) });
    return {
        mediaQuery,
        restore() { Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia }); },
        dispatchChange(nextMatches: boolean) {
            matches = nextMatches;
            const event = { matches, media: mediaQuery.media } as MediaQueryListEvent;
            for (const listener of [...listeners]) listener(event);
        },
    };
}

const originalMatchMedia = window.matchMedia;

afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
    vi.restoreAllMocks();
});

describe('confirmed movement presentation lifecycle', () => {
    it('reveals a newly discovered room on its own nonblocking Pixi track and completes once', () => {
        const beforeCore = createStartedFirstScenarioCore();
        const room = beforeCore.rooms.find(candidate => candidate.floor === 'ground' && candidate.state !== 'discovered');
        expect(room).toBeDefined();
        const roomId = room!.id;
        beforeCore.currentExplorer = { ...beforeCore.currentExplorer, roomId };
        beforeCore.activeRoomId = roomId;
        beforeCore.currentExplorerRoomId = roomId;
        const afterCore = structuredClone(beforeCore);
        const revealedRoom = afterCore.rooms.find(candidate => candidate.id === roomId)!;
        revealedRoom.state = 'discovered';
        revealedRoom.name = '新发现的房间';
        revealedRoom.visualId = 'library';
        const explored: EventStreamEntry = {
            id: 90,
            event: {
                type: 'ROOM_EXPLORED',
                payload: { playerId: beforeCore.currentExplorer.playerId, roomId },
                timestamp: 90,
            },
        } as unknown as EventStreamEntry;
        const onStart = vi.fn(); const onEnd = vi.fn();
        const onRoomRevealActivity = vi.fn();
        const { result, rerender } = renderHook(props => useSceneMovement({ ...props, onStart, onEnd, onRoomRevealActivity }), { initialProps: input(beforeCore) });

        rerender(input(afterCore, [explored]));

        const tile = () => result.current.sprites.find(sprite => sprite.id === roomId)!;
        expect(onRoomRevealActivity).toHaveBeenLastCalledWith(true);
        expect(tile().motion).toMatchObject({ id: '0:90', kind: 'reveal', durationMs: 360, startScale: 0.96 });
        expect(tile().motion!.from.x).toBe(tile().x + tile().width / 2);
        expect(tile().motion!.from.y).toBeLessThan(tile().y + tile().height / 2);
        expect(result.current.active).toBe(false);
        expect(onStart).not.toHaveBeenCalled();
        expect(onEnd).not.toHaveBeenCalled();

        act(() => {
            result.current.complete(roomId, '0:90');
            result.current.complete(roomId, '0:90');
        });
        expect(tile().motion).toBeUndefined();
        expect(onRoomRevealActivity).toHaveBeenLastCalledWith(false);
        rerender(input(afterCore, [explored]));
        expect(tile().motion).toBeUndefined();
        expect(result.current.active).toBe(false);
    });

    it.each(['rollback', 'resource-error', 'room-removed', 'unmount'] as const)(
        'releases the discovery presentation hold on %s', (reason) => {
            const beforeCore = createStartedFirstScenarioCore();
            const roomId = beforeCore.rooms.find(room => room.floor === 'ground' && room.state !== 'discovered')!.id;
            const afterCore = structuredClone(beforeCore);
            afterCore.rooms.find(room => room.id === roomId)!.state = 'discovered';
            const explored = { id: 97, event: { type: 'ROOM_EXPLORED', payload: { playerId: '0', roomId }, timestamp: 97 } } as unknown as EventStreamEntry;
            const onRoomRevealActivity = vi.fn();
            const onStart = vi.fn(); const onEnd = vi.fn();
            const { result, rerender, unmount } = renderHook(props => useSceneMovement({
                ...props, onStart, onEnd, onRoomRevealActivity,
            }), { initialProps: input(beforeCore) });
            rerender(input(afterCore, [explored]));
            expect(onRoomRevealActivity).toHaveBeenLastCalledWith(true);
            act(() => result.current.complete(roomId, 'stale-event'));
            expect(onRoomRevealActivity).toHaveBeenLastCalledWith(true);
            if (reason === 'rollback') rerender(input(beforeCore, [], 1));
            else if (reason === 'resource-error') act(() => result.current.cancel());
            else if (reason === 'unmount') unmount();
            else {
                const next = input(afterCore, [explored]);
                next.sprites = next.sprites.filter(sprite => sprite.id !== roomId);
                rerender(next);
            }
            expect(onRoomRevealActivity).toHaveBeenLastCalledWith(false);
            if (reason !== 'unmount') unmount();
        },
    );

    it('prunes a reveal when its room sprite disappears and does not replay it on re-entry', () => {
        const beforeCore = createStartedFirstScenarioCore();
        const room = beforeCore.rooms.find(candidate => candidate.floor === 'ground' && candidate.state !== 'discovered');
        expect(room).toBeDefined();
        const roomId = room!.id;
        const afterCore = structuredClone(beforeCore);
        afterCore.rooms.find(candidate => candidate.id === roomId)!.state = 'discovered';
        const explored: EventStreamEntry = {
            id: 92,
            event: { type: 'ROOM_EXPLORED', payload: { playerId: beforeCore.currentExplorer.playerId, roomId }, timestamp: 92 },
        } as unknown as EventStreamEntry;
        const { result, rerender } = renderHook(props => useSceneMovement({ ...props, onStart: vi.fn(), onEnd: vi.fn() }), { initialProps: input(beforeCore) });

        rerender(input(afterCore, [explored]));
        expect(result.current.sprites.find(sprite => sprite.id === roomId)?.motion?.id).toBe('0:92');

        const missing = input(afterCore);
        missing.rooms = missing.rooms.filter(candidate => candidate.id !== roomId);
        missing.sprites = missing.sprites.filter(sprite => sprite.id !== roomId);
        rerender(missing);
        expect(result.current.sprites.some(sprite => sprite.id === roomId)).toBe(false);

        rerender(input(afterCore));
        expect(result.current.sprites.find(sprite => sprite.id === roomId)?.motion).toBeUndefined();
    });

    it('cancels a room reveal on resource failure and ignores a late completion callback', () => {
        const beforeCore = createStartedFirstScenarioCore();
        const room = beforeCore.rooms.find(candidate => candidate.floor === 'ground' && candidate.state !== 'discovered');
        expect(room).toBeDefined();
        const roomId = room!.id;
        const afterCore = structuredClone(beforeCore);
        afterCore.rooms.find(candidate => candidate.id === roomId)!.state = 'discovered';
        const explored: EventStreamEntry = {
            id: 93,
            event: { type: 'ROOM_EXPLORED', payload: { playerId: beforeCore.currentExplorer.playerId, roomId }, timestamp: 93 },
        } as unknown as EventStreamEntry;
        const { result, rerender } = renderHook(props => useSceneMovement({ ...props, onStart: vi.fn(), onEnd: vi.fn() }), { initialProps: input(beforeCore) });

        rerender(input(afterCore, [explored]));
        expect(result.current.sprites.find(sprite => sprite.id === roomId)?.motion?.id).toBe('0:93');
        act(() => result.current.cancel());
        act(() => result.current.complete(roomId, '0:93'));
        expect(result.current.sprites.find(sprite => sprite.id === roomId)?.motion).toBeUndefined();
        expect(result.current.active).toBe(false);
    });

    it('clears room reveals on rollback and settles immediately when reduced motion is enabled', () => {
        const media = installReducedMotionMediaQuery(false);
        try {
            const beforeCore = createStartedFirstScenarioCore();
            const room = beforeCore.rooms.find(candidate => candidate.floor === 'ground' && candidate.state !== 'discovered');
            expect(room).toBeDefined();
            const roomId = room!.id;
            beforeCore.currentExplorer = { ...beforeCore.currentExplorer, roomId };
            beforeCore.activeRoomId = roomId;
            beforeCore.currentExplorerRoomId = roomId;
            const afterCore = structuredClone(beforeCore);
            const revealedRoom = afterCore.rooms.find(candidate => candidate.id === roomId)!;
            revealedRoom.state = 'discovered';
            revealedRoom.visualId = 'library';
            const explored: EventStreamEntry = {
                id: 91,
                event: {
                    type: 'ROOM_EXPLORED',
                    payload: { playerId: beforeCore.currentExplorer.playerId, roomId },
                    timestamp: 91,
                },
            } as unknown as EventStreamEntry;
            const onStart = vi.fn(); const onEnd = vi.fn();
            const onRoomRevealActivity = vi.fn();
            const { result, rerender, unmount } = renderHook(props => useSceneMovement({ ...props, onStart, onEnd, onRoomRevealActivity }), { initialProps: input(beforeCore) });

            rerender(input(afterCore, [explored]));
            expect(result.current.sprites.find(sprite => sprite.id === roomId)?.motion?.id).toBe('0:91');
            rerender(input(beforeCore, [], 1));
            expect(result.current.sprites.find(sprite => sprite.id === roomId)?.motion).toBeUndefined();
            act(() => result.current.complete(roomId, '0:91'));
            expect(result.current.active).toBe(false);

            const freshHook = renderHook(props => useSceneMovement({ ...props, onStart, onEnd, onRoomRevealActivity }), { initialProps: input(beforeCore) });
            freshHook.rerender(input(afterCore, [explored]));
            expect(onRoomRevealActivity).toHaveBeenLastCalledWith(true);
            act(() => media.dispatchChange(true));
            expect(freshHook.result.current.sprites.find(sprite => sprite.id === roomId)?.motion).toMatchObject({ durationMs: 0 });
            act(() => freshHook.result.current.complete(roomId, '0:91'));
            expect(freshHook.result.current.sprites.find(sprite => sprite.id === roomId)?.motion).toBeUndefined();
            expect(freshHook.result.current.active).toBe(false);
            expect(onRoomRevealActivity).toHaveBeenLastCalledWith(false);
            expect(onStart).not.toHaveBeenCalled();
            expect(onEnd).not.toHaveBeenCalled();
            freshHook.unmount();
            unmount();
        } finally {
            media.restore();
        }
    });

    it('skips mounted history and releases one gate only after both committed steps settle', () => {
        const core = createStartedFirstScenarioCore();
        const first = move(10, 'hallway'); const second = move(11, 'grand-staircase');
        const onStart = vi.fn(); const onEnd = vi.fn(); const onPresented = vi.fn();
        const callbacks = { onStart, onEnd, onPresented };
        const { result, rerender } = renderHook(props => useSceneMovement({ ...props, ...callbacks }), { initialProps: input(core) });
        const next = after(after(core, first), second);
        rerender(input(next, [first, second]));
        expect(result.current.active).toBe(true);
        expect(onStart).toHaveBeenCalledTimes(1);
        const sprite = () => result.current.sprites.find(item => item.id === 'player:0')!;
        expect(sprite().motion?.id).toBe('0:10');
        act(() => { result.current.complete('player:0', '0:10'); result.current.complete('player:0', '0:10'); });
        expect(onPresented).toHaveBeenCalledTimes(1);
        expect(sprite().motion?.id).toBe('0:11');
        expect(onEnd).not.toHaveBeenCalled();
        act(() => result.current.complete('player:0', '0:11'));
        expect(result.current.active).toBe(false);
        expect(onEnd).toHaveBeenCalledTimes(1);
        rerender(input(next, [first, second]));
        expect(onStart).toHaveBeenCalledTimes(1);
        const restored = renderHook(() => useSceneMovement({ ...input(next, [first, second]), ...callbacks }));
        expect(restored.result.current.active).toBe(false);
        restored.unmount();
    });

    it('reduces an active queue to zero-duration hops on an actual media query change and completes each landing once', () => {
        const media = installReducedMotionMediaQuery(false);
        try {
            const core = createStartedFirstScenarioCore();
            const first = move(20, 'hallway'); const second = move(21, 'grand-staircase');
            const onStart = vi.fn(); const onEnd = vi.fn(); const onPresented = vi.fn();
            const playSound = vi.spyOn(AudioManager, 'play').mockReturnValue(1);
            const { result, rerender, unmount } = renderHook(props => useSceneMovement({ ...props, onStart, onEnd, onPresented }), { initialProps: input(core) });
            rerender(input(after(after(core, first), second), [first, second]));

            expect(result.current.active).toBe(true);
            expect(result.current.sprites.find(sprite => sprite.id === 'player:0')?.motion).toMatchObject({ kind: 'hop', durationMs: 300, landingDurationMs: 200, arcHeight: 16 });

            act(() => media.dispatchChange(true));

            const firstMotion = result.current.sprites.find(sprite => sprite.id === 'player:0')?.motion;
            expect(firstMotion).toMatchObject({ id: '0:20', kind: 'hop', durationMs: 0, landingDurationMs: 0, arcHeight: 0 });
            act(() => {
                result.current.onMotionPhase('player:0', '0:20', 'landing');
                result.current.onMotionPhase('player:0', '0:20', 'settled');
            });
            expect(playSound).toHaveBeenCalledExactlyOnceWith(BETRAYAL_FOOTSTEP_CARPET_KEYS[0]);
            act(() => { result.current.complete('player:0', '0:20'); result.current.complete('player:0', '0:20'); });
            expect(onPresented).toHaveBeenCalledExactlyOnceWith('hallway', 'player:0');
            const secondMotion = result.current.sprites.find(sprite => sprite.id === 'player:0')?.motion;
            expect(secondMotion).toMatchObject({ id: '0:21', durationMs: 0, landingDurationMs: 0, arcHeight: 0 });
            expect(result.current.active).toBe(true);
            expect(onEnd).not.toHaveBeenCalled();
            act(() => result.current.complete('player:0', '0:21'));
            expect(onPresented).toHaveBeenNthCalledWith(2, 'grand-staircase', 'player:0');
            expect(playSound).toHaveBeenCalledTimes(1);
            expect(result.current.active).toBe(false);
            expect(onEnd).toHaveBeenCalledTimes(1);
            unmount();
            expect(media.mediaQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
        } finally {
            media.restore();
        }
    });

    it('accepts each current motion phase once and rejects stale phases across same-entity queued steps', () => {
        const core = createStartedFirstScenarioCore();
        const first = move(50, 'hallway'); const second = move(51, 'grand-staircase');
        const onStart = vi.fn(); const onEnd = vi.fn();
        const playSound = vi.spyOn(AudioManager, 'play').mockReturnValue(1);
        const { result, rerender } = renderHook(props => useSceneMovement({ ...props, onStart, onEnd }), { initialProps: input(core) });
        rerender(input(after(after(core, first), second), [first, second]));

        act(() => {
            result.current.onMotionPhase('player:0', '0:50', 'landing');
            result.current.onMotionPhase('player:0', '0:50', 'landing');
            result.current.onMotionPhase('player:0', 'stale-motion', 'landing');
        });
        expect(playSound).toHaveBeenCalledExactlyOnceWith(BETRAYAL_FOOTSTEP_CARPET_KEYS[0]);
        act(() => {
            result.current.onMotionPhase('player:0', '0:50', 'settled');
            result.current.complete('player:0', '0:50');
            result.current.onMotionPhase('player:0', '0:50', 'landing');
            result.current.onMotionPhase('player:0', '0:51', 'landing');
            result.current.onMotionPhase('player:0', '0:51', 'landing');
            result.current.onMotionPhase('player:0', '0:51', 'settled');
            result.current.onMotionPhase('player:0', '0:51', 'settled');
        });
        expect(playSound).toHaveBeenCalledTimes(2);
        expect(playSound).toHaveBeenLastCalledWith(BETRAYAL_FOOTSTEP_WOOD_KEYS[1]);
        act(() => result.current.complete('player:0', '0:51'));
        expect(result.current.active).toBe(false);
        expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it('does not play walking footsteps for fade movement', () => {
        const core = createStartedFirstScenarioCore();
        const startRoomId = getAllExplorers(core)[0].roomId;
        const start = core.rooms.find(room => room.id === startRoomId)!;
        const distantRoom = core.rooms.find(room => room.floor === start.floor
            && Math.abs(room.x - start.x) + Math.abs(room.y - start.y) > 1)!;
        const fade = move(70, distantRoom.id);
        const movedCore = after(core, fade);
        const playSound = vi.spyOn(AudioManager, 'play').mockReturnValue(1);
        const onStart = vi.fn(); const onEnd = vi.fn();
        const { result, rerender } = renderHook(props => useSceneMovement({ ...props, onStart, onEnd }), { initialProps: input(core) });

        rerender(input(movedCore, [fade]));
        expect(result.current.sprites.find(sprite => sprite.id === 'player:0')?.motion?.kind).toBe('fade');
        act(() => {
            result.current.onMotionPhase('player:0', '0:70', 'landing');
            result.current.onMotionPhase('player:0', '0:70', 'settled');
        });
        expect(playSound).not.toHaveBeenCalled();
        act(() => result.current.complete('player:0', '0:70'));

        expect(onStart).toHaveBeenCalledTimes(1);
        expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it('announces the accepted destination before landing and plays one exploration footstep', () => {
        const core = createStartedFirstScenarioCore();
        const explored = { id: 71, event: { type: 'ROOM_EXPLORED', payload: { playerId: '0', roomId: 'hallway' }, timestamp: 71 } } as unknown as EventStreamEntry;
        const exploredCore = after(core, move(72, 'hallway'));
        const playSound = vi.spyOn(AudioManager, 'play').mockReturnValue(1);
        const onApproach = vi.fn(); const onPresented = vi.fn();
        const onStart = vi.fn(); const onEnd = vi.fn();
        const { result, rerender } = renderHook(props => useSceneMovement({ ...props, onStart, onEnd, onApproach, onPresented }), { initialProps: input(core) });
        rerender(input(exploredCore, [explored]));
        const motion = result.current.sprites.find(sprite => sprite.id === 'player:0')!.motion!;
        expect(motion.kind).toBe('hop');
        expect(onApproach).toHaveBeenCalledWith('hallway', 'player:0');
        expect(onPresented).not.toHaveBeenCalled();
        act(() => { result.current.onMotionPhase('player:0', motion.id, 'landing'); result.current.onMotionPhase('player:0', motion.id, 'landing'); });
        expect(playSound).toHaveBeenCalledExactlyOnceWith(BETRAYAL_FOOTSTEP_CARPET_KEYS[0]);
    });

    it('does not replay a landing if its motion is rolled back after the phase callback', () => {
        const core = createStartedFirstScenarioCore();
        const first = move(75, 'hallway');
        const playSound = vi.spyOn(AudioManager, 'play').mockReturnValue(1);
        const onStart = vi.fn(); const onEnd = vi.fn();
        const { result, rerender } = renderHook(props => useSceneMovement({ ...props, onStart, onEnd }), { initialProps: input(core) });
        rerender(input(after(core, first), [first]));

        act(() => result.current.onMotionPhase('player:0', '0:75', 'landing'));
        expect(playSound).toHaveBeenCalledExactlyOnceWith(BETRAYAL_FOOTSTEP_CARPET_KEYS[0]);
        rerender(input(core, [], 1));
        act(() => {
            result.current.onMotionPhase('player:0', '0:75', 'landing');
            result.current.onMotionPhase('player:0', '0:75', 'settled');
            result.current.complete('player:0', '0:75');
        });
        expect(playSound).toHaveBeenCalledTimes(1);
        expect(result.current.active).toBe(false);
        expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it('uses event array order to place intermediate landing targets, regardless of event IDs', () => {
        const core = createStartedFirstScenarioCore();
        const first = move(30, 'hallway'); const second = move(10, 'grand-staircase');
        const next = after(after(core, first), second);
        const onStart = vi.fn(); const onEnd = vi.fn();
        const { result, rerender } = renderHook(props => useSceneMovement({ ...props, onStart, onEnd }), { initialProps: input(core) });
        rerender(input(next, [first, second]));
        const sprite = result.current.sprites.find(item => item.id === 'player:0')!;
        const layout = input(next).layout;
        const hallway = next.rooms.find(room => room.id === 'hallway')!;
        const center = resolveRoomCenterPoint(hallway, layout);
        const expectedCenter = { x: center.x - sprite.width / 2, y: center.y - sprite.height / 2 };
        expect(sprite.motion?.id).toBe('0:30');
        expect(sprite.x).toBe(expectedCenter.x);
        expect(sprite.y).toBe(expectedCenter.y);
    });

    it('presents a final off-floor arrival and drops that entity from the blocking queue', () => {
        const core = createStartedFirstScenarioCore();
        const first = move(40, 'hallway'); const second = move(41, 'upper-landing');
        const onStart = vi.fn(); const onEnd = vi.fn(); const onPresented = vi.fn();
        const { result, rerender } = renderHook(props => useSceneMovement({ ...props, onStart, onEnd, onPresented }), { initialProps: input(core) });
        rerender(input(after(core, first), [first]));
        expect(result.current.active).toBe(true);
        rerender(input(after(after(core, first), second), [first, second]));

        expect(result.current.active).toBe(false);
        expect(onPresented).toHaveBeenCalledExactlyOnceWith('upper-landing', 'player:0');
        expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it('rejects old motion phases after an off-floor arrival clears an already-landed hop', () => {
        const core = createStartedFirstScenarioCore();
        const first = move(60, 'hallway'); const second = move(61, 'upper-landing');
        const onPresented = vi.fn(); const onStart = vi.fn(); const onEnd = vi.fn();
        const playSound = vi.spyOn(AudioManager, 'play').mockReturnValue(1);
        const { result, rerender } = renderHook(props => useSceneMovement({ ...props, onPresented, onStart, onEnd }), { initialProps: input(core) });
        rerender(input(after(core, first), [first]));
        act(() => result.current.onMotionPhase('player:0', '0:60', 'landing'));
        expect(playSound).toHaveBeenCalledExactlyOnceWith(BETRAYAL_FOOTSTEP_CARPET_KEYS[0]);
        expect(result.current.active).toBe(true);

        rerender(input(after(after(core, first), second), [first, second]));
        expect(result.current.active).toBe(false);
        expect(onPresented).toHaveBeenCalledExactlyOnceWith('upper-landing', 'player:0');
        expect(onEnd).toHaveBeenCalledTimes(1);
        act(() => {
            result.current.onMotionPhase('player:0', '0:60', 'settled');
            result.current.onMotionPhase('player:0', '0:60', 'landing');
        });
        expect(playSound).toHaveBeenCalledTimes(1);
    });

    it.each(['rollback', 'resource failure', 'removed entity', 'unmount'])('releases an interrupted sequence on %s', reason => {
        const core = createStartedFirstScenarioCore(); const first = move(10, 'hallway');
        const onStart = vi.fn(); const onEnd = vi.fn(); const onPresented = vi.fn();
        const { result, rerender, unmount } = renderHook(props => useSceneMovement({ ...props, onStart, onEnd, onPresented }), { initialProps: input(core) });
        const next = after(core, first);
        rerender(input(next, [first]));
        expect(onStart).toHaveBeenCalledTimes(1);
        if (reason === 'rollback') rerender(input(core, [], 1));
        else if (reason === 'resource failure') act(() => result.current.cancel());
        else if (reason === 'removed entity') rerender({ ...input(next, [first]), sprites: [] });
        else {
            const playSound = vi.spyOn(AudioManager, 'play').mockReturnValue(1);
            unmount();
            act(() => result.current.complete('player:0', '0:10'));
            act(() => result.current.onMotionPhase('player:0', '0:10', 'landing'));
            expect(onPresented).not.toHaveBeenCalled();
            expect(playSound).not.toHaveBeenCalled();
        }
        expect(onEnd).toHaveBeenCalledTimes(1);
        if (reason !== 'unmount') { expect(result.current.active).toBe(false); unmount(); }
        expect(onEnd).toHaveBeenCalledTimes(1);
    });
});
