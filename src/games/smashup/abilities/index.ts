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
import { registerFrankensteinAbilities, registerFrankensteinInteractionHandlers } from './frankenstein';
import { registerWerewolfAbilities, registerWerewolfInteractionHandlers } from './werewolves';
import { registerVampireAbilities, registerVampireInteractionHandlers } from './vampires';
import { registerGiantAntAbilities, registerGiantAntInteractionHandlers } from './giant_ants';
import { registerBaseAbilities, registerBaseInteractionHandlers, clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { registerMultiBaseScoringInteractionHandler } from '../domain/index';
import { registerAllOngoingModifiers } from './ongoing_modifiers';
import { clearPowerModifierRegistry } from '../domain/ongoingModifiers';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { clearDiscardPlayProviders } from '../domain/discardPlayability';
import { clearRegistry, registerPodAbilityAliases } from '../domain/abilityRegistry';
import { clearInteractionHandlers, registerPodInteractionAliases } from '../domain/abilityInteractionHandlers';

let initialized = false;

/** 注册所有派系能力（幂等，多次调用安全） */
export function initAllAbilities(): void {
    if (initialized) return;
    initialized = true;

    // HMR 安全：先清除所有注册表，防止模块热更新时 initialized 被重置但注册表保留旧数据
    clearRegistry();
    clearInteractionHandlers();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearDiscardPlayProviders();

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

    // Monster Smash 扩展
    registerFrankensteinAbilities();
    registerFrankensteinInteractionHandlers();
    registerWerewolfAbilities();
    registerWerewolfInteractionHandlers();
    registerVampireAbilities();
    registerVampireInteractionHandlers();
    registerGiantAntAbilities();
    registerGiantAntInteractionHandlers();

    // 持续力量修正
    registerAllOngoingModifiers();

    // === POD 版本能力别名注册 ===
    // 将所有基础版卡牌能力和交互处理回调自动复制给对应的 _pod 版本
    // 不需为每张 POD 卡单独写一行能力代码就能让其自动接继基础版的全套逻辑
    registerPodAbilityAliases();
    registerPodInteractionAliases();
}

/** 重置初始化状态（测试用） */
export function resetAbilityInit(): void {
    initialized = false;
    clearRegistry();
    clearInteractionHandlers();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearDiscardPlayProviders();
}
