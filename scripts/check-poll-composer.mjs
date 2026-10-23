import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const page=read("app/painel/mobile-first.tsx");
const composer=read("app/painel/poll-composer.tsx");
const css=read("app/painel/poll-composer.css");

const eventInfo=page.indexOf('<h2>Informações do evento</h2>');
const composerInInfo=page.indexOf('<PollComposer key=');
const bottomVoting=page.indexOf('<div id="event-polls"');
assert.ok(eventInfo>=0&&composerInInfo>eventInfo&&bottomVoting>composerInInfo,
  "The creator must only appear in the event information card, above the voting list.");
assert.equal((page.match(/<PollComposer /g)||[]).length,1,"The poll composer must render once.");
for(const obsolete of ['Opções, uma por linha','showCreatePoll','setShowCreatePoll','<h2>Criar enquete</h2>']){
 assert.ok(!page.includes(obsolete),"Remove obsolete poll composer: "+obsolete);
}
assert.ok(page.includes('Ver enquetes abertas →')&&page.includes('pollVotes.length'),
 "Existing poll voting and navigation must remain untouched.");
assert.ok(page.includes('await refreshScope("polls")'),
 "New poll must refresh existing voting list after creation.");
assert.ok(page.includes('session_poll_options')&&page.includes('session_polls'),
 "Keep existing Supabase poll persistence.");
for(const behavior of [
 'aria-expanded={open}', 'setOpen(value=>!value)', 'setOpen(false)',
 'function addOption()', 'function removeOption(index:number)',
 'onKeyDown={e=>{if(e.key==="Enter")',
 'options.some(item=>item.toLocaleLowerCase("pt-BR")',
 'options.length<2', 'MAX_OPTIONS=41','setOptions([])',
 'aria-label={"Remover opção "+option}', 'mm-poll-composer-item',
 'onCreate:(question:string,options:string[])=>Promise<void>'
]){
 assert.ok(composer.includes(behavior),"Poll option card or UI behavior missing: "+behavior);
}
assert.ok(css.includes('@media(max-width:560px)')&&css.includes('min-height:44px'),
 "Mobile-friendly touch targets missing.");
console.log("✓ Criador de enquete dentro de Informações do evento, sem formulário duplicado.");
