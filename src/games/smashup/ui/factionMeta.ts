import {
    Anchor,
    Award,
    Axe,
    Badge,
    BadgeAlert,
    BadgeCheck,
    BicepsFlexed,
    Bone,
    Bot,
    BookMarked,
    BookOpen,
    Bug,
    Castle,
    Clock,
    Cloud,
    Cog,
    Cross,
    Crosshair,
    Crown,
    Dice6,
    Disc3,
    Droplet,
    Drama,
    Dumbbell,
    Eye,
    Fish,
    Flame,
    FlaskConical,
    Flower2,
    Gem,
    Ghost,
    GitFork,
    Glasses,
    GraduationCap,
    Grape,
    Hammer,
    HandFist,
    HatGlasses,
    HeartPulse,
    KeyRound,
    Landmark,
    Leaf,
    LeafyGreen,
    Medal,
    Moon,
    Mountain,
    Orbit,
    PawPrint,
    Pickaxe,
    Pyramid,
    Rainbow,
    Rose,
    Sailboat,
    Satellite,
    Shield,
    ShieldAlert,
    ShieldCheck,
    ShieldHalf,
    Skull,
    Snowflake,
    Sparkle,
    Sparkles,
    Sun,
    Sunrise,
    Sword,
    Swords,
    Sprout,
    Telescope,
    Theater,
    Tornado,
    Turtle,
    Truck,
    VenetianMask,
    Wand2,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import type { ElementType } from 'react';
import { isSmashUpFactionImplementationInProgress, SMASHUP_FACTION_IDS } from '../domain/ids';
import {
    AntIcon,
    CowboyHatIcon,
    OctopusHeadIcon,
    ShapeshifterIcon,
    ShurikenIcon,
    SvgRepoMagicLampIcon,
} from './icons/CustomIcons';

export interface FactionMeta {
    id: string;
    nameKey: string;
    icon: LucideIcon | ElementType;
    color: string;
    descriptionKey: string;
    /** 可选：派系特有机制规则说明（用于派系选择详情面板） */
    mechanicRule?: FactionMechanicRuleMeta;
    /** @deprecated 派系实施状态由 domain/ids.ts 的配置提供，UI 元数据不得再维护第二份状态。 */
    implementationStatus?: never;
    /** 可选：实施状态提示文案 key */
    implementationHintKey?: string;
    /** 可选：限制仅在哪些语言界面中显示此阵营，不填则全语言显示 */
    locales?: string[];
    /** 可选：扩展开关分组；DIY 派系仅在 diy 开关开启时显示 */
    expansion?: 'diy';
}

export interface FactionMechanicTutorialMeta {
    tutorialId: string;
    titleKey: string;
    descriptionKey: string;
}

export interface FactionMechanicRuleMeta {
    titleKey: string;
    descriptionKey: string;
}

export interface FactionVariantGroup {
    groupId: string;
    icon: FactionMeta['icon'];
    color: string;
    variants: FactionMeta[];
}

const POD_SUFFIX = '_pod';

const FACTION_MECHANIC_RULES = {
    madness: {
        titleKey: 'mechanics.madness.title',
        descriptionKey: 'mechanics.madness.description',
    },
    bury: {
        titleKey: 'mechanics.bury.title',
        descriptionKey: 'mechanics.bury.description',
    },
    duel: {
        titleKey: 'mechanics.duel.title',
        descriptionKey: 'mechanics.duel.description',
    },
    powerCounters: {
        titleKey: 'mechanics.powerCounters.title',
        descriptionKey: 'mechanics.powerCounters.description',
    },
} as const satisfies Record<string, FactionMechanicRuleMeta>;

const MADNESS_MECHANIC_RULE = FACTION_MECHANIC_RULES.madness;
const BURY_MECHANIC_RULE = FACTION_MECHANIC_RULES.bury;
const DUEL_MECHANIC_RULE = FACTION_MECHANIC_RULES.duel;
const POWER_COUNTER_MECHANIC_RULE = FACTION_MECHANIC_RULES.powerCounters;

function toFactionGroupId(factionId: string): string {
    return factionId.endsWith(POD_SUFFIX) ? factionId.slice(0, -POD_SUFFIX.length) : factionId;
}

function isFactionVisibleInLocale(faction: FactionMeta, locale: string): boolean {
    return !faction.locales || faction.locales.includes(locale);
}

function isFactionEnabledInExpansions(faction: FactionMeta, enabledExpansions: readonly string[]): boolean {
    return !faction.expansion || enabledExpansions.includes(faction.expansion);
}

function preferBaseVariant(variants: FactionMeta[], locale: string): FactionMeta {
    const visibleVariants = variants.filter((variant) => isFactionVisibleInLocale(variant, locale));
    const candidates = visibleVariants.length > 0 ? visibleVariants : variants;

    return candidates.find((variant) => !variant.id.endsWith(POD_SUFFIX))
        ?? candidates[0]
        ?? variants[0];
}

export const FACTION_METADATA: FactionMeta[] = [
    { id: SMASHUP_FACTION_IDS.PIRATES, nameKey: 'factions.pirates.name', icon: Anchor, color: '#1e293b', descriptionKey: 'factions.pirates.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.PIRATES_POD, nameKey: 'factions.pirates_pod.name', icon: Anchor, color: '#1e293b', descriptionKey: 'factions.pirates_pod.description' },
    // 原版忍者：仅在中文界面显示（中文玩家对照用）
    { id: SMASHUP_FACTION_IDS.NINJAS, nameKey: 'factions.ninjas.name', icon: ShurikenIcon, color: '#7f1d1d', descriptionKey: 'factions.ninjas.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.DINOSAURS, nameKey: 'factions.dinosaurs.name', icon: Bone, color: '#15803d', descriptionKey: 'factions.dinosaurs.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.DINOSAURS_POD, nameKey: 'factions.dinosaurs_pod.name', icon: Bone, color: '#15803d', descriptionKey: 'factions.dinosaurs_pod.description' },
    { id: SMASHUP_FACTION_IDS.ALIENS, nameKey: 'factions.aliens.name', icon: Orbit, color: '#0ea5e9', descriptionKey: 'factions.aliens.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.ALIENS_POD, nameKey: 'factions.aliens_pod.name', icon: Orbit, color: '#0ea5e9', descriptionKey: 'factions.aliens_pod.description' },
    { id: SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS, nameKey: 'factions.ancient_egyptians.name', icon: Pyramid, color: '#eab308', descriptionKey: 'factions.ancient_egyptians.description', mechanicRule: BURY_MECHANIC_RULE, locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS_POD, nameKey: 'factions.ancient_egyptians_pod.name', icon: Pyramid, color: '#eab308', descriptionKey: 'factions.ancient_egyptians_pod.description', mechanicRule: BURY_MECHANIC_RULE },
    { id: SMASHUP_FACTION_IDS.COWBOYS, nameKey: 'factions.cowboys.name', icon: CowboyHatIcon, color: '#92400e', descriptionKey: 'factions.cowboys.description', mechanicRule: DUEL_MECHANIC_RULE, locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.COWBOYS_POD, nameKey: 'factions.cowboys_pod.name', icon: CowboyHatIcon, color: '#92400e', descriptionKey: 'factions.cowboys_pod.description', mechanicRule: DUEL_MECHANIC_RULE },
    { id: SMASHUP_FACTION_IDS.ROBOTS, nameKey: 'factions.robots.name', icon: Bot, color: '#475569', descriptionKey: 'factions.robots.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.ROBOTS_POD, nameKey: 'factions.robots_pod.name', icon: Bot, color: '#475569', descriptionKey: 'factions.robots_pod.description' },
    { id: SMASHUP_FACTION_IDS.SAMURAI, nameKey: 'factions.samurai.name', icon: Sword, color: '#94a3b8', descriptionKey: 'factions.samurai.description', mechanicRule: DUEL_MECHANIC_RULE, locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.SAMURAI_POD, nameKey: 'factions.samurai_pod.name', icon: Sword, color: '#94a3b8', descriptionKey: 'factions.samurai_pod.description', mechanicRule: DUEL_MECHANIC_RULE },
    { id: SMASHUP_FACTION_IDS.ZOMBIES, nameKey: 'factions.zombies.name', icon: Skull, color: '#10b981', descriptionKey: 'factions.zombies.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.ZOMBIES_POD, nameKey: 'factions.zombies_pod.name', icon: Skull, color: '#10b981', descriptionKey: 'factions.zombies_pod.description' },
    { id: SMASHUP_FACTION_IDS.VIKINGS, nameKey: 'factions.vikings.name', icon: Axe, color: '#2563eb', descriptionKey: 'factions.vikings.description', mechanicRule: BURY_MECHANIC_RULE, locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.VIKINGS_POD, nameKey: 'factions.vikings_pod.name', icon: Axe, color: '#2563eb', descriptionKey: 'factions.vikings_pod.description', mechanicRule: BURY_MECHANIC_RULE },
    { id: SMASHUP_FACTION_IDS.WIZARDS, nameKey: 'factions.wizards.name', icon: Wand2, color: '#8b5cf6', descriptionKey: 'factions.wizards.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.WIZARDS_POD, nameKey: 'factions.wizards_pod.name', icon: Wand2, color: '#8b5cf6', descriptionKey: 'factions.wizards_pod.description' },
    { id: SMASHUP_FACTION_IDS.TRICKSTERS, nameKey: 'factions.tricksters.name', icon: Theater, color: '#f59e0b', descriptionKey: 'factions.tricksters.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.TRICKSTERS_POD, nameKey: 'factions.tricksters_pod.name', icon: Theater, color: '#f59e0b', descriptionKey: 'factions.tricksters_pod.description' },
    { id: SMASHUP_FACTION_IDS.STEAMPUNKS, nameKey: 'factions.steampunks.name', icon: Cog, color: '#b45309', descriptionKey: 'factions.steampunks.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.STEAMPUNKS_POD, nameKey: 'factions.steampunks_pod.name', icon: Cog, color: '#b45309', descriptionKey: 'factions.steampunks_pod.description' },
    { id: SMASHUP_FACTION_IDS.GHOSTS, nameKey: 'factions.ghosts.name', icon: Ghost, color: '#fca5a5', descriptionKey: 'factions.ghosts.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.GHOSTS_POD, nameKey: 'factions.ghosts_pod.name', icon: Ghost, color: '#fca5a5', descriptionKey: 'factions.ghosts_pod.description' },
    { id: SMASHUP_FACTION_IDS.KILLER_PLANTS, nameKey: 'factions.killer_plants.name', icon: Sprout, color: '#4d7c0f', descriptionKey: 'factions.killer_plants.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.KILLER_PLANTS_POD, nameKey: 'factions.killer_plants_pod.name', icon: Sprout, color: '#4d7c0f', descriptionKey: 'factions.killer_plants_pod.description' },
    { id: SMASHUP_FACTION_IDS.ROCK_STARS, nameKey: 'factions.rock_stars.name', icon: Medal, color: '#f59e0b', descriptionKey: 'factions.rock_stars.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.TEDDY_BEARS, nameKey: 'factions.teddy_bears.name', icon: PawPrint, color: '#c084fc', descriptionKey: 'factions.teddy_bears.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.GRANNIES, nameKey: 'factions.grannies.name', icon: Flower2, color: '#a16207', descriptionKey: 'factions.grannies.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.EXPLORERS, nameKey: 'factions.explorers.name', icon: Pyramid, color: '#ca8a04', descriptionKey: 'factions.explorers.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.ACTION_HEROES, nameKey: 'factions.action_heroes.name', icon: Medal, color: '#dc2626', descriptionKey: 'factions.action_heroes.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.ACTION_HEROES_POD, nameKey: 'factions.action_heroes_pod.name', icon: Medal, color: '#dc2626', descriptionKey: 'factions.action_heroes_pod.description' },
    { id: SMASHUP_FACTION_IDS.BACKTIMERS, nameKey: 'factions.backtimers.name', icon: Orbit, color: '#0d9488', descriptionKey: 'factions.backtimers.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.EXTRAMORPHS, nameKey: 'factions.extramorphs.name', icon: OctopusHeadIcon, color: '#16a34a', descriptionKey: 'factions.extramorphs.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.TEENS, nameKey: 'factions.teens.name', icon: Theater, color: '#db2777', descriptionKey: 'factions.teens.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.WRAITHRUSTLERS, nameKey: 'factions.wraithrustlers.name', icon: Ghost, color: '#7c3aed', descriptionKey: 'factions.wraithrustlers.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.EXPLORERS_POD, nameKey: 'factions.explorers_pod.name', icon: Pyramid, color: '#ca8a04', descriptionKey: 'factions.explorers_pod.description' },
    { id: SMASHUP_FACTION_IDS.BEAR_CAVALRY, nameKey: 'factions.bear_cavalry.name', icon: PawPrint, color: '#7c2d12', descriptionKey: 'factions.bear_cavalry.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD, nameKey: 'factions.bear_cavalry_pod.name', icon: PawPrint, color: '#7c2d12', descriptionKey: 'factions.bear_cavalry_pod.description' },
    { id: SMASHUP_FACTION_IDS.ASTROKNIGHTS, nameKey: 'factions.astroknights.name', icon: Sword, color: '#64748b', descriptionKey: 'factions.astroknights.description' },
    { id: SMASHUP_FACTION_IDS.IGNOBLES, nameKey: 'factions.ignobles.name', icon: Theater, color: '#be123c', descriptionKey: 'factions.ignobles.description' },
    { id: SMASHUP_FACTION_IDS.STAR_ROAMERS, nameKey: 'factions.star_roamers.name', icon: Orbit, color: '#7c3aed', descriptionKey: 'factions.star_roamers.description' },
    { id: SMASHUP_FACTION_IDS.STAR_ROAMERS_POD, nameKey: 'factions.star_roamers_pod.name', icon: Orbit, color: '#7c3aed', descriptionKey: 'factions.star_roamers_pod.description' },
    { id: SMASHUP_FACTION_IDS.CHANGERBOTS, nameKey: 'factions.changerbots.name', icon: Bot, color: '#0284c7', descriptionKey: 'factions.changerbots.description' },
    { id: SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU, nameKey: 'factions.minions_of_cthulhu.name', icon: Eye, color: '#4c1d95', descriptionKey: 'factions.minions_of_cthulhu.description', mechanicRule: MADNESS_MECHANIC_RULE },
    { id: SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU_POD, nameKey: 'factions.minions_of_cthulhu_pod.name', icon: Eye, color: '#4c1d95', descriptionKey: 'factions.minions_of_cthulhu_pod.description', mechanicRule: MADNESS_MECHANIC_RULE },
    { id: SMASHUP_FACTION_IDS.ELDER_THINGS, nameKey: 'factions.elder_things.name', icon: OctopusHeadIcon, color: '#0e7490', descriptionKey: 'factions.elder_things.description', mechanicRule: MADNESS_MECHANIC_RULE, locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.ELDER_THINGS_POD, nameKey: 'factions.elder_things_pod.name', icon: OctopusHeadIcon, color: '#0e7490', descriptionKey: 'factions.elder_things_pod.description', mechanicRule: MADNESS_MECHANIC_RULE },
    { id: SMASHUP_FACTION_IDS.INNSMOUTH, nameKey: 'factions.innsmouth.name', icon: Fish, color: '#06b6d4', descriptionKey: 'factions.innsmouth.description', mechanicRule: MADNESS_MECHANIC_RULE, locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.INNSMOUTH_POD, nameKey: 'factions.innsmouth_pod.name', icon: Fish, color: '#06b6d4', descriptionKey: 'factions.innsmouth_pod.description', mechanicRule: MADNESS_MECHANIC_RULE },
    { id: SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY, nameKey: 'factions.miskatonic_university.name', icon: GraduationCap, color: '#fcd34d', descriptionKey: 'factions.miskatonic_university.description', mechanicRule: MADNESS_MECHANIC_RULE },
    { id: SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY_POD, nameKey: 'factions.miskatonic_university_pod.name', icon: GraduationCap, color: '#fcd34d', descriptionKey: 'factions.miskatonic_university_pod.description', mechanicRule: MADNESS_MECHANIC_RULE },
    { id: SMASHUP_FACTION_IDS.FRANKENSTEIN, nameKey: 'factions.frankenstein.name', icon: FlaskConical, color: '#65a30d', descriptionKey: 'factions.frankenstein.description', mechanicRule: POWER_COUNTER_MECHANIC_RULE, locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.FRANKENSTEIN_POD, nameKey: 'factions.frankenstein_pod.name', icon: FlaskConical, color: '#65a30d', descriptionKey: 'factions.frankenstein_pod.description', mechanicRule: POWER_COUNTER_MECHANIC_RULE },
    { id: SMASHUP_FACTION_IDS.WEREWOLVES, nameKey: 'factions.werewolves.name', icon: Moon, color: '#78716c', descriptionKey: 'factions.werewolves.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.WEREWOLVES_POD, nameKey: 'factions.werewolves_pod.name', icon: Moon, color: '#78716c', descriptionKey: 'factions.werewolves_pod.description' },
    { id: SMASHUP_FACTION_IDS.VAMPIRES, nameKey: 'factions.vampires.name', icon: Droplet, color: '#991b1b', descriptionKey: 'factions.vampires.description', mechanicRule: POWER_COUNTER_MECHANIC_RULE, locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.VAMPIRES_POD, nameKey: 'factions.vampires_pod.name', icon: Droplet, color: '#991b1b', descriptionKey: 'factions.vampires_pod.description', mechanicRule: POWER_COUNTER_MECHANIC_RULE },
    { id: SMASHUP_FACTION_IDS.GIANT_ANTS, nameKey: 'factions.giant_ants.name', icon: AntIcon, color: '#ca8a04', descriptionKey: 'factions.giant_ants.description', mechanicRule: POWER_COUNTER_MECHANIC_RULE },
    { id: SMASHUP_FACTION_IDS.GIANT_ANTS_POD, nameKey: 'factions.giant_ants_pod.name', icon: AntIcon, color: '#ca8a04', descriptionKey: 'factions.giant_ants_pod.description', mechanicRule: POWER_COUNTER_MECHANIC_RULE },
    { id: SMASHUP_FACTION_IDS.MERMAIDS, nameKey: 'factions.mermaids.name', icon: Fish, color: '#0ea5e9', descriptionKey: 'factions.mermaids.description' },
    { id: SMASHUP_FACTION_IDS.MERMAIDS_POD, nameKey: 'factions.mermaids_pod.name', icon: Fish, color: '#0ea5e9', descriptionKey: 'factions.mermaids_pod.description' },
    { id: SMASHUP_FACTION_IDS.KITTY_CATS, nameKey: 'factions.kitty_cats.name', icon: PawPrint, color: '#c026d3', descriptionKey: 'factions.kitty_cats.description' },
    { id: SMASHUP_FACTION_IDS.KITTY_CATS_POD, nameKey: 'factions.kitty_cats_pod.name', icon: PawPrint, color: '#c026d3', descriptionKey: 'factions.kitty_cats_pod.description' },
    { id: SMASHUP_FACTION_IDS.MYTHIC_HORSES, nameKey: 'factions.mythic_horses.name', icon: Rainbow, color: '#14b8a6', descriptionKey: 'factions.mythic_horses.description' },
    { id: SMASHUP_FACTION_IDS.MYTHIC_HORSES_POD, nameKey: 'factions.mythic_horses_pod.name', icon: Rainbow, color: '#14b8a6', descriptionKey: 'factions.mythic_horses_pod.description' },
    { id: SMASHUP_FACTION_IDS.FAIRIES, nameKey: 'factions.fairies.name', icon: Flower2, color: '#ec4899', descriptionKey: 'factions.fairies.description' },
    { id: SMASHUP_FACTION_IDS.FAIRIES_POD, nameKey: 'factions.fairies_pod.name', icon: Flower2, color: '#ec4899', descriptionKey: 'factions.fairies_pod.description' },
    { id: SMASHUP_FACTION_IDS.HULUWAWA, nameKey: 'factions.huluwawa.name', icon: Grape, color: '#15803d', descriptionKey: 'factions.huluwawa.description', locales: ['zh-CN'], expansion: 'diy' },
    {
        id: SMASHUP_FACTION_IDS.ROUND_TABLE_KNIGHTS,
        nameKey: 'factions.round_table_knights.name',
        icon: Shield,
        color: '#b45309',
        descriptionKey: 'factions.round_table_knights.description',
        locales: ['zh-CN'],
    },
    {
        id: SMASHUP_FACTION_IDS.GOBLINS,
        nameKey: 'factions.goblins.name',
        icon: VenetianMask,
        color: '#16a34a',
        descriptionKey: 'factions.goblins.description',
        mechanicRule: POWER_COUNTER_MECHANIC_RULE,
        locales: ['zh-CN'],
    },
    { id: SMASHUP_FACTION_IDS.MUNCHKIN_DWARVES, nameKey: 'factions.munchkin_dwarves.name', icon: Pickaxe, color: '#92400e', descriptionKey: 'factions.munchkin_dwarves.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.MUNCHKIN_HALFLINGS, nameKey: 'factions.munchkin_halflings.name', icon: LeafyGreen, color: '#65a30d', descriptionKey: 'factions.munchkin_halflings.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.MUNCHKIN_THIEVES, nameKey: 'factions.munchkin_thieves.name', icon: KeyRound, color: '#334155', descriptionKey: 'factions.munchkin_thieves.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.MUNCHKIN_MAGES, nameKey: 'factions.munchkin_mages.name', icon: Wand2, color: '#7c3aed', descriptionKey: 'factions.munchkin_mages.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.MUNCHKIN_ELVES, nameKey: 'factions.munchkin_elves.name', icon: Leaf, color: '#16a34a', descriptionKey: 'factions.munchkin_elves.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.MUNCHKIN_CLERICS, nameKey: 'factions.munchkin_clerics.name', icon: Cross, color: '#0ea5e9', descriptionKey: 'factions.munchkin_clerics.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.MUNCHKIN_ORCS, nameKey: 'factions.munchkin_orcs.name', icon: Skull, color: '#166534', descriptionKey: 'factions.munchkin_orcs.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.MUNCHKIN_WARRIORS, nameKey: 'factions.munchkin_warriors.name', icon: Swords, color: '#dc2626', descriptionKey: 'factions.munchkin_warriors.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.PALADINS, nameKey: 'factions.paladins.name', icon: ShieldCheck, color: '#2563eb', descriptionKey: 'factions.paladins.description' },
    { id: SMASHUP_FACTION_IDS.DIY_KILLERS, nameKey: 'factions.diy_killers.name', icon: Axe, color: '#991b1b', descriptionKey: 'factions.diy_killers.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.DIY_CLOWNS, nameKey: 'factions.diy_clowns.name', icon: Drama, color: '#e11d48', descriptionKey: 'factions.diy_clowns.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.PRINCESSES, nameKey: 'factions.princesses.name', icon: Crown, color: '#f59eb8', descriptionKey: 'factions.princesses.description' },
    { id: SMASHUP_FACTION_IDS.PRINCESSES_POD, nameKey: 'factions.princesses_pod.name', icon: Crown, color: '#f59eb8', descriptionKey: 'factions.princesses_pod.description' },
    { id: SMASHUP_FACTION_IDS.SHARKS, nameKey: 'factions.sharks.name', icon: Fish, color: '#0e7490', descriptionKey: 'factions.sharks.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.SHARKS_POD, nameKey: 'factions.sharks_pod.name', icon: Fish, color: '#0e7490', descriptionKey: 'factions.sharks_pod.description' },
    { id: SMASHUP_FACTION_IDS.TORNADOS, nameKey: 'factions.tornados.name', icon: Tornado, color: '#64748b', descriptionKey: 'factions.tornados.description' },
    { id: SMASHUP_FACTION_IDS.TORNADOS_POD, nameKey: 'factions.tornados_pod.name', icon: Tornado, color: '#64748b', descriptionKey: 'factions.tornados_pod.description' },
    { id: SMASHUP_FACTION_IDS.PENGUINS, nameKey: 'factions.penguins.name', icon: Snowflake, color: '#0ea5e9', descriptionKey: 'factions.penguins.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.MYTHIC_GREEKS, nameKey: 'factions.mythic_greeks.name', icon: Landmark, color: '#f59e0b', descriptionKey: 'factions.mythic_greeks.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.MYTHIC_GREEKS_POD, nameKey: 'factions.mythic_greeks_pod.name', icon: Landmark, color: '#f59e0b', descriptionKey: 'factions.mythic_greeks_pod.description' },
    {
        id: SMASHUP_FACTION_IDS.KUNG_FU_FIGHTERS,
        nameKey: 'factions.kung_fu_fighters.name',
        icon: HandFist,
        color: '#b45309',
        descriptionKey: 'factions.kung_fu_fighters.description',
        locales: ['zh-CN'],
    },
    {
        id: SMASHUP_FACTION_IDS.VIGILANTES,
        nameKey: 'factions.vigilantes.name',
        icon: Crosshair,
        color: '#334155',
        descriptionKey: 'factions.vigilantes.description',
        locales: ['zh-CN'],
    },
    { id: SMASHUP_FACTION_IDS.VIGILANTES_POD, nameKey: 'factions.vigilantes_pod.name', icon: Crosshair, color: '#334155', descriptionKey: 'factions.vigilantes_pod.description' },
    {
        id: SMASHUP_FACTION_IDS.TRUCKERS,
        nameKey: 'factions.truckers.name',
        icon: Truck,
        color: '#ea580c',
        descriptionKey: 'factions.truckers.description',
        locales: ['zh-CN'],
    },
    {
        id: SMASHUP_FACTION_IDS.DISCO_DANCERS,
        nameKey: 'factions.disco_dancers.name',
        icon: Disc3,
        color: '#0d9488',
        descriptionKey: 'factions.disco_dancers.description',
        locales: ['zh-CN'],
    },
    { id: SMASHUP_FACTION_IDS.DRAGONS, nameKey: 'factions.dragons.name', icon: Flame, color: '#b91c1c', descriptionKey: 'factions.dragons.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.DRAGONS_POD, nameKey: 'factions.dragons_pod.name', icon: Flame, color: '#b91c1c', descriptionKey: 'factions.dragons_pod.description' },
    { id: SMASHUP_FACTION_IDS.SUPERHEROES, nameKey: 'factions.superheroes.name', icon: BicepsFlexed, color: '#2563eb', descriptionKey: 'factions.superheroes.description' },
    { id: SMASHUP_FACTION_IDS.SUPERHEROES_POD, nameKey: 'factions.superheroes_pod.name', icon: BicepsFlexed, color: '#2563eb', descriptionKey: 'factions.superheroes_pod.description' },
    { id: SMASHUP_FACTION_IDS.SUMO_WRESTLERS, nameKey: 'factions.sumo_wrestlers.name', icon: Dumbbell, color: '#a16207', descriptionKey: 'factions.sumo_wrestlers.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.MUSKETEERS, nameKey: 'factions.musketeers.name', icon: Sword, color: '#2563eb', descriptionKey: 'factions.musketeers.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.MOUNTIES, nameKey: 'factions.mounties.name', icon: Badge, color: '#dc2626', descriptionKey: 'factions.mounties.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.LUCHADORS, nameKey: 'factions.luchadors.name', icon: Theater, color: '#7c3aed', descriptionKey: 'factions.luchadors.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.LUCHADORS_POD, nameKey: 'factions.luchadors_pod.name', icon: Theater, color: '#7c3aed', descriptionKey: 'factions.luchadors_pod.description' },
    {
        id: SMASHUP_FACTION_IDS.AVENGERS,
        nameKey: 'factions.avengers.name',
        icon: ShieldAlert,
        color: '#1d4ed8',
        descriptionKey: 'factions.avengers.description',
        locales: ['zh-CN'],
    },
    {
        id: SMASHUP_FACTION_IDS.AVENGERS_POD,
        nameKey: 'factions.avengers_pod.name',
        icon: ShieldAlert,
        color: '#1d4ed8',
        descriptionKey: 'factions.avengers_pod.description',
    },
    {
        id: SMASHUP_FACTION_IDS.SHIELD,
        nameKey: 'factions.shield.name',
        icon: ShieldHalf,
        color: '#0f172a',
        descriptionKey: 'factions.shield.description',
        locales: ['zh-CN'],
    },
    {
        id: SMASHUP_FACTION_IDS.SHIELD_POD,
        nameKey: 'factions.shield_pod.name',
        icon: ShieldHalf,
        color: '#0f172a',
        descriptionKey: 'factions.shield_pod.description',
    },
    {
        id: SMASHUP_FACTION_IDS.SPIDER_VERSE,
        nameKey: 'factions.spider_verse.name',
        icon: Orbit,
        color: '#dc2626',
        descriptionKey: 'factions.spider_verse.description',
        locales: ['zh-CN'],
    },
    {
        id: SMASHUP_FACTION_IDS.SPIDER_VERSE_POD,
        nameKey: 'factions.spider_verse_pod.name',
        icon: Orbit,
        color: '#dc2626',
        descriptionKey: 'factions.spider_verse_pod.description',
    },
    {
        id: SMASHUP_FACTION_IDS.ULTIMATES,
        nameKey: 'factions.ultimates.name',
        icon: Sparkles,
        color: '#7c3aed',
        descriptionKey: 'factions.ultimates.description',
        locales: ['zh-CN'],
    },
    {
        id: SMASHUP_FACTION_IDS.ULTIMATES_POD,
        nameKey: 'factions.ultimates_pod.name',
        icon: Sparkles,
        color: '#7c3aed',
        descriptionKey: 'factions.ultimates_pod.description',
    },
    {
        id: SMASHUP_FACTION_IDS.HYDRA,
        nameKey: 'factions.hydra.name',
        icon: GitFork,
        color: '#166534',
        descriptionKey: 'factions.hydra.description',
        locales: ['zh-CN'],
    },
    {
        id: SMASHUP_FACTION_IDS.HYDRA_POD,
        nameKey: 'factions.hydra_pod.name',
        icon: GitFork,
        color: '#166534',
        descriptionKey: 'factions.hydra_pod.description',
    },
    {
        id: SMASHUP_FACTION_IDS.KREE,
        nameKey: 'factions.kree.name',
        icon: Satellite,
        color: '#0284c7',
        descriptionKey: 'factions.kree.description',
        locales: ['zh-CN'],
    },
    {
        id: SMASHUP_FACTION_IDS.KREE_POD,
        nameKey: 'factions.kree_pod.name',
        icon: Satellite,
        color: '#0284c7',
        descriptionKey: 'factions.kree_pod.description',
    },
    {
        id: SMASHUP_FACTION_IDS.MASTERS_OF_EVIL,
        nameKey: 'factions.masters_of_evil.name',
        icon: BadgeAlert,
        color: '#7f1d1d',
        descriptionKey: 'factions.masters_of_evil.description',
        locales: ['zh-CN'],
    },
    {
        id: SMASHUP_FACTION_IDS.MASTERS_OF_EVIL_POD,
        nameKey: 'factions.masters_of_evil_pod.name',
        icon: BadgeAlert,
        color: '#7f1d1d',
        descriptionKey: 'factions.masters_of_evil_pod.description',
    },
    {
        id: SMASHUP_FACTION_IDS.SINISTER_SIX,
        nameKey: 'factions.sinister_six.name',
        icon: Dice6,
        color: '#581c87',
        descriptionKey: 'factions.sinister_six.description',
        locales: ['zh-CN'],
    },
    {
        id: SMASHUP_FACTION_IDS.SINISTER_SIX_POD,
        nameKey: 'factions.sinister_six_pod.name',
        icon: Dice6,
        color: '#581c87',
        descriptionKey: 'factions.sinister_six_pod.description',
    },
    {
        id: SMASHUP_FACTION_IDS.ALADDIN,
        nameKey: 'factions.aladdin.name',
        icon: SvgRepoMagicLampIcon,
        color: '#d97706',
        descriptionKey: 'factions.aladdin.description',
        locales: ['zh-CN'],
    },
    {
        id: SMASHUP_FACTION_IDS.BEAUTY_AND_THE_BEAST,
        nameKey: 'factions.beauty_and_the_beast.name',
        icon: Rose,
        color: '#be185d',
        descriptionKey: 'factions.beauty_and_the_beast.description',
        locales: ['zh-CN'],
    },
    {
        id: SMASHUP_FACTION_IDS.NIGHTMARE_BEFORE_CHRISTMAS,
        nameKey: 'factions.nightmare_before_christmas.name',
        icon: Ghost,
        color: '#4b5563',
        descriptionKey: 'factions.nightmare_before_christmas.description',
        locales: ['zh-CN'],
    },
    {
        id: SMASHUP_FACTION_IDS.WRECK_IT_RALPH,
        nameKey: 'factions.wreck_it_ralph.name',
        icon: Hammer,
        color: '#dc2626',
        descriptionKey: 'factions.wreck_it_ralph.description',
        locales: ['zh-CN'],
    },
    { id: SMASHUP_FACTION_IDS.ANANSI_TALES, nameKey: 'factions.anansi_tales.name', icon: Bug, color: '#b45309', descriptionKey: 'factions.anansi_tales.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.ANANSI_TALES_POD, nameKey: 'factions.anansi_tales_pod.name', icon: Bug, color: '#b45309', descriptionKey: 'factions.anansi_tales_pod.description' },
    { id: SMASHUP_FACTION_IDS.GRIMMS_FAIRY_TALES, nameKey: 'factions.grimms_fairy_tales.name', icon: BookOpen, color: '#9333ea', descriptionKey: 'factions.grimms_fairy_tales.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.RUSSIAN_FAIRY_TALES, nameKey: 'factions.russian_fairy_tales.name', icon: BookMarked, color: '#475569', descriptionKey: 'factions.russian_fairy_tales.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.RUSSIAN_FAIRY_TALES_POD, nameKey: 'factions.russian_fairy_tales_pod.name', icon: BookMarked, color: '#475569', descriptionKey: 'factions.russian_fairy_tales_pod.description' },
    { id: SMASHUP_FACTION_IDS.ANCIENT_INCAS, nameKey: 'factions.ancient_incas.name', icon: Sun, color: '#ca8a04', descriptionKey: 'factions.ancient_incas.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.POLYNESIAN_VOYAGERS, nameKey: 'factions.polynesian_voyagers.name', icon: Sailboat, color: '#0f766e', descriptionKey: 'factions.polynesian_voyagers.description', mechanicRule: POWER_COUNTER_MECHANIC_RULE, locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.GEEKS, nameKey: 'factions.geeks.name', icon: Glasses, color: '#16a34a', descriptionKey: 'factions.geeks.description' },
    { id: SMASHUP_FACTION_IDS.ADOLESCENT_EPIC_GECKOS, nameKey: 'factions.adolescent_epic_geckos.name', icon: Turtle, color: '#16a34a', descriptionKey: 'factions.adolescent_epic_geckos.description' },
    { id: SMASHUP_FACTION_IDS.GI_GERALD, nameKey: 'factions.gi_gerald.name', icon: BadgeCheck, color: '#2563eb', descriptionKey: 'factions.gi_gerald.description' },
    { id: SMASHUP_FACTION_IDS.RULERS_OF_THE_COSMOS, nameKey: 'factions.rulers_of_the_cosmos.name', icon: Telescope, color: '#f59e0b', descriptionKey: 'factions.rulers_of_the_cosmos.description' },
    { id: SMASHUP_FACTION_IDS.PEARL_AND_THE_IMAGES, nameKey: 'factions.pearl_and_the_images.name', icon: Gem, color: '#db2777', descriptionKey: 'factions.pearl_and_the_images.description' },
    { id: SMASHUP_FACTION_IDS.SHAPESHIFTERS, nameKey: 'factions.shapeshifters.name', icon: ShapeshifterIcon, color: '#db2777', descriptionKey: 'factions.shapeshifters.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.SHAPESHIFTERS_POD, nameKey: 'factions.shapeshifters_pod.name', icon: ShapeshifterIcon, color: '#db2777', descriptionKey: 'factions.shapeshifters_pod.description' },
    { id: SMASHUP_FACTION_IDS.CYBORG_APES, nameKey: 'factions.cyborg_apes.name', icon: Bot, color: '#84cc16', descriptionKey: 'factions.cyborg_apes.description' },
    { id: SMASHUP_FACTION_IDS.SUPER_SPIES, nameKey: 'factions.super_spies.name', icon: HatGlasses, color: '#dc2626', descriptionKey: 'factions.super_spies.description' },
    { id: SMASHUP_FACTION_IDS.TIME_TRAVELERS, nameKey: 'factions.time_travelers.name', icon: Clock, color: '#0d9488', descriptionKey: 'factions.time_travelers.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.TIME_TRAVELERS_POD, nameKey: 'factions.time_travelers_pod.name', icon: Clock, color: '#0d9488', descriptionKey: 'factions.time_travelers_pod.description' },
    { id: SMASHUP_FACTION_IDS.ITTY_CRITTERS, nameKey: 'factions.itty_critters.name', icon: PawPrint, color: '#facc15', descriptionKey: 'factions.itty_critters.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.ITTY_CRITTERS_POD, nameKey: 'factions.itty_critters_pod.name', icon: PawPrint, color: '#facc15', descriptionKey: 'factions.itty_critters_pod.description' },
    { id: SMASHUP_FACTION_IDS.KAIJU, nameKey: 'factions.kaiju.name', icon: Mountain, color: '#be123c', descriptionKey: 'factions.kaiju.description' },
    { id: SMASHUP_FACTION_IDS.KAIJU_POD, nameKey: 'factions.kaiju_pod.name', icon: Mountain, color: '#be123c', descriptionKey: 'factions.kaiju_pod.description' },
    { id: SMASHUP_FACTION_IDS.MAGICAL_GIRLS, nameKey: 'factions.magical_girls.name', icon: Sparkle, color: '#ec4899', descriptionKey: 'factions.magical_girls.description' },
    { id: SMASHUP_FACTION_IDS.MAGICAL_GIRLS_POD, nameKey: 'factions.magical_girls_pod.name', icon: Sparkle, color: '#ec4899', descriptionKey: 'factions.magical_girls_pod.description' },
    { id: SMASHUP_FACTION_IDS.MEGA_TROOPERS, nameKey: 'factions.mega_troopers.name', icon: Zap, color: '#dc2626', descriptionKey: 'factions.mega_troopers.description' },
    { id: SMASHUP_FACTION_IDS.MEGA_TROOPERS_POD, nameKey: 'factions.mega_troopers_pod.name', icon: Zap, color: '#dc2626', descriptionKey: 'factions.mega_troopers_pod.description' },
    { id: SMASHUP_FACTION_IDS.BIG_HERO_6, nameKey: 'factions.big_hero_6.name', icon: HeartPulse, color: '#dc2626', descriptionKey: 'factions.big_hero_6.description', mechanicRule: POWER_COUNTER_MECHANIC_RULE },
    { id: SMASHUP_FACTION_IDS.FROZEN, nameKey: 'factions.frozen.name', icon: Castle, color: '#0ea5e9', descriptionKey: 'factions.frozen.description' },
    { id: SMASHUP_FACTION_IDS.LION_KING, nameKey: 'factions.lion_king.name', icon: Sunrise, color: '#f59e0b', descriptionKey: 'factions.lion_king.description', mechanicRule: POWER_COUNTER_MECHANIC_RULE },
    { id: SMASHUP_FACTION_IDS.MULAN, nameKey: 'factions.mulan.name', icon: Flower2, color: '#b91c1c', descriptionKey: 'factions.mulan.description', mechanicRule: POWER_COUNTER_MECHANIC_RULE },
    { id: SMASHUP_FACTION_IDS.SKELETONS, nameKey: 'factions.skeletons.name', icon: Bone, color: '#6b7280', descriptionKey: 'factions.skeletons.description', mechanicRule: BURY_MECHANIC_RULE, locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.SKELETONS_POD, nameKey: 'factions.skeletons_pod.name', icon: Bone, color: '#6b7280', descriptionKey: 'factions.skeletons_pod.description', mechanicRule: BURY_MECHANIC_RULE },
    { id: SMASHUP_FACTION_IDS.WORLD_CHAMPS, nameKey: 'factions.world_champs.name', icon: Award, color: '#eab308', descriptionKey: 'factions.world_champs.description' },
    { id: SMASHUP_FACTION_IDS.SHEEP, nameKey: 'factions.sheep.name', icon: Cloud, color: '#84cc16', descriptionKey: 'factions.sheep.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.ALL_STARS, nameKey: 'factions.all_stars.name', icon: Medal, color: '#f59e0b', descriptionKey: 'factions.all_stars.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.ALL_STARS_POD, nameKey: 'factions.all_stars_pod.name', icon: Medal, color: '#eab308', descriptionKey: 'factions.all_stars_pod.description' },
    // POD 版本阵营：英文和中文都显示（英文用户的主版本）
    { id: SMASHUP_FACTION_IDS.NINJAS_POD, nameKey: 'factions.ninjas_pod.name', icon: ShurikenIcon, color: '#991b1b', descriptionKey: 'factions.ninjas_pod.description' },
];

export const FACTION_VARIANT_GROUPS: FactionVariantGroup[] = (() => {
    const groups = new Map<string, FactionVariantGroup>();

    for (const faction of FACTION_METADATA) {
        const groupId = toFactionGroupId(faction.id);
        const existing = groups.get(groupId);
        if (existing) {
            existing.variants.push(faction);
            continue;
        }

        groups.set(groupId, {
            groupId,
            icon: faction.icon,
            color: faction.color,
            variants: [faction],
        });
    }

    return Array.from(groups.values()).map((group) => ({
        ...group,
        variants: [...group.variants].sort((left, right) => {
            const leftScore = left.id.endsWith(POD_SUFFIX) ? 1 : 0;
            const rightScore = right.id.endsWith(POD_SUFFIX) ? 1 : 0;
            return leftScore - rightScore;
        }),
    }));
})();

export function getVisibleFactionMetadata(locale: string, enabledExpansions: readonly string[] = ['titans', 'diy']): FactionMeta[] {
    return FACTION_METADATA.filter((faction) =>
        isFactionVisibleInLocale(faction, locale)
        && isFactionEnabledInExpansions(faction, enabledExpansions),
    );
}

export function getVisibleFactionVariantGroups(locale: string, enabledExpansions: readonly string[] = ['titans', 'diy']): Array<FactionVariantGroup & { defaultVariant: FactionMeta }> {
    return FACTION_VARIANT_GROUPS
        .map((group) => {
            const visibleVariants = group.variants.filter((variant) =>
                isFactionVisibleInLocale(variant, locale)
                && isFactionEnabledInExpansions(variant, enabledExpansions),
            );
            if (visibleVariants.length === 0) return null;
            return {
                ...group,
                variants: visibleVariants,
                defaultVariant: preferBaseVariant(visibleVariants, locale),
            };
        })
        .filter((group): group is FactionVariantGroup & { defaultVariant: FactionMeta } => Boolean(group));
}

export function getFactionVariantGroupById(factionId: string): FactionVariantGroup | undefined {
    const groupId = toFactionGroupId(factionId);
    return FACTION_VARIANT_GROUPS.find((group) => group.groupId === groupId);
}

export function getPreferredFactionVariant(groupId: string, locale: string, enabledExpansions: readonly string[] = ['titans', 'diy']): FactionMeta | undefined {
    const group = getFactionVariantGroupById(groupId);
    if (!group) return undefined;
    const enabledVariants = group.variants.filter((variant) => isFactionEnabledInExpansions(variant, enabledExpansions));
    if (enabledVariants.length === 0) return undefined;
    return preferBaseVariant(enabledVariants, locale);
}

export function getFactionMeta(id: string): FactionMeta | undefined {
    return FACTION_METADATA.find(f => f.id === id);
}

export function isFactionImplementationInProgress(factionId: string): boolean {
    return isSmashUpFactionImplementationInProgress(factionId);
}

const FACTION_MECHANIC_TUTORIALS: Record<string, FactionMechanicTutorialMeta> = {
    [SMASHUP_FACTION_IDS.COWBOYS]: {
        tutorialId: 'cowboys-duel',
        titleKey: 'tutorial.subTutorials.cowboysDuel.title',
        descriptionKey: 'tutorial.subTutorials.cowboysDuel.description',
    },
};

export function getFactionMechanicTutorial(groupId: string): FactionMechanicTutorialMeta | undefined {
    return FACTION_MECHANIC_TUTORIALS[groupId];
}
