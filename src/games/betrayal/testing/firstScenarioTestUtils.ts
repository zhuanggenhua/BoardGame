import type { Command, MatchState, RandomFn } from "../../../engine/types";
import {
  BETRAYAL_COMMANDS,
  BetrayalDomain,
  createBetrayalMonsterFromDefinition,
  type BetrayalCommand,
  type BetrayalCommandMap,
  type BetrayalCore,
  type BetrayalTraitKey,
} from "../game";
import { BETRAYAL_DISCOVERY_POOLS } from "../scenarioConfig";

const BETRAYAL_TRAIT_KEYS: BetrayalTraitKey[] = [
  "might",
  "speed",
  "knowledge",
  "sanity",
];

export const BETRAYAL_FIXED_RANDOM: RandomFn = {
  random: () => 0.42,
  d: (max) => Math.max(1, Math.min(max, 1)),
  range: (min) => min,
  shuffle: (array) => [...array],
};

export function createBetrayalScriptedRandom(
  ...diceResults: number[]
): RandomFn {
  let index = 0;
  return {
    random: () => 0.42,
    d: (max) => {
      const next = diceResults[index] ?? 1;
      index += 1;
      return Math.max(1, Math.min(max, next));
    },
    range: (min) => min,
    shuffle: (array) => [...array],
  };
}

function stateOf(core: BetrayalCore): MatchState<BetrayalCore> {
  return { core, sys: {} as MatchState<BetrayalCore>["sys"] };
}

function buildLinearTestTraitTrack(
  trackId: string,
  value: number,
): BetrayalCore["currentExplorer"]["traitTracks"][BetrayalTraitKey] {
  const currentValue = Math.max(1, Math.round(value));
  const values = [
    Math.max(1, currentValue - 2),
    Math.max(1, currentValue - 1),
    currentValue,
    currentValue + 1,
    currentValue + 2,
  ];
  const startPosition = 2;
  return {
    trackId,
    values,
    position: startPosition,
    startPosition,
    criticalPosition: 0,
    skullPosition: -1,
    maxPosition: values.length - 1,
  };
}

function traitValueAtTestTrack(
  track: BetrayalCore["currentExplorer"]["traitTracks"][BetrayalTraitKey],
): number {
  if (track.position <= track.skullPosition) {
    return 0;
  }
  const position = Math.max(
    track.criticalPosition,
    Math.min(track.maxPosition, track.position),
  );
  return track.values[position] ?? track.values[track.criticalPosition] ?? 1;
}

function positionForTestTrackValue(
  track: BetrayalCore["currentExplorer"]["traitTracks"][BetrayalTraitKey],
  value: number,
): number | null {
  if (value <= 0) {
    return track.skullPosition;
  }
  const exactPositions = track.values
    .map((trackValue, index) => ({ trackValue, index }))
    .filter(({ trackValue }) => trackValue === value)
    .map(({ index }) => index);
  if (exactPositions.length === 0) {
    return null;
  }
  return exactPositions.reduce((best, index) => (
    Math.abs(index - track.startPosition) < Math.abs(best - track.startPosition)
      ? index
      : best
  ), exactPositions[0]!);
}

function syncLegacyTestExplorerTraitTracks(
  explorer: BetrayalCore["currentExplorer"],
): void {
  for (const trait of BETRAYAL_TRAIT_KEYS) {
    const track = explorer.traitTracks[trait];
    const isExplicitTestTrack = track?.trackId.startsWith("test-") ?? false;
    if (!track) {
      explorer.traitTracks[trait] = buildLinearTestTraitTrack(
        `legacy-test-${explorer.explorerId}-${trait}`,
        explorer.traits[trait],
      );
      continue;
    }
    if (explorer.traits[trait] !== traitValueAtTestTrack(track)) {
      if (isExplicitTestTrack) {
        explorer.traits[trait] = traitValueAtTestTrack(track);
        continue;
      }
      const nextPosition = positionForTestTrackValue(track, explorer.traits[trait]);
      if (nextPosition === null) {
        explorer.traitTracks[trait] = buildLinearTestTraitTrack(
          `legacy-test-${explorer.explorerId}-${trait}`,
          explorer.traits[trait],
        );
        explorer.traits[trait] = traitValueAtTestTrack(explorer.traitTracks[trait]);
      } else {
        track.position = nextPosition;
        explorer.traits[trait] = traitValueAtTestTrack(track);
      }
    }
  }
}

function syncLegacyTestCoreTraitTracks(core: BetrayalCore): void {
  syncLegacyTestExplorerTraitTracks(core.currentExplorer);
  for (const explorer of core.otherExplorers) {
    syncLegacyTestExplorerTraitTracks(explorer);
  }
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
}

export function createBetrayalCommand<Type extends keyof BetrayalCommandMap>(
  type: Type,
  playerId: string,
  payload: BetrayalCommandMap[Type],
  timestamp = 100,
): BetrayalCommand {
  return {
    type,
    playerId,
    payload,
    timestamp,
  } as Command<Type & string, BetrayalCommandMap[Type]> as BetrayalCommand;
}

export function applyBetrayalCommand<Type extends keyof BetrayalCommandMap>(
  core: BetrayalCore,
  type: Type,
  playerId: string,
  payload: BetrayalCommandMap[Type],
  timestamp = 100,
  random: RandomFn = BETRAYAL_FIXED_RANDOM,
): BetrayalCore {
  syncLegacyTestCoreTraitTracks(core);
  const nextCommand = createBetrayalCommand(type, playerId, payload, timestamp);
  const validation = BetrayalDomain.validate(stateOf(core), nextCommand);
  if (!validation.valid) {
    throw new Error(
      validation.error ?? `invalid betrayal command: ${String(type)}`,
    );
  }
  return BetrayalDomain.execute(stateOf(core), nextCommand, random).reduce(
    (nextCore, event) => BetrayalDomain.reduce(nextCore, event),
    core,
  );
}

export function acknowledgePendingCardResolutions(core: BetrayalCore): BetrayalCore {
  let nextCore = core;
  let safety = 0;
  while ((nextCore.pendingCardResolutionQueue ?? []).length > 0) {
    if (safety >= 20) {
      throw new Error("山屋测试夹具确认牌面队列超过安全上限");
    }
    const pendingResolution = nextCore.pendingCardResolutionQueue[0]!;
    nextCore = applyBetrayalCommand(
      nextCore,
      BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION,
      pendingResolution.playerId,
      { resolutionId: pendingResolution.id },
    );
    safety += 1;
  }
  return nextCore;
}

function findFixtureExplorer(
  core: BetrayalCore,
  playerId: string,
): BetrayalCore["currentExplorer"] {
  const explorer = [core.currentExplorer, ...core.otherExplorers].find(
    (candidate) => candidate.playerId === playerId,
  );
  if (!explorer) {
    throw new Error(`山屋测试夹具缺少玩家 ${playerId}`);
  }
  return explorer;
}

function lethalTraitsForPendingDamage(
  core: BetrayalCore,
  lethalTrait: BetrayalTraitKey = "might",
): BetrayalTraitKey[] {
  const pending = core.pendingDamageAllocation;
  if (!pending) {
    throw new Error("expected pending damage allocation");
  }
  const primaryTrait = pending.allowedTraits.includes(lethalTrait)
    ? lethalTrait
    : pending.allowedTraits[0];
  if (!primaryTrait) {
    throw new Error("pending damage allocation has no allowed traits");
  }
  const explorer = findFixtureExplorer(core, pending.playerId);
  const orderedTraits = [
    primaryTrait,
    ...pending.allowedTraits.filter((trait) => trait !== primaryTrait),
  ];
  const traits: BetrayalTraitKey[] = [];
  let remaining = pending.amount;
  for (const trait of orderedTraits) {
    if (remaining <= 0) {
      break;
    }
    const track = explorer.traitTracks[trait];
    const floorPosition = pending.allowSkull
      ? track.skullPosition
      : track.criticalPosition;
    const assignableSteps = Math.max(0, track.position - floorPosition);
    const take = Math.min(remaining, assignableSteps);
    traits.push(...Array.from({ length: take }, () => trait));
    remaining -= take;
  }
  return traits;
}

function resolvePendingDamageAllocation(
  core: BetrayalCore,
  lethalTrait: BetrayalTraitKey = "might",
): BetrayalCore {
  const pending = core.pendingDamageAllocation;
  if (!pending) {
    return core;
  }
  return applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
    pending.playerId,
    { traits: lethalTraitsForPendingDamage(core, lethalTrait) },
  );
}

export function setScenarioTestTurnMovement(
  core: BetrayalCore,
  amount: number,
): void {
  core.turnStartSpeed = amount;
  core.movesRemaining = amount;
}

export function createStartedFirstScenarioCore(
  playerIds: string[] = ["0", "1", "2"],
): BetrayalCore {
  let core = BetrayalDomain.setup(playerIds, BETRAYAL_FIXED_RANDOM);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, "0", {
    explorerId: "jaden-jones",
  });
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.CONFIRM_EXPLORER,
    "0",
    {},
  );
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD,
    "0",
    {},
  );
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.START_SCENARIO, "0", {
  });
  core.eventOrder = [
    {
      name: "测试中性事件",
      effect: { mode: "none", recommendedAction: "endTurn" },
    },
  ];
  return core;
}

function applyTutorialDiscoveryOrder(core: BetrayalCore): BetrayalCore {
  const tutorialEvent = BETRAYAL_DISCOVERY_POOLS.events.find(
    (event) => event.name === "外星几何",
  );
  if (!tutorialEvent) {
    throw new Error("山屋教程缺少官方事件牌：外星几何");
  }
  core.eventOrder = [tutorialEvent];
  return core;
}

function cloneTestExplorer(
  explorer: BetrayalCore["currentExplorer"],
): BetrayalCore["currentExplorer"] {
  return {
    ...explorer,
    traits: { ...explorer.traits },
    traitTracks: Object.fromEntries(
      Object.entries(explorer.traitTracks).map(([trait, track]) => [
        trait,
        { ...track, values: [...track.values] },
      ]),
    ) as BetrayalCore["currentExplorer"]["traitTracks"],
    inventory: explorer.inventory.map((card) => ({ ...card })),
  };
}

function focusCoreOnExplorer(
  core: BetrayalCore,
  playerId: string,
): BetrayalCore {
  const explorers = [core.currentExplorer, ...core.otherExplorers];
  const currentExplorer = explorers.find(
    (explorer) => explorer.playerId === playerId,
  );
  if (!currentExplorer) {
    throw new Error(`山屋测试夹具缺少玩家 ${playerId}`);
  }
  const feverishRoomId = core.monsters.find(
    (monster) => monster.id === `feverish-${playerId}`,
  )?.roomId;
  const controlledRoomId =
    core.scenarioRuntime.traitorPlayerId === playerId &&
    core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId) &&
    core.scenarioRuntime.jackSpiritReleased &&
    core.scenarioRuntime.jackSpiritRoomId
      ? core.scenarioRuntime.jackSpiritRoomId
      : core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId) &&
          core.scenarioRuntime.dust?.feverishPlayerIds.includes(playerId) &&
          feverishRoomId
        ? feverishRoomId
      : currentExplorer.roomId;
  const nextCurrentExplorer = cloneTestExplorer(currentExplorer);
  return {
    ...core,
    currentPlayer: playerId,
    currentExplorer: nextCurrentExplorer,
    otherExplorers: explorers
      .filter((explorer) => explorer.playerId !== playerId)
      .map(cloneTestExplorer),
    activeRoomId: controlledRoomId,
    currentExplorerTraits: { ...nextCurrentExplorer.traits },
    currentExplorerInventory: nextCurrentExplorer.inventory.map((card) => ({
      ...card,
    })),
    turnStartInventoryCardIds: nextCurrentExplorer.inventory.map(
      (card) => card.id,
    ),
    usedCardIdsThisTurn: [],
    recommendedAction: "move",
  };
}

export function createStartedFirstScenarioTutorialCore(
  playerIds: string[] = ["0", "1", "2"],
): BetrayalCore {
  return applyTutorialDiscoveryOrder(createStartedFirstScenarioCore(playerIds));
}

export function createFirstScenarioHauntCore(
  playerIds: string[] = ["0", "1", "2"],
): BetrayalCore {
  let core = createStartedFirstScenarioCore(playerIds);
  core.roomDiscoveryOrderByFloor.basement = [
    BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find(
      (room) => room.visualId === "chasm",
    )!,
  ];
  const hauntTriggerRandom = createBetrayalScriptedRandom(
    3,
    3,
    3,
    3, // 第三次探索第一次真正抽到恶兆：当前全员持有 4 张恶兆，haunt roll = 8
  );

  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "hallway",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "grand-staircase",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-landing",
  });
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.EXPLORE_ROOM,
    "0",
    {},
    100,
    hauntTriggerRandom,
  );
  core = acknowledgePendingCardResolutions(core);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "0", {});

  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "1", {
    roomId: "hallway",
  });
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.EXPLORE_ROOM,
    "1",
    {},
    100,
    hauntTriggerRandom,
  );
  core = acknowledgePendingCardResolutions(core);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "1", {});

  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "2", {
    roomId: "hallway",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "2", {
    roomId: "grand-staircase",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "2", {
    roomId: "basement-landing",
  });
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.EXPLORE_ROOM,
    "2",
    {},
    100,
    hauntTriggerRandom,
  );
  core = acknowledgePendingCardResolutions(core);

  setScenarioTestTurnMovement(core, 6);
  return core;
}

export function createFirstScenarioHauntTutorialCore(): BetrayalCore {
  return applyTutorialDiscoveryOrder(createFirstScenarioHauntCore());
}

export function createDustHauntCore(
  playerIds: string[] = ["0", "1", "2"],
): BetrayalCore {
  let core = createStartedFirstScenarioCore(playerIds);
  const dustEvent = BETRAYAL_DISCOVERY_POOLS.events.find(
    (event) => event.name === "一瓶微尘",
  );
  if (!dustEvent) {
    throw new Error("山屋测试夹具缺少官方事件牌：一瓶微尘");
  }
  core.drawOrder = ["event"];
  core.eventOrder = [dustEvent];
  core.currentExplorer.inventory = [
    ...core.currentExplorer.inventory,
    { id: "omen-book", name: "书本", kind: "omen" },
    { id: "dog", name: "狗", kind: "omen" },
    { id: "mask", name: "面具", kind: "omen" },
  ];
  core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({
    ...card,
  }));
  core.currentExplorerTraits = { ...core.currentExplorer.traits };

  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "hallway",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, "0", {
    roomId: "ground-north",
  });
  return applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
    "0",
    { accept: true },
    100,
    createBetrayalScriptedRandom(3, 3, 3),
  );
}

export function createDustFeverishControlReadyCore(
  feverishPlayerId = "0",
): BetrayalCore {
  let core = createDustHauntCore();
  const feverishRoomId = "hallway";
  core = focusCoreOnExplorer(core, feverishPlayerId);
  core.currentExplorer = {
    ...core.currentExplorer,
    roomId: feverishRoomId,
    inventory: [
      { id: "medical-kit", name: "急救包", kind: "item" },
      { id: "rope", name: "兔脚", kind: "item" },
    ],
  };
  core.otherExplorers = core.otherExplorers.map((explorer) => ({
    ...explorer,
    roomId: explorer.playerId === "1" ? feverishRoomId : "grand-staircase",
  }));
  core.activeRoomId = feverishRoomId;
  core.currentExplorerRoomId = feverishRoomId;
  core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({
    ...card,
  }));
  core.turnStartInventoryCardIds = core.currentExplorer.inventory.map(
    (card) => card.id,
  );
  core.scenarioRuntime.deadExplorerPlayerIds = Array.from(
    new Set([...core.scenarioRuntime.deadExplorerPlayerIds, feverishPlayerId]),
  );
  if (!core.scenarioRuntime.dust) {
    throw new Error("山屋灰尘夹具缺少 dust 运行态");
  }
  core.scenarioRuntime.dust.permanentTraitorPlayerIds = Array.from(
    new Set([
      ...core.scenarioRuntime.dust.permanentTraitorPlayerIds,
      feverishPlayerId,
    ]),
  );
  core.scenarioRuntime.dust.feverishPlayerIds = Array.from(
    new Set([
      ...core.scenarioRuntime.dust.feverishPlayerIds,
      feverishPlayerId,
    ]),
  );
  core.monsters = [
    ...core.monsters.filter(
      (monster) => monster.id !== `feverish-${feverishPlayerId}`,
    ),
    createBetrayalMonsterFromDefinition(
      "dust-feverish-patient",
      `feverish-${feverishPlayerId}`,
      feverishRoomId,
    ),
  ];
  setScenarioTestTurnMovement(core, 2);
  return focusCoreOnExplorer(core, feverishPlayerId);
}

export function createDustFeverishNaturalMonsterTurnBeforeRollCore(): BetrayalCore {
  let core = createDustFeverishControlReadyCore("0");
  if (!core.scenarioRuntime.dust) {
    throw new Error("山屋灰尘夹具缺少 dust 运行态");
  }
  core.scenarioRuntime.dust.exchangedSicknessThisTurnPlayerIds = Array.from(
    new Set([
      ...core.scenarioRuntime.dust.exchangedSicknessThisTurnPlayerIds,
      "2",
    ]),
  );
  core = focusCoreOnExplorer(core, "2");
  setScenarioTestTurnMovement(core, 2);
  return {
    ...core,
    recentRoll: null,
    recommendedAction: "endTurn",
  };
}

export function createDustFeverishMovementRollReadyCore(): BetrayalCore {
  return applyBetrayalCommand(
    createDustFeverishNaturalMonsterTurnBeforeRollCore(),
    BETRAYAL_COMMANDS.END_TURN,
    "2",
    {},
    100,
    createBetrayalScriptedRandom(2, 2, 1, 1, 1),
  );
}

export function createDustFeverishAttackReadyCore(): BetrayalCore {
  const core = createDustFeverishMovementRollReadyCore();
  const monsterId = "feverish-0";
  const groupId = "狂热病患:5";
  core.movesRemaining = 0;
  core.recentRoll = null;
  core.usedCardIdsThisTurn = core.usedCardIdsThisTurn.filter(
    (id) => id !== "haunt-attack",
  );
  core.scenarioRuntime.monsterTurn = {
    ...core.scenarioRuntime.monsterTurn,
    resolvedStartMonsterIds: Array.from(
      new Set([
        ...core.scenarioRuntime.monsterTurn.resolvedStartMonsterIds,
        monsterId,
      ]),
    ),
    movementRollsByGroupId: {
      ...core.scenarioRuntime.monsterTurn.movementRollsByGroupId,
      [groupId]: {
        groupId,
        monsterName: "狂热病患",
        monsterIds: [monsterId],
        playerId: "0",
        speed: 5,
        diceCount: 5,
        dice: [1, 1, 0, 0, 0],
        total: 2,
        moveAllowance: 2,
        rollOnceForGroup: true,
        minimumMoveAllowance: 1,
      },
    },
    moveRemainingById: {
      ...core.scenarioRuntime.monsterTurn.moveRemainingById,
      [monsterId]: 0,
    },
  };
  return core;
}

export function playFirstScenarioToSurvivorVictory(): BetrayalCore {
  let core = createFirstScenarioHauntCore();
  const hauntSuccessRandom = createBetrayalScriptedRandom(
    3,
    3,
    3,
    3, // 图书馆成功
    3,
    3,
    1,
    1,
    1,
    1,
    1,
    1, // 对攻击倒叛徒：英雄 12(+2) vs 叛徒 6
    2,
    2,
    2, // 杰克之灵移动到 basement-landing
    3,
    3,
    3,
    3, // 驱魔法阵成功
    3,
    3,
    3,
    3, // 第二次驱魔法阵成功
    3,
    3,
    3,
    3,
    3,
    3, // 最终驱魔成功
  );

  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-west",
  });
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.LEARN_ABOUT_JACK,
    "0",
    {},
    100,
    hauntSuccessRandom,
  );
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "0", {});

  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "1", {});
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "2", {});

  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "grand-staircase",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "basement-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "basement-east",
  });
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.HAUNT_ATTACK,
    "0",
    { target: "traitor" },
    100,
    hauntSuccessRandom,
  );
  core = resolvePendingDamageAllocation(core);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "0", {});
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "1", {});
  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "2", {
    roomId: "basement-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "2", {});

  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "basement-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "grand-staircase",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-north",
  });
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.STUDY_EXORCISM,
    "0",
    {},
    100,
    hauntSuccessRandom,
  );
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "0", {});

  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.END_TURN,
    "1",
    {},
    100,
    createBetrayalScriptedRandom(2, 2, 1),
  );
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "2", {});
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.STUDY_EXORCISM,
    "0",
    {},
    100,
    hauntSuccessRandom,
  );
  core.currentExplorer.roomId = "basement-landing";
  core.activeRoomId = "basement-landing";
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.EXORCISE_JACK,
    "0",
    {},
    100,
    hauntSuccessRandom,
  );

  return core;
}

export function createFirstScenarioReadyToExorciseCore(): BetrayalCore {
  let core = createFirstScenarioHauntCore();
  const hauntProgressRandom = createBetrayalScriptedRandom(
    3,
    3,
    3,
    3, // 图书馆成功
    3,
    3,
    1,
    1,
    1,
    1,
    1,
    1, // 对攻击倒叛徒：英雄 12(+2) vs 叛徒 6
    2,
    2,
    2, // 杰克之灵移动到 basement-landing
    3,
    3,
    3,
    3, // 第一处驱魔法阵成功
    3,
    3,
    3,
    3, // 第二处驱魔法阵成功
  );

  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-west",
  });
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.LEARN_ABOUT_JACK,
    "0",
    {},
    100,
    hauntProgressRandom,
  );
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "0", {});

  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "1", {});
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "2", {});

  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "grand-staircase",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "basement-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "basement-east",
  });
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.HAUNT_ATTACK,
    "0",
    { target: "traitor" },
    100,
    hauntProgressRandom,
  );
  core = resolvePendingDamageAllocation(core);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "0", {});
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "1", {});
  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "2", {
    roomId: "basement-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "2", {});

  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "basement-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "grand-staircase",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-north",
  });
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.STUDY_EXORCISM,
    "0",
    {},
    100,
    hauntProgressRandom,
  );
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "0", {});

  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.END_TURN,
    "1",
    {},
    100,
    createBetrayalScriptedRandom(2, 2, 1),
  );
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "2", {});
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.STUDY_EXORCISM,
    "0",
    {},
    100,
    hauntProgressRandom,
  );
  core.currentExplorer.roomId = "basement-landing";
  core.activeRoomId = "basement-landing";

  return core;
}

export function createFirstScenarioReadyToExorciseTutorialCore(): BetrayalCore {
  return applyTutorialDiscoveryOrder(createFirstScenarioReadyToExorciseCore());
}

export function createFirstScenarioReadyToLearnAboutJackCore(): BetrayalCore {
  let core = createFirstScenarioHauntCore();
  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-west",
  });
  return core;
}

export function createFirstScenarioReadyToStudyExorcismCore(): BetrayalCore {
  let core = createFirstScenarioHauntCore();
  const hauntProgressRandom = createBetrayalScriptedRandom(3, 3, 3, 3);

  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-west",
  });
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.LEARN_ABOUT_JACK,
    "0",
    {},
    100,
    hauntProgressRandom,
  );
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "0", {});
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.END_TURN,
    "1",
    {},
    100,
    createBetrayalScriptedRandom(2, 2, 1),
  );
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "2", {});
  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-north",
  });

  return core;
}

export function createTradeReadyCore(): BetrayalCore {
  const core = createStartedFirstScenarioCore();
  const teammate = core.otherExplorers.find(
    (explorer) => explorer.playerId === "1",
  )!;
  const traitor = core.otherExplorers.find(
    (explorer) => explorer.playerId === "2",
  )!;

  core.currentExplorer = {
    ...core.currentExplorer,
    roomId: "hallway",
    inventory: [
      { id: "rope", name: "兔脚", kind: "item" },
      { id: "omen-book", name: "书本", kind: "omen" },
    ],
  };
  core.otherExplorers = [
    {
      ...teammate,
      roomId: "hallway",
      inventory: [],
    },
    {
      ...traitor,
      roomId: "entrance-hall",
    },
  ];
  core.activeRoomId = "hallway";
  core.currentExplorerInventory = [...core.currentExplorer.inventory];
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.recommendedAction = "trade";
  core.usedCardIdsThisTurn = [];
  core.pendingEventChoice = null;
  core.recentRoll = null;
  core.latestDiscovery = null;
  core.latestDiscoveryOwnerPlayerId = null;

  return core;
}

export function createTradeReadyTutorialCore(): BetrayalCore {
  return applyTutorialDiscoveryOrder(createTradeReadyCore());
}

export function createExchangeReadyCore(): BetrayalCore {
  const core = createTradeReadyCore();
  core.otherExplorers = core.otherExplorers.map((explorer) =>
    explorer.playerId === "1"
      ? {
          ...explorer,
          inventory: [
            { id: "map", name: "地图", kind: "item" },
            { id: "skull", name: "头骨", kind: "omen" },
          ],
        }
      : explorer,
  );
  core.currentExplorerInventory = [...core.currentExplorer.inventory];
  core.turnStartInventoryCardIds = core.currentExplorer.inventory.map(
    (card) => card.id,
  );
  return core;
}

export function createExchangeReadyTutorialCore(): BetrayalCore {
  return applyTutorialDiscoveryOrder(createExchangeReadyCore());
}

export function createDogTradeReadyCore(): BetrayalCore {
  const core = createStartedFirstScenarioCore();
  const teammate = core.otherExplorers.find(
    (explorer) => explorer.playerId === "1",
  )!;
  const traitor = core.otherExplorers.find(
    (explorer) => explorer.playerId === "2",
  )!;

  core.currentExplorer = {
    ...core.currentExplorer,
    roomId: "entrance-hall",
    inventory: [
      { id: "dog", name: "狗", kind: "omen" },
      { id: "medical-kit", name: "急救包", kind: "item" },
      { id: "map", name: "地图", kind: "item" },
    ],
  };
  core.otherExplorers = [
    {
      ...teammate,
      roomId: "upper-landing",
      inventory: [],
    },
    {
      ...traitor,
      roomId: "basement-east",
      inventory: [],
    },
  ];
  core.activeRoomId = "entrance-hall";
  core.currentExplorerInventory = [...core.currentExplorer.inventory];
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.turnStartInventoryCardIds = ["dog", "medical-kit", "map"];
  core.usedCardIdsThisTurn = [];
  core.recommendedAction = "trade";
  core.latestDiscovery = null;
  core.latestDiscoveryOwnerPlayerId = null;

  return core;
}

export function createMedicalKitUseReadyCore(): BetrayalCore {
  const core = createStartedFirstScenarioCore();
  const teammate = core.otherExplorers.find(
    (explorer) => explorer.playerId === "1",
  )!;
  const traitor = core.otherExplorers.find(
    (explorer) => explorer.playerId === "2",
  )!;

  core.currentExplorer = {
    ...core.currentExplorer,
    roomId: "hallway",
    inventory: [{ id: "medical-kit", name: "急救包", kind: "item" }],
  };
  core.otherExplorers = [
    {
      ...teammate,
      roomId: "hallway",
      traits: {
        ...teammate.traits,
        might: 1,
        speed: 1,
        knowledge: 1,
        sanity: 1,
      },
    },
    {
      ...traitor,
      roomId: "entrance-hall",
    },
  ];
  core.activeRoomId = "hallway";
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.currentExplorerInventory = [...core.currentExplorer.inventory];
  core.turnStartInventoryCardIds = ["medical-kit"];
  core.usedCardIdsThisTurn = [];
  core.recommendedAction = "use";
  core.latestDiscovery = null;
  core.latestDiscoveryOwnerPlayerId = null;

  return core;
}

export function createHolyWaterUseReadyCore(): BetrayalCore {
  const core = createStartedFirstScenarioCore();

  core.currentExplorer = {
    ...core.currentExplorer,
    roomId: "hallway",
    traits: {
      ...core.currentExplorer.traits,
      might: 1,
      speed: 1,
    },
    inventory: [{ id: "holy-water", name: "奇怪的药品", kind: "item" }],
  };
  core.activeRoomId = "hallway";
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.currentExplorerInventory = [...core.currentExplorer.inventory];
  core.turnStartInventoryCardIds = ["holy-water"];
  core.usedCardIdsThisTurn = [];
  core.recommendedAction = "use";
  core.latestDiscovery = null;
  core.latestDiscoveryOwnerPlayerId = null;

  return core;
}

export function createSkeletonKeyMoveReadyCore(): BetrayalCore {
  const core = createStartedFirstScenarioCore();

  core.currentExplorer = {
    ...core.currentExplorer,
    roomId: "upper-landing",
    inventory: [{ id: "lockpick-tool", name: "骨制钥匙", kind: "item" }],
  };
  core.activeRoomId = "upper-landing";
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.currentExplorerInventory = [...core.currentExplorer.inventory];
  core.turnStartInventoryCardIds = ["lockpick-tool"];
  core.usedCardIdsThisTurn = [];
  setScenarioTestTurnMovement(core, 2);
  core.recommendedAction = "move";
  core.latestDiscovery = null;
  core.latestDiscoveryOwnerPlayerId = null;
  core.rooms = core.rooms.map((room) => {
    if (room.id === "upper-landing") {
      return {
        ...room,
        doorways: room.doorways.filter(
          (doorway) => doorway.connectsToRoomId !== "upper-west",
        ),
      };
    }
    if (room.id === "upper-west") {
      return {
        ...room,
        name: "图书馆",
        state: "discovered",
        hint: "已发现的相邻上层房间",
        tags: ["知识", "调查", "图书馆"],
        discoveryReward: "event",
        visualId: "library",
        doorways: room.doorways.filter(
          (doorway) => doorway.connectsToRoomId !== "upper-landing",
        ),
      };
    }
    return room;
  });

  return core;
}

export function createMaskMoveReadyCore(): BetrayalCore {
  const core = createStartedFirstScenarioCore();
  const teammate = core.otherExplorers.find(
    (explorer) => explorer.playerId === "1",
  )!;
  const traitor = core.otherExplorers.find(
    (explorer) => explorer.playerId === "2",
  )!;

  core.currentExplorer = {
    ...core.currentExplorer,
    roomId: "hallway",
    inventory: [{ id: "mask", name: "面具", kind: "omen" }],
  };
  core.otherExplorers = [
    {
      ...teammate,
      roomId: "hallway",
      inventory: [],
    },
    {
      ...traitor,
      roomId: "upper-landing",
      inventory: [],
    },
  ];
  core.activeRoomId = "hallway";
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.currentExplorerInventory = [...core.currentExplorer.inventory];
  core.turnStartInventoryCardIds = ["mask"];
  core.usedCardIdsThisTurn = [];
  core.recommendedAction = "use";
  core.latestDiscovery = null;
  core.latestDiscoveryOwnerPlayerId = null;

  return core;
}

export function createHeroAttackTraitorReadyCore(): BetrayalCore {
  let core = createFirstScenarioHauntCore();
  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "grand-staircase",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "basement-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "basement-east",
  });
  core.pendingEventChoice = null;
  core.recentRoll = null;
  core.latestDiscovery = null;
  core.latestDiscoveryOwnerPlayerId = null;
  return core;
}

export function createHeroAttackTraitorReadyTutorialCore(): BetrayalCore {
  return applyTutorialDiscoveryOrder(createHeroAttackTraitorReadyCore());
}

export function playFirstScenarioToTraitorVictory(): BetrayalCore {
  let core = createFirstScenarioHauntCore();
  const traitorWinRandom = createBetrayalScriptedRandom(
    3,
    3,
    3,
    3,
    1,
    1,
    1,
    1, // 第一次对攻击倒英雄：叛徒 8 vs 英雄 0
    3,
    3,
    3,
    3,
    1,
    1,
    1,
    1, // 第二次对攻击倒英雄
  );

  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "grand-staircase",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "hallway",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "ground-north",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "0", {});

  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "1", {
    roomId: "hallway",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "1", {
    roomId: "ground-north",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "1", {});

  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "2", {
    roomId: "basement-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "2", {
    roomId: "grand-staircase",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "2", {
    roomId: "hallway",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "2", {
    roomId: "ground-north",
  });
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.HAUNT_ATTACK,
    "2",
    { target: "hero", targetPlayerId: "0" },
    100,
    traitorWinRandom,
  );
  core = resolvePendingDamageAllocation(core);

  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "2", {});
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "1", {});
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.HAUNT_ATTACK,
    "2",
    { target: "hero", targetPlayerId: "1" },
    100,
    traitorWinRandom,
  );
  core = resolvePendingDamageAllocation(core);

  return core;
}

export function createFirstScenarioReadyToTraitorVictoryCore(): BetrayalCore {
  let core = createFirstScenarioHauntCore();
  const traitorWinRandom = createBetrayalScriptedRandom(
    3,
    3,
    3,
    3,
    1,
    1,
    1,
    1, // 第一次对攻击倒英雄：叛徒 8 vs 英雄 0
    3,
    3,
    3,
    3,
    1,
    1,
    1,
    1, // 第二次对攻击倒英雄
  );

  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "grand-staircase",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "hallway",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "ground-north",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "0", {});

  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "1", {
    roomId: "hallway",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "1", {
    roomId: "ground-north",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "1", {});

  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "2", {
    roomId: "basement-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "2", {
    roomId: "grand-staircase",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "2", {
    roomId: "hallway",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "2", {
    roomId: "ground-north",
  });
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.HAUNT_ATTACK,
    "2",
    { target: "hero", targetPlayerId: "0" },
    100,
    traitorWinRandom,
  );
  core = resolvePendingDamageAllocation(core);

  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "2", {});
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "1", {});

  return focusCoreOnExplorer(core, "2");
}

export function createFirstScenarioReadyToTraitorVictoryTutorialCore(): BetrayalCore {
  return applyTutorialDiscoveryOrder(
    createFirstScenarioReadyToTraitorVictoryCore(),
  );
}

export function createCorpseLootReadyCore(): BetrayalCore {
  const core = createFirstScenarioHauntCore();
  const current = core.otherExplorers.find(
    (explorer) => explorer.playerId === "1",
  )!;
  const corpse = core.currentExplorer;
  const traitor = core.otherExplorers.find(
    (explorer) => explorer.playerId === "2",
  )!;

  core.currentPlayer = "1";
  core.currentExplorer = {
    ...current,
    roomId: "hallway",
  };
  core.otherExplorers = [
    {
      ...corpse,
      roomId: "hallway",
      inventory: [
        { id: "corpse-item-1", name: "匕首", kind: "item" },
        { id: "corpse-omen-1", name: "黑暗预兆", kind: "omen" },
      ],
    },
    {
      ...traitor,
      roomId: "basement-east",
    },
  ];
  core.activeRoomId = "hallway";
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.currentExplorerInventory = [...core.currentExplorer.inventory];
  core.scenarioRuntime.deadExplorerPlayerIds = ["0"];
  core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn = [];
  setScenarioTestTurnMovement(core, 4);
  core.recommendedAction = "trade";
  core.usedCardIdsThisTurn = [];
  core.pendingEventChoice = null;
  core.recentRoll = null;
  core.latestDiscovery = null;
  core.latestDiscoveryOwnerPlayerId = null;

  return core;
}

export function createJackSpiritReviveReadyCore(): BetrayalCore {
  let core = createFirstScenarioHauntCore();

  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "grand-staircase",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "basement-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "basement-east",
  });
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.HAUNT_ATTACK,
    "0",
    { target: "traitor" },
    100,
    createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
  );
  core = resolvePendingDamageAllocation(core);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "0", {});
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.END_TURN,
    "1",
    {},
    100,
    createBetrayalScriptedRandom(2, 2, 1),
  );
  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "2", {
    roomId: "basement-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "2", {
    roomId: "basement-east",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "2", {});
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "0", {});

  return core;
}

export function createJackSpiritNaturalMonsterTurnBeforeRollCore(): BetrayalCore {
  let core = createFirstScenarioHauntCore();

  setScenarioTestTurnMovement(core, 6);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "upper-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "grand-staircase",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "basement-landing",
  });
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "basement-east",
  });
  core = applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.HAUNT_ATTACK,
    "0",
    { target: "traitor" },
    100,
    createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
  );
  core = resolvePendingDamageAllocation(core);
  return applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "0", {});
}

export function createJackSpiritMovementRollReadyCore(): BetrayalCore {
  const core = createJackSpiritNaturalMonsterTurnBeforeRollCore();
  return applyBetrayalCommand(
    core,
    BETRAYAL_COMMANDS.END_TURN,
    "1",
    {},
    100,
    createBetrayalScriptedRandom(2, 2, 1),
  );
}

export function createJackSpiritPostReviveAttackReadyCore(): BetrayalCore {
  let core = createJackSpiritReviveReadyCore();
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, "1", {});
  return focusCoreOnExplorer(core, "2");
}

export function createJackSpiritPostReviveAttackReadyTutorialCore(): BetrayalCore {
  const attackReadyCore = createJackSpiritMovementRollReadyCore();
  return applyTutorialDiscoveryOrder(
    {
      ...attackReadyCore,
      recentRoll: null,
    },
  );
}
