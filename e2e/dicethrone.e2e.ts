import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const setEnglishLocale = async (context: BrowserContext | Page) => {
    await context.addInitScript(() => {
        localStorage.setItem('i18nextLng', 'en');
    });
};


const maybePassResponse = async (page: Page) => {
    const passButton = page.getByRole('button', { name: 'Pass' });
    if (await passButton.isVisible()) {
        await passButton.click();
        return true;
    }
    return false;
};

test.describe('DiceThrone E2E', () => {
    test('Tutorial route shows Dice Throne tutorial overlay', async ({ page }) => {
        await setEnglishLocale(page);
        await page.goto('/play/dicethrone/tutorial');

        await expect(page.getByAltText('Player Board')).toBeVisible();
        await expect(page.getByText(/Dice Throne 1v1 tutorial/i)).toBeVisible();
    });

    test('Online match can be created and HUD shows room info', async ({ page }) => {
        await setEnglishLocale(page);
        await page.goto('/');
        await page.getByRole('heading', { name: 'Dice Throne' }).click();
        await page.getByRole('button', { name: 'Create Room' }).click();
        await expect(page.getByRole('heading', { name: 'Create Room' })).toBeVisible();
        await page.getByRole('button', { name: 'Confirm' }).click();

        await expect(page).toHaveURL(/\/play\/dicethrone\/match\//);
        await expect(page.getByAltText('Player Board')).toBeVisible();

        // Open HUD menu
        const hudFab = page.locator('.fixed.bottom-8.right-8 button').first();
        await expect(hudFab).toBeVisible();
        await hudFab.click();

        await expect(page.getByText('Online Room')).toBeVisible();
        await expect(page.getByText(/ID:\s*[A-Za-z0-9]+/)).toBeVisible();
    });

    test('Online match supports offensive roll flow with two players', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const hostContext = await browser.newContext({ baseURL });
        await setEnglishLocale(hostContext);
        const hostPage = await hostContext.newPage();

        await hostPage.goto('/');
        await hostPage.getByRole('heading', { name: 'Dice Throne' }).click();
        await hostPage.getByRole('button', { name: 'Create Room' }).click();
        await expect(hostPage.getByRole('heading', { name: 'Create Room' })).toBeVisible();
        await hostPage.getByRole('button', { name: 'Confirm' }).click();
        await hostPage.waitForURL(/\/play\/dicethrone\/match\//);
        await expect(hostPage.getByAltText('Player Board')).toBeVisible();

        const hostUrl = new URL(hostPage.url());
        const matchId = hostUrl.pathname.split('/').pop();
        if (!matchId) {
            throw new Error('Failed to parse match id from host URL.');
        }

        if (!hostUrl.searchParams.get('playerID')) {
            hostUrl.searchParams.set('playerID', '0');
            await hostPage.goto(hostUrl.toString());
            await expect(hostPage.getByAltText('Player Board')).toBeVisible();
        }

        const guestContext = await browser.newContext({ baseURL });
        await setEnglishLocale(guestContext);
        const guestPage = await guestContext.newPage();
        await guestPage.goto(`/play/dicethrone/match/${matchId}?join=true`);
        await guestPage.waitForURL(/playerID=\d/);
        await expect(guestPage.getByAltText('Player Board')).toBeVisible();

        const isButtonEnabled = async (page: Page, name: string | RegExp) => {
            const button = page.getByRole('button', { name });
            if (await button.count() === 0) return false;
            return button.isEnabled();
        };

        let attackerPage: Page | null = null;
        let defenderPage: Page | null = null;
        let alreadyOffensive = false;
        for (let i = 0; i < 20; i += 1) {
            if (await isButtonEnabled(hostPage, 'Resolve Attack')) {
                attackerPage = hostPage;
                defenderPage = guestPage;
                alreadyOffensive = true;
                break;
            }
            if (await isButtonEnabled(guestPage, 'Resolve Attack')) {
                attackerPage = guestPage;
                defenderPage = hostPage;
                alreadyOffensive = true;
                break;
            }
            if (await isButtonEnabled(hostPage, 'Next Phase')) {
                attackerPage = hostPage;
                defenderPage = guestPage;
                break;
            }
            if (await isButtonEnabled(guestPage, 'Next Phase')) {
                attackerPage = guestPage;
                defenderPage = hostPage;
                break;
            }
            await hostPage.waitForTimeout(300);
        }

        if (!attackerPage || !defenderPage) {
            throw new Error('Failed to determine the active player page.');
        }

        const resolveAttackButton = attackerPage.getByRole('button', { name: 'Resolve Attack' });
        if (!alreadyOffensive) {
            await attackerPage.getByRole('button', { name: 'Next Phase' }).click();
            await expect(resolveAttackButton).toBeVisible();
        }

        const rollButton = attackerPage.getByRole('button', { name: /^Roll/ });
        const confirmButton = attackerPage.getByRole('button', { name: 'Confirm Dice' });
        // Match ability slots with highlight border (cyan for regular, amber for ultimate)
        const highlightedSlots = attackerPage
            .locator('[data-ability-slot]')
            .filter({ has: attackerPage.locator('div.animate-pulse[class*="border-"]') });

        // Roll up to 10 times to find an available ability (probabilistic but sufficient)
        let abilitySelected = false;
        for (let attempt = 0; attempt < 10; attempt += 1) {
            await expect(rollButton).toBeEnabled({ timeout: 5000 });
            await rollButton.click();
            // Wait for dice animation to complete
            await attackerPage.waitForTimeout(1000);
            
            const highlightCount = await highlightedSlots.count();
            if (highlightCount > 0) {
                await confirmButton.click();
                await attackerPage.waitForTimeout(500);
                await highlightedSlots.first().click();
                abilitySelected = true;
                break;
            }
        }

        if (!abilitySelected) {
            throw new Error('No offensive ability available after 10 roll attempts.');
        }
        await resolveAttackButton.click();

        // Handle ability resolution choice modal if it appears (some abilities require token selection)
        // Loop to handle multiple choice modals that may appear
        for (let choiceAttempt = 0; choiceAttempt < 5; choiceAttempt++) {
            const choiceModal = attackerPage.getByText('Ability Resolution Choice');
            if (await choiceModal.isVisible({ timeout: 1500 }).catch(() => false)) {
                // Click the first available choice option button
                const choiceButton = attackerPage.locator('button').filter({ hasText: /(Evasive|Purify|Chi|Taiji)/i }).first();
                if (await choiceButton.isVisible({ timeout: 500 }).catch(() => false)) {
                    await choiceButton.click();
                    await attackerPage.waitForTimeout(500);
                }
            } else {
                break;
            }
        }

        // Wait for either defensive phase or main phase 2 (ability might not be defendable)
        const defensePhaseStarted = await Promise.race([
            defenderPage.getByRole('button', { name: 'End Defense' }).isVisible({ timeout: 5000 }).then(() => true).catch(() => false),
            attackerPage.getByText(/Main Phase \(2\)/).isVisible({ timeout: 5000 }).then(() => false).catch(() => false),
        ]);

        if (defensePhaseStarted) {
            // If defensive phase started, defender should be able to roll
            await expect(defenderPage.getByRole('button', { name: /^Roll/ })).toBeEnabled();
            await defenderPage.getByRole('button', { name: /^Roll/ }).click();
            await defenderPage.getByRole('button', { name: 'Confirm Dice' }).click();
            await defenderPage.getByRole('button', { name: 'End Defense' }).click();

            // Handle response windows
            for (let i = 0; i < 4; i += 1) {
                const hostPassed = await maybePassResponse(hostPage);
                const guestPassed = await maybePassResponse(guestPage);
                if (!hostPassed && !guestPassed) break;
            }
        }

        // Verify we reached Main Phase 2 (attack completed)
        await expect(attackerPage.getByText(/Main Phase \(2\)/)).toBeVisible({ timeout: 10000 });

        await hostContext.close();
        await guestContext.close();
    });

    test('Local skip token response shows Next Phase button', async ({ page }) => {
        await setEnglishLocale(page);
        await page.goto('/play/dicethrone/local');
        await expect(page.getByAltText('Player Board')).toBeVisible();

        await expect(page.getByText(/Main Phase \(1\)/)).toBeVisible({ timeout: 10000 });
        await page.getByRole('button', { name: 'Next Phase' }).click();
        await expect(page.getByRole('button', { name: 'Resolve Attack' })).toBeVisible({ timeout: 10000 });

        const rollButton = page.getByRole('button', { name: /^Roll/ });
        const confirmButton = page.getByRole('button', { name: 'Confirm Dice' });
        const highlightedSlots = page
            .locator('[data-ability-slot]')
            .filter({ has: page.locator('div.animate-pulse[class*="border-"]') });

        let abilitySelected = false;
        for (let attempt = 0; attempt < 10; attempt += 1) {
            await expect(rollButton).toBeEnabled({ timeout: 5000 });
            await rollButton.click();
            await page.waitForTimeout(1000);

            if (await highlightedSlots.count()) {
                await confirmButton.click();
                await page.waitForTimeout(500);
                await highlightedSlots.first().click();
                abilitySelected = true;
                break;
            }
        }

        if (!abilitySelected) {
            throw new Error('No offensive ability available after 10 roll attempts.');
        }

        await page.getByRole('button', { name: 'Resolve Attack' }).click();
        await expect(page.getByRole('button', { name: 'End Defense' })).toBeVisible({ timeout: 10000 });

        await page.locator('button[title="Dev Debug"]').click();
        await page.getByRole('button', { name: '📊 State' }).click();

        const rawStateText = await page.locator('pre').filter({ hasText: '"core"' }).first().textContent();
        const stateText = rawStateText?.trim();
        if (!stateText) {
            throw new Error('Failed to read debug game state.');
        }

        const state = JSON.parse(stateText) as { core?: Record<string, unknown> };
        const core = (state.core ?? state) as Record<string, unknown>;
        const pendingDamage = {
            id: `e2e-damage-${Date.now()}`,
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 2,
            currentDamage: 2,
            responseType: 'beforeDamageDealt',
            responderId: '0',
            isFullyEvaded: false,
        };

        await page.getByRole('button', { name: '📝 赋值' }).click();
        await page.getByPlaceholder('粘贴游戏状态 JSON...').fill(JSON.stringify({
            ...core,
            pendingDamage,
        }));
        await page.getByRole('button', { name: '✓ 应用状态' }).click();

        const skipButton = page.getByRole('button', { name: 'Skip' });
        await expect(skipButton).toBeVisible({ timeout: 5000 });
        await skipButton.click();

        await expect(page.getByRole('button', { name: 'Next Phase' })).toBeVisible({ timeout: 10000 });
    });
});
