import type { GameManifestEntry } from '../manifest.types';
import {
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
    cursorTheme: 'betrayal-haunt',
    allowLocalMode: true,
    playerOptions: [3, 4, 5, 6],
    publicRoomSetupSummary: {
        scenario: {
            options: Object.fromEntries(
                BETRAYAL_SCENARIO_SETUP_OPTIONS.map((option) => [
                    option.value,
                    { labelKey: option.labelKey },
                ]),
            ),
            pendingLabel: {
                labelKey: 'rooms.scenarioPending',
                namespace: 'lobby',
                defaultValue: '未定剧本',
            },
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
    mobileLayoutPreset: 'map-shell',
    shellTargets: ['pwa', 'app-webview', 'mini-program-webview'],
    pageShell: {
        keepBoardMountedOnPlayerViewChange: true,
        tutorialCatalogTheme: {
            className: 'tutorial-catalog-stage--betrayal',
            chapterAccents: ['#b8975b', '#496246', '#d8c29a', '#8b6f45', '#7e2f2a', '#b8975b'],
        },
    },
};

export const BETRAYAL_MANIFEST: GameManifestEntry = entry;

export default entry;
