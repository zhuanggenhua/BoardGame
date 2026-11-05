import type { TutorialCollection } from '../../engine/types';
import { QIDAHEN_ANNUAL_TUTORIAL } from './annualTutorial';

export const QIDAHEN_DEFAULT_TUTORIAL_ID = 'basic-opening';
export const QIDAHEN_PLAYER_TUTORIALS: TutorialCollection = {
    defaultTutorialId: QIDAHEN_DEFAULT_TUTORIAL_ID,
    tutorials: {
        [QIDAHEN_DEFAULT_TUTORIAL_ID]: {
            titleKey: 'tutorial.basic.title',
            descriptionKey: 'tutorial.basic.description',
            manifest: QIDAHEN_ANNUAL_TUTORIAL,
        },
    },
};
// QA也必须走同一连续课程，不再注册旧预设章节。
export const QIDAHEN_TUTORIAL_QA_SCENARIOS: TutorialCollection['tutorials'] = {};
export const QIDAHEN_TEST_TUTORIALS = QIDAHEN_PLAYER_TUTORIALS;
export const isQidahenTutorialQaRuntime = (): boolean => false;
export default QIDAHEN_PLAYER_TUTORIALS;
