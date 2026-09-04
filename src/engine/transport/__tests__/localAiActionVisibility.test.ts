import { describe, expect, it } from 'vitest';
import { resolveLocalAiActionVisibility } from '../../ai/actionVisibility';

describe('resolveLocalAiActionVisibility（可见步骤分类）', () => {
    it('metadata.visibleStepDelayPolicy 应优先覆盖默认分类', () => {
        expect(resolveLocalAiActionVisibility({
            actionId: 'toggle-hidden',
            kind: 'toggle-die-lock',
            label: '锁骰',
            commands: [{ type: 'TOGGLE_DIE_LOCK', payload: {} }],
            metadata: { visibleStepDelayPolicy: 'hidden' },
        })).toBe('hidden');

        expect(resolveLocalAiActionVisibility({
            actionId: 'card-visible',
            kind: 'play-card',
            label: '打牌',
            commands: [{ type: 'PLAY_CARD', payload: {} }],
            metadata: { visibleStepDelayPolicy: 'visible' },
        })).toBe('visible');
    });

    it('runtime 白名单存在时，只允许白名单动作吃可见步骤延迟', () => {
        const runtime = {
            localVisibleStepDelayConfig: {
                mode: 'whitelist' as const,
                actionKinds: ['play-card', 'roll-dice'],
            },
        };

        expect(resolveLocalAiActionVisibility({
            actionId: 'card-visible',
            kind: 'play-card',
            label: '打牌',
            commands: [{ type: 'PLAY_CARD', payload: {} }],
        }, runtime)).toBe('visible');

        expect(resolveLocalAiActionVisibility({
            actionId: 'lock-hidden',
            kind: 'toggle-die-lock',
            label: '锁骰',
            commands: [{ type: 'TOGGLE_DIE_LOCK', payload: {} }],
        }, runtime)).toBe('hidden');

        expect(resolveLocalAiActionVisibility({
            actionId: 'phase-hidden-by-runtime-whitelist',
            kind: 'advance-phase',
            label: '推进阶段',
            commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
        }, runtime)).toBe('hidden');
    });

    it('无 runtime 配置时，interaction/response-pass 仍隐藏，advance-phase 强制可见', () => {
        expect(resolveLocalAiActionVisibility({
            actionId: 'interaction-hidden',
            kind: 'interaction-multistep',
            label: '多步交互',
            commands: [{ type: 'SYS_INTERACTION_CONFIRM', payload: {} }],
        })).toBe('hidden');

        expect(resolveLocalAiActionVisibility({
            actionId: 'phase-hidden',
            kind: 'advance-phase',
            label: '推进阶段',
            commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
        })).toBe('visible');

        expect(resolveLocalAiActionVisibility({
            actionId: 'response-hidden',
            kind: 'response-pass',
            label: '放弃响应',
            commands: [{ type: 'RESPONSE_PASS', payload: {} }],
        })).toBe('hidden');

        expect(resolveLocalAiActionVisibility({
            actionId: 'select-faction-hidden',
            kind: 'setup-select-faction',
            label: '选择阵营',
            commands: [{ type: 'SELECT_FACTION', payload: {} }],
        })).toBe('hidden');

        expect(resolveLocalAiActionVisibility({
            actionId: 'smashup-select-faction-hidden',
            kind: 'select-faction',
            label: '选择派系',
            commands: [{ type: 'SELECT_FACTION', payload: {} }],
        })).toBe('hidden');

        expect(resolveLocalAiActionVisibility({
            actionId: 'setup-select-character-hidden',
            kind: 'setup-select-character',
            label: '选择角色',
            commands: [{ type: 'SELECT_CHARACTER', payload: {} }],
        })).toBe('hidden');

        expect(resolveLocalAiActionVisibility({
            actionId: 'setup-ready-hidden',
            kind: 'setup-ready',
            label: '准备完成',
            commands: [{ type: 'PLAYER_READY', payload: {} }],
        })).toBe('hidden');
    });

    it('无 runtime 配置时，普通可见业务动作默认视为可见步骤', () => {
        expect(resolveLocalAiActionVisibility({
            actionId: 'card-visible',
            kind: 'play-card',
            label: '打牌',
            commands: [{ type: 'PLAY_CARD', payload: {} }],
        })).toBe('visible');
    });

    it('游戏特殊快进命令应由 runtime 声明为隐藏步骤', () => {
        const action = {
            actionId: 'game-fast-step',
            kind: 'watchdog-follow-up',
            label: '游戏快进步骤',
            commands: [{ type: 'game:end_phase', payload: {} }],
        };

        expect(resolveLocalAiActionVisibility(action)).toBe('visible');
        expect(resolveLocalAiActionVisibility(action, {
            localHiddenCommandTypes: ['game:end_phase'],
        })).toBe('hidden');
    });
});
