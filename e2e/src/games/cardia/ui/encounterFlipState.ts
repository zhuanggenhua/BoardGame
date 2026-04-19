export interface EncounterFlipInput {
    isLatest: boolean;
    opponentCardRevealed: boolean;
}

export interface EncounterFlipUpdateInput extends EncounterFlipInput {
    currentFlipState: boolean;
}

/**
 * 遭遇牌翻面状态（UI）
 *
 * 设计目标：
 * 1) 历史遭遇：永远显示明牌
 * 2) 当前遭遇：只有在满足“应揭示”条件时才翻开
 *
 * 备注：这里的“揭示”是 UI 翻面展示逻辑，不是规则层的 cardRevealed 状态本身。
 */
export function getInitialOpponentFlipState(input: EncounterFlipInput): boolean {
    // 历史遭遇：直接显示明牌
    if (!input.isLatest) return true;

    // 当前遭遇：如果已经处于“应揭示”状态，则直接明牌（避免组件重挂载时错过翻面）
    return input.opponentCardRevealed;
}

export function getNextOpponentFlipState(input: EncounterFlipUpdateInput): boolean {
    // 一旦进入历史遭遇，必须强制明牌（即使之前没来得及翻面）
    if (!input.isLatest) return true;

    // 当前遭遇：只要“应揭示”变为 true，就翻开；否则保持现状
    if (input.opponentCardRevealed) return true;

    return input.currentFlipState;
}

