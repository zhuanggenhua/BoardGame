import type { UGCGameState } from '../sdk/types';

export const BUILDER_PREVIEW_CONFIG_KEY = 'builderPreviewConfig';

export interface BuilderPreviewConfig {
  layout: Array<{
    id: string;
    type: string;
    anchor: { x: number; y: number };
    pivot: { x: number; y: number };
    offset: { x: number; y: number };
    width: number;
    height: number;
    data: Record<string, unknown>;
    renderComponentId?: string;
  }>;
  renderComponents: Array<{
    id: string;
    name: string;
    targetSchema: string;
    renderCode: string;
    backRenderCode?: string;
  }>;
  instances: Record<string, Record<string, unknown>[]>;
  layoutGroups?: Array<{ id: string; name: string; hidden: boolean }>;
  schemaDefaults?: Record<string, string>;
}
const buildInstanceCatalog = (
  instances: BuilderPreviewConfig['instances'],
  schemaIds: Set<string>
) => {
  const catalog = new Map<string, Record<string, unknown>>();
  schemaIds.forEach(schemaId => {
    const items = instances[schemaId];
    if (!Array.isArray(items)) return;
    items.forEach(item => {
      if (!item || typeof item !== 'object' || !('id' in item)) return;
      const id = String((item as { id?: unknown }).id ?? '');
      if (!id || catalog.has(id)) return;
      catalog.set(id, item as Record<string, unknown>);
    });
  });
  return catalog;
};

const deriveInstancesFromRuntime = (
  state: UGCGameState,
  config: BuilderPreviewConfig
): BuilderPreviewConfig['instances'] | null => {
  const publicZones = state.publicZones || {};
  const hands = publicZones.hands as Record<string, Array<Record<string, unknown>>> | undefined;
  const landlordCards = publicZones.landlordCards as Array<Record<string, unknown>> | undefined;
  const lastPlay = publicZones.lastPlay as { playerId?: string; cardIds?: Array<string | number> } | null | undefined;
  const playerOrder = (publicZones.playerOrder as Array<string | number> | undefined)?.map(id => String(id))
    || Object.keys(state.players || {});
  const playerMap = state.players || {};

  const cardSchemaIds = new Set<string>();
  const playerSchemaIds = new Set<string>();
  config.layout.forEach(comp => {
    const schemaId = (comp.data.bindSchema || comp.data.targetSchema) as string | undefined;
    if (!schemaId) return;
    if (comp.type === 'player-area') {
      playerSchemaIds.add(String(schemaId));
      return;
    }
    if (['hand-zone', 'play-zone', 'deck-zone', 'discard-zone'].includes(comp.type)) {
      cardSchemaIds.add(String(schemaId));
    }
  });

  if (cardSchemaIds.size === 0 && playerSchemaIds.size === 0) {
    return null;
  }

  const nextInstances: BuilderPreviewConfig['instances'] = {
    ...(config.instances || {}),
  };

  if (playerSchemaIds.size > 0) {
    const basePlayers = nextInstances[Array.from(playerSchemaIds)[0]] || [];
    const baseById = new Map(
      basePlayers
        .map(item => (item && typeof item === 'object' && 'id' in item ? [String((item as { id?: unknown }).id), item] : null))
        .filter((item): item is [string, Record<string, unknown>] => Boolean(item))
    );
    const resolvedPlayers = playerOrder.map((playerId, index) => {
      const base = baseById.get(playerId) || {};
      const playerState = playerMap[playerId] as { handCount?: number; public?: { role?: string } } | undefined;
      const role = playerState?.public?.role
      || (base.role as string | undefined);
      const cardCount = hands && hands[playerId]
        ? hands[playerId].length
        : (playerState?.handCount ?? (base.cardCount as number | undefined) ?? 0);
      const name = (base.name as string | undefined) || `玩家${index + 1}`;
      const seat = (base.seat as number | undefined) ?? index + 1;
      return {
        ...base,
        id: playerId,
        name,
        role,
        seat,
        cardCount,
      };
    });
    playerSchemaIds.forEach(schemaId => {
      nextInstances[schemaId] = resolvedPlayers;
    });
  }

  if (cardSchemaIds.size > 0) {
    const catalog = buildInstanceCatalog(nextInstances, cardSchemaIds);
    const cardItems: Record<string, unknown>[] = [];
    if (hands && typeof hands === 'object') {
      Object.entries(hands).forEach(([playerId, cards]) => {
        if (!Array.isArray(cards)) return;
        cards.forEach(card => {
          const cardId = String(card.id ?? '');
          const base = cardId ? catalog.get(cardId) || {} : {};
          const name = (card.name as string | undefined)
            || (base.name as string | undefined)
            || (card.display as string | undefined)
            || (base.display as string | undefined)
            || cardId;
          cardItems.push({
            ...base,
            ...card,
            id: cardId || card.id,
            name,
            ownerId: playerId,
            zone: 'hand',
          });
        });
      });
    }
    if (Array.isArray(landlordCards)) {
      const landlordId = String(publicZones.landlordId || 'landlord');
      landlordCards.forEach(card => {
        const cardId = String(card.id ?? '');
        const base = cardId ? catalog.get(cardId) || {} : {};
        const name = (card.name as string | undefined)
          || (base.name as string | undefined)
          || (card.display as string | undefined)
          || (base.display as string | undefined)
          || cardId;
        cardItems.push({
          ...base,
          ...card,
          id: cardId || card.id,
          name,
          ownerId: landlordId,
          zone: 'landlord',
        });
      });
    }
    if (lastPlay && Array.isArray(lastPlay.cardIds)) {
      const tableOwner = String(lastPlay.playerId || 'table');
      lastPlay.cardIds.forEach(rawId => {
        const cardId = String(rawId);
        const base = catalog.get(cardId) || {};
        cardItems.push({
          ...base,
          id: cardId,
          name: (base.name as string | undefined)
            || (base.display as string | undefined)
            || cardId,
          ownerId: tableOwner,
          zone: 'table',
        });
      });
    }
    cardSchemaIds.forEach(schemaId => {
      nextInstances[schemaId] = cardItems;
    });
  }

  return nextInstances;
};

export function attachBuilderPreviewConfig(
  state: UGCGameState,
  config: BuilderPreviewConfig
): UGCGameState {
  return {
    ...state,
    publicZones: {
      ...(state.publicZones || {}),
      [BUILDER_PREVIEW_CONFIG_KEY]: config,
    },
  };
}

export function extractBuilderPreviewConfig(
  state: UGCGameState | null
): BuilderPreviewConfig | null {
  if (!state) return null;
  const publicZones = state.publicZones || {};
  const config = publicZones[BUILDER_PREVIEW_CONFIG_KEY];
  if (!config || typeof config !== 'object') return null;
  const runtimeInstances = publicZones.instances;
  const derivedInstances = deriveInstancesFromRuntime(state, config as BuilderPreviewConfig);
  const resolvedInstances = runtimeInstances && typeof runtimeInstances === 'object'
    ? (runtimeInstances as BuilderPreviewConfig['instances'])
    : derivedInstances;
  if (resolvedInstances) {
    return {
      ...(config as BuilderPreviewConfig),
      instances: resolvedInstances,
    };
  }
  return config as BuilderPreviewConfig;
}
