import type { TutorialCollection } from '../engine/types';
import { getVisibleTutorialCatalogEntries } from './useMatchRoomRuntimeSetup';

/** 选课目录按页面阅读；指定课程与单课程入口继续进入牌桌。 */
export const shouldShowMatchRoomTutorialCatalog = (stage: {
    tutorialId?: string;
    tutorialCatalog: TutorialCollection | null;
} | null): boolean => Boolean(
    stage
    && !stage.tutorialId
    && stage.tutorialCatalog
    && getVisibleTutorialCatalogEntries(stage.tutorialCatalog).length > 1,
);
