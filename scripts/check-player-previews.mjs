import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const seats=read("app/painel/seating-table.tsx");
const screen=read("app/painel/mobile-first.tsx");
const preview=read("app/painel/player-profile-preview.tsx");
const previewStyle=read("app/painel/player-profile-preview.css");
const medals=read("app/painel/player-medals.tsx");
const medalStyle=read("app/painel/player-medals.css");

assert.ok(seats.includes('if(occupant)return <PlayerProfileTrigger'),"Occupied seats need profile preview.");
assert.ok(seats.includes('<PlayerAvatar name={name} photoUrl={photoUrls[occupant.user_id]}/>'),
 "Occupied chairs must render the actual player's photo.");
assert.ok(seats.includes('onClick={()=>select(n)}'),"Free chairs must still allow choosing a seat.");
assert.ok(seats.includes('onClick={()=>onChoose(null)}'),"Keep leave-table function.");
assert.ok(seats.includes('renderChair(0,"50%","11%",true)'),"Blackjack dealer should also show profile.");
assert.ok(screen.includes('profiles={profiles} photoUrls={photoUrls}')&&screen.includes('onOpenProfile={id=>'),
 "Pass real profiles and profile navigation to the table.");
assert.ok(screen.includes('<PlayerProfileTrigger key={g.user_id} variant="attendee"'),
 "Participants must show matching preview.");
for(const t of ['onMouseEnter={openCard}','onMouseLeave={scheduleClose}','onFocus={openCard}',
 'onClick={openCard}','role="dialog"','getBoundingClientRect','createPortal',
 'aria-haspopup="dialog"','Ver perfil completo','profile?.bio','get_player_medal_progress',
 'player_medal_grants','profile_medal_showcase'])
 assert.ok(preview.includes(t),"Missing profile preview behavior: "+t);
assert.ok(previewStyle.includes('position:fixed')&&previewStyle.includes('@media(max-width:600px)'),
 "Mobile touch preview must escape clipped table container.");
for(const t of ['Escolher meus 3 troféus','mm-medals-pin-slots','mm-medals-picker-grid',
 'setDraftPins(previous=>','previous.length<3','aria-pressed={active}',
 'onClick={()=>void save(featured,draftPins,visible).then'])
 assert.ok(medals.includes(t),"Missing trophy selection: "+t);
assert.ok(medalStyle.includes('.mm-medals-pin-slots')&&medalStyle.includes('.mm-medals-picker-choice.chosen'),
 "Three trophy picker styling missing.");
console.log("✓ Poker/Blackjack seats, confirmed users, hover/touch public profiles and three chosen trophies.");
