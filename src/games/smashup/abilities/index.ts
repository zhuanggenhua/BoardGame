/**
 * 大杀四方 - 能力注册入口
 *
 * 在游戏初始化时调用 initAllAbilities() 注册所有派系能力。
 */

import { registerAlienAbilities } from './aliens';
import { registerAlienPromptContinuations } from './aliens';
import { registerPirateAbilities } from './pirates';
import { registerNinjaAbilities } from './ninjas';
import { registerDinosaurAbilities } from './dinosaurs';
import { registerRobotAbilities } from './robots';
import { registerWizardAbilities } from './wizards';
import { registerZombieAbilities } from './zombies';
import { registerTricksterAbilities } from './tricksters';
import { registerGhostAbilities } from './ghosts';
import { registerBearCavalryAbilities } from './bear_cavalry';
import { registerSteampunkAbilities } from './steampunks';
import { registerKillerPlantAbilities } from './killer_plants';
import { registerInnsmouthAbilities } from './innsmouth';
import { registerMiskatonicAbilities } from './miskatonic';
import { registerMiskatonicPromptContinuations } from './miskatonic';
import { registerCthulhuAbilities } from './cthulhu';
import { registerBaseAbilities } from '../domain/baseAbilities';
import { registerMultiBaseScoringContinuation } from '../domain/index';

let initialized = false;

/** 注册所有派系能力（幂等，多次调用安全） */
export function initAllAbilities(): void {
    if (initialized) return;
    initialized = true;

    // 基础版 8 派系
    registerAlienAbilities();
    registerAlienPromptContinuations();
    registerPirateAbilities();
    registerNinjaAbilities();
    registerDinosaurAbilities();
    registerRobotAbilities();
    registerWizardAbilities();
    registerZombieAbilities();
    registerTricksterAbilities();

    // 基地能力
    registerBaseAbilities();

    // 多基地计分 Prompt 继续函数
    registerMultiBaseScoringContinuation();

    // 扩展派系
    registerGhostAbilities();
    registerBearCavalryAbilities();
    registerSteampunkAbilities();
    registerKillerPlantAbilities();

    // 克苏鲁扩展
    registerInnsmouthAbilities();
    registerMiskatonicAbilities();
    registerMiskatonicPromptContinuations();
    registerCthulhuAbilities();

    // TODO: registerElderThingAbilities(); — 几乎全部依赖 Madness 系统
}

/** 重置初始化状态（测试用） */
export function resetAbilityInit(): void {
    initialized = false;
}
