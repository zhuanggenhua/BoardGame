import { inferMonsterDefinitionId } from './monsterReadModel';
import { getRuntimeImageCandidateUrls } from '../../core/AssetLoader';
import type { MapSceneSprite } from '../../engine/mapRenderer/types';
import { resolveSpriteAtlasFrame } from '../../engine/primitives/spriteAtlas';
import { resolveRoomEntitySlots, EXPLORER_TOKEN_SILHOUETTE, MONSTER_TOKEN_SILHOUETTE, MONSTER_SQUARE_SILHOUETTE } from './roomEntitySceneModel';
import type { BetrayalExplorerSummary, BetrayalMonsterSummary, BetrayalRoomNode } from './game';
import { resolveBetrayalRoomNodeTileVisual } from './roomAtlas';
import { resolveRoomTileRotationDegrees, resolveRoomTileStyle, type RoomCanvasLayout } from './roomMapModel';

/** Projects existing room/atlas authoring into the shared renderer. Does not infer rules or write core. */
export function resolveBetrayalRoomSceneSprites(
    rooms: readonly BetrayalRoomNode[],
    layout: RoomCanvasLayout,
    locale: string,
): MapSceneSprite[] {
    return rooms.map(room => {
        const discovered = room.state === 'discovered';
        const visual = resolveBetrayalRoomNodeTileVisual(room, discovered);
        const frame = resolveSpriteAtlasFrame(visual.frameIndex, visual.config);
        const rect = resolveRoomTileStyle(room, layout);
        const scale = Math.min(rect.width / frame.width, rect.height / frame.height);
        const width = frame.width * scale;
        const height = frame.height * scale;
        return {
            id: room.id,
            textureUrls: getRuntimeImageCandidateUrls(visual.image, locale),
            x: rect.left + (rect.width - width) / 2,
            y: rect.top + (rect.height - height) / 2,
            width,
            height,
            frame: {
                x: frame.x / visual.config.imageW,
                y: frame.y / visual.config.imageH,
                width: frame.width / visual.config.imageW,
                height: frame.height / visual.config.imageH,
            },
            rotation: (resolveRoomTileRotationDegrees(room, discovered) ?? 0) * Math.PI / 180,
            alpha: discovered ? 0.95 : 0.82,
        };
    });
}

/** Artwork and DOM targets consume the same identity/slot projection. */
export function resolveBetrayalEntitySceneSprites(
    rooms: readonly BetrayalRoomNode[],
    occupantsByRoom: Readonly<Record<string, readonly BetrayalExplorerSummary[]>>,
    monstersByRoom: Readonly<Record<string, readonly BetrayalMonsterSummary[]>>,
    layout: RoomCanvasLayout,
    locale: string,
    currentPlayerId: string,
    movingExplorerPlayerId?: string | null,
    movingMonsterId?: string | null,
): MapSceneSprite[] {
    return rooms.flatMap(room => {
        const occupants = occupantsByRoom[room.id] ?? [];
        const monsters = monstersByRoom[room.id] ?? [];
        const slots = resolveRoomEntitySlots([
            ...occupants.map(explorer => `player:${explorer.playerId}`),
            ...monsters.map(monster => `monster:${monster.id}`),
        ]);
        const rect = resolveRoomTileStyle(room, layout);
        return [
            ...occupants.flatMap(explorer => {
                if (!explorer.tokenAsset || explorer.playerId === movingExplorerPlayerId) return [];
                const slot = slots.get(`player:${explorer.playerId}`)!;
                return [{
                    id: `player:${explorer.playerId}`,
                    textureUrls: getRuntimeImageCandidateUrls(explorer.tokenAsset, locale),
                    x: rect.left + slot.x + slot.size * (1 - 66 / 72) / 2,
                    y: rect.top + slot.y,
                    width: slot.size * 66 / 72, height: slot.size,
                    clipPolygon: EXPLORER_TOKEN_SILHOUETTE,
                    border: { color: explorer.playerId === currentPlayerId ? 0x8af05f : 0xf5cc48, width: 3 },
                    imageFit: 'cover' as const, imageScale: 1.16,
                }];
            }),
            ...monsters.flatMap(monster => {
                if (monster.id === movingMonsterId) return [];
                const slot = slots.get(`monster:${monster.id}`)!;
                return [{
                    id: `monster:${monster.id}`,
                    textureUrls: getRuntimeImageCandidateUrls(monster.tokenAsset ?? monster.portraitAsset, locale),
                    x: rect.left + slot.x, y: rect.top + slot.y,
                    width: slot.size, height: slot.size,
                    clipPolygon: inferMonsterDefinitionId(monster) === "mummy" ? MONSTER_TOKEN_SILHOUETTE : MONSTER_SQUARE_SILHOUETTE,
                    border: { color: 0xda4a39, width: 3 },
                    imageFit: 'contain' as const,
                }];
            }),
        ];
    });
}
