import type {ReactNode} from "react";

export type UiIconName =
  "home"|"calendar"|"cards"|"trophy"|"user"|"settings"|"log-out"|
  "plus"|"book-open"|"users"|"credit-card"|"smartphone"|
  "check"|"arrow-right"|"clock"|"map-pin"|"spade"|"diamond"|
  "club"|"sparkles"|"close"|"bell"|"grid"|"clipboard";

export default function UiIcon({name,size=22,className}:{
  name:UiIconName;size?:number;className?:string;
}){
  const drawing:Record<UiIconName,ReactNode>={
    home:<><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-8h6v8"/></>,
    calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7.5 14h2M12 14h2M7.5 17.5h2"/></>,
    cards:<><rect x="5" y="4" width="13" height="17" rx="2"/><path d="m9 12 2.5-3 2.5 3-2.5 3zM3 8V5a3 3 0 0 1 3-3h10M18 7h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3"/></>,
    trophy:<><path d="M8 3h8v8a4 4 0 0 1-8 0zM8 5H5a2 2 0 0 0 0 4h3M16 5h3a2 2 0 0 1 0 4h-3M12 15v4M8 21h8M9 19h6"/></>,
    user:<><circle cx="12" cy="8" r="3.8"/><path d="M4.2 20c.3-4.1 3.2-6.2 7.8-6.2s7.5 2.1 7.8 6.2"/></>,
    settings:<><circle cx="12" cy="12" r="3.1"/><path d="m10 2-.5 2.1a8.5 8.5 0 0 0-2.2 1.3L5.3 4.3 3.4 7.6l1.5 1.7a8.5 8.5 0 0 0 0 2.6l-1.5 1.7 1.9 3.3 2-.9a8.5 8.5 0 0 0 2.2 1.3L10 20h4l.5-2.7a8.5 8.5 0 0 0 2.2-1.3l2 .9 1.9-3.3-1.5-1.7a8.5 8.5 0 0 0 0-2.6l1.5-1.7-1.9-3.3-2 1.1a8.5 8.5 0 0 0-2.2-1.3L14 2z" transform="translate(0 1)"/></>,
    "log-out":<><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 7l5 5-5 5M19 12H9"/></>,
    plus:<path d="M12 4v16M4 12h16"/>,
    "book-open":<><path d="M12 20V5c-2.2-1.4-5.4-1.6-9-.8v15c3.8-.9 7-.7 9 .8ZM12 5c2.2-1.4 5.4-1.6 9-.8v15c-3.8-.9-7-.7-9 .8Z"/></>,
    users:<><circle cx="9" cy="8" r="3"/><path d="M2 20v-2c0-3 3-5 7-5s7 2 7 5v2M17 5a3 3 0 0 1 0 6M18 14c3 0 4 2 4 4v2"/></>,
    "credit-card":<><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h5"/></>,
    smartphone:<><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/></>,
    check:<path d="m4 12 5 5L20 6"/>,
    "arrow-right":<><path d="M4 12h16m-7-7 7 7-7 7"/></>,
    clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    "map-pin":<><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    spade:<path d="M12 3c-3.2 5.4-8 7.2-8 11a4.2 4.2 0 0 0 7.7 2.2L10 21h4l-1.7-4.8A4.2 4.2 0 0 0 20 14c0-3.8-4.8-5.6-8-11Z" fill="currentColor" stroke="none"/>,
    diamond:<path d="m12 2 8 10-8 10L4 12Z" fill="currentColor" stroke="none"/>,
    club:<><circle cx="12" cy="7" r="4"/><circle cx="7" cy="13" r="4"/><circle cx="17" cy="13" r="4"/><path d="m10 16-1 5h6l-1-5" fill="currentColor"/></>,
    sparkles:<><path d="m12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3Z"/><path d="M19 2v4M17 4h4"/></>,
    close:<path d="M5 5 19 19M19 5 5 19"/>,
    bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9ZM10 21h4"/></>,
    grid:<><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></>,
    clipboard:<><rect x="4" y="4" width="16" height="18" rx="2"/><rect x="8" y="2" width="8" height="5" rx="1"/><path d="M8 12h8M8 16h6"/></>
  };
  return <svg xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24" width={size} height={size}
    className={className} aria-hidden="true" focusable="false"
    fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round">{drawing[name]}</svg>;
}
