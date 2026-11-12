// node src/games/open-golf/scripts/build-open-golf.mjs  →  public/games/open-golf/index.html
//                                     + src/games/open-golf/components/credits.ts
import fs from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "src/games/open-golf/bundle");
const read = (file) => fs.readFile(path.join(root, file), "utf8");

/** Host bridge: localStorage shim (saves go to the parent page) + postMessage protocol v1. */
const prelude = String.raw`<script>(() => {
 const boot = window.__STATOZ_BOOT__ || {}, gameId = document.documentElement.dataset.game, sessionId = boot.sessionId || crypto.randomUUID();
 let disposed = false, stores = boot.stores && typeof boot.stores === "object" ? { ...boot.stores } : {}, resultIds = Array.isArray(boot.resultIds) ? boot.resultIds : [];
 const emit = (type, payload = {}) => { if (disposed) return; const message = { protocolVersion: 1, gameId, sessionId, type, payload }; if (parent !== window) parent.postMessage(message, boot.origin || location.origin); };
 const save = () => emit("save", { schemaVersion: 1, stores, resultIds });
 const storage = {
  getItem: key => Object.hasOwn(stores, key) ? stores[key] : null,
  setItem(key, value) { const next = { ...stores, [key]: String(value) }; if (JSON.stringify(next).length > 524288) throw new DOMException("Save limit exceeded", "QuotaExceededError"); stores = next; save(); },
  removeItem(key) { delete stores[key]; save(); },
  clear() { stores = {}; save(); },
  key: index => Object.keys(stores)[index] ?? null,
  get length() { return Object.keys(stores).length; },
 };
 Object.defineProperty(window, "localStorage", { value: storage, configurable: false });
 const api = { emit, save, sessionId, presentation: boot.presentation, command: null };
 window.__STATOZ_HOST__ = api;
 const apply = command => { if (command === "dispose") { api.command?.("dispose"); disposed = true; } else api.command?.(command); };
 addEventListener("message", event => {
  if (event.source !== parent || parent === window || event.origin !== boot.origin) return;
  const m = event.data;
  if (!m || m.protocolVersion !== 1 || m.gameId !== gameId || m.sessionId !== sessionId || !["pause", "resume", "dispose"].includes(m.type)) return;
  apply(m.type);
 });
 addEventListener("visibilitychange", () => { if (document.hidden) apply("pause"); });
 addEventListener("error", () => emit("error", { message: "The game could not continue." }));
})();</script>`;

/** Engine start-up: pausable rAF, storage.json ↔ localStorage, host commands, deferred engine start. */
const configuration = `
let paused=false,disposed=false,started=false;const waiting=new Map(),raf=requestAnimationFrame.bind(window),caf=cancelAnimationFrame.bind(window);
window.requestAnimationFrame=callback=>{let id;id=raf(time=>{if(disposed)return;if(paused)waiting.set(id,callback);else callback(time);});return id;};
window.cancelAnimationFrame=id=>{waiting.delete(id);caf(id);};
const shell=()=>window.OpenGolfShell;
const decode=text=>{const binary=atob(text),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;};
var Module={canvas:document.getElementById('canvas'),preRun:[()=>{
  const mount=FS.mount.bind(FS);
  FS.mount=(type,options,target)=>mount(target==='/opengolf_persistent_data'?MEMFS:type,options,target);
  FS.syncfs=(populate,callback)=>{if(typeof populate==='function'){callback=populate;populate=false;}try{
    const file='/opengolf_persistent_data/storage.json';
    if(populate){const saved=localStorage.getItem('open-golf.storage');if(saved)FS.writeFile(file,saved);}
    else{try{localStorage.setItem('open-golf.storage',FS.readFile(file,{encoding:'utf8'}));}catch(e){if(e.errno!==44)throw e;}}
    callback(null);
  }catch(error){callback(error);}};
}],onRuntimeInitialized:()=>{window.__STATOZ_HOST__.emit('ready');shell()?.ready(Module);},onAbort:()=>{shell()?.fail();window.__STATOZ_HOST__.emit('error',{message:'Open Golf could not start.'});}};
window.__STATOZ_HOST__.command=command=>{if(command==='pause'){paused=true;Module._saudio_context?.suspend();shell()?.hostPause(true);}else if(command==='resume'){paused=false;for(const callback of waiting.values())raf(callback);waiting.clear();Module._saudio_context?.resume();shell()?.hostPause(false);}else if(command==='dispose'){disposed=true;waiting.clear();Module._saudio_context?.close();}};
document.getElementById('resume').onclick=()=>window.__STATOZ_HOST__.command('resume');
// Paint the splash first: decoding and compiling the engine blocks the page for a moment.
const startEngine=()=>{if(started||disposed)return;started=true;Module.wasmBinary=decode(document.getElementById('og-wasm').textContent);const engine=document.createElement('script');engine.textContent=document.getElementById('og-runtime').textContent;document.body.append(engine);};
const scheduleEngine=()=>raf(()=>setTimeout(startEngine,0));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleEngine,{once:true});else scheduleEngine();
`;

const runtime = await read("engine/golf-mobile.js");
const wasm = (
  await fs.readFile(path.join(root, "engine/golf-mobile.wasm"))
).toString("base64");
const notices = await read("THIRD-PARTY-NOTICES.txt");
const font = (
  await fs.readFile(path.join(root, "fonts/rubik-latin-wght-normal.woff2"))
).toString("base64");
const css = (await read("shell/css/golf-shell.css")).replace(
  "__RUBIK_WOFF2__",
  "data:font/woff2;base64," + font,
);
const markup = await read("shell/golf-shell.html");
const shell = await read("shell/golf-shell.js");
const escape = (s) => s.replaceAll("</script", "<\\/script");

const html = `<!doctype html><html lang="en" data-game="open-golf"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Open Golf</title><style>html,body{margin:0;background:#04190f;width:100%;height:100%;overflow:hidden}canvas{position:absolute;width:100%;height:100%;display:block;touch-action:none}</style><style>${css}</style></head><body><canvas id="canvas" oncontextmenu="event.preventDefault()"></canvas>${markup}<script type="application/json" id="open-golf-credits">${escape(JSON.stringify(notices))}</script><script type="application/octet-stream" id="og-wasm">${wasm}</script><script type="text/plain" id="og-runtime">${escape(runtime)}</script>${prelude}<script>${escape(shell)}</script><script>${escape(configuration)}</script></body></html>`;

await fs.mkdir("public/games/open-golf", { recursive: true });
await fs.writeFile("public/games/open-golf/index.html", html);
console.log(`open-golf: ${(Buffer.byteLength(html) / 1048576).toFixed(1)} MiB`);

// The lobby shows the same notices the bundle carries.
await fs.writeFile(
  "src/games/open-golf/components/credits.ts",
  `// Generated by src/games/open-golf/scripts/build-open-golf.mjs from bundle/THIRD-PARTY-NOTICES.txt.\nexport const OPEN_GOLF_CREDITS = ${JSON.stringify(notices)};\n`,
);
console.log("open-golf: credits.ts updated");
