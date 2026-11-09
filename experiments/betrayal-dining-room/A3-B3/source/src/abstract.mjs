import * as THREE from 'three';
import {box,mesh} from './furniture.mjs';
import {dimensions as d,seats,settings} from './dimensions.mjs';

function paperShape(parent,m,name,shape,depth,x=0,y=0,z=0) {
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:36});
  g.rotateX(-Math.PI/2);return mesh(parent,g,m,name,x,y,z);
}
function ellipse(w,l) {const s=new THREE.Shape();s.absellipse(0,0,w/2,l/2,0,Math.PI*2,false,0);return s;}
function chairSilhouette() {
  const s=new THREE.Shape();s.moveTo(-.23,.02);s.lineTo(-.23,.91);s.quadraticCurveTo(0,1.14,.23,.91);
  s.lineTo(.23,.02);s.lineTo(.13,.02);s.lineTo(.13,.46);s.lineTo(-.13,.46);s.lineTo(-.13,.02);s.closePath();
  const hole=new THREE.Path();hole.moveTo(-.13,.60);hole.lineTo(.13,.60);hole.lineTo(.13,.87);
  hole.quadraticCurveTo(0,1.02,-.13,.87);hole.closePath();s.holes.push(hole);return s;
}
function wall(m,name,rotation) {
  const group=new THREE.Group();group.name=name;group.rotation.y=rotation;
  // Lower paper wall preserves the board silhouette rather than imitating realism.
  for(const side of [-1,1]) {
    const x=side*(d.room+d.doorWidth)/4,w=(d.room-d.doorWidth)/2;
    box(group,m.paperDark,'inked-paper-wall',w,1.40,.055,x,.70,-d.room/2);
    box(group,m.paperLight,'printed-wainscot',w,.48,.012,x,.26,-d.room/2+.034);
    for(let i=0;i<7;i++)box(group,m.ink,'printed-panel-rule',.009,.39,.006,x-w/2+.14+i*(w-.28)/6,.26,-d.room/2+.044);
    for(const y of [.06,.49,1.38])box(group,m.ink,'printed-wall-rule',w,.012,.009,x,y,-d.room/2+.045);
  }
  for(const sign of [-1,1])box(group,m.paperLight,'paper-door-jamb',.07,1.4,.075,sign*d.doorWidth/2,.70,-d.room/2);
  // Open door negative space is retained; no portal glow or dungeon arch.
  return group;
}
export function createAbstractRoom(m) {
  const root=new THREE.Group();root.name='paper-theatre-dining-room';
  box(root,m.paperLight,'paper-layer-01',7.03,.07,7.03,0,-.18,0);
  box(root,m.ink,'ink-layer-02',7.00,.025,7.00,0,-.1325,0);
  box(root,m.paperLight,'paper-layer-03',6.98,.065,6.98,0,-.0875,0);
  box(root,m.ink,'printed-tile-border',6.92,.025,6.92,0,-.0425,0);
  box(root,m.paperFloor,'printed-parquet',d.room,.035,d.room,0,-.0125,0);
  const suite=new THREE.Group();suite.name='paper-dining-composition';suite.rotation.y=d.rotation;root.add(suite);
  box(suite,m.paperRug,'cut-paper-rug',d.rugWidth,.018,d.rugLength,0,.016,0);
  // One continuous engraved table silhouette and detached paper rim.
  paperShape(suite,m.ink,'table-ink-outline',ellipse(d.tableWidth+.06,d.tableLength+.06),.055,0,.72,0);
  paperShape(suite,m.paperTable,'table-paper-surface',ellipse(d.tableWidth,d.tableLength),.018,0,.778,0);
  for(const z of [-.98,.98])box(suite,m.ink,'folded-table-support',.70,.70,.045,0,.385,z);
  box(suite,m.paperLight,'paper-runner',.53,.008,3.17,0,.801,0);
  for(const [index,seat] of seats.entries()) {
    const chair=new THREE.Group();chair.name='paper-chair';chair.position.set(seat.x,.034,seat.z);chair.rotation.y=seat.rotation;suite.add(chair);
    const shape=chairSilhouette();const g=new THREE.ExtrudeGeometry(shape,{depth:.027,bevelEnabled:false,curveSegments:18});
    mesh(chair,g,m.ink,'die-cut-chair-outline',0,0,.15);
    box(chair,m.paperLight,'folded-paper-seat',.43,.025,.40,0,.46,-.01);
    // A fine front crease is the only material cue; no miniature toy geometry.
    box(chair,m.ink,'chair-fold-line',.43,.008,.008,0,.478,-.20);
    chair.userData.seat=index;
  }
  for(const setting of settings) {
    const plate=mesh(suite,new THREE.CylinderGeometry(.14,.14,.007,40),m.paperLight,'printed-place-setting',setting.x,.812,setting.z);
    const rim=mesh(suite,new THREE.TorusGeometry(.119,.004,4,40),m.ink,'plate-ink-ring',setting.x,.818,setting.z);rim.rotation.x=Math.PI/2;
    plate.userData.fixedLayout=true;
  }
  for(const z of [-.63,.63]) {
    const s=new THREE.Shape();s.moveTo(-.18,0);s.lineTo(.18,0);s.lineTo(.18,.025);s.lineTo(.035,.07);s.lineTo(.035,.30);
    s.lineTo(.17,.30);s.lineTo(.17,.42);s.lineTo(.145,.42);s.lineTo(.145,.33);s.lineTo(.015,.33);s.lineTo(.015,.47);
    s.lineTo(-.015,.47);s.lineTo(-.015,.33);s.lineTo(-.145,.33);s.lineTo(-.145,.42);s.lineTo(-.17,.42);s.lineTo(-.17,.30);
    s.lineTo(-.035,.30);s.lineTo(-.035,.07);s.lineTo(-.18,.025);s.closePath();
    mesh(suite,new THREE.ExtrudeGeometry(s,{depth:.025,bevelEnabled:false}),m.paperGold,'cutout-candelabra',0,.81,z);
  }
  // Cabinet is deliberately a folded printable silhouette, not a reduced B model.
  const cabinet=new THREE.Group();cabinet.name='folded-paper-sideboard';cabinet.position.set(2.17,0,-2.76);root.add(cabinet);
  box(cabinet,m.ink,'paper-sideboard-front',1.40,.78,.035,0,.43,.25);
  box(cabinet,m.paperLight,'paper-sideboard-top',1.40,.03,.54,0,.84,0);
  for(const x of [-.34,.34])box(cabinet,m.paperDark,'printed-cabinet-door',.59,.49,.009,x,.47,.273);
  const walls=[wall(m,'paper-north-wall',0),wall(m,'paper-west-wall',Math.PI/2),wall(m,'paper-south-wall',Math.PI),wall(m,'paper-east-wall',-Math.PI/2)];
  walls.forEach(item=>root.add(item));
  const cutEdges=new THREE.Group();cutEdges.name='paper-wall-footprints';root.add(cutEdges);
  for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]) {
    const edge=new THREE.Group();edge.rotation.y=angle;cutEdges.add(edge);
    for(const sign of [-1,1])box(edge,m.ink,'printed-wall-footprint',(d.room-d.doorWidth)/2,.035,.07,sign*(d.room+d.doorWidth)/4,.038,-d.room/2);
  }
  return {root,walls,cutEdges,suite};
}
