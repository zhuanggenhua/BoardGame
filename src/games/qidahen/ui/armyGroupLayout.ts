import type { QidahenMapToken } from '../domain/types';
import type { QidahenArmyCallout } from './fieldArmyLayout';
import type { PopulationSite } from './populationLayout';
import { QIDAHEN_MAP_NAMEPLATE_OBSTACLES, QIDAHEN_PRINTED_NAMEPLATE_BOUNDS } from './mapGraph';

export interface ArmyGroup {
    regionId: string;
    anchor: { x: number; y: number };
    left: number;
    top: number;
    width: number;
    height: number;
}
type Rect = { left: number; top: number; width: number; height: number; excludeRegionId?: string };
export type ArmyGroupView = { visible: Rect; overlays: readonly Rect[]; protectedRegionIds?: readonly string[] };

/** 分阵营稳定放置地区内的超容量兵堆，找不到位置时显式返回未解决地区。 */
export function layoutOverflowArmyStacks(
    tokens: readonly QidahenMapToken[], stackTokenIds: ReadonlySet<string>, sites: ReadonlyMap<string, PopulationSite>, width: number, height: number,
): { tokens: QidahenMapToken[]; unresolvedRegionIds: string[] } {
    const stacks = tokens.filter(token => stackTokenIds.has(token.id)).slice().sort((a, b) =>
        (a.regionId ?? '').localeCompare(b.regionId ?? '') || a.faction.localeCompare(b.faction) || a.id.localeCompare(b.id));
    const occupied = tokens.filter(token => !stackTokenIds.has(token.id)).map(token => ({ x: token.x * width,
        y: token.y * height, half: (token.size ?? 30) / 2 }));
    occupied.push(...QIDAHEN_MAP_NAMEPLATE_OBSTACLES.map(item => ({ x: item.x, y: item.y, half: item.size / 2 })));
    const positions = new Map<string, { x: number; y: number }>();
    const unresolved = new Set<string>();
    for (const token of stacks) {
        const site = token.regionId ? sites.get(token.regionId) : undefined;
        if (!site) { if (token.regionId) unresolved.add(token.regionId); continue; }
        const half = (token.size ?? 26) / 2;
        let best: { x: number; y: number } | undefined;
        let bestScore = Infinity;
        for (const point of site.candidates) {
            if (occupied.some(box => Math.abs(point.x - box.x) < half + box.half + 4
                && Math.abs(point.y - box.y) < half + box.half + 4)) continue;
            const score = (point.x - site.anchor.x) ** 2 + (point.y - site.anchor.y) ** 2;
            if (score < bestScore) { best = point; bestScore = score; }
        }
        if (!best) { unresolved.add(token.regionId!); positions.set(token.id, site.anchor); continue; }
        positions.set(token.id, best);
        occupied.push({ ...best, half });
    }
    return { tokens: tokens.map(token => {
        const point = positions.get(token.id);
        return point ? { ...token, x: point.x / width, y: point.y / height } : token;
    }), unresolvedRegionIds: [...unresolved] };
}

/** 同一地区和阵营的部队形成一个堆；只有玩家看得见的不同面值才标为混编。 */
export function compactCrowdedArmies(
    tokens: readonly QidahenMapToken[], crowdedRegionIds: ReadonlySet<string>, expandedRegionIds: ReadonlySet<string>,
    visibleFaceKey: (token: QidahenMapToken) => string | null,
    selectiveRegionIds: ReadonlySet<string> = new Set(), preservedPieceIds: ReadonlySet<string> = new Set(),
): { tokens: QidahenMapToken[]; stackSizes: ReadonlyMap<string, number>; mixedStacks: ReadonlySet<string> } {
    const representatives = new Map<string, QidahenMapToken>();
    const stackSizes = new Map<string, number>();
    const visibleFaces = new Map<string, Set<string>>();
    const hiddenStacks = new Set<string>();
    const visible = tokens.filter(token => {
        if (token.type !== 'army' || token.location !== 'field' || !token.regionId || !crowdedRegionIds.has(token.regionId)) return true;
        if (selectiveRegionIds.has(token.regionId)) {
            if (token.pieceId && preservedPieceIds.has(token.pieceId)) return true;
        } else if (expandedRegionIds.has(token.regionId)) return true;
        const key = JSON.stringify([token.regionId, token.faction]);
        const representative = representatives.get(key);
        const representativeId = representative?.id ?? token.id;
        const face = visibleFaceKey(token);
        if (face == null) hiddenStacks.add(representativeId);
        else {
            const faces = visibleFaces.get(representativeId) ?? new Set<string>();
            faces.add(face);
            visibleFaces.set(representativeId, faces);
        }
        if (!representative) {
            representatives.set(key, token);
            stackSizes.set(token.id, 1);
            return true;
        }
        stackSizes.set(representative.id, (stackSizes.get(representative.id) ?? 0) + 1);
        return false;
    });
    const mixedStacks = new Set([...visibleFaces].filter(([id, faces]) => !hiddenStacks.has(id) && faces.size > 1).map(([id]) => id));
    return { tokens: visible, stackSizes, mixedStacks };
}

/** 将拥挤地区的真实兵牌一起排列，避免散落到其他地区而丢失归属。 */
export function groupCrowdedArmies(
    tokens: readonly QidahenMapToken[], callouts: readonly QidahenArmyCallout[],
    sites: ReadonlyMap<string, PopulationSite>, width: number, height: number, view?: ArmyGroupView | null,
): { tokens: readonly QidahenMapToken[]; callouts: readonly QidahenArmyCallout[]; groups: ArmyGroup[] } {
    const groupedIds = new Set<string>();
    const positions = new Map<string, { x: number; y: number }>();
    const groups: ArmyGroup[] = [];
    const regionIds = [...new Set(callouts.map(callout => tokens.find(token => token.id === callout.tokenId)?.regionId).filter((id): id is string => !!id))].sort();
    for (const regionId of regionIds) {
        const pieces = tokens.filter(token => token.type === 'army' && token.location === 'field' && token.regionId === regionId);
        if (pieces.length < 3 || callouts.filter(callout => pieces.some(token => token.id === callout.tokenId)).length < 2) continue;
        const control = tokens.find(token => token.type === 'control' && token.regionId === regionId);
        const anchor = control ? { x: control.x * width, y: control.y * height } : sites.get(regionId)!.anchor;
        const defaultColumns = Math.min(pieces.length > 6 ? 5 : 3, pieces.length);
        let columns = defaultColumns;
        const size = Math.max(...pieces.map(token => token.size ?? 30));
        const step = size + 12;
        let panelWidth = columns * step + 12;
        let panelHeight = Math.ceil(pieces.length / columns) * step + 24;
        const others = tokens.filter(token => !pieces.includes(token)).map(token => ({
            x: positions.get(token.id)?.x ?? token.x * width, y: positions.get(token.id)?.y ?? token.y * height,
            half: (token.size ?? 30) / 2 + 5,
        }));
        others.push(...QIDAHEN_MAP_NAMEPLATE_OBSTACLES.map(item => ({ x: item.x, y: item.y, half: item.size / 2 + 4 })));
        others.push({ ...anchor, half: 8 });
        // 屏幕重排时，当前决策涉及的地区仍须可读、可操作；无关地图兵牌不应让标题永远藏在上层 HUD 下。
        const protectedRegions = new Set(view?.protectedRegionIds ?? []);
        const readableOthers = tokens.filter(token => !pieces.includes(token) && (token.type === 'control' || (token.regionId && protectedRegions.has(token.regionId))))
            .map(token => ({ x: positions.get(token.id)?.x ?? token.x * width, y: positions.get(token.id)?.y ?? token.y * height,
                half: (token.size ?? 30) / 2 + 5 }));
        readableOthers.push({ ...anchor, half: 8 });
        // 面板贴住地图顶边会让镜头为避开上层状态栏露出地图外空白。
        const overlaps = (a: Rect, b: Rect) => a.left < b.left + b.width && a.left + a.width > b.left
            && a.top < b.top + b.height && a.top + a.height > b.top;
        const findPosition = (readable: boolean) => {
        let best: { left: number; top: number; score: number } | undefined;
        const topInset = Math.min(panelHeight / 3, Math.max(2, height - panelHeight - 2));
        for (let top = Math.max(2, Math.ceil(topInset / 6) * 6 + 2); top + panelHeight < height; top += 6) for (let left = 2; left + panelWidth < width; left += 6) {
            const panel = { left, top, width: panelWidth, height: panelHeight };
            if (readable && view && (left < view.visible.left || top < view.visible.top
                || left + panelWidth > view.visible.left + view.visible.width || top + panelHeight > view.visible.top + view.visible.height
                || view.overlays.some(rect => rect.excludeRegionId !== regionId && overlaps(panel, rect)))) continue;
            const dx = Math.max(left - anchor.x, 0, anchor.x - left - panelWidth);
            const dy = Math.max(top - anchor.y, 0, anchor.y - top - panelHeight);
            const score = dx * dx + dy * dy;
            if (best && score >= best.score) continue;
            if ((readable ? readableOthers : others).some(item => left < item.x + item.half && left + panelWidth > item.x - item.half
                && top < item.y + item.half && top + panelHeight > item.y - item.half)) continue;
            if (!readable && QIDAHEN_PRINTED_NAMEPLATE_BOUNDS.some(bounds => left < bounds.left + bounds.width + 4 && left + panelWidth + 4 > bounds.left
                && top < bounds.top + bounds.height + 4 && top + panelHeight + 4 > bounds.top)) continue;
            if (groups.some(group => left < group.left + group.width + 5 && left + panelWidth + 5 > group.left
                && top < group.top + group.height + 5 && top + panelHeight + 5 > group.top)) continue;
            best = { left, top, score };
        }
        return best;
        };
        let best = findPosition(false);
        if (best && view) {
            const panel = { left: best.left, top: best.top, width: panelWidth, height: panelHeight };
            const panelVisible = panel.left >= view.visible.left && panel.top >= view.visible.top
                && panel.left + panel.width <= view.visible.left + view.visible.width && panel.top + panel.height <= view.visible.top + view.visible.height;
            if (overlaps(panel, view.visible) && (!panelVisible || view.overlays.some(rect => rect.excludeRegionId !== regionId && overlaps(panel, rect)))) {
                const original = best;
                let readablePosition: ReturnType<typeof findPosition> = undefined;
                for (const candidateColumns of [...new Set([defaultColumns, 3, 2].map(value => Math.min(value, pieces.length)))]) {
                    columns = candidateColumns;
                    panelWidth = columns * step + 12;
                    panelHeight = Math.ceil(pieces.length / columns) * step + 24;
                    readablePosition = findPosition(true);
                    if (readablePosition) break;
                }
                if (readablePosition) best = readablePosition;
                else {
                    columns = defaultColumns;
                    panelWidth = columns * step + 12;
                    panelHeight = Math.ceil(pieces.length / columns) * step + 24;
                    best = original;
                }
            }
        }
        if (!best) continue;
        const group = { regionId, anchor, left: best.left, top: best.top, width: panelWidth, height: panelHeight };
        groups.push(group);
        pieces.forEach((token, index) => {
            groupedIds.add(token.id);
            positions.set(token.id, { x: group.left + 6 + step * (index % columns) + step / 2,
                y: group.top + 21 + step * Math.floor(index / columns) + step / 2 });
        });
    }
    return {
        tokens: tokens.map(token => { const p = positions.get(token.id); return p ? { ...token, x: p.x / width, y: p.y / height } : token; }),
        callouts: callouts.filter(callout => !groupedIds.has(callout.tokenId)), groups,
    };
}
