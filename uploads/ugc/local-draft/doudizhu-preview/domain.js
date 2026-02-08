const domain = (() => {
  const SUITS = ['黑桃', '红心', '梅花', '方块'];
  const RANKS = [
    { label: '3', value: 3 },
    { label: '4', value: 4 },
    { label: '5', value: 5 },
    { label: '6', value: 6 },
    { label: '7', value: 7 },
    { label: '8', value: 8 },
    { label: '9', value: 9 },
    { label: '10', value: 10 },
    { label: 'J', value: 11 },
    { label: 'Q', value: 12 },
    { label: 'K', value: 13 },
    { label: 'A', value: 14 },
    { label: '2', value: 15 }
  ];

  const buildPlayerState = (handCount) => ({
    resources: {},
    handCount,
    deckCount: 0,
    discardCount: 0,
    statusEffects: {},
  });

  const normalizePlayerOrder = (playerIds) => (playerIds || []).map(id => String(id)).filter(Boolean);

  const createDeck = () => {
    const deck = [];
    let index = 1;
    SUITS.forEach(suit => {
      RANKS.forEach(rank => {
        deck.push({
          id: `card-${index++}`,
          suit,
          rank: rank.label,
          rankValue: rank.value,
          display: `${suit}${rank.label}`,
        });
      });
    });
    deck.push({
      id: `card-${index++}`,
      suit: '王',
      rank: '小王',
      rankValue: 16,
      display: '小王',
    });
    deck.push({
      id: `card-${index++}`,
      suit: '王',
      rank: '大王',
      rankValue: 17,
      display: '大王',
    });
    return deck;
  };

  const extractCardIds = (payload) => {
    if (!payload || typeof payload !== 'object') return [];
    const raw = payload.cardIds || payload.cards || payload.cardId;
    if (Array.isArray(raw)) return raw.map(id => String(id));
    if (typeof raw === 'string' || typeof raw === 'number') return [String(raw)];
    return [];
  };

  const groupByRank = (cards) => {
    const bucket = {};
    cards.forEach(card => {
      const key = String(card.rankValue);
      if (!bucket[key]) bucket[key] = [];
      bucket[key].push(card);
    });
    const ranks = Object.keys(bucket).map(Number).sort((a, b) => a - b);
    return ranks.map(rank => ({
      rankValue: rank,
      cards: bucket[String(rank)],
      count: bucket[String(rank)].length,
    }));
  };

  const isConsecutive = (ranks) => {
    if (ranks.length <= 1) return true;
    for (let i = 1; i < ranks.length; i += 1) {
      if (ranks[i] !== ranks[i - 1] + 1) return false;
    }
    return true;
  };

  const detectPattern = (cards) => {
    const total = cards.length;
    if (!total) return null;
    const groups = groupByRank(cards);
    const counts = groups.map(group => group.count);
    const ranks = groups.map(group => group.rankValue);
    const maxRank = ranks[ranks.length - 1];

    if (total === 2 && ranks.length === 2 && ranks[0] >= 16 && ranks[1] >= 16) {
      return { type: 'rocket', mainRank: maxRank, length: total };
    }
    if (total === 4 && ranks.length === 1 && counts[0] === 4) {
      return { type: 'bomb', mainRank: ranks[0], length: total };
    }
    if (total === 1) {
      return { type: 'single', mainRank: ranks[0], length: total };
    }
    if (total === 2 && ranks.length === 1 && counts[0] === 2) {
      return { type: 'pair', mainRank: ranks[0], length: total };
    }
    if (total === 3 && ranks.length === 1 && counts[0] === 3) {
      return { type: 'triple', mainRank: ranks[0], length: total };
    }
    if (total === 4 && ranks.length === 2 && counts.includes(3)) {
      const tripleRank = groups.find(group => group.count === 3).rankValue;
      return { type: 'tripleWithOne', mainRank: tripleRank, length: total };
    }
    if (total === 5 && ranks.length === 2 && counts.includes(3) && counts.includes(2)) {
      const tripleRank = groups.find(group => group.count === 3).rankValue;
      return { type: 'tripleWithPair', mainRank: tripleRank, length: total };
    }
    if (total >= 5 && ranks.length === total && maxRank < 15 && isConsecutive(ranks)) {
      return { type: 'straight', mainRank: maxRank, length: total };
    }
    if (total >= 6 && total % 2 === 0 && counts.every(count => count === 2) && maxRank < 15 && isConsecutive(ranks)) {
      return { type: 'doubleStraight', mainRank: maxRank, length: total };
    }

    const tripleGroups = groups.filter(group => group.count === 3);
    if (tripleGroups.length >= 2) {
      const tripleRanks = tripleGroups.map(group => group.rankValue);
      const tripleMax = tripleRanks[tripleRanks.length - 1];
      if (tripleMax < 15 && isConsecutive(tripleRanks)) {
        const tripleCount = tripleGroups.length;
        const remaining = total - tripleCount * 3;
        const pairGroups = groups.filter(group => group.count === 2);
        const singleGroups = groups.filter(group => group.count === 1);
        if (remaining === 0) {
          return { type: 'plane', mainRank: tripleMax, length: total, mainLength: tripleCount };
        }
        if (remaining === tripleCount && singleGroups.length === tripleCount) {
          return { type: 'planeWithSingles', mainRank: tripleMax, length: total, mainLength: tripleCount };
        }
        if (remaining === tripleCount * 2 && pairGroups.length === tripleCount) {
          return { type: 'planeWithPairs', mainRank: tripleMax, length: total, mainLength: tripleCount };
        }
      }
    }

    return null;
  };

  const isSamePatternType = (pattern, lastPattern) => {
    return pattern.type === lastPattern.type
      && pattern.length === lastPattern.length
      && Number(pattern.mainLength || 0) === Number(lastPattern.mainLength || 0);
  };

  const canBeat = (pattern, lastPattern) => {
    if (!lastPattern) return true;
    if (pattern.type === 'rocket') return true;
    if (lastPattern.type === 'rocket') return false;
    if (pattern.type === 'bomb') {
      if (lastPattern.type !== 'bomb') return true;
      return pattern.mainRank > lastPattern.mainRank;
    }
    if (lastPattern.type === 'bomb') return false;
    if (!isSamePatternType(pattern, lastPattern)) return false;
    return pattern.mainRank > lastPattern.mainRank;
  };

  const pickCardsByIds = (hand, cardIds) => {
    const lookup = {};
    cardIds.forEach(id => {
      lookup[String(id)] = true;
    });
    return hand.filter(card => lookup[String(card.id)]);
  };

  const removeCardsByIds = (hand, cardIds) => {
    const lookup = {};
    cardIds.forEach(id => {
      lookup[String(id)] = true;
    });
    return hand.filter(card => !lookup[String(card.id)]);
  };

  const getNextPlayerId = (currentId, order) => {
    if (!order || order.length === 0) return currentId;
    const index = order.indexOf(currentId);
    const nextIndex = index < 0 ? 0 : (index + 1) % order.length;
    return order[nextIndex];
  };

  const updateTurnNumber = (turnNumber, currentId, nextId, order) => {
    if (!order || order.length === 0) return turnNumber;
    const firstId = order[0];
    if (currentId !== firstId && nextId === firstId) return turnNumber + 1;
    return turnNumber;
  };

  return {
    gameId: 'doudizhu',

    setup(playerIds, random) {
      const order = normalizePlayerOrder(playerIds);
      const landlordId = order[0] || 'player-1';
      const deck = random.shuffle(createDeck());
      const hands = {};
      order.forEach((id, index) => {
        hands[id] = deck.slice(index * 17, index * 17 + 17);
      });
      const landlordCards = deck.slice(51, 54);
      hands[landlordId] = (hands[landlordId] || []).concat(landlordCards);

      const players = {};
      order.forEach(id => {
        players[id] = {
          ...buildPlayerState(hands[id].length),
          public: { role: id === landlordId ? '地主' : '农民' },
        };
      });

      return {
        phase: 'play',
        turnNumber: 1,
        activePlayerId: landlordId,
        players,
        publicZones: {
          playerOrder: order,
          landlordId,
          hands,
          deck: deck.slice(54),
          landlordCards,
          lastPlay: null,
          passCount: 0,
        },
      };
    },

    validate(state, command) {
      if (!state || typeof state !== 'object') {
        return { valid: false, error: '状态无效' };
      }
      if (!command || typeof command !== 'object') {
        return { valid: false, error: '命令无效' };
      }

      const commandType = String(command.type || '');
      const playerId = String(command.playerId || '');
      if (!playerId) {
        return { valid: false, error: '缺少玩家信息' };
      }
      if (state.activePlayerId && playerId !== state.activePlayerId) {
        return { valid: false, error: '非当前玩家回合' };
      }

      const zones = state.publicZones || {};
      const hands = (zones.hands && typeof zones.hands === 'object') ? zones.hands : {};
      const hand = hands[playerId] || [];
      const lastPlay = zones.lastPlay || null;

      if (commandType === 'PASS') {
        if (!lastPlay) {
          return { valid: false, error: '当前没有可跳过的出牌' };
        }
        return { valid: true };
      }

      if (commandType !== 'PLAY_CARD') {
        return { valid: false, error: '不支持的命令类型' };
      }

      const cardIds = extractCardIds(command.payload || {});
      if (!Array.isArray(cardIds) || cardIds.length === 0) {
        return { valid: false, error: '未选择卡牌' };
      }
      const uniqueIds = Array.from(new Set(cardIds));
      if (uniqueIds.length !== cardIds.length) {
        return { valid: false, error: '存在重复卡牌' };
      }

      const selected = pickCardsByIds(hand, uniqueIds);
      if (selected.length !== uniqueIds.length) {
        return { valid: false, error: '手牌不包含所选卡牌' };
      }

      const pattern = detectPattern(selected);
      if (!pattern) {
        return { valid: false, error: '牌型不合法' };
      }
      const lastPattern = lastPlay ? lastPlay.pattern : null;
      if (!canBeat(pattern, lastPattern)) {
        return { valid: false, error: '牌型不够大' };
      }

      return { valid: true };
    },

    execute(state, command) {
      const commandType = String(command.type || '');
      const playerId = String(command.playerId || '');

      if (commandType === 'PASS') {
        return [{ type: 'PASSED', payload: { playerId } }];
      }
      if (commandType !== 'PLAY_CARD') {
        return [{ type: 'NO_OP', payload: { commandType } }];
      }

      const zones = state.publicZones || {};
      const hands = (zones.hands && typeof zones.hands === 'object') ? zones.hands : {};
      const hand = hands[playerId] || [];
      const cardIds = extractCardIds(command.payload || {});
      const uniqueIds = Array.from(new Set(cardIds));
      const selected = pickCardsByIds(hand, uniqueIds);
      const pattern = detectPattern(selected);
      if (!pattern) {
        return [{ type: 'NO_OP', payload: { commandType } }];
      }

      return [{
        type: 'PLAYED',
        payload: {
          playerId,
          cardIds: uniqueIds,
          pattern,
        },
      }];
    },

    reduce(state, event) {
      const zones = state.publicZones || {};
      const playerOrder = zones.playerOrder || Object.keys(state.players || {});
      const hands = (zones.hands && typeof zones.hands === 'object') ? zones.hands : {};

      if (event.type === 'PLAYED') {
        const playerId = String(event.payload.playerId || '');
        const cardIds = Array.isArray(event.payload.cardIds)
          ? event.payload.cardIds.map(id => String(id))
          : [];
        const hand = hands[playerId] || [];
        const remaining = removeCardsByIds(hand, cardIds);
        const lastPlay = {
          playerId,
          cardIds,
          pattern: event.payload.pattern || null,
        };
        const nextPlayerId = getNextPlayerId(playerId, playerOrder);
        const nextTurnNumber = updateTurnNumber(state.turnNumber, state.activePlayerId, nextPlayerId, playerOrder);
        const nextPlayers = { ...state.players };
        if (nextPlayers[playerId]) {
          nextPlayers[playerId] = {
            ...nextPlayers[playerId],
            handCount: remaining.length,
          };
        }
        return {
          ...state,
          turnNumber: nextTurnNumber,
          activePlayerId: nextPlayerId,
          players: nextPlayers,
          publicZones: {
            ...zones,
            hands: {
              ...hands,
              [playerId]: remaining,
            },
            lastPlay,
            passCount: 0,
          },
        };
      }

      if (event.type === 'PASSED') {
        const playerId = String(event.payload.playerId || '');
        if (!zones.lastPlay) return state;
        let passCount = Number(zones.passCount || 0) + 1;
        let nextPlayerId = getNextPlayerId(playerId, playerOrder);
        let nextLastPlay = zones.lastPlay;
        if (passCount >= Math.max(1, playerOrder.length - 1)) {
          nextPlayerId = zones.lastPlay.playerId || nextPlayerId;
          nextLastPlay = null;
          passCount = 0;
        }
        const nextTurnNumber = updateTurnNumber(state.turnNumber, state.activePlayerId, nextPlayerId, playerOrder);
        return {
          ...state,
          turnNumber: nextTurnNumber,
          activePlayerId: nextPlayerId,
          publicZones: {
            ...zones,
            lastPlay: nextLastPlay,
            passCount,
          },
        };
      }

      return state;
    },

    isGameOver(state) {
      const zones = state.publicZones || {};
      const hands = (zones.hands && typeof zones.hands === 'object') ? zones.hands : {};
      const order = zones.playerOrder || Object.keys(state.players || {});
      let winnerId = null;
      order.forEach(id => {
        if (!winnerId && hands[id] && hands[id].length === 0) {
          winnerId = id;
        }
      });
      if (!winnerId) {
        order.forEach(id => {
          const player = state.players ? state.players[id] : null;
          if (!winnerId && player && player.handCount === 0) {
            winnerId = id;
          }
        });
      }
      if (!winnerId) return undefined;
      const landlordId = zones.landlordId;
      if (landlordId && winnerId !== landlordId) {
        return {
          winner: winnerId,
          winners: order.filter(id => id !== landlordId),
        };
      }
      return { winner: winnerId };
    },
  };
})();

// === builder preview config injected for runtime view ===
const builderPreviewConfig = {
  "layout": [
    {
      "id": "player-top-left",
      "type": "player-area",
      "anchor": {
        "x": 0,
        "y": 0
      },
      "pivot": {
        "x": 0,
        "y": 0
      },
      "offset": {
        "x": 20,
        "y": 20
      },
      "width": 200,
      "height": 70,
      "data": {
        "name": "玩家二信息",
        "bindSchema": "player",
        "playerRef": "index",
        "playerRefIndex": 1,
        "playerIds": [
          "player-1",
          "player-2",
          "player-3"
        ],
        "currentPlayerId": "player-1",
        "playerIdField": "id",
        "renderCode": "(data) => (\n  <div className='w-full h-full rounded-md border border-slate-600 bg-slate-900/80 text-slate-100 flex items-center justify-between p-2'>\n    <div className='text-sm font-semibold'>{data.player ? data.player.name : '未知'}</div>\n    <div className='flex flex-col items-center gap-1'>\n      <span className='text-[10px] text-slate-400'>余牌</span>\n      <span className='min-w-[28px] text-center px-2 py-0.5 rounded-full bg-slate-700 text-sm font-semibold'>{data.player ? data.player.cardCount : '--'}</span>\n    </div>\n  </div>\n)"
      }
    },
    {
      "id": "player-top-right",
      "type": "player-area",
      "anchor": {
        "x": 0,
        "y": 0
      },
      "pivot": {
        "x": 0,
        "y": 0
      },
      "offset": {
        "x": 804,
        "y": 20
      },
      "width": 200,
      "height": 70,
      "data": {
        "name": "玩家三信息",
        "bindSchema": "player",
        "playerRef": "index",
        "playerRefIndex": 2,
        "playerIds": [
          "player-1",
          "player-2",
          "player-3"
        ],
        "currentPlayerId": "player-1",
        "playerIdField": "id",
        "renderCode": "(data) => (\n  <div className='w-full h-full rounded-md border border-slate-600 bg-slate-900/80 text-slate-100 flex items-center justify-between p-2'>\n    <div className='text-sm font-semibold'>{data.player ? data.player.name : '未知'}</div>\n    <div className='flex flex-col items-center gap-1'>\n      <span className='text-[10px] text-slate-400'>余牌</span>\n      <span className='min-w-[28px] text-center px-2 py-0.5 rounded-full bg-slate-700 text-sm font-semibold'>{data.player ? data.player.cardCount : '--'}</span>\n    </div>\n  </div>\n)"
      }
    },
    {
      "id": "player-bottom",
      "type": "player-area",
      "anchor": {
        "x": 0,
        "y": 0
      },
      "pivot": {
        "x": 0,
        "y": 0
      },
      "offset": {
        "x": 20,
        "y": 440
      },
      "width": 200,
      "height": 120,
      "data": {
        "name": "玩家一信息",
        "bindSchema": "player",
        "playerRef": "index",
        "playerRefIndex": 0,
        "playerIds": [
          "player-1",
          "player-2",
          "player-3"
        ],
        "currentPlayerId": "player-1",
        "playerIdField": "id",
        "renderCode": "(data) => (\n  <div className='w-full h-full rounded-md border border-amber-500/70 bg-amber-900/30 text-amber-100 flex flex-col justify-between p-2'>\n    <div className='flex items-center justify-between text-[10px] text-amber-200'>\n      <span>当前玩家</span>\n      <span className='px-1.5 py-0.5 rounded bg-amber-700/70'>{data.player ? data.player.role : '--'}</span>\n    </div>\n    <div className='text-sm font-semibold'>{data.player ? data.player.name : '未知'}</div>\n    <div className='text-[10px] text-amber-200'>余牌 {data.player ? data.player.cardCount : '--'}</div>\n  </div>\n)"
      }
    },
    {
      "id": "phase-hud",
      "type": "phase-hud",
      "anchor": {
        "x": 0,
        "y": 0
      },
      "pivot": {
        "x": 0,
        "y": 0
      },
      "offset": {
        "x": 220,
        "y": 90
      },
      "width": 584,
      "height": 100,
      "data": {
        "name": "阶段提示",
        "showFrame": false,
        "orientation": "horizontal",
        "align": "center",
        "bindSchema": "player",
        "useRuntimeState": true,
        "playerIdField": "id",
        "playerNameField": "name",
        "playerLabelPrefix": "当前玩家: ",
        "phases": [
          {
            "id": "ready",
            "label": "发牌"
          },
          {
            "id": "bid",
            "label": "叫分"
          },
          {
            "id": "action",
            "label": "出牌"
          },
          {
            "id": "resolve",
            "label": "结算"
          }
        ],
        "currentPhaseId": "bid",
        "statusText": "等待叫分",
        "currentPlayerLabel": "当前玩家: 玩家一"
      }
    },
    {
      "id": "play-zone",
      "type": "play-zone",
      "anchor": {
        "x": 0,
        "y": 0
      },
      "pivot": {
        "x": 0,
        "y": 0
      },
      "offset": {
        "x": 220,
        "y": 290
      },
      "width": 584,
      "height": 90,
      "data": {
        "name": "桌面出牌",
        "showFrame": false,
        "bindSchema": "card",
        "filterCode": "(card) => card.zone === 'table'",
        "renderFaceMode": "front",
        "layoutCode": "(index, total) => ({ marginLeft: index === 0 ? 0 : -18 })",
        "allowActionHooks": false
      }
    },
    {
      "id": "landlord-zone",
      "type": "play-zone",
      "anchor": {
        "x": 0,
        "y": 0
      },
      "pivot": {
        "x": 0,
        "y": 0
      },
      "offset": {
        "x": 412,
        "y": 200
      },
      "width": 200,
      "height": 80,
      "data": {
        "name": "底牌展示",
        "showFrame": false,
        "bindSchema": "card",
        "filterCode": "(card) => card.zone === 'landlord'",
        "renderFaceMode": "front",
        "layoutCode": "(index, total) => ({ marginLeft: index === 0 ? 0 : -18 })",
        "allowActionHooks": false
      }
    },
    {
      "id": "hand-bottom",
      "type": "hand-zone",
      "anchor": {
        "x": 0,
        "y": 0
      },
      "pivot": {
        "x": 0,
        "y": 0
      },
      "offset": {
        "x": 220,
        "y": 440
      },
      "width": 584,
      "height": 120,
      "data": {
        "name": "玩家一手牌",
        "showFrame": false,
        "bindSchema": "card",
        "bindEntity": "ownerId",
        "zoneField": "zone",
        "zoneValue": "hand",
        "targetPlayerRef": "index",
        "targetPlayerIndex": 0,
        "playerIds": [
          "player-1",
          "player-2",
          "player-3"
        ],
        "currentPlayerId": "player-1",
        "renderFaceMode": "front",
        "interactionMode": "click",
        "sortCode": "(a, b) => (b.rankValue ?? 0) - (a.rankValue ?? 0)",
        "layoutCode": "(index, total) => ({ marginLeft: index === 0 ? 0 : -24 })",
        "selectEffectCode": "(isSelected) => ({ transform: isSelected ? 'translateY(-12px)' : 'translateY(0px)', boxShadow: isSelected ? '0 6px 12px rgba(0,0,0,0.35)' : 'none' })",
        "actions": [
          {
            "id": "play-cards",
            "label": "出牌",
            "scope": "current-player",
            "hookCode": "(payload) => {\n  const selectedCardIds = Array.isArray(payload.context?.selectedCardIds) ? payload.context.selectedCardIds : [];\n  if (!selectedCardIds.length) {\n    throw new Error('未选择卡牌');\n  }\n  return { type: 'PLAY_CARD', payload: { componentId: payload.context.componentId, cardIds: selectedCardIds } };\n}"
          }
        ]
      }
    },
    {
      "id": "action-bar",
      "type": "action-bar",
      "anchor": {
        "x": 0,
        "y": 0
      },
      "pivot": {
        "x": 0,
        "y": 0
      },
      "offset": {
        "x": 220,
        "y": 390
      },
      "width": 584,
      "height": 50,
      "data": {
        "name": "操作栏",
        "showFrame": false,
        "layout": "row",
        "align": "center",
        "gap": 10,
        "selectionSourceId": "hand-bottom",
        "actions": [
          {
            "id": "call-landlord",
            "label": "抢地主",
            "scope": "current-player",
            "variant": "primary",
            "requirement": "仅开局阶段可点击",
            "hookCode": "(payload) => { return; }"
          },
          {
            "id": "bid",
            "label": "叫分",
            "scope": "current-player",
            "variant": "secondary",
            "requirement": "仅开局阶段可点击",
            "hookCode": "(payload) => { return; }"
          },
          {
            "id": "pass",
            "label": "不出",
            "scope": "current-player",
            "variant": "ghost",
            "hookCode": "(payload) => ({ type: 'PASS', payload: { componentId: payload.context.componentId } })"
          }
        ]
      }
    }
  ],
  "renderComponents": [
    {
      "id": "rc-ddz-card",
      "name": "斗地主卡牌",
      "targetSchema": "card",
      "description": "斗地主卡牌渲染",
      "renderCode": "(data) => (\n  <div className={`w-full h-full rounded-md border border-slate-300 bg-gradient-to-b from-white via-slate-50 to-slate-200 shadow-sm flex flex-col justify-between p-1 ${data.suit === '红心' || data.suit === '方块' || data.suit === '王' ? 'text-red-600' : 'text-slate-900'}`} >\n    <div className='text-xs font-bold leading-none'>{data.rank}</div>\n    <div className='text-[10px] text-center text-slate-500'>{data.suit}</div>\n    <div className='text-xs font-bold leading-none self-end rotate-180'>{data.rank}</div>\n  </div>\n)",
      "backRenderCode": "(data) => (\n  <div className='w-full h-full rounded-md border border-slate-500 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 text-slate-100 flex flex-col items-center justify-center text-[10px] tracking-widest'>\n    <div>斗地主</div>\n    <div className='opacity-60'>LANDLORD</div>\n  </div>\n)"
    }
  ],
  "instances": {
    "player": [
      {
        "id": "player-1",
        "name": "玩家一",
        "role": "地主",
        "seat": 1,
        "cardCount": 20
      },
      {
        "id": "player-2",
        "name": "玩家二",
        "role": "农民",
        "seat": 2,
        "cardCount": 17
      },
      {
        "id": "player-3",
        "name": "玩家三",
        "role": "农民",
        "seat": 3,
        "cardCount": 17
      }
    ],
    "card": [
      {
        "id": "card-1",
        "name": "黑桃3",
        "suit": "黑桃",
        "rank": "3",
        "rankValue": 3,
        "ownerId": "player-1",
        "zone": "hand"
      },
      {
        "id": "card-2",
        "name": "黑桃4",
        "suit": "黑桃",
        "rank": "4",
        "rankValue": 4,
        "ownerId": "player-1",
        "zone": "hand"
      },
      {
        "id": "card-3",
        "name": "黑桃5",
        "suit": "黑桃",
        "rank": "5",
        "rankValue": 5,
        "ownerId": "player-1",
        "zone": "hand"
      },
      {
        "id": "card-4",
        "name": "黑桃6",
        "suit": "黑桃",
        "rank": "6",
        "rankValue": 6,
        "ownerId": "player-1",
        "zone": "hand"
      },
      {
        "id": "card-5",
        "name": "黑桃7",
        "suit": "黑桃",
        "rank": "7",
        "rankValue": 7,
        "ownerId": "player-1",
        "zone": "hand"
      },
      {
        "id": "card-6",
        "name": "黑桃8",
        "suit": "黑桃",
        "rank": "8",
        "rankValue": 8,
        "ownerId": "player-1",
        "zone": "hand"
      },
      {
        "id": "card-7",
        "name": "黑桃9",
        "suit": "黑桃",
        "rank": "9",
        "rankValue": 9,
        "ownerId": "player-1",
        "zone": "hand"
      },
      {
        "id": "card-8",
        "name": "黑桃10",
        "suit": "黑桃",
        "rank": "10",
        "rankValue": 10,
        "ownerId": "player-1",
        "zone": "hand"
      },
      {
        "id": "card-9",
        "name": "黑桃J",
        "suit": "黑桃",
        "rank": "J",
        "rankValue": 11,
        "ownerId": "player-1",
        "zone": "hand"
      },
      {
        "id": "card-10",
        "name": "黑桃Q",
        "suit": "黑桃",
        "rank": "Q",
        "rankValue": 12,
        "ownerId": "player-1",
        "zone": "hand"
      },
      {
        "id": "card-11",
        "name": "黑桃K",
        "suit": "黑桃",
        "rank": "K",
        "rankValue": 13,
        "ownerId": "player-1",
        "zone": "hand"
      },
      {
        "id": "card-12",
        "name": "黑桃A",
        "suit": "黑桃",
        "rank": "A",
        "rankValue": 14,
        "ownerId": "player-1",
        "zone": "hand"
      },
      {
        "id": "card-13",
        "name": "黑桃2",
        "suit": "黑桃",
        "rank": "2",
        "rankValue": 15,
        "ownerId": "player-1",
        "zone": "hand"
      },
      {
        "id": "card-14",
        "name": "红心3",
        "suit": "红心",
        "rank": "3",
        "rankValue": 3,
        "ownerId": "player-1",
        "zone": "hand"
      },
      {
        "id": "card-15",
        "name": "红心4",
        "suit": "红心",
        "rank": "4",
        "rankValue": 4,
        "ownerId": "player-1",
        "zone": "hand"
      },
      {
        "id": "card-16",
        "name": "红心5",
        "suit": "红心",
        "rank": "5",
        "rankValue": 5,
        "ownerId": "player-1",
        "zone": "hand"
      },
      {
        "id": "card-17",
        "name": "红心6",
        "suit": "红心",
        "rank": "6",
        "rankValue": 6,
        "ownerId": "player-1",
        "zone": "hand"
      },
      {
        "id": "card-18",
        "name": "红心7",
        "suit": "红心",
        "rank": "7",
        "rankValue": 7,
        "ownerId": "player-2",
        "zone": "hand"
      },
      {
        "id": "card-19",
        "name": "红心8",
        "suit": "红心",
        "rank": "8",
        "rankValue": 8,
        "ownerId": "player-2",
        "zone": "hand"
      },
      {
        "id": "card-20",
        "name": "红心9",
        "suit": "红心",
        "rank": "9",
        "rankValue": 9,
        "ownerId": "player-2",
        "zone": "hand"
      },
      {
        "id": "card-21",
        "name": "红心10",
        "suit": "红心",
        "rank": "10",
        "rankValue": 10,
        "ownerId": "player-2",
        "zone": "hand"
      },
      {
        "id": "card-22",
        "name": "红心J",
        "suit": "红心",
        "rank": "J",
        "rankValue": 11,
        "ownerId": "player-2",
        "zone": "hand"
      },
      {
        "id": "card-23",
        "name": "红心Q",
        "suit": "红心",
        "rank": "Q",
        "rankValue": 12,
        "ownerId": "player-2",
        "zone": "hand"
      },
      {
        "id": "card-24",
        "name": "红心K",
        "suit": "红心",
        "rank": "K",
        "rankValue": 13,
        "ownerId": "player-2",
        "zone": "hand"
      },
      {
        "id": "card-25",
        "name": "红心A",
        "suit": "红心",
        "rank": "A",
        "rankValue": 14,
        "ownerId": "player-2",
        "zone": "hand"
      },
      {
        "id": "card-26",
        "name": "红心2",
        "suit": "红心",
        "rank": "2",
        "rankValue": 15,
        "ownerId": "player-2",
        "zone": "hand"
      },
      {
        "id": "card-27",
        "name": "梅花3",
        "suit": "梅花",
        "rank": "3",
        "rankValue": 3,
        "ownerId": "player-2",
        "zone": "hand"
      },
      {
        "id": "card-28",
        "name": "梅花4",
        "suit": "梅花",
        "rank": "4",
        "rankValue": 4,
        "ownerId": "player-2",
        "zone": "hand"
      },
      {
        "id": "card-29",
        "name": "梅花5",
        "suit": "梅花",
        "rank": "5",
        "rankValue": 5,
        "ownerId": "player-2",
        "zone": "hand"
      },
      {
        "id": "card-30",
        "name": "梅花6",
        "suit": "梅花",
        "rank": "6",
        "rankValue": 6,
        "ownerId": "player-2",
        "zone": "hand"
      },
      {
        "id": "card-31",
        "name": "梅花7",
        "suit": "梅花",
        "rank": "7",
        "rankValue": 7,
        "ownerId": "player-2",
        "zone": "hand"
      },
      {
        "id": "card-32",
        "name": "梅花8",
        "suit": "梅花",
        "rank": "8",
        "rankValue": 8,
        "ownerId": "player-2",
        "zone": "hand"
      },
      {
        "id": "card-33",
        "name": "梅花9",
        "suit": "梅花",
        "rank": "9",
        "rankValue": 9,
        "ownerId": "player-2",
        "zone": "hand"
      },
      {
        "id": "card-34",
        "name": "梅花10",
        "suit": "梅花",
        "rank": "10",
        "rankValue": 10,
        "ownerId": "player-2",
        "zone": "hand"
      },
      {
        "id": "card-35",
        "name": "梅花J",
        "suit": "梅花",
        "rank": "J",
        "rankValue": 11,
        "ownerId": "player-3",
        "zone": "hand"
      },
      {
        "id": "card-36",
        "name": "梅花Q",
        "suit": "梅花",
        "rank": "Q",
        "rankValue": 12,
        "ownerId": "player-3",
        "zone": "hand"
      },
      {
        "id": "card-37",
        "name": "梅花K",
        "suit": "梅花",
        "rank": "K",
        "rankValue": 13,
        "ownerId": "player-3",
        "zone": "hand"
      },
      {
        "id": "card-38",
        "name": "梅花A",
        "suit": "梅花",
        "rank": "A",
        "rankValue": 14,
        "ownerId": "player-3",
        "zone": "hand"
      },
      {
        "id": "card-39",
        "name": "梅花2",
        "suit": "梅花",
        "rank": "2",
        "rankValue": 15,
        "ownerId": "player-3",
        "zone": "hand"
      },
      {
        "id": "card-40",
        "name": "方块3",
        "suit": "方块",
        "rank": "3",
        "rankValue": 3,
        "ownerId": "player-3",
        "zone": "hand"
      },
      {
        "id": "card-41",
        "name": "方块4",
        "suit": "方块",
        "rank": "4",
        "rankValue": 4,
        "ownerId": "player-3",
        "zone": "hand"
      },
      {
        "id": "card-42",
        "name": "方块5",
        "suit": "方块",
        "rank": "5",
        "rankValue": 5,
        "ownerId": "player-3",
        "zone": "hand"
      },
      {
        "id": "card-43",
        "name": "方块6",
        "suit": "方块",
        "rank": "6",
        "rankValue": 6,
        "ownerId": "player-3",
        "zone": "hand"
      },
      {
        "id": "card-44",
        "name": "方块7",
        "suit": "方块",
        "rank": "7",
        "rankValue": 7,
        "ownerId": "player-3",
        "zone": "hand"
      },
      {
        "id": "card-45",
        "name": "方块8",
        "suit": "方块",
        "rank": "8",
        "rankValue": 8,
        "ownerId": "player-3",
        "zone": "hand"
      },
      {
        "id": "card-46",
        "name": "方块9",
        "suit": "方块",
        "rank": "9",
        "rankValue": 9,
        "ownerId": "player-3",
        "zone": "hand"
      },
      {
        "id": "card-47",
        "name": "方块10",
        "suit": "方块",
        "rank": "10",
        "rankValue": 10,
        "ownerId": "player-3",
        "zone": "hand"
      },
      {
        "id": "card-48",
        "name": "方块J",
        "suit": "方块",
        "rank": "J",
        "rankValue": 11,
        "ownerId": "player-3",
        "zone": "hand"
      },
      {
        "id": "card-49",
        "name": "方块Q",
        "suit": "方块",
        "rank": "Q",
        "rankValue": 12,
        "ownerId": "player-3",
        "zone": "hand"
      },
      {
        "id": "card-50",
        "name": "方块K",
        "suit": "方块",
        "rank": "K",
        "rankValue": 13,
        "ownerId": "player-3",
        "zone": "hand"
      },
      {
        "id": "card-51",
        "name": "方块A",
        "suit": "方块",
        "rank": "A",
        "rankValue": 14,
        "ownerId": "player-3",
        "zone": "hand"
      },
      {
        "id": "card-52",
        "name": "方块2",
        "suit": "方块",
        "rank": "2",
        "rankValue": 15,
        "ownerId": "player-1",
        "zone": "landlord"
      },
      {
        "id": "card-53",
        "name": "小王",
        "suit": "王",
        "rank": "小王",
        "rankValue": 16,
        "ownerId": "player-1",
        "zone": "landlord"
      },
      {
        "id": "card-54",
        "name": "大王",
        "suit": "王",
        "rank": "大王",
        "rankValue": 17,
        "ownerId": "player-1",
        "zone": "landlord"
      }
    ]
  },
  "layoutGroups": [
    {
      "id": "default",
      "name": "默认",
      "hidden": false
    }
  ],
  "schemaDefaults": {
    "card": "rc-ddz-card"
  }
};
const __attachBuilderPreviewConfig = (state) => {
  if (!state || typeof state !== "object") return state;
  const publicZones = (state.publicZones && typeof state.publicZones === "object") ? state.publicZones : {};
  return { ...state, publicZones: { ...publicZones, builderPreviewConfig } };
};
const __baseSetup = domain.setup;
const __baseReduce = domain.reduce;
if (typeof __baseSetup === "function") {
  domain.setup = (playerIds, random) => __attachBuilderPreviewConfig(__baseSetup(playerIds, random));
}
if (typeof __baseReduce === "function") {
  domain.reduce = (state, event) => __attachBuilderPreviewConfig(__baseReduce(state, event));
}
