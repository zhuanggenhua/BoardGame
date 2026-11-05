/** 蜘蛛侠可主动使用的被动动作 */

import type { PassiveAbilityDef } from '../../domain/passiveAbility';
import { TOKEN_IDS } from '../../domain/ids';

export const ZHIZHUXIA_PASSIVE_ABILITIES: PassiveAbilityDef[] = [
    {
        id: 'zhizhuxia-combo',
        nameKey: 'passive.zhizhuxiaCombo.name',
        actions: [
            {
                type: 'custom',
                labelKey: 'passive.zhizhuxiaCombo.useShort',
                cpCost: 0,
                tokenCost: { tokenId: TOKEN_IDS.COMBO, amount: 1 },
                timing: 'responseWindow',
                descriptionKey: 'passive.zhizhuxiaCombo.use',
                customActionId: 'zhizhuxia-combo-extra-attack',
                oncePerTurnKey: 'zhizhuxia-combo-extra-attack',
                requiresCurrentAttackDamageDealt: true,
                showWhenUnavailable: true,
            },
        ],
    },
];
