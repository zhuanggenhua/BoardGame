const parseCssPixelValue = (value: string | null | undefined): number => {
    const parsed = Number.parseFloat(value ?? '');
    return Number.isFinite(parsed) ? parsed : 0;
};

const readKeyboardInsetHeight = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return 0;
    }

    const rootStyles = window.getComputedStyle(document.documentElement);
    return parseCssPixelValue(rootStyles.getPropertyValue('--keyboard-inset-height'));
};

const readRuntimeVisibleBounds = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return { top: 16, bottom: 0 };
    }

    const rootStyles = window.getComputedStyle(document.documentElement);
    const viewportHeight = Math.max(
        parseCssPixelValue(rootStyles.getPropertyValue('--runtime-viewport-height')),
        window.visualViewport?.height ?? 0,
        window.innerHeight,
    );
    const safeAreaTop = parseCssPixelValue(rootStyles.getPropertyValue('--safe-area-top'));
    const safeAreaBottom = parseCssPixelValue(rootStyles.getPropertyValue('--safe-area-bottom'));
    const viewportPadding = 16;

    return {
        top: safeAreaTop + viewportPadding,
        bottom: Math.max(0, viewportHeight - safeAreaBottom - viewportPadding),
    };
};

const isVerticallyScrollable = (candidate: HTMLElement): boolean => {
    const styles = window.getComputedStyle(candidate);
    const overflowY = styles.overflowY.toLowerCase();
    const canScroll = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    return canScroll && candidate.scrollHeight > candidate.clientHeight + 1;
};

const findNearestScrollableAncestor = (candidate: HTMLElement): HTMLElement | null => {
    let current = candidate.parentElement;
    while (current && current !== document.body) {
        if (isVerticallyScrollable(current)) {
            return current;
        }
        current = current.parentElement;
    }
    return null;
};

export const isTextEntryElement = (candidate: Element | null): candidate is HTMLElement => {
    if (typeof HTMLElement === 'undefined' || !(candidate instanceof HTMLElement)) {
        return false;
    }

    const contentEditableAttr = candidate.getAttribute('contenteditable');
    if (
        candidate.isContentEditable
        || contentEditableAttr === ''
        || contentEditableAttr?.toLowerCase() === 'true'
        || contentEditableAttr?.toLowerCase() === 'plaintext-only'
    ) {
        return true;
    }

    const tagName = candidate.tagName.toLowerCase();
    if (tagName === 'textarea') {
        const textarea = candidate as HTMLTextAreaElement;
        return !textarea.readOnly && !textarea.disabled;
    }

    if (tagName !== 'input') {
        return false;
    }

    const input = candidate as HTMLInputElement;
    if (input.readOnly || input.disabled) {
        return false;
    }

    const blockedTypes = new Set([
        'button',
        'checkbox',
        'color',
        'file',
        'hidden',
        'image',
        'radio',
        'range',
        'reset',
        'submit',
    ]);
    return !blockedTypes.has(input.type.toLowerCase());
};

const resolvePreferredVisibleBand = (
    effectiveTop: number,
    effectiveBottom: number,
    candidateHeight: number,
    keyboardInsetHeight: number,
) => {
    if (keyboardInsetHeight <= 0) {
        return {
            preferredTop: effectiveTop,
            preferredBottom: effectiveBottom,
        };
    }

    const desiredBottomClearance = Math.min(
        140,
        Math.max(72, keyboardInsetHeight * 0.4, candidateHeight * 2),
    );
    const minimumBottom = effectiveTop + candidateHeight + 24;
    const preferredBottom = Math.max(minimumBottom, effectiveBottom - desiredBottomClearance);

    return {
        preferredTop: effectiveTop + 12,
        preferredBottom,
    };
};

export const scrollTextEntryIntoView = (
    candidate: Element | null,
    behavior: ScrollBehavior = 'smooth',
) => {
    if (!isTextEntryElement(candidate)) {
        return false;
    }

    const scrollContainer = findNearestScrollableAncestor(candidate);
    if (scrollContainer) {
        const candidateRect = candidate.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        const visibleBounds = readRuntimeVisibleBounds();
        const keyboardInsetHeight = readKeyboardInsetHeight();
        const effectiveTop = Math.max(containerRect.top, visibleBounds.top);
        const effectiveBottom = Math.min(containerRect.bottom, visibleBounds.bottom);
        const { preferredTop, preferredBottom } = resolvePreferredVisibleBand(
            effectiveTop,
            effectiveBottom,
            candidateRect.height,
            keyboardInsetHeight,
        );
        let nextScrollTop = scrollContainer.scrollTop;

        if (candidateRect.bottom > preferredBottom) {
            nextScrollTop += candidateRect.bottom - preferredBottom;
        } else if (candidateRect.top < preferredTop) {
            nextScrollTop -= preferredTop - candidateRect.top;
        }

        if (Math.abs(nextScrollTop - scrollContainer.scrollTop) > 1) {
            const resolvedTop = Math.max(0, nextScrollTop);
            if (typeof scrollContainer.scrollTo === 'function') {
                scrollContainer.scrollTo({ top: resolvedTop, behavior });
            } else {
                scrollContainer.scrollTop = resolvedTop;
            }
            return true;
        }
    }

    candidate.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior,
    });
    return true;
};
