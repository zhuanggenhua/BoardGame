import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest } from '../framework/evidenceScreenshots';
import { closeDebugPanelIfOpen, dragDiceThroneHandCardToPlay } from '../helpers/dicethrone';
import { dismissCardSpotlightWithBackdrop, shot, waitForDamageNumbersToSettle } from '../helpers/dicethroneThorEvidence';

for (const entry of [
    { id: 'card-worthy-of-me', repeated: true, expected: [6, 1, 1, 1, 1] },
    { id: 'card-i-can-again', repeated: false, expected: [6, 6, 1, 1, 1] },
]) test(`索尔本人打出${entry.id}并沿原骰盘重投`, async ({ page, game }, info) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(info);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 120000);
    await game.setupScene({ gameId: 'dicethrone', phase: 'main1', currentPlayer: '0', randomQueue: [.08, .08, .08, .08, .08, .92, .92],
        player0: { hand: [entry.id], resources: { hp: 50, cp: 5 } }, player1: { hand: [] },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true, dice: [], rollCount: 0, rollConfirmed: false } });
    await closeDebugPanelIfOpen(page);
    await page.locator('[data-tutorial-id="advance-phase-button"]').click();
    await page.locator('[data-tutorial-id="dice-roll-button"]').click();
    await shot(page, info, '01-索尔公共重投牌在手牌');
    await dragDiceThroneHandCardToPlay(page, entry.id);
    await page.getByTestId('die-button-0').click();
    await page.getByTestId(entry.repeated ? 'die-button-0' : 'die-button-1').click();
    await expect(page.getByTestId('dice-interaction-confirm-button')).toBeEnabled();
    await shot(page, info, '02-原骰盘选择后等待确认');
    await page.getByTestId('dice-interaction-confirm-button').click();
    await expect.poll(async () => (await game.getState()).core.currentRollContext?.dice.map((die: { value: number }) => die.value)).toEqual(entry.expected);
    await expect.poll(async () => (await game.getState()).core.players['0'].resources.cp).toBe(4);
    await shot(page, info, '03-原骰盘确认后完成重投');
});

test('索尔本人防御时打出就这并沿原骰盘重投', async ({ page, game }, info) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(info);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 120000);
    await game.setupScene({ gameId: 'dicethrone', phase: 'defensiveRoll', currentPlayer: '1', randomQueue: [.08, .25, .42, .92],
        player0: { hand: ['card-just-this'], resources: { hp: 40, cp: 5 } }, player1: { hand: [], resources: { hp: 50, cp: 2 } },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true, rollCount: 0, rollConfirmed: false, dice: [],
            pendingAttack: { attackerId: '1', defenderId: '0', sourceAbilityId: 'fist-technique-5', damage: 8, bonusDamage: 0, isDefendable: true, preDefenseResolved: true, offensiveRollEndTokenResolved: true } } });
    await closeDebugPanelIfOpen(page);
    await page.getByRole('button', { name: '开始防御', exact: true }).click();
    await page.locator('[data-ability-slot="meditate"][data-can-click="true"]').first().click();
    await page.locator('[data-tutorial-id="dice-roll-button"]').click();
    await shot(page, info, '01-索尔防御骰和就这手牌');
    await dragDiceThroneHandCardToPlay(page, 'card-just-this');
    await page.getByTestId('die-button-0').click();
    await expect(page.getByTestId('dice-interaction-confirm-button')).toBeEnabled();
    await shot(page, info, '02-原防御骰盘选择重投');
    await page.getByTestId('dice-interaction-confirm-button').click();
    await expect.poll(async () => (await game.getState()).core.currentRollContext?.dice.map((die: { value: number }) => die.value)).toEqual([6, 2, 3]);
    await expect.poll(async () => (await game.getState()).core.players['0'].resources.cp).toBe(5);
    await shot(page, info, '03-原骰盘确认后仅选中防御骰重投');
});

// 物理升级牌合同：每张升级替换对应技能，按卡面支付费用。
for (const entry of [
    { id: 'upgrade-thor-hammer-2', ability: 'thor-hammer', level: 2, cp: 5 },
    { id: 'upgrade-thor-hammer-3', ability: 'thor-hammer', level: 3, cp: 3 },
    { id: 'upgrade-thor-mighty-summon-2', ability: 'thor-mighty-summon', level: 2, cp: 3 },
    { id: 'upgrade-thor-thunder-strike-2', ability: 'thor-thunder-strike', level: 2, cp: 3 },
    { id: 'upgrade-thor-power-of-thunder-2', ability: 'thor-power-of-thunder', level: 2, cp: 3 },
]) test(`索尔从原手牌入口使用${entry.id}`, async ({ page, game }, info) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(info);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 120000);
    await game.setupScene({ gameId: 'dicethrone', phase: 'main1', currentPlayer: '0',
        player0: { hand: [entry.id], resources: { hp: 50, cp: 5 } }, player1: { hand: [] },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true } });
    await closeDebugPanelIfOpen(page);
    await shot(page, info, '01-升级牌与原技能槽');
    await dragDiceThroneHandCardToPlay(page, entry.id);
    await expect.poll(async () => {
        const player = (await game.getState()).core.players['0'];
        return { level: player.abilityLevels[entry.ability], cp: player.resources.cp,
            cardInHand: player.hand.some((card: { id: string }) => card.id === entry.id) };
    }).toEqual({ level: entry.level, cp: entry.cp, cardInHand: false });
    await shot(page, info, '02-原技能槽替换为升级牌');
});

// 公共牌原文：加倍抽二、超级加倍抽三、老板大气获得 2 CP。
for (const entry of [
    { id: 'card-double', cp: 4, hand: 2 },
    { id: 'card-super-double', cp: 3, hand: 3 },
    { id: 'card-boss-generous', cp: 7, hand: 0 },
]) test(`索尔以原手牌入口打出${entry.id}`, async ({ page, game }, info) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(info);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 120000);
    await game.setupScene({ gameId: 'dicethrone', phase: 'main1', currentPlayer: '0',
        player0: { hand: [entry.id], resources: { hp: 50, cp: 5 } }, player1: { hand: [] },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true } });
    await closeDebugPanelIfOpen(page);
    await shot(page, info, '01-公共牌等待从手牌打出');
    await dragDiceThroneHandCardToPlay(page, entry.id);
    await expect.poll(async () => {
        const s = await game.getState();
        const player = s.core.players['0'];
        return { cp: player.resources.cp, hand: player.hand.length,
            discarded: player.discard.some((card: { id: string }) => card.id === entry.id),
            interaction: s.sys.interaction.current ?? null };
    }).toEqual({ cp: entry.cp, hand: entry.hand, discarded: true, interaction: null });
    await shot(page, info, '02-原手牌区与资源显示出牌结果');
});

test('索尔实际两次飞掷后打出风暴来袭', async ({ page, game }, info) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(info);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 120000);
    await game.setupScene({ gameId: 'dicethrone', phase: 'main1', currentPlayer: '0',
        player0: { hand: ['card-double', 'card-super-double', 'card-thor-hammer-time', 'card-thor-storm-brewing'], resources: { hp: 50, cp: 5 } },
        player1: { hand: [], resources: { hp: 50, cp: 2 } },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true, mjolnirThrowsThisTurn: {} } });
    await closeDebugPanelIfOpen(page);
    await page.getByTestId('passive-action-thor-mjolnir-0').click();
    await expect(page.getByTestId('dicethrone-hand-discard-hint')).toBeVisible();
    const firstDiscard = page.locator('[data-testid="hand-area"] [data-card-id="card-double"]');
    await expect(firstDiscard).toHaveAttribute('data-is-flipped', 'true');
    await firstDiscard.click();
    await expect.poll(async () => (await game.getState()).core.mjolnirThrowsThisTurn?.['0']).toBe(1);
    await dragDiceThroneHandCardToPlay(page, 'card-thor-hammer-time');
    await dismissCardSpotlightWithBackdrop(page);
    await expect.poll(async () => (await game.getState()).core.players['0'].tokens.mjolnir).toBe(1);
    await page.getByTestId('passive-action-thor-mjolnir-0').click();
    await expect(page.getByTestId('dicethrone-hand-discard-hint')).toBeVisible();
    const secondDiscard = page.locator('[data-testid="hand-area"] [data-card-id="card-super-double"]');
    await expect(secondDiscard).toHaveAttribute('data-is-flipped', 'true');
    await secondDiscard.click();
    await expect.poll(async () => (await game.getState()).core.mjolnirThrowsThisTurn?.['0']).toBe(2);
    await expect.poll(async () => (await game.getState()).core.players['1'].resources.hp).toBe(48);
    await expect(page.locator('[aria-label="HP 48"]')).toBeVisible();
    await waitForDamageNumbersToSettle(page);
    await shot(page, info, '01-实际两次飞掷后风暴来袭可使用');
    await dragDiceThroneHandCardToPlay(page, 'card-thor-storm-brewing');
    await expect.poll(async () => {
        const s = await game.getState();
        return { hp: s.core.players['1'].resources.hp, cp: s.core.players['0'].resources.cp,
            electro: s.core.players['0'].tokens.electrokinesis, guard: s.core.players['0'].tokens.guard_break,
            count: s.core.mjolnirThrowsThisTurn?.['0'], hand: s.core.players['0'].hand.length };
    }).toEqual({ hp: 48, cp: 7, electro: 3, guard: 1, count: 2, hand: 1 });
    await shot(page, info, '02-风暴来袭出牌后结算资源和抽牌');
});

// 卡面合同：挥锤时刻召回并获得资源；雷霆万钧抽牌获驭电；风暴来袭要求本回合两次飞掷。
for (const entry of [
    { id: 'card-thor-hammer-time', away: true, throws: 0, cp: 6, electro: 2, guard: 0, hand: 0 },
    { id: 'card-thor-thunderous', away: false, throws: 0, cp: 4, electro: 2, guard: 0, hand: 1 },
    { id: 'card-thor-storm-brewing', away: false, throws: 2, cp: 6, electro: 1, guard: 1, hand: 1 },
]) test(`索尔${entry.id}从手牌出牌并结算`, async ({ page, game }, info) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(info);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 120000);
    await game.setupScene({ gameId: 'dicethrone', phase: 'main1', currentPlayer: '0',
        player0: { hand: [entry.id], resources: { hp: 50, cp: 5 }, tokens: { mjolnir: entry.away ? 0 : 1, electrokinesis: 0, guard_break: 0 } },
        player1: { hand: [], tokens: { mjolnir: entry.away ? 1 : 0 } },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true, mjolnirThrowsThisTurn: { '0': entry.throws } } });
    await closeDebugPanelIfOpen(page);
    await shot(page, info, '01-专属牌在手牌中等待打出');
    await dragDiceThroneHandCardToPlay(page, entry.id);
    await expect.poll(async () => {
        const s = await game.getState();
        const player = s.core.players['0'];
        return { cp: player.resources.cp, electro: player.tokens.electrokinesis ?? 0, guard: player.tokens.guard_break ?? 0,
            holder: player.tokens.mjolnir ?? 0, hand: player.hand.length, discard: player.discard.some((card: { id: string }) => card.id === entry.id) };
    }).toEqual({ cp: entry.cp, electro: entry.electro, guard: entry.guard, holder: 1, hand: entry.hand, discard: true });
    await shot(page, info, '02-出牌后资源与手牌结算');
});

// 预期来自实体卡：意不意外改变两颗骰；一掷千金获得向上取整的半数骰点 CP。
test('索尔意不意外沿旧骰盘修改两颗骰子并确认', async ({ page, game }, info) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(info);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 120000);
    await game.setupScene({ gameId: 'dicethrone', phase: 'main1', currentPlayer: '0', randomQueue: [.08, .08, .08, .08, .08],
        player0: { hand: ['card-unexpected'], resources: { hp: 50, cp: 5 } }, player1: { hand: [] },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true, dice: [], rollCount: 0, rollConfirmed: false } });
    await closeDebugPanelIfOpen(page);
    await page.locator('[data-tutorial-id="advance-phase-button"]').click();
    await page.locator('[data-tutorial-id="dice-roll-button"]').click();
    await dragDiceThroneHandCardToPlay(page, 'card-unexpected');
    await shot(page, info, '01-原骰盘显示两骰调整入口');
    await page.getByTestId('die-adjust-increment-0').click();
    await page.getByTestId('die-adjust-increment-1').click();
    await shot(page, info, '02-两颗骰子预览后沿原按钮确认');
    await page.getByTestId('dice-interaction-confirm-button').click();
    await expect.poll(async () => (await game.getState()).core.currentRollContext?.dice.map((d: { value: number }) => d.value)).toEqual([2, 2, 1, 1, 1]);
    await shot(page, info, '03-确认后仅两颗骰子改变');
});

for (const roll of [1, 6]) test(`索尔一掷千金投出${roll}后沿原效果骰确认`, async ({ page, game }, info) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(info);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 120000);
    await game.setupScene({ gameId: 'dicethrone', phase: 'main1', currentPlayer: '0', randomQueue: [(roll - .5) / 6],
        player0: { hand: ['card-one-throw-fortune'], resources: { hp: 50, cp: 5 } }, player1: { hand: [] },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true } });
    await closeDebugPanelIfOpen(page);
    await dragDiceThroneHandCardToPlay(page, 'card-one-throw-fortune');
    await expect.poll(async () => (await game.getState()).core.pendingBonusDiceSettlement?.dice[0].value).toBe(roll);
    await shot(page, info, '01-效果骰结果在原骰盘待确认');
    await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
    await expect.poll(async () => (await game.getState()).core.players['0'].resources.cp).toBe(5 + Math.ceil(roll / 2));
    await shot(page, info, '02-确认后获得对应CP');
});

test('索尔抬一手在对手确认后选择对手骰并强制重投', async ({ page, game }, info) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(info);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 120000);
    await game.setupScene({ gameId: 'dicethrone', phase: 'offensiveRoll', currentPlayer: '1', randomQueue: [.92],
        player0: { hand: ['card-give-hand'], resources: { hp: 50, cp: 5 } }, player1: { hand: [] },
        responseWindow: { windowType: 'afterRollConfirmed', responderQueue: ['0'], currentResponderIndex: 0 },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true, rollCount: 3, rollLimit: 3,
            rollDiceCount: 5, rollConfirmed: true, pendingAttack: null,
            dice: [{ id: 0, value: 1, isKept: true }, { id: 1, value: 2, isKept: true }, { id: 2, value: 3, isKept: true }, { id: 3, value: 4, isKept: true }, { id: 4, value: 5, isKept: true }] } });
    await closeDebugPanelIfOpen(page);
    await dragDiceThroneHandCardToPlay(page, 'card-give-hand');
    await shot(page, info, '01-对手已确认骰面后原骰盘选择目标');
    await page.getByTestId('die-button-0').click();
    await shot(page, info, '02-选中对手骰后原确认入口可用');
    await page.getByTestId('dice-interaction-confirm-button').click();
    await expect.poll(async () => (await game.getState()).core.dice.map((d: { value: number }) => d.value)).toEqual([6, 2, 3, 4, 5]);
    await shot(page, info, '03-确认后仅选中对手骰重投');
});

test('历史抬一手房间恢复后仍能选择对手骰并重投', async ({ page, game }) => {
    test.setTimeout(120000);
    await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 120000);
    await game.setupScene({ gameId: 'dicethrone', phase: 'offensiveRoll', currentPlayer: '1', randomQueue: [.92],
        player0: { hand: ['card-give-hand'], resources: { hp: 50, cp: 5 } }, player1: { hand: [] },
        responseWindow: { windowType: 'afterRollConfirmed', responderQueue: ['0'], currentResponderIndex: 0 },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true, rollCount: 3, rollLimit: 3,
            rollDiceCount: 5, rollConfirmed: true, pendingAttack: null,
            dice: [1, 2, 3, 4, 5].map((value, id) => ({ id, value, isKept: true })) } });
    await closeDebugPanelIfOpen(page);
    await dragDiceThroneHandCardToPlay(page, 'card-give-hand');
    await expect(page.getByTestId('dice-interaction-hint')).toBeVisible();
    await page.evaluate(async () => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = JSON.parse(JSON.stringify(harness.state.get()));
        const current = state.sys.interaction.current;
        if (!current?.id.startsWith('dt-dice-select-')) throw new Error('未进入真实重投交互');
        delete current.data.meta.selectionMode;
        delete current.data.initialResult;
        await harness.state.set(state);
    });
    await expect(page.getByTestId('dice-interaction-hint')).toContainText('对手');
    await page.getByTestId('die-button-0').click();
    await page.getByTestId('dice-interaction-confirm-button').click();
    await expect.poll(async () => (await game.getState()).core.dice.map((die: { value: number }) => die.value))
        .toEqual([6, 2, 3, 4, 5]);
});

test('索尔意不意外可在对手确认后改变对手两颗骰子', async ({ page, game }, info) => {
    test.setTimeout(120000);
    await clearEvidenceScreenshotsForTest(info);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 120000);
    await game.setupScene({ gameId: 'dicethrone', phase: 'offensiveRoll', currentPlayer: '1',
        player0: { hand: ['card-unexpected'], resources: { hp: 50, cp: 5 } }, player1: { hand: [] },
        responseWindow: { windowType: 'afterRollConfirmed', responderQueue: ['0'], currentResponderIndex: 0 },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true, rollCount: 3, rollLimit: 3,
            rollDiceCount: 5, rollConfirmed: true, pendingAttack: null,
            dice: [{ id: 0, value: 1, isKept: true }, { id: 1, value: 2, isKept: true }, { id: 2, value: 3, isKept: true }, { id: 3, value: 4, isKept: true }, { id: 4, value: 5, isKept: true }] } });
    await closeDebugPanelIfOpen(page);
    await dragDiceThroneHandCardToPlay(page, 'card-unexpected');
    await shot(page, info, '01-对手已确认后原骰盘允许修改');
    await page.getByTestId('die-adjust-increment-0').click();
    await page.getByTestId('die-adjust-increment-1').click();
    await shot(page, info, '02-两颗对手骰预览后原确认可用');
    await page.getByTestId('dice-interaction-confirm-button').click();
    await expect.poll(async () => (await game.getState()).core.dice.map((d: { value: number }) => d.value)).toEqual([2, 3, 3, 4, 5]);
    await shot(page, info, '03-确认后仅两颗对手骰改变');
});
