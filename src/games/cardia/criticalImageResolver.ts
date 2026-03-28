/**
 * Cardia 关键图片解析器
 *
 * 设计目标：
 * 1. 教程 setup 阶段最小化加载，避免卡在资源加载页。
 * 2. playing 阶段只加载当前牌组所需卡图（I 或 II），不再全量加载两套牌。
 */

import type { CriticalImageResolver, CriticalImageResolverResult } from '../../core/types';
import type { MatchState } from '../../engine/types';
import type { CardiaCore } from './domain/core-types';
import { DECK_VARIANT_IDS } from './domain/ids';
import { CARDIA_IMAGE_PATHS, getCardiaDeckCardPaths, getCardiaLocationPaths } from './imagePaths';

function buildDeckCriticalImages(deckVariant: string): string[] {
    const normalizedDeckVariant = deckVariant === DECK_VARIANT_IDS.II ? DECK_VARIANT_IDS.II : DECK_VARIANT_IDS.I;
    return [
        CARDIA_IMAGE_PATHS.DECK1_BACK,
        ...getCardiaDeckCardPaths(normalizedDeckVariant),
    ];
}

function buildDeckWarmImages(deckVariant: string): string[] {
    void deckVariant;
    return [
        ...getCardiaLocationPaths(),
        // 预留：未来可把非首屏卡图/装饰图放入 warm。
        // Deck 卡图目前仍作为 critical，保证对局开始即刻可见。
    ];
}

/**
 * Cardia 关键图片解析器
 *
 * 教程模式下：
 * - setup 步骤（stepIndex=0）返回空关键图，快速通过门禁
 * - setup 结束后按当前牌组加载关键图
 */
export const cardiaCriticalImageResolver: CriticalImageResolver = (gameState): CriticalImageResolverResult => {
    const state = gameState as MatchState<CardiaCore> | undefined;
    const deckVariant = state?.core?.deckVariant ?? DECK_VARIANT_IDS.I;
    const isTutorial = state?.sys?.tutorial?.active === true;
    const tutorialStepIndex = state?.sys?.tutorial?.stepIndex ?? -1;

    if (isTutorial && tutorialStepIndex === 0) {
        return {
            critical: [],
            warm: [],
            phaseKey: 'tutorial-setup',
        };
    }

    return {
        critical: buildDeckCriticalImages(deckVariant),
        warm: buildDeckWarmImages(deckVariant),
        phaseKey: isTutorial ? `tutorial-playing:${deckVariant}` : `playing:${deckVariant}`,
    };
};
