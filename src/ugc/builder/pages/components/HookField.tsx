/**
 * 通用钩子字段组件（AI辅助代码生成）
 */

import type { SchemaDefinition } from '../../schema/types';
import { BASE_UI_COMPONENTS } from '../uiComponents';

export function HookField({
  label,
  value,
  onChange,
  requirementValue,
  onRequirementChange,
  schema,
  hookType,
  placeholder,
  componentType,
  outputsSummary,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  requirementValue: string;
  onRequirementChange: (v: string) => void;
  schema: SchemaDefinition | undefined;
  hookType: 'sort' | 'filter' | 'layout' | 'selectEffect' | 'render';
  placeholder: string;
  componentType?: string;
  outputsSummary?: string;
}) {
  const requirementText = requirementValue.trim() ? requirementValue.trim() : '（未填写需求）';

  const generatePrompt = () => {
    const schemaFields = schema
      ? Object.entries(schema.fields).map(([k, f]) => `- ${k}: ${f.type} (${f.label})`).join('\n')
      : '无 Schema';
    
    const compDef = componentType 
      ? BASE_UI_COMPONENTS.flatMap(c => c.items).find(i => i.type === componentType)
      : undefined;
    const dataFormatInfo = compDef?.dataFormat 
      ? `\n## 组件接收数据格式\n${compDef.dataFormat}\n\n## 预制功能\n${compDef.presetFeatures || '无'}`
      : '';

    const tagsInfo = schema?.tagDefinitions?.length 
      ? `\n## 可用标签\n${[...new Set(schema.tagDefinitions.map(t => t.group || '未分组'))]
          .map(g => `- ${g}: ${schema.tagDefinitions?.filter(t => (t.group || '未分组') === g).map(t => t.name).join(', ')}`)
          .join('\n')}`
      : '';

    const outputsSection = outputsSummary
      ? `\n## 当前布局可用输出\n${outputsSummary}`
      : '';
    const playerContextInfo = componentType === 'player-area'
      ? `\n## 玩家上下文（系统注入，仅 player-area 可用）\n- playerIds: string[] - 玩家 ID 列表（由绑定 Schema 自动推导）\n- currentPlayerId: string | null - 当前玩家 ID\n- currentPlayerIndex: number - 当前玩家索引\n- resolvedPlayerId: string | null - 当前组件定位到的玩家 ID\n- resolvedPlayerIndex: number - 目标玩家索引\n- resolvedPlayer: Record<string, unknown> | undefined - 目标玩家数据\n- player: resolvedPlayer 的别名\n- isCurrentPlayer: boolean - 是否为当前玩家\n- isCurrentTurn: boolean - 预览中等价于 isCurrentPlayer\n\n### 组件配置字段（用于定位玩家）\n- playerRef: 'current' | 'index'\n  - current: 当前玩家\n  - index: 第 N 个玩家（使用 playerRefIndex）\n- playerRefIndex: number - 第 N 个玩家的索引（0 开始）\n\n### 关联示例（目标玩家的关联数据）\n\`\`\`tsx\nconst outputs = data.outputsByType?.['hand-zone'] || [];\nconst output = outputs[0];\nconst key = output?.bindEntity;\nconst relatedItems = key ? output.items.filter(item => item[key] === data.resolvedPlayerId) : [];\n\`\`\``
      : '';
    const filterContextInfo = componentType === 'hand-zone'
      ? `\n## 过滤上下文 ctx（系统注入，仅 hand-zone 可用）\n- playerIds: string[] - 玩家 ID 列表\n- currentPlayerId: string | null - 当前玩家 ID\n- currentPlayerIndex: number - 当前玩家索引\n- resolvedPlayerId: string | null - 目标玩家 ID\n- resolvedPlayerIndex: number - 目标玩家索引\n- bindEntity?: string - 归属字段（玩家ID）\n- zoneField?: string - 区域字段\n- zoneValue?: string - 区域值`
      : '';

    const templates: Record<string, string> = {
      sort: `你是一个排序比较函数生成器。\n${dataFormatInfo}\n## 数据结构\n${schemaFields}\n${tagsInfo}\n\n## 用户需求\n${requirementText}\n\n## 函数签名（必须严格遵守）\n(a: TItem, b: TItem) => number\n// 返回负数：a排在b前面\n// 返回正数：b排在a前面\n// 返回0：顺序不变\n\n## 输出格式（只输出函数体，不要包装）\n\`\`\`javascript\n(a, b) => 0\n\`\`\``,
      filter: `你是一个过滤判断函数生成器。\n${dataFormatInfo}\n## 数据结构\n${schemaFields}\n${tagsInfo}\n${filterContextInfo}\n\n## 用户需求\n${requirementText}\n\n## 函数签名（必须严格遵守）\n(item: TItem, ctx: Record<string, unknown>) => boolean\n// 返回 true：显示该项\n// 返回 false：隐藏该项\n\n## 输出格式（只输出函数体，不要包装）\n\`\`\`javascript\n(item, ctx) => true\n\`\`\``,
      layout: `你是一个布局代码生成器。\n${dataFormatInfo}\n\n## 用户需求\n${requirementText}\n\n## 函数签名\n(index: number, total: number) => React.CSSProperties\n\n## 参数说明\n- index: 当前项在列表中的索引（0开始）\n- total: 项目总数\n\n## 输出格式（只输出函数体，不要包装）\n\`\`\`javascript\n(index, total) => ({})\n\`\`\``,
      selectEffect: `你是一个选中效果代码生成器。\n\n## 用户需求\n${requirementText}\n\n## 函数签名\n(isSelected: boolean) => React.CSSProperties\n\n## 参数说明\n- isSelected: 项是否被选中\n\n## 输出格式（只输出函数体，不要包装）\n\`\`\`javascript\n(isSelected) => (isSelected ? {} : {})\n\`\`\``,
      render: `你是一个 React 渲染组件生成器。\n${dataFormatInfo}\n## 数据结构（Schema字段）\n${schemaFields}\n${tagsInfo}\n\n## 组件渲染上下文 (data)\n渲染代码接收的 data 对象包含以下字段：\n\n### 通用字段\n- type: string - 组件类型\n- name: string - 组件名称\n- width/height: number - 组件尺寸\n\n### 绑定数据（来自Schema）\n- items: Array - 绑定Schema的实例列表\n- itemCount: number - 实例数量\n- ...组件配置中的其他字段\n\n## 组件输出（系统注入）\n- outputsByType: Record<string, ComponentOutput[]> - 按组件类型聚合的输出\n- outputsById: Record<string, ComponentOutput> - 按组件ID聚合的输出\n\n## 渲染组件复用（系统注入）\n- renderComponentIndex: Array<{ id: string; name: string; targetSchema: string }> 渲染组件索引\n- renderByComponentId: (id: string, item: Record<string, unknown>, options?: { showBack?: boolean }) => ReactElement | null\n\nComponentOutput 结构:\n- componentId: string\n- type: string\n- schemaId?: string\n- items: Record<string, unknown>[]\n- itemCount: number\n- bindEntity?: string  // 关联字段（用于跨组件关联）\n\n输出使用说明（通用）：\n- 只有存在对应组件时才会出现 outputsByType['hand-zone'] 等输出\n- bindEntity 表示"关联字段名"，例如 hand-zone 绑定的 Schema 若有 ownerId，则可设置 bindEntity = ownerId\n- 其它组件可用 data.items 中的实体字段与 output.items 里的 bindEntity 字段进行关联过滤\n${outputsSection}\n\n## 关联示例（通用）\n\`\`\`tsx\nconst outputs = data.outputsByType?.['hand-zone'] || [];\nconst output = outputs[0];\nconst key = output?.bindEntity;\nconst relatedItems = key ? output.items.filter(item => item[key] === (data as any)[key]) : [];\n\`\`\`\n${playerContextInfo}\n\n## 渲染组件复用示例（通用）\n\`\`\`tsx\nconst renderer = data.renderByComponentId;\nconst componentId = data.renderComponentIndex?.[0]?.id;\nconst node = componentId && renderer ? renderer(componentId, relatedItems[0] || {}, { showBack: true }) : null;\n\`\`\`\n\n### 渲染组件字段\n当渲染单个数据项时，data 直接是该项对象，包含 Schema 定义的所有字段。\n用户通过 Schema 定义自己需要的字段（如 playerName、cardCount 等）。\n\n## 用户需求\n${requirementText}\n\n## 技术栈\n- **Tailwind CSS 4**\n- React 19 + TypeScript\n- Lucide React 图标库\n\n## 样式要求\n- 根元素使用 \`className="relative w-full h-full"\`\n- 定位使用内联样式 \`style={{ top: '8%', left: '8%' }}\`\n\n## 输出格式\n\`\`\`tsx\n(data: Record<string, unknown>) => (\n  <div className="relative w-full h-full ...">\n    {/* 使用 data.items / data.outputsByType 等字段 */}\n  </div>\n)\n\`\`\``,
    };

    return templates[hookType] || '';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-slate-400">{label}</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigator.clipboard?.writeText(generatePrompt())}
            className="px-1.5 py-0.5 bg-purple-600 hover:bg-purple-500 rounded text-[10px]"
          >
            复制提示词
          </button>
          <button
            onClick={() => onChange('')}
            disabled={!value}
            className="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[10px] disabled:opacity-40"
          >
            清空
          </button>
        </div>
      </div>
      <div className="mb-2">
        <input
          type="text"
          value={requirementValue}
          onChange={e => onRequirementChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-[10px]"
        />
      </div>
      <textarea
        value={value}
        readOnly
        onPaste={e => {
          e.preventDefault();
          const text = e.clipboardData.getData('text');
          if (text.trim()) {
            onChange(text);
          }
        }}
        placeholder="粘贴 AI 生成结果..."
        className="w-full h-14 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white font-mono text-[10px] resize-none"
      />
    </div>
  );
}
