/**
 * AI 提示词生成函数
 */

import type { SchemaDefinition } from '../schema/types';
import type { BuilderState } from '../context';
import { buildRequirementsText } from '../utils/requirements';
import { generateUnifiedPrompt, TECH_STACK, OUTPUT_RULES } from '../ai/promptUtils';
import type { AIGenType } from './builderTypes';

export function buildActionHookPrompt({
  requirement,
  componentType,
}: {
  requirement?: string;
  componentType?: string;
}): string {
  const requirementText = requirement?.trim() ? requirement.trim() : '实现按钮交互';
  const sourceInfo = componentType ? `组件类型: ${componentType}` : '组件类型: 未指定';
  return `你是一个动作钩子代码生成器。

${TECH_STACK}

## 触发来源
${sourceInfo}
- 点击动作按钮时触发

## 可用输入 payload
- payload.action: { id, label, scope, requirement? }
- payload.context: { componentId, componentType, currentPlayerId, resolvedPlayerId, resolvedPlayerIndex }
- payload.state: UGCGameState | null
- payload.sdk: UGCViewSdk | null
- payload.dispatchCommand: (command: { type?: string; payload?: Record<string, unknown> }) => string

## SDK 可用方法（存在时调用）
- payload.sdk.playCard(cardId, targetIds?)
- payload.sdk.selectTarget(targetIds)
- payload.sdk.endPhase()
- payload.sdk.endTurn()
- payload.sdk.drawCard(count?)
- payload.sdk.discardCard(cardIds)
- payload.sdk.respond(responseType, params?)
- payload.sdk.pass()

## 支持返回命令（推荐）
可直接 return 命令对象或数组，框架会自动调用 sendCommand：
- { type?: string; payload?: Record<string, unknown> }
- type 为空时默认使用 "ACTION"
- payload 会自动合并 actionId/actionLabel/componentId/componentType

## 用户需求
${requirementText}

## 函数签名（必须严格遵守）
(payload: { action: Record<string, unknown>; context: Record<string, unknown>; state: unknown; sdk: unknown; dispatchCommand: (command: { type?: string; payload?: Record<string, unknown> }) => string }) => void | { type?: string; payload?: Record<string, unknown> } | { type?: string; payload?: Record<string, unknown> }[] | Promise<void | { type?: string; payload?: Record<string, unknown> } | { type?: string; payload?: Record<string, unknown> }[]>

${OUTPUT_RULES}

## 输出格式（只输出函数体）
(payload) => {
  return {
    type: 'ACTION',
    payload: {
      detail: '触发动作',
    },
  };
}`;
}

export function generateAIPrompt(
  type: AIGenType, 
  schema: SchemaDefinition | undefined,
  state: BuilderState,
): string {
  if (!type || !schema) return '';
  
  const schemaFields = Object.entries(schema.fields)
    .map(([k, f]) => `- ${k}: ${f.type} (${f.label})${f.description ? ` - ${f.description}` : ''}`)
    .join('\n');

  const allSchemas = state.schemas
    .map(s => `- ${s.name} (${s.id}): ${Object.keys(s.fields).length}个字段`)
    .join('\n');

  const renderComponents = state.renderComponents.length > 0
    ? `\n渲染组件: ${state.renderComponents.map(rc => rc.name).join(', ')}`
    : '';

  const gameContext = `## 游戏上下文
游戏名称: ${state.name}
游戏描述: ${state.description || '未设置'}
所有 Schema:
${allSchemas}${renderComponents}`;

  const requirementsText = buildRequirementsText(state.requirements);

  if (type === 'batch-data' || type === 'batch-tags') {
    return generateUnifiedPrompt({
      type,
      requirement: requirementsText,
      schema,
      gameState: {
        name: state.name,
        description: state.description,
        schemas: state.schemas,
        renderComponents: state.renderComponents,
        instances: state.instances,
      },
    });
  }

  if (type === 'ability-field') {
    const attributeCandidates = state.schemas
      .map(s => {
        const fields = Object.entries(s.fields)
          .filter(([, f]) => f.type === 'number')
          .map(([key]) => key);
        return fields.length > 0 ? `- ${s.name} (${s.id}): ${fields.join(', ')}` : null;
      })
      .filter((line): line is string => Boolean(line))
      .join('\n');
    const attributeInfo = attributeCandidates
      ? `\n## 可能的属性/资源字段（可用作 attrId/cost）\n${attributeCandidates}`
      : '\n## 可能的属性/资源字段（可用作 attrId/cost）\n无';

    return `你是一个 GAS 能力数据生成器。请根据需求生成 AbilityDefinition JSON（不是代码）。

${gameContext}

## 目标 Schema: ${schema.name}
字段定义:
${schemaFields}
${attributeInfo}

## 用户需求
${requirementsText}

## GAS 结构要求（必须严格遵守）
- AbilityDefinition 字段: id, name, description?, tags?, trigger?, effects?, variants?, cooldown?, cost?
- trigger/condition 使用 EffectCondition：
  - always / hasTag / attributeCompare / and / or / not
- EffectDefinition 字段: id, name?, description?, operations, condition?
- EffectOperation 类型：
  - modifyAttribute / setAttribute / addTag / removeTag / custom
- TargetRef: self | target | allPlayers | allEnemies | { entityId: string }
- Expression: number | { type: 'attribute', entityId, attrId } | add/subtract/multiply/min/max
- custom 操作使用 actionId + params，自定义逻辑由游戏层实现

## custom actionId 命名规范
- 使用 kebab-case
- 建议以 abilityId 作为前缀，例如 "ability-1-transfer-resource"

${TECH_STACK}

## 输出格式（JSON 数组）
[
  {
    "id": "entity-1",
    "abilities": [
      {
        "id": "ability-1",
        "name": "能力名称",
        "trigger": { "type": "always" },
        "effects": [
          {
            "id": "effect-1",
            "operations": [
              { "type": "modifyAttribute", "target": "target", "attrId": "attributeA", "value": -1 }
            ]
          }
        ]
      }
    ]
  }
]

要求：
1. 只输出纯 JSON，不要 markdown 代码块或解释
2. abilities 为数组，每个元素是 AbilityDefinition
3. trigger/condition 必须使用 EffectCondition 结构，不要使用字符串条件
4. operations 必须是数组，单步也用数组表示`;
  }

  return '';
}
