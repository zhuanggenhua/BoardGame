/**
 * 视角与自动观战计算工具
 * - 防御阶段仅在存在 pendingAttack 时强制切到防守方
 * - 响应窗口是否应自动引导切换，由 Board 层在窗口打开瞬间单次处理
 */
import type { PlayerId } from '../../../engine/types';
import type { PendingAttack, TurnPhase, PendingDamage } from '../domain/types';

export type ViewMode = 'self' | 'opponent';

export interface ViewModeParams {
    currentPhase: TurnPhase;
    pendingAttack: PendingAttack | null;
    activePlayerId: PlayerId;
    rootPlayerId: PlayerId;
    manualViewMode: ViewMode;
    /** 响应窗口是否打开 */
    isResponseWindowOpen?: boolean;
    /** 当前响应者 ID */
    currentResponderId?: PlayerId;
    /** 待处理的伤害（Token 响应） */
    pendingDamage?: PendingDamage;
}

export interface ViewModeResult {
    rollerId: PlayerId;
    shouldAutoObserve: boolean;
    viewMode: ViewMode;
    isSelfView: boolean;
    /** 是否满足“响应窗口建议切到对手视角”的条件 */
    isResponseAutoSwitch?: boolean;
}

export interface ResponseViewSuggestionParams {
    previousSuggestionKey: string | null;
    currentSuggestionKey: string | null;
    autoResponseEnabled: boolean;
}

export interface ResponseViewSuggestionKeyParams {
    rootPlayerId: PlayerId;
    isResponseWindowOpen?: boolean;
    currentResponderId?: PlayerId;
    currentResponderIndex?: number;
    pendingDamage?: PendingDamage;
}

export const getResponseViewSuggestionKey = (
    params: ResponseViewSuggestionKeyParams,
): string | null => {
    const {
        rootPlayerId,
        isResponseWindowOpen,
        currentResponderId,
        currentResponderIndex,
        pendingDamage,
    } = params;

    if (isResponseWindowOpen && currentResponderId === rootPlayerId) {
        return `window:${currentResponderId}:${currentResponderIndex ?? 0}`;
    }

    if (pendingDamage?.responderId === rootPlayerId) {
        return `token:${pendingDamage.id}`;
    }

    return null;
};

export const shouldSuggestOpponentViewOnResponseChange = (
    params: ResponseViewSuggestionParams,
): boolean => {
    const {
        previousSuggestionKey,
        currentSuggestionKey,
        autoResponseEnabled,
    } = params;

    return autoResponseEnabled
        && currentSuggestionKey !== null
        && currentSuggestionKey !== previousSuggestionKey;
};

export const computeViewModeState = (params: ViewModeParams): ViewModeResult => {
    const {
        currentPhase,
        pendingAttack,
        activePlayerId,
        rootPlayerId,
        manualViewMode,
        isResponseWindowOpen,
        currentResponderId,
        pendingDamage,
    } = params;

    const rollerId = currentPhase === 'defensiveRoll'
        ? (pendingAttack?.defenderId ?? activePlayerId)
        : activePlayerId;
    const shouldAutoObserve = currentPhase === 'defensiveRoll' && Boolean(pendingAttack) && rootPlayerId !== rollerId;

    // 响应窗口自动切换逻辑
    let isResponseAutoSwitch = false;
    if (isResponseWindowOpen && currentResponderId) {
        // 当前响应者是自己 → 切换到对手视角（看对手的骰子/状态来决定如何响应）
        isResponseAutoSwitch = currentResponderId === rootPlayerId;
    } else if (pendingDamage) {
        // Token 响应窗口：响应者是自己 → 切换到对手视角
        isResponseAutoSwitch = pendingDamage.responderId === rootPlayerId;
    }

    // 优先级：防御阶段自动观战 > 手动视角
    // 响应窗口自动切换只做一次性引导，不在这里强制覆盖手动选择
    let viewMode = manualViewMode;
    if (shouldAutoObserve) {
        viewMode = 'opponent';
    }

    const isSelfView = viewMode === 'self';

    return {
        rollerId,
        shouldAutoObserve,
        viewMode,
        isSelfView,
        isResponseAutoSwitch,
    };
};
