import { canViewFateHiddenShinto } from '../domain/playerView';
import { constrainFateTableCamera, fitFateTableCamera, resizeFateTableCamera } from './tableCameraLayout';
import React from 'react';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { PixiMapSceneHost, type MapSceneSprite, type MapViewportState } from '../../../engine/mapRenderer';
import { getRuntimeImageCandidateUrls } from '../../../core/AssetLoader';
import type { FateDominationCore, LocationId } from '../domain/types';
import './map-surface.css';
import { fateTokenAsset } from './identityArtwork';
import {legalFateDeploymentSlots,nextFateDeploymentSlot} from '../domain/deployment';
import {useTranslation} from 'react-i18next';
import { FATE_DEPLOYMENT_SLOTS as DEPLOYMENT_SLOTS, FATE_MAP_ROOMS as ROOMS, fatePawnPosition } from './fateMapGeometry';
const WIDTH = 1927, HEIGHT = 1179;
// Printed E movement-cost/arrow rectangles, measured on the original Fuyuki board.
const MOVEMENT_EXITS: Partial<Record<LocationId, {x:number;y:number;w:number;h:number}>> = {
    workshop:{x:1216,y:318,w:199,h:51},
    miyama:{x:1216,y:697,w:199,h:53},
    shinto:{x:1216,y:1077,w:199,h:53},
};
// Empty DOM bounds over printed map text let tutorial placement avoid covering the data being taught.
const TUTORIAL_MAP_LANDMARKS = [
    { id: 'workshop-title', left: 850, top: 12, width: 570, height: 96 },
    { id: 'workshop-values', left: 970, top: 108, width: 465, height: 230 },
    { id: 'miyama-values', left: 1075, top: 408, width: 360, height: 345 },
    { id: 'shinto-values', left: 1075, top: 788, width: 360, height: 345 },
    { id: 'recon-values', left: 26, top: 784, width: 360, height: 360 },
    { id: 'battle-track', left: 1438, top: 0, width: 489, height: 1179 },
] as const;
interface Props {
    core: FateDominationCore;
    locale: string;
    viewerId?: string | null;
    movablePlayerId?: string | null;
    moving?: boolean;
    movementOrigin?: LocationId | null;
    onPawn?: () => void;
    legalLocations: readonly LocationId[];
    onLocation: (id: LocationId, slot?:number|null) => void;
    canUseLocation?: (id:LocationId,slot?:number|null)=>boolean;
    onInspect: (assetPath: string, name: string) => void;
    onBattleAnchorChange?: (locationId: LocationId, element: HTMLDivElement | null) => void;
}
/** Shared Pixi camera owns world transforms. Accessible controls consume that displayed pose. */
export function FateMapSurface({ core, locale, viewerId, legalLocations, onLocation, canUseLocation=()=>true, onInspect, movablePlayerId, moving, onPawn, movementOrigin, onBattleAnchorChange }: Props) {
    const { t } = useTranslation('game-fate-domination');
    const canInspectHiddenShinto=canViewFateHiddenShinto(core,viewerId);
    const [host, setHost] = React.useState<HTMLDivElement | null>(null);
    const overlay = React.useRef<HTMLDivElement>(null);
    const miyamaAnchor = React.useCallback((element: HTMLDivElement | null) => onBattleAnchorChange?.('miyama', element), [onBattleAnchorChange]);
    const shintoAnchor = React.useCallback((element: HTMLDivElement | null) => onBattleAnchorChange?.('shinto', element), [onBattleAnchorChange]);
    const [size, setSize] = React.useState({ w: 0, h: 0 });
    const [{pose, revision}, setCameraRequest] = React.useState({
        pose: { zoom: .65, panX: 0, panY: 0 }, revision: 0,
    });
    const livePose = React.useRef(pose);
    const [zoomPercent, setZoomPercent] = React.useState(65);
    const observeCamera = React.useCallback((next: MapViewportState) => {
        livePose.current = next;
        setZoomPercent(Math.round(next.zoom * 100));
    }, []);
    const requestCamera = React.useCallback((next: MapViewportState) => {
        observeCamera(next);
        setCameraRequest(current => ({ pose: next, revision: current.revision + 1 }));
    }, [observeCamera]);
    const constrainViewport = React.useCallback((next: MapViewportState) => constrainFateTableCamera(next, size.w, size.h, WIDTH, HEIGHT), [size.w, size.h]);
    const manualCamera = React.useRef(false);
    const onManualCameraInteraction = React.useCallback(() => { manualCamera.current = true; }, []);
    const previousFit = React.useRef<MapViewportState | null>(null);
    const focusDeployment = React.useRef<() => void>(() => {});
    const reset = React.useCallback(() => {
        if (!size.w || !size.h)
            return;
        manualCamera.current = false;
        requestCamera(fitFateTableCamera(size.w,size.h,WIDTH,HEIGHT));
        requestAnimationFrame(() => focusDeployment.current());
    }, [size, requestCamera]);
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
            requestCamera(constrainViewport(resizeFateTableCamera(livePose.current,before,nextFit)));
        }
    }, [size, constrainViewport, requestCamera]);
    const needsDeploymentTargets = core.phase === 'outpost' && viewerId === core.currentPlayerId && legalLocations.includes('shinto');
    React.useLayoutEffect(() => {
        if (!host || !needsDeploymentTargets) return;
        // 只在进入可部署状态时调整地图，不移动手牌或改变卡牌尺寸。
        const focus = () => {
            if (manualCamera.current) return;
            const target = host.querySelector<HTMLElement>('[data-testid="fate-domination-location-shinto"]');
            if (!target) return;
            const bounds = target.getBoundingClientRect();
            const cards = Array.from(host.closest('.fd-runtime-table')?.querySelectorAll<HTMLElement>('.fd-runtime-hand-grid .fd-runtime-card') ?? []);
            const blockers = cards.map(card => card.getBoundingClientRect()).filter(card =>
                card.left < bounds.right && card.right > bounds.left && card.top < bounds.bottom && card.bottom > bounds.top);
            if (!blockers.length) return;
            const slotIndex = nextFateDeploymentSlot(core, 'shinto');
            const slot = slotIndex === null ? undefined : DEPLOYMENT_SLOTS.shinto?.[slotIndex];
            if (!slot) return;
            const availableHeight = Math.min(...blockers.map(card => card.top)) - host.getBoundingClientRect().top - 12;
            const zoom = Math.max(.25, Math.min(livePose.current.zoom, availableHeight / (slot.pawnY + 44)));
            requestCamera({ zoom, panX:(host.clientWidth-WIDTH*zoom)/2, panY:0 });
        };
        focusDeployment.current = focus;
        const frame = requestAnimationFrame(focus);
        return () => { cancelAnimationFrame(frame); focusDeployment.current = () => {}; };
    }, [host, needsDeploymentTargets, requestCamera]);
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
    return <div className="fd-runtime-map" data-tutorial-id="fate-map" ref={setHost}>
        <PixiMapSceneHost inputElement={host} sprites={sprites} mapWidth={WIDTH} mapHeight={HEIGHT} viewport={pose} viewportRevision={revision} onViewportChange={observeCamera} constrainViewport={constrainViewport} onDisplayViewportChange={project} onManualCameraInteraction={onManualCameraInteraction} minimumZoom={.25} maximumZoom={2.5} inertiaEnabled={false} interactive regionSelectionEnabled={false} canvasTestId="fate-pixi-map-canvas" ariaLabel="冬木市地图，可拖动和缩放"/>
        <div ref={overlay} className="fd-runtime-map-overlay" data-moving={moving ? 'true' : undefined} style={{ width: WIDTH, height: HEIGHT }}>
            {(['miyama', 'shinto'] as const).map(id => <div key={`battle-${id}`} ref={id === 'miyama' ? miyamaAnchor : shintoAnchor}
                className="fd-fgo-battle-anchor" data-testid={`fate-fgo-anchor-${id}`}
                style={{ left: ROOMS[id].x, top: ROOMS[id].y, width: ROOMS[id].w, height: ROOMS[id].h }} />)}
            {TUTORIAL_MAP_LANDMARKS.map(({id,...bounds}) => <span key={id} aria-hidden="true" data-tutorial-map-landmark={id} className="fd-runtime-map-landmark" style={bounds}/>) }
            {movementOrigin && !moving && MOVEMENT_EXITS[movementOrigin] && <button type="button" className="fd-runtime-movement-exit" aria-label={`从${core.battlefield[movementOrigin].label}开始常规移动`} onClick={onPawn} style={{left:MOVEMENT_EXITS[movementOrigin]!.x,top:MOVEMENT_EXITS[movementOrigin]!.y,width:MOVEMENT_EXITS[movementOrigin]!.w,height:MOVEMENT_EXITS[movementOrigin]!.h}}/>}
            {Object.entries(ROOMS).map(([key, rect]) => {
            const id = key as LocationId;
            const nextSlot = core.phase === 'outpost' ? nextFateDeploymentSlot(core,id) : null;
            const legalSlots = core.phase === 'outpost' ? legalFateDeploymentSlots(core,id) : [];
            const deployment = core.phase === 'outpost';
            const slots = deployment ? DEPLOYMENT_SLOTS[id] : undefined;
            return <React.Fragment key={id}>
                    {slots && nextSlot !== null && <span aria-hidden="true" data-tutorial-id={`fate-deployment-${id}`} style={{position:'absolute',left:slots[nextSlot].x,top:slots[nextSlot].y,width:slots[nextSlot].w,height:slots[nextSlot].h}}/>}
                    {legalLocations.includes(id) && (slots && nextSlot !== null ? slots.map((slot,index) => <React.Fragment key={index}>
                        <button type="button" className={`fd-runtime-location fd-runtime-deployment-slot${canUseLocation(id,index)?'':' is-tutorial-unavailable'}`} data-tutorial-blocked={!canUseLocation(id,index)} disabled={!legalSlots.includes(index)} data-fate-destination={id} data-fate-slot={index} style={{left:slot.pawnX-44,top:slot.pawnY-44,width:88,height:88}} data-testid={index === nextSlot ? `fate-domination-location-${id}` : `fate-domination-slot-${id}-${index}`} aria-label={`部署到${core.battlefield[id].label}第${index+1}点位`} onClick={() => onLocation(id,index)}/></React.Fragment>)
                        : <button type="button" className={`fd-runtime-location${deployment ? ' fd-runtime-deployment-slot' : ''}${canUseLocation(id,deployment?null:undefined)?'':' is-tutorial-unavailable'}`} data-tutorial-blocked={!canUseLocation(id,deployment?null:undefined)} data-fate-destination={id} data-fate-slot={deployment?'none':undefined} style={deployment ? {left:rect.x+705,top:rect.y+46,width:88,height:88} : { left: rect.x, top: rect.y, width: rect.w, height: rect.h }} data-tutorial-id={deployment ? `fate-deployment-${id}` : `fate-location-${id}`} data-testid={`fate-domination-location-${id}`} aria-label={`选择${core.battlefield[id].label}`} onClick={() => deployment ? onLocation(id,null) : onLocation(id)}/>) }
                    {core.battlefield[id].playerIds.map(playerId => {
                        const { x: pawnX, y: pawnY } = fatePawnPosition(core,id,playerId);
                        return <React.Fragment key={playerId}>
                            <button type="button" data-fate-drag-source={playerId===movablePlayerId?playerId:undefined} data-tutorial-id={`fate-pawn-${playerId}`} className="fd-runtime-pawn" disabled={playerId !== movablePlayerId} aria-pressed={playerId === movablePlayerId && moving} onClick={onPawn} style={{ left: pawnX, top: pawnY }} aria-label={`玩家${Number(playerId) + 1}位于${core.battlefield[id].label}`}><OptimizedImage draggable={false} src={fateTokenAsset(core.players[playerId].masterId)} alt={`玩家${Number(playerId)+1}棋子`} /></button></React.Fragment>; })}
                </React.Fragment>;
        })}
            <span className="fd-event-deck-count fd-situation-deck-count" style={{left:285,top:324}}>{core.situationDeckCount}</span>
            <span className="fd-event-deck-count" style={{left: 285, top: 704}}>{core.eventDeckCount}</span>
            {cards.map(card => <button key={card.id} type="button" className="fd-runtime-map-card-hit" style={{ left: card.x, top: card.y, width: card.w, height: card.h }} aria-label={`检视${card.name}`} onClick={() => onInspect(card.assetPath, card.name)}/>)}
        </div>
        <div className="fd-runtime-camera-controls"><span>{zoomPercent}%</span><button type="button" onClick={reset}>{t('ui.map.reset')}</button></div>
    </div>;
}
