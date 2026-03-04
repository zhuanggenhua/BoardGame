/**
 * 视角与自动观战计算工具
 * - 防御阶段仅在存在 pendingAttack 时强制切到防守方
 * - 响应窗口打开时自动切换到响应者视角
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
    /** 是否因响应窗口自动切换视角 */
    isResponseAutoSwitch?: boolean;
}

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

    // 响应窗口自动切换逻辑（已禁用 - 保持当前视角）
    const isResponseAutoSwitch = false;
    // 注释掉自动切换逻辑，响应窗口期间不改变视角
    // if (isResponseWindowOpen && currentResponderId) {
    //     // 当前响应者是对手 → 切到对手视角看对方技能
    //     isResponseAutoSwitch = currentResponderId !== rootPlayerId;
    // } else if (pendingDamage) {
    //     // Token 响应窗口：响应者是对手 → 切到对手视角
    //     isResponseAutoSwitch = pendingDamage.responderId !== rootPlayerId;
    // }

    // 优先级：防御阶段自动观战 > 响应窗口自动切换 > 手动视角
    let viewMode = manualViewMode;
    if (shouldAutoObserve) {
        viewMode = 'opponent';
    } else if (isResponseAutoSwitch) {
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
