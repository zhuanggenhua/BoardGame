import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'smashup',
    type: 'game',
    enabled: true,
    titleKey: 'games.smashup.title',
    descriptionKey: 'games.smashup.description',
    category: 'card',
    playersKey: 'games.smashup.players',
    icon: '🎲',
    thumbnailPath: 'smashup/thumbnails/smashup',
    playerOptions: [2, 3, 4],
    /** 最佳游玩人数：3 人 */
    bestPlayers: [3],
    tags: ['card_driven', 'casual'],
    allowLocalMode: false,
};

export const SMASH_UP_MANIFEST: GameManifestEntry = entry;

export default entry;
