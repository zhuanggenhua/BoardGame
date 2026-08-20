import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../types';
import {
    isOnlineAiUnsatisfiableInteractionReason,
    resolveAiEmergencySkipCancelPayload,
    shouldSuppressUnsatisfiableInteractionFeedback,
} from '../onlineAiUnsatisfiableInteraction';
import { buildInteractionSelectabilityDiagnostic } from '../onlineAiWatchdogFeedbackDiagnostics';

const createSeatState = (options: unknown[]): MatchState<unknown> => ({
    core: { activePlayerId: '1' },
    sys: {
        phase: 'main',
        turnNumber: 1,
        eventStream: { nextId: 1, entries: [] },
        interaction: {
            isBlocked: true,
            current: {
                id: 'choice-1',
                kind: 'simple-choice',
                playerId: '1',
                data: {
                    sourceId: 'source-1',
                    options,
                },
            },
        },
    },
}) as unknown as MatchState<unknown>;

describe('onlineAiUnsatisfiableInteraction', () => {
    it('只认可可上报的无解交互原因', () => {
        expect(isOnlineAiUnsatisfiableInteractionReason('empty-options')).toBe(true);
        expect(isOnlineAiUnsatisfiableInteractionReason('all-options-disabled')).toBe(true);
        expect(isOnlineAiUnsatisfiableInteractionReason('min-selection-unreachable')).toBe(true);
        expect(isOnlineAiUnsatisfiableInteractionReason('manual-selection-required')).toBe(false);
        expect(isOnlineAiUnsatisfiableInteractionReason(null)).toBe(false);
    });

    it('默认抑制只有 emergency skip 一个可恢复选项的反馈', () => {
        const selectability = buildInteractionSelectabilityDiagnostic({
            id: 'choice-1',
            kind: 'simple-choice',
            sourceId: 'source-1',
            options: [{
                id: '__emergency_skip__',
                label: 'Skip',
                value: { __emergency_skip__: true },
                displayMode: 'button',
            }],
        });

        expect(shouldSuppressUnsatisfiableInteractionFeedback({
            sharedInteraction: null,
            seatInteraction: null,
            sharedSelectability: selectability,
        })).toBe(true);
    });

    it('AI emergency skip 可转成 cancel payload 并保留交互原因', () => {
        const cancelPayload = resolveAiEmergencySkipCancelPayload(
            createSeatState([{
                id: '__emergency_skip__',
                label: 'Skip',
                value: {
                    __emergency_skip__: true,
                    __emergency_skip_reason__: 'empty-options',
                },
                displayMode: 'button',
            }]),
            { interactionId: 'choice-1', optionId: '__emergency_skip__' },
        );

        expect(cancelPayload).toEqual({
            interactionId: 'choice-1',
            reason: 'empty-options',
        });
    });

    it('AI emergency skip 不会跨 interactionId 转换', () => {
        const cancelPayload = resolveAiEmergencySkipCancelPayload(
            createSeatState([{
                id: '__emergency_skip__',
                label: 'Skip',
                value: { __emergency_skip__: true },
                displayMode: 'button',
            }]),
            { interactionId: 'other-choice', optionId: '__emergency_skip__' },
        );

        expect(cancelPayload).toBeNull();
    });
});
