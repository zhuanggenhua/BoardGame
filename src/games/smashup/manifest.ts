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
    setupOptions: {
        expansions: {
            type: 'multi-select',
            labelKey: 'games.smashup.setup.expansions.label',
            options: [
                { value: 'titans', labelKey: 'games.smashup.setup.expansions.titans' },
                { value: 'diy', labelKey: 'games.smashup.setup.expansions.diy' },
            ],
            default: ['titans', 'diy'],
        },
        deckQuery: {
            type: 'select',
            labelKey: 'games.smashup.setup.deckQuery.label',
            options: [
                { value: 'off', labelKey: 'games.smashup.setup.deckQuery.off' },
                { value: 'on', labelKey: 'games.smashup.setup.deckQuery.on' },
            ],
            default: 'off',
        },
        teamMode: {
            type: 'select',
            labelKey: 'games.smashup.setup.teamMode.label',
            optionsByPlayerCount: {
                2: [
                    { value: 'off', labelKey: 'games.smashup.setup.teamMode.off' },
                ],
                3: [
                    { value: 'off', labelKey: 'games.smashup.setup.teamMode.off' },
                ],
                4: [
                    { value: 'off', labelKey: 'games.smashup.setup.teamMode.off' },
                    { value: '2v2', labelKey: 'games.smashup.setup.teamMode.2v2' },
                ],
            },
            default: 'off',
        },
    },
    ai: {
        capture: true,
        localAi: true,
        remoteAi: false,
    },
    cursorTheme: 'smashup-popart',
    fontFamily: { display: 'Bangers' },
    mobileProfile: 'landscape-adapted',
    preferredOrientation: 'landscape',
    mobileLayoutPreset: 'board-shell',
    mobileBattlefieldZoom: 'shell-pinch-pan',
    shellTargets: ['pwa', 'app-webview', 'mini-program-webview'],
    mobileDelivery: {
        mode: 'package-managed',
        runtimeChannel: 'stable',
        modulePackId: 'smashup',
        assetPackId: 'smashup',
    },
};

export const SMASH_UP_MANIFEST: GameManifestEntry = entry;

export default entry;
