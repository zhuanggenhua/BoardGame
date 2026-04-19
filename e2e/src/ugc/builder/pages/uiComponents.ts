/**
 * UI 布局组件定义
 * 区域组件：预制渲染逻辑 + 可覆盖
 */

export interface UIComponentDef {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  bindSchema?: string;
  defaultData?: Record<string, unknown>;
  dataFormat?: string;
  customizable?: boolean;
  presetFeatures?: string;
}

export const BASE_UI_COMPONENTS: { category: string; items: UIComponentDef[] }[] = [
  {
    category: '区域组件',
    items: [
      {
        id: 'hand-zone',
        name: '手牌区',
        type: 'hand-zone',
        width: 400,
        height: 120,
        dataFormat: '{ cards: CardData[] }',
        customizable: true,
      },
      {
        id: 'play-zone',
        name: '出牌区',
        type: 'play-zone',
        width: 300,
        height: 200,
        dataFormat: '{ playedCards: { card: CardData, playerId: string }[] }',
        customizable: true,
      },
      {
        id: 'deck-zone',
        name: '牌堆',
        type: 'deck-zone',
        width: 100,
        height: 140,
        dataFormat: '{ count: number, topCard?: CardData }',
        customizable: true,
      },
      {
        id: 'discard-zone',
        name: '弃牌堆',
        type: 'discard-zone',
        width: 100,
        height: 140,
        dataFormat: '{ cards: CardData[], topCard?: CardData }',
        customizable: true,
      },
    ],
  },
  {
    category: '玩家区域',
    items: [
      {
        id: 'player-area',
        name: '玩家信息',
        type: 'player-area',
        width: 200,
        height: 150,
        dataFormat:
          '{ resolvedPlayer: PlayerData, resolvedPlayerId: string, currentPlayerId: string, playerIds: string[], isCurrentPlayer: boolean, isCurrentTurn: boolean }',
        customizable: true,
      },
      {
        id: 'resource-bar',
        name: '资源栏',
        type: 'resource-bar',
        width: 200,
        height: 40,
        dataFormat: '{ resources: { [key: string]: number } }',
        customizable: true,
      },
    ],
  },
  {
    category: 'UI 元素',
    items: [
      {
        id: 'action-bar',
        name: '操作栏',
        type: 'action-bar',
        width: 360,
        height: 70,
        defaultData: {
          name: '操作栏',
          layout: 'row',
          align: 'center',
          gap: 8,
          actions: [
            { id: 'action-primary', label: '主要操作', scope: 'current-player', variant: 'primary' },
            { id: 'action-secondary', label: '次要操作', scope: 'current-player', variant: 'secondary' },
          ],
        },
      },
      {
        id: 'phase-hud',
        name: '阶段提示',
        type: 'phase-hud',
        width: 260,
        height: 80,
        defaultData: {
          name: '阶段提示',
          orientation: 'horizontal',
          phases: [
            { id: 'ready', label: '准备' },
            { id: 'action', label: '行动' },
            { id: 'resolve', label: '结算' },
          ],
          currentPhaseId: 'action',
          statusText: '等待操作',
          currentPlayerLabel: '当前玩家: 玩家1',
        },
      },
      { id: 'message-log', name: '消息日志', type: 'message-log', width: 250, height: 200 },
      { id: 'dice-area', name: '骰子区', type: 'dice-area', width: 200, height: 100 },
      { id: 'token-area', name: '标记区', type: 'token-area', width: 150, height: 80 },
      { id: 'render-component', name: '渲染组件', type: 'render-component', width: 100, height: 140, customizable: true },
    ],
  },
  {
    category: '系统组件',
    items: [
      {
        id: 'bgm',
        name: '背景音乐',
        type: 'bgm',
        width: 220,
        height: 80,
        presetFeatures: '场景级背景音乐配置',
        defaultData: {
          name: '背景音乐',
          bgmKey: 'bgm-main',
          bgmName: '主背景',
          bgmSrc: '',
          bgmBasePath: '',
          bgmVolume: 0.6,
          bgmEnabled: true,
          bgmAutoPlay: true,
        },
      },
    ],
  },
];

export function getUIComponents(): { category: string; items: UIComponentDef[] }[] {
  return BASE_UI_COMPONENTS;
}
