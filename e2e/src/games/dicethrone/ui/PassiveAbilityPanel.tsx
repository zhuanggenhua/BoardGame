/**
 * 被动能力面板
 *
 * 显示英雄的被动能力动作按钮（如教皇税的重掷/抽牌）。
 * 放置在骰子区域附近，支持两种交互模式：
 * - 抽牌：直接点击执行
 * - 重掷骰子：点击后进入骰子选择模式，选中骰子后执行
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dices, BookOpen } from 'lucide-react';
import { GameButton } from './components/GameButton';
import type { PassiveAbilityDef, PassiveActionDef } from '../domain/passiveAbility';

export interface PassiveAbilityPanelProps {
    /** 当前玩家的被动能力列表 */
    passives: PassiveAbilityDef[];
    /** 各动作是否可用（passiveId -> actionIndex -> boolean） */
    actionUsability: Map<string, boolean[]>;
    /** 玩家当前 CP */
    currentCp: number;
    /** 当前是否处于重掷选择模式 */
    rerollSelectingAction?: { passiveId: string; actionIndex: number } | null;
    /** 点击动作按钮 */
    onActionClick: (passiveId: string, actionIndex: number) => void;
    /** 取消重掷选择 */
    onCancelRerollSelect?: () => void;
}

/** 动作类型对应的图标 */
const ACTION_ICON: Record<string, React.ReactNode> = {
    rerollDie: <Dices className="w-[0.9vw] h-[0.9vw]" />,
    drawCard: <BookOpen className="w-[0.9vw] h-[0.9vw]" />,
};

export const PassiveAbilityPanel: React.FC<PassiveAbilityPanelProps> = ({
    passives,
    actionUsability,
    currentCp,
    rerollSelectingAction,
    onActionClick,
    onCancelRerollSelect,
}) => {
    const { t } = useTranslation('game-dicethrone');

    if (passives.length === 0) return null;

    return (
        <div className="w-[10.2vw] min-w-0 flex flex-col gap-[0.3vw]">
            {passives.map(passive => {
                const usability = actionUsability.get(passive.id) ?? [];
                return (
                    <div key={passive.id} className="flex min-w-0 flex-col gap-[0.25vw]">
                        {/* 被动能力名称 */}
                        <div className="truncate text-center text-[0.55vw] font-bold uppercase tracking-wider text-emerald-400/80">
                            {t(passive.nameKey)}
                        </div>
                        {/* 动作按钮 */}
                        <div className="grid min-w-0 grid-cols-2 gap-[0.3vw]">
                            {passive.actions.map((action, idx) => {
                                const isUsable = usability[idx] ?? false;
                                const isSelecting = rerollSelectingAction?.passiveId === passive.id
                                    && rerollSelectingAction?.actionIndex === idx;

                                return (
                                    <PassiveActionButton
                                        key={idx}
                                        action={action}
                                        isUsable={isUsable}
                                        isSelecting={isSelecting}
                                        currentCp={currentCp}
                                        onClick={() => {
                                            if (isSelecting && onCancelRerollSelect) {
                                                onCancelRerollSelect();
                                            } else {
                                                onActionClick(passive.id, idx);
                                            }
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

/** 单个被动动作按钮 */
const PassiveActionButton: React.FC<{
    action: PassiveActionDef;
    isUsable: boolean;
    isSelecting: boolean;
    currentCp: number;
    onClick: () => void;
}> = ({ action, isUsable, isSelecting, currentCp, onClick }) => {
    const { t } = useTranslation('game-dicethrone');
    const icon = ACTION_ICON[action.type];
    const notEnoughCp = currentCp < action.cpCost;
    const label = action.type === 'rerollDie'
        ? t('passive.action.reroll')
        : t('passive.action.draw');

    return (
        <GameButton
            onClick={onClick}
            disabled={!isUsable && !isSelecting}
            variant={isSelecting ? 'danger' : 'glass'}
            size="sm"
            className={`
                !px-[0.3vw] !py-[0.35vw] !min-h-0 !rounded-[0.4vw] flex min-w-0 flex-col items-center gap-[0.1vw] overflow-hidden
                ${isSelecting ? 'ring-[0.15vw] ring-amber-400 animate-pulse' : ''}
                ${isUsable && !isSelecting ? 'hover:!bg-emerald-500/20 hover:border-emerald-400/50' : ''}
            `}
        >
            <div className="flex min-w-0 items-center gap-[0.2vw]">
                {icon}
                <span className="truncate whitespace-nowrap !text-[0.6vw] font-bold">
                    {isSelecting ? t('passive.action.cancel') : label}
                </span>
            </div>
            <span className={`truncate whitespace-nowrap !text-[0.5vw] ${notEnoughCp ? 'text-red-400' : 'text-amber-300'}`}>
                {action.cpCost} CP
            </span>
        </GameButton>
    );
};
