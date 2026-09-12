import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type Dispatch,
    type SetStateAction,
} from 'react';
import type { PlayerId } from '../../../engine/types';
import { MAGE_WARS_MAX_PREPARED_SPELLS, type MageWarsPhase } from '../domain';

const MAGE_WARS_PLANNING_DRAFT_STORAGE_PREFIX = 'mage-wars:planning-draft:v1';

interface PlanningDraftSelection {
    storageKey: string;
    cardIds: number[];
}

export interface MageWarsPlanningDraftContext {
    phase: MageWarsPhase;
    viewingPlayerId: PlayerId;
    currentPlayerId: PlayerId;
    phaseActorId: PlayerId;
    turnNumber: number;
}

export interface MageWarsPlanningDraftState {
    selectedCardIds: number[];
    setSelectedCardIds: Dispatch<SetStateAction<number[]>>;
    clearSelectedCardIds: () => void;
    storageKey: string | null;
}

function sanitizePlanningDraftCardIds(cardIds: readonly number[]): number[] {
    return cardIds
        .filter((value): value is number => Number.isInteger(value) && value > 0)
        .slice(0, MAGE_WARS_MAX_PREPARED_SPELLS);
}

function readMageWarsPlanningDraftStorage(key: string): number[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        const candidate = Array.isArray(parsed)
            ? parsed
            : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { cardIds?: unknown }).cardIds)
                ? (parsed as { cardIds: unknown[] }).cardIds
                : [];
        return sanitizePlanningDraftCardIds(candidate);
    } catch {
        return [];
    }
}

function writeMageWarsPlanningDraftStorage(key: string, cardIds: readonly number[]): void {
    if (typeof window === 'undefined') return;
    try {
        const sanitized = sanitizePlanningDraftCardIds(cardIds);
        if (sanitized.length === 0) {
            window.localStorage.removeItem(key);
            return;
        }
        window.localStorage.setItem(key, JSON.stringify({ cardIds: sanitized }));
    } catch {
        // localStorage can be unavailable in private or restricted browser contexts.
    }
}

function getMageWarsPlanningDraftRoutePrefix(): string | null {
    if (typeof window === 'undefined') return null;
    return `${MAGE_WARS_PLANNING_DRAFT_STORAGE_PREFIX}:${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}:`;
}

function clearMageWarsPlanningDraftStorageForCurrentRoute(): void {
    if (typeof window === 'undefined') return;
    const prefix = getMageWarsPlanningDraftRoutePrefix();
    if (!prefix) return;
    try {
        for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
            const key = window.localStorage.key(index);
            if (key?.startsWith(prefix)) {
                window.localStorage.removeItem(key);
            }
        }
    } catch {
        // Ignore localStorage read failures; the live draft state still remains authoritative.
    }
}

function buildMageWarsPlanningDraftStorageKey(args: MageWarsPlanningDraftContext): string | null {
    if (args.phase !== 'planning') return null;
    const prefix = getMageWarsPlanningDraftRoutePrefix();
    if (!prefix) return null;
    return [
        prefix,
        `viewer=${encodeURIComponent(args.viewingPlayerId)}`,
        `current=${encodeURIComponent(args.currentPlayerId)}`,
        `actor=${encodeURIComponent(args.phaseActorId)}`,
        `turn=${args.turnNumber}`,
    ].join(':');
}

export function useMageWarsPlanningDraft(args: MageWarsPlanningDraftContext): MageWarsPlanningDraftState {
    const storageKey = useMemo(() => buildMageWarsPlanningDraftStorageKey(args), [
        args.currentPlayerId,
        args.phase,
        args.phaseActorId,
        args.turnNumber,
        args.viewingPlayerId,
    ]);
    const [selection, setSelection] = useState<PlanningDraftSelection | null>(null);
    const selectedCardIds = selection?.storageKey === storageKey ? selection.cardIds : [];

    useEffect(() => {
        if (!storageKey) {
            setSelection(null);
            clearMageWarsPlanningDraftStorageForCurrentRoute();
            return;
        }
        setSelection({
            storageKey,
            cardIds: readMageWarsPlanningDraftStorage(storageKey),
        });
    }, [storageKey]);

    useEffect(() => {
        if (!storageKey || selection?.storageKey !== storageKey) return;
        writeMageWarsPlanningDraftStorage(storageKey, selection.cardIds);
    }, [selection, storageKey]);

    const setSelectedCardIds = useCallback<Dispatch<SetStateAction<number[]>>>((nextValue) => {
        setSelection((current) => {
            if (!storageKey) return current;
            const currentCardIds = current?.storageKey === storageKey ? current.cardIds : [];
            const nextCardIds = typeof nextValue === 'function'
                ? nextValue(currentCardIds)
                : nextValue;
            return {
                storageKey,
                cardIds: sanitizePlanningDraftCardIds(nextCardIds),
            };
        });
    }, [storageKey]);

    const clearSelectedCardIds = useCallback(() => {
        if (!storageKey) {
            setSelection(null);
            return;
        }
        writeMageWarsPlanningDraftStorage(storageKey, []);
        setSelection({ storageKey, cardIds: [] });
    }, [storageKey]);

    return {
        selectedCardIds,
        setSelectedCardIds,
        clearSelectedCardIds,
        storageKey,
    };
}
