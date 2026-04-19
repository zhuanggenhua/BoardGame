/**
 * 特效预览工具
 *
 * 独立页面，可在 /dev/fx 访问。
 * 左侧分类导航（按特效类型分组） + 右侧网格展示该分类下所有特效。
 *
 * 自动注册机制：
 * - 每个 cards/*.tsx 文件导出 `meta: EffectEntryMeta[]` 描述自身包含的特效条目
 * - 本文件通过 `import.meta.glob` 自动收集所有 meta，无需手动维护注册表
 * - 新增特效只需在卡片文件中添加组件 + meta 条目即可
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { EffectEntryMeta, EffectGroupDef, IconComponent } from './cards/shared';
import { EFFECT_GROUP_DEFS } from './cards/shared';
import { AudioManager } from '../../lib/audio/AudioManager';
import { loadCommonAudioRegistry } from '../../lib/audio/commonRegistry';

// ============================================================================
// 自动收集所有卡片文件的 meta（eager 模式，构建时静态解析）
// ============================================================================

const cardModules = import.meta.glob<{ meta?: EffectEntryMeta[] }>(
  './cards/*Cards.tsx',
  { eager: true },
);

/** 从所有卡片模块中收集 meta 条目 */
function collectEntries(): EffectEntryMeta[] {
  const entries: EffectEntryMeta[] = [];
  for (const mod of Object.values(cardModules)) {
    if (mod.meta) entries.push(...mod.meta);
  }
  return entries;
}

// ============================================================================
// 构建分组结构
// ============================================================================

interface EffectGroup {
  id: string;
  label: string;
  icon: IconComponent;
  colorClass: string;
  entries: EffectEntryMeta[];
}

function buildGroups(entries: EffectEntryMeta[]): EffectGroup[] {
  const groupMap = new Map<string, EffectGroupDef>();
  for (const def of EFFECT_GROUP_DEFS) groupMap.set(def.id, def);

  const grouped = new Map<string, EffectEntryMeta[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.group) ?? [];
    list.push(entry);
    grouped.set(entry.group, list);
  }

  return EFFECT_GROUP_DEFS
    .filter(def => grouped.has(def.id))
    .map(def => ({
      id: def.id,
      label: def.label,
      icon: def.icon,
      colorClass: def.colorClass,
      entries: grouped.get(def.id)!,
    }));
}

const ALL_ENTRIES = collectEntries();
const EFFECT_GROUPS = buildGroups(ALL_ENTRIES);

// ============================================================================
// 主页面
// ============================================================================

const EffectPreview: React.FC = () => {
  const [activeEffectId, setActiveEffectId] = useState(ALL_ENTRIES[0]?.id ?? '');
  const [useRealCards, setUseRealCards] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const totalCount = ALL_ENTRIES.length;

  // 初始化音频系统
  useEffect(() => {
    const initAudio = async () => {
      try {
        const registry = await loadCommonAudioRegistry();
        AudioManager.registerRegistryEntries(registry.entries, 'common/audio');
        AudioManager.initialize();
      } catch (error) {
        console.error('[EffectPreview] 音频初始化失败:', error);
      }
    };
    initAudio();
  }, []);

  const activeGroup = useMemo(
    () => EFFECT_GROUPS.find(g => g.entries.some(e => e.id === activeEffectId)) ?? EFFECT_GROUPS[0],
    [activeEffectId],
  );
  const activeEntry = useMemo(
    () => activeGroup?.entries.find(e => e.id === activeEffectId) ?? activeGroup?.entries[0],
    [activeGroup, activeEffectId],
  );
  const Comp = activeEntry?.component;

  const allCollapsed = collapsedGroups.size === EFFECT_GROUPS.length;
  const toggleAll = () => {
    setCollapsedGroups(allCollapsed ? new Set() : new Set(EFFECT_GROUPS.map(g => g.id)));
  };
  const toggleGroup = (id: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="h-screen bg-slate-900 text-slate-200 flex overflow-hidden">
      {/* 左侧：两级导航（分类 + 特效条目） */}
      <nav className="w-52 shrink-0 min-h-0 bg-slate-800/80 border-r border-slate-700 flex flex-col overflow-y-auto">
        <div className="p-3 pb-2 border-b border-slate-700/50">
          <a href="/" className="text-slate-400 hover:text-slate-200 text-xs mb-1 block">← 返回首页</a>
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-black text-slate-100">特效预览 <span className="text-[10px] font-normal text-slate-500">({totalCount})</span></h1>
            <button
              onClick={toggleAll}
              className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
              title={allCollapsed ? '全部展开' : '全部折叠'}
            >
              {allCollapsed ? '▶ 展开' : '▼ 折叠'}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {EFFECT_GROUPS.map(group => {
            const isCollapsed = collapsedGroups.has(group.id);
            return (
              <div key={group.id} className="mb-2">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="cursor-pointer w-full text-left text-xs font-bold text-slate-500 px-2 py-1.5 flex items-center gap-1.5 hover:text-slate-300 transition-colors"
                >
                  <span className="text-[9px]">{isCollapsed ? '▶' : '▼'}</span>
                  <group.icon size={14} className={`shrink-0 ${group.colorClass}`} />
                  {group.label}
                  <span className="ml-auto text-[10px] font-normal">{group.entries.length}</span>
                </button>
                {!isCollapsed && group.entries.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => setActiveEffectId(entry.id)}
                    className={`cursor-pointer w-full text-left px-2.5 py-1.5 rounded-md text-[11px] transition-[background-color] flex items-center gap-1.5 ${
                      entry.id === activeEffectId
                        ? 'bg-indigo-600/40 text-indigo-200'
                        : 'text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
                    }`}
                  >
                    <entry.icon size={14} className={`shrink-0 ${entry.id === activeEffectId ? group.colorClass : ''}`} />
                    <span className="truncate">{entry.label}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        {/* 底部开关 */}
        <div className="p-2 border-t border-slate-700/50">
          <button
            onClick={() => setUseRealCards(v => !v)}
            className={`cursor-pointer w-full px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-[background-color] ${
              useRealCards
                ? 'bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/40'
                : 'bg-slate-700/40 text-slate-500 hover:bg-slate-700/60'
            }`}
          >
            {useRealCards ? '实际卡图' : '占位区域'}
          </button>
        </div>
      </nav>

      {/* 右侧：单一特效预览区（填满屏幕） */}
      <main className="flex-1 flex flex-col min-h-0 min-w-0">
        {Comp && activeEntry && (
          <Comp key={activeEntry.id} useRealCards={useRealCards} iconColor={activeGroup?.colorClass} />
        )}
      </main>
    </div>
  );
};

export default EffectPreview;
