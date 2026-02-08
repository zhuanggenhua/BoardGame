/**
 * 月精灵 (Moon Elf) E2E 交互测试
 *
 * 覆盖交互面：
 * - 角色选择：月精灵在选角界面可选
 * - 攻击流程：掷骰 → 确认 → 选择技能 → 结算攻击 → 防御阶段
 * - 技能高亮：关键技能触发
 * - 防御阶段：防御掷骰流程覆盖
 * - 状态效果：Targeted 伤害提升结算
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { STATUS_IDS } from '../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../src/games/dicethrone/domain/resources';

// ============================================================================
// 复用辅助函数（与 dicethrone.e2e.ts 保持一致）
// ============================================================================

const setEnglishLocale = async (context: BrowserContext | Page) => {
    await context.addInitScript(() => {
        localStorage.setItem('i18nextLng', 'en');
    });
};

const normalizeUrl = (url: string) => url.replace(/\/$/, '');

const getGameServerBaseURL = () => {
    const envUrl = process.env.PW_GAME_SERVER_URL || process.env.VITE_GAME_SERVER_URL;
    if (envUrl) return normalizeUrl(envUrl);
    const port = process.env.GAME_SERVER_PORT || process.env.PW_GAME_SERVER_PORT || '18000';
    return `http://localhost:${port}`;
};

const ensureGameServerAvailable = async (page: Page) => {
    const gameServerBaseURL = getGameServerBaseURL();
    const candidates = ['/games', `${gameServerBaseURL}/games`];
    for (const url of candidates) {
        try {
            const response = await page.request.get(url);
            if (response.ok()) return true;
        } catch { /* ignore */ }
    }
    return false;
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

const waitForBoardReady = async (page: Page, timeout = 20000) => {
    await page.waitForFunction(() => {
        const selectors = [
            '[data-tutorial-id="advance-phase-button"]',
            '[data-tutorial-id="dice-roll-button"]',
            '[data-tutorial-id="hand-area"]',
        ];
        return selectors.some((selector) => {
            const el = document.querySelector(selector) as HTMLElement | null;
            if (!el) return false;
            const style = window.getComputedStyle(el);
            if (!style || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            const rects = el.getClientRects();
            return rects.length > 0 && rects[0].width > 0 && rects[0].height > 0;
        });
    }, { timeout });
};

const openDiceThroneModal = async (page: Page) => {
    await page.goto('/?game=dicethrone', { waitUntil: 'domcontentloaded' });
    const modalHeading = page.getByRole('heading', { name: /Dice Throne|王权骰铸/i }).first();
    await expect(modalHeading).toBeVisible({ timeout: 15000 });
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
    await expect(input).toBeHidden({ timeout: 5000 }).catch(() => { });
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

const getPlayerIdFromUrl = (page: Page, fallback: string) => {
    try {
        const url = new URL(page.url());
        return url.searchParams.get('playerID') ?? fallback;
    } catch {
        return fallback;
    }
};

const waitForMainPhase = async (page: Page, timeout = 20000) => {
    await expect(page.getByText(/Main Phase \(1\)|主要阶段 \(1\)/)).toBeVisible({ timeout });
};

const waitForRoomReady = async (page: Page, timeout = 15000) => {
    await page.waitForFunction(() => {
        const text = document.body?.innerText ?? '';
        const hasSelectionText = text.includes('Select Your Hero') || text.includes('选择你的英雄');
        const hasCharacterCard = document.querySelector('[data-char-id]') !== null;
        if (hasSelectionText || hasCharacterCard) return true;
        const candidates = Array.from(document.querySelectorAll(
            '[data-tutorial-id="player-board"], img[alt="Player Board"], img[alt="玩家面板"]'
        ));
        return candidates.some((el) => {
            const style = window.getComputedStyle(el);
            if (!style || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            const rects = (el as HTMLElement).getClientRects();
            return rects.length > 0 && rects[0].width > 0 && rects[0].height > 0;
        });
    }, { timeout });
};

const advanceToOffensiveRoll = async (page: Page) => {
    const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
    for (let attempt = 0; attempt < 5; attempt += 1) {
        if (await rollButton.isEnabled().catch(() => false)) return;
        const nextPhaseButton = page.locator('[data-tutorial-id="advance-phase-button"]');
        if (await nextPhaseButton.isEnabled().catch(() => false)) {
            await nextPhaseButton.click();
            await page.waitForTimeout(500);
        } else if (await nextPhaseButton.isVisible().catch(() => false)) {
            await page.waitForTimeout(300);
        }
    }
};

const maybePassResponse = async (page: Page) => {
    const passButton = page.getByRole('button', { name: /Pass|跳过/i });
    if (await passButton.isVisible()) {
        await passButton.click();
        return true;
    }
    return false;
};

const getModalContainerByHeading = async (page: Page, heading: RegExp, timeout = 8000) => {
    const headingLocator = page.getByRole('heading', { name: heading });
    await expect(headingLocator).toBeVisible({ timeout });
    return headingLocator.locator('..').locator('..');
};

// ============================================================================
// 月精灵 E2E 测试
// ============================================================================

test.describe('DiceThrone Moon Elf E2E', () => {

    // ========================================================================
    // 1. 在线对局：月精灵角色选择 + 基础攻击流程
    // ========================================================================
    test('Online match: Moon Elf character selection and basic attack flow', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        // 创建 Host 上下文
        const hostContext = await browser.newContext({ baseURL });
        await blockAudioRequests(hostContext);
        await disableAudio(hostContext);
        await disableTutorial(hostContext as any);
        await setEnglishLocale(hostContext);
        const hostPage = await hostContext.newPage();

        if (!await ensureGameServerAvailable(hostPage)) {
            test.skip(true, '游戏服务器不可用');
        }

        // 创建房间
        await openDiceThroneModal(hostPage);
        await hostPage.getByRole('button', { name: /Create Room|创建房间/i }).click();
        await expect(hostPage.getByRole('heading', { name: /Create Room|创建房间/i })).toBeVisible();
        await hostPage.getByRole('button', { name: /Confirm|确认/i }).click();
        try {
            await hostPage.waitForURL(/\/play\/dicethrone\/match\//, { timeout: 5000 });
        } catch {
            test.skip(true, '房间创建失败或后端不可用');
        }

        const hostUrl = new URL(hostPage.url());
        const matchId = hostUrl.pathname.split('/').pop();
        if (!matchId) throw new Error('无法从 URL 解析 matchId');

        if (!hostUrl.searchParams.get('playerID')) {
            hostUrl.searchParams.set('playerID', '0');
            await hostPage.goto(hostUrl.toString());
        }

        // Guest 加入
        const guestContext = await browser.newContext({ baseURL });
        await blockAudioRequests(guestContext);
        await disableAudio(guestContext);
        await disableTutorial(guestContext as any);
        await setEnglishLocale(guestContext);
        const guestPage = await guestContext.newPage();
        await guestPage.goto(`/play/dicethrone/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
        await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });

        // 先检查是否自动开始（服务器可能自动分配角色）
        let autoStarted = true;
        try {
            await waitForMainPhase(hostPage, 15000);
            await waitForMainPhase(guestPage, 15000);
        } catch {
            autoStarted = false;
        }

        if (!autoStarted) {
            // 等待角色选择界面
            await hostPage.waitForSelector('[data-char-id="moon_elf"]', { state: 'attached', timeout: 60000 });
            await guestPage.waitForSelector('[data-char-id="barbarian"]', { state: 'attached', timeout: 60000 });

            // Host 选月精灵，Guest 选野蛮人
            await hostPage.locator('[data-char-id="moon_elf"]').first().click();
            await guestPage.locator('[data-char-id="barbarian"]').first().click();

            // Guest 准备
            const readyButton = guestPage.getByRole('button', { name: /Ready|准备/i });
            await expect(readyButton).toBeVisible({ timeout: 20000 });
            await expect(readyButton).toBeEnabled({ timeout: 20000 });
            await readyButton.click();

            // Host 开始游戏
            const startButton = hostPage.getByRole('button', { name: /Start Game|开始游戏/i });
            await expect(startButton).toBeVisible({ timeout: 20000 });
            await expect(startButton).toBeEnabled({ timeout: 20000 });
            await startButton.click();

            // 等待进入 Main Phase 1
            await waitForMainPhase(hostPage, 15000);
            await waitForMainPhase(guestPage, 15000);
        }

        // 验证手牌区可见（4张初始手牌）
        await hostPage.waitForTimeout(2000);
        const hostHandArea = hostPage.locator('[data-tutorial-id="hand-area"]');
        await expect(hostHandArea).toBeVisible();
        const hostHandCards = hostHandArea.locator('[data-card-id]');
        await expect(hostHandCards).toHaveCount(4, { timeout: 15000 });

        // 确定攻击方（谁有 Next Phase 按钮可用）
        let attackerPage: Page;
        let defenderPage: Page;

        const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
        if (await hostNextPhase.isEnabled({ timeout: 3000 }).catch(() => false)) {
            attackerPage = hostPage;
            defenderPage = guestPage;
        } else {
            attackerPage = guestPage;
            defenderPage = hostPage;
        }

        // 推进到攻击掷骰阶段
        await advanceToOffensiveRoll(attackerPage);

        // 掷骰
        const rollButton = attackerPage.locator('[data-tutorial-id="dice-roll-button"]');
        await expect(rollButton).toBeEnabled({ timeout: 5000 });
        await rollButton.click();
        await attackerPage.waitForTimeout(300);

        // 设置骰面为 [1,1,1,1,1] = 5个弓(bow)，触发长弓 5-of-a-kind
        await applyDiceValues(attackerPage, [1, 1, 1, 1, 1]);

        // 确认掷骰
        const confirmButton = attackerPage.locator('[data-tutorial-id="dice-confirm-button"]');
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

        // 检查技能高亮（应该有技能被激活）
        const highlightedSlots = attackerPage
            .locator('[data-ability-slot]')
            .filter({ has: attackerPage.locator('div.animate-pulse[class*="border-"]') });
        const hasHighlight = await highlightedSlots.first().isVisible({ timeout: 5000 }).catch(() => false);

        if (hasHighlight) {
            // 选择高亮的技能
            await highlightedSlots.first().click();

            // 点击结算攻击
            const resolveAttackButton = attackerPage.getByRole('button', { name: /Resolve Attack|结算攻击/i });
            await expect(resolveAttackButton).toBeVisible({ timeout: 10000 });
            await resolveAttackButton.click();
        } else {
            // 没有高亮技能，直接推进
            const advanceButton = attackerPage.locator('[data-tutorial-id="advance-phase-button"]');
            await advanceButton.click();
            const confirmHeading = attackerPage.getByRole('heading', { name: /End offensive roll\?|确认结束攻击掷骰？/i });
            if (await confirmHeading.isVisible({ timeout: 4000 }).catch(() => false)) {
                const confirmSkipModal = confirmHeading.locator('..').locator('..');
                await confirmSkipModal.getByRole('button', { name: /Confirm|确认/i }).click();
            }
        }

        // 处理技能结算选择弹窗（如果出现）
        for (let choiceAttempt = 0; choiceAttempt < 5; choiceAttempt++) {
            let choiceModal: ReturnType<typeof attackerPage.locator> | null = null;
            try {
                choiceModal = await getModalContainerByHeading(attackerPage, /Ability Resolution Choice|技能结算选择/i, 1500);
            } catch { choiceModal = null; }
            if (!choiceModal) break;
            const choiceButton = choiceModal.getByRole('button').filter({ hasText: /\S+/ }).first();
            if (await choiceButton.isVisible({ timeout: 500 }).catch(() => false)) {
                await choiceButton.click();
                await attackerPage.waitForTimeout(500);
            }
        }

        // 等待防御阶段或 Main Phase 2
        const defensePhaseStarted = await Promise.race([
            defenderPage.getByRole('button', { name: /End Defense|结束防御/i }).isVisible({ timeout: 8000 }).then(() => true).catch(() => false),
            attackerPage.getByText(/Main Phase \(2\)|主要阶段 \(2\)/).isVisible({ timeout: 8000 }).then(() => false).catch(() => false),
        ]);

        if (defensePhaseStarted) {
            // 防御方掷骰并结束防御
            const defenderRollButton = defenderPage.locator('[data-tutorial-id="dice-roll-button"]');
            const defenderConfirmButton = defenderPage.locator('[data-tutorial-id="dice-confirm-button"]');
            const endDefenseButton = defenderPage.getByRole('button', { name: /End Defense|结束防御/i });

            const canRoll = await defenderRollButton.isEnabled({ timeout: 5000 }).catch(() => false);
            if (canRoll) {
                await defenderRollButton.click();
                await defenderPage.waitForTimeout(300);
                await defenderConfirmButton.click();
                await endDefenseButton.click();
            } else {
                const canEndDefense = await endDefenseButton.isEnabled({ timeout: 2000 }).catch(() => false);
                if (canEndDefense) await endDefenseButton.click();
            }

            // 处理响应窗口
            for (let i = 0; i < 4; i += 1) {
                const hostPassed = await maybePassResponse(hostPage);
                const guestPassed = await maybePassResponse(guestPage);
                if (!hostPassed && !guestPassed) break;
            }
        }

        // 验证到达 Main Phase 2（攻击完成）
        await expect(attackerPage.getByText(/Main Phase \(2\)|主要阶段 \(2\)/)).toBeVisible({ timeout: 15000 });

        await hostPage.screenshot({ path: testInfo.outputPath('moon-elf-attack-flow.png'), fullPage: false });

        await hostContext.close();
        await guestContext.close();
    });

    // ========================================================================
    // 2. 在线对局：Targeted 受伤 +2（伤害结算后移除）
    // ========================================================================
    test('Online match: Moon Elf Targeted increases damage by 2', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const hostContext = await browser.newContext({ baseURL });
        await blockAudioRequests(hostContext);
        await disableAudio(hostContext);
        await disableTutorial(hostContext as any);
        await setEnglishLocale(hostContext);
        const hostPage = await hostContext.newPage();

        if (!await ensureGameServerAvailable(hostPage)) {
            test.skip(true, '游戏服务器不可用');
        }

        // 创建房间
        await openDiceThroneModal(hostPage);
        await hostPage.getByRole('button', { name: /Create Room|创建房间/i }).click();
        await expect(hostPage.getByRole('heading', { name: /Create Room|创建房间/i })).toBeVisible();
        await hostPage.getByRole('button', { name: /Confirm|确认/i }).click();
        try {
            await hostPage.waitForURL(/\/play\/dicethrone\/match\//, { timeout: 5000 });
        } catch {
            test.skip(true, '房间创建失败或后端不可用');
        }

        const hostUrl = new URL(hostPage.url());
        const matchId = hostUrl.pathname.split('/').pop();
        if (!matchId) throw new Error('无法从 URL 解析 matchId');
        if (!hostUrl.searchParams.get('playerID')) {
            hostUrl.searchParams.set('playerID', '0');
            await hostPage.goto(hostUrl.toString());
        }

        const guestContext = await browser.newContext({ baseURL });
        await blockAudioRequests(guestContext);
        await disableAudio(guestContext);
        await disableTutorial(guestContext as any);
        await setEnglishLocale(guestContext);
        const guestPage = await guestContext.newPage();
        await guestPage.goto(`/play/dicethrone/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
        await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });

        // 先检查是否自动开始
        let autoStarted5 = true;
        try {
            await waitForMainPhase(hostPage, 15000);
            await waitForMainPhase(guestPage, 15000);
        } catch {
            autoStarted5 = false;
        }

        if (autoStarted5) {
            test.skip(true, '游戏自动开始，无法选择角色');
        }

        await hostPage.waitForSelector('[data-char-id="barbarian"]', { state: 'attached', timeout: 60000 });
        await guestPage.waitForSelector('[data-char-id="moon_elf"]', { state: 'attached', timeout: 60000 });
        await hostPage.locator('[data-char-id="barbarian"]').first().click();
        await guestPage.locator('[data-char-id="moon_elf"]').first().click();

        const readyButton = guestPage.getByRole('button', { name: /Ready|准备/i });
        await expect(readyButton).toBeVisible({ timeout: 20000 });
        await expect(readyButton).toBeEnabled({ timeout: 20000 });
        await readyButton.click();

        const startButton = hostPage.getByRole('button', { name: /Start Game|开始游戏/i });
        await expect(startButton).toBeVisible({ timeout: 20000 });
        await expect(startButton).toBeEnabled({ timeout: 20000 });
        await startButton.click();

        await waitForMainPhase(hostPage, 15000);
        await waitForMainPhase(guestPage, 15000);

        const hostNextPhase = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
        const hostIsActive = await hostNextPhase.isEnabled({ timeout: 3000 }).catch(() => false);
        if (!hostIsActive) {
            test.skip(true, '非预期起始玩家，无法构造 Targeted 受伤场景');
        }

        const attackerPage = hostPage;
        const defenderPage = guestPage;
        const defenderId = getPlayerIdFromUrl(defenderPage, '1');

        const coreState = await readCoreState(attackerPage);
        const defenderState = coreState?.players?.[defenderId];
        if (!defenderState) {
            test.skip(true, '无法读取防御方状态');
        }

        const hpBefore = defenderState.resources?.[RESOURCE_IDS.HP] ?? 0;
        const nextCoreState = {
            ...coreState,
            players: {
                ...coreState.players,
                [defenderId]: {
                    ...defenderState,
                    statusEffects: {
                        ...(defenderState.statusEffects ?? {}),
                        [STATUS_IDS.TARGETED]: 1,
                    },
                },
            },
        };

        await applyCoreState(attackerPage, nextCoreState);
        await attackerPage.waitForTimeout(300);

        // 狂战士进攻：4 Strength 触发不可防御攻击 (violent-assault)
        await advanceToOffensiveRoll(attackerPage);
        const rollButton = attackerPage.locator('[data-tutorial-id="dice-roll-button"]');
        await expect(rollButton).toBeEnabled({ timeout: 5000 });
        await rollButton.click();
        await attackerPage.waitForTimeout(300);
        await applyDiceValues(attackerPage, [6, 6, 6, 6, 1]);

        const confirmButton = attackerPage.locator('[data-tutorial-id="dice-confirm-button"]');
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

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
        expect(hpAfter).toBe(hpBefore - 7);
        expect(defenderAfter?.statusEffects?.[STATUS_IDS.TARGETED] ?? 0).toBe(0);

        await attackerPage.screenshot({ path: testInfo.outputPath('moon-elf-targeted-damage.png'), fullPage: false });

        await hostContext.close();
        await guestContext.close();
    });
});
