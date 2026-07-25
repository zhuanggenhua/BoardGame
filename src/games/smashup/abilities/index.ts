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
import { registerKittyCatsAbilities } from './kitty_cats';
import { registerMythicHorsesAbilities } from './mythic_horses';
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
import { registerDragonAbilities } from './dragons';
import { registerGeekAbilities } from './geeks';
import { registerAllStarsAbilities, registerAllStarsInteractionHandlers } from './all_stars';
import { registerSheepAbilities, registerSheepInteractionHandlers } from './sheep';
import { registerSuperheroesAbilities, registerSuperheroesInteractionHandlers } from './superheroes';
import { registerYuanhouAbilities } from './yuanhou';
import { registerIttyCrittersAbilities } from './itty_critters';
import { registerKaijuAbilities, registerKaijuInteractionHandlers } from './kaiju';
import { registerMagicalGirlsAbilities, registerMagicalGirlsInteractionHandlers } from './magical_girls';
import { registerMegaTroopersAbilities, registerMegaTroopersInteractionHandlers } from './mega_troopers';
import { registerCeaseAndDesistAbilities } from './cease_and_desist';
import { registerHuluwawaAbilities } from './huluwawa';
import { registerPaladinAbilities } from './paladins';
import { registerZhongguoAbilities } from './zhongguo';
import { registerAvengersAbilities } from './avengers';
import { registerMarvelAbilities } from './marvel';
import { registerMarvelVillainsAbilities } from './marvel_villains';
import { registerInternationalIncidentAbilities } from './international_incident';
import { registerWhatWereWeThinkingAbilities, registerWhatWereWeThinkingInteractionHandlers } from './what_were_we_thinking';
import { registerAnansiTalesAbilities } from './anansi_tales';
import { registerGrimmsFairyTalesAbilities, registerGrimmsFairyTalesInteractionHandlers } from './grimms_fairy_tales';
import { registerRussianFairyTalesAbilities, registerRussianFairyTalesInteractionHandlers } from './russian_fairy_tales';
import { registerAncientIncasAbilities, registerAncientIncasInteractionHandlers } from './ancient_incas';
import { registerDisneyFourFactionsAbilities } from './disney_four_factions';
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
import { registerActionCounterInteractionHandlers } from '../domain/actionCounter';
import { registerMulliganInteractionHandlers } from '../domain/mulliganHandlers';
import { registerAllOngoingModifiers } from './ongoing_modifiers';
import { clearPowerModifierRegistry, registerPodPowerModifierAliases } from '../domain/ongoingModifiers';
import { clearOngoingEffectRegistry, registerPodOngoingAliases } from '../domain/ongoingEffects';
import { clearDiscardPlayProviders } from '../domain/discardPlayability';
import { clearDiscardActionPlayProviders } from '../domain/discardActionPlayability';
import { clearDiscardSpecialProviders } from '../domain/discardSpecialAbilities';
import { clearRegistry, registerPodAbilityAliases } from '../domain/abilityRegistry';
import { clearInteractionHandlers, registerPodInteractionAliases } from '../domain/abilityInteractionHandlers';
import { clearTitanAbilityValidators } from '../domain/titanAbilityValidators';
import { validateSmashUpVariantBindings } from '../domain/variantBindingValidation';

let initialized = false;

/** 注册所有派系能力（幂等，多次调用安全） */
export function initAllAbilities(): void {
    if (initialized) return;

    // HMR 安全：先清除所有注册表，防止模块热更新时 initialized 被重置但注册表保留旧数据
    clearRegistry();
    clearInteractionHandlers();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearDiscardPlayProviders();
    clearDiscardActionPlayProviders();
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
    registerActionCounterInteractionHandlers();
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
    registerKittyCatsAbilities();
    registerMythicHorsesAbilities();
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
    registerDragonAbilities();
    registerGeekAbilities();
    registerSuperheroesAbilities();
    registerSuperheroesInteractionHandlers();
    registerYuanhouAbilities();
    registerSheepAbilities();
    registerSheepInteractionHandlers();
    registerAllStarsAbilities();
    registerAllStarsInteractionHandlers();
    registerIttyCrittersAbilities();
    registerKaijuAbilities();
    registerKaijuInteractionHandlers();
    registerMagicalGirlsAbilities();
    registerMagicalGirlsInteractionHandlers();
    registerMegaTroopersAbilities();
    registerMegaTroopersInteractionHandlers();
    registerCeaseAndDesistAbilities();
    registerHuluwawaAbilities();
    registerPaladinAbilities();
    registerZhongguoAbilities();
    registerAvengersAbilities();
    registerMarvelAbilities();
    registerMarvelVillainsAbilities();
    registerInternationalIncidentAbilities();
    registerWhatWereWeThinkingAbilities();
    registerWhatWereWeThinkingInteractionHandlers();
    registerAnansiTalesAbilities();
    registerGrimmsFairyTalesAbilities();
    registerGrimmsFairyTalesInteractionHandlers();
    registerRussianFairyTalesAbilities();
    registerRussianFairyTalesInteractionHandlers();
    registerAncientIncasAbilities();
    registerAncientIncasInteractionHandlers();
    registerDisneyFourFactionsAbilities();
    registerTitanAbilities();
    registerTitanInteractionHandlers();

    // 持续力量修正
    registerAllOngoingModifiers();

    // === POD 变体绑定 ===
    // 只有 metadata 显式声明 shared 的 surface，才允许生成 _pod 运行时别名。
    registerPodAbilityAliases();
    registerPodInteractionAliases();
    registerPodBaseAbilityAliases();
    registerPodOngoingAliases();
    registerPodPowerModifierAliases();
    validateSmashUpVariantBindings();
    initialized = true;
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
    clearDiscardActionPlayProviders();
    clearTitanAbilityValidators();
}
