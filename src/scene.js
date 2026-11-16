import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createMini } from './car.js';
import { buildHall } from './hall.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createScene(viewport) {
  const scene=new THREE.Scene(); scene.background=new THREE.Color('#b9bcb5'); scene.fog=new THREE.Fog('#b9bcb5',28,65);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;viewport.append(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(35,1,.015,100);
  const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();scene.environmentIntensity=.65;
  scene.add(new THREE.HemisphereLight('#f4f3e8','#6c7269',1.5));
  const key=new THREE.DirectionalLight('#fff5e3',2.6);key.position.set(-5,5,2);key.castShadow=true;key.shadow.mapSize.set(4096,4096);Object.assign(key.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:1,far:35});key.shadow.bias=-.0002;key.shadow.normalBias=.003;scene.add(key);
  const materials=new Map();
  function material(color,roughness=.8){const k=color+roughness;if(!materials.has(k))materials.set(k,new THREE.MeshStandardMaterial({color,roughness}));return materials.get(k);}
  function box(w,h,d,color,x,y,z,parent=scene,radius=0,roughness=.8){const mesh=new THREE.Mesh(radius?new RoundedBoxGeometry(w,h,d,3,radius):new THREE.BoxGeometry(w,h,d),material(color,roughness));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  function texture(draw,w=512,h=512){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;}
  const hall=buildHall(scene,renderer,new THREE.LoadingManager());
  const carpetMat=new THREE.MeshStandardMaterial({...hall.pbr('carpet',42,29),color:'#777d80',normalScale:new THREE.Vector2(.45,.45),roughness:1});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(21,14.5),carpetMat);floor.rotation.x=-Math.PI/2;floor.position.y=-.005;floor.receiveShadow=true;scene.add(floor);
  for(let x=-9;x<=9;x+=3)box(.006,.001,14.5,'#505655',x,-.003,0);
  for(const z of [-7.24,7.24])box(21,.002,.035,'#aaa99b',0,0,z);
  for(const x of [-10.49,10.49])box(.035,.002,14.5,'#aaa99b',x,0,0);
  const anchors=[[0,5],[6.6,5],[8,3.6],[8,-3.6],[6.6,-5],[-6.6,-5],[-8,-3.5],[-8,3.5],[-6.4,5],[-4.5,4.6],[-3.8,2.8],[-3.8,-.7],[-2.5,-2],[1.8,-2],[3.1,-.7],[2.8,1],[.1,1.7],[-.7,3.2]];
  const curve=new THREE.CatmullRomCurve3(anchors.map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal');
  const count=480,width=1.95;
  const points=Array.from({length:count},(_,i)=>curve.getPointAt(i/count));
  const normals=points.map((_,i)=>{const t=curve.getTangentAt(i/count);return new THREE.Vector3(-t.z,0,t.x).normalize();});
  // Rounded white PVC trunking, joined continuously around each corner.
  const railGeometry=new RoundedBoxGeometry(.07,.052,1,3,.018);
  const rails=new THREE.InstancedMesh(railGeometry,new THREE.MeshPhysicalMaterial({color:'#e5e4da',roughness:.36,clearcoat:.25}),count*2);
  rails.castShadow=true;rails.receiveShadow=true;
  const dummy=new THREE.Object3D();let ri=0;
  for(let i=0;i<count;i++){const next=(i+1)%count;for(const side of [-1,1]){
    const a=points[i].clone().addScaledVector(normals[i],side*(width/2+.02));
    const b=points[next].clone().addScaledVector(normals[next],side*(width/2+.02));
    dummy.position.set((a.x+b.x)/2,.026,(a.z+b.z)/2);dummy.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);dummy.scale.set(1,1,a.distanceTo(b)+.012);dummy.updateMatrix();rails.setMatrixAt(ri,dummy.matrix);
    rails.setColorAt(ri++,new THREE.Color(Math.floor(i/9)%13===0?'#bd4934':'#e5e4da'));
  }}scene.add(rails);
  // Broad, irregular tyre wear embedded in the carpet, with no painted racing line.
  const wear=texture((ctx,w,h)=>{
    let seed=921;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let n=0;n<15000;n++){const i=Math.floor(random()*count),p=points[i],normal=normals[i],spread=(random()+random()+random()-1.5)*.42;
      const x=(p.x+normal.x*spread+10.5)/21*w,y=(p.z+normal.z*spread+7.25)/14.5*h;
      ctx.fillStyle='rgba(20,24,23,0.012)';ctx.beginPath();ctx.ellipse(x,y,2+random()*9,1+random()*4,0,0,Math.PI*2);ctx.fill();
    }
  },2048,2048);
  const wearPlane=new THREE.Mesh(new THREE.PlaneGeometry(21,14.5),new THREE.MeshBasicMaterial({map:wear,transparent:true,depthWrite:false,opacity:.6}));wearPlane.rotation.x=-Math.PI/2;wearPlane.scale.y=-1;wearPlane.material.side=THREE.DoubleSide;wearPlane.position.y=-.003;scene.add(wearPlane);
  const start=points[0],tangent=curve.getTangentAt(0);
  const finish=new THREE.Group();finish.position.copy(start);finish.rotation.y=Math.atan2(tangent.x,tangent.z);scene.add(finish);
  for(let x=0;x<12;x++)for(let z=0;z<2;z++)box(width/12,.001,.065,(x+z)%2?'#20252a':'#d8d9d3',(x-5.5)*width/12,.002,(z-.5)*.065,finish);
  for(let i=1;i<=6;i++){const p=curve.getPointAt(1-i*.008),n=new THREE.Vector3(-curve.getTangentAt(1-i*.008).z,0,curve.getTangentAt(1-i*.008).x);const grid=box(.22,.001,.008,'#aaaead',p.x+n.x*(i%2?.24:-.24),.002,p.z+n.z*(i%2?.24:-.24));grid.rotation.y=Math.atan2(tangent.x,tangent.z);}
  for(const [x,z] of [[-9,5.7],[9,5.7],[-9,-5.7],[9,-5.7]]){box(.20,.025,.20,'#e6e6de',x,.012,z);const cone=new THREE.Mesh(new THREE.ConeGeometry(.065,.19,16),material('#df6535'));cone.position.set(x,.12,z);cone.castShadow=true;scene.add(cone);}
  const {carGroup,shell,frontWheels,wheels}=createMini();scene.add(carGroup);
  let overview=false, initialized=false;const target=new THREE.Vector3();const rostrum=new THREE.Vector3(0,3.3,9.5);
  const targetBuffer=new THREE.WebGLRenderTarget(1,1,{samples:4,type:THREE.HalfFloatType});
  const composer=new EffectComposer(renderer,targetBuffer);composer.addPass(new RenderPass(scene,camera));
  const ao=new GTAOPass(scene,camera,1,1);ao.updateGtaoMaterial({radius:.22,thickness:.12,distanceFallOff:1,scale:1,samples:8});ao.blendIntensity=.75;composer.addPass(ao);composer.addPass(new OutputPass());
  function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);composer.setSize(w,h);ao.setSize(Math.ceil(w*renderer.getPixelRatio()*.5),Math.ceil(h*renderer.getPixelRatio()*.5));camera.aspect=w/h;camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(viewport);resize();
  function toggleCamera(){overview=!overview;hall.roof.visible=!overview;initialized=false;return overview;}
  function render(car,dt){
    carGroup.position.set(car.x,.002,car.z);carGroup.rotation.y=car.heading;
    shell.rotation.z=THREE.MathUtils.damp(shell.rotation.z,-(car.lateralAcceleration||0)*.0022,12,dt);
    shell.rotation.x=THREE.MathUtils.damp(shell.rotation.x,(car.acceleration||0)*.0023,12,dt);
    frontWheels.forEach(w=>w.rotation.y=-car.steering);wheels.forEach(w=>w.rotation.x+=car.speed/.023*dt);
    if(overview){camera.position.set(0,17,14);camera.fov=48;camera.lookAt(0,0,0);}
    else{
      camera.position.copy(rostrum);
      const desired=new THREE.Vector3(car.x+car.vx*.13,.025,car.z+car.vz*.13);
      if(!initialized){target.copy(desired);initialized=true;}else target.lerp(desired,1-Math.exp(-10*dt));
      camera.lookAt(target);
      const d=camera.position.distanceTo(target);
      const fov=THREE.MathUtils.clamp(2*Math.atan((1.65+Math.min(1.1,Math.abs(car.speed)*.15))/d)*180/Math.PI,16,55);
      camera.fov=THREE.MathUtils.damp(camera.fov,fov,3,dt);
    }
    camera.updateProjectionMatrix();composer.render();
  }
  return {points,width,start,startTangent:tangent,render,toggleCamera};
}
