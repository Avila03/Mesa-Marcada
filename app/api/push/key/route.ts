import {NextResponse} from "next/server";
export async function GET(){
 return NextResponse.json({key:process.env.WEB_PUSH_PUBLIC_KEY||null},{
  headers:{"Cache-Control":"no-store"}
 });
}
