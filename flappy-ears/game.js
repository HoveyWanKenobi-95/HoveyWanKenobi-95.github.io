(()=>{'use strict';
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
const $=s=>document.querySelector(s),overlay=$('#overlay'),heading=$('#heading'),message=$('#message'),play=$('#play');
const scoreEl=$('#score'),carrotEl=$('#runCarrots'),bestEl=$('#best'),totalEl=$('#carrots');
const KEY='hoveybits_flappy_ears_v1';let stored={best:0,carrots:0};try{stored={...stored,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(stored))}catch{}}
let W=480,H=640,dpr=1,state='menu',rabbit,obstacles=[],particles=[],score=0,carrots=0,elapsed=0,spawnTimer=0,scroll=0,last=0,raf=0,soundOn=true,audio=null;
function resize(){const r=canvas.getBoundingClientRect();W=r.width;H=r.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);if(rabbit)rabbit.x=W*.28;}
new ResizeObserver(resize).observe(canvas);
function rand(a,b){return a+Math.random()*(b-a)}
function sound(freq=500,dur=.07,type='sine'){if(!soundOn)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(90,freq*.6),audio.currentTime+dur);g.gain.setValueAtTime(.08,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+dur);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+dur)}catch{}}
function start(){rabbit={x:W*.28,y:H*.5,vy:0,angle:0};obstacles=[];particles=[];score=0;carrots=0;elapsed=0;spawnTimer=0.5;scroll=0;state='playing';scoreEl.textContent='0';carrotEl.textContent='0';overlay.classList.add('hidden');flap();}
function flap(){if(state==='playing'){rabbit.vy=-Math.min(350,H*.56);rabbit.angle=-.38;sound(520,.055)}else if(state==='menu'||state==='over'){start()}else if(state==='paused'){resume()}}
function pause(){if(state!=='playing')return;state='paused';heading.textContent='Taking a breather?';message.textContent='Your rabbit is resting. Resume whenever you’re ready.';play.textContent='Resume';showOverlay()}
function resume(){state='playing';overlay.classList.add('hidden');last=performance.now()}
function showOverlay(){bestEl.textContent=stored.best;totalEl.textContent=stored.carrots;overlay.classList.remove('hidden')}
function end(){if(state!=='playing')return;state='over';stored.best=Math.max(stored.best,score);stored.carrots+=carrots;persist();heading.textContent='Bonked the burrow!';message.textContent=`You made it through ${score} ${score===1?'gap':'gaps'} and grabbed ${carrots} ${carrots===1?'carrot':'carrots'}. Give those ears another try!`;play.textContent='Hop again';showOverlay();sound(190,.25,'triangle');}
function rounded(x,y,w,h,r,fill){if(w<=0||h<=0)return;ctx.beginPath();ctx.roundRect(x,y,w,h,Math.min(r,w/2,h/2));ctx.fillStyle=fill;ctx.fill()}
function oval(x,y,rx,ry,fill,rotation=0){ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();ctx.restore()}
function spawn(){const gap=Math.max(146,Math.min(H*.33,205)),margin=75,center=rand(margin+gap/2,H-margin-gap/2),width=Math.max(54,Math.min(78,W*.15));obstacles.push({x:W+width,center,gap,width,passed:false,carrot:Math.random()<.78,collected:false});}
function update(dt){if(state!=='playing')return;elapsed+=dt;const speed=Math.min(265,Math.max(155,W*.37)+score*3.5),gravity=Math.min(1100,H*1.45);scroll+=speed*dt;spawnTimer-=dt;if(spawnTimer<=0){spawn();spawnTimer=Math.max(1.15,Math.min(1.65,W/(speed*1.75)))}rabbit.vy+=gravity*dt;rabbit.y+=rabbit.vy*dt;rabbit.angle=Math.max(-.43,Math.min(1.05,rabbit.vy/450));const radius=Math.max(13,Math.min(19,W*.037));if(rabbit.y-radius<18||rabbit.y+radius>H-18){end();return}
for(const o of obstacles){o.x-=speed*dt;const top=o.center-o.gap/2,bottom=o.center+o.gap/2;
if(rabbit.x+radius>o.x+5&&rabbit.x-radius<o.x+o.width-5&&(rabbit.y-radius<top||rabbit.y+radius>bottom)){end();return}
if(!o.passed&&o.x+o.width<rabbit.x){o.passed=true;score++;scoreEl.textContent=score;sound(730,.085)}
const cx=o.x+o.width/2,cy=o.center;
if(o.carrot&&!o.collected&&Math.hypot(rabbit.x-cx,rabbit.y-cy)<radius+15){o.collected=true;carrots++;carrotEl.textContent=carrots;sound(980,.12);for(let i=0;i<7;i++)particles.push({x:cx,y:cy,vx:rand(-95,95),vy:rand(-110,45),life:.5})}}
obstacles=obstacles.filter(o=>o.x+o.width>-10);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;p.life-=dt}particles=particles.filter(p=>p.life>0)}
function rockWall(x,y,w,h,top){if(h<=0)return;ctx.fillStyle='#785a42';ctx.fillRect(x,y,w,h);ctx.fillStyle='#967354';ctx.fillRect(x+6,y,w-12,h);const edgeY=top?y+h-17:y;ctx.fillStyle='#513e33';ctx.fillRect(x-5,edgeY,w+10,17);ctx.fillStyle='#bd9365';ctx.fillRect(x-5,top?edgeY:edgeY+13,w+10,4);
ctx.strokeStyle='#5f4838';ctx.lineWidth=2;for(let i=0;i<4;i++){const xx=x+10+(i*.29*w)%Math.max(1,w-16);ctx.beginPath();ctx.moveTo(xx,y+((i*47+scroll*.12)%(Math.max(20,h))));ctx.lineTo(xx+9,y+((i*47+scroll*.12)%(Math.max(20,h)))+9);ctx.stroke()}}
function background(){const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#749d88');g.addColorStop(.5,'#c4d7a7');g.addColorStop(1,'#779d83');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
for(let i=0;i<22;i++){const x=((i*91-scroll*.13)%(W+120)+(W+120))%(W+120)-50,y=(i*97)%(H-40)+20;oval(x,y,18+(i%4)*8,9+(i%3)*6,'#6e9c7a44')}
for(let i=0;i<15;i++){const x=((i*157-scroll*.3)%(W+130)+(W+130))%(W+130)-50,y=(i*137)%(H-30)+15;oval(x,y,3+(i%4),3+(i%3),'#547c6566')}}
function drawCarrot(x,y){ctx.save();ctx.translate(x,y);ctx.rotate(-.35);oval(0,-11,5,9,'#4b9251',-.4);oval(5,-10,4,8,'#67a75a',.5);ctx.beginPath();ctx.moveTo(-11,-4);ctx.lineTo(12,-4);ctx.lineTo(0,20);ctx.closePath();ctx.fillStyle='#f28c3b';ctx.fill();ctx.strokeStyle='#d66b2b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-6,3);ctx.lineTo(4,3);ctx.moveTo(-3,10);ctx.lineTo(3,10);ctx.stroke();ctx.restore()}
function drawRabbit(){if(!rabbit)return;ctx.save();ctx.translate(rabbit.x,rabbit.y);ctx.rotate(rabbit.angle);const s=Math.max(.75,Math.min(1.1,W/430));ctx.scale(s,s);
// ears and feet behind body
oval(-8,-23,8,24,'#f4ede1',-.33);oval(-8,-25,3.5,16,'#efa9ad',-.33);oval(7,-24,8,26,'#f4ede1',.24);oval(7,-26,3.5,17,'#efa9ad',.24);
oval(-15,12,12,7,'#d5c7b7',-.25);oval(12,13,11,7,'#d5c7b7',.2);oval(-16,4,8,9,'#fffaf1');oval(0,1,21,19,'#f5eee2');oval(4,5,13,10,'#fffaf1');oval(0,-8,17,16,'#fffaf1');oval(7,-10,2.8,4,'#25393c');oval(12,-4,3.4,2.5,'#ed8d9a');oval(10,-1,3,2,'#f3b5b8');ctx.restore()}
function render(){ctx.clearRect(0,0,W,H);background();for(const o of obstacles){const top=o.center-o.gap/2,bottom=o.center+o.gap/2;rockWall(o.x,0,o.width,top,true);rockWall(o.x,bottom,o.width,H-bottom,false);if(o.carrot&&!o.collected)drawCarrot(o.x+o.width/2,o.center)}for(const p of particles)oval(p.x,p.y,3,3,`rgba(255,225,120,${Math.min(1,p.life*2)})`);drawRabbit();if(state==='menu'&&!rabbit){rabbit={x:W*.28,y:H*.48,vy:0,angle:-.1};drawRabbit();rabbit=null}}
function loop(t){const dt=Math.min((t-last)/1000||0,.035);last=t;update(dt);render();raf=requestAnimationFrame(loop)}
function action(e){if(e){e.preventDefault()}flap()}
canvas.addEventListener('pointerdown',action);play.addEventListener('click',()=>state==='paused'?resume():start());
document.addEventListener('keydown',e=>{if(['Space','ArrowUp','KeyW'].includes(e.code)){if(e.repeat)return;action(e)}else if(e.code==='KeyP'||e.code==='Escape'){if(state==='playing')pause();else if(state==='paused')resume()}});
$('#sound').addEventListener('click',()=>{soundOn=!soundOn;$('#sound').textContent=soundOn?'♪ On':'♪ Off';$('#sound').setAttribute('aria-pressed',String(soundOn))});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause()});
resize();showOverlay();last=performance.now();raf=requestAnimationFrame(loop);
})();
