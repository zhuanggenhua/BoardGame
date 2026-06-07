import { test, expect } from '../framework';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
    applyCoreStateDirect,
    clickBaseByIndex,
    clickHandCard,
    clickPromptOptionByText,
    closeDebugPanel,
    makeCard,
    makeMinion,
    readFullState,
    setupSUOnlineMatch,
    waitForHandArea,
} from './smashup-debug-helpers';

type SmashUpFullState = Awaited<ReturnType<typeof readFullState>>;

type PowerBadgeSnapshot = {
    text: string;
    title: string;
    className: string;
};

function buildEnchantmentScenario(state: SmashUpFullState, actorPid: string, enemyPid: string) {
    return {
        ...state.core,
        currentPlayerIndex: state.core.turnOrder.indexOf(actorPid),
        bases: state.core.bases.map((base, index) => ({
            ...base,
            minions: index === 0
                ? [
                    makeMinion('ally-1', 'fairies_tinx', actorPid, actorPid, 2),
                    makeMinion('enemy-1', 'alien_scout', enemyPid, enemyPid, 2),
                ]
                : [],
            ongoingActions: [],
            buriedCards: [],
        })),
        players: Object.fromEntries(
            Object.entries(state.core.players).map(([pid, player]) => [
                pid,
                {
                    ...player,
                    hand: pid === actorPid
                        ? [makeCard('enchantment-1', 'fairies_enchantment', 'action', actorPid)]
                        : [],
                    discard: [],
                    extraMinionPlays: 0,
                    extraActionPlays: 0,
                    minionPlaysThisTurn: pid === actorPid ? 0 : player.minionPlaysThisTurn,
                    actionPlaysThisTurn: pid === actorPid ? 0 : player.actionPlaysThisTurn,
                },
            ]),
        ),
    };
}

async function readPowerBadge(page: Parameters<typeof test>[0]['page'], minionUid: string): Promise<PowerBadgeSnapshot> {
    const badge = page.locator(`[data-minion-uid="${minionUid}"] [title*="基础:"]`).first();
    await expect(badge).toBeVisible({ timeout: 10000 });
    return badge.evaluate((node) => {
        const element = node as HTMLElement;
        return {
            text: element.innerText.trim(),
            title: element.getAttribute('title') ?? '',
            className: element.className,
        };
    });
}

async function saveOutcomeScreenshot(
    page: Parameters<typeof test>[0]['page'],
    fileName: string,
) {
    const dir = join(process.cwd(), 'evidence', 'smashup');
    await mkdir(dir, { recursive: true });
    const path = join(dir, fileName);
    await page.screenshot({ path, fullPage: true });
    return path;
}

async function prepareScenario(browser: Parameters<typeof setupSUOnlineMatch>[0], baseURL: string | undefined) {
    const setup = await setupSUOnlineMatch(browser, baseURL, ['fairies', 'aliens', 'dinosaurs', 'robots']);
    if (!setup) return null;

    const { hostPage, guestPage } = setup;
    await waitForHandArea(hostPage, 45000);
    await waitForHandArea(guestPage, 45000);

    const fullState = await readFullState(hostPage) as SmashUpFullState;
    const actorPid = fullState.core.turnOrder[fullState.core.currentPlayerIndex] ?? '0';
    const enemyPid = fullState.core.turnOrder.find((pid: string) => pid !== actorPid) ?? (actorPid === '0' ? '1' : '0');
    const injectedCore = buildEnchantmentScenario(fullState, actorPid, enemyPid);

    await applyCoreStateDirect(hostPage, injectedCore);
    await closeDebugPanel(hostPage);

    const actorPage = actorPid === '0' ? hostPage : guestPage;
    await waitForHandArea(actorPage, 10000);
    return { ...setup, actorPage, actorPid };
}

test.describe('大杀四方 - 精灵结果端到端', () => {
    test('选择 +1 时，metadata 与双方随从展示都应统一为 +1', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await prepareScenario(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostContext, guestContext, actorPage } = setup;
        try {
            await clickHandCard(actorPage, 0);
            await clickBaseByIndex(actorPage, 0);
            await clickPromptOptionByText(actorPage, /所有随从\s*\+1\s*力量/i);

            const resolved = await readFullState(actorPage) as SmashUpFullState;
            const ongoing = resolved.core.bases[0]?.ongoingActions?.find((action: { uid?: string }) => action.uid === 'enchantment-1');
            expect(ongoing?.metadata?.fairiesEnchantmentMode).toBe('plus');

            const allyBadge = await readPowerBadge(actorPage, 'ally-1');
            const enemyBadge = await readPowerBadge(actorPage, 'enemy-1');
            await saveOutcomeScreenshot(actorPage, 'fairies-enchantment-plus.png');

            expect(allyBadge.text).toBe('+1');
            expect(enemyBadge.text).toBe('+1');
            expect(allyBadge.title).toContain('= 3');
            expect(enemyBadge.title).toContain('= 3');
            expect(allyBadge.className).toContain('bg-green-600');
            expect(enemyBadge.className).toContain('bg-green-600');
        } finally {
            await guestContext.close();
            await hostContext.close();
        }
    });

    test('选择 -1 时，metadata 与双方随从展示都应统一为 -1', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await prepareScenario(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostContext, guestContext, actorPage } = setup;
        try {
            await clickHandCard(actorPage, 0);
            await clickBaseByIndex(actorPage, 0);
            await clickPromptOptionByText(actorPage, /所有随从\s*-1\s*力量/i);

            const resolved = await readFullState(actorPage) as SmashUpFullState;
            const ongoing = resolved.core.bases[0]?.ongoingActions?.find((action: { uid?: string }) => action.uid === 'enchantment-1');
            expect(ongoing?.metadata?.fairiesEnchantmentMode).toBe('minus');

            const allyBadge = await readPowerBadge(actorPage, 'ally-1');
            const enemyBadge = await readPowerBadge(actorPage, 'enemy-1');
            await saveOutcomeScreenshot(actorPage, 'fairies-enchantment-minus.png');

            expect(allyBadge.text).toBe('-1');
            expect(enemyBadge.text).toBe('-1');
            expect(allyBadge.title).toContain('= 1');
            expect(enemyBadge.title).toContain('= 1');
            expect(allyBadge.className).toContain('bg-red-600');
            expect(enemyBadge.className).toContain('bg-red-600');
        } finally {
            await guestContext.close();
            await hostContext.close();
        }
    });
});
