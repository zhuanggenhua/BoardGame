import { test, expect } from '../framework';

test.describe('DiceThrone - 选择骰子重投', () => {
    test('card-worthy-of-me 应通过 framework 场景完成单骰重投', async ({ page, game }) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-worthy-of-me'],
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'barbarian' },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: false,
                dice: [
                    { id: 0, value: 1, isKept: false },
                    { id: 1, value: 2, isKept: false },
                    { id: 2, value: 3, isKept: false },
                    { id: 3, value: 4, isKept: false },
                    { id: 4, value: 5, isKept: false },
                ],
            },
        });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                hasCard: !!state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-worthy-of-me'),
                diceCount: state?.core?.dice?.length ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            hasCard: true,
            diceCount: 5,
        });

        const rerollCard = page
            .locator('[data-card-id="card-worthy-of-me"], [data-card-key^="card-worthy-of-me-"]')
            .first();
        await expect(rerollCard).toBeVisible({ timeout: 5000 });
        await rerollCard.click();

        await expect.poll(async () => {
            const interaction = (await game.getState())?.sys?.interaction?.current;
            const meta = interaction?.data?.meta;
            return {
                dtType: meta?.dtType ?? null,
                selectCount: meta?.selectCount ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            dtType: 'selectDie',
            selectCount: 2,
        });

        const firstDieButton = page.locator('[data-testid="die-button-0"]');
        await expect(firstDieButton).toBeVisible({ timeout: 5000 });
        await firstDieButton.click();

        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([6]);
        });

        const confirmButton = page.getByRole('button', { name: /^(确认|Confirm)(?:\s*\(\d+\))?$/i }).first();
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const lastEvents = (state?.sys?.eventStream?.entries ?? []).slice(-6);
            return {
                firstDie: state?.core?.dice?.[0]?.value ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                handIds: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
                lastEventTypes: lastEvents.map((entry: any) => entry.event?.type),
            };
        }, { timeout: 5000 }).toMatchObject({
            firstDie: 6,
            interactionKind: null,
            handIds: [],
        });

        const finalState = await game.getState();
        const finalHandIds = (finalState?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id);
        const finalEventTypes = (finalState?.sys?.eventStream?.entries ?? [])
            .slice(-6)
            .map((entry: any) => entry.event?.type);

        expect(finalState?.core?.dice?.[0]?.value ?? null).toBe(6);
        expect(finalHandIds).not.toContain('card-worthy-of-me');
        expect(finalEventTypes).toContain('CARD_PLAYED');
        expect(finalEventTypes).toContain('DIE_REROLLED');
    });

    test('card-wild-west 应触发弹药特写奖励骰，不改攻击骰盘', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-wild-west'],
                resources: { CP: 2, HP: 50 },
                tokens: { loaded: 1 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'gunslinger', '1': 'monk' },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                dice: [
                    { id: 0, value: 1, isKept: false },
                    { id: 1, value: 2, isKept: false },
                    { id: 2, value: 3, isKept: false },
                    { id: 3, value: 4, isKept: false },
                    { id: 4, value: 5, isKept: false },
                ],
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    isDefendable: true,
                    sourceAbilityId: 'revolver-3',
                },
            },
        });

        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([2, 6]);
        });

        const initialState = await game.getState();
        const initialDiceValues = (initialState?.core?.dice ?? []).map((die: any) => die.value);

        const wildWestCard = page
            .locator('[data-card-id="card-wild-west"], [data-card-key^="card-wild-west-"]')
            .first();
        await expect(wildWestCard).toBeVisible({ timeout: 5000 });
        await wildWestCard.click();

        // 断言：攻击修正徽章应在“打出卡牌后”立即出现（徽章是效果提示，不代表数值已生效）
        const modifierBadgeEarly = page.locator('[data-testid="active-modifier-badge"]').first();
        await expect(modifierBadgeEarly).toBeVisible({ timeout: 5000 });
        await expect(modifierBadgeEarly).toHaveAttribute('data-bonus-damage', '0');
        await game.screenshot('gunslinger-wild-west-attack-modifier-badge-pending', testInfo);

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement ?? null;
            const boostAdds = state?.core?.pendingAttack?.loadedBonusDieBoost?.postSettleBonusDamageAdds?.length ?? 0;
            return {
                settlement,
                boostAdds,
            };
        }, { timeout: 5000 }).toMatchObject({
            settlement: null,
            boostAdds: 1,
        });

        const resolveAttackButton = page.getByRole('button', { name: /^(Resolve Attack|结算攻击)$/i }).first();
        await expect(resolveAttackButton).toBeVisible({ timeout: 5000 });
        await expect(resolveAttackButton).toBeEnabled({ timeout: 5000 });
        await resolveAttackButton.click();

        await expect(page.getByText(/技能结算选择/i)).toBeVisible({ timeout: 5000 });
        const loadedOption = page.getByText(/^装填$/).first();
        await expect(loadedOption).toBeVisible({ timeout: 5000 });
        await loadedOption.click({ force: true });

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            return {
                hasSettlement: !!settlement,
                diceCount: settlement?.dice?.length ?? 0,
                displayOnly: settlement?.displayOnly ?? false,
            };
        }, { timeout: 5000 }).toMatchObject({
            hasSettlement: true,
            diceCount: 1,
            displayOnly: false,
        });

        const overlay = page.locator('[data-testid="bonus-die-overlay"]').first();
        await expect(overlay).toBeVisible({ timeout: 5000 });
        await expect(overlay.locator('.dice3d-perspective')).toHaveCount(1, { timeout: 5000 });

        const finalState = await game.getState();
        const finalDiceValues = (finalState?.core?.dice ?? []).map((die: any) => die.value);
        expect(finalDiceValues).toEqual(initialDiceValues);

        // 断言：奖励骰来自 Loaded token；Wild West 的“然后 +1”应在奖励骰收口后才计入攻击修正汇总（徽章提前出现不等于数值提前生效）
        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.pendingAttack?.attackModifierBonusDamage ?? null;
        }, { timeout: 5000 }).toBe(null);

        await game.screenshot('gunslinger-wild-west-bonus-die-overlay', testInfo);

        const bonusDie = overlay.locator('.dice3d-perspective').first();
        await expect(bonusDie).toBeVisible({ timeout: 5000 });
        await bonusDie.click({ force: true });

        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.pendingBonusDiceSettlement?.dice?.[0]?.value ?? null;
        }, { timeout: 5000 }).toBe(6);

        // 断言：已完成一次重掷后，应显示“到达重掷上限”，而不是“没装填可重掷”的误导提示
        await expect(overlay).toContainText('已达到本次重掷上限', { timeout: 5000 });
        await expect(page.getByText('没有装填标记可用于重掷')).toHaveCount(0);

        // 断言：在奖励骰仍处于特写阶段（未收口结算）时，不应提前计入“然后 +1”
        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.pendingAttack?.attackModifierBonusDamage ?? null;
        }, { timeout: 5000 }).toBe(null);

        await game.screenshot('gunslinger-wild-west-bonus-die-rerolled', testInfo);

        // 关闭特写并触发结算（Board.tsx: onBonusDieClose -> SKIP_BONUS_DICE_REROLL）
        await overlay.click({ force: true });
        await expect(overlay).toBeHidden({ timeout: 5000 });
        await game.screenshot('gunslinger-wild-west-bonus-die-closed', testInfo);

        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.pendingBonusDiceSettlement ?? null;
        }, { timeout: 5000 }).toBeNull();

        // 断言：Wild West 绑定的 Loaded 奖励骰增强应在收口后清空，避免下次 Loaded 被错误复用（防回归）。
        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.pendingAttack?.loadedBonusDieBoost ?? null;
        }, { timeout: 5000 }).toBeNull();

        // 断言：收口后，总 bonusDamage 应包含 Loaded 半值加伤（6 -> +3）以及 Wild West 的“然后 +1”，合计 4；
        // 但攻击修正汇总只应包含 Wild West 的 +1（Loaded 属于 token 效果，不应混入攻击修正卡汇总）。
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                bonusDamage: state?.core?.pendingAttack?.bonusDamage ?? null,
                attackModifierBonusDamage: state?.core?.pendingAttack?.attackModifierBonusDamage ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            bonusDamage: 4,
            attackModifierBonusDamage: 1,
        });

        // 断言：该加伤应在“攻击修正”UI 区域可见（回应“荒野西部是否应显示在攻击修正里”的验收点）
        const modifierBadge = page.locator('[data-testid="active-modifier-badge"]').first();
        await expect(modifierBadge).toBeVisible({ timeout: 5000 });
        await expect(modifierBadge).toHaveAttribute('data-bonus-damage', '1');
        await game.screenshot('gunslinger-wild-west-attack-modifier-badge', testInfo);

        await game.screenshot('gunslinger-wild-west-bonus-die-settled', testInfo);
    });

    test('card-wild-west 无装填时应被出牌门禁阻止（requireLoaded）', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-wild-west'],
                resources: { CP: 2, HP: 50 },
                tokens: { loaded: 0 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'gunslinger', '1': 'monk' },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                dice: [
                    { id: 0, value: 1, isKept: false },
                    { id: 1, value: 2, isKept: false },
                    { id: 2, value: 3, isKept: false },
                    { id: 3, value: 4, isKept: false },
                    { id: 4, value: 5, isKept: false },
                ],
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    isDefendable: true,
                    sourceAbilityId: 'revolver-3',
                },
            },
        });

        await game.waitForPhase('offensiveRoll', 10000);

        const wildWestCard = page
            .locator('[data-card-id="card-wild-west"], [data-card-key^="card-wild-west-"]')
            .first();
        await expect(wildWestCard).toBeVisible({ timeout: 5000 });
        await wildWestCard.click();

        // 断言：应提示 requireLoaded，而不是进入奖励骰特写
        await expect(page.getByText('需要消耗 1 个装填才能打出此卡')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-testid="bonus-die-overlay"]')).toHaveCount(0);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                stillHasCard: !!state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'card-wild-west'),
                settlement: state?.core?.pendingBonusDiceSettlement ?? null,
                bonusDamage: state?.core?.pendingAttack?.attackModifierBonusDamage ?? 0,
            };
        }, { timeout: 5000 }).toMatchObject({
            stillHasCard: true,
            settlement: null,
            bonusDamage: 0,
        });

        await game.screenshot('gunslinger-wild-west-require-loaded-toast', testInfo);
    });

    test('card-high-noon（bullet）应造成 2 点不可防御伤害，并提供奖励骰特写证据链', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-high-noon'],
                resources: { CP: 1, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': 'gunslinger', '1': 'monk' },
                hostStarted: true,
            },
        });

        await game.waitForPhase('main1', 10000);
        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            // bullet = 1/2/3
            window.__BG_TEST_HARNESS__?.dice.setValues([1]);
        });

        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.players?.['1']?.resources?.hp ?? null;
        }, { timeout: 5000 }).toBe(50);

        const highNoonCard = page
            .locator('[data-card-id="card-high-noon"], [data-card-key^="card-high-noon-"]')
            .first();
        await expect(highNoonCard).toBeVisible({ timeout: 5000 });
        await highNoonCard.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            const targetHp = state?.core?.players?.['1']?.resources?.hp ?? null;
            return {
                hasSettlement: !!settlement,
                displayOnly: settlement?.displayOnly ?? false,
                attackerId: settlement?.attackerId ?? null,
                targetId: settlement?.targetId ?? null,
                face: settlement?.dice?.[0]?.face ?? null,
                // 高正午（bullet）伤害是立即结算的，但特写仍需收口
                targetHp,
            };
        }, { timeout: 5000 }).toMatchObject({
            hasSettlement: true,
            displayOnly: true,
            attackerId: '0',
            targetId: '1',
            face: 'bullet',
            targetHp: 48,
        });

        const overlay = page.locator('[data-testid="bonus-die-overlay"]').first();
        await expect(overlay).toBeVisible({ timeout: 5000 });
        await expect(overlay.locator('.dice3d-perspective')).toHaveCount(1, { timeout: 5000 });
        await game.screenshot('gunslinger-high-noon-bullet-overlay', testInfo);

        await overlay.click({ force: true });
        await expect(overlay).toBeHidden({ timeout: 5000 });
        await game.screenshot('gunslinger-high-noon-bullet-closed', testInfo);

        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.pendingBonusDiceSettlement ?? null;
        }, { timeout: 5000 }).toBeNull();

        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.players?.['1']?.resources?.hp ?? null;
        }, { timeout: 5000 }).toBe(48);

        await game.screenshot('gunslinger-high-noon-bullet-settled', testInfo);
    });

    test('card-high-noon（dash）应施加 1 层击倒，并提供奖励骰特写证据链', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-high-noon'],
                resources: { CP: 1, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': 'gunslinger', '1': 'monk' },
                hostStarted: true,
            },
        });

        await game.waitForPhase('main1', 10000);
        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            // dash = 4/5
            window.__BG_TEST_HARNESS__?.dice.setValues([4]);
        });

        const highNoonCard = page
            .locator('[data-card-id="card-high-noon"], [data-card-key^="card-high-noon-"]')
            .first();
        await expect(highNoonCard).toBeVisible({ timeout: 5000 });
        await highNoonCard.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            const knockdown = state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0;
            return {
                hasSettlement: !!settlement,
                displayOnly: settlement?.displayOnly ?? false,
                attackerId: settlement?.attackerId ?? null,
                targetId: settlement?.targetId ?? null,
                face: settlement?.dice?.[0]?.face ?? null,
                knockdown,
            };
        }, { timeout: 5000 }).toMatchObject({
            hasSettlement: true,
            displayOnly: true,
            attackerId: '0',
            targetId: '1',
            face: 'dash',
            knockdown: 1,
        });

        const overlay = page.locator('[data-testid="bonus-die-overlay"]').first();
        await expect(overlay).toBeVisible({ timeout: 5000 });
        await expect(overlay.locator('.dice3d-perspective')).toHaveCount(1, { timeout: 5000 });
        await game.screenshot('gunslinger-high-noon-dash-overlay', testInfo);

        await overlay.click({ force: true });
        await expect(overlay).toBeHidden({ timeout: 5000 });
        await game.screenshot('gunslinger-high-noon-dash-closed', testInfo);

        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.pendingBonusDiceSettlement ?? null;
        }, { timeout: 5000 }).toBeNull();

        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0;
        }, { timeout: 5000 }).toBe(1);

        await game.screenshot('gunslinger-high-noon-dash-settled', testInfo);
    });

    test('card-high-noon（bullseye）应施加 1 层赏金，并提供奖励骰特写证据链', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-high-noon'],
                resources: { CP: 1, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': 'gunslinger', '1': 'monk' },
                hostStarted: true,
            },
        });

        await game.waitForPhase('main1', 10000);
        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            // bullseye = 6
            window.__BG_TEST_HARNESS__?.dice.setValues([6]);
        });

        const highNoonCard = page
            .locator('[data-card-id="card-high-noon"], [data-card-key^="card-high-noon-"]')
            .first();
        await expect(highNoonCard).toBeVisible({ timeout: 5000 });
        await highNoonCard.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            const bounty = state?.core?.players?.['1']?.tokens?.bounty ?? 0;
            return {
                hasSettlement: !!settlement,
                displayOnly: settlement?.displayOnly ?? false,
                attackerId: settlement?.attackerId ?? null,
                targetId: settlement?.targetId ?? null,
                face: settlement?.dice?.[0]?.face ?? null,
                bounty,
            };
        }, { timeout: 5000 }).toMatchObject({
            hasSettlement: true,
            displayOnly: true,
            attackerId: '0',
            targetId: '1',
            face: 'bullseye',
            bounty: 1,
        });

        const overlay = page.locator('[data-testid="bonus-die-overlay"]').first();
        await expect(overlay).toBeVisible({ timeout: 5000 });
        await expect(overlay.locator('.dice3d-perspective')).toHaveCount(1, { timeout: 5000 });
        await game.screenshot('gunslinger-high-noon-bullseye-overlay', testInfo);

        await overlay.click({ force: true });
        await expect(overlay).toBeHidden({ timeout: 5000 });
        await game.screenshot('gunslinger-high-noon-bullseye-closed', testInfo);

        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.pendingBonusDiceSettlement ?? null;
        }, { timeout: 5000 }).toBeNull();

        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.players?.['1']?.tokens?.bounty ?? 0;
        }, { timeout: 5000 }).toBe(1);

        await game.screenshot('gunslinger-high-noon-bullseye-settled', testInfo);
    });
});
