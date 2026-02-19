/**
 * 召唤师战争（SummonerWars）延迟优化配置
 *
 * 召唤师战争大部分命令为确定性操作（召唤、移动、建造等），
 * 仅攻击确认（掷骰子）和开始游戏（洗牌）依赖随机数。
 * 技能激活可能触发随机效果，保守标记为非确定性。
 */

import type { LatencyOptimizationConfig } from '../../engine/transport/latency/types';
import { FLOW_COMMANDS } from '../../engine/systems/FlowSystem';
import { SW_COMMANDS } from './domain/types';

// ============================================================================
// 命令确定性声明
// ============================================================================

/**
 * 确定性命令：纯状态转换，不依赖随机数。
 */
const DETERMINISTIC_COMMANDS = [
    // 阵营选择阶段
    SW_COMMANDS.SELECT_FACTION,
    SW_COMMANDS.SELECT_CUSTOM_DECK,
    SW_COMMANDS.PLAYER_READY,
    // 召唤阶段（从手牌放置到棋盘）
    SW_COMMANDS.SUMMON_UNIT,
    // 移动阶段（选择 + 移动）
    SW_COMMANDS.SELECT_UNIT,
    SW_COMMANDS.MOVE_UNIT,
    // 建造阶段（放置建筑）
    SW_COMMANDS.BUILD_STRUCTURE,
    // 攻击阶段（宣告攻击，不含掷骰）
    SW_COMMANDS.DECLARE_ATTACK,
    // 魔力阶段（弃牌换魔力）
    SW_COMMANDS.DISCARD_FOR_MAGIC,
    // 结束阶段
    SW_COMMANDS.END_PHASE,
    // 施放事件卡（确定性效果部分）
    SW_COMMANDS.PLAY_EVENT,
    // 血契召唤步骤
    SW_COMMANDS.BLOOD_SUMMON_STEP,
    // 殉葬火堆治疗
    SW_COMMANDS.FUNERAL_PYRE_HEAL,
] as const;

/**
 * 非确定性命令：依赖服务端随机数生成器。
 */
const NON_DETERMINISTIC_COMMANDS = [
    // 开始游戏 → 洗牌（random.shuffle）
    SW_COMMANDS.HOST_START_GAME,
    // 确认攻击 → 掷骰子（random.random）
    SW_COMMANDS.CONFIRM_ATTACK,
    // 激活技能 → 部分技能可能触发随机效果
    SW_COMMANDS.ACTIVATE_ABILITY,
] as const;

// ============================================================================
// 导出配置
// ============================================================================

/**
 * 召唤师战争延迟优化配置
 *
 * 策略说明：
 * - 乐观更新：13/16 命令为确定性，可安全预测
 * - 命令批处理：启用，移动阶段多步操作可合并
 * - 本地交互：未启用（移动链路已由 InteractionSystem 管理）
 */
export const summonerWarsLatencyConfig: LatencyOptimizationConfig = {
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
            // 单位操作：选择/移动/召唤/建造 → 立即反馈
            [SW_COMMANDS.SELECT_UNIT]: 'optimistic',
            [SW_COMMANDS.MOVE_UNIT]: 'optimistic',
            [SW_COMMANDS.SUMMON_UNIT]: 'optimistic',
            [SW_COMMANDS.BUILD_STRUCTURE]: 'optimistic',
            // 攻击宣告（不含掷骰）→ 立即反馈
            [SW_COMMANDS.DECLARE_ATTACK]: 'optimistic',
            // 阶段推进 → 立即反馈
            [SW_COMMANDS.END_PHASE]: 'optimistic',
            // 引擎层阶段推进（FlowSystem）→ 确定性，立即反馈
            // 避免 onPhaseStart 技能事件（如幻化）等待服务端确认
            [FLOW_COMMANDS.ADVANCE_PHASE]: 'optimistic',
            // 魔力弃牌 → 立即反馈
            [SW_COMMANDS.DISCARD_FOR_MAGIC]: 'optimistic',
        },
    },
    batching: {
        enabled: true,
        windowMs: 50,
        maxBatchSize: 8,
        immediateCommands: [
            // 攻击确认需要即时反馈（掷骰子）
            SW_COMMANDS.CONFIRM_ATTACK,
            // 开始游戏（低频但重要）
            SW_COMMANDS.HOST_START_GAME,
            // 技能激活需要即时反馈
            SW_COMMANDS.ACTIVATE_ABILITY,
            // 结束阶段需要即时反馈
            SW_COMMANDS.END_PHASE,
        ],
    },
};
