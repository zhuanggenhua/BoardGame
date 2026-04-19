/**
 * 渲染组件提示词 Hook
 * 
 * 仅处理渲染组件相关的提示词生成
 */

import { useCallback } from 'react';
import { usePromptContext } from '../../context';
import { TECH_STACK, OUTPUT_RULES, CODE_STYLE_RULES } from '../promptUtils';
import type { SchemaDefinition } from '../../schema/types';

interface RenderPromptOptions {
  requirement?: string;
  schema?: SchemaDefinition;
}

/**
 * 渲染组件提示词生成器
 * 
 * 职责：生成正面/背面渲染代码的提示词
 */
export function useRenderPrompt() {
  const ctx = usePromptContext();

  const buildContext = useCallback((schema?: SchemaDefinition) => {
    const targetSchema = schema || ctx.currentSchema;
    if (!targetSchema) return '';

    const fieldEntries = Object.entries(targetSchema.fields);
    const fields = fieldEntries
      .map(([k, f]) => {
        const access = f.type === 'array' ? `(data.${k} as string[])` : `data.${k}`;
        return `- \`${access}\`: ${f.type} - ${f.label}${f.description ? ` - ${f.description}` : ''}`;
      })
      .join('\n');

    // 生成使用示例
    const exampleFields = fieldEntries.slice(0, 3).map(([k, f]) => {
      if (f.type === 'array') return `{(data.${k} as string[])?.map(t => <span key={t}>{t}</span>)}`;
      if (f.type === 'number') return `<span>{data.${k} as number}</span>`;
      return `<span>{data.${k} as string}</span>`;
    }).join('\n    ');

    // 从传入的 schema 提取标签（优先使用 schema 自带的，其次使用 Context 的）
    const schemaTagsByGroup: Record<string, string[]> = {};
    if (targetSchema.tagDefinitions && targetSchema.tagDefinitions.length > 0) {
      targetSchema.tagDefinitions.forEach(t => {
        const group = t.group || '未分组';
        if (!schemaTagsByGroup[group]) schemaTagsByGroup[group] = [];
        if (!schemaTagsByGroup[group].includes(t.name)) {
          schemaTagsByGroup[group].push(t.name);
        }
      });
    }
    // 合并 Context 的标签（作为补充）
    const mergedTagsByGroup = { ...ctx.tagsByGroup, ...schemaTagsByGroup };
    
    const tagDetails = Object.entries(mergedTagsByGroup)
      .map(([group, tags]) => `- **${group}**: ${tags.join(', ')}`)
      .join('\n');
    
    // 生成更智能的标签使用示例
    const groups = Object.entries(mergedTagsByGroup);
    const tagUsage = groups.length > 0
      ? `
## 可用标签（按分组）
${tagDetails}

## 标签访问方法
\`\`\`tsx
const tags = data.tags as string[];
\`\`\`

## 各分组标签判断示例
${groups.map(([group, tags]) => {
  const examples = tags.slice(0, 3);
  return `### ${group}
\`\`\`tsx
// 获取该分组的标签（${group}）
const ${group}Tag = tags?.find(t => [${examples.map(t => `'${t}'`).join(', ')}].includes(t));

// 判断是否包含特定${group}
const is${examples[0] || '某值'} = tags?.includes('${examples[0] || '某值'}');

// 根据${group}显示不同样式
{${group}Tag === '${examples[0]}' && <span className="text-red-500">{${group}Tag}</span>}
{${group}Tag === '${examples[1] || examples[0]}' && <span className="text-blue-500">{${group}Tag}</span>}
\`\`\``;
}).join('\n\n')}`
      : '';

    return `## 游戏: ${ctx.gameName || '未命名游戏'}
${ctx.gameDescription || ''}

## Schema: ${targetSchema.name}
${targetSchema.description || ''}

## data 参数说明
传入的 \`data\` 是一个对象，包含以下字段（直接使用 \`data.xxx\`，不要重新定义变量）：
${fields}

## 使用示例
\`\`\`tsx
(data: Record<string, unknown>) => (
  <div className="...">
    ${exampleFields}
  </div>
)
\`\`\`
${tagUsage}`;
  }, [ctx]);

  /** 生成正面渲染提示词 */
  const generateFront = useCallback((options: RenderPromptOptions = {}) => {
    const context = buildContext(options.schema);
    return `你是一个 React 渲染组件生成器。

${TECH_STACK}

${context}

## 需求
${options.requirement || '显示数据'}

## 样式要求（重要）
- 根元素必须使用 \`className="relative w-full h-full"\` 填满父容器并作为定位参照
- 不要使用固定尺寸（如 w-20 h-28）
- 父容器会在画布中设置实际尺寸（约100px × 140px）
- 避免使用 \`overflow-hidden\`，防止绝对定位元素被裁剪
- 多个绝对定位层需要合理设置 \`z-index\`（如 z-10, z-20）确保层叠顺序正确
- **定位使用内联样式**：使用 \`style={{ top: '8%', left: '8%' }}\` 而非 Tailwind 的 \`top-[8%]\` 语法
- 这是因为 Tailwind 4 的动态类可能不会被正确编译

## 定位示例
\`\`\`tsx
// 左上角
<div className="absolute z-10" style={{ top: '8%', left: '8%' }}>...</div>
// 右下角
<div className="absolute z-10" style={{ bottom: '8%', right: '8%' }}>...</div>
// 居中
<div className="absolute inset-0 flex items-center justify-center z-0">...</div>
\`\`\`

## 输出格式
(data: Record<string, unknown>) => (<div className="relative w-full h-full ...">...</div>)

${OUTPUT_RULES}
${CODE_STYLE_RULES}`;
  }, [buildContext]);

  /** 生成背面渲染提示词 */
  const generateBack = useCallback((options: RenderPromptOptions = {}) => {
    return `你是一个 React 渲染组件生成器，生成背面代码。

${TECH_STACK}

## 游戏: ${ctx.gameName}

## 需求
${options.requirement || '生成背面样式'}

## 样式要求（重要）
- 根元素必须使用 \`relative w-full h-full\` 填满父容器并作为定位参照
- 不要使用固定尺寸
- 父容器会在画布中设置实际尺寸
- 避免使用 \`overflow-hidden\`
- 使用百分比定位而非固定像素

## 输出格式
() => (<div className="relative w-full h-full ...">背面样式</div>)

说明：背面不需要 data 参数，显示统一图案

${OUTPUT_RULES}
${CODE_STYLE_RULES}`;
  }, [ctx.gameName]);

  return { generateFront, generateBack };
}
