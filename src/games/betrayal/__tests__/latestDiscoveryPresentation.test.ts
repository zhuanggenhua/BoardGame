import { describe, expect, it } from 'vitest';
import type { BetrayalCore, BetrayalDiscoverySummary } from '../game';
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
      pendingEventChoice: null,
      shouldShowHauntRevealCue: false,
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
});
