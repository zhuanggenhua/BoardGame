import {
    buildFactionSelectionIdentitySet,
    isSmashUpDiyFaction,
    isSmashUpFactionImplementationInProgress,
    normalizeFactionSelectionId,
    SMASHUP_FACTION_IDS,
} from './domain/ids';
import { getFactionCards } from './data/cards';

export const SMASHUP_INCLUDED_FACTIONS_SETUP_FIELD = 'smashupIncludedFactionIds' as const;

const DEFAULT_ENABLED_EXPANSIONS = ['titans', 'diy'] as const;

export interface SmashUpFactionParticipationGroup {
    id: string;
    labelKey: string;
    factionIds: string[];
}

export const SMASHUP_FACTION_PARTICIPATION_GROUPS: SmashUpFactionParticipationGroup[] = [
    {
        id: 'core',
        labelKey: 'setup.factionParticipation.groups.core',
        factionIds: [
            SMASHUP_FACTION_IDS.ALIENS,
            SMASHUP_FACTION_IDS.DINOSAURS,
            SMASHUP_FACTION_IDS.NINJAS,
            SMASHUP_FACTION_IDS.PIRATES,
            SMASHUP_FACTION_IDS.ROBOTS,
            SMASHUP_FACTION_IDS.TRICKSTERS,
            SMASHUP_FACTION_IDS.WIZARDS,
            SMASHUP_FACTION_IDS.ZOMBIES,
        ],
    },
    {
        id: 'awesome_9000',
        labelKey: 'setup.factionParticipation.groups.awesome9000',
        factionIds: [
            SMASHUP_FACTION_IDS.BEAR_CAVALRY,
            SMASHUP_FACTION_IDS.GHOSTS,
            SMASHUP_FACTION_IDS.KILLER_PLANTS,
            SMASHUP_FACTION_IDS.STEAMPUNKS,
        ],
    },
    {
        id: 'obligatory_cthulhu',
        labelKey: 'setup.factionParticipation.groups.obligatoryCthulhu',
        factionIds: [
            SMASHUP_FACTION_IDS.ELDER_THINGS,
            SMASHUP_FACTION_IDS.INNSMOUTH,
            SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU,
            SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY,
        ],
    },
    {
        id: 'science_fiction_double_feature',
        labelKey: 'setup.factionParticipation.groups.scienceFictionDoubleFeature',
        factionIds: [
            SMASHUP_FACTION_IDS.CYBORG_APES,
            SMASHUP_FACTION_IDS.EXTRAMORPHS,
            SMASHUP_FACTION_IDS.SHAPESHIFTERS,
            SMASHUP_FACTION_IDS.SUPER_SPIES,
            SMASHUP_FACTION_IDS.TIME_TRAVELERS,
        ],
    },
    {
        id: 'monster_smash',
        labelKey: 'setup.factionParticipation.groups.monsterSmash',
        factionIds: [
            SMASHUP_FACTION_IDS.GIANT_ANTS,
            SMASHUP_FACTION_IDS.FRANKENSTEIN,
            SMASHUP_FACTION_IDS.VAMPIRES,
            SMASHUP_FACTION_IDS.WEREWOLVES,
        ],
    },
    {
        id: 'pretty_pretty',
        labelKey: 'setup.factionParticipation.groups.prettyPretty',
        factionIds: [
            SMASHUP_FACTION_IDS.FAIRIES,
            SMASHUP_FACTION_IDS.KITTY_CATS,
            SMASHUP_FACTION_IDS.MYTHIC_HORSES,
            SMASHUP_FACTION_IDS.PRINCESSES,
        ],
    },
    {
        id: 'its_your_fault',
        labelKey: 'setup.factionParticipation.groups.itsYourFault',
        factionIds: [
            SMASHUP_FACTION_IDS.DRAGONS,
            SMASHUP_FACTION_IDS.MYTHIC_GREEKS,
            SMASHUP_FACTION_IDS.SHARKS,
            SMASHUP_FACTION_IDS.SUPERHEROES,
            SMASHUP_FACTION_IDS.TORNADOS,
        ],
    },
    {
        id: 'cease_and_desist',
        labelKey: 'setup.factionParticipation.groups.ceaseAndDesist',
        factionIds: [
            SMASHUP_FACTION_IDS.ASTROKNIGHTS,
            SMASHUP_FACTION_IDS.CHANGERBOTS,
            SMASHUP_FACTION_IDS.IGNOBLES,
            SMASHUP_FACTION_IDS.STAR_ROAMERS,
        ],
    },
    {
        id: 'what_were_we_thinking',
        labelKey: 'setup.factionParticipation.groups.whatWereWeThinking',
        factionIds: [
            SMASHUP_FACTION_IDS.EXPLORERS,
            SMASHUP_FACTION_IDS.GRANNIES,
            SMASHUP_FACTION_IDS.ROCK_STARS,
            SMASHUP_FACTION_IDS.TEDDY_BEARS,
        ],
    },
    {
        id: 'big_in_japan',
        labelKey: 'setup.factionParticipation.groups.bigInJapan',
        factionIds: [
            SMASHUP_FACTION_IDS.ITTY_CRITTERS,
            SMASHUP_FACTION_IDS.KAIJU,
            SMASHUP_FACTION_IDS.MAGICAL_GIRLS,
            SMASHUP_FACTION_IDS.MEGA_TROOPERS,
        ],
    },
    {
        id: 'that_70s',
        labelKey: 'setup.factionParticipation.groups.that70s',
        factionIds: [
            SMASHUP_FACTION_IDS.DISCO_DANCERS,
            SMASHUP_FACTION_IDS.KUNG_FU_FIGHTERS,
            SMASHUP_FACTION_IDS.TRUCKERS,
            SMASHUP_FACTION_IDS.VIGILANTES,
        ],
    },
    {
        id: 'oops_you_did_it_again',
        labelKey: 'setup.factionParticipation.groups.oopsYouDidItAgain',
        factionIds: [
            SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS,
            SMASHUP_FACTION_IDS.COWBOYS,
            SMASHUP_FACTION_IDS.SAMURAI,
            SMASHUP_FACTION_IDS.VIKINGS,
        ],
    },
    {
        id: 'international_incident',
        labelKey: 'setup.factionParticipation.groups.internationalIncident',
        factionIds: [
            SMASHUP_FACTION_IDS.LUCHADORS,
            SMASHUP_FACTION_IDS.MOUNTIES,
            SMASHUP_FACTION_IDS.MUSKETEERS,
            SMASHUP_FACTION_IDS.PENGUINS,
            SMASHUP_FACTION_IDS.POLYNESIAN_VOYAGERS,
            SMASHUP_FACTION_IDS.SUMO_WRESTLERS,
        ],
    },
    {
        id: 'culture_shock',
        labelKey: 'setup.factionParticipation.groups.cultureShock',
        factionIds: [
            SMASHUP_FACTION_IDS.ANANSI_TALES,
            SMASHUP_FACTION_IDS.ANCIENT_INCAS,
            SMASHUP_FACTION_IDS.GRIMMS_FAIRY_TALES,
            SMASHUP_FACTION_IDS.RUSSIAN_FAIRY_TALES,
        ],
    },
    {
        id: 'marvel',
        labelKey: 'setup.factionParticipation.groups.marvel',
        factionIds: [
            SMASHUP_FACTION_IDS.AVENGERS,
            SMASHUP_FACTION_IDS.HYDRA,
            SMASHUP_FACTION_IDS.KREE,
            SMASHUP_FACTION_IDS.MASTERS_OF_EVIL,
            SMASHUP_FACTION_IDS.SHIELD,
            SMASHUP_FACTION_IDS.SINISTER_SIX,
            SMASHUP_FACTION_IDS.SPIDER_VERSE,
            SMASHUP_FACTION_IDS.ULTIMATES,
        ],
    },
    {
        id: 'disney',
        labelKey: 'setup.factionParticipation.groups.disney',
        factionIds: [
            SMASHUP_FACTION_IDS.ALADDIN,
            SMASHUP_FACTION_IDS.BEAUTY_AND_THE_BEAST,
            SMASHUP_FACTION_IDS.BIG_HERO_6,
            SMASHUP_FACTION_IDS.FROZEN,
            SMASHUP_FACTION_IDS.LION_KING,
            SMASHUP_FACTION_IDS.MULAN,
            SMASHUP_FACTION_IDS.NIGHTMARE_BEFORE_CHRISTMAS,
            SMASHUP_FACTION_IDS.WRECK_IT_RALPH,
        ],
    },
    {
        id: 'excellent_movies',
        labelKey: 'setup.factionParticipation.groups.excellentMovies',
        factionIds: [
            SMASHUP_FACTION_IDS.ACTION_HEROES,
            SMASHUP_FACTION_IDS.BACKTIMERS,
            SMASHUP_FACTION_IDS.TEENS,
            SMASHUP_FACTION_IDS.WRAITHRUSTLERS,
        ],
    },
    {
        id: 'single_faction_packs',
        labelKey: 'setup.factionParticipation.groups.singleFactionPacks',
        factionIds: [
            SMASHUP_FACTION_IDS.ROUND_TABLE_KNIGHTS,
            SMASHUP_FACTION_IDS.GOBLINS,
            SMASHUP_FACTION_IDS.DIY_KILLERS,
            SMASHUP_FACTION_IDS.DIY_CLOWNS,
        ],
    },
    {
        id: 'promos',
        labelKey: 'setup.factionParticipation.groups.promos',
        factionIds: [
            SMASHUP_FACTION_IDS.ALL_STARS,
            SMASHUP_FACTION_IDS.GEEKS,
            SMASHUP_FACTION_IDS.MERMAIDS,
            SMASHUP_FACTION_IDS.SHEEP,
            SMASHUP_FACTION_IDS.SKELETONS,
            SMASHUP_FACTION_IDS.WORLD_CHAMPS,
        ],
    },
    {
        id: 'custom',
        labelKey: 'setup.factionParticipation.groups.custom',
        factionIds: [
            SMASHUP_FACTION_IDS.HULUWAWA,
            SMASHUP_FACTION_IDS.PALADINS,
        ],
    },
    {
        id: 'half_the_battle',
        labelKey: 'setup.factionParticipation.groups.halfTheBattle',
        factionIds: [
            SMASHUP_FACTION_IDS.ADOLESCENT_EPIC_GECKOS,
            SMASHUP_FACTION_IDS.GI_GERALD,
            SMASHUP_FACTION_IDS.PEARL_AND_THE_IMAGES,
            SMASHUP_FACTION_IDS.RULERS_OF_THE_COSMOS,
        ],
    },
];

export function isSmashUpFactionAvailableForParticipation(
    factionId: string,
    enabledExpansions: readonly string[] = DEFAULT_ENABLED_EXPANSIONS,
): boolean {
    return factionId !== SMASHUP_FACTION_IDS.MADNESS
        && !isSmashUpFactionImplementationInProgress(factionId)
        && (!isSmashUpDiyFaction(factionId) || enabledExpansions.includes('diy'))
        && getFactionCards(factionId).length > 0;
}

export function getSmashUpDefaultIncludedFactionIds(
    enabledExpansions: readonly string[] = DEFAULT_ENABLED_EXPANSIONS,
): string[] {
    const identities: string[] = [];
    const seen = new Set<string>();
    for (const factionId of Object.values(SMASHUP_FACTION_IDS)) {
        if (!isSmashUpFactionAvailableForParticipation(factionId, enabledExpansions)) continue;
        const identity = normalizeFactionSelectionId(factionId);
        if (!identity || seen.has(identity)) continue;
        seen.add(identity);
        identities.push(identity);
    }
    return identities;
}

export function getSmashUpFactionParticipationGroups(
    enabledExpansions: readonly string[] = DEFAULT_ENABLED_EXPANSIONS,
): SmashUpFactionParticipationGroup[] {
    return SMASHUP_FACTION_PARTICIPATION_GROUPS
        .map((group) => ({
            ...group,
            factionIds: group.factionIds.filter((factionId) =>
                isSmashUpFactionAvailableForParticipation(factionId, enabledExpansions),
            ),
        }))
        .filter((group) => group.factionIds.length > 0);
}

export function normalizeSmashUpIncludedFactionIds(
    rawValue: unknown,
    enabledExpansions: readonly string[] = DEFAULT_ENABLED_EXPANSIONS,
    options: { minFactionCount?: number } = {},
): string[] {
    const defaultIncludedFactionIds = getSmashUpDefaultIncludedFactionIds(enabledExpansions);
    if (!Array.isArray(rawValue)) {
        return defaultIncludedFactionIds;
    }

    const availableIdentities = new Set(defaultIncludedFactionIds);
    const rawIdentities = buildFactionSelectionIdentitySet(
        rawValue.filter((value): value is string => typeof value === 'string'),
    );
    const normalized = defaultIncludedFactionIds.filter((factionId) => (
        availableIdentities.has(factionId) && rawIdentities.has(factionId)
    ));

    if (normalized.length < (options.minFactionCount ?? 1)) {
        return defaultIncludedFactionIds;
    }
    return normalized;
}

export function isSmashUpFactionIncludedInParticipationPool(
    factionId: string,
    includedFactionIds: readonly string[] | undefined,
): boolean {
    if (!includedFactionIds || includedFactionIds.length === 0) return true;
    return buildFactionSelectionIdentitySet(includedFactionIds).has(normalizeFactionSelectionId(factionId));
}
