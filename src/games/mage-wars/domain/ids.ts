export const MAGE_WARS_GAME_ID = 'mage-wars' as const;

export const MAGE_IDS = {
    BEASTMASTER_APPRENTICE: 'beastmaster_apprentice',
    PRIESTESS_APPRENTICE: 'priestess_apprentice',
    WARLOCK_APPRENTICE: 'warlock_apprentice',
    WIZARD_APPRENTICE: 'wizard_apprentice',
} as const;

export const ARENA_ZONE_IDS = {
    A1: 'a1',
    A2: 'a2',
    A3: 'a3',
    B1: 'b1',
    B2: 'b2',
    B3: 'b3',
    C1: 'c1',
    C2: 'c2',
    C3: 'c3',
    D1: 'd1',
    D2: 'd2',
    D3: 'd3',
} as const;

export const STATUS_TOKEN_IDS = {
    BURN: 'burn',
    DAZE: 'daze',
    STUN: 'stun',
    ROT: 'rot',
    WEAK: 'weak',
    CRIPPLE: 'cripple',
    SLEEP: 'sleep',
} as const;

export const MAGE_WARS_MAGE_ABILITY_IDS = {
    PRIESTESS_RESTORE_QUICK: 'mw.mage.priestess.restore.quick',
    PRIESTESS_RESTORE_STANDARD: 'mw.mage.priestess.restore.standard',
} as const;

export const MAGE_WARS_OBJECT_ABILITY_IDS = {
    BLUE_GREMLIN_SWIFT_TELEPORT: 'mw.object.2822.swift-teleport',
    ASYRAN_CLERIC_HEALING_LIGHT: 'mw.object.2811.healing-light',
    GREY_ANGEL_REDEMPTION_SACRIFICE: 'mw.object.2907.redemption-sacrifice',
    BEAST_STAFF: 'mw.equipment.3710.beast-staff',
    ELEMENTAL_STAFF_BIND: 'mw.equipment.3716.elemental-staff-bind',
} as const;

export type MageId = typeof MAGE_IDS[keyof typeof MAGE_IDS];
export type ArenaZoneId = typeof ARENA_ZONE_IDS[keyof typeof ARENA_ZONE_IDS];
export type StatusTokenId = typeof STATUS_TOKEN_IDS[keyof typeof STATUS_TOKEN_IDS];
export type MageWarsMageAbilityId = typeof MAGE_WARS_MAGE_ABILITY_IDS[keyof typeof MAGE_WARS_MAGE_ABILITY_IDS];
export type MageWarsObjectAbilityId = typeof MAGE_WARS_OBJECT_ABILITY_IDS[keyof typeof MAGE_WARS_OBJECT_ABILITY_IDS];

export type MageWarsWallEdgeId = string;

const ARENA_ZONE_ID_ORDER = Object.values(ARENA_ZONE_IDS);

export function getMageWarsWallEdgeId(left: ArenaZoneId, right: ArenaZoneId): MageWarsWallEdgeId {
    const [first, second] = [left, right].sort((leftId, rightId) => (
        ARENA_ZONE_ID_ORDER.indexOf(leftId) - ARENA_ZONE_ID_ORDER.indexOf(rightId)
    ));
    return `${first}-${second}`;
}
