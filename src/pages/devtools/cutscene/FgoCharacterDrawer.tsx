import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, UserRound, X } from 'lucide-react';
import { UI_Z_INDEX } from '../../../core';
import { FGO_CHARACTER_ASSETS, type FgoCharacterEntry } from './fgoCharacterData';
import { fgoNobleClipCount } from './fgoCharacterLabels';

type FgoCharacterDrawerProps = {
  characters: FgoCharacterEntry[];
  selectedId: string;
  onSelect: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const normalizeSearchValue = (value: string) => value.normalize('NFKC').toLocaleLowerCase('zh-CN');

const FgoCharacterDrawer = ({
  characters,
  selectedId,
  onSelect,
  open,
  onOpenChange,
}: FgoCharacterDrawerProps) => {
  const drawerId = useId();
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const wasOpenRef = useRef(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');

  const categories = useMemo(
    () => Array.from(new Set(characters.map((character) => character.category)))
      .sort((left, right) => left.localeCompare(right, 'zh-CN')),
    [characters],
  );
  const visibleCharacters = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query.trim());
    return characters.filter((character) => {
      if (category && character.category !== category) return false;
      if (!normalizedQuery) return true;
      return normalizeSearchValue(`${character.name}\n${character.sourceName}\n${character.id}`)
        .includes(normalizedQuery);
    });
  }, [category, characters, query]);

  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    } else if (wasOpenRef.current) {
      toggleRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onOpenChange(false);
      }
      if (event.key === 'Tab') {
        const controls = drawerRef.current?.querySelectorAll<HTMLElement>('button, input, select');
        if (!controls?.length) return;
        const first = controls[0]; const last = controls[controls.length - 1];
        if (!drawerRef.current?.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange, open]);

  const toggleLabel = open ? '收起角色抽屉' : '展开角色抽屉';

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="fixed left-3 top-3 grid h-10 w-10 place-items-center rounded-sm border border-zinc-700 bg-zinc-950 text-zinc-100 transition-colors hover:border-cyan-400 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        style={{ zIndex: UI_Z_INDEX.modalTooltip }}
        aria-label={toggleLabel}
        aria-controls={open ? drawerId : undefined}
        aria-expanded={open}
        title={toggleLabel}
        onClick={() => onOpenChange(!open)}
      >
        {open ? <PanelLeftClose size={18} aria-hidden="true" /> : <PanelLeftOpen size={18} aria-hidden="true" />}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 cursor-default bg-black/60"
            style={{ zIndex: UI_Z_INDEX.modalOverlay }}
            aria-label="关闭角色抽屉"
            title="关闭角色抽屉"
            tabIndex={-1}
            onClick={() => onOpenChange(false)}
          />
          <aside
            ref={drawerRef}
            id={drawerId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${drawerId}-title`}
            className="fixed inset-y-0 left-0 flex flex-col overflow-hidden border-r border-zinc-700 bg-zinc-950 text-zinc-100 shadow-2xl"
            style={{ width: 320, maxWidth: 'calc(100vw - 32px)', zIndex: UI_Z_INDEX.modalContent }}
          >
            <header className="flex min-h-16 items-center justify-between gap-3 border-b border-zinc-800 py-3 pl-16 pr-3">
              <div className="flex min-w-0 items-baseline gap-2">
                <h2 id={`${drawerId}-title`} className="shrink-0 text-base font-semibold">角色</h2>
                <span className="text-xs tabular-nums text-zinc-400">
                  {visibleCharacters.length} / {characters.length}
                </span>
              </div>
              <button
                type="button"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                aria-label="关闭角色抽屉"
                title="关闭角色抽屉"
                onClick={() => onOpenChange(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="space-y-2 border-b border-zinc-800 p-3">
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="搜索角色"
                aria-label="搜索角色"
                className="h-10 w-full rounded-sm border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-cyan-400"
              />
              <label className="sr-only" htmlFor={`${drawerId}-category`}>分类</label>
              <select
                id={`${drawerId}-category`}
                value={category}
                onChange={(event) => setCategory(event.currentTarget.value)}
                className="h-10 w-full rounded-sm border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-cyan-400"
              >
                <option value="">全部分类</option>
                {categories.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <p className="text-[11px] leading-4 text-zinc-400">
                完整宝具演出 {characters.filter(character => character.noblePhantasm).length} 套
                {' · '}宝具动作片段 {characters.reduce((count, character) => count + fgoNobleClipCount(character), 0)} 段
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {visibleCharacters.length === 0 ? (
                <p role="status" className="px-4 py-5 text-sm text-zinc-500">暂无角色</p>
              ) : (
                <ul>
                  {visibleCharacters.map((character) => {
                    const selected = character.id === selectedId;
                    const nobleClips = fgoNobleClipCount(character);
                    return (
                      <li key={character.id}>
                        <button
                          type="button"
                          className={`flex min-h-12 w-full items-center gap-3 border-b border-zinc-800 px-3 py-2 text-left transition-colors hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400 ${selected ? 'border-l-2 border-l-cyan-300 bg-cyan-950 text-cyan-50' : 'text-zinc-200'}`}
                          aria-label={`切换到${character.name}`}
                          aria-pressed={selected}
                          onClick={() => {
                            onSelect(character.id);
                            onOpenChange(false);
                          }}
                        >
                          <span title={character.thumbnail ? character.name : '暂无头像'} className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-sm border border-zinc-700 bg-zinc-900">
                            {character.thumbnail ? (
                              <img
                                src={`${FGO_CHARACTER_ASSETS}${character.thumbnail}`}
                                alt=""
                                className="h-full w-full object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <UserRound size={18} role="img" aria-label="暂无头像" className="text-zinc-500" />
                            )}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="whitespace-normal break-words text-sm leading-4">{character.name}</span>
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4 text-zinc-400">
                              <span className="break-all font-mono">{character.id}</span>
                              <span>动作 {character.animations.length}</span>
                              {character.noblePhantasm && (
                                <span className="rounded-sm border border-cyan-800 px-1 text-cyan-300">完整宝具演出</span>
                              )}
                              {nobleClips > 0 && <span>宝具片段 {nobleClips}</span>}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
};

export default FgoCharacterDrawer;
