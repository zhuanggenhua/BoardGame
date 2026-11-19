import type { MapViewportState } from '../../../engine/mapRenderer';

export function projectFateMapBounds(bounds: { x: number; y: number; w: number; h: number }, pose: MapViewportState) {
    return {
        left: pose.panX + bounds.x * pose.zoom,
        top: pose.panY + bounds.y * pose.zoom,
        right: pose.panX + (bounds.x + bounds.w) * pose.zoom,
        bottom: pose.panY + (bounds.y + bounds.h) * pose.zoom,
    };
}

export function constrainFateTableCamera(pose: MapViewportState, width: number, height: number, mapWidth: number, mapHeight: number): MapViewportState {
    if (!width || !height) return pose;
    const constrain = (offset: number, view: number, map: number) => {
        // 棋盘缩小时仍保留主体，大于视口时允许轻微越界以便检视边缘。
        const visible = Math.min(view, map) * 0.85;
        return Math.max(visible - map, Math.min(offset, view - visible));
    };
    return { ...pose, panX: constrain(pose.panX, width, mapWidth * pose.zoom), panY: constrain(pose.panY, height, mapHeight * pose.zoom) };
}
/** 默认视野按完整视口适配；浮动操作区不改变棋盘构图。 */
export function fitFateTableCamera(width:number,height:number,mapWidth:number,mapHeight:number):MapViewportState {
    const zoom=Math.max(.25,Math.min(2.5,width/mapWidth,height/mapHeight));
    return {zoom,panX:(width-mapWidth*zoom)/2,panY:(height-mapHeight*zoom)/2};
}

/** A resized default view refits; an intentionally moved camera keeps its owner. */
export function resizeFateTableCamera(current:MapViewportState, previousFit:MapViewportState|null, nextFit:MapViewportState):MapViewportState {
    const isDefault = !previousFit || (Math.abs(current.zoom-previousFit.zoom)<.00001 && Math.abs(current.panX-previousFit.panX)<.01 && Math.abs(current.panY-previousFit.panY)<.01);
    return isDefault ? nextFit : current;
}

/** Keep the same card target visible while the existing HUD stays in place. */
export function fitFateTargetCamera(current:MapViewportState, viewport:{width:number;height:number}, map:{width:number;height:number}, target:{x:number;y:number;width:number;height:number}, blockers:readonly {left:number;top:number;right:number;bottom:number}[]):MapViewportState {
    const gap=8;
    let best:MapViewportState|undefined,bestScore=Infinity;
    for(let zoom=current.zoom;zoom>=.25;zoom=Math.round((zoom-.025)*1000)/1000){
        const xs=[current.panX,0,viewport.width-map.width*zoom,gap-target.x*zoom,viewport.width-gap-(target.x+target.width)*zoom];
        const ys=[current.panY,0,viewport.height-map.height*zoom,gap-target.y*zoom,viewport.height-gap-(target.y+target.height)*zoom];
        for(const block of blockers){
            xs.push(block.right+gap-target.x*zoom,block.left-gap-(target.x+target.width)*zoom);
            ys.push(block.bottom+gap-target.y*zoom,block.top-gap-(target.y+target.height)*zoom);
        }
        let fullMapPose: MapViewportState | undefined;
        let fullMapDistance = Infinity;
        for(const x of xs)for(const y of ys){
            const pose=constrainFateTableCamera({zoom,panX:x,panY:y},viewport.width,viewport.height,map.width,map.height);
            const left=pose.panX+target.x*zoom,top=pose.panY+target.y*zoom,right=left+target.width*zoom,bottom=top+target.height*zoom;
            if(left<0||top<0||right>viewport.width||bottom>viewport.height || blockers.some(b=>left<b.right+gap&&right>b.left-gap&&top<b.bottom+gap&&bottom>b.top-gap))continue;
            const crop=Math.max(0,-pose.panX)+Math.max(0,pose.panX+map.width*zoom-viewport.width)
                +Math.max(0,-pose.panY)+Math.max(0,pose.panY+map.height*zoom-viewport.height);
            const distance=Math.abs(pose.panX-current.panX)+Math.abs(pose.panY-current.panY);
            if(crop<.01 && distance<fullMapDistance){fullMapPose=pose;fullMapDistance=distance;}
            const score=distance+crop*4+(current.zoom-zoom)*400;
            if(score<bestScore){best=pose;bestScore=score;}
        }
        // 按缩放由大到小搜索。同一缩放下以移动最少的完整棋盘为准。
        if(fullMapPose)return fullMapPose;
    }
    return best??current;
}
