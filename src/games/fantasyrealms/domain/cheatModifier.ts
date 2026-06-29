import type { CheatResourceModifier } from '../../../engine/systems/CheatSystem';
import type { FantasyRealmsCore } from './types';

// Fantasy Realms 当前教程只依赖共享 CheatSystem 的 MERGE_STATE。
// 这里提供最小 modifier，把系统挂活；后续若需要调试资源/发牌能力，再在此扩展。
export const fantasyRealmsCheatModifier: CheatResourceModifier<FantasyRealmsCore> = {
    getResource: () => undefined,
    setResource: (core) => core,
};

export default fantasyRealmsCheatModifier;
