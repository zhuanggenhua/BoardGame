import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'smashup',
    type: 'game',
    enabled: true,
    titleKey: 'games.smashup.title',
    descriptionKey: 'games.smashup.description',
    category: 'strategy',
    playersKey: 'games.smashup.players',
    icon: '🎲',
    playerOptions: [2, 3, 4],
    tags: ['card_driven'],
    allowLocalMode: false,
};

export const SMASH_UP_MANIFEST: GameManifestEntry = entry;

export default entry;
