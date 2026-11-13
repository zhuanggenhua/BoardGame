import type { Page, TestInfo } from '@playwright/test';
import { test, expect, type GameTestContext } from '../framework';
import { clearEvidenceScreenshotsForTest } from '../framework/evidenceScreenshots';
import { closeDebugPanelIfOpen, continueAttackShowcaseIfVisible, dragDiceThroneHandCardToPlay } from '../helpers/dicethrone';
import { expectDiceHintSurface, shot, waitForDamageNumbersToSettle } from '../helpers/dicethroneThorEvidence';
import { THOR_CARDS } from '../../src/games/dicethrone/heroes/thor/cards';

// 独立预期：原玩家板/提示板、slot18–33卡图与FAQ；逐对象表见当前Thor审计的独立规则预期表。
// 这里只覆盖独有操作族，不能把本文件通过外推为公共卡已发现权限缺陷也通过。
async function scene(page: Page, game: GameTestContext, info: TestInfo, config: Parameters<GameTestContext['setupScene']>[0]) {
    await clearEvidenceScreenshotsForTest(info);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 120000);
    await game.setupScene(config);
    await closeDebugPanelIfOpen(page);
    await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id', 'thor');
}

async function attack(page: Page, game: GameTestContext, info: TestInfo, input: { dice: number[]; slot: string; upgrade?: string; bonus?: number[] }) {
    await scene(page, game, info, {
        gameId: 'dicethrone', phase: 'main1', currentPlayer: '0',
        randomQueue: [...input.dice, ...(input.bonus ?? [])].map(v => (v - .5) / 6),
        player0: { hand: input.upgrade ? [input.upgrade] : [], resources: { cp: 10, hp: 30 } },
        player1: { hand: [], resources: { cp: 2, hp: 50 } },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true, pendingAttack: null, pendingDamage: undefined, rollCount: 0, rollConfirmed: false, dice: [] },
    });
    if (input.upgrade) await dragDiceThroneHandCardToPlay(page, input.upgrade);
    await page.locator('[data-tutorial-id="advance-phase-button"]').click();
    await page.locator('[data-tutorial-id="dice-roll-button"]').click();
    await expect.poll(async () => (await game.getState()).core.currentRollContext?.dice.map((d: { value: number }) => d.value)).toEqual(input.dice);
    await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
    await page.locator(`[data-ability-slot="${input.slot}"][data-can-click="true"]`).first().click();
    if (input.upgrade === 'upgrade-thor-bottled-lightning-2' && input.dice.filter(value => value === 6).length >= 4) {
        await expect(page.getByText('选择发动变体', { exact: true })).toBeVisible();
        await expect(page.getByText('结算索尔能力效果', { exact: false })).toHaveCount(0);
        await shot(page, info, '00-同张升级的两个变体以真实规则供选择');
        await page.getByRole('button', { name: /^瓶中闪电 II/ }).click();
    }
    await shot(page, info, '01-原角色板技能选择与升级牌面');
    await page.locator('[data-tutorial-id="advance-phase-button"]').click();
}

async function chooseCustom(page: Page, game: GameTestContext, customId: string, value?: number) {
    const state = await game.getState();
    const options = state.sys.interaction.current?.data?.options ?? [];
    const option = options.find((o: { value?: { customId?: string; value?: number } }) => o.value?.customId === customId && (value === undefined || o.value?.value === value));
    expect(option, `当前正式候选缺少${customId}/${value}`).toBeDefined();
    if (customId === 'thor-mjolnir-move' && options.some((o: { value?: { choiceKind?: string } }) => o.value?.choiceKind === 'player')) {
        if (value === -1) {
            await page.getByRole('button', { name: '停止移动', exact: true }).click();
        } else {
            await page.getByTestId(`dt-player-target-${value}`).click();
            await page.locator('#modal-root').getByRole('button', { name: '确认', exact: true }).last().click();
        }
    } else {
        await page.locator(`[data-option-id="${option.id}"]`).click();
    }
}

test('索尔阿斯加德神力以三头盔治疗而不发起攻击', async ({ page, game }, info) => {
    test.setTimeout(150000);
    await attack(page, game, info, { dice: [4, 4, 4, 1, 6], slot: 'calm', upgrade: 'upgrade-thor-power-of-thunder-2' });
    await expect.poll(async () => {
        const s = await game.getState();
        return { hp: s.core.players['0'].resources.hp, targetHp: s.core.players['1'].resources.hp,
            phase: s.sys.phase, attack: s.core.pendingAttack ?? null };
    }).toEqual({ hp: 34, targetHp: 50, phase: 'main2', attack: null });
    await waitForDamageNumbersToSettle(page);
    await shot(page, info, '02-治疗完成直接回主要阶段');
});

// 五枚锤面触发各等级最高档；基础版只飞掷，升级版额外授予驭电。
for (const input of [
    { name: '雷神之锤基础', dice: [1, 1, 1, 1, 1], slot: 'fist', source: 'thor-hammer-5', electro: 0 },
    { name: '雷神之锤二级', dice: [1, 1, 1, 1, 1], slot: 'fist', upgrade: 'upgrade-thor-hammer-2', source: 'thor-hammer-2-5', electro: 1 },
    { name: '雷神之锤三级', dice: [1, 1, 1, 1, 1], slot: 'fist', upgrade: 'upgrade-thor-hammer-3', source: 'thor-hammer-3-5', electro: 1 },
]) test(`索尔${input.name}从技能槽触发最高档`, async ({ page, game }, info) => {
    test.setTimeout(150000);
    await attack(page, game, info, input);
    await expect.poll(async () => {
        const s = await game.getState();
        return { hp: s.core.players['1'].resources.hp, holder: s.core.players['1'].tokens.mjolnir,
            electro: s.core.players['0'].tokens.electrokinesis ?? 0, source: s.core.pendingAttack?.sourceAbilityId };
    }).toEqual({ hp: 49, holder: 1, electro: input.electro, source: input.source });
    await waitForDamageNumbersToSettle(page);
    await shot(page, info, '02-飞锤与最高档攻击分别保留');
});

// 驭雷策电基础/升级的治疗和资源，与同张升级牌的电闪雷鸣攻击是独立分支。
for (const input of [
    { name: '驭雷策电基础', dice: [1, 4, 4, 6, 4], slot: 'chi', hp: 32, electro: 3, guard: 2, phase: 'main2', source: null },
    { name: '驭雷策电二级', dice: [1, 4, 4, 6, 4], slot: 'chi', upgrade: 'upgrade-thor-mighty-summon-2', hp: 33, electro: 3, guard: 2, phase: 'main2', source: null },
    { name: '电闪雷鸣', dice: [1, 1, 6, 6, 4], slot: 'chi', upgrade: 'upgrade-thor-mighty-summon-2', hp: 30, electro: 2, guard: 0, phase: 'defensiveRoll', source: 'thor-flash-and-thunder' },
]) test(`索尔${input.name}从技能槽结算对应分支`, async ({ page, game }, info) => {
    test.setTimeout(150000);
    await attack(page, game, info, input);
    await expect.poll(async () => {
        const s = await game.getState();
        return { hp: s.core.players['0'].resources.hp, electro: s.core.players['0'].tokens.electrokinesis ?? 0,
            guard: s.core.players['0'].tokens.guard_break ?? 0, phase: s.sys.phase, source: s.core.pendingAttack?.sourceAbilityId ?? null };
    }).toEqual({ hp: input.hp, electro: input.electro, guard: input.guard, phase: input.phase, source: input.source });
    await waitForDamageNumbersToSettle(page);
    await shot(page, info, '02-对应分支结算后回到原阶段');
});

// 原玩家板：雷轰电掣基础版按目标持锤分支结算；升级版和两种雷霆之力移动神锤。
for (const input of [
    { name: '雷轰电掣基础', dice: [1, 2, 3, 4, 4], slot: 'combo', source: 'thor-thunder-strike', electro: 1, hp: 50, holder: 0 },
    { name: '雷轰电掣二级', dice: [1, 2, 3, 4, 4], slot: 'combo', upgrade: 'upgrade-thor-thunder-strike-2', source: 'thor-thunder-strike', electro: 1, hp: 49, holder: 1 },
    { name: '雷霆之力基础', dice: [1, 2, 3, 4, 5], slot: 'calm', source: 'thor-power-of-thunder', electro: 2, hp: 49, holder: 1 },
    { name: '雷霆之力二级', dice: [1, 2, 3, 4, 5], slot: 'calm', upgrade: 'upgrade-thor-power-of-thunder-2', source: 'thor-power-of-thunder-2', electro: 2, hp: 49, holder: 1 },
]) test(`索尔${input.name}从技能槽结算并保留攻击`, async ({ page, game }, info) => {
    test.setTimeout(150000);
    await attack(page, game, info, input);
    await expect.poll(async () => {
        const s = await game.getState();
        return { hp: s.core.players['1'].resources.hp, holder: s.core.players['1'].tokens.mjolnir ?? 0,
            electro: s.core.players['0'].tokens.electrokinesis, source: s.core.pendingAttack?.sourceAbilityId };
    }).toEqual({ hp: input.hp, holder: input.holder, electro: input.electro, source: input.source });
    await waitForDamageNumbersToSettle(page);
    await shot(page, info, '02-技能结算后神锤归属与原攻击保留');
});

test('索尔俺也一样通过原骰盘复制锁定骰', async ({ page, game }, info) => {
    test.setTimeout(120000);
    await scene(page, game, info, {
        gameId: 'dicethrone', currentPlayer: '0', phase: 'offensiveRoll',
        player0: { hand: ['card-me-too'], resources: { cp: 5, hp: 50 } },
        player1: { hand: [], resources: { cp: 2, hp: 50 } },
        extra: {
            selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true,
            rollCount: 3, rollLimit: 3, rollDiceCount: 5, rollConfirmed: false, pendingAttack: null,
            dice: [
                { id: 0, value: 6, isKept: true }, { id: 1, value: 5, isKept: true },
                { id: 2, value: 4, isKept: false }, { id: 3, value: 2, isKept: false },
                { id: 4, value: 3, isKept: false },
            ],
        },
    });
    await dragDiceThroneHandCardToPlay(page, 'card-me-too');
    await expect.poll(async () => (await game.getState()).sys.interaction.current?.data?.meta?.dieModifyConfig?.mode).toBe('copy');
    const source = page.getByTestId('die-button-0');
    const target = page.getByTestId('die-button-1');
    await shot(page, info, '01-原骰盘选择复制来源');
    await source.click();
    await expect(source).toHaveAttribute('data-selected', 'true');
    await shot(page, info, '02-来源骰选定后选择目标骰');
    await target.click();
    await expect.poll(async () => {
        const state = await game.getState();
        return { values: state.core.dice.slice(0, 2).map((die: { value: number }) => die.value), hand: state.core.players['0'].hand.length };
    }).toEqual({ values: [6, 6], hand: 0 });
    await shot(page, info, '03-复制完成且锁定骰点数更新');
});

test('索尔付费召回和驭电抽牌沿原主动栏与弃牌提示', async ({ page, game }, info) => {
    test.setTimeout(120000);
    await scene(page, game, info, { gameId: 'dicethrone', currentPlayer: '0', phase: 'main1',
        player0: { hand: ['card-thor-hammer-time'], resources: { cp: 5, hp: 50 }, tokens: { mjolnir: 0, electrokinesis: 3 } },
        player1: { hand: [], resources: { cp: 2, hp: 50 }, tokens: { mjolnir: 1 } },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true } });
    await shot(page, info, '01-神锤在敌人处且驭电三枚');
    await page.getByTestId('passive-action-thor-mjolnir-1').click();
    await expect(page.getByTestId('dicethrone-hand-discard-hint')).toContainText('选择 1 张手牌弃置');
    await shot(page, info, '02-召回成本复用手牌区与当前提示');
    await page.locator('[data-testid="hand-area"] [data-card-id="card-thor-hammer-time"]').click();
    await expect.poll(async () => { const s = await game.getState(); return { holder: s.core.players['0'].tokens.mjolnir, electro: s.core.players['0'].tokens.electrokinesis, hand: s.core.players['0'].hand.length }; }).toEqual({ holder: 1, electro: 4, hand: 0 });
    await shot(page, info, '03-弃牌召回后神锤回归且驭电三至四');
    await page.getByTestId('passive-action-electrokinesis-draw-0').click();
    await expect.poll(async () => { const s = await game.getState(); return { electro: s.core.players['0'].tokens.electrokinesis, hand: s.core.players['0'].hand.length }; }).toEqual({ electro: 0, hand: 1 });
    await shot(page, info, '04-花四驭电抽一牌并禁用重复抽牌');
    await expect(page.getByTestId('passive-action-electrokinesis-draw-0')).toBeDisabled();
});

test('索尔弃牌飞掷通过原手牌区取消和支付', async ({ page, game }, info) => {
    test.setTimeout(120000);
    await scene(page, game, info, {
        gameId: 'dicethrone', currentPlayer: '0', phase: 'main1',
        player0: { hand: ['card-thor-hammer-time'], resources: { cp: 5, hp: 50 }, tokens: { mjolnir: 1 } },
        player1: { hand: [], resources: { cp: 2, hp: 50 } },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true },
    });
    await page.getByTestId('passive-action-thor-mjolnir-0').click();
    const hint = page.getByTestId('dicethrone-hand-discard-hint');
    await expect(hint).toContainText('选择 1 张手牌弃置');
    await expect(page.getByTestId('dt-card-pool-overlay')).toBeHidden();
    await shot(page, info, '01-原手牌区选择弃牌成本');
    await page.getByTestId('dicethrone-hand-discard-cancel').click();
    await expect.poll(async () => {
        const state = await game.getState();
        return { hand: state.core.players['0'].hand.length, holder: state.core.players['0'].tokens.mjolnir, hp: state.core.players['1'].resources.hp };
    }).toEqual({ hand: 1, holder: 1, hp: 50 });
    await shot(page, info, '02-取消后手牌与神锤保持');
    await page.getByTestId('passive-action-thor-mjolnir-0').click();
    await page.locator('[data-testid="hand-area"] [data-card-id="card-thor-hammer-time"]').click();
    await expect.poll(async () => {
        const state = await game.getState();
        return { hand: state.core.players['0'].hand.length, holder: state.core.players['1'].tokens.mjolnir, hp: state.core.players['1'].resources.hp };
    }).toEqual({ hand: 0, holder: 1, hp: 49 });
    await waitForDamageNumbersToSettle(page);
    await shot(page, info, '03-支付后飞掷神锤造成一点伤害');
});

test('索尔起开沿原状态选择入口移除对手一层气', async ({ page, game }, info) => {
    test.setTimeout(120000);
    await scene(page, game, info, {
        gameId: 'dicethrone', currentPlayer: '0', phase: 'main1',
        player0: { hand: ['card-get-away'], resources: { cp: 5, hp: 50 } },
        player1: { hand: [], tokens: { taiji: 2 }, resources: { cp: 2, hp: 50 } },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true },
    });
    await dragDiceThroneHandCardToPlay(page, 'card-get-away');
    const modal = page.locator('#modal-root');
    const target = modal.getByTestId('dt-status-owner-1').getByTestId('dt-status-effect-1-taiji');
    await expect(target).toBeVisible();
    await shot(page, info, '01-起开沿原状态选择入口显示对手气');
    await target.click();
    const confirm = modal.getByRole('button', { name: '确认', exact: true }).last();
    await expect(confirm).toBeEnabled();
    await shot(page, info, '02-选中对手气后原确认入口可用');
    await confirm.click();
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            taiji: state.core.players['1'].tokens.taiji,
            cp: state.core.players['0'].resources.cp,
            hand: state.core.players['0'].hand.length,
            discarded: state.core.players['0'].discard.some((card: { id: string }) => card.id === 'card-get-away'),
        };
    }).toEqual({ taiji: 1, cp: 4, hand: 0, discarded: true });
    await shot(page, info, '03-确认后只移除一层气并完成出牌');
});

test('索尔拜拜了您内在投掷阶段沿原入口移除一层状态', async ({ page, game }, info) => {
    test.setTimeout(120000);
    await scene(page, game, info, {
        gameId: 'dicethrone', currentPlayer: '0', phase: 'offensiveRoll',
        player0: { hand: ['card-bye-bye'], resources: { cp: 5, hp: 50 } },
        player1: { hand: [], tokens: { taiji: 2 }, resources: { cp: 2, hp: 50 } },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true, rollCount: 0, rollConfirmed: false, dice: [] },
    });
    await dragDiceThroneHandCardToPlay(page, 'card-bye-bye');
    const modal = page.locator('#modal-root');
    const target = modal.getByTestId('dt-status-owner-1').getByTestId('dt-status-effect-1-taiji');
    await expect(target).toBeVisible();
    await shot(page, info, '01-投掷阶段瞬时出牌后选择对手状态');
    await target.click();
    const confirm = modal.getByRole('button', { name: '确认', exact: true }).last();
    await expect(confirm).toBeEnabled();
    await shot(page, info, '02-选中一层状态后确认');
    await confirm.click();
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            taiji: state.core.players['1'].tokens.taiji,
            cp: state.core.players['0'].resources.cp,
            phase: state.sys.phase,
            discarded: state.core.players['0'].discard.some((card: { id: string }) => card.id === 'card-bye-bye'),
        };
    }).toEqual({ taiji: 1, cp: 3, phase: 'offensiveRoll', discarded: true });
    await shot(page, info, '03-移除一层后回原投掷阶段');
});

test('索尔乾坤大挪移复用原状态转移并排除神锤', async ({ page, game }, info) => {
    test.setTimeout(120000);
    await scene(page, game, info, {
        gameId: 'dicethrone', currentPlayer: '0', phase: 'main1',
        player0: { hand: ['card-transfer-status'], resources: { cp: 5, hp: 50 } },
        player1: { hand: [], statusEffects: { poison: 2 }, resources: { cp: 2, hp: 50 } },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true },
    });
    await dragDiceThroneHandCardToPlay(page, 'card-transfer-status');
    const modal = page.locator('#modal-root');
    const poison = modal.getByTestId('dt-status-effect-1-poison');
    await expect(poison).toBeVisible();
    await expect(modal.getByTestId('dt-status-effect-0-mjolnir')).toHaveCount(0);
    await shot(page, info, '01-选择转移来源且神锤不可转移');
    await poison.click();
    await expect(modal.getByTestId('dt-transfer-source-locked-1')).toBeVisible();
    const destination = modal.getByTestId('dt-transfer-target-0');
    await expect(destination).toBeVisible();
    await shot(page, info, '02-来源锁定后选择索尔为目标');
    await destination.click();
    const confirm = modal.getByRole('button', { name: '确认', exact: true }).last();
    await expect(confirm).toBeEnabled();
    await shot(page, info, '03-选中目标后原确认入口可用');
    await confirm.click();
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            source: state.core.players['1'].statusEffects.poison,
            target: state.core.players['0'].statusEffects.poison,
            hammer: state.core.players['0'].tokens.mjolnir,
            cp: state.core.players['0'].resources.cp,
            discarded: state.core.players['0'].discard.some((card: { id: string }) => card.id === 'card-transfer-status'),
        };
    }).toEqual({ source: 1, target: 1, hammer: 1, cp: 3, discarded: true });
    await shot(page, info, '04-转移一层后神锤仍归索尔');
});

test('索尔状什么态沿原玩家选择移除对手全部状态', async ({ page, game }, info) => {
    test.setTimeout(120000);
    await scene(page, game, info, {
        gameId: 'dicethrone', currentPlayer: '0', phase: 'main1',
        player0: { hand: ['card-what-status'], resources: { cp: 5, hp: 50 } },
        player1: { hand: [], statusEffects: { poison: 2 }, tokens: { taiji: 2 }, resources: { cp: 2, hp: 50 } },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true },
    });
    await dragDiceThroneHandCardToPlay(page, 'card-what-status');
    const modal = page.locator('#modal-root');
    const target = modal.getByTestId('dt-player-target-1');
    await expect(target).toBeVisible();
    await shot(page, info, '01-原玩家选择入口显示有状态的对手');
    await target.click();
    const confirm = modal.getByRole('button', { name: '确认', exact: true }).last();
    await expect(confirm).toBeEnabled();
    await shot(page, info, '02-选中对手后原确认入口可用');
    await confirm.click();
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            poison: state.core.players['1'].statusEffects.poison ?? 0,
            taiji: state.core.players['1'].tokens.taiji ?? 0,
            hammer: state.core.players['0'].tokens.mjolnir,
            cp: state.core.players['0'].resources.cp,
            discarded: state.core.players['0'].discard.some((card: { id: string }) => card.id === 'card-what-status'),
        };
    }).toEqual({ poison: 0, taiji: 0, hammer: 1, cp: 3, discarded: true });
    await shot(page, info, '03-确认后对手状态清除且神锤仍在');
});

for (const upgraded of [false, true]) test(`索尔奥丁${upgraded ? '二级空选保留' : '基础无重掷'}效果骰原确认`, async ({ page, game }, info) => {
    test.setTimeout(120000);
    await attack(page, game, info, { dice: [1, 1, 4, 4, 4], slot: 'sky', upgrade: upgraded ? 'upgrade-thor-odinforce-2' : undefined, bonus: [4, 4, 6, 6, 6] });
    await expect.poll(async () => (await game.getState()).core.pendingBonusDiceSettlement?.dice.length).toBe(5);
    await expect(page.locator('[data-tutorial-id="dice-roll-button"]')).toHaveCount(0);
    if (upgraded) await expect(page.getByTestId('dice-interaction-hint')).toContainText('选择重投骰子（0/5）');
    else await expect(page.getByTestId('dice-interaction-hint')).toHaveText('确认效果骰结果并继续结算');
    await expectDiceHintSurface(page, 'dice-tray-left-center');
    await shot(page, info, '02-五颗效果骰与原确认保留结果');
    await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
    await expect.poll(async () => { const s = await game.getState(); return { phase: s.sys.phase, electro: s.core.players['0'].tokens.electrokinesis, cp: s.core.players['0'].resources.cp, reroll: s.core.pendingBonusDiceSettlement ?? null }; }).toEqual({ phase: 'defensiveRoll', electro: 3, cp: upgraded ? 9 : 11, reroll: null });
    await waitForDamageNumbersToSettle(page);
    await shot(page, info, '03-确认后一次获得三驭电和一点战斗点数');
});

test('索尔连锁二级四颗效果骰保留六个组合选择', async ({ page, game }, info) => {
    test.setTimeout(120000);
    await attack(page, game, info, { dice: [1, 1, 1, 6, 6], slot: 'lotus', upgrade: 'upgrade-thor-chain-lightning-2', bonus: [1, 2, 4, 6] });
    await expect.poll(async () => (await game.getState()).core.pendingBonusDiceSettlement?.dice.length).toBe(4);
    await expectDiceHintSurface(page, 'dice-tray-left-center');
    await shot(page, info, '02-四颗效果骰先由原骰盘确认');
    await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
    await expectDiceHintSurface(page, 'dice-tray-left-center');
    await expect(page.getByTestId('dice-interaction-hint-title')).toHaveText('选择两颗效果骰');
    await expect(page.getByTestId('dicethrone-2d-dice-tray')).toHaveAttribute('data-dice-count', '4');
    await expect(page.locator('[data-option-id]')).toHaveCount(0);
    await shot(page, info, '03-原骰盘直接展示四骰与组合选择提示');
    await page.getByTestId('die-button-0').click();
    await page.getByTestId('die-button-1').click();
    await expect(page.getByTestId('die-button-0')).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('die-button-1')).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('dice-interaction-confirm-button')).toBeEnabled();
    await shot(page, info, '04-选中两颗后原确认动作启用');
    await page.getByTestId('dice-interaction-confirm-button').click();
    await expect.poll(async () => { const s = await game.getState(); return { hp: s.core.players['1'].resources.hp, bonus: s.core.pendingAttack?.bonusDamage, phase: s.sys.phase }; }).toEqual({ hp: 47, bonus: 3, phase: 'defensiveRoll' });
    await waitForDamageNumbersToSettle(page);
    await shot(page, info, '05-玩家选低值组合后三附属伤害与主攻击分别保留');
});

for (const input of [
    { name: '瓶中基础零次停止', dice: [6, 6, 6, 6, 1], slot: 'lightning', moves: 0, stopAfter: undefined },
    { name: '瓶中二级三次', dice: [6, 6, 6, 6, 1], slot: 'lightning', upgrade: 'upgrade-thor-bottled-lightning-2', moves: 3, stopAfter: undefined },
    { name: '瓶中二级飞掷一次后主动停止', dice: [6, 6, 6, 6, 1], slot: 'lightning', upgrade: 'upgrade-thor-bottled-lightning-2', moves: 3, stopAfter: 1 },
    { name: '连锁锤击六次', dice: [6, 6, 6, 1, 1], slot: 'lightning', upgrade: 'upgrade-thor-bottled-lightning-2', moves: 6, stopAfter: undefined },
    { name: '终极四次', dice: [6, 6, 6, 6, 6], slot: 'ultimate', moves: 4, stopAfter: undefined },
]) test(`索尔${input.name}沿既有选择窗口逐次移动`, async ({ page, game }, info) => {
    test.setTimeout(150000);
    await attack(page, game, info, input);
    await expect(page.getByText('飞掷或召回姆乔尔尼尔', { exact: true })).toBeVisible();
    await shot(page, info, '02-可选移动窗口保留立即停止入口');
    if (input.moves === 0) await chooseCustom(page, game, 'thor-mjolnir-move', -1);
    for (let i = 0; i < input.moves; i++) {
        const destination = i % 2 === 0 ? 1 : 0;
        await chooseCustom(page, game, 'thor-mjolnir-move', destination);
        await expect.poll(async () => (await game.getState()).core.players[String(destination)].tokens.mjolnir).toBe(1);
        if (i === 0) {
            await waitForDamageNumbersToSettle(page);
            await shot(page, info, '03-一次飞掷独立扣一生命后可继续或停止');
        }
        if (input.stopAfter === i + 1) {
            await chooseCustom(page, game, 'thor-mjolnir-move', -1);
            await expect(page.getByText('飞掷或召回姆乔尔尼尔', { exact: true })).toHaveCount(0);
            const stopped = await game.getState();
            expect(stopped.core.players['1'].resources.hp).toBe(49);
            expect(stopped.core.players['1'].tokens.mjolnir).toBe(1);
            expect(stopped.core.pendingAttack).not.toBeNull();
            await waitForDamageNumbersToSettle(page);
            await shot(page, info, '05-飞掷一次后主动停止并进入攻击响应');
            break;
        }
    }
    await expect(page.getByText('飞掷或召回姆乔尔尼尔', { exact: true })).toHaveCount(0);
    const s = await game.getState();
    const completedMoves = input.stopAfter ?? input.moves;
    expect(s.core.players['1'].resources.hp).toBe(input.slot === 'ultimate' ? 34 : 50 - Math.ceil(completedMoves / 2));
    await waitForDamageNumbersToSettle(page);
    if (!input.stopAfter) await shot(page, info, '04-达到次数上限或停止后回原结算');
});

for (const upgraded of [false, true]) test(`索尔雷电之轮${upgraded ? '二级四骰' : '基础三骰'}沿原防御入口`, async ({ page, game }, info) => {
    test.setTimeout(120000);
    // 防御升级由正式手牌先打出；再注入下一段合法攻击前态，不注入防御结果。
    await scene(page, game, info, { gameId: 'dicethrone', phase: 'main1', currentPlayer: '0', player0: { hand: upgraded ? ['upgrade-thor-thunder-wheel-2'] : [], resources: { hp: 40, cp: 10 } }, player1: { hand: [] }, extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true } });
    if (upgraded) await dragDiceThroneHandCardToPlay(page, 'upgrade-thor-thunder-wheel-2');
    await expect.poll(async () => (await game.getState()).core.players['0'].hand.length).toBe(0);
    const before = await game.getState();
    await game.setupScene({ gameId: 'dicethrone', phase: 'defensiveRoll', currentPlayer: '1', randomQueue: (upgraded ? [1, 1, 1, 1] : [1, 1, 4]).map(v => (v - .5) / 6),
        player0: before.core.players['0'], player1: { hand: [], resources: { hp: 50, cp: 2 } },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true, rollCount: 0, rollConfirmed: false, dice: [], pendingAttack: { attackerId: '1', defenderId: '0', sourceAbilityId: 'fist-technique-5', damage: 8, bonusDamage: 0, isDefendable: true, preDefenseResolved: true, offensiveRollEndTokenResolved: true } } });
    await shot(page, info, '01-敌方八伤攻击前态与防御原入口');
    await page.getByRole('button', { name: '开始防御', exact: true }).click();
    await page.locator('[data-ability-slot="meditate"][data-can-click="true"]').first().click();
    await page.locator('[data-tutorial-id="dice-roll-button"]').click();
    await expect(page.locator('[data-testid^="die-button-"]')).toHaveCount(upgraded ? 4 : 3);
    await shot(page, info, '02-实际投出对应数量防御骰');
    await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
    await page.locator('[data-tutorial-id="advance-phase-button"]').click();
    await expect.poll(async () => (await game.getState()).sys.phase).toBe('main2');
    await expect.poll(async () => (await game.getState()).core.players['0'].resources.hp).toBe(upgraded ? 32 : 34);
    await waitForDamageNumbersToSettle(page);
    await shot(page, info, '03-防御减伤和每组神锤移动后结算生命');
});

test('索尔防御召回神锤与雷电各获得一驭电', async ({ page, game }, info) => {
    test.setTimeout(120000);
    await scene(page, game, info, { gameId: 'dicethrone', phase: 'defensiveRoll', currentPlayer: '1',
        randomQueue: [1, 1, 6].map(v => (v - .5) / 6),
        player0: { hand: [], resources: { hp: 40, cp: 2 }, tokens: { mjolnir: 0, electrokinesis: 0 } },
        player1: { hand: [], resources: { hp: 50, cp: 2 }, tokens: { mjolnir: 1 } },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true, rollCount: 0, rollConfirmed: false, dice: [], pendingAttack: { attackerId: '1', defenderId: '0', sourceAbilityId: 'fist-technique-5', damage: 8, bonusDamage: 0, isDefendable: true, preDefenseResolved: true, offensiveRollEndTokenResolved: true } } });
    await page.getByRole('button', { name: '开始防御', exact: true }).click();
    await page.locator('[data-ability-slot="meditate"][data-can-click="true"]').first().click();
    await page.locator('[data-tutorial-id="dice-roll-button"]').click();
    await shot(page, info, '01-防御骰两神锤一雷电');
    await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
    await page.locator('[data-tutorial-id="advance-phase-button"]').click();
    await expect.poll(async () => { const state = await game.getState(); return {
        phase: state.sys.phase, holder: state.core.players['0'].tokens.mjolnir,
        electro: state.core.players['0'].tokens.electrokinesis,
    }; }).toEqual({ phase: 'main2', holder: 1, electro: 2 });
    await waitForDamageNumbersToSettle(page);
    await shot(page, info, '02-防御完成后神锤回归并获得两驭电');
});

for (const roll of [1, 6]) test(`索尔推广彩虹桥投出${roll}沿原效果骰确认`, async ({ page, game }, info) => {
    test.setTimeout(120000);
    await scene(page, game, info, { gameId: 'dicethrone', phase: 'main1', currentPlayer: '0', randomQueue: [(roll - .5) / 6],
        player0: { hand: [THOR_CARDS.find(card => card.id === 'card-thor-bifrost')!], resources: { hp: 50, cp: 5 } }, player1: { hand: [] },
        extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true } });
    await shot(page, info, '01-明确加入推广卡的合法主要阶段前态');
    await dragDiceThroneHandCardToPlay(page, 'card-thor-bifrost');
    await expect.poll(async () => (await game.getState()).core.pendingBonusDiceSettlement?.dice[0].value).toBe(roll);
    await shot(page, info, '02-推广卡效果骰原骰盘待确认');
    await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
    await expect.poll(async () => { const s = await game.getState(); return { hand: s.core.players['0'].hand.length, electro: s.core.players['0'].tokens.electrokinesis ?? 0, guard: s.core.players['0'].tokens.guard_break ?? 0 }; }).toEqual({ hand: 1, electro: roll === 6 ? 2 : 0, guard: roll === 6 ? 1 : 0 });
    await shot(page, info, '03-确认后抽一牌及雷电分支状态奖励');
});

for (const input of [
    { cardId: 'card-thor-impenetrable', effectRoll: 1, finalHp: 5 },
    { cardId: 'card-thor-undaunted', effectRoll: 4, finalHp: 1 },
    { cardId: 'card-thor-undaunted', effectRoll: 1, finalHp: 0 },
]) test(`索尔${input.cardId === 'card-thor-impenetrable' ? '无懈可击' : '不屈意志'}响应后生命${input.finalHp}`, async ({ page, game }, info) => {
    test.setTimeout(120000);
    const pendingDamageId = 'thor-lethal-attack-response';
    await scene(page, game, info, { gameId: 'dicethrone', phase: 'defensiveRoll', currentPlayer: '0',
        randomQueue: [(input.effectRoll - .5) / 6],
        player0: { hand: [input.cardId], resources: { hp: 5, cp: 5 }, tokens: { electrokinesis: 2 } }, player1: { hand: [], resources: { hp: 50, cp: 2 } },
        sys: {
            interaction: { current: { id: `dt-token-response-${pendingDamageId}`, kind: 'dt:token-response', playerId: '0', data: { pendingDamageId } }, queue: [] },
        },
        extra: {
            selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true, rollCount: 0, rollConfirmed: false, dice: [],
            pendingAttack: { attackerId: '1', defenderId: '0', sourceAbilityId: 'fist-technique-5', damage: 8, bonusDamage: 0, isDefendable: false, preDefenseResolved: true, offensiveRollEndTokenResolved: true, settlementStage: 'preDamage' },
            pendingDamage: { id: pendingDamageId, sourcePlayerId: '1', targetPlayerId: '0', originalDamage: 8, currentDamage: 8, sourceAbilityId: 'fist-technique-5', damageScope: 'attack', responseType: 'beforeDamageReceived', responderId: '0', isFullyEvaded: false },
        },
    });
    await expect.poll(async () => {
        const state = await game.getState();
        return { pending: state.core.pendingDamage?.id, hp: state.core.players['0'].resources.hp, damage: state.core.pendingDamage?.currentDamage };
    }).toEqual({ pending: pendingDamageId, hp: 5, damage: 8 });
    await page.locator(`[data-testid="hand-area"] [data-card-id="${input.cardId}"]`).click();
    await expect(page.getByTestId('board-magnify-overlay')).toBeVisible();
    await shot(page, info, '00-响应出牌前放大阅读索尔防护卡');
    await page.getByTestId('board-magnify-overlay-close').click();
    await shot(page, info, '01-代表态：索尔5血、即将承受8点攻击伤害，处于受伤响应');
    await dragDiceThroneHandCardToPlay(page, input.cardId);
    if (input.cardId === 'card-thor-undaunted') {
        await expect.poll(async () => (await game.getState()).core.pendingBonusDiceSettlement?.dice[0].value).toBe(input.effectRoll);
        await shot(page, info, '02-不屈效果骰在原骰盘待玩家确认');
        await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
    }
    const expectedRemainingDamage = input.cardId === 'card-thor-impenetrable'
        ? 0
        : input.effectRoll === 4 ? 4 : 8;
    await expect.poll(async () => (await game.getState()).core.pendingDamage?.currentDamage).toBe(expectedRemainingDamage);
    const responsePass = page.getByTestId('dicethrone-response-pass-button');
    if (await responsePass.isVisible()) await responsePass.click();
    await expect.poll(async () => (await game.getState()).core.pendingDamage).toBeUndefined();
    await expect.poll(async () => (await game.getState()).core.players['0'].resources.hp).toBe(input.finalHp);
    await expect.poll(async () => (await game.getState()).core.players['0'].resources.cp).toBe(3);
    if (input.finalHp === 0) {
        await expect(page.getByTestId('attack-showcase-overlay')).toBeVisible();
        await shot(page, info, '03-攻击结果特写等待玩家点击继续');
    }
    const continuedAttackShowcase = await continueAttackShowcaseIfVisible(page);
    if (input.finalHp === 0) expect(continuedAttackShowcase).toBe(true);
    await waitForDamageNumbersToSettle(page);
    await shot(page, info, input.finalHp === 0
        ? '04-玩家点击继续后显示失败结算且生命与牌费正确'
        : '03-原伤害事务完成且生命与牌费正确');
});

for (const input of [
    { cardId: 'card-play-six', fixed: true, expectedValue: 6, label: '固定六', hint: '选择要设为6的骰子' },
    { cardId: 'card-surprise', fixed: false, expectedValue: 2, label: '任意改一骰', hint: '选择要修改的骰子' },
    { cardId: 'card-flick', fixed: false, expectedValue: 2, label: '弹一手调整一格', hint: '选择要调整的骰子' },
]) test(`索尔公共${input.label}保留旧操作语义`, async ({ page, game }, info) => {
    test.setTimeout(120000);
    await scene(page, game, info, { gameId: 'dicethrone', phase: 'main1', currentPlayer: '0', randomQueue: [.08, .08, .08, .08, .08],
        player0: { hand: [input.cardId], resources: { hp: 50, cp: 5 } }, player1: { hand: [] }, extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true, dice: [], rollCount: 0, rollConfirmed: false } });
    await page.locator('[data-tutorial-id="advance-phase-button"]').click();
    await page.locator('[data-tutorial-id="dice-roll-button"]').click();
    await page.locator(`[data-testid="hand-area"] [data-card-id="${input.cardId}"]`).click();
    await expect(page.getByTestId('board-magnify-overlay')).toBeVisible();
    await shot(page, info, '00-改骰前放大阅读公共卡牌');
    await page.getByTestId('board-magnify-overlay-close').click();
    await dragDiceThroneHandCardToPlay(page, input.cardId);
    await expect(page.getByTestId('dice-interaction-hint')).toContainText(input.hint);
    await shot(page, info, input.cardId === 'card-flick' ? '01-调整一格使用原骰盘提示与控件' : '01-旧固定值和任意编辑各自提示与控件');
    if (input.fixed) {
        await expect(page.locator('[data-testid^="die-adjust-"]')).toHaveCount(0);
        await page.getByTestId('die-button-0').click();
    } else {
        await page.getByTestId('die-adjust-increment-0').click();
        if (input.cardId === 'card-flick') {
            await expect(page.getByTestId('die-adjust-increment-0')).toBeDisabled();
        }
        await shot(page, info, input.cardId === 'card-flick' ? '02-调整一格后原确认可用且再次增加被禁用' : '02-任意编辑保留原加减预览和手动确认');
        await page.getByTestId('dice-interaction-confirm-button').click();
    }
    await expect.poll(async () => (await game.getState()).core.currentRollContext?.dice.map((d: { value: number }) => d.value)).toEqual([input.expectedValue, 1, 1, 1, 1]);
    await shot(page, info, '03-旧流程提交后只修改一颗骰子');
});
