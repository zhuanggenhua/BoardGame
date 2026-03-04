/**
 * 卡牌特写队列组件
 *
 * 用于展示其他玩家打出的卡牌，支持队列显示。
 * 无遮罩、无虚化背景。
 *
 * 若该卡牌触发了额外骰子投掷，可在右侧同时展示骰子动画。
 */

import React from 'react';
import { CardPreview } from '../../../components/common/media/CardPreview';
import type { CardPreviewRef } from '../../../core';
import { UI_Z_INDEX } from '../../../core';
import type { DieFace } from '../types';
import SpotlightContainer from './SpotlightContainer';
import BonusDieSpotlightContent from './BonusDieSpotlightContent';

/** 特写队列项 */
export interface CardSpotlightItem {
    /** 唯一标识（通常用 cardId + timestamp） */
    id: string;
    /** 该卡牌打出的时间戳（用于关联额外骰子） */
    timestamp: number;
    /** 卡牌预览引用 */
    previewRef?: CardPreviewRef;
    /** 打出卡牌的玩家 ID */
    playerId: string;
    /** 打出卡牌的玩家名称 */
    playerName?: string;
    /** 若该卡牌触发了额外骰子，附带骰子信息（支持多颗骰子） */
    bonusDice?: Array<{
        value: number;
        face?: DieFace;
        timestamp: number;
        effectKey?: string;
        effectParams?: Record<string, string | number>;
        /** 骰子所属角色（用于图集选择） */
        characterId?: string;
    }>;
}


interface CardSpotlightOverlayProps {
    /** 特写队列 */
    queue: CardSpotlightItem[];
    /** 语言 */
    locale?: string;
    /** 当前项关闭回调（从队列中移除） */
    onClose: (id: string) => void;
    /** 对手悬浮窗元素引用（用于计算起始位置） */
    opponentHeaderRef?: React.RefObject<HTMLElement | null>;
    /** 自动关闭延迟（毫秒），默认 3000 */
    autoCloseDelay?: number;
}

export const CardSpotlightOverlay: React.FC<CardSpotlightOverlayProps> = ({
    queue,
    locale,
    onClose,
    opponentHeaderRef,
    autoCloseDelay = 3000,
}) => {
    const currentItem = queue[0];
    const currentItemId = currentItem?.id;

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
    const hasBonusDice = !!currentItem.bonusDice && currentItem.bonusDice.length > 0;


    return (
        <SpotlightContainer
            id={currentItem.id}
            isVisible={true}
            onClose={() => onClose(currentItem.id)}
            autoCloseDelay={autoCloseDelay}
            zIndex={UI_Z_INDEX.overlayRaised}
            contentMotion={{
                initial: { x: startPos.x, y: startPos.y, scale: 0.2, opacity: 0 },
                animate: { x: 0, y: '-10vh', scale: 1, opacity: 1 },
                exit: { scale: 0.8, opacity: 0 },
                transition: { type: 'spring', stiffness: 200, damping: 25 },
            }}
        >
            <div className={hasBonusDice ? 'flex items-center gap-[1.5vw]' : undefined}>
                {/* 卡牌（左） */}
                <CardPreview
                    previewRef={currentItem.previewRef}
                    locale={locale}
                    className="w-[16vw] aspect-[0.61] rounded-[0.6vw] shadow-2xl border-2 border-amber-500/60"
                    style={{ boxShadow: '0 0 1.5vw 0.3vw rgba(251, 191, 36, 0.4)' }}
                />

                {/* 额外骰子（右）- 支持多颗骰子横向排列 */}
                {hasBonusDice && (
                    <div className="flex items-center gap-[1vw] relative z-[1]">
                        {currentItem.bonusDice!.map((die, index) => (
                            <BonusDieSpotlightContent
                                key={`${die.timestamp}-${index}`}
                                value={die.value}
                                face={die.face}
                                effectKey={die.effectKey}
                                effectParams={die.effectParams}
                                locale={locale}
                                size="10vw"
                                characterId={die.characterId}
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
                            className={`w-[0.5vw] h-[0.5vw] rounded-full transition-colors ${index === 0 ? 'bg-amber-400' : 'bg-slate-500'
                                }`}
                        />
                    ))}
                </div>
            )}
        </SpotlightContainer>
    );
};

export default CardSpotlightOverlay;
