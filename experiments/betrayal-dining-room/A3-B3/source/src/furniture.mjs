import * as THREE from 'three';
import { dimensions as d, seats, settings } from './dimensions.mjs';

export function mesh(parent,geometry,material,name,x=0,y=0,z=0) {
  const object=new THREE.Mesh(geometry,material);object.name=name;object.position.set(x,y,z);
  object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;
}
export const box=(parent,material,name,w,h,depth,x=0,y=0,z=0)=>mesh(parent,new THREE.BoxGeometry(w,h,depth),material,name,x,y,z);
export function rod(parent,material,name,start,end,r1=.022,r2=r1) {
  const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),delta=b.clone().sub(a);
  const object=mesh(parent,new THREE.CylinderGeometry(r2,r1,delta.length(),12),material,name);
  object.position.copy(a).add(b).multiplyScalar(.5);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return object;
}
export function tube(parent,material,name,points,radius=.015) {
  const curve=new THREE.CatmullRomCurve3(points.map(point=>new THREE.Vector3(...point)));
  return mesh(parent,new THREE.TubeGeometry(curve,28,radius,7,false),material,name);
}
function lathe(parent,material,name,profile,x,y,z) {
  return mesh(parent,new THREE.LatheGeometry(profile.map(([r,h])=>new THREE.Vector2(r,h)),32),material,name,x,y,z);
}
function ovalGeometry(width,length,thickness) {
  const shape=new THREE.Shape();shape.absellipse(0,0,width/2,length/2,0,Math.PI*2,false,0);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:true,bevelSize:.013,bevelThickness:.009,bevelSegments:2,curveSegments:48});
  geometry.rotateX(-Math.PI/2);geometry.translate(0,0,0);return geometry;
}
export function createTable(m) {
  const table=new THREE.Group();table.name='oval-dining-table';
  const surface=mesh(table,ovalGeometry(d.tableWidth,d.tableLength,d.tableThickness),m.wood,'oval-tabletop',0,d.tableHeight-d.tableThickness,0);
  surface.userData.dimensions={width:d.tableWidth,length:d.tableLength};
  // Fine moulding and apron, not a chunky toy block.
  mesh(table,ovalGeometry(d.tableWidth-.08,d.tableLength-.08,.075),m.darkWood,'table-apron',0,d.tableHeight-.15,0);
  for(const z of [-.98,.98]) {
    lathe(table,m.darkWood,'turned-pedestal',[[.10,0],[.13,.045],[.13,.07],[.09,.10],[.067,.20],[.09,.34],[.12,.39],[.085,.44],[.078,.58],[.14,.61],[.14,.64]],0,.035,z);
    for(const side of [-1,1]) {
      tube(table,m.darkWood,'splayed-foot',[[0,.17,z],[side*.15,.10,z],[side*.39,.065,z+.08],[side*.53,.04,z+.12]],.038);
      box(table,m.darkWood,'foot-pad',.16,.04,.13,side*.5,.020,z+.12);
    }
  }
  rod(table,m.darkWood,'pedestal-stretcher',[0,.19,-.98],[0,.19,.98],.035);
  const runner=box(table,m.cloth,'linen-runner',.65,.008,3.2,0,d.tableHeight+.014,0);
  runner.rotation.y=.018;
  return table;
}
export function createChair(m) {
  const chair=new THREE.Group();chair.name='slender-dining-chair';
  box(chair,m.darkWood,'seat-frame',d.seatWidth,.065,d.seatDepth,0,d.seatHeight-.048,0);
  mesh(chair,new THREE.BoxGeometry(.414,.043,.392,1,1,1),m.upholstery,'upholstered-seat',0,d.seatHeight-.002,-.006);
  for(const x of [-.195,.195]) for(const z of [-.175,.175]) {
    rod(chair,m.darkWood,'tapered-leg',[x*1.11,.0029,z*1.12],[x,d.seatHeight-.06,z],.017,.026);
  }
  for(const x of [-.195,.195]) {
    tube(chair,m.darkWood,'back-post',[[x,.41,.175],[x,.71,.205],[x*.89,.94,.235],[x*.75,1.025,.237]],.024);
    rod(chair,m.darkWood,'seat-side-stretcher',[x,.19,-.17],[x,.19,.17],.012);
  }
  tube(chair,m.wood,'curved-crest',[[-.173,1.004,.235],[-.11,1.052,.24],[0,d.chairHeight,.247],[.11,1.052,.24],[.173,1.004,.235]],.031);
  tube(chair,m.darkWood,'lower-back-rail',[[-.195,.68,.203],[0,.65,.211],[.195,.68,.203]],.018);
  // Open back with two curved narrow splats; visible negative space is deliberate.
  for(const side of [-1,1]) {
    tube(chair,m.wood,'back-splat',[[side*.04,.67,.212],[side*.105,.78,.22],[side*.065,.90,.235],[side*.09,1.035,.24]],.016);
  }
  return chair;
}
function plate(parent,m,x,y,z) {
  const profile=[[0,0],[.10,0],[.122,.003],[.14,.014],[.145,.021],[.14,.026],[.122,.016],[.10,.012],[0,.012]];
  lathe(parent,m.ceramic,'ceramic-plate',profile,x,y,z);
  const rim=mesh(parent,new THREE.TorusGeometry(.132,.0025,5,40),m.brass,'plate-rim',x,y+.021,z);rim.rotation.x=Math.PI/2;
}
function glass(parent,m,x,y,z) {
  lathe(parent,m.glass,'wineglass',[[.039,0],[.042,.004],[.008,.012],[.006,.075],[.022,.083],[.044,.123],[.043,.162],[.038,.164],[.037,.125],[.019,.089]],x,y,z);
}
function bottle(parent,m,x,y,z) {
  lathe(parent,m.bottle,'wine-bottle',[[.034,0],[.046,.01],[.046,.145],[.041,.172],[.019,.20],[.017,.275],[.021,.28],[.021,.296],[.016,.30]],x,y,z);
  mesh(parent,new THREE.CylinderGeometry(.047,.047,.065,24,1,true),m.paper,'bottle-label',x,y+.085,z);
}
export function createCandelabra(m) {
  const group=new THREE.Group();group.name='brass-candelabra';
  lathe(group,m.brass,'candelabra-stem',[[.085,0],[.09,.012],[.06,.03],[.025,.05],[.018,.20],[.035,.23],[.022,.27],[.02,.31]],0,0,0);
  for(const x of [-.17,0,.17]) {
    if(x) tube(group,m.brass,'candle-arm',[[0,.16,0],[x*.45,.13,0],[x,.19,0],[x,.29,0]],.012);
    lathe(group,m.brass,'candle-cup',[[.018,0],[.043,.008],[.044,.016],[.024,.023]],x,.30,0);
    mesh(group,new THREE.CylinderGeometry(.017,.019,.17,14),m.candle,'wax-candle',x,.41,0);
    const flame=mesh(group,new THREE.SphereGeometry(.018,10,8),m.flame,'candle-flame',x,.511,0);flame.scale.set(.6,1.65,.6);flame.castShadow=false;
  }
  return group;
}
function createPlaceSetting(m) {
  const group=new THREE.Group();group.name='dining-setting';
  plate(group,m,0,0,0);
  box(group,m.cloth,'folded-napkin',.11,.018,.13,-.205,.009,.015);
  box(group,m.iron,'knife',.012,.007,.195,.18,.0035,.01);
  box(group,m.iron,'fork-handle',.011,.006,.13,-.165,.003,.045);
  for(let i=0;i<3;i++)box(group,m.iron,'fork-tine',.003,.005,.035,-.17+i*.005,.003,-.038);
  glass(group,m,.145,0,-.20);
  return group;
}
export function createDiningSuite(m) {
  const suite=new THREE.Group();suite.name='diagonal-dining-suite';suite.rotation.y=d.rotation;
  suite.add(createTable(m));
  for(const seat of seats) {const chair=createChair(m);chair.position.set(seat.x,0,seat.z);chair.rotation.y=seat.rotation;suite.add(chair);}
  for(const setting of settings) {const group=createPlaceSetting(m);group.position.set(setting.x,d.tableHeight+(setting.x===0?.018:.009),setting.z);group.rotation.y=setting.rotation;suite.add(group);}
  for(const z of [-.63,.63]) {const candles=createCandelabra(m);candles.position.set(0,d.tableHeight+.018,z);suite.add(candles);}
  bottle(suite,m,.14,d.tableHeight+.018,.12);bottle(suite,m,-.21,d.tableHeight+.018,-.30);
  plate(suite,m,0,d.tableHeight+.018,.02);
  return suite;
}
function bowFrontGeometry(width,depth,height) {
  const s=new THREE.Shape(),x=width/2,z=depth/2;
  s.moveTo(-x,z);s.lineTo(x,z);s.lineTo(x,-z+.07);
  s.quadraticCurveTo(0,-z-.15,-x,-z+.07);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:height,bevelEnabled:true,bevelSize:.009,bevelThickness:.004,bevelSegments:2,curveSegments:32});
  g.rotateX(-Math.PI/2);return g;
}
export function createSideboard(m) {
  const group=new THREE.Group();group.name='wooden-sideboard';
  mesh(group,bowFrontGeometry(1.32,.47,.63),m.darkWood,'bow-front-cabinet-body',0,.155,0);
  mesh(group,bowFrontGeometry(1.43,.54,.035),m.wood,'bow-front-cabinet-top',0,.80,0);
  mesh(group,bowFrontGeometry(1.36,.49,.025),m.wood,'bow-front-cabinet-lower-moulding',0,.17,0);
  for(const x of [-.49,.49])for(const z of [-.15,.17]){
    tube(group,m.darkWood,'curved-sideboard-leg',[[x,.19,z],[x*1.04,.13,z*1.03],[x*1.02,.075,z*1.07],[x*1.10,.024,z*1.15]],.020);
    box(group,m.darkWood,'cabinet-foot',.065,.018,.065,x*1.10,.009,z*1.15);
  }
  // Thin carved contours follow the bowed front instead of flat, chunky boxes.
  for(const x of [-.32,.32]) {
    const a=x-.265,b=x+.265;
    const z=xx=>.297-.09*(xx/.66)**2;
    for(const y of [.25,.64])tube(group,m.wood,'bowed-door-carving',[[a,y,z(a)],[x,y,z(x)],[b,y,z(b)]],.010);
    for(const xx of [a,b])rod(group,m.wood,'sideboard-door-stile',[xx,.25,z(xx)],[xx,.64,z(xx)],.009);
    const handle=mesh(group,new THREE.TorusGeometry(.026,.005,6,20),m.brass,'cabinet-ring-pull',x,.53,z(x)+.014);
    handle.scale.y=1.18;
  }
  for(const y of [.705,.765])tube(group,m.wood,'bowed-drawer-rule',[[-.60,y,.226],[0,y,.303],[.60,y,.226]],.007);
  for(const x of [-.32,.32])mesh(group,new THREE.SphereGeometry(.013,10,6),m.brass,'drawer-knob',x,.737,.287);
  plate(group,m,-.38,.839,0);
  const candle=createCandelabra(m);candle.scale.setScalar(.78);candle.position.set(.40,.839,0);group.add(candle);
  return group;
}
