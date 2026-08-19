import { describe, expect, it } from 'vitest';
import {
    formatOnlineAiCommandFailureReason,
    formatPipelineFailureReason,
    normalizeCommandFailureReason,
    resolveCommandFailureFeedbackSeverity,
    shouldAutoReportCommandFailure,
} from '../commandFailureReason';

describe('commandFailureReason', () => {
    it('规范化空失败原因并截断过长原因', () => {
        expect(normalizeCommandFailureReason(undefined)).toBe('command_failed');
        expect(normalizeCommandFailureReason('   ')).toBe('command_failed');
        expect(normalizeCommandFailureReason(' x '.repeat(260))).toHaveLength(503);
    });

    it('pipeline 异常原因保留 pipeline_error 前缀', () => {
        expect(formatPipelineFailureReason(new Error('boom'))).toBe('pipeline_error: boom');
        expect(formatPipelineFailureReason('')).toBe('pipeline_error');
    });

    it('在线 AI 命令失败原因不会重复附加同一原因', () => {
        expect(formatOnlineAiCommandFailureReason(
            'legal_action_command_failed',
            'ROLL_DICE',
            'pipeline_error: denied',
        )).toBe('legal_action_command_failed:ROLL_DICE:pipeline_error: denied');
        expect(formatOnlineAiCommandFailureReason(
            'command_failed',
            'ROLL_DICE',
            'command_failed',
        )).toBe('command_failed:ROLL_DICE');
    });

    it('在线 AI watchdog 失败始终允许自动上报，真人命令只上报通用或 pipeline 失败', () => {
        expect(shouldAutoReportCommandFailure('card_not_in_hand')).toBe(false);
        expect(shouldAutoReportCommandFailure('card_not_in_hand', 'online-ai-watchdog')).toBe(true);
        expect(shouldAutoReportCommandFailure('command_failed')).toBe(true);
        expect(shouldAutoReportCommandFailure('pipeline_error: denied')).toBe(true);
    });

    it('通用命令失败为 medium，其它失败为 high', () => {
        expect(resolveCommandFailureFeedbackSeverity('command_failed')).toBe('medium');
        expect(resolveCommandFailureFeedbackSeverity('pipeline_error: denied')).toBe('high');
    });
});
