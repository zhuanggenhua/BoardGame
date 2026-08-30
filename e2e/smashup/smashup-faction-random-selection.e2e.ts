import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';

type FactionSelectionHarnessState = {
    sys?: {
        phase?: string;
    };
    core?: {
        turnOrder?: string[];
        currentPlayerIndex?: number;
        factionSelection?: {
            takenFactions?: string[];
            playerSelections?: Record<string, string[]>;
        };
        players?: Record<string, {
            factions?: string[];
        }>;
    };
};

type TestHarnessWindow = Window & {
    __BG_TEST_HARNESS__?: {
        command?: {
            dispatch: (command: { type: string; playerId: string; payload: Record<string, unknown> }) => void;
        };
        state?: {
            get?: () => FactionSelectionHarnessState | null;
        };
    };
};

function buildFactionSelectionScene() {
    return {
        gameId: 'smashup',
        currentPlayer: '0' as const,
        phase: 'factionSelect' as const,
        randomQueue: [0],
        extra: {
            core: {
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                turnNumber: 1,
                nextUid: 1000,
                players: {
                    '0': {
                        id: '0',
                        vp: 0,
                        hand: [],
                        deck: [],
                        discard: [],
                        factions: ['', ''],
                    },
                    '1': {
                        id: '1',
                        vp: 0,
                        hand: [],
                        deck: [],
                        discard: [],
                        factions: ['', ''],
                    },
                },
                factionSelection: {
                    takenFactions: [],
                    playerSelections: {
                        '0': [],
                        '1': [],
                    },
                    completedPlayers: [],
                },
            },
        },
    };
}

async function waitForFactionSelectionReady(page: Page): Promise<void> {
    await expect(page.locator('h1').filter({ hasText: /Draft Your Factions|选择你的派系/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('faction-option-random')).toBeVisible({ timeout: 10000 });
}

async function readFactionSelectionState(page: Page): Promise<FactionSelectionHarnessState | null> {
    return page.evaluate(() => (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.() ?? null);
}

async function findAvailableFactionId(page: Page): Promise<string> {
    const factionId = await page.evaluate(() => {
        const state = (window as TestHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
        const takenFactionIds = new Set(
            Object.values(state?.core?.factionSelection?.playerSelections ?? {}).flat(),
        );
        const options = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="faction-option-"]'));
        const option = options.find((node) => (
            node.dataset.testid !== 'faction-option-random'
            && !node.className.includes('opacity-40')
            && !node.className.includes('pointer-events-none')
            && !takenFactionIds.has(node.dataset.testid?.replace(/^faction-option-/, '') ?? '')
        ));
        return option?.dataset.testid?.replace(/^faction-option-/, '') ?? null;
    });

    expect(factionId).toBeTruthy();
    return factionId!;
}

async function dispatchFactionSelection(page: Page, playerId: '0' | '1', factionId: string): Promise<void> {
    await page.evaluate(({ commandPlayerId, selectedFactionId }) => {
        const harness = (window as TestHarnessWindow).__BG_TEST_HARNESS__;
        harness?.command?.dispatch({
            type: 'su:select_faction',
            playerId: commandPlayerId,
            payload: { factionId: selectedFactionId },
        });
    }, { commandPlayerId: playerId, selectedFactionId: factionId });
}

test.describe('SmashUp 随机派系选择', () => {
    test('第一张随机派系卡点击后会落地为真实派系并占用该派系', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        const evidenceDir = join(process.cwd(), 'test-results', 'evidence-screenshots', 'smashup-faction-random-selection');
        mkdirSync(evidenceDir, { recursive: true });

        await setChineseLocale(page.context());
        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true, seat1: 'human' }, 20000);
        await game.setupScene(buildFactionSelectionScene());
        await waitForFactionSelectionReady(page);

        const option = page.getByTestId('faction-option-random');
        const firstFactionOption = page.locator('[data-testid^="faction-option-"]:not([data-testid="faction-option-random"])').first();
        await expect(option).toHaveAttribute('role', 'button');
        await expect(firstFactionOption).toBeVisible({ timeout: 10000 });
        await expect(option).toBeVisible();
        await expect
            .poll(() => page.locator('[data-testid^="faction-option-"]').first().getAttribute('data-testid'))
            .toBe('faction-option-random');

        const beforeState = await readFactionSelectionState(page);
        expect(beforeState?.sys?.phase).toBe('factionSelect');
        expect(beforeState?.core?.factionSelection?.playerSelections?.['0'] ?? []).toHaveLength(0);

        await page.screenshot({ path: join(evidenceDir, '01-random-faction-first-option.png'), fullPage: false });
        await page.screenshot({ path: testInfo.outputPath('01-random-faction-first-option.png'), fullPage: false });

        await option.click();

        await expect.poll(async () => {
            const state = await readFactionSelectionState(page);
            return state?.core?.factionSelection?.playerSelections?.['0'] ?? [];
        }, { timeout: 15000, intervals: [100, 200, 400] }).toHaveLength(1);

        const afterState = await readFactionSelectionState(page);
        const selectedFaction = afterState?.core?.factionSelection?.playerSelections?.['0']?.[0];
        expect(selectedFaction).toEqual(expect.any(String));
        expect(selectedFaction).not.toBe('random');
        expect(selectedFaction).not.toBe('');
        expect(afterState?.core?.factionSelection?.playerSelections?.['0']).toContain(selectedFaction);
        expect(afterState?.core?.factionSelection?.takenFactions).toContain(selectedFaction);

        await expect(page.getByTestId(`faction-option-${selectedFaction}`)).toContainText(/已选择|点按取消选择|已占领|Selected|Taken by/i);
        await page.screenshot({ path: join(evidenceDir, '02-random-faction-selected.png'), fullPage: false });
        await page.screenshot({ path: testInfo.outputPath('02-random-faction-selected.png'), fullPage: false });

        const selectionGrid = page.getByTestId('faction-virtual-window');
        await selectionGrid.evaluate((node) => {
            const scrollContainer = node.parentElement;
            if (!scrollContainer) throw new Error('找不到派系选择列表滚动容器');
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        });
        await page.waitForTimeout(300);
        await expect(selectionGrid).toBeVisible();
        await page.screenshot({ path: join(evidenceDir, '03-faction-list-scrolled.png'), fullPage: false });
        await page.screenshot({ path: testInfo.outputPath('03-faction-list-scrolled.png'), fullPage: false });

        const playerOneFirstFaction = await findAvailableFactionId(page);
        await dispatchFactionSelection(page, '1', playerOneFirstFaction);
        await expect.poll(async () => (await readFactionSelectionState(page))?.core?.factionSelection?.playerSelections?.['1'] ?? [])
            .toHaveLength(1);

        const playerOneSecondFaction = await findAvailableFactionId(page);
        await dispatchFactionSelection(page, '1', playerOneSecondFaction);
        await expect.poll(async () => (await readFactionSelectionState(page))?.core?.factionSelection?.playerSelections?.['1'] ?? [])
            .toHaveLength(2);

        const playerZeroSecondFaction = await findAvailableFactionId(page);
        await dispatchFactionSelection(page, '0', playerZeroSecondFaction);

        await expect.poll(async () => {
            const state = await readFactionSelectionState(page);
            return {
                phase: state?.sys?.phase ?? null,
                factionSelection: state?.core?.factionSelection ?? null,
                playerZeroFactions: state?.core?.players?.['0']?.factions ?? [],
                playerOneFactions: state?.core?.players?.['1']?.factions ?? [],
                playerZeroHand: state?.core?.players?.['0']?.hand?.length ?? 0,
                playerOneHand: state?.core?.players?.['1']?.hand?.length ?? 0,
            };
        }, { timeout: 15000, intervals: [100, 200, 400] }).toEqual({
            phase: 'playCards',
            factionSelection: null,
            playerZeroFactions: expect.arrayContaining([expect.any(String), expect.any(String)]),
            playerOneFactions: expect.arrayContaining([expect.any(String), expect.any(String)]),
            playerZeroHand: 5,
            playerOneHand: 5,
        });
    });
});
