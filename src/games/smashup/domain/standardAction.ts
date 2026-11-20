import type { ActionCardDef, CardDef } from './types';

/** 规则中的标准行动不包括打出后进入场上的行动。 */
export function isRulesStandardAction(def: CardDef | undefined): def is ActionCardDef {
    return def?.type === 'action' && def.subtype === 'standard' && !def.entersPlayOnPlay;
}
