// Regressões de estabilidade de tela e de formulário no Mesa Marcada.
// Mantém as garantias no código sem exigir login ou dados reais no Supabase.
import {readFileSync} from "node:fs";
import {strict as assert} from "node:assert";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const panel=read("app/painel/mobile-first.tsx");
const hook=read("app/painel/use-stable-dialog.ts");
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

for(const token of [
  'body.style.position="fixed"',
  'body.style.top="-"+scrollY+"px"',
  'body.style.overflow="hidden"',
  'body.style.overscrollBehavior="none"',
  'window.scrollTo({top:currentScreenRef.current===originScreen?scrollY:0,behavior:"auto"})',
  'overlay.style.removeProperty("--mm-dialog-viewport-height")',
  'visual?.addEventListener("resize",syncVisualViewport)',
  'visual?.addEventListener("scroll",syncVisualViewport)',
  'window.addEventListener("keydown",handleDialogKeys)',
  'previouslyFocused?.focus({preventScroll:true})',
  'background.forEach(node=>{node.inert=true})',
  'Object.assign(body.style,originalBody)'
]){
  assert.ok(hook.includes(token),"Missing dialog lock/focus/cleanup behavior: "+token);
}
assert.ok(hook.includes('if(!open)return'),"Lock must not affect the normal page");
assert.ok(hook.includes('currentScreenRef.current===originScreen?scrollY:0'),
  "Navigate-to-event should not return to old dashboard scroll position");

for(const token of [
  "scroll-behavior:auto","overscroll-behavior:none",
  "overscroll-behavior:contain","-webkit-overflow-scrolling:touch",
  "touch-action:pan-y","--mm-dialog-viewport-height",
  "scrollbar-gutter:stable","-webkit-text-size-adjust:100%",
  "font-size:16px","grid-template-columns:minmax(0,1fr)",
  ".mm-modal .mm-form-actions",".mm-modal>header"
]){
  assert.ok(css.includes(token),"Missing stable layout CSS: "+token);
}
assert.ok(!css.includes("html {scroll-behavior:smooth}"),
  "Global smooth scrolling must be disabled");
assert.ok(!/\.mm-overlay\s*\{[^}]*touch-action:none/s.test(css),
  "Disabling touch-action on the overlay blocks inner touch scrolling");
assert.ok(login.includes('className="mm-login-card"'),
  "Login screen must remain intact");
console.log("✓ v1.7.1: body lock, iOS keyboard, modal-only scroll, preserved position, no navigation bounce");
