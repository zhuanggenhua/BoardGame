/**
 * useAttackShowcase Hook
 *
 * 防御阶段开始时，展示对方使用的进攻技能特写。
 * 直接从 pendingAttack 状态读取攻击信息，
 * 当防御方处于 defensiveRoll 阶段时自动触发展示。
 * 点击"开始防御"后关闭，开始正常防御流程。
 *
 * 设计：派生状态模式，不依赖 useEffect 检测阶段切换。
 * - defensiveRoll + pendingAttack + 是防御方 → 展示
 * - 用户点击关闭 → 标记已关闭（基于攻击唯一 key）
 * - 离开 defensiveRoll → 自动重置
 */

import { useState, useEffect, useCallback } from 'react';
import type { PlayerId } from '../../../engine/types';
import type { TurnPhase, CharacterId, PendingAttack } from '../domain/types';
import type { CardPreviewRef } from '../../../core';
import { getUpgradeCardPreviewRef, getAbilitySlotId } from '../ui/AbilityOverlays';

export interface AttackShowcaseData {
    /** 攻击方角色 ID */
    attackerCharacterId: CharacterId;
    /** 进攻技能 ID */
    sourceAbilityId: string;
    /** 技能槽 ID（用于从面板裁切基础技能） */
    slotId: string | null;
    /** 升级卡预览引用（level > 1 时有值） */
    upgradePreviewRef: CardPreviewRef | undefined;
    /** 技能等级 */
    abilityLevel: number;
}

export interface AttackShowcaseState {
    /** 是否显示特写 */
    isShowcaseVisible: boolean;
    /** 特写数据 */
    showcaseData: AttackShowcaseData | null;
    /** 关闭特写（点击继续） */
    dismissShowcase: () => void;
}

interface AttackShowcaseConfig {
    /** 当前阶段 */
    currentPhase: TurnPhase;
    /** 当前玩家 ID（防御方才展示） */
    currentPlayerId: PlayerId;
    /** 是否为观战模式（观战不展示） */
    isSpectator?: boolean;
    /** 玩家选角映射 */
    selectedCharacters: Record<PlayerId, CharacterId>;
    /** 玩家技能等级映射（按玩家 ID 索引） */
    abilityLevels: Record<string, Record<string, number>>;
    /** 当前 pendingAttack 状态（直接从 core 读取） */
    pendingAttack: PendingAttack | null;
}

/**
 * 生成当前攻击的唯一标识
 */
function getAttackKey(pa: PendingAttack): string {
    return `${pa.attackerId}:${pa.sourceAbilityId ?? ''}`;
}

/**
 * 构建特写展示数据
 */
function buildShowcaseData(
    pendingAttack: PendingAttack,
    selectedCharacters: Record<PlayerId, CharacterId>,
    abilityLevels: Record<string, Record<string, number>>,
): AttackShowcaseData | null {
    const sourceAbilityId = pendingAttack.sourceAbilityId;
    if (!sourceAbilityId) return null;

    const attackerCharId = selectedCharacters[pendingAttack.attackerId];
    if (!attackerCharId || attackerCharId === 'unselected') return null;

    const slotId = getAbilitySlotId(sourceAbilityId);

    // 技能 ID 可能带变体后缀（如 fist-technique-5），提取基础 ID
    const baseAbilityId = sourceAbilityId.replace(/-\d+$/, '');
    const attackerLevels = abilityLevels[pendingAttack.attackerId] ?? {};
    const level = attackerLevels[baseAbilityId] ?? attackerLevels[sourceAbilityId] ?? 1;

    const upgradePreviewRef = level > 1
        ? getUpgradeCardPreviewRef(attackerCharId, baseAbilityId, level)
        : undefined;

    return {
        attackerCharacterId: attackerCharId,
        sourceAbilityId,
        slotId,
        upgradePreviewRef,
        abilityLevel: level,
    };
}

export function useAttackShowcase(config: AttackShowcaseConfig): AttackShowcaseState {
    const {
        currentPhase,
        currentPlayerId,
        isSpectator = false,
        selectedCharacters,
        abilityLevels,
        pendingAttack,
    } = config;

    // 已关闭的攻击 key（用户点击"继续"后设置，触发重渲染隐藏遮罩）
    const [dismissedKey, setDismissedKey] = useState<string | null>(null);

    // 离开 defensiveRoll 时重置
    useEffect(() => {
        if (currentPhase !== 'defensiveRoll') {
            setDismissedKey(null);
        }
    }, [currentPhase]);

    // 判断是否应该展示（纯派生逻辑）
    const shouldShow =
        currentPhase === 'defensiveRoll'
        && !isSpectator
        && pendingAttack !== null
        && pendingAttack.isDefendable
        && Boolean(pendingAttack.sourceAbilityId)
        && String(pendingAttack.defenderId) === String(currentPlayerId)
        && getAttackKey(pendingAttack) !== dismissedKey;

    const showcaseData = shouldShow && pendingAttack
        ? buildShowcaseData(pendingAttack, selectedCharacters, abilityLevels)
        : null;

    const isShowcaseVisible = shouldShow && showcaseData !== null;

    const dismissShowcase = useCallback(() => {
        if (pendingAttack) {
            setDismissedKey(getAttackKey(pendingAttack));
        }
    }, [pendingAttack]);

    return { isShowcaseVisible, showcaseData, dismissShowcase };
}
