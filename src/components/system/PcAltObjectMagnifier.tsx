import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UI_Z_INDEX } from '../../core';

const DEFAULT_ZOOM = 2.6;
const MIN_ZOOM = 1.2;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.2;
const VIEWPORT_FIT_RATIO = 0.86;

type PreviewState = {
    target: HTMLElement;
    html: string;
    baseWidth: number;
    baseHeight: number;
    targetRect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
    pointerX: number;
    pointerY: number;
    zoom: number;
    maxZoom: number;
};

const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
};

const isInspectButton = (element: HTMLElement) => (
    element.hasAttribute('data-card-inspect-variant')
        || element.getAttribute('data-testid')?.includes('inspect-button') === true
);

const GENERIC_OBJECT_ATTRIBUTE_PATTERN = /^data-(?:(?:card|object|token|die|unit|piece|tile|monster|character|faction|mage|minion|item|base|structure|ability)(?:-|$)|source-(?:card|spell-card)(?:-|$)|game-object(?:-|$))/;
const OBJECT_CLASS_PATTERN = /(?:^|[-_\s])(card|token|die|dice|unit|piece|tile|character-card|faction-card|monster-card|spellbook-card|hand-card|field-card|object|item|structure|ability-slot|game-object)(?:$|[-_\s])/i;
const INFRASTRUCTURE_CLASS_PATTERN = /(?:^|[-_\s])(overlay|modal|backdrop|tooltip|popover|dialog|panel|hud|menu|toolbar|header|footer|shell|viewport|wrapper|container|button|icon|label|title|selection|grid|detail|scroll|content|list|summary|screen|area|zone|surface|board|page|root)(?:$|[-_\s])/i;

const getClassAndTestId = (element: HTMLElement) => {
    const className = typeof element.className === 'string'
        ? element.className
        : element.getAttribute('class') ?? '';
    return `${className} ${element.getAttribute('data-testid') ?? ''}`;
};

const hasGenericObjectIdentity = (element: HTMLElement) => Array.from(element.attributes).some(({ name, value }) => (
    GENERIC_OBJECT_ATTRIBUTE_PATTERN.test(name)
        && value.trim().length > 0
        && value !== 'false'
        && value !== 'undefined'
));

const isMagnifierIgnored = (element: HTMLElement) => (
    element.getAttribute('data-pc-alt-inspect-disabled') === 'true'
        || element.closest('[data-pc-alt-inspect-disabled="true"], [data-board-magnify-ignore="true"]') !== null
);

const isReasonableObjectRect = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    if (typeof window === 'undefined') return true;
    const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
    const elementArea = rect.width * rect.height;
    return elementArea < viewportArea * 0.7
        && rect.width < window.innerWidth * 0.95
        && rect.height < window.innerHeight * 0.95;
};

const isGenericObjectCandidate = (element: HTMLElement) => {
    if (isInspectButton(element) || isMagnifierIgnored(element) || !isReasonableObjectRect(element)) return false;
    if (hasGenericObjectIdentity(element)) return true;
    const classAndTestId = getClassAndTestId(element);
    return OBJECT_CLASS_PATTERN.test(classAndTestId) && !INFRASTRUCTURE_CLASS_PATTERN.test(classAndTestId);
};

const resolveInspectableElement = (element: Element | null): HTMLElement | null => {
    const candidates: HTMLElement[] = [];
    let current = element instanceof HTMLElement ? element : null;
    while (current && current !== document.body) {
        if (!isMagnifierIgnored(current)) {
            candidates.push(current);
        }
        current = current.parentElement;
    }

    const explicitCandidate = candidates.find((candidate) => (
        candidate.getAttribute('data-secondary-inspect') === 'true' && !isInspectButton(candidate)
    ))
        ?? candidates.find((candidate) => (
            candidate.getAttribute('data-browse-inspectable') === 'true' && !isInspectButton(candidate)
        ));
    if (explicitCandidate) return explicitCandidate;

    const genericCandidates = candidates.filter(isGenericObjectCandidate);
    if (genericCandidates.length === 0) return null;

    return genericCandidates.reduce((best, candidate) => {
        const bestRect = best.getBoundingClientRect();
        const candidateRect = candidate.getBoundingClientRect();
        return candidateRect.width * candidateRect.height > bestRect.width * bestRect.height
            ? candidate
            : best;
    });
};

const buildPreviewMarkup = (target: HTMLElement) => {
    const clone = target.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-card-inspect-variant], [data-testid*="inspect-button"]').forEach((element) => {
        element.remove();
    });
    clone.removeAttribute('id');
    clone.removeAttribute('data-testid');
    clone.dataset.pcAltPreviewClone = 'true';
    clone.style.width = '100%';
    clone.style.height = '100%';
    clone.style.maxWidth = 'none';
    clone.style.maxHeight = 'none';
    clone.style.margin = '0';
    clone.style.pointerEvents = 'none';
    return clone.outerHTML;
};

const resolveMaxZoom = (width: number, height: number) => {
    if (typeof window === 'undefined' || width <= 0 || height <= 0) return MAX_ZOOM;
    return Math.max(
        MIN_ZOOM,
        Math.min(
            MAX_ZOOM,
            (window.innerWidth * VIEWPORT_FIT_RATIO) / width,
            (window.innerHeight * VIEWPORT_FIT_RATIO) / height,
        ),
    );
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function PcAltObjectMagnifier({ enabled = true }: { enabled?: boolean }) {
    const [preview, setPreview] = useState<PreviewState | null>(null);
    const previewRef = useRef<PreviewState | null>(null);
    const lastPointerRef = useRef({ x: 0, y: 0 });
    const altHeldRef = useRef(false);

    useEffect(() => {
        if (!enabled) {
            previewRef.current = null;
            altHeldRef.current = false;
            return undefined;
        }

        const setPreviewState = (nextPreview: PreviewState | null) => {
            previewRef.current = nextPreview;
            setPreview(nextPreview);
        };

        const updateFromPoint = (clientX: number, clientY: number) => {
            lastPointerRef.current = { x: clientX, y: clientY };
            const element = document.elementFromPoint?.(clientX, clientY) ?? null;
            const target = resolveInspectableElement(element);
            if (!target) {
                setPreviewState(null);
                return;
            }

            const rect = target.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) {
                setPreviewState(null);
                return;
            }

            const current = previewRef.current;
            if (current?.target === target) {
                setPreviewState({
                    ...current,
                    targetRect: {
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                    },
                    pointerX: clientX,
                    pointerY: clientY,
                });
                return;
            }

            const maxZoom = resolveMaxZoom(rect.width, rect.height);
            setPreviewState({
                target,
                html: buildPreviewMarkup(target),
                baseWidth: rect.width,
                baseHeight: rect.height,
                targetRect: {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                },
                pointerX: clientX,
                pointerY: clientY,
                zoom: Math.min(DEFAULT_ZOOM, maxZoom),
                maxZoom,
            });
        };

        const handleMouseMove = (event: MouseEvent) => {
            lastPointerRef.current = { x: event.clientX, y: event.clientY };
            if (!altHeldRef.current && !event.altKey) return;
            altHeldRef.current = true;
            updateFromPoint(event.clientX, event.clientY);
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                altHeldRef.current = false;
                setPreviewState(null);
                return;
            }
            if (event.key !== 'Alt' || isEditableTarget(event.target)) return;
            altHeldRef.current = true;
            updateFromPoint(lastPointerRef.current.x, lastPointerRef.current.y);
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.key !== 'Alt') return;
            altHeldRef.current = false;
            setPreviewState(null);
        };

        const handleBlur = () => {
            altHeldRef.current = false;
            setPreviewState(null);
        };

        const handleWheel = (event: WheelEvent) => {
            const current = previewRef.current;
            if (!current || (!altHeldRef.current && !event.altKey) || isEditableTarget(event.target)) return;

            event.preventDefault();
            event.stopPropagation();
            const nextZoom = clamp(
                current.zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP),
                MIN_ZOOM,
                current.maxZoom,
            );
            if (Math.abs(nextZoom - current.zoom) < 0.001) return;
            setPreviewState({ ...current, zoom: nextZoom });
        };

        window.addEventListener('mousemove', handleMouseMove, true);
        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('keyup', handleKeyUp, true);
        window.addEventListener('blur', handleBlur);
        window.addEventListener('wheel', handleWheel, { capture: true, passive: false });

        return () => {
            window.removeEventListener('mousemove', handleMouseMove, true);
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('keyup', handleKeyUp, true);
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('wheel', handleWheel, true);
        };
    }, [enabled]);

    if (!enabled || !preview || typeof document === 'undefined') return null;

    const displayWidth = preview.baseWidth * preview.zoom;
    const displayHeight = preview.baseHeight * preview.zoom;
    const padding = 20;
    const gap = 24;
    const targetRight = preview.targetRect.left + preview.targetRect.width;
    const targetBottom = preview.targetRect.top + preview.targetRect.height;
    const preferredLeft = targetRight + gap + displayWidth <= window.innerWidth - padding
        ? targetRight + gap
        : preview.targetRect.left - gap - displayWidth >= padding
            ? preview.targetRect.left - gap - displayWidth
            : preview.pointerX - displayWidth / 2;
    const preferredTop = targetBottom + gap + displayHeight <= window.innerHeight - padding
        ? targetBottom + gap
        : preview.targetRect.top - gap - displayHeight >= padding
            ? preview.targetRect.top - gap - displayHeight
            : preview.pointerY - displayHeight / 2;
    const left = clamp(
        preferredLeft,
        padding,
        Math.max(padding, window.innerWidth - displayWidth - padding),
    );
    const top = clamp(
        preferredTop,
        padding,
        Math.max(padding, window.innerHeight - displayHeight - padding),
    );

    return createPortal(
        <div
            data-testid="pc-alt-object-magnifier"
            aria-hidden="true"
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: UI_Z_INDEX.magnify + 20,
                pointerEvents: 'none',
                background: 'rgba(0, 0, 0, 0.12)',
            }}
        >
            <div
                data-pc-alt-zoom={preview.zoom.toFixed(2)}
                style={{
                    position: 'fixed',
                    left,
                    top,
                    width: displayWidth,
                    height: displayHeight,
                    overflow: 'hidden',
                    padding: 8,
                    border: '3px solid rgba(251, 191, 36, 0.95)',
                    borderRadius: 16,
                    background: 'rgba(10, 12, 16, 0.97)',
                    boxShadow: '0 20px 64px rgba(0, 0, 0, 0.62), 0 0 0 1px rgba(255, 255, 255, 0.2)',
                }}
            >
                <div
                    style={{
                        position: 'relative',
                        width: preview.baseWidth,
                        height: preview.baseHeight,
                    transform: `scale(${preview.zoom})`,
                        transformOrigin: 'top left',
                    }}
                    dangerouslySetInnerHTML={{ __html: preview.html }}
                />
            </div>
        </div>,
        document.body,
    );
}
