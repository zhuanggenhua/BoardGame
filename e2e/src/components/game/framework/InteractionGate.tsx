/**
 * 交互禁用遮罩
 * 在 canInteract=false 时拦截交互并触发 denied 音效。
 */

import React, { useEffect, useMemo } from 'react';
import { UI_Z_INDEX } from '../../../core';
import { useInteractionGuard } from './InteractionGuard';

const DEFAULT_ALLOWED_SELECTORS = ['[data-interaction-allow]', '[data-interaction-allow="true"]'];

export interface InteractionGateProps {
    active: boolean;
    containerRef: React.RefObject<HTMLElement | null>;
    allowedSelectors?: string[];
    allowedRefs?: Array<React.RefObject<HTMLElement | null>>;
    reason?: string;
    className?: string;
    zIndex?: number;
}

export const InteractionGate: React.FC<InteractionGateProps> = ({
    active,
    containerRef,
    allowedSelectors,
    allowedRefs,
    reason = 'interaction-gate',
    className,
    zIndex = UI_Z_INDEX.overlay,
}) => {
    const guard = useInteractionGuard();
    const resolvedSelectors = useMemo(
        () => (allowedSelectors && allowedSelectors.length > 0 ? allowedSelectors : DEFAULT_ALLOWED_SELECTORS),
        [allowedSelectors]
    );

    useEffect(() => {
        if (!active) return undefined;
        const container = containerRef.current;
        if (!container) return undefined;

        const isAllowedTarget = (target: EventTarget | null) => {
            if (!(target instanceof Element)) return false;
            if (resolvedSelectors.some((selector) => target.closest(selector))) return true;
            if (allowedRefs && allowedRefs.some((ref) => ref.current && ref.current.contains(target))) return true;
            return false;
        };

        const handlePointerDown = (event: PointerEvent) => {
            if (isAllowedTarget(event.target)) return;
            guard.notifyDenied(reason, { key: reason });
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
        };

        const iframes = Array.from(container.querySelectorAll('iframe'));
        const iframePointerStates = new Map<HTMLIFrameElement, string>();
        iframes.forEach((iframe) => {
            iframePointerStates.set(iframe, iframe.style.pointerEvents);
            iframe.style.pointerEvents = 'none';
        });

        container.addEventListener('pointerdown', handlePointerDown, true);
        return () => {
            container.removeEventListener('pointerdown', handlePointerDown, true);
            iframePointerStates.forEach((value, iframe) => {
                iframe.style.pointerEvents = value;
            });
        };
    }, [active, allowedRefs, containerRef, guard, reason, resolvedSelectors]);

    if (!active) return null;

    return (
        <div
            className={className}
            data-component="interaction-gate"
            aria-hidden="true"
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex,
            }}
        />
    );
};

export default InteractionGate;
