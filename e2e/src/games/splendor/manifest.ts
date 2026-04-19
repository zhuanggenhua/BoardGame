import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'splendor',
    type: 'game',
    enabled: true,
    titleKey: 'games.splendor.title',
    descriptionKey: 'games.splendor.description',
    category: 'card',
    playersKey: 'games.splendor.players',
    cursorTheme: 'splendor-crystal',
    icon: '💎',
    thumbnailPath: 'splendor/picture',
    allowLocalMode: false,
    playerOptions: [2, 3, 4],
    tags: ['card_driven', 'tactical', 'engine_building'],
    bestPlayers: [2, 3],
    setupOptions: {
        startingPlayerId: {
            type: 'select',
            labelKey: 'games.splendor.setup.startingPlayerId.label',
            optionsByPlayerCount: {
                2: [
                    { value: '0', labelKey: 'games.splendor.setup.startingPlayerId.player1' },
                    { value: '1', labelKey: 'games.splendor.setup.startingPlayerId.player2' },
                ],
                3: [
                    { value: '0', labelKey: 'games.splendor.setup.startingPlayerId.player1' },
                    { value: '1', labelKey: 'games.splendor.setup.startingPlayerId.player2' },
                    { value: '2', labelKey: 'games.splendor.setup.startingPlayerId.player3' },
                ],
                4: [
                    { value: '0', labelKey: 'games.splendor.setup.startingPlayerId.player1' },
                    { value: '1', labelKey: 'games.splendor.setup.startingPlayerId.player2' },
                    { value: '2', labelKey: 'games.splendor.setup.startingPlayerId.player3' },
                    { value: '3', labelKey: 'games.splendor.setup.startingPlayerId.player4' },
                ],
            },
            default: '0',
        },
    },
    ai: {
        capture: false,
        localAi: false,
        remoteAi: false,
    },
    mobileProfile: 'landscape-adapted',
    preferredOrientation: 'landscape',
    mobileLayoutPreset: 'board-shell',
    shellTargets: ['pwa'],
};

export const SPLENDOR_MANIFEST: GameManifestEntry = entry;
export default entry;
