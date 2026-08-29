import type { GameManifestEntry } from '../manifest.types';
import { buildMageWarsSetupOptions } from './roomSetup';

const entry: GameManifestEntry = {
    id: 'mage-wars',
    type: 'game',
    enabled: true,
    listed: true,
    statusTag: 'under_construction',
    titleKey: 'games.mage-wars.title',
    descriptionKey: 'games.mage-wars.description',
    category: 'wargame',
    playersKey: 'games.mage-wars.players',
    icon: 'MW',
    cursorTheme: 'mage-wars-arcane',
    allowLocalMode: false,
    playerOptions: [2],
    setupOptions: buildMageWarsSetupOptions(),
    tags: ['tactical', 'card_driven', 'spellcasting'],
    bestPlayers: [2],
    ai: {
        capture: true,
        localAi: false,
        remoteAi: false,
        capturePolicy: 'human-only',
    },
    fontFamily: { display: 'Cinzel' },
    mobileProfile: 'landscape-adapted',
    preferredOrientation: 'landscape',
    mobileLayoutPreset: 'board-shell',
    mobileBoardShellLayout: {
        designWidth: 1920,
    },
    shellTargets: ['pwa', 'app-webview', 'mini-program-webview'],
    mobileDelivery: {
        mode: 'package-managed',
        runtimeChannel: 'foundation',
        modulePackId: 'mage-wars',
        assetPackId: 'mage-wars',
    },
};

export const MAGE_WARS_MANIFEST: GameManifestEntry = entry;

export default entry;
