import {ImageResponse} from "next/og";

/** Borderless Dark Cards icon for Safari, iOS home screen and PWA. */
export function renderBrandIcon(size:number){
 return new ImageResponse(
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={size} height={size}>
   <rect width="512" height="512" fill="#080A0E"/>
   <path d="M100 364V150L220 247L251 219V275L224 301L159 249V364Z" fill="#F1F5FB"/>
   <path d="M261 219L291 247L412 150V364H353V249L288 301L261 275Z" fill="#258BFF"/>
   <path d="M256 275C246 289 220 302 220 319C220 334 232 343 246 338C251 336 254 333 256 329C259 333 262 336 267 338C281 343 293 334 293 319C293 302 266 289 256 275Z" fill="#F1F5FB"/>
   <path d="M249 325H263L270 349H242Z" fill="#F1F5FB"/>
  </svg>,{width:size,height:size});
}