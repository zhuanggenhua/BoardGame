/**
 * 王权骰铸专属终局胜负界面
 *
 * 通过 EndgameOverlay 的 renderContent / renderActions 插槽注入，
 * 展示英雄对决结果面板（肖像、HP/CP、Token 摘要）和街机立体风格按钮。
 *
 * 数据只读：从 HeroState 读取所有展示数据，不引入新的 core 状态字段。
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { ContentSlotProps } from '../../../components/game/framework/widgets/EndgameOverlay';
import type { RematchButtonProps } from '../../../components/game/framework/widgets/RematchActions';
import type { HeroState } from '../domain/types';
import { getDiceThroneCharacterNameKey } from '../domain/types';
import type { PlayerId } from '../../../engine/types';
import { RESOURCE_IDS } from '../domain/resources';
import { getPortraitStyle } from './assets';

// ============================================================================
// 视觉样式常量（街机立体风格色彩系统）
// ============================================================================

const DT_ENDGAME_STYLES = {
    /** 胜利：琥珀金 */
    victory: {
        title: 'bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent',
        glow: 'drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]',
    },
    /** 失败：红色系 */
    defeat: {
        title: 'bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent',
        glow: 'drop-shadow-[0_0_20px_rgba(239,68,68,0.3)]',
    },
    /** 平局：白银 */
    draw: {
        title: 'bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent',
        glow: 'drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]',
    },
    /** 面板背景 */
    panel: 'bg-black/80 backdrop-blur-sm rounded-2xl border border-amber-500/20',
    /** 主按钮（琥珀金立体） */
    primaryButton: 'bg-gradient-to-b from-amber-500 to-amber-700 shadow-[0_4px_0_0_#92400e] active:translate-y-0.5 active:shadow-[0_2px_0_0_#92400e]',
    /** 次要按钮（slate 立体） */
    secondaryButton: 'bg-gradient-to-b from-slate-600 to-slate-700 shadow-[0_4px_0_0_#1e293b] active:translate-y-0.5 active:shadow-[0_2px_0_0_#1e293b]',
} as const;

// ============================================================================
// 动画参数
// ============================================================================

const ENDGAME_ANIMATION = {
    /** 面板入场 */
    panel: {
        initial: { scale: 0.8, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        transition: { type: 'spring' as const, stiffness: 300, damping: 25 },
    },
    /** 英雄肖像交错入场 */
    portrait: {
        staggerDelay: 0.15,
        initial: { scale: 0.5, opacity: 0, y: 20 },
        animate: { scale: 1, opacity: 1, y: 0 },
        transition: { type: 'spring' as const, stiffness: 200, damping: 20 },
    },
    /** 胜负标题 */
    title: {
        delay: 0.3,
        initial: { scale: 0.5, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        transition: { type: 'spring' as const, stiffness: 300, damping: 20 },
    },
} as const;

// ============================================================================
// 类型定义
// ============================================================================

export interface DiceThroneEndgameContentProps extends ContentSlotProps {
    /** 双方玩家状态 */
    players: Record<PlayerId, HeroState>;
    /** 当前视角玩家 ID */
    myPlayerId: string | null;
    /** 当前语言 */
    locale: string;
}

/** 结果视角类型 */
type ResultPerspective = 'victory' | 'defeat' | 'draw' | 'spectator';

// ============================================================================
// 辅助函数
// ============================================================================

/** 根据游戏结果和当前玩家视角判断结果类型 */
function getResultPerspective(
    winners: string[],
    isDraw: boolean,
    myPlayerId: string | null,
): ResultPerspective {
    if (isDraw) return 'draw';
    if (!myPlayerId || winners.length === 0) return 'spectator';
    return winners.includes(String(myPlayerId)) ? 'victory' : 'defeat';
}

/** 获取结果类型对应的样式 */
function getResultStyles(perspective: ResultPerspective) {
    switch (perspective) {
        case 'victory': return DT_ENDGAME_STYLES.victory;
        case 'defeat': return DT_ENDGAME_STYLES.defeat;
        default: return DT_ENDGAME_STYLES.draw;
    }
}

/** 获取非零 Token 列表 */
function getNonZeroTokens(tokens: Record<string, number>): Array<{ id: string; count: number }> {
    return Object.entries(tokens)
        .filter(([, v]) => v > 0)
        .map(([id, count]) => ({ id, count }));
}

// ============================================================================
// 英雄面板子组件
// ============================================================================

interface HeroPanelProps {
    player: HeroState;
    isWinner: boolean;
    isDraw: boolean;
    index: number;
    locale: string;
    t: (key: string, options?: Record<string, unknown>) => string;
}

/** 单个英雄信息面板 */
function HeroPanel({ player, isWinner, isDraw, index, locale, t }: HeroPanelProps) {
    const hp = player.resources[RESOURCE_IDS.HP] ?? 0;
    const cp = player.resources[RESOURCE_IDS.CP] ?? 0;
    const tokens = useMemo(() => getNonZeroTokens(player.tokens ?? {}), [player.tokens]);
    const heroName = t(getDiceThroneCharacterNameKey(player.characterId) ?? 'selection.notSelected');

    // 无障碍标注：描述英雄名称和关键数值
    const heroAriaLabel = t('endgame.ariaHero', { heroName, hp, cp });

    // 胜者/败者/平局的视觉差异（基础结构，2.4 会细化）
    const portraitScale = isDraw ? 'scale-100' : isWinner ? 'scale-110' : 'scale-90 grayscale-[30%] opacity-80';
    const portraitBorder = isDraw
        ? 'border-white/30'
        : isWinner
            ? 'border-amber-400/60 shadow-[0_0_16px_rgba(251,191,36,0.4)]'
            : 'border-slate-500/40';

    return (
        <motion.div
            className="flex flex-col items-center gap-2 max-[1023px]:gap-1"
            aria-label={heroAriaLabel}
            initial={ENDGAME_ANIMATION.portrait.initial}
            animate={ENDGAME_ANIMATION.portrait.animate}
            transition={{
                ...ENDGAME_ANIMATION.portrait.transition,
                delay: index * ENDGAME_ANIMATION.portrait.staggerDelay,
            }}
        >
            {/* 英雄肖像 */}
            <div
                className={`w-20 h-28 rounded-xl border-2 overflow-hidden max-[1023px]:h-20 max-[1023px]:w-14 max-[1023px]:rounded-lg ${portraitBorder} ${portraitScale} transition-transform`}
            >
                <div
                    className="w-full h-full"
                    style={getPortraitStyle(player.characterId, locale)}
                />
            </div>

            {/* 角色名称 */}
            <span className="text-white font-bold text-sm tracking-wide uppercase max-[1023px]:text-[11px]">
                {heroName}
            </span>

            {/* HP / CP 数值 */}
            <div className="flex items-center gap-3 text-xs max-[1023px]:gap-2 max-[1023px]:text-[10px]">
                <span className="text-red-400 font-bold">
                    HP {hp}
                </span>
                <span className="text-amber-400 font-bold">
                    CP {cp}
                </span>
            </div>

            {/* Token 摘要（仅展示非零 Token） */}
            {tokens.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5 mt-1 max-[1023px]:gap-1 max-[1023px]:mt-0">
                    {tokens.map(({ id, count }) => (
                        <span
                            key={id}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 max-[1023px]:text-[9px] max-[1023px]:px-1"
                        >
                            {t(`tokens.${id}.name`)} ×{count}
                        </span>
                    ))}
                </div>
            )}
        </motion.div>
    );
}

// ============================================================================
// 主内容组件
// ============================================================================

/** 王权骰铸终局胜负内容区域（注入 EndgameOverlay 的 renderContent 插槽） */
export function DiceThroneEndgameContent({
    result,
    playerID,
    players,
    myPlayerId,
    locale,
}: DiceThroneEndgameContentProps) {
    const { t } = useTranslation('game-dicethrone');
    const { t: tCommon } = useTranslation('common');

    // 游戏结果解析
    const winner = result?.winner !== undefined ? String(result.winner) : undefined;
    const winners = result?.winners?.map(String) ?? (winner ? [winner] : []);
    const isDraw = result?.draw === true;
    const perspective = getResultPerspective(winners, isDraw, myPlayerId ?? playerID ?? null);
    const resultStyles = getResultStyles(perspective);

    // 获取结果标题文案（使用 common namespace 中已有的翻译）
    const titleText = useMemo(() => {
        switch (perspective) {
            case 'victory': return tCommon('endgame.victory');
            case 'defeat': return tCommon('endgame.defeat');
            case 'draw': return tCommon('endgame.draw');
            case 'spectator': return tCommon('endgame.gameOver');
        }
    }, [perspective, tCommon]);

    // 无障碍标注：描述游戏结果
    const panelAriaLabel = t('endgame.ariaPanel', { result: titleText });

    // 按玩家 ID 排序，确保渲染顺序稳定
    const playerEntries = useMemo(() => {
        return Object.entries(players).sort(([a], [b]) => a.localeCompare(b));
    }, [players]);

    return (
        <motion.div
            className={`flex flex-col items-center gap-5 w-full max-w-lg p-6 pb-8 max-[1023px]:max-w-[30rem] max-[1023px]:gap-2 max-[1023px]:p-3 max-[1023px]:pb-3 ${DT_ENDGAME_STYLES.panel}`}
            initial={ENDGAME_ANIMATION.panel.initial}
            animate={ENDGAME_ANIMATION.panel.animate}
            transition={ENDGAME_ANIMATION.panel.transition}
            data-testid="dt-endgame-content"
            aria-label={panelAriaLabel}
        >
            {/* 胜负标题 */}
            <motion.h2
                className={`text-3xl md:text-4xl font-black tracking-wider uppercase max-[1023px]:text-2xl ${resultStyles.title} ${resultStyles.glow}`}
                initial={ENDGAME_ANIMATION.title.initial}
                animate={ENDGAME_ANIMATION.title.animate}
                transition={{
                    ...ENDGAME_ANIMATION.title.transition,
                    delay: ENDGAME_ANIMATION.title.delay,
                }}
                data-testid="dt-endgame-title"
                data-result={perspective}
            >
                {titleText}
            </motion.h2>

            {/* 英雄对决面板 */}
            <div className="flex items-start justify-center gap-8 w-full max-[1023px]:gap-5">
                    {playerEntries.map(([pid, player], index) => (
                        <HeroPanel
                            key={pid}
                            player={player}
                            isWinner={!isDraw && winners.includes(String(pid))}
                            isDraw={isDraw}
                            index={index}
                            locale={locale}
                            t={t}
                    />
                ))}
            </div>
        </motion.div>
    );
}

// ============================================================================
// 街机立体风格按钮渲染函数
// ============================================================================

/** 王权骰铸风格按钮渲染函数（注入 RematchActions 的 renderButton 插槽） */
export function renderDiceThroneButton(props: RematchButtonProps): React.ReactNode {
    const isPrimary = props.role === 'playAgain' || props.role === 'vote';
    const buttonStyle = isPrimary
        ? DT_ENDGAME_STYLES.primaryButton
        : DT_ENDGAME_STYLES.secondaryButton;

    // 重开中状态：脉冲动画
    if (props.role === 'restarting') {
        return (
            <div
                className={`min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-bold tracking-[0.15em] uppercase text-amber-400 border border-amber-400/40 max-[1023px]:px-3 max-[1023px]:py-2 max-[1023px]:text-xs max-[1023px]:tracking-[0.08em] ${DT_ENDGAME_STYLES.panel} animate-pulse`}
            >
                {props.label}
            </div>
        );
    }

    return (
        <button
            onClick={props.onClick}
            disabled={props.disabled}
            className={`min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-bold tracking-[0.15em] uppercase text-white transition-all max-[1023px]:px-3 max-[1023px]:py-2 max-[1023px]:text-xs max-[1023px]:tracking-[0.08em] ${buttonStyle} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            {props.label}
        </button>
    );
}
