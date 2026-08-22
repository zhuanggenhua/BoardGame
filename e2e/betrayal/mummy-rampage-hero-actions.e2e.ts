import { expect, test } from '@playwright/test';
import type { BetrayalCore } from '../../src/games/betrayal/game';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createFirstScenarioHauntRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    waitForPhysicalDiceSettled,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/山屋惊魂-木乃伊英雄行动真实入口';
const STUDY_READY_SCREENSHOT = `${EVIDENCE_DIR}/01-寻找真名前.jpg`;
const STUDY_SUCCESS_SCREENSHOT = `${EVIDENCE_DIR}/02-寻找真名成功.jpg`;
const LEARN_READY_SCREENSHOT = `${EVIDENCE_DIR}/03-学习驱逐法术前.jpg`;
const LEARN_SUCCESS_SCREENSHOT = `${EVIDENCE_DIR}/04-学习驱逐法术成功.jpg`;
const BANISH_READY_SCREENSHOT = `${EVIDENCE_DIR}/05-驱逐木乃伊前.jpg`;
const BANISH_ENDING_SCREENSHOT = `${EVIDENCE_DIR}/06-驱逐成功英雄终局朗读.jpg`;
const BANISH_REPORT_SCREENSHOT = `${EVIDENCE_DIR}/07-驱逐成功英雄结果报告.jpg`;
const HUMAN_HERO_TEST_URL = '/play/betrayal?players=3&playerID=0&seat0=human&seat1=human&seat2=human';

type BetrayalTraitKey = keyof BetrayalCore['currentExplorer']['traits'];

const cloneExplorer = (explorer: BetrayalCore['currentExplorer']) => ({
    ...explorer,
    traits: { ...explorer.traits },
    traitTracks: Object.fromEntries(
        Object.entries(explorer.traitTracks).map(([trait, track]) => [
            trait,
            { ...track, values: [...track.values] },
        ]),
    ) as BetrayalCore['currentExplorer']['traitTracks'],
    inventory: explorer.inventory.map((card) => ({ ...card })),
});

const activateExplorer = (core: BetrayalCore, playerId: string): BetrayalCore => {
    const explorers = [core.currentExplorer, ...core.otherExplorers].map(cloneExplorer);
    const active = explorers.find((explorer) => explorer.playerId === playerId);
    if (!active) {
        throw new Error(`木乃伊横行英雄线 E2E 夹具缺少玩家 ${playerId}`);
    }
    core.currentPlayer = playerId;
    core.currentExplorer = active;
    core.otherExplorers = explorers.filter((explorer) => explorer.playerId !== playerId);
    core.activeRoomId = active.roomId;
    core.currentExplorerRoomId = active.roomId;
    core.currentExplorerTraits = { ...active.traits };
    core.currentExplorerInventory = active.inventory.map((card) => ({ ...card }));
    core.turnStartInventoryCardIds = active.inventory.map((card) => card.id);
    return core;
};

const syncCurrentExplorerProjection = (core: BetrayalCore): void => {
    core.activeRoomId = core.currentExplorer.roomId;
    core.currentExplorerRoomId = core.currentExplorer.roomId;
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
    core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
};

const setTraitTrack = (
    core: BetrayalCore,
    playerId: string,
    trait: BetrayalTraitKey,
    values: number[],
    position: number,
    startPosition = 0,
): void => {
    const explorer = [core.currentExplorer, ...core.otherExplorers]
        .find((candidate) => candidate.playerId === playerId);
    if (!explorer) {
        throw new Error(`木乃伊横行英雄线 E2E 夹具无法设置玩家 ${playerId} 的属性`);
    }
    explorer.traitTracks[trait] = {
        trackId: `mummy-hero-e2e-${playerId}-${trait}`,
        values: [...values],
        position,
        startPosition,
        criticalPosition: 0,
        skullPosition: -1,
        maxPosition: values.length - 1,
    };
    explorer.traits[trait] = values[position] ?? 0;
    if (core.currentExplorer.playerId === playerId) {
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
    }
};

const dismissBlockingOverlays = (core: BetrayalCore): BetrayalCore => {
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;
    core.pendingEventChoice = null;
    core.pendingDamageAllocation = null;
    core.recentRoll = null;
    core.activePlayerId = null;
    return core;
};

const createMummyHeroActionCore = (stage: 'study-name' | 'learn-banishment' | 'banish') => {
    let core = createFirstScenarioHauntRuntimeCore();
    const traitorId = core.scenarioRuntime.traitorPlayerId;
    const heroId = core.playerIds.find((playerId) => playerId !== traitorId);
    const mummyRuntime = core.scenarioRuntime.mummy;
    if (!heroId || !mummyRuntime) {
        throw new Error('木乃伊横行英雄线 E2E 夹具缺少英雄或木乃伊运行态');
    }
    core = activateExplorer(core, heroId);
    const sarcophagusRoomId = mummyRuntime.sarcophagusRoomId;
    const book = { id: 'omen-book', name: '书本', kind: 'omen' as const };
    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: sarcophagusRoomId,
        inventory: [
            ...core.currentExplorer.inventory.filter((card) => card.id !== book.id),
            book,
        ],
    };
    core.otherExplorers = core.otherExplorers.map((explorer) => (
        explorer.playerId === traitorId ? { ...explorer, roomId: 'entrance-hall' } : explorer
    ));
    core.monsters = core.monsters.map((monster) => (
        monster.id === mummyRuntime.mummyMonsterId || monster.definitionId === 'mummy'
            ? { ...monster, roomId: sarcophagusRoomId }
            : monster
    ));
    core.scenarioRuntime.mummy = {
        ...mummyRuntime,
        girlRoomId: null,
        girlHolderPlayerId: null,
        girlHeldByMummy: false,
        knowledgeTokenCount: stage === 'study-name' ? 0 : stage === 'learn-banishment' ? 1 : 2,
        trueNameFound: stage !== 'study-name',
        banishmentSpellLearned: stage === 'banish',
    };
    core.usedCardIdsThisTurn = [];
    core.recommendedAction = 'use';
    setTraitTrack(core, heroId, 'knowledge', [4], 0);
    setTraitTrack(core, heroId, 'sanity', [6], 0);
    syncCurrentExplorerProjection(core);
    return {
        core: dismissBlockingOverlays(core),
        heroId,
        sarcophagusRoomId,
    };
};

const openBetrayalAsHero = async (page: Parameters<typeof injectCore>[0]): Promise<void> => {
    await page.goto(HUMAN_HERO_TEST_URL, { waitUntil: 'domcontentloaded' });
    await waitForBetrayalPageReady(page);
};

type MummyHeroState = {
    currentPlayer?: string;
    knowledgeTokenCount?: number;
    trueNameFound?: boolean;
    banishmentSpellLearned?: boolean;
    recentRollKind?: string | null;
    recentRollSourceTitle?: string | null;
    recentRollLatestLabel?: string | null;
    endgameOutcome?: string | null;
};

const readMummyHeroState = async (page: Parameters<typeof injectCore>[0]): Promise<MummyHeroState> =>
    page.evaluate(() => {
        const state = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentPlayer?: string;
                            endgameResult?: { outcome?: string } | null;
                            recentRoll?: {
                                kind?: string;
                                sourceTitle?: string;
                                latestLabel?: string;
                            } | null;
                            scenarioRuntime?: {
                                mummy?: {
                                    knowledgeTokenCount?: number;
                                    trueNameFound?: boolean;
                                    banishmentSpellLearned?: boolean;
                                };
                            };
                        };
                    };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.();
        const core = state?.core;
        const mummy = core?.scenarioRuntime?.mummy;
        return {
            currentPlayer: core?.currentPlayer,
            knowledgeTokenCount: mummy?.knowledgeTokenCount,
            trueNameFound: mummy?.trueNameFound,
            banishmentSpellLearned: mummy?.banishmentSpellLearned,
            recentRollKind: core?.recentRoll?.kind ?? null,
            recentRollSourceTitle: core?.recentRoll?.sourceTitle ?? null,
            recentRollLatestLabel: core?.recentRoll?.latestLabel ?? null,
            endgameOutcome: core?.endgameResult?.outcome ?? null,
        };
    });

test.describe('山屋惊魂木乃伊横行英雄行动真实入口', () => {
    test('英雄可从真实牌桌入口寻找真名并取得第 1 枚知识标记', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-hero-study-name');
        const fixture = createMummyHeroActionCore('study-name');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayalAsHero(page);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyHeroState(page)).toMatchObject({
            currentPlayer: fixture.heroId,
            knowledgeTokenCount: 0,
            trueNameFound: false,
        });
        await expect(page.getByTestId('betrayal-action-use')).toContainText('寻找木乃伊真名');
        await expect(page.getByTestId('betrayal-action-cue')).toContainText('点寻找真名');
        await saveScreenshot(page, STUDY_READY_SCREENSHOT);

        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99]);
        await page.getByTestId('betrayal-action-use').click();
        const rollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(rollPanel).toBeVisible();
        await expect(rollPanel).toContainText('寻找木乃伊真名');
        await expect(rollPanel).toContainText('取得第 1 枚知识标记');
        await waitForPhysicalDiceSettled(rollPanel);
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('找到了木乃伊真名');
        await expect.poll(() => readMummyHeroState(page)).toMatchObject({
            knowledgeTokenCount: 1,
            trueNameFound: true,
            recentRollKind: 'hauntActionTraitCheck',
            recentRollSourceTitle: '寻找木乃伊真名',
            recentRollLatestLabel: '取得第 1 枚知识标记',
        });
        await saveScreenshot(page, STUDY_SUCCESS_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-hero-study-name', diagnostics }]);
    });

    test('持书英雄可从真实牌桌入口学习驱逐法术并取得第 2 枚知识标记', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-hero-learn-banishment');
        const fixture = createMummyHeroActionCore('learn-banishment');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayalAsHero(page);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyHeroState(page)).toMatchObject({
            currentPlayer: fixture.heroId,
            knowledgeTokenCount: 1,
            trueNameFound: true,
            banishmentSpellLearned: false,
        });
        await expect(page.getByTestId('betrayal-action-use')).toContainText('学习驱逐法术');
        await expect(page.getByTestId('betrayal-action-cue')).toContainText('点学习驱逐法术');
        await saveScreenshot(page, LEARN_READY_SCREENSHOT);

        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99]);
        await page.getByTestId('betrayal-action-use').click();
        const rollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(rollPanel).toBeVisible();
        await expect(rollPanel).toContainText('学习驱逐法术');
        await expect(rollPanel).toContainText('取得第 2 枚知识标记');
        await waitForPhysicalDiceSettled(rollPanel);
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('学会驱逐木乃伊的法术');
        await expect.poll(() => readMummyHeroState(page)).toMatchObject({
            knowledgeTokenCount: 2,
            banishmentSpellLearned: true,
            recentRollKind: 'hauntActionTraitCheck',
            recentRollSourceTitle: '学习驱逐法术',
            recentRollLatestLabel: '取得第 2 枚知识标记',
        });
        await saveScreenshot(page, LEARN_SUCCESS_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-hero-learn-banishment', diagnostics }]);
    });

    test('英雄可从真实牌桌入口驱逐木乃伊并进入英雄终局', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mummy-rampage-hero-banish');
        const fixture = createMummyHeroActionCore('banish');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await openBetrayalAsHero(page);
        await injectCore(page, fixture.core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readMummyHeroState(page)).toMatchObject({
            currentPlayer: fixture.heroId,
            knowledgeTokenCount: 2,
            trueNameFound: true,
            banishmentSpellLearned: true,
        });
        await expect(page.getByTestId('betrayal-action-use')).toContainText('驱逐木乃伊');
        await expect(page.getByTestId('betrayal-action-cue')).toContainText('点驱逐木乃伊');
        await saveScreenshot(page, BANISH_READY_SCREENSHOT);

        await setHarnessRandomQueue(page, [
            0.99, 0.99, 0.99, 0.99, 0.99, 0.99,
            0.01, 0.01, 0.01, 0.01, 0.01,
        ]);
        await page.getByTestId('betrayal-action-use').click();
        await expect.poll(() => readMummyHeroState(page)).toMatchObject({
            endgameOutcome: 'survivors',
        });
        const exorciseRollReview = page.getByTestId('betrayal-exorcise-roll-review');
        await expect(exorciseRollReview).toBeVisible({ timeout: 30000 });
        const rollPanel = exorciseRollReview.getByTestId('betrayal-recent-roll-panel');
        await expect(rollPanel).toContainText('驱逐木乃伊');
        await expect(rollPanel).toContainText('神志对抗');
        await waitForPhysicalDiceSettled(rollPanel);
        await expect(page.getByTestId('betrayal-exorcise-roll-continue')).toContainText(/进入终局|查看终局|继续/);
        await page.getByTestId('betrayal-exorcise-roll-continue').click();
        const endgame = page.getByTestId('betrayal-endgame-screen');
        await expect(endgame).toBeVisible({ timeout: 30000 });
        await expect(endgame.getByTestId('betrayal-endgame-ending-narration')).toContainText('木乃伊犹如细砂随风飞散');
        await saveScreenshot(page, BANISH_ENDING_SCREENSHOT);
        await endgame.getByTestId('betrayal-endgame-ending-continue').click();
        await expect(endgame.getByTestId('betrayal-endgame-result-report')).toBeVisible();
        await saveScreenshot(page, BANISH_REPORT_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-mummy-rampage-hero-banish', diagnostics }]);
    });
});
