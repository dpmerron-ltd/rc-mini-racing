import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAxis, steeringExpo, applyEndpoints, updateSteering, stepCar, constrainToTrack, LapCounter } from '../src/physics.js';
test('calibration handles reversed axes, unequal travel, and neutral jitter',()=>{
  assert.equal(normalizeAxis(.1,.1,.8,-.5),0);
  assert.equal(normalizeAxis(.11,.1,.8,-.5),0);
  assert.equal(normalizeAxis(-.5,.1,.8,-.5),1);
  assert.equal(normalizeAxis(.8,.1,.8,-.5),-1);
  assert.equal(normalizeAxis(-1,.1,.8,-.5),1);
});
test('throttle accelerates, braking slows, and steering changes heading',()=>{
  const car={x:0,z:0,speed:0,steering:0,heading:0,vx:0,vz:0};
  for(let i=0;i<120;i++)stepCar(car,{throttle:1,steer:0},1/120);
  assert.ok(car.speed>3); assert.ok(car.z>1);
  const speed=car.speed;
  for(let i=0;i<20;i++)stepCar(car,{throttle:-1,steer:.5},1/120);
  assert.ok(car.speed<speed); assert.ok(car.heading<0);
});
test('hard barriers reflect impacts without removing speed',()=>{
  const track=[{x:0,z:0},{x:0,z:10},{x:-10,z:10},{x:-10,z:0}];
  const car={x:2,z:5,vx:2,vz:3,speed:3,heading:0};
  const before=Math.hypot(car.vx,car.vz);
  constrainToTrack(car,track,.8);
  assert.ok(car.x<=.7150001);assert.ok(car.vx<0);
  assert.equal(car.vz,3);assert.ok(Math.abs(Math.hypot(car.vx,car.vz)-before)<1e-9);
  const vx=car.vx;constrainToTrack(car,track,.8);assert.equal(car.vx,vx);
});
test('laps require ordered checkpoints and forward finish crossing',()=>{
  const laps=new LapCounter();
  laps.update(.95,1);laps.update(.01,1);assert.equal(laps.laps,0);
  laps.reset();
  for(let i=1;i<=101;i++)laps.update((i/100)%1,.1);
  assert.equal(laps.laps,1);assert.ok(laps.best>9);
  laps.update(.99,.1);assert.equal(laps.laps,1);
});

test('steering at rest cannot propel or rotate the car',()=>{
  const car={x:0,z:0,speed:0,steering:0,heading:0,vx:0,vz:0};
  for(let i=0;i<600;i++)stepCar(car,{throttle:0,steer:1},1/120);
  assert.ok(Math.hypot(car.x,car.z)<.001);assert.ok(Math.abs(car.heading)<.001);
});
test('handling stays finite through accelerating turns and reversing',()=>{
  const car={x:0,z:0,speed:0,steering:0,heading:0,vx:0,vz:0};
  for(let i=0;i<7200;i++){
    stepCar(car,{throttle:i<3600?1:-1,steer:Math.sin(i/200)},1/120);
    assert.ok(Object.values(car).every(Number.isFinite));
    assert.ok(Math.hypot(car.vx,car.vz)<10);assert.ok(Math.abs(car.yawRate)<30);
  }
});
test('handling is consistent across simulation call rates',()=>{
  const simulate=(hz)=>{const car={x:0,z:0,speed:0,steering:0,heading:0,vx:0,vz:0};for(let i=0;i<2*hz;i++)stepCar(car,{throttle:.5,steer:.15},1/hz);return car;};
  const a=simulate(60),b=simulate(120);
  assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.015);assert.ok(Math.abs(a.heading-b.heading)<.015);
});

test('fast corner entry runs wide; braking restores a tighter line',()=>{
  const make=()=>({x:0,z:0,heading:0,speed:7,steering:0,vx:0,vz:7});
  const fast=make(),braked=make();
  for(let i=0;i<72;i++)stepCar(braked,{throttle:-1,steer:0},1/120);
  for(let i=0;i<60;i++){
    stepCar(fast,{throttle:.25,steer:.4},1/120);
    stepCar(braked,{throttle:.25,steer:.4},1/120);
  }
  const fastRadius=Math.abs(fast.speed/fast.yawRate),slowRadius=Math.abs(braked.speed/braked.yawRate);
  assert.ok(fastRadius>slowRadius*1.5,`Entry radii: fast ${fastRadius}, braked ${slowRadius}`);
});

test('end points independently limit steering, throttle, and brake',()=>{
  const e={left:.6,right:1.2,throttle:.7,brake:.3};
  assert.deepEqual(applyEndpoints({steer:-1,throttle:1},e),{steer:-.6,throttle:.7});
  assert.deepEqual(applyEndpoints({steer:1,throttle:-1},e),{steer:1.2,throttle:-.3});
  assert.deepEqual(applyEndpoints({steer:0,throttle:0},e),{steer:0,throttle:0});
});

test('releasing maximum steering centres within 60ms without overshoot',()=>{
  for(const direction of [-1,1]){
    const car={x:0,z:0,heading:0,speed:0,steering:0,vx:0,vz:0};
    for(let i=0;i<60;i++)stepCar(car,{steer:direction*1.25,throttle:0},1/120);
    assert.ok(Math.abs(car.steering)>.48);
    for(let i=0;i<7;i++){
      stepCar(car,{steer:0,throttle:0},1/120);
      assert.ok(car.steering*direction>=0);
    }
    assert.equal(car.steering,0);
  }
});

test('expo changes centre response without changing neutral or end points',()=>{
  for(const e of [-1,-.5,0,.2,.5,1]){
    assert.equal(steeringExpo(0,e),0);assert.equal(steeringExpo(1,e),1);assert.equal(steeringExpo(-1,e),-1);
    assert.equal(steeringExpo(-.5,e),-steeringExpo(.5,e));
  }
  assert.equal(steeringExpo(.5,0),.5);
  assert.ok(steeringExpo(.5,.5)<.5);assert.ok(steeringExpo(.5,-.5)>.5);
  const epa={left:.6,right:1.2,throttle:1,brake:1};
  for(const expo of [-1,0,1])assert.equal(applyEndpoints({steer:steeringExpo(1,expo),throttle:0},epa).steer,1.2);
});

test('expo reaches the actual wheel angle, including with reduced end points',()=>{
  const angles=[];
  for(const expo of [-1,0,1]){
    const car={x:0,z:0,heading:0,speed:0,steering:0,vx:0,vz:0};
    const input=applyEndpoints({steer:steeringExpo(.5,expo),throttle:0},{left:.63,right:.63,throttle:1,brake:.56});
    for(let i=0;i<30;i++)stepCar(car,input,1/120);
    angles.push(car.steering);
  }
  assert.ok(angles[0]>angles[1]);assert.ok(angles[1]>angles[2]);assert.ok(angles[0]>angles[2]*6);
});
test('paused steering preview moves the wheels without moving the car',()=>{
  const car={x:2,z:3,steering:0,heading:1,speed:4,vx:0,vz:4};
  for(let i=0;i<30;i++)updateSteering(car,.5,1/60);
  assert.ok(car.steering>.19);assert.equal(car.x,2);assert.equal(car.z,3);assert.equal(car.heading,1);assert.equal(car.speed,4);
});
