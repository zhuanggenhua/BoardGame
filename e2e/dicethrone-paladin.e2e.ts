/**
 * 圣骑士 (Paladin) E2E 交互测试
 *
 * 覆盖交互面：
 * - 神圣祝福 (Blessing of Divinity) 触发：免疫伤害并回复生命
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { TOKEN_IDS } from '../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../src/games/dicethrone/domain/resources';
import { initHeroState, createCharacterDice } from '../src/games/dicethrone/domain/characters';
// 触发骰子/资源定义注册（副作用 import）
import '../src/games/dicethrone/domain/index';

// ============================================================================
// 复用辅助函数（与 dicethrone-shadow-thief.e2e.ts 保持一致）
// ============================================================================

const setEnglishLocale = async (context: BrowserContext | Page) => {
    await context.addInitScript(() => {
        localStorage.setItem('i18nextLng', 'en');
    });
};

const disableTutorial = async (page: Page) => {
    await page.addInitScript(() => {
        localStorage.setItem('tutorial_skip', '1');
    });
};

const blockAudioRequests = async (context: BrowserContext | Page) => {
    await context.route(/\.(mp3|ogg|webm|wav)(\?.*)?$/i, route => route.abort());
};

const disableAudio = async (context: BrowserContext | Page) => {
    await context.addInitScript(() => {
        localStorage.setItem('audio_muted', 'true');
        localStorage.setItem('audio_master_volume', '0');
        localStorage.setItem('audio_sfx_volume', '0');
        localStorage.setItem('audio_bgm_volume', '0');
        (window as Window & { __BG_DISABLE_AUDIO__?: boolean }).__BG_DISABLE_AUDIO__ = true;
    });
};

const waitForMainPhase = async (page: Page, timeout = 20000) => {
    await expect(page.getByText(/Main Phase \(1\)|主要阶段 \(1\)/)).toBeVisible({ timeout });
};


const ensureDebugPanelOpen = async (page: Page) => {
    const panel = page.getByTestId('debug-panel');
    if (await panel.isVisible().catch(() => false)) return;
    await page.getByTestId('debug-toggle').click();
    await expect(panel).toBeVisible({ timeout: 5000 });
};

const closeDebugPanelIfOpen = async (page: Page) => {
    const panel = page.getByTestId('debug-panel');
    if (await panel.isVisible().catch(() => false)) {
        await page.getByTestId('debug-toggle').click();
        await expect(panel).toBeHidden({ timeout: 5000 });
    }
};


const ensureDebugControlsTab = async (page: Page) => {
    await ensureDebugPanelOpen(page);
    const controlsTab = page.getByRole('button', { name: /⚙️|System|系统/i });
    if (await controlsTab.isVisible().catch(() => false)) {
        await controlsTab.click();
    }
};

const ensureDebugStateTab = async (page: Page) => {
    await ensureDebugPanelOpen(page);
    const stateTab = page.getByTestId('debug-tab-state');
    if (await stateTab.isVisible().catch(() => false)) {
        await stateTab.click();
    }
};

const readCoreState = async (page: Page) => {
    await ensureDebugStateTab(page);
    const raw = await page.getByTestId('debug-state-json').innerText();
    const parsed = JSON.parse(raw);
    return parsed?.core ?? parsed?.G?.core ?? parsed;
};

const applyCoreState = async (page: Page, coreState: unknown) => {
    await ensureDebugStateTab(page);
    await page.getByTestId('debug-state-toggle-input').click();
    const input = page.getByTestId('debug-state-input');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill(JSON.stringify(coreState));
    await page.getByTestId('debug-state-apply').click();
    await expect(input).toBeHidden({ timeout: 5000 }).catch(() => {});
};

const applyDiceValues = async (page: Page, values: number[]) => {
    await ensureDebugControlsTab(page);
    const diceSection = page.getByTestId('dt-debug-dice');
    const diceInputs = diceSection.locator('input[type="number"]');
    await expect(diceInputs).toHaveCount(5);
    for (let i = 0; i < 5; i += 1) {
        await diceInputs.nth(i).fill(String(values[i] ?? 1));
    }
    await diceSection.getByTestId('dt-debug-dice-apply').click();
    await closeDebugPanelIfOpen(page);
};

const buildHeroState = (playerId: string, characterId: 'barbarian' | 'paladin') => {
    const dummyRandom = {
        shuffle: <T>(arr: T[]) => arr,
        random: () => 0.5,
        d: (_n: number) => 1,
        range: (min: number) => min,
    } as const;
    return initHeroState(playerId, characterId, dummyRandom);
};

const advanceToOffensiveRoll = async (page: Page) => {
    // 持续点击 NEXT PHASE 直到 core state 中 currentPhase === 'offensiveRoll'
    for (let attempt = 0; attempt < 10; attempt += 1) {
        // 先关闭可能存在的弹窗
        const cancelBtn = page.getByRole('button', { name: /Cancel.*Select Ability|取消/i });
        if (await cancelBtn.isVisible({ timeout: 300 }).catch(() => false)) {
            await cancelBtn.click();
            await page.waitForTimeout(300);
        }

        const coreState = await readCoreState(page);
        await closeDebugPanelIfOpen(page);
        if (coreState?.currentPhase === 'offensiveRoll') {
            return;
        }
        const nextPhaseButton = page.locator('[data-tutorial-id="advance-phase-button"]');
        if (await nextPhaseButton.isEnabled({ timeout: 1000 }).catch(() => false)) {
            await nextPhaseButton.click();
            // 等待状态更新
            await page.waitForTimeout(800);
        } else {
            await page.waitForTimeout(300);
        }
    }
};
const setupLocalMatch = async (
    browser: import('@playwright/test').Browser,
    baseURL: string | undefined,
    hostChar: 'barbarian' | 'paladin',
    guestChar: 'barbarian' | 'paladin',
) => {
    const context = await browser.newContext({ baseURL });
    await blockAudioRequests(context);
    await disableAudio(context);
    await setEnglishLocale(context);
    const page = await context.newPage();
    await disableTutorial(page);

    await page.goto('/play/dicethrone/local?seed=paladin-e2e', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('debug-toggle')).toBeVisible({ timeout: 15000 });

    const coreSnapshot = await readCoreState(page);
    const hostId = '0';
    const guestId = '1';
    const forcedCore = {
        ...coreSnapshot,
        players: {
            ...coreSnapshot.players,
            [hostId]: buildHeroState(hostId, hostChar),
            [guestId]: buildHeroState(guestId, guestChar),
        },
        selectedCharacters: {
            ...coreSnapshot.selectedCharacters,
            [hostId]: hostChar,
            [guestId]: guestChar,
        },
        readyPlayers: {
            ...coreSnapshot.readyPlayers,
            [hostId]: true,
            [guestId]: true,
        },
        hostStarted: true,
        activePlayerId: hostId,
        startingPlayerId: hostId,
        dice: createCharacterDice(hostChar),
    };
    await applyCoreState(page, forcedCore);
    await page.waitForTimeout(300);
    await closeDebugPanelIfOpen(page);
    await waitForMainPhase(page, 20000);

    return { page, context, hostId, guestId };
};

// ============================================================================
// 圣骑士 E2E 测试
// ============================================================================

test.describe('DiceThrone Paladin E2E', () => {
    // ========================================================================
    // 1. 神圣祝福触发（免疫伤害 + 回复生命）
    // ========================================================================
    test('Local match: Paladin Blessing of Divinity prevents lethal damage', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const match = await setupLocalMatch(browser, baseURL, 'barbarian', 'paladin');
        const { page, context, hostId, guestId } = match;

        const hostNextPhase = page.locator('[data-tutorial-id="advance-phase-button"]');
        const hostIsActive = await hostNextPhase.isEnabled({ timeout: 3000 }).catch(() => false);
        if (!hostIsActive) {
            const coreSnapshot = await readCoreState(page);
            const forcedCore = {
                ...coreSnapshot,
                activePlayerId: hostId,
                startingPlayerId: hostId,
            };
            await applyCoreState(page, forcedCore);
            await page.waitForTimeout(300);
            await closeDebugPanelIfOpen(page);
        }

        const attackerPage = page;
        const defenderPage = page;
        const defenderId = guestId;

        const coreState = await readCoreState(attackerPage);
        const defenderState = coreState?.players?.[defenderId];
        if (!defenderState) {
            throw new Error('无法读取防御方状态');
        }

        const hpBefore = 1;
        const nextCoreState = {
            ...coreState,
            players: {
                ...coreState.players,
                [defenderId]: {
                    ...defenderState,
                    resources: {
                        ...(defenderState.resources ?? {}),
                        [RESOURCE_IDS.HP]: hpBefore,
                    },
                    tokens: {
                        ...(defenderState.tokens ?? {}),
                        [TOKEN_IDS.BLESSING_OF_DIVINITY]: 1,
                    },
                },
            },
        };

        await applyCoreState(attackerPage, nextCoreState);
        await attackerPage.waitForTimeout(300);
        await closeDebugPanelIfOpen(attackerPage);

        // 狂战士进攻：4 Strength 触发不可防御攻击 (violent-assault)
        await advanceToOffensiveRoll(attackerPage);

        // 关闭可能出现的 "End Offensive Roll?" 弹窗
        const skipModal = attackerPage.getByRole('button', { name: /Cancel/i });
        if (await skipModal.isVisible({ timeout: 500 }).catch(() => false)) {
            await skipModal.click();
            await attackerPage.waitForTimeout(300);
        }

        const rollButton = attackerPage.locator('[data-tutorial-id="dice-roll-button"]');
        await expect(rollButton).toBeEnabled({ timeout: 5000 });
        await rollButton.click();
        await attackerPage.waitForTimeout(500);
        await applyDiceValues(attackerPage, [6, 6, 6, 6, 1]);
        await attackerPage.waitForTimeout(300);

        const confirmButton = attackerPage.locator('[data-tutorial-id="dice-confirm-button"]');
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();
        await attackerPage.waitForTimeout(1000);

        const highlightedSlots = attackerPage
            .locator('[data-ability-slot]')
            .filter({ has: attackerPage.locator('div.animate-pulse[class*="border-"]') });
        await expect(highlightedSlots.first()).toBeVisible({ timeout: 8000 });
        await highlightedSlots.first().click();

        const resolveAttackButton = attackerPage.getByRole('button', { name: /Resolve Attack|结算攻击/i });
        await expect(resolveAttackButton).toBeVisible({ timeout: 10000 });
        await resolveAttackButton.click();

        await expect(attackerPage.getByText(/Main Phase \(2\)|主要阶段 \(2\)/)).toBeVisible({ timeout: 15000 });

        const coreAfter = await readCoreState(attackerPage);
        const defenderAfter = coreAfter?.players?.[defenderId];
        const hpAfter = defenderAfter?.resources?.[RESOURCE_IDS.HP] ?? 0;
        expect(hpAfter).toBe(hpBefore + 5);
        expect(defenderAfter?.tokens?.[TOKEN_IDS.BLESSING_OF_DIVINITY] ?? 0).toBe(0);

        await attackerPage.screenshot({ path: testInfo.outputPath('paladin-blessing-prevent.png'), fullPage: false });

        await context.close();
    });
});
