import {GAME_META,VARIANT_NAMES} from '@/lib/games';
import {cardText,type PostGameCard} from '@/lib/post-game-card';

/** Produce the same PNG used for preview, download and native sharing. */
export async function makePostGameImage(data:PostGameCard):Promise<Blob>{
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Este navegador não conseguiu preparar a imagem.');
 const text=cardText(data),accent=data.game==='blackjack'||data.game==='pife'?'#FF6976':'#69B5FF';
 ctx.fillStyle='#080A0E';ctx.fillRect(0,0,1080,1350);
 const glow=ctx.createRadialGradient(1000,30,20,950,100,900);glow.addColorStop(0,'#143454');glow.addColorStop(1,'#080A0E');ctx.fillStyle=glow;ctx.fillRect(0,0,1080,1350);
 ctx.fillStyle='#258BFF';ctx.fillRect(68,60,600,5);ctx.fillStyle='#FF424D';ctx.fillRect(668,60,344,5);
 function write(value:string,x:number,y:number,size:number,color='#F1F5FB',weight=600){ctx!.font=`${weight} ${size}px Arial, sans-serif`;ctx!.fillStyle=color;ctx!.fillText(value,x,y)}
 function wrap(value:string,x:number,y:number,width:number,size:number,maxLines:number,color='#F1F5FB',weight=700){
  ctx!.font=`${weight} ${size}px Arial, sans-serif`;const words=value.replace(/\s+/g,' ').trim().split(' ');const lines:string[]=[];let line='';
  for(const word of words){if(ctx!.measureText((line?line+' ':'')+word).width<=width){line+=(line?' ':'')+word;continue}if(line)lines.push(line);line=word;}
  if(line)lines.push(line);for(let i=0;i<Math.min(lines.length,maxLines);i++){let row=lines[i];while(ctx!.measureText(row).width>width&&row.length>1)row=row.slice(0,-1);if(i===maxLines-1&&lines.length>maxLines){row+='…';while(ctx!.measureText(row).width>width)row=row.slice(0,-2)+'…'}write(row,x,y+i*size*1.3,size,color,weight)}
 }
 // Same-origin vector monogram; no third-party photos or trackers.
 try{const logo=new Image();logo.src='/icons/monogram.svg';await logo.decode();ctx.drawImage(logo,62,101,88,88)}catch{write('MM',68,161,40,accent,800)}
 write('MESA MARCADA',174,151,27,'#D7E7FA',700);write('PÓS-JOGO',174,185,17,accent,700);
 ctx.save();ctx.translate(875,158);ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.globalAlpha=.55;ctx.beginPath();ctx.arc(0,0,57,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(0,0,48,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.9;ctx.textAlign='center';write(data.game==='blackjack'?'21':GAME_META[data.game].symbol,0,20,53,accent,800);ctx.textAlign='left';ctx.restore();
 write(GAME_META[data.game].name.toUpperCase(),68,275,22,accent,800);
 wrap(data.variant?VARIANT_NAMES[data.variant]||data.variant:'Partida presencial',68,315,944,24,2,'#9BB0CA',500);
 wrap(data.title,68,430,944,58,3);
 ctx.strokeStyle='#2D4058';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(68,645);ctx.lineTo(1012,645);ctx.stroke();
 write(data.winner_names.length?data.winner_label.toUpperCase():'ENCONTRO CONCLUÍDO',68,700,18,accent,700);
 wrap(text.winners,68,760,944,40,3,'#F1F5FB',700);
 if(data.lines.length){
  write('PLACAR FINAL',68,943,16,'#829BB9',700);
  data.lines.slice(0,6).forEach((row,i)=>{const y=984+i*37;wrap(row.label,68,y,740,22,1,'#C8D8ED',500);ctx!.textAlign='right';write(new Intl.NumberFormat('pt-BR').format(row.value),1012,y,23,accent,700);ctx!.textAlign='left'});
 }
 write(text.date,68,1255,22,'#B1C4DE',500);write(`${data.participants} participantes`,68,1293,18,'#7E95B3',500);
 ctx.textAlign='right';write(text.footer,1012,1293,15,'#7E95B3',500);ctx.textAlign='left';
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Não foi possível gerar o PNG.')),'image/png'));
}
