import { test, expect, type Browser, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    initContext,
    waitForTestHarness,
} from '../helpers/common';

type SerializableTutorialStep = {
    id: string;
    aiActions?: unknown[];
    [key: string]: unknown;
};

type TutorialResumeCase = {
    gameId: string;
    tutorialId: string;
    manifestId: string;
    numPlayers: number;
    stepCount: number;
};

type TutorialDiscoveryResult = {
    cases: TutorialResumeCase[];
    skipped: string[];
};

const PROGRESS_SEED_PREFIX = 'tutorial-progress:v1';
const REPRESENTATIVE_SCREENSHOT_PATH =
    'test-results/evidence-screenshots/_shared/tutorial-resume-all-restored.png';

const encodeProgressPart = (value: string) => encodeURIComponent(value.trim());

const buildTutorialProgressSeed = (
    gameId: string,
    tutorialId: string,
    manifestId: string,
) => [
    PROGRESS_SEED_PREFIX,
    encodeProgressPart(gameId),
    encodeProgressPart(tutorialId || manifestId),
].join(':');

const sanitizeForPath = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, '-');

const discoverTutorialResumeCases = async (page: Page): Promise<TutorialDiscoveryResult> => page.evaluate(async () => {
    const { GAME_CLIENT_MANIFEST } = await import('/src/games/manifest.client.tsx');

    const isCollection = (source: unknown): source is {
        tutorials: Record<string, { manifest: { id: string; steps: SerializableTutorialStep[]; allowManualSkip?: boolean; randomPolicy?: unknown } }>;
    } => Boolean(
        source
            && typeof source === 'object'
            && 'tutorials' in source
            && typeof (source as { tutorials?: unknown }).tutorials === 'object',
    );

    const cases: TutorialResumeCase[] = [];
    const skipped: string[] = [];

    for (const entry of GAME_CLIENT_MANIFEST) {
        const gameId = entry.manifest.id;
        if (entry.manifest.type !== 'game' || entry.manifest.enabled !== true) {
            continue;
        }
        if (!entry.loadRuntime || !entry.loadTutorial) {
            skipped.push(`${gameId}: no tutorial runtime`);
            continue;
        }

        const [runtime, tutorialSource] = await Promise.all([
            entry.loadRuntime(),
            entry.loadTutorial(),
        ]);
        const tutorialEntries = isCollection(tutorialSource)
            ? Object.entries(tutorialSource.tutorials).map(([tutorialId, tutorialEntry]) => [
                tutorialId,
                tutorialEntry.manifest,
            ] as const)
            : [[
                (tutorialSource as { id: string }).id,
                tutorialSource as {
                    id: string;
                    steps: SerializableTutorialStep[];
                    allowManualSkip?: boolean;
                    randomPolicy?: unknown;
                },
            ] as const];

        for (const [tutorialId, manifest] of tutorialEntries) {
            if (!Array.isArray(manifest.steps) || manifest.steps.length < 2) {
                skipped.push(`${gameId}/${tutorialId}: fewer than 2 steps`);
                continue;
            }

            const runtimeLocalSetup = runtime.runtimeAdapter?.resolveLocalSetup?.({
                searchParams: new URLSearchParams(),
                tutorialId,
                tutorialMode: true,
            }) ?? null;
            const numPlayers = runtimeLocalSetup?.numPlayers
                ?? (manifest as { numPlayers?: number }).numPlayers
                ?? runtime.engineConfig?.minPlayers
                ?? 2;

            cases.push({
                gameId,
                tutorialId,
                manifestId: manifest.id,
                numPlayers,
                stepCount: manifest.steps.length,
            });
        }
    }

    return { cases, skipped };
});

const waitForStateHarnessReady = async (page: Page) => {
    await waitForTestHarness(page, 60000);
    await page.waitForFunction(
        () => window.__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
        undefined,
        { timeout: 60000 },
    );
};

type SavedProgress = {
    stepIndex: number;
    stepId: string;
    snapshotKey: string;
    snapshotSummary: unknown;
};

const readTutorialDiagnostics = async (page: Page) => page.evaluate(() => (
    window.__BG_TUTORIAL_CONTEXT_DIAGNOSTICS__ ?? null
));

const getSnapshotKey = (resumeCase: TutorialResumeCase) => {
    const seed = buildTutorialProgressSeed(
        resumeCase.gameId,
        resumeCase.tutorialId,
        resumeCase.manifestId,
    );
    return `local_match_snapshot_v1:${resumeCase.gameId}:${seed}`;
};

const readSnapshotSummary = async (
    page: Page,
    snapshotKey: string,
) => page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        const core = parsed?.state?.core ?? {};
        const sys = parsed?.state?.sys ?? {};
        return {
            numPlayers: parsed?.numPlayers,
            tutorial: {
                active: sys.tutorial?.active,
                manifestId: sys.tutorial?.manifestId,
                stepIndex: sys.tutorial?.stepIndex,
                stepId: sys.tutorial?.step?.id,
            },
            corePlayerIds: core.playerIds ?? null,
            corePlayers: core.players && typeof core.players === 'object'
                ? Object.keys(core.players)
                : null,
            currentPlayer: core.currentPlayer ?? null,
            turnOrder: sys.turnOrder ?? null,
            currentPlayerIndex: sys.currentPlayerIndex ?? null,
        };
    } catch (error) {
        return { parseError: String(error) };
    }
}, snapshotKey);

const progressTutorialToSavedMiddleStep = async (
    page: Page,
    resumeCase: TutorialResumeCase,
): Promise<SavedProgress> => {
    await page.waitForFunction(
        () => {
            const diagnostics = window.__BG_TUTORIAL_CONTEXT_DIAGNOSTICS__;
            return diagnostics?.active === true
                && typeof diagnostics.stepIndex === 'number'
                && typeof diagnostics.stepId === 'string';
        },
        undefined,
        { timeout: 30000 },
    );

    let diagnostics = await readTutorialDiagnostics(page);
    if (diagnostics?.stepIndex === 0) {
        const nextButton = page.getByTestId('tutorial-next-button');
        await expect(nextButton, `${resumeCase.gameId}/${resumeCase.tutorialId} should allow progressing beyond step 1`).toBeVisible({ timeout: 15000 });
        await nextButton.click();
        await page.waitForFunction(
            () => {
                const nextDiagnostics = window.__BG_TUTORIAL_CONTEXT_DIAGNOSTICS__;
                return nextDiagnostics?.active === true
                    && typeof nextDiagnostics.stepIndex === 'number'
                    && nextDiagnostics.stepIndex > 0
                    && typeof nextDiagnostics.stepId === 'string';
            },
            undefined,
            { timeout: 30000 },
        );
        diagnostics = await readTutorialDiagnostics(page);
    }

    if (
        diagnostics?.active !== true
        || typeof diagnostics.stepIndex !== 'number'
        || diagnostics.stepIndex <= 0
        || typeof diagnostics.stepId !== 'string'
    ) {
        throw new Error(`未能把教程推进到非第一步，当前诊断=${JSON.stringify(diagnostics)}`);
    }

    const snapshotKey = getSnapshotKey(resumeCase);
    await page.waitForFunction(
        ({ key, stepIndex, stepId, numPlayers }) => {
            const raw = localStorage.getItem(key);
            if (!raw) return false;
            try {
                const parsed = JSON.parse(raw);
                const tutorial = parsed?.state?.sys?.tutorial;
                return parsed?.numPlayers === numPlayers
                    && tutorial?.active === true
                    && tutorial?.stepIndex === stepIndex
                    && tutorial?.step?.id === stepId;
            } catch {
                return false;
            }
        },
        {
            key: snapshotKey,
            stepIndex: diagnostics.stepIndex,
            stepId: diagnostics.stepId,
            numPlayers: resumeCase.numPlayers,
        },
        { timeout: 30000 },
    );

    return {
        stepIndex: diagnostics.stepIndex,
        stepId: diagnostics.stepId,
        snapshotKey,
        snapshotSummary: await readSnapshotSummary(page, snapshotKey),
    };
};

const assertResumedAtSavedStep = async (
    page: Page,
    resumeCase: TutorialResumeCase,
    savedProgress: SavedProgress,
) => {
    try {
        await page.waitForFunction(
            ({ savedStepIndex, savedStepId }) => {
                const diagnostics = window.__BG_TUTORIAL_CONTEXT_DIAGNOSTICS__;
                return diagnostics?.active === true
                    && diagnostics.stepIndex === savedStepIndex
                    && diagnostics.stepId === savedStepId;
            },
            {
                savedStepIndex: savedProgress.stepIndex,
                savedStepId: savedProgress.stepId,
            },
            { timeout: 30000 },
        );
    } catch (error) {
        const diagnostics = await readTutorialDiagnostics(page);
        const snapshotSummary = await readSnapshotSummary(page, savedProgress.snapshotKey);
        throw new Error([
            error instanceof Error ? error.message : String(error),
            `saved=${JSON.stringify({
                stepIndex: savedProgress.stepIndex,
                stepId: savedProgress.stepId,
                snapshotSummary: savedProgress.snapshotSummary,
            })}`,
            `currentDiagnostics=${JSON.stringify(diagnostics)}`,
            `currentSnapshot=${JSON.stringify(snapshotSummary)}`,
        ].join('\n'));
    }

    const diagnostics = await page.evaluate(() => window.__BG_TUTORIAL_CONTEXT_DIAGNOSTICS__);
    expect(diagnostics?.stepIndex, `${resumeCase.gameId}/${resumeCase.tutorialId} should not restart from first step`)
        .toBe(savedProgress.stepIndex);
    expect(diagnostics?.stepId).toBe(savedProgress.stepId);
    expect(diagnostics?.stepIndex).not.toBe(0);
};

const verifyOneTutorialResumeCase = async (
    browser: Browser,
    resumeCase: TutorialResumeCase,
    shouldCaptureRepresentative: boolean,
): Promise<string | null> => {
    const context = await browser.newContext();
    await initContext(context, {
        skipTutorial: false,
        skipImageGate: true,
        storageKey: `tutorial-resume-${resumeCase.gameId}-${resumeCase.tutorialId}`,
    });
    const page = await context.newPage();
    const diagnostics = attachPageDiagnostics(page);
    const label = `${resumeCase.gameId}/${resumeCase.tutorialId}`;
    const tutorialUrl = `/play/${encodeURIComponent(resumeCase.gameId)}/tutorial/${encodeURIComponent(resumeCase.tutorialId)}`;

    try {
        await page.goto(tutorialUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector(`[data-game-page][data-game-id="${resumeCase.gameId}"]`, { timeout: 60000 });
        await waitForStateHarnessReady(page);
        const savedProgress = await progressTutorialToSavedMiddleStep(page, resumeCase);

        await page.reload({ waitUntil: 'domcontentloaded' });
        const continueButton = page.getByRole('button', { name: /从上次继续|Continue/i });
        await expect(continueButton, `${label} should show resume confirmation`).toBeVisible({ timeout: 30000 });
        await continueButton.click();

        await assertResumedAtSavedStep(page, resumeCase, savedProgress);
        await assertNoFatalFrontendErrors([{ label, diagnostics }]);

        if (shouldCaptureRepresentative) {
            await page.screenshot({ path: REPRESENTATIVE_SCREENSHOT_PATH, fullPage: true });
            return `${process.cwd()}\\${REPRESENTATIVE_SCREENSHOT_PATH.replace(/\//g, '\\')}`;
        }
        return null;
    } catch (error) {
        const failureScreenshotPath = [
            'test-results/evidence-screenshots/_shared',
            `${sanitizeForPath(resumeCase.gameId)}-${sanitizeForPath(resumeCase.tutorialId)}-resume-failure.png`,
        ].join('/');
        await page.screenshot({ path: failureScreenshotPath, fullPage: true }).catch(() => undefined);
        throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)} (screenshot: ${failureScreenshotPath})`);
    } finally {
        await context.close();
    }
};

test.describe('全部教程刷新恢复', () => {
    test('刷新后点击从上次继续应恢复到保存的中途步骤', async ({ browser }) => {
        test.setTimeout(30 * 60 * 1000);

        const discoveryContext = await browser.newContext();
        await initContext(discoveryContext, {
            skipTutorial: false,
            skipImageGate: true,
            storageKey: 'tutorial-resume-discovery',
        });
        const discoveryPage = await discoveryContext.newPage();
        await discoveryPage.goto('/', { waitUntil: 'domcontentloaded' });
        const discovery = await discoverTutorialResumeCases(discoveryPage);
        await discoveryContext.close();

        const filter = process.env.PW_TUTORIAL_RESUME_FILTER?.trim();
        const selectedCases = filter
            ? discovery.cases.filter((resumeCase) => (
                `${resumeCase.gameId}/${resumeCase.tutorialId}`.includes(filter)
                    || resumeCase.gameId === filter
            ))
            : discovery.cases;

        expect(selectedCases.length, 'should discover at least one tutorial resume case').toBeGreaterThan(0);

        const failures: string[] = [];
        const passed: string[] = [];
        let representativeScreenshot: string | null = null;

        for (const resumeCase of selectedCases) {
            try {
                const screenshot = await verifyOneTutorialResumeCase(
                    browser,
                    resumeCase,
                    representativeScreenshot === null,
                );
                if (screenshot) {
                    representativeScreenshot = screenshot;
                }
                passed.push(`${resumeCase.gameId}/${resumeCase.tutorialId}`);
            } catch (error) {
                failures.push(error instanceof Error ? error.message : String(error));
            }
        }

        console.log([
            `tutorial-resume-all passed=${passed.length} failed=${failures.length} skipped=${discovery.skipped.length}`,
            `representativeScreenshot=${representativeScreenshot ?? 'none'}`,
            `passedCases=${passed.join(', ')}`,
            `skippedCases=${discovery.skipped.join(', ') || 'none'}`,
        ].join('\n'));

        expect(failures, failures.join('\n')).toEqual([]);
    });
});
