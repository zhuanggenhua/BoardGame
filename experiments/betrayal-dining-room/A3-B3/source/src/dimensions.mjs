/** Metres are inferred for a coherent prototype, not recovered measurements. */
export const dimensions = Object.freeze({
  room: 6.6, wallHeight: 2.65, wallThickness: .16, wainscotHeight: .92,
  tableWidth: 1.68, tableLength: 3.75, tableHeight: .79, tableThickness: .075,
  seatWidth: .48, seatDepth: .46, seatHeight: .47, chairHeight: 1.08,
  rugWidth: 3.0, rugLength: 5.08, rotation: Math.PI / 4,
  doorWidth: 1.38, doorHeight: 2.18,
});
// Chair local forward is -Z. Four side seats and two end seats are visible in the reference.
export const seats = Object.freeze([
  {x:-1.13,z:-.83,rotation:-Math.PI/2}, {x:-1.13,z:.83,rotation:-Math.PI/2},
  {x:1.13,z:-.83,rotation:Math.PI/2}, {x:1.13,z:.83,rotation:Math.PI/2},
  {x:0,z:-2.10,rotation:Math.PI}, {x:0,z:2.10,rotation:0},
]);
export const settings = Object.freeze([
  {x:-.51,z:-.77,rotation:-Math.PI/2}, {x:-.51,z:.77,rotation:-Math.PI/2},
  {x:.51,z:-.77,rotation:Math.PI/2}, {x:.51,z:.77,rotation:Math.PI/2},
  {x:0,z:-1.48,rotation:Math.PI}, {x:0,z:1.48,rotation:0},
]);
export const cameraPresets = Object.freeze({
  overview: {position:[9.3,10.8,11.6],target:[0,.3,0],height:5.0},
  detail: {position:[4.5,5.0,6.0],target:[0,.55,0],height:3.15},
  // Stay just inside the minimum polar angle; controls must not clamp the preset.
  top: {position:[0,15,.02],target:[0,0,0],height:4.05},
});
export const lighting = Object.freeze({
  neutral: {sky:'#ffffff',ground:'#69645b',ambient:2.1,key:'#ffffff',keyIntensity:3.1,fill:'#ffffff',fillIntensity:.8,candles:0,exposure:1.0},
  warm: {sky:'#bac7c1',ground:'#31291e',ambient:.85,key:'#e9c99f',keyIntensity:2.6,fill:'#9eafbf',fillIntensity:.7,candles:2.0,exposure:1.05},
});
