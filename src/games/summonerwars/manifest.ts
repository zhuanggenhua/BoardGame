import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'summonerwars',
    type: 'game',
    enabled: false, // 初始禁用，待实现后启用
    titleKey: 'games.summonerwars.title',
    descriptionKey: 'games.summonerwars.description',
    category: 'strategy',
    playersKey: 'games.summonerwars.players',
    icon: '⚔️',
    allowLocalMode: true,
    playerOptions: [2],
    tags: ['tactical', 'card_driven', 'dice_driven'],
    bestPlayers: [2],
};

export const SUMMONER_WARS_MANIFEST: GameManifestEntry = entry;

export default entry;
