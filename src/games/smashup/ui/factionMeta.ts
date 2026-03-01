
import {
    Anchor,
    Bone,
    Bot,
    Cog,
    Crosshair,
    Droplet,
    Eye,
    Fish,
    FlaskConical,
    Ghost,
    GraduationCap,
    Moon,
    Orbit,
    PawPrint,
    Skull,
    Snowflake,
    Sprout,
    Theater,
    Wand2,
    type LucideIcon,
} from 'lucide-react';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { ShurikenIcon, OctopusHeadIcon, AntIcon } from './icons/CustomIcons';

export interface FactionMeta {
    id: string;
    nameKey: string;
    icon: LucideIcon | React.FC<any>;
    color: string;
    descriptionKey: string;
    /** 可选：限制仅在哪些语言界面中显示此阵营，不填则全语言显示 */
    locales?: string[];
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
    { id: SMASHUP_FACTION_IDS.ROBOTS, nameKey: 'factions.robots.name', icon: Bot, color: '#475569', descriptionKey: 'factions.robots.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.ROBOTS_POD, nameKey: 'factions.robots_pod.name', icon: Bot, color: '#475569', descriptionKey: 'factions.robots_pod.description' },
    { id: SMASHUP_FACTION_IDS.ZOMBIES, nameKey: 'factions.zombies.name', icon: Skull, color: '#10b981', descriptionKey: 'factions.zombies.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.ZOMBIES_POD, nameKey: 'factions.zombies_pod.name', icon: Skull, color: '#10b981', descriptionKey: 'factions.zombies_pod.description' },
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
    { id: SMASHUP_FACTION_IDS.BEAR_CAVALRY, nameKey: 'factions.bear_cavalry.name', icon: PawPrint, color: '#7c2d12', descriptionKey: 'factions.bear_cavalry.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD, nameKey: 'factions.bear_cavalry_pod.name', icon: PawPrint, color: '#7c2d12', descriptionKey: 'factions.bear_cavalry_pod.description' },
    { id: SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU, nameKey: 'factions.minions_of_cthulhu.name', icon: Eye, color: '#4c1d95', descriptionKey: 'factions.minions_of_cthulhu.description' },
    { id: SMASHUP_FACTION_IDS.ELDER_THINGS, nameKey: 'factions.elder_things.name', icon: OctopusHeadIcon, color: '#0e7490', descriptionKey: 'factions.elder_things.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.ELDER_THINGS_POD, nameKey: 'factions.elder_things_pod.name', icon: OctopusHeadIcon, color: '#0e7490', descriptionKey: 'factions.elder_things_pod.description' },
    { id: SMASHUP_FACTION_IDS.INNSMOUTH, nameKey: 'factions.innsmouth.name', icon: Fish, color: '#06b6d4', descriptionKey: 'factions.innsmouth.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.INNSMOUTH_POD, nameKey: 'factions.innsmouth_pod.name', icon: Fish, color: '#06b6d4', descriptionKey: 'factions.innsmouth_pod.description' },
    { id: SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY, nameKey: 'factions.miskatonic_university.name', icon: GraduationCap, color: '#fcd34d', descriptionKey: 'factions.miskatonic_university.description' },
    { id: SMASHUP_FACTION_IDS.FRANKENSTEIN, nameKey: 'factions.frankenstein.name', icon: FlaskConical, color: '#65a30d', descriptionKey: 'factions.frankenstein.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.FRANKENSTEIN_POD, nameKey: 'factions.frankenstein_pod.name', icon: FlaskConical, color: '#65a30d', descriptionKey: 'factions.frankenstein_pod.description' },
    { id: SMASHUP_FACTION_IDS.WEREWOLVES, nameKey: 'factions.werewolves.name', icon: Moon, color: '#78716c', descriptionKey: 'factions.werewolves.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.WEREWOLVES_POD, nameKey: 'factions.werewolves_pod.name', icon: Moon, color: '#78716c', descriptionKey: 'factions.werewolves_pod.description' },
    { id: SMASHUP_FACTION_IDS.VAMPIRES, nameKey: 'factions.vampires.name', icon: Droplet, color: '#991b1b', descriptionKey: 'factions.vampires.description', locales: ['zh-CN'] },
    { id: SMASHUP_FACTION_IDS.VAMPIRES_POD, nameKey: 'factions.vampires_pod.name', icon: Droplet, color: '#991b1b', descriptionKey: 'factions.vampires_pod.description' },
    { id: SMASHUP_FACTION_IDS.GIANT_ANTS, nameKey: 'factions.giant_ants.name', icon: AntIcon, color: '#ca8a04', descriptionKey: 'factions.giant_ants.description' },
    // POD 版本阵营：英文和中文都显示（英文用户的主版本）
    { id: SMASHUP_FACTION_IDS.NINJAS_POD, nameKey: 'factions.ninjas_pod.name', icon: ShurikenIcon, color: '#991b1b', descriptionKey: 'factions.ninjas_pod.description' },
];

export function getFactionMeta(id: string): FactionMeta | undefined {
    return FACTION_METADATA.find(f => f.id === id);
}
