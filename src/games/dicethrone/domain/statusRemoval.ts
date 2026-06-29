import type { DiceThroneCore } from './types';
import type { TokenDef } from './tokenTypes';

const findTokenDefinition = (state: DiceThroneCore, statusId: string): TokenDef | undefined =>
    (state.tokenDefinitions ?? []).find((definition) => definition.id === statusId);

export const isRemovableStatusId = (state: DiceThroneCore, statusId: string): boolean => {
    const def = findTokenDefinition(state, statusId);
    return def?.passiveTrigger?.removable ?? true;
};

export const isPurifiableDebuffId = (state: DiceThroneCore, statusId: string): boolean => {
    const def = findTokenDefinition(state, statusId);
    return def?.category === 'debuff' && isRemovableStatusId(state, statusId);
};
