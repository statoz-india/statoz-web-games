import {adoptGameAudioContext} from '@statoz/game-engine/audio';
import {createGameLoop} from '@statoz/game-engine';
/* Shared lifecycle; original game rules, animation and presentation remain game-owned. */
(() => {
 'use strict';
 const boot=window.__STATOZ_BOOT__||{},sessionId=boot.sessionId||new URLSearchParams(boot.query||location.search).get('session')||'';
 const restart=search=>parent.postMessage({protocolVersion:1,gameId:'vibe-basketball',sessionId,type:'restart',payload:{search}},boot.origin||location.origin);
 const contexts=new Set();
 let disposed=false,ready=false,touch=new URLSearchParams(boot.query||location.search).has('touch')?new URLSearchParams(boot.query||location.search).get('touch')==='1':matchMedia('(any-pointer: coarse)').matches,paused=document.hidden;
 const emit=type=>{if(parent!==window)parent.postMessage({protocolVersion:1,gameId:'vibe-basketball',sessionId,type},boot.origin||location.origin);};
 const disposeCallbacks=new Set();
 const host=window.__VIBE_HOST__={paused,move:null,onDispose:callback=>disposeCallbacks.add(callback),pause:()=>pause(),resume:()=>resume(),ready(){ready=true;emit('ready');if(document.hidden)pause();}};
 document.documentElement.dataset.vibeTouch=String(touch);document.documentElement.dataset.vibeMode=new URLSearchParams(boot.query||location.search).get('mode')||'menu';
 const surface=new ResizeObserver(()=>window.dispatchEvent(new Event('resize')));surface.observe(document.getElementById('app'));
 emit('loading');
 for(const name of ['AudioContext','webkitAudioContext']){
  const Original=window[name];if(!Original)continue;
  window[name]=new Proxy(Original,{construct(Target,args){
   const context=Reflect.construct(Target,args),resume=context.resume.bind(context);
   adoptGameAudioContext('vibe-basketball',context);
   context.resume=()=>host.paused||disposed?Promise.resolve():resume();contexts.add(context);return context;
  }});
 }
 const bar=document.createElement('nav');bar.id='vibe-toolbar';bar.setAttribute('aria-label','Game controls');
 bar.innerHTML='<button data-command="exit" aria-label="Back to basketball"><span class="vibe-back-arrow">←</span><span class="vibe-back-label"> Basketball</span></button><div><button data-command="menu">Modes</button><button data-command="camera" aria-label="Change camera">View</button><button data-command="touch" aria-pressed="'+touch+'">Touch</button><button data-command="pause" aria-label="Pause game"><span class="vibe-pause-icon" aria-hidden="true">Ⅱ</span><span class="vibe-pause-label">Pause</span></button></div>';
 document.body.append(bar);
 const controls=document.createElement('section');controls.id='vibe-touch';controls.setAttribute('aria-label','Touch basketball controls');
 controls.innerHTML='<div id="vibe-joystick" role="group" aria-label="Movement joystick"><span>MOVE</span><i></i></div><div class="vibe-actions"><button data-key="ShiftLeft" class="vibe-extra">Sprint</button><button data-key="ControlLeft" class="vibe-extra vibe-defense">Stance</button><button data-key="KeyK" class="vibe-extra vibe-offense">Spin</button><button data-key="KeyE" class="vibe-extra vibe-defense">Steal</button><button data-skill="true" class="vibe-extra vibe-offense" aria-label="Dribble: tap or swipe for a skill move, swipe and hold for a finish">Dribble</button><button data-key="Space" id="vibe-shoot"><b>SHOOT</b><span>HOLD · RELEASE</span></button></div>';
 document.body.append(controls);
 const panel=document.createElement('div');panel.id='vibe-pause';panel.hidden=!paused;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Game paused');
 panel.innerHTML='<div><h2>Game paused</h2><p>Take your time. Resume when you’re ready.</p><button data-command="resume">Resume game</button><div class="vibe-pause-tools"><button data-command="menu">Modes</button><button data-command="camera">Camera</button><button data-command="touch" aria-pressed="false">Touch controls</button></div><button data-command="graphics">Graphics: Auto</button><small class="vibe-graphics-note">Changing graphics restarts this game.</small><button data-command="rematch">Rematch / restart</button><button data-command="exit">Back to basketball</button></div>';
 document.body.append(panel);
 const graphics=panel.querySelector('[data-command=graphics]'),quality=new URLSearchParams(boot.query||location.search).get('quality')||'auto';graphics.textContent='Graphics: '+quality[0].toUpperCase()+quality.slice(1);
 const guide=document.createElement('p');guide.className='vibe-touch-guide';guide.textContent='TOUCH: Left stick moves. Hold and release SHOOT to time a shot; tap to fake. On defense SHOOT blocks. Hold Sprint or Stance while moving. Tap Dribble for a handle move, or swipe it in a direction. Swipe and hold for a finish. Spin and Steal have their own buttons. In the contest, movement and rack changes are automatic. Pause stops the clock; View changes the camera.';document.querySelector('.how-to-shell')?.append(guide);
 const refs=new Map(),pointers=new Map();let stickPointer=null,clearing=false;
 const key=(code,down)=>window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:code==='Space'?' ':code,bubbles:true,cancelable:true}));
 function hold(code){const n=refs.get(code)||0;refs.set(code,n+1);if(!n)key(code,true);}
 function release(code){const n=refs.get(code)||0;if(n<=1){refs.delete(code);key(code,false);}else refs.set(code,n-1);}
 function clear(){
  // Blur resets the source input without converting a canceled shot/skill into a release action.
  clearing=true;window.dispatchEvent(new Event('blur'));clearing=false;refs.clear();pointers.clear();stickPointer=null;host.move=null;
  document.querySelectorAll('#vibe-touch .held').forEach(node=>node.classList.remove('held'));
  document.querySelector('#vibe-joystick i').style.transform='translate(0,0)';
 }
 function pause(){if(disposed)return;host.paused=true;clear();panel.hidden=false;for(const context of contexts)void context.suspend().catch(()=>{});panel.querySelector('button').focus({preventScroll:true});}
 function resume(){if(document.hidden||disposed)return;clear();host.paused=false;panel.hidden=true;for(const context of contexts)void context.resume().catch(()=>{});document.querySelector('[data-command="pause"]').focus({preventScroll:true});}
 function menu(){clear();const url=new URL(document.baseURI+(boot.query||location.search));url.searchParams.delete('mode');url.searchParams.delete('attract');restart(url.search);}
 function dispose(){surface.disconnect();host.paused=true;disposed=true;clear();for(const context of contexts)void context.close().catch(()=>{});contexts.clear();uiLoop?.dispose();for(const callback of disposeCallbacks)callback();disposeCallbacks.clear();}
 const click=event=>{
  const button=event.target.closest('[data-command]');if(!button)return;
  switch(button.dataset.command){
   case 'exit':pause();emit('exit');break;
   case 'menu':menu();break;
   case 'graphics':{const url=new URL(document.baseURI+(boot.query||location.search)),values=['auto','performance','high'],current=url.searchParams.get('quality')||'auto';url.searchParams.set('quality',values[(values.indexOf(current)+1)%values.length]);url.searchParams.delete('lite');restart(url.search);break;}
   case 'camera':key('KeyC',true);key('KeyC',false);break;
   case 'touch':{touch=!touch;const url=new URL(document.baseURI+(boot.query||location.search));url.searchParams.set('touch',touch?'1':'0');clear();window.dispatchEvent(new Event('resize'));break;}
   case 'pause':pause();break;
   case 'resume':resume();break;
   case 'rematch':clear();restart(boot.query||location.search);break;
  }
 };
 bar.addEventListener('click',click);panel.addEventListener('click',click);
 for(const button of controls.querySelectorAll('[data-key]')){
  button.addEventListener('pointerdown',event=>{
   if(host.paused||disposed||pointers.has(event.pointerId))return;
   event.preventDefault();button.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{button,code:button.dataset.key});button.classList.add('held');hold(button.dataset.key);
  });
  button.addEventListener('pointerup',event=>{
   const entry=pointers.get(event.pointerId);if(!entry)return;
   event.preventDefault();pointers.delete(event.pointerId);release(entry.code);entry.button.classList.remove('held');
  });
  for(const type of ['pointercancel','lostpointercapture'])button.addEventListener(type,event=>{if(pointers.has(event.pointerId))clear();});
 }
 const skill=controls.querySelector('[data-skill]');
 skill.addEventListener('pointerdown',event=>{
  if(host.paused||disposed)return;event.preventDefault();skill.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId,{button:skill,code:null,x:event.clientX,y:event.clientY});skill.classList.add('held');
 });
 skill.addEventListener('pointermove',event=>{
  const entry=pointers.get(event.pointerId);if(!entry||entry.button!==skill||entry.code)return;
  const dx=event.clientX-entry.x,dy=event.clientY-entry.y;if(Math.hypot(dx,dy)<14)return;
  entry.code=Math.abs(dx)>Math.abs(dy)?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp');hold(entry.code);
 });
 skill.addEventListener('pointerup',event=>{
  const entry=pointers.get(event.pointerId);if(!entry||entry.button!==skill)return;event.preventDefault();
  if(!entry.code){entry.code='ArrowUp';hold(entry.code);}release(entry.code);pointers.delete(event.pointerId);skill.classList.remove('held');
 });
 for(const type of ['pointercancel','lostpointercapture'])skill.addEventListener(type,event=>{if(pointers.has(event.pointerId))clear();});
 const stick=document.getElementById('vibe-joystick'),thumb=stick.querySelector('i');let stickKeys=[];
 function move(event){
  if(event.pointerId!==stickPointer)return;
  const rect=stick.getBoundingClientRect(),radius=rect.width*.36;
  let x=(event.clientX-rect.left-rect.width/2)/radius,z=(event.clientY-rect.top-rect.height/2)/radius;
  const length=Math.hypot(x,z);if(length>1){x/=length;z/=length;}if(length<.15){x=0;z=0;}
  host.move={x,z};thumb.style.transform=`translate(${x*radius}px,${z*radius}px)`;
  const next=[...(z<-.2?['KeyW']:z>.2?['KeyS']:[]),...(x<-.2?['KeyA']:x>.2?['KeyD']:[])];
  for(const code of stickKeys)if(!next.includes(code))release(code);
  for(const code of next)if(!stickKeys.includes(code))hold(code);stickKeys=next;
 }
 stick.addEventListener('pointerdown',event=>{if(host.paused||stickPointer!==null)return;event.preventDefault();stickPointer=event.pointerId;stickKeys=[];stick.setPointerCapture(event.pointerId);move(event);});
 stick.addEventListener('pointermove',event=>{if(stickPointer===event.pointerId){event.preventDefault();move(event);}});
 stick.addEventListener('pointerup',event=>{if(event.pointerId!==stickPointer)return;for(const code of stickKeys)release(code);stickKeys=[];stickPointer=null;host.move=null;thumb.style.transform='translate(0,0)';});
 for(const type of ['pointercancel','lostpointercapture'])stick.addEventListener(type,event=>{if(event.pointerId===stickPointer){clear();stickKeys=[];}});
 window.addEventListener('blur',()=>{if(!clearing&&ready&&!host.paused)pause();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
 window.addEventListener('orientationchange',()=>{clear();stickKeys=[];if(ready)pause();});
 window.addEventListener('pagehide',dispose);
 window.addEventListener('message',event=>{
  const message=event.data;if(event.source!==parent||event.origin!==location.origin||!message||message.protocolVersion!==1||message.gameId!=='vibe-basketball'||message.sessionId!==sessionId)return;
  if(message.type==='pause')pause();if(message.type==='dispose')dispose();
 });
 window.addEventListener('keydown',event=>{
  if(event.code==='Escape'&&!host.paused&&!window.__game&&document.getElementById('how-to-play')?.classList.contains('show'))return;
  if(event.code==='Escape'){event.preventDefault();if(host.paused)resume();else pause();}
  if(!host.paused||event.code==='Escape')return;
  if(event.code==='Tab'){
   const items=[...panel.querySelectorAll('button,a')],index=items.indexOf(document.activeElement);
   if(event.shiftKey&&index<=0){event.preventDefault();items.at(-1).focus();}
   if(!event.shiftKey&&index===items.length-1){event.preventDefault();items[0].focus();}
  }
 },true);
 const failure=()=>{emit('error');};window.addEventListener('error',failure,true);window.addEventListener('unhandledrejection',failure);
 document.addEventListener('webglcontextlost',event=>{event.preventDefault();pause();failure();},true);
 const uiMode=new URLSearchParams(boot.query||location.search).get('mode');
 const root=document.documentElement,shootLabel=document.querySelector('#vibe-shoot b'),shootHint=document.querySelector('#vibe-shoot span');
 const touchButtons=[...document.querySelectorAll('[data-command=touch]')],overlays=[...document.querySelectorAll('.ui-overlay')];
 const assign=(name,value)=>{if(root.dataset[name]!==value)root.dataset[name]=value;};
 function ui(){
  if(disposed)return;
  const game=window.__game,role=uiMode==='1v1'&&game?.offenseIdx!==game?.userPlayer?.team?'defense':'offense';
  if(root.dataset.vibeRole&&root.dataset.vibeRole!==role&&pointers.size)clear();assign('vibeRole',role);
  const label=uiMode==='1v1'&&role==='defense'?'BLOCK':'SHOOT',hint=uiMode==='three-point'?'HOLD · RELEASE':role==='defense'?'TAP':'HOLD · TAP FAKE';
  if(shootLabel.textContent!==label)shootLabel.textContent=label;if(shootHint.textContent!==hint)shootHint.textContent=hint;
  for(const button of touchButtons)if(button.getAttribute('aria-pressed')!==String(touch))button.setAttribute('aria-pressed',String(touch));
  assign('vibeTouch',String(touch));assign('vibeMode',uiMode||'menu');
  const hidden=!touch||host.paused||overlays.some(el=>el.classList.contains('show'))||!ready||(uiMode==='1v1'&&game?.state==='over');
  if(controls.hidden!==hidden)controls.hidden=hidden;
 }
 const uiLoop=createGameLoop({id:'vibe-basketball-ui',frame:()=>ui()});
})();
