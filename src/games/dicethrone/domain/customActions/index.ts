import { registerArtificerCustomActions } from './artificer';
import { registerBarbarianCustomActions } from './barbarian';
import { registerCommonCustomActions } from './common';
import { registerGunslingerCustomActions } from './gunslinger';
import { registerMonkCustomActions } from './monk';
import { registerMoonElfCustomActions } from './moon_elf';
import { registerPaladinCustomActions } from './paladin';
import { registerPyromancerCustomActions } from './pyromancer';
import { registerSamuraiCustomActions } from './samurai';
import { registerShadowThiefCustomActions } from './shadow_thief';
import { registerTreantCustomActions } from './treant';
import { registerNinjaCustomActions } from './ninja';
import { registerZhanshujiaCustomActions } from './zhanshujia';
import { registerCursedPirateCustomActions } from './cursed_pirate';
import { registerTianshiCustomActions } from './tianshi';
import { registerLierenCustomActions } from './lieren';
import { registerVampireLordCustomActions } from './vampire_lord';

let initialized = false;

/**
 * 初始化所有 Custom Action 处理器。
 * 保证只注册一次，避免测试和热更新时重复覆盖。
 */
export function initializeCustomActions(): void {
    if (initialized) {
        return;
    }

    registerCommonCustomActions();
    registerArtificerCustomActions();
    registerMonkCustomActions();
    registerBarbarianCustomActions();
    registerPyromancerCustomActions();
    registerMoonElfCustomActions();
    registerShadowThiefCustomActions();
    registerPaladinCustomActions();
    registerGunslingerCustomActions();
    registerSamuraiCustomActions();
    registerTreantCustomActions();
    registerNinjaCustomActions();
    registerZhanshujiaCustomActions();
    registerCursedPirateCustomActions();
    registerTianshiCustomActions();
    registerLierenCustomActions();
    registerVampireLordCustomActions();

    initialized = true;
}

export { registerArtificerCustomActions } from './artificer';
export { registerCommonCustomActions } from './common';
export { registerMonkCustomActions } from './monk';
export { registerBarbarianCustomActions } from './barbarian';
export { registerPyromancerCustomActions } from './pyromancer';
export { registerMoonElfCustomActions } from './moon_elf';
export { registerShadowThiefCustomActions } from './shadow_thief';
export { registerPaladinCustomActions } from './paladin';
export { registerGunslingerCustomActions } from './gunslinger';
export { registerSamuraiCustomActions } from './samurai';
export { registerTreantCustomActions } from './treant';
export { registerNinjaCustomActions } from './ninja';
export { registerZhanshujiaCustomActions } from './zhanshujia';
export { registerCursedPirateCustomActions } from './cursed_pirate';
export { registerTianshiCustomActions } from './tianshi';
export { registerLierenCustomActions } from './lieren';
export { registerVampireLordCustomActions } from './vampire_lord';
