import type { PassiveAbilityDef } from '../../domain/passiveAbility';
import type { TokenDef } from '../../domain/tokenTypes';
import { DICETHRONE_STATUS_ATLAS_IDS, STATUS_IDS, TOKEN_IDS } from '../../domain/ids';
import { ZHANSHUJIA_SFX_COMMAND, ZHANSHUJIA_SFX_LIGHT } from './abilities';

const tokenText = (id: string, field: 'name' | 'description') => `tokens.${id}.${field}`;
const statusText = (id: string, field: 'name' | 'description') => `statusEffects.${id}.${field}`;

export const ZHANSHUJIA_TOKENS: TokenDef[] = [
    {
        id: TOKEN_IDS.TACTICAL_ADVANTAGE,
        name: tokenText(TOKEN_IDS.TACTICAL_ADVANTAGE, 'name'),
        colorTheme: 'from-amber-300 to-orange-500',
        description: tokenText(TOKEN_IDS.TACTICAL_ADVANTAGE, 'description') as unknown as string[],
        iconPath: 'dicethrone/images/zhanshujia/status/战术优势',
        stackLimit: 5,
        category: 'consumable',
        sfxKey: ZHANSHUJIA_SFX_COMMAND,
        frameId: 'tactical_advantage',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.ZHANSHUJIA,
    },
    {
        id: STATUS_IDS.BIND,
        name: statusText(STATUS_IDS.BIND, 'name'),
        colorTheme: 'from-stone-500 to-zinc-800',
        description: statusText(STATUS_IDS.BIND, 'description') as unknown as string[],
        iconPath: 'dicethrone/images/zhanshujia/status/紧缚',
        stackLimit: 1,
        category: 'debuff',
        sfxKey: ZHANSHUJIA_SFX_LIGHT,
        passiveTrigger: {
            timing: 'onPhaseEnter',
            removable: true,
            actions: [],
        },
        frameId: 'bind',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.ZHANSHUJIA,
    },
];

export const ZHANSHUJIA_PASSIVE_ABILITIES: PassiveAbilityDef[] = [
    {
        id: 'zhanshujia-tactical-advantage',
        nameKey: 'passive.zhanshujiaTacticalAdvantage.name',
        actions: [
            {
                type: 'custom',
                labelKey: 'passive.zhanshujiaTacticalAdvantage.cpShort',
                cpCost: 0,
                tokenCost: { tokenId: TOKEN_IDS.TACTICAL_ADVANTAGE, amount: 1 },
                timing: 'anytime',
                descriptionKey: 'passive.zhanshujiaTacticalAdvantage.cp',
                customActionId: 'zhanshujia-tactical-advantage-gain-cp',
            },
            {
                type: 'rerollDie',
                labelKey: 'passive.zhanshujiaTacticalAdvantage.rerollShort',
                cpCost: 0,
                tokenCost: { tokenId: TOKEN_IDS.TACTICAL_ADVANTAGE, amount: 1 },
                timing: 'anytime',
                allowConfirmedRollInterference: true,
                descriptionKey: 'passive.zhanshujiaTacticalAdvantage.reroll',
            },
            {
                type: 'drawCard',
                labelKey: 'passive.zhanshujiaTacticalAdvantage.drawShort',
                cpCost: 0,
                tokenCost: { tokenId: TOKEN_IDS.TACTICAL_ADVANTAGE, amount: 3 },
                timing: 'anytime',
                descriptionKey: 'passive.zhanshujiaTacticalAdvantage.draw',
            },
            {
                type: 'custom',
                labelKey: 'passive.zhanshujiaTacticalAdvantage.targetedShort',
                cpCost: 0,
                tokenCost: { tokenId: TOKEN_IDS.TACTICAL_ADVANTAGE, amount: 3 },
                timing: 'anytime',
                descriptionKey: 'passive.zhanshujiaTacticalAdvantage.targeted',
                customActionId: 'zhanshujia-tactical-advantage-apply-targeted',
            },
            {
                type: 'custom',
                labelKey: 'passive.zhanshujiaTacticalAdvantage.protectShort',
                cpCost: 0,
                tokenCost: { tokenId: TOKEN_IDS.TACTICAL_ADVANTAGE, amount: 4 },
                timing: 'anytime',
                descriptionKey: 'passive.zhanshujiaTacticalAdvantage.protect',
                customActionId: 'zhanshujia-tactical-advantage-grant-protect',
            },
            {
                type: 'custom',
                labelKey: 'passive.zhanshujiaTacticalAdvantage.transferShort',
                cpCost: 0,
                tokenCost: { tokenId: TOKEN_IDS.TACTICAL_ADVANTAGE, amount: 4 },
                timing: 'ownMainPhase',
                descriptionKey: 'passive.zhanshujiaTacticalAdvantage.transfer',
                customActionId: 'transfer-status',
            },
        ],
    },
];

export const ZHANSHUJIA_INITIAL_TOKENS: Record<string, number> = {
    [TOKEN_IDS.TACTICAL_ADVANTAGE]: 2,
    [STATUS_IDS.BIND]: 0,
};
