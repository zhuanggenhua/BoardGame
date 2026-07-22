/**
 * AttackShowcaseOverlay 组件
 *
 * 防御阶段开始时，特写展示对方使用的进攻技能。
 * - 升级技能（level > 1）：展示升级卡图
 * - 基础技能（level 1）：从对方玩家面板裁切对应技能区域
 * 点击"继续"后关闭，开始正常防御流程。
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Swords } from 'lucide-react';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { buildLocalizedImageSet, HudPortal, UI_Z_INDEX } from '../../../core';
import { GameButton } from './components/GameButton';
import { ASSETS } from './assets';
import {
    getAbilitySlotLayoutForCharacter,
    getPlayerBoardAspectRatio,
} from './abilitySlotLayout';
import type { AttackShowcaseData } from '../hooks/useAttackShowcase';

interface AttackShowcaseOverlayProps {
    /** 特写数据 */
    data: AttackShowcaseData;
    /** 展示模式 */
    mode?: 'defensive-entry' | 'offensive-preview' | null;
    /** 语言 */
    locale?: string;
    /** 对手名称 */
    opponentName: string;
    /** 自动关闭时长，null 表示仅手动关闭 */
    autoDismissMs?: number | null;
    /** 关闭回调 */
    onDismiss: () => void;
}

function buildCardFrameStyle(width: string, aspectRatio: number): React.CSSProperties {
    return {
        width,
        height: `calc(${width} / ${aspectRatio})`,
        aspectRatio: `${aspectRatio} / 1`,
    };
}

/**
 * 根据槽位百分比和面板宽高比，计算槽位的实际宽高比
 */
function getSlotAspectRatio(slot: { w: number; h: number }, playerBoardAspectRatio: number): number {
    // 槽位像素宽 = boardWidth × (slot.w / 100)
    // 槽位像素高 = boardHeight × (slot.h / 100)
    // ratio = pixelW / pixelH = (boardW × slot.w) / (boardH × slot.h) = ASPECT × slot.w / slot.h
    return playerBoardAspectRatio * slot.w / slot.h;
}

/**
 * 从玩家面板裁切技能区域
 * 利用 abilitySlotLayout 的百分比坐标，用 CSS background-position + background-size 实现
 */
const AbilitySlotCrop: React.FC<{
    characterId: string;
    playerBoardFace?: AttackShowcaseData['attackerPlayerBoardFace'];
    slotId: string;
    locale?: string;
}> = ({ characterId, playerBoardFace, slotId, locale }) => {
    const slot = getAbilitySlotLayoutForCharacter(characterId).find(s => s.id === slotId);
    if (!slot) return null;

    const boardPath = ASSETS.PLAYER_BOARD(characterId, playerBoardFace);
    const backgroundImage = buildLocalizedImageSet(boardPath, locale);

    // 将百分比坐标转换为 background-position 和 background-size
    // slot.x, slot.y 是左上角百分比；slot.w, slot.h 是宽高百分比
    const bgSizeX = (100 / slot.w) * 100;
    const bgSizeY = (100 / slot.h) * 100;
    const bgPosX = slot.w < 100 ? (slot.x / (100 - slot.w)) * 100 : 0;
    const bgPosY = slot.h < 100 ? (slot.y / (100 - slot.h)) * 100 : 0;

    return (
        <div
            className="w-full h-full rounded-[0.6vw]"
            style={{
                backgroundImage,
                backgroundSize: `${bgSizeX}% ${bgSizeY}%`,
                backgroundPosition: `${bgPosX}% ${bgPosY}%`,
                backgroundRepeat: 'no-repeat',
            }}
        />
    );
};

export const AttackShowcaseOverlay: React.FC<AttackShowcaseOverlayProps> = ({
    data,
    mode = 'defensive-entry',
    locale,
    opponentName: _opponentName,
    autoDismissMs = null,
    onDismiss,
}) => {
    const { t } = useTranslation('game-dicethrone');
    const hasUpgradeCard = Boolean(data.upgradePreviewRef);
    const layout = getAbilitySlotLayoutForCharacter(data.attackerCharacterId);
    const playerBoardAspectRatio = getPlayerBoardAspectRatio(data.attackerCharacterId);

    // 根据槽位数据动态计算宽高比
    const slot = data.slotId
        ? layout.find(s => s.id === data.slotId)
        : null;
    const slotAspect = slot ? getSlotAspectRatio(slot, playerBoardAspectRatio) : 0.66;
    const isUltimate = data.slotId === 'ultimate';

    // 升级卡用卡牌比例 0.61；基础技能用槽位实际比例
    const containerStyle: React.CSSProperties = hasUpgradeCard
        ? buildCardFrameStyle('20vw', 0.61)
        : isUltimate
            ? buildCardFrameStyle('28vw', slotAspect)
            : buildCardFrameStyle('16vw', slotAspect);
    const title = mode === 'offensive-preview'
        ? t('attackShowcase.previewTitle')
        : t('attackShowcase.title');
    const dismissLabel = mode === 'offensive-preview'
        ? t('attackShowcase.previewContinue')
        : t('attackShowcase.continue');

    React.useEffect(() => {
        if (!autoDismissMs || autoDismissMs <= 0) return;
        const timer = window.setTimeout(() => onDismiss(), autoDismissMs);
        return () => window.clearTimeout(timer);
    }, [autoDismissMs, onDismiss]);

    return (
        <HudPortal>
            <AnimatePresence>
                <motion.div
                    key="attack-showcase"
                    data-testid="attack-showcase-overlay"
                    data-showcase-mode={mode ?? undefined}
                    data-source-ability-id={data.sourceAbilityId}
                    className="fixed inset-0 flex items-center justify-center"
                    style={{ zIndex: UI_Z_INDEX.overlayRaised + 10 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {/* 半透明遮罩 */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                    {/* 内容 */}
                    <motion.div
                        className="relative flex flex-col items-center gap-[1.5vw]"
                        initial={{ y: -40, scale: 0.85, opacity: 0 }}
                        animate={{ y: 0, scale: 1, opacity: 1 }}
                        exit={{ y: 20, scale: 0.9, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
                    >
                        {/* 标题 */}
                        <div className="flex items-center gap-[0.6vw] text-red-400">
                            <Swords className="w-[1.8vw] h-[1.8vw]" />
                            <span className="text-[1.4vw] font-black tracking-wider uppercase">
                                {title}
                            </span>
                            <Swords className="w-[1.8vw] h-[1.8vw] scale-x-[-1]" />
                        </div>

                        {/* 技能展示区域 */}
                        <div
                            className="relative overflow-hidden rounded-[0.8vw] border-2 border-red-500/60 shadow-[0_0_2vw_rgba(239,68,68,0.5),0_0_4vw_rgba(239,68,68,0.2)]"
                            style={containerStyle}
                        >
                            {hasUpgradeCard ? (
                                <CardPreview
                                    previewRef={data.upgradePreviewRef}
                                    locale={locale}
                                    className="w-full h-full"
                                />
                            ) : data.slotId ? (
                                <AbilitySlotCrop
                                    characterId={data.attackerCharacterId}
                                    playerBoardFace={data.attackerPlayerBoardFace}
                                    slotId={data.slotId}
                                    locale={locale}
                                />
                            ) : (
                                // 无法定位技能槽时的 fallback：显示技能名称
                                <div className="w-full h-full bg-slate-800/80 flex items-center justify-center">
                                    <span className="text-white/60 text-[1vw]">
                                        {data.sourceAbilityId}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* 继续按钮 */}
                        <GameButton
                            variant="primary"
                            size="md"
                            onClick={onDismiss}
                            className="mt-[0.5vw] text-[1vw] px-[3vw] py-[0.8vw]"
                        >
                            {dismissLabel}
                        </GameButton>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        </HudPortal>
    );
};
