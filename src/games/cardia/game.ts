import { createGameEngine, createBaseSystems, createFlowSystem, createCheatSystem } from '../../engine';
import { CardiaDomain } from './domain';
import cardRegistry from './domain/cardRegistry';
import type { CardiaCore, CardiaCommand, CardiaEvent } from './domain/types';
import { cardiaFlowHooks } from './domain/flowHooks';
import { cardiaCheatModifier } from './domain/cheatModifier';
import { CARDIA_COMMANDS } from './domain/commands';
import { createCardiaEventSystem } from './domain/systems';
import { INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';

// 注册游戏资源（必须在游戏引擎创建前执行）
import './assets';

// 导入所有能力组以注册执行器（必须在游戏引擎创建前执行）
import './domain/abilities/group1-resources';
import { registerResourceInteractionHandlers } from './domain/abilities/group1-resources';
import './domain/abilities/group2-modifiers';
import { registerModifierInteractionHandlers } from './domain/abilities/group2-modifiers';
import './domain/abilities/group3-ongoing';
import './domain/abilities/group4-card-ops';
import { registerCardOpsInteractionHandlers } from './domain/abilities/group4-card-ops';
import './domain/abilities/group5-copy';
import { registerCopyInteractionHandlers } from './domain/abilities/group5-copy';
import './domain/abilities/group6-special';
import { registerSpecialInteractionHandlers } from './domain/abilities/group6-special';
import './domain/abilities/group7-faction';
import { registerFactionInteractionHandlers } from './domain/abilities/group7-faction';

// 注册交互处理函数
registerResourceInteractionHandlers();
registerModifierInteractionHandlers();
registerCardOpsInteractionHandlers();
registerCopyInteractionHandlers();
registerSpecialInteractionHandlers();
registerFactionInteractionHandlers();

/**
 * 系统组装
 */
const systems = [
    createFlowSystem<CardiaCore>({ hooks: cardiaFlowHooks }),
    ...createBaseSystems<CardiaCore>(),
    createCardiaEventSystem(),
    createCheatSystem<CardiaCore>(cardiaCheatModifier),
];

/**
 * 命令类型列表
 * 注意：系统命令需要显式添加（INTERACTION_COMMANDS 等）
 */
const commandTypes = [
    ...Object.values(CARDIA_COMMANDS),
    ...Object.values(INTERACTION_COMMANDS),
];

/**
 * 游戏适配器
 */
export const Cardia = createGameEngine<CardiaCore, CardiaCommand, CardiaEvent>({
    domain: CardiaDomain,
    systems,
    minPlayers: 2,
    maxPlayers: 2,
    commandTypes,
});

// 引擎配置（用于服务端注册）
export const engineConfig = Cardia;

// 暴露 cardRegistry 到 window 对象（用于 E2E 测试）
if (typeof window !== 'undefined') {
    (window as any).__BG_CARD_REGISTRY__ = cardRegistry;
}

export default Cardia;
