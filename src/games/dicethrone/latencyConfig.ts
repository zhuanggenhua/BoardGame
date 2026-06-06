/**
 * DiceThrone 延迟优化配置
 *
 * 乐观更新引擎默认使用 Random Probe 自动检测命令是否依赖随机数：
 * - pipeline 执行期间调用了 RandomFn → 非确定性，丢弃乐观结果
 * - 未调用 RandomFn → 确定性，保留乐观结果
 *
 * 此处只需声明需要覆盖自动检测的特殊命令。
 */

import type { LatencyOptimizationConfig } from '../../engine/transport/latency/types';

// ============================================================================
// 命令确定性覆盖（仅特殊情况）
// ============================================================================

/**
 * ADVANCE_PHASE 在以下阶段退出时会调用 random，Random Probe 能自动检测到。
 * 但 offensiveRoll/defensiveRoll 退出时的随机调用发生在 FlowSystem onPhaseExit 内，
 * 而非 execute 层，probe 同样能捕获，无需手动声明。
 *
 * 保留此注释作为说明，实际不需要任何覆盖声明。
 */

// ============================================================================
// 导出配置
// ============================================================================

export const diceThroneLatencyConfig: LatencyOptimizationConfig = {
    optimistic: {
        enabled: true,
        // commandDeterminism 不声明 → 全部走 Random Probe 自动检测
        // 乐观动画：确定性命令立即播放动画，不等服务端确认
        animationMode: {
            'TOGGLE_DIE_LOCK': 'optimistic',
            'CONFIRM_ROLL': 'optimistic',
            'SELECT_ABILITY': 'optimistic',
            'SKIP_TOKEN_RESPONSE': 'optimistic',
            // 维持/回合推进可能公开揭示对手的额外投骰；这里必须等权威 eventStream，
            // 否则发送方本地回滚会把这类公开事件误裁掉，表现成对面视角静默结算。
            'ADVANCE_PHASE': 'wait-confirm',
            // 种子同步后，随机命令也可以乐观预测并立即播放动画
            'ROLL_DICE': 'optimistic',
            'REROLL_DIE': 'optimistic',
            'REROLL_BONUS_DIE': 'optimistic',
            // 注：RESPONSE_PASS 仍沿用引擎层内置 optimistic 默认值
        },
        // [已移除] animationDelay：延迟整个 setState 会阻塞 EventStream 事件传递，
        // 骰子动画最短播放时间改为在 DiceActions 组件内用 MIN_ROLL_ANIMATION_MS 保护。
    },
    batching: {
        enabled: true,
        windowMs: 50,
        maxBatchSize: 5,
        immediateCommands: [
            'ROLL_DICE',
            'REROLL_DIE',
            'REROLL_BONUS_DIE',
            'DRAW_CARD',
            'ADVANCE_PHASE',
            'CONFIRM_ROLL',
        ],
    },
};
