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
import { Dices, BookOpen, Sparkles } from 'lucide-react';
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
    custom: <Sparkles className="w-[0.9vw] h-[0.9vw]" />,
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

    const visibleActions = passives.flatMap(passive => {
        const usability = actionUsability.get(passive.id) ?? [];
        return passive.actions
            .map((action, actionIndex) => {
                const isUsable = usability[actionIndex] ?? false;
                const isSelecting = rerollSelectingAction?.passiveId === passive.id
                    && rerollSelectingAction?.actionIndex === actionIndex;
                return {
                    passive,
                    action,
                    actionIndex,
                    isUsable,
                    isSelecting,
                };
            })
            .filter(item => item.isUsable || item.isSelecting || item.action.showWhenUnavailable);
    });

    if (visibleActions.length === 0) return null;

    return (
        <div className="w-[10.2vw] min-w-0" data-testid="passive-ability-action-bar">
            <div className="grid min-w-0 grid-cols-2 gap-[0.25vw]">
                {visibleActions.map(({ passive, action, actionIndex, isUsable, isSelecting }) => (
                    <PassiveActionButton
                        key={`${passive.id}-${actionIndex}`}
                        action={action}
                        passiveId={passive.id}
                        actionIndex={actionIndex}
                        passiveName={t(passive.nameKey)}
                        isUsable={isUsable}
                        isSelecting={isSelecting}
                        currentCp={currentCp}
                        onClick={() => {
                            if (isSelecting && onCancelRerollSelect) {
                                onCancelRerollSelect();
                            } else {
                                onActionClick(passive.id, actionIndex);
                            }
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

/** 单个被动动作按钮 */
const PassiveActionButton: React.FC<{
    action: PassiveActionDef;
    passiveId: string;
    actionIndex: number;
    passiveName: string;
    isUsable: boolean;
    isSelecting: boolean;
    currentCp: number;
    onClick: () => void;
}> = ({ action, passiveId, actionIndex, passiveName, isUsable, isSelecting, currentCp, onClick }) => {
    const { t } = useTranslation('game-dicethrone');
    const icon = ACTION_ICON[action.type];
    const label = action.type === 'rerollDie'
        ? t(action.labelKey ?? 'passive.action.reroll')
        : action.type === 'drawCard'
            ? t(action.labelKey ?? 'passive.action.draw')
            : t(action.labelKey ?? action.descriptionKey);
    const tokenCosts = [
        ...(action.tokenCost ? [action.tokenCost] : []),
        ...(action.tokenCosts ?? []),
    ];
    const tokenCostLabel = tokenCosts.length > 0
        ? tokenCosts.map(cost => `${cost.amount} ${t(`tokens.${cost.tokenId}.name`)}`).join(' + ')
        : null;
    const cpCostLabel = action.cpCost > 0 ? `${action.cpCost} CP` : null;
    const costLabel = [cpCostLabel, tokenCostLabel].filter(Boolean).join(' + ');
    const accessibleLabel = `${passiveName}：${isSelecting ? t('passive.action.cancel') : label}${costLabel ? `，${costLabel}` : ''}`;

    return (
        <GameButton
            onClick={onClick}
            data-testid={`passive-action-${passiveId}-${actionIndex}`}
            title={accessibleLabel}
            aria-label={accessibleLabel}
            disabled={!isUsable && !isSelecting}
            variant={isSelecting ? 'danger' : 'glass'}
            size="sm"
            className={`
                !px-[0.28vw] !py-[0.25vw] !min-h-0 !rounded-[0.4vw] flex min-w-0 flex-col items-center gap-[0.05vw] overflow-hidden
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
        </GameButton>
    );
};
