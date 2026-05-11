import type { PassiveAbilityDef } from '../../domain/passiveAbility';
import type { TokenDef } from '../../domain/tokenTypes';
import { DICETHRONE_STATUS_ATLAS_IDS, TOKEN_IDS } from '../../domain/ids';

const tokenText = (id: string, field: 'name' | 'description') => `tokens.${id}.${field}`;

export const TREANT_TOKENS: TokenDef[] = [
    {
        id: TOKEN_IDS.TREANT_SEEDLING,
        name: tokenText(TOKEN_IDS.TREANT_SEEDLING, 'name'),
        colorTheme: 'from-lime-500 to-emerald-500',
        description: tokenText(TOKEN_IDS.TREANT_SEEDLING, 'description') as unknown as string[],
        stackLimit: 3,
        category: 'consumable',
        frameId: 'treant_seedling',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.TREANT,
    },
    {
        id: TOKEN_IDS.TREANT_SAPLING,
        name: tokenText(TOKEN_IDS.TREANT_SAPLING, 'name'),
        colorTheme: 'from-green-500 to-teal-500',
        description: tokenText(TOKEN_IDS.TREANT_SAPLING, 'description') as unknown as string[],
        stackLimit: 2,
        category: 'consumable',
        frameId: 'treant_sapling',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.TREANT,
    },
    {
        id: TOKEN_IDS.TREANT_DIVINE,
        name: tokenText(TOKEN_IDS.TREANT_DIVINE, 'name'),
        colorTheme: 'from-yellow-300 to-lime-500',
        description: tokenText(TOKEN_IDS.TREANT_DIVINE, 'description') as unknown as string[],
        stackLimit: 1,
        category: 'consumable',
        activeUse: {
            timing: ['beforeDamageDealt'],
            consumeAmount: 1,
            effect: { type: 'modifyDamageDealt', value: 3 },
        },
        frameId: 'treant_divine',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.TREANT,
    },
    {
        id: TOKEN_IDS.LIFE_SAP,
        name: tokenText(TOKEN_IDS.LIFE_SAP, 'name'),
        colorTheme: 'from-cyan-300 to-blue-500',
        description: tokenText(TOKEN_IDS.LIFE_SAP, 'description') as unknown as string[],
        stackLimit: 1,
        category: 'buff',
        frameId: 'life_sap',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.TREANT,
    },
    {
        id: TOKEN_IDS.THORN,
        name: tokenText(TOKEN_IDS.THORN, 'name'),
        colorTheme: 'from-red-600 to-rose-700',
        description: tokenText(TOKEN_IDS.THORN, 'description') as unknown as string[],
        stackLimit: 1,
        category: 'debuff',
        frameId: 'thorn',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.TREANT,
    },
];


export const TREANT_PASSIVE_ABILITIES: PassiveAbilityDef[] = [
    {
        id: 'treant-seedling-cultivation',
        nameKey: 'passive.treantSeedling.name',
        actions: [
            {
                type: 'rerollDie',
                labelKey: 'passive.treantSeedling.rerollShort',
                cpCost: 0,
                tokenCost: { tokenId: TOKEN_IDS.TREANT_SEEDLING, amount: 1 },
                timing: 'ownRollPhase',
                descriptionKey: 'passive.treantSeedling.reroll',
            },
        ],
    },
    {
        id: 'treant-sapling-cultivation',
        nameKey: 'passive.treantSapling.name',
        actions: [
            {
                type: 'custom',
                labelKey: 'passive.treantSapling.healCpShort',
                cpCost: 0,
                tokenCost: { tokenId: TOKEN_IDS.TREANT_SAPLING, amount: 1 },
                timing: 'ownMainPhase',
                descriptionKey: 'passive.treantSapling.healCp',
                customActionId: 'treant-sapling-heal-cp',
            },
            {
                type: 'custom',
                labelKey: 'passive.treantSapling.drawShort',
                cpCost: 1,
                tokenCost: { tokenId: TOKEN_IDS.TREANT_SAPLING, amount: 1 },
                timing: 'ownMainPhase',
                descriptionKey: 'passive.treantSapling.draw',
                customActionId: 'treant-sapling-draw',
            },
        ],
    },
    {
        id: 'treant-life-sap',
        nameKey: 'passive.treantLifeSap.name',
        actions: [
            {
                type: 'custom',
                labelKey: 'passive.treantLifeSap.rollHealShort',
                cpCost: 0,
                tokenCost: { tokenId: TOKEN_IDS.LIFE_SAP, amount: 1 },
                timing: 'ownMainPhase',
                descriptionKey: 'passive.treantLifeSap.rollHeal',
                customActionId: 'treant-life-sap-use',
            },
        ],
    },
];

export const TREANT_INITIAL_TOKENS: Record<string, number> = {
    [TOKEN_IDS.TREANT_SEEDLING]: 0,
    [TOKEN_IDS.TREANT_SAPLING]: 0,
    [TOKEN_IDS.TREANT_DIVINE]: 0,
    [TOKEN_IDS.LIFE_SAP]: 0,
    [TOKEN_IDS.THORN]: 0,
};
