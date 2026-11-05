import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QidahenBattleRolls } from '../domain/types';
import { QidahenBattleRollOverlay } from '../ui/QidahenBattleRollOverlay';
vi.mock('../ui/QidahenBattleRollSequence', () => ({ QidahenBattleRollSequence: () => <section data-testid="real-sequence">投掷</section> }));
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} });
const originalViewport = { width: window.innerWidth, height: window.innerHeight };
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }));
const overlap = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
function node(id: string, bounds: ReturnType<typeof rect>) {
    const element = document.createElement('div'); element.dataset.testid = id;
    element.getBoundingClientRect = () => bounds; return element;
}
function frame() {
    const style = document.querySelector<HTMLElement>('[data-testid="qidahen-battle-roll-overlay"]')!.style;
    return rect(parseFloat(style.left), parseFloat(style.top), parseFloat(style.width), parseFloat(style.getPropertyValue('--qidahen-battle-panel-height')));
}
const onFrameChange = vi.fn();
const props = { rolls: { stages: [] } as unknown as QidahenBattleRolls, sourceName: '辽北', targetName: '叶赫部', onFrameChange, onComplete() {} };
function mount(ready = true) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 915 }); Object.defineProperty(window, 'innerHeight', { configurable: true, value: 412 });
    document.body.append(node('qidahen-player-float', rect(0, 0, 915, 40)), node('qidahen-hand-card-shell-first', rect(0, 340, 915, 72)));
    const map = node('qidahen-map-layer', rect(0, 0, 915, 412)); document.body.append(map);
    return { ...render(<QidahenBattleRollOverlay {...props} layoutReady={ready} />), map };
}
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalViewport.width }); Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalViewport.height }); onFrameChange.mockClear(); });
describe('骰盘排座与地图取景分工', () => {
    it.each(['qidahen-draw-anchor', 'qidahen-discard-anchor'])('%s迟挂载后仍保留，骰盘重新避让', async anchor => {
        mount(); const current = frame();
        const pile = node(anchor, rect(current.left + 20, current.top + 30, 100, 140));
        expect(overlap(current, pile.getBoundingClientRect())).toBe(true);
        act(() => { document.body.append(pile); });
        await waitFor(() => expect(overlap(frame(), pile.getBoundingClientRect())).toBe(false));
    });
    it('先排座，再由地图唯一owner安排双方；地图变换不能反过来推挤骰盘', async () => {
        const { map } = mount(); const before = frame();
        const region = node('qidahen-battle-region-space-target', before); region.dataset.qidahenBattleRegionSpace = 'target';
        act(() => { map.append(region); map.style.transform = 'translateX(100px)'; });
        await waitFor(() => expect(frame()).toMatchObject({ left: before.left, top: before.top, width: before.width, height: before.height }));
        expect(onFrameChange).toHaveBeenCalledWith(expect.objectContaining({ left: before.left, top: before.top, width: before.width, height: before.height }));
    });
    it('骰盘只占空位一侧，给地图取景保留另一侧', () => {
        mount(); const panel = frame();
        expect(panel.left).toBe(8); expect(panel.width).toBeGreaterThanOrEqual(240);
        expect(panel.right).toBeLessThan(915 / 2);
        expect(panel.top).toBeGreaterThanOrEqual(48); expect(panel.bottom).toBeLessThanOrEqual(332);
    });
    it('当前战斗的镜头布局就绪前不挂载物理骰子，不提前播放或重挂', () => {
        const view = mount(false);
        expect(document.querySelector('[data-testid="real-sequence"]')).toBeNull();
        view.rerender(<QidahenBattleRollOverlay {...props} layoutReady />);
        expect(document.querySelector('[data-testid="real-sequence"]')).not.toBeNull();
        const sequence = document.querySelector('[data-testid="real-sequence"]');
        view.rerender(<QidahenBattleRollOverlay {...props} layoutReady={false} />);
        expect(document.querySelector('[data-testid="real-sequence"]')).toBe(sequence);
    });
});
