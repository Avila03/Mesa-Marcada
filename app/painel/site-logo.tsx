import Image from "next/image";

export default function SiteLogo({kind="sidebar"}:{kind?:"sidebar"|"mobile"|"login"}){
  return <div className={"brand mm-site-logo mm-site-logo-"+kind}>
    <Image src="/mesa-marcada-logo.webp" alt="Emblema oficial Mesa Marcada" width={96} height={96}
      priority={kind==="login"} unoptimized className="mm-site-logo-mark"/>
    <div className="brandname">Mesa <em>Marcada</em>
      {kind==="sidebar"&&<span className="brandsub">CLUBE DE JOGOS</span>}
    </div>
  </div>;
}
