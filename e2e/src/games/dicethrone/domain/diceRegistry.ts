/**
 * DiceThrone 骰子定义注册表（本地）
 *
 * 取代 systems/DiceSystem 全局单例。
 * 仅负责存储骰子定义并提供按点数查找骰面的能力。
 */

import type { DiceDefinition, DieFaceDefinition } from '../../../engine/primitives';
import { getFaceByValue } from '../../../engine/primitives';

const diceDefinitions = new Map<string, DiceDefinition>();

export function registerDiceDefinition(def: DiceDefinition): void {
    diceDefinitions.set(def.id, def);
}

export function getDiceDefinition(definitionId: string): DiceDefinition | undefined {
    return diceDefinitions.get(definitionId);
}

export function getDieFaceByValue(definitionId: string, value: number): DieFaceDefinition | undefined {
    const def = diceDefinitions.get(definitionId);
    if (!def) return undefined;
    return getFaceByValue(def, value);
}
