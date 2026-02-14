/**
 * 大杀四方 - 能力注册入口
 *
 * 在游戏初始化时调用 initAllAbilities() 注册所有派系能力。
 */

import { registerAlienAbilities } from './aliens';
import { registerAlienInteractionHandlers } from './aliens';
import { registerPirateAbilities } from './pirates';
import { registerPirateInteractionHandlers } from './pirates';
import { registerNinjaAbilities } from './ninjas';
import { registerNinjaInteractionHandlers } from './ninjas';
import { registerDinosaurAbilities } from './dinosaurs';
import { registerDinosaurInteractionHandlers } from './dinosaurs';
import { registerRobotAbilities } from './robots';
import { registerRobotInteractionHandlers } from './robots';
import { registerWizardAbilities, registerWizardInteractionHandlers } from './wizards';
import { registerZombieAbilities } from './zombies';
import { registerZombieInteractionHandlers } from './zombies';
import { registerTricksterAbilities } from './tricksters';
import { registerTricksterInteractionHandlers } from './tricksters';
import { registerGhostAbilities } from './ghosts';
import { registerGhostInteractionHandlers } from './ghosts';
import { registerBearCavalryAbilities } from './bear_cavalry';
import { registerBearCavalryInteractionHandlers } from './bear_cavalry';
import { registerSteampunkAbilities } from './steampunks';
import { registerSteampunkInteractionHandlers } from './steampunks';
import { registerKillerPlantAbilities, registerKillerPlantInteractionHandlers } from './killer_plants';
import { registerInnsmouthAbilities, registerInnsmouthInteractionHandlers } from './innsmouth';
import { registerMiskatonicAbilities } from './miskatonic';
import { registerMiskatonicInteractionHandlers } from './miskatonic';
import { registerCthulhuAbilities } from './cthulhu';
import { registerCthulhuInteractionHandlers } from './cthulhu';
import { registerElderThingAbilities } from './elder_things';
import { registerElderThingInteractionHandlers } from './elder_things';
import { registerBaseAbilities, registerBaseInteractionHandlers } from '../domain/baseAbilities';
import { registerMultiBaseScoringInteractionHandler } from '../domain/index';
import { registerAllOngoingModifiers } from './ongoing_modifiers';
import { clearPowerModifierRegistry } from '../domain/ongoingModifiers';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { clearDiscardPlayProviders } from '../domain/discardPlayability';

let initialized = false;

/** 注册所有派系能力（幂等，多次调用安全） */
export function initAllAbilities(): void {
    if (initialized) return;
    initialized = true;

    // 基础?8 派系
    registerAlienAbilities();
    registerAlienInteractionHandlers();
    registerPirateAbilities();
    registerPirateInteractionHandlers();
    registerNinjaAbilities();
    registerNinjaInteractionHandlers();
    registerDinosaurAbilities();
    registerDinosaurInteractionHandlers();
    registerRobotAbilities();
    registerRobotInteractionHandlers();
    registerWizardAbilities();
    registerWizardInteractionHandlers();
    registerZombieAbilities();
    registerZombieInteractionHandlers();
    registerTricksterAbilities();
    registerTricksterInteractionHandlers();

    // 基地能力
    registerBaseAbilities();
    registerBaseInteractionHandlers();

    // 多基地计分 Prompt 继续函数
    registerMultiBaseScoringInteractionHandler();

    // 扩展派系
    registerGhostAbilities();
    registerGhostInteractionHandlers();
    registerBearCavalryAbilities();
    registerBearCavalryInteractionHandlers();
    registerSteampunkAbilities();
    registerSteampunkInteractionHandlers();
    registerKillerPlantAbilities();
    registerKillerPlantInteractionHandlers();

    // 克苏鲁扩展?
    registerInnsmouthAbilities();
    registerInnsmouthInteractionHandlers();
    registerMiskatonicAbilities();
    registerMiskatonicInteractionHandlers();
    registerCthulhuAbilities();
    registerCthulhuInteractionHandlers();
    registerElderThingAbilities();
    registerElderThingInteractionHandlers();

    // 持续力量修正
    registerAllOngoingModifiers();
}

/** 重置初始化状态（测试用） */
export function resetAbilityInit(): void {
    initialized = false;
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearDiscardPlayProviders();
}
