/**
 * 自定义牌组卡片组件
 * 
 * 用于在阵营选择界面展示已保存的自定义牌组。
 * 设计与 FactionCard 保持一致，但增加了 DIY 徽章和编辑按钮。
 */

import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { TFunction } from 'i18next';
import type { SavedDeckSummary } from '../../../api/custom-deck';
import type { FactionId } from '../domain/types';
import { CardSprite } from './CardSprite';
import { getSummonerAtlasIdByFaction } from './helpers/customDeckHelpers';

// 玩家配色（与 FactionSelectionAdapter 保持一致）
const PLAYER_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  '0': { bg: '#F43F5E', border: '#fb7185', text: 'white', glow: 'rgba(244,63,94,0.4)' },
  '1': { bg: '#3B82F6', border: '#60a5fa', text: 'white', glow: 'rgba(59,130,246,0.4)' },
};

const getPlayerShortLabel = (t: TFunction, pid: string) => t('player.short', {
  id: pid === '0' ? 1 : 2,
});

export interface CustomDeckCardProps {
  /** 牌组摘要信息 */
  deck: SavedDeckSummary;
  /** 用于动画延迟的索引 */
  index: number;
  /** 是否被当前玩家选中 */
  isSelectedByMe: boolean;
  /** 占用该牌组的玩家 ID 列表 */
  occupyingPlayers: string[];
  /** i18n 翻译函数 */
  t: TFunction;
  /** 选择牌组回调 */
  onSelect: () => void;
  /** 编辑牌组回调 */
  onEdit: () => void;
  /** 放大预览回调 */
  onMagnify: (factionId: FactionId) => void;
  /** 是否为占位卡片（显示"自定义牌组"而非具体牌组名） */
  isPlaceholder?: boolean;
}

/**
 * 自定义牌组卡片组件
 * 
 * 功能：
 * - 显示召唤师精灵图（根据 summonerFaction 获取）
 * - 显示牌组名称（底部渐变遮罩）
 * - 显示 DIY 徽章（左上角，紫色主题）
 * - Hover 时显示编辑按钮（右上角）
 * - 选中状态：金色边框 + ring 效果
 * - 玩家占用标记（右上角，P1/P2 圆球）
 * - 入场动画、Hover 动画、点击动画
 */
export const CustomDeckCard: React.FC<CustomDeckCardProps> = ({
  deck,
  index,
  isSelectedByMe,
  occupyingPlayers,
  t,
  onSelect,
  onEdit,
  onMagnify,
  isPlaceholder = false,
}) => {
  // 获取召唤师精灵图 atlasId
  const atlasId = getSummonerAtlasIdByFaction(deck.summonerFaction);
  
  // 占位模式下显示"自定义牌组"文本
  const displayName = isPlaceholder 
    ? t('factionSelection.customDeck', '自定义牌组')
    : deck.name;

  return (
    <motion.div
      data-testid={`custom-deck-card-${deck.id}`}
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
      onClick={onSelect}
    >
      {/* 召唤师卡牌精灵图 */}
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

      {/* 底部渐变遮罩 + 牌组名称 + 放大按钮 */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pt-[2vw] pb-[0.4vw] px-[0.5vw] flex items-end justify-between">
        <div className="text-[clamp(10px,0.75vw,16px)] font-bold text-white/90 tracking-wide drop-shadow-md truncate">
          {displayName}
        </div>
        {/* 放大查看按钮 */}
        <button
          className="text-white/50 hover:text-white/90 transition-colors duration-150 p-[0.2vw] cursor-pointer shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onMagnify(deck.summonerFaction);
          }}
          title={t('actions.magnify')}
        >
          <svg width="clamp(14px,1vw,20px)" height="clamp(14px,1vw,20px)" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5 8a1 1 0 011-1h1V6a1 1 0 012 0v1h1a1 1 0 110 2H9v1a1 1 0 11-2 0V9H6a1 1 0 01-1-1z" />
            <path fillRule="evenodd" d="M8 14A6 6 0 108 2a6 6 0 000 12zm0-2a4 4 0 100-8 4 4 0 000 8z" clipRule="evenodd" />
            <path d="M12.293 11.293a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414z" />
          </svg>
        </button>
      </div>

      {/* DIY 徽章（左上角，紫色主题） */}
      <div className="absolute top-[0.3vw] left-[0.3vw] bg-purple-500/20 text-purple-300 text-[clamp(8px,0.5vw,12px)] px-[0.4vw] py-[0.2vw] rounded border border-purple-500/30 uppercase tracking-wider font-bold pointer-events-none">
        DIY
      </div>

      {/* 编辑按钮（右上角，Hover 显示） */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className={clsx(
          'absolute top-[0.3vw] right-[0.3vw] rounded-full bg-black/60 text-white/70 hover:bg-black/80 hover:text-white',
          'flex items-center justify-center transition-opacity z-20',
          'opacity-0 group-hover:opacity-100',
          // 如果有玩家占用标记，编辑按钮需要避让
          occupyingPlayers.length > 0 ? 'mr-[clamp(20px,1.5vw,32px)]' : ''
        )}
        style={{
          width: 'clamp(20px,1.5vw,32px)',
          height: 'clamp(20px,1.5vw,32px)',
        }}
        title={t('factionSelection.editDeck')}
      >
        {/* 铅笔图标 */}
        <svg width="clamp(12px,0.8vw,18px)" height="clamp(12px,0.8vw,18px)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>

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
