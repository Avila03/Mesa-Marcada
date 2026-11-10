import assert from 'node:assert/strict';
// Lista de espera (v7.6): fila ordenada, promoção automática na cadeira livre,
// aviso único, fila travada após o início e permissões.
export async function runWaitlistTests({db,as,scalar,A,B,C}){
 const W1=crypto.randomUUID(),W2=crypto.randomUUID(),W3=crypto.randomUUID();
 const SECRET='s'.repeat(48);
 await db.exec('RESET ROLE');
 await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,'w1@example.invalid','{\"display_name\":\"Fila Um\"}'),($2,'w2@example.invalid','{\"display_name\":\"Fila Dois\"}'),($3,'w3@example.invalid','{\"display_name\":\"Fila Tres\"}')",[W1,W2,W3]);
 await db.query("INSERT INTO app_private.push_server_auth(secret_hash) VALUES(encode(sha256(convert_to($1,'UTF8')),'hex')) ON CONFLICT DO NOTHING",[SECRET]);
 await db.query("INSERT INTO public.push_subscriptions(user_id,endpoint,p256dh,auth_key) VALUES($1,'https://push.example.invalid/w1','p','a')",[W1]);
 const create=async(game,max)=>{await as(A);return scalar("INSERT INTO public.sessions(room_id,organizer_id,title,starts_at,location,max_participants) SELECT id,$1,'Fila QA',now()+interval '1 day','Local QA',$2 FROM public.rooms WHERE game=$3 RETURNING id",[A,max,game])};
 const seats=async id=>{await db.exec('RESET ROLE');const r=(await db.query('SELECT user_id,seat_no FROM public.session_table_seats WHERE session_id=$1 ORDER BY seat_no',[id])).rows;return Object.fromEntries(r.map(x=>[x.user_id,x.seat_no]))};
 const queue=async id=>{await db.exec('RESET ROLE');return (await db.query('SELECT user_id FROM public.session_waitlist WHERE session_id=$1 ORDER BY joined_at,user_id',[id])).rows.map(x=>x.user_id)};

 const ev=await create('poker',2);
 await as(A);await db.query('SELECT public.choose_table_seat($1,1)',[ev]);
 await as(W1);await assert.rejects(db.query('SELECT public.join_event_waitlist($1)',[ev]),/cadeira livre/);
 await as(B);await db.query('SELECT public.choose_table_seat($1,2)',[ev]);
 await as(B);await assert.rejects(db.query('SELECT public.join_event_waitlist($1)',[ev]),/já está confirmado/);
 await as(W1);assert.equal(await scalar('SELECT public.join_event_waitlist($1)',[ev]),1);
 assert.equal(await scalar('SELECT public.join_event_waitlist($1)',[ev]),1,'Joining twice keeps the original place');
 await as(W2);assert.equal(await scalar('SELECT public.join_event_waitlist($1)',[ev]),2);
 await as(W3);assert.equal(await scalar('SELECT public.join_event_waitlist($1)',[ev]),3);
 await assert.rejects(db.query("INSERT INTO public.session_waitlist(session_id,user_id) VALUES($1,$2)",[ev,C]),/permission denied/);
 await as(C);assert.equal(await scalar('SELECT count(*)::integer FROM public.session_waitlist WHERE session_id=$1',[ev]),3,'Anyone who sees the event sees the queue');
 await as(W3);assert.equal(await scalar('SELECT public.leave_event_waitlist($1)',[ev]),true);
 assert.deepEqual(await queue(ev),[W1,W2]);

 // B sai: W1 assume a cadeira 2, recebe aviso na central e entra na fila de push.
 await as(B);await db.query('SELECT public.choose_table_seat($1,NULL)',[ev]);
 let s=await seats(ev);assert.equal(s[W1],2);assert.equal(s[B],undefined);
 assert.deepEqual(await queue(ev),[W2]);
 await as(W1);assert.equal(await scalar("SELECT count(*)::integer FROM public.event_change_notices WHERE event_id=$1 AND recipient_id=$2 AND 'vaga da lista de espera'=ANY(changed_fields)",[ev,W1]),1);
 // Quem não enxerga o evento ou não tem o segredo não recebe alvos.
 await as(W2);await assert.rejects(db.query('SELECT * FROM public.claim_waitlist_push_targets($1,$2)',[ev,'x'.repeat(48)]),/não autorizada/);
 let targets=(await db.query('SELECT * FROM public.claim_waitlist_push_targets($1,$2)',[ev,SECRET])).rows;
 assert.equal(targets.length,1);assert.equal(targets[0].endpoint,'https://push.example.invalid/w1');
 targets=(await db.query('SELECT * FROM public.claim_waitlist_push_targets($1,$2)',[ev,SECRET])).rows;
 assert.equal(targets.length,0,'Promotion push is delivered once');
 await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub','',false)");await db.exec('SET ROLE anon');
 await assert.rejects(db.query('SELECT * FROM public.claim_waitlist_push_targets($1,$2)',[ev,SECRET]),/não disponível/);
 assert.equal((await db.query('SELECT * FROM public.claim_waitlist_push_targets(NULL,$1)',[SECRET])).rows.length,0);
 await db.exec('RESET ROLE');

 // Anfitrião aumenta a mesa: W2 é chamado para a nova cadeira 3.
 await db.query('UPDATE public.sessions SET max_participants=3 WHERE id=$1',[ev]);
 s=await seats(ev);assert.equal(s[W2],3);assert.deepEqual(await queue(ev),[]);

 // Mesa cheia de novo: W3 entra na fila; trocar de cadeira não mexe na fila.
 await as(W3);assert.equal(await scalar('SELECT public.join_event_waitlist($1)',[ev]),1);
 await as(W2);await assert.rejects(db.query('SELECT public.choose_table_seat($1,2)',[ev]),/ocupada/);
 assert.deepEqual(await queue(ev),[W3]);

 // Depois do início a fila para de andar e não aceita novos nomes.
 await as(A);await db.query('SELECT public.start_live_event($1)',[ev]);
 await as(C);await assert.rejects(db.query('SELECT public.join_event_waitlist($1)',[ev]),/já começou/);
 await db.exec('RESET ROLE');await db.query('DELETE FROM public.session_table_seats WHERE session_id=$1 AND user_id=$2',[ev,W1]);
 await db.query('DELETE FROM public.session_attendance WHERE session_id=$1 AND user_id=$2',[ev,W1]);
 assert.deepEqual(await queue(ev),[W3],'Queue is frozen once the match is live');

 // Blackjack: quem vem da fila não assume o crupiê enquanto houver outra cadeira.
 const bj=await create('blackjack',3);
 await as(A);await db.query('SELECT public.choose_table_seat($1,0)',[bj]);
 await as(B);await db.query('SELECT public.choose_table_seat($1,1)',[bj]);
 await as(C);await db.query('SELECT public.choose_table_seat($1,2)',[bj]);
 await as(W1);await db.query('SELECT public.join_event_waitlist($1)',[bj]);
 await as(W2);await db.query('SELECT public.join_event_waitlist($1)',[bj]);
 await as(A);await db.query('SELECT public.choose_table_seat($1,NULL)',[bj]);
 s=await seats(bj);assert.equal(s[W1],0,'Croupier chair is handed over only when it is the last free seat');
 await db.exec('RESET ROLE');await db.query('UPDATE public.sessions SET max_participants=4 WHERE id=$1',[bj]);
 s=await seats(bj);assert.equal(s[W2],3);
 // Evento cancelado não promove ninguém.
 await as(W3);await db.query('SELECT public.join_event_waitlist($1)',[bj]);
 await db.exec('RESET ROLE');await db.query("UPDATE public.sessions SET status='cancelled' WHERE id=$1",[bj]);
 await db.query('DELETE FROM public.session_attendance WHERE session_id=$1 AND user_id=$2',[bj,B]);
 assert.equal((await seats(bj))[W3],undefined);
 console.log('✓ Lista de espera: ordem, promoção na cadeira livre, mesa maior, aviso único, fila travada no início e crupiê preservado');
}
