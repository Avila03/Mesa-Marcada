import {GAME_META} from '@/lib/games';
import {cardDimensions,type CardFormat} from '@/lib/post-game-card';
import {leagueCardDate,leagueCardMetrics,type LeagueFinalCard} from '@/lib/league-final-card';

const BLUE='#258BFF',RED='#FF424D',WHITE='#F1F5FB',MUTED='#A9BED6';

/** The same PNG supplies the preview, download and native share. */
export async function makeLeagueFinalImage(data:LeagueFinalCard,format:CardFormat,crestSvg:string):Promise<Blob>{
 const canvas=document.createElement('canvas'),size=cardDimensions(format);
 canvas.width=size.width;canvas.height=size.height;
 const c=canvas.getContext('2d');
 if(!c)throw new Error('Este navegador não conseguiu preparar a imagem.');
 await document.fonts?.ready;
 const story=format==='story',H=size.height,accent=['blackjack','pife'].includes(data.game)?RED:BLUE;
 const fonts='Inter, Arial, sans-serif';
 function font(px:number,weight=700){c!.font=`${weight} ${px}px ${fonts}`}
 function text(s:string,x:number,y:number,px:number,color=WHITE,align:CanvasTextAlign='left',weight=700){
  font(px,weight);c!.fillStyle=color;c!.textAlign=align;c!.fillText(s,x,y);
 }
 function fit(s:string,x:number,y:number,width:number,px:number,color=WHITE,align:CanvasTextAlign='left',min=18){
  font(px);while(c!.measureText(s).width>width&&px>min)font(--px);
  const chars=Array.from(s);
  while(c!.measureText(chars.join('')).width>width&&chars.length>1){chars.splice(-2,2,'…')}
  text(chars.join(''),x,y,px,color,align);
 }
 function wrap(s:string,x:number,y:number,width:number,px:number,lines=2,color=WHITE){
  font(px);const rows:string[]=[];let line='';
  for(const word of s.trim().split(/\s+/)){
   if(line&&c!.measureText(line+' '+word).width>width){rows.push(line);line=word}
   else line+=(line?' ':'')+word;
  }
  if(line)rows.push(line);
  rows.slice(0,lines).forEach((row,i)=>fit(row+(i===lines-1&&rows.length>lines?'…':''),x,y+i*px*1.1,width,px,color,'center'));
 }
 function line(y:number){c!.beginPath();c!.moveTo(68,y);c!.lineTo(1012,y);c!.strokeStyle='#365675';c!.lineWidth=1;c!.stroke()}
 function box(x:number,y:number,w:number,h:number,fill:string,stroke:string,r=14){
  c!.beginPath();c!.roundRect(x,y,w,h,r);c!.fillStyle=fill;c!.fill();c!.strokeStyle=stroke;c!.lineWidth=1.5;c!.stroke();
 }
 function sideCard(x:number,y:number,angle:number,color:string,mark:string){
  c!.save();c!.translate(x,y);c!.rotate(angle);c!.globalAlpha=.18;
  box(-105,-265,210,530,'#0C1825',color,16);
  box(-92,-250,184,500,'#0C1825',color,10);
  text(mark,0,25,92,color,'center');
  c!.restore();
 }
 function trophy(y:number){
  c!.save();c!.translate(540,y);
  const silver=c!.createLinearGradient(-150,-140,170,140);
  for(const [stop,color] of [[0,'#547A9A'],[.18,'#EDF7FF'],[.35,'#729CBF'],[.5,'#E6F5FF'],[.7,'#345777'],[.86,'#B8DBF7'],[1,'#557D9C']] as const)silver.addColorStop(stop,color);
  const blue=c!.createLinearGradient(-100,0,100,0);blue.addColorStop(0,'#0754A4');blue.addColorStop(.5,'#4BB6FF');blue.addColorStop(1,'#0A4A8B');
  // Metallic laurels, placed beside the trophy and outside the name area.
  for(const side of [-1,1]){
   c!.strokeStyle='#628EB4';c!.lineWidth=3;c!.beginPath();
   c!.moveTo(side*105,135);c!.bezierCurveTo(side*260,95,side*284,-25,side*206,-128);c!.stroke();
   for(let i=0;i<10;i++){
    const t=i/9,x=side*(118+139*Math.sin(t*Math.PI*.65)),leafY=121-235*t;
    c!.save();c!.translate(x,leafY);c!.rotate(side*(.55-t*1.25));
    c!.beginPath();c!.moveTo(0,17);c!.bezierCurveTo(-17,-2,-16,-31,0,-47);c!.bezierCurveTo(14,-24,13,2,0,17);
    c!.fillStyle=silver;c!.fill();c!.strokeStyle='#8CBFE3';c!.lineWidth=.8;c!.stroke();c!.restore();
   }
  }
  c!.strokeStyle=silver;c!.lineWidth=12;
  for(const side of [-1,1]){
   c!.beginPath();c!.moveTo(side*109,-108);c!.bezierCurveTo(side*197,-151,side*195,-41,side*135,-21);c!.lineTo(side*107,2);c!.stroke();
  }
  c!.beginPath();c!.moveTo(-119,-124);c!.lineTo(119,-124);
  c!.bezierCurveTo(117,-24,88,32,18,58);c!.lineTo(18,101);c!.lineTo(75,119);
  c!.lineTo(-75,119);c!.lineTo(-18,101);c!.lineTo(-18,58);c!.bezierCurveTo(-88,32,-117,-24,-119,-124);
  c!.closePath();c!.fillStyle=silver;c!.fill();c!.strokeStyle='#9DD4FF';c!.lineWidth=2;c!.stroke();
  c!.beginPath();c!.ellipse(0,-124,119,12,0,0,Math.PI*2);c!.fillStyle='#102B43';c!.fill();c!.strokeStyle='#C8E7FC';c!.stroke();
  box(-94,118,188,21,'#10263A','#639DC9',7);c!.fillStyle=blue;c!.fillRect(-76,123,152,6);
  text(data.game==='uno'?'↻':GAME_META[data.game].symbol,0,-26,80,'#0B3762','center');
  c!.restore();
 }

 c.fillStyle='#080A0E';c.fillRect(0,0,1080,H);
 const glow=c.createRadialGradient(910,80,0,810,180,H*.8);glow.addColorStop(0,'#123455');glow.addColorStop(1,'#080A0E');
 c.fillStyle=glow;c.fillRect(0,0,1080,H);
 sideCard(-30,H*.47,-.2,BLUE,data.game==='truco'?'1':data.game==='uno'?'+2':'K');
 sideCard(1110,H*.47,.2,RED,data.game==='truco'?'7':data.game==='uno'?'↻':'Q');
 c.fillStyle=BLUE;c.fillRect(68,42,565,4);c.fillStyle=RED;c.fillRect(633,42,379,4);
 const logo=new Image();logo.src='/icons/monogram.svg';await logo.decode();c.drawImage(logo,51,65,111,111);
 text('MESA MARCADA',177,115,30);text('ENCERRAMENTO DA LIGA',177,151,19,BLUE);
 const crest=new Image();crest.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(crestSvg);await crest.decode();
 c.drawImage(crest,480,story?220:178,120,140);
 fit(data.leagueName.toUpperCase(),540,story?410:349,900,30,MUTED,'center');
 trophy(story?644:514);
 text(data.championsCount>1?`TÍTULO COMPARTILHADO · ${data.championsCount} JOGADORES`:'CAMPEÃO DA MODALIDADE',540,story?851:690,19,MUTED,'center');
 fit(data.modeLabel.toUpperCase(),540,story?903:735,920,story?32:26,MUTED,'center');
 const name=data.featured.name.toUpperCase();font(story?120:110);
 if(c.measureText(name).width<=920)text(name,540,story?1090:853,story?120:110,accent,'center');
 else wrap(name,540,story?1025:807,920,story?90:64,2,accent);
 const badgeY=story?1192:944;
 box(300,badgeY-31,480,45,'#0A1521',accent,23);
 text(data.championsCount>1?'COCAMPEÃO DA LIGA':'CAMPEÃO DA LIGA',540,badgeY,23,accent,'center');
 const metricsY=story?1307:1018;
 leagueCardMetrics(data).forEach((metric,i)=>{
  const x=230+i*310;fit(metric.value,x,metricsY,270,story?80:63,accent,'center');
  fit(metric.label,x,metricsY+34,285,18,MUTED,'center');
  if(i<2){c.beginPath();c.moveTo(x+155,metricsY-52);c.lineTo(x+155,metricsY+35);c.strokeStyle='#46637D';c.lineWidth=1;c.stroke()}
 });
 const podiumY=story?1430:1108,rowHeight=story?74:46,gap=story?16:8;
 line(podiumY-48);text('PÓDIO FINAL · '+GAME_META[data.game].name.toUpperCase(),540,podiumY-20,19,MUTED,'center');
 const podium=data.players.filter(p=>p.rank<=3),visible=podium.slice(0,3);
 visible.forEach((player,i)=>{
  const y=podiumY+i*(rowHeight+gap),color=player.rank===1?accent:WHITE;
  box(88,y,904,rowHeight,player.rank===1?'#0C2440':'#0D141D',player.rank===1?accent:'#324B61',10);
  text(player.rank+'º',110,y+rowHeight*.69,24,color);
  fit(player.name,179,y+rowHeight*.69,505,story?28:23,color);
  text(data.financial?`${player.played} resultados`:`${player.wins} vitórias`,965,y+rowHeight*.69,story?24:21,color,'right');
 });
 if(podium.length>visible.length)text(`+${podium.length-visible.length} jogador(es) empatado(s) no pódio · consulte o resumo completo`,540,podiumY+3*(rowHeight+gap)+18,15,MUTED,'center',400);
 if(data.financial&&(story||podium.length<=visible.length))text('Posições da classificação arquivada · valores financeiros omitidos',540,story?1780:1284,14,MUTED,'center',400);
 const footerY=story?1844:1311;
 line(footerY-15);text('CLASSIFICAÇÃO FINAL ARQUIVADA',68,footerY+15,15,MUTED);
 text(leagueCardDate(data.finishedAt).toUpperCase(),1012,footerY+15,17,MUTED,'right');
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Não foi possível gerar o PNG.')),'image/png'));
}
