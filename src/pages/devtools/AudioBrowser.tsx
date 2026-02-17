/**
 * 音效浏览器
 *
 * 独立页面，可在 /dev/audio 访问。
 * 支持按分类（group/sub）筛选、关键词搜索、类型过滤，方便查找和试听音效。
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Check } from 'lucide-react';
import { AudioManager } from '../../lib/audio/AudioManager';
import {
  loadCommonAudioRegistry,
  COMMON_AUDIO_BASE_PATH,
  type AudioRegistryEntry,
} from '../../lib/audio/commonRegistry';
// 直接 import src/ 下的 JSON
import phraseMappingsData from '../../assets/audio/phrase-mappings.zh-CN.json';

// ============================================================================
// 类型与常量
// ============================================================================

interface CategoryNode {
  group: string;
  subs: string[];
  count: number;
}

/** group 中文名映射 */
const GROUP_LABELS: Record<string, string> = {
  ambient: '环境音',
  bgm: '背景音乐',
  card: '卡牌',
  coins: '金币',
  combat: '战斗',
  cyberpunk: '赛博朋克',
  dice: '骰子',
  fantasy: '奇幻',
  magic: '魔法',
  misc: '其他',
  monster: '怪物',
  puzzle: '解谜',
  status: '状态效果',
  steampunk: '蒸汽朋克',
  stinger: '过场音效',
  system: '系统',
  token: '标记物',
  ui: '界面',
};

/** sub 中文名映射（仅翻译常见的有意义分类，音效包名称保持原样） */
const SUB_LABELS: Record<string, string> = {
  general: '通用',
  ethereal: '空灵',
  fantasy: '奇幻',
  funk: '放克',
  fire: '火焰',
  ice: '冰霜',
  water: '水流',
  wind: '风',
  lightning: '闪电',
  poison: '毒素',
  dark: '暗黑',
  rock: '岩石',
  earth: '大地',
  attack: '攻击',
  impact: '冲击',
  footstep: '脚步',
  shout: '呼喊',
  celebrate: '庆祝',
  handling: '操作',
  fx: '特效',
  loops: '循环',
  movement: '移动',
  death: '死亡',
  growl: '低吼',
  breath: '呼吸',
  click: '点击',
  shooting: '射击',
};

/** 获取 group 的中文显示名，未映射的原样返回 */
const groupLabel = (group: string): string => GROUP_LABELS[group] ?? group;

/** 获取 sub 的中文显示名，未映射的原样返回 */
const subLabel = (sub: string): string => SUB_LABELS[sub] ?? sub;

// ============================================================================
// 通用 UI
// ============================================================================

/** 从 key 提取词根（去掉数字后缀） */
const extractStem = (name: string): string => {
  return name.replace(/\s+\d+[A-Za-z]?$/, '').replace(/\s+[A-Za-z]$/, '').trim();
};

/** 从 key 提取可读简短名称 */
const friendlyNameBase = (key: string): string => {
  const parts = key.split('.');
  const last = parts[parts.length - 1] ?? key;
  // 去掉末尾的 _krst、_none 标签（可能组合出现如 _krst_none）
  const cleaned = last.replace(/(_(?:krst|none))+$/i, '');
  return cleaned.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
};

// ============================================================================
// 分类侧栏
// ============================================================================

const CategorySidebar: React.FC<{
  categories: CategoryNode[];
  selectedGroup: string | null;
  selectedSub: string | null;
  onSelectGroup: (group: string | null) => void;
  onSelectSub: (sub: string | null) => void;
  totalCount: number;
}> = ({ categories, selectedGroup, selectedSub, onSelectGroup, onSelectSub, totalCount }) => {
  return (
    <div className="w-56 shrink-0 overflow-y-auto max-h-[calc(100vh-10rem)] pr-2">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">分类</div>
      {/* 全部 */}
      <button
        onClick={() => { onSelectGroup(null); onSelectSub(null); }}
        className={`w-full text-left px-2 py-1.5 rounded text-sm mb-1 transition-[background-color] ${
          !selectedGroup ? 'bg-indigo-600/30 text-indigo-300 font-bold' : 'text-slate-300 hover:bg-slate-700/50'
        }`}
      >
        全部 <span className="text-slate-500 text-xs">({totalCount})</span>
      </button>

      {categories.map((cat) => (
        <div key={cat.group} className="mb-0.5">
          <button
            onClick={() => {
              if (selectedGroup === cat.group) {
                onSelectGroup(null);
                onSelectSub(null);
              } else {
                onSelectGroup(cat.group);
                onSelectSub(null);
              }
            }}
            className={`w-full text-left px-2 py-1.5 rounded text-sm transition-[background-color] ${
              selectedGroup === cat.group ? 'bg-indigo-600/30 text-indigo-300 font-bold' : 'text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            {groupLabel(cat.group)} <span className="text-slate-500 text-xs">({cat.count})</span>
          </button>
          {/* 展开子分类 */}
          {selectedGroup === cat.group && cat.subs.length > 1 && (
            <div className="ml-3 mt-0.5 space-y-0.5">
              {cat.subs.map((sub) => (
                <button
                  key={sub}
                  onClick={() => onSelectSub(selectedSub === sub ? null : sub)}
                  className={`w-full text-left px-2 py-1 rounded text-xs transition-[background-color] ${
                    selectedSub === sub ? 'bg-indigo-600/20 text-indigo-200 font-bold' : 'text-slate-400 hover:bg-slate-700/40'
                  }`}
                >
                  {subLabel(sub)}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// 音频列表（紧凑版）
// ============================================================================

const AudioTable: React.FC<{
  entries: AudioRegistryEntry[];
  playEntry: (entry: AudioRegistryEntry) => void;
  playingKey: string | null;
  friendlyName: (key: string) => string;
}> = ({ entries, playEntry, playingKey, friendlyName }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<number>(0);

  const copyKey = useCallback((key: string) => {
    void navigator.clipboard.writeText(key);
    setCopiedKey(key);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopiedKey(null), 1500);
  }, []);

  return (
    <div className="max-h-[calc(100vh-14rem)] overflow-y-auto rounded border border-slate-700 bg-slate-800/40">
      <table className="w-full text-xs table-fixed">
        <thead className="sticky top-0 bg-slate-800 z-10">
          <tr className="text-slate-400 border-b border-slate-700">
            <th className="text-left px-1.5 py-1 font-medium">名称</th>
            <th className="text-left px-1.5 py-1 font-medium w-16">类型</th>
            <th className="px-1.5 py-1 w-10">▶</th>
          </tr>
        </thead>
        <tbody>
          {entries.slice(0, 300).map((entry) => (
            <tr key={entry.key} className={`border-b border-slate-700/50 hover:bg-slate-700/30 ${playingKey === entry.key ? 'bg-indigo-900/20' : ''}`}>
              <td
                className="px-1.5 py-0.5 cursor-pointer hover:text-indigo-300 truncate"
                title={entry.key}
                onClick={() => copyKey(entry.key)}
              >
                <span className="text-slate-200 text-[11px] flex items-center gap-1">
                  {copiedKey === entry.key ? <Check size={12} className="text-emerald-400" /> : friendlyName(entry.key)}
                </span>
              </td>
              <td className="px-1.5 py-0.5">
                <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${entry.type === 'bgm' ? 'bg-emerald-900 text-emerald-300' : 'bg-indigo-900 text-indigo-300'}`}>
                  {entry.type === 'bgm' ? '音乐' : '音效'}
                </span>
              </td>
              <td className="px-1.5 py-0.5 text-center">
                <button
                  onClick={() => playEntry(entry)}
                  className="px-1.5 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold transition-[background-color]"
                  title="试听"
                >
                  {playingKey === entry.key ? '⏸' : '▶'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {entries.length > 300 && (
        <div className="text-center text-slate-500 text-xs py-2">显示前 300 条，共 {entries.length} 条匹配</div>
      )}
      {entries.length === 0 && (
        <div className="text-center text-slate-500 text-xs py-4">无匹配结果</div>
      )}
    </div>
  );
};

// ============================================================================
// 历史播放面板
// ============================================================================

interface HistoryItem {
  entry: AudioRegistryEntry;
  timestamp: number;
}

const HISTORY_STORAGE_KEY = 'audio-browser-history';
const HISTORY_MAX = 30;

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    return Array.isArray(parsed) ? parsed.slice(0, HISTORY_MAX) : [];
  } catch { return []; }
}

function saveHistory(items: HistoryItem[]): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items.slice(0, HISTORY_MAX)));
  } catch { /* quota exceeded etc. */ }
}

const HistoryPanel: React.FC<{
  history: HistoryItem[];
  replayEntry: (entry: AudioRegistryEntry) => void;
  playingKey: string | null;
  friendlyName: (key: string) => string;
  onClear: () => void;
}> = ({ history, replayEntry, playingKey, friendlyName, onClear }) => {
  return (
    <div className="w-56 shrink-0 flex flex-col max-h-[calc(100vh-10rem)]">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">历史播放</div>
        {history.length > 0 && (
          <button
            onClick={onClear}
            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            清空
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto rounded border border-slate-700 bg-slate-800/40">
        {history.length === 0 ? (
          <div className="text-center text-slate-500 text-xs py-6">播放音效后
此处会记录历史</div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {history.map((item, idx) => (
              <div
                key={`${item.entry.key}-${item.timestamp}-${idx}`}
                className={`px-2 py-1.5 hover:bg-slate-700/30 flex items-center gap-1.5 ${
                  playingKey === item.entry.key ? 'bg-indigo-900/20' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-slate-200 truncate" title={item.entry.key}>
                    {friendlyName(item.entry.key)}
                  </div>
                  <div className="text-[9px] text-slate-500">
                    {new Date(item.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
                <span className={`shrink-0 px-1 py-0.5 rounded text-[9px] font-bold ${
                  item.entry.type === 'bgm' ? 'bg-emerald-900 text-emerald-300' : 'bg-indigo-900 text-indigo-300'
                }`}>
                  {item.entry.type === 'bgm' ? '乐' : '效'}
                </span>
                <button
                  onClick={() => replayEntry(item.entry)}
                  className="shrink-0 w-5 h-5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center transition-[background-color]"
                  title="重新播放"
                >
                  {playingKey === item.entry.key ? '⏸' : '▶'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 主页面
// ============================================================================

const AudioBrowser: React.FC = () => {
  const [entries, setEntries] = useState<AudioRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'sfx' | 'bgm'>('all');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const playingRef = useRef<{ key: string; type: string } | null>(null);
  const [phraseMappings, setPhraseMappings] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [preloading, setPreloading] = useState(false);
  const [preloadedCount, setPreloadedCount] = useState(0);
  const preloadCancelledRef = useRef(false);

  // 加载完整短语中文映射表
  useEffect(() => {
    try {
      const phrases = (phraseMappingsData as { phrases?: Record<string, string> }).phrases ?? {};
      console.log(`[AudioBrowser] 短语映射表加载成功，${Object.keys(phrases).length} 条`);
      setPhraseMappings(phrases);
    } catch (err) {
      console.error('[AudioBrowser] 短语映射表加载失败，使用英文', err);
    }
  }, []);

  // 创建精确匹配的 friendlyName 函数
  const friendlyName = useMemo(() => {
    return (key: string): string => {
      const base = friendlyNameBase(key);
      const stem = extractStem(base);
      
      // 精确匹配完整短语
      if (phraseMappings[stem]) {
        const suffix = base.slice(stem.length).trim();
        return suffix ? `${phraseMappings[stem]} ${suffix}` : phraseMappings[stem];
      }
      
      // 否则返回英文自动友好化
      return base;
    };
  }, [phraseMappings]);

  useEffect(() => {
    setLoadError(null);
    loadCommonAudioRegistry()
      .then((payload) => {
        setEntries(payload.entries);
        if (!initialized) {
          AudioManager.registerRegistryEntries(payload.entries, COMMON_AUDIO_BASE_PATH);
          AudioManager.initialize();
          setInitialized(true);
        }
      })
      .catch((err) => {
        console.error('加载音频注册表失败', err);
        setLoadError(String(err?.message ?? err));
      })
      .finally(() => setLoading(false));
  }, [initialized]);

  // 构建分类树
  const categories = useMemo<CategoryNode[]>(() => {
    const map = new Map<string, Set<string>>();
    const countMap = new Map<string, number>();
    for (const e of entries) {
      const group = e.category?.group ?? 'misc';
      const sub = e.category?.sub ?? '';
      if (!map.has(group)) map.set(group, new Set());
      if (sub) map.get(group)!.add(sub);
      countMap.set(group, (countMap.get(group) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([group, subs]) => ({
        group,
        subs: Array.from(subs).sort(),
        count: countMap.get(group) ?? 0,
      }))
      .sort((a, b) => a.group.localeCompare(b.group));
  }, [entries]);

  // 过滤
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (selectedGroup) {
        const group = e.category?.group ?? 'misc';
        if (group !== selectedGroup) return false;
        if (selectedSub && (e.category?.sub ?? '') !== selectedSub) return false;
      }
      if (filter) {
        const q = filter.toLowerCase();
        const matchKey = e.key.toLowerCase().includes(q);
        const matchSrc = e.src?.toLowerCase().includes(q);
        const matchName = friendlyName(e.key).toLowerCase().includes(q);
        if (!matchKey && !matchSrc && !matchName) return false;
      }
      return true;
    });
  }, [entries, typeFilter, selectedGroup, selectedSub, filter, friendlyName]);

  /** 停止上一次播放 */
  const stopPrevious = useCallback(() => {
    const prev = playingRef.current;
    if (!prev) return;
    if (prev.type === 'bgm') {
      AudioManager.stopBgm();
    } else {
      AudioManager.stopSfx(prev.key);
    }
    playingRef.current = null;
  }, []);

  /** 播放并记录历史（中间列表用） */
  const playEntry = useCallback((entry: AudioRegistryEntry) => {
    stopPrevious();
    if (entry.type === 'bgm') {
      AudioManager.playBgm(entry.key);
    } else {
      AudioManager.play(entry.key, undefined, () => {
        setPlayingKey(null);
        playingRef.current = null;
      });
    }
    setPlayingKey(entry.key);
    playingRef.current = { key: entry.key, type: entry.type };
    setHistory((prev) => {
      const deduped = prev.filter((h) => h.entry.key !== entry.key);
      const next = [{ entry, timestamp: Date.now() }, ...deduped].slice(0, HISTORY_MAX);
      saveHistory(next);
      return next;
    });
  }, [stopPrevious]);

  /** 仅播放不修改历史（历史面板用） */
  const replayEntry = useCallback((entry: AudioRegistryEntry) => {
    stopPrevious();
    if (entry.type === 'bgm') {
      AudioManager.playBgm(entry.key);
    } else {
      AudioManager.play(entry.key, undefined, () => {
        setPlayingKey(null);
        playingRef.current = null;
      });
    }
    setPlayingKey(entry.key);
    playingRef.current = { key: entry.key, type: entry.type };
  }, [stopPrevious]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  }, []);

  /** 预加载当前过滤结果中的所有音效 */
  const preloadFiltered = useCallback(() => {
    const sfxKeys = filtered.filter((e) => e.type === 'sfx').map((e) => e.key);
    if (sfxKeys.length === 0) return;
    setPreloading(true);
    setPreloadedCount(0);
    preloadCancelledRef.current = false;
    // 分批预加载，避免一次性请求过多
    const BATCH_SIZE = 20;
    let loaded = 0;
    const loadBatch = (startIdx: number) => {
      if (preloadCancelledRef.current) {
        setPreloading(false);
        return;
      }
      const batch = sfxKeys.slice(startIdx, startIdx + BATCH_SIZE);
      if (batch.length === 0) {
        setPreloading(false);
        return;
      }
      AudioManager.preloadKeys(batch);
      loaded += batch.length;
      setPreloadedCount(loaded);
      // 延迟加载下一批，给浏览器喘息空间
      if (startIdx + BATCH_SIZE < sfxKeys.length) {
        setTimeout(() => loadBatch(startIdx + BATCH_SIZE), 100);
      } else {
        setPreloading(false);
      }
    };
    loadBatch(0);
  }, [filtered]);

  /** 取消预加载 */
  const cancelPreload = useCallback(() => {
    preloadCancelledRef.current = true;
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <a href="/" className="text-slate-400 hover:text-slate-200 text-sm">← 返回首页</a>
          <h1 className="text-xl font-black text-slate-100">音效浏览器</h1>
          <span className="text-slate-500 text-sm">({entries.length} 条)</span>
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm py-8 text-center">加载中...</div>
        ) : loadError ? (
          <div className="text-center py-12">
            <p className="text-red-400 mb-2">加载音频注册表失败</p>
            <p className="text-slate-500 text-sm mb-4">{loadError}</p>
            <button
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
              onClick={() => { setLoading(true); setLoadError(null); setInitialized(false); }}
            >
              重试
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            {/* 左侧分类 */}
            <CategorySidebar
              categories={categories}
              selectedGroup={selectedGroup}
              selectedSub={selectedSub}
              onSelectGroup={setSelectedGroup}
              onSelectSub={setSelectedSub}
              totalCount={entries.length}
            />

            {/* 中间列表 */}
            <div className="flex-1 min-w-0">
              {/* 搜索栏 */}
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="搜索键名 / 文件名..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="flex-1 px-2 py-1 rounded bg-slate-800 border border-slate-600 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
                />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as 'all' | 'sfx' | 'bgm')}
                  className="px-2 py-1 rounded bg-slate-800 border border-slate-600 text-sm text-slate-200 outline-none"
                >
                  <option value="all">全部</option>
                  <option value="sfx">音效</option>
                  <option value="bgm">音乐</option>
                </select>
                <button
                  onClick={() => AudioManager.stopBgm()}
                  className="px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-[10px] font-bold text-white transition-[background-color]"
                >
                  停止BGM
                </button>
                {preloading ? (
                  <button
                    onClick={cancelPreload}
                    className="px-2 py-1 rounded text-[10px] font-bold text-white bg-red-600 hover:bg-red-500 transition-[background-color]"
                    title="取消预加载"
                  >
                    取消 ({preloadedCount}/{filtered.filter((e) => e.type === 'sfx').length})
                  </button>
                ) : (
                  <button
                    onClick={preloadFiltered}
                    disabled={filtered.filter((e) => e.type === 'sfx').length === 0}
                    className="px-2 py-1 rounded text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-[background-color]"
                    title="预加载当前搜索结果中的所有音效，消除首次播放延迟"
                  >
                    预加载全部
                  </button>
                )}
              </div>

              {/* 结果统计 */}
              <div className="text-xs text-slate-500 mb-1">
                {selectedGroup && (
                  <span>
                    {groupLabel(selectedGroup)}{selectedSub ? ` / ${selectedSub}` : ''} ·{' '}
                  </span>
                )}
                {filtered.length} 条结果
              </div>

              <AudioTable entries={filtered} playEntry={playEntry} playingKey={playingKey} friendlyName={friendlyName} />
            </div>

            {/* 右侧历史播放 */}
            <HistoryPanel
              history={history}
              replayEntry={replayEntry}
              playingKey={playingKey}
              friendlyName={friendlyName}
              onClear={clearHistory}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioBrowser;
