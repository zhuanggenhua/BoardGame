import { HEROES_DATA } from '../heroes';
import type { AbilityDef } from '../domain/combat';

export const ABILITY_SLOT_MAP: Record<string, { labelKey: string; ids: string[] }> = {
    fist: { labelKey: 'abilitySlots.fist', ids: ['fist-technique', 'fireball', 'slap', 'longbow', 'dagger-strike', 'revolver', 'katana-slice'] },
    chi: { labelKey: 'abilitySlots.chi', ids: ['zen-forget', 'soul-burn', 'all-out-strike', 'vengeance', 'covert-fire', 'pickpocket', 'bounty-hunter', 'wakizashi'] },
    sky: { labelKey: 'abilitySlots.sky', ids: ['harmony', 'fiery-combo', 'powerful-strike', 'holy-strike', 'entangling-shot', 'shadow-dance', 'quick-draw', 'bushido'] },
    lotus: { labelKey: 'abilitySlots.lotus', ids: ['lotus-palm', 'meteor', 'violent-assault', 'righteous-prayer', 'eclipse', 'shadow-defense', 'take-cover', 'solemnity'] },
    combo: { labelKey: 'abilitySlots.combo', ids: ['taiji-combo', 'pyro-blast', 'steadfast', 'righteous-combat', 'covering-fire', 'steal', 'showdown', 'budo'] },
    lightning: { labelKey: 'abilitySlots.lightning', ids: ['thunder-strike', 'burn-down', 'suppress', 'blessing-of-might', 'exploding-arrow', 'kidney-shot', 'deadeye', 'samurai-slot-06'] },
    calm: { labelKey: 'abilitySlots.calm', ids: ['calm-water', 'ignite', 'reckless-strike', 'holy-light', 'blinding-shot', 'cornucopia', 'fan-the-hammer', 'masamune'] },
    meditate: { labelKey: 'abilitySlots.meditate', ids: ['meditation', 'magma-armor', 'thick-skin', 'holy-defense', 'elusive-step', 'fearless-riposte', 'duel', 'stand-tall'] },
    ultimate: { labelKey: 'abilitySlots.ultimate', ids: ['transcendence', 'ultimate-inferno', 'rage', 'unyielding-faith', 'lunar-eclipse', 'shadow-shank', 'fill-em-with-lead', 'samurai-ultimate'] },
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

export function getAbilitySlotId(abilityId: string): string | null {
    for (const slotId of Object.keys(ABILITY_SLOT_MAP)) {
        if (slotContainsAbilityId(slotId, abilityId)) {
            return slotId;
        }
    }
    return null;
}
