import type { FactionId } from './domain/types';
import { resolveFactionId } from './config/factions';

const FACTION_DIR_MAP: Record<FactionId, string> = {
    necromancer: 'Necromancer',
    trickster: 'Trickster',
    paladin: 'Paladin',
    goblin: 'Goblin',
    frost: 'Frost',
    barbaric: 'Barbaric',
    mogu: 'mogu',
    huijin: 'huijin',
    shouren: 'shouren',
    yongheng: 'yongheng',
    shadow: 'shadow',
    zhongcai: 'zhongcai',
};

export function getFactionAtlasId(faction: FactionId | string, atlasType: 'hero' | 'cards'): string {
    const factionId = resolveFactionId(faction);
    const dir = FACTION_DIR_MAP[factionId] ?? 'Necromancer';
    return `sw:${dir.toLowerCase()}:${atlasType}`;
}

const CARD_ID_PREFIX_MAP: Record<string, FactionId> = {
    necro: 'necromancer',
    trick: 'trickster',
    paladin: 'paladin',
    goblin: 'goblin',
    frost: 'frost',
    barb: 'barbaric',
    mogu: 'mogu',
    huijin: 'huijin',
    shouren: 'shouren',
    yongheng: 'yongheng',
    shadow: 'shadow',
    zhongcai: 'zhongcai',
};

export function resolveCardAtlasId(
    card: { id: string; faction?: FactionId | string },
    atlasType: 'hero' | 'cards',
): string {
    if (card.faction) {
        return getFactionAtlasId(card.faction, atlasType);
    }
    for (const [prefix, faction] of Object.entries(CARD_ID_PREFIX_MAP)) {
        if (card.id.startsWith(prefix)) {
            return getFactionAtlasId(faction, atlasType);
        }
    }
    return getFactionAtlasId('necromancer', atlasType);
}
