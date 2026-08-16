/**
 * SmashUp 响应窗口 UI 基础验证（三板斧）
 */
import { test, expect } from '../framework';

type RectLike = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>;

function overlaps(a: RectLike, b: RectLike): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function toRectLike(box: { x: number; y: number; width: number; height: number }): RectLike {
  return {
    left: box.x,
    right: box.x + box.width,
    top: box.y,
    bottom: box.y + box.height,
  };
}

test.describe('SmashUp 响应窗口 UI（三板斧）', () => {
  test('卡牌型响应应从手牌本体发起，并只允许提交到合法计分基地', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await game.openTestGame('smashup');
    await game.setupScene({
      gameId: 'smashup',
      player0: {
        hand: [
          { uid: 'hand-shinobi', defId: 'ninja_shinobi', type: 'minion' },
          { uid: 'hand-acolyte', defId: 'ninja_acolyte', type: 'minion' },
        ],
        deck: [],
        discard: [],
        factions: ['ninjas', 'pirates'],
      },
      player1: { hand: [], deck: [], discard: [], factions: ['robots', 'aliens'] },
      currentPlayer: '0',
      phase: 'scoreBases',
      bases: [
        { defId: 'base_the_mothership', breakpoint: 20, minions: [] },
        {
          defId: 'base_the_factory',
          breakpoint: 8,
          minions: [
            { uid: 'anchor-minion', defId: 'pirate_buccaneer', owner: '0', controller: '0', basePower: 8 },
          ],
        },
      ],
    });

    await page.evaluate(async () => {
      const harness = (window as any).__BG_TEST_HARNESS__;
      const state = harness.state.get();
      const frameId = 'score-before:e2e-card-response';
      await harness.state.patch({
        sys: {
          ...state.sys,
          phase: 'scoreBases',
          interaction: {
            current: {
              id: 'smashup-reaction-e2e-card-response',
              kind: 'simple-choice',
              playerId: '0',
              data: {
                sourceId: 'smashup_reaction_choose',
                title: '响应窗口',
                targetType: 'button',
                responseValidationMode: 'live',
                autoResolveIfSingle: false,
                allowedCommands: ['REACTION_PASS'],
                options: [
                  {
                    id: 'play_minion:hand-shinobi:1',
                    label: '影舞者 -> 436-1337工厂',
                    value: {
                      kind: 'play_minion',
                      playerId: '0',
                      cardUid: 'hand-shinobi',
                      baseIndex: 1,
                    },
                    displayMode: 'card',
                  },
                  {
                    id: 'pass',
                    label: '跳过',
                    value: { kind: 'pass' },
                    displayMode: 'button',
                  },
                ],
              },
            },
            queue: [],
          },
          resolution: {
            activeFrameId: frameId,
            frames: [{
              id: frameId,
              kind: 'smashup:reaction:score-before',
              ownerGame: 'smashup',
              ownerSystem: 'smashup-reaction',
              ownerToken: `smashup:reaction:${frameId}`,
              ordering: 'responder-round',
              status: 'running',
              step: 'optional',
              phase: 'scoreBases',
              phaseGate: 'block-advance-when-blocked',
              metadata: {
                smashupReactionSession: {
                  frameId,
                  frameKind: 'score-before',
                  phase: 'optional',
                  activePlayerId: '0',
                  currentPlayerId: '0',
                  consecutivePasses: 0,
                  passedPlayerIds: [],
                  sourceBaseIndex: 1,
                  responseWindowType: 'meFirst',
                },
              },
            }],
          },
          responseWindow: { current: undefined },
        },
      });
    });

    const handArea = page.getByTestId('su-hand-area');
    const playableCard = handArea.locator('[data-card-uid="hand-shinobi"]');
    const disabledCard = handArea.locator('[data-card-uid="hand-acolyte"]');
    const invalidBase = page.getByTestId('base-zone-0');
    const scoringBase = page.getByTestId('base-zone-1');

    await expect(playableCard).toBeVisible({ timeout: 10000 });
    await expect(disabledCard).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('su-reaction-pass-button')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('su-reaction-hand-status')).toContainText('点高亮手牌响应', { timeout: 10000 });
    await expect(page.locator('[data-option-id^="play_minion:hand-shinobi"]')).toHaveCount(0);
    await expect(playableCard).toHaveAttribute('data-highlighted', 'true');
    await expect(disabledCard).toHaveAttribute('data-disabled', 'true');

    await expect.poll(async () => {
      return await disabledCard.evaluate((el) => el.querySelector('.opacity-40') !== null);
    }, { timeout: 10000 }).toBe(true);
    await expect.poll(async () => {
      return await playableCard.evaluate((el) => el.textContent !== null && el.querySelector('.opacity-40') === null);
    }, { timeout: 10000 }).toBe(true);

    await game.screenshot('大杀四方响应窗口-手牌本体承接响应', testInfo);

    await disabledCard.click({ force: true });
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        currentInteraction: state.sys.interaction?.current?.id ?? null,
        hand: state.core.players['0'].hand.map((card: any) => card.uid),
        base0: state.core.bases[0].minions.map((minion: any) => minion.uid),
        base1: state.core.bases[1].minions.map((minion: any) => minion.uid),
      };
    }).toEqual({
      currentInteraction: 'smashup-reaction-e2e-card-response',
      hand: ['hand-shinobi', 'hand-acolyte'],
      base0: [],
      base1: ['anchor-minion'],
    });

    await playableCard.click({ force: true });
    await expect(playableCard).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('su-reaction-hand-status')).toContainText('点高亮目标打出响应牌');
    await expect(scoringBase).toHaveAttribute('data-deploy-mode', 'true');
    await expect(scoringBase).toHaveAttribute('data-dimmed', 'false');
    await expect(invalidBase).toHaveAttribute('data-deploy-mode', 'false');
    await expect(invalidBase).toHaveAttribute('data-dimmed', 'true');

    await game.screenshot('大杀四方响应窗口-选中手牌后合法基地高亮', testInfo);

    await invalidBase.click({ force: true });
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        currentInteraction: state.sys.interaction?.current?.id ?? null,
        hand: state.core.players['0'].hand.map((card: any) => card.uid),
        base0: state.core.bases[0].minions.map((minion: any) => minion.uid),
        base1: state.core.bases[1].minions.map((minion: any) => minion.uid),
      };
    }).toEqual({
      currentInteraction: 'smashup-reaction-e2e-card-response',
      hand: ['hand-shinobi', 'hand-acolyte'],
      base0: [],
      base1: ['anchor-minion'],
    });

    await game.screenshot('大杀四方响应窗口-无关基地不可提交', testInfo);

    await scoringBase.click({ force: true });
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        hand: state.core.players['0'].hand.map((card: any) => card.uid),
        base0: state.core.bases[0].minions.map((minion: any) => minion.uid),
        base1: state.core.bases[1].minions.map((minion: any) => minion.uid),
      };
    }, { timeout: 10000 }).toEqual({
      hand: ['hand-acolyte'],
      base0: [],
      base1: ['anchor-minion', 'hand-shinobi'],
    });
    await expect(handArea.locator('[data-card-uid="hand-shinobi"]')).toHaveCount(0);
    await page.waitForTimeout(500);

    await game.screenshot('大杀四方响应窗口-合法基地完成打出', testInfo);
  });

  test('注入 responseWindow 后状态应可见且可被读取', async ({ game }, testInfo) => {
    await game.openTestGame('smashup');
    await game.setupScene({
      gameId: 'smashup',
      player0: { hand: [], deck: [], discard: [], factions: ['aliens', 'robots'] },
      player1: { hand: [], deck: [], discard: [], factions: ['ninjas', 'pirates'] },
      currentPlayer: '0',
      phase: 'playCards',
      responseWindow: {
        windowType: 'afterPlayAction',
        sourceId: 'test_response_window',
        responderQueue: ['0', '1'],
        currentResponderIndex: 0,
      },
    });

    const state = await game.getState();
    expect(state?.sys?.responseWindow?.current?.windowType).toBe('afterPlayAction');
    expect(state?.sys?.responseWindow?.current?.sourceId).toBe('test_response_window');

    await game.screenshot('response-window-ui-state-visible', testInfo);
  });

  test('对手响应等待提示应在顶部，不遮挡中间交互按钮', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await game.openTestGame('smashup', { players: 2, seat0: 'human', seat1: 'human' });
    await game.setupScene({
      gameId: 'smashup',
      player0: { hand: [], deck: [], discard: [], factions: ['aliens', 'robots'] },
      player1: { hand: [], deck: [], discard: [], factions: ['ninjas', 'pirates'] },
      currentPlayer: '0',
      phase: 'playCards',
      bases: [
        { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        { defId: 'base_tortuga', minions: [], ongoingActions: [] },
      ],
    });

    await page.evaluate(async () => {
      const harness = (window as any).__BG_TEST_HARNESS__;
      const state = harness.state.get();
      await harness.state.patch({
        sys: {
          ...state.sys,
          phase: 'playCards',
          interaction: {
            current: {
              id: 'score-base-choice',
              kind: 'simple-choice',
              playerId: '0',
              data: {
                sourceId: 'multi_base_scoring',
                title: '选择计分基地',
                options: [
                  { id: 'score-base-tortuga', label: '托尔图加', value: { baseIndex: 1, baseDefId: 'base_tortuga' } },
                ],
              },
            },
            queue: [],
          },
          responseWindow: {
            current: {
              id: 'ui-waiting-response-window',
              windowType: 'afterScoring',
              sourceId: 'scoreBases',
              responderQueue: ['0', '1'],
              currentResponderIndex: 1,
              passedPlayers: [],
            },
          },
          resolution: {
            activeFrameId: 'ui-waiting-frame',
            frames: [{
              id: 'ui-waiting-frame',
              kind: 'smashup:reaction:score-after',
              ownerGame: 'smashup',
              ownerSystem: 'smashup-reaction',
              ownerToken: 'ui-waiting-frame',
              ordering: 'responder-round',
              status: 'running',
              step: 'optional',
              phase: 'playCards',
              phaseGate: 'block-advance-when-blocked',
              metadata: {
                smashupReactionSession: {
                  frameId: 'ui-waiting-frame',
                  frameKind: 'score-after',
                  phase: 'optional',
                  activePlayerId: '1',
                  currentPlayerId: '0',
                  consecutivePasses: 0,
                  passedPlayerIds: [],
                  responseWindowType: 'afterScoring',
                },
              },
            }],
          },
        },
      });
    });

    const waitingShell = page.getByTestId('me-first-waiting-shell');
    const centerButton = page.locator('[data-option-id="score-base-tortuga"]').first();
    await expect(waitingShell).toBeVisible({ timeout: 10000 });
    await expect(centerButton).toBeVisible({ timeout: 10000 });

    const waitingBox = await waitingShell.boundingBox();
    const buttonBox = await centerButton.boundingBox();
    const viewport = page.viewportSize();
    expect(waitingBox, '等待提示必须有真实可见矩形').toBeTruthy();
    expect(buttonBox, '中间按钮必须有真实可见矩形').toBeTruthy();
    expect(viewport, '测试必须锁定视口尺寸').toBeTruthy();
    const geometry = {
      waiting: toRectLike(waitingBox!),
      button: toRectLike(buttonBox!),
      viewport: viewport!,
    };

    expect(geometry.waiting.top, '等待提示应位于屏幕上方槽位').toBeLessThan(geometry.viewport.height * 0.25);
    expect(geometry.waiting.bottom, '等待提示底部必须在中间按钮上方留出间距').toBeLessThan(geometry.button.top - 12);
    expect(overlaps(geometry.waiting, geometry.button), '等待提示不能覆盖中间按钮').toBe(false);

    await game.screenshot('opponent-response-waiting-banner-top-not-covering-center-button', testInfo);
    await centerButton.click();
  });
});
