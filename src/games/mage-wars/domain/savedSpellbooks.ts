import { MAGE_IDS, type MageId } from './ids';
import type { MageWarsPlayerSpellbookEntry } from './spellbook';
import { getMageWarsSpellbookCopyLimitForCard } from './spellbookBuilder';

export const MAGE_WARS_SAVED_SPELLBOOKS_STORAGE_KEY = 'mage-wars:saved-spellbooks:v1';
export const MAGE_WARS_SAVED_SPELLBOOK_LIMIT = 10;

export interface MageWarsSavedSpellbook {
    id: string;
    mageId: MageId;
    name: string;
    entries: MageWarsPlayerSpellbookEntry[];
    createdAt: string;
    updatedAt: string;
}

interface SaveMageWarsSpellbookDraftInput {
    mageId: MageId;
    name: string;
    entries: readonly MageWarsPlayerSpellbookEntry[];
    storage?: Storage;
}

interface UpdateMageWarsSpellbookDraftInput extends SaveMageWarsSpellbookDraftInput {
    id: string;
}

function isMageId(value: unknown): value is MageId {
    return typeof value === 'string'
        && (Object.values(MAGE_IDS) as readonly string[]).includes(value);
}

function resolveStorage(storage?: Storage): Storage | undefined {
    if (storage) return storage;
    if (typeof window === 'undefined') return undefined;
    return window.localStorage;
}

function createSavedSpellbookId(): string {
    return globalThis.crypto?.randomUUID?.()
        ?? `mw-spellbook-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readStorage(storage?: Storage): string | null {
    try {
        return resolveStorage(storage)?.getItem(MAGE_WARS_SAVED_SPELLBOOKS_STORAGE_KEY) ?? null;
    } catch {
        return null;
    }
}

function writeStorage(spellbooks: readonly MageWarsSavedSpellbook[], storage?: Storage): void {
    const target = resolveStorage(storage);
    if (!target) return;
    try {
        target.setItem(MAGE_WARS_SAVED_SPELLBOOKS_STORAGE_KEY, JSON.stringify(spellbooks));
    } catch {
        // localStorage can be disabled or full; callers still keep the current draft in setup state.
    }
}

export function normalizeMageWarsSavedSpellbookEntries(
    entries: readonly MageWarsPlayerSpellbookEntry[],
): MageWarsPlayerSpellbookEntry[] {
    const counts = new Map<number, number>();
    for (const entry of entries) {
        const spellCardId = Number(entry.spellCardId);
        const count = Number(entry.count);
        if (!Number.isInteger(spellCardId) || !Number.isInteger(count) || count <= 0) continue;
        const limit = getMageWarsSpellbookCopyLimitForCard(spellCardId);
        if (limit <= 0) continue;
        counts.set(spellCardId, Math.min(limit, (counts.get(spellCardId) ?? 0) + count));
    }

    return [...counts.entries()]
        .sort(([left], [right]) => left - right)
        .map(([spellCardId, count]) => ({ spellCardId, count }));
}

export function normalizeMageWarsSavedSpellbooks(raw: unknown): MageWarsSavedSpellbook[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((entry): MageWarsSavedSpellbook | null => {
            if (!entry || typeof entry !== 'object') return null;
            const data = entry as Partial<MageWarsSavedSpellbook>;
            const id = typeof data.id === 'string' && data.id.trim() ? data.id.trim() : undefined;
            const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : undefined;
            if (!id || !name || !isMageId(data.mageId)) return null;
            const entries = normalizeMageWarsSavedSpellbookEntries(Array.isArray(data.entries) ? data.entries : []);
            if (entries.length === 0) return null;
            const createdAt = typeof data.createdAt === 'string' && data.createdAt.trim()
                ? data.createdAt
                : new Date(0).toISOString();
            const updatedAt = typeof data.updatedAt === 'string' && data.updatedAt.trim()
                ? data.updatedAt
                : createdAt;
            return {
                id,
                mageId: data.mageId,
                name,
                entries,
                createdAt,
                updatedAt,
            };
        })
        .filter((entry): entry is MageWarsSavedSpellbook => entry !== null)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function loadMageWarsSavedSpellbooks(storage?: Storage): MageWarsSavedSpellbook[] {
    const raw = readStorage(storage);
    if (!raw) return [];
    try {
        return normalizeMageWarsSavedSpellbooks(JSON.parse(raw));
    } catch {
        return [];
    }
}

export function listMageWarsSavedSpellbooksForMage(
    mageId: MageId,
    storage?: Storage,
): MageWarsSavedSpellbook[] {
    return loadMageWarsSavedSpellbooks(storage)
        .filter((spellbook) => spellbook.mageId === mageId);
}

export function getMageWarsSavedSpellbookById(
    id: string,
    storage?: Storage,
): MageWarsSavedSpellbook | undefined {
    return loadMageWarsSavedSpellbooks(storage)
        .find((spellbook) => spellbook.id === id);
}

export function saveMageWarsSpellbookDraft({
    mageId,
    name,
    entries,
    storage,
}: SaveMageWarsSpellbookDraftInput): MageWarsSavedSpellbook {
    const normalizedName = name.trim();
    if (!normalizedName) {
        throw new Error('请输入法术书名称');
    }
    const normalizedEntries = normalizeMageWarsSavedSpellbookEntries(entries);
    if (normalizedEntries.length === 0) {
        throw new Error('至少加入一张法术牌后再保存');
    }

    const spellbooks = loadMageWarsSavedSpellbooks(storage);
    if (spellbooks.length >= MAGE_WARS_SAVED_SPELLBOOK_LIMIT) {
        throw new Error(`最多保存 ${MAGE_WARS_SAVED_SPELLBOOK_LIMIT} 本法术书`);
    }

    const now = new Date().toISOString();
    const saved: MageWarsSavedSpellbook = {
        id: createSavedSpellbookId(),
        mageId,
        name: normalizedName,
        entries: normalizedEntries,
        createdAt: now,
        updatedAt: now,
    };
    writeStorage([saved, ...spellbooks], storage);
    return saved;
}

export function updateMageWarsSavedSpellbookDraft({
    id,
    mageId,
    name,
    entries,
    storage,
}: UpdateMageWarsSpellbookDraftInput): MageWarsSavedSpellbook {
    const normalizedName = name.trim();
    if (!normalizedName) {
        throw new Error('请输入法术书名称');
    }
    const normalizedEntries = normalizeMageWarsSavedSpellbookEntries(entries);
    if (normalizedEntries.length === 0) {
        throw new Error('至少加入一张法术牌后再保存');
    }

    const spellbooks = loadMageWarsSavedSpellbooks(storage);
    const existing = spellbooks.find((spellbook) => spellbook.id === id);
    if (!existing) {
        throw new Error('找不到已保存法术书');
    }
    if (existing.mageId !== mageId) {
        throw new Error('这本法术书不属于当前法师');
    }

    const updated: MageWarsSavedSpellbook = {
        ...existing,
        name: normalizedName,
        entries: normalizedEntries,
        updatedAt: new Date().toISOString(),
    };
    writeStorage([updated, ...spellbooks.filter((spellbook) => spellbook.id !== id)], storage);
    return updated;
}

export function deleteMageWarsSavedSpellbook(id: string, storage?: Storage): void {
    const next = loadMageWarsSavedSpellbooks(storage).filter((spellbook) => spellbook.id !== id);
    writeStorage(next, storage);
}
