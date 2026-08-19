import { describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../types';
import {
    isOnlineAiEngineSystemCommand,
    precheckOnlineAiAuthoritativeCommand,
} from '../onlineAiLegalActionCommand';
import { buildOnlineAiLegalActionCommandFailedResult } from '../onlineAiWatchdogSequenceHelpers';

const state = {
    core: { activePlayerId: '1' },
    sys: { phase: 'main', turnNumber: 1 },
} as unknown as MatchState<unknown>;

describe('onlineAiLegalActionCommand', () => {
    it('系统恢复命令不走领域 validate 预检', () => {
        const validate = vi.fn(() => ({ valid: false, error: 'should-not-run' }));

        expect(isOnlineAiEngineSystemCommand('SYS_INTERACTION_RESPOND')).toBe(true);
        expect(isOnlineAiEngineSystemCommand('ADVANCE_PHASE')).toBe(true);
        expect(isOnlineAiEngineSystemCommand('RESPONSE_PASS')).toBe(true);

        const result = precheckOnlineAiAuthoritativeCommand({
            state,
            playerId: '1',
            command: { type: 'ADVANCE_PHASE', payload: {} },
            validate,
        });

        expect(result).toEqual({ kind: 'skipped', reason: 'engine-system-command' });
        expect(validate).not.toHaveBeenCalled();
    });

    it('普通命令使用当前权威状态和 AI 玩家身份做领域预检', () => {
        const validate = vi.fn(() => ({ valid: true }));

        const result = precheckOnlineAiAuthoritativeCommand({
            state,
            playerId: '1',
            command: { type: 'su:summon_unit', payload: { cardUid: 'unit-1' } },
            validate,
            now: () => 1234,
        });

        expect(result).toEqual({ kind: 'valid' });
        expect(validate).toHaveBeenCalledWith(state, {
            type: 'su:summon_unit',
            playerId: '1',
            payload: { cardUid: 'unit-1' },
            timestamp: 1234,
        });
    });

    it('领域预检拒绝时返回规范化失败原因', () => {
        const result = precheckOnlineAiAuthoritativeCommand({
            state,
            playerId: '1',
            command: { type: 'su:summon_unit', payload: { cardUid: 'missing-card' } },
            validate: vi.fn(() => ({ valid: false, error: '  手牌中没有该卡牌  ' })),
        });

        expect(result).toEqual({
            kind: 'invalid',
            commandFailureReason: '手牌中没有该卡牌',
        });
    });

    it('领域 validate 抛错时保留给正式执行管线处理', () => {
        const result = precheckOnlineAiAuthoritativeCommand({
            state,
            playerId: '1',
            command: { type: 'su:summon_unit', payload: { cardUid: 'unit-1' } },
            validate: vi.fn(() => {
                throw new Error('validator unavailable');
            }),
        });

        expect(result).toEqual({
            kind: 'deferred',
            errorMessage: 'validator unavailable',
        });
    });

    it('命令失败结果保持 legal-action recovery 的外部合同', () => {
        expect(buildOnlineAiLegalActionCommandFailedResult({
            executedCommandTypes: ['FIRST_OK'],
            failedCommandType: 'SECOND_FAILS',
            commandFailureReason: 'pipeline_error: denied',
        })).toEqual({
            applied: false,
            resolved: false,
            blockedReason: null,
            executedCommandTypes: ['FIRST_OK'],
            outcome: 'legal-action-command-failed',
            failedCommandType: 'SECOND_FAILS',
            commandFailureReason: 'pipeline_error: denied',
            reportedAction: null,
        });
    });
});
