import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { SHADOW_THIEF_DICE_FACE_IDS, TOKEN_IDS } from '../../domain/ids';
import { abilityText, abilityEffectText } from '../../../../engine/primitives/ability';

const FACE = SHADOW_THIEF_DICE_FACE_IDS;

// 暗影盗贼音效常量 — 按技能语义分配不同音效，确保听感差异化
/** 匕首打击（标志性匕首音） */
export const SHADOW_THIEF_SFX_DAGGER = 'combat.general.khron_studio_fight_fury_vol_1_assets.knife_stab.weapknif_knife_stab_01';
/** 抢夺（快速匕首变体） */
export const SHADOW_THIEF_SFX_PICKPOCKET = 'combat.general.khron_studio_fight_fury_vol_1_assets.knife_stab.weapknif_knife_stab_02';
/** 偷窃（偷钱音效） */
export const SHADOW_THIEF_SFX_STEAL = 'coins.decks_and_cards_sound_fx_pack.small_coin_drop_001';
/** 破隐一击（重匕首音） */
export const SHADOW_THIEF_SFX_KIDNEY = 'combat.general.khron_studio_fight_fury_vol_1_assets.knife_stab.weapknif_knife_stab_03';
/** 聚宝盆（战利品音效） */
export const SHADOW_THIEF_SFX_LOOT = 'coins.decks_and_cards_sound_fx_pack.big_coin_drop_001';
/** 暗影之舞 */
export const SHADOW_THIEF_SFX_SHADOW = 'magic.general.simple_magic_sound_fx_pack_vol.dark.shadow_bolt_impact_a';
/** 大招（暗影突刺） */
export const SHADOW_THIEF_SFX_ULTIMATE = 'magic.general.spells_variations_vol_1.shadowstrike_beam.magspel_shadowstrike_beam_01_krst';

// 辅助函数
const damage = (value: number | string, description: string): AbilityEffect => ({
    description,
    action: { type: 'damage', target: 'opponent', value: typeof value === 'number' ? value : 0 },
});

const grantToken = (tokenId: string, value: number, description: string, opts?: { timing?: EffectTiming }): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target: 'self', tokenId, value },
    timing: opts?.timing ?? 'postDamage',
});

const gainCp = (value: number, description: string): AbilityEffect => ({
    description,
    action: { type: 'custom', target: 'self', customActionId: 'gain-cp', params: { amount: value } },
});

// ============================================================================
// Level 1 Abilities
// ============================================================================
export const SHADOW_THIEF_ABILITIES: AbilityDef[] = [
    // 匕首打击 (Dagger Strike) I
    {
        id: 'dagger-strike',
        name: abilityText('dagger-strike', 'name'),
        type: 'offensive',
        description: abilityText('dagger-strike', 'description'),
        sfxKey: SHADOW_THIEF_SFX_DAGGER,
        variants: [
            { id: 'dagger-strike-3', trigger: { type: 'diceSet', faces: { [FACE.DAGGER]: 3 } }, effects: [damage(4, abilityEffectText('dagger-strike', 'damage4')), { description: '每有[Bag]获得1CP', action: { type: 'custom', target: 'self', customActionId: 'shadow_thief-dagger-strike-cp' } }, { description: '每有[Shadow]造成毒液', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-dagger-strike-poison' } }], priority: 1 },
            { id: 'dagger-strike-4', trigger: { type: 'diceSet', faces: { [FACE.DAGGER]: 4 } }, effects: [damage(6, abilityEffectText('dagger-strike', 'damage6')), { description: '每有[Bag]获得1CP', action: { type: 'custom', target: 'self', customActionId: 'shadow_thief-dagger-strike-cp' } }, { description: '每有[Shadow]造成毒液', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-dagger-strike-poison' } }], priority: 2 },
            { id: 'dagger-strike-5', trigger: { type: 'diceSet', faces: { [FACE.DAGGER]: 5 } }, effects: [damage(8, abilityEffectText('dagger-strike', 'damage8')), { description: '每有[Bag]获得1CP', action: { type: 'custom', target: 'self', customActionId: 'shadow_thief-dagger-strike-cp' } }, { description: '每有[Shadow]造成毒液', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-dagger-strike-poison' } }], priority: 3 }
        ]
    },
    // 抢夺 (Pickpocket) I
    {
        id: 'pickpocket',
        name: abilityText('pickpocket', 'name'),
        type: 'offensive',
        description: abilityText('pickpocket', 'description'),
        sfxKey: SHADOW_THIEF_SFX_PICKPOCKET,
        trigger: { type: 'smallStraight' },
        effects: [
            gainCp(3, abilityEffectText('pickpocket', 'gainCp3')),
            { description: '造成一半CP的伤害', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-damage-half-cp', params: { bonusCp: 3 } } }
        ]
    },
    // 偷窃 (Steal) I
    {
        id: 'steal',
        name: abilityText('steal', 'name'),
        type: 'offensive',
        description: abilityText('steal', 'description'),
        sfxKey: SHADOW_THIEF_SFX_STEAL,
        variants: [
            { id: 'steal-2', trigger: { type: 'diceSet', faces: { [FACE.BAG]: 2 } }, effects: [{ description: '获得2CP (若有Shadow则偷取)', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-steal-cp-2' } }], priority: 1 },
            { id: 'steal-3', trigger: { type: 'diceSet', faces: { [FACE.BAG]: 3 } }, effects: [{ description: '获得3CP (若有Shadow则偷取)', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-steal-cp-3' } }], priority: 2 },
            { id: 'steal-4', trigger: { type: 'diceSet', faces: { [FACE.BAG]: 4 } }, effects: [{ description: '获得4CP (若有Shadow则偷取)', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-steal-cp-4' } }], priority: 3 }
        ]
    },
    // 破隐一击 (Kidney Shot) I
    {
        id: 'kidney-shot',
        name: abilityText('kidney-shot', 'name'),
        type: 'offensive',
        description: abilityText('kidney-shot', 'description'),
        sfxKey: SHADOW_THIEF_SFX_KIDNEY,
        trigger: { type: 'largeStraight' },
        effects: [
            gainCp(4, abilityEffectText('kidney-shot', 'gainCp4')),
            { description: '造成等同CP的伤害', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-damage-full-cp', params: { bonusCp: 4 } } }
        ]
    },
    // 暗影之舞 (Shadow Dance) I
    {
        id: 'shadow-dance',
        name: abilityText('shadow-dance', 'name'),
        type: 'offensive',
        description: abilityText('shadow-dance', 'description'),
        sfxKey: SHADOW_THIEF_SFX_SHADOW,
        trigger: { type: 'diceSet', faces: { [FACE.SHADOW]: 3 } },
        effects: [
            { description: '投掷1骰造成一半伤害', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-shadow-dance-roll' }, timing: 'withDamage' },
            grantToken(TOKEN_IDS.SNEAK, 1, abilityEffectText('shadow-dance', 'gainSneak')),
            grantToken(TOKEN_IDS.SNEAK_ATTACK, 1, abilityEffectText('shadow-dance', 'gainSneakAttack'))
        ]
    },
    // 聚宝盆 (Cornucopia) I
    // 抽 1×Card面 牌，若有Shadow弃对手1牌
    {
        id: 'cornucopia',
        name: abilityText('cornucopia', 'name'),
        type: 'offensive',
        description: abilityText('cornucopia', 'description'),
        sfxKey: SHADOW_THIEF_SFX_LOOT,
        trigger: { type: 'diceSet', faces: { [FACE.CARD]: 2 } },
        effects: [
            { description: '抽Card面数量牌+若有Shadow弃对手1牌', action: { type: 'custom', target: 'self', customActionId: 'shadow_thief-cornucopia' }, timing: 'withDamage' }
        ]
    },
    // 终极: Shadow Shank
    {
        id: 'shadow-shank',
        name: abilityText('shadow-shank', 'name'),
        type: 'offensive',
        tags: ['ultimate'],
        description: abilityText('shadow-shank', 'description'),
        sfxKey: SHADOW_THIEF_SFX_ULTIMATE,
        trigger: { type: 'diceSet', faces: { [FACE.SHADOW]: 5 } },
        effects: [
            gainCp(3, abilityEffectText('shadow-shank', 'gainCp3')),
            { description: '造成CP+5伤害', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-shadow-shank-damage', params: { bonusCp: 3 } } },
            // Replaced removeStatus with custom action
            { description: '移除负面效果', action: { type: 'custom', target: 'self', customActionId: 'shadow_thief-remove-all-debuffs' } },
            grantToken(TOKEN_IDS.SNEAK, 1, abilityEffectText('shadow-shank', 'gainSneak'))
        ]
    },
    // 防御: 暗影守护
    {
        id: 'shadow-defense',
        name: abilityText('shadow-defense', 'name'),
        type: 'defensive',
        description: abilityText('shadow-defense', 'description'),
        trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 4 },
        effects: [
            { description: '防御结算', action: { type: 'custom', target: 'self', customActionId: 'shadow_thief-defense-resolve' }, timing: 'withDamage' }
        ]
    },
    // 防御: 恐惧反击 (Fearless Riposte) I
    // 独立防御技能，5骰，造成匕首数伤害，若有匕首+暗影则造成毒液
    {
        id: 'fearless-riposte',
        name: abilityText('fearless-riposte', 'name'),
        type: 'defensive',
        description: abilityText('fearless-riposte', 'description'),
        trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 },
        effects: [
            { description: '防御结算 (恐惧反击)', action: { type: 'custom', target: 'self', customActionId: 'shadow_thief-fearless-riposte' }, timing: 'withDamage' }
        ]
    }
];

// ============================================================================
// Upgrades (Level 2 & 3)
// ============================================================================

export const DAGGER_STRIKE_2: AbilityDef = {
    id: 'dagger-strike',
    name: abilityText('dagger-strike-2', 'name'),
    type: 'offensive',
    description: abilityText('dagger-strike-2', 'description'),
    sfxKey: SHADOW_THIEF_SFX_DAGGER,
    variants: [
        { id: 'dagger-strike-3-2', trigger: { type: 'diceSet', faces: { [FACE.DAGGER]: 3 } }, effects: [damage(4, abilityEffectText('dagger-strike', 'damage4')), { description: 'Gain 1 CP', action: { type: 'custom', target: 'self', customActionId: 'gain-cp', params: { amount: 1 } } }, { description: 'Per Shadow Poison', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-dagger-strike-poison' } }, { description: 'Per Card Draw', action: { type: 'custom', target: 'self', customActionId: 'shadow_thief-dagger-strike-draw' }, timing: 'withDamage' }], priority: 1 },
        { id: 'dagger-strike-4-2', trigger: { type: 'diceSet', faces: { [FACE.DAGGER]: 4 } }, effects: [damage(6, abilityEffectText('dagger-strike', 'damage6')), { description: 'Gain 1 CP', action: { type: 'custom', target: 'self', customActionId: 'gain-cp', params: { amount: 1 } } }, { description: 'Per Shadow Poison', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-dagger-strike-poison' } }, { description: 'Per Card Draw', action: { type: 'custom', target: 'self', customActionId: 'shadow_thief-dagger-strike-draw' }, timing: 'withDamage' }], priority: 2 },
        { id: 'dagger-strike-5-2', trigger: { type: 'diceSet', faces: { [FACE.DAGGER]: 5 } }, effects: [damage(8, abilityEffectText('dagger-strike', 'damage8')), { description: 'Gain 1 CP', action: { type: 'custom', target: 'self', customActionId: 'gain-cp', params: { amount: 1 } } }, { description: 'Per Shadow Poison', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-dagger-strike-poison' } }, { description: 'Per Card Draw', action: { type: 'custom', target: 'self', customActionId: 'shadow_thief-dagger-strike-draw' }, timing: 'withDamage' }], priority: 3 }
    ]
};

export const PICKPOCKET_2: AbilityDef = {
    id: 'pickpocket',
    name: abilityText('pickpocket-2', 'name'),
    type: 'offensive',
    description: abilityText('pickpocket-2', 'description'),
    sfxKey: SHADOW_THIEF_SFX_PICKPOCKET,
    variants: [
        {
            // 迅捷突袭 II：小顺子触发
            id: 'pickpocket-2',
            name: abilityText('pickpocket-2', 'name'),
            trigger: { type: 'smallStraight' },
            effects: [
                gainCp(4, abilityEffectText('pickpocket-2', 'gainCp4')),
                { description: '造成一半CP的伤害 (向上取整)', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-damage-half-cp', params: { bonusCp: 4 } } }
            ],
            priority: 1
        },
        {
            // 暗影突袭：2匕首+2暗影触发
            id: 'shadow-assault',
            name: abilityText('shadow-assault', 'name'),
            trigger: { type: 'diceSet', faces: { [FACE.DAGGER]: 2, [FACE.SHADOW]: 2 } },
            effects: [
                { description: '造成1/2 CP伤害 (向上取整)', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-damage-half-cp' } },
                { description: '施加中毒', action: { type: 'grantStatus', target: 'opponent', statusId: 'poison', value: 1 } }
            ],
            priority: 2
        }
    ]
};

export const KIDNEY_SHOT_2: AbilityDef = {
    id: 'kidney-shot',
    name: abilityText('kidney-shot-2', 'name'),
    type: 'offensive',
    description: abilityText('kidney-shot-2', 'description'),
    sfxKey: SHADOW_THIEF_SFX_KIDNEY,
    variants: [
        {
            // 破隐一击 II：大顺子触发
            id: 'kidney-shot-2',
            name: abilityText('kidney-shot-2', 'name'),
            trigger: { type: 'largeStraight' },
            effects: [
                gainCp(4, abilityEffectText('kidney-shot-2', 'gainCp4')),
                { description: '造成等同CP的伤害', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-damage-full-cp', params: { bonusCp: 4 } } }
            ],
            priority: 1
        },
        {
            // 穿刺攻击：匕首+钱袋+卡牌+暗影各1个触发
            id: 'piercing-attack',
            name: abilityText('piercing-attack', 'name'),
            trigger: { type: 'diceSet', faces: { [FACE.DAGGER]: 1, [FACE.BAG]: 1, [FACE.CARD]: 1, [FACE.SHADOW]: 1 } },
            effects: [
                gainCp(1, 'Gain 1 CP'),
                grantToken(TOKEN_IDS.SNEAK_ATTACK, 1, 'Gain Sneak Attack'),
                { description: 'Draw 1 Card', action: { type: 'drawCard', target: 'self', value: 1 }, timing: 'withDamage' },
                { description: 'Inflict Poison', action: { type: 'grantStatus', target: 'opponent', statusId: 'poison', value: 1 } }
            ],
            priority: 2
        }
    ]
};

// 暗影之舞 II
export const SHADOW_DANCE_2: AbilityDef = {
    id: 'shadow-dance',
    name: abilityText('shadow-dance-2', 'name'),
    type: 'offensive',
    description: abilityText('shadow-dance-2', 'description'),
    sfxKey: SHADOW_THIEF_SFX_SHADOW,
    tags: ['unblockable'], // 真实伤害 = 不可防御，通过 tags 声明而非 handler 直接修改 state
    trigger: { type: 'diceSet', faces: { [FACE.SHADOW]: 3 } },
    effects: [
        { description: '投掷1骰造成一半伤害(真实)', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-shadow-dance-roll-2' }, timing: 'withDamage' },
    ]
};

// 偷窃 II
export const STEAL_2: AbilityDef = {
    id: 'steal',
    name: abilityText('steal-2', 'name'),
    type: 'offensive',
    description: abilityText('steal-2', 'description'),
    sfxKey: SHADOW_THIEF_SFX_STEAL,
    variants: [
        { id: 'steal-2-2', trigger: { type: 'diceSet', faces: { [FACE.BAG]: 2 } }, effects: [{ description: '获得3CP (若有Shadow则偷取)', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-steal-cp-3' } }], priority: 1 },
        { id: 'steal-3-2', trigger: { type: 'diceSet', faces: { [FACE.BAG]: 3 } }, effects: [{ description: '获得4CP (若有Shadow则偷取)', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-steal-cp-4' } }], priority: 2 },
        { id: 'steal-4-2', trigger: { type: 'diceSet', faces: { [FACE.BAG]: 4 } }, effects: [{ description: '获得5CP (若有Shadow则偷取)', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-steal-cp-5' } }], priority: 3 },
        { id: 'steal-5-2', trigger: { type: 'diceSet', faces: { [FACE.BAG]: 5 } }, effects: [{ description: '获得6CP (若有Shadow则偷取)', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-steal-cp-6' } }], priority: 4 }
    ]
};

// 聚宝盆 II
export const CORNUCOPIA_2: AbilityDef = {
    id: 'cornucopia',
    name: abilityText('cornucopia-2', 'name'),
    type: 'offensive',
    description: abilityText('cornucopia-2', 'description'),
    sfxKey: SHADOW_THIEF_SFX_LOOT,
    trigger: { type: 'diceSet', faces: { [FACE.CARD]: 2 } },
    effects: [
        { description: '每有[Card]抽1，有[Shadow]弃1，有[Bag]得1CP', action: { type: 'custom', target: 'self', customActionId: 'shadow_thief-cornucopia-2' }, timing: 'withDamage' }
    ]
};

// 暗影防御 II (Shadow Defense II)
export const SHADOW_DEFENSE_2: AbilityDef = {
    id: 'shadow-defense',
    name: abilityText('shadow-defense-2', 'name'),
    type: 'defensive',
    description: abilityText('shadow-defense-2', 'description'),
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 }, // 5 Dice
    effects: [
        { description: '防御结算 II', action: { type: 'custom', target: 'self', customActionId: 'shadow_thief-defense-resolve-2' }, timing: 'withDamage' }
    ]
};

// 后发制人 II (Fearless Riposte II) - 恐惧反击的 Level 2 升级
export const FEARLESS_RIPOSTE_2: AbilityDef = {
    id: 'fearless-riposte',
    name: abilityText('fearless-riposte-2', 'name'),
    type: 'defensive',
    description: abilityText('fearless-riposte-2', 'description'),
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 },
    effects: [
        { description: '防御结算 (后发制人 II)', action: { type: 'custom', target: 'self', customActionId: 'shadow_thief-fearless-riposte-2' }, timing: 'withDamage' }
    ]
};
