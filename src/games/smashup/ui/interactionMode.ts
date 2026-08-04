export type SmashUpHandPromptUiMode = 'none' | 'direct' | 'overlay';
export type SmashUpPromptSurface = 'none' | 'hand' | 'board' | 'overlay';

type HandPromptLike = {
    playerId?: unknown;
    multi?: unknown;
} | null | undefined;

type PromptOptionLike = {
    disabled?: unknown;
    value?: unknown;
};

type HandCardLike = {
    uid?: unknown;
};

type ButtonOverlayPromptLike = HandPromptLike & {
    sourceId?: unknown;
    options?: Array<{ displayMode?: unknown; disabled?: unknown; value?: unknown }>;
};

type ResolveHandPromptUiModeInput = {
    currentPrompt: HandPromptLike;
    playerID: string | null | undefined;
    targetType: unknown;
    hand?: ReadonlyArray<HandCardLike> | null | undefined;
};

type ResolveHandInteractionModeInput = {
    preferredMode: 'click' | 'drag';
    needDiscard: boolean;
    activePromptSurface: SmashUpPromptSurface;
};

type ResolveHandAreaVisibilityInput = ResolveHandPromptUiModeInput & {
    activePromptSurface: SmashUpPromptSurface;
};

type ResolvePromptOwnershipInput = {
    currentPrompt: HandPromptLike;
    playerID: string | null | undefined;
};

type ResolveDirectHandCardStateInput = ResolveHandPromptUiModeInput & {
    hand: ReadonlyArray<HandCardLike> | null | undefined;
};

export function isSmashUpPromptOwnedByPlayer({
    currentPrompt,
    playerID,
}: ResolvePromptOwnershipInput): boolean {
    if (!currentPrompt || !playerID || currentPrompt.playerId == null) return false;
    return String(currentPrompt.playerId) === String(playerID);
}

export function shouldForceSmashUpPromptOverlay(currentPrompt: ButtonOverlayPromptLike): boolean {
    const options = currentPrompt?.options;
    return Array.isArray(options) && options.length > 0 && options.every(option => option.displayMode === 'button');
}

export function getSmashUpSelectableBaseIndices(options: ReadonlyArray<PromptOptionLike> | null | undefined): Set<number> {
    const indices = new Set<number>();
    if (!Array.isArray(options)) return indices;

    for (const option of options) {
        if (option?.disabled) continue;
        const value = option?.value as { baseIndex?: unknown } | undefined;
        if (typeof value?.baseIndex === 'number' && value.baseIndex >= 0) {
            indices.add(value.baseIndex);
        }
    }

    return indices;
}

function hasEnabledCardOptionOutsideHand(
    currentPrompt: HandPromptLike,
    hand: ReadonlyArray<HandCardLike> | null | undefined,
): boolean {
    if (!hand) return false;
    const options = (currentPrompt as ButtonOverlayPromptLike | undefined)?.options;
    if (!Array.isArray(options) || options.length === 0) return false;

    const handUids = new Set(
        hand.flatMap(card => typeof card?.uid === 'string' ? [card.uid] : []),
    );

    return options.some(option => {
        if (option?.disabled) return false;
        const value = option?.value as { cardUid?: unknown } | undefined;
        return typeof value?.cardUid === 'string' && !handUids.has(value.cardUid);
    });
}

/**
 * 手牌类交互要先区分“由手牌区直接承接”还是“仍由 PromptOverlay 承接”：
 * - direct: 当前手牌本体能承接的 hand prompt，单选点卡即提交，多选点卡后确认
 * - overlay: 选项不全在当前手牌本体上，仍由 PromptOverlay 承接
 * - none: 不是当前玩家的 hand prompt
 */
export function resolveSmashUpHandPromptUiMode({
    currentPrompt,
    playerID,
    targetType,
    hand,
}: ResolveHandPromptUiModeInput): SmashUpHandPromptUiMode {
    if (!isSmashUpPromptOwnedByPlayer({ currentPrompt, playerID })) return 'none';
    if (targetType !== 'hand') return 'none';
    if (hasEnabledCardOptionOutsideHand(currentPrompt, hand)) return 'overlay';
    return 'direct';
}

export function hasSmashUpDirectHandPromptPlayableOptions({
    currentPrompt,
    playerID,
    targetType,
    hand,
}: ResolveHandPromptUiModeInput): boolean {
    if (resolveSmashUpHandPromptUiMode({ currentPrompt, playerID, targetType, hand }) !== 'direct') {
        return false;
    }

    const options = (currentPrompt as ButtonOverlayPromptLike | undefined)?.options;
    if (!Array.isArray(options) || options.length === 0) return false;

    return options.some(option => {
        if (option?.disabled) return false;
        const value = option?.value as { cardUid?: unknown; titanUid?: unknown } | undefined;
        return typeof value?.cardUid === 'string' || typeof value?.titanUid === 'string';
    });
}

export function getSmashUpDirectHandPromptCardState({
    currentPrompt,
    playerID,
    targetType,
    hand,
}: ResolveDirectHandCardStateInput): {
    selectableCardUids: Set<string>;
    disabledCardUids?: Set<string>;
} {
    const selectableCardUids = new Set<string>();
    if (resolveSmashUpHandPromptUiMode({ currentPrompt, playerID, targetType, hand }) !== 'direct') {
        return { selectableCardUids };
    }

    const options = (currentPrompt as ButtonOverlayPromptLike | undefined)?.options;
    const disabledCardUids = new Set<string>();
    if (!Array.isArray(options) || options.length === 0) {
        return {
            selectableCardUids,
            disabledCardUids: hand?.length
                ? new Set((hand ?? []).flatMap(card => typeof card?.uid === 'string' ? [card.uid] : []))
                : undefined,
        };
    }

    for (const option of options) {
        const value = option?.value as { cardUid?: unknown } | undefined;
        if (typeof value?.cardUid !== 'string') continue;
        if (option?.disabled) {
            disabledCardUids.add(value.cardUid);
            continue;
        }
        selectableCardUids.add(value.cardUid);
    }

    for (const card of hand ?? []) {
        if (typeof card?.uid !== 'string') continue;
        if (!selectableCardUids.has(card.uid)) {
            disabledCardUids.add(card.uid);
        }
    }

    return {
        selectableCardUids,
        disabledCardUids: disabledCardUids.size > 0 ? disabledCardUids : undefined,
    };
}

export function shouldRenderSmashUpHandArea({
    currentPrompt,
    playerID,
    targetType,
    activePromptSurface,
    hand,
}: ResolveHandAreaVisibilityInput): boolean {
    if (activePromptSurface === 'overlay') return false;

    const handPromptUiMode = resolveSmashUpHandPromptUiMode({
        currentPrompt,
        playerID,
        targetType,
        hand,
    });
    if (handPromptUiMode !== 'direct') return true;

    return hasSmashUpDirectHandPromptPlayableOptions({
        currentPrompt,
        playerID,
        targetType,
        hand,
    });
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
