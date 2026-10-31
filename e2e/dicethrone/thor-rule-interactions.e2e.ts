import type { Page, TestInfo } from '@playwright/test';
import { test, expect, type GameTestContext } from '../framework';
import { clearEvidenceScreenshotsForTest } from '../framework/evidenceScreenshots';
import { closeDebugPanelIfOpen, continueAttackShowcaseIfVisible, dragDiceThroneHandCardToPlay } from '../helpers/dicethrone';
import { expectDiceHintSurface, shot } from '../helpers/dicethroneThorEvidence';
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
    await page.locator(`[data-option-id="${option.id}"]`).click();
}

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

for (const upgraded of [false, true]) test(`索尔奥丁${upgraded ? '二级空选保留' : '基础无重掷'}效果骰原确认`, async ({ page, game }, info) => {
    test.setTimeout(120000);
    await attack(page, game, info, { dice: [1, 1, 4, 4, 4], slot: 'sky', upgrade: upgraded ? 'upgrade-thor-odinforce-2' : undefined, bonus: [4, 4, 6, 6, 6] });
    await expect.poll(async () => (await game.getState()).core.pendingBonusDiceSettlement?.dice.length).toBe(5);
    await expect(page.locator('[data-tutorial-id="dice-roll-button"]')).toHaveCount(0);
    if (upgraded) await expect(page.getByTestId('dice-interaction-hint')).toContainText('确认保留当前结果');
    else await expect(page.getByTestId('dice-interaction-hint')).toHaveText('确认效果骰结果并继续结算');
    await expectDiceHintSurface(page, 'dice-tray');
    await shot(page, info, '02-五颗效果骰与原确认保留结果');
    await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
    await expect.poll(async () => { const s = await game.getState(); return { phase: s.sys.phase, electro: s.core.players['0'].tokens.electrokinesis, cp: s.core.players['0'].resources.cp, reroll: s.core.pendingBonusDiceSettlement ?? null }; }).toEqual({ phase: 'defensiveRoll', electro: 3, cp: upgraded ? 9 : 11, reroll: null });
    await shot(page, info, '03-确认后一次获得三驭电和一点战斗点数');
});

test('索尔连锁二级四颗效果骰保留六个组合选择', async ({ page, game }, info) => {
    test.setTimeout(120000);
    await attack(page, game, info, { dice: [1, 1, 1, 6, 6], slot: 'lotus', upgrade: 'upgrade-thor-chain-lightning-2', bonus: [1, 2, 4, 6] });
    await expect.poll(async () => (await game.getState()).core.pendingBonusDiceSettlement?.dice.length).toBe(4);
    await expectDiceHintSurface(page, 'dice-tray');
    await shot(page, info, '02-四颗效果骰先由原骰盘确认');
    await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
    await expectDiceHintSurface(page, 'viewport');
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
    await shot(page, info, '05-玩家选低值组合后三附属伤害与主攻击分别保留');
});

for (const input of [
    { name: '瓶中基础零次停止', dice: [6, 6, 6, 6, 1], slot: 'lightning', moves: 0 },
    { name: '瓶中二级三次', dice: [6, 6, 6, 6, 1], slot: 'lightning', upgrade: 'upgrade-thor-bottled-lightning-2', moves: 3 },
    { name: '连锁锤击六次', dice: [6, 6, 6, 1, 1], slot: 'lightning', upgrade: 'upgrade-thor-bottled-lightning-2', moves: 6 },
    { name: '终极四次', dice: [6, 6, 6, 6, 6], slot: 'ultimate', moves: 4 },
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
        if (i === 0) await shot(page, info, '03-一次飞掷独立扣一生命后可继续或停止');
    }
    await expect(page.getByText('飞掷或召回姆乔尔尼尔', { exact: true })).toHaveCount(0);
    const s = await game.getState();
    expect(s.core.players['1'].resources.hp).toBe(input.slot === 'ultimate' ? 34 : 50 - Math.ceil(input.moves / 2));
    await shot(page, info, '04-达到次数上限或停止后回原结算');
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
    await shot(page, info, '03-防御减伤和每组神锤移动后结算生命');
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
    await shot(page, info, input.finalHp === 0
        ? '04-玩家点击继续后显示失败结算且生命与牌费正确'
        : '03-原伤害事务完成且生命与牌费正确');
});

for (const input of [
    { cardId: 'card-play-six', fixed: true, expectedValue: 6 },
    { cardId: 'card-surprise', fixed: false, expectedValue: 2 },
]) test(`索尔公共${input.fixed ? '固定六' : '任意改一骰'}保留旧操作语义`, async ({ page, game }, info) => {
    test.setTimeout(120000);
    await scene(page, game, info, { gameId: 'dicethrone', phase: 'main1', currentPlayer: '0', randomQueue: [.08, .08, .08, .08, .08],
        player0: { hand: [input.cardId], resources: { hp: 50, cp: 5 } }, player1: { hand: [] }, extra: { selectedCharacters: { '0': 'thor', '1': 'monk' }, hostStarted: true, dice: [], rollCount: 0, rollConfirmed: false } });
    await page.locator('[data-tutorial-id="advance-phase-button"]').click();
    await page.locator('[data-tutorial-id="dice-roll-button"]').click();
    await dragDiceThroneHandCardToPlay(page, input.cardId);
    await expect(page.getByTestId('dice-interaction-hint')).toContainText(input.fixed ? '选择要设为6的骰子' : '选择要修改的骰子');
    await shot(page, info, '01-旧固定值和任意编辑各自提示与控件');
    if (input.fixed) {
        await expect(page.locator('[data-testid^="die-adjust-"]')).toHaveCount(0);
        await page.getByTestId('die-button-0').click();
    } else {
        await page.getByTestId('die-adjust-increment-0').click();
        await shot(page, info, '02-任意编辑保留原加减预览和手动确认');
        await page.getByTestId('dice-interaction-confirm-button').click();
    }
    await expect.poll(async () => (await game.getState()).core.currentRollContext?.dice.map((d: { value: number }) => d.value)).toEqual([input.expectedValue, 1, 1, 1, 1]);
    await shot(page, info, '03-旧流程提交后只修改一颗骰子');
});
