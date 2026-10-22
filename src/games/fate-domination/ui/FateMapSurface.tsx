import { canViewFateHiddenShinto } from '../domain/playerView';
import { fitFateTableCamera, resizeFateTableCamera } from './tableCameraLayout';
import React from 'react';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { PixiMapSceneHost, type MapSceneSprite, type MapViewportState } from '../../../engine/mapRenderer';
import { getRuntimeImageCandidateUrls } from '../../../core/AssetLoader';
import type { FateDominationCore, LocationId } from '../domain/types';
import './map-surface.css';
import { fateTokenAsset } from './identityArtwork';
import {nextFateDeploymentSlot} from '../domain/deployment';
const WIDTH = 1927, HEIGHT = 1179;
// Printed E movement-cost/arrow rectangles, measured on the original Fuyuki board.
const MOVEMENT_EXITS: Partial<Record<LocationId, {x:number;y:number;w:number;h:number}>> = {
    workshop:{x:1216,y:318,w:199,h:51},
    miyama:{x:1216,y:697,w:199,h:53},
    shinto:{x:1216,y:1077,w:199,h:53},
};
const DEPLOYMENT_SLOTS: Partial<Record<LocationId, readonly {x:number;y:number;w:number;h:number;pawnX:number;pawnY:number}[]>> = {
    workshop:[
        {x:1010,y:119,w:199,h:94,pawnX:1163,pawnY:166}, {x:1216,y:119,w:199,h:94,pawnX:1368,pawnY:166},
        {x:1010,y:218,w:199,h:94,pawnX:1163,pawnY:265}, {x:1216,y:218,w:199,h:94,pawnX:1368,pawnY:265},
    ],
    miyama:[{x:1216,y:500,w:199,h:96,pawnX:1367,pawnY:547},{x:1216,y:598,w:199,h:95,pawnX:1367,pawnY:643}],
    shinto:[{x:1216,y:880,w:199,h:96,pawnX:1367,pawnY:926},{x:1216,y:977,w:199,h:96,pawnX:1367,pawnY:1023}],
};
const ROOMS: Record<LocationId, {
    x: number;
    y: number;
    w: number;
    h: number;
    pawnX: number;
    pawnY: number;
}> = {
    workshop: { x: 397, y: 30, w: 1036, h: 359, pawnX: 1158, pawnY: 166 },
    miyama: { x: 397, y: 410, w: 1036, h: 357, pawnX: 1358, pawnY: 548 },
    shinto: { x: 397, y: 790, w: 1036, h: 357, pawnX: 1358, pawnY: 923 },
    recon: { x: 34, y: 788, w: 344, h: 358, pawnX: 212, pawnY: 958 },
};
interface Props {
    core: FateDominationCore;
    locale: string;
    viewerId?: string | null;
    movablePlayerId?: string | null;
    moving?: boolean;
    movementOrigin?: LocationId | null;
    selectedLocation?: LocationId | null;
    onPawn?: () => void;
    legalLocations: readonly LocationId[];
    onLocation: (id: LocationId) => void;
    onInspect: (assetPath: string, name: string) => void;
}
/** Shared Pixi camera owns world transforms. Accessible controls consume that displayed pose. */
export function FateMapSurface({ core, locale, viewerId, legalLocations, onLocation, onInspect, movablePlayerId, moving, onPawn, movementOrigin, selectedLocation }: Props) {
    const canInspectHiddenShinto=canViewFateHiddenShinto(core,viewerId);
    const [host, setHost] = React.useState<HTMLDivElement | null>(null);
    const overlay = React.useRef<HTMLDivElement>(null);
    const [size, setSize] = React.useState({ w: 0, h: 0 });
    const [pose, setPose] = React.useState<MapViewportState>({ zoom: .65, panX: 0, panY: 0 });
    const previousFit = React.useRef<MapViewportState | null>(null);
    const reset = React.useCallback(() => {
        if (!size.w || !size.h)
            return;
        setPose(fitFateTableCamera(size.w,size.h,WIDTH,HEIGHT));
    }, [size]);
    React.useLayoutEffect(() => {
        if (!host)
            return;
        const measure = () => {
            setSize({w:host.clientWidth,h:host.clientHeight});
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(host);
        return () => observer.disconnect();
    }, [host]);
    React.useLayoutEffect(() => {
        if (size.w && size.h) {
            const nextFit = fitFateTableCamera(size.w,size.h,WIDTH,HEIGHT);
            const before = previousFit.current;
            previousFit.current = nextFit;
            setPose(current => resizeFateTableCamera(current,before,nextFit));
        }
    }, [size]);
    const project = React.useCallback((display: MapViewportState) => {
        if (overlay.current)
            overlay.current.style.transform = `translate(${display.panX}px, ${display.panY}px) scale(${display.zoom})`;
    }, []);
    const cards = React.useMemo(() => {
        const list = [{id:'situation-deck',assetPath:'fate-domination/situations/back',name:`局势牌库，剩余 ${core.situationDeckCount} 张`,x:130,y:50,w:210,h:300}, { id: 'event-deck', assetPath: 'fate-domination/events/back', name: `事件牌库，剩余 ${core.eventDeckCount} 张`, x: 130, y: 430, w: 210, h: 300 }, { id: 'situation', assetPath: core.situation.assetPath, name: core.situation.name, x: 418, y: 50, w: 226, h: 316 }];
        for (const location of ['miyama', 'shinto'] as const) {
            const events = core.currentEvents?.[location] ?? (location === 'miyama' ? [core.miyamaEvent] : []);
            events.forEach((card, index) => list.push({ id: `${location}-${index}`, assetPath: location === 'shinto' && index === 0 && core.shintoEventFaceDown && !canInspectHiddenShinto ? 'fate-domination/events/back' : card.assetPath,
                name: location === 'shinto' && index === 0 && core.shintoEventFaceDown && !canInspectHiddenShinto ? '新都暗置事件' : card.name,
                x: 417 + index * 236, y: location === 'miyama' ? 430 : 806, w: 226, h: 316 }));
        }
        return list;
    }, [core.eventDeckCount, core.situationDeckCount, core.situation, core.currentEvents, core.miyamaEvent, core.shintoEventFaceDown, core.publicView?.shintoEventCount, core.publicView?.canViewHiddenShinto, viewerId, canInspectHiddenShinto]);
    const sprites = React.useMemo<MapSceneSprite[]>(() => [
        { id: 'board', textureUrls: getRuntimeImageCandidateUrls('fate-domination/board/fuyuki-city', locale), x: 0, y: 0, width: WIDTH, height: HEIGHT },
        ...cards.map(card => ({ id: card.id, textureUrls: getRuntimeImageCandidateUrls(card.assetPath, locale), x: card.x, y: card.y, width: card.w, height: card.h, imageFit: 'contain' as const })),
    ], [cards, locale]);
    return <div className="fd-runtime-map" ref={setHost}>
        <PixiMapSceneHost inputElement={host} sprites={sprites} mapWidth={WIDTH} mapHeight={HEIGHT} viewport={pose} onViewportChange={setPose} onDisplayViewportChange={project} minimumZoom={.25} maximumZoom={2.5} interactive regionSelectionEnabled={false} canvasTestId="fate-pixi-map-canvas" ariaLabel="冬木市地图，可拖动和缩放"/>
        <div ref={overlay} className="fd-runtime-map-overlay" style={{ width: WIDTH, height: HEIGHT, transform: `translate(${pose.panX}px, ${pose.panY}px) scale(${pose.zoom})` }}>
            {movementOrigin && !moving && MOVEMENT_EXITS[movementOrigin] && <button type="button" className="fd-runtime-movement-exit" aria-label={`从${core.battlefield[movementOrigin].label}开始常规移动`} onClick={onPawn} style={{left:MOVEMENT_EXITS[movementOrigin]!.x,top:MOVEMENT_EXITS[movementOrigin]!.y,width:MOVEMENT_EXITS[movementOrigin]!.w,height:MOVEMENT_EXITS[movementOrigin]!.h}}/>}
            {Object.entries(ROOMS).map(([key, rect]) => {
            const id = key as LocationId;
            const nextSlot = core.phase === 'outpost' ? nextFateDeploymentSlot(core,id) : null;
            const hit = nextSlot !== null ? DEPLOYMENT_SLOTS[id]?.[nextSlot] ?? rect : rect;
            return <React.Fragment key={id}>
                    {legalLocations.includes(id) && <button type="button" className="fd-runtime-location" aria-pressed={selectedLocation === id} style={{ left: hit.x, top: hit.y, width: hit.w, height: hit.h }} data-testid={`fate-domination-location-${id}`} aria-label={`选择${core.battlefield[id].label}`} onClick={() => onLocation(id)}></button>}
                    {core.battlefield[id].playerIds.map(playerId => {
                        const slot = core.players[playerId].deploymentSlot;
                        const anchor = slot !== null ? DEPLOYMENT_SLOTS[id]?.[slot] : undefined;
                        const unbonused = core.battlefield[id].playerIds.filter(pid => core.players[pid].deploymentSlot === null);
                        const freeIndex = unbonused.indexOf(playerId);
                        const pawnX = anchor?.pawnX ?? (id === 'recon' ? rect.pawnX : 1150 - (Math.max(0,freeIndex) % 2) * 90);
                        const pawnY = anchor?.pawnY ?? (id === 'recon' ? rect.pawnY : rect.y + 90 + Math.floor(Math.max(0,freeIndex) / 2) * 90);
                        return <button type="button" key={playerId} className="fd-runtime-pawn" disabled={playerId !== movablePlayerId} aria-pressed={playerId === movablePlayerId && moving} onClick={onPawn} style={{ left: pawnX, top: pawnY }} aria-label={`玩家${Number(playerId) + 1}位于${core.battlefield[id].label}`}><OptimizedImage src={fateTokenAsset(core.players[playerId].masterId)} alt={`玩家${Number(playerId)+1}棋子`} /></button>; })}
                </React.Fragment>;
        })}
            <span className="fd-event-deck-count fd-situation-deck-count" style={{left:285,top:324}}>{core.situationDeckCount}</span>
            <span className="fd-event-deck-count" style={{left: 285, top: 704}}>{core.eventDeckCount}</span>
            {cards.map(card => <button key={card.id} type="button" className="fd-runtime-map-card-hit" style={{ left: card.x, top: card.y, width: card.w, height: card.h }} aria-label={`检视${card.name}`} onClick={() => onInspect(card.assetPath, card.name)}/>)}
        </div>
        <div className="fd-runtime-camera-controls"><span>{Math.round(pose.zoom * 100)}%</span><button type="button" onClick={reset}>复位</button></div>
    </div>;
}
