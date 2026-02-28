/**
 * 大杀四方 (Smash Up) - "Paper Chaos" Aesthetic
 * 
 * Style Guide:
 * - Theme: "Basement Board Game Night" / American Comic Spoof
 * - Background: Warm wooden table surface, cluttered but cozy.
 * - Cards: Physical objects with white printed borders, slight imperfections (rotations).
 * - UI: "Sticky notes", "Scrap paper", "Tokens" - nothing digital.
 * - Font: Thick, bold, informal.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameBoardProps } from '../../engine/transport/protocol';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { MatchState } from '../../engine/types';
import type { SmashUpCore, CardInstance, ActionCardDef, MinionCardDef } from './domain/types';
import { SU_COMMANDS, HAND_LIMIT, getCurrentPlayerId } from './domain/types';
import { getScores } from './domain/index';
import { FLOW_COMMANDS } from '../../engine/systems/FlowSystem';
import { asSimpleChoice, INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';
import { getCardDef, getBaseDef, getMinionDef, resolveCardName, resolveCardText } from './data/cards';
import { getTotalEffectivePowerOnBase, getEffectiveBreakpoint, getPlayerEffectivePowerOnBase } from './domain/ongoingModifiers';
import { isOperationRestricted } from './domain/ongoingEffects';
import { useGameAudio, playDeniedSound, playSound } from '../../lib/audio/useGameAudio';
import { CardPreview } from '../../components/common/media/CardPreview';
import { AnimatePresence, motion } from 'framer-motion';
import { initSmashUpAtlases } from './ui/cardAtlas';
import { registerCardPreviewRenderer } from '../../components/common/media/CardPreview';
import { smashUpCardRenderer } from './ui/SmashUpCardRenderer';
import { SmashUpOverlayProvider, useSmashUpOverlay } from './ui/SmashUpOverlayContext';

// 同步注册所有图集（cards1-4 + base1-4，懒解析模式），确保首次渲染时 atlas 注册已就绪
initSmashUpAtlases();
registerCardPreviewRenderer('smashup-card-renderer', smashUpCardRenderer);
import { SMASH_UP_MANIFEST } from './manifest';
import './cursor';
import { HandArea } from './ui/HandArea';
import { useGameEvents } from './ui/useGameEvents';
import { useFxBus, FxLayer } from '../../engine/fx';
import { smashUpFxRegistry } from './ui/fxSetup';
import { FactionSelection } from './ui/FactionSelection';
import { PromptOverlay } from './ui/PromptOverlay';
import { getFactionMeta } from './ui/factionMeta';
import { PLAYER_CONFIG } from './ui/playerConfig';
import { BaseZone } from './ui/BaseZone';
import { MeFirstOverlay, type MeFirstPendingCard } from './ui/MeFirstOverlay';
import { CardMagnifyOverlay, type CardMagnifyTarget } from './ui/CardMagnifyOverlay';
import { GameButton as SmashUpGameButton } from './ui/GameButton';
import { DeckDiscardZone } from './ui/DeckDiscardZone';
import { getDiscardPlayOptions } from './domain/discardPlayability';
import { SMASHUP_AUDIO_CONFIG } from './audio.config';
import { useTutorialBridge, useTutorial } from '../../contexts/TutorialContext';
import { UndoProvider } from '../../contexts/UndoContext';
import { TutorialSelectionGate } from '../../components/game/framework';
import { LoadingScreen } from '../../components/system/LoadingScreen';
import { GameDebugPanel } from '../../components/game/framework/widgets/GameDebugPanel';
import { SmashUpDebugConfig } from './debug-config';
import { UI_Z_INDEX } from '../../core';
import { EndgameOverlay } from '../../components/game/framework/widgets/EndgameOverlay';
import { useEndgame } from '../../hooks/game/useEndgame';
import { SmashUpEndgameContent, SmashUpEndgameActions } from './ui/SmashUpEndgame';
import type { PlayConstraint } from './domain/types';
import { useCardSpotlightQueue, CardSpotlightQueue } from '../../components/game/framework';
import type { SpotlightItem } from '../../components/game/framework';
import { getEventStreamEntries } from '../../engine/systems/EventStreamSystem';
import { RevealOverlay } from './ui/RevealOverlay';

type Props = GameBoardProps<SmashUpCore>;

/** UI 层打出约束检查（与 commands.ts 的 checkPlayConstraint 对齐） */
function checkPlayConstraintUI(
    constraint: PlayConstraint,
    core: SmashUpCore,
    baseIndex: number,
    playerId: string,
): boolean {
    if (constraint === 'requireOwnMinion') {
        return core.bases[baseIndex].minions.some(m => m.owner === playerId);
    }
    if (typeof constraint === 'object' && constraint.type === 'requireOwnPower') {
        const base = core.bases[baseIndex];
        const myPower = getPlayerEffectivePowerOnBase(core, base, baseIndex, playerId);
        return myPower >= constraint.minPower;
    }
    return true;
}

const getPhaseNameKey = (phase: string) => `phases.${phase}`;

const SmashUpBoard: React.FC<Props> = ({ G, dispatch, playerID: rawPlayerID, reset, matchData, isMultiplayer }) => {
    const { t } = useTranslation('game-smashup');
    const core = G.core;
    const phase = G.sys.phase;
    const currentPid = getCurrentPlayerId(core);
    // 在本地热座模式下（非多人游戏且无指定玩家 ID），自动挂载到当前活动玩家视角
    const playerID = (!isMultiplayer && !rawPlayerID) ? currentPid : rawPlayerID;
    const isMyTurn = playerID === currentPid;
    const myPlayer = playerID ? core.players[playerID] : undefined;
    const isGameOver = G.sys.gameover;
    const rootPid = playerID || '0';
    const isWinner = !!isGameOver && isGameOver.winner === rootPid;

    // 重赛系统（通用 hook）
    const { overlayProps: endgameProps, isSpectator } = useEndgame({
        result: isGameOver || undefined,
        playerID,
        reset,
        matchData,
        isMultiplayer,
    });

    const [selectedCardUid, setSelectedCardUid] = useState<string | null>(null);
    const [selectedCardMode, setSelectedCardMode] = useState<'minion' | 'ongoing' | 'ongoing-minion' | null>(null);
    const [discardSelection, setDiscardSelection] = useState<Set<string>>(new Set());
    const [meFirstPendingCard, setMeFirstPendingCard] = useState<MeFirstPendingCard | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 弃牌判断：抽牌阶段 + 是我的回合 + 手牌超限
    // 使用 useMemo 确保使用最新的依赖值（避免时序问题）
    const needDiscard = useMemo(() => {
        return phase === 'draw' && isMyTurn && !!myPlayer && myPlayer.hand.length > HAND_LIMIT;
    }, [phase, isMyTurn, myPlayer]);

    const discardCount = needDiscard && myPlayer ? myPlayer.hand.length - HAND_LIMIT : 0;

    // 含疯狂卡惩罚的最终分数（统一查询入口）
    const finalScores = useMemo(() => getScores(core), [core]);

    // 弃牌堆可打出卡牌选项（仅在出牌阶段且是自己回合时计算）
    // 随从额度已满时，过滤掉消耗正常额度的选项（不消耗额度的额外打出仍然可用）
    // 但需要考虑基地限定额度和同名额度：如果有额度，则保留可以打到对应基地的选项
    const discardPlayOptions = useMemo(() => {
        if (!isMyTurn || phase !== 'playCards' || !playerID) return [];
        const all = getDiscardPlayOptions(core, playerID);
        const globalQuotaFull = myPlayer ? myPlayer.minionsPlayed >= myPlayer.minionLimit : false;
        if (!globalQuotaFull) return all;

        // 全局额度已满，检查同名额度和基地限定额度
        const sameNameRemaining = myPlayer?.sameNameMinionRemaining ?? 0;
        const sameNameDefId = myPlayer?.sameNameMinionDefId;
        const baseQuota = myPlayer?.baseLimitedMinionQuota ?? {};
        const hasBaseQuota = Object.values(baseQuota).some(v => v > 0);

        return all.filter(opt => {
            // 不消耗正常额度的选项（额外打出）始终保留
            if (!opt.consumesNormalLimit) return true;
            // 同名额度可用时，检查 defId 是否匹配
            if (sameNameRemaining > 0) {
                // 尚未锁定 defId 或 defId 匹配时可用
                if (sameNameDefId === null || sameNameDefId === undefined || opt.defId === sameNameDefId) {
                    return true;
                }
            }
            // 消耗正常额度的选项：只有当有基地限定额度且可以打到对应基地时才保留
            if (!hasBaseQuota) return false;
            if (opt.allowedBaseIndices === 'all') {
                // 可以打到任意基地，检查是否有任何基地有额度
                return Object.keys(baseQuota).some(baseIdx => baseQuota[Number(baseIdx)] > 0);
            }
            // 只能打到特定基地，检查这些基地是否有额度
            return opt.allowedBaseIndices.some(baseIdx => (baseQuota[baseIdx] ?? 0) > 0);
        });
    }, [core, isMyTurn, phase, playerID, myPlayer]);

    // 手牌弃牌交互检测：当前 interaction 的所有选项都对应手牌时，用手牌区直接选择
    const currentInteraction = G.sys.interaction?.current;
    const currentPrompt = useMemo(() => asSimpleChoice(currentInteraction), [currentInteraction]);

    const isHandDiscardPrompt = useMemo(() => {
        if (!currentPrompt || currentPrompt.playerId !== playerID) return false;
        if (!myPlayer || myPlayer.hand.length === 0) return false;
        // 多选交互（如疯狂解放）不走手牌直选，交给 PromptOverlay 处理
        if (currentPrompt.multi) return false;

        // 优先使用 targetType 字段（数据驱动）
        const data = currentInteraction?.data as Record<string, unknown> | undefined;
        if (data?.targetType === 'hand') return true;

        // 兼容旧模式：所有选项都对应手牌
        const handUids = new Set(myPlayer.hand.map(c => c.uid));
        return currentPrompt.options.length > 0 &&
            currentPrompt.options.every(opt => {
                const val = opt.value as { cardUid?: string } | undefined;
                return val?.cardUid && handUids.has(val.cardUid);
            });
    }, [currentPrompt, playerID, myPlayer, currentInteraction]);

    // 手牌交互中不可选的 uid 集合（置灰）
    // 框架层已支持通用刷新（所有交互自动刷新），此处只处理明确禁用的选项
    const handPromptDisabledUids = useMemo<Set<string> | undefined>(() => {
        if (!isHandDiscardPrompt || !currentPrompt || !myPlayer) return undefined;

        // 只标记选项中明确禁用的卡牌（opt.disabled === true）
        const disabled = new Set<string>();
        for (const opt of currentPrompt.options) {
            if (opt.disabled) {
                const val = opt.value as { cardUid?: string } | undefined;
                if (val?.cardUid) disabled.add(val.cardUid);
            }
        }

        return disabled.size > 0 ? disabled : undefined;
    }, [isHandDiscardPrompt, currentPrompt, myPlayer]);

    // 手牌选择中的非手牌选项（如"跳过"/"完成"），需要作为浮动按钮显示
    const handSelectExtraOptions = useMemo(() => {
        if (!isHandDiscardPrompt || !currentPrompt) return [];
        return currentPrompt.options.filter(opt => {
            const val = opt.value as Record<string, unknown> | undefined;
            if (!val) return false;
            // 非手牌选项：没有 cardUid 字段的选项（如 skip/done/confirm）
            return !val.cardUid;
        });
    }, [isHandDiscardPrompt, currentPrompt]);

    // 基地选择交互检测：当前 interaction 的选项包含有效 baseIndex 时，用基地区直接点击选择
    const isBaseSelectPrompt = useMemo(() => {
        if (!currentPrompt || currentPrompt.playerId !== playerID) return false;
        // 多选交互不走棋盘点击模式，交给 PromptOverlay 卡牌多选面板处理
        if (currentPrompt.multi) return false;
        const data = currentInteraction?.data as Record<string, unknown> | undefined;
        // 优先使用 targetType 字段（数据驱动）：显式声明时不做任何兜底推断
        // 避免 minion 选项（通常同时包含 minionUid + baseIndex）被误判为 base 选择
        if (typeof data?.targetType === 'string') return data.targetType === 'base';
        // 兼容旧模式：至少有一个有效 baseIndex≥0 的选项，且所有选项要么是有效基地要么是特殊选项（如"完成"baseIndex=-1）
        if (currentPrompt.options.length === 0) return false;

        // 只要出现 minion/card 维度字段，就不是基地选择交互
        const hasEntityField = currentPrompt.options.some(opt => {
            const val = opt.value as Record<string, unknown> | undefined;
            if (!val) return false;
            return typeof val.minionUid === 'string' || typeof val.cardUid === 'string';
        });
        if (hasEntityField) return false;

        const hasBaseOption = currentPrompt.options.some(opt => {
            const val = opt.value as { baseIndex?: number } | undefined;
            return val != null && typeof val.baseIndex === 'number' && val.baseIndex >= 0;
        });
        if (!hasBaseOption) return false;
        return currentPrompt.options.every(opt => {
            const val = opt.value as { baseIndex?: number } | undefined;
            return val != null && typeof val.baseIndex === 'number';
        });
    }, [currentPrompt, playerID, currentInteraction]);

    const _baseSelectPromptTitle = isBaseSelectPrompt && currentPrompt ? currentPrompt.title : '';

    // 可选基地索引集合（只高亮候选基地，baseIndex≥0）
    const selectableBaseIndices = useMemo<Set<number>>(() => {
        if (!isBaseSelectPrompt || !currentPrompt) return new Set();
        const indices = new Set<number>();
        for (const opt of currentPrompt.options) {
            const val = opt.value as { baseIndex?: number } | undefined;
            if (val != null && typeof val.baseIndex === 'number' && val.baseIndex >= 0) {
                indices.add(val.baseIndex);
            }
        }
        return indices;
    }, [isBaseSelectPrompt, currentPrompt]);

    // 基地选择中的非基地选项（如"完成"/"跳过"），需要作为浮动按钮显示
    const baseSelectExtraOptions = useMemo(() => {
        if (!isBaseSelectPrompt || !currentPrompt) return [];
        return currentPrompt.options.filter(opt => {
            const val = opt.value as Record<string, unknown> | undefined;
            if (!val) return true;
            // 有效基地选项：baseIndex >= 0
            if (typeof val.baseIndex === 'number' && val.baseIndex >= 0) return false;
            // 其余都是非基地操作选项（skip / done / cancel 等）
            return true;
        });
    }, [isBaseSelectPrompt, currentPrompt]);

    // 随从选择交互检测：targetType === 'minion' 或所有选项都包含 minionUid
    const isMinionSelectPrompt = useMemo(() => {
        if (!currentPrompt || currentPrompt.playerId !== playerID) return false;
        const data = currentInteraction?.data as Record<string, unknown> | undefined;
        // 多选交互：仅当 targetType === 'minion' 时走棋盘点选（场上随从多选），其余多选交给 PromptOverlay
        if (currentPrompt.multi) return data?.targetType === 'minion';
        if (data?.targetType === 'minion') return true;
        // 显式声明了非 minion 的 targetType（如 'generic'/'base'）→ 不走棋盘随从点选
        if (typeof data?.targetType === 'string') return false;
        // 兼容旧模式：所有选项都包含 minionUid，且不包含确认类字段（accept/confirm/returnIt/skip/done）
        // 确认类字段说明这是"是/否"交互而非随从选择
        return currentPrompt.options.length > 0 &&
            currentPrompt.options.every(opt => {
                const val = opt.value as Record<string, unknown> | undefined;
                if (!val || typeof val.minionUid !== 'string') return false;
                // 排除包含确认类字段的选项（这些是是/否交互，不是随从选择）
                if ('accept' in val || 'confirm' in val || 'returnIt' in val || 'skip' in val || 'done' in val) return false;
                return true;
            });
    }, [currentPrompt, playerID, currentInteraction]);

    // 可选随从 UID 集合（只高亮候选随从，排除跳过选项）
    const selectableMinionUids = useMemo<Set<string>>(() => {
        if (!isMinionSelectPrompt || !currentPrompt) return new Set();
        const uids = new Set<string>();
        for (const opt of currentPrompt.options) {
            const val = opt.value as { minionUid?: string; skip?: boolean } | undefined;
            // 排除跳过选项（不高亮）
            if (val?.skip === true) continue;
            if (val?.minionUid) uids.add(val.minionUid);
        }
        return uids;
    }, [isMinionSelectPrompt, currentPrompt]);

    // 随从选择中的非随从选项（如"跳过"/"完成"），需要作为浮动按钮显示
    const minionSelectExtraOptions = useMemo(() => {
        if (!isMinionSelectPrompt || !currentPrompt) return [];
        return currentPrompt.options.filter(opt => {
            const val = opt.value as Record<string, unknown> | undefined;
            if (!val) return true;
            // 包含 minionUid 的是随从选项，不在此显示
            if (typeof val.minionUid === 'string') return false;
            // 其余都是非随从操作选项（skip / done / cancel 等）
            return true;
        });
    }, [isMinionSelectPrompt, currentPrompt]);

    // 多选随从模式检测
    const isMultiMinionSelect = useMemo(() => {
        return isMinionSelectPrompt && !!currentPrompt?.multi;
    }, [isMinionSelectPrompt, currentPrompt]);

    // 多选随从模式：已选中的 optionId 集合
    const [multiSelectedOptionIds, setMultiSelectedOptionIds] = useState<Set<string>>(new Set());

    // 多选随从模式：约束
    const multiMinionConstraints = useMemo(() => {
        if (!isMultiMinionSelect || !currentPrompt?.multi) return { min: 0, max: Infinity };
        const multi = currentPrompt.multi as { min?: number; max?: number };
        return { min: multi.min ?? 0, max: multi.max ?? Infinity };
    }, [isMultiMinionSelect, currentPrompt]);

    // 多选随从已选中的 UID 集合（用于 BaseZone 高亮已选随从）
    const multiSelectedMinionUids = useMemo<Set<string>>(() => {
        if (!isMultiMinionSelect) return new Set();
        const uids = new Set<string>();
        for (const optId of multiSelectedOptionIds) {
            const opt = currentPrompt?.options.find(o => o.id === optId);
            const val = opt?.value as { minionUid?: string } | undefined;
            if (val?.minionUid) uids.add(val.minionUid);
        }
        return uids;
    }, [isMultiMinionSelect, multiSelectedOptionIds, currentPrompt]);

    // 持续行动卡选择交互检测：targetType === 'ongoing'
    const isOngoingSelectPrompt = useMemo(() => {
        if (!currentPrompt || currentPrompt.playerId !== playerID) return false;
        const data = currentInteraction?.data as Record<string, unknown> | undefined;
        return data?.targetType === 'ongoing';
    }, [currentPrompt, playerID, currentInteraction]);

    // 可选持续行动卡 UID 集合（高亮候选行动卡）
    const selectableOngoingUids = useMemo<Set<string>>(() => {
        if (!isOngoingSelectPrompt || !currentPrompt) return new Set();
        const uids = new Set<string>();
        for (const opt of currentPrompt.options) {
            const val = opt.value as { cardUid?: string; skip?: boolean } | undefined;
            if (val?.skip === true) continue;
            if (val?.cardUid) uids.add(val.cardUid);
        }
        return uids;
    }, [isOngoingSelectPrompt, currentPrompt]);

    // 持续行动卡选择中的非行动卡选项（如"跳过"），需要作为浮动按钮显示
    const ongoingSelectExtraOptions = useMemo(() => {
        if (!isOngoingSelectPrompt || !currentPrompt) return [];
        return currentPrompt.options.filter(opt => {
            const val = opt.value as Record<string, unknown> | undefined;
            if (!val) return true;
            // 包含 cardUid 的是行动卡目标选项，不在此显示
            if (typeof val.cardUid === 'string') return false;
            // 其余都是非行动卡操作选项（skip / done / cancel 等）
            return true;
        });
    }, [isOngoingSelectPrompt, currentPrompt]);

    // 交互驱动的选择提示标题（基地/随从/手牌/行动卡选择统一）
    const interactionSelectTitle = useMemo(() => {
        if (isBaseSelectPrompt && currentPrompt) return currentPrompt.title;
        if (isMinionSelectPrompt && currentPrompt) return currentPrompt.title;
        if (isHandDiscardPrompt && currentPrompt) return currentPrompt.title;
        if (isOngoingSelectPrompt && currentPrompt) return currentPrompt.title;
        return '';
    }, [isBaseSelectPrompt, isMinionSelectPrompt, isHandDiscardPrompt, isOngoingSelectPrompt, currentPrompt]);

    // 弃牌堆随从选择交互检测（僵尸领主等）：targetType === 'discard_minion'
    const isDiscardMinionPrompt = useMemo(() => {
        if (!currentPrompt || currentPrompt.playerId !== playerID) return false;
        const data = currentInteraction?.data as Record<string, unknown> | undefined;
        return data?.targetType === 'discard_minion';
    }, [currentPrompt, playerID, currentInteraction]);



    // 弃牌堆随从选择：可选基地索引（从 interaction data 中读取）
    const discardMinionAllowedBases = useMemo<Set<number>>(() => {
        if (!isDiscardMinionPrompt) return new Set();
        const data = currentInteraction?.data as Record<string, unknown> | undefined;
        const indices = data?.allowedBaseIndices as number[] | undefined;
        return new Set(indices ?? []);
    }, [isDiscardMinionPrompt, currentInteraction]);

    // 弃牌堆出牌横排选中的卡 uid（统一状态）
    const [discardStripSelectedUid, setDiscardStripSelectedUid] = useState<string | null>(null);

    // interaction 激活时重置手牌选中状态，避免 selectedCardUid 残留干扰基地渲染
    useEffect(() => {
        if (currentPrompt) {
            setSelectedCardUid(null);
            setSelectedCardMode(null);
        }
        setDiscardStripSelectedUid(null);
        setMultiSelectedOptionIds(new Set());
    }, [currentPrompt?.id]);

    // 统一弃牌堆出牌：合并正常弃牌堆出牌 + interaction 驱动的弃牌堆随从选择
    const discardStripCards = useMemo<{ uid: string; defId: string; label: string; optionId?: string; optionValue?: unknown }[]>(() => {
        // interaction 驱动模式优先（僵尸领主等）
        if (isDiscardMinionPrompt && currentPrompt) {
            return currentPrompt.options
                .filter(opt => !(opt.value as Record<string, unknown>)?.done)
                .map(opt => {
                    const val = opt.value as { cardUid: string; defId: string };
                    return { uid: val.cardUid, defId: val.defId, label: opt.label, optionId: opt.id, optionValue: opt.value };
                });
        }
        // 正常弃牌堆出牌模式
        if (discardPlayOptions.length > 0) {
            return discardPlayOptions.map(opt => ({
                uid: opt.card.uid, defId: opt.defId, label: opt.name,
            }));
        }
        return [];
    }, [isDiscardMinionPrompt, currentPrompt, discardPlayOptions]);

    // 弃牌堆出牌横排的"完成"选项（interaction 模式下的 done 选项）
    const discardStripDoneOption = useMemo(() => {
        if (!isDiscardMinionPrompt || !currentPrompt) return null;
        return currentPrompt.options.find(opt => (opt.value as Record<string, unknown>)?.done) ?? null;
    }, [isDiscardMinionPrompt, currentPrompt]);

    // 横排消失时重置
    useEffect(() => {
        if (discardStripCards.length === 0) setDiscardStripSelectedUid(null);
    }, [discardStripCards.length]);

    // 弃牌堆出牌横排可选基地集合
    const discardStripAllowedBases = useMemo<Set<number>>(() => {
        if (!discardStripSelectedUid) return new Set();
        // interaction 模式：从 interaction data 读取
        if (isDiscardMinionPrompt) return discardMinionAllowedBases;
        // 正常弃牌堆出牌：从 discardPlayOptions 读取
        const opt = discardPlayOptions.find(o => o.card.uid === discardStripSelectedUid);
        if (!opt) return new Set();
        if (opt.allowedBaseIndices === 'all') {
            return new Set(core.bases.map((_, i) => i));
        }
        return new Set(opt.allowedBaseIndices);
    }, [discardStripSelectedUid, isDiscardMinionPrompt, discardMinionAllowedBases, discardPlayOptions, core.bases]);


    // Me First! 响应状态判断
    const responseWindow = G.sys.responseWindow?.current;
    const isMeFirstResponse = useMemo(() => {
        if (!responseWindow || responseWindow.windowType !== 'meFirst') return false;
        const currentResponderId = responseWindow.responderQueue[responseWindow.currentResponderIndex];
        return playerID === currentResponderId;
    }, [responseWindow, playerID]);

    // Me First! 期间非 special 卡的禁用集合（置灰）
    const meFirstDisabledUids = useMemo<Set<string> | undefined>(() => {
        if (!isMeFirstResponse || !myPlayer) return undefined;
        const disabled = new Set<string>();
        for (const card of myPlayer.hand) {
            if (card.type !== 'action') {
                disabled.add(card.uid);
                continue;
            }
            const def = getCardDef(card.defId) as ActionCardDef | undefined;
            if (def?.subtype !== 'special') {
                disabled.add(card.uid);
            }
        }
        return disabled.size > 0 ? disabled : undefined;
    }, [isMeFirstResponse, myPlayer]);

    // Me First! 可选基地集合（达到临界点的基地索引）
    const meFirstEligibleBaseIndices = useMemo<Set<number>>(() => {
        if (!meFirstPendingCard) return new Set();
        const indices = new Set<number>();
        for (let i = 0; i < core.bases.length; i++) {
            const base = core.bases[i];
            const baseDef = getBaseDef(base.defId);
            if (!baseDef) continue;
            const totalPower = getTotalEffectivePowerOnBase(core, base, i);
            if (totalPower >= getEffectiveBreakpoint(core, i)) {
                indices.add(i);
            }
        }
        return indices;
    }, [meFirstPendingCard, core]);

    // 手牌选中卡牌的有效部署基地集合（排除被 ongoing 限制的基地）
    // deployBlockReason: 当所有基地都不可选时的原因（用于 toast 提示）
    const { deployableBaseIndices, deployBlockReason } = useMemo<{ deployableBaseIndices: Set<number>; deployBlockReason: string | null }>(() => {
        if (!selectedCardUid || !playerID) return { deployableBaseIndices: new Set(), deployBlockReason: null };
        const indices = new Set<number>();
        const card = myPlayer?.hand.find(c => c.uid === selectedCardUid);
        if (!card) return { deployableBaseIndices: indices, deployBlockReason: null };

        // 全局力量限制检查（如家园额外出牌：力量≤2）
        const player = core.players[playerID];
        if (selectedCardMode === 'minion' && player?.extraMinionPowerMax !== undefined && player.minionsPlayed >= 1) {
            const minionDef = getMinionDef(card.defId);
            const basePower = minionDef?.power ?? 0;
            if (basePower > player.extraMinionPowerMax) {
                return {
                    deployableBaseIndices: indices,
                    deployBlockReason: t('ui.power_limit_exceeded', {
                        defaultValue: '额外出牌只能打出力量≤{{max}}的随从',
                        max: player.extraMinionPowerMax,
                    }),
                };
            }
        }

        // 同名额度检查：全局额度用完且只剩同名额度时，defId 必须匹配
        if (selectedCardMode === 'minion' && player) {
            const globalRemaining = player.minionLimit - player.minionsPlayed;
            const sameNameRemaining = player.sameNameMinionRemaining ?? 0;
            const baseQuotaTotal = Object.values(player.baseLimitedMinionQuota ?? {}).reduce((s, v) => s + v, 0);
            if (globalRemaining <= 0 && sameNameRemaining > 0 && baseQuotaTotal <= 0) {
                // 已锁定 defId 且不匹配时阻止
                if (player.sameNameMinionDefId !== null && player.sameNameMinionDefId !== undefined && card.defId !== player.sameNameMinionDefId) {
                    return {
                        deployableBaseIndices: indices,
                        deployBlockReason: t('ui.same_name_only', {
                            defaultValue: '额外出牌只能打出同名随从',
                        }),
                    };
                }
            }
        }

        // 预计算额度状态（用于基地限定同名约束过滤）
        const globalRemaining2 = player ? player.minionLimit - player.minionsPlayed : 0;
        const sameNameRemaining2 = player?.sameNameMinionRemaining ?? 0;
        const onlyBaseQuota = selectedCardMode === 'minion' && globalRemaining2 <= 0 && sameNameRemaining2 <= 0;

        for (let i = 0; i < core.bases.length; i++) {
            if (selectedCardMode === 'minion') {
                // 打出随从：检查 play_minion 限制
                const minionDef = getMinionDef(card.defId);
                const basePower = minionDef?.power ?? 0;
                if (!isOperationRestricted(core, i, playerID, 'play_minion', { minionDefId: card.defId, basePower })) {
                    // 基地限定同名约束：只剩基地限定额度时，检查该基地是否有额度且满足同名约束
                    if (onlyBaseQuota) {
                        const bQuota = player?.baseLimitedMinionQuota?.[i] ?? 0;
                        if (bQuota <= 0) continue; // 该基地无额度
                        if (player?.baseLimitedSameNameRequired?.[i]) {
                            const baseDefIds = new Set(core.bases[i].minions.map(m => m.defId));
                            if (!baseDefIds.has(card.defId)) continue; // 不满足同名约束
                        }
                    }
                    // 随从打出约束（数据驱动）
                    if (minionDef?.playConstraint) {
                        if (checkPlayConstraintUI(minionDef.playConstraint, core, i, playerID)) {
                            indices.add(i);
                        }
                    } else {
                        indices.add(i);
                    }
                }
            } else if (selectedCardMode === 'ongoing' || selectedCardMode === 'ongoing-minion') {
                // 打出行动卡：检查 play_action 限制
                if (!isOperationRestricted(core, i, playerID, 'play_action')) {
                    // playConstraint 数据驱动约束
                    const actionDef = getCardDef(card.defId) as ActionCardDef | undefined;
                    if (actionDef?.playConstraint) {
                        if (checkPlayConstraintUI(actionDef.playConstraint, core, i, playerID)) {
                            indices.add(i);
                        }
                    } else {
                        indices.add(i);
                    }
                }
            }
        }
        return { deployableBaseIndices: indices, deployBlockReason: null };
    }, [selectedCardUid, selectedCardMode, playerID, myPlayer?.hand, core, t]);

    // ongoing-minion 模式下的有效随从 UID 集合（只包含未被限制基地上的随从）
    const ongoingMinionTargetUids = useMemo<Set<string>>(() => {
        if (selectedCardMode !== 'ongoing-minion' || !playerID) return new Set();
        const uids = new Set<string>();
        for (let i = 0; i < core.bases.length; i++) {
            if (!deployableBaseIndices.has(i)) continue;
            for (const m of core.bases[i].minions) {
                uids.add(m.uid);
            }
        }
        return uids;
    }, [selectedCardMode, playerID, core, deployableBaseIndices]);

    // 基地 DOM 引用（用于 FX 特效定位）
    const baseRefsMap = useRef<Map<number, HTMLElement>>(new Map());

    // FX 系统
    const fxBus = useFxBus(smashUpFxRegistry, { playSound });

    // 事件流消费 → FX 特效驱动
    const myPid = playerID || '0';
    const gameEvents = useGameEvents({ G, myPlayerId: myPid, fxBus, baseRefs: baseRefsMap });

    // 行动卡特写队列（只显示其他玩家打出的行动卡，点击关闭）
    const extractActionCard = useCallback((event: { type: string; payload: unknown }) => {
        const p = event.payload as { playerId: string; defId: string };
        if (!p?.playerId || !p?.defId) return null;
        return { playerId: p.playerId, cardData: { defId: p.defId } };
    }, []);

    const SPOTLIGHT_TRIGGER_EVENTS = useMemo(() => ['su:action_played'], []);

    // 事件流条目（统一获取，避免重复调用）
    const eventStreamEntries = getEventStreamEntries(G);

    const { queue: spotlightQueue, dismiss: dismissSpotlight } = useCardSpotlightQueue<{ defId: string }>({
        entries: eventStreamEntries,
        currentPlayerId: myPid,
        triggerEventTypes: SPOTLIGHT_TRIGGER_EVENTS,
        extractCard: extractActionCard,
        maxQueue: 5,
    });

    // 行动卡特写渲染
    const renderSpotlightCard = useCallback((item: SpotlightItem<{ defId: string }>) => {
        const def = getCardDef(item.cardData.defId);
        const resolvedName = resolveCardName(def, t) || item.cardData.defId;
        const resolvedText = resolveCardText(def, t);
        return (
            <div className="relative w-[20vw] max-w-[320px] aspect-[0.714] bg-white rounded-lg shadow-2xl border-2 border-slate-300 overflow-hidden">
                <CardPreview
                    previewRef={def?.previewRef}
                    className="w-full h-full object-cover"
                    title={resolvedName}
                />
                {!def?.previewRef && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-[#f3f0e8]">
                        <div className="text-[1.2vw] font-black uppercase text-slate-800 mb-2">{resolvedName}</div>
                        <div className="text-[0.7vw] text-slate-600 text-center font-mono">{resolvedText}</div>
                    </div>
                )}
                <div className="absolute top-2 right-2 bg-red-500 text-white text-[0.7vw] font-black px-2 py-0.5 rounded shadow-md rotate-6">
                    {t('ui.played')}
                </div>
            </div>
        );
    }, [t]);

    // 能力反馈 toast（搜索失败等提示）
    useEffect(() => {
        if (gameEvents.feedbacks.length === 0) return;
        for (const fb of gameEvents.feedbacks) {
            // 只显示给当前玩家的反馈
            if (fb.playerId === playerID) {
                toast(t(fb.messageKey, { defaultValue: '牌库中未找到符合条件的卡牌，已重洗牌库', ...fb.messageParams }));
            }
            gameEvents.removeFeedback(fb.id);
        }
    }, [gameEvents.feedbacks, gameEvents.removeFeedback, playerID, t]);

    // 音效系统
    useGameAudio({
        config: SMASHUP_AUDIO_CONFIG,
        gameId: SMASH_UP_MANIFEST.id,
        G: G.core,
        ctx: {
            currentPhase: phase,
            isGameOver: !!isGameOver,
            isWinner,
        },
        meta: {
            currentPlayerId: currentPid,
        },
        eventEntries: G.sys.eventStream.entries,
    });

    // 教学系统集成
    useTutorialBridge(G.sys.tutorial, dispatch);
    const { isActive: isTutorialActive, currentStep: tutorialStep } = useTutorial();
    const isTutorialMode = isTutorialActive;

    // 教学模式下的命令权限检查
    const isTutorialCommandAllowed = useCallback((commandType: string): boolean => {
        if (!isTutorialActive || !tutorialStep) return true;
        // 系统命令不受限制
        if (commandType.startsWith('SYS_')) return true;
        // 有 allowedCommands 白名单时，只允许白名单内的命令
        if (tutorialStep.allowedCommands && tutorialStep.allowedCommands.length > 0) {
            return tutorialStep.allowedCommands.includes(commandType);
        }
        return true;
    }, [isTutorialActive, tutorialStep]);

    // 教学模式下的目标级门控（卡牌/单位粒度）
    const isTutorialTargetAllowed = useCallback((targetId: string): boolean => {
        if (!isTutorialActive || !tutorialStep) return true;
        if (!tutorialStep.allowedTargets || tutorialStep.allowedTargets.length === 0) return true;
        return tutorialStep.allowedTargets.includes(targetId);
    }, [isTutorialActive, tutorialStep]);

    // 教学模式下被禁用的手牌 uid 集合
    const tutorialDisabledUids = useMemo<Set<string> | undefined>(() => {
        if (!isTutorialActive || !tutorialStep?.allowedTargets?.length) return undefined;
        const allowed = tutorialStep.allowedTargets;
        return new Set(
            myPlayer?.hand.filter(c => !allowed.includes(c.uid)).map(c => c.uid) ?? []
        );
    }, [isTutorialActive, tutorialStep, myPlayer?.hand]);

    // 回合切换提示
    const [showTurnNotice, setShowTurnNotice] = useState(false);
    const prevCurrentPidRef = useRef(currentPid);
    useEffect(() => {
        if (prevCurrentPidRef.current !== currentPid) {
            prevCurrentPidRef.current = currentPid;
            if (currentPid === playerID) {
                setShowTurnNotice(true);
                const timer = setTimeout(() => setShowTurnNotice(false), 1500);
                return () => clearTimeout(timer);
            }
        }
    }, [currentPid, playerID]);

    // --- State Management ---
    useEffect(() => {
        setSelectedCardUid(null);
        setSelectedCardMode(null);
        setDiscardSelection(new Set());
        setMeFirstPendingCard(null);
        setIsSubmitting(false);
    }, [phase, currentPid]);

    // 卡牌和基地图集已在模块顶层 initSmashUpAtlases() 同步注册，无需异步加载

    // --- Handlers ---
    const handlePlayMinion = useCallback((cardUid: string, baseIndex: number) => {
        if (!isTutorialCommandAllowed(SU_COMMANDS.PLAY_MINION)) {
            playDeniedSound();
            return;
        }
        dispatch(SU_COMMANDS.PLAY_MINION, { cardUid, baseIndex });
        setSelectedCardUid(null);
        setSelectedCardMode(null);
    }, [dispatch, isTutorialCommandAllowed]);

    const handlePlayOngoingAction = useCallback((cardUid: string, baseIndex: number) => {
        if (!isTutorialCommandAllowed(SU_COMMANDS.PLAY_ACTION)) {
            playDeniedSound();
            return;
        }
        // 二次防御：行动额度检查（正常流程在 handleCardClick 已拦截）
        if (myPlayer && myPlayer.actionsPlayed >= myPlayer.actionLimit) {
            playDeniedSound();
            toast(t('ui.action_limit_reached', { defaultValue: '本回合行动额度已用完' }));
            setSelectedCardUid(null);
            setSelectedCardMode(null);
            return;
        }
        dispatch(SU_COMMANDS.PLAY_ACTION, { cardUid, targetBaseIndex: baseIndex });
        setSelectedCardUid(null);
        setSelectedCardMode(null);
    }, [dispatch, isTutorialCommandAllowed, myPlayer, t]);

    /** 持续行动卡附着到随从：点击随从时触发 */
    const handlePlayOngoingToMinion = useCallback((cardUid: string, baseIndex: number, minionUid: string) => {
        if (!isTutorialCommandAllowed(SU_COMMANDS.PLAY_ACTION)) {
            playDeniedSound();
            return;
        }
        // 二次防御：行动额度检查
        if (myPlayer && myPlayer.actionsPlayed >= myPlayer.actionLimit) {
            playDeniedSound();
            toast(t('ui.action_limit_reached', { defaultValue: '本回合行动额度已用完' }));
            setSelectedCardUid(null);
            setSelectedCardMode(null);
            return;
        }
        dispatch(SU_COMMANDS.PLAY_ACTION, { cardUid, targetBaseIndex: baseIndex, targetMinionUid: minionUid });
        setSelectedCardUid(null);
        setSelectedCardMode(null);
    }, [dispatch, isTutorialCommandAllowed, myPlayer, t]);

    // VIEWING STATE
    const [viewingCard, setViewingCard] = useState<CardMagnifyTarget | null>(null);

    const handleBaseClick = useCallback((index: number) => {
        const base = core.bases[index];
        // Me First! 基地选择模式：打出需要基地目标的 Special 卡
        if (meFirstPendingCard) {
            if (!meFirstEligibleBaseIndices.has(index)) {
                toast(t('ui.invalid_base_target', { defaultValue: '该基地不可选择' }));
                return;
            }
            dispatch(SU_COMMANDS.PLAY_ACTION, { cardUid: meFirstPendingCard.cardUid, targetBaseIndex: index });
            setMeFirstPendingCard(null);
            return;
        }
        // 弃牌堆出牌模式：选中随从后点基地
        if (discardStripSelectedUid) {
            if (!discardStripAllowedBases.has(index)) {
                toast(t('ui.invalid_base_target', { defaultValue: '该基地不可选择' }));
                return;
            }
            // interaction 驱动模式（僵尸领主等）：合并 cardUid + baseIndex 响应
            if (isDiscardMinionPrompt && currentPrompt) {
                const card = discardStripCards.find(c => c.uid === discardStripSelectedUid);
                if (card?.optionId) {
                    dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: card.optionId, mergedValue: { ...card.optionValue as Record<string, unknown>, baseIndex: index } });
                }
                setDiscardStripSelectedUid(null);
                return;
            }
            // 正常弃牌堆出牌模式
            dispatch(SU_COMMANDS.PLAY_MINION, { cardUid: discardStripSelectedUid, baseIndex: index, fromDiscard: true });
            setDiscardStripSelectedUid(null);
            return;
        }
        // 基地选择交互模式：直接响应 interaction
        if (isBaseSelectPrompt && currentPrompt) {
            if (!selectableBaseIndices.has(index)) {
                toast(t('ui.invalid_base_target', { defaultValue: '该基地不可选择' }));
                return;
            }
            const option = currentPrompt.options.find(
                opt => (opt.value as { baseIndex?: number })?.baseIndex === index
            );
            if (option) {
                dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: option.id });
            }
            return;
        }
        if (selectedCardUid) {
            if (selectedCardMode === 'ongoing-minion') {
                // 需要选择随从，点击基地无效
                toast(t('ui.select_minion_hint', { defaultValue: '请选择一个随从' }));
                return;
            }
            // 被限制的基地不可部署
            if (!deployableBaseIndices.has(index)) {
                toast(deployBlockReason || t('ui.invalid_base_target', { defaultValue: '该基地不可选择' }));
                return;
            }
            if (selectedCardMode === 'ongoing') {
                handlePlayOngoingAction(selectedCardUid, index);
            } else {
                handlePlayMinion(selectedCardUid, index);
            }
        } else {
            setViewingCard({ defId: base.defId, type: 'base' });
        }
    }, [selectedCardUid, selectedCardMode, handlePlayMinion, handlePlayOngoingAction, core.bases, t, isBaseSelectPrompt, selectableBaseIndices, currentPrompt, dispatch, meFirstPendingCard, deployableBaseIndices, deployBlockReason, discardStripSelectedUid, discardStripAllowedBases, isDiscardMinionPrompt, discardStripCards, meFirstEligibleBaseIndices]);

    const handleCardClick = useCallback((card: CardInstance) => {
        // 手牌弃牌交互优先：直接响应 interaction
        if (isHandDiscardPrompt && currentPrompt) {
            const option = currentPrompt.options.find(
                opt => (opt.value as { cardUid?: string })?.cardUid === card.uid
            );
            if (option) {
                dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: option.id });
            } else {
                // 点击了不在交互选项中的牌（如新抽到的牌尚未刷新到选项中）
                playDeniedSound();
                toast(t('ui.card_not_in_options', { defaultValue: '该卡牌不在当前可选范围内' }));
            }
            return;
        }

        // 手牌超限弃牌模式：toggle 选中状态
        if (needDiscard) {
            setDiscardSelection(prev => {
                const next = new Set(prev);
                if (next.has(card.uid)) {
                    next.delete(card.uid);
                } else if (next.size < discardCount) {
                    next.add(card.uid);
                }
                return next;
            });
            return;
        }

        // Validation for play phase / turn
        // Me First! 响应期间：允许点击手牌中的 special 卡直接打出
        if (isMeFirstResponse) {
            if (card.type !== 'action') {
                playDeniedSound();
                return;
            }
            const cardDef = getCardDef(card.defId) as ActionCardDef | undefined;
            if (cardDef?.subtype !== 'special') {
                playDeniedSound();
                return;
            }
            if (cardDef.specialNeedsBase) {
                // 需要选基地：进入基地选择模式
                setMeFirstPendingCard({ cardUid: card.uid, defId: card.defId });
            } else {
                // 不需要选基地：直接打出
                dispatch(SU_COMMANDS.PLAY_ACTION, { cardUid: card.uid });
            }
            return;
        }

        if (!isMyTurn || phase !== 'playCards') {
            playDeniedSound();
            toast(t('ui.invalid_play'));
            return;
        }

        // 教学模式下检查命令权限
        const commandType = card.type === 'action' ? SU_COMMANDS.PLAY_ACTION : SU_COMMANDS.PLAY_MINION;
        if (!isTutorialCommandAllowed(commandType)) {
            playDeniedSound();
            return;
        }

        // 教学模式下检查目标级门控
        if (!isTutorialTargetAllowed(card.uid)) {
            playDeniedSound();
            return;
        }

        // Normal play logic
        if (card.type === 'action') {
            // 行动额度检查（special 卡不消耗额度，在 Me First! 窗口打出）
            const cardDef = getCardDef(card.defId) as ActionCardDef | undefined;
            if (cardDef?.subtype !== 'special' && myPlayer && myPlayer.actionsPlayed >= myPlayer.actionLimit) {
                playDeniedSound();
                toast(t('ui.action_limit_reached', { defaultValue: '本回合行动额度已用完' }));
                return;
            }
            // ongoing 行动卡需要选择目标
            if (cardDef?.subtype === 'ongoing') {
                // 进入/退出部署模式
                if (selectedCardUid === card.uid) {
                    setSelectedCardUid(null);
                    setSelectedCardMode(null);
                } else {
                    setSelectedCardUid(card.uid);
                    // 根据 ongoingTarget 决定选择基地还是随从
                    setSelectedCardMode(cardDef.ongoingTarget === 'minion' ? 'ongoing-minion' : 'ongoing');
                }
            } else {
                dispatch(SU_COMMANDS.PLAY_ACTION, { cardUid: card.uid });
            }
        } else {
            if (selectedCardUid === card.uid) {
                setSelectedCardUid(null);
                setSelectedCardMode(null);
            } else {
                setSelectedCardUid(card.uid);
                setSelectedCardMode('minion');
            }
        }
    }, [isMyTurn, phase, dispatch, isTutorialCommandAllowed, isTutorialTargetAllowed, selectedCardUid, isHandDiscardPrompt, currentPrompt, myPlayer, t, needDiscard, discardCount, isMeFirstResponse]);

    /** 随从点击回调：ongoing-minion 模式下附着行动卡到随从，或交互驱动的随从选择 */
    const handleMinionSelect = useCallback((minionUid: string, baseIndex: number) => {
        // 交互驱动的随从选择
        if (isMinionSelectPrompt && currentPrompt) {
            if (!selectableMinionUids.has(minionUid)) return;
            const option = currentPrompt.options.find(
                opt => (opt.value as { minionUid?: string })?.minionUid === minionUid
            );
            if (!option) return;

            // 多选模式：toggle 选中状态
            if (isMultiMinionSelect) {
                setMultiSelectedOptionIds(prev => {
                    const next = new Set(prev);
                    if (next.has(option.id)) {
                        next.delete(option.id);
                    } else {
                        if (next.size >= multiMinionConstraints.max) return prev;
                        next.add(option.id);
                    }
                    return next;
                });
                return;
            }

            // 单选模式：立即提交
            dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: option.id });
            return;
        }
        // ongoing-minion 模式下附着行动卡到随从
        if (selectedCardUid && selectedCardMode === 'ongoing-minion') {
            if (!ongoingMinionTargetUids.has(minionUid)) return;
            handlePlayOngoingToMinion(selectedCardUid, baseIndex, minionUid);
        }
    }, [selectedCardUid, selectedCardMode, handlePlayOngoingToMinion, isMinionSelectPrompt, isMultiMinionSelect, multiMinionConstraints, selectableMinionUids, currentPrompt, dispatch, ongoingMinionTargetUids]);

    /** 持续行动卡点击回调：交互驱动的行动卡选择 */
    const handleOngoingSelect = useCallback((ongoingUid: string) => {
        if (!isOngoingSelectPrompt || !currentPrompt) return;
        if (!selectableOngoingUids.has(ongoingUid)) return;
        const option = currentPrompt.options.find(
            opt => (opt.value as { cardUid?: string })?.cardUid === ongoingUid
        );
        if (option) {
            dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: option.id });
        }
    }, [isOngoingSelectPrompt, selectableOngoingUids, currentPrompt, dispatch]);

    const handleViewCardDetail = useCallback((card: CardInstance) => {
        setViewingCard({ defId: card.defId, type: card.type === 'minion' ? 'minion' : 'action' });
    }, []);

    const handleViewAction = useCallback((defId: string) => {
        setViewingCard({ defId, type: 'action' });
    }, []);

    // 防御性检查：HMR 或 client 重建时 core 可能不完整
    if (!core.turnOrder || !core.bases) {
        return (
            <UndoProvider value={{ G, dispatch, playerID, isGameOver: !!isGameOver, isLocalMode: false }}>
                <LoadingScreen
                    description={t('ui.loading', { defaultValue: '加载中...' })}
                    className="bg-[#3e2723]"
                />
            </UndoProvider>
        );
    }

    // EARLY RETURN: Faction Selection
    if (phase === 'factionSelect') {
        return (
            <UndoProvider value={{ G, dispatch, playerID, isGameOver: !!isGameOver, isLocalMode: false }}>
                <TutorialSelectionGate
                    isTutorialMode={isTutorialMode}
                    isTutorialActive={isTutorialActive}
                    containerClassName="bg-[#3e2723]"
                    textClassName="text-lg"
                >
                    <div className="relative w-full h-screen bg-[#3e2723] overflow-hidden font-sans select-none">
                        <div className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-multiply">
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]" />
                        </div>
                        <FactionSelection core={core} dispatch={dispatch} playerID={playerID} />
                    </div>
                </TutorialSelectionGate>
            </UndoProvider>
        );
    }

    return (
        <UndoProvider value={{ G, dispatch, playerID, isGameOver: !!isGameOver, isLocalMode: false }}>
            {/* BACKGROUND: A warm, dark wooden table texture. */}
            <div className="relative w-full h-screen bg-[#3e2723] overflow-hidden font-sans select-none"
            >

                {/* Table Texture Layer */}
                <div className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-multiply">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]" />
                </div>
                {/* Vignette for focus */}
                <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]" />

                {/* --- TOP HUD: "Sticky Notes" Style --- */}
                <div className="relative z-20 flex justify-between items-start pt-6 px-[2vw] pointer-events-none">

                    {/* Left: Turn Tracker (Yellow Notepad) */}
                    <div className="bg-[#fef3c7] text-slate-800 p-3 pt-4 shadow-[2px_3px_5px_rgba(0,0,0,0.2)] -rotate-1 pointer-events-auto min-w-[140px] clip-path-jagged" data-tutorial-id="su-turn-tracker">
                        <div className="w-3 h-3 rounded-full bg-red-400 absolute top-1 left-1/2 -translate-x-1/2 opacity-50 shadow-inner" /> {/* Pin */}
                        <motion.div
                            key={`turn-${core.turnNumber}`}
                            initial={{ scale: 0.9, rotate: -3 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            className="text-center font-black uppercase text-xl leading-none tracking-tighter mb-1 border-b-2 border-slate-800/20 pb-1"
                        >
                            {t('ui.turn')} {core.turnNumber}
                        </motion.div>
                        <div className="flex justify-between items-center text-sm font-bold font-mono">
                            <span>{isMyTurn ? t('ui.you') : t('ui.opp')}</span>
                            <motion.span
                                key={phase}
                                initial={{ scale: 0.7, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                className="text-blue-600 bg-blue-100 px-1 rounded transform rotate-2 inline-block"
                            >
                                {t(getPhaseNameKey(phase))}
                            </motion.span>
                        </div>
                    </div>

                    {/* Right: Score Sheet + Player Info */}
                    <div className="bg-white text-slate-900 p-4 shadow-[3px_4px_10px_rgba(0,0,0,0.3)] rotate-1 max-w-[500px] pointer-events-auto rounded-sm" data-tutorial-id="su-scoreboard">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-2 border-b border-slate-200">{t('ui.score_sheet')}</div>
                        <div className="flex gap-5">
                            {core.turnOrder.map(pid => {
                                const conf = PLAYER_CONFIG[parseInt(pid) % PLAYER_CONFIG.length];
                                const isCurrent = pid === currentPid;
                                const player = core.players[pid];
                                const isMe = pid === playerID;
                                // 派系图标
                                const factionIcons = (player.factions ?? [])
                                    .map(fid => getFactionMeta(fid))
                                    .filter(Boolean);
                                return (
                                    <motion.div
                                        key={pid}
                                        className={`flex flex-col items-center relative ${isCurrent ? 'scale-110' : 'opacity-60 grayscale'}`}
                                        animate={isCurrent ? { scale: 1.1 } : { scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                    >
                                        <span className="text-xs font-black uppercase mb-1">
                                            {isMe ? t('ui.you_short') : t('ui.player_short', { id: pid })}
                                        </span>
                                        <motion.div
                                            key={`vp-${pid}-${finalScores[pid]}`}
                                            className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-black text-white shadow-md border-2 border-white ${conf.bg}`}
                                            initial={{ scale: 1 }}
                                            animate={{ scale: [1, 1.3, 1] }}
                                            transition={{ duration: 0.4, ease: 'easeOut' }}
                                        >
                                            {finalScores[pid]}
                                        </motion.div>
                                        {/* 派系图标 */}
                                        <div className="flex gap-0.5 mt-1">
                                            {factionIcons.map(meta => {
                                                if (!meta) return null;
                                                const Icon = meta.icon;
                                                return (
                                                    <span key={meta.id} title={t(meta.nameKey)}>
                                                        <Icon className="w-4 h-4" style={{ color: meta.color }} />
                                                    </span>
                                                );
                                            })}
                                        </div>
                                        {/* 自己的牌库/弃牌信息已移至下方 DeckDiscardZone */}
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* --- FINISH TURN BUTTON: Fixed Position (Right Edge) --- */}
                <div className="fixed right-[8vw] bottom-[28vh] z-50 flex pointer-events-none w-24 h-24" data-tutorial-id="su-end-turn-btn">
                    <AnimatePresence>
                        {isMyTurn && phase === 'playCards' && (
                            <motion.div
                                initial={{ y: 100, opacity: 0, scale: 0.5 }}
                                animate={{ y: 0, opacity: 1, scale: 1 }}
                                exit={{ y: 100, opacity: 0, scale: 0.5 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                className="pointer-events-auto relative"
                            >
                                <button
                                    onClick={() => {
                                        if (G.sys.interaction?.isBlocked || !isTutorialCommandAllowed(FLOW_COMMANDS.ADVANCE_PHASE) || isSubmitting) {
                                            playDeniedSound();
                                            return;
                                        }
                                        setIsSubmitting(true);
                                        dispatch(FLOW_COMMANDS.ADVANCE_PHASE, {});
                                        // 超时兜底：3秒后强制重置（防止命令失败导致按钮永久禁用）
                                        setTimeout(() => setIsSubmitting(false), 3000);
                                    }}
                                    disabled={!!G.sys.interaction?.isBlocked || !isTutorialCommandAllowed(FLOW_COMMANDS.ADVANCE_PHASE) || isSubmitting}
                                    className={`group w-24 h-24 rounded-full border-4 border-white shadow-[0_10px_20px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center transition-all text-white relative overflow-hidden ${G.sys.interaction?.isBlocked || !isTutorialCommandAllowed(FLOW_COMMANDS.ADVANCE_PHASE) || isSubmitting
                                        ? 'bg-slate-600 opacity-50 cursor-not-allowed'
                                        : 'bg-slate-900 hover:scale-110 hover:rotate-3 active:scale-95'
                                        }`}
                                >
                                    <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]" />

                                    {G.sys.interaction?.isBlocked ? (
                                        <span className="text-xs font-bold text-amber-300 text-center leading-tight">
                                            {t('ui.waiting_opponent', { defaultValue: '等待对方操作' })}
                                        </span>
                                    ) : t('ui.finish_turn').includes(' ') ? (
                                        <>
                                            <span className="text-[10px] font-bold opacity-70 uppercase tracking-tighter leading-tight">
                                                {t('ui.finish_turn').split(' ')[0]}
                                            </span>
                                            <span className="text-lg font-black uppercase italic leading-none">
                                                {t('ui.finish_turn').split(' ')[1]}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-lg font-black uppercase italic leading-none tracking-tighter">
                                            {t('ui.finish_turn')}
                                        </span>
                                    )}

                                    <div className="absolute -inset-1 bg-white/5 blur-xl group-hover:bg-white/10 transition-colors" />
                                </button>

                                {/* 剩余出牌额度指示器 - 绝对定位在按钮右侧 */}
                                {myPlayer && (
                                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 flex flex-col gap-2">
                                        {/* 随从额度（含基地限定额度 + 力量限制 tooltip） */}
                                        {(() => {
                                            const baseQuota = myPlayer.baseLimitedMinionQuota ?? {};
                                            const baseQuotaTotal = Object.values(baseQuota).reduce((s, v) => s + v, 0);
                                            const sameNameRemaining = myPlayer.sameNameMinionRemaining ?? 0;
                                            const globalRemaining = Math.max(0, myPlayer.minionLimit - myPlayer.minionsPlayed);
                                            const totalRemaining = globalRemaining + baseQuotaTotal + sameNameRemaining;
                                            const hasExtra = baseQuotaTotal > 0 || myPlayer.extraMinionPowerMax !== undefined || sameNameRemaining > 0;
                                            return (
                                                <div className="relative group/minion">
                                                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded border-2 shadow-md text-xs font-black whitespace-nowrap cursor-default ${totalRemaining > 0
                                                        ? 'bg-emerald-600 border-emerald-400 text-white'
                                                        : 'bg-slate-700 border-slate-500 text-slate-300'
                                                        }`}>
                                                        <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 20 20">
                                                            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                                                        </svg>
                                                        <span>{t('ui.minion_short', { defaultValue: '随从' })}</span>
                                                        <span>{totalRemaining}</span>
                                                        {hasExtra && (
                                                            <svg className="w-3.5 h-3.5 fill-amber-300 shrink-0 drop-shadow-[0_0_2px_rgba(252,211,77,0.6)]" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    {/* Tooltip：紧凑纯文本，无图标 */}
                                                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover/minion:block z-50 pointer-events-none">
                                                        <div className="bg-slate-900/95 backdrop-blur-sm text-white text-[11px] leading-tight rounded border border-slate-600 shadow-xl px-2 py-1.5 whitespace-nowrap space-y-0.5">
                                                            <div className="flex justify-between gap-3">
                                                                <span className="text-slate-300">{t('ui.minion_global_quota', { defaultValue: '通用额度' })}</span>
                                                                <span className="font-bold">{globalRemaining}/{myPlayer.minionLimit}</span>
                                                            </div>
                                                            {Object.entries(baseQuota).map(([baseIdx, count]) => {
                                                                if (count <= 0) return null;
                                                                const bDef = getBaseDef(core.bases[Number(baseIdx)]?.defId);
                                                                const bName = bDef?.name ? t(`cards.${bDef.id}.name`, { defaultValue: bDef.name }) : `#${Number(baseIdx) + 1}`;
                                                                return (
                                                                    <div key={baseIdx} className="text-amber-300">+{count} → {bName}</div>
                                                                );
                                                            })}
                                                            {myPlayer.extraMinionPowerMax !== undefined && (
                                                                <div className="text-orange-300 border-t border-slate-700 pt-0.5">{t('ui.minion_power_cap', { defaultValue: '力量限制 ≤{{max}}', max: myPlayer.extraMinionPowerMax })}</div>
                                                            )}
                                                            {sameNameRemaining > 0 && (
                                                                <div className="text-cyan-300 border-t border-slate-700 pt-0.5">
                                                                    {t('ui.same_name_quota', { defaultValue: '同名额度 +{{count}}', count: sameNameRemaining })}
                                                                    {myPlayer.sameNameMinionDefId && (() => {
                                                                        const def = getMinionDef(myPlayer.sameNameMinionDefId);
                                                                        const name = def ? t(`cards.${myPlayer.sameNameMinionDefId}.name`, { defaultValue: def.name }) : myPlayer.sameNameMinionDefId;
                                                                        return <span className="text-cyan-200 ml-1">({name})</span>;
                                                                    })()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="absolute right-3 top-full w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-slate-600" />
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        {/* 行动额度（含 tooltip） */}
                                        {(() => {
                                            const actionRemaining = Math.max(0, myPlayer.actionLimit - myPlayer.actionsPlayed);
                                            const hasExtraAction = myPlayer.actionLimit > 1;
                                            return (
                                                <div className="relative group/action">
                                                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded border-2 shadow-md text-xs font-black whitespace-nowrap cursor-default ${actionRemaining > 0
                                                        ? 'bg-blue-600 border-blue-400 text-white'
                                                        : 'bg-slate-700 border-slate-500 text-slate-300'
                                                        }`}>
                                                        <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                                        </svg>
                                                        <span>{t('ui.action_short', { defaultValue: '战术' })}</span>
                                                        <span>{actionRemaining}</span>
                                                        {hasExtraAction && (
                                                            <svg className="w-3.5 h-3.5 fill-amber-300 shrink-0 drop-shadow-[0_0_2px_rgba(252,211,77,0.6)]" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    {/* Tooltip：紧凑纯文本，与随从额度 tooltip 风格一致 */}
                                                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover/action:block z-50 pointer-events-none">
                                                        <div className="bg-slate-900/95 backdrop-blur-sm text-white text-[11px] leading-tight rounded border border-slate-600 shadow-xl px-2 py-1.5 whitespace-nowrap space-y-0.5">
                                                            <div className="flex justify-between gap-3">
                                                                <span className="text-slate-300">{t('ui.action_global_quota', { defaultValue: '通用额度' })}</span>
                                                                <span className="font-bold">{actionRemaining}/{myPlayer.actionLimit}</span>
                                                            </div>
                                                            {hasExtraAction && (
                                                                <div className="text-amber-300">{t('ui.action_extra_hint', { defaultValue: '含额外行动额度 +{{extra}}', extra: myPlayer.actionLimit - 1 })}</div>
                                                            )}
                                                        </div>
                                                        <div className="absolute right-3 top-full w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-slate-600" />
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* 弃牌模式：继续按钮（复用结束回合按钮位置） */}
                    <AnimatePresence>
                        {needDiscard && (
                            <motion.div
                                initial={{ y: 100, opacity: 0, scale: 0.5 }}
                                animate={{ y: 0, opacity: 1, scale: 1 }}
                                exit={{ y: 100, opacity: 0, scale: 0.5 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                className="pointer-events-auto"
                            >
                                <button
                                    onClick={() => {
                                        if (discardSelection.size === discardCount) {
                                            dispatch(SU_COMMANDS.DISCARD_TO_LIMIT, { cardUids: Array.from(discardSelection) });
                                            setDiscardSelection(new Set());
                                        }
                                    }}
                                    disabled={discardSelection.size !== discardCount}
                                    className={`group w-24 h-24 rounded-full border-4 border-white shadow-[0_10px_20px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center transition-all text-white relative overflow-hidden ${discardSelection.size !== discardCount
                                        ? 'bg-slate-600 opacity-50 cursor-not-allowed'
                                        : 'bg-slate-900 hover:scale-110 hover:rotate-3 active:scale-95'
                                        }`}
                                >
                                    <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]" />
                                    <span className="text-lg font-black uppercase italic leading-none tracking-tighter">
                                        {t('ui.continue', { defaultValue: '继续' })}
                                    </span>
                                    <div className="absolute -inset-1 bg-white/5 blur-xl group-hover:bg-white/10 transition-colors" />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* --- 交互选择提示横幅（基地/随从/手牌选择） --- */}
                <AnimatePresence>
                    {(isBaseSelectPrompt || isMinionSelectPrompt || isHandDiscardPrompt || isOngoingSelectPrompt) && (
                        <motion.div
                            initial={{ y: -20, opacity: 0, scale: 0.95 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: -20, opacity: 0, scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            className="absolute top-[72px] inset-x-0 z-30 flex justify-center pointer-events-none"
                        >
                            <div className="bg-slate-900/95 backdrop-blur-sm text-white px-8 py-3 rounded border border-slate-600 shadow-[0_4px_0_#334155,0_8px_24px_rgba(0,0,0,0.5)]">
                                <span className="font-black text-lg uppercase tracking-tighter">
                                    {interactionSelectTitle}
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- 基地选择浮动操作栏（完成/跳过按钮） --- */}
                <AnimatePresence>
                    {isBaseSelectPrompt && baseSelectExtraOptions.length > 0 && (
                        <motion.div
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 40, opacity: 0 }}
                            className="fixed bottom-[280px] inset-x-0 flex justify-center pointer-events-none"
                            style={{ zIndex: UI_Z_INDEX.hint }}
                        >
                            <div className="flex gap-3 pointer-events-auto">
                                {baseSelectExtraOptions.map(opt => (
                                    <SmashUpGameButton
                                        key={opt.id}
                                        variant="secondary"
                                        size="md"
                                        onClick={() => dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: opt.id })}
                                    >
                                        {opt.label}
                                    </SmashUpGameButton>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- 随从选择浮动操作栏（多选确认 + 跳过按钮） --- */}
                <AnimatePresence>
                    {isMinionSelectPrompt && (isMultiMinionSelect || minionSelectExtraOptions.length > 0) && (
                        <motion.div
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 40, opacity: 0 }}
                            className="fixed bottom-[280px] inset-x-0 flex justify-center pointer-events-none"
                            style={{ zIndex: UI_Z_INDEX.hint }}
                        >
                            <div className="flex gap-3 items-center pointer-events-auto">
                                {isMultiMinionSelect && (
                                    <>
                                        <div className="bg-slate-900/90 backdrop-blur-sm text-white px-4 py-2 rounded border border-slate-600 shadow-lg">
                                            <span className="font-bold text-sm">
                                                已选 {multiSelectedOptionIds.size}
                                                {multiMinionConstraints.max !== Infinity && ` / ${multiMinionConstraints.max}`}
                                            </span>
                                        </div>
                                        <SmashUpGameButton
                                            variant="primary"
                                            size="md"
                                            disabled={multiSelectedOptionIds.size < multiMinionConstraints.min}
                                            onClick={() => dispatch(INTERACTION_COMMANDS.RESPOND, { optionIds: Array.from(multiSelectedOptionIds) })}
                                        >
                                            确认选择
                                        </SmashUpGameButton>
                                    </>
                                )}
                                {minionSelectExtraOptions.map(opt => (
                                    <SmashUpGameButton
                                        key={opt.id}
                                        variant="secondary"
                                        size="md"
                                        onClick={() => {
                                            if (isMultiMinionSelect) {
                                                dispatch(INTERACTION_COMMANDS.RESPOND, { optionIds: [opt.id] });
                                            } else {
                                                dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: opt.id });
                                            }
                                        }}
                                    >
                                        {opt.label}
                                    </SmashUpGameButton>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- 手牌选择浮动操作栏（跳过按钮） --- */}
                <AnimatePresence>
                    {isHandDiscardPrompt && handSelectExtraOptions.length > 0 && (
                        <motion.div
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 40, opacity: 0 }}
                            className="fixed bottom-[280px] inset-x-0 flex justify-center pointer-events-none"
                            style={{ zIndex: UI_Z_INDEX.hint }}
                        >
                            <div className="flex gap-3 pointer-events-auto">
                                {handSelectExtraOptions.map(opt => (
                                    <SmashUpGameButton
                                        key={opt.id}
                                        variant="secondary"
                                        size="md"
                                        onClick={() => dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: opt.id })}
                                    >
                                        {opt.label}
                                    </SmashUpGameButton>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- 持续行动卡选择浮动操作栏（跳过按钮） --- */}
                <AnimatePresence>
                    {isOngoingSelectPrompt && ongoingSelectExtraOptions.length > 0 && (
                        <motion.div
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 40, opacity: 0 }}
                            className="fixed bottom-[280px] inset-x-0 flex justify-center pointer-events-none"
                            style={{ zIndex: UI_Z_INDEX.hint }}
                        >
                            <div className="flex gap-3 pointer-events-auto">
                                {ongoingSelectExtraOptions.map(opt => (
                                    <SmashUpGameButton
                                        key={opt.id}
                                        variant="secondary"
                                        size="md"
                                        onClick={() => dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: opt.id })}
                                    >
                                        {opt.label}
                                    </SmashUpGameButton>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- MAIN BOARD --- */}
                {/* Scrollable table area */}
                <div className="absolute inset-0 flex items-center justify-center overflow-x-auto overflow-y-hidden z-10 no-scrollbar pt-12 pb-60" data-tutorial-id="su-base-area">
                    <div className="flex items-start gap-12 px-20 min-w-max">
                        {core.bases.map((base, idx) => (
                            <BaseZone
                                key={`${base.defId}-${idx}`}
                                base={base}
                                baseIndex={idx}
                                core={core}
                                turnOrder={core.turnOrder}
                                isDeployMode={
                                    (!!selectedCardUid && deployableBaseIndices.has(idx)) || (!!meFirstPendingCard && meFirstEligibleBaseIndices.has(idx))
                                }
                                isMinionSelectMode={(selectedCardMode === 'ongoing-minion' && ongoingMinionTargetUids.size > 0) || (isMinionSelectPrompt && selectableMinionUids.size > 0)}
                                selectableMinionUids={isMinionSelectPrompt ? selectableMinionUids : selectedCardMode === 'ongoing-minion' ? ongoingMinionTargetUids : undefined}
                                multiSelectedMinionUids={isMultiMinionSelect ? multiSelectedMinionUids : undefined}
                                isSelectable={(isBaseSelectPrompt && selectableBaseIndices.has(idx)) || (discardStripSelectedUid != null && discardStripAllowedBases.has(idx))}
                                isDimmed={
                                    (isBaseSelectPrompt && !selectableBaseIndices.has(idx))
                                    || (discardStripSelectedUid != null && !discardStripAllowedBases.has(idx))
                                    || (!!selectedCardUid && selectedCardMode !== 'ongoing-minion' && !deployableBaseIndices.has(idx))
                                    || (!!meFirstPendingCard && !meFirstEligibleBaseIndices.has(idx))
                                }
                                isMyTurn={isMyTurn}
                                myPlayerId={playerID}
                                dispatch={dispatch}
                                onClick={() => handleBaseClick(idx)}
                                onMinionSelect={handleMinionSelect}
                                onOngoingSelect={handleOngoingSelect}
                                selectableOngoingUids={isOngoingSelectPrompt ? selectableOngoingUids : undefined}
                                onViewMinion={(defId) => setViewingCard({ defId, type: 'minion' })}
                                onViewAction={handleViewAction}
                                onViewBase={(defId) => setViewingCard({ defId, type: 'base' })}
                                isTutorialTargetAllowed={isTutorialTargetAllowed}
                                tokenRef={(el) => {
                                    if (el) baseRefsMap.current.set(idx, el);
                                    else baseRefsMap.current.delete(idx);
                                }}
                            />

                        ))}
                    </div>
                </div>

                {/* --- BOTTOM: HAND & CONTROLS --- */}
                {/* Not a bar, but floating elements */}

                {/* 弃牌提示横幅（顶部，不遮挡手牌） */}
                {myPlayer && needDiscard && (
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="fixed top-[72px] inset-x-0 z-30 flex justify-center pointer-events-none"
                    >
                        <div className="bg-red-900/90 backdrop-blur-sm text-white px-6 py-2 rounded border border-red-500 shadow-lg">
                            <span className="font-black text-base uppercase tracking-tight">
                                {t('ui.discard_desc', { count: discardCount })}（{discardSelection.size}/{discardCount}）
                            </span>
                        </div>
                    </motion.div>
                )}

                {/* 手牌区：z-60，在弃牌遮罩之上 */}
                {
                    myPlayer && (
                        <div className="absolute bottom-0 inset-x-0 h-[220px] z-60 pointer-events-none">

                            <HandArea
                                hand={myPlayer.hand}
                                selectedCardUid={selectedCardUid}
                                onCardSelect={handleCardClick}
                                isDiscardMode={needDiscard || isHandDiscardPrompt}
                                discardSelection={discardSelection}
                                // 教学模式下，当不允许打出随从和行动时禁用手牌交互（摇头反馈）
                                disableInteraction={
                                    isTutorialActive &&
                                    !isTutorialCommandAllowed(SU_COMMANDS.PLAY_MINION) &&
                                    !isTutorialCommandAllowed(SU_COMMANDS.PLAY_ACTION)
                                }
                                disabledCardUids={meFirstDisabledUids ?? handPromptDisabledUids ?? tutorialDisabledUids}
                                onCardView={handleViewCardDetail}
                            />



                            {/* NEW: Deck & Discard Zone */}
                            <DeckDiscardZone
                                deckCount={myPlayer.deck.length}
                                discard={myPlayer.discard}
                                isMyTurn={isMyTurn}
                                hasPlayableFromDiscard={discardPlayOptions.length > 0 || isDiscardMinionPrompt}
                                autoOpenPanel={isDiscardMinionPrompt}
                                playableCards={discardStripCards.map(c => ({ uid: c.uid, defId: c.defId, label: c.label }))}
                                selectedUid={discardStripSelectedUid}
                                onSelectCard={setDiscardStripSelectedUid}
                                selectHint={discardStripSelectedUid ? t('ui.click_base_to_deploy', { defaultValue: '点击基地放置随从' }) : undefined}
                                onClosePanel={isDiscardMinionPrompt
                                    ? (discardStripDoneOption
                                        ? () => dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: discardStripDoneOption!.id })
                                        : () => dispatch(INTERACTION_COMMANDS.CANCEL, {}))
                                    : () => { setDiscardStripSelectedUid(null); }
                                }
                                dispatch={dispatch}
                                playerID={playerID}
                            />
                        </div>
                    )
                }

                {/* FX 特效层 */}
                <FxLayer
                    bus={fxBus}
                    getCellPosition={() => ({ left: 0, top: 0, width: 0, height: 0 })}
                />

                {/* 回合切换提示 */}
                <AnimatePresence>
                    {showTurnNotice && (
                        <motion.div
                            className="fixed inset-0 flex items-center justify-center pointer-events-none"
                            style={{ zIndex: UI_Z_INDEX.hint }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <motion.div
                                className="bg-[#fef3c7] text-slate-900 px-8 py-4 shadow-2xl border-4 border-dashed border-slate-800/30"
                                initial={{ scale: 0.5, rotate: -10 }}
                                animate={{ scale: 1, rotate: 2 }}
                                exit={{ scale: 0.5, rotate: 10, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                                style={{ fontFamily: "'Caveat', 'Comic Sans MS', cursive" }}
                            >
                                <span className="text-[3vw] font-black uppercase tracking-tight">{t('ui.your_turn')}</span>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* DEBUG PANEL */}
                <GameDebugPanel G={G} dispatch={dispatch} playerID={playerID} autoSwitch={false}>
                    <SmashUpDebugConfig G={G} dispatch={dispatch} />
                </GameDebugPanel>

                {/* 行动卡特写队列（其他玩家打出的行动卡，点击关闭） */}
                <CardSpotlightQueue
                    queue={spotlightQueue}
                    onDismiss={dismissSpotlight}
                    renderCard={renderSpotlightCard}
                />

                {/* 卡牌展示浮层（非阻塞，点击关闭） */}
                <RevealOverlay
                    entries={eventStreamEntries}
                    currentPlayerId={currentPid}
                />

                {/* PREVIEW OVERLAY */}
                <CardMagnifyOverlay target={viewingCard} onClose={() => setViewingCard(null)} />

                {/* PROMPT OVERLAY（手牌弃牌/基地选择/随从选择/行动卡选择/弃牌堆出牌交互时隐藏，由对应区域直接处理） */}
                {!isHandDiscardPrompt && !isBaseSelectPrompt && !isMinionSelectPrompt && !isOngoingSelectPrompt && !isDiscardMinionPrompt && (
                    <PromptOverlay
                        interaction={G.sys.interaction?.current}
                        dispatch={dispatch}
                        playerID={playerID}
                    />
                )}

                {/* ME FIRST! 响应窗口 */}
                <MeFirstOverlay
                    G={G}
                    dispatch={dispatch}
                    playerID={playerID}
                    pendingCard={meFirstPendingCard}
                    onSelectCard={setMeFirstPendingCard}
                />

                {/* 自定义结束页面（计分轨风格） */}
                <EndgameOverlay
                    {...endgameProps}
                    renderContent={(props) => (
                        <SmashUpEndgameContent
                            {...props}
                            core={core}
                            myPlayerId={playerID}
                        />
                    )}
                    renderActions={(actionsProps) => (
                        <SmashUpEndgameActions {...actionsProps} />
                    )}
                />
            </div>
        </UndoProvider>
    );
};

/** 英文模式下的中文覆盖层开关按钮（仅在 SmashUpOverlayProvider 内部可用） */
function OverlayToggleButton() {
    const { i18n } = useTranslation('game-smashup');
    const { overlayEnabled, toggleOverlay } = useSmashUpOverlay();
    const isEn = i18n.language === 'en' || i18n.language === 'en-US';
    // 只在英文模式下显示此按钮（中文模式下中文就是卡图本身，不需要开关）
    if (!isEn) return null;
    return (
        <button
            onClick={toggleOverlay}
            title={overlayEnabled ? '点击关闭中文悬浮翻译' : '点击开启（鼠标悬浮卡牌可见中文）'}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg border transition-all select-none
                ${overlayEnabled
                    ? 'bg-amber-400/90 text-slate-900 border-amber-500/80 hover:bg-amber-300'
                    : 'bg-slate-700/80 text-white/60 border-white/20 hover:bg-slate-600'
                }`}
        >
            <span>{overlayEnabled ? '🈶' : '🈚'}</span>
            <span>{overlayEnabled ? '中文注释 悬浮' : '中文注释 关'}</span>
        </button>
    );
}

/** 带 Provider 的外层包装（注入开关 Context + 渲染内层 Board） */
const SmashUpBoardWithProvider = (props: Props) => (
    <SmashUpOverlayProvider>
        <OverlayToggleButton />
        <SmashUpBoard {...props} />
    </SmashUpOverlayProvider>
);

export default SmashUpBoardWithProvider;
