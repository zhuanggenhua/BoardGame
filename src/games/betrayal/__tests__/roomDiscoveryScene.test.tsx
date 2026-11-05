import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventStreamEntry } from '../../../engine/types';
import type { BetrayalCore, BetrayalExplorerSummary, BetrayalRoomNode } from '../game';
const visual = vi.hoisted(() => ({ done: undefined as undefined | ((phase: string) => void), reduced: false, backgroundPlay: null as any, stagePlay: null as any }));
vi.mock('../../../core', () => ({ HudPortal: ({ children }: React.PropsWithChildren) => children, UI_Z_INDEX: { modalOverlay: 2100, tutorial: 2300, modalFullscreenGate: 2360 } }));
vi.mock('../../../components/common/media/OptimizedImage', () => ({ OptimizedImage: ({ src, locale: _locale, placeholder: _placeholder, ...props }: any) => <img src={src} {...props} /> }));
vi.mock('framer-motion', () => ({ useReducedMotion: () => visual.reduced, motion: {
    button: React.forwardRef(({ children, onAnimationComplete, variants: _variants, initial: _initial, animate: _animate, ...props }: any, ref: any) => { visual.done = onAnimationComplete; visual.stagePlay = _variants.play; return <button ref={ref} {...props}>{children}</button>; }),
    span: ({ children, variants: _variants, ...props }: any) => { if (_variants?.play?.filter?.startsWith('brightness')) visual.backgroundPlay = _variants.play; return <span {...props}>{children}</span>; },
} }));
import { RoomDiscoverySceneSurface, useRoomDiscoveryScene } from '../roomDiscoveryScene';
const room = { id: 'room-1', name: '温室', state: 'discovered', visualId: 'conservatory' } as BetrayalRoomNode;
const actor = { playerId: '0', displayName: '伊莎', tokenAsset: 'betrayal/tokens/explorers/isa-valencia' } as BetrayalExplorerSummary;
const core = { rooms: [room], currentExplorer: actor, otherExplorers: [] } as unknown as BetrayalCore;
const explored = (id: number, playerId = '0'): EventStreamEntry => ({ id, event: { type: 'ROOM_EXPLORED', payload: { playerId, roomId: room.id }, timestamp: id } });
const initial = { core, entries: [explored(1)], rollbackRevision: 0, viewerPlayerId: '0', enabled: true };

describe('committed room discovery scene ownership', () => {
    it('does not replay mount history, consumes new discoveries once, and ignores stale completion', () => {
        const { result, rerender } = renderHook(useRoomDiscoveryScene, { initialProps: initial });
        expect(result.current.scene).toBeNull();
        rerender({ ...initial, entries: [explored(1), explored(2), explored(3)] });
        expect(result.current.scene?.id).toBe('0:2');
        act(() => result.current.complete('wrong'));
        expect(result.current.scene?.id).toBe('0:2');
        act(() => result.current.complete('0:2'));
        expect(result.current.scene?.id).toBe('0:3');
        act(() => result.current.complete('0:2'));
        expect(result.current.scene?.id).toBe('0:3');
        act(() => result.current.complete('0:3'));
        rerender({ ...initial, entries: [explored(1), explored(2), explored(3)] });
        expect(result.current.scene).toBeNull();
    });
    it('does not interrupt the viewer for another seat, and clears on rollback or spectator changes', () => {
        const { result, rerender } = renderHook(useRoomDiscoveryScene, { initialProps: initial });
        rerender({ ...initial, entries: [explored(1), explored(2, '1')] });
        expect(result.current.scene).toBeNull();
        rerender({ ...initial, entries: [explored(1), explored(2, '1'), explored(3)] });
        expect(result.current.scene?.id).toBe('0:3');
        rerender({ ...initial, entries: [explored(1)], rollbackRevision: 1 });
        expect(result.current.scene).toBeNull();
        rerender({ ...initial, entries: [explored(1), explored(4)], rollbackRevision: 1 });
        expect(result.current.scene?.id).toBe('1:4');
        rerender({ ...initial, entries: [explored(1), explored(4)], rollbackRevision: 1, enabled: false });
        expect(result.current.scene).toBeNull();
    });
});

describe('full-stage room reveal', () => {
    beforeEach(() => { visual.reduced = false; visual.done = undefined; });
    it('背景提亮先完成，再结束舞台，不能把亮度绑定到更长的镜头漂移', () => {
        render(<RoomDiscoverySceneSurface scene={{id:'0:lighting',room,explorer:actor}} locale="zh-CN" discoveryLabel="发现新房间" skipLabel="点击加速" onComplete={vi.fn()}/>);
        const transition=visual.backgroundPlay.transition;
        const illuminationDuration=transition.filter?.duration ?? transition.duration;
        expect(illuminationDuration).toBeLessThan(visual.stagePlay.transition.duration);
        // Framer waits for descendant variants: a longer drift leaves an invisible fullscreen gate.
        expect(transition.duration).toBeLessThanOrEqual(visual.stagePlay.transition.duration);
    });
    it('starts with actual asset readiness, then finishes once without any rule command', () => {
        const done = vi.fn();
        render(<RoomDiscoverySceneSurface scene={{ id: '0:2', room, explorer: actor }} locale="zh-CN" discoveryLabel="发现新房间" skipLabel="点击加速" onComplete={done} />);
        const layer = screen.getByTestId('betrayal-room-discovery-scene');
        expect(Number(layer.style.zIndex)).toBeGreaterThan(2300);
        expect(layer.dataset.presentationStage).toBe('waiting');
        fireEvent.load(screen.getByTestId('betrayal-room-scene-art'));
        expect(layer.dataset.presentationStage).toBe('waiting');
        fireEvent.load(screen.getByTestId('betrayal-room-scene-actor'));
        expect(layer.dataset.presentationStage).toBe('play');
        expect(layer.textContent).toContain('温室');
        expect(layer.textContent).toContain('伊莎');
        act(() => { visual.done?.('play'); visual.done?.('play'); });
        expect(done).toHaveBeenCalledExactlyOnceWith('0:2');
    });
    it('allows keyboard skip even when an asset is unavailable, and ignores interrupted play completion', () => {
        const done = vi.fn();
        render(<RoomDiscoverySceneSurface scene={{ id: '0:3', room, explorer: actor }} locale="zh-CN" discoveryLabel="发现新房间" skipLabel="点击加速" onComplete={done} />);
        const layer = screen.getByTestId('betrayal-room-discovery-scene');
        expect(document.activeElement).toBe(layer);
        fireEvent.keyDown(layer, { key: 'Escape' });
        expect(layer.dataset.presentationStage).toBe('skip');
        act(() => visual.done?.('play'));
        expect(done).not.toHaveBeenCalled();
        act(() => { visual.done?.('skip'); visual.done?.('skip'); });
        expect(done).toHaveBeenCalledExactlyOnceWith('0:3');
    });
    it('uses the same lifecycle in reduced motion and settles explicit image failures', () => {
        visual.reduced = true; const done = vi.fn();
        render(<RoomDiscoverySceneSurface scene={{ id: '0:4', room, explorer: actor }} locale="zh-CN" discoveryLabel="发现新房间" skipLabel="点击加速" onComplete={done} />);
        fireEvent.error(screen.getByTestId('betrayal-room-scene-art'));
        fireEvent.error(screen.getByTestId('betrayal-room-scene-actor'));
        expect(screen.getByTestId('betrayal-room-discovery-scene').dataset.presentationStage).toBe('play');
        act(() => visual.done?.('play'));
        expect(done).toHaveBeenCalledExactlyOnceWith('0:4');
    });
});
