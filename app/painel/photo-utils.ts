/** Processa fotos no aparelho antes de enviar ao Storage privado.
 * Remove metadados EXIF e limita a saída a 512x512 pixels. */
export async function prepareProfilePhoto(input:File):Promise<File>{
  if(!input.type.startsWith("image/")){
    throw new Error("Escolha uma imagem do seu aparelho.");
  }
  if(input.size>8*1024*1024){
    throw new Error("A foto original deve ter até 8 MB.");
  }
  const url=URL.createObjectURL(input);
  try{
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>reject(new Error("Este formato não pode ser aberto pelo navegador. Escolha JPG, PNG ou WebP."));
      img.src=url;
    });
    if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth>9000||image.naturalHeight>9000){
      throw new Error("As dimensões da foto não são compatíveis.");
    }
    const canvas=document.createElement("canvas");
    canvas.width=512;canvas.height=512;
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("Não foi possível preparar a foto.");
    const side=Math.min(image.naturalWidth,image.naturalHeight);
    const x=(image.naturalWidth-side)/2;
    const y=(image.naturalHeight-side)/2;
    ctx.drawImage(image,x,y,side,side,0,0,512,512);
    const convert=(type:string,quality:number)=>new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,type,quality));
    let blob=await convert("image/webp",0.82);
    if(!blob||blob.type!=="image/webp"){
      blob=await convert("image/jpeg",0.82);
    }
    if(!blob||blob.size>2*1024*1024){
      throw new Error("A foto ficou muito grande; tente outra imagem.");
    }
    const ext=blob.type==="image/webp"?"webp":"jpg";
    return new File([blob],"avatar-"+crypto.randomUUID()+"."+ext,{type:blob.type});
  }finally{
    URL.revokeObjectURL(url);
  }
}
