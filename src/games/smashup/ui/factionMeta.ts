
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
}

export const FACTION_METADATA: FactionMeta[] = [
    { id: SMASHUP_FACTION_IDS.PIRATES, nameKey: 'factions.pirates.name', icon: Anchor, color: '#1e293b', descriptionKey: 'factions.pirates.description' },
    { id: SMASHUP_FACTION_IDS.NINJAS, nameKey: 'factions.ninjas.name', icon: ShurikenIcon, color: '#7f1d1d', descriptionKey: 'factions.ninjas.description' },
    { id: SMASHUP_FACTION_IDS.DINOSAURS, nameKey: 'factions.dinosaurs.name', icon: Bone, color: '#15803d', descriptionKey: 'factions.dinosaurs.description' },
    { id: SMASHUP_FACTION_IDS.ALIENS, nameKey: 'factions.aliens.name', icon: Orbit, color: '#0ea5e9', descriptionKey: 'factions.aliens.description' },
    { id: SMASHUP_FACTION_IDS.ROBOTS, nameKey: 'factions.robots.name', icon: Bot, color: '#475569', descriptionKey: 'factions.robots.description' },
    { id: SMASHUP_FACTION_IDS.ZOMBIES, nameKey: 'factions.zombies.name', icon: Skull, color: '#10b981', descriptionKey: 'factions.zombies.description' },
    { id: SMASHUP_FACTION_IDS.WIZARDS, nameKey: 'factions.wizards.name', icon: Wand2, color: '#8b5cf6', descriptionKey: 'factions.wizards.description' },
    { id: SMASHUP_FACTION_IDS.TRICKSTERS, nameKey: 'factions.tricksters.name', icon: Theater, color: '#f59e0b', descriptionKey: 'factions.tricksters.description' },
    { id: SMASHUP_FACTION_IDS.STEAMPUNKS, nameKey: 'factions.steampunks.name', icon: Cog, color: '#b45309', descriptionKey: 'factions.steampunks.description' },
    { id: SMASHUP_FACTION_IDS.GHOSTS, nameKey: 'factions.ghosts.name', icon: Ghost, color: '#fca5a5', descriptionKey: 'factions.ghosts.description' },
    { id: SMASHUP_FACTION_IDS.KILLER_PLANTS, nameKey: 'factions.killer_plants.name', icon: Sprout, color: '#4d7c0f', descriptionKey: 'factions.killer_plants.description' },
    { id: SMASHUP_FACTION_IDS.BEAR_CAVALRY, nameKey: 'factions.bear_cavalry.name', icon: PawPrint, color: '#7c2d12', descriptionKey: 'factions.bear_cavalry.description' },
    { id: SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU, nameKey: 'factions.minions_of_cthulhu.name', icon: Eye, color: '#4c1d95', descriptionKey: 'factions.minions_of_cthulhu.description' },
    { id: SMASHUP_FACTION_IDS.ELDER_THINGS, nameKey: 'factions.elder_things.name', icon: OctopusHeadIcon, color: '#0e7490', descriptionKey: 'factions.elder_things.description' },
    { id: SMASHUP_FACTION_IDS.INNSMOUTH, nameKey: 'factions.innsmouth.name', icon: Fish, color: '#06b6d4', descriptionKey: 'factions.innsmouth.description' },
    { id: SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY, nameKey: 'factions.miskatonic_university.name', icon: GraduationCap, color: '#fcd34d', descriptionKey: 'factions.miskatonic_university.description' },
    { id: SMASHUP_FACTION_IDS.FRANKENSTEIN, nameKey: 'factions.frankenstein.name', icon: FlaskConical, color: '#65a30d', descriptionKey: 'factions.frankenstein.description' },
    { id: SMASHUP_FACTION_IDS.WEREWOLVES, nameKey: 'factions.werewolves.name', icon: Moon, color: '#78716c', descriptionKey: 'factions.werewolves.description' },
    { id: SMASHUP_FACTION_IDS.VAMPIRES, nameKey: 'factions.vampires.name', icon: Droplet, color: '#991b1b', descriptionKey: 'factions.vampires.description' },
    { id: SMASHUP_FACTION_IDS.GIANT_ANTS, nameKey: 'factions.giant_ants.name', icon: AntIcon, color: '#ca8a04', descriptionKey: 'factions.giant_ants.description' },
];

export function getFactionMeta(id: string): FactionMeta | undefined {
    return FACTION_METADATA.find(f => f.id === id);
}
