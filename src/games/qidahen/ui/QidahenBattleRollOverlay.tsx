import React from 'react';
import { createPortal } from 'react-dom';
import type { QidahenBattleRolls } from '../domain/types';
import { getQidahenAvailableMapFrames } from './mapRegionFocus';
import { QidahenBattleRollSequence } from './QidahenBattleRollSequence';

export type QidahenBattleDiceFrame = { left: number; top: number; width: number; height: number };
/** 骰盘排座与地图取景共用常驻界面的实际占位。 */
export const QIDAHEN_BATTLE_HUD_SELECTORS = [
    '[data-testid="qidahen-player-float"]', '[data-testid^="qidahen-hand-card-shell-"]',
    '[data-testid="qidahen-chronology-zone"]', '[data-testid="qidahen-korea-zone"]',
    '[data-testid="qidahen-action-wheel"]', '[data-testid="qidahen-draw-anchor"]', '[data-testid="qidahen-discard-anchor"]',
    '[data-testid="fab-menu"]', '[data-testid="qidahen-map-viewport-controls"]',
];
interface Props {
    rolls: QidahenBattleRolls;
    sourceName: string;
    targetName: string;
    onFrameChange: (frame: QidahenBattleDiceFrame | null) => void;
    layoutReady: boolean;
    onComplete: () => void;
}

/** 战斗是当前结算主体，在地图空位投掷；双方军队、手牌和常驻HUD保持可见。 */
export function QidahenBattleRollOverlay({ onFrameChange, layoutReady, ...sequence }: Props) {
    const [frame, setFrame] = React.useState<QidahenBattleDiceFrame | null>(null);
    // 外层以战斗身份挂载；播放开始后，重排只改布局，不卸载物理序列重投。
    const [started, setStarted] = React.useState(false);
    React.useLayoutEffect(() => { if (layoutReady) setStarted(true); }, [layoutReady]);
    React.useLayoutEffect(() => {
        const measure = () => {
            const protectedRects = QIDAHEN_BATTLE_HUD_SELECTORS.flatMap(selector => [...document.querySelectorAll(selector)])
                .map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
            const screen = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
            const frames = getQidahenAvailableMapFrames(screen, protectedRects, 8).filter(rect => rect.width >= 240 && rect.height >= 228);
            frames.sort((a, b) => Math.min(b.width, 620) * Math.min(b.height, 370) - Math.min(a.width, 620) * Math.min(a.height, 370));
            const space = frames[0];
            if (!space) throw new Error('Battle dice have no readable map space between the persistent HUD elements');
            // 骰盘先占空位的一侧，另一侧交给唯一地图镜头安排交战双方。
            const width = Math.min(620, Math.max(240, space.width * 0.45));
            const height = Math.min(370, space.height);
            const next = { left: space.left, top: space.top + (space.height - height) / 2, width, height };
            setFrame(current => current && current.left === next.left && current.top === next.top && current.width === next.width && current.height === next.height ? current : next);
        };
        measure();
        let measurementFrame = 0;
        const scheduleMeasure = () => {
            window.cancelAnimationFrame(measurementFrame);
            measurementFrame = window.requestAnimationFrame(measure);
        };
        const mutationObserver = new MutationObserver(scheduleMeasure);
        mutationObserver.observe(document.body, { childList: true, subtree: true });
        const resizeObserver = new ResizeObserver(scheduleMeasure);
        for (const selector of ['[data-testid="qidahen-map-layer"]', '[data-testid="qidahen-player-float"]', '[data-testid="qidahen-hand-zone"]']) {
            document.querySelectorAll(selector).forEach(element => resizeObserver.observe(element));
        }
        window.addEventListener('resize', scheduleMeasure);
        document.addEventListener('scroll', scheduleMeasure, true);
        return () => {
            window.removeEventListener('resize', scheduleMeasure);
            document.removeEventListener('scroll', scheduleMeasure, true);
            window.cancelAnimationFrame(measurementFrame);
            mutationObserver.disconnect(); resizeObserver.disconnect();
        };
    }, []);
    React.useLayoutEffect(() => { onFrameChange(frame); }, [frame, onFrameChange]);
    React.useLayoutEffect(() => () => onFrameChange(null), [onFrameChange]);
    return frame ? createPortal(<div data-testid="qidahen-battle-roll-overlay" className="pointer-events-none fixed z-[170] [--spacing:4px]"
        style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height, '--qidahen-battle-panel-height': `${frame.height}px` } as React.CSSProperties}>
        {started ? <QidahenBattleRollSequence {...sequence} /> : null}
    </div>, document.body) : null;
}
