import { describe, expect, it } from 'vitest';
import {
    buildStoredSeatValidationClearKey,
    resolveMatchRoomRouteIdentity,
    resolveSeatValidationPlayers,
    resolveStoredSeatValidationClearDecision,
    shouldUseTransportSeatValidationSnapshot,
} from '../MatchRoom';

describe('resolveMatchRoomRouteIdentity', () => {
    it('有 stored seat 且 URL 缺失时，仍保持 seat 身份而不是 spectator', () => {
        const result = resolveMatchRoomRouteIdentity({
            isTutorialRoute: false,
            tutorialPlayerID: '0',
            tutorialStatusPlayerID: '0',
            urlPlayerID: null,
            storedPlayerID: '0',
            shouldAutoJoin: false,
            spectateParam: null,
        });

        expect(result.hasStoredSeat).toBe(true);
        expect(result.isSpectatorRoute).toBe(false);
        expect(result.effectivePlayerID).toBe('0');
        expect(result.statusPlayerID).toBe('0');
    });

    it('即使显式带 spectate=1，只要本地仍有 stored seat，也不能退回 spectator', () => {
        const result = resolveMatchRoomRouteIdentity({
            isTutorialRoute: false,
            tutorialPlayerID: '0',
            tutorialStatusPlayerID: '0',
            urlPlayerID: null,
            storedPlayerID: '1',
            shouldAutoJoin: false,
            spectateParam: '1',
        });

        expect(result.isSpectatorRoute).toBe(false);
        expect(result.effectivePlayerID).toBe('1');
        expect(result.statusPlayerID).toBe('1');
    });

    it('当 URL seat 与本地 stored seat 冲突时，resolver 仍以本地 stored seat 为准', () => {
        const result = resolveMatchRoomRouteIdentity({
            isTutorialRoute: false,
            tutorialPlayerID: '0',
            tutorialStatusPlayerID: '0',
            urlPlayerID: '1',
            storedPlayerID: '0',
            shouldAutoJoin: false,
            spectateParam: null,
        });

        expect(result.hasStoredSeat).toBe(true);
        expect(result.isSpectatorRoute).toBe(false);
        expect(result.effectivePlayerID).toBe('0');
        expect(result.statusPlayerID).toBe('0');
    });

    it('只有无 URL、无 stored seat 且显式允许旁观时，才进入 spectator', () => {
        const result = resolveMatchRoomRouteIdentity({
            isTutorialRoute: false,
            tutorialPlayerID: '0',
            tutorialStatusPlayerID: '0',
            urlPlayerID: null,
            storedPlayerID: null,
            shouldAutoJoin: false,
            spectateParam: 'true',
        });

        expect(result.hasStoredSeat).toBe(false);
        expect(result.isSpectatorRoute).toBe(true);
        expect(result.effectivePlayerID).toBeUndefined();
        expect(result.statusPlayerID).toBeNull();
    });
});

describe('resolveStoredSeatValidationClearDecision', () => {
    it('同一坏快照第一次只挂起 pending key，不立即清 seat', () => {
        const nextKey = buildStoredSeatValidationClearKey({
            matchId: 'match-a',
            statusPlayerID: '0',
            validation: { shouldClear: true, reason: 'missing_seat' },
        });

        const result = resolveStoredSeatValidationClearDecision({
            pendingKey: null,
            nextKey,
        });

        expect(result.shouldClear).toBe(false);
        expect(result.nextPendingKey).toBe(nextKey);
    });

    it('同一坏快照连续第二次才真正允许清 seat', () => {
        const nextKey = buildStoredSeatValidationClearKey({
            matchId: 'match-a',
            statusPlayerID: '0',
            validation: { shouldClear: true, reason: 'missing_seat' },
        });

        const result = resolveStoredSeatValidationClearDecision({
            pendingKey: nextKey,
            nextKey,
        });

        expect(result.shouldClear).toBe(true);
        expect(result.nextPendingKey).toBeNull();
    });

    it('同一次坏快照重放时不应被当成第二次确认', () => {
        const nextKey = buildStoredSeatValidationClearKey({
            matchId: 'match-a',
            statusPlayerID: '0',
            validation: { shouldClear: true, reason: 'missing_seat' },
        });

        const replay = resolveStoredSeatValidationClearDecision({
            pendingKey: nextKey,
            pendingObservationKey: 'snapshot-1',
            nextKey,
            nextObservationKey: 'snapshot-1',
        });
        expect(replay.shouldClear).toBe(false);
        expect(replay.nextPendingKey).toBe(nextKey);
        expect(replay.nextPendingObservationKey).toBe('snapshot-1');

        const nextSnapshot = resolveStoredSeatValidationClearDecision({
            pendingKey: replay.nextPendingKey,
            pendingObservationKey: replay.nextPendingObservationKey,
            nextKey,
            nextObservationKey: 'snapshot-2',
        });
        expect(nextSnapshot.shouldClear).toBe(true);
        expect(nextSnapshot.nextPendingKey).toBeNull();
    });

    it('中间恢复正常快照后，会清掉 pending key 并重新累计', () => {
        const badKey = buildStoredSeatValidationClearKey({
            matchId: 'match-a',
            statusPlayerID: '0',
            validation: { shouldClear: true, reason: 'seat_empty' },
        });

        const recovered = resolveStoredSeatValidationClearDecision({
            pendingKey: badKey,
            nextKey: null,
        });
        expect(recovered.shouldClear).toBe(false);
        expect(recovered.nextPendingKey).toBeNull();

        const next = resolveStoredSeatValidationClearDecision({
            pendingKey: recovered.nextPendingKey,
            nextKey: badKey,
        });
        expect(next.shouldClear).toBe(false);
        expect(next.nextPendingKey).toBe(badKey);
    });
});

describe('resolveSeatValidationPlayers', () => {
    it('transport 已确认 seat 时，应优先使用 transport 快照而不是 fallback 坏快照', () => {
        const result = resolveSeatValidationPlayers({
            fallbackPlayers: [{ id: 1, name: 'Bob', isConnected: true }],
            transportPlayers: [
                { id: 0, name: 'Alice', isConnected: true },
                { id: 1, name: 'Bob', isConnected: true },
            ],
            transportReady: true,
        });

        expect(result).toEqual([
            { id: 0, name: 'Alice', isConnected: true },
            { id: 1, name: 'Bob', isConnected: true },
        ]);
    });

    it('transport 已 ready 且不再包含某个 fallback seat 时，不应把旧 fallback seat 并回结果里', () => {
        const result = resolveSeatValidationPlayers({
            fallbackPlayers: [
                { id: 0, name: 'Alice', isConnected: true },
                { id: 1, name: 'Bob', isConnected: true },
            ],
            transportPlayers: [
                { id: 1, name: 'Bob', isConnected: true },
            ],
            transportReady: true,
        });

        expect(result).toEqual([
            { id: 1, name: 'Bob', isConnected: true },
        ]);
    });
});

describe('shouldUseTransportSeatValidationSnapshot', () => {
    it('transport 刚断线但最近确认过 seat 时，短 grace 内仍应继续信任 transport 快照', () => {
        const result = shouldUseTransportSeatValidationSnapshot({
            transportPlayers: [{ id: 0, name: 'Alice', isConnected: true }],
            transportReady: false,
            lastConfirmedAt: 1000,
            now: 6500,
        });

        expect(result).toBe(true);
    });

    it('transport 长时间未恢复时，超出 grace 后不应继续沿用旧 transport 快照', () => {
        const result = shouldUseTransportSeatValidationSnapshot({
            transportPlayers: [{ id: 0, name: 'Alice', isConnected: true }],
            transportReady: false,
            lastConfirmedAt: 1000,
            now: 12_000,
        });

        expect(result).toBe(false);
    });
});
