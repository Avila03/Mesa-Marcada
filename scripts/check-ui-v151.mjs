// Regressão de ícones e da posição do cartão de instalação do Mesa Marcada.
import {readFileSync} from "node:fs";
import {strict as assert} from "node:assert";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const panel=read("app/painel/mobile-first.tsx");
const companion=read("app/painel/mobile-app-companion.tsx");
const styles=read("app/v05-theme.css");
const features=read("app/painel/v09-features.tsx");
const icons=read("app/painel/ui-icon.tsx");

for(const section of ["home","calendar","cards","trophy","user","settings","log-out","plus","book-open"]){
  assert.ok(icons.includes(section+":"), "Missing SVG icon "+section);
}
for(const text of [panel,companion,features]){
  assert.ok(!/[▦▤▣↪]/.test(text),"Legacy symbols that display inconsistently remain");
}
assert.ok(panel.includes('<UiIcon name={icon} size={22}/>'),"Navigation does not use SVG icons");
assert.equal((panel.match(/name="log-out"/g)||[]).length,2,"Desktop and mobile logout need icons");
const card=panel.indexOf('<MobileAppCompanion onUpdate={reload} visible={page==="inicio"}/>');
assert.ok(card>panel.indexOf('{page==="inicio"&&'),'Install settings render too high in dashboard');
assert.ok(card<panel.indexOf("<footer"),"Install settings must precede the footer");
assert.ok(companion.includes("appInstalled?\"Avisos de eventos\""),"Installed PWA tutorial not compact");
assert.ok(styles.includes("safe-area-inset-top"),"iOS PWA status bar safe area missing");
assert.ok(panel.includes('getTime()>=Date.now()'),"Old events shown as upcoming");
console.log("✓ UI check: SVG navigation, logoff, tutorial below dashboard, iOS safe area, upcoming events");
