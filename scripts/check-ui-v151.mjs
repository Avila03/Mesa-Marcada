// Regressão de ícones e da posição do cartão de instalação do Mesa Marcada.
import {readFileSync} from "node:fs";
import {strict as assert} from "node:assert";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const panel=read("app/painel/mobile-first.tsx");
const companion=read("app/painel/mobile-app-companion.tsx");
const styles=read("app/v05-theme.css");
const features=read("app/painel/v09-features.tsx");
const icons=read("app/painel/ui-icon.tsx");
const dashboard=read("app/painel/dashboard-v16.tsx");

for(const section of ["home","calendar","cards","trophy","user","settings","log-out","plus","book-open"]){
  assert.ok(icons.includes(section+":")||icons.includes('"'+section+'":'), "Missing SVG icon "+section);
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
assert.ok(panel.includes('className="nav mm-bottom-nav"'),"Mobile bottom nav missing");
assert.ok(panel.includes('className="nav mm-desktop-nav"'),"Desktop nav must remain");
/* Desktop navigation stays stacked; mobile keeps five permanent destinations. */
const desktopNavCss=styles.match(/\.sidebar \.mm-desktop-nav\{[^}]+\}/)?.[0]||"";
assert.ok(/flex-direction:\s*column/.test(desktopNavCss),
  "Desktop navigation must stack vertically, not overflow sideways");
assert.ok(/align-items:\s*stretch/.test(desktopNavCss),
  "Desktop navigation must stretch menu buttons inside sidebar");
assert.ok(/\.sidebar \.mm-desktop-nav \.mm-nav-btn\{[^}]*width:100%/.test(styles),
  "Desktop buttons must fit the sidebar width");

const mobileNav=panel.slice(
  panel.indexOf("const mobileNavEntries="),
  panel.indexOf("const mobileActivePage")
);
for(const key of ['id==="inicio"','id==="eventos"','id==="ligas"','id==="ranking"','id==="perfil"']){
  assert.ok(mobileNav.includes(key),"Missing mobile tab: "+key);
}
assert.ok(!mobileNav.includes('id==="mesas"')&&!mobileNav.includes('id==="admin"'),
  "Other screens remain accessible via shortcuts, not new permanent tabs");
assert.ok(styles.includes("grid-template-columns:repeat(5,minmax(0,1fr))"),
  "Mobile bottom bar must have five equally sized columns");
assert.ok(styles.includes("safe-area-inset-bottom"),"iPhone bottom safe area missing");
assert.ok(panel.includes("<DashboardV16"),"Action-oriented dashboard missing");
assert.ok(!panel.includes("A próxima rodada<br/>começa aqui"),"Old oversized homepage hero still present");
for(const anchor of [
  "PRÓXIMO EVENTO","Escolher assento","Próximas noites","Meus rachas",
  "Poker","Blackjack","onGame(game)","onAdmin","onProfile"
])assert.ok(dashboard.includes(anchor),"Dashboard action or information missing: "+anchor);
assert.ok(panel.includes("mm-profile-admin-link"),
  "Admin must remain accessible from profile");
assert.ok(panel.includes('const activePage=page==="detalhe"?"eventos"')&&
 panel.includes('page==="liga"||page==="liga-admin"?"ligas":page;'),
 "League subpages must highlight Ligas in navigation");
assert.ok(panel.includes('onLeagues={()=>go("ligas")}'),
 "Homepage must link to Ligas");
assert.ok(dashboard.includes("<LeagueHomePreview"),
 "Minhas Ligas must remain on the Inicio homepage");
assert.ok(panel.includes('onTables={()=>go("mesas")}'),
  "Mesas must remain accessible without a mobile tab");
assert.ok(dashboard.includes("settled.has("),"Debt totals must exclude settled expenses");
console.log("✓ v1.6 UI: Dashboard, 4 mobile tabs, desktop + admin shortcuts, personal debts");
