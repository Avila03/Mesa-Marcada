import {GAME_META,VARIANT_NAMES,isChipGame} from '@/lib/games';
import {cardDimensions,cardText,type CardFormat,type PostGameCard} from '@/lib/post-game-card';
import {MEDALS} from './medal-catalog';

const BLUE='#258BFF',RED='#FF424D',WHITE='#F1F5FB',MUTED='#9CB3CF';
/** A single deterministic renderer: the preview, saved PNG and shared file are identical. */
export async function makePostGameImage(data:PostGameCard,format:CardFormat='compact',crestSvg?:string):Promise<Blob>{
 const canvas=document.createElement('canvas'),size=cardDimensions(format);canvas.width=size.width;canvas.height=size.height;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Este navegador não conseguiu preparar a imagem.');
 // Inter is the site's font. Await already-requested fonts before measuring names.
 await document.fonts?.ready;
 const c=ctx,H=size.height,story=format==='story',A=data.game==='blackjack'||data.game==='pife'?RED:BLUE;
 const fonts='Inter, Arial, sans-serif',text=cardText(data),chip=isChipGame(data.game),paired=(data.teams?.length||0)===2;
 function font(px:number,weight=700){c.font=`${weight} ${px}px ${fonts}`}
 function write(s:string,x:number,y:number,px:number,color=WHITE,align:CanvasTextAlign='left',weight=700){font(px,weight);c.fillStyle=color;c.textAlign=align;c.fillText(s,x,y)}
 function fit(s:string,x:number,y:number,maxWidth:number,px:number,color=WHITE,align:CanvasTextAlign='left',min=18){font(px);while(c.measureText(s).width>maxWidth&&px>min)font(--px);let out=s;while(c.measureText(out).width>maxWidth&&out.length>1)out=out.slice(0,-2)+'…';write(out,x,y,px,color,align)}
 function wrap(s:string,x:number,y:number,w:number,px:number,rows:number,color=WHITE,align:CanvasTextAlign='left'){
  font(px);const lines:string[]=[];let line='';for(const word of s.trim().split(/\s+/)){if(line&&c.measureText(line+' '+word).width>w){lines.push(line);line=word}else line+=(line?' ':'')+word}if(line)lines.push(line);
  lines.slice(0,rows).forEach((s,i)=>fit(s+(i===rows-1&&lines.length>rows?'…':''),x,y+i*px*1.2,w,px,color,align));
 }
 function rule(y:number){c.strokeStyle='#2C455F';c.lineWidth=1;c.beginPath();c.moveTo(68,y);c.lineTo(1012,y);c.stroke()}
 function panel(x:number,y:number,w:number,h:number){c.beginPath();c.roundRect(x,y,w,h,20);c.fillStyle='#0C1621';c.fill();c.strokeStyle='#284B6E';c.stroke()}
 function badge(s:string,x:number,y:number,color=A){font(18);const w=Math.max(130,c.measureText(s).width+50);c.beginPath();c.roundRect(x-w/2,y-26,w,40,20);c.strokeStyle=color;c.lineWidth=2;c.stroke();write(s,x,y,18,color,'center')}
 function card(x:number,y:number,rank:string,suit:string,color:string,angle=0,scale=1,back=false){
  c.save();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);c.beginPath();c.roundRect(-65,-95,130,190,10);c.fillStyle='#0C1521';c.fill();c.strokeStyle=color;c.lineWidth=2;c.stroke();
  c.beginPath();c.roundRect(-57,-87,114,174,6);c.strokeStyle='#36506B';c.lineWidth=1;c.stroke();
  if(back){c.save();c.beginPath();c.rect(-52,-81,104,162);c.clip();c.strokeStyle=color;c.globalAlpha=.35;for(let k=-180;k<180;k+=18){c.beginPath();c.moveTo(k,-90);c.lineTo(k+180,90);c.stroke();c.beginPath();c.moveTo(k,90);c.lineTo(k+180,-90);c.stroke()}c.restore();write('M',0,18,45,color,'center')}
  else{write(rank,-47,-57,27,WHITE);write(suit,0,31,65,color,'center');c.save();c.rotate(Math.PI);write(rank,-47,-57,27,WHITE);c.restore();if(['K','Q','J'].includes(rank)){c.strokeStyle=color;c.beginPath();c.moveTo(-27,-30);c.lineTo(-30,-45);c.lineTo(-12,-36);c.lineTo(0,-52);c.lineTo(12,-36);c.lineTo(30,-45);c.lineTo(27,-30);c.closePath();c.stroke()}}
  c.restore();
 }
 function pokerChip(x:number,y:number,r:number,color:string){c.save();c.translate(x,y);c.fillStyle='#101D2C';c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fill();c.strokeStyle=color;c.lineWidth=8;c.setLineDash([10,10]);c.stroke();c.setLineDash([]);c.lineWidth=2;c.beginPath();c.arc(0,0,r-14,0,Math.PI*2);c.stroke();write('♠',0,16,r*.8,color,'center');c.restore()}
 function gameArt(y:number){
  c.save();
  if(data.game==='canastra')for(let i=0;i<7;i++)card(351+i*63,y+Math.abs(i-3)*10,String(i+3),'♥',i===6?RED:BLUE,(i-3)*.075,.72);
  else if(data.game==='uno'){
   const colors=[RED,BLUE,'#3BAF7D','#D8B43F'];['+2','↻','⊘','7'].forEach((s,i)=>{c.save();c.translate(410+i*88,y+Math.abs(i-1.5)*12);c.rotate((i-1.5)*.15);c.fillStyle=colors[i];c.beginPath();c.roundRect(-58,-78,116,156,14);c.fill();c.strokeStyle=WHITE;c.lineWidth=3;c.stroke();c.beginPath();c.ellipse(0,0,40,65,.45,0,Math.PI*2);c.stroke();write(s,0,16,s.length>1?35:53,WHITE,'center');c.restore()})
  }else if(data.game==='poker'){
   ['10','J','Q','K','A'].forEach((s,i)=>card(392+i*73,y+Math.abs(i-2)*12,s,'♠',BLUE,(i-2)*.14,.76,data.variant==='five_card_draw'));pokerChip(290,y+44,37,BLUE);pokerChip(798,y+44,37,RED)
  }else if(data.game==='blackjack'){card(485,y,'A','♠',BLUE,-.17,.9);card(595,y-12,'K','♥',RED,.17,.9);pokerChip(730,y+40,40,RED)}
  else if(data.game==='pife'){['7','8','9'].forEach((s,i)=>card(450+i*91,y+Math.abs(i-1)*12,s,'♥',RED,(i-1)*.17,.8))}
  else if(data.game==='truco'){card(486,y,'1','⚔',BLUE,-.18,.88);card(594,y-12,'1','♣',RED,.18,.88)}
  else {card(475,y,'K','♠',BLUE,-.18,.85);card(596,y-12,'Q','♥',RED,.18,.85)}
  c.restore();
 }
 c.fillStyle='#080A0E';c.fillRect(0,0,1080,H);const glow=c.createRadialGradient(1000,20,10,950,50,H*.8);glow.addColorStop(0,'#153756');glow.addColorStop(1,'#080A0E');c.fillStyle=glow;c.fillRect(0,0,1080,H);
 // Quiet, game-specific edge details frame the outcome; never obscure text.
 c.save();c.globalAlpha=.2;if(data.game==='uno'){card(-22,H*.48,'+2','↻',RED,-.2,2);card(1102,H*.48,'7','⊘',BLUE,.2,2)}else{card(-28,H*.48,data.game==='truco'?'1':'K',data.game==='truco'?'⚔':'♠',BLUE,-.2,2.3);card(1108,H*.48,data.game==='truco'?'7':'Q',data.game==='truco'?'⚔':'♥',RED,.2,2.3)}c.restore();
 c.fillStyle=BLUE;c.fillRect(68,56,565,4);c.fillStyle=RED;c.fillRect(633,56,379,4);
 try{const logo=new Image();logo.src='/icons/monogram.svg';await logo.decode();c.drawImage(logo,60,91,90,90)}catch{write('MM',68,153,40,BLUE)}
 write('MESA MARCADA',173,139,29);write('PÓS-JOGO',173,173,18,BLUE);
 const artY=story?380:290;gameArt(artY);
 // Actual custom crest, not a stock emblem pretending to be the league's.
 if(data.league&&crestSvg){const logo=new Image();logo.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(crestSvg);await logo.decode();c.drawImage(logo,838,92,114,133)}
 const leagueY=story?550:440;
 if(data.league)fit(data.league.name.toUpperCase(),540,leagueY,850,23,MUTED,'center');
 else write('ENCONTRO ENTRE AMIGOS',540,leagueY,20,MUTED,'center');
 const titleY=leagueY+67;wrap(data.title.toUpperCase(),540,titleY,936,58,2,WHITE,'center');
 const variant=(data.game==='truco'?'Truco · ':'')+(VARIANT_NAMES[data.variant||'']||GAME_META[data.game].name)+(data.target&&['uno','pife','pontinho'].includes(data.game)?' · '+(data.game==='pontinho'?'Limite':'Meta')+' de '+data.target+' '+(data.game==='pife'?'vitórias':'pontos'):'');
 fit(variant.toUpperCase(),540,titleY+112,920,23,MUTED,'center');
 const resultY=story?890:745;
 if(paired){
  const teams=data.teams!;teams.forEach((t,i)=>{const x=i===0?302:778,col=i===0?BLUE:RED;fit(new Intl.NumberFormat('pt-BR').format(t.score),x,resultY,420,152,col,'center',72);wrap(t.names.join(' & '),x,resultY+64,416,32,2,WHITE,'center');write(t.label.toUpperCase(),x,resultY+150,17,col,'center');if(t.winner)badge('VENCEDORES',x,resultY+198,col)});write('×',540,resultY-34,64,MUTED,'center');
 }else{
  write(chip?data.winner_label.toUpperCase():data.game==='pontinho'?'ÚLTIMO DE PÉ':'VENCEDOR DA PARTIDA',540,resultY-66,19,A,'center');
  wrap(text.winners,540,resultY+4,880,70,2,A,'center');
  if(!chip){const winning=data.lines.filter(l=>l.winner);if(winning.length===1&&data.game!=='pontinho'){const y=resultY+150;write(String(winning[0].value),540,y,76,A,'center');write(data.game==='pife'?'VITÓRIAS':'PONTOS',540,y+33,17,MUTED,'center')}}
 }
 const awards=(data.awards||[]).filter(a=>MEDALS.some(m=>m.id===a.medal_id));
 const awardsY=H-272,linesY=story?1240:970;
 if(!chip&&!paired&&data.lines.length){
  rule(linesY-25);write(data.game==='pontinho'?'SITUAÇÃO FINAL':'PLACAR FINAL',68,linesY,16,MUTED);
  const rows=data.lines.slice(0,6),room=(awards.length?awardsY-22:H-145)-linesY;
  const columns=story?1:2,rowHeight=Math.min(story?46:32,room/Math.ceil(rows.length/columns));
  rows.forEach((r,i)=>{const col=i%columns,row=Math.floor(i/columns),x=68+col*490,y=linesY+35+row*rowHeight,w=columns===1?944:454;fit(r.label,x,y,w-150,20,r.winner?BLUE:WHITE);write(String(r.value),x+w,y,22,r.winner?BLUE:MUTED,'right');if(r.eliminated&&story)write('Eliminado',x+w-110,y,16,RED,'right')});
  if((data.participants||0)>rows.length)write('+'+(data.participants-rows.length)+' participantes no resumo do evento',68,linesY+35+Math.ceil(rows.length/columns)*rowHeight,14,MUTED);
 }
 if(awards.length){panel(68,awardsY,944,137);const first=awards[0],medal=MEDALS.find(m=>m.id===first.medal_id)!;c.save();c.translate(123,awardsY+65);c.strokeStyle=BLUE;c.lineWidth=3;c.beginPath();c.moveTo(-23,-39);c.lineTo(-12,-16);c.lineTo(0,-23);c.lineTo(-7,-39);c.closePath();c.stroke();c.beginPath();c.moveTo(7,-39);c.lineTo(0,-23);c.lineTo(12,-16);c.lineTo(23,-39);c.closePath();c.stroke();c.beginPath();c.arc(0,7,24,0,Math.PI*2);c.stroke();write('★',0,15,24,BLUE,'center');c.restore();write('CONQUISTA DA PARTIDA',180,awardsY+34,16,BLUE);fit(medal.title+' · '+first.player_name,180,awardsY+75,795,30);fit((medal.levels[first.level_index]?.name||'')+(awards.length>1?' · +'+(awards.length-1)+' conquista(s) nesta partida':''),180,awardsY+109,795,18,MUTED)}
 rule(H-109);write(text.date.toUpperCase(),68,H-68,20,MUTED);write(`${data.participants} PARTICIPANTES`,1012,H-68,17,MUTED,'right');write(text.footer,540,H-30,15,MUTED,'center');
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Não foi possível gerar o PNG.')),'image/png'));
}
