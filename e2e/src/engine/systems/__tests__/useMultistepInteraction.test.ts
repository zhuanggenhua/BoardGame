/**
 * useMultistepInteraction hook 单元测试
 * 重点验证 any/adjust 模式下禁用 auto-confirm，用户必须手动确认
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMultistepInteraction } from '../useMultistepInteraction';
import type { InteractionDescriptor, MultistepChoiceData } from '../InteractionSystem';

// 模拟骰子修改场景的类型
interface DiceModifyResult {
    modifications: Record<number, number>;
    modCount: number;
}
interface DiceModifyStep {
    action: 'setAny';
    dieId: number;
    newValue: number;
}

/** 创建 any 模式交互（无 maxSteps，手动确认） */
function createAnyModeInteraction(
    minSteps = 1,
): InteractionDescriptor<MultistepChoiceData<DiceModifyStep, DiceModifyResult>> {
    return {
        id: 'test-any-mode',
        kind: 'multistep-choice',
        playerId: '0',
        data: {
            title: '测试 any 模式',
            maxSteps: undefined, // 禁用 auto-confirm
            minSteps,
            initialResult: { modifications: {}, modCount: 0 },
            localReducer: (current, step) => {
                const isNewDie = !(step.dieId in current.modifications);
                return {
                    modifications: { ...current.modifications, [step.dieId]: step.newValue },
                    modCount: isNewDie ? current.modCount + 1 : current.modCount,
                };
            },
            toCommands: (result) =>
                Object.entries(result.modifications).map(([dieId, newValue]) => ({
                    type: 'MODIFY_DIE',
                    payload: { dieId: Number(dieId), newValue },
                })),
        },
    };
}

/** 创建 set 模式交互（有 maxSteps，自动确认） */
function createSetModeInteraction(
    maxSteps: number,
): InteractionDescriptor<MultistepChoiceData<DiceModifyStep, DiceModifyResult>> {
    return {
        id: 'test-set-mode',
        kind: 'multistep-choice',
        playerId: '0',
        data: {
            title: '测试 set 模式',
            maxSteps,
            initialResult: { modifications: {}, modCount: 0 },
            localReducer: (current, step) => ({
                modifications: { ...current.modifications, [step.dieId]: step.newValue },
                modCount: current.modCount + 1,
            }),
            toCommands: (result) =>
                Object.entries(result.modifications).map(([dieId, newValue]) => ({
                    type: 'MODIFY_DIE',
                    payload: { dieId: Number(dieId), newValue },
                })),
        },
    };
}

describe('useMultistepInteraction', () => {
    describe('any 模式（无 maxSteps，手动确认）', () => {
        it('对同一骰子多次 +/- 不触发 auto-confirm', () => {
            const dispatch = vi.fn();
            const interaction = createAnyModeInteraction();

            const { result } = renderHook(() =>
                useMultistepInteraction(interaction, dispatch),
            );

            // 对同一颗骰子反复调整
            act(() => { result.current.step({ action: 'setAny', dieId: 0, newValue: 3 }); });
            act(() => { result.current.step({ action: 'setAny', dieId: 0, newValue: 4 }); });
            act(() => { result.current.step({ action: 'setAny', dieId: 0, newValue: 5 }); });

            // 不应 auto-confirm
            expect(dispatch).not.toHaveBeenCalled();
            expect(result.current.stepCount).toBe(3);
            expect(result.current.result?.modCount).toBe(1);
            // minSteps=1，已修改 1 颗骰子，可以手动确认
            expect(result.current.canConfirm).toBe(true);
        });

        it('修改多颗骰子后仍不 auto-confirm，需手动确认', () => {
            const dispatch = vi.fn();
            const interaction = createAnyModeInteraction();

            const { result } = renderHook(() =>
                useMultistepInteraction(interaction, dispatch),
            );

            act(() => { result.current.step({ action: 'setAny', dieId: 0, newValue: 6 }); });
            act(() => { result.current.step({ action: 'setAny', dieId: 1, newValue: 6 }); });

            // 不应 auto-confirm（maxSteps=undefined）
            expect(dispatch).not.toHaveBeenCalled();
            expect(result.current.result?.modCount).toBe(2);
            expect(result.current.canConfirm).toBe(true);
        });

        it('手动 confirm 正确 dispatch 命令', () => {
            const dispatch = vi.fn();
            const interaction = createAnyModeInteraction();

            const { result } = renderHook(() =>
                useMultistepInteraction(interaction, dispatch),
            );

            act(() => { result.current.step({ action: 'setAny', dieId: 0, newValue: 5 }); });
            act(() => { result.current.step({ action: 'setAny', dieId: 2, newValue: 3 }); });

            // 手动确认
            act(() => { result.current.confirm(); });

            const calls = dispatch.mock.calls.map(c => c[0]);
            expect(calls.filter(c => c === 'MODIFY_DIE')).toHaveLength(2);
            expect(calls).toContain('SYS_INTERACTION_CONFIRM');
        });

        it('未达到 minSteps 时 canConfirm=false', () => {
            const dispatch = vi.fn();
            const interaction = createAnyModeInteraction(1);

            const { result } = renderHook(() =>
                useMultistepInteraction(interaction, dispatch),
            );

            // 未做任何修改
            expect(result.current.canConfirm).toBe(false);

            // 做一次修改后
            act(() => { result.current.step({ action: 'setAny', dieId: 0, newValue: 3 }); });
            expect(result.current.canConfirm).toBe(true);
        });
    });

    describe('set 模式（有 maxSteps，自动确认）', () => {
        it('达到 maxSteps 时自动 confirm', async () => {
            const dispatch = vi.fn();
            const interaction = createSetModeInteraction(1);

            const { result } = renderHook(() =>
                useMultistepInteraction(interaction, dispatch),
            );

            act(() => { result.current.step({ action: 'setAny', dieId: 0, newValue: 6 }); });

            await vi.waitFor(() => {
                expect(dispatch).toHaveBeenCalled();
            });

            const calls = dispatch.mock.calls.map(c => c[0]);
            expect(calls).toContain('MODIFY_DIE');
            expect(calls).toContain('SYS_INTERACTION_CONFIRM');
        });
    });

    describe('getCompletedSteps 回调', () => {
        it('使用 getCompletedSteps 时，按语义步骤数判断 auto-confirm', async () => {
            const dispatch = vi.fn();
            const interaction: InteractionDescriptor<MultistepChoiceData<DiceModifyStep, DiceModifyResult>> = {
                id: 'test-with-getter',
                kind: 'multistep-choice',
                playerId: '0',
                data: {
                    title: '测试 getCompletedSteps',
                    maxSteps: 2,
                    initialResult: { modifications: {}, modCount: 0 },
                    localReducer: (current, step) => {
                        const isNewDie = !(step.dieId in current.modifications);
                        return {
                            modifications: { ...current.modifications, [step.dieId]: step.newValue },
                            modCount: isNewDie ? current.modCount + 1 : current.modCount,
                        };
                    },
                    toCommands: (result) =>
                        Object.entries(result.modifications).map(([dieId, newValue]) => ({
                            type: 'MODIFY_DIE',
                            payload: { dieId: Number(dieId), newValue },
                        })),
                    getCompletedSteps: (result) => result.modCount,
                },
            };

            const { result } = renderHook(() =>
                useMultistepInteraction(interaction, dispatch),
            );

            // 对同一骰子 step 两次 → modCount=1，不触发
            act(() => { result.current.step({ action: 'setAny', dieId: 0, newValue: 3 }); });
            act(() => { result.current.step({ action: 'setAny', dieId: 0, newValue: 5 }); });
            expect(dispatch).not.toHaveBeenCalled();

            // 修改第二颗 → modCount=2 >= maxSteps=2，触发
            act(() => { result.current.step({ action: 'setAny', dieId: 1, newValue: 6 }); });

            await vi.waitFor(() => {
                expect(dispatch).toHaveBeenCalled();
            });

            const calls = dispatch.mock.calls.map(c => c[0]);
            expect(calls).toContain('SYS_INTERACTION_CONFIRM');
        });
    });
});
