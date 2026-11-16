import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function buildHall(scene,renderer,manager) {
  const staticGroup=new THREE.Group();scene.add(staticGroup);
  const materials=new Map();
  const loader=new THREE.TextureLoader(manager);
  function material(color,roughness=.8,metalness=0){const key=color+roughness+metalness;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness,metalness}));return materials.get(key);}
  function box(w,h,d,color,x,y,z,radius=0,roughness=.8,metalness=0){const m=new THREE.Mesh(radius?new RoundedBoxGeometry(w,h,d,2,radius):new THREE.BoxGeometry(w,h,d),material(color,roughness,metalness));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;staticGroup.add(m);return m;}
  function cylinder(radius,length,color,a,b,roughness=.6){const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,12),material(color,roughness,.35));m.position.copy(a).lerp(b,.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());m.castShadow=true;staticGroup.add(m);return m;}
  function texture(draw,w=1024,h=512){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
  function sign(text,w,h,x,y,z,background='#173b42',color='#ecebe0',rotation=0){const t=texture((ctx,cw,ch)=>{ctx.fillStyle=background;ctx.fillRect(0,0,cw,ch);ctx.fillStyle=color;ctx.font='italic 800 100px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,cw/2,ch/2,cw*.9);},1024,256);const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,roughness:.8}));mesh.position.set(x,y,z);mesh.rotation.y=rotation;scene.add(mesh);return mesh;}
  function pbr(name,repeatX,repeatY){const load=(suffix,srgb=false)=>{const t=loader.load(`${import.meta.env.BASE_URL}textures/${name}-${suffix}.jpg`);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeatX,repeatY);t.anisotropy=Math.min(12,renderer.capabilities.getMaxAnisotropy());if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;};return {map:load('color',true),normalMap:load('normal'),roughnessMap:load('roughness')};}
  const wood=new THREE.MeshStandardMaterial({...pbr('wood',6,5),roughness:.6,normalScale:new THREE.Vector2(.4,.4),color:'#bba58d'});
  const timber=new THREE.Mesh(new THREE.PlaneGeometry(32,25),wood);timber.rotation.x=-Math.PI/2;timber.position.set(0,-.014,0);timber.receiveShadow=true;scene.add(timber);
  // Faded sports-court lines remain visible beyond the carpet edge.
  for(const z of [-9,9])box(27,.0005,.04,'#d9d8c0',0,-.012,z);
  for(const x of [-13.5,13.5])box(.04,.0005,18,'#d9d8c0',x,-.012,0);
  const court=new THREE.Mesh(new THREE.RingGeometry(3.15,3.19,96),material('#b8ba9c'));court.rotation.x=-Math.PI/2;court.position.set(0,-.011,0);scene.add(court);
  // Cream blockwork with teal lower walls and timber skirting.
  const wallMap=texture((ctx,w,h)=>{ctx.fillStyle='#cec9b9';ctx.fillRect(0,0,w,h);let seed=45;for(let i=0;i<50000;i++){seed=(seed*1664525+1013904223)>>>0;ctx.fillStyle=i%2?'#fff1':'#0001';ctx.fillRect(seed%w,(seed>>>10)%h,1,1);}ctx.strokeStyle='#8e8d8122';ctx.lineWidth=2;for(let y=0;y<=h;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();for(let x=(y/64%2)*128;x<w;x+=256){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+64);ctx.stroke();}}});wallMap.wrapS=wallMap.wrapT=THREE.RepeatWrapping;wallMap.repeat.set(8,2);
  const wallMat=new THREE.MeshStandardMaterial({map:wallMap,roughness:.96});
  for(const [w,d,x,z] of [[32,.18,0,-10.5],[.18,24,-14.5,0],[.18,24,14.5,0]]){const wall=box(w,5.8,d,'#d4d0c2',x,2.85,z);wall.material=wallMat;box(w+.03,1.12,d+.03,'#647d76',x,.53,z);box(w+.06,.11,d+.06,'#65503b',x,.035,z);box(w+.055,.055,d+.055,'#adab94',x,1.11,z);}
  // Deep window reveals, muntins and gathered curtains.
  for(const x of [-11,-7,7,11]){
    box(2.7,2,.11,'#d9d9c8',x,2.7,-10.34,.015);const glass=box(2.48,1.8,.015,'#8dabb3',x,2.7,-10.26,0,.17);glass.material=new THREE.MeshPhysicalMaterial({color:'#8ba1a8',roughness:.22,metalness:.15,envMapIntensity:.6});
    for(const dx of [-1.24,0,1.24])box(.05,1.86,.035,'#d8d8c7',x+dx,2.7,-10.23);
    for(const y of [1.78,2.7,3.62])box(2.55,.05,.035,'#d8d8c7',x,y,-10.23);
    box(2.85,.08,.25,'#d9d8c6',x,1.71,-10.20,.012);
    for(const side of [-1,1])for(let fold=0;fold<9;fold++){const m=box(.075,2.25,.1,'#655047',x+side*(1.3+fold*.035),2.60,-10.12+Math.sin(fold*2)*.04,.025);m.castShadow=false;}
    cylinder(.018,3.5,'#69645c',new THREE.Vector3(x-1.75,3.78,-10.05),new THREE.Vector3(x+1.75,3.78,-10.05));
    // Wall-mounted radiators underneath.
    box(1.65,.49,.13,'#d6d4c6',x,.56,-10.26,.025);for(let k=0;k<24;k++)box(.018,.42,.025,'#b7b9aa',x-.75+k*.064,.56,-10.17,.004);
  }
  // Exit and fire equipment, with readable scale cues.
  for(const x of [-2.3,2.3]){box(1.15,2.18,.09,'#444f48',x,1.08,-10.32,.01);box(.07,.07,.07,'#a9b2af',x+.38,1.04,-10.22,.008,.3,.7);box(.85,.035,.045,'#aeb5ad',x,1.00,-10.20,.007,.3,.7);}
  sign('EXIT  →',.85,.23,2.3,2.37,-10.20,'#2a6c4c');
  box(.16,.50,.15,'#a52d22',3.28,.46,-10.17,.045);box(.11,.045,.09,'#1f2726',3.28,.73,-10.17,.01);
  sign('CARPET CLUB',5,.7,0,3.4,-10.22,'#173b42');
  sign('INDOOR RACING  /  1:12',3,.3,0,2.75,-10.22,'#d0cbbb','#303f3d');
  for(const [x,text,color] of [[-10,'MINI CHALLENGE','#253943'],[-5,'RACE • REPEAT','#c34d32'],[5,'CARPET CLUB','#253943'],[10,'CLUB NIGHT','#c34d32']]){sign(text,2.8,.58,x,.42,-7.55,color);for(const dx of [-1.2,1.2])box(.035,.72,.035,'#555e59',x+dx,.35,-7.58);}
  // Folding pit benches with rubber mats, chargers, tyres, cases and transmitters.
  const chairPositions=[];
  for(const x of [-10,-6,6,10]){
    box(2.8,.065,.88,'#a99576',x,.76,-8.55,.025,.6);
    for(const side of [-1,1]){cylinder(.025,.76,'#8b9697',new THREE.Vector3(x+side*1.12,.02,-8.83),new THREE.Vector3(x+side*.92,.73,-8.23));cylinder(.025,.76,'#8b9697',new THREE.Vector3(x+side*1.12,.02,-8.23),new THREE.Vector3(x+side*.92,.73,-8.83));}
    box(1.05,.008,.6,'#21312e',x,.801,-8.55,.009);box(.31,.13,.23,'#253a44',x-.85,.86,-8.63,.015);box(.19,.003,.075,'#89b5b8',x-.85,.928,-8.62,.004,.3);box(.20,.10,.16,'#1d292a',x+.8,.85,-8.6,.01);box(.055,.13,.05,'#343e3e',x+.8,.965,-8.6,.01);box(.13,.07,.09,'#414b49',x+.8,1.04,-8.6,.008);
    for(let k=0;k<4;k++){const tyre=new THREE.Mesh(new THREE.TorusGeometry(.027,.009,8,24),material('#161b1b'));tyre.position.set(x+.33+k*.075,.816,-8.35);tyre.rotation.x=Math.PI/2;staticGroup.add(tyre);}
    const wireCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(x-.71,.82,-8.6),new THREE.Vector3(x-.52,.81,-8.35),new THREE.Vector3(x-.27,.81,-8.39),new THREE.Vector3(x-.21,.81,-8.56)]);staticGroup.add(new THREE.Mesh(new THREE.TubeGeometry(wireCurve,20,.002,6,false),material('#b74935')));
    box(.7,.30,.38,'#25302f',x+.5,.15,-8.48,.025);box(.18,.025,.07,'#191f1e',x+.5,.315,-8.48,.008);
    chairPositions.push([x-.5,-9.4,Math.PI],[x+.65,-9.35,Math.PI+.1]);
  }
  new GLTFLoader(manager).load(`${import.meta.env.BASE_URL}models/chair/chair.gltf`,gltf=>{
    const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3());
    const scale=.86/size.y;
    for(const [x,z,rotation] of chairPositions){const chair=gltf.scene.clone(true);chair.scale.setScalar(scale);chair.position.set(x,-.014-bounds.min.y*scale,z);chair.rotation.y=rotation;chair.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(chair);}
  });
  // Timing desk, laptop and timing board.
  box(1.8,.07,.8,'#8c795f',-12,.76,-4.5,.02);for(const x of [-12.7,-11.3])box(.04,.76,.65,'#626b69',x,.34,-4.5);
  box(.32,.015,.23,'#242f32',-12,.81,-4.5,.006);const laptop=box(.32,.21,.012,'#26343a',-12,.92,-4.6,.007);laptop.rotation.x=-.15;sign('LIVE TIMING',.27,.12,-12,.94,-4.585,'#10363a','#6ed5c0');
  // Ceiling structure. Diffuse fixtures provide broad reflections rather than hard stripes.
  const roofStart=staticGroup.children.length;
  box(32,.12,24,'#aaada3',0,5.8,0).castShadow=false;
  for(const z of [-7,-1,5]){box(29,.19,.12,'#565f5b',0,5.55,z).castShadow=false;for(const x of [-8,0,8]){const fixture=box(2.5,.07,.3,'#bfc6be',x,5.35,z,.025,.5);fixture.castShadow=false;const lens=box(2.35,.012,.23,'#f0eee0',x,5.31,z,.008);lens.castShadow=false;lens.material=new THREE.MeshBasicMaterial({color:'#f5f3df'});}}
  const roof=new THREE.Group();scene.add(roof);for(const part of staticGroup.children.slice(roofStart))roof.add(part);
  // Merge stationary structural meshes by material to keep rendering costs low.
  staticGroup.updateMatrixWorld(true);const groups=new Map();
  for(const child of [...staticGroup.children]){if(!child.isMesh||Array.isArray(child.material))continue;const key=child.material.uuid+child.castShadow;const bucket=groups.get(key)||{material:child.material,shadow:child.castShadow,geometries:[]};const geo=child.geometry.clone().applyMatrix4(child.matrixWorld);bucket.geometries.push(geo.index?geo.toNonIndexed():geo);groups.set(key,bucket);staticGroup.remove(child);}
  for(const {material:mat,shadow,geometries} of groups.values()){const geometry=mergeGeometries(geometries,false);const mesh=new THREE.Mesh(geometry,mat);mesh.castShadow=shadow;mesh.receiveShadow=true;staticGroup.add(mesh);for(const g of geometries)g.dispose();}
  return {pbr,box,material,texture,sign,roof};
}
