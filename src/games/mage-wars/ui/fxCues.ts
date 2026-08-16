export const MW_FX = {
    SUMMON: 'mage-wars.summon',
    SPELL_PUSH: 'mage-wars.spell.push',
    SPELL_TELEPORT: 'mage-wars.spell.teleport',
    ATTACK_IMPACT: 'mage-wars.attack.impact',
    DAMAGE_IMPACT: 'mage-wars.damage.impact',
} as const;

export type MageWarsFxCue = typeof MW_FX[keyof typeof MW_FX];
