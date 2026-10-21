"use client";

import {useEffect,useRef} from "react";

/**
 * Mantém o conteúdo da página imóvel enquanto uma janela está aberta.
 * Funciona também no Safari/iOS, que ignora overflow:hidden no body em
 * algumas situações e move a página ao abrir o teclado.
 */
export function useStableDialog(open:boolean,screen:string,onClose:()=>void){
  const overlayRef=useRef<HTMLDivElement>(null);
  const currentScreenRef=useRef(screen);
  const onCloseRef=useRef(onClose);
  currentScreenRef.current=screen;
  onCloseRef.current=onClose;

  useEffect(()=>{
    if(!open)return;
    const overlay=overlayRef.current;
    if(!overlay)return;

    const body=document.body;
    const root=document.documentElement;
    const scrollY=window.scrollY;
    const originScreen=currentScreenRef.current;
    const previouslyFocused=document.activeElement instanceof HTMLElement
      ?document.activeElement:null;

    const originalBody={
      position:body.style.position,
      top:body.style.top,
      left:body.style.left,
      right:body.style.right,
      width:body.style.width,
      overflow:body.style.overflow,
      overscrollBehavior:body.style.overscrollBehavior,
      paddingRight:body.style.paddingRight
    };
    const originalRoot={
      scrollBehavior:root.style.scrollBehavior,
      overscrollBehavior:root.style.overscrollBehavior
    };

    // Com a barra de rolagem removida, reserva seu espaço para não deslocar
    // cartões, menus ou botões lateralmente no desktop.
    const scrollbarWidth=Math.max(0,window.innerWidth-root.clientWidth);
    if(scrollbarWidth>0){
      const padding=parseFloat(window.getComputedStyle(body).paddingRight)||0;
      body.style.paddingRight=(padding+scrollbarWidth)+"px";
    }
    root.style.scrollBehavior="auto";
    root.style.overscrollBehavior="none";
    body.style.position="fixed";
    body.style.top="-"+scrollY+"px";
    body.style.left="0";
    body.style.right="0";
    body.style.width="100%";
    body.style.overflow="hidden";
    body.style.overscrollBehavior="none";

    // O restante da tela também fica fora da navegação pelo teclado/leitor.
    const background=Array.from(document.querySelectorAll<HTMLElement>(
      ".sidebar, #main-content, .mm-fab"
    ));
    const previousInert=background.map(node=>node.inert);
    background.forEach(node=>{node.inert=true});

    // O teclado do iPhone reduz e pode deslocar a viewport visual.
    // A janela permanece sobre a área realmente visível; só ela rola.
    const visual=window.visualViewport;
    function syncVisualViewport(){
      const height=visual?.height||window.innerHeight;
      overlay?.style.setProperty("--mm-dialog-viewport-height",Math.round(height)+"px");
      overlay?.style.setProperty("--mm-dialog-viewport-top",Math.round(visual?.offsetTop||0)+"px");
    }
    syncVisualViewport();
    visual?.addEventListener("resize",syncVisualViewport);
    visual?.addEventListener("scroll",syncVisualViewport);
    window.addEventListener("resize",syncVisualViewport);

    const dialog=overlay.querySelector<HTMLElement>('[role="dialog"]');
    const closeButton=dialog?.querySelector<HTMLElement>('[aria-label="Fechar"]');
    const focusFrame=requestAnimationFrame(()=>closeButton?.focus({preventScroll:true}));

    function handleDialogKeys(event:KeyboardEvent){
      if(event.key==="Escape"){
        event.preventDefault();
        onCloseRef.current();
      }
      if(event.key!=="Tab"||!dialog)return;
      const candidates=Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )).filter(node=>node.getClientRects().length>0&&!node.inert);
      if(!candidates.length){
        event.preventDefault();
        dialog.focus({preventScroll:true});
        return;
      }
      const first=candidates[0];
      const last=candidates[candidates.length-1];
      if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){
        event.preventDefault();
        last.focus({preventScroll:true});
      }else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){
        event.preventDefault();
        first.focus({preventScroll:true});
      }
    }
    window.addEventListener("keydown",handleDialogKeys);

    return()=>{
      cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown",handleDialogKeys);
      window.removeEventListener("resize",syncVisualViewport);
      visual?.removeEventListener("resize",syncVisualViewport);
      visual?.removeEventListener("scroll",syncVisualViewport);
      overlay.style.removeProperty("--mm-dialog-viewport-height");
      overlay.style.removeProperty("--mm-dialog-viewport-top");
      background.forEach((node,index)=>{node.inert=previousInert[index]});

      Object.assign(body.style,originalBody);
      // Restaura a posição anterior ao diálogo. Se criar um evento levou o
      // usuário à página do novo evento, começa do topo sem animação.
      window.scrollTo({top:currentScreenRef.current===originScreen?scrollY:0,behavior:"auto"});
      Object.assign(root.style,originalRoot);
      if(currentScreenRef.current===originScreen){
        previouslyFocused?.focus({preventScroll:true});
      }
    };
  },[open]);

  return overlayRef;
}
