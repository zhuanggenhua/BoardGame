import { useCallback, useRef } from 'react';

import type {
  FxAnchorRef,
  FxAnchorRegistration,
  FxAnchorSnapshot,
  FxSurfaceId,
  FxSurfaceKind,
} from './types';

export interface FxAnchorRegistry {
  surfaceId: FxSurfaceId;
  surfaceKind: FxSurfaceKind;
  registerSurface: (element: HTMLElement | null) => void;
  registerAnchor: (anchor: Omit<FxAnchorRegistration, 'surfaceId'>) => (element: HTMLElement | null) => void;
  resolveSnapshot: (anchor: FxAnchorRef | string | undefined | null) => FxAnchorSnapshot | null;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function resolveAnchorKey(anchor: Pick<FxAnchorRef, 'surfaceId' | 'anchorId'>): string {
  return `${anchor.surfaceId}:${anchor.anchorId}`;
}

function captureSnapshot(
  surfaceElement: HTMLElement | null,
  element: HTMLElement | null,
  anchor: FxAnchorRegistration,
): FxAnchorSnapshot | null {
  if (!surfaceElement || !element) return null;

  const surfaceRect = surfaceElement.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  if (surfaceRect.width <= 0 || surfaceRect.height <= 0 || rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const box = {
    left: ((rect.left - surfaceRect.left) / surfaceRect.width) * 100,
    top: ((rect.top - surfaceRect.top) / surfaceRect.height) * 100,
    width: (rect.width / surfaceRect.width) * 100,
    height: (rect.height / surfaceRect.height) * 100,
  };

  return {
    surfaceId: anchor.surfaceId,
    anchorId: anchor.anchorId,
    anchorKind: anchor.anchorKind,
    entityRef: anchor.entityRef,
    box,
    center: {
      xPct: box.left + box.width / 2,
      yPct: box.top + box.height / 2,
    },
    size: {
      widthPct: box.width,
      heightPct: box.height,
    },
    capturedAt: nowMs(),
    mode: 'spawn-snapshot',
  };
}

export function useFxAnchorRegistry(surfaceId: FxSurfaceId, surfaceKind: FxSurfaceKind): FxAnchorRegistry {
  const surfaceRef = useRef<HTMLElement | null>(null);
  const elementsRef = useRef(new Map<string, HTMLElement>());
  const registrationsRef = useRef(new Map<string, FxAnchorRegistration>());
  const snapshotsRef = useRef(new Map<string, FxAnchorSnapshot>());

  const recaptureAnchor = useCallback((key: string): FxAnchorSnapshot | null => {
    const anchor = registrationsRef.current.get(key);
    const element = elementsRef.current.get(key) ?? null;
    if (!anchor) return null;
    const snapshot = captureSnapshot(surfaceRef.current, element, anchor);
    if (snapshot) snapshotsRef.current.set(key, snapshot);
    return snapshot;
  }, []);

  const registerSurface = useCallback((element: HTMLElement | null) => {
    surfaceRef.current = element;
    if (!element) return;
    for (const key of registrationsRef.current.keys()) {
      recaptureAnchor(key);
    }
  }, [recaptureAnchor]);

  const registerAnchor = useCallback((anchorInput: Omit<FxAnchorRegistration, 'surfaceId'>) => (
    element: HTMLElement | null,
  ) => {
    const anchor: FxAnchorRegistration = { ...anchorInput, surfaceId };
    const key = resolveAnchorKey(anchor);
    registrationsRef.current.set(key, anchor);
    if (element) {
      elementsRef.current.set(key, element);
      recaptureAnchor(key);
    } else {
      elementsRef.current.delete(key);
      // 保留最后一次快照，供同批结算中已离场对象的 one-shot FX 使用。
    }
  }, [recaptureAnchor, surfaceId]);

  const resolveSnapshot = useCallback((anchor: FxAnchorRef | string | undefined | null): FxAnchorSnapshot | null => {
    if (!anchor) return null;
    const ref = typeof anchor === 'string'
      ? { surfaceId, anchorId: anchor }
      : anchor;
    const key = resolveAnchorKey(ref);
    return recaptureAnchor(key) ?? snapshotsRef.current.get(key) ?? null;
  }, [recaptureAnchor, surfaceId]);

  return {
    surfaceId,
    surfaceKind,
    registerSurface,
    registerAnchor,
    resolveSnapshot,
  };
}

export function fxAnchorRef(
  surfaceId: FxSurfaceId,
  anchorId: string | undefined | null,
  anchorKind?: FxAnchorRef['anchorKind'],
): FxAnchorRef | null {
  return anchorId ? { surfaceId, anchorId, anchorKind } : null;
}
