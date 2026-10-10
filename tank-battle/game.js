import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getDatabase, ref, get, set, onValue, update as firebaseUpdate, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';const config=window.HOVEYBITS_FIREBASE_CONFIG;
let db=null,auth=null,mode='menu',room=null,seat=0,unsub=null,shotId=null,commitShot=false,roomState=null;
const show=id=>{for(const k of ['menu','joinPanel','lobby','battle'])$(k).classList.toggle('hidden',k!==id)};
const error=e=>{$('error').textContent=typeof e==='string'?e:(e?.message||String(e));console.error(e)};
const ammo=()=>({bomb:5,power:3,triple:4,five:2});
function firebaseReady(){if(!config?.apiKey||!config?.databaseURL)throw Error('Firebase is not configured. Edit firebase-config.js first. CPU mode works without Firebase.');if(!db){const app=initializeApp(config);db=getDatabase(app);auth=getAuth(app)}return signInAnonymously(auth)}
const roomRef=()=>ref(db,'rooms/'+room);
const code=()=>Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');
function freshState(){makeTerrain();return {terrain:terrain.map(v=>Math.round(v)),tanks:[{x:90,y:height(90)-12,hp:100,angle:45,power:65,ammo:ammo(),color:'#37c891'},{x:910,y:height(910)-12,hp:100,angle:135,power:65,ammo:ammo(),color:'#f36e69'}],turn:0,ended:false}}
const snapshot=()=>({terrain:terrain.map(v=>Math.round(v)),tanks:tanks.map(t=>({...t})),turn,ended});
function loadState(s){terrain=s.terrain.slice();tanks=s.tanks.map(t=>({...t}));turn=s.turn;ended=!!s.ended;projectiles=[];particles=[];busy=false;waiting=0;if(mode==='online'){$('message').textContent=ended?(tanks[seat].hp>0?'🏆 YOU WIN!':'💀 YOU LOSE!'):(turn===seat?'Your turn':'Opponent’s turn');$('angle').value=tanks[seat].angle;$('power').value=tanks[seat].power}setUI()}
function stopRoom(){if(unsub){unsub();unsub=null}room=null;roomState=null;shotId=null;commitShot=false;history.replaceState({},'',location.pathname)}
function enterBattle(){show('battle');$('reset').textContent=mode==='cpu'?'New battlefield':'Rematch';$('name1').textContent=mode==='cpu'?'YOU':seat===0?'YOU':'OPPONENT';$('name2').textContent=mode==='cpu'?'CPU':seat===1?'YOU':'OPPONENT';setUI()}
async function createGame(){try{error('');await firebaseReady();stopRoom();mode='online';seat=0;reset();let id=code(),r=ref(db,'rooms/'+id);let created=await runTransaction(r,v=>v===null?{host:auth.currentUser.uid,guest:'',phase:'waiting',state:snapshot(),updated:Date.now()}:undefined,{applyLocally:false});if(!created.committed)throw Error('Room collision; try again');room=id;listen();show('lobby');$('roomCode').textContent=id;const url=new URL(location.href);url.searchParams.set('room',id);$('inviteLink').value=url.href;history.replaceState({},'',url.href)}catch(e){error(e)}}

async function joinGame(id) {
  try {
    error('');
    id = id.trim().toUpperCase();

    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(id)) {
      throw Error('Enter a valid 6-character room code.');
    }

    await firebaseReady();
    stopRoom();

    mode = 'online';
    room = id;

    const uid = auth.currentUser.uid;
    const roomReference = roomRef();

    console.log('Joining room:', id);
    console.log('Current player UID:', uid);

    // Read the existing room from Firebase
    const snapshot = await get(roomReference);
    const roomData = snapshot.val();

    console.log('Room data:', roomData);

    if (!roomData) {
      throw Error('Room not found.');
    }

    // Allow existing players to reconnect
    if (roomData.host === uid) {
      seat = 0;
    } else if (roomData.guest === uid) {
      seat = 1;
    } else {
      // Only allow joining rooms waiting for a player
      if (roomData.phase !== 'waiting') {
        throw Error('Room is no longer accepting players.');
      }

      if (roomData.guest) {
        throw Error('Room is already full.');
      }

      // Assign the second player
      await firebaseUpdate(roomReference, {
        guest: uid,
        phase: 'playing',
        updated: Date.now()
      });

      seat = 1;
    }

    console.log('Successfully joined room:', id);
    console.log('Player seat:', seat);

    // Start listening for multiplayer updates
    listen();
    enterBattle();

    // Update browser URL with room code
    const url = new URL(location.href);
    url.searchParams.set('room', id);
    history.replaceState({}, '', url.href);

  } catch (e) {
    console.error('Join game failed:', e);
    error(e);
    stopRoom();
    show('joinPanel');
  }
}

function listen() {
  unsub = onValue(roomRef(), snap => {
    const r = snap.val();

    if (!r) {
      error('This room is no longer available.');
      return;
    }

    roomState = r;

    if (r.phase === 'waiting') return;

    if (r.phase === 'playing' || r.phase === 'finished') {
      if (!$('lobby').classList.contains('hidden')) {
        enterBattle();
      }

      if (r.shot && r.shot.id !== shotId) {
        shotId = r.shot.id;
        loadState(r.state);

        turn = r.shot.player;

        const t = tanks[turn];
        t.angle = r.shot.angle;
        t.power = r.shot.power;

        commitShot = r.shot.player === seat;

        shoot(r.shot.weapon, true);
        return;
      }

      if (!r.shot && !busy) {
        loadState(r.state);

        if (r.phase === 'finished') {
          ended = true;
        }

        setUI();
      }
    }
  }, error);
}

async function onlineShoot(w){if(!roomState||roomState.phase!=='playing'||roomState.shot||turn!==seat||busy||ended)return;const t=tanks[seat];const id=crypto.randomUUID();try{const result=await runTransaction(roomRef(),r=>{if(!r||r.phase!=='playing'||r.shot||r.state.turn!==seat||r[seat===0?'host':'guest']!==auth.currentUser.uid)return;let tank=r.state.tanks[seat];if(w!=='regular'){if(tank.ammo[w]<=0)return;tank.ammo[w]--}r.shot={id,player:seat,angle:t.angle,power:t.power,weapon:w};r.updated=Date.now();return r},{applyLocally:false});if(!result.committed)error('That shot could not be submitted. Try again.')}catch(e){error(e)}}
async function finishOnlineShot(){console.log('Finishing shot:', {
  commitShot,
  shotId,
  seat,
  turn,
  busy
});if(!commitShot)return;console.log('Saving completed shot to Firebase');commitShot=false;const currentId=shotId;try{await runTransaction(roomRef(),r=>{if(!r||r.shot?.id!==currentId||r[seat===0?'host':'guest']!==auth.currentUser.uid)return;let s=snapshot();let dead=s.tanks.findIndex(t=>t.hp<=0);s.ended=dead!==-1;s.turn=dead!==-1?turn:1-turn;r.state=s;r.shot=null;r.phase=dead!==-1?'finished':'playing';r.updated=Date.now();return r},{applyLocally:false})}catch(e){error(e)}}
async function rematch(){if(mode==='cpu'){reset();return}if(!roomState||roomState.phase!=='finished')return error('Finish the match before requesting a rematch.');try{await runTransaction(roomRef(),r=>{if(!r||r.phase!=='finished')return;r.rematch=r.rematch||{};r.rematch[seat===0?'host':'guest']=true;if(r.rematch.host&&r.rematch.guest){r.state=freshState();r.phase='playing';r.shot=null;r.rematch=null}return r},{applyLocally:false});$('message').textContent='Rematch requested — waiting for opponent'}catch(e){error(e)}}
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;
const $=id=>document.getElementById(id);const types=[['regular','Regular ∞',Infinity],['bomb','Bomb',5],['power','Power Shot',3],['triple','Triple Shot',4],['five','Five Shot',2]];
let terrain=[],tanks=[],projectiles=[],particles=[],turn=0,busy=false,ended=false,weapon='regular',last=0,waiting=0,turnToken=0;
const rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function height(x){return terrain[clamp(Math.round(x),0,W-1)]}function makeTerrain(){let nodes=Array.from({length:12},(_,i)=>({x:i*W/11,y:rand(275,420)}));terrain=Array.from({length:W},(_,x)=>{let i=Math.min(10,Math.floor(x/(W/11))),a=nodes[i],b=nodes[i+1],t=(x-a.x)/(b.x-a.x);t=t*t*(3-2*t);return clamp(a.y+(b.y-a.y)*t+Math.sin(x*.024)*11,205,H-45)})}
function setUI(){for(let i=0;i<2;i++){let hp=Math.max(0,Math.ceil(tanks[i].hp));$('hp'+(i+1)).textContent=hp;$('bar'+(i+1)).style.width=hp+'%'}$('angleValue').textContent=$('angle').value+'°';$('powerValue').textContent=$('power').value;$('fire').disabled=busy||(mode==='online'?turn!==seat||!!roomState?.shot:turn!==0)||ended;document.querySelectorAll('[data-weapon]').forEach(b=>{let t=tanks[mode==='online'?seat:0],w=b.dataset.weapon;b.textContent=types.find(v=>v[0]===w)[1]+(w==='regular'?'':' ('+t.ammo[w]+')');b.classList.toggle('active',weapon===w);b.disabled=busy||(mode==='online'?turn!==seat||!!roomState?.shot:turn!==0)||ended||t.ammo[w]===0})}
function reset(){turnToken++;makeTerrain();tanks=[{x:90,y:0,hp:100,angle:45,power:65,ammo:{bomb:5,power:3,triple:4,five:2},color:'#37c891'},{x:910,y:0,hp:100,angle:135,power:65,ammo:{bomb:5,power:3,triple:4,five:2},color:'#f36e69'}];tanks.forEach(t=>t.y=height(t.x)-12);projectiles=[];particles=[];turn=0;busy=false;ended=false;waiting=0;weapon='regular';$('angle').value=45;$('power').value=65;$('message').textContent='Your turn';setUI()}
function crater(x,y,r){let lo=Math.max(0,Math.floor(x-r)),hi=Math.min(W-1,Math.ceil(x+r));for(let i=lo;i<=hi;i++){let dx=i-x,depth=Math.sqrt(Math.max(0,r*r-dx*dx));terrain[i]=Math.min(H-3,Math.max(terrain[i],y+depth))}}
function blast(x,y,r,dmg){crater(x,y,r);for(let t of tanks){let dist=Math.hypot(t.x-x,t.y-y);if(dist<r+24)t.hp=Math.max(0,t.hp-Math.round(dmg*Math.max(.2,1-dist/(r+30))))}for(let i=0;i<24;i++){let a=rand(0,Math.PI*2),v=rand(1,5);particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(18,38),color:Math.random()<.5?'#ffce63':'#f57948'})}tanks.forEach(t=>t.y=height(t.x)-12);setUI()}
function launch(t,w){let n=w==='triple'?3:w==='five'?5:1,spread=w==='five'?7:8;for(let i=0;i<n;i++){let a=(t.angle+(i-(n-1)/2)*spread)*Math.PI/180,vel=w==='power'?15:4+t.power*.105;projectiles.push({x:t.x+Math.cos(a)*25,y:t.y-Math.sin(a)*25,vx:Math.cos(a)*vel,vy:-Math.sin(a)*vel,kind:w,owner:turn,life:0})}}
function shoot(w,remote=false){if(busy||ended)return;if(mode==='online'&&!remote){onlineShoot(w);return}let t=tanks[turn];if(w!=='regular'&&mode!=='online'){if(t.ammo[w]<=0)return;t.ammo[w]--}busy=true;waiting=0;launch(t,w);$('message').textContent=turn===0?'Shot fired!':'CPU firing!';setUI()}
function cpuTurn(token){if(token!==turnToken||ended||turn!==1)return;let t=tanks[1],target=tanks[0],choice=Math.random();let w=choice<.19&&t.ammo.bomb?'bomb':choice<.31&&t.ammo.triple?'triple':choice<.4&&t.ammo.power?'power':'regular';let best=null;for(let p=35;p<=100;p+=5)for(let a=98;a<=175;a+=2){let rad=a*Math.PI/180,v=w==='power'?15:4+p*.105,x=t.x+Math.cos(rad)*25,y=t.y-Math.sin(rad)*25,vx=Math.cos(rad)*v,vy=-Math.sin(rad)*v,score=99999;for(let j=0;j<190;j++){x+=vx*.65;y+=vy*.65;if(w!=='power')vy+=.18*.65;if(x<0||x>=W||y>H)break;if(y>=height(x)||Math.hypot(x-target.x,y-target.y)<18){score=Math.hypot(x-target.x,y-target.y);break}}if(!best||score<best.score)best={a,p,score}}t.angle=clamp(best.a+rand(-5,5),98,175);t.power=clamp(best.p+rand(-6,6),35,100);shoot(w)}
function nextTurn(){if(mode==='online'){busy=false;finishOnlineShot();return}if(ended)return;let dead=tanks.findIndex(t=>t.hp<=0);if(dead!==-1){ended=true;busy=false;$('message').textContent=dead===1?'🏆 YOU WIN!':'💀 CPU WINS!';setUI();return}turn=1-turn;busy=false;$('message').textContent=turn===0?'Your turn':'CPU is aiming…';setUI();if(turn===1){let token=turnToken;setTimeout(()=>cpuTurn(token),650)}}
function update(dt){for(let p of projectiles){let steps=Math.max(1,Math.ceil(Math.hypot(p.vx,p.vy)*dt/3));for(let s=0;s<steps;s++){p.x+=p.vx*dt/steps;p.y+=p.vy*dt/steps;if(p.kind!=='power')p.vy+=.18*dt/steps;p.life+=dt/steps;if(p.x<0||p.x>=W||p.y>H+20||p.y< -150){p.dead=true;break}let hit=tanks.find((t,i)=>i!==p.owner&&Math.hypot(p.x-t.x,p.y-t.y)<17);if(hit){blast(p.x,p.y,p.kind==='bomb'?58:p.kind==='power'?32:23,p.kind==='bomb'?48:p.kind==='power'?38:21);p.dead=true;break}if(p.y>=height(p.x)){let r=p.kind==='bomb'?60:p.kind==='power'?36:p.kind==='regular'?12:20;blast(p.x,p.y,r,p.kind==='bomb'?45:p.kind==='power'?34:p.kind==='regular'?9:14);p.dead=true;break}}}projectiles=projectiles.filter(p=>!p.dead);for(let p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=.12*dt;p.life-=dt}particles=particles.filter(p=>p.life>0);if(busy&&!projectiles.length){waiting+=dt;if(waiting>35)nextTurn()}}
function draw(){ctx.clearRect(0,0,W,H);let sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#6db8f4');sky.addColorStop(1,'#d2efff');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);ctx.fillStyle='rgba(255,255,255,.55)';for(let i=0;i<5;i++){let x=80+i*225;ctx.beginPath();ctx.ellipse(x,70+(i%2)*55,57,17,0,0,7);ctx.fill()}ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(0,terrain[0]);for(let x=1;x<W;x++)ctx.lineTo(x,terrain[x]);ctx.lineTo(W,H);ctx.closePath();ctx.fillStyle='#628f53';ctx.fill();ctx.strokeStyle='#a0cf70';ctx.lineWidth=5;ctx.beginPath();for(let x=0;x<W;x++){if(x===0)ctx.moveTo(x,terrain[x]);else ctx.lineTo(x,terrain[x])}ctx.stroke();for(let i=0;i<2;i++){let t=tanks[i];ctx.save();ctx.translate(t.x,t.y);ctx.fillStyle=t.color;ctx.fillRect(-17,-7,34,14);ctx.fillStyle='#263e48';ctx.fillRect(-20,3,40,10);for(let k=-13;k<=13;k+=13){ctx.fillStyle='#9da9ae';ctx.beginPath();ctx.arc(k,8,4,0,7);ctx.fill()}ctx.rotate(-t.angle*Math.PI/180);ctx.fillStyle='#273c49';ctx.fillRect(0,-4,29,8);ctx.restore();ctx.fillStyle='#132a40';ctx.font='bold 14px system-ui';ctx.textAlign='center';ctx.fillText(mode==='cpu'?(i===0?'YOU':'CPU'):(i===seat?'YOU':'RIVAL'),t.x,t.y-37)}if(!busy&&!ended){let t=tanks[mode==='online'?seat:turn],a=t.angle*Math.PI/180,v=4+t.power*.105,x=t.x+Math.cos(a)*25,y=t.y-Math.sin(a)*25,vx=Math.cos(a)*v,vy=-Math.sin(a)*v;ctx.fillStyle='rgba(255,255,255,.7)';for(let i=0;i<55;i++){x+=vx*.85;y+=vy*.85;vy+=.18*.85;if(x<0||x>=W||y>=height(x))break;if(i%3===0){ctx.beginPath();ctx.arc(x,y,2,0,7);ctx.fill()}}}for(let p of projectiles){ctx.fillStyle=p.kind==='power'?'#f7faff':'#ffac42';ctx.beginPath();ctx.arc(p.x,p.y,p.kind==='bomb'?8:5,0,7);ctx.fill()}for(let p of particles){ctx.globalAlpha=clamp(p.life/35,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4)}ctx.globalAlpha=1}
function frame(ts){let dt=Math.min(2.5,(ts-last)/16.67||1);last=ts;update(dt);draw();requestAnimationFrame(frame)}

types.forEach(([id])=>{let b=document.createElement('button');b.dataset.weapon=id;b.onclick=()=>{weapon=id;setUI()};$('weapons').append(b)});
$('angle').oninput=()=>{tanks[mode==='online'?seat:0].angle=+$('angle').value;setUI()};
$('power').oninput=()=>{tanks[mode==='online'?seat:0].power=+$('power').value;setUI()};
$('fire').onclick=()=>shoot(weapon);$('reset').onclick=rematch;
$('exit').onclick=()=>{stopRoom();mode='menu';show('menu')};
$('cpuBtn').onclick=()=>{stopRoom();mode='cpu';seat=0;reset();enterBattle()};
$('createBtn').onclick=createGame;$('joinBtn').onclick=()=>show('joinPanel');
$('joinConfirm').onclick=()=>joinGame($('roomInput').value);
$('leaveLobby').onclick=()=>{stopRoom();mode='menu';show('menu')};
document.querySelectorAll('.back').forEach(b=>b.onclick=()=>show('menu'));
$('copyLink').onclick=()=>navigator.clipboard.writeText($('inviteLink').value).then(()=>{$('copyLink').textContent='Copied!'}).catch(error);
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&mode!=='menu'&&!$('battle').classList.contains('hidden')){e.preventDefault();shoot(weapon)}});
canvas.addEventListener('pointerdown',e=>{if(busy||ended||(mode==='online'?(turn!==seat||roomState?.shot):turn!==0))return;let r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height,t=tanks[mode==='online'?seat:0],dx=x-t.x,dy=t.y-y;t.angle=clamp(Math.round(Math.atan2(dy,dx)*180/Math.PI),0,180);t.power=clamp(Math.round(Math.hypot(dx,dy)/4),15,100);$('angle').value=t.angle;$('power').value=t.power;setUI()});
reset();show('menu');requestAnimationFrame(frame);
const initialRoom=new URLSearchParams(location.search).get('room');if(initialRoom){$('roomInput').value=initialRoom;show('joinPanel')}
