import { describe, expect, it } from 'vitest';
import type { BetrayalCore, BetrayalDiscoverySummary } from '../game';
import { resolveEventRollConfirmationPresentation } from '../recentRollPresentation';
import {
  buildLatestDiscoveryDisplayEntry,
  removeBetrayalLatestDiscoveryQueueEntry,
  resolveBetrayalLatestDiscoveryPanelPresentation,
  resolveBetrayalLatestDiscoveryQueueAfterCurrentEntry,
  resolveBetrayalLatestDiscoverySelectionPresentation,
  type LatestDiscoveryDisplayEntry,
} from '../latestDiscoveryPresentation';

const discovery = (
  kind: BetrayalDiscoverySummary['kind'],
  title: string,
): BetrayalDiscoverySummary => ({
  kind,
  title,
  summary: '',
  detail: '',
});

const entry = (
  key: string,
  sourceKey: string,
  discoveryValue: BetrayalDiscoverySummary,
  ownerPlayerId: string,
): LatestDiscoveryDisplayEntry => ({
  key,
  sourceKey,
  discovery: discoveryValue,
  ownerPlayerId,
  recentRoll: null,
});

describe('latest discovery presentation', () => {
  it('事件骰确认名单以 pending 快照为准，不因缺少 seatControllers 把 AI 座位重新算进来', () => {
    const core = {
      playerIds: ['0', '1', '2', '3'],
      pendingEventRollResolution: {
        rollId: 'small-robot-roll',
        playerId: '3',
        sourceTitle: '小机器人',
        effect: { mode: 'trait', trait: 'knowledge', amount: 1 },
        requiredPlayerIds: ['0'],
        acknowledgedPlayerIds: ['0'],
        requiresAcknowledgement: true,
      },
    } as unknown as BetrayalCore;

    const presentation = resolveEventRollConfirmationPresentation(core, '0');

    expect(presentation.requiredPlayerIds).toEqual(['0']);
    expect(presentation.acknowledgedPlayerIds).toEqual(['0']);
    expect(presentation.confirmedCount).toBe(1);
    expect(presentation.totalCount).toBe(1);
    expect(presentation.viewerHasAcknowledged).toBe(true);
    expect(presentation.canViewerAcknowledge).toBe(false);
  });

  it('removes queued discovery entries by stable source key', () => {
    const queued = [
      entry(
        '0::event::标本剥制::old-log',
        '0::event::标本剥制',
        discovery('event', '标本剥制'),
        '0',
      ),
    ];

    expect(
      removeBetrayalLatestDiscoveryQueueEntry(queued, '0::event::标本剥制'),
    ).toEqual([]);
  });

  it('无发现符号且没有房间效果时不生成发现弹窗', () => {
    const core = {
      latestDiscovery: {
        kind: 'none',
        title: '洗衣滑槽',
        summary: '无发现符号',
        detail: '没有事件、物品或预兆发现牌',
        tone: 'neutral',
        resolutionSteps: [],
      },
      latestDiscoveryOwnerPlayerId: '0',
      activityLog: [{ id: 'room-log', text: '探索到洗衣滑槽', tone: 'neutral' }],
    } as unknown as BetrayalCore;

    expect(buildLatestDiscoveryDisplayEntry(core)).toBeNull();
  });

  it('drops stale queued entries when the current discovery source is already dismissed', () => {
    const queued = [
      entry(
        '0::event::标本剥制::old-log',
        '0::event::标本剥制',
        discovery('event', '标本剥制'),
        '0',
      ),
    ];
    const currentEntry = entry(
      '0::event::标本剥制::new-log',
      '0::event::标本剥制',
      discovery('event', '标本剥制'),
      '0',
    );

    expect(
      resolveBetrayalLatestDiscoveryQueueAfterCurrentEntry({
        core: {} as BetrayalCore,
        currentEntry,
        queue: queued,
        dismissedLatestDiscoveryKey: currentEntry.key,
        dismissedLatestDiscoveryKeys: new Set(),
      }),
    ).toEqual([]);
  });

  it('foregrounds the current pending card resolution instead of an older queued card', () => {
    const oldEvent = entry(
      '0::event::标本剥制::old-log',
      '0::event::标本剥制',
      discovery('event', '标本剥制'),
      '0',
    );
    const dog = entry(
      '2::omen::狗::haunt-roll',
      '2::omen::狗',
      discovery('omen', '狗'),
      '2',
    );

    const core = {
      recentRoll: null,
      pendingCardResolutionQueue: [
        {
          id: 'dog-resolution',
          playerId: '2',
          requiredPlayerIds: ['2'],
          acknowledgedPlayerIds: [],
          deckKind: 'omen',
          cardId: 'dog-2',
          cardName: '狗',
          discoveryTitle: '狗',
          stepKind: 'drawn-card',
          text: '已加入持有区：狗',
          index: 1,
          total: 1,
        },
      ],
    } as unknown as BetrayalCore;

    const selection = resolveBetrayalLatestDiscoverySelectionPresentation({
      core,
      currentEntry: dog,
      queue: [oldEvent],
      dismissedLatestDiscoveryKey: null,
      dismissedLatestDiscoveryKeys: new Set(),
    });

    expect(selection.entry?.discovery.title).toBe('狗');
    expect(selection.ownerPlayerId).toBe('2');
  });

  it('builds the foreground entry from the pending card when latest discovery is stale', () => {
    const oldEvent = entry(
      '0::event::标本剥制::old-log',
      '0::event::标本剥制',
      discovery('event', '标本剥制'),
      '0',
    );
    const core = {
      latestDiscovery: {
        ...discovery('event', '标本剥制'),
        summary: '旧事件结果',
        detail: '旧事件已经处理',
        tone: 'warning',
      },
      latestDiscoveryOwnerPlayerId: '0',
      turnEndedByDiscovery: true,
      recentRoll: {
        id: 'dog-haunt-roll',
        kind: 'hauntRoll',
        playerId: '2',
        sourceTitle: '狗',
        rollLabel: '作祟检定',
        dice: [0, 0, 0],
        passiveBonus: 0,
        latestLabel: '未触发作祟',
        consumedRabbitFootCardIds: [],
      },
      activityLog: [{ id: 'dog-log', text: '队友 2 翻出狗', tone: 'accent' }],
      pendingCardResolutionQueue: [
        {
          id: 'dog-resolution',
          playerId: '2',
          requiredPlayerIds: ['2'],
          acknowledgedPlayerIds: [],
          deckKind: 'omen',
          cardId: 'dog-2',
          cardName: '狗',
          discoveryTitle: '狗',
          stepKind: 'drawn-card',
          text: '已加入持有区：狗；作祟检定：未触发作祟',
          index: 1,
          total: 1,
        },
      ],
    } as unknown as BetrayalCore;

    const currentEntry = buildLatestDiscoveryDisplayEntry(core);
    const selection = resolveBetrayalLatestDiscoverySelectionPresentation({
      core,
      currentEntry,
      queue: [oldEvent],
      dismissedLatestDiscoveryKey: null,
      dismissedLatestDiscoveryKeys: new Set(),
    });
    const panel = resolveBetrayalLatestDiscoveryPanelPresentation({
      core,
      selection,
      dismissedLatestDiscoveryKey: null,
      dismissedRecentRollId: null,
      viewerPlayerId: '0',
      inventoryActionPlayerId: '0',
       hasRecentRollModifier: false,
       isConfirmedExorciseRoll: false,
      pendingEventChoice: null,
      shouldShowHauntRevealCue: false,
      shouldPauseHauntBoardActions: false,
      scenarioReaderOpen: false,
      shouldShowScenarioStartOpening: false,
      latestDiscoverySearchRevealIndex: 0,
      eventRollConfirmation: {
        requiredPlayerIds: [],
        acknowledgedPlayerIds: [],
        confirmedCount: 0,
        totalCount: 0,
        viewerHasAcknowledged: false,
        canViewerAcknowledge: false,
      },
      isRecentRollReadable: true,
      t: (key, params) => {
        if (key === 'board.discovery.waitingForCardConfirmation') {
          return `等待确认 ${params?.confirmed}/${params?.total}`;
        }
        return key;
      },
    });

    expect(currentEntry?.discovery.title).toBe('狗');
    expect(currentEntry?.sourceKey).toBe('2::omen::狗');
    expect(selection.entry?.discovery.title).toBe('狗');
    expect(selection.entry?.recentRoll?.kind).toBe('hauntRoll');
    expect(panel.shouldShow).toBe(true);
    expect(panel.displayedTitle).toBe('狗');
    expect(panel.pendingCardResolution?.id).toBe('dog-resolution');
    expect(panel.continueButton.pendingCardResolutionId).toBe('dog-resolution');
    expect(panel.continueButton.cardResolutionRequiredCount).toBe(1);
    expect(panel.continueButton.disabled).toBe(true);
    expect(panel.continueButton.label).toBe('等待确认 0/1');
  });

  it('让预兆牌发起者也看到与事件投骰一致的确认进度', () => {
    const currentDiscovery = discovery('omen', '书本');
    const currentEntry = entry(
      '0::omen::书本::omen-resolution',
      '0::omen::书本',
      currentDiscovery,
      '0',
    );
    const panel = resolveBetrayalLatestDiscoveryPanelPresentation({
      core: {
        playerIds: ['0', '1', '2'],
        latestDiscovery: currentDiscovery,
        latestDiscoveryOwnerPlayerId: '0',
        pendingCardResolutionQueue: [{
          id: 'omen-resolution',
          playerId: '0',
          requiredPlayerIds: ['0', '1', '2'],
          acknowledgedPlayerIds: [],
          deckKind: 'omen',
          cardId: 'omen-book',
          cardName: '书本',
          discoveryTitle: '书本',
          stepKind: 'drawn-card',
          text: '已加入持有区：书本',
          index: 1,
          total: 1,
        }],
      } as unknown as BetrayalCore,
      selection: {
        queuedEntry: null,
        visibleCurrentEntry: currentEntry,
        entry: currentEntry,
        discovery: currentDiscovery,
        recentRoll: null,
        ownerPlayerId: '0',
        key: currentEntry.key,
        coreRecentRollDisplayKey: null,
        recentRollDisplayKey: null,
      },
      dismissedLatestDiscoveryKey: null,
      dismissedRecentRollId: null,
      viewerPlayerId: '0',
      inventoryActionPlayerId: '0',
      hasRecentRollModifier: false,
      isConfirmedExorciseRoll: false,
      pendingEventChoice: null,
      shouldShowHauntRevealCue: false,
      shouldPauseHauntBoardActions: false,
      scenarioReaderOpen: false,
      shouldShowScenarioStartOpening: false,
      latestDiscoverySearchRevealIndex: 0,
      eventRollConfirmation: {
        requiredPlayerIds: [],
        acknowledgedPlayerIds: [],
        confirmedCount: 0,
        totalCount: 0,
        viewerHasAcknowledged: false,
        canViewerAcknowledge: false,
      },
      isRecentRollReadable: true,
      t: (key, params) => {
        if (key === 'board.discovery.confirmWithProgress') {
          return `确认 ${params?.confirmed}/${params?.total}`;
        }
        return key;
      },
    });

    expect(panel.continueButton.label).toBe('确认 0/3');
    expect(panel.continueButton.cardResolutionConfirmedCount).toBe(0);
    expect(panel.continueButton.cardResolutionRequiredCount).toBe(3);
  });

  it('keeps item and omen discovery visible until every required player acknowledges it', () => {
    const currentDiscovery = discovery('item', '手电筒');
    const currentEntry = entry(
      '0::item::手电筒::item-resolution',
      '0::item::手电筒',
      currentDiscovery,
      '0',
    );
    const baseResolution = {
      id: 'item-resolution',
      playerId: '0',
      requiredPlayerIds: ['0', '1', '2'],
      acknowledgedPlayerIds: ['0'],
      deckKind: 'item',
      cardId: 'flashlight',
      cardName: '手电筒',
      discoveryTitle: '手电筒',
      stepKind: 'drawn-card',
      text: '已加入持有区：手电筒',
      index: 1,
      total: 1,
      processCards: [
        {
          cardId: 'flashlight',
          cardName: '手电筒',
          deckKind: 'item',
          outcome: 'gained',
          text: '获得手电筒',
        },
      ],
    } as const;

    const createPanel = (
      acknowledgedPlayerIds: string[],
      viewerPlayerId: string,
    ) =>
      resolveBetrayalLatestDiscoveryPanelPresentation({
        core: {
          playerIds: ['0', '1', '2'],
          latestDiscovery: currentDiscovery,
          latestDiscoveryOwnerPlayerId: '0',
          pendingCardResolutionQueue: [
            {
              ...baseResolution,
              acknowledgedPlayerIds,
            },
          ],
        } as unknown as BetrayalCore,
        selection: {
          queuedEntry: null,
          visibleCurrentEntry: currentEntry,
          entry: currentEntry,
          discovery: currentDiscovery,
          recentRoll: null,
          ownerPlayerId: '0',
          key: currentEntry.key,
          coreRecentRollDisplayKey: null,
          recentRollDisplayKey: null,
        },
        dismissedLatestDiscoveryKey: null,
        dismissedRecentRollId: null,
        viewerPlayerId,
        inventoryActionPlayerId: viewerPlayerId,
         hasRecentRollModifier: false,
         isConfirmedExorciseRoll: false,
        pendingEventChoice: null,
        shouldShowHauntRevealCue: false,
        shouldPauseHauntBoardActions: false,
        scenarioReaderOpen: false,
        shouldShowScenarioStartOpening: false,
        latestDiscoverySearchRevealIndex: 0,
        eventRollConfirmation: {
          requiredPlayerIds: [],
          acknowledgedPlayerIds: [],
          confirmedCount: 0,
          totalCount: 0,
          viewerHasAcknowledged: false,
          canViewerAcknowledge: false,
        },
        isRecentRollReadable: true,
        t: (key, params) => {
          if (key === 'board.discovery.waitingForCardConfirmation') {
            return `等待确认 ${params?.confirmed}/${params?.total}`;
          }
          if (key === 'board.discovery.confirmedWithProgress') {
            return `已确认 ${params?.confirmed}/${params?.total}`;
          }
          return key;
        },
      });

    expect(createPanel(['0'], '0').shouldShow).toBe(true);
    expect(createPanel(['0', '1'], '1').shouldShow).toBe(true);
    expect(createPanel(['0', '1', '2'], '2').shouldShow).toBe(false);
  });

  it('restores a dismissed event roll after undo while the viewer is still required', () => {
    const currentDiscovery = discovery('event', '地狱蝙蝠');
    const recentRoll = {
      id: 'event-dice-roll',
      kind: 'eventDiceRoll',
      playerId: '4',
      sourceTitle: '地狱蝙蝠',
      rollLabel: '速度骰',
      dice: [0, 2, 2],
      passiveBonus: 0,
      latestLabel: '总点数 4',
      consumedRabbitFootCardIds: [],
      requiredPlayerIds: ['0', '1', '2', '3'],
      acknowledgedPlayerIds: ['1', '2', '3'],
    } as unknown as BetrayalCore['recentRoll'];
    const core = {
      playerIds: ['0', '1', '2', '3', '4'],
      latestDiscovery: currentDiscovery,
      latestDiscoveryOwnerPlayerId: '4',
      recentRoll,
      activityLog: [{ id: 'event-log', text: '地狱蝙蝠', tone: 'accent' }],
      pendingCardResolutionQueue: [],
      pendingEventChoice: null,
      pendingEventRollStart: null,
      pendingEventRollResolution: {
        rollId: recentRoll.id,
        playerId: '4',
        sourceTitle: '地狱蝙蝠',
        effect: { mode: 'none' },
        requiredPlayerIds: ['0', '1', '2', '3'],
        acknowledgedPlayerIds: ['1', '2', '3'],
        requiresAcknowledgement: true,
      },
      turnEndedByDiscovery: true,
    } as unknown as BetrayalCore;
    const currentEntry = buildLatestDiscoveryDisplayEntry(core);
    expect(currentEntry).not.toBeNull();

    const selection = resolveBetrayalLatestDiscoverySelectionPresentation({
      core,
      currentEntry,
      queue: [],
      dismissedLatestDiscoveryKey: currentEntry!.key,
      dismissedLatestDiscoveryKeys: new Set([currentEntry!.key]),
    });
    const panel = resolveBetrayalLatestDiscoveryPanelPresentation({
      core,
      selection,
      dismissedLatestDiscoveryKey: currentEntry!.key,
      dismissedRecentRollId: null,
      viewerPlayerId: '0',
      inventoryActionPlayerId: '0',
      hasRecentRollModifier: false,
      isConfirmedExorciseRoll: false,
      pendingEventChoice: null,
      shouldShowHauntRevealCue: false,
      shouldPauseHauntBoardActions: false,
      scenarioReaderOpen: false,
      shouldShowScenarioStartOpening: false,
      latestDiscoverySearchRevealIndex: 0,
      eventRollConfirmation: {
        requiredPlayerIds: ['0', '1', '2', '3'],
        acknowledgedPlayerIds: ['1', '2', '3'],
        confirmedCount: 3,
        totalCount: 4,
        viewerHasAcknowledged: false,
        canViewerAcknowledge: true,
      },
      isRecentRollReadable: true,
      t: (key, params) =>
        key === 'board.discovery.confirmWithProgress'
          ? `确认 ${params?.confirmed}/${params?.total}`
          : key,
    });

    expect(selection.entry?.key).toBe(currentEntry!.key);
    expect(panel.shouldShow).toBe(true);
    expect(panel.continueButton.disabled).toBe(false);
    expect(panel.continueButton.eventRollConfirmedCount).toBe(3);
    expect(panel.continueButton.eventRollRequiredCount).toBe(4);
  });

  it('keeps table chrome visible after a resolved event roll review', () => {
    const currentDiscovery = discovery('event', '地下回声');
    const recentRoll = {
      id: 'event-trait-roll',
      kind: 'eventTraitCheck',
      playerId: '0',
      sourceTitle: '地下回声',
      trait: 'knowledge',
      rollLabel: '知识检定',
      dice: [3],
      passiveBonus: 0,
      latestLabel: '检定成功',
      consumedRabbitFootCardIds: [],
    } as unknown as BetrayalCore['recentRoll'];
    const core = {
      playerIds: ['0'],
      latestDiscovery: currentDiscovery,
      latestDiscoveryOwnerPlayerId: '0',
      recentRoll,
      activityLog: [{ id: 'event-log', text: '地下回声', tone: 'accent' }],
      pendingCardResolutionQueue: [],
      pendingEventChoice: null,
      pendingEventRollStart: null,
      pendingEventRollResolution: null,
      turnEndedByDiscovery: true,
    } as unknown as BetrayalCore;
    const currentEntry = buildLatestDiscoveryDisplayEntry(core);
    const selection = resolveBetrayalLatestDiscoverySelectionPresentation({
      core,
      currentEntry,
      queue: [],
      dismissedLatestDiscoveryKey: null,
      dismissedLatestDiscoveryKeys: new Set(),
    });
    const panel = resolveBetrayalLatestDiscoveryPanelPresentation({
      core,
      selection,
      dismissedLatestDiscoveryKey: null,
      dismissedRecentRollId: null,
      viewerPlayerId: '0',
      inventoryActionPlayerId: '0',
      hasRecentRollModifier: false,
      isConfirmedExorciseRoll: false,
      pendingEventChoice: null,
      shouldShowHauntRevealCue: false,
      shouldPauseHauntBoardActions: false,
      scenarioReaderOpen: false,
      shouldShowScenarioStartOpening: false,
      latestDiscoverySearchRevealIndex: 0,
      eventRollConfirmation: {
        requiredPlayerIds: [],
        acknowledgedPlayerIds: [],
        confirmedCount: 0,
        totalCount: 0,
        viewerHasAcknowledged: false,
        canViewerAcknowledge: false,
      },
      isRecentRollReadable: true,
      t: (key) => key,
    });

    expect(panel.shouldShow).toBe(false);
    expect(panel.shouldShowRecentRollReview).toBe(true);
    expect(panel.shouldHideTableChromeForBlockingOverlay).toBe(false);
  });

  it('keeps the table chrome open while event damage is shown as an independent roll', () => {
    const currentDiscovery = discovery('event', '摇曳灯光');
    const recentRoll = {
      id: 'event-damage-roll',
      kind: 'eventRolledDamage',
      playerId: '0',
      sourceTitle: '摇曳灯光',
      rollLabel: '事件伤害骰',
      dice: [2],
      passiveBonus: 0,
      latestLabel: '造成 2 点精神伤害',
      consumedRabbitFootCardIds: [],
      eventRolledDamageResults: [
        {
          damageKind: 'mental',
          rolls: [2],
          total: 2,
          appliedAmount: 2,
        },
      ],
    } as unknown as BetrayalCore['recentRoll'];
    const core = {
      playerIds: ['0'],
      latestDiscovery: currentDiscovery,
      latestDiscoveryOwnerPlayerId: '0',
      recentRoll,
      activityLog: [{ id: 'event-log', text: '摇曳灯光', tone: 'accent' }],
      pendingCardResolutionQueue: [],
      pendingEventChoice: null,
      pendingEventRollResolution: null,
      turnEndedByDiscovery: false,
    } as unknown as BetrayalCore;
    const currentEntry = buildLatestDiscoveryDisplayEntry(core);
    const selection = resolveBetrayalLatestDiscoverySelectionPresentation({
      core,
      currentEntry,
      queue: [],
      dismissedLatestDiscoveryKey: null,
      dismissedLatestDiscoveryKeys: new Set(),
    });

    const panel = resolveBetrayalLatestDiscoveryPanelPresentation({
      core,
      selection,
      dismissedLatestDiscoveryKey: null,
      dismissedRecentRollId: null,
      viewerPlayerId: '0',
      inventoryActionPlayerId: '0',
       hasRecentRollModifier: false,
       isConfirmedExorciseRoll: false,
      pendingEventChoice: null,
      shouldShowHauntRevealCue: false,
      shouldPauseHauntBoardActions: false,
      scenarioReaderOpen: false,
      shouldShowScenarioStartOpening: false,
      latestDiscoverySearchRevealIndex: 0,
      eventRollConfirmation: {
        requiredPlayerIds: [],
        acknowledgedPlayerIds: [],
        confirmedCount: 0,
        totalCount: 0,
        viewerHasAcknowledged: false,
        canViewerAcknowledge: false,
      },
      isRecentRollReadable: true,
      t: (key) => key,
    });

    expect(panel.shouldDisplayEventRolledDamageAsIndependentRoll).toBe(true);
    expect(panel.shouldShow).toBe(false);
    expect(panel.shouldKeepTableChromeOpenForEventResult).toBe(true);
    expect(panel.shouldHideTableChromeForBlockingOverlay).toBe(false);
  });

  it('keeps the spider discovery visible while the event roll awaits acknowledgement', () => {
    const currentDiscovery: BetrayalDiscoverySummary = {
      kind: 'event',
      title: '蜘蛛！',
      summary: '结果已公开',
      detail: '神志检定 8：获得 1 点神志或速度，并放置到相邻板块；神志 +1；放置到相邻板块',
    };
    const core = {
      playerIds: ['0'],
      latestDiscovery: currentDiscovery,
      latestDiscoveryOwnerPlayerId: '0',
      recentRoll: {
        id: 'spider-roll',
        kind: 'eventTraitCheck',
        playerId: '0',
        sourceTitle: '蜘蛛！',
        trait: 'sanity',
        rollLabel: '神志检定',
        dice: [2, 2, 2, 2],
        passiveBonus: 0,
        latestLabel: '获得 1 点神志或速度，并放置到相邻板块',
        consumedRabbitFootCardIds: [],
      },
      pendingEventChoice: null,
      pendingEventRollStart: null,
      pendingEventRollResolution: {
        rollId: 'spider-roll',
        playerId: '0',
        sourceTitle: '蜘蛛！',
        effect: {
          mode: 'compound',
          recommendedAction: 'explore',
          effects: [],
        },
        requiredPlayerIds: ['0'],
        acknowledgedPlayerIds: [],
        nextPendingEventChoice: {
          id: 'spider-choice',
          playerId: '0',
          sourceTitle: '蜘蛛！',
          effect: {
            mode: 'compound',
            recommendedAction: 'explore',
            effects: [],
          },
        },
      },
      pendingCardResolutionQueue: [],
      activityLog: [{ id: 'spider-log', text: '蜘蛛！', tone: 'accent' }],
      turnEndedByDiscovery: true,
    } as unknown as BetrayalCore;
    const currentEntry = buildLatestDiscoveryDisplayEntry(core);
    const selection = resolveBetrayalLatestDiscoverySelectionPresentation({
      core,
      currentEntry,
      queue: [],
      dismissedLatestDiscoveryKey: null,
      dismissedLatestDiscoveryKeys: new Set(),
    });

    const panel = resolveBetrayalLatestDiscoveryPanelPresentation({
      core,
      selection,
      dismissedLatestDiscoveryKey: null,
      dismissedRecentRollId: null,
      viewerPlayerId: '0',
      inventoryActionPlayerId: '0',
      hasRecentRollModifier: false,
      isConfirmedExorciseRoll: false,
      pendingEventChoice: null,
      shouldShowHauntRevealCue: false,
      shouldPauseHauntBoardActions: false,
      scenarioReaderOpen: false,
      shouldShowScenarioStartOpening: false,
      latestDiscoverySearchRevealIndex: 0,
      eventRollConfirmation: {
        requiredPlayerIds: ['0'],
        acknowledgedPlayerIds: [],
        confirmedCount: 0,
        totalCount: 1,
        viewerHasAcknowledged: false,
        canViewerAcknowledge: true,
      },
      isRecentRollReadable: true,
      t: (key) => key,
    });

    expect(panel.shouldAutoReturnAfterLatestDiscovery).toBe(false);
    expect(panel.shouldShow).toBe(true);
    expect(panel.shouldShowRoll).toBe(true);
  });
});
