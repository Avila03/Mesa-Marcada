// Regressões de estabilidade de tela e de formulário no Mesa Marcada.
// Mantém as garantias no código sem exigir login ou dados reais no Supabase.
import {readFileSync} from "node:fs";
import {strict as assert} from "node:assert";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const panel=read("app/painel/mobile-first.tsx");
const css=read("app/v05-theme.css");
const login=read("app/login/page.tsx");

const taskCss=read("app/painel/task-layout.css"),wizard=read("app/painel/event-wizard.tsx");
assert.ok(panel.includes('<EventWizard')&&!panel.includes('className="mm-overlay"'),"Event creation must use a dedicated page with native document scrolling");
assert.ok(wizard.includes('mm-wizard-actions')&&wizard.includes('sessionStorage'),"Wizard must preserve drafts across navigation");
assert.ok(taskCss.includes('font-size:16px')&&taskCss.includes('min-height:48px')&&taskCss.includes('safe-area-inset-bottom'),"Wizard needs iPhone-safe inputs and touch targets");
assert.equal((panel.match(/window\.scrollTo\(\{top:0,behavior:"smooth"\}\)/g)||[]).length,0,
  "Page transitions cannot animate the full viewport");
assert.ok((panel.match(/window\.scrollTo\(\{top:0,behavior:"auto"\}\)/g)||[]).length>=3,
  "Main sections must change page without scrolling animation");

for(const token of ["-webkit-text-size-adjust:100%","font-size:16px"]){
  assert.ok(css.includes(token),"Missing stable layout CSS: "+token);
}
assert.ok(!css.includes("html {scroll-behavior:smooth}"),
  "Global smooth scrolling must be disabled");
assert.ok(!panel.includes("useStableDialog")&&!css.includes(".mm-overlay{"),"Modal flows were replaced by task pages; no dialog scroll lock remains");
assert.ok(login.includes('className="mm-login-card"'),
  "Login screen must remain intact");
console.log("✓ Rolagem estável: páginas de tarefa, campos de 16 px, sem animação de rolagem nem trava de diálogo antiga");
