import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const logo=read("app/painel/site-logo.tsx");
const manifest=read("app/manifest.ts");
const layout=read("app/layout.tsx");
const icon=read("app/icon.tsx");
const apple=read("app/apple-icon.tsx");
const renderer=read("lib/brand-icon-image.tsx");
const mark=read("public/icons/monogram.svg");
const pwa192=read("public/icons/mesa-192.svg");
const pwa512=read("public/icons/mesa-512.svg");
const theme=read("app/v05-theme.css");
const duo=read("app/painel/duo-theme.css");

assert.ok(logo.includes('src="/icons/monogram.svg"'),"Header/login must display monogram");
assert.ok(!logo.includes("mesa-marcada-logo.webp"),"No former logo in header");
for(const svg of [mark,pwa192,pwa512]){
 assert.ok(svg.includes("#258BFF"),"Blue accent required");
 assert.ok(svg.includes("#F1F5FB"),"White spade required");
 assert.ok(svg.includes('M104 399V113L244 225V310L177 256V399H104Z'),"Monogram must match mark");
 assert.ok(!svg.includes('rx="90"'),"iPhone provides its own rounded icon mask; no border");
}
assert.ok(!mark.includes("<rect"),"Header monogram should have transparent background");
assert.ok(pwa192.includes('fill="#080A0E"')&&pwa512.includes('fill="#080A0E"'),"Dark icon background required");
assert.ok(layout.includes('apple: [{url:"/apple-icon",type:"image/png",sizes:"180x180"}]'),"iPhone touch icon must be PNG");
assert.ok(layout.includes('icon: [{url:"/icon",type:"image/png",sizes:"512x512"}]'),"Browser icon must be PNG");
assert.ok(manifest.includes('{src:"/icons/mesa-192.svg"'));
assert.ok(manifest.includes('{src:"/icons/mesa-512.svg"'));
assert.ok(manifest.includes('{src:"/icon",sizes:"512x512",type:"image/png"'));
assert.ok(icon.includes("makeBrandIcon(512)")&&apple.includes("makeBrandIcon(180)"),"Raster icon routes missing");
assert.ok(renderer.includes("ImageResponse")&&renderer.includes("background:\"#080A0E\""),"PNG generation unavailable");
assert.ok(theme.includes("box-shadow:none")&&duo.includes("border-radius:0!important"),"Borderless mark CSS missing");
assert.ok(!layout.includes("mesa-marcada-logo.webp"),"Former iPhone icon must be gone");
console.log("✓ Borderless MM monogram in header, login, favicon, iPhone PNG, PWA and metadata.");
