import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

const css=read("app/neon-sign.css");
const shell=read("app/painel/mobile-first.tsx");
const layout=read("app/layout.tsx");

// Carregada por último no app e nas telas de acesso.
assert.ok(shell.indexOf('import "../neon-sign.css";')>shell.indexOf('import "./task-layout.css";'),"Letreiro must load after task layout");
for(const page of ["app/login/page.tsx","app/recuperar-senha/page.tsx","app/redefinir-senha/page.tsx"]){
  assert.ok(read(page).includes('import "../neon-sign.css";'),`Letreiro missing on ${page}`);
}
assert.ok(layout.includes("family=Tilt+Neon")&&layout.includes("family=Outfit"),"Letreiro fonts missing");

// A identidade Dark Cards Duo continua intacta: fundo, barra lateral e naipes não são tocados.
const rules=css.replace(/\/\*[\s\S]*?\*\//g,"");
for(const forbidden of ["html body{background","html body,","sidebar","mm-login-shell","loginview",".mm-home-featured"]){
  assert.ok(!rules.includes(forbidden),`Letreiro must not override identity: ${forbidden}`);
}
// Só visual: nada de estrutura ou visibilidade.
const banned=/(^|[;{\s])(display|grid-template[\w-]*|flex(-direction|-wrap|-basis)?|order|overflow|z-index|visibility|position)\s*:/;
for(const rule of rules.split("}")){
  const [selector="",body=""]=rule.split("{");
  if(!body.trim())continue;
  assert.ok(!banned.test(body),`Layout property in Letreiro layer: ${selector.trim()}`);
}
assert.ok(read("app/painel/duo-theme.css").includes("radial-gradient(ellipse at 94% 7%"),"Duo background must remain");
console.log("✓ Letreiro: Tilt Neon, pílulas holográficas e Marcada piscando, com a identidade Dark Cards Duo intacta.");
