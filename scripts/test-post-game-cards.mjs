import {strict as assert} from 'node:assert';
export async function runPostGameCardTests({db,as,scalar,A,B,C}){
 await as(A);
 const draw=await scalar("SELECT s.id FROM public.sessions s WHERE game_variant='five_card_draw' AND status='finished' LIMIT 1");
 const card=await scalar('SELECT public.get_post_game_card($1)',[draw]);
 assert.ok(card.awards.some(a=>a.medal_id==='draw_poker'&&a.level_index===0),'First confirmed Draw captures its real milestone');
 assert.equal(card.league,null);assert.equal(card.teams.length,0);
 assert.deepEqual(await scalar('SELECT public.get_post_game_card($1)',[draw]),card,'Repeated read does not mint achievements');
 await assert.rejects(db.query('SELECT * FROM app_private.event_medal_receipts'),/permission denied/);
 await assert.rejects(db.query('SELECT app_private.card_receipt_scores()'),/permission denied/);
 const id=await scalar("SELECT s.id FROM public.sessions s JOIN public.rooms r ON r.id=s.room_id WHERE r.game='canastra' AND s.status='finished' LIMIT 1");
 const pair=await scalar('SELECT public.get_post_game_card($1)',[id]);assert.equal(pair.teams.length,2);assert.ok(pair.teams.every(t=>t.names.length>0&&Number.isInteger(t.score)));assert.equal(pair.teams.filter(t=>t.winner).length,1);
 const individualId=await scalar("SELECT s.id FROM public.sessions s JOIN public.rooms r ON r.id=s.room_id WHERE r.game='pontinho' AND s.status='finished' LIMIT 1");const individual=await scalar('SELECT public.get_post_game_card($1)',[individualId]);assert.ok(individual.lines.some(l=>l.winner));assert.ok(individual.lines.some(l=>l.eliminated));assert.ok(individual.target);
 const leagueId=await scalar('SELECT id FROM public.leagues LIMIT 1');
 const leagueEvent=await scalar("SELECT s.id FROM public.sessions s WHERE s.league_id=$1 AND s.status='finished' AND EXISTS(SELECT 1 FROM public.session_attendance a WHERE a.session_id=s.id) LIMIT 1",[leagueId]);
 const leagueCard=await scalar('SELECT public.get_post_game_card($1)',[leagueEvent]);assert.equal(leagueCard.league.name,'Liga QA');assert.ok(leagueCard.league.emblem);
 await db.exec('RESET ROLE');
 // Receipt rules match the public progress for the admin who can see every fixture.
 const all=await scalar('SELECT app_private.card_receipt_progress($1,NULL)',[A]);const visible=await scalar('SELECT public.get_player_medal_progress($1)',[A]);assert.deepEqual(all,visible);
 const before=await scalar('SELECT app_private.card_receipt_progress($1,$2)',[A,draw]);assert.equal(all.draw_poker-before.draw_poker,1);
 const count=await scalar('SELECT count(*)::integer FROM app_private.event_medal_receipts WHERE session_id=$1',[draw]);
 await as(A);await db.query("UPDATE public.sessions SET status='finished' WHERE id=$1",[draw]);
 await db.exec('RESET ROLE');assert.equal(await scalar('SELECT count(*)::integer FROM app_private.event_medal_receipts WHERE session_id=$1',[draw]),count);
 const old=await scalar("SELECT count(*)::integer FROM app_private.event_medal_receipts r JOIN public.sessions s ON s.id=r.session_id WHERE s.title LIKE 'Histórico QA %'");assert.equal(old,0,'No invented retroactive medal unlocks');
 // A manually granted tier must not be announced as a new unlock later.
 const D=crypto.randomUUID();
 await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,'d@example.invalid','{\"display_name\":\"Convidado QA\"}')",[D]);
 await db.query("INSERT INTO public.player_medal_grants(user_id,medal_id,level_index,granted_by,reason) VALUES($1,'draw_poker',2,$2,'Presente QA')",[D,A]);
 await as(A);const giftEvent=await scalar("INSERT INTO public.sessions(room_id,organizer_id,title,starts_at,location,max_participants,game_variant) SELECT id,$1,'Draw presente QA',now(),'Local QA',4,'five_card_draw' FROM public.rooms WHERE game='poker' RETURNING id",[A]);
 await db.query('SELECT public.choose_table_seat($1,1)',[giftEvent]);await as(D);await db.query('SELECT public.choose_table_seat($1,2)',[giftEvent]);await as(A);await db.query('SELECT public.start_live_event($1)',[giftEvent]);
 await db.query("SELECT public.record_chip_purchase_once($1,$2,'[20,0,0,0,0]',$3)",[crypto.randomUUID(),giftEvent,A]);await as(D);await db.query("SELECT public.record_chip_purchase_once($1,$2,'[20,0,0,0,0]',$3)",[crypto.randomUUID(),giftEvent,D]);
 await as(A);await db.query('SELECT public.record_chip_cashout($1,$2,10)',[giftEvent,A]);await db.query('SELECT public.record_chip_cashout($1,$2,30)',[giftEvent,D]);await db.query("UPDATE public.sessions SET status='finished' WHERE id=$1",[giftEvent]);
 const giftCard=await scalar('SELECT public.get_post_game_card($1)',[giftEvent]);assert.ok(!giftCard.awards.some(a=>a.medal_id==='draw_poker'&&a.player_name==='Convidado QA'));assert.ok(giftCard.awards.some(a=>a.medal_id==='first'&&a.player_name==='Convidado QA'));
 await as(C);await assert.rejects(db.query('SELECT public.get_post_game_card($1)',[draw]),/acesso/);
 await db.exec('RESET ROLE');await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT public.get_post_game_card($1)',[draw]),/permission denied/);await as(A);
 console.log('✓ Post-game cards: real teams and league crests, atomic medal receipts, no replay/history duplicates, progress parity and private-data permissions');
}
