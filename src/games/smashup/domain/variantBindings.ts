import { SMASHUP_FACTION_IDS } from './ids';

export type SmashUpVariantSurface =
    | 'ability'
    | 'interaction'
    | 'ongoing'
    | 'baseAbility'
    | 'powerModifier'
    | 'basePool';

export type SmashUpVariantRelation =
    | 'shared'
    | 'separate'
    | 'baseOnly'
    | 'podOnly';

export interface SmashUpFactionVariantProfile {
    baseFactionId: string;
    podFactionId: string;
    defaults: Record<SmashUpVariantSurface, SmashUpVariantRelation>;
    familyOverrides?: Record<string, Partial<Record<SmashUpVariantSurface, SmashUpVariantRelation>>>;
}

const DEFAULT_VARIANT_SURFACES: Record<SmashUpVariantSurface, SmashUpVariantRelation> = {
    ability: 'shared',
    interaction: 'shared',
    ongoing: 'shared',
    baseAbility: 'shared',
    powerModifier: 'shared',
    basePool: 'separate',
};

function createVariantProfile(
    baseFactionId: string,
    podFactionId: string,
    familyOverrides?: SmashUpFactionVariantProfile['familyOverrides'],
): SmashUpFactionVariantProfile {
    return {
        baseFactionId,
        podFactionId,
        defaults: { ...DEFAULT_VARIANT_SURFACES },
        ...(familyOverrides ? { familyOverrides } : {}),
    };
}

export const SMASHUP_VARIANT_BINDING_PROFILES: readonly SmashUpFactionVariantProfile[] = [
    createVariantProfile(SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.ALIENS_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.PIRATES_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.NINJAS, SMASHUP_FACTION_IDS.NINJAS_POD, {
        base_temple_of_goju: { baseAbility: 'separate' },
        base_ninja_dojo: { baseAbility: 'separate' },
        ninja_infiltrate: { ability: 'separate', ongoing: 'separate' },
    }),
    createVariantProfile(SMASHUP_FACTION_IDS.DINOSAURS, SMASHUP_FACTION_IDS.DINOSAURS_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ROBOTS_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.WIZARDS, SMASHUP_FACTION_IDS.WIZARDS_POD, {
        wizard_archmage: { ability: 'separate', ongoing: 'separate' },
    }),
    createVariantProfile(SMASHUP_FACTION_IDS.ZOMBIES, SMASHUP_FACTION_IDS.ZOMBIES_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.TRICKSTERS_POD, {
        base_cave_of_shinies: { baseAbility: 'separate' },
        base_mushroom_kingdom: { baseAbility: 'separate' },
        trickster_brownie: { ongoing: 'separate' },
        tricksters_big_funny_giant: { ability: 'separate', interaction: 'separate', ongoing: 'separate' },
        trickster_enshrouding_mist: { ability: 'separate', ongoing: 'separate' },
        trickster_hideout: { ongoing: 'separate' },
    }),
    createVariantProfile(SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.GHOSTS_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.BEAR_CAVALRY, SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.STEAMPUNKS, SMASHUP_FACTION_IDS.STEAMPUNKS_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.KILLER_PLANTS, SMASHUP_FACTION_IDS.KILLER_PLANTS_POD, {
        base_secret_garden: { baseAbility: 'separate' },
    }),
    createVariantProfile(SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU, SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.ELDER_THINGS, SMASHUP_FACTION_IDS.ELDER_THINGS_POD, {
        elder_thing_dunwich_horror: { ongoing: 'separate' },
    }),
    createVariantProfile(SMASHUP_FACTION_IDS.INNSMOUTH, SMASHUP_FACTION_IDS.INNSMOUTH_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY, SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY_POD, {
        base_miskatonic_university_base: { baseAbility: 'separate' },
    }),
    createVariantProfile(SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.FRANKENSTEIN_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.WEREWOLVES, SMASHUP_FACTION_IDS.WEREWOLVES_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.VAMPIRES, SMASHUP_FACTION_IDS.VAMPIRES_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.GIANT_ANTS_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS, SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.SHARKS, SMASHUP_FACTION_IDS.SHARKS_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.SKELETONS, SMASHUP_FACTION_IDS.SKELETONS_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.MYTHIC_HORSES, SMASHUP_FACTION_IDS.MYTHIC_HORSES_POD, {
        mythic_horses_seastar: { ability: 'separate' },
    }),
    createVariantProfile(SMASHUP_FACTION_IDS.MYTHIC_GREEKS, SMASHUP_FACTION_IDS.MYTHIC_GREEKS_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.SHAPESHIFTERS, SMASHUP_FACTION_IDS.SHAPESHIFTERS_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.DRAGONS, SMASHUP_FACTION_IDS.DRAGONS_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.COWBOYS, SMASHUP_FACTION_IDS.COWBOYS_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.SAMURAI_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.DRAGONS, SMASHUP_FACTION_IDS.DRAGONS_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.SUPERHEROES, SMASHUP_FACTION_IDS.SUPERHEROES_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.MAGICAL_GIRLS, SMASHUP_FACTION_IDS.MAGICAL_GIRLS_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.MEGA_TROOPERS, SMASHUP_FACTION_IDS.MEGA_TROOPERS_POD, {
        mega_troopers_blitzing_sword_attack: { ability: 'separate', interaction: 'separate' },
        mega_troopers_form_megabot: { ability: 'separate', interaction: 'separate' },
        mega_troopers_its_blitzin_time: { ability: 'separate', interaction: 'separate' },
        mega_troopers_lightning_rescue: { ability: 'separate', interaction: 'separate' },
        mega_troopers_lightning_crystal: { ability: 'separate', interaction: 'separate' },
        mega_troopers_mega_attack: { ability: 'same', interaction: 'same' },
        mega_troopers_plan_for_more: { ability: 'separate', interaction: 'separate' },
        mega_troopers_beta_6: { ability: 'separate', interaction: 'separate' },
        mega_troopers_blue_trooper: { ability: 'separate', interaction: 'separate' },
        mega_troopers_omega_protocol: { ongoing: 'podOnly' },
        mega_troopers_power_pose: { ability: 'separate', interaction: 'separate' },
        mega_troopers_red_trooper: { ability: 'separate', interaction: 'separate' },
    }),
    createVariantProfile(SMASHUP_FACTION_IDS.VIKINGS, SMASHUP_FACTION_IDS.VIKINGS_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.ITTY_CRITTERS, SMASHUP_FACTION_IDS.ITTY_CRITTERS_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.TIME_TRAVELERS, SMASHUP_FACTION_IDS.TIME_TRAVELERS_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.SHARKS, SMASHUP_FACTION_IDS.SHARKS_POD),
    createVariantProfile(SMASHUP_FACTION_IDS.TORNADOS, SMASHUP_FACTION_IDS.TORNADOS_POD),
];

const profileByFactionId = new Map<string, SmashUpFactionVariantProfile>();
for (const profile of SMASHUP_VARIANT_BINDING_PROFILES) {
    profileByFactionId.set(profile.baseFactionId, profile);
    profileByFactionId.set(profile.podFactionId, profile);
}

export function isSmashUpPodVariantId(id: string): boolean {
    return id.endsWith('_pod');
}

export function normalizeSmashUpVariantFamilyId(id: string): string {
    return isSmashUpPodVariantId(id) ? id.slice(0, -4) : id;
}

export function toSmashUpPodVariantId(id: string): string {
    return isSmashUpPodVariantId(id) ? id : `${id}_pod`;
}

export function getSmashUpVariantProfile(factionId: string | undefined): SmashUpFactionVariantProfile | undefined {
    if (!factionId) return undefined;
    return profileByFactionId.get(factionId);
}

export function getSmashUpVariantSurfaceRelation(
    surface: SmashUpVariantSurface,
    familyId: string,
    factionId: string | undefined,
): SmashUpVariantRelation | undefined {
    const profile = getSmashUpVariantProfile(factionId);
    if (!profile) return undefined;
    const normalizedFamilyId = normalizeSmashUpVariantFamilyId(familyId);
    return profile.familyOverrides?.[normalizedFamilyId]?.[surface] ?? profile.defaults[surface];
}

export function usesSeparateSmashUpBasePoolVariant(factionId: string | undefined): boolean {
    return getSmashUpVariantSurfaceRelation('basePool', factionId ?? '', factionId) === 'separate';
}

export function getAllSmashUpVariantProfiles(): readonly SmashUpFactionVariantProfile[] {
    return SMASHUP_VARIANT_BINDING_PROFILES;
}
