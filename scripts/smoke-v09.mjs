// Mesa Marcada v0.9 — testes HTTP da aplicação compilada, sem autenticação real.
import {spawn} from "node:child_process";
import {setTimeout as sleep} from "node:timers/promises";
import {strict as assert} from "node:assert";

const port=3123;
const base="http://127.0.0.1:"+port;
const cli=process.platform==="win32"?"npm.cmd":"npm";
const server=spawn(cli,["run","start","--","-p",String(port)],{stdio:["ignore","pipe","pipe"],detached:process.platform!=="win32"});
let logs="";
server.stdout.on("data",chunk=>{logs+=String(chunk).slice(0,2000)});
server.stderr.on("data",chunk=>{logs+=String(chunk).slice(0,2000)});

async function request(path){
  return fetch(base+path,{redirect:"manual",signal:AbortSignal.timeout(6000)});
}
async function verify(path,expectedStatus,includesLocation){
  const response=await request(path);
  assert.equal(response.status,expectedStatus,path+" returned "+response.status);
  if(includesLocation){
    const loc=response.headers.get("location")||"";
    assert.ok(loc.includes(includesLocation),path+" unexpected redirect "+loc);
  }
  return response;
}

let passed=false;
try{
  let ready=false;
  for(let attempt=0;attempt<35;attempt++){
    if(server.exitCode!==null)throw new Error("Server exited early:\n"+logs);
    try{const response=await request("/login");if(response.status===200){ready=true;break;}}
    catch{/* Starting */}
    await sleep(650);
  }
  assert.ok(ready,"Server did not start:\n"+logs);
  await verify("/",307,"/painel");
  await verify("/login",200);
  await verify("/painel",200);
  const eventId="00000000-0000-4000-8000-000000000001";
  await verify("/evento/"+eventId,307,"/eventos/"+eventId);
  await verify("/evento/invalid",307,"/eventos");
  for(const path of [
    "/eventos","/eventos/"+eventId,"/eventos/"+eventId+"/ao-vivo",
    "/eventos/"+eventId+"/resumo","/mesas","/mesas/poker","/mesas/blackjack",
    "/ranking","/perfil","/administracao"
  ])await verify(path,200);
  for(const path of ["/ligas","/ligas/"+eventId,"/ligas/"+eventId+"/gerenciar",
    "/ligas/convite/"+"a".repeat(64)])await verify(path,200);
  const manifest=await verify("/manifest.webmanifest",200);
  const manifestJson=await manifest.json();
  assert.equal(manifestJson.name,"Mesa Marcada");
  assert.equal(manifestJson.start_url,"/painel");
  assert.equal(manifestJson.display,"standalone");
  assert.ok(manifestJson.icons.some(x=>x.sizes==="192x192"),"Missing 192 icon");
  assert.ok(manifestJson.icons.some(x=>x.sizes==="512x512"),"Missing 512 icon");
  await verify("/icons/mesa-192.svg",200);
  await verify("/icons/mesa-512.svg",200);
  await verify("/convite/"+"a".repeat(64),200);
  const pushKey=await verify("/api/push/key",200);
  assert.ok(Object.prototype.hasOwnProperty.call(await pushKey.json(),"key"));
  const unauthorizedPush=await fetch(base+"/api/push/notify",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({eventId,kind:"event"})
  });
  assert.equal(unauthorizedPush.status,401,"Push API must reject unauthenticated delivery");

  const unauthenticatedLeaguePush=await fetch(base+"/api/push/league-request",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({leagueId:eventId})
  });
  assert.equal(unauthenticatedLeaguePush.status,401,"League push must reject unauthenticated senders");
  const serviceWorker=await verify("/sw.js",200);
  const serviceWorkerText=await serviceWorker.text();
  assert.ok(serviceWorkerText.includes('event.request')&&serviceWorkerText.includes("/offline.html"));
  assert.ok(!serviceWorkerText.includes('caches.put(req'),'SW must never cache user requests');
  const offline=await verify("/offline.html",200);
  assert.ok((await offline.text()).includes("Você está sem internet"));
  console.log("✓ PWA HTTP: manifest, service worker e offline sem cache financeiro");
  console.log("✓ Smoke HTTP: rotas próprias, navegação de evento e links antigos");
  passed=true;
}finally{
  // npm spawns Next.js as a child. Terminate the process group so CI cannot
  // hang with an orphaned Next server holding the inherited stdout pipe open.
  try{
    if(process.platform!=="win32"&&server.pid)process.kill(-server.pid,"SIGKILL");
    else server.kill("SIGKILL");
  }catch{server.kill("SIGKILL");}
  server.stdout.destroy();
  server.stderr.destroy();
  if(!passed)console.error(logs.slice(-4500));
}
