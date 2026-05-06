import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { ModalEntry } from '../../contexts/ModalStackContext';
import { useModalStack } from '../../contexts/ModalStackContext';

interface UseSyncedModalStackEntryOptions {
    enabled: boolean;
    entryId: string;
    entry: Omit<ModalEntry, 'id'>;
}

type ModalEntryStore = {
    getSnapshot: () => Omit<ModalEntry, 'id'>;
    setSnapshot: (entry: Omit<ModalEntry, 'id'>) => void;
    subscribe: (listener: () => void) => () => void;
};

const createModalEntryStore = (initialEntry: Omit<ModalEntry, 'id'>): ModalEntryStore => {
    let snapshot = initialEntry;
    const listeners = new Set<() => void>();

    return {
        getSnapshot: () => snapshot,
        setSnapshot: (entry) => {
            snapshot = entry;
            listeners.forEach((listener) => listener());
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
};

const SyncedModalEntryBridge = ({
    entryStore,
    api,
}: {
    entryStore: ModalEntryStore;
    api: { close: () => void; closeOnBackdrop: boolean };
}) => {
    const currentEntry = useSyncExternalStore(
        entryStore.subscribe,
        entryStore.getSnapshot,
        entryStore.getSnapshot,
    );

    return <>{currentEntry.render(api)}</>;
};

/**
 * 将声明式本地状态同步到全局 modal stack。
 * 适用于“组件内部已有开关状态，但实际渲染必须走全局弹窗栈”的场景。
 */
export function useSyncedModalStackEntry({
    enabled,
    entryId,
    entry,
}: UseSyncedModalStackEntryOptions) {
    const { stack, openModal, updateModal, closeModal } = useModalStack();
    const isInStack = stack.some((item) => item.id === entryId);
    const entryStoreRef = useRef<ModalEntryStore | null>(null);
    if (!entryStoreRef.current) {
        entryStoreRef.current = createModalEntryStore(entry);
    }

    const owner = entry.owner;
    const stableEntry = useMemo<Omit<ModalEntry, 'id'>>(() => ({
        owner: owner ? { ...owner } : undefined,
        closeOnEsc: entry.closeOnEsc,
        closeOnBackdrop: entry.closeOnBackdrop,
        lockScroll: entry.lockScroll,
        zIndex: entry.zIndex,
        allowPointerThrough: entry.allowPointerThrough,
        onClose: () => entryStoreRef.current?.getSnapshot().onClose?.(),
        render: (api) => (
            <SyncedModalEntryBridge
                entryStore={entryStoreRef.current!}
                api={api}
            />
        ),
    }), [
        entry.allowPointerThrough,
        entry.closeOnBackdrop,
        entry.closeOnEsc,
        entry.lockScroll,
        entry.zIndex,
        owner?.blocksProgress,
        owner?.gameId,
        owner?.id,
        owner?.kind,
        owner?.namespace,
        owner?.resolutionFrameId,
        owner?.system,
    ]);
    const lastSyncedEntryRef = useRef<Omit<ModalEntry, 'id'> | null>(null);

    useEffect(() => {
        if (!enabled) {
            return;
        }
        entryStoreRef.current?.setSnapshot(entry);
    }, [enabled, entry]);

    useEffect(() => {
        if (!enabled) {
            lastSyncedEntryRef.current = null;
            if (isInStack) {
                closeModal(entryId);
            }
            return;
        }

        if (!isInStack) {
            openModal({ ...stableEntry, id: entryId });
            lastSyncedEntryRef.current = stableEntry;
            return;
        }

        if (lastSyncedEntryRef.current === stableEntry) {
            return;
        }

        updateModal(entryId, stableEntry);
        lastSyncedEntryRef.current = stableEntry;
    }, [closeModal, enabled, entryId, isInStack, openModal, stableEntry, updateModal]);

    useEffect(() => {
        return () => {
            closeModal(entryId);
        };
    }, [closeModal, entryId]);
}
