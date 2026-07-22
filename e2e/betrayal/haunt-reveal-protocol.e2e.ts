import { expect, test } from '@playwright/test';
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
const ONE_TRAITOR_SCREENSHOT = `${EVIDENCE_DIR}/01-作祟揭示-一名叛徒公开步骤.jpg`;
const HIDDEN_TRAITOR_SCREENSHOT = `${EVIDENCE_DIR}/02-作祟揭示-隐藏叛徒公开步骤.jpg`;

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

async function closeAutoOpenedScenarioReaderIfPresent(page: Parameters<typeof injectCore>[0]) {
    const dialog = page.getByTestId('betrayal-scenario-reader-dialog');
    try {
        await expect(dialog).toBeVisible({ timeout: 5000 });
    } catch {
        return;
    }
    await page.getByTestId('betrayal-scenario-reader-close').click();
    await expect(dialog).toBeHidden();
}

test.describe('山屋惊魂作祟揭示顺序和秘密边界', () => {
    test('一名叛徒作祟揭示层先显示英雄和叛徒公开介绍 / 设置', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-haunt-reveal-one-traitor');

        await warmBetrayalFrontend(context);
        await openInjectedBetrayalBoard(page, createFirstScenarioHauntRuntimeCore());

        await expect(page.getByTestId('betrayal-haunt-reveal-public-steps')).toHaveAttribute('data-haunt-type', 'one-traitor');
        await expect(page.getByTestId('betrayal-haunt-reveal-step-heroes-intro')).toContainText('公开：英雄介绍');
        await expect(page.getByTestId('betrayal-haunt-reveal-step-heroes-setup')).toContainText('公开：英雄设置');
        await expect(page.getByTestId('betrayal-haunt-reveal-step-traitor-intro')).toContainText('公开：叛徒介绍');
        await expect(page.getByTestId('betrayal-haunt-reveal-step-traitor-setup')).toContainText('公开：叛徒设置');
        await expect(page.getByTestId('betrayal-haunt-reveal-secret-boundary')).toContainText('之后分开阅读目标');
        await expect(page.getByTestId('betrayal-haunt-setup-queue')).toHaveAttribute('data-haunt-setup-count', '6');
        await expect(page.getByTestId('betrayal-haunt-setup-entry-heal-and-boost-traitor')).toContainText('治疗并强化叛徒');
        await expect(page.getByTestId('betrayal-haunt-setup-entry-prepare-jack-spirit-tokens')).toContainText('按书确认');

        await closeAutoOpenedScenarioReaderIfPresent(page);
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toBeVisible();
        await saveScreenshot(page, ONE_TRAITOR_SCREENSHOT);

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
        await expect(page.getByTestId('betrayal-haunt-reveal-step-heroes-intro')).toContainText('公开：英雄介绍');
        await expect(page.getByTestId('betrayal-haunt-reveal-step-heroes-setup')).toContainText('公开：英雄设置');
        await expect(page.getByTestId('betrayal-haunt-reveal-step-traitor-intro')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-haunt-reveal-step-traitor-setup')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-haunt-reveal-secret-boundary')).toContainText('隐藏身份不公开');
        await expect(page.getByTestId('betrayal-haunt-setup-queue')).toHaveAttribute('data-haunt-setup-count', '5');
        await expect(page.getByTestId('betrayal-haunt-setup-entry-announce-hidden-traitor')).toContainText('公开隐藏叛徒规则');
        await expect(page.getByTestId('betrayal-haunt-setup-entry-deal-secret-sickness-tokens')).toContainText('秘密分发疾病标记');

        await closeAutoOpenedScenarioReaderIfPresent(page);
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toBeVisible();
        await saveScreenshot(page, HIDDEN_TRAITOR_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-haunt-reveal-hidden-traitor', diagnostics }]);
    });
});
