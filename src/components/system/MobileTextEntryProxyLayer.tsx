import { useEffect, useRef, useState, type ChangeEvent, type HTMLAttributes, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import {
    isTextEntryElement,
    isTextEntrySessionElement,
    isTextEntryProxyEligible,
    readTextEntryValue,
    syncProxyValueToTextEntry,
} from '../../lib/textEntry';
import { readLiveRuntimeKeyboardInsetBottom } from '../../hooks/ui/useRuntimeViewport';
import { UI_Z_INDEX } from '../../core';

interface ProxyState {
    target: HTMLElement;
    multiline: boolean;
    value: string;
    placeholder: string;
    inputType?: string;
    inputMode?: string;
    maxLength?: number;
    enterKeyHint?: string;
    className?: string;
    inlineStyle?: Record<string, string>;
}

interface PendingLayoutLockSnapshot {
    target: HTMLElement;
    lockedViewportContainer: HTMLElement | null;
    scrollTop: number;
    scrollLeft: number;
}

interface TargetProxySnapshot {
    readonly?: boolean;
    contentEditable?: string | null;
    caretColor?: string;
    hostPointerEvents?: string;
    lockedViewportBottomInset?: string | null;
    lockedViewportOverflowY?: string;
    lockedViewportScrollTop?: number;
    lockedViewportScrollLeft?: number;
}

const KEYBOARD_PROXY_MIN_INSET = 72;
const TARGET_PROXY_ATTR = 'data-mobile-text-entry-proxy-source';
const DEFAULT_PROXY_BACKGROUND = 'rgba(255, 248, 240, 0.98)';
const DEFAULT_PROXY_BOX_SHADOW = '0 18px 40px rgba(15, 23, 42, 0.18)';
const MOBILE_TEXT_ENTRY_DEBUG = false;
const POINTER_SWITCH_GRACE_MS = 600;
const SUBMIT_ENTER_KEY_HINTS = new Set(['enter', 'go', 'search', 'send']);
const MULTILINE_PROXY_MIN_HEIGHT = '96px';
const MULTILINE_PROXY_MAX_HEIGHT = 'min(160px, 28vh)';

const debugProxyEvent = (phase: string, details: Record<string, unknown> = {}) => {
    if (!MOBILE_TEXT_ENTRY_DEBUG || typeof console === 'undefined') {
        return;
    }
    try {
        console.warn('[mobile-text-proxy]', JSON.stringify({ phase, ...details }));
    } catch {
        console.warn('[mobile-text-proxy]', phase, details);
    }
};

const readCssKeyboardInset = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return 0;
    }

    const rawValue = window.getComputedStyle(document.documentElement).getPropertyValue('--keyboard-inset-height');
    const parsed = Number.parseFloat(rawValue || '0');
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const readCssViewportMetric = (name: string) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return 0;
    }

    const rawValue = window.getComputedStyle(document.documentElement).getPropertyValue(name);
    const parsed = Number.parseFloat(rawValue || '0');
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const resolveProxyBottomInset = (keyboardInset: number) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return Math.max(0, keyboardInset);
    }

    const runtimeViewportHeight = readCssViewportMetric('--runtime-viewport-height');
    const layoutViewportHeight = Math.max(
        readCssViewportMetric('--layout-viewport-height'),
        window.innerHeight,
        document.documentElement.clientHeight,
    );
    const runtimeViewportGap = runtimeViewportHeight > 0
        ? Math.max(0, layoutViewportHeight - runtimeViewportHeight)
        : 0;

    return Math.max(0, keyboardInset, runtimeViewportGap);
};

const isProxyUiElement = (candidate: EventTarget | Element | null | undefined): boolean => {
    return candidate instanceof HTMLElement
        && (candidate.dataset.testid === 'mobile-text-entry-proxy-input'
            || candidate.dataset.testid === 'mobile-text-entry-proxy-textarea'
            || candidate.dataset.testid === 'mobile-text-entry-proxy'
            || candidate.closest('[data-testid="mobile-text-entry-proxy"]') !== null);
};

const isTransparentColor = (value: string | null | undefined) => {
    if (!value) {
        return true;
    }

    const normalized = value.trim().toLowerCase();
    return normalized === ''
        || normalized === 'transparent'
        || normalized === 'rgba(0, 0, 0, 0)'
        || normalized === 'rgba(0,0,0,0)';
};

const getOwningForm = (target: HTMLElement | null) => {
    if (!target) {
        return null;
    }
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement) {
        return target.form;
    }
    return target.closest('form');
};

const sharesImplicitRetargetContext = (from: HTMLElement | null, to: HTMLElement | null) => {
    if (!from || !to) {
        return false;
    }

    const fromForm = getOwningForm(from);
    const toForm = getOwningForm(to);
    if (fromForm && fromForm === toForm) {
        return true;
    }

    const fromHost = from.closest('[data-mobile-text-entry-proxy-host="true"]');
    const toHost = to.closest('[data-mobile-text-entry-proxy-host="true"]');
    return fromHost instanceof HTMLElement && fromHost === toHost;
};

const deriveProxyInputType = (input: HTMLInputElement | null): string | undefined => {
    if (!input) {
        return undefined;
    }
    const normalized = input.type.toLowerCase();
    switch (normalized) {
        case 'password':
        case 'search':
        case 'tel':
        case 'text':
        case 'url':
            return normalized;
        default:
            return 'text';
    }
};

const deriveProxyInputMode = (target: HTMLElement, input: HTMLInputElement | null): string | undefined => {
    const explicitInputMode = input?.inputMode || target.getAttribute('inputmode') || undefined;
    if (explicitInputMode) {
        return explicitInputMode;
    }
    const normalized = input?.type.toLowerCase();
    switch (normalized) {
        case 'email':
            return 'email';
        case 'number':
            return 'decimal';
        default:
            return undefined;
    }
};

const safeSetInputSelection = (input: HTMLInputElement | HTMLTextAreaElement, selectionStart: number, selectionEnd: number) => {
    try {
        input.setSelectionRange(selectionStart, selectionEnd);
    } catch (error) {
        debugProxyEvent('selection-range-skip', {
            inputType: input instanceof HTMLInputElement ? input.type : 'textarea',
            message: error instanceof Error ? error.message : String(error),
        });
    }
};

const buildProxyState = (target: HTMLElement): ProxyState => {
    const tagName = target.tagName.toLowerCase();
    const multiline = tagName === 'textarea' || target.getAttribute('contenteditable') !== null || target.isContentEditable;
    const input = tagName === 'input' ? target as HTMLInputElement : null;
    const computed = window.getComputedStyle(target);

    return {
        target,
        multiline,
        value: readTextEntryValue(target),
        placeholder: target.getAttribute('placeholder') ?? '',
        inputType: deriveProxyInputType(input),
        inputMode: deriveProxyInputMode(target, input),
        maxLength: input?.maxLength && input.maxLength > 0 ? input.maxLength : undefined,
        enterKeyHint: input?.enterKeyHint || target.getAttribute('enterkeyhint') || undefined,
        className: target.className,
        inlineStyle: {
            minHeight: multiline ? MULTILINE_PROXY_MIN_HEIGHT : computed.minHeight,
            height: multiline ? 'auto' : 'auto',
            maxHeight: multiline ? MULTILINE_PROXY_MAX_HEIGHT : computed.maxHeight,
            paddingTop: computed.paddingTop,
            paddingRight: computed.paddingRight,
            paddingBottom: computed.paddingBottom,
            paddingLeft: computed.paddingLeft,
            borderRadius: computed.borderRadius,
            borderWidth: computed.borderWidth,
            borderStyle: computed.borderStyle,
            borderColor: computed.borderColor,
            background: isTransparentColor(computed.backgroundColor) ? DEFAULT_PROXY_BACKGROUND : computed.background,
            backgroundColor: isTransparentColor(computed.backgroundColor) ? DEFAULT_PROXY_BACKGROUND : computed.backgroundColor,
            color: computed.color,
            font: computed.font,
            letterSpacing: computed.letterSpacing,
            lineHeight: computed.lineHeight,
            boxShadow: computed.boxShadow === 'none' ? DEFAULT_PROXY_BOX_SHADOW : computed.boxShadow,
            textAlign: computed.textAlign,
        },
    };
};

const areInlineStylesEqual = (
    left?: Record<string, string>,
    right?: Record<string, string>,
) => {
    if (left === right) {
        return true;
    }
    if (!left || !right) {
        return !left && !right;
    }

    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
        return false;
    }

    return leftKeys.every((key) => left[key] === right[key]);
};

const areProxyStatesEquivalent = (current: ProxyState | null, next: ProxyState) => {
    if (!current) {
        return false;
    }

    return current.target === next.target
        && current.multiline === next.multiline
        && current.value === next.value
        && current.placeholder === next.placeholder
        && current.inputType === next.inputType
        && current.inputMode === next.inputMode
        && current.maxLength === next.maxLength
        && current.enterKeyHint === next.enterKeyHint
        && current.className === next.className
        && areInlineStylesEqual(current.inlineStyle, next.inlineStyle);
};

const capturePendingLayoutLockSnapshot = (target: HTMLElement): PendingLayoutLockSnapshot => {
    const lockedViewportContainer = target.closest('[data-lock-layout-viewport="true"]');
    return {
        target,
        lockedViewportContainer: lockedViewportContainer instanceof HTMLElement ? lockedViewportContainer : null,
        scrollTop: lockedViewportContainer instanceof HTMLElement ? lockedViewportContainer.scrollTop : 0,
        scrollLeft: lockedViewportContainer instanceof HTMLElement ? lockedViewportContainer.scrollLeft : 0,
    };
};

const freezeTargetForProxy = (
    target: HTMLElement,
    pendingLayoutLockSnapshot: PendingLayoutLockSnapshot | null,
): TargetProxySnapshot => {
    const host = target.closest('[data-mobile-text-entry-proxy-host="true"]');
    const lockedViewportContainer = target.closest('[data-lock-layout-viewport="true"]');
    const matchedPendingLayoutSnapshot = (
        pendingLayoutLockSnapshot
        && pendingLayoutLockSnapshot.target === target
        && pendingLayoutLockSnapshot.lockedViewportContainer === lockedViewportContainer
    ) ? pendingLayoutLockSnapshot : null;
    const snapshot: TargetProxySnapshot = {
        caretColor: target.style.caretColor,
        hostPointerEvents: host instanceof HTMLElement ? host.style.pointerEvents : undefined,
        lockedViewportBottomInset: lockedViewportContainer instanceof HTMLElement
            ? lockedViewportContainer.style.getPropertyValue('--modal-active-bottom-inset')
            : null,
        lockedViewportOverflowY: lockedViewportContainer instanceof HTMLElement ? lockedViewportContainer.style.overflowY : undefined,
        lockedViewportScrollTop: lockedViewportContainer instanceof HTMLElement
            ? (matchedPendingLayoutSnapshot?.scrollTop ?? lockedViewportContainer.scrollTop)
            : undefined,
        lockedViewportScrollLeft: lockedViewportContainer instanceof HTMLElement
            ? (matchedPendingLayoutSnapshot?.scrollLeft ?? lockedViewportContainer.scrollLeft)
            : undefined,
    };

    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        snapshot.readonly = target.readOnly;
        target.readOnly = true;
    } else if (target.isContentEditable || target.getAttribute('contenteditable') !== null) {
        snapshot.contentEditable = target.getAttribute('contenteditable');
        target.setAttribute('contenteditable', 'false');
    }

    target.style.caretColor = 'transparent';
    if (host instanceof HTMLElement) {
        host.style.pointerEvents = 'none';
    }
    if (lockedViewportContainer instanceof HTMLElement) {
        lockedViewportContainer.scrollTop = matchedPendingLayoutSnapshot?.scrollTop ?? lockedViewportContainer.scrollTop;
        lockedViewportContainer.scrollLeft = matchedPendingLayoutSnapshot?.scrollLeft ?? lockedViewportContainer.scrollLeft;
        lockedViewportContainer.style.setProperty('--modal-active-bottom-inset', 'var(--safe-area-bottom)');
        lockedViewportContainer.style.overflowY = 'hidden';
    }
    target.setAttribute(TARGET_PROXY_ATTR, 'true');

    return snapshot;
};

const restoreTargetAfterProxy = (target: HTMLElement, snapshot: TargetProxySnapshot | null) => {
    const host = target.closest('[data-mobile-text-entry-proxy-host="true"]');
    const lockedViewportContainer = target.closest('[data-lock-layout-viewport="true"]');
    target.removeAttribute(TARGET_PROXY_ATTR);
    target.style.caretColor = snapshot?.caretColor ?? '';
    if (host instanceof HTMLElement) {
        host.style.pointerEvents = snapshot?.hostPointerEvents ?? '';
    }
    if (lockedViewportContainer instanceof HTMLElement) {
        lockedViewportContainer.scrollTop = snapshot?.lockedViewportScrollTop ?? lockedViewportContainer.scrollTop;
        lockedViewportContainer.scrollLeft = snapshot?.lockedViewportScrollLeft ?? lockedViewportContainer.scrollLeft;
        lockedViewportContainer.style.overflowY = snapshot?.lockedViewportOverflowY ?? '';
        if (snapshot?.lockedViewportBottomInset && snapshot.lockedViewportBottomInset.length > 0) {
            lockedViewportContainer.style.setProperty('--modal-active-bottom-inset', snapshot.lockedViewportBottomInset);
        } else {
            lockedViewportContainer.style.removeProperty('--modal-active-bottom-inset');
        }
    }

    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        target.readOnly = snapshot?.readonly ?? false;
    } else if (snapshot && 'contentEditable' in snapshot) {
        if (snapshot.contentEditable == null) {
            target.removeAttribute('contenteditable');
        } else {
            target.setAttribute('contenteditable', snapshot.contentEditable);
        }
    }
};

export const MobileTextEntryProxyLayer = () => {
    const portalRoot = typeof document === 'undefined'
        ? null
        : (document.getElementById('modal-root') ?? document.body);
    const [proxyState, setProxyState] = useState<ProxyState | null>(null);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const proxiedTargetRef = useRef<HTMLElement | null>(null);
    const proxiedSnapshotRef = useRef<TargetProxySnapshot | null>(null);
    const blurCleanupTimerRef = useRef<number | null>(null);
    const lastKeyboardInsetRef = useRef<number>(0);
    const lastPointerIntentRef = useRef<{ at: number; target: HTMLElement | null }>({ at: 0, target: null });
    const suppressProxyRestoreUntilRef = useRef<number>(0);
    const pendingLayoutLockSnapshotRef = useRef<PendingLayoutLockSnapshot | null>(null);
    const proxyTarget = proxyState?.target ?? null;

    const dismissProxySession = () => {
        const proxyInput = inputRef.current;
        if (proxyInput && document.activeElement === proxyInput) {
            proxyInput.blur();
        }
        if (proxyTarget && document.activeElement === proxyTarget) {
            proxyTarget.blur();
        }
        debugProxyEvent('dismiss-session', {
            activeTag: document.activeElement instanceof HTMLElement ? document.activeElement.tagName : null,
            activeTestId: document.activeElement instanceof HTMLElement ? document.activeElement.getAttribute('data-testid') : null,
        });
        setProxyState(null);
    };

    const hasRecentPointerIntentFor = (target: HTMLElement | null) => {
        const { at, target: pointerTarget } = lastPointerIntentRef.current;
        if (!target || !pointerTarget) {
            return false;
        }
        if (Date.now() - at > POINTER_SWITCH_GRACE_MS) {
            return false;
        }
        return pointerTarget === target || target.contains(pointerTarget) || pointerTarget.contains(target);
    };

    const shouldSuppressImplicitProxyRetarget = (target: Element | null) => {
        if (!(target instanceof HTMLElement)) {
            return false;
        }
        if (!proxiedTargetRef.current || target === proxiedTargetRef.current) {
            return false;
        }
        if (!isTextEntryElement(target) || !isTextEntryProxyEligible(target)) {
            return false;
        }
        if (sharesImplicitRetargetContext(proxiedTargetRef.current, target)) {
            return false;
        }
        return !hasRecentPointerIntentFor(target);
    };

    const markSuppressedImplicitRetarget = () => {
        suppressProxyRestoreUntilRef.current = Date.now() + POINTER_SWITCH_GRACE_MS;
    };

    const shouldSkipProxyRestore = () => suppressProxyRestoreUntilRef.current > Date.now();

    const readKeyboardInset = () => {
        const cssInset = readCssKeyboardInset();
        const activeElement = typeof document === 'undefined' ? null : document.activeElement;
        const activeProxySession = activeElement === inputRef.current
            || isProxyUiElement(activeElement)
            || isTextEntrySessionElement(activeElement);
        const liveInset = readLiveRuntimeKeyboardInsetBottom({
            hasFocusedTextEntry: activeProxySession,
        });
        const nextInset = Math.max(cssInset, liveInset);

        if (nextInset >= KEYBOARD_PROXY_MIN_INSET) {
            lastKeyboardInsetRef.current = nextInset;
            return nextInset;
        }

        if (activeProxySession && lastKeyboardInsetRef.current >= KEYBOARD_PROXY_MIN_INSET) {
            return lastKeyboardInsetRef.current;
        }

        lastKeyboardInsetRef.current = 0;
        return 0;
    };

    useEffect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return undefined;
        }

        const clearPendingBlurCleanup = () => {
            if (blurCleanupTimerRef.current != null) {
                window.clearTimeout(blurCleanupTimerRef.current);
                blurCleanupTimerRef.current = null;
            }
        };

        const scheduleProxyClear = (delayMs: number) => {
            clearPendingBlurCleanup();
            blurCleanupTimerRef.current = window.setTimeout(() => {
                blurCleanupTimerRef.current = null;
                setProxyState(null);
            }, delayMs);
        };

        const activateProxy = (target: HTMLElement) => {
            clearPendingBlurCleanup();
            if (isProxyUiElement(target) || target === inputRef.current) {
                return;
            }
            const targetTag = target.tagName;
            const targetTestId = target.getAttribute('data-testid');
            if (!isTextEntryProxyEligible(target)) {
                debugProxyEvent('activate-skip-ineligible', {
                    tag: targetTag,
                    testId: targetTestId,
                });
                setProxyState(null);
                return;
            }
            debugProxyEvent('activate-proxy', {
                tag: targetTag,
                testId: targetTestId,
                placeholder: target.getAttribute('placeholder'),
                cssInset: readCssKeyboardInset(),
                keyboardInset: readKeyboardInset(),
            });
            setProxyState((current) => {
                const next = buildProxyState(target);
                return areProxyStatesEquivalent(current, next) ? current : next;
            });
        };

        const maybeActivateFromActiveElement = () => {
            const active = document.activeElement;
            if (!isTextEntryElement(active) || !isTextEntryProxyEligible(active)) {
                return;
            }
            if (readKeyboardInset() < KEYBOARD_PROXY_MIN_INSET) {
                return;
            }
            activateProxy(active);
        };

        const handleFocusIn = (event: FocusEvent) => {
            const target = event.target;
            const targetElement = target instanceof HTMLElement ? target : null;
            debugProxyEvent('focusin', {
                eventTargetTag: targetElement ? targetElement.tagName : typeof target,
                eventTargetTestId: targetElement ? targetElement.getAttribute('data-testid') : null,
                activeTag: document.activeElement instanceof HTMLElement ? document.activeElement.tagName : null,
                activeTestId: document.activeElement instanceof HTMLElement ? document.activeElement.getAttribute('data-testid') : null,
                cssInset: readCssKeyboardInset(),
                keyboardInset: readKeyboardInset(),
            });
            if (isProxyUiElement(targetElement) || targetElement === inputRef.current) {
                return;
            }
            if (!isTextEntryElement(targetElement)) {
                debugProxyEvent('focusin-clear-non-text-entry');
                scheduleProxyClear(160);
                return;
            }

            const targetTag = targetElement.tagName;
            const targetTestId = targetElement.getAttribute('data-testid');
            if (!isTextEntryProxyEligible(targetElement)) {
                debugProxyEvent('focusin-clear-ineligible', {
                    tag: targetTag,
                    testId: targetTestId,
                });
                scheduleProxyClear(160);
                return;
            }

            pendingLayoutLockSnapshotRef.current = capturePendingLayoutLockSnapshot(targetElement);
            window.setTimeout(() => {
                if (readKeyboardInset() >= KEYBOARD_PROXY_MIN_INSET) {
                    activateProxy(targetElement);
                }
            }, 40);
        };

        const handleFocusOut = () => {
            debugProxyEvent('focusout', {
                activeTag: document.activeElement instanceof HTMLElement ? document.activeElement.tagName : null,
                activeTestId: document.activeElement instanceof HTMLElement ? document.activeElement.getAttribute('data-testid') : null,
                cssInset: readCssKeyboardInset(),
                keyboardInset: readKeyboardInset(),
            });
            window.setTimeout(() => {
                const active = document.activeElement;
                if (active === inputRef.current || isProxyUiElement(active)) {
                    return;
                }
                if (shouldSuppressImplicitProxyRetarget(active)) {
                    markSuppressedImplicitRetarget();
                    debugProxyEvent('focusout-suppress-implicit-retarget', {
                        activeTag: active instanceof HTMLElement ? active.tagName : null,
                        activeTestId: active instanceof HTMLElement ? active.getAttribute('data-testid') : null,
                    });
                    (active as HTMLElement).blur();
                    setProxyState(null);
                    return;
                }
                if (isTextEntryElement(active) && isTextEntryProxyEligible(active) && readKeyboardInset() >= KEYBOARD_PROXY_MIN_INSET) {
                    activateProxy(active);
                    return;
                }
                if (shouldSkipProxyRestore()) {
                    debugProxyEvent('focusout-skip-restore-after-suppressed-retarget');
                    setProxyState(null);
                    return;
                }
                if (blurCleanupTimerRef.current != null) {
                    return;
                }
                if (proxiedTargetRef.current && readKeyboardInset() >= KEYBOARD_PROXY_MIN_INSET) {
                    clearPendingBlurCleanup();
                    setProxyState((current) => current ?? (proxiedTargetRef.current ? buildProxyState(proxiedTargetRef.current) : null));
                    return;
                }
                debugProxyEvent('focusout-clear-proxy', {
                    activeTag: active instanceof HTMLElement ? active.tagName : null,
                    activeTestId: active instanceof HTMLElement ? active.getAttribute('data-testid') : null,
                    cssInset: readCssKeyboardInset(),
                    keyboardInset: readKeyboardInset(),
                });
                setProxyState(null);
            }, 80);
        };

        const handleViewportResize = () => {
            debugProxyEvent('viewport-resize', {
                activeTag: document.activeElement instanceof HTMLElement ? document.activeElement.tagName : null,
                activeTestId: document.activeElement instanceof HTMLElement ? document.activeElement.getAttribute('data-testid') : null,
                cssInset: readCssKeyboardInset(),
                keyboardInset: readKeyboardInset(),
                visualViewportHeight: window.visualViewport?.height ?? null,
            });
            if (readKeyboardInset() < KEYBOARD_PROXY_MIN_INSET) {
                debugProxyEvent('viewport-resize-clear-proxy');
                setProxyState(null);
                return;
            }
            maybeActivateFromActiveElement();
        };

        const handlePointerIntent = (event: Event) => {
            const target = event.target instanceof HTMLElement ? event.target : null;
            lastPointerIntentRef.current = { at: Date.now(), target };
        };

        document.addEventListener('focusin', handleFocusIn, true);
        document.addEventListener('focusout', handleFocusOut, true);
        document.addEventListener('pointerdown', handlePointerIntent, true);
        document.addEventListener('touchstart', handlePointerIntent, true);
        document.addEventListener('mousedown', handlePointerIntent, true);
        window.visualViewport?.addEventListener('resize', handleViewportResize);

        return () => {
            clearPendingBlurCleanup();
            document.removeEventListener('focusin', handleFocusIn, true);
            document.removeEventListener('focusout', handleFocusOut, true);
            document.removeEventListener('pointerdown', handlePointerIntent, true);
            document.removeEventListener('touchstart', handlePointerIntent, true);
            document.removeEventListener('mousedown', handlePointerIntent, true);
            window.visualViewport?.removeEventListener('resize', handleViewportResize);
        };
        // 这里需要维持单次挂载的 document 级监听，隐式重绑判定读取的是 ref 最新值而不是闭包快照。
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!proxyState) {
            return undefined;
        }

        const syncFromTarget = () => {
            setProxyState((current) => {
                if (!current || current.target !== proxyState.target) {
                    return current;
                }
                const nextValue = readTextEntryValue(current.target);
                if (current.value === nextValue) {
                    return current;
                }
                return {
                    ...current,
                    value: nextValue,
                };
            });
        };

        proxyState.target.addEventListener('input', syncFromTarget);
        proxyState.target.addEventListener('change', syncFromTarget);

        return () => {
            proxyState.target.removeEventListener('input', syncFromTarget);
            proxyState.target.removeEventListener('change', syncFromTarget);
        };
    }, [proxyState]);

    useEffect(() => {
        const previousTarget = proxiedTargetRef.current;
        if (previousTarget && previousTarget !== proxyTarget) {
            restoreTargetAfterProxy(previousTarget, proxiedSnapshotRef.current);
            proxiedTargetRef.current = null;
            proxiedSnapshotRef.current = null;
        }

        if (!proxyTarget) {
            return undefined;
        }

        if (proxiedTargetRef.current !== proxyTarget) {
            proxiedSnapshotRef.current = freezeTargetForProxy(proxyTarget, pendingLayoutLockSnapshotRef.current);
            proxiedTargetRef.current = proxyTarget;
            pendingLayoutLockSnapshotRef.current = null;
            debugProxyEvent('freeze-target', {
                tag: proxyTarget.tagName,
                testId: proxyTarget.getAttribute('data-testid'),
                placeholder: proxyTarget.getAttribute('placeholder'),
            });
        }

        const next = inputRef.current;
        if (next) {
            next.focus({ preventScroll: true });
            const selectionEnd = readTextEntryValue(proxyTarget).length;
            safeSetInputSelection(next, selectionEnd, selectionEnd);
        }

        return () => {
            if (!proxyTarget) {
                return;
            }
            if (proxiedTargetRef.current === proxyTarget) {
                restoreTargetAfterProxy(proxyTarget, proxiedSnapshotRef.current);
                proxiedTargetRef.current = null;
                proxiedSnapshotRef.current = null;
            }
        };
    }, [proxyTarget]);

    if (!portalRoot || !proxyState) {
        return null;
    }

    // 代理层显示期间需要读取当前运行时键盘 inset；这里读取 ref 支撑的运行时值是有意设计。
    const keyboardInset = readKeyboardInset();
    const resolvedEnterKeyHint = proxyState.enterKeyHint
        ?? (proxyState.multiline
            ? undefined
            : proxyState.inputType === 'search'
                ? 'search'
                : getOwningForm(proxyState.target)
                    ? 'enter'
                    : 'done');
    const submitAndDismissProxySession = () => {
        debugProxyEvent('proxy-submit', {
            targetTag: proxyState.target.tagName,
            targetTestId: proxyState.target.getAttribute('data-testid'),
            inputType: proxyState.inputType,
            activeTag: document.activeElement instanceof HTMLElement ? document.activeElement.tagName : null,
            activeTestId: document.activeElement instanceof HTMLElement ? document.activeElement.getAttribute('data-testid') : null,
        });
        const form = getOwningForm(proxyState.target);
        if (form) {
            const submitter = form.querySelector('button[type="submit"]:not(:disabled), input[type="submit"]:not(:disabled)');
            if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) {
                submitter.click();
                dismissProxySession();
                return;
            }
            if (typeof form.requestSubmit === 'function') {
                form.requestSubmit();
                dismissProxySession();
                return;
            }
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
        dismissProxySession();
    };
    const setProxyInputRef = (node: HTMLInputElement | null) => {
        inputRef.current = node;
    };
    const setProxyTextareaRef = (node: HTMLTextAreaElement | null) => {
        inputRef.current = node;
    };

    const sharedProps = {
        value: proxyState.value,
        placeholder: proxyState.placeholder,
        inputMode: proxyState.inputMode as HTMLAttributes<HTMLInputElement>['inputMode'],
        maxLength: proxyState.maxLength,
        enterKeyHint: resolvedEnterKeyHint as HTMLAttributes<HTMLInputElement>['enterKeyHint'],
        autoCapitalize: 'sentences' as const,
        autoCorrect: 'on',
        spellCheck: true,
        className: `pointer-events-auto ${proxyState.className || 'w-full'}`,
        style: {
            width: '100%',
            ...proxyState.inlineStyle,
        },
        onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const nextValue = event.target.value;
            debugProxyEvent('proxy-change', {
                valueLength: nextValue.length,
                cssInset: readCssKeyboardInset(),
                keyboardInset: readKeyboardInset(),
                activeTag: document.activeElement instanceof HTMLElement ? document.activeElement.tagName : null,
                activeTestId: document.activeElement instanceof HTMLElement ? document.activeElement.getAttribute('data-testid') : null,
            });
            setProxyState((current) => (current ? { ...current, value: nextValue } : current));
            syncProxyValueToTextEntry(proxyState.target, nextValue);
        },
        onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            debugProxyEvent('proxy-keydown', {
                key: event.key,
                code: event.code,
                isComposing: event.nativeEvent.isComposing,
                shiftKey: event.shiftKey,
                enterKeyHint: resolvedEnterKeyHint,
                activeTag: document.activeElement instanceof HTMLElement ? document.activeElement.tagName : null,
                activeTestId: document.activeElement instanceof HTMLElement ? document.activeElement.getAttribute('data-testid') : null,
            });
            if (
                event.key === 'Enter'
                && !proxyState.multiline
                && !event.shiftKey
                && !event.nativeEvent.isComposing
            ) {
                event.preventDefault();
                if (resolvedEnterKeyHint && SUBMIT_ENTER_KEY_HINTS.has(resolvedEnterKeyHint)) {
                    submitAndDismissProxySession();
                    return;
                }
                dismissProxySession();
                return;
            }

            const forwardedEvent = new KeyboardEvent('keydown', {
                key: event.key,
                code: event.code,
                location: event.location,
                repeat: event.repeat,
                isComposing: event.nativeEvent.isComposing,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                metaKey: event.metaKey,
                bubbles: true,
                cancelable: true,
            });
            const notCancelled = proxyState.target.dispatchEvent(forwardedEvent);
            if (!notCancelled || forwardedEvent.defaultPrevented) {
                event.preventDefault();
                return;
            }
        },
        onKeyUp: (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            debugProxyEvent('proxy-keyup', {
                key: event.key,
                code: event.code,
                isComposing: event.nativeEvent.isComposing,
                activeTag: document.activeElement instanceof HTMLElement ? document.activeElement.tagName : null,
                activeTestId: document.activeElement instanceof HTMLElement ? document.activeElement.getAttribute('data-testid') : null,
            });
            const forwardedEvent = new KeyboardEvent('keyup', {
                key: event.key,
                code: event.code,
                location: event.location,
                repeat: event.repeat,
                isComposing: event.nativeEvent.isComposing,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                metaKey: event.metaKey,
                bubbles: true,
                cancelable: true,
            });
            proxyState.target.dispatchEvent(forwardedEvent);
        },
        onBlur: () => {
            debugProxyEvent('proxy-blur', {
                activeTag: document.activeElement instanceof HTMLElement ? document.activeElement.tagName : null,
                activeTestId: document.activeElement instanceof HTMLElement ? document.activeElement.getAttribute('data-testid') : null,
                cssInset: readCssKeyboardInset(),
                keyboardInset: readKeyboardInset(),
            });
            if (blurCleanupTimerRef.current != null) {
                window.clearTimeout(blurCleanupTimerRef.current);
            }
            blurCleanupTimerRef.current = window.setTimeout(() => {
                blurCleanupTimerRef.current = null;
                const active = document.activeElement;
                if (active === inputRef.current || isProxyUiElement(active)) {
                    return;
                }
                if (shouldSuppressImplicitProxyRetarget(active)) {
                    markSuppressedImplicitRetarget();
                    debugProxyEvent('proxy-blur-suppress-implicit-retarget', {
                        activeTag: active instanceof HTMLElement ? active.tagName : null,
                        activeTestId: active instanceof HTMLElement ? active.getAttribute('data-testid') : null,
                    });
                    (active as HTMLElement).blur();
                    setProxyState(null);
                    return;
                }
                if (isTextEntryElement(active) && isTextEntryProxyEligible(active) && readKeyboardInset() >= KEYBOARD_PROXY_MIN_INSET) {
                    setProxyState((current) => {
                        const next = buildProxyState(active);
                        return areProxyStatesEquivalent(current, next) ? current : next;
                    });
                    return;
                }
                debugProxyEvent('proxy-blur-clear', {
                    activeTag: active instanceof HTMLElement ? active.tagName : null,
                    activeTestId: active instanceof HTMLElement ? active.getAttribute('data-testid') : null,
                    cssInset: readCssKeyboardInset(),
                    keyboardInset: readKeyboardInset(),
                });
                setProxyState(null);
            }, 100);
        },
        'data-testid': 'mobile-text-entry-proxy-input',
    };

    const proxyBottomInset = resolveProxyBottomInset(keyboardInset);

    return createPortal(
        <div
            className="fixed inset-x-0 bottom-0 pointer-events-none"
            style={{ zIndex: UI_Z_INDEX.textEntryProxy }}
            data-testid="mobile-text-entry-proxy"
        >
            <form
                className="pointer-events-none mx-auto w-full max-w-3xl px-3"
                style={{ paddingBottom: `max(12px, calc(${proxyBottomInset}px + var(--safe-area-bottom)))` }}
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!proxyState.multiline) {
                        submitAndDismissProxySession();
                    }
                }}
            >
                {proxyState.multiline ? (
                    <textarea
                        {...sharedProps}
                        ref={setProxyTextareaRef}
                        rows={3}
                        data-testid="mobile-text-entry-proxy-textarea"
                        className={`${sharedProps.className} resize-none`}
                    />
                ) : (
                    <input
                        {...sharedProps}
                        ref={setProxyInputRef}
                        type={proxyState.inputType ?? 'text'}
                        data-testid="mobile-text-entry-proxy-input"
                    />
                )}
            </form>
        </div>,
        portalRoot,
    );
};

export default MobileTextEntryProxyLayer;
