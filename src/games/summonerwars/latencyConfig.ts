/**
 * 召唤师战争（SummonerWars）延迟优化配置
 *
 * 召唤师战争大部分命令为确定性操作（召唤、移动、建造等），
 * 攻击宣告（掷骰子）和开始游戏（洗牌）依赖随机数。
 * 注意：DECLARE_ATTACK 是实际执行攻击结算（含掷骰）的命令，CONFIRM_ATTACK 是死代码（execute 未实现）。
 * 技能激活由 Random Probe 自动检测确定性（当前所有执行器均不调用 random）。
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
    // 宣告攻击 → 掷骰子（random.random）
    // 注意：DECLARE_ATTACK 是实际执行攻击结算的命令（含掷骰），CONFIRM_ATTACK 是死代码
    SW_COMMANDS.DECLARE_ATTACK,
    // 确认攻击（死代码，execute 未实现，保留声明避免 Random Probe 误判）
    SW_COMMANDS.CONFIRM_ATTACK,
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
            // 技能激活：不显式声明，由 Random Probe 自动检测。
            // 确定性技能（心灵捕获/幻化/念力等）自动乐观预测；
            // 未来若新增含随机效果的技能，probe 检测到 random 调用后自动回退，无需手动维护。
        },
        // 乐观动画：确定性命令立即播放动画，不等服务端确认
        animationMode: {
            // 单位操作：选择/移动/召唤/建造 → 立即反馈
            [SW_COMMANDS.SELECT_UNIT]: 'optimistic',
            [SW_COMMANDS.MOVE_UNIT]: 'optimistic',
            [SW_COMMANDS.SUMMON_UNIT]: 'optimistic',
            [SW_COMMANDS.BUILD_STRUCTURE]: 'optimistic',
            // 攻击宣告（含掷骰，非确定性）→ 种子同步后可乐观预测，立即反馈
            // isRandomSynced=false 时不会进入此路径（non-deterministic 命令会跳过预测）
            [SW_COMMANDS.DECLARE_ATTACK]: 'optimistic',
            // 阶段推进 → 立即反馈
            [SW_COMMANDS.END_PHASE]: 'optimistic',
            // 引擎层阶段推进（FlowSystem）→ 确定性，立即反馈
            // 避免 onPhaseStart 技能事件（如幻化）等待服务端确认
            [FLOW_COMMANDS.ADVANCE_PHASE]: 'optimistic',
            // 魔力弃牌 → 立即反馈
            [SW_COMMANDS.DISCARD_FOR_MAGIC]: 'optimistic',
            // 技能激活 → 确定性，立即反馈（心灵捕获/幻化/念力等）
            [SW_COMMANDS.ACTIVATE_ABILITY]: 'optimistic',
            // CONFIRM_ATTACK 是死代码（execute 未实现），无需声明动画模式
        },
    },
    batching: {
        enabled: true,
        windowMs: 50,
        maxBatchSize: 8,
        immediateCommands: [
            // 攻击宣告需要即时反馈（掷骰子）
            SW_COMMANDS.DECLARE_ATTACK,
            // 开始游戏（低频但重要）
            SW_COMMANDS.HOST_START_GAME,
            // 技能激活需要即时反馈
            SW_COMMANDS.ACTIVATE_ABILITY,
            // 结束阶段需要即时反馈
            SW_COMMANDS.END_PHASE,
        ],
    },
};
