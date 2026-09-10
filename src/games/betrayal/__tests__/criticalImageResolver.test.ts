import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../../engine/types';
import { betrayalCriticalImageResolver, _testExports } from '../criticalImageResolver';
import type { BetrayalCore } from '../game';

const stateOf = (state: Partial<MatchState<BetrayalCore>>): MatchState<BetrayalCore> =>
    state as MatchState<BetrayalCore>;

describe('betrayalCriticalImageResolver', () => {
    it('教程 setup 步骤不加载全量山屋关键图，避免 Board 挂载前互等', () => {
        const result = betrayalCriticalImageResolver(stateOf({
            core: { phase: 'characterSelect' } as BetrayalCore,
            sys: {
                tutorial: {
                    active: true,
                    manifestId: 'basic-setup-and-turn',
                    stepIndex: 0,
                    step: { id: 'setup-runtime', content: 'setup' },
                    steps: [],
                },
            } as MatchState<BetrayalCore>['sys'],
        }), undefined, '0');

        expect(result.critical).toEqual([]);
        expect(result.warm).toEqual([]);
        expect(result.replaceStaticCritical).toBe(true);
        expect(result.phaseKey).toBe('betrayal:tutorial-setup:basic-setup-and-turn:setup-runtime:0');
    });

    it('教程牌桌阶段只阻塞当前教程所需素材，避免直接入口长时间停在加载屏', () => {
        const result = betrayalCriticalImageResolver(stateOf({
            core: {
                phase: 'preHaunt',
                currentExplorer: {
                    playerId: '0',
                    portraitAsset: 'betrayal/explorers/xia',
                    tokenAsset: 'betrayal/tokens/explorers/isa-valencia',
                    inventory: [
                        { id: 'rope', name: '兔脚', kind: 'item' },
                        { id: 'omen-book', name: '书本', kind: 'omen' },
                    ],
                },
                currentExplorerInventory: [
                    { id: 'rope', name: '兔脚', kind: 'item' },
                    { id: 'omen-book', name: '书本', kind: 'omen' },
                ],
                otherExplorers: [
                    {
                        playerId: '1',
                        portraitAsset: 'betrayal/explorers/anita-hernandez',
                        tokenAsset: 'betrayal/tokens/explorers/anita-hernandez',
                        inventory: [],
                    },
                ],
                monsters: [],
                rooms: [
                    {
                        id: 'foyer',
                        name: '门厅',
                        floor: 'ground',
                        x: 0,
                        y: 0,
                        connectedRoomIds: [],
                        orientationTurns: 0,
                        state: 'discovered',
                        hint: '',
                        tags: [],
                        discoveryReward: null,
                        visualId: 'startTriple',
                        doorways: [],
                        backVisualId: 'backGround',
                    },
                    {
                        id: 'ground-north',
                        name: '未探索走廊',
                        floor: 'ground',
                        x: 0,
                        y: -1,
                        connectedRoomIds: [],
                        orientationTurns: 0,
                        state: 'unexplored',
                        hint: '',
                        tags: [],
                        discoveryReward: null,
                        visualId: 'conservatory',
                        doorways: [],
                        backVisualId: 'backGround',
                    },
                ],
            } as BetrayalCore,
            sys: {
                tutorial: {
                    active: true,
                    manifestId: 'basic-setup-and-turn',
                    stepIndex: 1,
                    step: { id: 'objective-and-turn', content: 'objective' },
                    steps: [],
                },
            } as MatchState<BetrayalCore>['sys'],
        }), undefined, '0');

        expect(result.phaseKey).toContain('betrayal:tutorial:basic-setup-and-turn:objective-and-turn:preHaunt:0:');
        expect(result.critical).toEqual(
            expect.arrayContaining(_testExports.BETRAYAL_TUTORIAL_BASE_IMAGE_PATHS),
        );
        expect(result.critical).toContain('betrayal/ui/title-banner');
        expect(result.critical).toContain('betrayal/cards/back-event');
        expect(result.critical).toContain('betrayal/explorers/xia');
        expect(result.critical).toContain('betrayal/tokens/explorers/isa-valencia');
        expect(result.critical).toContain('betrayal/rooms/start-triple-room');
        expect(result.critical).toContain('betrayal/rooms/room-back-atlas');
        expect(result.critical).not.toContain('betrayal/explorers/anita-hernandez');
        expect(result.critical).not.toContain('betrayal/cards/item-front-atlas');
        expect(result.critical).not.toContain('betrayal/cards/omen-front-atlas');
        expect(result.critical).not.toContain('betrayal/cards/event-front-atlas');
        expect(result.critical).not.toContain('betrayal/rooms/room-front-atlas');
        expect(result.critical).not.toContain('betrayal/tokens/monsters/werewolf');
        expect(result.warm).toEqual(_testExports.BETRAYAL_TUTORIAL_WARM_IMAGE_PATHS);
        expect(result.warm).toContain('betrayal/cards/item-front-atlas');
        expect(result.warm).toContain('betrayal/cards/omen-front-atlas');
        expect(result.warm).not.toContain('betrayal/tokens/monsters/mummy.svg');
        expect(result.warm).not.toContain('betrayal/tokens/haunts/mummy-girl.svg');
        expect(result.replaceStaticCritical).toBe(true);
        expect(result.critical.length).toBeLessThan(_testExports.BETRAYAL_CRITICAL_IMAGE_PATHS.length);
        expect(result.critical.some((path) => path.includes('/compressed/'))).toBe(false);
    });

    it('教程 setup 步骤如果已经生成牌桌状态，也按牌桌首屏素材加载', () => {
        const result = betrayalCriticalImageResolver(stateOf({
            core: {
                phase: 'preHaunt',
                currentExplorer: {
                    playerId: '0',
                    portraitAsset: 'betrayal/explorers/xia',
                    tokenAsset: 'betrayal/tokens/explorers/isa-valencia',
                    inventory: [],
                },
                currentExplorerInventory: [],
                otherExplorers: [],
                monsters: [],
                rooms: [],
            } as BetrayalCore,
            sys: {
                tutorial: {
                    active: true,
                    manifestId: 'basic-setup-and-turn',
                    stepIndex: 0,
                    step: { id: 'setup-runtime', content: 'setup' },
                    steps: [],
                },
            } as MatchState<BetrayalCore>['sys'],
        }), undefined, '0');

        expect(result.critical).toContain('betrayal/explorers/xia');
        expect(result.critical).toContain('betrayal/tokens/explorers/isa-valencia');
        expect(result.replaceStaticCritical).toBe(true);
        expect(result.phaseKey).toContain('betrayal:tutorial:basic-setup-and-turn:setup-runtime:preHaunt:0:');
    });

    it('教程事件结果出现后才把事件牌图集升为关键图', () => {
        const result = betrayalCriticalImageResolver(stateOf({
            core: {
                phase: 'preHaunt',
                currentExplorer: {
                    playerId: '0',
                    portraitAsset: 'betrayal/explorers/xia',
                    tokenAsset: 'betrayal/tokens/explorers/isa-valencia',
                    inventory: [],
                },
                currentExplorerInventory: [],
                otherExplorers: [],
                monsters: [],
                rooms: [],
                latestDiscovery: {
                    kind: 'event',
                    title: '标本剥制',
                },
                latestDiscoveryOwnerPlayerId: '0',
            } as BetrayalCore,
            sys: {
                tutorial: {
                    active: true,
                    manifestId: 'basic-setup-and-turn',
                    stepIndex: 20,
                    step: { id: 'rabbit-foot-result', content: 'result' },
                    steps: [],
                },
            } as MatchState<BetrayalCore>['sys'],
        }), undefined, '0');

        expect(result.phaseKey).toContain('betrayal:tutorial:basic-setup-and-turn:rabbit-foot-result:preHaunt:0:');
        expect(result.critical).toContain('betrayal/cards/event-front-atlas');
        expect(result.replaceStaticCritical).toBe(true);
        expect(result.critical.length).toBeLessThan(_testExports.BETRAYAL_CRITICAL_IMAGE_PATHS.length);
    });

    it('非教程正式牌桌阶段仍加载山屋完整关键素材', () => {
        const result = betrayalCriticalImageResolver(stateOf({
            core: { phase: 'playing' } as BetrayalCore,
            sys: {
                tutorial: {
                    active: false,
                    stepIndex: 0,
                    steps: [],
                },
            } as MatchState<BetrayalCore>['sys'],
        }), undefined, '0');

        expect(result.phaseKey).toBe('betrayal:playing:0');
        expect(result.critical).toEqual(_testExports.BETRAYAL_CRITICAL_IMAGE_PATHS);
    });
});
