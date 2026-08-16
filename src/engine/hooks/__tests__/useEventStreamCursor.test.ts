import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EventStreamEntry } from '../../types';
import { EventStreamRollbackContext, type EventStreamRollbackValue } from '../EventStreamRollbackContext';
import { useEventStreamCursor } from '../useEventStreamCursor';

function createEntry(id: number, type: string): EventStreamEntry {
    return {
        id,
        event: {
            type,
            payload: {},
            timestamp: id * 1000,
        },
    } as EventStreamEntry;
}

describe('useEventStreamCursor', () => {
    it('默认首次调用跳过已有事件并从后续新事件开始消费', () => {
        const rollbackValue: EventStreamRollbackValue = {
            watermark: null,
            seq: 0,
            reconcileSeq: 0,
        };

        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                EventStreamRollbackContext.Provider,
                { value: rollbackValue },
                children,
            );

        const initialEntries = [
            createEntry(1, 'OLD_A'),
            createEntry(2, 'OLD_B'),
        ];
        const { result, rerender } = renderHook(
            ({ entries }: { entries: EventStreamEntry[] }) =>
                useEventStreamCursor({ entries }),
            {
                initialProps: { entries: initialEntries },
                wrapper,
            },
        );

        act(() => {
            expect(result.current.consumeNew().entries).toEqual([]);
        });
        expect(result.current.getCursor()).toBe(2);

        rerender({
            entries: [
                ...initialEntries,
                createEntry(3, 'NEW_C'),
            ],
        });

        let consumedTypes: string[] = [];
        act(() => {
            consumedTypes = result.current.consumeNew().entries.map((entry) => entry.event.type);
        });

        expect(consumedTypes).toEqual(['NEW_C']);
    });

    it('consumeInitialEntries=true 时首次调用消费已有事件并推进游标', () => {
        const rollbackValue: EventStreamRollbackValue = {
            watermark: null,
            seq: 0,
            reconcileSeq: 0,
        };

        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                EventStreamRollbackContext.Provider,
                { value: rollbackValue },
                children,
            );

        const initialEntries = [
            createEntry(1, 'SUMMON_A'),
            createEntry(2, 'ATTACK_B'),
        ];
        const { result, rerender } = renderHook(
            ({ entries }: { entries: EventStreamEntry[] }) =>
                useEventStreamCursor({ entries, consumeInitialEntries: true }),
            {
                initialProps: { entries: initialEntries },
                wrapper,
            },
        );

        let firstConsumedTypes: string[] = [];
        act(() => {
            firstConsumedTypes = result.current.consumeNew().entries.map((entry) => entry.event.type);
        });

        expect(firstConsumedTypes).toEqual(['SUMMON_A', 'ATTACK_B']);
        expect(result.current.getCursor()).toBe(2);

        rerender({
            entries: [
                ...initialEntries,
                createEntry(3, 'NEW_C'),
            ],
        });

        let nextConsumedTypes: string[] = [];
        act(() => {
            nextConsumedTypes = result.current.consumeNew().entries.map((entry) => entry.event.type);
        });

        expect(nextConsumedTypes).toEqual(['NEW_C']);
    });

    it('consumeOnReconcile=true 时会在 reconcile 后继续消费确认事件', () => {
        let rollbackValue: EventStreamRollbackValue = {
            watermark: null,
            seq: 0,
            reconcileSeq: 0,
        };

        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                EventStreamRollbackContext.Provider,
                { value: rollbackValue },
                children,
            );

        const initialEntries = [createEntry(1, 'OLD_EVENT')];
        const { result, rerender } = renderHook(
            ({ entries, consumeOnReconcile }: { entries: EventStreamEntry[]; consumeOnReconcile?: boolean }) =>
                useEventStreamCursor({ entries, consumeOnReconcile }),
            {
                initialProps: {
                    entries: initialEntries,
                    consumeOnReconcile: true,
                },
                wrapper,
            },
        );

        act(() => {
            result.current.consumeNew();
        });

        rollbackValue = {
            watermark: null,
            seq: 0,
            reconcileSeq: 1,
        };

        rerender({
            entries: [
                ...initialEntries,
                createEntry(2, 'CARD_PLAYED'),
                createEntry(3, 'BONUS_DIE_ROLLED'),
            ],
            consumeOnReconcile: true,
        });

        let consumedTypes: string[] = [];
        act(() => {
            consumedTypes = result.current.consumeNew().entries.map((entry) => entry.event.type);
        });

        expect(consumedTypes).toEqual(['CARD_PLAYED', 'BONUS_DIE_ROLLED']);
    });

    it('consumeOnReconcile=false 时保持 reconcile 静默同步游标', () => {
        let rollbackValue: EventStreamRollbackValue = {
            watermark: null,
            seq: 0,
            reconcileSeq: 0,
        };

        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                EventStreamRollbackContext.Provider,
                { value: rollbackValue },
                children,
            );

        const initialEntries = [createEntry(1, 'OLD_EVENT')];
        const { result, rerender } = renderHook(
            ({ entries }: { entries: EventStreamEntry[] }) =>
                useEventStreamCursor({ entries }),
            {
                initialProps: { entries: initialEntries },
                wrapper,
            },
        );

        act(() => {
            result.current.consumeNew();
        });

        rollbackValue = {
            watermark: null,
            seq: 0,
            reconcileSeq: 1,
        };

        rerender({
            entries: [
                ...initialEntries,
                createEntry(2, 'CARD_PLAYED'),
                createEntry(3, 'BONUS_DIE_ROLLED'),
            ],
        });

        let consumedCount = -1;
        act(() => {
            consumedCount = result.current.consumeNew().entries.length;
        });

        expect(consumedCount).toBe(0);
    });

    it('consumeOnReconcile=true 时空 reconcile 不会把历史事件重新当成新事件消费', () => {
        let rollbackValue: EventStreamRollbackValue = {
            watermark: null,
            seq: 0,
            reconcileSeq: 0,
        };

        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                EventStreamRollbackContext.Provider,
                { value: rollbackValue },
                children,
            );

        const { result, rerender } = renderHook(
            ({ entries }: { entries: EventStreamEntry[] }) =>
                useEventStreamCursor({ entries, consumeOnReconcile: true }),
            {
                initialProps: {
                    entries: [
                        createEntry(1, 'ACTION_PLAYED'),
                        createEntry(2, 'CARDS_DRAWN'),
                    ],
                },
                wrapper,
            },
        );

        act(() => {
            result.current.consumeNew();
        });

        rollbackValue = {
            watermark: null,
            seq: 0,
            reconcileSeq: 1,
        };

        rerender({ entries: [] });

        act(() => {
            expect(result.current.consumeNew().entries).toEqual([]);
        });

        rerender({ entries: [] });

        act(() => {
            expect(result.current.consumeNew().entries).toEqual([]);
        });

        rerender({
            entries: [
                createEntry(1, 'ACTION_PLAYED'),
                createEntry(2, 'CARDS_DRAWN'),
                createEntry(3, 'NEW_EVENT'),
            ],
        });

        let consumedTypes: string[] = [];
        act(() => {
            consumedTypes = result.current.consumeNew().entries.map((entry) => entry.event.type);
        });

        expect(consumedTypes).toEqual(['NEW_EVENT']);
    });

    it('reconnect 后若 entries 先清空再恢复旧 ID，不应把历史事件整包重放', () => {
        const rollbackValue: EventStreamRollbackValue = {
            watermark: null,
            seq: 0,
            reconcileSeq: 0,
        };

        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                EventStreamRollbackContext.Provider,
                { value: rollbackValue },
                children,
            );

        const initialEntries = [
            createEntry(1, 'ACTION_PLAYED'),
            createEntry(2, 'CARDS_DRAWN'),
        ];

        const { result, rerender } = renderHook(
            ({ entries, reconnectToken }: { entries: EventStreamEntry[]; reconnectToken: number }) =>
                useEventStreamCursor({ entries, reconnectToken }),
            {
                initialProps: {
                    entries: initialEntries,
                    reconnectToken: 0,
                },
                wrapper,
            },
        );

        act(() => {
            expect(result.current.consumeNew().entries).toEqual([]);
        });

        rerender({
            entries: [],
            reconnectToken: 1,
        });

        act(() => {
            expect(result.current.consumeNew().entries).toEqual([]);
        });

        rerender({
            entries: initialEntries,
            reconnectToken: 1,
        });

        let consumedTypes: string[] = [];
        act(() => {
            consumedTypes = result.current.consumeNew().entries.map((entry) => entry.event.type);
        });

        expect(consumedTypes).toEqual([]);
    });

    it('rollback 过滤后 entries 暂时为空时，不应把旧事件重新当成新事件消费', () => {
        let rollbackValue: EventStreamRollbackValue = {
            watermark: null,
            seq: 0,
            reconcileSeq: 0,
        };

        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                EventStreamRollbackContext.Provider,
                { value: rollbackValue },
                children,
            );

        const initialEntries = [
            createEntry(1, 'SUMMON_A'),
            createEntry(2, 'SUMMON_B'),
        ];

        const { result, rerender } = renderHook(
            ({ entries }: { entries: EventStreamEntry[] }) =>
                useEventStreamCursor({ entries }),
            {
                initialProps: { entries: initialEntries },
                wrapper,
            },
        );

        act(() => {
            expect(result.current.consumeNew().entries).toEqual([]);
        });

        rollbackValue = {
            watermark: 2,
            seq: 1,
            reconcileSeq: 0,
        };

        rerender({ entries: [] });

        act(() => {
            const consumed = result.current.consumeNew();
            expect(consumed.entries).toEqual([]);
            expect(consumed.didOptimisticRollback).toBe(true);
        });

        rerender({ entries: [] });

        act(() => {
            expect(result.current.consumeNew().entries).toEqual([]);
        });

        rerender({
            entries: [
                createEntry(1, 'SUMMON_A'),
                createEntry(2, 'SUMMON_B'),
                createEntry(3, 'SUMMON_C'),
            ],
        });

        let consumedTypes: string[] = [];
        act(() => {
            consumedTypes = result.current.consumeNew().entries.map((entry) => entry.event.type);
        });

        expect(consumedTypes).toEqual(['SUMMON_C']);
    });

    it('watermark=null 的 rollback signal 后，恢复旧 ID 时不应重播历史事件且应标记 didOptimisticRollback', () => {
        let rollbackValue: EventStreamRollbackValue = {
            watermark: null,
            seq: 0,
            reconcileSeq: 0,
        };

        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                EventStreamRollbackContext.Provider,
                { value: rollbackValue },
                children,
            );

        const initialEntries = [
            createEntry(1, 'OLD_A'),
            createEntry(2, 'OLD_B'),
        ];

        const { result, rerender } = renderHook(
            ({ entries }: { entries: EventStreamEntry[] }) =>
                useEventStreamCursor({ entries }),
            {
                initialProps: { entries: initialEntries },
                wrapper,
            },
        );

        act(() => {
            expect(result.current.consumeNew().entries).toEqual([]);
        });

        rollbackValue = {
            watermark: null,
            seq: 1,
            reconcileSeq: 0,
        };

        rerender({ entries: [] });

        act(() => {
            const consumed = result.current.consumeNew();
            expect(consumed.entries).toEqual([]);
            expect(consumed.didOptimisticRollback).toBe(true);
            expect(consumed.didReset).toBe(false);
        });

        rerender({ entries: initialEntries });

        act(() => {
            expect(result.current.consumeNew().entries).toEqual([]);
        });

        rerender({
            entries: [
                createEntry(1, 'OLD_A'),
                createEntry(2, 'OLD_B'),
                createEntry(3, 'NEW_C'),
            ],
        });

        let consumedTypes: string[] = [];
        act(() => {
            consumedTypes = result.current.consumeNew().entries.map((entry) => entry.event.type);
        });

        expect(consumedTypes).toEqual(['NEW_C']);
    });
});
