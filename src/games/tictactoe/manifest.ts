import type { GameManifestEntry } from '../manifest.types';
import { MOBILE_PORTRAIT_DESIGN_VIEWPORT } from '../../shared/referenceViewports';

const entry: GameManifestEntry = {
    id: 'tictactoe',
    type: 'game',
    enabled: true,
    titleKey: 'games.tictactoe.title',
    descriptionKey: 'games.tictactoe.description',
    category: 'abstract',
    playersKey: 'games.tictactoe.players',
    icon: '#',
    cursorTheme: 'tictactoe-neon',
    mobileProfile: 'portrait-adapted',
    preferredOrientation: 'portrait',
    mobileLayoutPreset: 'board-shell',
    mobileBoardShellLayout: {
        designWidth: MOBILE_PORTRAIT_DESIGN_VIEWPORT.width,
        designHeight: MOBILE_PORTRAIT_DESIGN_VIEWPORT.height,
        referenceWidth: MOBILE_PORTRAIT_DESIGN_VIEWPORT.width,
        referenceHeight: MOBILE_PORTRAIT_DESIGN_VIEWPORT.height,
        fit: 'contain',
    },
    shellTargets: ['pwa', 'app-webview', 'mini-program-webview'],
    mobileDelivery: {
        mode: 'package-managed',
        runtimeChannel: 'stable',
        modulePackId: 'tictactoe',
        assetPackId: 'tictactoe',
    },
    ai: {
        capture: true,
        localAi: true,
        remoteAi: true,
    },
};

export const TIC_TAC_TOE_MANIFEST: GameManifestEntry = entry;

export default entry;
