/**
 * useMultistepInteraction — 多步交互 React Hook
 *
 * 管理 result / stepCount 本地状态。
 * step() 调用 localReducer（纯本地，不经过 pipeline）。
 * confirm() 调用 toCommands() 生成命令列表；多命令按一次 transport 批次 dispatch。
 * cancel() dispatch SYS_INTERACTION_CANCEL。
 * 交互 ID 变化时自动重置本地状态。
 * maxSteps 达到时自动 confirm。
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { TRANSPORT_BATCH_COMMAND, type TransportBatchCommand } from '../batchDispatchCommand';
import { INTERACTION_COMMANDS, type InteractionDescriptor, type MultistepChoiceData } from './InteractionSystem';

export interface MultistepInteractionState<TResult> {
    /** 当前累积结果 */
    result: TResult | null;
    /** 已执行的步骤数 */
    stepCount: number;
    /** 是否可以确认（stepCount >= minSteps） */
    canConfirm: boolean;
    /** 执行一个中间步骤（纯本地） */
    step: (payload: unknown) => void;
    /** 确认提交（生成命令列表并 dispatch） */
    confirm: () => void;
    /** 取消 */
    cancel: () => void;
}

export function useMultistepInteraction<TStep = unknown, TResult = unknown>(
    interaction: InteractionDescriptor<MultistepChoiceData<TStep, TResult>> | undefined,
    dispatch: (type: string, payload?: unknown) => void,
): MultistepInteractionState<TResult> {
    const data = interaction?.data as MultistepChoiceData<TStep, TResult> | undefined;
    const interactionId = interaction?.id;

    const [result, setResult] = useState<TResult | null>(data?.initialResult ?? null);
    const [stepCount, setStepCount] = useState(0);

    const getCompletedStepCount = useCallback((currentResult: TResult | null, fallbackStepCount: number): number => {
        if (currentResult === null) return 0;
        return data?.getCompletedSteps
            ? data.getCompletedSteps(currentResult)
            : fallbackStepCount;
    }, [data]);

    // 用 ref 追踪最新的 result/stepCount，避免 confirm 闭包捕获旧值
    const resultRef = useRef(result);
    const stepCountRef = useRef(stepCount);

    // 防止 auto-confirm（step 达到 maxSteps）和手动 confirm 重复 dispatch
    const confirmedRef = useRef(false);

    const dispatchCommands = useCallback((commands: TransportBatchCommand[]) => {
        if (commands.length === 0) return;
        if (commands.length === 1) {
            const command = commands[0]!;
            dispatch(command.type, command.payload);
            return;
        }
        dispatch(TRANSPORT_BATCH_COMMAND, { commands });
    }, [dispatch]);

    useEffect(() => {
        resultRef.current = result;
    }, [result]);

    useEffect(() => {
        stepCountRef.current = stepCount;
    }, [stepCount]);

    // 交互 ID 变化时重置本地状态
    useEffect(() => {
        const initialResult = data?.initialResult ?? null;
        resultRef.current = initialResult;
        stepCountRef.current = 0;
        if (data) {
            setResult(data.initialResult);
        } else {
            setResult(null);
        }
        setStepCount(0);
        confirmedRef.current = false;
    }, [interactionId]); // eslint-disable-line react-hooks/exhaustive-deps

    const step = useCallback((payload: unknown) => {
        if (!data) return;
        const typedPayload = payload as TStep;

        // 可选验证
        if (data.validateStep && resultRef.current !== null) {
            if (!data.validateStep(resultRef.current, typedPayload)) return;
        }

        // 先计算新 result，再同步传给 setStepCount 的自动 confirm 逻辑
        const newResult = resultRef.current !== null
            ? data.localReducer(resultRef.current, typedPayload)
            : null;

        // 同一事件循环内可能连续触发多个 step（快速点击、触摸连点或测试批处理）。
        // 必须立即推进 ref，不能等待 React 下一次渲染后再同步，否则后一步会基于旧结果计算。
        resultRef.current = newResult;
        setResult(newResult);
        setStepCount(prev => {
            const next = prev + 1;
            stepCountRef.current = next;
            // maxSteps 达到时自动 confirm
            // 直接使用上方已计算好的 newResult，不依赖 ref（避免 React 批量更新导致 ref 仍是旧值）
            if (data.maxSteps !== undefined && newResult !== null) {
                if (data.confirmationMode === 'submitBatch') {
                    return next;
                }
                // 优先使用 getCompletedSteps 从结果中提取语义步骤数（如已修改的不同骰子数），
                // 未提供时退化为按 step() 调用次数计数
                const completedSteps = data.getCompletedSteps
                    ? data.getCompletedSteps(newResult)
                    : next;
                if (completedSteps >= data.maxSteps) {
                    if (confirmedRef.current) return next; // 已经 confirm 过，跳过
                    confirmedRef.current = true;
                    const commands = data.toCommands(newResult);
                    // 捕获当前 interactionId，防止闭包中引用变化
                    const confirmId = interactionId;
                    // 用 queueMicrotask 确保在当前 React 渲染批次完成后再 dispatch
                    queueMicrotask(() => {
                        dispatchCommands([
                            ...commands,
                            {
                                type: INTERACTION_COMMANDS.CONFIRM,
                                payload: { interactionId: confirmId },
                            },
                        ]);
                    });
                }
            }
            return next;
        });
    }, [data, dispatchCommands, interactionId]);

    const confirm = useCallback(() => {
        if (!data || resultRef.current === null) return;
        if (confirmedRef.current) return; // 已经 confirm 过（auto-confirm 或重复点击），跳过
        const minSteps = data.minSteps ?? 0;
        const completedSteps = getCompletedStepCount(resultRef.current, stepCountRef.current);
        if (completedSteps < minSteps) return;

        confirmedRef.current = true;
        const shouldResolve = data.confirmationMode === 'submitBatch'
            ? data.shouldResolveOnConfirm?.(resultRef.current) === true
            : true;
        const commands = data.toCommands(resultRef.current);
        // 捕获当前 interactionId，防止闭包中引用变化
        const confirmId = interactionId;
        if (shouldResolve) {
            // 所有业务命令 dispatch 完后，发送确认信号 resolve 交互（携带 interactionId 防止误 resolve 下一个交互）
            dispatchCommands([
                ...commands,
                {
                    type: INTERACTION_COMMANDS.CONFIRM,
                    payload: { interactionId: confirmId },
                },
            ]);
            return;
        }

        dispatchCommands(commands);

        const nextResult = data.initialResult ?? null;
        resultRef.current = nextResult;
        stepCountRef.current = 0;
        setResult(nextResult);
        setStepCount(0);
        confirmedRef.current = false;
    }, [data, dispatchCommands, getCompletedStepCount, interactionId]);

    const cancel = useCallback(() => {
        if (!interaction) return;
        dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: interaction.id });
    }, [interaction, dispatch]);

    const minSteps = data?.minSteps ?? 0;
    const canConfirm = result !== null && getCompletedStepCount(result, stepCount) >= minSteps;

    return { result, stepCount, canConfirm, step, confirm, cancel };
}
