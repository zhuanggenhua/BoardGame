import { expect, test, type Locator } from '@playwright/test';
import { BETRAYAL_COMMANDS, type BetrayalCore } from '../../src/games/betrayal/game';
import { BETRAYAL_DISCOVERY_POOLS } from '../../src/games/betrayal/scenarioConfig';
import {
    applyBetrayalCommand,
    createBetrayalScriptedRandom,
    createStartedFirstScenarioCore,
} from '../../src/games/betrayal/testing/firstScenarioTestUtils';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createFirstScenarioHauntRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-core-interactions/haunt-reveal-protocol';
const ONE_TRAITOR_REVEAL_SCREENSHOT = `${EVIDENCE_DIR}/01-作祟揭示-一名叛徒公开步骤.jpg`;
const ONE_TRAITOR_BOARD_SCREENSHOT = `${EVIDENCE_DIR}/02-作祟揭示-一名叛徒返回牌桌.jpg`;
const HIDDEN_TRAITOR_REVEAL_SCREENSHOT = `${EVIDENCE_DIR}/03-作祟揭示-隐藏叛徒公开步骤.jpg`;
const HIDDEN_TRAITOR_BOARD_SCREENSHOT = `${EVIDENCE_DIR}/04-作祟揭示-隐藏叛徒返回牌桌.jpg`;

const FORBIDDEN_PLAYER_UI_INTERNAL_COPY = [
    '上屏',
    'off-screen',
    '看清后可关闭',
    '阅读后关闭',
    '确认是否受影响',
    '确认一下是否受影响',
    '如果有就给我看图',
    'setup 队列',
    'setup queue',
] as const;

async function expectNoForbiddenPlayerUiInternalCopy(locator: Locator, label: string) {
    for (const phrase of FORBIDDEN_PLAYER_UI_INTERNAL_COPY) {
        await expect(
            locator,
            `${label} 不得出现内部审查/AI过程话术：${phrase}`,
        ).not.toContainText(phrase);
    }
}

function createDustHauntRevealCore(playerIds: string[] = ['0', '1', '2']): BetrayalCore {
    let core = createStartedFirstScenarioCore(playerIds);
    const dustEvent = BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一瓶微尘');
    if (!dustEvent) {
        throw new Error('山屋作祟揭示 E2E 缺少事件牌《一瓶微尘》');
    }
    core.drawOrder = ['event'];
    core.eventOrder = [dustEvent];
    core.currentExplorer.inventory = [
        ...core.currentExplorer.inventory,
        { id: 'omen-book', name: '书本', kind: 'omen' },
        { id: 'dog', name: '狗', kind: 'omen' },
        { id: 'mask', name: '面具', kind: 'omen' },
    ];
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.currentExplorerTraits = { ...core.currentExplorer.traits };

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
    return applyBetrayalCommand(
        core,
        BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
        '0',
        { accept: true },
        100,
        createBetrayalScriptedRandom(3, 3, 3),
    );
}

async function openInjectedBetrayalBoard(page: Parameters<typeof injectCore>[0], core: BetrayalCore) {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&playerID=1', {
        waitUntil: 'domcontentloaded',
    });
    await waitForBetrayalPageReady(page);
    await injectCore(page, core);
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆后|Haunt/i);
}

async function expectScenarioReaderIsNotAutoOpened(page: Parameters<typeof injectCore>[0]) {
    await expect(
        page.getByTestId('betrayal-scenario-reader-dialog'),
        '作祟揭示不能自动弹出剧本书；剧本书应由牌桌入口手动打开',
    ).toHaveCount(0);
    await expect(
        page.getByTestId('betrayal-recent-roll-panel'),
        '作祟开场骰盘不能挡住牌桌公开提示',
    ).toHaveCount(0);
    await expect(page.getByTestId('betrayal-open-scenario')).toBeVisible();
}

test.describe('山屋惊魂作祟揭示顺序和秘密边界', () => {
    test('一名叛徒作祟揭示层先显示英雄和叛徒公开介绍 / 设置', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-haunt-reveal-one-traitor');

        await warmBetrayalFrontend(context);
        await openInjectedBetrayalBoard(page, createFirstScenarioHauntRuntimeCore());

        await expect(page.getByTestId('betrayal-haunt-reveal-public-steps')).toHaveAttribute('data-haunt-type', 'one-traitor');
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveAttribute('data-haunt-setup-count', '6');
        await expect(page.getByTestId('betrayal-haunt-reveal-public-flow')).toContainText('公开读英雄介绍/设置，再公开读叛徒介绍/设置');
        await expect(page.getByTestId('betrayal-haunt-reveal-secret-boundary')).toContainText('之后分开阅读目标/秘密规则');
        await expectNoForbiddenPlayerUiInternalCopy(page.locator('body'), '一名叛徒作祟揭示页');
        await expect(page.getByTestId('betrayal-haunt-setup-queue')).toHaveCount(0);
        await expect(page.getByText('治疗并强化叛徒')).toHaveCount(0);
        await expect(page.getByText('准备杰克标记')).toHaveCount(0);

        await expectScenarioReaderIsNotAutoOpened(page);
        const revealCue = page.getByTestId('betrayal-haunt-reveal-cue');
        await expect(revealCue).toBeVisible();
        await expect(page.getByTestId('betrayal-action-use')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-trade')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-attack-weapon-selector')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-haunt-reveal-return-to-board')).toContainText('返回牌桌');
        await saveScreenshot(page, ONE_TRAITOR_REVEAL_SCREENSHOT);

        await page.getByTestId('betrayal-haunt-reveal-return-to-board').click();
        await expect(revealCue).toHaveCount(0);
        await expect(page.getByTestId('betrayal-scenario-reader-dialog')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-open-scenario')).toBeVisible();
        await expect(page.getByTestId('betrayal-haunt-setup-queue')).toHaveCount(0);
        await saveScreenshot(page, ONE_TRAITOR_BOARD_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-haunt-reveal-one-traitor', diagnostics }]);
    });

    test('隐藏叛徒作祟揭示层不显示叛徒公开步骤，并提示隐藏身份边界', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-haunt-reveal-hidden-traitor');

        await warmBetrayalFrontend(context);
        await openInjectedBetrayalBoard(page, createDustHauntRevealCore());

        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveAttribute('data-haunt-type', 'hidden-traitor');
        await expect(page.getByTestId('betrayal-haunt-reveal-public-steps')).toHaveAttribute('data-haunt-type', 'hidden-traitor');
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveAttribute('data-haunt-setup-count', '5');
        await expect(page.getByTestId('betrayal-haunt-reveal-public-flow')).toContainText('公开读英雄介绍/设置；叛徒身份不公开');
        await expect(page.getByTestId('betrayal-haunt-reveal-step-traitor-intro')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-haunt-reveal-step-traitor-setup')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-haunt-reveal-secret-boundary')).toContainText('隐藏身份保持秘密；目标与秘密规则分开阅读');
        await expectNoForbiddenPlayerUiInternalCopy(page.locator('body'), '隐藏叛徒作祟揭示页');
        await expect(page.getByTestId('betrayal-haunt-setup-queue')).toHaveCount(0);
        await expect(page.getByText('秘密分发疾病标记')).toHaveCount(0);

        await expectScenarioReaderIsNotAutoOpened(page);
        const revealCue = page.getByTestId('betrayal-haunt-reveal-cue');
        await expect(revealCue).toBeVisible();
        await expect(page.getByTestId('betrayal-dust-progress-strip')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-use')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-trade')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-attack-weapon-selector')).toHaveCount(0);
        await expect(page.getByText('攻击灰尘')).toHaveCount(0);
        await expect(page.getByText('交换疾病')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-haunt-reveal-return-to-board')).toContainText('返回牌桌');
        await saveScreenshot(page, HIDDEN_TRAITOR_REVEAL_SCREENSHOT);

        await page.getByTestId('betrayal-haunt-reveal-return-to-board').click();
        await expect(revealCue).toHaveCount(0);
        const dustProgressStrip = page.getByTestId('betrayal-dust-progress-strip');
        await expect(dustProgressStrip).toBeVisible();
        await expect(dustProgressStrip).toContainText('剧本3查阅');
        await expect(dustProgressStrip).toContainText('灰尘');
        await expect(dustProgressStrip).toContainText('研究');
        await expect(dustProgressStrip).toContainText('疾病');
        await expect(dustProgressStrip).toContainText('交换疾病');
        await expect(page.getByText('秘密分发疾病标记')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-scenario-reader-dialog')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-open-scenario')).toBeVisible();
        await saveScreenshot(page, HIDDEN_TRAITOR_BOARD_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-haunt-reveal-hidden-traitor', diagnostics }]);
    });
});
