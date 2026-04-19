/**
 * 提示词生成器 Hook
 * 
 * 使用 Context 自动获取游戏上下文，生成提示词
 */

import { useCallback, useMemo } from 'react';
import { usePromptContext } from '../context';
import { TECH_STACK, OUTPUT_RULES, CODE_STYLE_RULES, type PromptType } from './promptUtils';
import type { SchemaDefinition } from '../schema/types';

/** 提示词生成选项 */
interface PromptOptions {
  /** 用户需求描述 */
  requirement?: string;
  /** 覆盖默认 Schema（用于特定组件） */
  overrideSchema?: SchemaDefinition;
  /** 额外数据（如手牌列表） */
  componentData?: Record<string, unknown>[];
}

/** 使用 Context 的提示词生成器 */
export function usePromptGenerator() {
  const ctx = usePromptContext();

  // 构建游戏上下文字符串
  const gameContextStr = useMemo(() => {
    return `## 游戏上下文
游戏名称: ${ctx.gameName}
游戏描述: ${ctx.gameDescription || '未设置'}
所有 Schema: ${ctx.schemasSummary.join(', ') || '无'}
渲染组件: ${ctx.renderComponentNames.join(', ') || '无'}`;
  }, [ctx.gameName, ctx.gameDescription, ctx.schemasSummary, ctx.renderComponentNames]);

  // 构建数据参数说明
  const buildDataParamInfo = useCallback((schema?: SchemaDefinition) => {
    const targetSchema = schema || ctx.currentSchema;
    if (!targetSchema) return '## data 参数\n无 Schema';

    const fields = Object.entries(targetSchema.fields)
      .map(([k, f]) => {
        const accessHint = f.type === 'array' ? `(data.${k} as string[])` : `data.${k}`;
        return `- \`${accessHint}\`: ${f.type} - ${f.label}`;
      })
      .join('\n');

    const tagGroups = Object.entries(ctx.tagsByGroup);
    const tagInfo = tagGroups.length > 0
      ? `\n\n## 标签使用说明\ndata.tags 是字符串数组，可用标签：\n${tagGroups
          .map(([group, names]) => `- ${group}: ${names.join('、') || '无'}`)
          .join('\n')}\n使用: (data.tags as string[])?.includes('标签名')`
      : '';

    return `## data 参数结构（已传入，直接使用 data.xxx）\n${fields}${tagInfo}`;
  }, [ctx.currentSchema, ctx.tagsByGroup]);

  // 生成提示词
  const generate = useCallback((type: PromptType, options: PromptOptions = {}): string => {
    const { requirement = '', overrideSchema, componentData } = options;
    const schema = overrideSchema || ctx.currentSchema;
    const dataParamInfo = buildDataParamInfo(schema);

    // 数据示例
    const existingData = schema?.id ? ctx.allInstances[schema.id]?.slice(0, 2) : componentData?.slice(0, 2);
    const dataSampleText = existingData?.length
      ? `\n## 已有数据示例\n${JSON.stringify(existingData, null, 2)}`
      : '';

    switch (type) {
      case 'render-component':
        return `你是一个 React 渲染组件生成器。

${TECH_STACK}

${gameContextStr}

## 目标 Schema: ${schema?.name || '未选择'}
${schema?.description || ''}

${dataParamInfo}

## 用户需求
${requirement || '显示数据的基本信息'}

## 输出格式
(data: Record<string, unknown>) => (<div>...</div>)

${OUTPUT_RULES}
${CODE_STYLE_RULES}`;

      case 'render-component-back':
        return `你是一个 React 渲染组件生成器，专门生成**背面**渲染代码。

${TECH_STACK}

${gameContextStr}

## 用户需求
${requirement || '生成背面样式'}

## 输出格式
() => (<div>背面样式</div>)

说明：背面不需要 data 参数，显示统一图案

${OUTPUT_RULES}
${CODE_STYLE_RULES}`;

      case 'sort-function':
        return `你是一个排序函数生成器。

${TECH_STACK}

${dataParamInfo}

## 用户需求
${requirement}

## 输出格式
(a, b) => { /* 排序逻辑 */ return 0; }

${OUTPUT_RULES}`;

      case 'filter-function':
        return `你是一个过滤函数生成器。

${TECH_STACK}

${dataParamInfo}

## 用户需求
${requirement}

## 输出格式
(item, ctx) => { /* 过滤条件 */ return true; }

${OUTPUT_RULES}`;

      case 'layout-code':
        return `你是一个卡牌布局代码生成器。

${TECH_STACK}

## 用户需求
${requirement || '顺序排开'}

## 输出格式
(index, total) => ({ marginLeft: ..., transform: ..., zIndex: ... })

${OUTPUT_RULES}`;

      case 'select-effect':
        return `你是一个选中效果代码生成器。

${TECH_STACK}

## 用户需求
${requirement || '抬高一点'}

## 输出格式
(isSelected) => isSelected ? { /* 选中样式 */ } : {}

${OUTPUT_RULES}`;

      case 'batch-data':
        return `你是一个游戏数据生成器。

${gameContextStr}

## 目标 Schema: ${schema?.name}
${schema?.description || ''}

${dataParamInfo}
${dataSampleText}

## 用户需求
${requirement}

${TECH_STACK}

## 输出格式
JSON 数组：[{ "id": "...", "name": "...", "tags": [...] }, ...]

${OUTPUT_RULES}`;

      case 'batch-tags':
        return `你是一个 Tag 系统设计器。

${gameContextStr}

## 目标 Schema: ${schema?.name}
已有分组: ${ctx.allTagGroups.join(', ') || '无'}

## 用户需求
${requirement}

## Tag 设计原则
Tag 描述单个实体的固有属性，不是组合规则。

## 输出格式
[{ "name": "...", "group": "分组名" }, ...]

${OUTPUT_RULES}`;

      default:
        return '';
    }
  }, [ctx, gameContextStr, buildDataParamInfo]);

  return { generate, context: ctx };
}
