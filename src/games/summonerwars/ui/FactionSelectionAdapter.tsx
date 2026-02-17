/**
 * 召唤师战争 - 阵营选择界面（重构版）
 * 
 * 设计理念：
 * - 使用游戏内 CardSprite 渲染召唤师卡牌，风格与局内一致
 * - 固定布局，玩家状态区不因 hover 产生位移
 * - 点击卡牌可放大查看（与局内一致）
 * - 预览区与玩家状态区独立布局，互不挤压
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { MagnifyOverlay } from '../../../components/common/overlays/MagnifyOverlay';
import clsx from 'clsx';
import type { PlayerId } from '../../../engine/types';
import type { FactionId } from '../domain/types';
import { FACTION_CATALOG, type FactionCatalogEntry } from '../config/factions';
import { CardSprite } from './CardSprite';
import { initSpriteAtlases, getSpriteAtlasSource, getFactionAtlasId } from './cardAtlas';
import { DeckBuilderDrawer } from './DeckBuilderDrawer';
import { UI_Z_INDEX } from '../../../core';
import type { SerializedCustomDeck } from '../config/deckSerializer';
import type { TFunction } from 'i18next';
import { listCustomDecks, getCustomDeck, type SavedDeckSummary } from '../../../api/custom-deck';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { CustomDeckCard } from './CustomDeckCard';
import { getSummonerAtlasIdByFaction } from './helpers/customDeckHelpers';

// 玩家配色
const PLAYER_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  '0': { bg: '#F43F5E', border: '#fb7185', text: 'white', glow: 'rgba(244,63,94,0.4)' },
  '1': { bg: '#3B82F6', border: '#60a5fa', text: 'white', glow: 'rgba(59,130,246,0.4)' },
};
const getPlayerShortLabel = (t: TFunction, pid: string) => t('player.short', {
  id: pid === '0' ? 1 : 2,
});

export interface FactionSelectionProps {
  isOpen: boolean;
  currentPlayerId: PlayerId;
  hostPlayerId: PlayerId;
  selectedFactions: Record<PlayerId, FactionId | 'unselected'>;
  readyPlayers: Record<PlayerId, boolean>;
  playerNames: Record<PlayerId, string>;
  onSelect: (factionId: FactionId) => void;
  onReady: () => void;
  onStart: () => void;
  /** 选择自定义牌组的回调（传递序列化牌组数据） */
  onSelectCustomDeck?: (deck: SerializedCustomDeck) => void;
}

/** 自定义牌组选择信息（用于 UI 展示） */
interface CustomDeckInfo {
  deckId: string;
  deckName: string;
  summonerName: string;
  summonerFaction: FactionId;
}

export const FactionSelection: React.FC<FactionSelectionProps> = ({
  isOpen,
  currentPlayerId,
  hostPlayerId,
  selectedFactions,
  readyPlayers,
  playerNames,
  onSelect,
  onReady,
  onStart,
  onSelectCustomDeck,
}) => {
  const { t, i18n } = useTranslation('game-summonerwars');
  const { token } = useAuth();
  const toast = useToast();
  
  // 确保精灵图注册表已初始化（使用当前语言）
  useEffect(() => {
    initSpriteAtlases(i18n.language);
  }, [i18n.language]);
  
  const isHost = currentPlayerId === hostPlayerId;
  // 动态获取所有玩家 ID（从 selectedFactions 或 readyPlayers 中推断）
  const playerIds = useMemo(() => {
    const allPids = new Set<string>();
    Object.keys(selectedFactions).forEach(pid => allPids.add(pid));
    Object.keys(readyPlayers).forEach(pid => allPids.add(pid));
    Object.keys(playerNames).forEach(pid => allPids.add(pid));
    // 如果没有任何数据，回退到默认的 2 人游戏
    return allPids.size > 0 ? Array.from(allPids).sort() : ['0', '1'];
  }, [selectedFactions, readyPlayers, playerNames]);

  // 自定义牌组选择状态（按玩家 ID 存储）
  const [customDeckSelections, setCustomDeckSelections] = useState<Record<string, CustomDeckInfo>>({});
  
  // 已保存的自定义牌组列表
  const [savedDecks, setSavedDecks] = useState<SavedDeckSummary[]>([]);
  
  // 当前选中的自定义牌组 ID（用于高亮显示）
  const [selectedCustomDeckId, setSelectedCustomDeckId] = useState<string | null>(null);
  
  // 编辑中的牌组 ID（用于传递给 DeckBuilderDrawer）
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  
  // 加载已保存的自定义牌组列表
  useEffect(() => {
    // 测试数据注入（仅用于 E2E 测试，仅在开发环境生效）
    if (import.meta.env.DEV && typeof window !== 'undefined' && (window as any).__TEST_CUSTOM_DECKS__) {
      setSavedDecks((window as any).__TEST_CUSTOM_DECKS__);
      return;
    }
    
    if (!token) return;
    
    let cancelled = false;
    
    const fetchDecks = async () => {
      try {
        const decks = await listCustomDecks(token);
        if (!cancelled) {
          setSavedDecks(decks);
        }
      } catch (err) {
        console.warn('[FactionSelection] 加载自定义牌组列表失败:', err);
        if (!cancelled) {
          toast.error(
            { kind: 'i18n', ns: 'game-summonerwars', key: 'factionSelection.loadDeckFailed' },
            undefined,
            { dedupeKey: 'load-deck-list-failed' }
          );
        }
      }
    };
    
    void fetchDecks();
    
    return () => { cancelled = true; };
  }, [token, toast]);
  
  /**
   * 刷新自定义牌组列表
   * 用于牌组保存/删除后更新列表
   */
  const refreshDeckList = useCallback(async () => {
    if (!token) return;
    
    try {
      const decks = await listCustomDecks(token);
      setSavedDecks(decks);
    } catch (err) {
      console.warn('[FactionSelection] 刷新自定义牌组列表失败:', err);
      toast.error(
        { kind: 'i18n', ns: 'game-summonerwars', key: 'factionSelection.loadDeckFailed' },
        undefined,
        { dedupeKey: 'refresh-deck-list-failed' }
      );
    }
  }, [token, toast]);
  
  // 预加载自定义牌组的召唤师精灵图（优化版：并行加载 + 错误处理）
  useEffect(() => {
    if (savedDecks.length === 0) return;
    
    let cancelled = false;
    
    const preloadImages = async () => {
      const loadPromises = savedDecks.map(deck => {
        return new Promise<void>((resolve) => {
          const atlasId = getSummonerAtlasIdByFaction(deck.summonerFaction);
          const source = getSpriteAtlasSource(atlasId);
          
          if (!source) {
            resolve(); // 没有图片源，直接完成
            return;
          }
          
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => {
            console.warn(`[FactionSelection] 预加载精灵图失败: ${atlasId}`);
            resolve(); // 失败也继续，不阻塞其他图片
          };
          img.src = source.image;
        });
      });
      
      try {
        await Promise.all(loadPromises);
      } catch (err) {
        console.warn('[FactionSelection] 精灵图预加载失败:', err);
      }
    };
    
    void preloadImages();
    
    return () => { cancelled = true; };
  }, [savedDecks]);

  // 当前玩家已选阵营（包括自定义牌组的情况）
  const myFaction = selectedFactions[currentPlayerId];
  const hasSelected = myFaction && myFaction !== 'unselected';

  // 全员就绪判定
  const everyoneReady = playerIds.every(pid => {
    const f = selectedFactions[pid as PlayerId];
    const selected = f && f !== 'unselected';
    if (pid === hostPlayerId) return selected;
    return selected && readyPlayers[pid as PlayerId];
  });

  // 预览阵营（hover 或已选）
  const [hoveredFaction, setHoveredFaction] = useState<string | null>(null);
  const previewFactionId = hoveredFaction ?? (hasSelected ? myFaction : null);
  const previewEntry = useMemo(() => {
    if (!previewFactionId) return null;
    return FACTION_CATALOG.find(f => f.id === previewFactionId) ?? null;
  }, [previewFactionId]);

  // 可选阵营
  const availableFactions = useMemo(() => {
    return FACTION_CATALOG.filter(f => f.selectable !== false);
  }, []);

  // 预加载双方选择的阵营资源（包括对方的）
  React.useEffect(() => {
    const factionsToPreload = new Set<FactionId>();
    
    // 收集所有已选择的阵营（动态遍历所有玩家）
    Object.entries(selectedFactions).forEach(([_pid, faction]) => {
      if (faction && faction !== 'unselected') {
        factionsToPreload.add(faction);
      }
    });

    // 预加载图片资源
    factionsToPreload.forEach(factionId => {
      const entry = FACTION_CATALOG.find(f => f.id === factionId);
      if (!entry) return;

      // 预加载 hero 精灵图
      const heroAtlasId = getSummonerAtlasIdByFaction(factionId);
      const heroSource = getSpriteAtlasSource(heroAtlasId);
      if (heroSource) {
        const img = new Image();
        img.src = heroSource.image;
      }

      // 预加载 cards 精灵图
      const cardsAtlasId = getFactionAtlasId(factionId, 'cards');
      const cardsSource = getSpriteAtlasSource(cardsAtlasId);
      if (cardsSource) {
        const img = new Image();
        img.src = cardsSource.image;
      }

      // 预加载 tip 图
      const tipImg = new Image();
      tipImg.src = entry.tipImagePath;
    });
  }, [selectedFactions]);

  // 放大预览状态（支持 tip 图和召唤师卡牌两种）
  const [magnifyImage, setMagnifyImage] = useState<string | null>(null);
  const [magnifySprite, setMagnifySprite] = useState<{ atlasId: string; frameIndex: number } | null>(null);
  const [isDeckBuilderOpen, setIsDeckBuilderOpen] = useState(false);

  // 点击卡牌放大查看召唤师
  const handleMagnifyCard = useCallback((factionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); // 不触发选择
    const atlasId = getSummonerAtlasIdByFaction(factionId);
    if (atlasId) setMagnifySprite({ atlasId, frameIndex: 0 });
  }, []);
  
  /**
   * 处理自定义牌组选择
   * 加载完整牌组数据并通知父组件
   */
  const handleSelectCustomDeck = useCallback(async (deckId: string) => {
    if (!token) return;
    
    try {
      // 1. 获取完整牌组数据
      const fullDeck = await getCustomDeck(token, deckId);
      
      // 2. 更新选中状态
      setSelectedCustomDeckId(deckId);
      
      // 3. 存储牌组信息（用于 PlayerStatusCard 显示）
      setCustomDeckSelections(prev => ({
        ...prev,
        [currentPlayerId]: {
          deckId: fullDeck.id,
          deckName: fullDeck.name,
          summonerName: fullDeck.summonerId,
          summonerFaction: fullDeck.summonerFaction,
        },
      }));
      
      // 4. 通知父组件
      onSelectCustomDeck?.(fullDeck);
    } catch (err) {
      console.error('[FactionSelection] 加载自定义牌组失败:', err);
      toast.error(
        { kind: 'i18n', ns: 'game-summonerwars', key: 'factionSelection.loadDeckFailed' },
        undefined,
        { dedupeKey: `select-deck-${deckId}-failed` }
      );
    }
  }, [token, currentPlayerId, onSelectCustomDeck, toast]);
  
  /**
   * 处理编辑牌组
   * 打开构建器并传递牌组 ID
   */
  const handleEditDeck = useCallback((deckId: string) => {
    setEditingDeckId(deckId);
    setIsDeckBuilderOpen(true);
  }, []);
  
  /**
   * 处理新建牌组
   * 打开构建器且不传递牌组 ID
   */
  const handleNewDeck = useCallback(() => {
    setEditingDeckId(null);
    setIsDeckBuilderOpen(true);
  }, []);

  /**
   * 处理自定义牌组确认
   * 将牌组数据存储到本地状态用于 UI 展示，并通过回调通知父组件
   */
  const handleConfirmCustomDeck = useCallback((deck: SerializedCustomDeck) => {
    // 记录自定义牌组选择信息（用于 PlayerStatusCard 展示）
    setCustomDeckSelections(prev => ({
      ...prev,
      [currentPlayerId]: {
        deckName: deck.name,
        summonerName: deck.summonerId,
        summonerFaction: deck.summonerFaction,
      },
    }));

    // 通知父组件（如果有回调）
    onSelectCustomDeck?.(deck);

    // 关闭抽屉
    setIsDeckBuilderOpen(false);
  }, [currentPlayerId, onSelectCustomDeck]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex flex-col bg-[#0d1117] overflow-hidden select-none text-white font-sans w-screen h-screen"
      style={{ zIndex: UI_Z_INDEX.overlay }}
    >
      {/* 背景氛围层 - 动态流光 */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d1117] via-[#161b22] to-[#0d1117]" />
        {/* 动态径向光晕 */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.03, 0.08, 0.03],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,_rgba(245,158,11,1)_0%,_transparent_70%)]"
        />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }} />
      </div>

      {/* 标题区 - 装饰强化 */}
      <div className="relative z-10 text-center pt-[3vh] pb-[2vh]">
        <div className="absolute top-[2vh] left-1/2 -translate-x-1/2 w-[30vw] h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        <motion.h1
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-[clamp(24px,2.2vw,42px)] font-black tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-500 to-amber-700"
          style={{ filter: 'drop-shadow(0 0 15px rgba(245,158,11,0.4))' }}
        >
          {t('factionSelection.title')}
        </motion.h1>
        <p className="text-[clamp(12px,0.75vw,16px)] text-amber-100/40 mt-[0.5vh] tracking-[0.5em] font-light uppercase">
          {t('factionSelection.subtitle')}
        </p>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[15vw] h-[1px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      </div>

      {/* 主内容区 */}
      <div className="relative z-10 flex-1 flex flex-col min-h-0 px-[4vw]">
        {/* 阵营卡片网格（两排三列） */}
        <div className="flex-shrink-0">
          <div className="grid grid-cols-4 gap-[0.8vw] max-w-[72vw] mx-auto">
            {availableFactions.map((faction, index) => {
              const isSelectedByMe = selectedFactions[currentPlayerId] === faction.id;
              const occupyingPlayers = playerIds.filter(
                pid => selectedFactions[pid as PlayerId] === faction.id
              );

              return (
                <FactionCard
                  key={faction.id}
                  faction={faction}
                  index={index}
                  isSelectedByMe={isSelectedByMe}
                  occupyingPlayers={occupyingPlayers}
                  t={t}
                  onSelect={onSelect}
                  onHover={setHoveredFaction}
                  onMagnify={handleMagnifyCard}
                />
              );
            })}

            {/* 自定义牌组卡片（最多显示 2 个） */}
            {savedDecks.slice(0, 2).map((deck, deckIndex) => {
              const isSelectedByMe = selectedCustomDeckId === deck.id;
              // 多玩家占用逻辑：检查哪些玩家选择了这个自定义牌组
              const occupyingPlayers = playerIds.filter(
                pid => customDeckSelections[pid]?.deckId === deck.id
              );
              
              return (
                <CustomDeckCard
                  key={deck.id}
                  deck={deck}
                  index={availableFactions.length + deckIndex}
                  isSelectedByMe={isSelectedByMe}
                  occupyingPlayers={occupyingPlayers}
                  t={t}
                  onSelect={() => handleSelectCustomDeck(deck.id)}
                  onEdit={() => handleEditDeck(deck.id)}
                  onMagnify={handleMagnifyCard}
                />
              );
            })}
            
            {/* "+"按钮（仅当自定义牌组数量 < 2 时显示） */}
            {savedDecks.length < 2 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                transition={{
                  delay: (availableFactions.length + savedDecks.length) * 0.06,
                  duration: 0.3,
                  scale: { type: 'spring', stiffness: 400, damping: 20 }
                }}
                className={clsx(
                  'relative rounded-lg overflow-hidden cursor-pointer group',
                  'border-2 border-dashed border-white/20 hover:border-amber-400/60 transition-colors shadow-lg flex flex-col items-center justify-center bg-white/5'
                )}
                onClick={handleNewDeck}
              >
                <div className="w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center mb-4 group-hover:border-amber-400/80 transition-colors">
                  <span className="text-3xl text-white/50 group-hover:text-amber-400 font-light">+</span>
                </div>
                <div className="text-white/70 font-bold uppercase tracking-widest text-sm group-hover:text-amber-100">
                  {t('factionSelection.newDeck')}
                </div>
                <div className="text-white/30 text-[10px] mt-1">
                  {t('factionSelection.clickToBuild')}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* 下方：预览区（左） + 玩家状态区（右），用固定间距隔开 */}
        <div className="flex-1 flex items-center justify-center min-h-0 pt-[1.5vh] pb-[1vh]">
          <div className="flex items-stretch gap-[3vw] h-full max-h-[32vh]">
            {/* Tip 图预览（固定宽度，不挤压右侧） */}
            <div className="w-[28vw] flex items-center justify-center shrink-0">
              <AnimatePresence mode="wait">
                {previewEntry ? (
                  <motion.div
                    key={previewEntry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="relative group h-full cursor-zoom-in rounded-lg overflow-hidden border-2 border-amber-900/30 shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-amber-500/50"
                    onClick={() => setMagnifyImage(previewEntry.tipImagePath)}
                  >
                    {/* 装饰边框背景 */}
                    <div className="absolute inset-0 z-0 bg-amber-950/20" />

                    <OptimizedImage
                      src={previewEntry.tipImagePath}
                      className="relative z-10 h-full w-auto object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                      alt={t('factionSelection.tipAlt', { name: t(previewEntry.nameKey) })}
                    />

                    {/* 内角边框装饰 */}
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-amber-500/40 rounded-tl-sm pointer-events-none" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-amber-500/40 rounded-tr-sm pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-amber-500/40 rounded-bl-sm pointer-events-none" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-amber-500/40 rounded-br-sm pointer-events-none" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-[24vh] aspect-[4/3] rounded-lg border border-dashed border-white/10 flex items-center justify-center"
                  >
                    <span className="text-[clamp(10px,0.7vw,14px)] text-white/20">
                      {t('factionSelection.hoverToPreview')}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 玩家状态面板（固定宽度） */}
            <div className="flex flex-col gap-[1.2vh] min-w-[14vw] justify-center">
              {playerIds.map(pid => (
                <PlayerStatusCard
                  key={pid}
                  pid={pid}
                  isMe={pid === currentPlayerId}
                  factionId={selectedFactions[pid as PlayerId]}
                  isReady={!!readyPlayers[pid as PlayerId]}
                  playerName={playerNames[pid as PlayerId]}
                  customDeckInfo={customDeckSelections[pid]}
                  t={t}
                />
              ))}

              {/* 操作按钮区（固定高度，避免布局跳动） */}
              <div className="h-[5vh] flex items-center justify-center">
                <ActionButton
                  isHost={isHost}
                  hasSelected={!!hasSelected}
                  isReady={!!readyPlayers[currentPlayerId]}
                  everyoneReady={everyoneReady}
                  onReady={onReady}
                  onStart={onStart}
                  t={t}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 放大预览弹窗（tip 图） */}
      <MagnifyOverlay
        isOpen={!!magnifyImage}
        onClose={() => setMagnifyImage(null)}
        containerClassName="max-h-[90vh] max-w-[90vw]"
        closeLabel={t('actions.closePreview')}
      >
        {magnifyImage && (
          <OptimizedImage
            src={magnifyImage}
            className="max-h-[90vh] max-w-[90vw] w-auto h-auto object-contain"
            alt={t('factionSelection.previewAlt')}
          />
        )}
      </MagnifyOverlay>

      {/* 放大预览弹窗（召唤师卡牌精灵图） */}
      <MagnifyOverlay
        isOpen={!!magnifySprite}
        onClose={() => setMagnifySprite(null)}
        containerClassName="max-h-[90vh] max-w-[90vw]"
        closeLabel={t('actions.closePreview')}
      >
        {magnifySprite && (
          <CardSprite
            atlasId={magnifySprite.atlasId}
            frameIndex={magnifySprite.frameIndex}
            className="max-h-[85vh] w-auto rounded-lg shadow-2xl"
            style={{ minWidth: '40vw' }}
          />
        )}
      </MagnifyOverlay>

      {/* Deck Builder Drawer */}
      <DeckBuilderDrawer
        isOpen={isDeckBuilderOpen}
        onClose={() => {
          setIsDeckBuilderOpen(false);
          setEditingDeckId(null);
        }}
        onConfirm={handleConfirmCustomDeck}
        currentPlayerId={currentPlayerId}
        initialDeckId={editingDeckId ?? undefined}
        onDeckSaved={refreshDeckList}
      />
    </motion.div>
  );
};

// ============================================================================
// 子组件：阵营卡片
// ============================================================================

interface FactionCardProps {
  faction: FactionCatalogEntry;
  index: number;
  isSelectedByMe: boolean;
  occupyingPlayers: string[];
  t: TFunction;
  onSelect: (factionId: FactionId) => void;
  onHover: (factionId: string | null) => void;
  onMagnify: (factionId: string, e: React.MouseEvent) => void;
}

const FactionCard: React.FC<FactionCardProps> = ({
  faction, index, isSelectedByMe, occupyingPlayers, t, onSelect, onHover, onMagnify,
}) => {
  const atlasId = getSummonerAtlasIdByFaction(faction.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{
        delay: index * 0.06,
        duration: 0.3,
        scale: { type: 'spring', stiffness: 400, damping: 20 }
      }}
      className={clsx(
        'relative rounded-lg overflow-hidden cursor-pointer group',
        'border-2 transition-[border-color,box-shadow] duration-200',
        isSelectedByMe
          ? 'border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.4)]'
          : 'border-white/10 hover:border-amber-400/40 shadow-xl'
      )}
      onClick={() => onSelect(faction.id)}
      onMouseEnter={() => onHover(faction.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* 卡牌图：使用 CardSprite 渲染召唤师（hero.png frameIndex=0） */}
      <div className={clsx(
        'transition-[filter,opacity] duration-300',
        isSelectedByMe
          ? 'brightness-110'
          : 'brightness-75 opacity-80 group-hover:brightness-100 group-hover:opacity-100'
      )}>
        <CardSprite
          atlasId={atlasId}
          frameIndex={0}
          className="w-full"
        />
      </div>

      {/* 底部渐变遮罩 + 阵营名 + 放大按钮 */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pt-[2vw] pb-[0.4vw] px-[0.5vw] flex items-end justify-between">
        <div className="text-[clamp(10px,0.75vw,16px)] font-bold text-white/90 tracking-wide drop-shadow-md">
          {t(faction.nameKey)}
        </div>
        {/* 放大查看按钮 */}
        <button
          className="text-white/50 hover:text-white/90 transition-colors duration-150 p-[0.2vw] cursor-pointer"
          onClick={(e) => onMagnify(faction.id, e)}
          title={t('actions.magnify')}
        >
          <svg width="clamp(14px,1vw,20px)" height="clamp(14px,1vw,20px)" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5 8a1 1 0 011-1h1V6a1 1 0 012 0v1h1a1 1 0 110 2H9v1a1 1 0 11-2 0V9H6a1 1 0 01-1-1z" />
            <path fillRule="evenodd" d="M8 14A6 6 0 108 2a6 6 0 000 12zm0-2a4 4 0 100-8 4 4 0 000 8z" clipRule="evenodd" />
            <path d="M12.293 11.293a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414z" />
          </svg>
        </button>
      </div>

      {/* 选中指示器（顶部金色条） */}
      {isSelectedByMe && (
        <motion.div
          layoutId="faction-selected-indicator"
          className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent"
        />
      )}

      {/* P1/P2 占用标记 */}
      {occupyingPlayers.length > 0 && (
        <div className="absolute top-[0.3vw] right-[0.3vw] flex gap-[0.2vw]">
          {occupyingPlayers.map(pid => {
            const colors = PLAYER_COLORS[pid as '0' | '1'];
            return (
              <div
                key={pid}
                className="rounded-full flex items-center justify-center font-black shadow-lg border border-white/60"
                style={{
                  width: 'clamp(16px, 1.3vw, 28px)',
                  height: 'clamp(16px, 1.3vw, 28px)',
                  fontSize: 'clamp(8px, 0.5vw, 12px)',
                  backgroundColor: colors.bg,
                  color: colors.text,
                  boxShadow: `0 0 8px ${colors.glow}`,
                }}
              >
                {getPlayerShortLabel(t, pid)}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

// ============================================================================
// 子组件：玩家状态卡片（固定尺寸，不因内容变化而位移）
// ============================================================================

interface PlayerStatusCardProps {
  pid: string;
  isMe: boolean;
  factionId: FactionId | 'unselected' | undefined;
  isReady: boolean;
  playerName: string;
  /** 自定义牌组选择信息（如果该玩家选择了自定义牌组） */
  customDeckInfo?: CustomDeckInfo;
  t: TFunction;
}

const PlayerStatusCard: React.FC<PlayerStatusCardProps> = ({
  pid, isMe, factionId, isReady, playerName, customDeckInfo, t,
}) => {
  const colors = PLAYER_COLORS[pid as '0' | '1'];
  const selected = factionId && factionId !== 'unselected';
  const factionEntry = selected
    ? FACTION_CATALOG.find(f => f.id === factionId)
    : null;

  // 判断是否为自定义牌组选择
  const isCustomDeck = !!customDeckInfo;

  // 显示名称：自定义牌组显示"自定义牌组"标签，否则显示阵营名
  const displayName = isCustomDeck
    ? t('factionSelection.customDeckLabel')
    : factionEntry
      ? t(factionEntry.nameKey)
      : t('factionSelection.notSelected');

  // 自定义牌组时显示召唤师所属阵营信息
  const customDeckSubtext = isCustomDeck && customDeckInfo
    ? (() => {
        const summonerFactionEntry = FACTION_CATALOG.find(f => f.id === customDeckInfo.summonerFaction);
        return summonerFactionEntry
          ? t('factionSelection.customDeckSummoner', { name: t(summonerFactionEntry.nameKey) })
          : customDeckInfo.deckName;
      })()
    : null;

  return (
    <div
      className={clsx(
        'relative flex items-center gap-[0.8vw] px-[1vw] py-[0.6vw] rounded-lg transition-all duration-300',
        'border backdrop-blur-md overflow-hidden',
        isMe
          ? 'bg-amber-900/10 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
          : 'bg-white/5 border-white/10'
      )}
    >
      {/* 侧边装饰条 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: colors.bg }}
      />

      {/* 内部背景斜切流光 */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-gradient-to-tr from-transparent via-white to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
      {/* 玩家标识圆球 */}
      <div
        className="rounded-full flex items-center justify-center font-black shrink-0"
        style={{
          width: 'clamp(24px, 1.8vw, 36px)',
          height: 'clamp(24px, 1.8vw, 36px)',
          fontSize: 'clamp(10px, 0.6vw, 14px)',
          backgroundColor: colors.bg,
          color: colors.text,
          boxShadow: `0 0 10px ${colors.glow}`,
        }}
      >
        {getPlayerShortLabel(t, pid)}
      </div>

      {/* 信息区 */}
      <div className="flex-1 min-w-0">
        <div className={clsx(
          'text-[clamp(11px,0.7vw,15px)] font-bold leading-tight truncate flex items-center gap-1',
          (selected || isCustomDeck) ? 'text-amber-300' : 'text-white/40'
        )}>
          {displayName}
          {/* 自定义牌组标识徽章 */}
          {isCustomDeck && (
            <span className="inline-flex items-center bg-purple-500/20 text-purple-300 text-[8px] px-1.5 py-0.5 rounded border border-purple-500/30 uppercase tracking-wider font-bold shrink-0">
              DIY
            </span>
          )}
        </div>
        {/* 自定义牌组时显示召唤师信息 */}
        {customDeckSubtext ? (
          <div className="text-[clamp(9px,0.5vw,12px)] text-purple-300/60 truncate leading-tight mt-[0.1vw]">
            {customDeckSubtext}
          </div>
        ) : null}
        <div className="text-[clamp(9px,0.5vw,12px)] text-white/40 truncate leading-tight mt-[0.1vw]">
          {playerName}
          {isMe && <span className="ml-1 text-amber-400/70 font-bold">{t('player.youTag')}</span>}
        </div>
      </div>

      {/* 就绪状态（固定宽度占位） */}
      <div className="w-[clamp(18px,1.2vw,24px)] shrink-0 flex items-center justify-center">
        {isReady && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-[clamp(16px,1vw,22px)] h-[clamp(16px,1vw,22px)] rounded-full bg-emerald-500 flex items-center justify-center"
          >
            <Check size={12} className="text-white" strokeWidth={3} />
          </motion.div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 子组件：操作按钮
// ============================================================================

interface ActionButtonProps {
  isHost: boolean;
  hasSelected: boolean;
  isReady: boolean;
  everyoneReady: boolean;
  onReady: () => void;
  onStart: () => void;
  t: TFunction;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  isHost, hasSelected, isReady, everyoneReady, onReady, onStart, t,
}) => {
  if (isHost && hasSelected) {
    return (
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        disabled={!everyoneReady}
        onClick={onStart}
        className={clsx(
          'px-[2.5vw] py-[0.7vw] rounded-xl text-[clamp(12px,0.9vw,18px)] font-black tracking-[0.2em] uppercase',
          'border-2 transition-[background-color,border-color,opacity,transform,box-shadow] duration-200',
          everyoneReady
            ? 'bg-gradient-to-b from-amber-400 via-amber-600 to-amber-700 text-white border-amber-300 shadow-[0_4px_0_#92400e,0_8px_20px_rgba(245,158,11,0.25)] hover:brightness-110 active:translate-y-[2px] active:shadow-[0_2px_0_#92400e] cursor-pointer'
            : 'bg-white/5 text-white/20 border-white/10 cursor-not-allowed'
        )}
      >
        {everyoneReady
          ? t('factionSelection.start')
          : t('factionSelection.waitAll')}
      </motion.button>
    );
  }

  if (!isHost && hasSelected && !isReady) {
    return (
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onReady}
        className="px-[2vw] py-[0.6vw] rounded-xl text-[clamp(11px,0.85vw,16px)] font-bold tracking-wider bg-gradient-to-b from-emerald-400 to-emerald-600 text-white border-2 border-emerald-300 shadow-[0_3px_0_#047857] hover:brightness-110 active:translate-y-[2px] active:shadow-none cursor-pointer transition-[transform] duration-200"
      >
        {t('factionSelection.ready')}
      </motion.button>
    );
  }

  if (!isHost && isReady) {
    return (
      <div className="px-[2vw] py-[0.6vw] rounded-xl text-[clamp(11px,0.85vw,16px)] font-bold tracking-wider border-2 bg-white/5 text-emerald-400/70 border-emerald-400/30">
        {t('factionSelection.waiting')}
      </div>
    );
  }

  return null;
};
