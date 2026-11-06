import React from 'react';
import { createPortal } from 'react-dom';
import type { QidahenBattleRolls } from '../domain/types';
import { getQidahenAvailableMapFrames } from './mapRegionFocus';
import { QidahenBattleRollSequence, type QidahenBattleActor } from './QidahenBattleRollSequence';
import { QidahenBattleReport } from './QidahenBattleReport';
import { useTranslation } from 'react-i18next';
import { getHudPortalRoot, UI_Z_INDEX } from '../../../core';

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
    attacker: QidahenBattleActor;
    defender: QidahenBattleActor;
    onFrameChange: (frame: QidahenBattleDiceFrame | null) => void;
    layoutReady: boolean;
    onComplete: () => void;
}

function measureReportFrame(): QidahenBattleDiceFrame {
    const screen = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    // 游戏应急HUD高于结算层，只为实际位于上层的入口留位。
    const emergencyRects = [...document.querySelectorAll('[data-testid="fab-menu"]')]
        .filter(element => Number(getComputedStyle(element).zIndex) > UI_Z_INDEX.modalContent)
        .map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
    const spaces = getQidahenAvailableMapFrames(screen, emergencyRects, 8);
    spaces.sort((a, b) => b.width * b.height - a.width * a.height);
    const chosen = spaces[0] ?? { left: 8, top: 8, width: Math.max(0, screen.width - 16), height: Math.max(0, screen.height - 16) };
    return { ...chosen, width: Math.min(620, chosen.width) };
}

function BattleLayoutReport({ rolls, attacker, defender, onComplete }: Pick<Props, 'rolls' | 'attacker' | 'defender' | 'onComplete'>) {
    const { t } = useTranslation('game-qidahen');
    const [bounds, setBounds] = React.useState(measureReportFrame);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const [scrollable, setScrollable] = React.useState(false);
    React.useLayoutEffect(() => {
        const content = contentRef.current;
        if (!content) return;
        const measure = () => setScrollable(content.scrollHeight > content.clientHeight);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(content);
        return () => observer.disconnect();
    }, [bounds, rolls, t]);
    React.useLayoutEffect(() => {
        const measure = () => setBounds(measureReportFrame());
        const observer = new MutationObserver(measure);
        for (const element of document.querySelectorAll('[data-testid="fab-menu"]')) observer.observe(element, { attributes: true, attributeFilter: ['style'] });
        window.addEventListener('resize', measure);
        return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
    }, []);
    return createPortal(<section role="alert" data-testid="qidahen-battle-layout-report"
        className="fixed flex flex-col overflow-hidden rounded-lg border border-amber-200 bg-[#4e2117] p-3 text-amber-50 [--spacing:4px]"
        style={{ zIndex: UI_Z_INDEX.modalContent, left: bounds.left, top: bounds.top, width: bounds.width, maxHeight: bounds.height }}>
        <header className="flex shrink-0 flex-wrap items-center gap-x-2 text-sm leading-5">
            <span>{attacker.name} → {defender.name}</span><span>{t('board.battleRoll.layoutUnavailable')}</span>
        </header>
        {scrollable ? <p className="shrink-0 text-xs leading-4">{t('board.battleRoll.scrollReport')}</p> : null}
        <div ref={contentRef} tabIndex={0} aria-label={t('board.battleRoll.report')}
            data-testid="qidahen-battle-layout-report-content" className="min-h-0 overflow-y-auto"
            style={{ scrollbarGutter: 'stable', scrollbarColor: '#eadab5 #5a2f20' }}>
            <QidahenBattleReport battleRolls={rolls} compact />
        </div>
        <button type="button" data-testid="qidahen-battle-layout-continue" className="mt-2 min-h-11 shrink-0 rounded border border-amber-200 px-4 py-1 text-sm" onClick={onComplete}>
            {t('board.battleRoll.continueResolution')}
        </button>
    </section>, getHudPortalRoot() ?? document.body);
}

/** 战斗是当前结算主体，在地图空位投掷；双方军队、手牌和常驻HUD保持可见。 */
export function QidahenBattleRollOverlay({ onFrameChange, layoutReady, ...sequence }: Props) {
    const [frame, setFrame] = React.useState<QidahenBattleDiceFrame | null>(null);
    const [spaceUnavailable, setSpaceUnavailable] = React.useState(false);
    // 外层以战斗身份挂载；播放开始后，重排只改布局，不卸载物理序列重投。
    const [started, setStarted] = React.useState(false);
    React.useLayoutEffect(() => { if (layoutReady) setStarted(true); }, [layoutReady]);
    React.useLayoutEffect(() => {
        // 本次表现改为战报后由玩家确认退出，窗口恢复不重新挂载并重播骰子。
        if (spaceUnavailable) return;
        const measure = () => {
            const protectedRects = QIDAHEN_BATTLE_HUD_SELECTORS.flatMap(selector => [...document.querySelectorAll(selector)])
                .map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
            const screen = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
            const regionIds = new Set([...document.querySelectorAll('[data-qidahen-battle-region-space]')]
                .map(element => element.getAttribute('data-qidahen-battle-region-space')));
            // 人口此时不参与交战决策，不用它占满双方兵牌之间的投掷空地。
            const regions = [...document.querySelectorAll('[data-qidahen-map-token-region]')]
                .filter(element => regionIds.has(element.getAttribute('data-qidahen-map-token-region')))
                .map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
            const battlefield = regions.length ? {
                left: Math.min(...regions.map(rect => rect.left)), top: Math.min(...regions.map(rect => rect.top)),
                right: Math.max(...regions.map(rect => rect.right)), bottom: Math.max(...regions.map(rect => rect.bottom)),
            } : null;
            const spaces = getQidahenAvailableMapFrames(screen, [...protectedRects, ...regions], 8)
                .filter(rect => rect.width >= 240 && rect.height >= 220);
            const candidates = spaces.map(space => {
                const width = Math.min(420, space.width), height = Math.min(300, space.height);
                const centerX = battlefield ? (battlefield.left + battlefield.right) / 2 : innerWidth / 2;
                const centerY = battlefield ? (battlefield.top + battlefield.bottom) / 2 : innerHeight / 2;
                const left = Math.max(space.left, Math.min(space.left + space.width - width, centerX - width / 2));
                const top = Math.max(space.top, Math.min(space.top + space.height - height, centerY - height / 2));
                const distance = battlefield ? Math.hypot(
                    Math.max(battlefield.left - left - width, left - battlefield.right, 0),
                    Math.max(battlefield.top - top - height, top - battlefield.bottom, 0)) : 0;
                return { left, top, width, height, distance };
            });
            // 地图先安置真实战场；骰子贴该战场的可用边缘，不再反推地图腾空。
            candidates.sort((a, b) => a.distance - b.distance || b.width * b.height - a.width * a.height);
            const chosen = candidates[0];
            if (!chosen) {
                setFrame(null);
                setSpaceUnavailable(true);
                return;
            }
            const { distance: _distance, ...next } = chosen;
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
        const mapTransformObserver = new MutationObserver(scheduleMeasure);
        const mapContent = document.querySelector('[data-testid="qidahen-map-content"]');
        if (mapContent) mapTransformObserver.observe(mapContent, { attributes: true, attributeFilter: ['style'] });
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
            mutationObserver.disconnect(); mapTransformObserver.disconnect(); resizeObserver.disconnect();
        };
    }, [spaceUnavailable]);
    React.useLayoutEffect(() => { onFrameChange(frame); }, [frame, onFrameChange]);
    React.useLayoutEffect(() => () => onFrameChange(null), [onFrameChange]);
    if (spaceUnavailable) return <BattleLayoutReport {...sequence} />;
    return frame ? createPortal(<div data-testid="qidahen-battle-roll-overlay" className="pointer-events-none fixed z-[170] [--spacing:4px]"
        style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height, '--qidahen-battle-panel-height': `${frame.height}px` } as React.CSSProperties}>
        {started ? <QidahenBattleRollSequence {...sequence} /> : null}
    </div>, document.body) : null;
}
