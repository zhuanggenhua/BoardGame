/**
 * 大杀四方（SmashUp）延迟优化配置
 *
 * 大杀四方的能力系统会在打出随从/行动卡时触发连锁效果，
 * 这些效果可能涉及抽牌（random.shuffle）和随机选择，
 * 因此大部分命令为非确定性。
 *
 * 保守策略：仅对不触发能力链的纯操作启用乐观预测。
 */

import type { LatencyOptimizationConfig } from '../../engine/transport/latency/types';
import { SU_COMMANDS } from './domain/types';

// ============================================================================
// 命令确定性声明
// ============================================================================

/**
 * 确定性命令：不触发能力链，不依赖随机数。
 */
const DETERMINISTIC_COMMANDS = [
    // 弃牌至手牌上限（纯移除操作）
    SU_COMMANDS.DISCARD_TO_LIMIT,
] as const;

/**
 * 非确定性命令：可能触发能力链（抽牌、洗牌等随机效果）。
 */
const NON_DETERMINISTIC_COMMANDS = [
    // 打出随从 → 触发 onPlay 能力链（可能抽牌/洗牌）
    SU_COMMANDS.PLAY_MINION,
    // 打出行动卡 → 触发效果（可能抽牌/洗牌/随机选择）
    SU_COMMANDS.PLAY_ACTION,
    // 选择派系 → 最后一人选择时触发牌库洗牌和初始手牌抽取
    SU_COMMANDS.SELECT_FACTION,
    // 使用天赋 → 触发能力效果（可能涉及随机）
    SU_COMMANDS.USE_TALENT,
] as const;

// ============================================================================
// 导出配置
// ============================================================================

/**
 * 大杀四方延迟优化配置
 *
 * 策略说明：
 * - 乐观更新：仅对弃牌和关闭展示启用（确定性操作）
 * - 命令批处理：启用，合并短时间内的多个操作
 * - 本地交互：未启用（当前无多步本地交互场景）
 */
export const smashUpLatencyConfig: LatencyOptimizationConfig = {
    optimistic: {
        enabled: true,
        commandDeterminism: {
            ...Object.fromEntries(
                DETERMINISTIC_COMMANDS.map(cmd => [cmd, 'deterministic' as const]),
            ),
            ...Object.fromEntries(
                NON_DETERMINISTIC_COMMANDS.map(cmd => [cmd, 'non-deterministic' as const]),
            ),
        },
        // 乐观动画：确定性命令立即播放动画，不等服务端确认
        animationMode: {
            // 弃牌至手牌上限 → 立即反馈
            [SU_COMMANDS.DISCARD_TO_LIMIT]: 'optimistic',
            // 种子同步后，随机命令也可以乐观预测并立即播放动画
            [SU_COMMANDS.PLAY_MINION]: 'optimistic',
            [SU_COMMANDS.PLAY_ACTION]: 'optimistic',
            [SU_COMMANDS.SELECT_FACTION]: 'optimistic',
            [SU_COMMANDS.USE_TALENT]: 'optimistic',
            // ADVANCE_PHASE 也使用 optimistic：立即应用状态，不等待服务器确认
            // 这样可以确保 afterScoring 效果（如自助餐）立即生效
            'ADVANCE_PHASE': 'optimistic',
        },
        // 事件级别乐观模式：基地计分相关事件立即应用，不等待服务器确认
        // 这样可以确保 afterScoring 触发器产生的效果（如自助餐加指示物）立即显示
        eventOptimistic: {
            'su:power_counter_added': true,
            'su:base_scored': true,
            'su:base_cleared': true,
            'su:base_replaced': true,
            'su:special_after_scoring_consumed': true,
        },
    },
    batching: {
        enabled: true,
        windowMs: 50,
        maxBatchSize: 5,
        immediateCommands: [
            // 打出随从/行动卡需要即时反馈
            SU_COMMANDS.PLAY_MINION,
            SU_COMMANDS.PLAY_ACTION,
            // 使用天赋需要即时反馈
            SU_COMMANDS.USE_TALENT,
            // 选择派系（低频但重要）
            SU_COMMANDS.SELECT_FACTION,
            // 交互响应和响应窗口跳过必须即时发送，绕过批处理窗口
            // 防止快速连点时多个交互命令被聚合，导致重复消费/状态异常
            'SYS_INTERACTION_RESPOND',
            'SYS_INTERACTION_CANCEL',
            'RESPONSE_PASS',
        ],
    },
};
