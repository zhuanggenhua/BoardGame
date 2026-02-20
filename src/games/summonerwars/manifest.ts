import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'summonerwars',
    type: 'game',
    enabled: true,
    titleKey: 'games.summonerwars.title',
    descriptionKey: 'games.summonerwars.description',
    category: 'wargame',
    playersKey: 'games.summonerwars.players',
    icon: '⚔️',
    thumbnailPath: 'summonerwars/thumbnails/cover',
    allowLocalMode: false,
    playerOptions: [2],
    tags: ['tactical', 'card_driven', 'dice_driven'],
    bestPlayers: [2],
    cursorTheme: 'summonerwars-ethereal',
};

export const SUMMONER_WARS_MANIFEST: GameManifestEntry = entry;

export default entry;
