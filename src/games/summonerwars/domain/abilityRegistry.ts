import type { AbilityDef, AbilityTrigger } from './abilityTypes';
import { AbilityRegistry } from '../../../engine/primitives/ability';

/**
 * 技能注册表
 *
 * 使用引擎层通用 AbilityRegistry 替代自建实现，
 * 获得 has/getByTag/getRegisteredIds 等能力。
 *
 * 注：SW 的 AbilityDef 与引擎层 AbilityDef 的 condition/cost 类型不兼容，
 * 因此使用 `as any` 实例化。运行时行为完全一致（registry 内部只用 id/trigger/tags）。
 */
export type SWAbilityRegistry = {
    register(def: AbilityDef): void;
    registerAll(defs: AbilityDef[]): void;
    get(id: string): AbilityDef | undefined;
    has(id: string): boolean;
    getAll(): AbilityDef[];
    getByTag(tag: string): AbilityDef[];
    getByTrigger(trigger: AbilityTrigger): AbilityDef[];
    getRegisteredIds(): Set<string>;
    readonly size: number;
    clear(): void;
};

export const abilityRegistry = new AbilityRegistry('sw-abilities') as unknown as SWAbilityRegistry;
