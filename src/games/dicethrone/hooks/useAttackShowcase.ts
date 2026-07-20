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
import type { TurnPhase, CharacterId, PendingAttack, DiceThroneCore } from '../domain/types';
import type { CardPreviewRef } from '../../../core';
import { getUpgradeCardPreviewRef } from '../ui/abilityOverlayHelpers';
import { getAbilitySlotIdForCharacter } from '../ui/abilitySlotMapping';
import { findPlayerAbility } from '../domain/abilityLookup';

export interface AttackShowcaseData {
    /** 攻击方角色 ID */
    attackerCharacterId: CharacterId;
    /** 攻击方当前玩家板朝向 */
    attackerPlayerBoardFace?: DiceThroneCore['players'][PlayerId]['playerBoardFace'];
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
    /** 特写模式 */
    mode: 'defensive-entry' | 'offensive-preview' | null;
    /** 自动关闭时长，null 表示仅手动关闭 */
    autoDismissMs: number | null;
    /** 关闭特写（点击继续） */
    dismissShowcase: () => void;
}

interface AttackShowcaseConfig {
    /** 当前阶段 */
    currentPhase: TurnPhase;
    /** 当前玩家 ID（非攻击方才展示） */
    currentPlayerId: PlayerId;
    /** 是否为观战模式（观战不展示） */
    isSpectator?: boolean;
    /** 玩家选角映射 */
    selectedCharacters: Record<PlayerId, CharacterId>;
    /** 玩家技能等级映射（按玩家 ID 索引） */
    abilityLevels: Record<string, Record<string, number>>;
    /** 当前 pendingAttack 状态（直接从 core 读取） */
    pendingAttack: PendingAttack | null;
    /** 游戏状态（用于查找变体技能） */
    state: DiceThroneCore;
}

/**
 * 生成当前攻击的唯一标识
 */
function getAttackKey(pa: PendingAttack, state: DiceThroneCore): string {
    return [
        state.turnNumber,
        state.attackResolvedSequence ?? 0,
        pa.attackerId,
        pa.defenderId ?? 'none',
        pa.sourceAbilityId ?? '',
    ].join(':');
}

/**
 * 构建特写展示数据
 */
function buildShowcaseData(
    pendingAttack: PendingAttack,
    selectedCharacters: Record<PlayerId, CharacterId>,
    abilityLevels: Record<string, Record<string, number>>,
    state: DiceThroneCore,
): AttackShowcaseData | null {
    const sourceAbilityId = pendingAttack.sourceAbilityId;
    if (!sourceAbilityId) return null;

    const attackerCharId = selectedCharacters[pendingAttack.attackerId];
    if (!attackerCharId || attackerCharId === 'unselected') return null;

    // 使用 findPlayerAbility 查找技能（支持变体ID）
    const match = findPlayerAbility(state, pendingAttack.attackerId, sourceAbilityId);
    if (!match) return null;

    // 获取基础技能ID（用于查找槽位和等级）
    const baseAbilityId = match.ability.id;
    const attackerPlayerBoardFace = state.players[pendingAttack.attackerId]?.playerBoardFace;
    
    // 使用基础ID查找槽位
    const slotId = getAbilitySlotIdForCharacter(attackerCharId, baseAbilityId, attackerPlayerBoardFace);

    // 使用基础ID查找等级
    const attackerLevels = abilityLevels[pendingAttack.attackerId] ?? {};
    const level = attackerLevels[baseAbilityId] ?? 1;

    // 使用基础ID和等级查找升级卡
    const upgradePreviewRef = level > 1
        ? getUpgradeCardPreviewRef(attackerCharId, baseAbilityId, level)
        : undefined;

    return {
        attackerCharacterId: attackerCharId,
        attackerPlayerBoardFace,
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
        state,
    } = config;

    // 已关闭的攻击 key（用户点击"继续"后设置，触发重渲染隐藏遮罩）
    const [dismissedKey, setDismissedKey] = useState<string | null>(null);
    const [latchedShowcase, setLatchedShowcase] = useState<{
        key: string;
        data: AttackShowcaseData;
        mode: 'defensive-entry' | 'offensive-preview';
        autoDismissMs: number | null;
    } | null>(null);

    // 离开 defensiveRoll 后，如果当前展示是“进入防御”提示，则自动收口
    useEffect(() => {
        if (currentPhase !== 'defensiveRoll') {
            setLatchedShowcase((prev) => prev?.mode === 'defensive-entry' ? null : prev);
        }
    }, [currentPhase]);

    const attackKey = pendingAttack ? getAttackKey(pendingAttack, state) : null;
    const isNonAttackerViewer = pendingAttack
        ? String(pendingAttack.attackerId) !== String(currentPlayerId)
        : false;
    const shouldDeriveShowcase =
        !isSpectator
        && pendingAttack !== null
        && Boolean(pendingAttack.sourceAbilityId)
        && isNonAttackerViewer;
    const showcaseData = shouldDeriveShowcase && pendingAttack
        ? buildShowcaseData(pendingAttack, selectedCharacters, abilityLevels, state)
        : null;
    const showcaseMode = shouldDeriveShowcase && pendingAttack
        ? (
            currentPhase === 'defensiveRoll'
            && pendingAttack.isDefendable
            && String(pendingAttack.defenderId) === String(currentPlayerId)
                ? 'defensive-entry'
                : 'offensive-preview'
        )
        : null;

    useEffect(() => {
        if (!attackKey || !showcaseData || !showcaseMode) {
            return;
        }
        if (attackKey === dismissedKey) {
            return;
        }

        setLatchedShowcase((prev) => {
            if (prev?.key === attackKey && prev.mode === showcaseMode) {
                return prev;
            }
            return {
                key: attackKey,
                data: showcaseData,
                mode: showcaseMode,
                autoDismissMs: null,
            };
        });
    }, [attackKey, showcaseData, showcaseMode, dismissedKey]);

    useEffect(() => {
        if (dismissedKey === null) return;
        setLatchedShowcase((prev) => prev?.key === dismissedKey ? null : prev);
    }, [dismissedKey]);

    const isShowcaseVisible = latchedShowcase !== null;

    const dismissShowcase = useCallback(() => {
        if (latchedShowcase) {
            setDismissedKey(latchedShowcase.key);
        }
    }, [latchedShowcase]);

    return {
        isShowcaseVisible,
        showcaseData: latchedShowcase?.data ?? null,
        mode: latchedShowcase?.mode ?? null,
        autoDismissMs: latchedShowcase?.autoDismissMs ?? null,
        dismissShowcase,
    };
}
