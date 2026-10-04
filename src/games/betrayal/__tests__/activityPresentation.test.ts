import { describe, expect, it } from 'vitest';
import type { BetrayalCore } from '../game';
import {
  resolveBetrayalActivityPresentation,
  resolveBetrayalTraitDeltas,
} from '../activityPresentation';

describe('betrayal activity presentation', () => {
  it('统一提取属性增减，覆盖加属性和扣属性', () => {
    expect(resolveBetrayalTraitDeltas(
      { might: 4, speed: 3, knowledge: 2, sanity: 5 },
      { might: 3, speed: 4, knowledge: 2, sanity: 4 },
    )).toEqual([
      { trait: 'might', amount: -1 },
      { trait: 'speed', amount: 1 },
      { trait: 'sanity', amount: -1 },
    ]);
  });

  it('纯属性事件结算显示实体浮字数据，不要求卡牌特写', () => {
    const core = {
      currentExplorer: {
        playerId: '0',
        displayName: '测试玩家',
        traits: { might: 3, speed: 3, knowledge: 4, sanity: 3 },
      },
      latestDiscovery: { kind: 'event', title: '外星几何' },
      recentRoll: {
        kind: 'eventTraitCheck',
        playerId: '0',
        sourceTitle: '外星几何',
        latestLabel: '获得 1 点知识',
        branchThresholds: [{
          label: '获得 1 点知识',
          effect: { mode: 'trait', amount: 1, trait: 'knowledge' },
        }],
        eventEffectSnapshot: {
          traitsBeforeEffect: { might: 3, speed: 3, knowledge: 3, sanity: 3 },
        },
      },
      activityLog: [{ id: 'event-log', text: '外星几何结算', tone: 'accent' }],
    } as unknown as BetrayalCore;

    const presentation = resolveBetrayalActivityPresentation({
      core,
      text: () => '',
    });

    expect(presentation.visibleBoardResultFeedback).toMatchObject({
      kind: 'traitChange',
      targetPlayerId: '0',
      deltaText: '+1 知识',
    });
  });
});
