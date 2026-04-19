/**
 * 召唤师战争 - 卡牌预览映射
 *
 * 用于 ActionLog / HUD 的卡牌预览获取（基于卡牌配置静态映射）。
 */

import type { CardPreviewRef } from '../../../core';
import type { Card } from '../domain/types';
import { createDeckByFactionId } from '../config/factions';
import { resolveCardAtlasId } from './cardAtlas';
import { getBaseCardId, VALID_FACTION_IDS } from '../domain/ids';

interface CardPreviewMeta {
  name: string;
  previewRef: CardPreviewRef | null;
}

const CARD_PREVIEW_MAP = new Map<string, CardPreviewMeta>();

/** 召唤师战争卡牌宽高比（横向卡牌） */
const SW_CARD_ASPECT_RATIO = 1044 / 729;
const SW_PORTAL_ASPECT_RATIO = 1024 / 715;

const buildPreviewRef = (card: Card): CardPreviewRef | null => {
  if (card.spriteIndex === undefined || card.spriteIndex === null) return null;
  const spriteAtlas = card.spriteAtlas ?? 'cards';
  if (spriteAtlas === 'portal') {
    return { type: 'atlas', atlasId: 'sw:portal', index: card.spriteIndex, aspectRatio: SW_PORTAL_ASPECT_RATIO };
  }
  const atlasId = resolveCardAtlasId(card, spriteAtlas as 'hero' | 'cards');
  return { type: 'atlas', atlasId, index: card.spriteIndex, aspectRatio: SW_CARD_ASPECT_RATIO };
};

const registerCard = (card: Card): void => {
  const baseId = getBaseCardId(card.id);
  if (CARD_PREVIEW_MAP.has(baseId)) return;
  CARD_PREVIEW_MAP.set(baseId, {
    name: card.name,
    previewRef: buildPreviewRef(card),
  });
};

const initializeCardPreviewMap = (): void => {
  if (CARD_PREVIEW_MAP.size > 0) return;
  for (const faction of VALID_FACTION_IDS) {
    const deckData = createDeckByFactionId(faction);
    registerCard(deckData.summoner);
    registerCard(deckData.startingGate);
    deckData.startingUnits.forEach((unit) => registerCard(unit.unit));
    deckData.deck.forEach((card) => registerCard(card));
  }
};

export const getSummonerWarsCardPreviewMeta = (cardId: string): CardPreviewMeta | null => {
  initializeCardPreviewMap();
  const baseId = getBaseCardId(cardId);
  return CARD_PREVIEW_MAP.get(baseId) ?? null;
};

export const getSummonerWarsCardPreviewRef = (cardId: string): CardPreviewRef | null => {
  return getSummonerWarsCardPreviewMeta(cardId)?.previewRef ?? null;
};
