import type { TutorialManifest } from '../../contexts/TutorialContext';

const SMASH_UP_TUTORIAL: TutorialManifest = {
    id: 'smashup-basic',
    steps: [
        {
            id: 'welcome',
            content: 'game-smashup:tutorial.welcome',
            requireAction: false,
        },
        {
            id: 'finish',
            content: 'game-smashup:tutorial.finish',
            position: 'center',
            requireAction: false,
        },
    ],
};

export default SMASH_UP_TUTORIAL;
