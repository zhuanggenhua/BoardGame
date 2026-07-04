import { HEROES_DATA } from '../heroes';
import type { AbilityDef } from '../domain/combat';
import type { HeroState } from '../domain/types';

export const ABILITY_SLOT_MAP: Record<string, { labelKey: string; ids: string[] }> = {
    fist: { labelKey: 'abilitySlots.fist', ids: ['fist-technique', 'fireball', 'slap', 'longbow', 'dagger-strike', 'revolver', 'katana-slice', 'shattering-fist', 'slash'] },
    chi: { labelKey: 'abilitySlots.chi', ids: ['zen-forget', 'soul-burn', 'all-out-strike', 'vengeance', 'covert-fire', 'pickpocket', 'bounty-hunter', 'wakizashi', 'tend-care', 'going-forward'] },
    sky: { labelKey: 'abilitySlots.sky', ids: ['harmony', 'fiery-combo', 'powerful-strike', 'holy-strike', 'entangling-shot', 'shadow-dance', 'quick-draw', 'bushido', 'vengeful-vines', 'poison-blade'] },
    lotus: { labelKey: 'abilitySlots.lotus', ids: ['lotus-palm', 'meteor', 'violent-assault', 'righteous-prayer', 'eclipse', 'shadow-defense', 'take-cover', 'solemnity', 'nature-touch', 'shadow-step'] },
    combo: { labelKey: 'abilitySlots.combo', ids: ['taiji-combo', 'pyro-blast', 'steadfast', 'righteous-combat', 'covering-fire', 'steal', 'showdown', 'budo', 'quiet-cultivation', 'death-blossom'] },
    lightning: { labelKey: 'abilitySlots.lightning', ids: ['thunder-strike', 'burn-down', 'suppress', 'blessing-of-might', 'exploding-arrow', 'kidney-shot', 'deadeye', 'samurai-slot-06', 'wild-growth', 'smoke-screen'] },
    calm: { labelKey: 'abilitySlots.calm', ids: ['calm-water', 'ignite', 'reckless-strike', 'holy-light', 'blinding-shot', 'cornucopia', 'fan-the-hammer', 'masamune', 'rooted', 'shadow-fang'] },
    meditate: { labelKey: 'abilitySlots.meditate', ids: ['meditation', 'magma-armor', 'thick-skin', 'holy-defense', 'elusive-step', 'fearless-riposte', 'duel', 'stand-tall', 'blink'] },
    ultimate: { labelKey: 'abilitySlots.ultimate', ids: ['transcendence', 'ultimate-inferno', 'rage', 'unyielding-faith', 'lunar-eclipse', 'shadow-shank', 'fill-em-with-lead', 'samurai-ultimate', 'forest-awakens', 'ninja-assassinate'] },
};

const CHARACTER_SLOT_ABILITY_OVERRIDES: Record<string, Record<string, string[]>> = {
    // 旧六角色新版面板坐标复用 v2，但每个物理槽上的技能标题仍来自各自旧面板底图。
    // 点击、高亮和升级牌覆盖都必须按底图物理槽位录入，不能退回共享槽位语义。
    monk: {
        fist: ['fist-technique'],
        chi: ['zen-forget'],
        sky: ['taiji-combo'],
        lotus: ['thunder-strike'],
        combo: ['harmony'],
        lightning: ['lotus-palm'],
        calm: ['calm-water'],
        meditate: ['meditation'],
        ultimate: ['transcendence'],
    },
    barbarian: {
        fist: ['slap'],
        chi: ['all-out-strike'],
        sky: ['steadfast'],
        lotus: ['suppress'],
        combo: ['powerful-strike'],
        lightning: ['violent-assault'],
        calm: ['reckless-strike'],
        meditate: ['thick-skin'],
        ultimate: ['rage'],
    },
    pyromancer: {
        fist: ['fireball'],
        chi: ['soul-burn'],
        sky: ['fiery-combo'],
        lotus: ['burn-down'],
        combo: ['pyro-blast'],
        lightning: ['meteor'],
        calm: ['ignite'],
        meditate: ['magma-armor'],
        ultimate: ['ultimate-inferno'],
    },
    moon_elf: {
        fist: ['longbow'],
        chi: ['covert-fire'],
        sky: ['covering-fire'],
        lotus: ['exploding-arrow'],
        combo: ['entangling-shot'],
        lightning: ['eclipse'],
        calm: ['blinding-shot'],
        meditate: ['elusive-step'],
        ultimate: ['lunar-eclipse'],
    },
    shadow_thief: {
        fist: ['dagger-strike'],
        chi: ['pickpocket'],
        sky: ['steal'],
        lotus: ['kidney-shot'],
        combo: ['shadow-dance'],
        lightning: ['shadow-defense'],
        calm: ['cornucopia'],
        meditate: ['fearless-riposte'],
        ultimate: ['shadow-shank'],
    },
    paladin: {
        fist: ['tithes'],
        chi: ['vengeance'],
        sky: ['righteous-combat'],
        lotus: ['blessing-of-might'],
        combo: ['holy-strike'],
        lightning: ['righteous-prayer'],
        calm: ['holy-light'],
        meditate: ['holy-defense'],
        ultimate: ['unyielding-faith'],
    },
    // Ninja v2 玩家面板的中间四格与旧共享语义不同：
    // top-right 两格分别是毒刃 / 暗影步，bottom-left 两格分别是死亡盛放 / 烟雾阵。
    ninja: {
        sky: ['death-blossom'],
        combo: ['poison-blade'],
        lotus: ['smoke-screen'],
        lightning: ['shadow-step'],
    },
    // Treant v2 玩家面板采用独立被动槽，且右下角防御位在 meditate。
    // 旧实现曾错误复用共享语义，导致 passive / defense 高亮错位。
    treant: {
        sky: ['quiet-cultivation'],
        lotus: ['wild-growth'],
        combo: ['vengeful-vines'],
        lightning: ['nature-touch', 'wild-roar'],
        calm: ['__treant-unmapped-calm__'],
        meditate: ['rooted'],
    },
    zhanshujia: {
        fist: ['sabre-thrust'],
        chi: ['carpet-bombing'],
        sky: ['war-monger'],
        lotus: ['drum-movement'],
        combo: ['flanking'],
        lightning: ['expand-battlefield'],
        calm: ['strategic-shift'],
        meditate: ['countermeasures'],
        ultimate: ['high-ground'],
    },
    cursed_pirate: {
        fist: ['soul-stab'],
        chi: ['marked-for-death'],
        sky: ['cursed'],
        lotus: ['deep-sea-dive'],
        combo: ['breath-of-death'],
        lightning: ['soul-command'],
        calm: ['undead-claw'],
        meditate: ['still-wet-behind-ears'],
        ultimate: ['merciless-curse'],
    },
    artificer: {
        fist: ['wrench-strike'],
        chi: ['schematics'],
        sky: ['collect-parts'],
        lotus: ['eureka'],
        combo: ['activate-bots'],
        lightning: ['overclock'],
        calm: ['shock-bot'],
        meditate: ['tinker'],
        ultimate: ['maximum-power'],
    },
};

const CURSED_PIRATE_NORMAL_SLOT_ABILITY_OVERRIDES: Record<string, string[]> = {
    fist: ['cutlass-stab'],
    chi: ['make-your-mark'],
    sky: ['human-cursed'],
    lotus: ['walk-the-plank'],
    combo: ['light-the-fuse'],
    lightning: ['verdict-command'],
    calm: ['astonishing'],
    meditate: ['human-still-wet-behind-ears'],
    ultimate: ['merciless-plunder'],
};

const ABILITY_BASE_ID_MAP = new Map<string, string>();

function registerAbility(ability: AbilityDef): void {
    ABILITY_BASE_ID_MAP.set(ability.id, ability.id);
    for (const variant of ability.variants ?? []) {
        ABILITY_BASE_ID_MAP.set(variant.id, ability.id);
    }
}

for (const heroData of Object.values(HEROES_DATA)) {
    for (const ability of heroData.abilities) {
        registerAbility(ability);
    }
    if (heroData.getAbilitiesForFace) {
        for (const face of ['normal', 'cursed'] as const) {
            for (const ability of heroData.getAbilitiesForFace(face)) {
                registerAbility(ability as AbilityDef);
            }
        }
    }

    for (const card of heroData.cards) {
        if (card.type !== 'upgrade' || !card.effects) continue;
        for (const effect of card.effects) {
            const action = effect.action;
            if (action?.type === 'replaceAbility' && action.newAbilityDef) {
                registerAbility(action.newAbilityDef as AbilityDef);
            }
        }
    }
}

export function getBaseAbilityId(abilityId: string): string {
    return ABILITY_BASE_ID_MAP.get(abilityId) ?? abilityId;
}

export function slotContainsAbilityId(slotId: string, abilityId: string): boolean {
    const mapping = ABILITY_SLOT_MAP[slotId];
    if (!mapping) return false;
    return mapping.ids.includes(getBaseAbilityId(abilityId));
}

export function slotContainsAbilityIdForCharacter(
    characterId: string | undefined | null,
    slotId: string,
    abilityId: string,
    playerBoardFace?: HeroState['playerBoardFace'],
): boolean {
    const baseAbilityId = getBaseAbilityId(abilityId);
    if (characterId === 'cursed_pirate' && playerBoardFace === 'normal') {
        return CURSED_PIRATE_NORMAL_SLOT_ABILITY_OVERRIDES[slotId]?.includes(baseAbilityId) ?? false;
    }
    const override = CHARACTER_SLOT_ABILITY_OVERRIDES[characterId ?? '']?.[slotId];
    if (override) {
        return override.includes(baseAbilityId);
    }
    return slotContainsAbilityId(slotId, abilityId);
}

export function getAbilitySlotId(abilityId: string): string | null {
    for (const slotId of Object.keys(ABILITY_SLOT_MAP)) {
        if (slotContainsAbilityId(slotId, abilityId)) {
            return slotId;
        }
    }
    return null;
}

export function getAbilitySlotIdForCharacter(
    characterId: string | undefined | null,
    abilityId: string,
    playerBoardFace?: HeroState['playerBoardFace'],
): string | null {
    for (const slotId of Object.keys(ABILITY_SLOT_MAP)) {
        if (slotContainsAbilityIdForCharacter(characterId, slotId, abilityId, playerBoardFace)) {
            return slotId;
        }
    }
    return null;
}
