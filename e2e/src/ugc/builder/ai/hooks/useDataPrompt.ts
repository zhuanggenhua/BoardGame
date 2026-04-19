/**
 * 数据管理提示词 Hook
 * 
 * 处理数据批量生成、标签生成、排序/过滤的提示词
 */

import { useCallback } from 'react';
import { usePromptContext } from '../../context';
import { OUTPUT_RULES } from '../promptUtils';
import type { SchemaDefinition } from '../../schema/types';

interface DataPromptOptions {
  requirement?: string;
  schema?: SchemaDefinition;
}

/**
 * 数据管理提示词生成器
 * 
 * 职责：生成批量数据、标签、排序/过滤函数的提示词
 */
export function useDataPrompt() {
  const ctx = usePromptContext();

  const buildSchemaInfo = useCallback((schema?: SchemaDefinition) => {
    const targetSchema = schema || ctx.currentSchema;
    if (!targetSchema) return '无 Schema';

    const fields = Object.entries(targetSchema.fields)
      .map(([k, f]) => `- ${k}: ${f.type} (${f.label})`)
      .join('\n');

    const existingData = ctx.allInstances[targetSchema.id]?.slice(0, 2);
    const sample = existingData?.length 
      ? `\n\n## 已有数据示例\n${JSON.stringify(existingData, null, 2)}`
      : '';

    return `## Schema: ${targetSchema.name}
${targetSchema.description || ''}

## 字段
${fields}${sample}`;
  }, [ctx]);

  /** 生成批量数据提示词 */
  const generateBatchData = useCallback((options: DataPromptOptions = {}) => {
    const schemaInfo = buildSchemaInfo(options.schema);
    const tagGroups = Object.entries(ctx.tagsByGroup);
    const tags = tagGroups.length > 0
      ? `\n## 可用标签\n${tagGroups
          .map(([group, names]) => `- ${group}: ${names.join('、') || '无'}`)
          .join('\n')}\n注意：tags 字段必须使用上述标签名称`
      : '';

    return `你是一个游戏数据生成器。

## 游戏: ${ctx.gameName}
${ctx.gameDescription || ''}

${schemaInfo}
${tags}

## 需求
${options.requirement || '生成数据'}

## 输出格式
JSON 数组，每个元素包含 Schema 定义的所有字段。

## 示例
\`\`\`json
[
  { "id": "entity-1", "name": "实体一", "tags": ["分类A", "状态可用"], "description": "..." },
  { "id": "entity-2", "name": "实体二", "tags": ["分类B"], "description": "..." }
]
\`\`\`

## 注意事项
1. id 必须唯一，建议使用有意义的前缀
2. 严格按 Schema 字段类型生成
3. tags 必须使用已定义的标签名称

${OUTPUT_RULES}`;
  }, [ctx, buildSchemaInfo]);

  /** 生成标签提示词 */
  const generateTags = useCallback((options: DataPromptOptions = {}) => {
    return `你是一个 Tag 系统设计器。

## 游戏: ${ctx.gameName}
已有分组: ${ctx.allTagGroups.join(', ') || '无'}

## 需求
${options.requirement || '设计标签'}

## Tag 设计原则
Tag 描述**单个实体的固有属性**，不是组合规则或游戏逻辑。

✅ 正确使用（实体固有属性）：
- 分类属性（类别、类型、子类）
- 数值属性（等级、强度、成本）
- 状态属性（可用、已使用、禁用）

❌ 错误使用（这些是规则/逻辑，不是属性）：
- 组合规则 → 应在规则代码中定义
- 使用限制 → 应在 moves 代码中定义

## 输出格式
\`\`\`json
[
  { "name": "标签名1", "group": "分组名" },
  { "name": "标签名2", "group": "分组名" }
]
\`\`\`

${OUTPUT_RULES}`;
  }, [ctx]);

  return { generateBatchData, generateTags };
}
