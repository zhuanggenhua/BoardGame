import { expect, test, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createDustSicknessPrivacyRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-the-dust-sickness-privacy';
const PLAYER_0_SCREENSHOT = `${EVIDENCE_DIR}/01-玩家0只看到自己的疾病编号.jpg`;
const PLAYER_1_SCREENSHOT = `${EVIDENCE_DIR}/02-玩家1看不到玩家0疾病编号和永久感染.jpg`;

const testUrl = (playerId: string) =>
    `/play/betrayal?players=3&playerID=${playerId}&seat0=human&seat1=human&seat2=human&seed=the-dust-sickness-privacy-${playerId}`;

type DustPrivacyViewState = {
    currentPlayer?: string;
    ownSicknessText: string;
    permanentInfectionText: string;
    progressText: string;
    boardText: string;
    rawPermanentTraitorPlayerIds?: string[];
    rawSicknessValuesByPlayerId?: Record<string, Array<number | null>>;
};

const readDustPrivacyViewState = async (page: Page): Promise<DustPrivacyViewState> =>
    page.evaluate(() => {
        const core = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentPlayer?: string;
                            scenarioRuntime?: {
                                dust?: {
                                    permanentTraitorPlayerIds?: string[];
                                    sicknessTokensByPlayerId?: Record<string, Array<{ value: number | null }>>;
                                };
                            };
                        };
                    };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.()?.core;
        const dust = core?.scenarioRuntime?.dust;
        const text = (selector: string) =>
            document.querySelector<HTMLElement>(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

        return {
            currentPlayer: core?.currentPlayer,
            ownSicknessText: text('[data-testid="betrayal-dust-progress-item-own-sickness"]'),
            permanentInfectionText: text('[data-testid="betrayal-dust-progress-item-permanent-infection"]'),
            progressText: text('[data-testid="betrayal-dust-progress-strip"]'),
            boardText: text('[data-testid="betrayal-board"]'),
            rawPermanentTraitorPlayerIds: dust?.permanentTraitorPlayerIds ?? [],
            rawSicknessValuesByPlayerId: Object.fromEntries(
                Object.entries(dust?.sicknessTokensByPlayerId ?? {}).map(([playerId, tokens]) => [
                    playerId,
                    tokens.map((token) => token.value),
                ]),
            ),
        };
    });

const dismissHauntRevealCueIfVisible = async (page: Page) => {
    const closeButton = page.getByTestId('betrayal-haunt-reveal-close');
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
    }
};

test.describe('山屋惊魂作祟3灰尘疾病编号隐私', () => {
    test('玩家只能在真实牌桌看到自己的疾病编号和永久感染状态', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-sickness-privacy');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);

        await page.goto(testUrl('0'), { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);
        await injectCore(page, createDustSicknessPrivacyRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await dismissHauntRevealCueIfVisible(page);

        await expect(page.getByTestId('betrayal-dust-progress-item-own-sickness')).toContainText('你的疾病');
        await expect(page.getByTestId('betrayal-dust-progress-item-own-sickness')).toContainText('1 / 4 / 8');
        await expect(page.getByTestId('betrayal-dust-progress-item-permanent-infection')).toContainText('永久感染');
        await expect(page.getByTestId('betrayal-dust-progress-item-permanent-infection')).toContainText('是');
        await expect(page.getByTestId('betrayal-board')).not.toContainText('2 / 3 / 5');
        await expect.poll(() => readDustPrivacyViewState(page)).toMatchObject({
            currentPlayer: '1',
            ownSicknessText: expect.stringContaining('1 / 4 / 8'),
            permanentInfectionText: expect.stringContaining('是'),
            rawPermanentTraitorPlayerIds: ['0'],
            rawSicknessValuesByPlayerId: {
                '0': [1, 4, 8],
                '1': [2, 3, 5],
                '2': [6, 7, 9],
            },
        });
        await saveScreenshot(page, PLAYER_0_SCREENSHOT);

        await page.goto(testUrl('1'), { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);
        await injectCore(page, createDustSicknessPrivacyRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await dismissHauntRevealCueIfVisible(page);

        await expect(page.getByTestId('betrayal-dust-progress-item-own-sickness')).toContainText('你的疾病');
        await expect(page.getByTestId('betrayal-dust-progress-item-own-sickness')).toContainText('2 / 3 / 5');
        await expect(page.getByTestId('betrayal-dust-progress-item-permanent-infection')).toContainText('永久感染');
        await expect(page.getByTestId('betrayal-dust-progress-item-permanent-infection')).toContainText('否');
        await expect(page.getByTestId('betrayal-board')).not.toContainText('1 / 4 / 8');
        await expect.poll(() => readDustPrivacyViewState(page)).toMatchObject({
            currentPlayer: '1',
            ownSicknessText: expect.stringContaining('2 / 3 / 5'),
            permanentInfectionText: expect.stringContaining('否'),
            boardText: expect.not.stringContaining('1 / 4 / 8'),
            rawPermanentTraitorPlayerIds: ['0'],
            rawSicknessValuesByPlayerId: {
                '0': [1, 4, 8],
                '1': [2, 3, 5],
                '2': [6, 7, 9],
            },
        });
        await saveScreenshot(page, PLAYER_1_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-sickness-privacy', diagnostics }]);
    });
});
