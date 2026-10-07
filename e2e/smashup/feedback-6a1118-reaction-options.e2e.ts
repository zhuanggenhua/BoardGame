import { test, expect } from '../framework';
import { hideSmashUpDebugPanelForEvidence } from '../helpers/smashup';

function buildTimeBoxReactionScene() {
  return {
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'startTurn',
    player0: {
      id: '0',
      factions: ['time_travelers', 'changerbots'],
      hand: [],
      deck: [],
      discard: [],
    },
    player1: {
      id: '1',
      factions: ['aliens', 'pirates'],
      hand: [],
      deck: [],
      discard: [],
    },
    bases: [
      { defId: 'base_the_mothership', minions: [] },
      { defId: 'base_the_workshop', minions: [] },
      { defId: 'base_the_field_of_honor', minions: [] },
    ],
    extra: {
      core: {
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        turnNumber: 6,
        nextUid: 400,
        titans: [
          {
            uid: 'titan-time-box-setaside',
            defId: 'time_travelers_time_box',
            faction: 'time_travelers',
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            metadata: { timeBoxCounters: 4, timeBoxPlayArmed: true },
            location: { zone: 'setaside' },
          },
        ],
        smashupReactionSession: {
          id: 'feedback-6a1118-session',
          sourceId: 'smashup_reaction_choose',
          playerId: '0',
          mandatoryTriggers: [
            { id: 'changerbots_mergacon', playerId: '0', required: true },
          ],
        },
      },
      sys: {
        phase: 'startTurn',
        interaction: {
          current: {
            id: 'feedback-6a1118-reaction',
            kind: 'simple-choice',
            playerId: '0',
            data: {
              title: '选择一个反应动作',
              sourceId: 'smashup_reaction_choose',
              targetType: 'button',
              options: [
                {
                  id: 'trigger:onTurnStart:time_travelers_time_box:0:1',
                  label: '时间盒',
                  value: { triggerId: 'onTurnStart:time_travelers_time_box:0:1' },
                },
                {
                  id: 'pass',
                  label: '跳过',
                  value: { action: 'pass' },
                },
              ],
            },
          },
          queue: [],
        },
      },
    },
    verifyConsumption: {
      phase: 'startTurn',
      interactionId: 'feedback-6a1118-reaction',
      interactionSourceId: 'smashup_reaction_choose',
      interactionPlayerId: '0',
      visibleText: ['时间盒', '跳过'],
    },
  };
}

test.describe('线上反馈 6a1118 真实 reaction 选项证据', () => {
  test.setTimeout(120000);

  test('前中后：时间盒卡牌本体 → reaction 选项 → 选择后收口', async ({ game, page }, testInfo) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.route('**/taitan1.webp*', (route) => route.fulfill({
      path: 'public/assets/i18n/zh-CN/smashup/taitan/compressed/taitan1.webp',
    }));
    await game.openTestGame('smashup', { skipInitialization: true }, 20000);
    await game.setupScene(buildTimeBoxReactionScene());
    await hideSmashUpDebugPanelForEvidence(page);

    const titanRailCard = page.getByTestId('su-rail-titan-titan-time-box-setaside');
    const titanCounter = page.getByTestId('su-rail-titan-timebox-counter-titan-time-box-setaside');
    await expect(titanRailCard, '前态必须显示牌库旁时间盒子 Titan 本体').toBeVisible({ timeout: 10000 });
    await expect(titanCounter, '前态必须显示时间盒子计数').toHaveText('4');
    const titanImage = titanRailCard.locator('img[data-card-atlas-img]');
    await expect(titanImage, '前态必须加载时间盒子正式图集像素').toHaveCount(1, { timeout: 15000 });
    await expect.poll(async () => titanImage.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 15000 }).toBeGreaterThan(16);
    const beforeState = await game.getState();
    expect(beforeState.core.titans).toEqual(expect.arrayContaining([
      expect.objectContaining({
        uid: 'titan-time-box-setaside',
        defId: 'time_travelers_time_box',
        location: { zone: 'setaside' },
        metadata: expect.objectContaining({ timeBoxCounters: 4 }),
      }),
    ]));
    await titanRailCard.hover();
    await page.getByTestId('su-rail-titan-magnify-titan-time-box-setaside').click();
    await expect(page.getByTestId('su-card-magnify-overlay')).toBeVisible({ timeout: 5000 });
    await game.screenshot('01-前态-时间盒子放大本体与四枚计数', testInfo);
    await page.getByTestId('su-card-magnify-overlay').locator('.smashup-close-button').click();
    await expect(page.getByTestId('su-card-magnify-overlay')).toHaveCount(0);

    const consumed = await game.readSceneConsumptionSnapshot();

    const optionLabels = await page.locator('[data-testid="interaction-option"]:visible').allTextContents().catch(() => []);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('时间盒');
    expect(bodyText).toContain('跳过');
    await expect(titanRailCard, '中态仍需看到时间盒子来源 Titan 本体').toBeVisible({ timeout: 10000 });
    await expect(titanCounter, '中态仍需看到时间盒子计数').toHaveText('4');

    await game.screenshot('02-中态-时间盒子本体与时间盒跳过反应选项', testInfo);

    await game.selectOption('pass');
    await game.waitForNoInteraction(10000);
    const after = await game.readSceneConsumptionSnapshot();
    expect(after.interaction).toBeUndefined();
    expect(after.actionLogTail.length + after.eventStreamTail.length).toBeGreaterThan(0);
    await expect(titanRailCard, '后态仍需保留未使用的时间盒子来源').toBeVisible({ timeout: 10000 });
    await game.screenshot('03-后态-跳过提交后反应窗口收口', testInfo);

    console.log(JSON.stringify({
      feedbackId: '6a1118c965c7c371dcef9083',
      sourceId: 'smashup_reaction_choose',
      optionLabels,
      chainId: 'feedback-6a1118-20261006',
      stages: {
        before: '牌库旁时间盒子 Titan 本体与四枚计数',
        during: '时间盒 Titan 本体与时间盒、跳过两个 reaction 选项同时可见',
        after: '提交选项后 interaction 收口',
      },
      consumed: {
        phase: consumed.phase,
        interaction: consumed.interaction,
        responseWindow: consumed.responseWindow,
        actionLogTail: consumed.actionLogTail.slice(-5),
        eventStreamTail: consumed.eventStreamTail.slice(-5),
      },
      after: {
        interaction: after.interaction,
        actionLogTail: after.actionLogTail.slice(-5),
        eventStreamTail: after.eventStreamTail.slice(-5),
      },
    }, null, 2));
  });
});
