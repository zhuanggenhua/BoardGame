/**
 * 大杀四方 - 能力注册入口
 *
 * 在游戏初始化时调用 initAllAbilities() 注册所有派系能力。
 */

import { registerAlienAbilities } from './aliens';
import { registerPirateAbilities } from './pirates';
import { registerPirateInteractionHandlers } from './pirates';
import { registerNinjaAbilities } from './ninjas';
import { registerNinjaInteractionHandlers } from './ninjas';
import { registerDinosaurAbilities } from './dinosaurs';
import { registerRobotAbilities } from './robots';
import { registerWizardAbilities } from './wizards';
import { registerZombieAbilities } from './zombies';
import { registerTricksterAbilities } from './tricksters';
import { registerTricksterInteractionHandlers } from './tricksters';
import { registerGhostAbilities } from './ghosts';
import { registerBearCavalryAbilities } from './bear_cavalry';
import { registerBearCavalryInteractionHandlers } from './bear_cavalry';
import { registerSteampunkAbilities } from './steampunks';
import { registerKillerPlantAbilities } from './killer_plants';
import { registerInnsmouthAbilities } from './innsmouth';
import { registerMiskatonicAbilities } from './miskatonic';
import { registerMiskatonicInteractionHandlers } from './miskatonic';
import { registerCthulhuAbilities } from './cthulhu';
import { registerElderThingAbilities } from './elder_things';
import { registerElderThingInteractionHandlers } from './elder_things';
import { registerFrankensteinAbilities } from './frankenstein';
import { registerWerewolfAbilities } from './werewolves';
import { registerVampireAbilities, registerVampireInteractionHandlers } from './vampires';
import { registerGiantAntAbilities, registerGiantAntInteractionHandlers } from './giant_ants';
import { registerFairiesAbilities } from './fairies';
import { registerAncientEgyptiansAbilities } from './ancient_egyptians';
import { registerCowboysAbilities, registerCowboysInteractionHandlers } from './cowboys';
import { registerSamuraiAbilities, registerSamuraiInteractionHandlers } from './samurai';
import { registerVikingsAbilities, registerVikingsInteractionHandlers } from './vikings';
import { registerTitanAbilities, registerTitanInteractionHandlers } from './titans';
import { registerWorldChampsAbilities, registerWorldChampsInteractionHandlers } from './world_champs';
import { registerSkeletonAbilities, registerSkeletonInteractionHandlers } from './skeletons';
import { registerMermaidsAbilities, registerMermaidsInteractionHandlers } from './mermaids';
import { registerPrincessesAbilities } from './princesses';
import { registerSharksAbilities } from './sharks';
import { registerTornadosAbilities } from './tornados';
import { registerMythicGreeksAbilities } from './mythic_greeks';
import { registerYuanhouAbilities } from './yuanhou';
import { registerBuryInteractionHandlers } from '../domain/bury';
import {
    registerBaseAbilities,
    registerBaseInteractionHandlers,
    clearBaseAbilityRegistry,
    registerPodBaseAbilityAliases,
} from '../domain/baseAbilities';
import { registerMultiBaseScoringInteractionHandler } from '../domain/index';
import { registerDuelInteractionHandlers } from '../domain/duel';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { registerMulliganInteractionHandlers } from '../domain/mulliganHandlers';
import { registerAllOngoingModifiers } from './ongoing_modifiers';
import { clearPowerModifierRegistry, registerPodPowerModifierAliases } from '../domain/ongoingModifiers';
import { clearOngoingEffectRegistry, registerPodOngoingAliases } from '../domain/ongoingEffects';
import { clearDiscardPlayProviders } from '../domain/discardPlayability';
import { clearDiscardSpecialProviders } from '../domain/discardSpecialAbilities';
import { clearRegistry, registerPodAbilityAliases } from '../domain/abilityRegistry';
import { clearInteractionHandlers, registerPodInteractionAliases } from '../domain/abilityInteractionHandlers';
import { clearTitanAbilityValidators } from '../domain/titanAbilityValidators';

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
    clearDiscardSpecialProviders();
    clearTitanAbilityValidators();

    // 基础?8 派系
    registerAlienAbilities();
    registerPirateAbilities();
    registerPirateInteractionHandlers();
    registerNinjaAbilities();
    registerNinjaInteractionHandlers();
    registerDinosaurAbilities();
    registerRobotAbilities();
    registerWizardAbilities();
    registerZombieAbilities();
    registerTricksterAbilities();
    registerTricksterInteractionHandlers();

    // 基地能力
    registerBaseAbilities();
    registerBaseInteractionHandlers();

    // 多基地计分 Prompt 继续函数
    registerMultiBaseScoringInteractionHandler();

    // 全局反应队列（同时触发排序）
    registerReactionQueueInteractionHandlers();
    registerMulliganInteractionHandlers();
    registerBuryInteractionHandlers();
    registerDuelInteractionHandlers();

    // 扩展派系
    registerGhostAbilities();
    registerBearCavalryAbilities();
    registerBearCavalryInteractionHandlers();
    registerSteampunkAbilities();
    registerKillerPlantAbilities();

    // 克苏鲁扩展?
    registerInnsmouthAbilities();
    registerMiskatonicAbilities();
    registerMiskatonicInteractionHandlers();
    registerCthulhuAbilities();
    registerElderThingAbilities();
    registerElderThingInteractionHandlers();

    // Monster Smash 扩展
    registerFrankensteinAbilities();
    registerWerewolfAbilities();
    registerVampireAbilities();
    registerVampireInteractionHandlers();
    registerGiantAntAbilities();
    registerGiantAntInteractionHandlers();
    registerFairiesAbilities();
    registerAncientEgyptiansAbilities();
    registerCowboysAbilities();
    registerCowboysInteractionHandlers();
    registerSamuraiAbilities();
    registerSamuraiInteractionHandlers();
    registerVikingsAbilities();
    registerVikingsInteractionHandlers();
    registerSkeletonAbilities();
    registerSkeletonInteractionHandlers();
    registerMermaidsAbilities();
    registerMermaidsInteractionHandlers();
    registerWorldChampsAbilities();
    registerWorldChampsInteractionHandlers();
    registerPrincessesAbilities();
    registerSharksAbilities();
    registerTornadosAbilities();
    registerMythicGreeksAbilities();
    registerYuanhouAbilities();
    registerTitanAbilities();
    registerTitanInteractionHandlers();

    // 持续力量修正
    registerAllOngoingModifiers();

    // === POD 版本能力别名注册 ===
    // 将所有基础版卡牌能力和交互处理回调自动复制给对应的 _pod 版本
    // 不需为每张 POD 卡单独写一行能力代码就能让其自动接继基础版的全套逻辑
    registerPodAbilityAliases();
    registerPodInteractionAliases();
    registerPodBaseAbilityAliases();
    registerPodOngoingAliases(); // 自动映射 trigger/restriction/protection
    registerPodPowerModifierAliases(); // 自动映射力量修正
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
    clearTitanAbilityValidators();
}
