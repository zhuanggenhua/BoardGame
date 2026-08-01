import { expect, test, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createDustMultiResearchCureTraitChoiceRuntimeCore,
    createDustResearchAndCureSuccessRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-the-dust-research-and-cure-success';
const BEFORE_SCREENSHOT = `${EVIDENCE_DIR}/01-寻找解药成功前.jpg`;
const RESEARCH_SCREENSHOT = `${EVIDENCE_DIR}/02-研究标记放置后.jpg`;
const CURE_SUCCESS_SCREENSHOT = `${EVIDENCE_DIR}/03-治愈灰尘成功终局.jpg`;
const MULTI_RESEARCH_TRAIT_CHOICE_SCREENSHOT = `${EVIDENCE_DIR}/04-多研究标记治愈属性选择.jpg`;
const SPEED_CURE_SUCCESS_SCREENSHOT = `${EVIDENCE_DIR}/05-速度治愈灰尘成功终局.jpg`;
const SPEED_CURE_SUCCESS_REPORT_SCREENSHOT = `${EVIDENCE_DIR}/06-速度治愈灰尘结果报告.jpg`;
const SEARCH_KNOWLEDGE_TRAIT_SCREENSHOT = `${EVIDENCE_DIR}/07-寻找解药知识选择成功.jpg`;
const SEARCH_SANITY_TRAIT_SCREENSHOT = `${EVIDENCE_DIR}/08-寻找解药神志选择成功.jpg`;
const CURE_MIGHT_TRAIT_SCREENSHOT = `${EVIDENCE_DIR}/09-治愈灰尘力量选择.jpg`;
const CURE_SPEED_TRAIT_SCREENSHOT = `${EVIDENCE_DIR}/10-治愈灰尘速度选择.jpg`;
const CURE_KNOWLEDGE_TRAIT_SCREENSHOT = `${EVIDENCE_DIR}/11-治愈灰尘知识选择.jpg`;
const CURE_SANITY_TRAIT_SCREENSHOT = `${EVIDENCE_DIR}/12-治愈灰尘神志选择.jpg`;
const TEST_URL = '/play/betrayal?players=3&playerID=1&seat0=human&seat1=human&seat2=human&seed=the-dust-research-and-cure-success';

const SEARCH_TRAIT_CASES = [
    { trait: 'knowledge', label: '知识', screenshot: SEARCH_KNOWLEDGE_TRAIT_SCREENSHOT },
    { trait: 'sanity', label: '神志', screenshot: SEARCH_SANITY_TRAIT_SCREENSHOT },
] as const;

const CURE_TRAIT_CASES = [
    { trait: 'might', label: '力量', screenshot: CURE_MIGHT_TRAIT_SCREENSHOT },
    { trait: 'speed', label: '速度', screenshot: CURE_SPEED_TRAIT_SCREENSHOT },
    { trait: 'knowledge', label: '知识', screenshot: CURE_KNOWLEDGE_TRAIT_SCREENSHOT },
    { trait: 'sanity', label: '神志', screenshot: CURE_SANITY_TRAIT_SCREENSHOT },
] as const;

type DustResearchAndCureState = {
    phase?: string;
    currentPlayer?: string;
    usedCardIdsThisTurn?: string[];
    researchRoomIds?: string[];
    recentRoll?: {
        sourceTitle?: string;
        latestLabel?: string;
        trait?: string;
        dice?: number[];
        passiveBonus?: number;
    } | null;
    endgameResult?: {
        hauntId?: string;
        outcome?: string;
        winners?: string[];
    } | null;
    progressText?: string;
    researchText?: string;
    latestLog?: string;
};

const readDustResearchAndCureState = async (
    page: Page,
): Promise<DustResearchAndCureState> =>
    page.evaluate(() => {
        const core = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            phase?: string;
                            currentPlayer?: string;
                            usedCardIdsThisTurn?: string[];
                            recentRoll?: DustResearchAndCureState['recentRoll'];
                            endgameResult?: DustResearchAndCureState['endgameResult'];
                            activityLog?: Array<{ text?: string }>;
                            scenarioRuntime?: {
                                dust?: {
                                    researchRoomIds?: string[];
                                };
                            };
                        };
                    };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.()?.core;
        const text = (selector: string) =>
            document.querySelector<HTMLElement>(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

        return {
            phase: core?.phase,
            currentPlayer: core?.currentPlayer,
            usedCardIdsThisTurn: core?.usedCardIdsThisTurn ?? [],
            researchRoomIds: core?.scenarioRuntime?.dust?.researchRoomIds ?? [],
            recentRoll: core?.recentRoll ?? null,
            endgameResult: core?.endgameResult ?? null,
            progressText: text('[data-testid="betrayal-dust-progress-strip"]'),
            researchText: text('[data-testid="betrayal-dust-progress-item-research"]'),
            latestLog: core?.activityLog?.[0]?.text ?? '',
        };
    });

const dismissHauntRevealCueIfVisible = async (page: Page) => {
    const closeButton = page.getByTestId('betrayal-haunt-reveal-close');
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
    }
};

const expectSelectedDustTrait = async (
    page: Page,
    testIdPrefix: string,
    traits: readonly string[],
    selectedTrait: string,
) => {
    for (const trait of traits) {
        await expect(page.getByTestId(`${testIdPrefix}-${trait}`)).toHaveAttribute(
            'data-selected',
            trait === selectedTrait ? 'true' : 'false',
        );
    }
};

test.describe('山屋惊魂作祟3灰尘研究与治愈成功', () => {
    test('寻找解药成功放置研究标记后可治愈灰尘并进入英雄胜利终局', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-research-and-cure-success');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createDustResearchAndCureSuccessRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await dismissHauntRevealCueIfVisible(page);
        await expect(page.getByTestId('betrayal-action-use')).toBeVisible();
        await expect(page.getByTestId('betrayal-action-use')).toContainText('寻找解药');
        await expect(page.getByTestId('betrayal-dust-progress-strip')).toContainText('灰尘');
        await expect(page.getByTestId('betrayal-dust-progress-item-research')).toContainText('0处');
        await expect.poll(() => readDustResearchAndCureState(page)).toMatchObject({
            phase: 'haunt',
            currentPlayer: '1',
            researchRoomIds: [],
            endgameResult: null,
            researchText: expect.stringContaining('0处'),
        });
        await saveScreenshot(page, BEFORE_SCREENSHOT);

        await setHarnessRandomQueue(page, Array.from({ length: 8 }, () => 0.99));
        await page.getByTestId('betrayal-action-use').click();

        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('寻找解药成功');
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('研究标记');
        await expect.poll(() => readDustResearchAndCureState(page)).toMatchObject({
            phase: 'haunt',
            currentPlayer: '1',
            usedCardIdsThisTurn: expect.arrayContaining(['search-for-cure']),
            researchRoomIds: ['ground-north'],
            recentRoll: {
                sourceTitle: '寻找解药',
                latestLabel: '放置研究标记',
                dice: [2, 2, 2, 2, 2, 2],
                passiveBonus: 0,
            },
            latestLog: expect.stringContaining('放置了研究标记'),
        });

        await page.getByRole('button', { name: '返回牌桌' }).click();
        await expect(page.getByTestId('betrayal-dust-progress-item-research')).toContainText('1处');
        await expect(page.getByTestId('betrayal-action-use')).toContainText('治愈灰尘');
        const researchRoomToken = page.getByTestId('betrayal-room-haunt-token-ground-north-dust-research-token-ground-north');
        await expect(researchRoomToken).toBeVisible();
        await expect(researchRoomToken).toContainText('研');
        await expect.poll(() => readDustResearchAndCureState(page)).toMatchObject({
            progressText: expect.stringContaining('研究1处'),
            researchText: expect.stringContaining('1处'),
        });
        await saveScreenshot(page, RESEARCH_SCREENSHOT);

        await setHarnessRandomQueue(page, Array.from({ length: 8 }, () => 0.99));
        await page.getByTestId('betrayal-action-use').click();

        const endgameScreen = page.getByTestId('betrayal-endgame-screen');
        await expect(endgameScreen).toBeVisible({ timeout: 30000 });
        await expect(endgameScreen).toContainText('灰尘');
        await expect(page.getByTestId('betrayal-endgame-ending-stage')).toBeVisible();
        await expect(page.getByTestId('betrayal-endgame-ending-source-status')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-endgame-ending-narration')).toContainText('你把临时做成的注射器扎进手臂');
        await expect(page.getByTestId('betrayal-endgame-ending-narration')).toContainText('最好趁免疫力消退前赶快离开');
        await expect(page.getByTestId('betrayal-endgame-ending-narration')).not.toContainText('官方 If You Win 原文');
        await expect(page.getByTestId('betrayal-endgame-ending-narration')).not.toContainText('非原文摘要');
        await expect.poll(() => readDustResearchAndCureState(page)).toMatchObject({
            phase: 'endgame',
            usedCardIdsThisTurn: expect.arrayContaining(['search-for-cure', 'cure-the-dust']),
            recentRoll: {
                sourceTitle: '治愈灰尘',
                latestLabel: '治愈成功',
                dice: [2, 2, 2, 2, 2, 2],
                passiveBonus: 2,
            },
            endgameResult: {
                hauntId: 'the-dust',
                outcome: 'survivors',
                winners: ['1', '2'],
            },
        });
        await saveScreenshot(page, CURE_SUCCESS_SCREENSHOT);

        await page.getByTestId('betrayal-endgame-ending-continue').click();
        await expect(page.getByTestId('betrayal-endgame-result-report')).toBeVisible();
        await expect(endgameScreen).toContainText('幸存者逃脱');
        await expect(endgameScreen).toContainText('胜利');

        assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-research-and-cure-success', diagnostics }]);
    });

    test('治愈灰尘可手动选择属性并按多个研究标记加值', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-cure-trait-choice-multi-research');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createDustMultiResearchCureTraitChoiceRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await dismissHauntRevealCueIfVisible(page);
        await expect(page.getByTestId('betrayal-action-use')).toBeVisible();
        await expect(page.getByTestId('betrayal-action-use')).toContainText('治愈灰尘');
        await expect(page.getByTestId('betrayal-dust-progress-strip')).toContainText('灰尘');
        await expect(page.getByTestId('betrayal-dust-progress-item-research')).toContainText('3处');
        await expect(page.getByTestId('betrayal-room-haunt-token-ground-north-dust-research-token-ground-north')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-haunt-token-hallway-dust-research-token-hallway')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-haunt-token-entrance-hall-dust-research-token-entrance-hall')).toBeVisible();
        await expect(page.getByTestId('betrayal-dust-trait-selector')).toHaveAttribute('data-action-id', 'cure-the-dust');
        await expect(page.getByTestId('betrayal-dust-cure-trait-might')).toHaveAttribute('data-selected', 'true');
        await expect(page.getByTestId('betrayal-dust-cure-trait-speed')).toHaveAttribute('data-selected', 'false');
        await expect(page.getByTestId('betrayal-dust-cure-trait-knowledge')).toHaveAttribute('data-selected', 'false');
        await expect(page.getByTestId('betrayal-dust-cure-trait-sanity')).toHaveAttribute('data-selected', 'false');

        await page.getByTestId('betrayal-dust-cure-trait-speed').click();
        await expect(page.getByTestId('betrayal-dust-cure-trait-might')).toHaveAttribute('data-selected', 'false');
        await expect(page.getByTestId('betrayal-dust-cure-trait-speed')).toHaveAttribute('data-selected', 'true');
        await expect.poll(() => readDustResearchAndCureState(page)).toMatchObject({
            phase: 'haunt',
            currentPlayer: '1',
            researchRoomIds: ['ground-north', 'hallway', 'entrance-hall'],
            researchText: expect.stringContaining('3处'),
        });
        await saveScreenshot(page, MULTI_RESEARCH_TRAIT_CHOICE_SCREENSHOT);

        await setHarnessRandomQueue(page, Array.from({ length: 8 }, () => 0.99));
        await page.getByTestId('betrayal-action-use').click();

        const endgameScreen = page.getByTestId('betrayal-endgame-screen');
        await expect(endgameScreen).toBeVisible({ timeout: 30000 });
        await expect(endgameScreen).toContainText('灰尘');
        await expect(page.getByTestId('betrayal-endgame-ending-stage')).toBeVisible();
        await expect(page.getByTestId('betrayal-endgame-ending-source-status')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-endgame-ending-narration')).toContainText('你把临时做成的注射器扎进手臂');
        await expect(page.getByTestId('betrayal-endgame-ending-narration')).toContainText('最好趁免疫力消退前赶快离开');
        await expect(page.getByTestId('betrayal-endgame-ending-narration')).not.toContainText('官方 If You Win 原文');
        await expect(page.getByTestId('betrayal-endgame-ending-narration')).not.toContainText('非原文摘要');
        await expect.poll(() => readDustResearchAndCureState(page)).toMatchObject({
            phase: 'endgame',
            usedCardIdsThisTurn: expect.arrayContaining(['cure-the-dust']),
            recentRoll: {
                sourceTitle: '治愈灰尘',
                latestLabel: '治愈成功',
                trait: 'speed',
                dice: [2, 2, 2, 2],
                passiveBonus: 6,
            },
            endgameResult: {
                hauntId: 'the-dust',
                outcome: 'survivors',
                winners: ['1', '2'],
            },
        });
        await saveScreenshot(page, SPEED_CURE_SUCCESS_SCREENSHOT);

        await page.getByTestId('betrayal-endgame-ending-continue').click();
        await expect(page.getByTestId('betrayal-endgame-result-report')).toBeVisible();
        await expect(endgameScreen).toContainText('幸存者逃脱');
        await expect(endgameScreen).toContainText('胜利');
        await saveScreenshot(page, SPEED_CURE_SUCCESS_REPORT_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-cure-trait-choice-multi-research', diagnostics }]);
    });

    test('寻找解药与治愈灰尘覆盖全部合法属性选择截图', async ({ page, context }) => {
        test.setTimeout(180000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-trait-choice-coverage');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        for (const searchCase of SEARCH_TRAIT_CASES) {
            await injectCore(page, createDustResearchAndCureSuccessRuntimeCore());
            await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
            await dismissHauntRevealCueIfVisible(page);
            await expect(page.getByTestId('betrayal-action-use')).toBeVisible();
            await expect(page.getByTestId('betrayal-action-use')).toContainText('寻找解药');
            await expect(page.getByTestId('betrayal-dust-trait-selector')).toHaveAttribute('data-action-id', 'search-for-cure');

            await page.getByTestId(`betrayal-dust-search-trait-${searchCase.trait}`).click();
            await expectSelectedDustTrait(
                page,
                'betrayal-dust-search-trait',
                SEARCH_TRAIT_CASES.map((item) => item.trait),
                searchCase.trait,
            );

            await setHarnessRandomQueue(page, Array.from({ length: 8 }, () => 0.99));
            await page.getByTestId('betrayal-action-use').click();
            await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('寻找解药成功');
            await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('研究标记');
            await expect.poll(() => readDustResearchAndCureState(page)).toMatchObject({
                phase: 'haunt',
                currentPlayer: '1',
                usedCardIdsThisTurn: expect.arrayContaining(['search-for-cure']),
                researchRoomIds: ['ground-north'],
                recentRoll: {
                    sourceTitle: '寻找解药',
                    latestLabel: '放置研究标记',
                    trait: searchCase.trait,
                    dice: [2, 2, 2, 2, 2, 2],
                },
                latestLog: expect.stringContaining('放置了研究标记'),
            });
            await saveScreenshot(page, searchCase.screenshot);

            await page.getByRole('button', { name: '返回牌桌' }).click();
            await expect(page.getByTestId('betrayal-dust-progress-item-research')).toContainText('1处');
        }

        for (const cureCase of CURE_TRAIT_CASES) {
            await injectCore(page, createDustMultiResearchCureTraitChoiceRuntimeCore());
            await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
            await dismissHauntRevealCueIfVisible(page);
            await expect(page.getByTestId('betrayal-action-use')).toBeVisible();
            await expect(page.getByTestId('betrayal-action-use')).toContainText('治愈灰尘');
            await expect(page.getByTestId('betrayal-dust-progress-item-research')).toContainText('3处');
            await expect(page.getByTestId('betrayal-dust-trait-selector')).toHaveAttribute('data-action-id', 'cure-the-dust');
            await expect(page.getByTestId('betrayal-room-haunt-token-ground-north-dust-research-token-ground-north')).toBeVisible();
            await expect(page.getByTestId('betrayal-room-haunt-token-hallway-dust-research-token-hallway')).toBeVisible();
            await expect(page.getByTestId('betrayal-room-haunt-token-entrance-hall-dust-research-token-entrance-hall')).toBeVisible();

            await page.getByTestId(`betrayal-dust-cure-trait-${cureCase.trait}`).click();
            await expectSelectedDustTrait(
                page,
                'betrayal-dust-cure-trait',
                CURE_TRAIT_CASES.map((item) => item.trait),
                cureCase.trait,
            );
            await expect.poll(() => readDustResearchAndCureState(page)).toMatchObject({
                phase: 'haunt',
                currentPlayer: '1',
                researchRoomIds: ['ground-north', 'hallway', 'entrance-hall'],
                researchText: expect.stringContaining('3处'),
            });
            await saveScreenshot(page, cureCase.screenshot);
        }

        assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-trait-choice-coverage', diagnostics }]);
    });
});
