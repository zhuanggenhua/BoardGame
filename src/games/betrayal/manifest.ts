import type { GameManifestEntry } from '../manifest.types';
import {
    BETRAYAL_SCENARIO_SETUP_FIELD,
    BETRAYAL_SCENARIO_SETUP_OPTIONS,
} from './roomSetup';

const entry: GameManifestEntry = {
    id: 'betrayal',
    type: 'game',
    enabled: true,
    statusTag: 'under_construction',
    titleKey: 'games.betrayal.title',
    descriptionKey: 'games.betrayal.description',
    category: 'card',
    playersKey: 'games.betrayal.players',
    icon: '屋',
    thumbnailPath: 'betrayal/thumbnails/cover',
    allowLocalMode: true,
    playerOptions: [3, 4, 5, 6],
    setupOptions: {
        [BETRAYAL_SCENARIO_SETUP_FIELD]: {
            type: 'select',
            labelKey: 'setup.scenario.label',
            options: [...BETRAYAL_SCENARIO_SETUP_OPTIONS],
            default: BETRAYAL_SCENARIO_SETUP_OPTIONS[0].value,
            presentation: 'segmented',
        },
    },
    tags: ['card_driven'],
    bestPlayers: [4, 5],
    ai: {
        capture: true,
        localAi: true,
        remoteAi: false,
        defaultLocalAiSeats: 'all-opponents',
    },
    mobileProfile: 'landscape-adapted',
    preferredOrientation: 'landscape',
    mobileLayoutPreset: 'board-shell',
    shellTargets: ['pwa', 'app-webview', 'mini-program-webview'],
};

export const BETRAYAL_MANIFEST: GameManifestEntry = entry;

export default entry;
