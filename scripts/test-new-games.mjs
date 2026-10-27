import {strict as assert} from 'node:assert';
export async function runNewGameTests({db,as,scalar,A,B,C}){
 const D='00000000-0000-4000-8000-000000000004';
 await db.exec('RESET ROLE');await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,'d@example.invalid','{\"display_name\":\"Teste D\"}')",[D]);
 const snap=id=>scalar('SELECT public.get_score_game($1)',[id]);
 const create=async(game,variant,players,target=null,league=null)=>{
  await as(A);const id=await scalar("INSERT INTO public.sessions(room_id,organizer_id,title,starts_at,location,max_participants,game_variant,score_target,league_id) SELECT id,$1,'Nova mesa QA',now()+interval '2 days','Local QA',$2,$3,$4,$5 FROM public.rooms WHERE game=$6 RETURNING id",[A,players.length,variant,target,league,game]);
  for(let i=0;i<players.length;i++){await as(players[i]);await db.query('SELECT public.choose_table_seat($1,$2)',[id,i+1]);}
  await as(A);return id;
 };
 const start=async(id,players,teams=players.map((_,i)=>i%2),request=crypto.randomUUID())=>{await db.query('SELECT public.start_score_game($1,$2,$3,$4)',[request,id,players,teams]);return request};
 const cmd=async(id,action,payload={},options={})=>{
  const revision=options.revision??(await snap(id)).match.revision,request=options.request??crypto.randomUUID();
  await db.query('SELECT public.score_game_command($1,$2,$3,$4,$5)',[request,id,revision,action,JSON.stringify(payload)]);return request;
 };
 const finish=id=>cmd(id,'finish');
 const t=await create('truco','gauderio',[A,B]);
 await as(B);await assert.rejects(start(t,[A,B]),/anfitrião/);await as(A);
 const started=await start(t,[A,B]);await start(t,[A,B],[0,1],started);
 await assert.rejects(db.query('SELECT public.choose_table_seat($1,NULL)',[t]),/travada|fixos|início/);
 await assert.rejects(db.query("INSERT INTO public.session_chip_purchases(session_id,user_id,chips_received,amount_brl) VALUES($1,$2,1,1)",[t,A]));
 await as(C);assert.equal((await snap(t)).match,null);
 await as(B);await assert.rejects(cmd(t,'truco_hand',{side:0,points:2},{revision:0}),/anfitrião/);
 await assert.rejects(db.query("UPDATE public.session_score_matches SET revision=10 WHERE session_id=$1",[t]),/permission denied/);
 await as(A);await assert.rejects(cmd(t,'truco_hand',{side:0,points:12}),/incompatível/);
 const req=await cmd(t,'truco_envite',{side:0,kind:'envido'});
 await cmd(t,'truco_envite',{side:0,kind:'envido'},{request:req,revision:0});assert.deepEqual((await snap(t)).match.state.scores,[2,0]);
 await assert.rejects(cmd(t,'truco_envite',{side:1,kind:'flor'},{request:req,revision:0}),/Identificador/);
 await assert.rejects(cmd(t,'truco_envite',{side:0,kind:'envido'}),/já registrado/);
 await assert.rejects(cmd(t,'truco_hand',{side:0,points:1},{revision:0}),/outra tela/);
 await cmd(t,'truco_hand',{side:1,points:2});await cmd(t,'undo');assert.deepEqual((await snap(t)).match.state.scores,[2,0]);
 await cmd(t,'undo');assert.deepEqual((await snap(t)).match.state.scores,[0,0]);
 await assert.rejects(finish(t),/Conclua/);
 await cmd(t,'truco_envite',{side:0,kind:'falta'});assert.equal((await snap(t)).match.status,'complete');
 await finish(t);assert.equal(await scalar('SELECT status FROM public.sessions WHERE id=$1',[t]),'finished');await assert.rejects(cmd(t,'undo'),/imutável/);
 console.log('✓ Truco Gaudério: host authorization, private reads, replay, revision conflicts, envites, undo and immutable finish');
 for(const [variant,values] of [['paulista',[3,9]],['mineiro',[6,6]]]){
  const id=await create('truco',variant,[A,B]);await start(id,[A,B]);
  await assert.rejects(cmd(id,'truco_envite',{side:0,kind:'envido'}),/indisponível/);
  await assert.rejects(db.query("UPDATE public.sessions SET game_variant='gauderio' WHERE id=$1",[id]),/variante/);
  for(const points of values)await cmd(id,'truco_hand',{side:0,points});
  assert.equal((await snap(id)).match.status,'complete');await finish(id);
 }
 const stats=(await db.query("SELECT * FROM public.get_score_ranking('truco')")).rows;
 assert.equal(stats.filter(r=>r.user_id===A).length,3);assert.ok(stats.filter(r=>r.user_id===A).every(r=>Number(r.wins)===1));
 console.log('✓ One Truco room, three independent variants and rankings');
 const c=await create('canastra','canastra',[A,B,C,D],500);
 await assert.rejects(start(c,[A,B,C,D],[0,0,0,1]),/equipes/);await start(c,[A,B,C,D],[0,1,0,1]);
 const closing={winner:0,cards:[180,120],hands:[20,50],clean:[1,0],dirty:[0,1],dead:[0,0]};
 await assert.rejects(cmd(c,'canastra_round',{...closing,clean:[0,0]}),/canastra/);
 await cmd(c,'canastra_round',closing);assert.deepEqual((await snap(c)).match.state.scores,[460,170]);
 await cmd(c,'canastra_round',{...closing,cards:[0,0],hands:[0,0],dirty:[0,0]});assert.deepEqual((await snap(c)).match.winner_ids.sort(),[A,C]);await finish(c);
 for(const variant of ['buraco_aberto','buraco_fechado']){
  const id=await create('canastra',variant,[A,B],100);await start(id,[A,B]);
  const value={winner:0,cards:[0,0],hands:[0,0],clean:[0,0],dirty:[1,0],dead:[0,0]};
  if(variant==='buraco_aberto')await assert.rejects(cmd(id,'canastra_round',value),/canastra/);
  await cmd(id,'canastra_round',{...value,clean:variant==='buraco_aberto'?[1,0]:[0,0]});await finish(id);
 }
 console.log('✓ Canastra/Buraco: balanced teams, atomic closing, clean/dirty requirements and both winning partners');
 const p=await create('pontinho','pontinho',[A,B,C],50);await start(p,[A,B,C]);
 await cmd(p,'pontinho_round',{winner:0,losses:[0,10,50]});assert.deepEqual((await snap(p)).match.state.scores,[50,40,0]);
 await assert.rejects(cmd(p,'pontinho_round',{winner:2,losses:[1,1,0]}),/vencedor/);
 await assert.rejects(cmd(p,'pontinho_round',{winner:0,losses:[0,1,1]}),/eliminado/);
 await cmd(p,'pontinho_round',{winner:0,losses:[0,40,0]});assert.equal((await snap(p)).match.status,'complete');
 await cmd(p,'undo');assert.equal((await snap(p)).match.status,'live');await cmd(p,'pontinho_round',{winner:0,losses:[0,40,0]});await finish(p);
 const u=await create('uno','uno_classico',[A,B,C],100);await start(u,[A,B,C]);
 await assert.rejects(cmd(u,'uno_round',{winner:1,losses:[30,10,80]}),/vencedor/);
 await cmd(u,'uno_round',{winner:1,losses:[30,0,80]});assert.deepEqual((await snap(u)).match.state.scores,[0,110,0]);await finish(u);
 const league=await scalar("SELECT public.create_league('Liga novas mesas','Teste de placares','public','')");
 await db.exec('RESET ROLE');await db.query("INSERT INTO public.league_members(league_id,user_id,role) VALUES($1,$2,'member')",[league,B]);
 const f=await create('pife','pife',[A,B],2,league);await start(f,[A,B]);
 await cmd(f,'pife_round',{winner:0});await assert.rejects(finish(f),/Conclua/);
 await cmd(f,'pife_round',{winner:1});await cmd(f,'pife_round',{winner:0});await finish(f);
 const report=await scalar('SELECT public.finish_league($1)',[league]);assert.equal(report.version,3);assert.equal(report.score_games[0].game,'pife');assert.equal(Number(report.score_games[0].ranking[0].wins),1);
 console.log('✓ Pontinho elimination, UNO winner-only scoring, Pife victories, league archive and preserved financial games');
}
