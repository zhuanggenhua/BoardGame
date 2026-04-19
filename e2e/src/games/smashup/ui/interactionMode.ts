export type SmashUpHandPromptUiMode = 'none' | 'direct' | 'overlay';
export type SmashUpPromptSurface = 'none' | 'hand' | 'board' | 'overlay';

type HandPromptLike = {
    playerId?: string | null;
    multi?: unknown;
} | null | undefined;

type ResolveHandPromptUiModeInput = {
    currentPrompt: HandPromptLike;
    playerID: string | null | undefined;
    targetType: unknown;
};

type ResolveHandInteractionModeInput = {
    preferredMode: 'click' | 'drag';
    needDiscard: boolean;
    activePromptSurface: SmashUpPromptSurface;
};

/**
 * 手牌类交互要先区分“由手牌区直接承接”还是“仍由 PromptOverlay 承接”：
 * - direct: 单选 hand prompt，手牌区直接点击选牌
 * - overlay: 多选 hand prompt，继续走 PromptOverlay
 * - none: 不是当前玩家的 hand prompt
 */
export function resolveSmashUpHandPromptUiMode({
    currentPrompt,
    playerID,
    targetType,
}: ResolveHandPromptUiModeInput): SmashUpHandPromptUiMode {
    if (!currentPrompt || !playerID || currentPrompt.playerId !== playerID) return 'none';
    if (targetType !== 'hand') return 'none';
    return currentPrompt.multi ? 'overlay' : 'direct';
}

/**
 * 拖拽只是“正常打牌”的输入方式偏好，不能覆盖交互语义本身。
 * 只要当前处于任意 prompt 或弃牌到上限阶段，就必须压回 click。
 */
export function resolveSmashUpHandInteractionMode({
    preferredMode,
    needDiscard,
    activePromptSurface,
}: ResolveHandInteractionModeInput): 'click' | 'drag' {
    if (preferredMode !== 'drag') return 'click';
    if (needDiscard || activePromptSurface !== 'none') return 'click';
    return 'drag';
}
