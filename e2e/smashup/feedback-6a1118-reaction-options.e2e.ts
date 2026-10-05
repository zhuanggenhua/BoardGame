import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';

test.describe('线上反馈 6a1118 真实 reaction 选项证据', () => {
  test.setTimeout(120000);

  test('真实页面应显示 time_travelers_time_box 与 pass 两个选项', async ({ game, page }, testInfo) => {
    await game.openTestGame('smashup', { skipInitialization: true }, 20000);
    await game.setupScene({
      gameId: 'smashup',
      player0: {
        factions: ['time_travelers', 'changerbots'],
        hand: [{ uid: 'feedback-6a1118-hand', defId: 'time_travelers_time_box', type: 'action', owner: '0' }],
      },
      player1: {
        factions: ['aliens', 'pirates'],
        hand: [],
      },
      bases: [
        { defId: 'base_the_mothership', minions: [] },
        { defId: 'base_the_workshop', minions: [] },
        { defId: 'base_the_field_of_honor', minions: [] },
      ],
      currentPlayer: '0',
      phase: 'startTurn',
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
      extra: {
        core: {
          triggerQueue: [],
          smashupReactionSession: {
            id: 'feedback-6a1118-session',
            sourceId: 'smashup_reaction_choose',
            playerId: '0',
            mandatoryTriggers: [
              { id: 'changerbots_mergacon', playerId: '0', required: true },
            ],
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
    });

    const consumed = await game.readSceneConsumptionSnapshot();

    const optionLabels = await page.locator('[data-testid="interaction-option"]:visible').allTextContents().catch(() => []);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('时间盒');
    expect(bodyText).toContain('跳过');

    const screenshotPath = getEvidenceScreenshotPath(testInfo, '6a1118-reaction-options-visible', {
      filename: '时间盒与跳过反应选项.png',
      requireChineseName: true,
    });
    await page.screenshot({ path: screenshotPath, fullPage: true, type: 'png' });

    console.log(JSON.stringify({
      feedbackId: '6a1118c965c7c371dcef9083',
      sourceId: 'smashup_reaction_choose',
      optionLabels,
      consumed: {
        phase: consumed.phase,
        interaction: consumed.interaction,
        responseWindow: consumed.responseWindow,
        actionLogTail: consumed.actionLogTail.slice(-5),
        eventStreamTail: consumed.eventStreamTail.slice(-5),
      },
      screenshotPath,
    }, null, 2));
  });
});
