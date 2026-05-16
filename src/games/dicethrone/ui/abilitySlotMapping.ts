import { HEROES_DATA } from '../heroes';
import type { AbilityDef } from '../domain/combat';

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
    // Ninja v2 玩家面板的两个视觉槽位与旧共享语义不同：
    // top-right(combo 坐标) 是毒刃小顺子，bottom-left(sky 坐标) 是死亡盛放。
    ninja: {
        sky: ['death-blossom'],
        combo: ['poison-blade'],
    },
    // Treant v2 玩家面板采用独立被动槽，且右下角防御位在 meditate。
    // 旧实现曾错误复用共享语义，导致 passive / defense 高亮错位。
    treant: {
        sky: ['quiet-cultivation'],
        lotus: ['wild-growth'],
        combo: ['vengeful-vines'],
        lightning: ['nature-touch'],
        calm: ['__treant-unmapped-calm__'],
        meditate: ['rooted'],
    },
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

export function slotContainsAbilityIdForCharacter(characterId: string | undefined | null, slotId: string, abilityId: string): boolean {
    const baseAbilityId = getBaseAbilityId(abilityId);
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

export function getAbilitySlotIdForCharacter(characterId: string | undefined | null, abilityId: string): string | null {
    for (const slotId of Object.keys(ABILITY_SLOT_MAP)) {
        if (slotContainsAbilityIdForCharacter(characterId, slotId, abilityId)) {
            return slotId;
        }
    }
    return null;
}
