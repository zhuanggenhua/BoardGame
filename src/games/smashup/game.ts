/**
 * 大杀四方 (Smash Up) - 游戏适配器组装
 */

import { createDefaultSystems, createGameAdapter, createFlowSystem } from '../../engine';
import { PROMPT_COMMANDS } from '../../engine/systems/PromptSystem';
import { SmashUpDomain, SU_COMMANDS, type SmashUpCommand, type SmashUpCore, type SmashUpEvent } from './domain';
import { smashUpFlowHooks } from './domain/index';
import { initAllAbilities } from './abilities';
import { createSmashUpPromptBridge } from './domain/systems';

// 注册所有派系能力
initAllAbilities();

const systems = [
    createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
    ...createDefaultSystems<SmashUpCore>(),
    createSmashUpPromptBridge(),
];

export const SmashUp = createGameAdapter<SmashUpCore, SmashUpCommand, SmashUpEvent>({
    domain: SmashUpDomain,
    systems,
    minPlayers: 2,
    maxPlayers: 4,
    commandTypes: [...Object.values(SU_COMMANDS), 'RESPONSE_PASS', PROMPT_COMMANDS.RESPOND],
});

export default SmashUp;
