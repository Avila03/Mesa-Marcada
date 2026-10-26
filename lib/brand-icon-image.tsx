import {ImageResponse} from "next/og";
import {BRAND_MONOGRAM_SVG} from "./brand-monogram";

/** Render real raster PNG for Safari/iOS Home Screen and web app icons. */
export function makeBrandIcon(size:number){
 const svgUrl="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(BRAND_MONOGRAM_SVG);
 return new ImageResponse(
  <div style={{display:"flex",alignItems:"center",justifyContent:"center",
   width:"100%",height:"100%",background:"#080A0E"}}>
   <img src={svgUrl} width={Math.round(size*.80)} height={Math.round(size*.80)}
    alt="Mesa Marcada"/>
  </div>,
  {width:size,height:size}
 );
}
