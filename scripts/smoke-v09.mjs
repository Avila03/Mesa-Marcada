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
  await verify("/evento/"+eventId,307,"/painel?evento="+eventId);
  await verify("/evento/invalid",307,"/painel");
  console.log("✓ Smoke HTTP: /, /login, /painel e links /evento/[id]");
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
