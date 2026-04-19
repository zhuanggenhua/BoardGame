/**
 * 井字棋（TicTacToe）延迟优化配置
 *
 * 井字棋只有一个命令 CLICK_CELL，是纯确定性操作（无随机数）。
 * 声明为 optimistic，点击格子后立即渲染，不等服务端确认。
 */

import type { LatencyOptimizationConfig } from '../../engine/transport/latency/types';

export const ticTacToeLatencyConfig: LatencyOptimizationConfig = {
    optimistic: {
        enabled: true,
        commandDeterminism: {
            CLICK_CELL: 'deterministic',
        },
        // 乐观动画：点击格子立即播放落子动画
        animationMode: {
            CLICK_CELL: 'optimistic',
        },
    },
    batching: {
        enabled: false,
    },
};
