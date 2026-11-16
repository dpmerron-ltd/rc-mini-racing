import * as THREE from 'three';

export function createMini() {
  const carGroup=new THREE.Group(),shell=new THREE.Group();carGroup.add(shell);
  const frontWheels=[],wheels=[];
  function tex(draw,w=1024,h=1024){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
  // White/green/black slash-and-splatter livery, following the supplied reference.
  let seed=412;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const livery=tex((ctx,w,h)=>{
    ctx.fillStyle='#e8ece8';ctx.fillRect(0,0,w,h);
    for(let i=0;i<42;i++){
      const x=random()*w,y=random()*h,len=140+random()*430;
      ctx.fillStyle=['#12a844','#12d54c','#08732e','#111b18','#9fa9a4'][i%5];
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+len*.2,y+len*.65);ctx.lineTo(x+25,y+len);ctx.lineTo(x-13,y+len*.6);ctx.closePath();ctx.fill();
    }
    for(let i=0;i<1500;i++){
      ctx.fillStyle=i%4===0?'#111815':i%3===0?'#077633':'#1bc74c';const r=random()*3.1+.3;
      ctx.beginPath();ctx.ellipse(random()*w,random()*h,r,r*.55,random()*3,0,Math.PI*2);ctx.fill();
    }
  },1024,2048);
  const paint=new THREE.MeshPhysicalMaterial({map:livery,roughness:.23,metalness:.05,clearcoat:1,clearcoatRoughness:.13,envMapIntensity:.9,side:THREE.DoubleSide});
  const black=new THREE.MeshStandardMaterial({color:'#111615',roughness:.55});
  const glass=new THREE.MeshPhysicalMaterial({color:'#19251e',metalness:.12,roughness:.11,clearcoat:1,transparent:true,opacity:.9,envMapIntensity:1.4,side:THREE.DoubleSide});
  const white=new THREE.MeshPhysicalMaterial({color:'#ebeee8',roughness:.25,clearcoat:1});
  function mesh(g,m,parent=shell){const o=new THREE.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function box(w,h,d,m,x,y,z,parent=shell){const o=mesh(new THREE.BoxGeometry(w,h,d),m,parent);o.position.set(x,y,z);return o;}
  // Smooth section-built polycarbonate shell with actual wheel-arch openings.
  // z, half width, shoulder height, roof half width, crown height
  const sections=[[-.145,.060,.044,.055,.047],[-.132,.077,.051,.066,.059],[-.105,.081,.053,.063,.067],[-.081,.080,.057,.057,.108],[-.059,.079,.058,.059,.116],[.018,.079,.058,.059,.116],[.046,.080,.057,.061,.106],[.079,.081,.052,.066,.063],[.114,.079,.049,.064,.056],[.142,.070,.037,.059,.046],[.149,.055,.028,.049,.032]];
  function sectionAt(z){let i=0;while(i<sections.length-2&&sections[i+1][0]<z)i++;const a=sections[i],b=sections[i+1],t=(z-a[0])/(b[0]-a[0]);return a.map((v,j)=>j===0?z:v+(b[j]-v)*t);}
  const vertices=[],uvs=[],indices=[],N=180,R=13;
  for(let i=0;i<=N;i++){
    const z=-.145+i/N*.294;const [,w,s,r,top]=sectionAt(z);
    const dz=Math.min(Math.abs(z-.088),Math.abs(z+.088));
    const bottom=dz<.029?Math.max(.017,.022+Math.sqrt(.029**2-dz**2)):.017;
    const ring=[[-w,bottom],[-w-.001,(bottom+s)/2],[-w,s],[-r-.006,top-.012],[-r,top-.003],[-r*.5,top+.001],[0,top+.003],[r*.5,top+.001],[r,top-.003],[r+.006,top-.012],[w,s],[w+.001,(bottom+s)/2],[w,bottom]];
    for(let j=0;j<R;j++){vertices.push(ring[j][0],ring[j][1],z);uvs.push(j/(R-1),i/N);}
    if(i<N)for(let j=0;j<R-1;j++){const k=i*R+j;indices.push(k,k+R,k+1,k+1,k+R,k+R+1);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();mesh(geo,paint);
  function quad(coords,m){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(coords.flat(),3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return mesh(g,m);}
  // Sloped windshield and rear glass, bounded by painted pillars.
  quad([[-.061,.066,.076],[.061,.066,.076],[.054,.106,.043],[-.054,.106,.043]],glass);
  quad([[-.052,.105,-.080],[.052,.105,-.080],[.059,.065,-.104],[-.059,.065,-.104]],glass);
  for(const side of [-1,1]){
    quad([[side*.080,.059,-.095],[side*.080,.059,.066],[side*.062,.105,.038],[side*.060,.108,-.074]],glass);
    // Pillar, door outline and a black side intake as in the reference body.
    const pillar=box(.003,.048,.004,black,side*.070,.082,-.022);pillar.rotation.z=side*.38;
    quad([[side*.082,.028,-.050],[side*.083,.028,-.031],[side*.082,.055,-.025],[side*.082,.055,-.044]],black);
    const edge=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(side*.082,.027,.048),new THREE.Vector3(side*.082,.055,.048),new THREE.Vector3(side*.082,.056,-.06)]),new THREE.LineBasicMaterial({color:'#374138',transparent:true,opacity:.6}));shell.add(edge);
  }
  const grille=box(.09,.022,.006,black,0,.036,.146);grille.rotation.x=-.1;
  for(let y=.029;y<=.044;y+=.004)box(.086,.001,.001,new THREE.MeshStandardMaterial({color:'#38403a',roughness:.45}),0,y,.150);
  for(const side of [-1,1]){
    const lamp=mesh(new THREE.CylinderGeometry(.013,.013,.003,32),black);lamp.rotation.x=Math.PI/2;lamp.rotation.z=side*.15;lamp.position.set(side*.055,.047,.140);
    box(.009,.014,.003,new THREE.MeshStandardMaterial({color:'#940c10',roughness:.3}),side*.057,.041,-.142);
  }
  box(.13,.005,.014,black,0,.016,.145);box(.13,.005,.014,black,0,.016,-.144);
  box(.13,.006,.23,black,0,.019,0,carGroup);
  // Black wing on two thin mounts, with tall endplates.
  for(const x of [-.048,.048])box(.006,.033,.009,black,x,.092,-.132);
  const wing=box(.186,.005,.038,black,0,.110,-.145);wing.rotation.x=-.12;
  for(const x of [-.092,.092])box(.004,.028,.043,black,x,.118,-.145);
  box(.181,.012,.003,black,0,.116,-.163);
  for(const z of [-.088,.088])for(const x of [-.071,.071]){
    const pivot=new THREE.Group();pivot.position.set(x,.023,z);carGroup.add(pivot);
    const tyre=mesh(new THREE.CylinderGeometry(.024,.024,.025,40),new THREE.MeshStandardMaterial({color:'#0d0f10',roughness:1}),pivot);tyre.rotation.z=Math.PI/2;
    const hub=mesh(new THREE.CylinderGeometry(.016,.016,.026,32),black,pivot);hub.rotation.z=Math.PI/2;
    const spin=new THREE.Group();pivot.add(spin);wheels.push(spin);
    for(let k=0;k<6;k++){const spoke=box(.027,.003,.026,new THREE.MeshStandardMaterial({color:'#2a302e',roughness:.6}),0,0,0,spin);spoke.rotation.x=k*Math.PI/6;}
    if(z>0)frontWheels.push(pivot);
  }
  // Body posts and livery markings.
  for(const x of [-.038,.038]){const post=mesh(new THREE.CylinderGeometry(.0025,.0025,.009,12),black);post.position.set(x,.066,.105);}
  const logo=tex((ctx,w,h)=>{ctx.clearRect(0,0,w,h);ctx.font='italic 900 115px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=14;ctx.strokeStyle='#101511';ctx.strokeText('PHAT',w/2,h/2);ctx.lineWidth=8;ctx.strokeStyle='#f4f4ef';ctx.strokeText('PHAT',w/2,h/2);ctx.fillStyle='#121712';ctx.fillText('PHAT',w/2,h/2);},512,180);
  const decal=new THREE.MeshBasicMaterial({map:logo,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  const hood=mesh(new THREE.PlaneGeometry(.075,.027),decal);hood.rotation.x=-Math.PI/2+.15;hood.position.set(0,.065,.091);
  const rearLogo=mesh(new THREE.PlaneGeometry(.075,.025),decal);rearLogo.rotation.x=-Math.PI/2;rearLogo.position.set(0,.115,-.145);
  for(const side of [-1,1]){const sideLogo=mesh(new THREE.PlaneGeometry(.082,.025),decal);sideLogo.rotation.y=side*Math.PI/2;sideLogo.position.set(side*.083,.033,-.004);}
  return {carGroup,shell,frontWheels,wheels};
}
