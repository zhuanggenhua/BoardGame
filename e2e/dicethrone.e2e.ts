import { test, expect, type Page, type BrowserContext, type Locator } from '@playwright/test';

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
        } catch {
            // ignore
        }
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
            if (!style || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return false;
            }
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

const openDebugStateTab = async (page: Page) => {
    await ensureDebugPanelOpen(page);
    await page.getByTestId('debug-tab-state').click();
};

const readDebugCoreState = async (page: Page) => {
    await openDebugStateTab(page);
    const rawStateText = await page.getByTestId('debug-state-json').textContent();
    const stateText = rawStateText?.trim();
    if (!stateText) {
        throw new Error('Failed to read debug game state.');
    }
    const state = JSON.parse(stateText) as { core?: Record<string, unknown> };
    const core = (state.core ?? state) as Record<string, unknown>;
    return JSON.parse(JSON.stringify(core)) as Record<string, unknown>;
};

const applyCoreState = async (
    page: Page,
    updater: (core: Record<string, unknown>) => Record<string, unknown>
) => {
    const core = await readDebugCoreState(page);
    const nextCore = updater(core);
    const stateInput = page.getByTestId('debug-state-input');
    if (!await stateInput.isVisible().catch(() => false)) {
        await page.getByTestId('debug-state-toggle-input').click();
    }
    await stateInput.fill(JSON.stringify(nextCore));
    await page.getByTestId('debug-state-apply').click();
    await closeDebugPanelIfOpen(page);
};

const setPlayerCp = async (page: Page, playerId: string, value: number) => {
    await applyCoreState(page, (core) => {
        const players = core.players as Record<string, any> | undefined;
        const player = players?.[playerId];
        if (!player) return core;
        player.resources = player.resources ?? {};
        player.resources.cp = value;
        return core;
    });
};

const ensureCardInHand = async (page: Page, cardId: string, playerId = '0') => {
    await applyCoreState(page, (core) => {
        const players = core.players as Record<string, any> | undefined;
        const player = players?.[playerId];
        if (!player) return core;
        const takeCard = (list: any[]) => {
            const idx = list.findIndex((card) => card?.id === cardId);
            if (idx === -1) return null;
            return list.splice(idx, 1)[0];
        };
        player.hand = player.hand ?? [];
        player.deck = player.deck ?? [];
        player.discard = player.discard ?? [];
        const card = takeCard(player.hand) ?? takeCard(player.deck) ?? takeCard(player.discard);
        if (card) {
            player.hand.push(card);
        }
        return core;
    });
};

const dragCardUp = async (page: Page, cardId: string, distance = 220) => {
    const card = page.locator(`[data-card-id="${cardId}"]`).first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const box = await card.boundingBox();
    if (!box) {
        throw new Error(`Card ${cardId} has no bounding box.`);
    }
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY - distance, { steps: 10 });
    await page.mouse.up();
};

const waitForTutorialStep = async (page: Page, stepId: string, timeout = 15000) => {
    await page.waitForFunction(
        (target) => {
            const el = document.querySelector('[data-tutorial-step]');
            return el && el.getAttribute('data-tutorial-step') === target;
        },
        stepId,
        { timeout }
    );
};

const closeTokenResponseModal = async (modal: Locator) => {
    const button = modal.getByRole('button', { name: /Skip|Confirm|跳过|确认/i }).first();
    if (await button.isVisible().catch(() => false)) {
        await button.click();
    }
};

const getModalContainerByHeading = async (page: Page, heading: RegExp, timeout = 8000) => {
    const headingLocator = page.getByRole('heading', { name: heading });
    await expect(headingLocator).toBeVisible({ timeout });
    return headingLocator.locator('..').locator('..');
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
            if (!style || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return false;
            }
            const rects = (el as HTMLElement).getClientRects();
            return rects.length > 0 && rects[0].width > 0 && rects[0].height > 0;
        });
    }, { timeout });
};

const assertHandCardsVisible = async (page: Page, expectedCount: number, label: string) => {
    const handArea = page.locator('[data-tutorial-id="hand-area"]');
    await expect(handArea, `[${label}] 手牌区域未显示`).toBeVisible();

    const handCards = handArea.locator('[data-card-id]');
    await expect(handCards).toHaveCount(expectedCount, { timeout: 15000 });
    const cardCount = await handCards.count();

    if (cardCount !== expectedCount) {
        throw new Error(`[${label}] 期望 ${expectedCount} 张手牌，实际找到 ${cardCount} 张`);
    }

    const firstCard = handCards.first();
    const firstOpacity = await firstCard.evaluate(el => window.getComputedStyle(el).opacity);
    const firstBox = await firstCard.boundingBox();
    if (parseFloat(firstOpacity) === 0) {
        throw new Error(`[${label}] 手牌透明度为 0，卡牌不可见`);
    }
    if (!firstBox || firstBox.width === 0 || firstBox.height === 0) {
        throw new Error(`[${label}] 手牌没有尺寸，卡牌不可见`);
    }
};

const advanceToOffensiveRoll = async (page: Page) => {
    const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
    for (let attempt = 0; attempt < 5; attempt += 1) {
        if (await rollButton.isEnabled().catch(() => false)) {
            return;
        }
        const nextPhaseButton = page.locator('[data-tutorial-id="advance-phase-button"]');
        if (await nextPhaseButton.isEnabled().catch(() => false)) {
            await nextPhaseButton.click();
            await page.waitForTimeout(500);
        } else if (await nextPhaseButton.isVisible().catch(() => false)) {
            await page.waitForTimeout(300);
        }
    }
};


const waitForMainPhase = async (page: Page, timeout = 20000) => {
    await expect(page.getByText(/Main Phase \(1\)|主要阶段 \(1\)/)).toBeVisible({ timeout });
};

test.describe('DiceThrone E2E', () => {
    test('Online match shows starting hand cards after character selection', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const hostContext = await browser.newContext({ baseURL });
        await blockAudioRequests(hostContext as BrowserContext);
        await disableAudio(hostContext as BrowserContext);
        await disableTutorial(hostContext as any);
        await setEnglishLocale(hostContext);
        const hostPage = await hostContext.newPage();

        if (!await ensureGameServerAvailable(hostPage)) {
            test.skip(true, 'Game server unavailable for online tests.');
        }

        // 创建房间
        await openDiceThroneModal(hostPage);
        await hostPage.getByRole('button', { name: /Create Room|创建房间/i }).click();
        await expect(hostPage.getByRole('heading', { name: /Create Room|创建房间/i })).toBeVisible();
        await hostPage.getByRole('button', { name: /Confirm|确认/i }).click();
        try {
            await hostPage.waitForURL(/\/play\/dicethrone\/match\//, { timeout: 5000 });
        } catch {
            test.skip(true, 'Room creation failed or backend unavailable.');
        }

        const hostUrl = new URL(hostPage.url());
        const matchId = hostUrl.pathname.split('/').pop();
        if (!matchId) {
            throw new Error('Failed to parse match id from host URL.');
        }

        // 确保 host 有 playerID
        if (!hostUrl.searchParams.get('playerID')) {
            hostUrl.searchParams.set('playerID', '0');
            await hostPage.goto(hostUrl.toString());
        }
        // Guest 加入
        const guestContext = await browser.newContext({ baseURL });
        await blockAudioRequests(guestContext as BrowserContext);
        await disableAudio(guestContext as BrowserContext);
        await disableTutorial(guestContext as any);
        await setEnglishLocale(guestContext);
        const guestPage = await guestContext.newPage();
        await guestPage.goto(`/play/dicethrone/match/${matchId}?join=true`, { waitUntil: 'domcontentloaded' });
        await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });
        console.log(`[guest] url=${guestPage.url()}`);
        let autoStarted = true;
        try {
            await waitForMainPhase(hostPage, 15000);
            await waitForMainPhase(guestPage, 15000);
        } catch {
            autoStarted = false;
        }

        if (!autoStarted) {
            // 等待角色卡片挂载（避免偶发加载慢）
            await hostPage.waitForSelector('[data-char-id="monk"]', { state: 'attached', timeout: 60000 });
            await guestPage.waitForSelector('[data-char-id="barbarian"]', { state: 'attached', timeout: 60000 });

            // 双方选角：Host 选僧侣，Guest 选野蛮人并准备
            await hostPage.locator('[data-char-id="monk"]').first().click();
            await guestPage.locator('[data-char-id="barbarian"]').first().click();
            const readyButton = guestPage.getByRole('button', { name: /Ready|准备/i });
            await expect(readyButton).toBeVisible({ timeout: 20000 });
            await expect(readyButton).toBeEnabled({ timeout: 20000 });
            await readyButton.click();

            // Host 开始游戏
            const startButton = hostPage.getByRole('button', { name: /Start Game|开始游戏/i });
            await expect(startButton).toBeVisible({ timeout: 20000 });
            await expect(startButton).toBeEnabled({ timeout: 20000 });
            await startButton.click();

            // 等待游戏开始，进入 main1 阶段（双方）
            await waitForMainPhase(hostPage, 15000);
            await waitForMainPhase(guestPage, 15000);
        }

        // 等待手牌渲染完成
        await hostPage.waitForTimeout(2000);
        await guestPage.waitForTimeout(2000);

        await assertHandCardsVisible(hostPage, 4, 'host');
        await assertHandCardsVisible(guestPage, 4, 'guest');

        // 截图保存证据（只截取视口，不是全页面）
        await hostPage.screenshot({ path: testInfo.outputPath('hand-cards-success.png'), fullPage: false });

        await hostContext.close();
        await guestContext.close();
    });

    test('Tutorial completes the full flow (main1 -> offensive -> defense -> finish)', async ({ page }, testInfo) => {
        test.setTimeout(120000);
        const pageErrors: string[] = [];
        const consoleErrors: string[] = [];
        page.on('pageerror', (error) => {
            const message = error.stack || error.message;
            pageErrors.push(message);
            console.log(`[tutorial] pageerror=${message}`);
        });
        page.on('console', (message) => {
            if (message.type() === 'error') {
                const text = message.text();
                consoleErrors.push(text);
                console.log(`[tutorial] consoleError=${text}`);
            }
        });
        page.on('framenavigated', (frame) => {
            if (frame === page.mainFrame()) {
                console.log(`[tutorial] navigated url=${frame.url()}`);
            }
        });
        page.on('crash', () => {
            console.log('[tutorial] page crashed');
        });
        page.on('close', () => {
            console.log('[tutorial] page closed');
        });

        await setEnglishLocale(page);
        await page.goto('/play/dicethrone/tutorial');
        await waitForBoardReady(page, 30000);

        const getTutorialStepId = async () => page
            .locator('[data-tutorial-step]')
            .first()
            .getAttribute('data-tutorial-step')
            .catch(() => 'unknown');

        const logTutorialStep = async (label: string) => {
            const stepId = await getTutorialStepId();
            console.log(`[tutorial] ${label} step=${stepId}`);
        };

        const clickNextOverlayStep = async () => {
            const nextButton = page.getByRole('button', { name: /^(Next|下一步)$/i }).first();
            if (await nextButton.isVisible({ timeout: 1500 }).catch(() => false)) {
                const beforeStep = await getTutorialStepId();
                await nextButton.click({ timeout: 2000, force: true }).catch(() => undefined);
                await page.waitForFunction(
                    (prev) => {
                        const el = document.querySelector('[data-tutorial-step]');
                        return el && el.getAttribute('data-tutorial-step') !== prev;
                    },
                    beforeStep,
                    { timeout: 2000 }
                ).catch(() => undefined);
                const afterStep = await getTutorialStepId();
                console.log(`[tutorial] next ${beforeStep} -> ${afterStep}`);
            }
        };

        // Tutorial overlay should be present.
        // Copy might differ by locale / i18n, so we anchor on the overlay controls.
        const overlayNextButton = page.getByRole('button', { name: /^(Next|下一步)$/i }).first();
        await expect(overlayNextButton).toBeVisible({ timeout: 15000 });
        await logTutorialStep('start');

        // setup -> intro -> stats -> phases -> player-board -> tip-board -> hand -> discard -> status-tokens
        const advanceStep = page.locator('[data-tutorial-step="advance"]');
        for (let i = 0; i < 12; i += 1) {
            if (page.isClosed()) {
                console.log('[tutorial] page closed before reaching advance step');
                break;
            }
            if (await advanceStep.isVisible({ timeout: 500 }).catch(() => false)) break;
            await clickNextOverlayStep();
            await page.waitForTimeout(200);
        }
        await logTutorialStep('before-advance');

        // Step: advance to offensive roll (requires clicking Next Phase on board)
        await expect(advanceStep).toBeVisible();
        const advanceButton = page.locator('[data-tutorial-id="advance-phase-button"]');
        await expect(advanceButton).toBeEnabled();
        await advanceButton.click();
        await page.waitForTimeout(300);

        // Step: dice tray visible
        const diceTray = page.locator('[data-tutorial-id="dice-tray"]');
        await expect(diceTray).toBeVisible();
        await logTutorialStep('dice-tray');

        // Step: roll dice (deterministic via debug: force values to trigger monk abilities)
        const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
        await expect(rollButton).toBeEnabled({ timeout: 10000 });
        await rollButton.click();
        await page.waitForTimeout(300);
        // Set dice to [1,1,1,3,6] to trigger fist-technique (3 fists) or taiji-combo (3 fists + 1 palm)
        await applyDiceValues(page, [1, 1, 1, 3, 6]);

        const confirmButton = page.locator('[data-tutorial-id="dice-confirm-button"]');
        await expect(confirmButton).toBeEnabled({ timeout: 10000 });
        await confirmButton.click();

        // In tutorial mode, the step advances on ABILITY_ACTIVATED.
        // Not every forced dice result guarantees an ability highlight depending on hero config,
        // so we accept either: an ability becomes selectable OR the tutorial progresses.
        const highlightedSlots = page
            .locator('[data-ability-slot]')
            .filter({ has: page.locator('div.animate-pulse[class*="border-"]') });

        const firstHighlighted = highlightedSlots.first();
        const hasSlot = await firstHighlighted.isVisible({ timeout: 4000 }).catch(() => false);
        console.log('[tutorial] highlighted slot visible:', hasSlot);
        
        if (hasSlot) {
            // The UI might show a highlight ring but not allow clicking yet (animations/overlays).
            // If clicking fails, just continue by advancing phase; tutorial will still validate the end-to-end path.
            try {
                await firstHighlighted.click({ timeout: 2000 });
                console.log('[tutorial] clicked highlighted slot');
                // 等待一下让事件处理
                await page.waitForTimeout(500);
            } catch (e) {
                console.log('[tutorial] failed to click slot:', e);
            }
        } else {
            // If no slot is highlighted, proceed by advancing phase; tutorial may have auto-activated.
            console.log('[tutorial] no highlighted slot, proceeding without clicking');
        }

        // Step: resolve attack via Next Phase.
        // 等待教程推进到 resolve-attack 步骤（点击技能槽触发 ABILITY_ACTIVATED 后）
        await waitForTutorialStep(page, 'resolve-attack', 15000);
        await logTutorialStep('resolve-attack');
        await expect(advanceButton).toBeEnabled({ timeout: 10000 });
        await advanceButton.click();

        // In tutorial mode, the system may either enter defense or jump directly to main2.
        await Promise.race([
            page.getByText(/Defense|防御/i).isVisible({ timeout: 15000 }).then(() => true).catch(() => false),
            page.getByText(/Main Phase \(2\)|主要阶段 \(2\)/).isVisible({ timeout: 15000 }).then(() => false).catch(() => false),
        ]);

        // If we are in defense, end it by rolling+confirming once.
        const endDefenseButton = page.getByRole('button', { name: /End Defense|结束防御/i });
        if (await endDefenseButton.isVisible({ timeout: 1500 }).catch(() => false)) {
            const defenseRollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(defenseRollButton).toBeEnabled({ timeout: 10000 });
            await defenseRollButton.click();
            await page.waitForTimeout(300);
            await applyDiceValues(page, [1, 1, 1, 1, 1]);
            await expect(confirmButton).toBeEnabled({ timeout: 10000 });
            await confirmButton.click();
            await endDefenseButton.click();
        }

        // Ensure tutorial reaches main2, then finish step should be available.
        await expect(page.getByText(/Main Phase \(2\)|主要阶段 \(2\)/)).toBeVisible({ timeout: 20000 });
        await logTutorialStep('main2');

        const waitStep = async (stepId: string, timeout = 15000) => {
            await waitForTutorialStep(page, stepId, timeout);
            await logTutorialStep(stepId);
        };

        await waitStep('taiji-response');
        // pendingDamage 已由教程 aiActions 中的 MERGE_STATE 注入
        const taijiModal = await getModalContainerByHeading(page, /Respond|响应/i, 15000);
        const useTaijiButton = taijiModal.getByRole('button', { name: /Use Taiji|使用太极/i });
        if (await useTaijiButton.isVisible().catch(() => false)) {
            await useTaijiButton.click();
        }
        await closeTokenResponseModal(taijiModal);

        await waitStep('evasive-response');
        // pendingDamage 已由教程 aiActions 中的 MERGE_STATE 注入
        const evasiveModal = await getModalContainerByHeading(page, /Respond|响应/i, 15000);
        const useEvasiveButton = evasiveModal.getByRole('button', { name: /Use Evasive|使用闪避/i });
        if (await useEvasiveButton.isVisible().catch(() => false)) {
            await useEvasiveButton.click();
        }
        await page.waitForTimeout(300);
        if (await evasiveModal.isVisible().catch(() => false)) {
            await closeTokenResponseModal(evasiveModal);
        }

        await waitStep('purify-use');
        const statusTokens = page.locator('[data-tutorial-id="status-tokens"]');
        await expect(statusTokens).toBeVisible({ timeout: 10000 });
        await statusTokens.locator('.cursor-pointer').first().click();
        const purifyModal = await getModalContainerByHeading(page, /Purify|净化/i, 15000);
        await purifyModal.getByRole('button', { name: /Confirm|确认/i }).click();

        await waitStep('inner-peace');
        await dragCardUp(page, 'card-inner-peace');

        await waitStep('play-six');
        await ensureCardInHand(page, 'card-play-six');
        await dragCardUp(page, 'card-play-six');
        const diceTrayInteraction = page.locator('[data-tutorial-id="dice-tray"]');
        await expect(diceTrayInteraction).toBeVisible({ timeout: 15000 });
        await diceTrayInteraction.locator('.cursor-pointer').first().click();
        await page.getByRole('button', { name: /Confirm|确认/i }).first().click();

        await waitStep('meditation-2');
        await setPlayerCp(page, '0', 2);
        await ensureCardInHand(page, 'card-meditation-2');
        await dragCardUp(page, 'card-meditation-2');

        await waitStep('defense-roll');
        await advanceToOffensiveRoll(page);
        await expect(rollButton).toBeEnabled({ timeout: 10000 });
        await rollButton.click();
        await page.waitForTimeout(300);
        await applyDiceValues(page, [1, 1, 1, 1, 1]);

        await waitStep('defense-end');
        await expect(advanceButton).toBeEnabled({ timeout: 10000 });
        await advanceButton.click();
        const confirmHeading = page.getByRole('heading', { name: /End offensive roll\?|确认结束攻击掷骰？/i });
        if (await confirmHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
            const confirmSkipModal = confirmHeading.locator('..').locator('..');
            await confirmSkipModal.getByRole('button', { name: /Confirm|确认/i }).click();
        }

        await waitStep('finish', 20000);
        const finishButton = page.getByRole('button', { name: /^(Finish and return|完成并返回)$/i }).first();
        if (await finishButton.isVisible({ timeout: 6000 }).catch(() => false)) {
            await page.screenshot({ path: testInfo.outputPath('tutorial-final-step.png'), fullPage: false });
            await finishButton.click();
        }

        if (pageErrors.length || consoleErrors.length) {
            console.log(`[tutorial] pageErrors=${pageErrors.length} consoleErrors=${consoleErrors.length}`);
            pageErrors.forEach((error) => console.log(`[tutorial] pageerror=${error}`));
            consoleErrors.forEach((error) => console.log(`[tutorial] consoleError=${error}`));
        }
    });

});
