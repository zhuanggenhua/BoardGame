import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'dicethrone',
    type: 'game',
    enabled: true,
    titleKey: 'games.dicethrone.title',
    descriptionKey: 'games.dicethrone.description',
    category: 'dice',
    playersKey: 'games.dicethrone.players',
    icon: '🎲',
    thumbnailPath: 'dicethrone/thumbnails/fengm',
    allowLocalMode: false,
    playerOptions: [2],
    tags: ['dice_driven', 'combat'],
    bestPlayers: [2],
    cursorTheme: 'dicethrone-critical',
    fontFamily: { display: 'Cinzel' },
};

export const DICETHRONE_MANIFEST: GameManifestEntry = entry;

export default entry;
