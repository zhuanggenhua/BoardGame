import type { GameManifestEntry } from '../manifest.types';
import { buildFantasyRealmsSetupOptions } from './roomSetup';

export const FANTASY_REALMS_MOBILE_BOARD_SHELL_DESIGN_WIDTH_PX = 1920;
export const FANTASY_REALMS_MOBILE_BOARD_SHELL_DESIGN_HEIGHT_PX = 1080;

const entry: GameManifestEntry = {
    id: 'fantasyrealms',
    type: 'game',
    enabled: true,
    titleKey: 'games.fantasyrealms.title',
    descriptionKey: 'games.fantasyrealms.description',
    category: 'card',
    playersKey: 'games.fantasyrealms.players',
    icon: '🏰',
    thumbnailPath: 'fantasyrealms/thumbnails/cover',
    cursorTheme: 'fantasyrealms-parchment',
    allowLocalMode: true,
    playerOptions: [2, 3, 4, 5, 6],
    setupOptions: buildFantasyRealmsSetupOptions(),
    bestPlayers: [3, 4],
    tags: ['card_driven', 'set_collection', 'fantasy'],
    mobileProfile: 'landscape-adapted',
    preferredOrientation: 'landscape',
    mobileLayoutPreset: 'board-shell',
    mobileBoardShellLayout: {
        designWidth: FANTASY_REALMS_MOBILE_BOARD_SHELL_DESIGN_WIDTH_PX,
        designHeight: FANTASY_REALMS_MOBILE_BOARD_SHELL_DESIGN_HEIGHT_PX,
    },
    shellTargets: ['pwa', 'app-webview', 'mini-program-webview'],
    ai: {
        capture: true,
        localAi: true,
        remoteAi: false,
    },
};

export const FANTASY_REALMS_MANIFEST: GameManifestEntry = entry;
export default entry;
