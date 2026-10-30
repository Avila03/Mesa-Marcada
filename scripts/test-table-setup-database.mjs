import assert from 'node:assert/strict';
export async function runTableSetupTests({db,as,scalar,A,B,C}){
 const D='00000000-0000-4000-8000-000000000004',E=crypto.randomUUID();
 await db.exec('RESET ROLE');await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,'outsider@example.invalid','{\"display_name\":\"Visitante QA\"}')",[E]);
 const create=async(game,players)=>{
  await as(A);const id=await scalar("INSERT INTO public.sessions(room_id,organizer_id,title,starts_at,location,max_participants) SELECT id,$1,'Organização QA',now(),'Local QA',$2 FROM public.rooms WHERE game=$3 RETURNING id",[A,players.length,game]);
  for(let i=0;i<players.length;i++){await as(players[i]);await db.query('SELECT public.choose_table_seat($1,$2)',[id,game==='blackjack'?i:i+1])}await as(A);return id;
 };
 const snap=id=>scalar('SELECT public.get_table_order($1)',[id]);
 const cmd=(id,revision,action,dealer=null,starter=null,direction=1,request=crypto.randomUUID())=>db.query('SELECT public.table_order_command($1,$2,$3,$4,$5,$6,$7)',[request,id,revision,action,dealer,starter,direction]);
 const t=await create('truco',[A,B,C,D]);
 assert.equal((await snap(t)).locked,true);await assert.rejects(cmd(t,0,'configure',A,B),/ao vivo/);
 await db.query('SELECT public.start_score_game($1,$2,$3,$4)',[crypto.randomUUID(),t,[A,B,C,D],[0,1,0,1]]);
 await as(B);await assert.rejects(cmd(t,0,'configure',A,B),/anfitrião/);await as(E);await assert.rejects(snap(t),/acesso/);await as(A);
 await assert.rejects(cmd(t,0,'configure',E,B),/responsáveis/);await assert.rejects(cmd(t,0,'configure',A,E),/responsáveis/);await assert.rejects(cmd(t,0,'configure',A,B,0),/responsáveis/);
 const token=crypto.randomUUID();await cmd(t,0,'configure',A,B,1,token);await cmd(t,0,'configure',A,B,1,token);let state=await snap(t);assert.equal(state.order.revision,1);assert.equal(state.order.distribution,1);
 await assert.rejects(cmd(t,0,'configure',A,C,1,token),/Identificador/);await assert.rejects(cmd(t,0,'configure',A,B),/outro aparelho/);
 const advance=crypto.randomUUID();await cmd(t,1,'advance',null,null,1,advance);await cmd(t,1,'advance',null,null,1,advance);state=await snap(t);assert.equal(state.order.dealer_id,B);assert.equal(state.order.starter_id,C);assert.equal(state.order.revision,2);
 await cmd(t,2,'configure',A,B,-1);await cmd(t,3,'advance');state=await snap(t);assert.equal(state.order.dealer_id,D);assert.equal(state.order.starter_id,A);assert.equal(state.order.distribution,3);
 await as(B);assert.equal((await snap(t)).order.revision,4);await assert.rejects(db.query('UPDATE public.session_table_order SET revision=99 WHERE session_id=$1',[t]),/permission denied/);
 await as(E);assert.equal(await scalar('SELECT count(*)::integer FROM public.session_table_order WHERE session_id=$1',[t]),0);await as(A);
 // A complete score cannot advance even before the host publishes the finish.
 const score=await scalar('SELECT public.get_score_game($1)',[t]);await db.query('SELECT public.score_game_command($1,$2,$3,$4,$5)',[crypto.randomUUID(),t,score.match.revision,'truco_envite',JSON.stringify({side:0,kind:'falta'})]);assert.equal((await snap(t)).locked,true);await assert.rejects(cmd(t,4,'advance'),/resultado final/);
 const bj=await create('blackjack',[A,B,C]);await db.query('SELECT public.start_live_event($1)',[bj]);assert.equal((await snap(bj)).fixed_dealer_id,A);
 await assert.rejects(cmd(bj,0,'configure',B,C),/responsáveis/);await assert.rejects(cmd(bj,0,'configure',A,A),/responsáveis/);
 await cmd(bj,0,'configure',A,B);await cmd(bj,1,'advance');state=await snap(bj);assert.equal(state.order.dealer_id,A);assert.equal(state.order.starter_id,C);await cmd(bj,2,'advance');assert.equal((await snap(bj)).order.starter_id,B);
 // Pontinho skips eliminated seats while preserving the circular seat order.
 const p=await create('pontinho',[A,B,C]);await db.query('SELECT public.start_score_game($1,$2,$3,$4)',[crypto.randomUUID(),p,[A,B,C],[0,1,2]]);await cmd(p,0,'configure',A,B);
 await db.query('SELECT public.score_game_command($1,$2,0,$3,$4)',[crypto.randomUUID(),p,'pontinho_round',JSON.stringify({winner:0,losses:[0,100,0]})]);assert.ok(!(await snap(p)).eligible_players.includes(B));await cmd(p,1,'advance');state=await snap(p);assert.equal(state.order.dealer_id,C);assert.equal(state.order.starter_id,A);
 await db.query("UPDATE public.sessions SET status='cancelled' WHERE id=$1",[p]);assert.equal((await snap(p)).locked,true);await assert.rejects(cmd(p,2,'advance'),/ao vivo/);
 await db.exec('RESET ROLE');await db.exec('SET ROLE anon');await assert.rejects(snap(t),/permission denied/);await as(A);
 console.log('✓ Table order: host-only writes, private reads, request replay, stale revisions, both directions, fixed Blackjack croupier, eliminated-player skips and locked finishes');
}
