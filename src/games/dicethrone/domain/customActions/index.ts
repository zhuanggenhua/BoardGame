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

    initialized = true;
}

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
