import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

const css=read("app/neon-deck.css");
const shell=read("app/painel/mobile-first.tsx");
const layout=read("app/layout.tsx");

// A camada é carregada por último no app e nas telas de acesso.
assert.ok(shell.indexOf('import "../neon-deck.css";')>shell.indexOf('import "./task-layout.css";'),"Neon deck must load after task layout");
for(const page of ["app/login/page.tsx","app/recuperar-senha/page.tsx","app/redefinir-senha/page.tsx"]){
  assert.ok(read(page).includes('import "../neon-deck.css";'),`Neon deck missing on ${page}`);
}
assert.ok(layout.includes("family=Barlow+Condensed")&&layout.includes("family=JetBrains+Mono"),"Deck fonts missing");

// Só visual: nenhuma regra mexe em estrutura ou visibilidade de conteúdo.
const banned=/(^|[;{\s])(display|grid-template[\w-]*|flex(-direction|-wrap|-basis)?|order|overflow|z-index|visibility)\s*:/;
for(const rule of css.replace(/\/\*[\s\S]*?\*\//g,"").split("}")){
  const [selector="",body=""]=rule.split("{");
  if(!body.trim())continue;
  if(/span\[aria-hidden="true"\]/.test(selector))continue; // seta decorativa do botão de login
  assert.ok(!banned.test(body),`Layout property in visual layer: ${selector.trim()}`);
}
// Fundo chapado, sem degradês nem brilho colorido.
assert.ok(!/gradient\(/.test(css),"Neon deck must not add gradients");
assert.ok(css.includes("html body,html .mm-login-shell,html .loginview{background:var(--deck-bg)!important}"),"Flat background missing");
console.log("✓ Baralho neon: camada só de visual, carregada por último, sem degradês e sem mudanças de layout.");
