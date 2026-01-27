/**
 * 技能特写队列组件
 *
 * 用于展示其他玩家激活的技能，支持队列显示。
 * 根据技能等级显示对应的升级卡图片（II级/III级），否则显示基础技能图片。
 * 无遮罩、无虚化背景。
 *
 * 若该技能触发了额外骰子投掷，可在右侧同时展示骰子动画。
 */

import React from 'react';
import { buildLocalizedImageSet } from '../../../core';
import { ASSETS } from './assets';
import type { CardAtlasConfig } from './cardAtlas';
import { getCardAtlasStyle } from './cardAtlas';
import type { DieFace } from '../types';
import SpotlightContainer from './SpotlightContainer';
import BonusDieSpotlightContent from './BonusDieSpotlightContent';
import { MONK_CARDS } from '../monk/cards';

/** 特写队列项 */
export interface AbilitySpotlightItem {
    /** 唯一标识（通常用 abilityId + timestamp） */
    id: string;
    /** 该技能激活的时间戳（用于关联额外骰子） */
    timestamp: number;
    /** 技能 ID */
    abilityId: string;
    /** 技能等级（1=基础, 2=II级, 3=III级） */
    level: number;
    /** 激活技能的玩家 ID */
    playerId: string;
    /** 激活技能的玩家名称 */
    playerName?: string;
    /** 是否为防御技能 */
    isDefense?: boolean;
    /** 若该技能触发了额外骰子，附带骰子信息（支持多颗骰子） */
    bonusDice?: Array<{
        value: number;
        face?: DieFace;
        timestamp: number;
    }>;
}

interface AbilitySpotlightOverlayProps {
    /** 特写队列 */
    queue: AbilitySpotlightItem[];
    /** 卡牌图集配置 */
    atlas: CardAtlasConfig | null;
    /** 语言 */
    locale?: string;
    /** 当前项关闭回调（从队列中移除） */
    onClose: (id: string) => void;
    /** 对手悬浮窗元素引用（用于计算起始位置） */
    opponentHeaderRef?: React.RefObject<HTMLElement | null>;
    /** 自动关闭延迟（毫秒），默认 3000 */
    autoCloseDelay?: number;
}

/**
 * 从卡牌定义中动态查找升级卡的 atlasIndex
 * @param abilityId 目标技能 ID（基础 ID，不带后缀）
 * @param level 升级后的等级
 * @returns 对应升级卡的 atlasIndex，未找到返回 undefined
 */
const getUpgradeCardAtlasIndex = (abilityId: string, level: number): number | undefined => {
    // 去掉后缀得到基础 ID
    const baseAbilityId = abilityId.replace(/(-\d+)+$/, '');
    
    for (const card of MONK_CARDS) {
        if (card.type !== 'upgrade' || !card.effects) continue;
        for (const effect of card.effects) {
            const action = effect.action;
            if (
                action?.type === 'replaceAbility' &&
                action.targetAbilityId === baseAbilityId &&
                action.newAbilityLevel === level
            ) {
                return card.atlasIndex;
            }
        }
    }
    return undefined;
};

/**
 * 获取技能对应的基础技能槽图集位置
 */
const ABILITY_SLOT_INDEX_MAP: Record<string, number> = {
    // 基础技能槽索引（对应 ability_cards.webp 的 3x3 网格）
    'fist-technique': 0,
    'zen-forget': 1,
    'harmony': 2,
    'lotus-palm': 3,
    'taiji-combo': 4,
    'thunder-strike': 5,
    'calm-water': 6,
    'meditation': 7,
    'transcendence': 8,
};

export const AbilitySpotlightOverlay: React.FC<AbilitySpotlightOverlayProps> = ({
    queue,
    atlas,
    locale,
    onClose,
    opponentHeaderRef,
    autoCloseDelay = 3000,
}) => {
    const currentItem = queue[0];
    const currentItemId = currentItem?.id;
    const cardFrontImage = React.useMemo(() => buildLocalizedImageSet(ASSETS.CARDS_ATLAS, locale), [locale]);
    const abilityCardsImage = React.useMemo(() => buildLocalizedImageSet(ASSETS.ABILITY_CARDS_BASE, locale), [locale]);

    // NOTE: eslint (react-hooks/refs) forbids reading refs during render.
    // We compute the fly-in start position in a layout effect and only render once it's ready for the current item.
    const [startPos, setStartPos] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [startPosForId, setStartPosForId] = React.useState<string | null>(null);

    React.useLayoutEffect(() => {
        if (!currentItemId) {
            setStartPosForId(null);
            return;
        }

        let pos = { x: 0, y: -window.innerHeight * 0.3 };
        if (opponentHeaderRef?.current) {
            const rect = opponentHeaderRef.current.getBoundingClientRect();
            pos = {
                x: rect.left + rect.width / 2 - window.innerWidth / 2,
                y: rect.top + rect.height / 2 - window.innerHeight / 2,
            };
        }

        setStartPos(pos);
        setStartPosForId(currentItemId);
    }, [currentItemId, opponentHeaderRef]);

    if (!currentItem || startPosForId !== currentItemId) {
        return null;
    }

    // 去掉后缀得到基础 ID
    const baseAbilityId = currentItem.abilityId.replace(/(-\d+)+$/, '');
    const level = currentItem.level;
    
    // 如果有升级（level > 1），尝试获取升级卡图集索引
    const upgradeAtlasIndex = level > 1 ? getUpgradeCardAtlasIndex(baseAbilityId, level) : undefined;
    
    // 是否使用卡牌图集（有升级卡）
    const useCardAtlas = upgradeAtlasIndex !== undefined && atlas;
    
    // 基础技能槽索引
    const slotIndex = ABILITY_SLOT_INDEX_MAP[baseAbilityId] ?? 0;
    const slotCol = slotIndex % 3;
    const slotRow = Math.floor(slotIndex / 3);
    
    const hasBonusDice = !!currentItem.bonusDice && currentItem.bonusDice.length > 0;

    return (
        <SpotlightContainer
            id={currentItem.id}
            isVisible={true}
            onClose={() => onClose(currentItem.id)}
            autoCloseDelay={autoCloseDelay}
            zIndex={9997}
            contentMotion={{
                initial: { x: startPos.x, y: startPos.y, scale: 0.2, opacity: 0 },
                animate: { x: 0, y: '-10vh', scale: 1, opacity: 1 },
                exit: { scale: 0.8, opacity: 0 },
                transition: { type: 'spring', stiffness: 200, damping: 25 },
            }}
        >
            <div className={hasBonusDice ? 'flex items-center gap-[1.5vw]' : undefined}>
                {/* 技能图片（左） */}
                {useCardAtlas ? (
                    // 升级卡：使用卡牌图集
                    <div
                        className="w-[16vw] aspect-[0.61] rounded-[0.6vw] shadow-2xl border-2 border-amber-500/60"
                        style={{
                            backgroundImage: cardFrontImage,
                            backgroundRepeat: 'no-repeat',
                            ...getCardAtlasStyle(upgradeAtlasIndex!, atlas),
                            boxShadow: '0 0 1.5vw 0.3vw rgba(251, 191, 36, 0.4)',
                        }}
                    />
                ) : (
                    // 基础技能：使用技能槽图集
                    <div
                        className="w-[16vw] aspect-square rounded-[0.6vw] shadow-2xl border-2 border-amber-500/60"
                        style={{
                            backgroundImage: abilityCardsImage,
                            backgroundSize: '300% 300%',
                            backgroundPosition: `${slotCol * 50}% ${slotRow * 50}%`,
                            boxShadow: '0 0 1.5vw 0.3vw rgba(251, 191, 36, 0.4)',
                        }}
                    />
                )}

                {/* 额外骰子（右）- 支持多颗骰子横向排列 */}
                {hasBonusDice && (
                    <div className="flex items-center gap-[1vw] relative z-[1]">
                        {currentItem.bonusDice!.map((die, index) => (
                            <BonusDieSpotlightContent
                                key={`${die.timestamp}-${index}`}
                                value={die.value}
                                face={die.face}
                                locale={locale}
                                size="10vw"
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* 队列指示器 */}
            {queue.length > 1 && (
                <div className="absolute bottom-[-2vw] flex items-center gap-[0.4vw]">
                    {queue.map((item, index) => (
                        <div
                            key={item.id}
                            className={`w-[0.5vw] h-[0.5vw] rounded-full transition-colors ${
                                index === 0 ? 'bg-amber-400' : 'bg-slate-500'
                            }`}
                        />
                    ))}
                </div>
            )}
        </SpotlightContainer>
    );
};

export default AbilitySpotlightOverlay;
