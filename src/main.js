import { createScene } from './scene.js';
import './style.css';
import { clamp, normalizeAxis, steeringExpo, applyEndpoints, updateSteering, stepCar, constrainToTrack, LapCounter } from './physics.js';

const $ = (id) => document.getElementById(id);
const storage = { get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }, set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} } };
const world=createScene($('viewport'));
const {points,width,start,startTangent}=world;

let car, running=false, hasStarted=false;
const laps=new LapCounter();
const keys=new Set();
let mode='keyboard', pad=null, lastPadId=null, calibration=null;
let settings=storage.get('carpet-club-settings') || {deadzone:.05,sensitivity:1};
settings.deadzone=clamp(Number.isFinite(settings.deadzone)?settings.deadzone:.05,0,.2); settings.sensitivity=clamp(Number.isFinite(settings.sensitivity)?settings.sensitivity:1,.4,1.4);
settings.expo=clamp(Number.isFinite(settings.expo)?settings.expo:.2,-1,1);
const endpoints=storage.get('carpet-club-endpoints') || {};
for(const key of ['left','right','throttle','brake']) endpoints[key]=clamp(Number.isFinite(endpoints[key])?endpoints[key]:1,key==='left'||key==='right'?.25:0,key==='left'||key==='right'?1.25:1);
function notice(text) { $('notice').textContent=text; }
function resetCar() {
  car={x:start.x,z:start.z,heading:Math.atan2(startTangent.x,startTangent.z),speed:0,steering:0,vx:0,vz:0,yawRate:0,acceleration:0,lateralAcceleration:0};
  laps.next=1; laps.previous=0; laps.elapsed=0;
  notice('Back on the start line. Find your rhythm.');
}
resetCar(); notice('Ready for a few practice laps?');
function pause(reason='Practice paused.') { running=false; keys.clear(); $('drive').innerHTML='Resume practice <span>↗</span>'; $('pause').textContent='Resume'; notice(reason); }
function startPractice() {
  if($('calibration').open)return;
  if(mode==='controller') {
    if(!pad) { notice('Connect your controller and move a control first.'); return; }
    if(!validCalibration(calibration,pad)) { openCalibration(); return; }
    const input=controllerInput();
    if(Math.abs(input.throttle)>.08 || Math.abs(input.steer)>.1) { notice('Release the trigger and centre the wheel, then press Start.'); return; }
  }
  running=true; hasStarted=true; $('drive').innerHTML='Practising <span>●</span>'; $('pause').innerHTML='Pause <kbd>P</kbd>'; document.activeElement?.blur(); notice('Follow the circuit. Cross the chequered line to finish a lap.');
}
$('drive').onclick=()=>{if(!running)startPractice();};
$('pause').onclick=()=>running?pause():startPractice();
$('reset').onclick=()=>{pause('Car reset. Press Start when ready.');resetCar();};
$('input-mode').onchange=()=>{mode=$('input-mode').value;pause('Control mode changed. Press Start when ready.');};
window.addEventListener('keydown',e=>{
  if(['INPUT','SELECT','BUTTON','SUMMARY','TEXTAREA'].includes(document.activeElement.tagName)||$('calibration').open)return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
  const k=e.key.toLowerCase(); keys.add(k);
  if(!e.repeat && (k==='p'||k===' ')) running?pause():startPractice();
  if(!e.repeat&&k==='r'){pause();resetCar();}
  if(!e.repeat&&k==='c')toggleCamera();
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{if(running)pause('Window unfocused. Return here and press Resume.');keys.clear();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)pause('Practice paused while the page was hidden.');});

function validCalibration(c,p) {
  return c && c.id===p.id && [c.steerAxis,c.throttleAxis].every(i=>Number.isInteger(i)&&i>=0&&i<p.axes.length) && c.steerAxis!==c.throttleAxis && ['centerSteer','left','right','centerThrottle','brake','throttle'].every(k=>Number.isFinite(c[k])) && Math.abs(c.left-c.centerSteer)>.05 && Math.abs(c.right-c.centerSteer)>.05 && (c.left-c.centerSteer)*(c.right-c.centerSteer)<0 && Math.abs(c.brake-c.centerThrottle)>.05 && Math.abs(c.throttle-c.centerThrottle)>.05 && (c.brake-c.centerThrottle)*(c.throttle-c.centerThrottle)<0;
}
function controllerInput() {
  if(!pad||!validCalibration(calibration,pad))return {steer:0,throttle:0};
  return {steer:clamp(normalizeAxis(pad.axes[calibration.steerAxis],calibration.centerSteer,calibration.left,calibration.right,settings.deadzone)*settings.sensitivity,-1,1),throttle:normalizeAxis(pad.axes[calibration.throttleAxis],calibration.centerThrottle,calibration.brake,calibration.throttle,settings.deadzone)};
}
let steeringBeforeExpo=0;
function readInput() {
  const input=mode==='controller'?controllerInput():{steer:((keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0))*Math.min(1,settings.sensitivity),throttle:(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0)};
  steeringBeforeExpo=input.steer;
  input.steer=steeringExpo(input.steer,settings.expo);
  return applyEndpoints(input,endpoints);
}
let apiError=false, nativePad=null, nativeReceived=0;
if(import.meta.env.DEV){
  const stream=new EventSource('/__nb4/events');
  stream.onmessage=e=>{try{const data=JSON.parse(e.data);nativeReceived=performance.now();nativePad=data.connected?{id:data.id,index:-1,axes:data.axes,buttons:[]}:null;}catch{}};
  stream.onerror=()=>{nativePad=null;};
}

function pollPad() {
  let devices=[];
  try{devices=Array.from(navigator.getGamepads?.() || []).filter(Boolean);}catch{apiError=true;}
  const native=performance.now()-nativeReceived<1500?nativePad:null;
  const next=devices.find(p=>/flysky|noble|284e/i.test(p.id))||native||devices[0]||null;
  const identity=next?`${next.index}:${next.id}`:null;
  if(identity!==lastPadId) {
    if(lastPadId&&mode==='controller')pause('Controller disconnected or changed. Reconnect, then resume.');
    pad=next;lastPadId=identity;
    calibration=pad?storage.get(`carpet-club-calibration:${pad.id}`):null;
    if(pad&&!hasStarted){mode='controller';$('input-mode').value=mode;}
    if($('calibration').open){$('calibration').close();notice('Controller changed. Restart calibration.');}
  }else pad=next;
  $('connection').textContent=pad?'USB CONNECTED':'KEYBOARD';$('connection').classList.toggle('connected',!!pad);
  $('controller-name').textContent=pad?`${pad.id}${validCalibration(calibration,pad)?' · Calibrated':' · Calibration needed'}`:(apiError?'Browser controller access is unavailable. Open this localhost page directly in Chrome.':'Connect your NB4, click this page, then move a control.');
  $('calibrate').disabled=!pad;
  $('raw-axes').textContent=pad?pad.axes.map((v,i)=>`Axis ${i}: ${v.toFixed(3)}`).join('\n'):'No controller data yet.';
}

for(const key of ['deadzone','sensitivity','expo']) {
  $(key).value=settings[key]; $(key+'-label').textContent=`${Math.round(settings[key]*100)}%`;
  $(key).oninput=()=>{settings[key]=Number($(key).value);$(key+'-label').textContent=`${Math.round(settings[key]*100)}%`;storage.set('carpet-club-settings',settings);};
}

function syncEndpoints(){for(const key of ['left','right','throttle','brake']){$('epa-'+key).value=Math.round(endpoints[key]*100);$('epa-'+key+'-label').textContent=`${Math.round(endpoints[key]*100)}%`;}}
for(const key of ['left','right','throttle','brake'])$('epa-'+key).oninput=()=>{endpoints[key]=Number($('epa-'+key).value)/100;syncEndpoints();storage.set('carpet-club-endpoints',endpoints);};
$('reset-endpoints').onclick=()=>{for(const key of Object.keys(endpoints))endpoints[key]=1;syncEndpoints();storage.set('carpet-club-endpoints',endpoints);};
syncEndpoints();

// Calibration captures a held endpoint on explicit clicks, avoiding timed-window ambiguity.
const steps=[
  ['Find your neutral.','Release the trigger and let the steering wheel centre. Click below while both controls are untouched.','Capture neutral'],
  ['Steer fully left.','Turn the wheel fully LEFT and keep holding it while you click Capture. Leave the trigger at neutral.','Capture left'],
  ['Steer fully right.','Turn the wheel fully RIGHT and keep holding it while you click Capture.','Capture right'],
  ['Full throttle.','Centre the wheel. Pull the trigger fully for acceleration and keep holding it while you click Capture.','Capture throttle'],
  ['Full brake.','Push the trigger fully forward for braking and keep holding it while you click Capture.','Capture brake'],
  ['Return to neutral.','Release the trigger and centre the wheel. Save when both controls are resting.','Save calibration']
];
let calStep=0, draft={}, neutral=[], calError='';
function renderCalStep() {
  calError='';$('cal-title').textContent=steps[calStep][0];$('cal-instruction').textContent=steps[calStep][1];$('cal-next').textContent=steps[calStep][2];$('cal-feedback').textContent='';
  $('cal-progress').innerHTML=steps.map((_,i)=>`<span class="${i<=calStep?'active':''}"></span>`).join('');
}
function openCalibration() {
  if(!pad){notice('Move a controller axis or press a transmitter button to connect.');return;}
  pause('Calibration in progress.');calStep=0;draft={id:pad.id};neutral=[];renderCalStep();$('calibration').showModal();
}
$('calibrate').onclick=openCalibration;
$('cal-next').onclick=()=>{
  if(!pad)return;
  const axes=[...pad.axes];
  const fail=text=>{calError=text;$('cal-feedback').textContent=text;};
  if(calStep===0){neutral=axes;}
  if(calStep===1||calStep===3){
    const candidates=axes.map((v,i)=>({i,delta:Math.abs(v-neutral[i])})).filter(v=>calStep!==3||v.i!==draft.steerAxis).sort((a,b)=>b.delta-a.delta);
    if(!candidates[0]||candidates[0].delta<.08)return fail('No clear movement detected. Hold the requested control fully, then try again.');
    const i=candidates[0].i;
    if(calStep===1){draft.steerAxis=i;draft.centerSteer=neutral[i];draft.left=axes[i];}
    else{draft.throttleAxis=i;draft.centerThrottle=neutral[i];draft.throttle=axes[i];}
  }
  if(calStep===2){draft.right=axes[draft.steerAxis];if((draft.right-draft.centerSteer)*(draft.left-draft.centerSteer)>=0||Math.abs(draft.right-draft.centerSteer)<.08)return fail('Hold the wheel in the opposite direction to the left capture.');}
  if(calStep===4){draft.brake=axes[draft.throttleAxis];if((draft.brake-draft.centerThrottle)*(draft.throttle-draft.centerThrottle)>=0||Math.abs(draft.brake-draft.centerThrottle)<.08)return fail('Push the trigger in the opposite direction to throttle.');}
  if(calStep===5){
    if(Math.abs(axes[draft.steerAxis]-draft.centerSteer)>.06||Math.abs(axes[draft.throttleAxis]-draft.centerThrottle)>.06)return fail('Please release both controls before saving.');
    if(!validCalibration(draft,pad))return fail('Calibration is incomplete. Close this window and try again.');
    calibration=draft;storage.set(`carpet-club-calibration:${pad.id}`,calibration);mode='controller';$('input-mode').value=mode;$('calibration').close();notice('Controller calibrated. Press Start practice.');return;
  }
  calStep++;renderCalStep();
};
$('calibration').addEventListener('close',()=>{if(!validCalibration(calibration,pad||{id:'',axes:[]}))notice('Calibration not saved. You can still test with the keyboard.');});

function formatTime(s){if(s===null)return '—';const ms=Math.floor(s*1000);return `${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;}
function meter(id,value){value=clamp(value,-1,1);$(id).style.left=`${50+Math.min(0,value)*50}%`;$(id).style.width=`${Math.abs(value)*50}%`;$(id).style.background=value<0&&id==='throttle-meter'?'#c88d5a':'#6b9254';}
let previousTime=performance.now(),accumulator=0,lastUi=0;
function animate(now){
  requestAnimationFrame(animate);
  const elapsed=Math.min((now-previousTime)/1000,.05);previousTime=now;
  pollPad(); const input=readInput();
  if(running){
    accumulator+=elapsed;
    while(accumulator>=1/120){
      stepCar(car,input,1/120);
      const progress=constrainToTrack(car,points,width/2);
      if(laps.update(progress,1/120))notice(`Lap ${laps.laps} · ${formatTime(laps.last)}${laps.last===laps.best?' · Personal best!':''}`);
      accumulator-=1/120;
    }
  }else {accumulator=0;updateSteering(car,input.steer,elapsed);}

  if(now-lastUi>70){
    $('lap-time').textContent=formatTime(laps.elapsed);$('laps').textContent=laps.laps;$('best').textContent=formatTime(laps.best);$('speed').textContent=Math.round(Math.abs(car.speed)*3.6);
    meter('steer-meter',input.steer);meter('throttle-meter',input.throttle);
    $('steer-value').textContent=`${Math.round(input.steer*100)}%`;
    $('expo-example').textContent=`At half wheel: ${Math.round(steeringExpo(.5,settings.expo)*100)}% before end points.`;
    $('steering-live').textContent=`Wheel input ${Math.round(steeringBeforeExpo*100)}% → steering output ${Math.round(input.steer*100)}% → front wheels ${(car.steering*180/Math.PI).toFixed(1)}°`;
$('throttle-value').textContent=`${Math.round(input.throttle*100)}%`;
    if($('calibration').open&&pad){$('cal-feedback').textContent=calError||pad.axes.map((v,i)=>`A${i}: ${v.toFixed(2)}`).join('  ');}
    lastUi=now;
  }
  world.render(car,elapsed);
}
requestAnimationFrame(animate);

function toggleCamera(){const wide=world.toggleCamera();$('camera-mode').textContent=wide?'Whole circuit':'Rostrum follow';}
$('camera-mode').onclick=toggleCamera;
$('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.();};
