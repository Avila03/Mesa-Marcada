import {PGlite} from "@electric-sql/pglite";
import {readFileSync,readdirSync} from "node:fs";
import {strict as assert} from "node:assert";
const root=new URL("../",import.meta.url),read=p=>readFileSync(new URL(p,root),"utf8");
const db=new PGlite();
const A="00000000-0000-4000-8000-000000000001",B="00000000-0000-4000-8000-000000000002",C="00000000-0000-4000-8000-000000000003";
const one=async(sql,args=[])=>{const r=await db.query(sql,args);return r.rows[0]};
const scalar=async(sql,args=[])=>Object.values(await one(sql,args))[0];
const as=async(id)=>{await db.exec("RESET ROLE");await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec("SET ROLE authenticated")};
try{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated,anon;
 CREATE FUNCTION extensions.digest(text,text) RETURNS bytea LANGUAGE sql AS $$ SELECT sha256(convert_to($1,'UTF8')) $$;
 CREATE FUNCTION extensions.gen_random_bytes(integer) RETURNS bytea LANGUAGE sql AS $$ SELECT decode(repeat('ab',$1),'hex') $$;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
 CREATE PUBLICATION supabase_realtime;`);
 await db.exec(read("supabase/bootstrap.sql"));
 const files=readdirSync(new URL("supabase/migrations/",root)).filter(x=>x.endsWith(".sql")).sort();
 for(const file of files){
  try{await db.exec(read("supabase/migrations/"+file))}catch(e){throw new Error(file+": "+e.message+" near "+read("supabase/migrations/"+file).slice(Math.max(0,Number(e.position)-80),Number(e.position)+80))}
  if(file.startsWith("20261020213234")){
   await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,'a@example.invalid','{\"display_name\":\"Bruno Avila\"}'),($2,'b@example.invalid','{\"display_name\":\"Teste B\"}'),($3,'c@example.invalid','{\"display_name\":\"Teste C\"}')",[A,B,C]);
   await db.query("INSERT INTO public.app_admins(user_id) VALUES($1)",[A]);
  }
 }
 console.log("✓ Canonical migration history rebuilt in isolated Postgres");
 await db.query("INSERT INTO public.rooms(name,game,created_by) VALUES('Poker','poker',$1),('Blackjack','blackjack',$1)",[A]);
 await as(A);
 const league=await scalar("SELECT public.create_league('Liga QA','Teste isolado','public','')");
 await db.exec("RESET ROLE");await db.query("INSERT INTO public.league_members(league_id,user_id,role) VALUES($1,$2,'member')",[league,B]);
 const event=await scalar("INSERT INTO public.sessions(room_id,organizer_id,title,starts_at,location,min_entry_brl,max_participants,league_id) SELECT id,$1,'Partida QA',now()+interval '1 day','Local QA',20,4,$2 FROM public.rooms WHERE game='poker' RETURNING id",[A,league]);
 await as(A);await db.query("SELECT public.choose_table_seat($1,1)",[event]);
 await as(B);await db.query("SELECT public.choose_table_seat($1,2)",[event]);
 await as(A);await db.query("SELECT public.start_live_event($1)",[event]);
 const req="00000000-0000-4000-8000-000000000010";
 const buy1=await scalar("SELECT public.record_chip_purchase_once($1,$2,'[20,0,0,0,0]',$3)",[req,event,A]);
 const replay=await scalar("SELECT public.record_chip_purchase_once($1,$2,'[20,0,0,0,0]',$3)",[req,event,A]);
 assert.equal(buy1,replay);
 assert.equal(Number(await scalar("SELECT count(*) FROM public.session_chip_purchases WHERE session_id=$1",[event])),1);
 const adminCatalog=await scalar("SELECT public.get_club_catalog()");
 assert.equal(adminCatalog.profiles.length,3,"Admin directory includes players without league membership or attendance");
 assert.equal(Number(adminCatalog.admin_finance.find(x=>x.session_id===event).pending),1);
 assert.equal(Number(adminCatalog.admin_finance.find(x=>x.session_id===event).total_brl),20);
 await assert.rejects(db.query("SELECT public.record_chip_purchase_once($1,$2,'[21,0,0,0,0]',$3)",[req,event,A]),/identificador/);
 await as(B);await db.query("SELECT public.record_chip_purchase_once('00000000-0000-4000-8000-000000000011',$1,'[20,0,0,0,0]',$2)",[event,B]);
 console.log("✓ Purchase replay returns the same receipt; changed payload is rejected");
 const poll=await scalar("SELECT public.create_poll_once('00000000-0000-4000-8000-000000000012',$1,'Comida?',ARRAY['Pizza','Sushi'])",[event]);
 assert.equal(Number(await scalar("SELECT count(*) FROM public.session_poll_options WHERE poll_id=$1",[poll])),2);
 await assert.rejects(db.query("SELECT public.create_poll_once('00000000-0000-4000-8000-000000000013',$1,'Outra?',ARRAY['Pizza','Pizza'])",[event]),/opções/);
 assert.equal(Number(await scalar("SELECT count(*) FROM public.session_polls WHERE session_id=$1",[event])),1);
 const expense=await scalar("SELECT public.create_expense_once('00000000-0000-4000-8000-000000000014',$1,'Pizza',30,'food',$2)",[event,B]);
 assert.equal(await scalar("SELECT public.create_expense_once('00000000-0000-4000-8000-000000000014',$1,'Pizza',30,'food',$2)",[event,B]),expense);
 await as(C);
 await assert.rejects(db.query("SELECT public.create_expense_once('00000000-0000-4000-8000-000000000015',$1,'Pizza',30,'food',$2)",[event,C]),/permissão/);
 const forbidden=await scalar("SELECT public.get_event_snapshot($1)",[event]);assert.equal(forbidden.buys.length,0);
 const outsiderCatalog=await scalar("SELECT public.get_club_catalog()");assert.equal(outsiderCatalog.admin_finance.length,0);
 console.log("✓ Atomic polls, expense replay and non-participant isolation");
 await as(A);
 const present=await scalar("SELECT public.get_event_snapshot($1)",[event]);
 assert.deepEqual(present.attendance.map(x=>x.user_id).sort(),[A,B]);
 assert.deepEqual(present.profiles.map(x=>x.id).sort(),[A,B]);
 assert.equal(present.seats.length,2);
 await db.query("SELECT public.record_chip_cashout($1,$2,30)",[event,A]);await db.query("SELECT public.record_chip_cashout($1,$2,10)",[event,B]);
 await db.query("UPDATE public.sessions SET status='finished' WHERE id=$1",[event]);
 const ranking=(await db.query("SELECT * FROM public.get_player_stats_period_v2('poker','ano')")).rows;
 assert.equal(ranking.length,2);assert.equal(Number(ranking.find(x=>x.user_id===A).net_chips),1000);assert.equal(Number(ranking.find(x=>x.user_id===B).net_chips),-1000);
 const medals=await scalar("SELECT public.get_player_medal_progress($1)",[A]);assert.equal(medals.first,1);assert.equal(medals.veteran,1);
 const frames=await scalar("SELECT public.get_player_frame_progress($1)",[A]);assert.equal(frames.conclave,1);
 const leagueRows=(await db.query("SELECT * FROM public.get_league_ranking_v2($1)",[league])).rows;assert.equal(leagueRows.length,2);
 const final=await scalar("SELECT public.finish_league($1)",[league]);assert.equal(final.score_unit,"brl_cents");assert.equal(final.games.poker.ranking.length,2);
 await db.exec("RESET ROLE");
 // Same timestamp exercises the UUID tie-breaker, not just date pagination.
 await db.query("INSERT INTO public.sessions(room_id,organizer_id,title,starts_at,location,max_participants,status) SELECT r.id,$1,'Histórico QA '||n,now()-interval '2 days','Local QA',4,'finished' FROM public.rooms r CROSS JOIN generate_series(1,51) n WHERE r.game='poker'",[A]);
 await as(A);
 const firstPage=await scalar("SELECT public.get_club_catalog()",[]);
 assert.equal(firstPage.history_more,true);
 const secondPage=await scalar("SELECT public.get_club_catalog($1,$2)",[firstPage.history_cursor.at,firstPage.history_cursor.id]);
 const ids=[...firstPage.events,...secondPage.events].map(e=>e.id);
 assert.equal(new Set(ids).size,52);assert.equal(ids.length,52,"History pages must not repeat tied timestamps");
 console.log("✓ History pagination preserves tied dates without duplicate or missing events");
 const snapshot=await scalar("SELECT public.get_club_catalog()",[]);assert.ok(snapshot.events.length);
 console.log("✓ Reconciled BRL closing → annual ranking → medals → frames → final league archive");
 await (await import("./test-new-games.mjs")).runNewGameTests({db,as,scalar,A,B,C});
}catch(e){console.error(e.message,e.where||"",e.query||"");process.exitCode=1}finally{await db.close()}
