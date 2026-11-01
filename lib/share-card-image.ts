/** Invoke the native share API synchronously from the user's click. */
export async function shareCardImage(file:File,title='Mesa Marcada · pós-jogo'):Promise<'shared'|'unsupported'|'cancelled'>{
 if(!navigator.share||!navigator.canShare?.({files:[file]}))return 'unsupported';
 try{await navigator.share({title,files:[file]});return 'shared'}catch(error){if(error instanceof Error&&error.name==='AbortError')return 'cancelled';throw error}
}
