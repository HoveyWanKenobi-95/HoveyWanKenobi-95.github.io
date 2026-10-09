'use strict';
// Pocket Mahjong web port. Geometry and rules mirror the Kivy edition.
const FACES=['1B','1C','1D','2B','2C','2D','3B','3C','3D','4B','4C','4D','5B','5C','5D','6B','6C','6D','7B','7C','7D','8B','8C','8D','9B','9C','9D','Au','Bm','Ch','E','G','N','Or','Pl','R','S','Sp','Su','W','Wh','Wi'];
const pos=(x,y,z)=>({x,y,z,id:`${x},${y},${z}`});
function layer(w,h,z,x=0,y=0){return Array.from({length:w*h},(_,i)=>pos(x+2*(i%w),y+2*Math.floor(i/w),z));}
const LAYOUTS={
 'Rectangle':()=>layer(12,8,0),
 'Turtle':()=>[...layer(12,8,0),...layer(10,6,1,2,2),...layer(8,4,2,4,4),...layer(4,2,3,8,6)],
 'Pyramid':()=>[...layer(12,8,0),...layer(10,6,1,2,2),...layer(8,4,2,4,4),...layer(6,2,3,6,6)],
 'Fortress':()=>[...layer(12,8,0),...layer(10,6,1,2,2).filter(p=>p.x===2||p.x===20||p.y===2||p.y===12)],
 'Bridge':()=>[...layer(12,8,0),...layer(8,2,1,4,6)],
 'Four Towers':()=>[...layer(12,8,0),...[ [0,0],[16,0],[0,8],[16,8] ].flatMap(([x,y])=>layer(4,4,1,x,y))],
 'Steps':()=>[...layer(12,8,0),...layer(8,6,1,4,2),...layer(4,4,2,8,4)],
 'Pocket Rectangle':()=>layer(6,8,0),
 'Pocket Turtle':()=>[...layer(6,8,0),...layer(4,6,1,2,2),...layer(2,4,2,4,4)],
 'Pocket Pyramid':()=>[...layer(6,8,0),...layer(4,6,1,2,2),...layer(2,2,2,4,6)],
 'Pocket Bridge':()=>[...layer(6,8,0),...layer(4,2,1,2,6)]
};
const $=id=>document.getElementById(id);
const board=$('board'),storageEl=$('storage');
let layoutName='Pocket Turtle',capacity=4,tiles=new Map(),initial=new Map(),storage=[],history=[],selected=null;
let widgets=new Map(),slotWidgets=[],saveTimer=null;
const key=(p)=>typeof p==='string'?p:p.id;
const parseKey=id=>{const [x,y,z]=id.split(',').map(Number);return pos(x,y,z)};
const geometry=()=>LAYOUTS[layoutName]();
const overlaps=(a,b)=>Math.abs(a.x-b.x)<2&&Math.abs(a.y-b.y)<2;
function isFree(id,active=tiles){if(!active.has(id))return false;const p=parseKey(id);let left=false,right=false;for(const qid of active.keys()){if(qid===id)continue;const q=parseKey(qid);if(q.z>p.z&&overlaps(p,q))return false;if(q.z===p.z&&Math.abs(q.y-p.y)<2){if(q.x===p.x-2)left=true;if(q.x===p.x+2)right=true;}}return !(left&&right);}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function generate(positions){const ids=positions.map(p=>p.id);if(ids.length%2)throw Error('Odd number of tiles');for(let attempt=0;attempt<300;attempt++){const remaining=new Map(ids.map(id=>[id,true]));const pairs=[];while(remaining.size){const free=[...remaining.keys()].filter(id=>isFree(id,remaining));if(free.length<2)break;const a=free.splice(Math.floor(Math.random()*free.length),1)[0];const b=free[Math.floor(Math.random()*free.length)];pairs.push([a,b]);remaining.delete(a);remaining.delete(b);}if(!remaining.size){const faces=shuffle(pairs.map((_,i)=>FACES[i%FACES.length]));const result=new Map();pairs.forEach(([a,b],i)=>{result.set(a,faces[i]);result.set(b,faces[i]);});return result;}}throw Error('Unable to generate solvable board');}
function clone(){return {tiles:[...tiles],storage:[...storage]};}
function snapshot(){history.push(clone());if(history.length>200)history.shift();}
function persist(){try{localStorage.setItem('pocket-mahjong-v1',JSON.stringify({version:1,layoutName,capacity,tiles:[...tiles],initial:[...initial],storage,history}));}catch(e){console.warn('Could not save game',e);}}
function queueSave(){clearTimeout(saveTimer);saveTimer=setTimeout(persist,160);}
function restore(){try{const raw=localStorage.getItem('pocket-mahjong-v1');if(!raw)return false;const s=JSON.parse(raw);if(s.version!==1||!LAYOUTS[s.layoutName]||![0,2,4,8].includes(s.capacity))return false;const valid=new Set(LAYOUTS[s.layoutName]().map(p=>p.id));if(!Array.isArray(s.initial)||s.initial.length!==valid.size||s.initial.some(([id,face])=>!valid.has(id)||!FACES.includes(face)))return false;const original=new Map(s.initial);if(s.tiles.some(([id,face])=>original.get(id)!==face)||s.storage.length>s.capacity||s.storage.some(f=>!FACES.includes(f)))return false;layoutName=s.layoutName;capacity=s.capacity;initial=original;tiles=new Map(s.tiles);storage=s.storage;history=Array.isArray(s.history)?s.history.slice(-200):[];return true;}catch(e){console.warn('Could not load saved game',e);return false;}}
function newGame(){try{tiles=generate(geometry());initial=new Map(tiles);storage=[];selected=null;history=[];render(true);persist();$('winDialog').close();}catch(e){$('status').textContent=e.message;}}
function restart(){tiles=new Map(initial);storage=[];selected=null;history=[];render(true);persist();}
function undo(){if(!history.length)return;const s=history.pop();tiles=new Map(s.tiles);storage=[...s.storage];selected=null;render(true);persist();}
function chooseLayout(name){layoutName=name;newGame();$('layoutDialog').close();}
function updateSelection(){$('store').disabled=!(selected?.kind==='board'&&storage.length<capacity&&isFree(selected.id));for(const [id,el] of widgets){el.classList.toggle('selected',selected?.kind==='board'&&selected.id===id);}slotWidgets.forEach((el,i)=>el?.classList.toggle('selected',selected?.kind==='storage'&&selected.index===i));}
function selectTile(loc,face){if(selected&&((selected.kind==='board'&&loc.kind==='board'&&selected.id===loc.id)||(selected.kind==='storage'&&loc.kind==='storage'&&selected.index===loc.index))){selected=null;updateSelection();queueSave();return;}
 if(selected){const old=selected.kind==='board'?tiles.get(selected.id):storage[selected.index];if(old===face){snapshot();const boardIds=[selected,loc].filter(x=>x.kind==='board').map(x=>x.id);const indexes=[selected,loc].filter(x=>x.kind==='storage').map(x=>x.index).sort((a,b)=>b-a);boardIds.forEach(id=>tiles.delete(id));indexes.forEach(i=>storage.splice(i,1));selected=null;render(false);queueSave();return;}}
 selected=loc;updateSelection();queueSave();}
function selectBoard(id){if(!tiles.has(id)||!isFree(id))return;selectTile({kind:'board',id},tiles.get(id));}
function selectStorage(i){if(i>=storage.length)return;selectTile({kind:'storage',index:i},storage[i]);}
function storeSelected(){if(!selected||selected.kind!=='board'||storage.length>=capacity||!isFree(selected.id))return;snapshot();storage.push(tiles.get(selected.id));tiles.delete(selected.id);selected=null;render(false);queueSave();}
function makeTile(face){const el=document.createElement('button');el.type='button';el.className='tile';el.setAttribute('aria-label',`${face} tile`);const img=document.createElement('img');img.src=`assets/tiles/${face}.png`;img.alt=face;img.draggable=false;el.append(img);return el;}
function boardState(){const free=new Set([...tiles.keys()].filter(id=>isFree(id)));return free;}
function render(force=false){const free=boardState();for(const [id,el] of widgets){if(force||!tiles.has(id)){el.remove();widgets.delete(id);}}
 for(const [id,face] of tiles){let el=widgets.get(id);if(!el){el=makeTile(face);el.dataset.id=id;el.addEventListener('click',()=>selectBoard(id));board.append(el);widgets.set(id,el);}el.classList.toggle('blocked',!free.has(id));}
 // Keep raised layers above lower layers, while retaining native button hit testing.
 for(const [id,el] of widgets){const p=parseKey(id);el.style.zIndex=String(1+p.z*100+p.y);}
 layoutTiles();renderStorage();updateSelection();const total=tiles.size+storage.length;const faces=[...storage,...[...free].map(id=>tiles.get(id))];const hasPair=new Set(faces).size<faces.length;
 $('status').textContent=total===0?`${layoutName} · You win!`:free.size===0&&!hasPair?`${layoutName} · No available moves — Undo or restart`:`${layoutName} · ${total} tiles left · ${free.size} free · Holding ${storage.length}/${capacity}`;
 $('undo').disabled=!history.length;$('store').disabled=!(selected?.kind==='board'&&storage.length<capacity&&free.has(selected.id));$('capacity').value=String(capacity);
 if(total===0&&!$('winDialog').open)$('winDialog').showModal();}
function renderStorage(){storageEl.replaceChildren();slotWidgets=[];for(let i=0;i<capacity;i++){const slot=document.createElement('div');slot.className='slot';if(i<storage.length){const el=makeTile(storage[i]);el.addEventListener('click',()=>selectStorage(i));slot.append(el);slotWidgets.push(el);}else{slot.classList.add('empty');slotWidgets.push(null);}storageEl.append(slot);}}
function layoutTiles(){const g=geometry(),r=board.getBoundingClientRect();if(!g.length||r.width<20||r.height<20)return;const minx=Math.min(...g.map(p=>p.x)),maxx=Math.max(...g.map(p=>p.x+2)),miny=Math.min(...g.map(p=>p.y)),maxy=Math.max(...g.map(p=>p.y+2)),maxz=Math.max(...g.map(p=>p.z));const shift=maxz*4,margin=14;const unitsX=(maxx-minx)/2,unitsY=(maxy-miny)/2;const ratio=336/256;const gap=0.5;const tw=Math.max(3,Math.min((r.width-2*margin-shift)/(unitsX+0.35),(r.height-2*margin-shift)/((unitsY+0.35)*ratio)));const th=tw*ratio;const ox=(r.width-unitsX*tw-shift)/2,oy=(r.height-unitsY*th-shift)/2;for(const [id,el] of widgets){const p=parseKey(id);el.style.width=`${Math.max(2,tw-gap)}px`;el.style.height=`${Math.max(2,th-gap)}px`;el.style.left=`${ox+(p.x-minx)*tw/2+p.z*4}px`;el.style.top=`${oy+(maxy-2-p.y)*th/2-p.z*4}px`;}}
function drawPreviews(){const list=$('layoutList');list.replaceChildren();for(const [name,fn] of Object.entries(LAYOUTS)){const g=fn(),btn=document.createElement('button');btn.className='layout-option'+(name===layoutName?' current':'');const label=document.createElement('strong');label.textContent=name;const meta=document.createElement('small');meta.textContent=`${g.length} tiles · ${Math.max(...g.map(p=>p.z))+1} layers`;const preview=document.createElement('div');preview.className='preview';const minx=Math.min(...g.map(p=>p.x)),maxx=Math.max(...g.map(p=>p.x+2)),miny=Math.min(...g.map(p=>p.y)),maxy=Math.max(...g.map(p=>p.y+2));const unit=Math.min(95/(maxx-minx),55/(maxy-miny));for(const p of g){const cell=document.createElement('span');cell.style.left=`${(p.x-minx)*unit+2+p.z}px`;cell.style.bottom=`${(p.y-miny)*unit+p.z}px`;cell.style.width=`${unit*1.8}px`;cell.style.height=`${unit*1.8}px`;cell.style.zIndex=p.z*100+p.y;preview.append(cell);}btn.append(preview,label,meta);btn.onclick=()=>chooseLayout(name);list.append(btn);}}
$('layouts').onclick=()=>{drawPreviews();$('layoutDialog').showModal()};$('random').onclick=()=>chooseLayout(Object.keys(LAYOUTS)[Math.floor(Math.random()*Object.keys(LAYOUTS).length)]);$('new').onclick=newGame;$('restart').onclick=restart;$('undo').onclick=undo;$('store').onclick=storeSelected;$('about').onclick=()=>$('aboutDialog').showModal();$('playAgain').onclick=newGame;$('capacity').onchange=e=>{capacity=Number(e.target.value);newGame()};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
if(!restore()){layoutName=matchMedia('(orientation: portrait) and (max-width: 650px)').matches?'Pocket Turtle':'Turtle';newGame();}else render(true);
new ResizeObserver(()=>layoutTiles()).observe(board);window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',()=>{if(document.hidden)persist();});
