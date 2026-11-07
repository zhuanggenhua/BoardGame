import React from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QidahenBattleRolls } from '../domain/types';
import { QidahenBattleRollOverlay } from '../ui/QidahenBattleRollOverlay';
const sequenceMounts = vi.hoisted(() => ({ count: 0 }));
vi.mock('../ui/QidahenBattleRollSequence', () => ({ QidahenBattleRollSequence: () => {
    React.useEffect(() => { sequenceMounts.count += 1; }, []);
    return <section data-testid="real-sequence">投掷</section>;
} }));
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
const props = { rolls: { stages: [] } as unknown as QidahenBattleRolls, sourceName: '辽北', targetName: '叶赫部', attacker: { name: '大明' }, defender: { name: '蒙古' }, onFrameChange, onComplete() {} };
function mount(ready = true) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 915 }); Object.defineProperty(window, 'innerHeight', { configurable: true, value: 412 });
    document.body.append(node('qidahen-player-float', rect(0, 0, 915, 40)), node('qidahen-hand-card-shell-first', rect(0, 340, 915, 72)));
    const map = node('qidahen-map-layer', rect(0, 0, 915, 412)); document.body.append(map);
    return { ...render(<QidahenBattleRollOverlay {...props} layoutReady={ready} />), map };
}
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalViewport.width }); Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalViewport.height }); onFrameChange.mockClear(); });
describe('骰盘排座与地图取景分工', () => {
    it('双方兵牌之间的空地优先投掷，背景人口标记不把骰子挤到其它地区', () => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 640 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
        document.body.append(node('qidahen-player-float', rect(0, 0, 640, 60)), node('qidahen-hand-card-shell-first', rect(0, 500, 640, 100)));
        for (const [id, top] of [['source', 400], ['target', 100]] as const) {
            const region = node(`${id}-region`, rect(300, top, 80, 60));
            region.setAttribute('data-qidahen-battle-region-space', id);
            const army = node(`${id}-army`, rect(300, top, 80, 60));
            army.setAttribute('data-qidahen-map-token-region', id);
            document.body.append(region, army);
        }
        const population = node('population', rect(300, 240, 80, 30));
        population.setAttribute('data-qidahen-map-protected-population', 'true');
        document.body.append(population);
        render(<QidahenBattleRollOverlay {...props} layoutReady />);
        const actual = frame();
        expect(actual.top).toBeGreaterThanOrEqual(168);
        expect(actual.bottom).toBeLessThanOrEqual(392);
        expect(actual.left).toBeLessThan(300);
        expect(actual.right).toBeGreaterThan(380);
    });
    it('投掷开始后空间不足转战报，恢复窗口并等待重排也不会从第一阶段重播', async () => {
        sequenceMounts.count = 0;
        const view = mount();
        expect(sequenceMounts.count).toBe(1);
        act(() => {
            Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
            Object.defineProperty(window, 'innerHeight', { configurable: true, value: 180 });
            window.dispatchEvent(new Event('resize'));
        });
        await waitFor(() => expect(view.getByTestId('qidahen-battle-layout-report')).toBeTruthy());
        await act(async () => {
            Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1920 });
            Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1080 });
            window.dispatchEvent(new Event('resize'));
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        expect(view.getByTestId('qidahen-battle-layout-report')).toBeTruthy();
        expect(sequenceMounts.count).toBe(1);
        expect(document.querySelector('[data-testid="real-sequence"]')).toBeNull();
    });
    it('没有可读空位时显示真实战报，只有玩家继续才结束表现', async () => {
        const complete = vi.fn();
        const hudRoot = document.createElement('div');
        hudRoot.id = 'hud-root';
        document.body.append(hudRoot);
        const emergencyMenu = node('fab-menu', rect(256, 8, 56, 56));
        emergencyMenu.style.zIndex = '2402';
        hudRoot.append(emergencyMenu);
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 180 });
        const rolls = { stages: [{ phase: 'infantry', attackerRolls: [{ raw: 6, value: 6, dieSides: 6 }], defenderRolls: [], attackerTotal: 6, attackerDamage: 2 }] } as unknown as QidahenBattleRolls;
        const original = JSON.stringify(rolls);
        const view = render(<QidahenBattleRollOverlay {...props} rolls={rolls} layoutReady={false} onComplete={complete} />);
        expect(view.getByTestId('qidahen-battle-layout-report')).toBeTruthy();
        expect(hudRoot.contains(view.getByTestId('qidahen-battle-layout-report'))).toBe(true);
        const reportStyle = view.getByTestId('qidahen-battle-layout-report').style;
        expect(parseFloat(reportStyle.left) + parseFloat(reportStyle.width)).toBeLessThanOrEqual(248);
        expect(view.getByTestId('qidahen-battle-report').getAttribute('data-report-mode')).toBe('expanded');
        expect(view.getByTestId('qidahen-post-battle-dice-summary').textContent).toContain('6');
        expect(complete).not.toHaveBeenCalled();
        expect(onFrameChange).toHaveBeenCalledWith(null);
        act(() => {
            Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1920 });
            Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1080 });
            window.dispatchEvent(new Event('resize'));
        });
        expect(view.getByTestId('qidahen-battle-layout-report')).toBeTruthy();
        expect(document.querySelector('[data-testid="real-sequence"]')).toBeNull();
        fireEvent.click(view.getByTestId('qidahen-battle-layout-continue'));
        expect(complete).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(rolls)).toBe(original);
    });
    it.each(['qidahen-draw-anchor', 'qidahen-discard-anchor'])('%s迟挂载后仍保留，骰盘重新避让', async anchor => {
        mount(); const current = frame();
        const pile = node(anchor, rect(current.left + 20, current.top + 30, 100, 140));
        expect(overlap(current, pile.getBoundingClientRect())).toBe(true);
        act(() => { document.body.append(pile); });
        await waitFor(() => expect(overlap(frame(), pile.getBoundingClientRect())).toBe(false));
    });
    it('地图先保留真实战场，骰子贴近战场边缘且不会覆盖双方地区', async () => {
        const { map } = mount();
        const battlefield = rect(620, 80, 220, 210);
        const region = node('qidahen-battle-region-space-target', battlefield); region.dataset.qidahenBattleRegionSpace = 'target';
        const troop = node('qidahen-map-token-target', battlefield); troop.dataset.qidahenMapTokenRegion = 'target';
        act(() => { map.append(region, troop); });
        await waitFor(() => expect(overlap(frame(), battlefield)).toBe(false));
        expect(battlefield.left - frame().right).toBeLessThanOrEqual(16);
        expect(onFrameChange).toHaveBeenCalledWith(expect.objectContaining({ left: frame().left, width: frame().width }));
    });
    it('骰子在实际HUD之间保持完整可见，不借地图外空白摆放', () => {
        mount(); const panel = frame();
        expect(panel.left).toBeGreaterThanOrEqual(8); expect(panel.width).toBeGreaterThanOrEqual(240);
        expect(panel.right).toBeLessThanOrEqual(915 - 8);
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
