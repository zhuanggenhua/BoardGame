import * as THREE from 'three';
import {box,mesh,rod,tube} from './furniture.mjs';

// Deliberately asymmetrical, domestic-scale additions. No dungeon props.
export function curtainGeometry(side=1) {
  const geometry=new THREE.PlaneGeometry(.52,1.42,24,32);
  const a=geometry.attributes.position;
  for(let i=0;i<a.count;i++) {
    const x=a.getX(i),y=a.getY(i),t=(y+.71)/1.42;
    // Fold amplitude and gathering vary with height, rather than rigid cylinders.
    const gather=.52+.48*Math.abs(t-.34);
    a.setXYZ(i,x*gather+side*.10*Math.sin(t*Math.PI),y,
      .047*Math.cos((x/.52+.5)*Math.PI*10)+.033*Math.sin(t*3.2));
  }
  a.needsUpdate=true;geometry.computeVertexNormals();return geometry;
}
export function addWindowDrapery(wall,m) {
  const group=new THREE.Group();group.name='aged-window-and-drapery';group.position.set(-1.93,0,-3.09);wall.add(group);
  box(group,m.darkWood,'window-recess',1.23,1.37,.045,0,1.72,0);
  box(group,m.window,'frosted-window',1.02,1.15,.014,0,1.72,.027);
  for(const x of [-.55,0,.55])box(group,m.wood,'window-mullion',.045,1.23,.065,x,1.72,.047);
  for(const y of [1.10,1.68,2.34])box(group,m.wood,'window-crossbar',1.16,.04,.075,0,y,.05);
  box(group,m.wood,'projecting-window-sill',1.38,.055,.24,0,1.055,.08);
  rod(group,m.brass,'curtain-pole',[-.77,2.48,.19],[.77,2.48,.19],.015);
  for(const x of [-.80,.80])mesh(group,new THREE.SphereGeometry(.035,12,8),m.brass,'pole-finial',x,2.48,.19);
  for(const side of [-1,1]) {
    const cloth=mesh(group,curtainGeometry(side),m.velvet,'gathered-curtain',side*.55,1.71,.17);
    cloth.material.side=THREE.DoubleSide;
    tube(group,m.cord,'curtain-tieback',[[side*.33,1.49,.24],[side*.55,1.43,.25],[side*.75,1.49,.23]],.012);
    rod(group,m.cord,'curtain-tassel',[side*.68,1.46,.25],[side*.68,1.33,.25],.018,.012);
  }
  return group;
}
export function addPortrait(wall,m,x=1.93) {
  const group=new THREE.Group();group.name='ancestral-portrait';group.position.set(x,1.80,-3.08);wall.add(group);
  box(group,m.darkWood,'portrait-backing',.86,1.12,.06);
  const painting=mesh(group,new THREE.PlaneGeometry(.69,.95),m.portrait,'painted-family-portrait',0,0,.036);
  painting.castShadow=false;
  for(const [w,h,z] of [[.90,1.16,.038],[.80,1.06,.062]]) {
    for(const sign of [-1,1]) {
      box(group,m.brass,'portrait-frame-vertical',.035,h,.035,sign*w/2,0,z);
      box(group,m.brass,'portrait-frame-horizontal',w+.035,.035,.035,0,sign*h/2,z);
    }
  }
  for(const x of [-.45,.45])for(const y of [-.58,.58]){
    const boss=mesh(group,new THREE.SphereGeometry(.035,10,8),m.brass,'frame-rosette',x,y,.06);boss.scale.z=.35;
  }
  return group;
}
export function addWallWear(wall,m,seed=0) {
  const group=new THREE.Group();group.name='localized-wall-age';wall.add(group);
  // Intentionally localized rather than covering every surface with noise.
  for(const [i,x] of [-2.7,-1.4,1.52,2.82].entries()) {
    const y=1.15+((i+seed)%3)*.37;
    tube(group,m.crack,'hairline-wall-crack',[[x,y+.35,-3.207],[x-.055,y+.22,-3.207],
      [x-.03,y+.10,-3.207],[x-.12,y,-3.207]],.0024);
    tube(group,m.crack,'hairline-crack-branch',[[x-.055,y+.22,-3.207],[x+.045,y+.19,-3.207]],.0018);
  }
  return group;
}
export function addDomesticDetails(room,m) {
  addWindowDrapery(room.walls[0],m);
  addPortrait(room.walls[1],m,-1.86);
  addPortrait(room.walls[0],m,1.93);
  room.walls.forEach((wall,index)=>addWallWear(wall,m,index));
  const suite=room.suite;
  // Ink-stained correspondence and wax drops tell a quiet story.
  const letter=box(suite,m.letter,'unopened-correspondence',.22,.004,.16,.42,.802,.35);letter.rotation.y=-.19;
  const seal=mesh(suite,new THREE.CylinderGeometry(.020,.020,.005,12),m.seal,'wax-letter-seal',.43,.807,.35);
  seal.castShadow=false;
  for(const z of [-.63,.63])for(let i=0;i<5;i++){
    const wax=mesh(suite,new THREE.SphereGeometry(.013,10,6),m.candle,'cooled-wax-drop',.045+Math.sin(i*2.7)*.06,.809,z+Math.cos(i*1.7)*.08);
    wax.scale.y=.16;
  }
}
