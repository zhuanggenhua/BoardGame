/**
 * AI 提示词生成器
 * 
 * 根据用户定义的 Schema、数据实例和 UI 布局，生成游戏规则代码的提示词
 */

import type { SchemaDefinition } from '../schema/types';
import type { SceneComponent } from '../ui/SceneCanvas';

// ============================================================================
// 类型定义
// ============================================================================

export interface GameContext {
  /** 游戏名称 */
  name: string;
  /** 游戏描述 */
  description: string;
  /** Schema 定义列表 */
  schemas: SchemaDefinition[];
  /** 数据实例（按 Schema ID 分组） */
  instances: Record<string, Record<string, unknown>[]>;
  /** UI 布局组件 */
  layout: SceneComponent[];
  /** 用户定义的 Tag */
  tags: string[];
}

// 分模块模板已移除，仅保留完整规则提示词

// ============================================================================
// 提示词生成器
// ============================================================================

export class PromptGenerator {
  private context: GameContext;

  constructor(context: GameContext) {
    this.context = context;
  }

  /** 生成完整的游戏规则提示词 */
  generateFullPrompt(requirement?: string): string {
    const requirementText = requirement?.trim() ? requirement.trim() : '未补充需求';
    return `你是一个桌游规则代码生成专家。请根据以下游戏定义，生成可在 UGC 沙箱执行的规则代码。

## 游戏信息
- 名称: ${this.context.name}
- 描述: ${this.context.description}
- 标签: ${this.context.tags.join(', ') || '无'}

## 用户需求
${requirementText}

## Schema 定义
${this.context.schemas.map(s => `
### ${s.name} (${s.id})
${s.description || ''}
字段:
${Object.entries(s.fields).map(([k, f]) => `- ${k}: ${f.type} (${f.label})${f.required ? ' [必填]' : ''}`).join('\n')}
`).join('\n')}

## 数据实例
${Object.entries(this.context.instances).map(([schemaId, items]) => `
### ${schemaId}
共 ${items.length} 条数据
${items.slice(0, 5).map(item => JSON.stringify(item, null, 2)).join('\n')}
${items.length > 5 ? `... 还有 ${items.length - 5} 条` : ''}
`).join('\n')}

## UI 布局
${this.context.layout.map(c => `- ${c.type}: ${String(c.data.name || c.type)} (${c.width}x${c.height} @ anchor ${c.anchor.x},${c.anchor.y} + offset ${c.offset.x},${c.offset.y} | pivot ${c.pivot.x},${c.pivot.y} | rotation ${c.rotation ?? 0})`).join('\n') || '未配置'}

## 输出契约（必须遵守）
请输出一个名为 \`domain\` 的对象，并包含以下方法（函数签名必须一致）：

\`\`\`ts
const domain = {
  gameId: string,
  setup(playerIds: string[], random: { random(): number; d(max: number): number; range(min: number, max: number): number; shuffle<T>(array: T[]): T[] }): UGCGameState,
  validate(state: UGCGameState, command: Command): { valid: boolean; error?: string },
  execute(state: UGCGameState, command: Command, random: { random(): number; d(max: number): number; range(min: number, max: number): number; shuffle<T>(array: T[]): T[] }): GameEvent[],
  reduce(state: UGCGameState, event: GameEvent): UGCGameState,
  playerView?(state: UGCGameState, playerId: string): Partial<UGCGameState>,
  isGameOver?(state: UGCGameState): { winner?: string; winners?: string[]; draw?: boolean; scores?: Record<string, number> } | undefined,
};
\`\`\`

### Command 结构
\`\`\`ts
type Command = {
  type: string;
  playerId: string;
  payload: Record<string, unknown>;
  timestamp?: number;
};
\`\`\`

### GameEvent 结构
\`\`\`ts
type GameEvent = {
  type: string;
  payload: Record<string, unknown>;
  timestamp?: number;
  sourceCommandType?: string;
  sfxKey?: string;
};
\`\`\`

### UGCGameState 结构
\`\`\`ts
type UGCGameState = {
  phase: string;
  activePlayerId: string;
  turnNumber: number;
  players: Record<string, {
    resources: Record<string, number>;
    handCount: number;
    deckCount: number;
    discardCount: number;
    statusEffects: Record<string, number>;
    public?: Record<string, unknown>;
  }>;
  publicZones?: Record<string, unknown>;
  gameOver?: { winner?: string; draw?: boolean };
};
\`\`\`

## 要求
1. 必须输出 \`const domain = {...}\`，并且可直接在沙箱中执行
2. 仅使用内置对象与参数，禁止 import/require
3. 状态必须保持可序列化、确定性
4. 若需要随机数，仅使用传入的 random
5. **效果执行必须使用现有 engine/primitives**（effects.ts + condition/expression/target）
6. 禁止重新实现效果执行器，仅编排 primitives 能力数据与游戏规则调用
7. 使用 TypeScript 风格（但无需类型导入）
8. 添加必要的中文注释

请直接输出代码：`;
  }

}

// ============================================================================
// 工具函数
// ============================================================================

/** 创建空的游戏上下文 */
export function createEmptyContext(): GameContext {
  return {
    name: '新游戏',
    description: '',
    schemas: [],
    instances: {},
    layout: [],
    tags: [],
  };
}

