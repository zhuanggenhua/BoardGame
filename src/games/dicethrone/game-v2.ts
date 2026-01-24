/**
 * DiceThrone 游戏定义（新引擎架构）
 * 
 * 使用领域内核 + 引擎适配器
 */

import { createGameAdapter, createDefaultSystems, UNDO_COMMANDS } from '../../engine';
import { DiceThroneDomain } from './domain';
import type { DiceThroneCore } from './domain';
import { createDiceThroneEventSystem } from './domain/systems';

// 创建系统集合（默认系统 + DiceThrone 专用系统）
const systems = [
    ...createDefaultSystems<DiceThroneCore>(),
    createDiceThroneEventSystem(),
];

// 所有业务命令类型（必须显式列出才能生成可枚举 moves）
const COMMAND_TYPES = [
    // 骰子操作
    'ROLL_DICE',
    'ROLL_BONUS_DIE',
    'TOGGLE_DIE_LOCK',
    'CONFIRM_ROLL',
    // 技能选择
    'SELECT_ABILITY',
    // 卡牌操作
    'DRAW_CARD',
    'DISCARD_CARD',
    'SELL_CARD',
    'UNDO_SELL_CARD',
    'REORDER_CARD_TO_END',
    'PLAY_CARD',
    'PLAY_UPGRADE_CARD',
    // 选择与阶段
    'RESOLVE_CHOICE',
    'ADVANCE_PHASE',
    // 撤销系统命令
    UNDO_COMMANDS.REQUEST_UNDO,
    UNDO_COMMANDS.APPROVE_UNDO,
    UNDO_COMMANDS.REJECT_UNDO,
    UNDO_COMMANDS.CANCEL_UNDO,
];

// 使用适配器创建 Boardgame.io Game
export const DiceThroneGameV2 = createGameAdapter({
    domain: DiceThroneDomain,
    systems,
    minPlayers: 2,
    maxPlayers: 2,
    commandTypes: COMMAND_TYPES,
});

export default DiceThroneGameV2;

// 导出类型（兼容）
export type { DiceThroneCore as DiceThroneStateV2 } from './domain';
