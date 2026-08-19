/**
 * 召唤师战争 - 领域工具函数
 */

import type {
  PlayerId,
  SummonerWarsCore,
  SummonerWarsSeatController,
} from './types';

/**
 * 全局自增计数器，用于生成唯一 instanceId。
 * 每局游戏从 1 开始递增，保证同一局内不重复。
 */
let instanceCounter = 0;

/**
 * 重置实例 ID 计数器（仅在游戏初始化时调用）
 */
export function resetInstanceCounter(startFrom = 0): void {
  instanceCounter = startFrom;
}

/**
 * 生成单位实例唯一 ID
 * 格式：`${cardId}#${序号}`，如 `frontier_archer#3`
 * 
 * @param cardId 卡牌类型 ID
 * @returns 唯一的 instanceId
 */
export function generateInstanceId(cardId: string): string {
  instanceCounter += 1;
  return `${cardId}#${instanceCounter}`;
}

/**
 * 从 instanceId 中提取 cardId
 * 例：`frontier_archer#3` → `frontier_archer`
 */
export function getCardIdFromInstanceId(instanceId: string): string {
  const idx = instanceId.lastIndexOf('#');
  return idx >= 0 ? instanceId.substring(0, idx) : instanceId;
}

/**
 * 构建技能使用次数追踪 key
 * 使用 instanceId 作为单位唯一标识。
 * 格式：`${instanceId}:${abilityId}`
 */
export function buildUsageKey(instanceId: string, abilityId: string): string {
  return `${instanceId}:${abilityId}`;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSeatControllerType(type: unknown): SummonerWarsSeatController['type'] | null {
  if (type === 'human' || type === 'local-ai' || type === 'remote-ai') {
    return type;
  }
  return typeof type === 'string' && type.length > 0 ? type : null;
}

export function normalizeSummonerWarsSeatControllers(
  value: unknown,
): Partial<Record<PlayerId, SummonerWarsSeatController>> | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const result: Partial<Record<PlayerId, SummonerWarsSeatController>> = {};
  for (const playerId of ['0', '1'] as PlayerId[]) {
    const controller = value[playerId];
    if (!isPlainRecord(controller)) {
      continue;
    }
    const type = normalizeSeatControllerType(controller.type);
    if (!type) {
      continue;
    }
    result[playerId] = { type };
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function normalizeSummonerWarsSeatControllersFromSetupData(
  setupData: unknown,
): Partial<Record<PlayerId, SummonerWarsSeatController>> | undefined {
  if (!isPlainRecord(setupData)) {
    return undefined;
  }
  if (setupData.enableAi === false) {
    return undefined;
  }
  return normalizeSummonerWarsSeatControllers(setupData.seatControllers);
}

export function isSummonerWarsAiSeat(core: SummonerWarsCore, playerId: PlayerId): boolean {
  const controllerType = core.seatControllers?.[playerId]?.type;
  return controllerType === 'local-ai' || controllerType === 'remote-ai';
}
