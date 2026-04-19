import type { TokenDef } from '../../domain/tokenTypes';
import { DICETHRONE_STATUS_ATLAS_IDS, STATUS_IDS, TOKEN_IDS } from '../../domain/ids';
import { RESOURCE_IDS } from '../../domain/resources';

export const GUNSLINGER_TOKENS: TokenDef[] = [
    {
        id: TOKEN_IDS.EVASIVE,
        name: '闪避',
        colorTheme: 'from-cyan-500 to-blue-500',
        description: [
            '受到伤害时可消耗 1 个闪避并掷 1 颗骰子。',
            '结果为 1-2 时，本次伤害变为 0。',
            '同一次攻击中可以连续消耗多个闪避重试。',
        ],
        sfxKey: 'magic.general.simple_magic_sound_fx_pack_vol.ice.glacial_shield',
        stackLimit: 3,
        category: 'consumable',
        activeUse: {
            timing: ['beforeDamageReceived'],
            consumeAmount: 1,
            effect: {
                type: 'rollToNegate',
                rollSuccess: { range: [1, 2] },
            },
        },
        frameId: 'dodge',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.MONK,
    },
    {
        id: STATUS_IDS.KNOCKDOWN,
        name: '击倒',
        colorTheme: 'from-red-600 to-orange-500',
        description: [
            '攻击掷骰阶段前可以花费 2 CP 移除此状态。',
            '若不移除，则必须跳过攻击掷骰阶段，然后移除此状态。',
        ],
        sfxKey: 'fantasy.medieval_fantasy_sound_fx_pack_vol.weapons.pot_explosion',
        stackLimit: 1,
        category: 'debuff',
        passiveTrigger: {
            timing: 'onPhaseEnter',
            removable: true,
            removalCost: { resource: RESOURCE_IDS.CP, amount: 2 },
        },
        frameId: 'knockdown',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.MONK,
    },
    {
        id: TOKEN_IDS.LOADED,
        name: '装填',
        colorTheme: 'from-amber-500 to-orange-500',
        description: [
            '攻击掷骰阶段结束时可消耗 1 个装填并掷 1 颗骰子。',
            '将骰值的一半向上取整，作为本次攻击的额外伤害。',
        ],
        sfxKey: 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a',
        stackLimit: 2,
        category: 'consumable',
        activeUse: {
            timing: ['onOffensiveRollEnd'],
            consumeAmount: 1,
            effect: {
                type: 'modifyDamageDealt',
                value: 0,
            },
            customActionId: 'gunslinger-loaded-use',
        },
        frameId: TOKEN_IDS.LOADED,
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.GUNSLINGER,
    },
    {
        id: TOKEN_IDS.BOUNTY,
        name: '赏金',
        colorTheme: 'from-yellow-500 to-amber-600',
        description: [
            '持有赏金的玩家受到攻击伤害时，伤害 +1。',
            '攻击者额外获得 1 CP。',
            '赏金不会自动移除。',
        ],
        iconPath: 'dicethrone/images/gunslinger/icons/赏金',
        sfxKey: 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a',
        stackLimit: 1,
        category: 'debuff',
        passiveTrigger: {
            timing: 'onDamageReceived',
            damageTriggerScope: 'opponentAttackDamage',
            removable: false,
            actions: [
                { type: 'modifyStat', target: 'self', value: 1 },
                { type: 'custom', target: 'self', customActionId: 'gunslinger-bounty-reward' },
            ],
        },
        frameId: TOKEN_IDS.BOUNTY,
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.GUNSLINGER,
    },
];

export const GUNSLINGER_INITIAL_TOKENS: Record<string, number> = {
    [TOKEN_IDS.EVASIVE]: 0,
    [STATUS_IDS.KNOCKDOWN]: 0,
    [TOKEN_IDS.LOADED]: 0,
    [TOKEN_IDS.BOUNTY]: 0,
};
