import * as THREE from 'three';
import {addDomesticDetails} from './decor.mjs';
import {dimensions as d} from './dimensions.mjs';
import {box,mesh,rod,createDiningSuite,createSideboard} from './furniture.mjs';

function wallSection(parent,m,from,to) {
  const width=to-from,c=(from+to)/2,z=-d.room/2;
  box(parent,m.wallpaper,'green-wallpaper',width,d.wallHeight,d.wallThickness,c,d.wallHeight/2,z);
  box(parent,m.darkWood,'wainscot-backing',width,d.wainscotHeight,.045,c,d.wainscotHeight/2,z+.105);
  const count=Math.max(1,Math.round(width/.61)),spacing=width/count;
  for(let i=0;i<count;i++) {
    const x=from+spacing*(i+.5),w=spacing-.10;
    box(parent,m.wood,'wood-panel-field',w,.63,.025,x,.43,z+.138);
    box(parent,m.darkWood,'panel-recess',w-.065,.55,.013,x,.43,z+.155);
    for(const offset of [-w/2,w/2])box(parent,m.wood,'panel-stile',.026,.67,.023,x+offset,.43,z+.168);
    for(const y of [.095,.765])box(parent,m.wood,'panel-rail',w+.03,.025,.025,x,y,z+.168);
  }
  for(const [y,h,depth] of [[.07,.09,.075],[.87,.07,.085],[.93,.025,.10],[2.56,.08,.10],[2.63,.035,.12]])
    box(parent,m.wood,'wall-moulding',width,h,depth,c,y,z+.13);
}
function wall(m,name,rotation) {
  const group=new THREE.Group();group.name=name;group.rotation.y=rotation;
  const half=d.doorWidth/2,z=-d.room/2;
  wallSection(group,m,-d.room/2,-half);wallSection(group,m,half,d.room/2);
  box(group,m.wallpaper,'door-lintel-wall',d.doorWidth,d.wallHeight-d.doorHeight,d.wallThickness,0,(d.wallHeight+d.doorHeight)/2,z);
  box(group,m.darkWood,'recessed-door',d.doorWidth-.10,d.doorHeight-.04,.075,0,d.doorHeight/2,z+.015);
  for(const y of [.43,1.35])for(const x of [-.30,.30]){
    box(group,m.wood,'door-panel-frame',.51,y===.43?.56:.98,.022,x,y,z+.07);
    box(group,m.darkWood,'door-panel-inset',.43,y===.43?.48:.90,.025,x,y,z+.087);
  }
  for(const x of [-half,half]){
    box(group,m.wood,'door-jamb',.105,d.doorHeight+.07,.15,x,d.doorHeight/2,z+.115);
    box(group,m.brass,'door-jamb-inlay',.013,d.doorHeight+.06,.009,x-.025,d.doorHeight/2,z+.195);
  }
  box(group,m.wood,'door-cornice',d.doorWidth+.24,.11,.20,0,d.doorHeight+.05,z+.115);
  mesh(group,new THREE.SphereGeometry(.028,12,10),m.brass,'door-handle',.48,1.02,z+.13);
  return group;
}
export function createRoom(m) {
  const root=new THREE.Group();root.name='dining-room-study-b3';
  box(root,m.base,'cardboard-plinth',7.03,.22,7.03,0,-.185,0);
  box(root,m.paper,'worn-card-edge',6.98,.038,6.98,0,-.055,0);
  box(root,m.base,'dark-green-tile-border',6.92,.045,6.92,0,-.018,0);
  box(root,m.floor,'parquet-floor',d.room,.04,d.room,0,.015,0);
  for(const x of [-1,1])for(const z of [-1,1]) {
    const nail=mesh(root,new THREE.CylinderGeometry(.014,.014,.006,12),m.brass,'tile-edge-pin',x*3.43,.009,z*3.43);nail.castShadow=false;
  }
  const rugGroup=new THREE.Group();rugGroup.name='diagonal-patterned-rug';rugGroup.rotation.y=d.rotation;root.add(rugGroup);
  const rug=mesh(rugGroup,new THREE.PlaneGeometry(d.rugWidth,d.rugLength),m.rug,'woven-rug',0,.039,0);rug.rotation.x=-Math.PI/2;
  for(const side of [-1,1]) for(let i=0;i<70;i++) {
    const x=-d.rugWidth/2+.025+i*(d.rugWidth-.05)/69;
    rod(rugGroup,m.cloth,'rug-fringe',[x,.04,side*d.rugLength/2],[x+.006*Math.sin(i),.04,side*(d.rugLength/2+.06)],.003);
  }
  const suite=createDiningSuite(m);suite.position.y=.039;root.add(suite);
  const sideboard=createSideboard(m);sideboard.position.set(2.17,.035,-2.76);root.add(sideboard);
  // Secondary low upholstered bench: inferred from the southwest furniture silhouette.
  const bench=new THREE.Group();bench.name='southwest-bench';bench.position.set(-2.56,.035,2.08);bench.rotation.y=Math.PI/2;root.add(bench);
  box(bench,m.darkWood,'bench-frame',1.12,.09,.43,0,.40,0);
  box(bench,m.upholstery,'bench-seat',1.07,.07,.42,0,.465,0);
  for(const x of [-.45,.45])for(const z of [-.14,.14])rod(bench,m.darkWood,'bench-leg',[x,0,z],[x,.38,z],.02,.028);
  const walls=[wall(m,'north-wall',0),wall(m,'west-wall',Math.PI/2),wall(m,'south-wall',Math.PI),wall(m,'east-wall',-Math.PI/2)];
  walls.forEach(part=>root.add(part));
  const cutEdges=new THREE.Group();cutEdges.name='cutaway-wall-footprints';root.add(cutEdges);
  for(const rotation of [0,Math.PI/2,Math.PI,-Math.PI/2]) {
    const edge=new THREE.Group();edge.rotation.y=rotation;cutEdges.add(edge);
    for(const sign of [-1,1])box(edge,m.darkWood,'cutaway-skirting',(d.room-d.doorWidth)/2,.17,.13,sign*(d.room+d.doorWidth)/4,.115,-d.room/2);
    box(edge,m.wood,'door-threshold',d.doorWidth,.015,.20,0,.047,-d.room/2);
  }
  const room={root,walls,cutEdges,suite};
  addDomesticDetails(room,m);
  return room;
}
export function setWallMode(room,mode) {
  if(!['cutaway','full','floor'].includes(mode))throw new Error(`Unknown wall mode: ${mode}`);
  room.walls.forEach((wall,index)=>wall.visible=mode==='full'||(mode==='cutaway'&&index<2));
  room.cutEdges.visible=mode!=='full';
}
export function geometryStats(root) {
  const geometries=new Set();let meshes=0,triangles=0;
  root.traverse(object=>{if(object instanceof THREE.Mesh){meshes++;geometries.add(object.geometry);triangles+=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3;}});
  return {meshes,uniqueGeometries:geometries.size,triangles};
}
export function disposeRoom(root) {
  const geometries=new Set();root.traverse(object=>{if(object instanceof THREE.Mesh)geometries.add(object.geometry);});
  geometries.forEach(g=>g.dispose());
}
