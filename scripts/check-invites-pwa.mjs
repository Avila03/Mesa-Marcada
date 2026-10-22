import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import qrcode from "../lib/vendor/qrcode.mjs";
const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const token="a".repeat(64);
const qr=qrcode(0,"M");qr.addData("https://mesa-marcada.vercel.app/convite/"+token);qr.make();
assert.ok(qr.getModuleCount()>21&&qr.getModuleCount()<=177);
assert.ok(qr.createDataURL(4,5).startsWith("data:image/gif;base64,"));

const privacy=read("supabase/migrations/20261022080000_private_event_invites.sql");
const protection=read("supabase/migrations/20261022082000_push_server_auth.sql");
const pushes=read("supabase/migrations/20261022081000_web_push_subscriptions.sql");
for(const frag of [
 "visibility IN ('public','private')","ALTER TABLE public.event_invite_members ENABLE ROW LEVEL SECURITY",
 "app_private.may_view_event","CREATE POLICY sessions_select_authorized",
 "CREATE POLICY attendance_insert_authorized","OR NOT app_private.may_view_event(p_event_id)",
 "CREATE OR REPLACE FUNCTION public.claim_event_invite",
 "CREATE OR REPLACE FUNCTION public.create_event_invite",
 "extensions.digest","extensions.gen_random_bytes"
].filter(x=>x!=="CREATE OR REPLACE FUNCTION public.claim_event_invite"))
 assert.ok(privacy.includes(frag),"Private invite security requirement missing: "+frag);
assert.ok(privacy.includes("public.claim_event_invite"),"Claim API absent");
assert.ok(!privacy.includes("DISABLE ROW LEVEL SECURITY"));
assert.ok(!pushes.includes("DISABLE ROW LEVEL SECURITY"));
assert.ok(pushes.includes("push_subscriptions_self_insert"));
assert.ok(protection.includes("DROP FUNCTION IF EXISTS public.claim_event_push_targets(uuid,text)"));
assert.ok(protection.includes("p_server_secret"),"Push endpoints require server secret");
const api=read("app/api/push/notify/route.ts");
assert.ok(api.includes("claim_event_push_targets"));
assert.ok(api.includes("PUSH_SERVER_SECRET"));
assert.ok(api.includes("auth.getUser(token)"));
assert.ok(!api.includes("SERVICE_ROLE_KEY"));
const sw=read("public/sw.js");
for(const v of ["self.addEventListener(\"push\"","self.addEventListener(\"notificationclick\"",
 "showNotification","/offline.html","event.request"])
 assert.ok(sw.includes(v),"Service worker missing: "+v);
const manifest=read("app/manifest.ts");
assert.ok(manifest.includes('display:"standalone"'));
assert.ok(manifest.includes('url:"/eventos"'));
const settings=read("app/painel/mobile-app-companion.tsx");
assert.ok(settings.includes("pushManager.subscribe"));
assert.ok(settings.includes("push_subscriptions"));
assert.ok(settings.includes("pushManager.getSubscription"));
console.log("✓ Convites privados, QR local, autorização RLS, PWA e Web Push seguros");
