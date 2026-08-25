/**
 * 大杀四方 UI 布局配置 — 响应式缩放
 * 
 * 根据玩家数量动态调整布局参数，确保 2-4 人局都有良好的视觉体验
 */

import { logger } from '../../../lib/logger';

export interface LayoutConfig {
    /** 基地卡片宽度（桌面为 vw，移动端为 board-shell 设计宽度百分比） */
    baseCardWidth: number;
    /** 基地之间的间距（桌面为 vw，移动端为 board-shell 设计宽度百分比） */
    baseGap: number;
    /** 随从卡片宽度（桌面为 vw，移动端为 board-shell 设计宽度百分比） */
    minionCardWidth: number;
    /** 随从卡片堆叠偏移（桌面为 vw，移动端为 board-shell 设计宽度百分比；负值表示重叠） */
    minionStackOffset: number;
    /** 玩家列之间的间距（桌面为 vw，移动端为 board-shell 设计宽度百分比） */
    playerColumnGap: number;
    /** 持续行动卡宽度（桌面为 vw，移动端为 board-shell 设计宽度百分比） */
    ongoingCardWidth: number;
    /** 持续行动卡顶部偏移（桌面为 vw，移动端为 board-shell 设计宽度百分比） */
    ongoingTopOffset: number;
    /** 主战区几何是否使用 board-shell 运行时 inline unit */
    useRuntimeInlineUnit: boolean;
    /** 手牌区域高度（px） */
    handAreaHeight: number;
    /** 顶部提示/横幅偏移（px） */
    hudTopOffset: number;
    /** 交互浮动操作栏距底部偏移（px） */
    floatingActionBottom: number;
    /** 主棋盘顶部内边距（px） */
    boardPaddingTop: number;
    /** 主棋盘左右内边距（px） */
    boardHorizontalPadding: number;
    /** 顶部 HUD 缩放比例 */
    topHudScale: number;
    /** 结束回合区缩放比例 */
    endTurnHudScale: number;
}

export function layoutInlineSize(value: number, layout: Pick<LayoutConfig, 'useRuntimeInlineUnit'>): string {
    if (!layout.useRuntimeInlineUnit) {
        return `${value}vw`;
    }
    const multiplier = Number.isFinite(value) ? Number(value.toFixed(4)) : 0;
    return `calc(var(--mobile-layout-inline-unit, 1vw) * ${multiplier})`;
}

/**
 * 根据玩家数量获取布局配置
 */
export function getLayoutConfig(
    playerCount: number,
    options: { isMobileViewport?: boolean } = {},
): LayoutConfig {
    const { isMobileViewport = false } = options;

    // 边界检查：防止无效输入导致无限递归或错误布局
    if (!Number.isFinite(playerCount) || playerCount < 2 || playerCount > 4) {
        logger.warn('[layoutConfig] playerCount 超出范围，回退到 2 人局布局', { playerCount });
        playerCount = 2;
    }

    switch (playerCount) {
        case 2:
            // 二人局：宽松布局，原始尺寸
            return {
                baseCardWidth: 14,
                baseGap: 6,
                minionCardWidth: 5.5,
                minionStackOffset: -5.5,
                playerColumnGap: 0.5,
                ongoingCardWidth: 3.8,
                ongoingTopOffset: 6,
                useRuntimeInlineUnit: isMobileViewport,
                handAreaHeight: isMobileViewport ? 210 : 220,
                hudTopOffset: isMobileViewport ? 42 : 72,
                floatingActionBottom: isMobileViewport ? 232 : 280,
                boardPaddingTop: isMobileViewport ? 28 : 48,
                boardHorizontalPadding: isMobileViewport ? 28 : 80,
                topHudScale: isMobileViewport ? 0.92 : 1,
                endTurnHudScale: isMobileViewport ? 0.9 : 1,
            };
        case 3:
            // 三人局：适度缩放，缩小间距
            return {
                baseCardWidth: 13,
                baseGap: 2,
                minionCardWidth: 5,
                minionStackOffset: -5,
                playerColumnGap: 0.1,
                ongoingCardWidth: 3.5,
                ongoingTopOffset: 5.5,
                useRuntimeInlineUnit: isMobileViewport,
                handAreaHeight: isMobileViewport ? 192 : 200,
                hudTopOffset: isMobileViewport ? 42 : 72,
                floatingActionBottom: isMobileViewport ? 214 : 260,
                boardPaddingTop: isMobileViewport ? 26 : 48,
                boardHorizontalPadding: isMobileViewport ? 24 : 80,
                topHudScale: isMobileViewport ? 0.86 : 1,
                endTurnHudScale: isMobileViewport ? 0.84 : 1,
            };
        case 4:
            // 四人局：按 Smash Up 的“玩家数 + 1”基地合同，桌面需要同时容纳 5 座基地。
            return {
                baseCardWidth: isMobileViewport ? 11 : 10.2,
                baseGap: 0,
                minionCardWidth: isMobileViewport ? 5 : 4.05,
                minionStackOffset: isMobileViewport ? -5 : -4.05,
                playerColumnGap: 0,
                ongoingCardWidth: isMobileViewport ? 3 : 2.7,
                ongoingTopOffset: 5,
                useRuntimeInlineUnit: isMobileViewport,
                handAreaHeight: isMobileViewport ? 176 : 180,
                hudTopOffset: isMobileViewport ? 40 : 72,
                floatingActionBottom: isMobileViewport ? 196 : 240,
                boardPaddingTop: isMobileViewport ? 24 : 48,
                boardHorizontalPadding: isMobileViewport ? 20 : 80,
                topHudScale: isMobileViewport ? 0.8 : 1,
                endTurnHudScale: isMobileViewport ? 0.78 : 1,
            };
        default:
            // 理论上不会到达这里（已在上方边界检查处理）
            // 为防止边界检查失效，直接返回 2 人局配置而非递归调用
            logger.error('[layoutConfig] 边界检查后仍收到异常 playerCount，回退到 2 人局布局', { playerCount });
            return {
                baseCardWidth: 14,
                baseGap: 12,
                minionCardWidth: 5.5,
                minionStackOffset: -5.5,
                playerColumnGap: 0.5,
                ongoingCardWidth: 3.8,
                ongoingTopOffset: 6,
                useRuntimeInlineUnit: isMobileViewport,
                handAreaHeight: isMobileViewport ? 210 : 220,
                hudTopOffset: isMobileViewport ? 42 : 72,
                floatingActionBottom: isMobileViewport ? 232 : 280,
                boardPaddingTop: isMobileViewport ? 20 : 48,
                boardHorizontalPadding: isMobileViewport ? 28 : 80,
                topHudScale: isMobileViewport ? 0.92 : 1,
                endTurnHudScale: isMobileViewport ? 0.9 : 1,
            };
    }
}

/**
 * 生成响应式 CSS 类名（用于 Tailwind 动态类）
 */
export function getResponsiveClasses(playerCount: number) {
    const config = getLayoutConfig(playerCount);
    
    return {
        baseCard: `w-[${config.baseCardWidth}vw]`,
        baseGap: `gap-[${config.baseGap}vw]`,
        minionCard: `w-[${config.minionCardWidth}vw]`,
        minionStack: `mt-[${config.minionStackOffset}vw]`,
        playerColumn: `gap-[${config.playerColumnGap}vw]`,
        ongoingCard: `w-[${config.ongoingCardWidth}vw]`,
        ongoingTop: `-top-[${config.ongoingTopOffset}vw]`,
        handArea: `h-[${config.handAreaHeight}px]`,
    };
}
