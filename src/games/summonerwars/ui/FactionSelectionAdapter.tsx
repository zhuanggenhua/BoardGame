/**
 * 召唤师战争 - 阵营选择界面（重构版）
 * 
 * 设计理念：
 * - 使用游戏内 CardSprite 渲染召唤师卡牌，风格与局内一致
 * - 固定布局，玩家状态区不因 hover 产生位移
 * - 点击卡牌可放大查看（与局内一致）
 * - 预览区与玩家状态区独立布局，互不挤压
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { MagnifyOverlay } from '../../../components/common/overlays/MagnifyOverlay';
import clsx from 'clsx';
import type { PlayerId } from '../../../engine/types';
import type { FactionId } from '../domain/types';
import { FACTION_CATALOG, type FactionCatalogEntry } from '../config/factions';
import { CardSprite } from './CardSprite';
import { initSpriteAtlases } from './cardAtlas';
import type { TFunction } from 'i18next';

// 模块级初始化精灵图注册表（同步、幂等，确保首次渲染即可用）
initSpriteAtlases();

// 玩家配色
const PLAYER_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  '0': { bg: '#F43F5E', border: '#fb7185', text: 'white', glow: 'rgba(244,63,94,0.4)' },
  '1': { bg: '#3B82F6', border: '#60a5fa', text: 'white', glow: 'rgba(59,130,246,0.4)' },
};
const getPlayerShortLabel = (t: TFunction, pid: string) => t('player.short', {
  id: pid === '0' ? 1 : 2,
});

/** 根据阵营 ID 获取召唤师精灵图 atlasId */
function getSummonerAtlasId(factionId: string): string {
  const entry = FACTION_CATALOG.find(f => f.id === factionId);
  if (!entry) return '';
  const match = entry.heroImagePath.match(/hero\/(\w+)\//);
  const dir = match?.[1] ?? 'Necromancer';
  return `sw:${dir.toLowerCase()}:hero`;
}

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
}) => {
  const { t } = useTranslation('game-summonerwars');
  const isHost = currentPlayerId === hostPlayerId;
  const playerIds = ['0', '1'];

  // 当前玩家已选阵营
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

  // 放大预览状态（支持 tip 图和召唤师卡牌两种）
  const [magnifyImage, setMagnifyImage] = useState<string | null>(null);
  const [magnifySprite, setMagnifySprite] = useState<{ atlasId: string; frameIndex: number } | null>(null);

  // 点击卡牌放大查看召唤师
  const handleMagnifyCard = useCallback((factionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 不触发选择
    const atlasId = getSummonerAtlasId(factionId);
    if (atlasId) setMagnifySprite({ atlasId, frameIndex: 0 });
  }, []);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col bg-[#0d1117] overflow-hidden select-none text-white font-sans w-screen h-screen"
    >
      {/* 背景氛围层 */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d1117] via-[#161b22] to-[#0d1117]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,_rgba(245,158,11,0.06)_0%,_transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }} />
      </div>

      {/* 标题区 */}
      <div className="relative z-10 text-center pt-[2.5vh] pb-[1.5vh]">
        <h1 className="text-[clamp(18px,1.6vw,32px)] font-black tracking-[0.25em] text-amber-400/90"
          style={{ textShadow: '0 0 20px rgba(245,158,11,0.3)' }}>
          {t('factionSelection.title')}
        </h1>
        <p className="text-[clamp(10px,0.65vw,14px)] text-white/35 mt-[0.5vh] tracking-wider">
          {t('factionSelection.subtitle')}
        </p>
      </div>

      {/* 主内容区 */}
      <div className="relative z-10 flex-1 flex flex-col min-h-0 px-[4vw]">
        {/* 阵营卡片网格（两排三列） */}
        <div className="flex-shrink-0">
          <div className="grid grid-cols-3 gap-[0.8vw] max-w-[54vw] mx-auto">
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
                    className="h-full cursor-zoom-in rounded-lg overflow-hidden border border-white/10 hover:border-amber-400/40 transition-colors duration-200"
                    onClick={() => setMagnifyImage(previewEntry.tipImagePath)}
                  >
                    <OptimizedImage
                      src={previewEntry.tipImagePath}
                      className="h-full w-auto object-contain"
                      alt={t('factionSelection.tipAlt', { name: t(previewEntry.nameKey) })}
                    />
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
  const atlasId = getSummonerAtlasId(faction.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className={clsx(
        'relative rounded-lg overflow-hidden cursor-pointer group',
        'border-2 transition-[border-color,box-shadow] duration-200',
        isSelectedByMe
          ? 'border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.35)]'
          : 'border-white/8 hover:border-white/25'
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
  t: TFunction;
}

const PlayerStatusCard: React.FC<PlayerStatusCardProps> = ({
  pid, isMe, factionId, isReady, playerName, t,
}) => {
  const colors = PLAYER_COLORS[pid as '0' | '1'];
  const selected = factionId && factionId !== 'unselected';
  const factionEntry = selected
    ? FACTION_CATALOG.find(f => f.id === factionId)
    : null;

  return (
    <div
      className={clsx(
        'flex items-center gap-[0.6vw] px-[0.8vw] py-[0.5vw] rounded-lg transition-[background-color,border-color] duration-200',
        'border',
        isMe
          ? 'bg-white/10 border-amber-400/40'
          : 'bg-white/5 border-white/8'
      )}
    >
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
          'text-[clamp(11px,0.7vw,15px)] font-bold leading-tight truncate',
          selected ? 'text-amber-300' : 'text-white/40'
        )}>
          {factionEntry ? t(factionEntry.nameKey) : t('factionSelection.notSelected')}
        </div>
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
            <span className="text-[clamp(8px,0.55vw,12px)] font-bold text-white">✓</span>
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
          'px-[2vw] py-[0.6vw] rounded-xl text-[clamp(11px,0.85vw,16px)] font-bold tracking-wider',
          'border-2 transition-[background-color,border-color,opacity,transform] duration-200',
          everyoneReady
            ? 'bg-gradient-to-b from-amber-400 to-amber-600 text-white border-amber-300 shadow-[0_3px_0_#b45309] hover:brightness-110 active:translate-y-[2px] active:shadow-none cursor-pointer'
            : 'bg-white/5 text-white/25 border-white/10 cursor-not-allowed'
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
