import * as THREE from '../vendor/three.module.min.js';

const SCREEN_W = 3.4, SCREEN_Z = 1.23, DEFAULT_H = 2.38;
const mix = (a, b, t) => a + (b - a) * t;

function texture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}
function marqueeArt() {
  return texture(1536, 256, (g, w, h) => {
    g.fillStyle = '#fff2ad'; g.fillRect(0, 0, w, h);
    for (let i = -2; i < 20; i++) {
      g.fillStyle = i % 2 ? '#ffca58' : '#ffdc79';
      g.beginPath(); g.moveTo(i * 110, h); g.lineTo(i * 110 + 170, 0); g.lineTo(i * 110 + 230, 0); g.lineTo(i * 110 + 60, h); g.fill();
    }
    g.strokeStyle = '#ff438e'; g.lineWidth = 12; g.strokeRect(12, 12, w - 24, h - 24);
    g.textAlign = 'center'; g.font = '900 italic 128px Arial';
    g.fillStyle = '#ff438e'; g.fillText("SAIF'S ARCADE", w / 2 + 6, 156);
    g.fillStyle = '#332475'; g.fillText("SAIF'S ARCADE", w / 2, 148);
    g.font = 'bold 24px monospace'; g.fillText('G A M E P L A Y   /   S Y S T E M S   /   M U L T I P L A Y E R', w / 2, 208);
  });
}
function carpetArt() {
  return texture(512, 512, (g, w, h) => {
    g.fillStyle = '#201141'; g.fillRect(0, 0, w, h);
    const colors = ['#ed4da6', '#3ccee0', '#8c60e8', '#ffce6b'];
    for (let i = 0; i < 90; i++) {
      const x = (i * 139 + 41) % w, y = (i * 89 + 53) % h;
      g.save(); g.translate(x, y); g.rotate(i * .72); g.strokeStyle = colors[i % 4]; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-5, 4); g.lineTo(0, -4); g.lineTo(5, 4); g.stroke(); g.restore();
    }
  });
}
function roomArt(label, color) {
  return texture(512, 360, (g, w, h) => {
    g.fillStyle = '#181337'; g.fillRect(0, 0, w, h);
    g.strokeStyle = color; g.lineWidth = 5; g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = color; g.font = 'bold 47px monospace'; g.textAlign = 'center'; g.fillText(label, w / 2, 110);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) if ((c + r) % 3 !== 1) g.fillRect(104 + c * 33, 150 + r * 29, 20, 20);
    g.font = '19px monospace'; g.fillText('INSERT IMAGINATION', w / 2, 309);
  });
}

export function createMachine({ canvas, screen, controls, onContextLost }) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' }); }
  catch { throw new Error('WebGL2 unavailable'); }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x211040, .028);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
  const cabinet = new THREE.Group(); scene.add(cabinet);
  scene.add(new THREE.HemisphereLight(0xe1ddff, 0x382457, 2.7));
  const light = (color, strength, x, y, z) => {
    const l = new THREE.DirectionalLight(color, strength); l.position.set(x, y, z); scene.add(l);
  };
  light(0xffe6da, 3.7, -4, 8, 7); light(0x61e4ff, 2.2, 5, 3, -1); light(0xff53ae, 1.8, -5, 1, -3);
  const mat = (color, metalness = .05) => new THREE.MeshStandardMaterial({ color, roughness: .4, metalness });
  const materials = {
    blue: mat(0x4548d8), violet: mat(0x5431a8), pink: mat(0xff4092), yellow: mat(0xffc852),
    cyan: mat(0x26cbd1), black: mat(0x171329), metal: mat(0xc7d6ee, .72),
  };
  const glowMat = color => new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const box = (w, h, d, material, parent = cabinet, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(boxGeo, material); mesh.scale.set(w, h, d); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const plane = (w, h, material, parent, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };

  // A profiled, bevelled shell gives the cabinet its actual arcade silhouette.
  const profile = [[-.96,-4.4],[.87,-4.4],[1.03,-2.14],[1.73,-1.82],[1.73,-1.35],[1.06,-.97],[1.06,1.26],[1.42,1.54],[1.42,2.17],[-.96,2.17]];
  const sideShape = new THREE.Shape();
  profile.forEach(([z,y],i) => i ? sideShape.lineTo(-z,y) : sideShape.moveTo(-z,y)); sideShape.closePath();
  const sideGeo = new THREE.ExtrudeGeometry(sideShape, { depth: .13, bevelEnabled: true, bevelSize: .055, bevelThickness: .045, bevelSegments: 3, steps: 1 });
  sideGeo.rotateY(Math.PI / 2);
  const originalSide = Float32Array.from(sideGeo.attributes.position.array);
  for (const x of [-2.04,1.91]) { const m = new THREE.Mesh(sideGeo,[materials.cyan,materials.pink]); m.position.x=x; cabinet.add(m); }
  const back = box(3.94,6.55,1.75,materials.blue,cabinet,0,-1.13,-.07);
  const service = new THREE.Group(); cabinet.add(service);
  box(3.1,4.3,.08,materials.violet,service,0,-1.15,-.99);
  for (const y of [.55,.4,.25,.1,-.05]) box(2.3,.06,.04,materials.black,service,0,y,-1.045);
  const rearLabel = plane(1.65,1.16,new THREE.MeshStandardMaterial({map:roomArt('PLAYER 01','#ffe263'),roughness:.7}),service,0,-1.7,-1.045);
  rearLabel.rotation.y = Math.PI;
  box(.15,.15,.05,materials.metal,service,1.25,-1.15,-1.055);
  const bezel = box(3.82,2.64,.27,materials.violet,cabinet,0,0,1.07);
  const rim = box(3.59,2.5,.09,materials.black,cabinet,0,0,1.235);
  const display = plane(SCREEN_W,1,new THREE.MeshBasicMaterial({color:0x15132d}),cabinet,0,0,SCREEN_Z+.06);
  const marquee = new THREE.Group(); cabinet.add(marquee);
  box(4.13,.76,.7,materials.pink,marquee,0,0,1.02);
  const marqueeMap=marqueeArt();
  plane(3.93,.63,new THREE.MeshStandardMaterial({map:marqueeMap,emissiveMap:marqueeMap,emissive:0xffffff,emissiveIntensity:.48,roughness:.55}),marquee,0,0,1.38);
  const deck = new THREE.Group(); cabinet.add(deck);
  box(3.99,1,.17,materials.yellow,deck,0,0,-.04);
  const boardPlane = plane(3.44,1,materials.yellow,deck,0,0,.051);
  const deckLip=box(4.12,.075,.16,materials.pink,deck,0,-.5,.02);
  // Solid controls remain visible at side angles where the HTML cannot be read.
  const solidControls = new THREE.Group(); deck.add(solidControls);
  const capGeo = new THREE.CylinderGeometry(.105,.12,.07,20);
  for (let i=0;i<6;i++) {
    const cap = new THREE.Mesh(capGeo,[materials.pink,materials.cyan,materials.violet,materials.cyan,materials.pink,materials.yellow][i]);
    cap.rotation.x=Math.PI/2;cap.position.set(-.6+i*.38,0,.15);solidControls.add(cap);
  }
  const stick=box(.045,.045,.27,materials.metal,solidControls,-1.2,0,.21);
  const ball=new THREE.Mesh(new THREE.SphereGeometry(.16,20,12),materials.pink);ball.position.set(-1.2,0,.37);solidControls.add(ball);
  const front=box(3.92,2.14,1.78,materials.blue,cabinet,0,-2.94,.04);
  const frontArt=texture(768,384,(g,w,h)=>{
    g.fillStyle='#4548d8';g.fillRect(0,0,w,h);
    for(let i=0;i<3;i++){g.strokeStyle=['#ff468d','#ffc852','#25cfda'][i];g.lineWidth=38;g.beginPath();g.moveTo(-40,260+i*50);g.lineTo(350,70+i*50);g.lineTo(810,230+i*50);g.stroke();}
    g.fillStyle='#211840';g.fillRect(292,68,184,241);g.strokeStyle='#a7a6df';g.lineWidth=3;g.strokeRect(299,75,170,227);
    g.fillStyle='#ffc852';g.font='bold 24px monospace';g.textAlign='center';g.fillText('FREE PLAY',384,120);
    g.fillStyle='#080918';g.fillRect(355,158,58,12);g.fillStyle='#ff438e';g.fillRect(365,197,38,30);
    g.fillStyle='#9b97cc';g.font='16px monospace';g.fillText('PLAYER 01',384,277);
  });
  const lowerFace=plane(3.84,1.91,new THREE.MeshStandardMaterial({map:frontArt,roughness:.55}),cabinet,0,-2.9,.942);
  const plinth=box(4.08,.18,1.97,materials.black,cabinet,0,-4.0,.03);
  const trims=[-1,1].map(sign=>box(.045,2.7,.045,materials.pink,cabinet,sign*1.9,0,1.245));
  const screws=[];
  for(const x of [-1.81,1.81]) for(const sign of [-1,1]){
    const m=new THREE.Mesh(new THREE.SphereGeometry(.027,8,6),materials.metal); m.position.set(x,0,1.28);cabinet.add(m);screws.push({m,sign});
  }
  // Side-panel lightning bolts, made from geometry rather than a downloaded model.
  for(const sign of [-1,1]){
    const bolt=new THREE.Shape();[[-.7,.9],[.1,.2],[-.1,-.05],[.63,-1],[-.44,-.22],[-.18,.03]].forEach(([x,y],i)=>i?bolt.lineTo(x,y):bolt.moveTo(x,y));bolt.closePath();
    const m=new THREE.Mesh(new THREE.ShapeGeometry(bolt),new THREE.MeshBasicMaterial({color:0xffe365,side:THREE.DoubleSide}));m.rotation.y=sign*Math.PI/2;m.position.set(sign*2.1,-.1,0);cabinet.add(m);
  }

  // A small, colourful room: patterned carpet, wall lights and neighbouring games.
  const room=new THREE.Group();scene.add(room);
  const carpet=carpetArt();carpet.wrapS=carpet.wrapT=THREE.RepeatWrapping;carpet.repeat.set(8,8);
  const floor=plane(45,45,new THREE.MeshStandardMaterial({map:carpet,roughness:1}),room,0,-4.14,0);floor.rotation.x=-Math.PI/2;
  plane(34,18,mat(0x382065),room,0,3,-7);
  box(34,.13,.12,glowMat(0x2ae3de),room,0,-2.3,-6.85);
  box(34,.09,.12,glowMat(0xff4fb9),room,0,-2.05,-6.85);
  for(const x of [-8,-4,4,8])box(.065,11,.12,glowMat(x<0?0xff48b3:0x36dfeb),room,x,1.7,-6.85);
  const signArt=texture(1024,256,(g,w,h)=>{
    g.fillStyle='#241439';g.fillRect(0,0,w,h);g.textAlign='center';g.font='bold italic 78px Arial';
    g.shadowColor='#ff50c5';g.shadowBlur=20;g.fillStyle='#ff8cdd';g.fillText('PLAY. CREATE. REPEAT.',w/2,113);
    g.shadowBlur=0;g.font='22px monospace';g.fillStyle='#70e3e2';g.fillText('GOOD GAMES START WITH GOOD IDEAS',w/2,180);
  });
  plane(8.6,2.15,new THREE.MeshBasicMaterial({map:signArt}),room,0,4,-6.8);
  const neighbors=[];
  for(const [x,rot,color,label] of [[-5.2,.17,0xec509e,'PIXEL CLUB'],[5.2,-.17,0x6955e8,'HIGH SCORE']]){
    const game=new THREE.Group();game.position.set(x,-1.27,-3.1);game.rotation.y=rot;room.add(game);
    neighbors.push(game);
    box(2.5,5.5,1.5,mat(color),game);box(2.3,2.0,.2,materials.black,game,0,.65,.83);
    plane(1.95,1.45,new THREE.MeshBasicMaterial({map:roomArt(label,color===0xec509e?'#ffe263':'#5de5dc')}),game,0,.65,.94);
    box(2.6,.35,1.0,materials.cyan,game,0,-.65,.8);box(2.5,.55,.3,materials.yellow,game,0,2.18,.8);
    box(1,.8,.08,materials.black,game,0,-1.8,.8);
  }
  const shadowMap=texture(128,128,(g,w,h)=>{const r=g.createRadialGradient(w/2,h/2,5,w/2,h/2,w/2);r.addColorStop(0,'#08051bf0');r.addColorStop(1,'#08051b00');g.fillStyle=r;g.fillRect(0,0,w,h);});
  const shadow=plane(7,5,new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}),room,0,-4.12,.6);shadow.rotation.x=-Math.PI/2;

  const motion=matchMedia('(prefers-reduced-motion: reduce)'),coarse=matchMedia('(pointer: coarse)');
  let width=0,height=0,focused=false,progress=0,screenH=DEFAULT_H,targetH=DEFAULT_H;
  let uiW=640,uiH=448,wantedW=0,wantedH=0,boardH=132,boardWorldH=.86,screenTop=90;
  let raf=0,disposed=false,last=0,quality=1,slowFrames=0;
  let yaw=-.29,targetYaw=-.29,drag=null,suppressClickUntil=0;
  const pointer=new THREE.Vector2(),corners=Array.from({length:4},()=>new THREE.Vector3());
  function resize(){
    document.body.dataset.camera='moving';
    const nextWidth=innerWidth,nextHeight=innerHeight;
    // Text remains native-resolution HTML; only the decorative WebGL buffer is capped.
    const ratio=Math.min(devicePixelRatio||1,quality*(coarse.matches?1.25:1.5),Math.sqrt(2600000/(nextWidth*nextHeight)));
    if(width!==nextWidth||height!==nextHeight||renderer.getPixelRatio()!==ratio){
      renderer.setPixelRatio(ratio);renderer.setSize(nextWidth,nextHeight,false);
    }
    width=nextWidth;height=nextHeight;camera.aspect=width/height;camera.updateProjectionMatrix();
    const short=height<500;
    wantedW=Math.min(width-(width<700?40:100),1040);
    boardH=wantedW<600?148:116;
    if(short)boardH=86;
    screenTop=short?48:84;
    wantedH=Math.max(150,height-screenTop-boardH-(short?38:60));
    targetH=SCREEN_W*wantedH/wantedW;
    uiW=focused?wantedW:640;uiH=focused?wantedH:640*DEFAULT_H/SCREEN_W;
    screen.style.width=uiW+'px';screen.style.height=uiH+'px';
    controls.style.width=uiW+'px';controls.style.height=(focused?boardH:146)+'px';
    requestFrame();
  }
  function warpY(y,h){const delta=h-DEFAULT_H;return y>DEFAULT_H/2?y+delta/2:y<-DEFAULT_H/2?y-delta/2:y*h/DEFAULT_H;}
  function layout(h,ease){
    const p=sideGeo.attributes.position;
    for(let i=0;i<p.count;i++)p.setY(i,warpY(originalSide[i*3+1],h));p.needsUpdate=true;
    sideGeo.computeBoundingSphere();
    back.scale.y=6.55+h-DEFAULT_H;
    service.position.y=-(h-DEFAULT_H)/2;
    bezel.scale.y=h+.34;rim.scale.y=h+.12;display.scale.y=h;
    marquee.position.y=h/2+.57;
    const desiredBoardH=boardH*SCREEN_W/wantedW/Math.cos(.24);
    boardWorldH=mix(.86,desiredBoardH,ease);
    deck.rotation.x=-.24;
    deck.position.set(0,-h/2-mix(.18,12*SCREEN_W/wantedW,ease)-boardWorldH*Math.cos(.24)/2,SCREEN_Z+.09);
    deck.children[0].scale.y=boardWorldH+.07;boardPlane.scale.y=boardWorldH;deckLip.position.y=-boardWorldH/2-.025;
    const bottom=deck.position.y-boardWorldH/2;
    front.position.y=bottom-1.09;lowerFace.position.y=bottom-1.06;plinth.position.y=bottom-2.19;
    floor.position.y=plinth.position.y-.1;shadow.position.y=floor.position.y+.02;
    neighbors.forEach(game=>game.position.y=floor.position.y+2.75);
    trims.forEach(m=>m.scale.y=h+.32);screws.forEach(({m,sign})=>m.position.y=sign*(h/2+.115));
  }
  function projectElement(element,w,h,z,matrix,cssW,cssH){
    const signs=[[-1,1],[1,1],[1,-1],[-1,-1]];
    for(let i=0;i<4;i++){
      corners[i].set(signs[i][0]*w/2,signs[i][1]*h/2,z).applyMatrix4(matrix).project(camera);
      corners[i].x=(corners[i].x+1)*width/2;corners[i].y=(1-corners[i].y)*height/2;
    }
    const [a,b,c,d]=corners,dx1=b.x-c.x,dx2=d.x-c.x,dx3=a.x-b.x+c.x-d.x,dy1=b.y-c.y,dy2=d.y-c.y,dy3=a.y-b.y+c.y-d.y;
    const den=dx1*dy2-dx2*dy1,g=(dx3*dy2-dx2*dy3)/den,hp=(dx1*dy3-dx3*dy1)/den;
    element.style.transform=`matrix3d(${(b.x-a.x+g*b.x)/cssW},${(b.y-a.y+g*b.y)/cssW},0,${g/cssW},${(d.x-a.x+hp*d.x)/cssH},${(d.y-a.y+hp*d.y)/cssH},0,${hp/cssH},0,0,1,0,${a.x},${a.y},0,1)`;
  }
  function requestFrame(){if(!raf&&!disposed&&!document.hidden)raf=requestAnimationFrame(frame);}
  function frame(now){
    raf=0;if(disposed||document.hidden)return;
    const elapsed=last?now-last:16;
    if(last&&coarse.matches&&!motion.matches&&elapsed<32){requestFrame();return;}
    const dt=Math.min(elapsed/1000,.05);last=now;
    progress=motion.matches?Number(focused):mix(progress,Number(focused),1-Math.exp(-dt*8));
    if(Math.abs(progress-Number(focused))<.0005)progress=Number(focused);
    document.body.dataset.camera = progress === Number(focused) ? (focused ? 'focused' : 'overview') : 'moving';
    const ease=progress*progress*(3-2*progress);screenH=mix(DEFAULT_H,targetH,ease);layout(screenH,ease);
    const tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    const usableH=Math.max(160,height-190);
    const overviewDistance=Math.max(6.85*height/(2*tangent*usableH),5.25*height/(2*tangent*(width-44)))+1.3;
    const focusDistance=SCREEN_W*height/(2*tangent*wantedW)+SCREEN_Z+.065;
    const focusY=(screenTop+wantedH/2-height/2)*SCREEN_W/wantedW;
    camera.position.set(mix(.25,0,ease),mix(.35,focusY,ease),mix(overviewDistance,focusDistance,ease));
    camera.lookAt(0,mix(-.85,focusY,ease),0);
    yaw=motion.matches||drag?targetYaw:mix(yaw,targetYaw,1-Math.exp(-dt*12));
    if(Math.abs(yaw-targetYaw)<.0005)yaw=targetYaw;
    cabinet.rotation.y=mix(yaw+(motion.matches||drag?0:pointer.x*.023),0,ease);
    cabinet.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const frontVisible = Math.cos(cabinet.rotation.y)>.3;
    document.body.classList.toggle('cabinet-back-facing',!frontVisible);
    screen.inert=controls.inert=!frontVisible;
    solidControls.visible=!frontVisible;
    if(frontVisible){
      projectElement(screen,SCREEN_W,screenH,SCREEN_Z+.065,cabinet.matrixWorld,uiW,uiH);
      projectElement(controls,SCREEN_W,boardWorldH,.061,deck.matrixWorld,uiW,focused?boardH:146);
    }
    document.body.dataset.rotation=String(Math.round(THREE.MathUtils.radToDeg(cabinet.rotation.y)));
    document.body.dataset.renderedViewport = `${width}x${height}`;
    const before=performance.now();
    try { renderer.render(scene,camera); } catch { onContextLost(); return; }
    slowFrames=performance.now()-before>40?slowFrames+1:Math.max(0,slowFrames-1);
    if(slowFrames>=8&&quality===1){quality=.75;resize();}
    if(progress!==Number(focused)||yaw!==targetYaw)requestFrame();
  }
  function down(event){
    if(focused||event.button!==0||!event.isPrimary||event.target.closest('.room-bar,.rotation-tools,#machine-controls,a,button:not(#start-button)'))return;
    suppressClickUntil=0;drag={id:event.pointerId,x:event.clientX,y:event.clientY,angle:targetYaw,moved:false,target:event.target};
  }
  function move(event){
    if(drag&&event.pointerId===drag.id){
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(!drag.moved&&Math.hypot(dx,dy)>6){
        drag.moved=true;drag.target.setPointerCapture?.(event.pointerId);document.body.classList.add('is-dragging');
      }
      if(drag.moved){targetYaw=drag.angle+dx/Math.min(width,900)*Math.PI*2;pointer.set(0,0);requestFrame();}
      return;
    }
    if(event.pointerType!=='mouse'||focused||motion.matches)return;
    pointer.set(event.clientX/width*2-1,event.clientY/height*2-1);requestFrame();
  }
  function up(event){
    if(!drag||event.pointerId!==drag.id)return;
    if(drag.moved)suppressClickUntil=performance.now()+400;
    if(drag.target.hasPointerCapture?.(event.pointerId))drag.target.releasePointerCapture(event.pointerId);
    drag=null;document.body.classList.remove('is-dragging');requestFrame();
  }
  function click(event){if(performance.now()<suppressClickUntil&&event.target.closest('#machine-screen,#rotation-surface')){event.preventDefault();event.stopImmediatePropagation();}}
  function visibility(){cancelAnimationFrame(raf);raf=0;if(!document.hidden){last=0;requestFrame();}}
  function contextLost(event){event.preventDefault();onContextLost();}
  addEventListener('resize',resize,{passive:true});addEventListener('pointermove',move,{passive:true});
  addEventListener('pointerdown',down);addEventListener('pointerup',up);addEventListener('pointercancel',up);addEventListener('click',click,true);
  document.addEventListener('visibilitychange',visibility);canvas.addEventListener('webglcontextlost',contextLost);
  motion.addEventListener('change',requestFrame);coarse.addEventListener('change',resize);
  resize();
  return {
    setFocused(value){
      if(focused===value)return;focused=value;
      yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));targetYaw=value?0:-.29;pointer.set(0,0);resize();
    },
    rotate(direction){if(focused)return;targetYaw+=direction*Math.PI/4;pointer.set(0,0);requestFrame();},
    resetView(){yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));targetYaw=-.29;pointer.set(0,0);requestFrame();},
    setSelection(){},
    dispose(){
      if(disposed)return;disposed=true;cancelAnimationFrame(raf);
      removeEventListener('resize',resize);removeEventListener('pointermove',move);
      removeEventListener('pointerdown',down);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);removeEventListener('click',click,true);
      document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('webglcontextlost',contextLost);
      motion.removeEventListener('change',requestFrame);coarse.removeEventListener('change',resize);
      const resources=new Set();scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){resources.add(m);for(const value of Object.values(m))if(value?.isTexture)resources.add(value);}});
      resources.forEach(r=>r.dispose());renderer.dispose();
    },
  };
}
