import type { MapViewportState } from '../../../engine/mapRenderer';
/** Initial/reset camera fits the viewport. HUD layers float over the board without changing its pose. */
export function fitFateTableCamera(width:number,height:number,mapWidth:number,mapHeight:number):MapViewportState {
    const zoom=Math.max(.25,Math.min(2.5,width/mapWidth,height/mapHeight));
    return {zoom,panX:(width-mapWidth*zoom)/2,panY:(height-mapHeight*zoom)/2};
}

/** A resized default view refits; an intentionally moved camera keeps its owner. */
export function resizeFateTableCamera(current:MapViewportState, previousFit:MapViewportState|null, nextFit:MapViewportState):MapViewportState {
    const isDefault = !previousFit || (Math.abs(current.zoom-previousFit.zoom)<.00001 && Math.abs(current.panX-previousFit.panX)<.01 && Math.abs(current.panY-previousFit.panY)<.01);
    return isDefault ? nextFit : current;
}
