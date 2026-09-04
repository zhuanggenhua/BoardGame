import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { resolveLocalAiActionDelayPlan, startCancelableAiDelay } from '../../ai';

describe('resolveLocalAiActionDelayPlan（单一延迟预算）', () => {
    it('隐藏动作不吃主动延迟', () => {
        const plan = resolveLocalAiActionDelayPlan({
            controller: { type: 'local-ai' },
            actionVisibility: 'hidden',
            now: 1_000,
            lastVisibleActionAt: 200,
            extraElapsedBudgetMs: [300],
        });

        expect(plan.minimumDelayMs).toBe(0);
        expect(plan.delayBudgetElapsedMs).toBe(0);
        expect(plan.remainingDelayMs).toBe(0);
    });

    it('默认可见动作统一使用 1000ms 最小时长', () => {
        const plan = resolveLocalAiActionDelayPlan({
            controller: { type: 'local-ai' },
            actionVisibility: 'visible',
            now: 1_000,
        });

        expect(plan.minimumDelayMs).toBe(1000);
        expect(plan.lastVisibleActionAt).toBeNull();
        expect(plan.visibleStepElapsedMs).toBeNull();
        expect(plan.remainingDelayMs).toBe(1000);
    });

    it('游戏 runtime 可覆盖默认 AI 思考时长，座位自定义优先级最高', () => {
        expect(resolveLocalAiActionDelayPlan({
            controller: { type: 'local-ai' },
            actionVisibility: 'visible',
            now: 1_000,
            defaultMinimumActionDelayMs: 3000,
        }).remainingDelayMs).toBe(3000);

        expect(resolveLocalAiActionDelayPlan({
            controller: { type: 'local-ai', minimumActionDelayMs: 0 },
            actionVisibility: 'visible',
            now: 1_000,
            defaultMinimumActionDelayMs: 3000,
        }).remainingDelayMs).toBe(0);

        expect(resolveLocalAiActionDelayPlan({
            controller: { type: 'local-ai', minimumActionDelayMs: 500 },
            actionVisibility: 'visible',
            now: 1_000,
            defaultMinimumActionDelayMs: 3000,
        }).remainingDelayMs).toBe(500);
    });

    it('在线链路已有状态年龄只做观测，不再抵扣可见步骤延迟', () => {
        const observedState = {
            sys: {
                eventStream: {
                    entries: [
                        { event: { timestamp: 8_000 } },
                    ],
                },
            },
        } as any;

        const plan = resolveLocalAiActionDelayPlan({
            controller: { type: 'local-ai' },
            actionVisibility: 'visible',
            now: 8_600,
            observedState,
            extraElapsedBudgetMs: [200],
        });

        expect(plan.minimumDelayMs).toBe(1000);
        expect(plan.observedStateAgeMs).toBe(600);
        expect(plan.delayBudgetElapsedMs).toBe(0);
        expect(plan.remainingDelayMs).toBe(1000);
    });

    it('会忽略 timestamp=0 的占位事件，避免错误吃光可见动作延迟', () => {
        const observedState = {
            sys: {
                eventStream: {
                    entries: [
                        { event: { timestamp: 0 } },
                    ],
                },
                actionLog: {
                    entries: [
                        { timestamp: 0 },
                    ],
                },
            },
        } as any;

        const plan = resolveLocalAiActionDelayPlan({
            controller: { type: 'local-ai' },
            actionVisibility: 'visible',
            now: 8_600,
            observedState,
            extraElapsedBudgetMs: [200],
        });

        expect(plan.observedStateAgeMs).toBe(0);
        expect(plan.delayBudgetElapsedMs).toBe(0);
        expect(plan.remainingDelayMs).toBe(1000);
    });

    it('可见步骤应从上一次可见动作提交后重新计时，不区分 seat', () => {
        const plan = resolveLocalAiActionDelayPlan({
            controller: { type: 'local-ai' },
            actionVisibility: 'visible',
            now: 8_600,
            lastVisibleActionAt: 8_150,
            extraElapsedBudgetMs: [900],
            observedState: {
                sys: {
                    eventStream: {
                        entries: [
                            { event: { timestamp: 7_000 } },
                        ],
                    },
                },
            } as any,
        });

        expect(plan.observedStateAgeMs).toBe(1600);
        expect(plan.visibleStepElapsedMs).toBe(450);
        expect(plan.delayBudgetElapsedMs).toBe(450);
        expect(plan.remainingDelayMs).toBe(550);
    });
});

describe('startCancelableAiDelay（可取消延迟）', () => {
    it('取消时不会让等待悬空', async () => {
        vi.useFakeTimers();
        try {
            const handle = startCancelableAiDelay(1000);
            const resultPromise = handle.promise;

            vi.advanceTimersByTime(300);
            handle.cancel();
            await vi.runAllTimersAsync();

            await expect(resultPromise).resolves.toMatchObject({
                outcome: 'cancelled',
                targetDelayMs: 1000,
                waitedMs: 300,
            });
        } finally {
            vi.useRealTimers();
        }
    });

    it('正常到点时会返回 elapsed', async () => {
        vi.useFakeTimers();
        try {
            const handle = startCancelableAiDelay(400);
            const resultPromise = handle.promise;

            vi.advanceTimersByTime(400);
            await vi.runAllTimersAsync();

            await expect(resultPromise).resolves.toMatchObject({
                outcome: 'elapsed',
                targetDelayMs: 400,
                waitedMs: 400,
            });
        } finally {
            vi.useRealTimers();
        }
    });
});
